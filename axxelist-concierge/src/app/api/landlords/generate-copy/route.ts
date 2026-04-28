import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpenAIClient } from "@/lib/openai";
import type { LandlordGeneratedCopyResponse, LandlordVisionSummary } from "@/lib/types";

const formSchema = z.object({
  bedrooms: z.coerce.number().min(0).max(8),
  bathrooms: z.coerce.number().min(1).max(8),
  sqft: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    })
    .refine((value) => value === undefined || (value >= 200 && value <= 10000), "Sqft must be between 200 and 10,000."),
  neighborhood: z.string().trim().min(2, "Neighborhood is required."),
  rent: z.coerce.number().min(500).max(50000),
  petPolicy: z.enum(["none", "cats", "dogs", "both"]),
  amenities: z
    .string()
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    )
    .refine((value) => value.length > 0, "Add at least one amenity."),
  standoutNotes: z.string().optional().transform((value) => value?.trim() || undefined),
});

const visionSummarySchema = z.object({
  styleKeywords: z.array(z.string()).min(1).max(6),
  naturalLight: z.enum(["low", "medium", "high"]),
  condition: z.enum(["needs-updates", "good", "renovated"]),
  notableFeatures: z.array(z.string()).min(1).max(8),
  likelyRoomTypes: z.array(z.string()).min(1).max(8),
  confidenceNote: z.string().min(5).max(240),
});

const generatedCopySchema = z.object({
  title: z.string().min(5).max(80),
  description: z.string().min(80).max(2200),
});

type OpenAIResponseFormat = {
  type: "json_schema";
  json_schema: {
    name: string;
    strict: true;
    schema: Record<string, unknown>;
  };
};

function toDataUrl(file: File, base64: string) {
  const mime = file.type || "image/jpeg";
  return `data:${mime};base64,${base64}`;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out. Please try again.`)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const photos = formData
      .getAll("photos")
      .filter((value): value is File => value instanceof File && value.size > 0);

    if (!photos.length) {
      return NextResponse.json({ error: "Upload at least one photo to generate listing copy." }, { status: 400 });
    }
    if (photos.length > 8) {
      return NextResponse.json({ error: "Use up to 8 photos for this demo." }, { status: 400 });
    }

    for (const file of photos) {
      if (!file.type.startsWith("image/")) {
        return NextResponse.json({ error: "Only image uploads are supported." }, { status: 400 });
      }
      if (file.size > 8 * 1024 * 1024) {
        return NextResponse.json({ error: "Each image must be under 8MB." }, { status: 400 });
      }
    }

    const parsedFacts = formSchema.safeParse({
      bedrooms: formData.get("bedrooms"),
      bathrooms: formData.get("bathrooms"),
      sqft: formData.get("sqft"),
      neighborhood: formData.get("neighborhood"),
      rent: formData.get("rent"),
      petPolicy: formData.get("petPolicy"),
      amenities: formData.get("amenities"),
      standoutNotes: formData.get("standoutNotes"),
    });

    if (!parsedFacts.success) {
      const message = parsedFacts.error.issues[0]?.message ?? "Invalid form fields.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const client = getOpenAIClient();
    const imageBlocks = await Promise.all(
      photos.map(async (file) => {
        const bytes = await file.arrayBuffer();
        const base64 = Buffer.from(bytes).toString("base64");
        return {
          type: "input_image" as const,
          image_url: toDataUrl(file, base64),
        };
      }),
    );

    const visionFormat: OpenAIResponseFormat = {
      type: "json_schema",
      json_schema: {
        name: "landlord_vision_summary",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["styleKeywords", "naturalLight", "condition", "notableFeatures", "likelyRoomTypes", "confidenceNote"],
          properties: {
            styleKeywords: { type: "array", minItems: 1, maxItems: 6, items: { type: "string" } },
            naturalLight: { type: "string", enum: ["low", "medium", "high"] },
            condition: { type: "string", enum: ["needs-updates", "good", "renovated"] },
            notableFeatures: { type: "array", minItems: 1, maxItems: 8, items: { type: "string" } },
            likelyRoomTypes: { type: "array", minItems: 1, maxItems: 8, items: { type: "string" } },
            confidenceNote: { type: "string", minLength: 5, maxLength: 240 },
          },
        },
      },
    };

    const visionResponse = await withTimeout(
      client.responses.create({
        model: "gpt-4o-mini",
        temperature: 0.2,
        input: [
          {
            role: "system",
            content:
              "You are an expert real-estate visual analyst. Only describe what can be reasonably inferred from apartment listing photos.",
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Review these listing photos and extract concise visual attributes for marketing copy.",
              },
              ...imageBlocks,
            ],
          },
        ],
        text: {
          format: visionFormat,
        },
      }),
      30000,
      "Image understanding stage",
    );

    const visionRaw = visionResponse.output_text;
    const visionParsed = visionSummarySchema.safeParse(JSON.parse(visionRaw));
    if (!visionParsed.success) {
      throw new Error("Could not parse image understanding output.");
    }
    const visionSummary: LandlordVisionSummary = visionParsed.data;

    const copyFormat: OpenAIResponseFormat = {
      type: "json_schema",
      json_schema: {
        name: "landlord_generated_copy",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["title", "description"],
          properties: {
            title: { type: "string", minLength: 5, maxLength: 80 },
            description: { type: "string", minLength: 80, maxLength: 2200 },
          },
        },
      },
    };

    const facts = parsedFacts.data;
    const copyResponse = await withTimeout(
      client.responses.create({
        model: "gpt-4o",
        temperature: 0.7,
        input: [
          {
            role: "system",
            content:
              "You write premium apartment listing copy. Keep it vivid, honest, and specific. Mention neighborhood context, layout, amenities, and one practical tradeoff. No false claims.",
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  "Generate listing copy from these facts and visual cues.",
                  `Facts: ${JSON.stringify(facts)}`,
                  `Visual summary: ${JSON.stringify(visionSummary)}`,
                  "Output title (5-10 words) and a 2-4 paragraph description.",
                ].join("\n"),
              },
            ],
          },
        ],
        text: {
          format: copyFormat,
        },
      }),
      30000,
      "Copy generation stage",
    );

    const copyRaw = copyResponse.output_text;
    const generatedCopyParsed = generatedCopySchema.safeParse(JSON.parse(copyRaw));
    if (!generatedCopyParsed.success) {
      throw new Error("Could not parse generated listing copy.");
    }

    const payload: LandlordGeneratedCopyResponse = {
      visionSummary,
      generatedCopy: generatedCopyParsed.data,
    };
    return NextResponse.json(payload);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json(
      {
        error:
          "I had trouble generating listing copy right now. Please try again in a moment.",
        details: reason,
      },
      { status: 500 },
    );
  }
}
