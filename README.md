# RadarJob

**Spot the scam before it costs you.**

RadarJob is a mobile-first Progressive Web App that helps job seekers — initially students, graduates and first-time job seekers in Kenya — recognise fraudulent recruitment. It combines job-scam education with a live link checker that gathers evidence from VirusTotal, domain-registration data, link-structure analysis, optional safe page inspection and optional AI, then explains the result in plain language.

📘 **Full documentation:** [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md) · 🚀 **Online database + Vercel hosting:** [docs/DEPLOYMENT-VERCEL.md](docs/DEPLOYMENT-VERCEL.md)

RadarJob never declares a link or job "safe". A clean reputation result is reported as *no significant threats detected*, together with what could not be checked.

---

## Contents

1. [Architecture](#architecture)
2. [Prerequisites](#prerequisites)
3. [Quick start](#quick-start)
4. [Configuration](#configuration)
5. [Workspace commands](#workspace-commands)
6. [Database](#database)
7. [API reference](#api-reference)
8. [External services](#external-services)
9. [How assessments are made](#how-assessments-are-made)
10. [Testing](#testing)
11. [PWA and offline behaviour](#pwa-and-offline-behaviour)
12. [Security](#security)
13. [Deployment](#deployment)
14. [Troubleshooting](#troubleshooting)
15. [Known limitations and next steps](#known-limitations-and-next-steps)

---

## Architecture

```
apps/
  web/        Next.js 16 (App Router), Tailwind CSS 4, shadcn-style components, Lucide, PWA
  api/        NestJS 11 REST API, Prisma 7 + PostgreSQL (optional)
packages/
  shared/     Zod API contract, URL validation/normalisation, guides, quiz content
```

```
Browser ──/api/*──▶ Next.js (same-origin rewrite, CSP nonce) ──▶ NestJS API
                                                                  ├─ URL validation (shared)
                                                                  ├─ Link-structure rules      (always)
                                                                  ├─ VirusTotal v3              ┐
                                                                  ├─ RDAP / WhoisXML            ├ in parallel, each bounded
                                                                  ├─ Safe page inspection       │
                                                                  ├─ Job-advert rules + AI      ┘
                                                                  ├─ AI URL indicators (validated)
                                                                  ├─ Deterministic risk engine  → category
                                                                  └─ AI or template explanation → report
```

Key decisions, in plain language:

- **Providers sit behind interfaces** (`ReputationProvider`, `DomainIntelProvider`, `LlmClient`, `PageInspector`, `ReportStore`). Swapping VirusTotal, the WHOIS source or the AI vendor does not touch the pipeline.
- **The risk engine is deterministic and separate from AI.** AI can only *add* evidence, capped at "warning" severity, and its evidence must literally appear in the data it was given. It never sets the category.
- **Analysis is asynchronous.** `POST /api/analysis` returns an id immediately; the browser polls `GET /api/analysis/:id` and shows each check's status live.
- **The browser only talks to its own origin.** Next.js rewrites `/api/*` to the API, which keeps the Content Security Policy tight (`connect-src 'self'`) and keeps API keys server-side.
- **NestJS 11** is used (the maintained `legacy` line). NestJS 12 is ESM-only; migrating is a contained follow-up.
- **Prisma 7** uses the `pg` driver adapter, so no native query engine is needed at runtime.

## Prerequisites

- Node.js 20.11+ (22 recommended)
- pnpm 10 (`corepack enable`)
- Optional: Docker (for PostgreSQL), a VirusTotal API key, an Anthropic, Gemini or OpenAI-compatible API key

## Quick start

```bash
pnpm install
cp .env.example .env          # then edit keys as needed
pnpm dev                      # API on :4000, web on http://localhost:3000
```

With no keys at all, the guides, quiz and history work fully; link checks still run the link-structure rules and RDAP lookup, mark VirusTotal and AI as *not configured*, and therefore return **Inconclusive** rather than a false all-clear.

To try every report path without any keys, use the clearly-labelled development mocks:

```bash
DEV_MOCK_PROVIDERS=true pnpm dev
```

Mock behaviour is keyword-driven: a hostname containing `mock-malicious` gets several detections, `mock-vt-down` simulates a VirusTotal outage, a registered domain containing `mock-new` is 5 days old, and `mock-whois-down` simulates a WHOIS outage. Every mock report shows a **Simulated report** banner, and the API refuses to start with mocks when `NODE_ENV=production`.

## Configuration

All variables are documented in [`.env.example`](.env.example) and validated at API startup with Zod — an invalid configuration stops the server with a readable message. The most important ones:

| Variable | Purpose |
| --- | --- |
| `VIRUSTOTAL_API_KEY` | Enables URL reputation. Never sent to the browser. |
| `DOMAIN_INTELLIGENCE_PROVIDER` | `rdap` (free, default), `whoisxml` (needs `DOMAIN_INTELLIGENCE_API_KEY`), or `none`. |
| `AI_PROVIDER`, `AI_MODEL`, `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` | Optional AI indicators and explanations. |
| `PAGE_INSPECTION_ENABLED` | Safe single-page fetch. Off by default — see [Security](#security). |
| `DATABASE_URL` | PostgreSQL for reports; in-memory when empty. |
| `ANALYSIS_RATE_LIMIT_PER_HOUR` | Per-client limit on checks (protects paid quotas). |
| `API_INTERNAL_URL` | (web) where Next.js forwards `/api/*`. Put it in `apps/web/.env.local` if not the default. |

## Workspace commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Builds the shared package, then runs shared (watch), API and web together |
| `pnpm dev:api` / `pnpm dev:web` | Run one side only |
| `pnpm build` | Production build of shared, API and web |
| `pnpm start` | Start the built API and web |
| `pnpm typecheck` | TypeScript checks across the workspace (also runs `prisma generate`) |
| `pnpm test` | Unit and integration tests (shared, API, web) |
| `pnpm test:e2e` | Playwright end-to-end tests (build first) |
| `pnpm format` | Prettier |
| `pnpm db:migrate` | Apply Prisma migrations |

## Database

PostgreSQL is optional and stores only privacy-minimised reports (no query strings, no job-advert text, no IPs). Records carry an `expiresAt` and are purged every 15 minutes.

```bash
docker compose up -d
# in .env:  DATABASE_URL=postgresql://radarjob:radarjob@localhost:5432/radarjob
pnpm db:migrate
```

Schema: `apps/api/prisma/schema.prisma`. Migrations: `apps/api/prisma/migrations`. For schema changes during development use `pnpm --filter @radarjob/api db:migrate:dev`.

## API reference

All errors share one shape: `{ "error": { "code": "...", "message": "...", "details"?: [...] } }`.

| Method & path | Description |
| --- | --- |
| `GET /api/health` | Status and which integrations are configured (never their values). |
| `POST /api/analysis` | Body `{ "url": string, "jobAdText"?: string }` → `202 { id, status: "running" }`. Rate-limited. |
| `GET /api/analysis/:id` | The report (`status`: `running` / `completed` / `failed`), including every check's status. |
| `POST /api/job-ad-analysis` | Body `{ "text": string }` → red flags, category and advice. Text is not stored. |
| `GET /api/education/guides?q=` | Guide list (searchable). |
| `GET /api/education/guides/:slug` | One guide. |
| `GET /api/education/quiz` | Quiz questions. |

Notable error codes: `invalid_url.empty|too_long|malformed|unsupported_protocol|local_address|invalid_host`, `rate_limited` (429), `busy` (503), `not_found` (404), `payload_too_large` (413).

The response types are defined once in `packages/shared/src/schemas/report.ts` and validated by the web client.

## External services

**VirusTotal** (`apps/api/src/virustotal`). Uses API v3: looks up an existing URL report first (`GET /urls/{id}`); if missing or older than `VIRUSTOTAL_MAX_REPORT_AGE_DAYS`, submits the URL (`POST /urls`) and polls `GET /analyses/{id}` a bounded number of times. A local sliding-window limiter keeps within your quota, identical concurrent requests are de-duplicated, and completed results are cached. Auth errors, 429s, outages, timeouts, malformed payloads and still-pending scans all produce an explicit non-clean status. Raw responses are never forwarded.

**Domain intelligence** (`apps/api/src/domain-intelligence`). Default is RDAP via the IANA bootstrap file — free and standardised. Some ccTLD registries, possibly including `.ke`, do not publish RDAP; those lookups are shown as *unavailable* (which never raises the risk). For broader coverage set `DOMAIN_INTELLIGENCE_PROVIDER=whoisxml` and a WhoisXML API key.

**AI** (`apps/api/src/ai`). Anthropic Messages API (default model `claude-haiku-5-5`), Gemini through its OpenAI-compatible endpoint (default model `gemini-3.5-flash-lite`), or any OpenAI-compatible Chat Completions endpoint. Responses are schema-validated; indicator evidence must be an exact substring of the URL, page excerpt or job text; summaries promising safety, guarantees or claiming an uninspected page was visited are rejected; on any failure the deterministic template is used. Job text has phone numbers, emails and ID-like numbers replaced before it is sent.

## How assessments are made

Rules live in `apps/api/src/risk-assessment` (`rules.config.ts` holds the thresholds and a version stamped onto every report).

- Any **strong** evidence (≥3 malicious vendor verdicts, a homograph look-alike of a known brand, a password form on an impersonating page, PIN/OTP fields) → **Potentially malicious**.
- **Warning** evidence from ≥2 independent non-AI sources → **Potentially malicious**; from one source → **Suspicious**.
- ≥3 minor signals → **Suspicious**. A new domain alone is a minor signal only.
- An address or page title that presents itself as Kenyan government outside `.go.ke` is **warning** evidence, so on its own it gives **Suspicious**, not **Potentially malicious**. Some public bodies use other endings, such as `.or.ke` or `.ac.ke`.
- No signals and VirusTotal completed → **No significant threats detected** (with a "not a guarantee" note).
- VirusTotal not completed and nothing else found → **Inconclusive**.
- The link and the job offer are assessed separately; the overall category is the more severe, and conflicts (e.g. clean reputation but impersonation) are explained in the report.

There is deliberately no numeric fraud score.

## Testing

```bash
pnpm test        # 154 unit + integration tests
pnpm build && pnpm test:e2e
```

- **Unit**: URL validation/normalisation and IDNs, link heuristics, domain age, VirusTotal normalisation, RDAP/WhoisXML parsing, AI output validation, risk rules (all five specification scenarios), job-ad rules, redaction, history storage, client error mapping, offline form behaviour.
- **Integration** (`apps/api/test`): the real Nest app and pipeline with a fake HTTP layer — success, zero detections, pending scans, 401/403/429/5xx, timeouts, malformed responses, partial results, malformed and local URLs, SSRF and redirect-SSRF against a local server, AI failure and malformed AI output with template fallback, rate limiting, and checks that API keys never reach responses or the AI provider.
- **End-to-end** (`apps/web/e2e`, Playwright, mobile viewport): full analysis flows, suspicious-despite-zero-detections, inconclusive, separate job-offer assessment, offline device, backend outage, standalone text check, guides, quiz, saved history, and offline guide access through the service worker.

All provider payloads in tests are synthetic and labelled; no real API quota is used. If Playwright's browser download is blocked on your network, point `CHROMIUM_PATH` at a local Chromium.

## PWA and offline behaviour

- `app/manifest.ts` + icons in `apps/web/public/icons`; installable in Chromium-based browsers and Safari ("Add to Home Screen").
- `public/sw.js` (registered in production builds only):
  - `/api/*` is never intercepted or cached, and nothing is queued for later.
  - Hashed build assets are cache-first; pages are network-first with a cached fallback. Guides are pre-cached at install.
  - `/report/*` is not cached, so an old live report can never appear current; offline it falls back to `/offline`.
- Saved reports live in `localStorage` and open on `/history` with a **"historical copy, not a fresh scan"** banner and their original timestamp.
- The analyse button is disabled while offline with the message *"You're offline. Connect to the internet to verify this job link."* Real request failures are also handled, since `navigator.onLine` is only a hint.

To test: `pnpm build && pnpm start`, open http://localhost:3000, then in DevTools → Application check the manifest and service worker, and use Network → Offline.

## Security

Implemented controls:

- **Secrets** only in API environment variables; health output reports configuration state, not values; the WhoisXML key is never logged.
- **Input validation** in the browser and authoritatively on the server (Zod + class-validator DTOs, `forbidNonWhitelisted`, 32 kB JSON body limit).
- **SSRF protection** for page inspection (`page-inspection/ssrf-guard.ts`, `safe-fetch.ts`): http/https on ports 80/443 only; internal hostnames blocked; every hop (including redirects) is DNS-resolved and *all* answers must be public unicast; the vetted IP is pinned for the connection (defeats DNS rebinding); GET only, no cookies, no JavaScript, HTML only, size and time limits; up to 5 redirects. Local/private URLs are also rejected at submission.
- **Prompt-injection hygiene**: untrusted data is wrapped and labelled, wrapper-escape attempts are neutralised, and AI output is validated rather than trusted.
- **Headers**: nonce-based CSP with `strict-dynamic` on every page (`apps/web/src/proxy.ts`), `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, Referrer and Permissions policies; Helmet on the API with `default-src 'none'`.
- **CORS** limited to `FRONTEND_URL`. **Rate limiting** per client for checks, global concurrency and queue caps, and outbound VirusTotal rate limiting.
- **Privacy-conscious logging**: hostnames and report ids only; query strings are stripped before storage or display.

**Before enabling page inspection in production**, run the API (or a dedicated inspection worker) in a network segment with egress only to the public internet — no route to your database, metadata service or internal hosts. The in-process guard is the primary defence; network isolation is the backstop.

## Deployment

1. Provision PostgreSQL (optional) and set environment variables from `.env.example` with `NODE_ENV=production`, `LOG_FORMAT=json`, real `FRONTEND_URL`, and `TRUST_PROXY` matching your proxy chain.
2. `pnpm install --frozen-lockfile && pnpm build && pnpm db:migrate`
3. Run `node apps/api/dist/main.js` and `pnpm --filter @radarjob/web start` (set `API_INTERNAL_URL` for the web process).
4. Serve both behind HTTPS. The CSP sets `upgrade-insecure-requests` and HSTS is enabled on the API in production.

Any Node host works (a VM, Render, Fly.io, Railway, Docker). Keep the API private and expose only the web app if possible — the web app already proxies `/api`.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| API exits with `Invalid environment configuration` | Read the listed variables; e.g. `whoisxml` needs a key, mocks can't run in production. |
| Every report is **Inconclusive** | VirusTotal is not configured or unreachable — check `GET /api/health` and the API log. |
| Domain registration "unavailable" for `.ke` domains | The registry may not publish RDAP. Use `DOMAIN_INTELLIGENCE_PROVIDER=whoisxml`. |
| "Verification could not be completed…" in the browser | The API isn't reachable from Next.js — check `API_INTERNAL_URL` and that the API is running. |
| 429 / "Too many requests" | Per-client limit reached; adjust `ANALYSIS_RATE_LIMIT_PER_HOUR`. |
| VirusTotal often "pending" | Free-tier scans can be slow; raise `VIRUSTOTAL_POLL_ATTEMPTS` (each poll uses quota). |
| Old pages after a deploy | Bump `VERSION` in `apps/web/public/sw.js`. |
| `prisma generate` can't download engines | Your network blocks `binaries.prisma.sh`; allow it, or set `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1` with a local `PRISMA_SCHEMA_ENGINE_BINARY`. |

## Known limitations and next steps

- The impersonated-brand list (`apps/api/src/url-analysis/brands.ts`) is curated and partial; extend it as new patterns appear.
- Page inspection is static HTML only; JavaScript-rendered phishing kits may show little content.
- Reports are anonymous and expire; there are no accounts by design.
- Possible next steps: a dedicated, network-isolated inspection worker; a shared cache (Redis) for multi-instance deployments; Swahili translations; NestJS 12 (ESM) migration.
