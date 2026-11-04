# Deploying RadarJob: Online Database + Vercel

> **Current deployment (set up 2026-11-04, Vercel team `ghoul1`):**
>
> - Web: https://radarjob-web.vercel.app (project `radarjob-web`, root `apps/web`)
> - API: https://radarjob-api.vercel.app (project `radarjob-api`, root `apps/api`, region `fra1`, max duration 180 s)
> - Database: Neon `radarjob` (Frankfurt), connected to `radarjob-api`, migration `20261028000000_init` applied
>
> The `waitUntil` change in §3 is already in the code. The steps below explain how to reproduce or change this setup.

This guide sets up a free online PostgreSQL database and hosts RadarJob on Vercel. It assumes the code is on GitHub (this repo: `github.com/kiprotich25/radarJob`).

---

## 1. Which database? → **Neon (free serverless PostgreSQL)**

RadarJob already uses **PostgreSQL through Prisma**, so the right choice is a hosted Postgres. Picking a different kind of database (MongoDB, Firebase, etc.) would mean rewriting the storage layer.

| Option | Verdict |
| --- | --- |
| **Neon** ✅ recommended | Free plan with no credit card. Real PostgreSQL. Built into Vercel's Marketplace, which creates the database and adds the connection strings to your project in a few clicks. Scales to zero when idle. RadarJob stores small JSON reports that expire after 72 h, so it fits easily in the free storage (about 0.5 GB per project). |
| Supabase | Also free Postgres and works fine. Free projects are paused after a period of inactivity, and it ships many extras (auth, storage) that RadarJob doesn't need. |
| Prisma Postgres | Also works with Prisma. Neon has the most mature Vercel integration. |

> Free-plan limits change from time to time. Check the current numbers at https://neon.com/pricing.

**Why a database is required on Vercel.** On Vercel the API runs as serverless functions. The request that *starts* an analysis and the requests that *poll* it may be handled by different instances. With the default in-memory store, polling would return "report not found". Setting `DATABASE_URL` fixes this.

---

## 2. The target setup

```
                     ┌──────────────────────────────┐
  Users ───────────▶ │ Vercel project: radarjob-web │  Root directory: apps/web (Next.js)
                     │ https://radarjob-web.vercel.app
                     └──────────────┬───────────────┘
                                    │ /api/* rewrite (API_INTERNAL_URL)
                     ┌──────────────▼───────────────┐
                     │ Vercel project: radarjob-api │  Root directory: apps/api (NestJS)
                     │ https://radarjob-api.vercel.app
                     └──────────────┬───────────────┘
                                    │ DATABASE_URL (pooled)
                     ┌──────────────▼───────────────┐
                     │ Neon PostgreSQL (free)       │
                     └──────────────────────────────┘
```

You create **two Vercel projects from the same GitHub repo**, one per app. Vercel supports NestJS with zero configuration. It runs the whole Nest app as one Vercel Function and detects `src/main.ts` automatically.

> **Tip (latency).** Put the Neon database and the Vercel functions in the **same region**. For Kenyan users, Frankfurt (Neon `aws-eu-central-1`, Vercel `fra1`) is a good choice. Set the Vercel region under **Project → Settings → Functions → Function Region**.

---

## 3. ⚠️ One small code change the API needs for Vercel

`AnalysisService.start()` returns `202` straight away and keeps working in the background (`void this.execute(...)`). On a normal server that is fine. On Vercel, work that continues **after the response is sent must be registered with `waitUntil`**. Otherwise the function may be frozen, and reports would stay "running" forever.

The change, in `apps/api/src/analysis/analysis.service.ts`:

```bash
pnpm --filter @radarjob/api add @vercel/functions
```

```ts
import { waitUntil } from '@vercel/functions';
// …
// in start(), replace:   void this.execute(report, u, text);
const work = this.execute(report, u, text);
if (process.env.VERCEL) waitUntil(work); // keep the function alive until the analysis finishes
else void work;
```

Also make sure the function may run longer than the pipeline deadline (`ANALYSIS_TIMEOUT_MS`, default 120 s). Under **radarjob-api → Settings → Functions**, set **Max Duration** to at least **150 seconds**. Fluid compute is on by default for new projects and allows this on the free Hobby plan.

*(Prefer not to change code? See [§9 — host the API on Render instead](#9-alternative-api-on-render-no-code-changes).)*

---

## 4. Step 1 — Push your code to GitHub

```powershell
cd C:\Users\MAXWELL\Downloads\radarJob
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

---

## 5. Step 2 — Create the API project on Vercel

1. Sign in at https://vercel.com with GitHub.
2. Click **Add New… → Project** and import **radarJob**.
3. Configure:
   - **Project name:** `radarjob-api`
   - **Root Directory:** `apps/api` (click *Edit*)
   - **Framework Preset:** NestJS (detected automatically)
   - **Build Command** (override): `cd ../.. && pnpm build:shared && pnpm --filter @radarjob/api build`
     This builds the shared package first and runs `prisma generate`.
   - Leave **Install Command** at its default. Vercel sees `pnpm-lock.yaml` and installs the whole workspace.
4. Add the **environment variables** (Settings → Environment Variables):

   | Name | Value |
   | --- | --- |
   | `LOG_FORMAT` | `json` |
   | `FRONTEND_URL` | `https://radarjob-web.vercel.app` (update after step 4 if the URL differs) |
   | `TRUST_PROXY` | `true` (Vercel's edge is always in front of the function) |
   | `VIRUSTOTAL_API_KEY` | your key from https://www.virustotal.com/gui/join-us |
   | `DOMAIN_INTELLIGENCE_PROVIDER` | `rdap` |
   | `AI_PROVIDER` | `none`, or `anthropic` / `gemini` / `openai` plus the matching `*_API_KEY` |
   | `PAGE_INSPECTION_ENABLED` | `false` (see the security note in DOCUMENTATION.md §16) |
   | `REPORT_RETENTION_HOURS` | `72` |
   | `DEV_MOCK_PROVIDERS` | `false` |
   | `DATABASE_URL` | added automatically in step 3 |

   > **Do not set `NODE_ENV`** on Vercel. If it is set at build time, `pnpm install` skips the dev tools the build needs (Nest CLI, Prisma). Vercel already runs functions with `NODE_ENV=production`.

5. Click **Deploy**. It is fine if the first deploy happens before the database exists. You will redeploy after step 3.

---

## 6. Step 3 — Create the Neon database (free) and connect it

### Option A — from inside Vercel (easiest)

1. Open **radarjob-api → Storage → Create Database → Neon (Serverless Postgres)**.
2. Choose the **Free** plan and a region (e.g. Frankfurt), name it `radarjob`, then **Create**.
3. Connect it to the **radarjob-api** project for *Production* (and Preview, if you like).
   Vercel adds `DATABASE_URL` (pooled, used by the app) and `DATABASE_URL_UNPOOLED` (direct, used for migrations), among others.
4. Under the integration's settings you can turn **Preview branching** off. If it is on, each preview deployment gets its own empty database branch, and you would need to run migrations on it.

### Option B — directly at neon.com

1. Sign up at https://neon.com and create a project (Postgres 16 or newer, region close to your users).
2. On the **Dashboard → Connect** dialog, copy two strings:
   - **Pooled** (host contains `-pooler`) → set as `DATABASE_URL` in radarjob-api's environment variables.
   - **Direct** (no `-pooler`) → keep it for running migrations.

### Create the table (run once from your PC)

Migrations must use the **direct (unpooled)** connection string. Find it in Vercel → radarjob-api → Settings → Environment Variables (`DATABASE_URL_UNPOOLED`), or in Neon's *Connect* dialog.

```powershell
cd C:\Users\MAXWELL\Downloads\radarJob
pnpm install
$env:DATABASE_URL = "postgresql://USER:PASSWORD@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require"
pnpm db:migrate
Remove-Item Env:DATABASE_URL
```

You should see `1 migration found … applied: 20261028000000_init`. To confirm, open Neon's **SQL Editor** and run:

```sql
SELECT count(*) FROM "AnalysisRecord";   -- returns 0
```

Then go to **radarjob-api → Deployments → ⋯ → Redeploy**, so the API starts with `DATABASE_URL`.

**Check the API:** open `https://radarjob-api.vercel.app/api/health`. You should see:

```json
{ "status": "ok", "integrations": { "virustotal": "configured", "persistence": "postgres", ... } }
```

If `persistence` says `memory`, `DATABASE_URL` is missing from that environment.

---

## 7. Step 4 — Create the web project on Vercel

1. **Add New… → Project** and import the **same** repo again.
2. Configure:
   - **Project name:** `radarjob-web`
   - **Root Directory:** `apps/web`
   - **Framework Preset:** Next.js
   - **Build Command** (override): `cd ../.. && pnpm build:shared && pnpm --filter @radarjob/web build`
3. Environment variables:

   | Name | Value |
   | --- | --- |
   | `API_INTERNAL_URL` | `https://radarjob-api.vercel.app` (no trailing slash, no `/api`) |
   | `CONTACT_EMAIL` | optional public contact address |

4. **Deploy.** Then, if the web URL differs from what you guessed, update `FRONTEND_URL` in **radarjob-api** and redeploy it.

> **Custom domain (optional).** Under **radarjob-web → Settings → Domains**, add e.g. `radarjob.co.ke`, and follow the DNS instructions. Then set `FRONTEND_URL` on the API to that domain.

---

## 8. Step 5 — Verify everything

- [ ] `https://radarjob-web.vercel.app` loads, and guides and the quiz work.
- [ ] Check a link (e.g. `https://example.com`). The progress steps update and the report **completes** (not stuck on "running").
- [ ] Reload the report page. It still loads, which shows the database is working.
- [ ] In Neon's SQL Editor, `SELECT id, status, category FROM "AnalysisRecord" ORDER BY "createdAt" DESC LIMIT 5;` shows the row.
- [ ] `/api/health` (through the web URL: `https://radarjob-web.vercel.app/api/health`) shows `persistence: "postgres"`.
- [ ] Rate limiting: after `ANALYSIS_RATE_LIMIT_PER_HOUR` checks you get "Too many requests". Confirm it applies **per user**, not to all users together. Because the web app proxies to the API, the API may see Vercel's proxy address instead of the visitor's.
- [ ] On a phone: the browser offers **Install app** / **Add to Home Screen**.

### Housekeeping: deleting expired reports

The API's 15-minute purge timer only runs while a function instance is alive. On serverless that is not guaranteed. Expired reports are **never served** anyway, because the code checks `expiresAt`, but the rows stay in the table. Two ways to clean up:

- **Manually**, now and then, in Neon's SQL Editor:
  ```sql
  DELETE FROM "AnalysisRecord" WHERE "expiresAt" < now();
  ```
- **Automatically:** add a small purge endpoint and a Vercel Cron job (a free feature) that calls it daily.

---

## 9. Alternative: API on Render (no code changes)

If you would rather not change the code in §3, keep the **web on Vercel** and run the **API** as a normal long-running server:

1. At https://render.com, choose **New → Web Service**, connect the repo.
2. Settings:
   - **Build Command:** `corepack enable && pnpm install --frozen-lockfile && pnpm build:shared && pnpm --filter @radarjob/api build`
   - **Start Command:** `node apps/api/dist/main.js`
   - The same environment variables as §5, including Neon's `DATABASE_URL`, plus `API_PORT=10000`. Render expects the service on port 10000 by default, and RadarJob reads `API_PORT` rather than `PORT`.
3. Set the web project's `API_INTERNAL_URL` to the Render URL.

The free Render tier sleeps after about 15 minutes without traffic, so the first check after a quiet period can take close to a minute.

---

## 10. Costs and terms to be aware of

| Service | Free tier notes |
| --- | --- |
| Vercel Hobby | Free, but **for personal, non-commercial use**. Move to Pro if RadarJob becomes a commercial service. |
| Neon Free | Limited storage and compute hours per month. More than enough for RadarJob's small, expiring reports. |
| VirusTotal public API | 4 requests per minute, 500 per day, **non-commercial use**. The app's limiter respects this. |
| RDAP | Free, no key |
| AI providers | Usually paid per use. `AI_PROVIDER=none` works fine and uses the built-in templates. |

---

## 11. Common deployment problems

| Problem | Cause / fix |
| --- | --- |
| Reports stay **"running"** forever | The `waitUntil` change (§3) is missing, or Max Duration is too low. |
| "This report does not exist or has expired" right after starting | `DATABASE_URL` is not set for that environment (Production or Preview). |
| `relation "AnalysisRecord" does not exist` | Migrations were not run on this database or branch. Repeat the migrate step. |
| `No entrypoint found which imports nestjs` | Vercel needs a direct `@nestjs/core` import in `src/main.ts`. The repo already includes it, so keep it. |
| Build fails: cannot find `@radarjob/shared` | The build command override is missing `pnpm build:shared`. |
| API crashes: `Invalid environment configuration` | Read the function logs (Vercel → Deployments → Logs). A variable is invalid. |
| Web shows "server could not be reached" | `API_INTERNAL_URL` is wrong (it must be the API's base URL without `/api`). |
| CORS errors | Only happen on direct cross-origin calls. Set `FRONTEND_URL` to the exact web origin. |
| Migration hangs or errors with the pooled URL | Use the **direct** (non-`-pooler`) connection string for `pnpm db:migrate`. |
