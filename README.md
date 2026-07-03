# The Signal — your AI-written tech newspaper

A mobile-first web app that reads what the most influential people in technology
are posting on **X (Twitter)** and turns it into a concise, **daily AI-generated
news brief** — the story, the conversation it sparked, notable replies, and the
overall sentiment. Think of it as a personalized, AI-powered technology
newspaper.

Built with Next.js 15 (App Router, RSC, Server Actions), TypeScript, Tailwind +
shadcn-style UI, Prisma + PostgreSQL, Better Auth, Inngest, and a swappable AI
summarization layer.

---

## Quick start

```bash
npm install
npm run dev
```

Then open **http://localhost:3000**.

That's it. `npm run dev` automatically:

1. provisions a local PostgreSQL database (see **Database** below),
2. applies Prisma migrations,
3. seeds the roster of tech leaders + a few days of content and summaries,
4. starts the database and the Next.js dev server together.

### Demo account

A demo user is seeded so you can log in immediately:

- **Email:** `demo@thesignal.app`
- **Password:** `demo12345`

Or just register a new account — it takes a few seconds.

---

## Zero-config database (why there's no Postgres to install)

The spec calls for **PostgreSQL + Prisma migrations**. To keep `npm run dev`
truly one-command with **no credentials and no external services**, this project
runs [**PGlite**](https://pglite.dev) — a real PostgreSQL build compiled to
WebAssembly — as a local server over the Postgres wire protocol
(`scripts/db-server.ts`). Prisma connects to it exactly like any Postgres server.

- It's genuine PostgreSQL (enums, JSONB, arrays, cascades, advisory locks all
  work), so the schema and migrations are 100% portable to Supabase/Neon/RDS.
- Data is persisted to `.local-postgres/` (gitignored).
- No Docker, no system Postgres, no secrets.

**Moving to hosted Postgres (Supabase/Neon) is a one-line change:** set
`DATABASE_URL` in `.env` to your connection string and run
`npm run db:deploy && npm run db:seed`. (Drop `pgbouncer=true`/`connection_limit=1`
unless your pooler needs them.)

---

## Integrations — swappable, and everything works without keys

| Integration      | Without keys (default)                                                                                    | With keys                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **X API**        | `INGEST_MODE=mock` uses realistic, on-brand fixtures so the whole pipeline is fully functional.           | Set `X_API_BEARER_TOKEN` + `INGEST_MODE=live` to fetch real tweets, replies & conversations.        |
| **AI summaries** | `AI_PROVIDER=template` — a deterministic editorial writer that produces article-style prose (no API key). | Set `AI_PROVIDER` to `anthropic` \| `openai` \| `gemini` \| `huggingface` and the matching API key. |

Use the X bearer token exactly as issued by X (it is already URL-encoded).

### Hugging Face model

To summarize with a Hugging Face model, set:

```env
AI_PROVIDER="huggingface"
HUGGINGFACE_API_KEY="hf_..."
AI_MODEL="meta-llama/Llama-3.1-8B-Instruct"   # optional; any instruct model
```

It calls the HF Inference **router** (`router.huggingface.co/v1/chat/completions`,
OpenAI-compatible) and, like every provider, falls back to the template writer if
the model output can't be parsed — so summaries never fail.

### ⚠️ Live X API costs (metered tiers)

Live mode makes real API calls. Per person, per refresh:
**`1` (timeline) + `X_REPLY_LOOKUPS` (reply searches)**. Defaults keep this small:

- `X_REPLY_LOOKUPS=2` — reply lookups per person (set `0` for timeline-only).
- `X_RATE_PER_MIN=50` — client request budget.

The database is already seeded with **real X data**, and `npm run dev` does **not**
call the X API when summaries already exist. New calls happen only when you click
**Refresh feed**, run the daily job, or `npm run db:reset`. To spend nothing, set
`INGEST_MODE="mock"`.

---

## 📍 Where the key logic lives

| What                                | File                                                                               | Notes                                                                                                                                                                                                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The X API call**                  | [`src/server/x/client.ts`](src/server/x/client.ts)                                 | `XApiSource` — every request to `https://api.twitter.com/2` goes through its private `request()` method (timeline: `GET /2/users/:id/tweets`; replies: `GET /2/tweets/search/recent`). Rate limiting, backoff, retries, and API-call counting live here. |
| Live vs mock switch                 | [`src/server/x/source.ts`](src/server/x/source.ts)                                 | Picks `XApiSource` (live) or `MockSource` based on env.                                                                                                                                                                                                  |
| Persisting X data                   | [`src/server/x/ingest.ts`](src/server/x/ingest.ts)                                 | Idempotent upserts (dedupe by X id).                                                                                                                                                                                                                     |
| **The Hugging Face implementation** | [`src/server/ai/providers/huggingface.ts`](src/server/ai/providers/huggingface.ts) | `HuggingFaceSummarizer` — calls the HF Inference **router** `POST https://router.huggingface.co/v1/chat/completions` (OpenAI-compatible).                                                                                                                |
| AI provider selection               | [`src/server/ai/index.ts`](src/server/ai/index.ts)                                 | `getSummarizer()` — swaps template / anthropic / openai / gemini / huggingface.                                                                                                                                                                          |
| Brief writing + reply analysis      | [`src/server/ai/providers/template.ts`](src/server/ai/providers/template.ts)       | Sentiment, discussion themes, subject extraction, spam filtering.                                                                                                                                                                                        |
| Credits meter                       | [`src/server/credits.ts`](src/server/credits.ts)                                   | Global pool + per-account usage.                                                                                                                                                                                                                         |
| "New day, refresh?" prompt          | [`src/components/staleness-banner.tsx`](src/components/staleness-banner.tsx)       | Local-timezone day check.                                                                                                                                                                                                                                |

---

## Features

- **Auth** — email/password (Better Auth): register, login, logout, sessions,
  protected routes (middleware + server-side checks).
- **Onboarding** — pick any combination of the tracked tech leaders (currently
  **Elon Musk** and **Sam Altman**). Selections persist to Postgres.
- **Dashboard** — a personalized "front page": one news card per person with the
  latest brief headline, sentiment, topics, and post/reply counts.
- **Detail page** — full AI brief written like a news article, plus the
  important posts and notable replies behind it, with links back to X.
- **Freshness prompt** — a "new day, want to refresh?" banner appears once a new
  local calendar day has passed since your last update (and stands down when
  you're out of X credits, since a refresh wouldn't help).
- **Credits meter** — a shared X API budget (normalized for guests) plus
  per-account usage, decremented as live calls are made.
- **Ingestion** — batching, in-memory caching, token-bucket rate limiting,
  exponential backoff with `Retry-After`, and idempotent upserts (dedupe by X
  id). Never spams the API.
- **Background jobs** — Inngest daily cron (`0 12 * * *` UTC) that fans out one
  durable, independently-retried step per person. Also a protected cron endpoint
  (`/api/cron/daily`) and an on-demand "Refresh feed" server action.
- **AI layer** — provider-agnostic `Summarizer` interface; providers swap via
  env; malformed model output falls back to the template writer so summaries
  never fail.

---

## Architecture

```
src/
  app/
    (auth)/            login, register (+ shared auth layout)
    (app)/             protected shell: dashboard, onboarding, person/[handle]
    api/
      auth/[...all]    Better Auth handler
      inngest          Inngest serve endpoint
      cron/daily       protected pipeline trigger
    actions.ts         server actions (selections, refresh)
  components/          UI primitives + feature components
  lib/                 env (zod), prisma, auth, session, logger, utils, constants
  server/
    x/                 ingestion: types, http (retry/limiter), mock, client, source, ingest
    ai/                summarization: types, prompt, providers/*, factory, summarize
    inngest/           client + functions
    pipeline.ts        ingest + summarize orchestration with JobRun bookkeeping
    dashboard.ts       dashboard queries
    person-detail.ts   detail queries
scripts/               db-server, db-setup, new-migration, polyfills
prisma/                schema.prisma, migrations/, seed.ts
```

### Data model (Prisma / Postgres)

`User`, `Session`, `Account`, `Verification` (auth) · `TrackedPerson` ·
`SelectedPerson` · `Tweet` · `Reply` · `Conversation` · `DailySummary` ·
`JobRun`. Summaries are computed once per `(person, day)` and shared across users.

---

## Scripts

| Command                                 | What it does                                                    |
| --------------------------------------- | --------------------------------------------------------------- |
| `npm run dev`                           | Setup DB + run DB server and Next.js together                   |
| `npm run build`                         | `prisma generate` + `next build`                                |
| `npm start`                             | Start the production server (run `npm run db:server` alongside) |
| `npm run db:server`                     | Run the embedded Postgres (PGlite) server on :5433              |
| `npm run db:setup`                      | Migrate + seed once                                             |
| `npm run db:reset`                      | Wipe local data and re-setup                                    |
| `npm run db:migrate:new -- <name>`      | Create + apply a new migration                                  |
| `npm run db:studio`                     | Prisma Studio                                                   |
| `npm run typecheck` / `lint` / `format` | Quality checks                                                  |

### Triggering the pipeline manually

```bash
# regenerate today's briefs (uses CRON_SECRET from .env)
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily
```

Or click **Refresh feed** on the dashboard.

### Running the Inngest dev server (optional)

```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

---

## Engineering notes

- **Strict TypeScript**, ESLint (+ Prettier), zod-validated environment.
- **RSC-first**: pages are Server Components; client JS is limited to forms and
  interactive bits. Images optimized via `next/image`.
- **Security**: secrets via env, protected routes (middleware + server checks),
  server actions validate input with zod, cron endpoint gated by a secret,
  parameterized queries via Prisma.
- **Resilience**: error boundaries (`error.tsx`, `global-error.tsx`), loading
  skeletons, empty states, and graceful degradation when providers are absent.

## Requirements

- Node.js 18.18+ (works on Node 18; a Web Crypto polyfill is included for
  Better Auth). Node 20+ recommended.
