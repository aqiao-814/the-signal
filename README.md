# The Signal — your AI-written tech newspaper

A mobile-first web app that reads what influential tech leaders are posting on
**X (Twitter)** and turns it into a concise, **AI-written news brief** — the
story, the conversation it sparked, the most notable replies, and the overall
sentiment. Think of it as a personalized, AI-powered technology newspaper.

It currently follows **Elon Musk** and/or **Sam Altman**, and reads with a clean, Notion-style light UI.

Built with **Next.js 15** (App Router, React Server Components, Server Actions),
TypeScript, Tailwind + shadcn-style UI, Framer Motion, Prisma + PostgreSQL,
Better Auth, Inngest, and a swappable AI summarization layer.

---

## Quick start

```bash
npm install
npm run dev
```

Then open **http://localhost:3000**.

`npm run dev` is one command — it automatically:

1. provisions a local PostgreSQL database (embedded PGlite — see below),
2. applies Prisma migrations,
3. seeds the tracked leaders + briefings so there's content immediately,
4. runs the database and the Next.js dev server together.

## How briefings work

Each briefing is built from the **notable activity** in a coverage window — not
a raw dump of tweets:

- The **top-3 most-liked posts** in the window, and **the single top reply to
  each** post.
- Those are analyzed into an article-style brief: a headline and subject, 2–3
  short paragraphs of prose, the discussion's **sentiment** (read
  proportionally across the replies, weighted by likes), the **themes** people
  kept raising, and a supportive vs. skeptical quote — with spam/bot replies
  filtered out.

On the **dashboard**, each person is a news card (headline, sentiment, topics,
counts). Opening a card shows the full brief plus the **most-liked posts** and
**notable replies** behind it (each labeled with the post it replied to), with
links back to X.

### Refreshing is manual (on purpose)

Hitting the live X API costs money, so **nothing refreshes automatically**. The
app serves the already-generated briefings for free; new data is pulled **only
when you tap Refresh** (or accept the "new day, want to refresh?" prompt). That
keeps everyday use at **$0** and makes it easy to show the live pipeline working
on demand during a demo.

---

## Zero-config database (why there's no Postgres to install)

To keep `npm run dev` truly one-command with **no credentials and no external
services**, this project runs [**PGlite**](https://pglite.dev) — a real
PostgreSQL build compiled to WebAssembly — as a local server over the Postgres
wire protocol. Prisma connects to it exactly like any Postgres server.

- Genuine PostgreSQL (enums, JSONB, arrays, cascades, advisory locks all work),
  so the schema and migrations are 100% portable to Supabase / Neon / RDS.
- Data persists to `.local-postgres/` (gitignored). No Docker, no system
  Postgres, no secrets.

**Moving to hosted Postgres** is a one-line change: set `DATABASE_URL` in `.env`
to your connection string and run `npm run db:deploy && npm run db:seed` (drop
`pgbouncer=true` / `connection_limit=1` unless your pooler needs them).

---

## Integrations — swappable, and everything works without keys

| Integration      | Default (no keys)                                                                                    | With keys                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **X API**        | `INGEST_MODE=mock` uses realistic, on-brand fixtures — the whole pipeline runs without an X account. | Set `X_API_BEARER_TOKEN` + `INGEST_MODE=live` to fetch real posts, replies & conversations.       |
| **AI summaries** | `AI_PROVIDER=template` — a deterministic editorial writer that produces article-style prose.         | Set `AI_PROVIDER` to `anthropic` \| `openai` \| `gemini` \| `huggingface` + the matching API key. |

Use the X bearer token exactly as issued by X (it is already URL-encoded). See
`.env.example` for every variable.

### Hugging Face model

```env
AI_PROVIDER="huggingface"
HUGGINGFACE_API_KEY="hf_..."
AI_MODEL="meta-llama/Llama-3.1-8B-Instruct"   # optional; any instruct model
```

It calls the HF Inference **router** (`router.huggingface.co/v1/chat/completions`,
OpenAI-compatible). Like every provider, it falls back to the template writer if
the model's output can't be parsed, so summaries never fail. The active
provider/model is shown on the dashboard ("Written by …").

### Live X API costs

X bills **per post retrieved**, so cost scales with reply volume. A refresh
costs, per person: **1 (timeline) + `X_REPLY_LOOKUPS` reply searches ×
`X_REPLY_PAGE` posts each**. Defaults keep this small:

- `X_REPLY_LOOKUPS=3` — reply lookups for the top-liked posts (`0` to skip).
- `X_REPLY_PAGE=30` — replies pulled per lookup.
- `X_RATE_PER_MIN=50` — client request budget.

X exposes no real balance/price via its API, so the dashboard's **"X API credits
left"** chip links straight to the [X console](https://console.x.com/) where
your actual usage lives. To spend nothing at all, set `INGEST_MODE="mock"`.

---

## Features

- **Auth** — email/password (Better Auth): register, login, logout, sessions,
  protected routes (edge middleware + server-side checks).
- **Onboarding** — pick which tracked leaders (Elon Musk, Sam Altman) to follow;
  selections persist to Postgres and can be changed anytime.
- **Dashboard** — a personalized front page: a news card per person, plus the
  coverage window, the active LLM badge, and the X-console link.
- **Detail page** — the full brief written like a news article, the most-liked
  posts, and the notable replies (top reply per post, each showing the post it
  replied to), with links back to X.
- **On-demand refresh** — a manual **Refresh** pulls the window's top-3 posts +
  top reply each and regenerates the briefing. No automatic jobs, no surprise
  spend.
- **Freshness prompt** — a "new day, want to refresh?" banner appears once a new
  local calendar day has passed since your last update.
- **Swappable AI** — a provider-agnostic `Summarizer` interface; template /
  Anthropic / OpenAI / Gemini / Hugging Face, chosen by env, with a safe
  fallback.
- **Resilient ingestion** — batching, in-memory user-id caching, token-bucket
  rate limiting, exponential backoff with `Retry-After`, and idempotent upserts
  (dedupe by X id). Never spams the API.
- **UI** — Notion-inspired light theme (warm, flat, no gradients), subtle Framer
  Motion, loading skeletons, empty states, and error boundaries.

---

## Architecture

```
src/
  middleware.ts        optimistic auth gate for protected routes
  instrumentation.ts   Node 18 Web-Crypto polyfill on boot
  app/
    (auth)/            login, register (+ shared auth layout)
    (app)/             protected shell: dashboard, onboarding, person/[handle]
                       (+ template.tsx page transitions)
    api/
      auth/[...all]    Better Auth handler
      inngest          Inngest serve endpoint (on-demand functions only)
      cron/daily       protected, manually-triggered pipeline endpoint
    actions.ts         server actions (save selections, refresh feed)
    error / global-error / not-found
  components/          ui/* primitives + features (news-card, credits-meter,
                       engine-badge, staleness-banner, person-picker,
                       summary-article, tweet/reply items, motion/*)
  lib/                 env (zod), prisma, auth, session, logger, utils,
                       constants, crypto-polyfill
  server/
    x/                 ingestion: types, http (retry/limiter), mock, client,
                       source (live vs mock), ingest (idempotent upserts)
    ai/                types, prompt, providers/* (template, anthropic, openai,
                       gemini, huggingface), index (factory + engine info),
                       summarize (generateBriefing)
    inngest/           client + on-demand functions
    pipeline.ts        ingest + briefing orchestration, JobRun bookkeeping
    schedule.ts        coverage windows + labels
    credits.ts         X API spend tracking
    dashboard.ts / person-detail.ts / people.ts   read queries
scripts/               db-server, db-setup, new-migration, polyfills
prisma/                schema.prisma, migrations/, seed.ts
```

### Data model (Prisma / Postgres)

`User`, `Session`, `Account`, `Verification` (Better Auth) · `TrackedPerson` ·
`SelectedPerson` · `Tweet` · `Reply` · `Conversation` · `DailySummary` (a
briefing, keyed per person + publish day, storing the covered window in
`periodStart`/`periodEnd`) · `JobRun` · `CreditPool`.

---

## Scripts

| Command                                 | What it does                                                    |
| --------------------------------------- | --------------------------------------------------------------- |
| `npm run dev`                           | Set up DB, then run the DB server and Next.js together          |
| `npm run build`                         | `prisma generate` + `next build`                                |
| `npm start`                             | Start the production server (run `npm run db:server` alongside) |
| `npm run db:server`                     | Run the embedded Postgres (PGlite) server on :5433              |
| `npm run db:setup`                      | Migrate + seed once                                             |
| `npm run db:reset`                      | Wipe local data and re-setup                                    |
| `npm run db:migrate:new -- <name>`      | Create + apply a new migration                                  |
| `npm run db:studio`                     | Prisma Studio                                                   |
| `npm run typecheck` / `lint` / `format` | Quality checks                                                  |

### Triggering a refresh from the CLI

Refreshing is normally a click, but the pipeline can be triggered manually (it
uses the live X API, so it costs credits):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily
```

To exercise the (on-demand) Inngest functions locally:

```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

---

## Engineering notes

- **Strict TypeScript**, ESLint (+ Prettier), zod-validated environment.
- **RSC-first**: pages are Server Components; client JS is limited to forms and
  interactive bits. Images optimized via `next/image`.
- **Security**: secrets via env (never committed), protected routes (middleware
  - server checks), server actions validate input with zod, the manual pipeline
    endpoint is gated by a secret, and all queries are parameterized via Prisma.
- **Resilience**: error boundaries, loading skeletons, empty states, and
  graceful degradation when API keys are absent.

## Requirements

- Node.js 18.18+ (a Web Crypto polyfill is bundled for Better Auth on Node 18).
  Node 20+ recommended.
