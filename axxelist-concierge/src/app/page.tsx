import { ListingsWorkspace } from "@/components/listings-workspace";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Listing } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("listings").select("*").order("created_at", { ascending: false }).limit(12);
  const listings = ((data ?? []) as Listing[]).map((listing) => ({
    ...listing,
    bedrooms: Number(listing.bedrooms),
    bathrooms: Number(listing.bathrooms),
    transit_distance_mi: listing.transit_distance_mi === null ? null : Number(listing.transit_distance_mi),
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-[1600px]">
        <ListingsWorkspace initialListings={listings} />
      </div>
    </div>
  );
}
