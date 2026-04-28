import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Filters, Listing } from "@/lib/types";

export const searchListingsInputSchema = z.object({
  bedrooms_min: z.number().optional(),
  bedrooms_max: z.number().optional(),
  price_min: z.number().optional(),
  price_max: z.number().optional(),
  neighborhoods: z.array(z.string()).optional(),
  property_types: z.array(z.enum(["apartment", "condo", "loft"])).optional(),
  pets: z.enum(["cats", "dogs", "both"]).optional(),
  required_amenities: z.array(z.string()).optional(),
  near_transit: z.boolean().optional(),
  min_walk_score: z.number().optional(),
  limit: z.number().default(8),
});

export type SearchListingsInput = z.infer<typeof searchListingsInputSchema>;

export async function searchListings(input: SearchListingsInput): Promise<{
  listings: Listing[];
  total: number;
  applied_filters: Filters;
}> {
  const params = searchListingsInputSchema.parse(input);
  const supabase = createSupabaseServerClient();

  let query = supabase.from("listings").select("*", { count: "exact" });

  if (params.bedrooms_min !== undefined) query = query.gte("bedrooms", params.bedrooms_min);
  if (params.bedrooms_max !== undefined) query = query.lte("bedrooms", params.bedrooms_max);
  if (params.price_min !== undefined) query = query.gte("price", params.price_min);
  if (params.price_max !== undefined) query = query.lte("price", params.price_max);
  if (params.neighborhoods?.length) query = query.in("neighborhood", params.neighborhoods);
  if (params.property_types?.length) query = query.in("property_type", params.property_types);
  if (params.pets) query = query.or(`pet_policy.eq.both,pet_policy.eq.${params.pets}`);
  if (params.required_amenities?.length) query = query.contains("amenities", params.required_amenities);
  if (params.near_transit) query = query.lte("transit_distance_mi", 0.5);
  if (params.min_walk_score !== undefined) query = query.gte("walk_score", params.min_walk_score);

  const { data, count, error } = await query.order("created_at", { ascending: false }).limit(params.limit);
  if (error) throw new Error(error.message);

  const listings = ((data ?? []) as Listing[]).map((listing) => ({
    ...listing,
    bedrooms: Number(listing.bedrooms),
    bathrooms: Number(listing.bathrooms),
    transit_distance_mi: listing.transit_distance_mi === null ? null : Number(listing.transit_distance_mi),
  }));

  return {
    listings,
    total: count ?? listings.length,
    applied_filters: params,
  };
}
