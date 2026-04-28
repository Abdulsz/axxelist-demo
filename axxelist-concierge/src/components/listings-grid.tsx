"use client";

import type { Listing } from "@/lib/types";
import { ListingCard } from "@/components/listing-card";
import { AnimatePresence, motion } from "framer-motion";

type ListingsGridProps = {
  listings: Listing[];
  onSelect: (id: string) => void;
};

export function ListingsGrid({ listings, onSelect }: ListingsGridProps) {
  if (listings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
        No listings found.
      </div>
    );
  }

  return (
    <motion.div layout className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <AnimatePresence mode="popLayout">
        {listings.map((listing) => (
          <motion.div
            key={listing.id}
            layout
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            <ListingCard listing={listing} onSelect={onSelect} />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
