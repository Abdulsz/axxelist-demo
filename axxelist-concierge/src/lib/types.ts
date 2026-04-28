export type PropertyType = "apartment" | "condo" | "loft";
export type PetsPolicy = "cats" | "dogs" | "both";

export type Listing = {
  id: string;
  title: string;
  description: string;
  address: string;
  city: string;
  state: string;
  zip: string | null;
  neighborhood: string;
  lat: number;
  lng: number;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number | null;
  property_type: PropertyType;
  amenities: string[];
  photos: string[];
  pet_policy: "none" | PetsPolicy;
  transit_distance_mi: number | null;
  walk_score: number | null;
  created_at: string;
};

export type Filters = {
  bedrooms_min?: number;
  bedrooms_max?: number;
  price_min?: number;
  price_max?: number;
  neighborhoods?: string[];
  property_types?: PropertyType[];
  pets?: PetsPolicy;
  required_amenities?: string[];
  near_transit?: boolean;
  min_walk_score?: number;
  limit?: number;
};

export type ToolEvent =
  | { kind: "apply_filters"; filters: Filters }
  | { kind: "show_results"; listing_ids: string[] }
  | { kind: "show_summary"; listing_id: string; bullets: string[] }
  | { kind: "replace_grid"; listing_ids: string[] };

export type SimilarResult = {
  listing: Listing;
  tradeoff: string;
};

export type LandlordCopyGeneratorFormValues = {
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  neighborhood: string;
  rent: number;
  pet_policy: "none" | PetsPolicy;
  amenities: string[];
  standout_notes: string;
};

export type LandlordVisionSummary = {
  style: string;
  condition: string;
  natural_light: string;
  notable_features: string[];
  room_cues: string[];
  confidence_note: string;
};

export type LandlordGeneratedCopy = {
  title: string;
  description: string;
};

export type LandlordCopyGeneratorResponse = {
  generated_copy: LandlordGeneratedCopy;
  vision_summary: LandlordVisionSummary;
};
