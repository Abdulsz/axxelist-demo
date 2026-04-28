import { NextResponse } from "next/server";
import { searchListings } from "@/agent/tools/search-listings";
import { semanticSearch } from "@/agent/tools/semantic-search";
import { summarizeListing } from "@/agent/tools/summarize-listing";
import { findSimilar } from "@/agent/tools/find-similar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ToolEvent } from "@/lib/types";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };
type ConciergeRequest = {
  messages: ChatMessage[];
  context?: { selectedListingId?: string | null };
};

function parseSearchIntent(text: string) {
  const lower = text.toLowerCase();
  const bedrooms = lower.match(/(\d)\s*br/)?.[1];
  const under = lower.match(/under\s*\$?([\d,]+)/)?.[1];
  const minPrice = lower.match(/above\s*\$?([\d,]+)/)?.[1];

  const neighborhoods = [
    "rockridge",
    "temescal",
    "lake merritt",
    "downtown",
    "jack london square",
    "adams point",
    "piedmont ave",
    "grand lake",
  ].filter((n) => lower.includes(n));

  const filters = {
    bedrooms_min: bedrooms ? Number(bedrooms) : undefined,
    bedrooms_max: bedrooms ? Number(bedrooms) : undefined,
    price_max: under ? Number(under.replace(/,/g, "")) : undefined,
    price_min: minPrice ? Number(minPrice.replace(/,/g, "")) : undefined,
    near_transit: lower.includes("bart") || lower.includes("near transit"),
    pets: lower.includes("dogs")
      ? ("dogs" as const)
      : lower.includes("cats")
        ? ("cats" as const)
        : lower.includes("pet")
          ? ("both" as const)
          : undefined,
    neighborhoods: neighborhoods.length ? neighborhoods.map((n) => n.replace(/\b\w/g, (c) => c.toUpperCase())) : undefined,
    limit: 8,
  };

  return filters;
}

function needsSemantic(text: string) {
  const lower = text.toLowerCase();
  return ["cozy", "natural light", "remote work", "quiet", "vibe", "charming"].some((token) =>
    lower.includes(token),
  );
}

async function generateAssistantText(prefix: string, ids: string[]) {
  if (!ids.length) return `${prefix} I couldn't find a good match. Try relaxing one filter.`;
  return `${prefix} I found ${ids.length} matches and surfaced the strongest options first.`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ConciergeRequest;
    const lastUserMessage = [...(body.messages ?? [])].reverse().find((m) => m.role === "user")?.content ?? "";
    const selectedListingId = body.context?.selectedListingId ?? null;
    const lower = lastUserMessage.toLowerCase();

    const events: ToolEvent[] = [];
    let message = "I can help with search, summaries, or similar listings.";

    if (
      (lower.includes("summary") || lower.includes("summarize")) &&
      selectedListingId
    ) {
      const summary = await summarizeListing({ listing_id: selectedListingId });
      events.push({
        kind: "show_summary",
        listing_id: selectedListingId,
        bullets: summary.summary_bullets,
      });
      message = "Here is a concise summary of this listing.";
      return NextResponse.json({ message, events });
    }

    if (
      (lower.includes("like this") || lower.includes("similar") || lower.includes("cheaper") || lower.includes("closer")) &&
      selectedListingId
    ) {
      const similar = await findSimilar({
        listing_id: selectedListingId,
        cheaper: lower.includes("cheaper"),
        closer_to: lower.includes("downtown") ? "downtown" : undefined,
        limit: 3,
      });
      const listingIds = similar.results.map((item) => item.listing.id);
      events.push({ kind: "replace_grid", listing_ids: listingIds });
      message =
        similar.results.length > 0
          ? similar.results.map((item) => `- ${item.listing.title}: ${item.tradeoff}`).join("\n")
          : "I couldn't find strong alternatives. Try dropping one requirement.";
      return NextResponse.json({ message, events, listing_ids: listingIds });
    }

    if (needsSemantic(lastUserMessage)) {
      const semantic = await semanticSearch({
        query: lastUserMessage,
        limit: 6,
      });
      const listingIds = semantic.listings.map((item) => item.id);
      events.push({ kind: "show_results", listing_ids: listingIds });
      message = await generateAssistantText("I interpreted this as a vibe-based request.", listingIds);
      return NextResponse.json({ message, events, listing_ids: listingIds });
    }

    const filters = parseSearchIntent(lastUserMessage);
    const structured = await searchListings(filters);
    const listingIds = structured.listings.map((item) => item.id);

    events.push({ kind: "apply_filters", filters: structured.applied_filters });
    events.push({ kind: "show_results", listing_ids: listingIds });
    message = await generateAssistantText(
      "Looking for listings based on your constraints.",
      listingIds,
    );

    // If user asks for summary without currently selected id, infer top result.
    if ((lower.includes("summary") || lower.includes("summarize")) && !selectedListingId && listingIds[0]) {
      const summary = await summarizeListing({ listing_id: listingIds[0] });
      events.push({ kind: "show_summary", listing_id: listingIds[0], bullets: summary.summary_bullets });
    }

    // Optionally return listing payload for grid refresh.
    const supabase = createSupabaseServerClient();
    const { data: listings } = await supabase.from("listings").select("*").in("id", listingIds);

    return NextResponse.json({
      message,
      events,
      listings: listings ?? [],
      listing_ids: listingIds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected concierge error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
