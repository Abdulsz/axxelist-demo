# Axxelist Concierge Demo

Conversational apartment discovery demo for Oakland listings, powered by Supabase + OpenAI.

## Stack

- Next.js 14 App Router + TypeScript
- Tailwind + shadcn/ui
- Supabase Postgres + pgvector
- OpenAI for summaries and semantic matching helpers

## Environment

Copy `.env.local.example` to `.env.local` and set:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
```

## Run

```bash
pnpm install
pnpm seed
pnpm dev
```

Open `http://localhost:3000` (or the next available port shown in terminal).

## Routes

- `POST /api/search` - structured listing search
- `GET /api/listings/[id]` - single listing fetch
- `POST /api/concierge` - concierge interactions + tool events

## 90-second demo script

1. Open the app. Grid shows Oakland listings and the concierge panel.
2. In chat, send:  
   `2BR under $2,500 in a walkable Oakland neighborhood, dogs ok, near BART.`
3. Confirm filter chips animate and grid updates.
4. Click the top card. Drawer opens and AI summary appears.
5. In chat (or drawer action), ask:  
   `find me something like this but cheaper and closer to downtown`
6. Confirm grid morphs to alternatives and tradeoff text appears.
7. Click **Reset demo** in header.

## Backup prompts

- `Loft with lots of natural light in Jack London Square`
- `Quiet 1BR in Rockridge with parking`
- `Show me pet-friendly options near transit under $3000`

## Known issues / TODOs

- Concierge response path currently returns structured JSON events (not token-level stream transport).
- OpenAI quota limits may trigger graceful fallback copy/summary behavior.
- Image rendering currently uses `<img>` for speed of implementation; can migrate to `next/image` later.
