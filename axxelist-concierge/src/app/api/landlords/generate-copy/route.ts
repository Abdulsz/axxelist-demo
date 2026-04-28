import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpenAIClient } from "@/lib/openai";
import type { LandlordCopyGeneratorResponse, LandlordVisionSummary } from "@/lib/types";

const MAX_IMAGE_COUNT = 6;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const landlordFormSchema = z.object({
  bedrooms: z.coerce.number().min(0).max(8),
  bathrooms: z.coerce.number().min(0.5).max(8),
  sqft: z.coerce.number().int().min(200).max(10000),
  neighborhood: z.string().trim().min(2).max(80),
  rent: z.coerce.number().int().min(500).max(25000),
  pet_policy: z.enum(["none", "cats", "dogs", "both"]),
  amenities: z.array(z.string().trim().min(1)).min(1).max(20),
  standout_notes: z.string().trim().min(8).max(1200),
});

const visionSummarySchema = z.object({
  style: z.string().min(3),
  condition: z.string().min(3),
  natural_light: z.string().min(3),
  notable_features: z.array(z.string().min(2)).min(1).max(8),
  room_cues: z.array(z.string().min(2)).min(1).max(8),
  confidence_note: z.string().min(3),
});

const generatedCopySchema = z.object({
  title: z.string().min(5).max(90),
  description: z.string().min(120).max(1800),
});

function safeJsonParse(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return {};
  }
}

function withTimeout<T>(promise: Promise<T>, ms = 30_000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

async function fileToDataUrl(file: File): Promise<string> {
  const bytes = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${bytes.toString("base64")}`;
}

function parseAmenities(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildFallbackCopy(input: z.infer<typeof landlordFormSchema>, vision: LandlordVisionSummary) {
  const amenityLine = input.amenities.slice(0, 5).join(", ");
  const title = `${input.bedrooms}BR in ${input.neighborhood} with ${vision.notable_features[0] ?? "great light"}`;
  const description = [
    `This ${input.bedrooms}BR/${input.bathrooms}BA rental in ${input.neighborhood} offers about ${input.sqft} sqft for $${input.rent}/month.`,
    `Photos suggest ${vision.style.toLowerCase()} and ${vision.natural_light.toLowerCase()}, with notable details like ${vision.notable_features.slice(0, 3).join(", ")}.`,
    `Everyday livability is supported by amenities including ${amenityLine}. Pet policy: ${input.pet_policy}.`,
    `Thing to know: ${input.standout_notes.trim()}`,
  ].join("\n\n");

  return { title, description };
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const photos = formData.getAll("photos").filter((entry): entry is File => entry instanceof File);

    if (photos.length === 0) {
      return NextResponse.json({ error: "Upload at least one photo to generate copy." }, { status: 400 });
    }
    if (photos.length > MAX_IMAGE_COUNT) {
      return NextResponse.json({ error: `Upload up to ${MAX_IMAGE_COUNT} photos.` }, { status: 400 });
    }

    for (const photo of photos) {
      if (!photo.type.startsWith("image/")) {
        return NextResponse.json({ error: "Only image uploads are supported." }, { status: 400 });
      }
      if (photo.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: "Each image must be 8MB or smaller." }, { status: 400 });
      }
    }

    const parsedForm = landlordFormSchema.safeParse({
      bedrooms: formData.get("bedrooms"),
      bathrooms: formData.get("bathrooms"),
      sqft: formData.get("sqft"),
      neighborhood: formData.get("neighborhood"),
      rent: formData.get("rent"),
      pet_policy: formData.get("pet_policy"),
      amenities: parseAmenities(formData.get("amenities")),
      standout_notes: formData.get("standout_notes"),
    });

    if (!parsedForm.success) {
      return NextResponse.json({ error: parsedForm.error.issues[0]?.message ?? "Invalid form fields." }, { status: 400 });
    }

    const openai = getOpenAIClient();
    const imageParts = await Promise.all(
      photos.map(async (photo) => ({
        type: "image_url" as const,
        image_url: {
          url: await fileToDataUrl(photo),
        },
      })),
    );

    const fallbackVision: LandlordVisionSummary = {
      style: "Modern rental style with practical finishes",
      condition: "Generally well-kept from visible details",
      natural_light: "Moderate natural light based on room exposure",
      notable_features: ["Clean interior presentation"],
      room_cues: ["Functional living layout"],
      confidence_note: "Visual assessment only; verify details in person.",
    };

    try {
      const visionCompletion = await withTimeout(
        openai.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "Analyze rental listing photos and return JSON with keys: style, condition, natural_light, notable_features (array), room_cues (array), confidence_note. Keep claims visual and concise.",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract visual cues from these listing photos. Do not invent details not visible.",
                },
                ...imageParts,
              ],
            },
          ],
        }),
      );

      const rawVision = visionCompletion.choices[0]?.message?.content ?? "{}";
      const parsedVision = visionSummarySchema.safeParse(safeJsonParse(rawVision) as LandlordVisionSummary);
      const visionSummary: LandlordVisionSummary = parsedVision.success ? parsedVision.data : fallbackVision;

      const copyCompletion = await withTimeout(
        openai.chat.completions.create({
          model: "gpt-4o",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You write compelling and honest rental listings. Return JSON only with keys title and description. Title must be 5-10 words. Description should be 2-4 short paragraphs and include neighborhood context, layout, amenities, and one realistic tradeoff.",
            },
            {
              role: "user",
              content: JSON.stringify({
                facts: parsedForm.data,
                visual_summary: visionSummary,
              }),
            },
          ],
        }),
      );

      const rawCopy = copyCompletion.choices[0]?.message?.content ?? "{}";
      const parsedCopy = generatedCopySchema.safeParse(safeJsonParse(rawCopy));

      const payload: LandlordCopyGeneratorResponse = {
        generated_copy: parsedCopy.success ? parsedCopy.data : buildFallbackCopy(parsedForm.data, visionSummary),
        vision_summary: visionSummary,
      };
      return NextResponse.json(payload);
    } catch {
      return NextResponse.json({
        generated_copy: buildFallbackCopy(parsedForm.data, fallbackVision),
        vision_summary: fallbackVision,
      } satisfies LandlordCopyGeneratorResponse);
    }
  } catch {
    return NextResponse.json(
      { error: "I had trouble generating copy from those photos. Please try again in a moment." },
      { status: 500 },
    );
  }
}
