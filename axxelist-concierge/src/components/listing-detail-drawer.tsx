"use client";

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Listing } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useEffect } from "react";

type ListingDetailDrawerProps = {
  listing: Listing | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summaryBullets?: string[];
  onAskConcierge?: (message: string) => void;
};

export function ListingDetailDrawer({
  listing,
  open,
  onOpenChange,
  summaryBullets,
  onAskConcierge,
}: ListingDetailDrawerProps) {
  useEffect(() => {
    if (open && listing && summaryBullets?.length === 0 && onAskConcierge) {
      onAskConcierge("Summarize this listing.");
    }
  }, [listing, onAskConcierge, open, summaryBullets?.length]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="left-auto right-0 top-0 mt-0 h-full w-full max-w-xl rounded-none border-l border-slate-200">
        {listing ? (
          <ScrollArea className="h-full">
            <DrawerHeader className="border-b border-slate-100 pb-4">
              <div className="flex items-start justify-between gap-3">
                <DrawerTitle className="text-left text-xl font-semibold text-slate-900">{listing.title}</DrawerTitle>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-slate-500 hover:text-slate-800"
                  onClick={() => onOpenChange(false)}
                  aria-label="Close listing details"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-left text-sm text-slate-600">
                {listing.address}, {listing.neighborhood}, Oakland
              </p>
            </DrawerHeader>
            <div className="space-y-6 p-6">
              <div className="rounded-xl bg-slate-50 p-4">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">AI Summary</h4>
                {summaryBullets?.length ? (
                  <ul className="mt-2 space-y-2 text-sm text-slate-700">
                    {summaryBullets.map((bullet, index) => (
                      <li key={`${bullet}-${index}`} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-500" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">Generating summary...</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAskConcierge?.("Find similar but cheaper")}
                  >
                    Find similar but cheaper
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAskConcierge?.("Find closer to downtown")}
                  >
                    Find closer to downtown
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {listing.photos.map((photo) => (
                  <img
                    key={photo}
                    src={photo}
                    alt={listing.title}
                    className="h-36 w-full rounded-xl object-cover"
                  />
                ))}
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Overview</h4>
                <p className="text-sm leading-6 text-slate-700 whitespace-pre-line">{listing.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm text-slate-700">
                <p><span className="font-medium text-slate-900">Price:</span> ${listing.price.toLocaleString()}/mo</p>
                <p><span className="font-medium text-slate-900">Layout:</span> {listing.bedrooms === 0 ? "Studio" : `${listing.bedrooms}BR`} / {listing.bathrooms}BA</p>
                <p><span className="font-medium text-slate-900">Sqft:</span> {listing.sqft ?? "N/A"}</p>
                <p><span className="font-medium text-slate-900">Transit:</span> {listing.transit_distance_mi ?? "N/A"} mi</p>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Amenities</h4>
                <div className="flex flex-wrap gap-2">
                  {listing.amenities.map((amenity) => (
                    <Badge key={amenity} variant="secondary" className="bg-slate-100 text-slate-700">
                      {amenity}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
