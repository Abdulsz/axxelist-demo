import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOpenAIClient } from "@/lib/openai";
import type { Listing, SimilarResult } from "@/lib/types";

const DOWNTOWN = { lat: 37.8044, lng: -122.2712 };

const findSimilarInputSchema = z.object({
  listing_id: z.string().uuid(),
  cheaper: z.boolean().optional(),
  closer_to: z.string().optional(),
  must_keep_amenities: z.array(z.string()).optional(),
  limit: z.number().default(3),
});

export type FindSimilarInput = z.infer<typeof findSimilarInputSchema>;

function haversineMi(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthMi = 3958.8;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthMi * Math.asin(Math.sqrt(x));
}

async function generateTradeoff(source: Listing, candidate: Listing): Promise<string> {
  try {
    const openai = getOpenAIClient();
    const completion = (await Promise.race([
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Write one concise rental tradeoff sentence comparing source and candidate.",
          },
          {
            role: "user",
            content: JSON.stringify({ source, candidate }),
          },
        ],
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 30_000)),
    ])) as Awaited<ReturnType<typeof openai.chat.completions.create>>;

    const text = completion.choices[0]?.message?.content?.trim();
    if (text) return text;
  } catch {
    // Fallback below.
  }

  const delta = source.price - candidate.price;
  const cheaperText = delta > 0 ? `$${delta}/mo cheaper` : `$${Math.abs(delta)}/mo pricier`;
  return `${cheaperText}; compare amenities and commute fit before deciding.`;
}

export async function findSimilar(input: FindSimilarInput): Promise<{
  source_listing_id: string;
  results: SimilarResult[];
}> {
  const params = findSimilarInputSchema.parse(input);
  const supabase = createSupabaseServerClient();

  const { data: source, error: sourceError } = await supabase
    .from("listings")
    .select("*")
    .eq("id", params.listing_id)
    .maybeSingle();
  if (sourceError) throw new Error(sourceError.message);
  if (!source) throw new Error("Source listing not found");

  const { data: emb, error: embError } = await supabase
    .from("listing_embeddings")
    .select("embedding")
    .eq("listing_id", source.id)
    .maybeSingle();
  if (embError) throw new Error(embError.message);
  if (!emb?.embedding) throw new Error("Source embedding not found");

  const { data: matches, error: matchError } = await supabase.rpc("match_listings", {
    query_embedding: emb.embedding,
    match_count: 12,
    min_price: 0,
    max_price: params.cheaper ? Math.floor(source.price * 0.9) : 100000,
    min_bedrooms: 0,
    required_pets: null,
  });
  if (matchError) throw new Error(matchError.message);

  const ids = ((matches ?? []) as Array<{ id: string }>).map((row) => row.id).filter((id) => id !== source.id);
  if (!ids.length) return { source_listing_id: source.id, results: [] };

  const { data: candidates, error: candidatesError } = await supabase
    .from("listings")
    .select("*")
    .in("id", ids);
  if (candidatesError) throw new Error(candidatesError.message);

  const target = (params.closer_to ?? "").toLowerCase() === "downtown" ? DOWNTOWN : DOWNTOWN;
  const filtered = (candidates ?? [])
    .filter((candidate) =>
      params.must_keep_amenities?.length
        ? params.must_keep_amenities.every((amenity) => (candidate.amenities ?? []).includes(amenity))
        : true,
    )
    .map((candidate) => ({
      listing: candidate as Listing,
      proximity: haversineMi(candidate.lat, candidate.lng, target.lat, target.lng),
    }))
    .sort((a, b) => a.proximity - b.proximity)
    .slice(0, params.limit);

  const results: SimilarResult[] = [];
  for (const row of filtered) {
    const tradeoff = await generateTradeoff(source as Listing, row.listing);
    results.push({ listing: row.listing, tradeoff });
  }

  return {
    source_listing_id: source.id,
    results,
  };
}
