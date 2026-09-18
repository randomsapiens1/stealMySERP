# StealMySERP

Takes a website (English and/or Bangla), infers what each page is trying to rank
for, checks real Google results for those queries (top 10 + People Also Ask +
related searches + AI Overview, when shown), finds content gaps against
competitors *and* against what Google's AI Overview already covers, and
surfaces public contact info on competing sites for outreach — built entirely
on free tools.

## Setup

1. Create a free [OpenRouter](https://openrouter.ai/keys) account and API key.
2. Provision a Postgres database (a free [Neon](https://neon.tech) project
   works well — this repo is set up for it via the Vercel Marketplace, but any
   Postgres works) and set `DATABASE_URL`.
3. Copy `.env.local.example` to `.env.local` and set `OPENROUTER_API_KEY`.
4. `npm install`
5. `npm run dev` and open [http://localhost:3000](http://localhost:3000).

## Deploying (Vercel free/Hobby tier)

Set `OPENROUTER_API_KEY` in Vercel Project Settings → Environment Variables.
`DATABASE_URL` (and friends) are set automatically if you provision Postgres
via the Vercel Marketplace (`vercel integration add neon`) — otherwise set it
manually. No other services or paid add-ons are required.

## Getting past Google blocking (local personal use)

The built-in SERP scraper (`direct-fetch`) is a plain HTTP request and gets
blocked by Google fairly easily (a "JavaScript required" gate, or 429s).
There are two local, personal-use alternatives, in order of reliability:

**1. Chrome extension bridge (recommended)** — [`extension/`](extension/README.md)
uses your real, already-logged-in Chrome session to do the search in a
genuine tab, with none of the automation fingerprints (`navigator.webdriver`,
CDP) that the other options carry. In testing, searches that got blocked
through both other paths went through immediately here. Setup: load
`extension/` unpacked in `chrome://extensions`, then in `.env.local`:

```
NEXT_PUBLIC_SERP_SOURCE=extension
NEXT_PUBLIC_EXTENSION_ID=<id from chrome://extensions>
```

**2. Python/Playwright crawler bridge** — [`crawler-service/`](crawler-service/README.md)
runs a real, visible Chrome browser via Playwright and exposes it over
HTTP. Still detectable as automated (it's a much harder bot-detection
signal than a fresh browser fingerprint would suggest), but useful as a
standalone service that doesn't depend on a specific open browser window.
Setup:

```
SERP_SOURCE=local-bridge
SERP_BRIDGE_URL=http://localhost:8787
```

Restart `npm run dev` after changing either. The SERP data source for
#2 is swappable via a registry (`lib/serp/index.ts`) the same way the site
crawler is (`lib/crawler/index.ts`); the extension bridge (#1) is wired in
directly in `components/AnalyzeClient.tsx` since browser-extension
messaging only works from client-side page code, not a server API route.

## How it works

Each analysis run is client-orchestrated: the browser calls a series of small
API routes in sequence (`/api/analyze/{discover,extract,queries,serp,
competitors,gaps,contacts}`), each scoped to stay well under Vercel's Hobby
function timeout, and accumulates the results in memory. Export the finished
report as Markdown or CSV from the UI. When a run finishes, every analyzed
page is also saved to a local history dashboard (see below).

## History dashboard

Every analyzed page is automatically saved to Postgres (via `DATABASE_URL`)
— visit `/history` to browse every site you've checked (grouped as a
"Monitored Websites" table), drill into a site to see each page's queries and
content gaps, delete entries, or export the visible rows to CSV. Because it's
a real hosted database rather than a local SQLite file, this works the same
way on a Vercel deployment as it does with `npm run dev`. See `lib/db/` for
the schema and `app/api/history/*` for the routes.

## Known limitations

- **Google scraping is unofficial** (against Google's ToS) and can be blocked
  or rate-limited at any time. The Chrome extension bridge and Playwright
  bridge (above) sidestep this reliably in testing but only run locally; a
  Vercel deployment falls back to the built-in `direct-fetch` scraper, which
  gets blocked more easily.
- **Free LLM rate limits** (OpenRouter's free models) mean a run is
  deliberately paced and can take 1–3 minutes. OpenRouter's free-model catalog
  changes over time — see `lib/llm/client.ts` for the current picks and how
  to swap them if a model gets discontinued or rate-limited.

## Tests

```bash
npm test
```

Covers the Google SERP HTML parser (synthetic fixture + a real captured
block/interstitial page), the crawler/SERP-source registries, contact-email
extraction (including a regression for library-version false positives), and
history persistence (save/search/delete against `DATABASE_URL`; skipped if unset).
