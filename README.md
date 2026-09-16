# StealMySERP

Takes a website (English and/or Bangla), infers what each page is trying to rank
for, checks real Google results for those queries (top 10 + People Also Ask +
related searches), finds content gaps against competitors, and surfaces public
contact info on competing sites for outreach — one report per run, no database,
built entirely on free tools.

## Setup

1. Create a free [OpenRouter](https://openrouter.ai/keys) account and API key.
2. Copy `.env.local.example` to `.env.local` and set `OPENROUTER_API_KEY`.
3. `npm install`
4. `npm run dev` and open [http://localhost:3000](http://localhost:3000).

## Deploying (Vercel free/Hobby tier)

Set `OPENROUTER_API_KEY` in Vercel Project Settings → Environment Variables,
then deploy as normal. No other services or paid add-ons are required.

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
function timeout, and accumulates the results in memory. Nothing is persisted
server-side — export the finished report as Markdown or CSV from the UI.

## Known limitations

- **Google scraping is unofficial** (against Google's ToS) and can be blocked
  or rate-limited at any time — it's the only free way to get top 10 + People
  Also Ask + related searches in one place. Each query fails independently
  with a clear message rather than breaking the whole run. In testing, this
  dev environment's network consistently got Google's "JavaScript required"
  interstitial rather than real results on every attempt (not a CAPTCHA — a
  harder bot-detection gate) — this may work better from a residential IP or
  Vercel's IP ranges, but there's no guarantee; treat it as unreliable by
  design and verify from wherever you actually deploy.
- **Free LLM rate limits** (OpenRouter's free models) mean a run is
  deliberately paced and can take 1–3 minutes. OpenRouter's free-model catalog
  changes over time — see `lib/llm/client.ts` for the current picks and how
  to swap them if a model gets discontinued or rate-limited.
- **No history/tracking** — every run is fresh; nothing is saved between runs.

## Tests

```bash
npm test
```

Covers the Google SERP HTML parser against a synthetic fixture (organic
results, ads excluded, PAA, related searches) and a real captured
block/interstitial page (`lib/serp/__fixtures__/`).
