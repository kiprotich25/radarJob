# RadarJob — Complete Project Documentation

> **Spot the scam before it costs you.**

This document explains everything about RadarJob: what it does, how it is built, how a link check works from start to finish, how the risk decision is made, what data is stored, every configuration option, the API, the frontend, security, testing, and how to extend it.

For putting the app online (database and Vercel), see **[DEPLOYMENT-VERCEL.md](DEPLOYMENT-VERCEL.md)**.

---

## Table of contents

1. [What RadarJob is](#1-what-radarjob-is)
2. [Core principles](#2-core-principles)
3. [Features for users](#3-features-for-users)
4. [Technology stack](#4-technology-stack)
5. [Repository layout](#5-repository-layout)
6. [System architecture](#6-system-architecture)
7. [How a link check works, step by step](#7-how-a-link-check-works-step-by-step)
8. [The individual checks](#8-the-individual-checks)
9. [How the risk decision is made](#9-how-the-risk-decision-is-made)
10. [The report](#10-the-report)
11. [Data, privacy and the database](#11-data-privacy-and-the-database)
12. [API reference](#12-api-reference)
13. [Configuration reference](#13-configuration-reference)
14. [The web app (frontend)](#14-the-web-app-frontend)
15. [PWA and offline behaviour](#15-pwa-and-offline-behaviour)
16. [Security](#16-security)
17. [Local development](#17-local-development)
18. [Testing](#18-testing)
19. [Extending RadarJob](#19-extending-radarjob)
20. [Troubleshooting](#20-troubleshooting)
21. [Known limitations and roadmap](#21-known-limitations-and-roadmap)
22. [Glossary](#22-glossary)

---

## 1. What RadarJob is

RadarJob is a **mobile-first Progressive Web App (PWA)** that helps job seekers recognise fraudulent recruitment. Its first audience is students, graduates and first-time job seekers in **Kenya**, where fake job adverts, recruitment-fee scams, WhatsApp/Telegram "hiring" and impersonation of employers and government bodies are common.

It does two things:

1. **Education.** Ten plain-language guides about common job scams, a quiz, and links to official reporting resources. All of this works offline once loaded.
2. **Verification.** A link checker. The user pastes a job link, and can also paste the advert text. RadarJob gathers evidence from several independent sources and explains the result in plain language:
   - **VirusTotal**: reputation verdicts from dozens of security vendors.
   - **Domain registration data** (RDAP or WhoisXML): how old the domain is.
   - **Link-structure analysis**: brand look-alikes, `@` tricks, raw IPs, shorteners, fake `.go.ke` addresses and similar.
   - **Optional safe page inspection**: a one-time, sandboxed fetch of the page's HTML.
   - **Job-advert rules**: fees, PIN requests, money-mule language, pressure tactics and other red flags.
   - **Optional AI**: Anthropic Claude, Google Gemini or any OpenAI-compatible model. It can add extra indicators and write a friendly explanation.

There is also a **standalone job-text checker**, for when the user has only a message and no link.

---

## 2. Core principles

These rules shape the whole codebase:

| Principle | What it means in practice |
| --- | --- |
| **Never say "safe"** | The best possible result is *"No significant threats detected"*, always with a note that this is not a guarantee and a list of what could not be checked. |
| **A failed check is never a clean check** | If VirusTotal is down, rate-limited, unconfigured or still scanning, the result is **Inconclusive**, not an all-clear. |
| **Deterministic decisions** | The risk category comes from fixed, versioned rules (`rules.config.ts`). AI can only *add* evidence. It never sets the category. |
| **Explainable evidence** | Every signal is an `Indicator` with a title, the exact evidence observed, why it matters, its severity and its limitations. |
| **No fraud score** | There is deliberately no "87% scam" number. Categories depend on how strong and independent the evidence is. |
| **Privacy by design** | No accounts. Query strings are stripped. Job text is never stored and is redacted before it goes to AI. Stored reports expire. |
| **Providers are swappable** | Each external service sits behind an interface, so changing vendors does not touch the pipeline. |

---

## 3. Features for users

| Page | Route | Purpose |
| --- | --- | --- |
| Home | `/` | Hero with the link analyser, a summary of how it works, entry points to the guides |
| Analyse | `/analyze` | Link checker (with optional job text) and the standalone job-text checker |
| Report | `/report/[id]` | Live-updating report: risk banner, each check's status, evidence, domain info, AI or template explanation, recommended actions, limitations |
| Learn | `/learn` | Searchable list of the 10 scam guides |
| Guide | `/learn/[slug]` | One guide (see the list below) |
| Quiz | `/quiz` | Scenario quiz to practise spotting scams |
| History | `/history` | Reports saved on this device only, shown as *"historical copy, not a fresh scan"* |
| About / Privacy / Terms | `/about`, `/privacy`, `/terms` | Project information and policies |
| Offline | `/offline` | Fallback page when a page is not cached and there is no network |

**Guides** (in `packages/shared/src/content/guides.ts`):
`fake-job-advertisements`, `recruitment-fee-scams`, `phishing-links-fake-career-sites`, `employer-impersonation`, `whatsapp-telegram-recruitment-scams`, `fake-remote-jobs`, `fake-interviews-fraudulent-offers`, `identity-theft-sensitive-information`, `money-mule-recruitment`, `social-engineering-urgency`.

---

## 4. Technology stack

| Layer | Technology |
| --- | --- |
| Monorepo | pnpm 10 workspaces, TypeScript 5.9, Node.js ≥ 20.11 (22 recommended) |
| Web | Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn-style components, Lucide icons, Public Sans font |
| API | NestJS 11 (Express), class-validator DTOs, Helmet, `@nestjs/throttler` |
| Shared contract | Zod 4 schemas, `tldts` (domain parsing), `punycode` (international domain names) |
| Database (optional) | PostgreSQL through Prisma 7, using the `@prisma/adapter-pg` driver adapter (no native engine at runtime) |
| HTML parsing | `node-html-parser` (page inspection), `undici` (HTTP with IP pinning) |
| Tests | Vitest (unit and integration), Testing Library, Supertest, Playwright (end-to-end) |
| Formatting | Prettier |

---

## 5. Repository layout

```
radarJob/
├── apps/
│   ├── api/                         NestJS REST API (port 4000)
│   │   ├── prisma/                  schema.prisma + SQL migrations
│   │   ├── prisma.config.ts         Prisma 7 config (reads DATABASE_URL)
│   │   ├── src/
│   │   │   ├── main.ts              Entry point: loads .env (dev), validates env, starts server
│   │   │   ├── bootstrap.ts         Helmet, CORS, body limit, validation, /api prefix
│   │   │   ├── app.module.ts        Chooses providers from env (real, mock, disabled)
│   │   │   ├── config/env.ts        Zod schema for every environment variable
│   │   │   ├── analysis/            POST/GET /api/analysis, pipeline, report store
│   │   │   ├── url-analysis/        Link-structure heuristics + known brand list
│   │   │   ├── virustotal/          VirusTotal v3 client, normaliser, cache
│   │   │   ├── domain-intelligence/ RDAP and WhoisXML providers
│   │   │   ├── page-inspection/     SSRF guard, safe fetch, HTML analyser
│   │   │   ├── job-ad/              Job-text red-flag rules + standalone endpoint
│   │   │   ├── ai/                  LLM clients, prompts, output validation
│   │   │   ├── risk-assessment/     Deterministic engine, thresholds, evidence builders
│   │   │   ├── report/              Findings, unknowns, actions, template explanation
│   │   │   ├── education/           Guides and quiz endpoints
│   │   │   ├── health/              GET /api/health
│   │   │   └── common/              Errors, limiters, TTL cache, redaction, mocks
│   │   └── test/                    Integration tests with a fake HTTP layer
│   └── web/                         Next.js PWA (port 3000)
│       ├── public/                  sw.js (service worker), icons, favicon
│       ├── e2e/                     Playwright tests
│       └── src/
│           ├── app/                 Routes (see §3), manifest, guide-index.json
│           ├── components/          UI, report sections, forms, quiz
│           ├── lib/                 api.ts (client), history.ts (localStorage), helpers
│           └── proxy.ts             Per-request CSP nonce
├── packages/
│   └── shared/                      @radarjob/shared — used by both apps
│       └── src/
│           ├── schemas/report.ts    The API contract (Zod)
│           ├── url.ts               URL validation and normalisation
│           ├── labels.ts            Human-readable labels
│           └── content/             guides.ts, quiz.ts, resources.ts
├── docker-compose.yml               Local PostgreSQL 16
├── .env.example                     Every setting, documented
└── README.md
```

> The shared package compiles to `packages/shared/dist`. Both apps import it from there, so **build it first** (`pnpm build:shared`). Every root script already does this.

---

## 6. System architecture

```
┌──────────────┐   same-origin   ┌───────────────────────┐   rewrite /api/*   ┌──────────────────────────┐
│   Browser    │ ──────────────▶ │ Next.js web (3000)    │ ─────────────────▶ │ NestJS API (4000)        │
│  (PWA, SW,   │ ◀────────────── │ CSP nonce, pages,     │ ◀───────────────── │ validation, pipeline,    │
│ localStorage)│                 │ static guides         │                    │ risk engine, store       │
└──────────────┘                 └───────────────────────┘                    └────────────┬─────────────┘
                                                                                           │
                         ┌──────────────────┬──────────────────┬───────────────┬───────────┼───────────────┐
                         ▼                  ▼                  ▼               ▼           ▼               ▼
                    VirusTotal v3      RDAP / WhoisXML     Target page     AI provider  PostgreSQL     (in-memory
                    (reputation)       (domain age)        (optional)      (optional)   (optional)      fallback)
```

**Why the browser only talks to its own origin.** Next.js rewrites `/api/*` to the API (`API_INTERNAL_URL`). As a result:

- the CSP can be `connect-src 'self'`,
- there is no CORS in normal use,
- API keys stay on the server,
- and the API can stay private, with only the web app exposed.

**Dependency injection and swappable providers.** `app.module.ts` reads the validated environment and builds one implementation per interface:

| Interface (token) | Implementations |
| --- | --- |
| `ReputationProvider` | `VirusTotalService`, `MockReputationProvider` |
| `DomainIntelProvider` | `RdapProvider`, `WhoisXmlProvider`, `NoDomainIntelProvider`, `MockDomainIntelProvider` |
| `AiService` / `LlmClient` | `AnthropicClient`, `OpenAiCompatibleClient` (OpenAI and Gemini), `MockLlmClient`, none |
| `PageInspector` | `SafePageInspector`, `DisabledPageInspector` |
| `ReportStore` | `PrismaReportStore` (PostgreSQL), `InMemoryReportStore` |

Integration tests use the same mechanism (`AppOverrides`) to replace HTTP, DNS and providers with fakes.

---

## 7. How a link check works, step by step

The code is in `apps/api/src/analysis/analysis.service.ts`.

```
POST /api/analysis {url, jobAdText?}
  │
  ├─ 1. Validate & normalise URL (shared/url.ts)  ── invalid → 400 invalid_url.*
  ├─ 2. Reject private/local IP literals          ── → 400 invalid_url.local_address
  ├─ 3. Capacity gate (Semaphore)                 ── full → 503 busy
  ├─ 4. Create report {status: running, all checks pending}, save to store
  └─ 5. Return 202 {id, status: "running"}  ◀── browser starts polling GET /api/analysis/:id
         │
         ▼  (continues in the background)
   a. Link-structure heuristics (instant)       → checks.urlHeuristics = completed
      Job-advert rules (instant, if text given)
   b. In parallel, each bounded by ANALYSIS_TIMEOUT_MS:
        • VirusTotal reputation                 → checks.virustotal
        • Domain registration lookup            → checks.domain
        • Safe page inspection (if enabled)     → checks.page
        • AI job-ad review (redacted text)      → part of checks.jobAd
        • AI URL review (waits for page excerpt)→ checks.urlAi
      The report is saved after every step, so the UI shows progress live.
   c. All indicators collected and numbered (virustotal-1, url_heuristic-2, …)
   d. Deterministic risk engine → assessment {category, link, offer, reasons, conflicts}
   e. Findings / unknowns built from check statuses
   f. Explanation: AI (validated) or deterministic template
   g. status = completed, saved. On any internal error: status = failed (no assessment).
```

Important details:

- **Bounded steps.** `bounded()` resolves every external call either with its result or with a fallback `unavailable` status when the overall deadline passes. A slow provider cannot hang a report.
- **Ordered saves.** Progress snapshots are saved in order, one after another, so a later state is never overwritten by an earlier one.
- **Capacity.** `ANALYSIS_MAX_CONCURRENT` analyses run at once and `ANALYSIS_MAX_QUEUED` can wait. Beyond that the API returns `503 busy`.
- **Retention.** A timer purges expired reports every 15 minutes, and `get()` also refuses expired rows.

---

## 8. The individual checks

Every check produces a **status**: `pending`, `running`, `completed`, `failed`, `unavailable`, `not_configured` or `skipped`. Every piece of evidence is an **Indicator** with one of four severities: `strong`, `moderate`, `weak` or `info`. Each indicator also has a *dimension*: `link` (about the website) or `offer` (about the job).

### 8.1 URL validation and normalisation (`packages/shared/src/url.ts`)

The same code runs in the browser and, authoritatively, on the server. It:

- trims the input and adds `https://` when no scheme is given,
- accepts only `http` and `https`,
- enforces a maximum length,
- rejects localhost and internal hostnames,
- converts IDNs (international domain names) to punycode while keeping a Unicode display form,
- extracts the *registered domain* (for example `example.co.ke`) using the Public Suffix List (`tldts`),
- strips the query string from the display URL.

### 8.2 Link-structure heuristics (`apps/api/src/url-analysis/url-heuristics.ts`)

This check needs no network, so it always runs.

| Signal | Severity |
| --- | --- |
| Homograph / look-alike characters imitating a known brand | strong (moderate when no specific brand is matched) |
| Raw IP address instead of a domain | moderate |
| `@` trick that hides the real host | moderate |
| Known brand in the subdomain of an unrelated site | moderate |
| Brand name inside an unrelated domain | moderate (weak for generic names) |
| Domain closely resembles a known brand (typosquat) | moderate |
| Looks like Kenyan government but not on `.go.ke` | moderate |
| Login or payment wording on a site using another organisation's name | moderate |
| Free website-builder or form host | weak |
| Unusually many subdomain levels | weak |
| Many hyphenated words in the domain | weak |
| TLD frequently seen in abuse reports | weak |
| No HTTPS | weak |
| Unusual port | weak |
| Heavily encoded characters | weak |
| URL shortener (hides the destination) | info |
| Login, verification or payment words in the address | info |

The known-brand list (employers, banks, M-Pesa, job boards, government bodies) is in `url-analysis/brands.ts`.

### 8.3 VirusTotal reputation (`apps/api/src/virustotal/`)

1. Look up an existing report: `GET /api/v3/urls/{id}`.
2. If there is none, or it is older than `VIRUSTOTAL_MAX_REPORT_AGE_DAYS`, submit the URL (`POST /urls`) and poll `GET /analyses/{id}` up to `VIRUSTOTAL_POLL_ATTEMPTS` times. The wait starts at 5 s and doubles up to `VIRUSTOTAL_POLL_INTERVAL_MS`.
3. A sliding-window limiter keeps calls within `VIRUSTOTAL_REQUESTS_PER_MINUTE`. The public API allows 4 per minute and 500 per day.
4. Identical requests that arrive at the same time share one call, and completed results are cached for `VIRUSTOTAL_CACHE_TTL_MINUTES`.
5. Errors (401/403, 429, 5xx, timeouts, malformed JSON, scans still pending) each produce an explicit non-clean status. Raw VirusTotal responses are never forwarded to the browser.

Evidence produced (`risk-assessment/evidence.ts`):

| Result | Severity |
| --- | --- |
| ≥ 3 vendors say malicious | strong |
| 1–2 vendors say malicious | moderate |
| ≥ 1 vendor says suspicious | weak |

### 8.4 Domain intelligence (`apps/api/src/domain-intelligence/`)

- **RDAP** (default, free, no key) uses the IANA bootstrap file to find the right registry. Some ccTLD registries, possibly including `.ke`, do not publish RDAP. Those lookups show as *unavailable*, and that never raises the risk.
- **WhoisXML** (paid) gives broader coverage. It needs `DOMAIN_INTELLIGENCE_API_KEY`.
- A domain **younger than 30 days** is a *weak* signal only. Privacy-protected registrant details are *info*.

### 8.5 Safe page inspection (`apps/api/src/page-inspection/`)

This check is off by default (`PAGE_INSPECTION_ENABLED=false`). When on, RadarJob fetches the page **once** under these limits:

- GET only, no cookies, no JavaScript, HTML only, with size and time limits;
- every hop, including redirects (up to 5), is DNS-resolved, and **all** answers must be public unicast addresses;
- the vetted IP is pinned for the connection, which defeats DNS rebinding;
- ports 80 and 443 only.

It then analyses the HTML:

| Signal | Severity |
| --- | --- |
| Password form on a page impersonating a brand | strong (weak if no impersonation) |
| PIN or one-time-code fields | strong |
| Title claims to be a known brand that doesn't own the domain | moderate |
| Title claims Kenyan government but not on `.go.ke` | moderate |
| Asks for card or bank details | moderate |
| Login form submits to a different website | moderate |
| Page text mentions paying a fee or sending money | moderate |
| Asks for ID-document numbers | weak |

### 8.6 Job-advert rules (`apps/api/src/job-ad/job-ad.rules.ts`)

These are pattern rules (English and common Kenyan phrasing) run on pasted text:

| Red flag | Severity |
| --- | --- |
| Asks you to pay before you are hired | strong |
| Asks for a PIN, password or one-time code | strong |
| Receiving or forwarding money through your account (money mule) | strong |
| Deposit or "top-up" to unlock work or earnings | strong |
| Guarantees employment or skips the normal selection process | moderate |
| Unusually high or easy earnings | moderate |
| Asks you to keep the offer secret | moderate |
| Requests ID documents or bank details early | moderate |
| Requires buying equipment, software or training | moderate |
| Pressure to act quickly | weak |
| Recruitment only through WhatsApp or Telegram | weak |
| Free email address used for an organisation | weak |

### 8.7 AI (`apps/api/src/ai/`) — optional and tightly constrained

- **Providers:** Anthropic Messages API (default model `claude-haiku-5-5`), Gemini through its OpenAI-compatible endpoint (default `gemini-3.8-flash`), or any OpenAI-compatible endpoint (`AI_MODEL` required).
- **What it may do:** add indicators about the URL and page, add indicators about the job text, and write the plain-language explanation.
- **Guard rails:**
  - Responses are schema-validated.
  - Each indicator's evidence must be an **exact substring** of the data the AI was given.
  - AI indicators are capped at *moderate* severity and never count as an independent source.
  - Summaries that promise safety, give guarantees, or claim to have visited an uninspected page are rejected.
  - Untrusted data is wrapped and labelled, and attempts to break out of the wrapper are neutralised (prompt-injection hygiene).
  - Job text has phone numbers, emails and ID-like numbers replaced before it is sent.
  - On **any** failure the deterministic template is used instead.

---

## 9. How the risk decision is made

The code is in `apps/api/src/risk-assessment/risk-engine.ts`. The thresholds are in `rules.config.ts` (version `2026.10-1`, stamped on every report).

### 9.1 The four categories (most severe first)

| Category | Meaning |
| --- | --- |
| `potentially_malicious` | Strong evidence, or warning signs from several independent sources |
| `suspicious` | Warning signs that justify caution |
| `inconclusive` | Not enough reliable information (usually VirusTotal didn't complete) |
| `no_significant_threats` | Checks ran and found nothing significant. **Not** a guarantee. |

### 9.2 Link assessment (indicators with dimension `link`)

1. Any **strong** indicator → **Potentially malicious**.
2. **Moderate** indicators from **≥ 2 independent non-AI sources** (for example VirusTotal plus page) → **Potentially malicious**.
3. Any moderate indicator → **Suspicious**.
4. **≥ 3 weak** indicators → **Suspicious**.
5. VirusTotal did **not** complete → **Inconclusive**.
6. Otherwise → **No significant threats detected**.

### 9.3 Offer assessment (indicators with dimension `offer`, only when job text was given)

- Any strong → **Potentially malicious**.
- Any moderate, or ≥ 2 weak → **Suspicious**.
- Otherwise → **No significant threats**.

### 9.4 Combining

The overall category is the **more severe** of link and offer. One exception: a clean offer cannot turn an inconclusive link into a clean result, so the category stays `inconclusive`.

### 9.5 Conflict explanations

The report explains apparent contradictions in plain words, for example:

- VirusTotal is clean but other checks found warnings ("new phishing sites often have no detections yet").
- Vendors flag a domain that is several years old ("established sites can be compromised").
- The website is clean but the job offer has red flags ("scams are posted on legitimate platforms").
- The job text looks ordinary but the link is suspicious ("scammers copy genuine advert text").

### 9.6 Changing the rules

Edit the values in `DEFAULT_RULES` and **bump `version`**. Don't change the engine logic for threshold tweaks. The five specification scenarios in `risk-engine.test.ts` must still pass.

---

## 10. The report

The shape is defined in `packages/shared/src/schemas/report.ts` (`ReportSchema`). The web client validates every response against it.

```jsonc
{
  "id": "uuid",
  "status": "running | completed | failed",
  "createdAt": "ISO date", "completedAt": "ISO date",
  "simulated": false,                       // true when DEV_MOCK_PROVIDERS is on
  "input": {
    "displayUrl": "https://example.co.ke/jobs",   // no query string
    "hostname": "...", "unicodeHostname": "...",
    "registeredDomain": "example.co.ke",
    "hadQuery": true, "jobAdSupplied": false
  },
  "checks": {
    "virustotal":   { "status": "completed", "stats": {...}, "flaggedBy": [...], "origin": "existing_report" },
    "domain":       { "status": "completed", "data": { "ageDays": 12, ... } },
    "urlHeuristics":{ "status": "completed" },
    "urlAi":        { "status": "not_configured" },
    "page":         { "status": "skipped" },
    "jobAd":        { "status": "skipped", "message": "No job text was provided." }
  },
  "indicators": [ { "id": "url_heuristic-1", "source": "url_heuristic", "dimension": "link",
                    "category": "...", "title": "...", "evidence": "...", "whyItMatters": "...",
                    "basis": "observed", "severity": "moderate" } ],
  "assessment": { "category": "suspicious", "link": "suspicious", "offer": null,
                  "reasons": [...], "conflicts": [...], "rulesVersion": "2026.10-1" },
  "findings": [...], "unknowns": [...], "limitations": [...],
  "explanation": { "summary": "...", ... }
}
```

---

## 11. Data, privacy and the database

### 11.1 What is stored where

| Data | Where | How long |
| --- | --- | --- |
| Analysis reports (redacted) | Server: PostgreSQL if `DATABASE_URL` is set, otherwise memory (max 5,000, lost on restart) | `REPORT_RETENTION_HOURS` (default 72 h), then purged |
| Saved history (up to 25 reports) | The user's browser (`localStorage` key `radarjob.history.v1`) | Until the user deletes it |
| Job-advert text | **Nowhere.** It is processed in memory only, and redacted before AI. | — |
| Query strings, IP addresses, accounts | **Never stored** | — |
| Logs | Hostnames and report IDs only | Depends on your host |

### 11.2 Database schema (`apps/api/prisma/schema.prisma`)

There is one table, `AnalysisRecord`:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `TEXT` (PK) | Random UUID, not derived from the URL |
| `registeredDomain` | `TEXT?` | e.g. `example.co.ke` (indexed) |
| `status` | `TEXT` | `running` / `completed` / `failed` |
| `category` | `TEXT?` | Final risk category |
| `report` | `JSONB` | The full, already-redacted report |
| `createdAt` | `TIMESTAMP` | Default now (indexed) |
| `updatedAt` | `TIMESTAMP` | Auto-updated |
| `expiresAt` | `TIMESTAMP` | Retention deadline (indexed, used by the purge) |

The migration is in `apps/api/prisma/migrations/20261028000000_init/migration.sql`. The store does an *upsert* on every progress step, so the row always holds the latest snapshot.

### 11.3 Why you need a database in production

Without `DATABASE_URL`, reports live in the API process's memory. That works for one long-running server. On **serverless hosts like Vercel**, the request that creates a report and the requests that poll it can land on different instances, so a database is **required** there. See [DEPLOYMENT-VERCEL.md](DEPLOYMENT-VERCEL.md).

### 11.4 Database commands

```bash
docker compose up -d                       # local Postgres 16 on 127.0.0.1:5432
# .env → DATABASE_URL=postgresql://radarjob:radarjob@localhost:5432/radarjob
pnpm db:migrate                            # apply migrations (prisma migrate deploy)
pnpm db:generate                           # regenerate the Prisma client
pnpm --filter @radarjob/api db:migrate:dev # create a new migration after editing the schema
```

---

## 12. API reference

The base path is `/api`. All errors use one shape:

```json
{ "error": { "code": "invalid_url.malformed", "message": "Human-readable text", "details": [] } }
```

| Method & path | Body / query | Response |
| --- | --- | --- |
| `GET /api/health` | — | `{ status, time, integrations: { virustotal, domainIntelligence, domainProvider, ai, aiProvider, pageInspection, persistence } }`. Shows configuration state, never secrets. |
| `POST /api/analysis` | `{ "url": string, "jobAdText"?: string }` | `202 { id, status: "running" }`. Limited to `ANALYSIS_RATE_LIMIT_PER_HOUR` per client. |
| `GET /api/analysis/:id` | — | The full report (§10). Poll until `status` is not `running`. |
| `POST /api/job-ad-analysis` | `{ "text": string }` (≥ 20 chars) | Red flags, category, summary, advice. Text is not stored. |
| `GET /api/education/guides?q=` | optional search `q` | Guide list |
| `GET /api/education/guides/:slug` | — | One guide |
| `GET /api/education/quiz` | — | Quiz questions |

**Error codes:** `invalid_url.empty`, `invalid_url.too_long`, `invalid_url.malformed`, `invalid_url.unsupported_protocol`, `invalid_url.local_address`, `invalid_url.invalid_host` (400), `text_too_short` (400), `not_found` (404), `payload_too_large` (413), `rate_limited` (429), `busy` (503).

**Rate limits:** 120 requests per minute per client globally, plus `ANALYSIS_RATE_LIMIT_PER_HOUR` for `POST /api/analysis`. Polling and health are excluded from the hourly limit.

**Example (PowerShell):**

```powershell
$r = Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/analysis `
      -ContentType 'application/json' -Body '{"url":"https://example.com/careers"}'
Invoke-RestMethod http://localhost:4000/api/analysis/$($r.id)
```

**Example (curl):**

```bash
curl -s -X POST http://localhost:4000/api/analysis -H 'content-type: application/json' \
     -d '{"url":"https://example.com/careers"}'
curl -s http://localhost:4000/api/analysis/<id>
```

---

## 13. Configuration reference

The API validates all of these with Zod at startup (`apps/api/src/config/env.ts`). An invalid value stops the server with a readable message. Values starting with `replace-with` are treated as empty.

### General

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test` or `production` |
| `API_PORT` / `API_HOST` | `4000` / `0.0.0.0` | Where the API listens |
| `FRONTEND_URL` | `http://localhost:3000` | Allowed CORS origin(s), comma-separated. No wildcards in production. |
| `TRUST_PROXY` | `loopback` | Express "trust proxy" setting (`true`, `false`, a hop count, or a subnet name) |
| `LOG_FORMAT` | `pretty` | `json` for production |

### Persistence

| Variable | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | *(empty)* | PostgreSQL connection string. Empty means in-memory. |
| `REPORT_RETENTION_HOURS` | `72` | Server-side report lifetime (1 h – 90 days) |

### VirusTotal

| Variable | Default | Description |
| --- | --- | --- |
| `VIRUSTOTAL_API_KEY` | — | Free key at virustotal.com |
| `VIRUSTOTAL_REQUESTS_PER_MINUTE` | `4` | Outbound limiter |
| `VIRUSTOTAL_MAX_REPORT_AGE_DAYS` | `7` | Reuse existing reports newer than this |
| `VIRUSTOTAL_POLL_ATTEMPTS` | `3` | Polls after submitting a new scan |
| `VIRUSTOTAL_POLL_INTERVAL_MS` | `15000` | Maximum wait between polls |
| `VIRUSTOTAL_CACHE_TTL_MINUTES` | `60` | In-process result cache |
| `VIRUSTOTAL_TIMEOUT_MS` | `15000` | Per-request timeout |

### Domain intelligence

| Variable | Default | Description |
| --- | --- | --- |
| `DOMAIN_INTELLIGENCE_PROVIDER` | `rdap` | `rdap`, `whoisxml` or `none` |
| `DOMAIN_INTELLIGENCE_API_KEY` | — | Required for `whoisxml` |
| `DOMAIN_INTELLIGENCE_TIMEOUT_MS` | `10000` | |

### AI

| Variable | Default | Description |
| --- | --- | --- |
| `AI_PROVIDER` | `none` | `anthropic`, `openai`, `gemini` or `none` |
| `AI_MODEL` | provider default | Required for `openai` |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` | — | Key for the chosen provider |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Any OpenAI-compatible endpoint |
| `AI_TIMEOUT_MS` | `20000` | |

### Page inspection

| Variable | Default | Description |
| --- | --- | --- |
| `PAGE_INSPECTION_ENABLED` | `false` | Turns on the safe fetch (read §16 first) |
| `PAGE_INSPECTION_TIMEOUT_MS` | `8000` | |
| `PAGE_INSPECTION_MAX_BYTES` | `1000000` | |
| `PAGE_INSPECTION_MAX_REDIRECTS` | `5` | |

### Abuse protection

| Variable | Default | Description |
| --- | --- | --- |
| `ANALYSIS_RATE_LIMIT_PER_HOUR` | `20` | Per-client link checks per hour |
| `ANALYSIS_MAX_CONCURRENT` | `4` | Analyses running at once |
| `ANALYSIS_MAX_QUEUED` | `20` | Waiting analyses before `503 busy` |
| `ANALYSIS_TIMEOUT_MS` | `120000` | Deadline for the whole pipeline |

### Development only

| Variable | Default | Description |
| --- | --- | --- |
| `DEV_MOCK_PROVIDERS` | `false` | Fake providers, keyed by hostname keywords (`mock-malicious`, `mock-vt-down`, `mock-new`, `mock-whois-down`). Reports are labelled **SIMULATED**. Refused in production. |

### Web app (`apps/web/.env.local` locally, or the web project's settings on a host)

| Variable | Default | Description |
| --- | --- | --- |
| `API_INTERNAL_URL` | `http://127.0.0.1:4000` | Where Next.js forwards `/api/*`. Server-side only. |
| `CONTACT_EMAIL` | — | Optional address shown on the About page |

---

## 14. The web app (frontend)

- **Rendering.** `layout.tsx` reads request headers, so every page renders per request. That lets each response carry a fresh CSP nonce (`src/proxy.ts`).
- **API client.** `src/lib/api.ts` wraps `fetch`:
  - it calls only same-origin `/api/...` paths;
  - it validates every response with the shared Zod schemas;
  - it maps failures to `offline`, `network`, `http` or `invalid_response`, so an unreachable server is never shown as a result.
- **Report page.** `components/report/report-view.tsx` polls `GET /api/analysis/:id` and renders the live sections:
  - risk banner;
  - analysis progress (each check's status);
  - detection summary;
  - domain information;
  - evidence list;
  - AI explanation;
  - recommended actions;
  - limitations.
- **History.** `src/lib/history.ts` saves up to 25 *completed* reports in `localStorage`, validated on load. Running or failed reports are never saved.
- **Education content.** Guides, quiz and resources come from `@radarjob/shared`, so the web app can render them statically and offline.
- **Styling.** Tailwind 4 with shadcn-style primitives in `components/ui/`. Risk colours are in `components/risk-style.ts`.

---

## 15. PWA and offline behaviour

- **Installable.** `app/manifest.ts` and the icons in `public/icons` make the app installable (Chrome/Edge install prompt, Safari *Add to Home Screen*).
- **Service worker** (`public/sw.js`, registered in production builds only):
  - `/api/*` is **never** cached or queued;
  - hashed build assets are cache-first;
  - pages are network-first with a cached fallback;
  - guides are pre-cached at install;
  - `/report/*` is never cached, so an old live report can't appear current. Offline, it falls back to `/offline`.
- **Offline form.** While offline, the analyse button is disabled with *"You're offline. Connect to the internet to verify this job link."*
- **After a deploy.** Bump `VERSION` in `public/sw.js` to force clients to refresh their caches.

---

## 16. Security

- **Secrets** live only in API environment variables and are never sent to the browser. `/api/health` reports configuration *state*, not values.
- **Input validation** happens in the browser and, authoritatively, on the server: Zod plus class-validator with `whitelist` and `forbidNonWhitelisted`, and a 32 kB JSON body limit.
- **SSRF defence** for page inspection: see §8.5. **Before enabling it in production**, run the API (or a separate inspection worker) in a network segment that can reach only the public internet. It must have no route to your database, cloud metadata service or internal hosts.
- **Prompt-injection hygiene** and AI output validation: see §8.7.
- **Headers:**
  - Web: nonce-based CSP with `strict-dynamic`, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, Referrer and Permissions policies, and COOP.
  - API: Helmet with `default-src 'none'`, plus HSTS in production.
- **CORS** is limited to `FRONTEND_URL` (GET and POST only).
- **Rate limiting:**
  - per-client throttling;
  - global concurrency and queue caps;
  - an outbound VirusTotal limiter.
- **Logging** records hostnames and report IDs only. Query strings are stripped before storage or display.

---

## 17. Local development

```bash
corepack enable                 # provides pnpm 10
pnpm install
cp .env.example .env            # Windows PowerShell: Copy-Item .env.example .env
pnpm dev                        # API http://localhost:4000/api, web http://localhost:3000
```

- **No keys at all:** guides, quiz and history work fully. Link checks run the heuristics and RDAP, mark VirusTotal and AI as *not configured*, and return **Inconclusive**.
- **Try every report path without keys:** set `DEV_MOCK_PROVIDERS=true` in `.env`, then try URLs such as `https://mock-malicious.example.com`.
- **Run one side only:** `pnpm dev:api` or `pnpm dev:web`.

| Command | What it does |
| --- | --- |
| `pnpm dev` | Builds shared, then runs shared (watch), API and web |
| `pnpm build` / `pnpm start` | Production build, then start both |
| `pnpm typecheck` | TypeScript across the workspace |
| `pnpm test` | Unit and integration tests |
| `pnpm test:e2e` | Playwright (run `pnpm build` first) |
| `pnpm format` | Prettier |
| `pnpm db:migrate` / `pnpm db:generate` | Prisma |

---

## 18. Testing

- **Unit tests** cover:
  - URL validation and IDNs;
  - link heuristics and domain age;
  - VirusTotal normalisation;
  - RDAP and WhoisXML parsing;
  - AI output validation;
  - the risk engine (all five specification scenarios);
  - job-ad rules and redaction;
  - history storage;
  - client error mapping and offline form behaviour.
- **Integration tests** (`apps/api/test`) run the real Nest app with a fake HTTP layer. They cover:
  - success and zero detections;
  - pending scans, 401/403/429/5xx, timeouts and malformed responses;
  - SSRF and redirect-SSRF;
  - AI failure falling back to the template;
  - rate limiting;
  - checks that API keys never leak.
- **End-to-end tests** (`apps/web/e2e`, Playwright, mobile viewport) cover:
  - the full analysis flows (inconclusive, suspicious despite zero detections, separate job-offer assessment);
  - offline use and backend outages;
  - the standalone text check;
  - guides, quiz and history;
  - offline guide access.

All provider payloads in tests are synthetic, so no real API quota is used. If the Playwright browser download is blocked, set `CHROMIUM_PATH` to a local Chromium.

---

## 19. Extending RadarJob

| Task | Where |
| --- | --- |
| Add an impersonated brand or employer | `apps/api/src/url-analysis/brands.ts` (name and official domains) |
| Add a job-advert red flag | `apps/api/src/job-ad/job-ad.rules.ts` (pattern, severity, explanation), plus a test in `job-ad.rules.test.ts` |
| Tune thresholds | `apps/api/src/risk-assessment/rules.config.ts`, and bump `version` |
| Add or edit a guide | `packages/shared/src/content/guides.ts` (it is pre-cached by the service worker) |
| Add quiz questions | `packages/shared/src/content/quiz.ts` |
| Swap the reputation or WHOIS vendor | Implement `ReputationProvider` / `DomainIntelProvider`, then wire it in `app.module.ts` |
| Add an AI vendor | Implement `LlmClient` in `ai/llm-client.ts`, then add a branch in `buildAi()` |
| Change the API contract | `packages/shared/src/schemas/report.ts`. Both apps pick it up after `pnpm build:shared`. |
| Change the database | Edit `schema.prisma`, then run `pnpm --filter @radarjob/api db:migrate:dev` |

---

## 20. Troubleshooting

| Symptom | Fix |
| --- | --- |
| API exits with `Invalid environment configuration` | Read the listed variables (e.g. `whoisxml` needs a key; mocks are refused in production). |
| Every report is **Inconclusive** | VirusTotal is not configured or unreachable. Check `GET /api/health` and the API log. |
| `.ke` domain registration "unavailable" | The registry may not publish RDAP. Use `whoisxml`. |
| "Verification could not be completed…" | Next.js can't reach the API. Check `API_INTERNAL_URL`. |
| 429 / "Too many requests" | Per-client limit reached. Adjust `ANALYSIS_RATE_LIMIT_PER_HOUR`. |
| VirusTotal often "pending" | Free-tier scans are slow. Raise `VIRUSTOTAL_POLL_ATTEMPTS` (uses more quota). |
| Old pages after a deploy | Bump `VERSION` in `apps/web/public/sw.js`. |
| Report "not found" right after starting (serverless) | No database is set. Set `DATABASE_URL`. |
| `prisma generate` can't download engines | Allow `binaries.prisma.sh`, or set `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1`. |

---

## 21. Known limitations and roadmap

- The brand list is curated and partial.
- Page inspection reads static HTML only, so phishing kits rendered with JavaScript may show little.
- There are no accounts, by design. Reports are anonymous and expire.
- In-memory caches and limiters are per process. Multi-instance hosting would benefit from a shared store such as Redis.
- **Next steps:**
  - a network-isolated inspection worker;
  - Redis for shared caching and limits;
  - Swahili translations;
  - migration to NestJS 12 (ESM);
  - a scheduled purge endpoint for serverless hosts.

---

## 22. Glossary

| Term | Meaning |
| --- | --- |
| **Indicator** | One explainable piece of evidence (title, evidence, why it matters, severity) |
| **Dimension** | Whether an indicator is about the *link* or the job *offer* |
| **Registered domain** | The part of the hostname someone actually registers, e.g. `example.co.ke` |
| **Homograph** | A look-alike domain using similar characters, e.g. Cyrillic "а" instead of Latin "a" |
| **RDAP** | Registration Data Access Protocol, the modern standard that replaces WHOIS |
| **SSRF** | Server-Side Request Forgery: tricking a server into fetching internal resources |
| **CSP nonce** | A random value per page load. Only scripts carrying it may run. |
| **PWA** | Progressive Web App: a website that can be installed and works offline |
| **Money mule** | Someone recruited to move stolen money through their own account |
