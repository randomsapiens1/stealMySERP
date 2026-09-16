# StealMySERP Crawler Bridge (Chrome extension)

Fetches real Google search results using your actual, already-logged-in
Chrome session — not a separate automated browser. This is the most
reliable of the three SERP sources in this project: `direct-fetch` and
the `crawler-service/` Python bridge both drive a browser Google can
fingerprint as automated (`navigator.webdriver`, CDP quirks); this
extension does a genuine tab navigation with none of that, so a search
that gets blocked through those paths can go through cleanly here.

The tradeoff: it needs a real Chrome window open on your machine (it's
not a headless background service), and it only works while you're
running the app locally with `npm run dev` — not on a deployed serverless
function, since there's no browser there at all.

## How it works

The extension listens for messages from the StealMySERP web page (via
`chrome.runtime.onMessageExternal` — the reason this has to be wired up
client-side in the app rather than through an API route: extension
messaging is a browser-page capability, not something a Next.js server
route can do). On a `SERP_SEARCH` message, it reuses one dedicated
background tab to navigate to the query on google.com, waits for the
page to settle, and extracts organic results / People Also Ask / related
searches directly from the live rendered DOM — then sends that back as
the response.

## Setup

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** (toggle, top right).
3. Click **Load unpacked** and select this `extension/` folder.
4. Copy the **ID** shown on the extension's card (or open its popup —
   it's shown there too).
5. In the Next.js app's `.env.local`:
   ```
   NEXT_PUBLIC_SERP_SOURCE=extension
   NEXT_PUBLIC_EXTENSION_ID=<the ID you copied>
   ```
6. Restart `npm run dev` (`NEXT_PUBLIC_*` vars are baked in at build
   time — a running dev server won't pick up a change without restarting).

## Notes

- One request at a time by design (a queue serializes requests onto a
  single reused tab) — this is intentional pacing, matching how a real
  person searches, not a limitation.
- If Google does show a verification challenge in the bridge tab, solve
  it there manually and retry — the extension surfaces this as a clear
  error rather than hanging.
- `background.js`'s extraction logic mirrors `../lib/serp/parseSerp.ts`
  on the Next.js side, adapted for the live DOM instead of static HTML.
  If Google changes its markup and results come back empty, both may
  need updating.
- Only works for one Chrome profile/window at a time — whichever window
  the extension is installed in and creates its bridge tab in.
