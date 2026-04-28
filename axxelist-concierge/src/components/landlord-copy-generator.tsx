"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Sparkles, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { LandlordCopyGeneratorResponse } from "@/lib/types";

type PhotoPreview = {
  file: File;
  previewUrl: string;
};

const DEFAULT_FORM = {
  bedrooms: "2",
  bathrooms: "1.5",
  sqft: "950",
  neighborhood: "",
  rent: "",
  pet_policy: "both",
  amenities: "in-unit laundry, dishwasher, natural light, parking",
  standout_notes: "",
};
const PET_POLICIES = ["none", "cats", "dogs", "both"] as const;

type FormState = typeof DEFAULT_FORM;

export function LandlordCopyGenerator() {
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [formValues, setFormValues] = useState<FormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationHint, setValidationHint] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [result, setResult] = useState<LandlordCopyGeneratorResponse | null>(null);
  const [copied, setCopied] = useState<"title" | "description" | null>(null);

  const formIsComplete = useMemo(() => {
    return Boolean(
      photos.length > 0 &&
        formValues.neighborhood.trim() &&
        formValues.rent.trim() &&
        formValues.standout_notes.trim(),
    );
  }, [formValues.neighborhood, formValues.rent, formValues.standout_notes, photos.length]);

  useEffect(() => {
    return () => {
      photos.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, [photos]);

  function handleFileInput(files: FileList | null) {
    if (!files?.length) return;

    const next = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, 6)
      .map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));

    setPhotos((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return next;
    });
  }

  function removePhoto(index: number) {
    setPhotos((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((_, i) => i !== index);
    });
  }

  async function copyText(kind: "title" | "description", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1400);
      return;
    } catch {
      const fallback = document.createElement("textarea");
      fallback.value = value;
      fallback.style.position = "fixed";
      fallback.style.opacity = "0";
      document.body.appendChild(fallback);
      fallback.select();
      const copiedWithFallback = document.execCommand("copy");
      document.body.removeChild(fallback);
      if (copiedWithFallback) {
        setCopied(kind);
        setTimeout(() => setCopied(null), 1400);
      } else {
        setError("Clipboard access is blocked in this browser. Copy manually from the draft text.");
      }
    }
  }

  async function handleGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitAttempted(true);
    setError(null);
    setValidationHint(null);
    setLoading(true);
    setResult(null);

    try {
      const missing: string[] = [];
      if (!photos.length) missing.push("at least one photo");
      if (!formValues.neighborhood.trim()) missing.push("neighborhood");
      if (!formValues.rent.trim()) missing.push("monthly rent");
      if (!formValues.standout_notes.trim()) missing.push("standout notes");
      if (missing.length) {
        setValidationHint(`Add ${missing.join(", ")} before generating.`);
        return;
      }

      const data = new FormData();
      photos.forEach((photo) => data.append("photos", photo.file));
      Object.entries(formValues).forEach(([key, value]) => data.append(key, value));

      const response = await fetch("/api/landlords/generate-copy", {
        method: "POST",
        body: data,
      });
      const payload = (await response.json()) as LandlordCopyGeneratorResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to generate listing copy.");
      }
      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate copy right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-xl">Landlord Listing Copy Generator</CardTitle>
          <CardDescription>
            Upload photos, provide core listing facts, and get a polished title plus full description draft.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleGenerate}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800" htmlFor="photos">
                Photos (up to 6)
              </label>
              <label
                htmlFor="photos"
                className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center transition hover:border-slate-500 hover:bg-slate-100 focus-within:border-slate-600"
              >
                <Upload className="mb-2 size-4 text-slate-600" />
                <p className="text-sm text-slate-700">Click to upload listing photos</p>
                <p className="text-xs text-slate-500">JPG, PNG, WEBP (local files only)</p>
              </label>
              <Input
                id="photos"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFileInput(e.target.files)}
              />
              {photos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {photos.map((photo, index) => (
                    <div key={photo.previewUrl} className="group relative overflow-hidden rounded-md border border-slate-200">
                      <img src={photo.previewUrl} alt={`Uploaded preview ${index + 1}`} className="h-20 w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                        aria-label="Remove photo"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Bedrooms" className="focus-visible:ring-2 focus-visible:ring-slate-400/60" value={formValues.bedrooms} onChange={(e) => setFormValues((v) => ({ ...v, bedrooms: e.target.value }))} />
              <Input placeholder="Bathrooms" className="focus-visible:ring-2 focus-visible:ring-slate-400/60" value={formValues.bathrooms} onChange={(e) => setFormValues((v) => ({ ...v, bathrooms: e.target.value }))} />
              <Input placeholder="Square feet" className="focus-visible:ring-2 focus-visible:ring-slate-400/60" value={formValues.sqft} onChange={(e) => setFormValues((v) => ({ ...v, sqft: e.target.value }))} />
              <Input placeholder="Monthly rent (USD)" className="focus-visible:ring-2 focus-visible:ring-slate-400/60" value={formValues.rent} onChange={(e) => setFormValues((v) => ({ ...v, rent: e.target.value }))} />
              <Input
                placeholder="Neighborhood (e.g. Rockridge)"
                className="sm:col-span-2 focus-visible:ring-2 focus-visible:ring-slate-400/60"
                value={formValues.neighborhood}
                onChange={(e) => setFormValues((v) => ({ ...v, neighborhood: e.target.value }))}
              />
              <Input
                placeholder="Amenities (comma-separated)"
                className="sm:col-span-2 focus-visible:ring-2 focus-visible:ring-slate-400/60"
                value={formValues.amenities}
                onChange={(e) => setFormValues((v) => ({ ...v, amenities: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-800">Pet policy</p>
              <div className="flex flex-wrap gap-2">
                {PET_POLICIES.map((policy) => (
                  <Button
                    key={policy}
                    type="button"
                    variant={formValues.pet_policy === policy ? "default" : "outline"}
                    onClick={() => setFormValues((v) => ({ ...v, pet_policy: policy }))}
                  >
                    {policy}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800" htmlFor="standout-notes">
                Standout notes or quirks
              </label>
              <textarea
                id="standout-notes"
                className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-0 transition focus:border-slate-500 focus-visible:ring-2 focus-visible:ring-slate-400/60"
                placeholder="Example: Top-floor corner unit, west-facing windows, older kitchen cabinets but newly renovated bathroom."
                value={formValues.standout_notes}
                onChange={(e) => setFormValues((v) => ({ ...v, standout_notes: e.target.value }))}
              />
            </div>

            {validationHint ? <p className="text-sm text-amber-700">{validationHint}</p> : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            {!formIsComplete && !loading ? (
              <p className="text-xs text-slate-500">Add photos, neighborhood, monthly rent, and standout notes to generate.</p>
            ) : null}
            {submitAttempted && !formIsComplete ? (
              <p className="text-xs text-amber-700">Missing required inputs. Upload at least one photo and complete the required fields.</p>
            ) : null}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Generating..." : "Generate listing copy"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="size-4" />
            AI Draft Output
          </CardTitle>
          <CardDescription>Editable draft for your listing page or MLS copy.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {result ? (
            <>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Title</p>
                  <Button variant="outline" size="sm" onClick={() => void copyText("title", result.generated_copy.title)}>
                    <Copy className="size-3.5" />
                    {copied === "title" ? "Copied" : "Copy"}
                  </Button>
                </div>
                <p className="text-lg font-semibold text-slate-900">{result.generated_copy.title}</p>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Description</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void copyText("description", result.generated_copy.description)}
                  >
                    <Copy className="size-3.5" />
                    {copied === "description" ? "Copied" : "Copy"}
                  </Button>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{result.generated_copy.description}</p>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Visual cues used</p>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {result.vision_summary.notable_features.map((feature) => (
                    <Badge key={feature} variant="secondary">
                      {feature}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-slate-600">{result.vision_summary.confidence_note}</p>
              </div>
            </>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Generation failed. Fix any inputs and try again.
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
              Generate copy to preview a ready-to-edit landlord draft.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
