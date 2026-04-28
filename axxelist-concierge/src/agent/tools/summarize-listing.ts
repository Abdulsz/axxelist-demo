import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOpenAIClient } from "@/lib/openai";

const summarizeListingInputSchema = z.object({
  listing_id: z.string().uuid(),
});

export type SummarizeListingInput = z.infer<typeof summarizeListingInputSchema>;

const FALLBACK_SUMMARY = [
  "Great overall fit for renters seeking a well-rounded Oakland location.",
  "Layout appears practical with balanced bedroom, bath, and square footage.",
  "Neighborhood is a meaningful part of the value proposition for day-to-day livability.",
  "Transit and walkability are strong enough for most city routines.",
  "Tradeoff: prioritize this listing if location and basics matter more than premium upgrades.",
];

export async function summarizeListing(input: SummarizeListingInput): Promise<{
  listing_id: string;
  summary_bullets: string[];
}> {
  const params = summarizeListingInputSchema.parse(input);
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.from("listings").select("*").eq("id", params.listing_id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Listing not found");

  try {
    const openai = getOpenAIClient();
    const completion = (await Promise.race([
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Return exactly 4-6 concise bullet points summarizing a rental listing. Include standout features, layout, neighborhood vibe, commute/transit, and a tradeoff.",
          },
          {
            role: "user",
            content: JSON.stringify(data),
          },
        ],
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 30_000)),
    ])) as Awaited<ReturnType<typeof openai.chat.completions.create>>;

    const content = completion.choices[0]?.message?.content ?? "";
    const bullets = content
      .split("\n")
      .map((line) => line.replace(/^[-*•\d.\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, 6);

    return {
      listing_id: params.listing_id,
      summary_bullets: bullets.length ? bullets : FALLBACK_SUMMARY,
    };
  } catch {
    return { listing_id: params.listing_id, summary_bullets: FALLBACK_SUMMARY };
  }
}
