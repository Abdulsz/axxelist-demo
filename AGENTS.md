# AGENTS.md — Axxelist AI Concierge Demo

You are building a working demo of an **AI Concierge** for [Axxelist](https://axxelist.com/estates/grid). The pitch: replace rigid filter UI with a conversational agent that understands natural language, summarizes listings, and refines results conversationally.

The audience cares about **what the product feels like**, not the plumbing. Build for "wow moments," not feature breadth.

---

## 1. Goal & scope

Ship a Next.js app with:

1. A listings grid (mirrors Axxelist's `/estates/grid` look) populated from Supabase.
2. A right-side **AI Concierge** chat panel that drives three flows:
   - **Natural-language search** → translates a sentence into filters and runs the query. Filter chips animate into the grid as proof the AI understood.
   - **AI listing summary** → click a card, get a streamed 4–6 bullet TL;DR.
   - **Conversational refinement** → "find me something like this but cheaper / closer to X" returns 3 alternatives with a written tradeoff.

Out of scope: auth, payments, real photos beyond Unsplash, agent/landlord side, red-flag checker, tour booking. Do not build them.

---

## 2. Tech stack (locked in — do not substitute)

| Layer | Choice |
|---|---|
| Framework | Next.js 14 App Router, TypeScript |
| Styling | Tailwind + shadcn/ui |
| DB + Vectors | Supabase Postgres + pgvector |
| Embeddings | OpenAI `text-embedding-3-small` (1536d) |
| LLM | `gpt-4o` for the agent, `gpt-4o-mini` for summaries |
| Agent framework | **OpenAI Agents SDK** (`@openai/agents`) |
| Streaming UI | Vercel AI SDK (`ai` package, `useChat`) |
| Hosting | Vercel (assume) |

You have Supabase access via the connector / MCP. Use it to create the schema, run migrations, and seed data directly. Do not ask the human to run SQL by hand unless something is genuinely blocked.

---

## 3. Repo layout

```
axxelist-concierge/
├── AGENTS.md                          # this file
├── README.md                          # quickstart + demo script
├── .env.local.example
├── package.json
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── supabase/
│   ├── migrations/
│   │   └── 0001_init.sql              # listings + listing_embeddings + match fn
│   └── seed/
│       ├── generate-listings.ts       # one-shot seed script
│       └── neighborhoods.ts           # Oakland neighborhood metadata
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                   # main demo page (grid + chat)
│   │   ├── globals.css
│   │   └── api/
│   │       ├── concierge/route.ts     # streams Agents SDK responses
│   │       ├── search/route.ts        # structured filter search
│   │       └── listings/[id]/route.ts # single listing fetch
│   ├── components/
│   │   ├── listings-grid.tsx
│   │   ├── listing-card.tsx
│   │   ├── listing-detail-drawer.tsx  # opens on card click, holds AI summary
│   │   ├── filter-chips.tsx           # animated chips
│   │   ├── concierge-panel.tsx        # right-side chat
│   │   ├── concierge-message.tsx
│   │   └── ui/                        # shadcn primitives
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts              # browser client
│   │   │   └── server.ts              # server client w/ service role
│   │   ├── openai.ts
│   │   ├── embeddings.ts
│   │   ├── types.ts                   # Listing, Filters, etc.
│   │   └── store.ts                   # Zustand: filters, selectedListingId
│   └── agent/
│       ├── concierge-agent.ts         # Agents SDK setup
│       ├── tools/
│       │   ├── search-listings.ts
│       │   ├── semantic-search.ts
│       │   ├── summarize-listing.ts
│       │   └── find-similar.ts
│       └── prompts.ts
└── scripts/
    └── seed.ts                        # invokes generate-listings.ts
```

---

## 4. Environment variables

Create `.env.local.example` with these keys; the human will fill `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
```

Never read service role key from a client component.

---

## 5. Supabase schema

Use the Supabase connector to apply this migration. Enable the `vector` extension first.

```sql
-- supabase/migrations/0001_init.sql
create extension if not exists vector;

create table listings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  address text not null,
  city text not null default 'Oakland',
  state text not null default 'CA',
  zip text,
  neighborhood text not null,
  lat double precision not null,
  lng double precision not null,
  price int not null,                -- monthly rent USD
  bedrooms numeric not null,         -- 0 = studio
  bathrooms numeric not null,
  sqft int,
  property_type text not null check (property_type in ('apartment','condo','loft')),
  amenities text[] not null default '{}',
  photos text[] not null default '{}',
  pet_policy text not null,          -- 'none' | 'cats' | 'dogs' | 'both'
  transit_distance_mi numeric,       -- to nearest BART
  walk_score int,
  created_at timestamptz not null default now()
);

create index on listings (city, state);
create index on listings (price);
create index on listings (bedrooms);
create index on listings (neighborhood);

create table listing_embeddings (
  listing_id uuid primary key references listings(id) on delete cascade,
  embedding vector(1536) not null,
  content text not null
);

create index on listing_embeddings using hnsw (embedding vector_cosine_ops);

-- Hybrid match function used by semantic_search tool.
create or replace function match_listings(
  query_embedding vector(1536),
  match_count int default 10,
  min_price int default 0,
  max_price int default 100000,
  min_bedrooms numeric default 0,
  required_pets text default null      -- 'cats' | 'dogs' | 'both' | null
)
returns table (
  id uuid,
  similarity float
)
language sql stable as $$
  select
    l.id,
    1 - (e.embedding <=> query_embedding) as similarity
  from listing_embeddings e
  join listings l on l.id = e.listing_id
  where l.price between min_price and max_price
    and l.bedrooms >= min_bedrooms
    and (
      required_pets is null
      or l.pet_policy = 'both'
      or l.pet_policy = required_pets
    )
  order by e.embedding <=> query_embedding
  limit match_count;
$$;
```

Apply via the Supabase connector. Verify with a `select count(*) from listings;` after seeding.

---

## 6. Mock listing generation

Generate **50 Oakland listings** with realistic spread. One-shot script at `supabase/seed/generate-listings.ts`. Idempotent: if `listings` already has ≥40 rows, skip. Otherwise truncate and re-seed.

### Distribution targets

- **Neighborhoods (with approx lat/lng):**

  ```ts
  // supabase/seed/neighborhoods.ts
  export const NEIGHBORHOODS = [
    { name: 'Rockridge',          lat: 37.8443, lng: -122.2519, vibe: 'leafy, walkable, foodie' },
    { name: 'Temescal',           lat: 37.8356, lng: -122.2640, vibe: 'hip, indie shops, brunch' },
    { name: 'Lake Merritt',       lat: 37.8076, lng: -122.2585, vibe: 'scenic, joggers, central' },
    { name: 'Downtown',           lat: 37.8044, lng: -122.2712, vibe: 'urban, transit-rich, nightlife' },
    { name: 'Jack London Square', lat: 37.7950, lng: -122.2770, vibe: 'waterfront, lofts, ferry' },
    { name: 'Adams Point',        lat: 37.8160, lng: -122.2580, vibe: 'quiet, residential, lake-adjacent' },
    { name: 'Piedmont Ave',       lat: 37.8270, lng: -122.2500, vibe: 'charming, tree-lined, cafes' },
    { name: 'Grand Lake',         lat: 37.8120, lng: -122.2470, vibe: 'farmers market, theater, family' },
  ];
  export const DOWNTOWN = { lat: 37.8044, lng: -122.2712 };
  ```

- **Beds:** ~15% studio, ~40% 1BR, ~35% 2BR, ~10% 3BR.
- **Price bands** (correlate with beds + neighborhood premium):
  - studio $1,800–2,400
  - 1BR $2,000–3,200
  - 2BR $2,600–4,500
  - 3BR $3,500–5,500
  - Add +$200–500 for Rockridge / Piedmont Ave / Grand Lake.
- **Property types:** ~70% apartment, 20% condo, 10% loft (lofts cluster in Jack London Square + Downtown).
- **Pets:** ~25% none, 25% cats, 15% dogs, 35% both.
- **Amenities pool:** `in-unit laundry, shared laundry, parking, garage, gym, pool, rooftop, balcony, dishwasher, hardwood floors, stainless appliances, central ac, hvac, dog park, ev charging, bike storage, doorman, elevator, fireplace, walk-in closet, renovated kitchen, natural light`. Pick 4–8 per listing.
- **Walk score:** 70–98, weighted by neighborhood (Downtown highest).
- **Transit distance:** 0.1–1.5 mi from BART.
- **Photos:** Use 3–5 Unsplash URLs per listing. Pull from a curated list of apartment-interior photo IDs (hardcode ~30 known-good Unsplash IDs and randomly sample). Use the format `https://images.unsplash.com/photo-{id}?w=1200&q=80`.

### Generation logic

For each listing:

1. Pick neighborhood, beds, type, pets, amenities, walk score, transit distance per distributions above.
2. Compute price within band + neighborhood premium + small jitter.
3. Compute sqft as `bedrooms_to_base_sqft + jitter` (studio 450, 1BR 650, 2BR 950, 3BR 1300, ±15%).
4. Lat/lng: neighborhood center + small jitter (±0.005°).
5. Address: random street number + plausible Oakland street name (hardcode a list of ~25 real Oakland streets).
6. Use **OpenAI structured outputs** (`gpt-4o-mini`, `response_format: { type: 'json_schema' }`) to generate `title` + `description` from the structured facts. One LLM call per listing is fine for 50 listings; batch in parallel with `Promise.all` chunks of 10.

   Title: catchy, 5–10 words, mentions a standout feature.
   Description: 2–4 short paragraphs, mentions neighborhood vibe, layout, 2–3 amenities, and a tradeoff or quirk so listings feel distinct.

7. Insert all listings into `listings` (single batch insert).
8. Build embedding text per listing:
   ```
   {title}. {neighborhood}, Oakland. {bedrooms}BR/{bathrooms}BA, {sqft} sqft, ${price}/mo. {property_type}. Amenities: {amenities joined}. Pets: {pet_policy}. {description}
   ```
9. Embed all in batches of 50 with `text-embedding-3-small`.
10. Insert into `listing_embeddings`.

Run via `pnpm seed`. Log a summary table at the end: count by neighborhood, count by beds, price min/median/max.

---

## 7. The agent (OpenAI Agents SDK)

Single agent with four tools. Server-side only. Stream responses to the client via the Vercel AI SDK.

### System prompt (in `src/agent/prompts.ts`)

```
You are the Axxelist Concierge, a friendly real-estate assistant for apartment hunters in Oakland, California.

Your job:
1. Translate natural-language requests into structured searches and run them.
2. Summarize individual listings clearly and honestly.
3. Help users refine results conversationally ("cheaper", "closer to downtown", "with parking").

Style:
- Warm, concise, confident. Never robotic.
- Lead with the answer; details after.
- When you call a search tool, briefly tell the user what you understood ("Looking for 2BR under $2,500 in walkable neighborhoods, dogs welcome…") before showing results.
- After results, give a one-sentence framing ("Here are 7 matches — the top one is in Temescal because…").
- Never invent listings. Only describe listings returned by your tools.
- If nothing matches, say so and propose a relaxed filter.

When summarizing a listing, output 4–6 bullets covering: standout features, layout, neighborhood vibe, commute/transit, and a tradeoff or thing-to-know.
```

### Tools

All tools live in `src/agent/tools/` and return JSON. Define them with the Agents SDK `tool()` helper and Zod schemas.

#### `search_listings`

Structured filter search. No embeddings.

Input schema:
```ts
{
  bedrooms_min?: number;
  bedrooms_max?: number;
  price_min?: number;
  price_max?: number;
  neighborhoods?: string[];
  property_types?: ('apartment'|'condo'|'loft')[];
  pets?: 'cats'|'dogs'|'both';
  required_amenities?: string[];   // matches via array contains
  near_transit?: boolean;          // transit_distance_mi <= 0.5
  min_walk_score?: number;
  limit?: number;                  // default 8
}
```

Returns: `{ listings: Listing[], total: number, applied_filters: {...} }`.

Side effect: After this tool runs, the API route should also stream a `tool_event` to the client with the applied filters so the UI can animate the filter chips. (See §9 for the streaming protocol.)

#### `semantic_search`

For fuzzy queries ("cozy", "lots of light", "great for remote work"). Embeds the query and calls `match_listings` SQL function. Accepts the same numeric/pet filters as `search_listings` for hybrid search.

Input:
```ts
{
  query: string;
  bedrooms_min?: number;
  price_min?: number;
  price_max?: number;
  pets?: 'cats'|'dogs'|'both';
  limit?: number;  // default 6
}
```

Returns: `{ listings: Listing[], scores: Record<string, number> }`.

#### `summarize_listing`

Input: `{ listing_id: string }`.

Implementation: fetch the listing row, then call `gpt-4o-mini` with a focused prompt to produce 4–6 bullets. Return `{ listing_id, summary_bullets: string[] }`.

The agent then formats this for the user. Also stream a `tool_event` with `{ kind: 'show_summary', listing_id, bullets }` so the detail drawer can render it.

#### `find_similar`

Input:
```ts
{
  listing_id: string;
  cheaper?: boolean;          // require price < 0.9 * source price
  closer_to?: 'downtown'|'bart'|string;  // can be neighborhood name
  must_keep_amenities?: string[];
  limit?: number;             // default 3
}
```

Implementation:
1. Fetch source listing + its embedding.
2. Run `match_listings` with embedding, filter by `price < source.price * 0.9` if `cheaper`.
3. If `closer_to === 'downtown'`, post-filter by Haversine distance to `DOWNTOWN`; otherwise to the named neighborhood's lat/lng (fall back to BART proximity if unknown).
4. Return top N with a `tradeoff` field per result, computed from a quick LLM call comparing source vs. candidate ("$400/mo cheaper, 1.2 mi closer, but no in-unit laundry").

Returns `{ source_listing_id, results: { listing: Listing, tradeoff: string }[] }`. Stream a `tool_event` `{ kind: 'replace_grid', listing_ids }` so the grid morphs.

### Agent wiring (`src/agent/concierge-agent.ts`)

```ts
import { Agent } from '@openai/agents';
import { searchListings } from './tools/search-listings';
import { semanticSearch } from './tools/semantic-search';
import { summarizeListing } from './tools/summarize-listing';
import { findSimilar } from './tools/find-similar';
import { CONCIERGE_SYSTEM_PROMPT } from './prompts';

export const conciergeAgent = new Agent({
  name: 'Axxelist Concierge',
  model: 'gpt-4o',
  instructions: CONCIERGE_SYSTEM_PROMPT,
  tools: [searchListings, semanticSearch, summarizeListing, findSimilar],
});
```

---

## 8. API routes

### `POST /api/concierge`

Body: `{ messages: Message[], context?: { selectedListingId?: string } }`.

- Build the agent run with messages.
- If `context.selectedListingId` is set, prepend a system note: `"User is currently viewing listing {id}. If they say 'this listing' assume they mean that one."`
- Stream the run using the Vercel AI SDK's data stream protocol so we can interleave token deltas and `tool_event` data parts.
- Tool events to emit:
  - `{ kind: 'apply_filters', filters }`
  - `{ kind: 'show_results', listing_ids }`
  - `{ kind: 'show_summary', listing_id, bullets }`
  - `{ kind: 'replace_grid', listing_ids }`

### `POST /api/search`

Pure structured search, used by the grid for direct filter chip edits. Same input shape as `search_listings` tool.

### `GET /api/listings/[id]`

Fetch a single listing by id.

---

## 9. UI

### Layout

Two-pane layout, full viewport:

- **Left (≈65%):** sticky header with logo "Axxelist" + filter chips row, then a 3-column responsive grid of listing cards.
- **Right (≈35%):** persistent concierge chat panel. Sticky, full height, with a message stream and an input pinned to the bottom. Above the input, show 3 "starter prompt" chips on first load:
  - "2BR under $2,500 near BART, dogs ok"
  - "Loft with lots of natural light in Jack London Square"
  - "Quiet 1BR in Rockridge with parking"

### Listing card

Photo carousel (first photo only by default), title, neighborhood, beds/baths/sqft, price/mo, 2-3 amenity badges. Click → opens detail drawer.

### Detail drawer

Slides in from the right, overlays the chat panel temporarily. Shows full photo gallery, full description, all amenities, map pin. **AI Summary section** at the top with a "Generate" button (or auto-runs on open). When summary streams in, render bullets with a subtle typing animation.

Inside the drawer: a button "Find similar but cheaper" and "Find closer to downtown" — these dispatch a pre-canned message to the agent.

### Filter chips animation

- Use Framer Motion. When `apply_filters` event arrives, chips fade + slide in from left, stagger 60ms.
- When user starts a new search, old chips fade out before new ones arrive.

### Grid morph

- When `replace_grid` event arrives, animate cards out (opacity + y translate), wait 200ms, render new cards in.

### State management (`src/lib/store.ts`)

Single Zustand store:
```ts
{
  listings: Listing[];          // currently shown in grid
  appliedFilters: Filters;
  selectedListingId: string | null;
  summaries: Record<string, string[]>;   // cached summaries
  mode: 'browsing' | 'similar';          // affects header copy
}
```

The chat panel uses `useChat` from `ai/react`; tool events update the Zustand store via the `onData` callback.

---

## 10. Build order — follow this exactly

1. **Init project.** `pnpm create next-app@latest axxelist-concierge --ts --tailwind --app --src-dir`. Add deps: `@supabase/supabase-js`, `@openai/agents`, `openai`, `ai`, `zod`, `zustand`, `framer-motion`, `lucide-react`, `clsx`, `tailwind-merge`. Install shadcn and add: button, card, input, badge, drawer, scroll-area, skeleton.
2. **Supabase schema.** Apply migration via the connector. Verify the `vector` extension and `match_listings` function exist.
3. **Seed script.** Implement `supabase/seed/generate-listings.ts` per §6. Run it. Verify 50 rows + 50 embeddings. Print summary.
4. **Types + Supabase clients.** `src/lib/types.ts`, `src/lib/supabase/{client,server}.ts`.
5. **`/api/search` + `/api/listings/[id]`.** Plain CRUD, no AI yet.
6. **Static UI.** Grid + card + drawer rendering from real Supabase data. No chat yet. Confirm it looks like a real product.
7. **Agent + tools.** Implement all four tools. Unit-test each via a scratch script before wiring to the route.
8. **`/api/concierge` route.** Streaming with tool events.
9. **Concierge panel.** `useChat` + starter prompts + custom rendering for tool events.
10. **Filter chip animation + grid morph.**
11. **AI summary in drawer.** Auto-runs on open.
12. **Polish:** loading skeletons, error boundaries, empty states, "reset demo" button in the header (clears chat + restores all listings).
    - Run the `visual-ui-browser-qa` subagent here to validate responsive layout, spacing, overflow, interaction states, and theme consistency before finalizing polish.
13. **README + demo script.** See §12.

After each step, run `pnpm dev` and screenshot or describe what should now work. Don't proceed if the previous step is broken.

At milestones after steps 6, 9, 11, and 12, run the `ui-flow-browser-tester` subagent to validate end-to-end flows and catch regressions early.

---

## 10.1 Subagent delegation (required)

Use the project subagents in `.cursor/agents/` for browser-based QA at the appropriate phases:

- `ui-flow-browser-tester`
  - Use after major behavior changes (grid interactions, chat flows, drawer actions, API wiring).
  - Focus on end-to-end paths, validation, loading/error states, and reproducible functional bugs.
- `visual-ui-browser-qa`
  - Use during polish and before final demo sign-off.
  - Focus on visual regressions, responsive layout integrity, interaction-state visuals, spacing/typography consistency, and overflow/clipping issues.

Minimum enforcement:
- Before declaring any step complete from §10 step 6 onward, run at least one relevant subagent pass.
- Before final "done" report (§14), run both subagents once on the latest build and include findings or "no issues found" notes.

---

## 10.2 Subagent prompt templates (copy/paste)

Use these prompt templates with the project subagents to keep QA runs consistent.

### Template A — Functional flow pass (`ui-flow-browser-tester`)

```
Test this app's highest-risk user journeys using Cursor Browser.

Scope:
- Primary flow: [describe exact path, e.g., "search -> open listing -> generate summary -> find similar"]
- Edge flows: [list 2-3]
- Validation/error checks: [list expected invalid inputs / failure cases]

Environment:
- Base URL: [http://localhost:3000]
- Build/branch context: [optional]

Output required:
1) Tested Flows (pass/fail)
2) Findings sorted by severity (critical/high/medium/low)
3) Repro steps + actual vs expected for each issue
4) Open risks / not covered
5) Recommended next tests
```

### Template B — Visual regression pass (`visual-ui-browser-qa`)

```
Run visual QA/regression testing with Cursor Browser across key screens.

Scope:
- Screens: [list 3-6 key routes/views]
- Breakpoints: mobile, tablet, desktop
- Theme: [light only / dark only / both]
- States to inspect: default, hover/focus, loading, error, empty

Check for:
- Layout/alignment issues
- Spacing/typography inconsistencies
- Overflow/clipping/truncation
- Z-index/layering issues
- Responsiveness breaks near breakpoints
- Contrast/readability issues

Output required:
1) Coverage Matrix (screen x breakpoint x theme)
2) Findings by severity (high/medium/low) with repro steps
3) Visual risks not covered
4) Suggested follow-up checks
```

### Template C — Final release gate (run both)

```
Run a release-gate QA pass for this app.

Step 1: Use ui-flow-browser-tester
- Validate 2-3 highest-risk end-to-end user journeys
- Include validation/error-state checks

Step 2: Use visual-ui-browser-qa
- Validate the same screens for visual/regression quality across breakpoints

Final report:
- GO / NO-GO recommendation
- Blockers (if any)
- Non-blocking issues
- Residual risk summary
```

---

## 11. Quality bar

- TypeScript strict mode. No `any` outside narrow casts at trust boundaries.
- All Supabase queries server-side except read-only listing fetches (which can use anon key).
- All LLM calls have a 30s timeout and graceful fallback ("I had trouble — try again").
- Zod-validate every tool input.
- The demo must be runnable with `pnpm install && pnpm seed && pnpm dev`. Document any manual steps in README.
- No console errors in the browser during a normal demo run.
- Browser QA is mandatory: run `ui-flow-browser-tester` for functional validation and `visual-ui-browser-qa` for visual/regression validation before sign-off.

---

## 12. Demo script (put this in README)

A 90-second flow the human will perform live:

1. Open the app. Grid shows 12 Oakland listings, no filters applied.
2. In the chat: type *"2BR under $2,500 in a walkable Oakland neighborhood, dogs ok, near BART."* → filter chips animate in, grid filters to ~6 results, agent explains the picks.
3. Click the top card → drawer opens, AI summary streams in as 5 bullets.
4. In the chat: type *"find me something like this but cheaper and closer to downtown."* → grid morphs to 3 alternatives, agent writes a one-paragraph tradeoff comparison.
5. Click "Reset demo" to start over for the next stakeholder.

Include 3 backup prompts in case the live one misfires.

---

## 13. Things to NOT do

- Don't add authentication.
- Don't build admin/agent dashboards.
- Don't wire real MLS data — the mock is the point.
- Don't add a red-flag checker, tour booking, or affordability coach (those are roadmap, not demo).
- Don't use Pinecone/Weaviate/etc. — pgvector is the choice.
- Don't replace the OpenAI Agents SDK with raw `chat.completions` to "simplify." The Agents SDK is part of the pitch.
- Don't skip the filter-chip animation — it's the single most persuasive moment.

---

## 14. When you finish

Report:
- Number of listings seeded + neighborhood distribution.
- A list of routes built and their status.
- One screenshot description per "magic moment" (filter chips animating, summary streaming, grid morphing).
- Any TODOs or known issues.
- The exact `pnpm` commands the human should run for the live demo.
