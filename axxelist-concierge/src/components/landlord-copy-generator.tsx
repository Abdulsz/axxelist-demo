"use client";

import { useMemo, useState } from "react";
import type {
  LandlordGeneratedCopyResponse,
  LandlordPetPolicy,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PET_OPTIONS: Array<{ label: string; value: LandlordPetPolicy }> = [
  { label: "No pets", value: "none" },
  { label: "Cats", value: "cats" },
  { label: "Dogs", value: "dogs" },
  { label: "Cats + Dogs", value: "both" },
];

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

type LocalErrors = Partial<Record<"photos" | "amenities" | "neighborhood", string>>;

export function LandlordCopyGenerator() {
  const [photos, setPhotos] = useState<File[]>([]);
  const [bedrooms, setBedrooms] = useState("2");
  const [bathrooms, setBathrooms] = useState("2");
  const [sqft, setSqft] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [rent, setRent] = useState("3200");
  const [petPolicy, setPetPolicy] = useState<LandlordPetPolicy>("both");
  const [amenities, setAmenities] = useState("in-unit laundry, dishwasher, parking, natural light");
  const [standoutNotes, setStandoutNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localErrors, setLocalErrors] = useState<LocalErrors>({});
  const [result, setResult] = useState<LandlordGeneratedCopyResponse | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "title" | "description">("idle");

  const previews = useMemo(
    () =>
      photos.map((file) => ({
        key: fileKey(file),
        file,
        url: URL.createObjectURL(file),
      })),
    [photos],
  );

  function validateClient() {
    const nextErrors: LocalErrors = {};
    if (!photos.length) nextErrors.photos = "Upload at least one image.";
    if (!neighborhood.trim()) nextErrors.neighborhood = "Neighborhood is required.";
    if (!amenities.split(",").map((item) => item.trim()).filter(Boolean).length) {
      nextErrors.amenities = "Add at least one amenity.";
    }
    setLocalErrors(nextErrors);
    return !Object.keys(nextErrors).length;
  }

  function onPhotoChange(fileList: FileList | null) {
    if (!fileList) return;
    const incoming = Array.from(fileList);
    setPhotos((prev) => {
      const existing = new Set(prev.map(fileKey));
      const deduped = incoming.filter((file) => !existing.has(fileKey(file)));
      return [...prev, ...deduped].slice(0, 8);
    });
  }

  function removePhoto(target: File) {
    setPhotos((prev) => prev.filter((file) => fileKey(file) !== fileKey(target)));
  }

  async function generateCopy() {
    setError(null);
    setCopyState("idle");
    if (!validateClient()) return;

    setLoading(true);
    try {
      const formData = new FormData();
      for (const file of photos) {
        formData.append("photos", file);
      }
      formData.append("bedrooms", bedrooms);
      formData.append("bathrooms", bathrooms);
      formData.append("sqft", sqft);
      formData.append("neighborhood", neighborhood);
      formData.append("rent", rent);
      formData.append("petPolicy", petPolicy);
      formData.append("amenities", amenities);
      formData.append("standoutNotes", standoutNotes);

      const response = await fetch("/api/landlords/generate-copy", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as LandlordGeneratedCopyResponse & {
        error?: string;
      };

      if (!response.ok) throw new Error(payload.error ?? "Failed to generate listing copy.");
      setResult(payload);
    } catch (requestError) {
      setResult(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "I had trouble generating listing copy. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyText(value: string, target: "title" | "description") {
    try {
      await navigator.clipboard.writeText(value);
      setCopyState(target);
      setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      setCopyState("idle");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Listing facts + photos</h2>
        <p className="mt-1 text-sm text-slate-600">
          Upload local listing photos, enter key details, then generate polished title and description copy.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Photos (up to 8)</label>
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => onPhotoChange(event.target.files)}
              disabled={loading}
            />
            {localErrors.photos ? <p className="mt-1 text-xs text-red-600">{localErrors.photos}</p> : null}
            {previews.length ? (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {previews.map((item) => (
                  <div key={item.key} className="relative overflow-hidden rounded-lg border border-slate-200">
                    <img src={item.url} alt={item.file.name} className="h-24 w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(item.file)}
                      className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Bedrooms</label>
              <Input type="number" min={0} max={8} value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} disabled={loading} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Bathrooms</label>
              <Input type="number" min={1} max={8} step={0.5} value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} disabled={loading} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Sqft (optional)</label>
              <Input type="number" min={200} max={10000} value={sqft} onChange={(e) => setSqft(e.target.value)} disabled={loading} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Rent (monthly USD)</label>
              <Input type="number" min={500} max={50000} value={rent} onChange={(e) => setRent(e.target.value)} disabled={loading} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Neighborhood</label>
            <Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="e.g., Rockridge" disabled={loading} />
            {localErrors.neighborhood ? <p className="mt-1 text-xs text-red-600">{localErrors.neighborhood}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Pet policy</label>
            <select
              value={petPolicy}
              onChange={(e) => setPetPolicy(e.target.value as LandlordPetPolicy)}
              disabled={loading}
              className="h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-800"
            >
              {PET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Amenities (comma-separated)</label>
            <Input
              value={amenities}
              onChange={(e) => setAmenities(e.target.value)}
              placeholder="in-unit laundry, balcony, EV charging"
              disabled={loading}
            />
            {localErrors.amenities ? <p className="mt-1 text-xs text-red-600">{localErrors.amenities}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Standout notes (optional)</label>
            <textarea
              value={standoutNotes}
              onChange={(e) => setStandoutNotes(e.target.value)}
              disabled={loading}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="Anything you want emphasized (quiet street, top-floor unit, private patio...)"
            />
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        <div className="mt-5 flex items-center gap-2">
          <Button disabled={loading} onClick={() => void generateCopy()}>
            {loading ? "Generating..." : "Generate listing copy"}
          </Button>
          {result ? (
            <Button variant="outline" disabled={loading} onClick={() => void generateCopy()}>
              Regenerate
            </Button>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Draft output</h2>
        <p className="mt-1 text-sm text-slate-600">AI combines your facts with image understanding to produce demo-ready copy.</p>

        {!result ? (
          <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            Your generated title and full description will appear here.
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Generated title</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void copyText(result.generatedCopy.title, "title")}
                >
                  {copyState === "title" ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-lg font-semibold text-slate-900">{result.generatedCopy.title}</p>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Generated description</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void copyText(result.generatedCopy.description, "description")}
                >
                  {copyState === "description" ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{result.generatedCopy.description}</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Vision cues used</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                <li>Style: {result.visionSummary.styleKeywords.join(", ")}</li>
                <li>Natural light: {result.visionSummary.naturalLight}</li>
                <li>Condition: {result.visionSummary.condition}</li>
                <li>Notable features: {result.visionSummary.notableFeatures.join(", ")}</li>
              </ul>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
