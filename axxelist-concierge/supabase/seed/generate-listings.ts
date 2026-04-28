import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NEIGHBORHOODS } from "./neighborhoods";

type PropertyType = "apartment" | "condo" | "loft";
type PetPolicy = "none" | "cats" | "dogs" | "both";

type ListingInsert = {
  title: string;
  description: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  neighborhood: string;
  lat: number;
  lng: number;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  property_type: PropertyType;
  amenities: string[];
  photos: string[];
  pet_policy: PetPolicy;
  transit_distance_mi: number;
  walk_score: number;
};

type GeneratedCopy = {
  title: string;
  description: string;
};

const TOTAL_LISTINGS = 50;
const CITY = "Oakland";
const STATE = "CA";

const AMENITIES_POOL = [
  "in-unit laundry", "shared laundry", "parking", "garage", "gym", "pool", "rooftop", "balcony",
  "dishwasher", "hardwood floors", "stainless appliances", "central ac", "hvac", "dog park",
  "ev charging", "bike storage", "doorman", "elevator", "fireplace", "walk-in closet",
  "renovated kitchen", "natural light",
];

const STREET_NAMES = [
  "Telegraph Ave", "Broadway", "Grand Ave", "College Ave", "Market St", "San Pablo Ave", "Lakeshore Ave",
  "Piedmont Ave", "14th St", "24th St", "Harrison St", "Webster St", "Peralta St", "Adeline St",
  "Shattuck Ave", "MacArthur Blvd", "Park Blvd", "Mandana Blvd", "Foothill Blvd", "High St",
  "Fruitvale Ave", "International Blvd", "West St", "Brush St", "Alice St",
];

const UNSPLASH_IDS = [
  "1460317442991-0ec209397118", "1465800872432-3f1d7ddf7ec6", "1494526585095-c41746248156",
  "1484154218962-a197022b5858", "1493666438817-866a91353ca9", "1505693416388-ac5ce068fe85",
  "1505691938895-1758d7feb511", "1493663284031-b7e3aefcae8e", "1502672260266-1c1ef2d93688",
  "1502672023488-70e25813eb80", "1493809842364-78817add7ffb", "1513694203232-719a280e022f",
  "1516455590571-18256e5bb9ff", "1505691938895-1758d7feb511", "1519710164239-da123dc03ef4",
  "1507089947368-19c1da9775ae", "1494526585095-c41746248156", "1560185893-a55cbc8c57e8",
  "1600121848594-d8644e57abab", "1560448204-603b3fc33ddc", "1560185008-b033106af5c3",
  "1600607688066-890987f18a86", "1560184897-ae75f418493e", "1484154218962-a197022b5858",
  "1502672260266-1c1ef2d93688", "1505691723518-36a5ac3be353", "1564078516393-cf04bd966897",
  "1560185007-cde436f6a4d0", "1560185009-dddeb820c7b7", "1515263487990-61b07816b324",
];

const PRICE_BANDS: Record<number, [number, number]> = {
  0: [1800, 2400],
  1: [2000, 3200],
  2: [2600, 4500],
  3: [3500, 5500],
};

const BEDROOMS_BASE_SQFT: Record<number, number> = {
  0: 450,
  1: 650,
  2: 950,
  3: 1300,
};

const BATHROOM_OPTIONS: Record<number, number[]> = {
  0: [1],
  1: [1, 1.5],
  2: [1, 1.5, 2],
  3: [2, 2.5, 3],
};

function sampleOne<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function sampleMany<T>(items: T[], count: number): T[] {
  const pool = [...items];
  const result: T[] = [];
  while (result.length < count && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    const [picked] = pool.splice(idx, 1);
    result.push(picked);
  }
  return result;
}

function weightedPick<T>(pairs: Array<{ value: T; weight: number }>): T {
  const total = pairs.reduce((sum, p) => sum + p.weight, 0);
  let cursor = Math.random() * total;
  for (const pair of pairs) {
    cursor -= pair.weight;
    if (cursor <= 0) return pair.value;
  }
  return pairs[pairs.length - 1]!.value;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function roundToOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function generateZip(): string {
  const zips = ["94607", "94609", "94610", "94611", "94612", "94618"];
  return sampleOne(zips);
}

function pickBedrooms(): number {
  return weightedPick<number>([
    { value: 0, weight: 15 },
    { value: 1, weight: 40 },
    { value: 2, weight: 35 },
    { value: 3, weight: 10 },
  ]);
}

function pickPropertyType(neighborhood: string): PropertyType {
  if (neighborhood === "Downtown" || neighborhood === "Jack London Square") {
    return weightedPick<PropertyType>([
      { value: "apartment", weight: 55 },
      { value: "condo", weight: 20 },
      { value: "loft", weight: 25 },
    ]);
  }

  return weightedPick<PropertyType>([
    { value: "apartment", weight: 70 },
    { value: "condo", weight: 20 },
    { value: "loft", weight: 10 },
  ]);
}

function pickPetPolicy(): PetPolicy {
  return weightedPick<PetPolicy>([
    { value: "none", weight: 25 },
    { value: "cats", weight: 25 },
    { value: "dogs", weight: 15 },
    { value: "both", weight: 35 },
  ]);
}

function generatePrice(bedrooms: number, neighborhood: (typeof NEIGHBORHOODS)[number]): number {
  const [min, max] = PRICE_BANDS[bedrooms];
  const base = min + Math.random() * (max - min);
  const premium = neighborhood.pricePremiumMin + Math.random() * (neighborhood.pricePremiumMax - neighborhood.pricePremiumMin);
  const jitter = (Math.random() - 0.5) * 180;
  return clampInt(base + premium + jitter, min, max + 600);
}

function generateSqft(bedrooms: number): number {
  const base = BEDROOMS_BASE_SQFT[bedrooms];
  const jitterMultiplier = 0.85 + Math.random() * 0.3;
  return clampInt(base * jitterMultiplier, 350, 1700);
}

function generateBathrooms(bedrooms: number): number {
  return sampleOne(BATHROOM_OPTIONS[bedrooms]);
}

function generateLatLng(centerLat: number, centerLng: number): { lat: number; lng: number } {
  const lat = centerLat + (Math.random() - 0.5) * 0.01;
  const lng = centerLng + (Math.random() - 0.5) * 0.01;
  return { lat: roundToOne(lat * 10000) / 10000, lng: roundToOne(lng * 10000) / 10000 };
}

function generateWalkScore(base: number): number {
  return clampInt(base + (Math.random() - 0.5) * 10, 70, 98);
}

function generateTransitDistance(): number {
  return roundToOne(0.1 + Math.random() * 1.4);
}

function generateAddress(): string {
  const streetNum = Math.floor(300 + Math.random() * 9700);
  return `${streetNum} ${sampleOne(STREET_NAMES)}`;
}

function pickAmenities(): string[] {
  const count = Math.floor(4 + Math.random() * 5);
  return sampleMany(AMENITIES_POOL, count);
}

function pickPhotos(): string[] {
  const count = Math.floor(3 + Math.random() * 3);
  const ids = sampleMany(UNSPLASH_IDS, count);
  return ids.map((id) => `https://images.unsplash.com/photo-${id}?w=1200&q=80`);
}

async function generateCopy(openai: OpenAI, seedData: Omit<ListingInsert, "title" | "description">): Promise<GeneratedCopy> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Generate realistic rental listing copy for Oakland listings. Keep details grounded in the provided facts only.",
        },
        {
          role: "user",
          content: `Facts: ${JSON.stringify(seedData)}`,
        },
      ],
      response_format: {
        type: "json_schema" as const,
        json_schema: {
          name: "listing_copy",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              description: { type: "string" },
            },
            required: ["title", "description"],
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Missing model output for listing copy.");
    }

    const parsed = JSON.parse(content) as GeneratedCopy;
    if (!parsed.title || !parsed.description) {
      throw new Error("Structured output parse failed for listing copy.");
    }

    return {
      title: parsed.title.trim(),
      description: parsed.description.trim(),
    };
  } catch {
    const bedLabel = seedData.bedrooms === 0 ? "Studio" : `${seedData.bedrooms}BR`;
    const title = `${bedLabel} with ${sampleOne(seedData.amenities)} in ${seedData.neighborhood}`;
    const description = [
      `Comfortable ${bedLabel.toLowerCase()} in ${seedData.neighborhood} with ${sampleOne(seedData.amenities)} and ${sampleOne(seedData.amenities)}.`,
      `Set in a ${seedData.neighborhood.toLowerCase()} pocket of Oakland with a walk score around ${seedData.walk_score} and transit about ${seedData.transit_distance_mi} miles away.`,
      `Good fit for renters who want ${seedData.pet_policy === "both" ? "pet flexibility" : `${seedData.pet_policy} policy`} and a practical layout at $${seedData.price}/mo.`,
    ].join("\n\n");
    return { title, description };
  }
}

async function mapInBatches<T, R>(items: T[], batchSize: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const output: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const slice = items.slice(i, i + batchSize);
    const results = await Promise.all(slice.map((item, idx) => worker(item, i + idx)));
    output.push(...results);
  }
  return output;
}

function buildEmbeddingContent(listing: ListingInsert): string {
  return `${listing.title}. ${listing.neighborhood}, Oakland. ${listing.bedrooms}BR/${listing.bathrooms}BA, ${listing.sqft} sqft, $${listing.price}/mo. ${listing.property_type}. Amenities: ${listing.amenities.join(", ")}. Pets: ${listing.pet_policy}. ${listing.description}`;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function fallbackEmbedding(text: string): number[] {
  const vec = new Array<number>(1536).fill(0);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    const idx = i % 1536;
    vec[idx] = (vec[idx] + (code % 127) / 127) % 1;
  }
  return vec;
}

export async function generateListingsAndEmbeddings() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !supabaseKey || !openaiApiKey) {
    throw new Error("Missing required env vars for seeding.");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const openai = new OpenAI({ apiKey: openaiApiKey });

  const existing = await supabase.from("listings").select("id", { count: "exact", head: true });
  const existingCount = existing.count ?? 0;
  if (existingCount >= 40) {
    console.log(`Skipping seed because listings already has ${existingCount} rows.`);
    return;
  }

  await supabase.from("listing_embeddings").delete().neq("listing_id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("listings").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  const baseListings: Omit<ListingInsert, "title" | "description">[] = Array.from({ length: TOTAL_LISTINGS }).map(() => {
    const neighborhood = sampleOne([...NEIGHBORHOODS]);
    const bedrooms = pickBedrooms();
    const listing: Omit<ListingInsert, "title" | "description"> = {
      address: generateAddress(),
      city: CITY,
      state: STATE,
      zip: generateZip(),
      neighborhood: neighborhood.name,
      ...generateLatLng(neighborhood.lat, neighborhood.lng),
      price: generatePrice(bedrooms, neighborhood),
      bedrooms,
      bathrooms: generateBathrooms(bedrooms),
      sqft: generateSqft(bedrooms),
      property_type: pickPropertyType(neighborhood.name),
      amenities: pickAmenities(),
      photos: pickPhotos(),
      pet_policy: pickPetPolicy(),
      transit_distance_mi: generateTransitDistance(),
      walk_score: generateWalkScore(neighborhood.walkScoreBase),
    };

    return listing;
  });

  const fullListings = await mapInBatches(baseListings, 10, async (listing) => {
    const copy = await generateCopy(openai, listing);
    return { ...listing, ...copy };
  });

  const inserted = await supabase
    .from("listings")
    .insert(fullListings)
    .select("id, title, description, neighborhood, bedrooms, bathrooms, sqft, price, property_type, amenities, pet_policy");

  if (inserted.error || !inserted.data) {
    throw new Error(`Failed inserting listings: ${inserted.error?.message ?? "Unknown error"}`);
  }

  const embeddingInput = inserted.data.map((row) => ({
    listing_id: row.id,
    content: buildEmbeddingContent({
      title: row.title,
      description: row.description,
      neighborhood: row.neighborhood,
      bedrooms: Number(row.bedrooms),
      bathrooms: Number(row.bathrooms),
      sqft: row.sqft ?? 0,
      price: row.price,
      property_type: row.property_type as PropertyType,
      amenities: row.amenities ?? [],
      pet_policy: row.pet_policy as PetPolicy,
      address: "",
      city: CITY,
      state: STATE,
      zip: "",
      lat: 0,
      lng: 0,
      photos: [],
      transit_distance_mi: 0,
      walk_score: 0,
    }),
  }));

  let embeddingRows: Array<{ listing_id: string; embedding: number[]; content: string }> = [];
  try {
    const embeddingRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: embeddingInput.map((item) => item.content),
    });

    embeddingRows = embeddingRes.data.map((item, index) => ({
      listing_id: embeddingInput[index]!.listing_id,
      embedding: item.embedding,
      content: embeddingInput[index]!.content,
    }));
  } catch {
    embeddingRows = embeddingInput.map((item) => ({
      listing_id: item.listing_id,
      embedding: fallbackEmbedding(item.content),
      content: item.content,
    }));
  }

  const embeddingInsert = await supabase.from("listing_embeddings").insert(embeddingRows);
  if (embeddingInsert.error) {
    throw new Error(`Failed inserting embeddings: ${embeddingInsert.error.message}`);
  }

  const neighborhoodCounts = new Map<string, number>();
  const bedCounts = new Map<string, number>();
  const prices: number[] = [];
  for (const listing of fullListings) {
    neighborhoodCounts.set(listing.neighborhood, (neighborhoodCounts.get(listing.neighborhood) ?? 0) + 1);
    const bedKey = listing.bedrooms === 0 ? "studio" : `${listing.bedrooms}BR`;
    bedCounts.set(bedKey, (bedCounts.get(bedKey) ?? 0) + 1);
    prices.push(listing.price);
  }

  console.log(`Seeded ${fullListings.length} listings and ${embeddingRows.length} embeddings.`);
  console.log("Neighborhood distribution:", Object.fromEntries([...neighborhoodCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))));
  console.log("Bed distribution:", Object.fromEntries([...bedCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))));
  console.log("Price stats:", {
    min: Math.min(...prices),
    median: median(prices),
    max: Math.max(...prices),
  });
}
