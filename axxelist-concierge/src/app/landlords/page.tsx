import Link from "next/link";
import { LandlordCopyGenerator } from "@/components/landlord-copy-generator";

export default function LandlordsPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Axxelist</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Landlord Listing Copy Generator</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Upload listing photos and facts, then generate polished listing copy using AI-powered visual understanding.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100"
          >
            Back to concierge demo
          </Link>
        </header>

        <LandlordCopyGenerator />
      </div>
    </main>
  );
}
