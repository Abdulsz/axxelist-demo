"use client";

import { BedDouble, Bath, Ruler, MapPin } from "lucide-react";
import type { Listing } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type ListingCardProps = {
  listing: Listing;
  onSelect: (id: string) => void;
};

export function ListingCard({ listing, onSelect }: ListingCardProps) {
  return (
    <Card
      className="group overflow-hidden border-slate-200 bg-white/95 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      onClick={() => onSelect(listing.id)}
      role="button"
      tabIndex={0}
    >
      <div className="relative h-48 w-full overflow-hidden bg-slate-100">
        <img
          src={listing.photos[0] ?? "https://images.unsplash.com/photo-1494526585095-c41746248156?w=1200&q=80"}
          alt={listing.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
        <div className="absolute bottom-3 left-3 rounded-full bg-black/75 px-3 py-1 text-xs font-medium text-white">
          ${listing.price.toLocaleString()}/mo
        </div>
      </div>
      <CardContent className="space-y-3 p-4">
        <div>
          <h3 className="line-clamp-1 text-base font-semibold text-slate-900">{listing.title}</h3>
          <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
            <MapPin className="h-3.5 w-3.5" />
            {listing.neighborhood}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-slate-700">
          <span className="inline-flex items-center gap-1">
            <BedDouble className="h-3.5 w-3.5" />
            {listing.bedrooms === 0 ? "Studio" : `${listing.bedrooms}BR`}
          </span>
          <span className="inline-flex items-center gap-1">
            <Bath className="h-3.5 w-3.5" />
            {listing.bathrooms}BA
          </span>
          <span className="inline-flex items-center gap-1">
            <Ruler className="h-3.5 w-3.5" />
            {listing.sqft ?? "—"} sqft
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {listing.amenities.slice(0, 3).map((amenity) => (
            <Badge key={amenity} variant="secondary" className="bg-slate-100 text-slate-700">
              {amenity}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
