# StealMySERP crawler bridge

A local Python service that drives a real, visible Chrome browser (via
Playwright) to fetch Google search results, and exposes them over HTTP for
the Next.js app to consume — instead of the app's built-in `direct-fetch`
scraper, which is a plain `fetch()` and easily blocked by Google's bot
detection ("JavaScript required" interstitial, 429s).

**Why this works better:** a real browser passes the JS-execution check a
bare HTTP request never can, and running it from your own residential IP
avoids the pre-flagged datacenter IP ranges that got the built-in scraper
blocked. It's still against Google's Terms of Service and still not
bulletproof (you may occasionally see a CAPTCHA) — this is for personal,
low-volume, local use, not a production/multi-user deployment.

## Setup

```bash
cd crawler-service
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
python server.py
```

A Chrome window will open and navigate to google.com — leave it open. The
server listens on `http://localhost:8787`.

First run creates `.browser-profile/` (gitignored) to persist cookies
across restarts, so it looks less like a fresh bot session every time.

## Wiring it into the web app

In the Next.js app's `.env.local`:

```
SERP_SOURCE=local-bridge
SERP_BRIDGE_URL=http://localhost:8787
```

Restart `npm run dev` after changing `.env.local` (Next.js only reads env
files at startup). With this set, `/api/analyze/serp` calls this bridge
instead of scraping Google itself.

## If Google shows a CAPTCHA/verification challenge

The service waits (up to 3 minutes) for you to solve it manually in the
visible browser window — the in-flight request picks back up automatically
once the challenge clears. Watch the terminal running `server.py` for a
message when this happens.

## Notes

- Only handles one request at a time by design (a single shared browser
  page, serialized with a lock) — this is intentional pacing, not a bug.
- `serp_parser.py` mirrors the parsing heuristics in
  `../lib/serp/parseSerp.ts` on the TypeScript side. If Google changes its
  markup and results come back empty, both may need updating.
- This service is meant for `next dev` on your own machine. It's pointless
  on a deployed serverless function — there's no visible browser there.
