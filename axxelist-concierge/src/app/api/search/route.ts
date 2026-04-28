import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Filters, Listing } from "@/lib/types";

function normalizeArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const arr = value.filter((item): item is string => typeof item === "string" && item.length > 0);
  return arr.length > 0 ? arr : undefined;
}

function parseFilters(body: unknown): Filters {
  const input = (body ?? {}) as Record<string, unknown>;

  return {
    bedrooms_min: typeof input.bedrooms_min === "number" ? input.bedrooms_min : undefined,
    bedrooms_max: typeof input.bedrooms_max === "number" ? input.bedrooms_max : undefined,
    price_min: typeof input.price_min === "number" ? input.price_min : undefined,
    price_max: typeof input.price_max === "number" ? input.price_max : undefined,
    neighborhoods: normalizeArray(input.neighborhoods),
    property_types: normalizeArray(input.property_types) as Filters["property_types"],
    pets: typeof input.pets === "string" ? (input.pets as Filters["pets"]) : undefined,
    required_amenities: normalizeArray(input.required_amenities),
    near_transit: typeof input.near_transit === "boolean" ? input.near_transit : undefined,
    min_walk_score: typeof input.min_walk_score === "number" ? input.min_walk_score : undefined,
    limit: typeof input.limit === "number" ? input.limit : 8,
  };
}

export async function POST(req: NextRequest) {
  try {
    const filters = parseFilters(await req.json());
    const supabase = createSupabaseServerClient();

    let query = supabase.from("listings").select("*", { count: "exact" });

    if (filters.bedrooms_min !== undefined) query = query.gte("bedrooms", filters.bedrooms_min);
    if (filters.bedrooms_max !== undefined) query = query.lte("bedrooms", filters.bedrooms_max);
    if (filters.price_min !== undefined) query = query.gte("price", filters.price_min);
    if (filters.price_max !== undefined) query = query.lte("price", filters.price_max);
    if (filters.neighborhoods?.length) query = query.in("neighborhood", filters.neighborhoods);
    if (filters.property_types?.length) query = query.in("property_type", filters.property_types);
    if (filters.pets) query = query.or(`pet_policy.eq.both,pet_policy.eq.${filters.pets}`);
    if (filters.required_amenities?.length) query = query.contains("amenities", filters.required_amenities);
    if (filters.near_transit) query = query.lte("transit_distance_mi", 0.5);
    if (filters.min_walk_score !== undefined) query = query.gte("walk_score", filters.min_walk_score);

    query = query.order("created_at", { ascending: false }).limit(filters.limit ?? 8);

    const { data, count, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      listings: (data ?? []) as Listing[],
      total: count ?? 0,
      applied_filters: filters,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
