"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Filters } from "@/lib/types";

function stringifyFilters(filters: Filters): string[] {
  const chips: string[] = [];
  if (filters.bedrooms_min !== undefined && filters.bedrooms_max !== undefined) {
    chips.push(`${filters.bedrooms_min}BR`);
  }
  if (filters.price_max !== undefined) chips.push(`Under $${filters.price_max.toLocaleString()}`);
  if (filters.price_min !== undefined) chips.push(`Above $${filters.price_min.toLocaleString()}`);
  if (filters.near_transit) chips.push("Near BART");
  if (filters.pets) chips.push(`${filters.pets} welcome`);
  if (filters.neighborhoods?.length) chips.push(...filters.neighborhoods);
  if (filters.required_amenities?.length) chips.push(...filters.required_amenities.map((a) => `Has ${a}`));
  if (filters.min_walk_score !== undefined) chips.push(`Walk score ${filters.min_walk_score}+`);
  return chips;
}

type FilterChipsProps = {
  filters: Filters;
};

export function FilterChips({ filters }: FilterChipsProps) {
  const chips = stringifyFilters(filters);
  return (
    <div className="min-h-8">
      <AnimatePresence mode="popLayout">
        <div className="flex flex-wrap gap-2">
          {chips.map((chip, index) => (
            <motion.span
              key={chip}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.24, delay: index * 0.06, ease: "easeOut" }}
              className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white"
            >
              {chip}
            </motion.span>
          ))}
        </div>
      </AnimatePresence>
    </div>
  );
}
