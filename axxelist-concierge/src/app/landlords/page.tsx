import { LandlordCopyGenerator } from "@/components/landlord-copy-generator";

export const dynamic = "force-dynamic";

export default function LandlordsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 lg:px-10">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Axxelist</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Landlord Copy Generator</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            Demo workflow: upload real listing photos, add the core facts, and generate polished marketing copy powered by
            AI image understanding plus structured text generation.
          </p>
        </header>

        <LandlordCopyGenerator />
      </div>
    </main>
  );
}
