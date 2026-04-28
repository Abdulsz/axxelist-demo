import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { embedText } from "@/lib/embeddings";
import type { Listing } from "@/lib/types";

const semanticSearchInputSchema = z.object({
  query: z.string().min(2),
  bedrooms_min: z.number().optional(),
  price_min: z.number().optional(),
  price_max: z.number().optional(),
  pets: z.enum(["cats", "dogs", "both"]).optional(),
  limit: z.number().default(6),
});

type SemanticSearchInput = z.infer<typeof semanticSearchInputSchema>;

export async function semanticSearch(input: SemanticSearchInput): Promise<{
  listings: Listing[];
  scores: Record<string, number>;
}> {
  const params = semanticSearchInputSchema.parse(input);
  const supabase = createSupabaseServerClient();
  const embedding = await embedText(params.query);

  const { data, error } = await supabase.rpc("match_listings", {
    query_embedding: embedding,
    match_count: params.limit,
    min_price: params.price_min ?? 0,
    max_price: params.price_max ?? 100000,
    min_bedrooms: params.bedrooms_min ?? 0,
    required_pets: params.pets ?? null,
  });

  if (error) throw new Error(error.message);
  const idScoreRows = (data ?? []) as Array<{ id: string; similarity: number }>;
  const ids = idScoreRows.map((row) => row.id);
  if (!ids.length) return { listings: [], scores: {} };

  const { data: listingsData, error: listError } = await supabase.from("listings").select("*").in("id", ids);
  if (listError) throw new Error(listError.message);

  const byId = new Map((listingsData ?? []).map((row) => [row.id, row]));
  const listings = ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((listing) => listing as Listing);
  const scores = Object.fromEntries(idScoreRows.map((row) => [row.id, row.similarity]));

  return { listings, scores };
}
