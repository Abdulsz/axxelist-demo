"use client";

import { useEffect, useMemo, useState } from "react";
import type { Listing, ToolEvent } from "@/lib/types";
import { ListingsGrid } from "@/components/listings-grid";
import { ListingDetailDrawer } from "@/components/listing-detail-drawer";
import { ConciergePanel } from "@/components/concierge-panel";
import { FilterChips } from "@/components/filter-chips";
import { useConciergeStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

type ListingsWorkspaceProps = {
  initialListings: Listing[];
};

export function ListingsWorkspace({ initialListings }: ListingsWorkspaceProps) {
  const [open, setOpen] = useState(false);

  const listings = useConciergeStore((s) => s.listings);
  const allListings = useConciergeStore((s) => s.allListings);
  const appliedFilters = useConciergeStore((s) => s.appliedFilters);
  const selectedListingId = useConciergeStore((s) => s.selectedListingId);
  const summaries = useConciergeStore((s) => s.summaries);
  const setListings = useConciergeStore((s) => s.setListings);
  const setAllListings = useConciergeStore((s) => s.setAllListings);
  const applyFilters = useConciergeStore((s) => s.applyFilters);
  const selectListing = useConciergeStore((s) => s.selectListing);
  const setSummary = useConciergeStore((s) => s.setSummary);
  const setMode = useConciergeStore((s) => s.setMode);
  const resetDemo = useConciergeStore((s) => s.resetDemo);

  useEffect(() => {
    setAllListings(initialListings);
    setListings(initialListings);
  }, [initialListings, setAllListings, setListings]);

  const selectedListing = useMemo(
    () => listings.find((item) => item.id === selectedListingId) ?? allListings.find((item) => item.id === selectedListingId) ?? null,
    [allListings, listings, selectedListingId],
  );
  const effectiveAllListings = allListings.length ? allListings : initialListings;
  const effectiveListings = listings.length || !effectiveAllListings.length ? listings : initialListings.slice(0, 12);

  async function sendDrawerMessage(message: string) {
    if (!selectedListingId) return;
    const response = await fetch("/api/concierge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: message }],
        context: { selectedListingId },
      }),
    });
    const payload = await response.json();
    if (response.ok) {
      handleEvents((payload.events ?? []) as ToolEvent[], payload.listings as Listing[] | undefined);
    }
  }

  function handleEvents(events: ToolEvent[], eventListings?: Listing[]) {
    for (const event of events) {
      if (event.kind === "apply_filters") {
        applyFilters(event.filters);
      }
      if (event.kind === "show_results") {
        const ids = new Set(event.listing_ids);
        const nextListings = (eventListings ?? effectiveAllListings).filter((listing) => ids.has(listing.id));
        setListings(nextListings);
        setMode("browsing");
      }
      if (event.kind === "show_summary") {
        setSummary(event.listing_id, event.bullets);
      }
      if (event.kind === "replace_grid") {
        const ids = new Set(event.listing_ids);
        const source = eventListings?.length ? eventListings : effectiveAllListings;
        const nextListings = source.filter((listing) => ids.has(listing.id));
        setListings(nextListings);
        setMode("similar");
      }
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[1.9fr_1.1fr]">
      <section className="border-r border-slate-200 px-6 py-6 lg:px-8">
        <header className="sticky top-0 z-10 mb-6 border-b border-slate-200 bg-slate-50/90 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Axxelist</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Oakland Listings</h1>
              <p className="mt-2 text-sm text-slate-600">
                {effectiveListings.length} shown of {effectiveAllListings.length} listings.
              </p>
            </div>
            <Button variant="outline" onClick={resetDemo}>
              Reset demo
            </Button>
          </div>
          <div className="mt-3">
            <FilterChips filters={appliedFilters} />
          </div>
        </header>

        <ListingsGrid
          listings={effectiveListings}
          onSelect={(id) => {
            selectListing(id);
            setOpen(true);
          }}
        />
      </section>

      <aside className="min-h-[40vh] border-t border-slate-200 bg-white px-6 py-6 xl:sticky xl:top-0 xl:h-screen xl:self-start xl:border-t-0 xl:border-l">
        <ConciergePanel onEvents={handleEvents} />
      </aside>

      <ListingDetailDrawer
        listing={selectedListing}
        open={open}
        onOpenChange={setOpen}
        summaryBullets={selectedListingId ? summaries[selectedListingId] ?? [] : []}
        onAskConcierge={(message) => {
          void sendDrawerMessage(message);
        }}
      />
    </div>
  );
}
