import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Listing } from "@/lib/types";

export const dynamic = "force-dynamic";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export default async function LandlordPage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("listings").select("*").order("created_at", { ascending: false }).limit(24);

  const listings = ((data ?? []) as Listing[]).map((listing) => ({
    ...listing,
    bedrooms: Number(listing.bedrooms),
    bathrooms: Number(listing.bathrooms),
    transit_distance_mi: listing.transit_distance_mi === null ? null : Number(listing.transit_distance_mi),
  }));

  const averagePrice = listings.length ? Math.round(listings.reduce((sum, item) => sum + item.price, 0) / listings.length) : 0;
  const medianWalkScore = listings.length
    ? listings
        .map((item) => item.walk_score ?? 0)
        .sort((a, b) => a - b)[Math.floor(listings.length / 2)]
    : 0;
  const petFriendlyCount = listings.filter((item) => item.pet_policy !== "none").length;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Axxelist</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Landlord workspace</h1>
            <p className="mt-2 text-sm text-slate-600">Kickoff page for landlord-side listing operations and portfolio visibility.</p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100"
          >
            Back to concierge demo
          </Link>
        </header>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Listings loaded</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{listings.length}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Average monthly rent</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{formatCurrency(averagePrice)}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Pet-friendly inventory</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{petFriendlyCount}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Median walk score</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{medianWalkScore}</p>
          </article>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Recent listings</h2>
            <p className="text-sm text-slate-600">Initial scaffold for landlord-facing inventory management.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Title</th>
                  <th className="px-5 py-3 font-medium">Neighborhood</th>
                  <th className="px-5 py-3 font-medium">Beds / Baths</th>
                  <th className="px-5 py-3 font-medium">Rent</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Pets</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {listings.map((listing) => (
                  <tr key={listing.id}>
                    <td className="whitespace-nowrap px-5 py-3 font-medium text-slate-900">{listing.title}</td>
                    <td className="whitespace-nowrap px-5 py-3">{listing.neighborhood}</td>
                    <td className="whitespace-nowrap px-5 py-3">
                      {listing.bedrooms === 0 ? "Studio" : `${listing.bedrooms} BR`} / {listing.bathrooms} BA
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">{formatCurrency(listing.price)}</td>
                    <td className="whitespace-nowrap px-5 py-3 capitalize">{listing.property_type}</td>
                    <td className="whitespace-nowrap px-5 py-3 capitalize">{listing.pet_policy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
