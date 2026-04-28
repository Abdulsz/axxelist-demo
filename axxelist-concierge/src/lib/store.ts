"use client";

import { create } from "zustand";
import type { Filters, Listing } from "@/lib/types";

type ConciergeStore = {
  listings: Listing[];
  allListings: Listing[];
  appliedFilters: Filters;
  selectedListingId: string | null;
  summaries: Record<string, string[]>;
  mode: "browsing" | "similar";
  setListings: (listings: Listing[]) => void;
  setAllListings: (listings: Listing[]) => void;
  applyFilters: (filters: Filters) => void;
  selectListing: (id: string | null) => void;
  setSummary: (id: string, bullets: string[]) => void;
  setMode: (mode: "browsing" | "similar") => void;
  resetDemo: () => void;
};

export const useConciergeStore = create<ConciergeStore>((set, get) => ({
  listings: [],
  allListings: [],
  appliedFilters: {},
  selectedListingId: null,
  summaries: {},
  mode: "browsing",
  setListings: (listings) => set({ listings }),
  setAllListings: (allListings) => set({ allListings }),
  applyFilters: (appliedFilters) => set({ appliedFilters }),
  selectListing: (selectedListingId) => set({ selectedListingId }),
  setSummary: (id, bullets) =>
    set((state) => ({
      summaries: {
        ...state.summaries,
        [id]: bullets,
      },
    })),
  setMode: (mode) => set({ mode }),
  resetDemo: () => {
    const { allListings } = get();
    set({
      listings: allListings,
      appliedFilters: {},
      selectedListingId: null,
      summaries: {},
      mode: "browsing",
    });
  },
}));
