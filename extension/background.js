// StealMySERP crawler bridge — background service worker.
//
// Receives a search request from the local StealMySERP web app (via
// chrome.runtime.onMessageExternal), runs the search in a real, normal
// browser tab using your actual logged-in Chrome session, and extracts
// the results directly from the live rendered DOM. Because this is a
// genuine tab navigation with no automation flags (no navigator.webdriver,
// no CDP session), it doesn't carry the bot-detection signals that a
// Playwright-driven browser does.

const MIN_DELAY_MS = 3000;
const MAX_DELAY_MS = 7000;
const NAV_TIMEOUT_MS = 20000;
// AI Overview streams in asynchronously after the rest of the page has
// loaded (it's generated, not static) — needs more settle time than the
// rest of the results to have a chance of being present when we read the DOM.
const SETTLE_DELAY_MS = 3000;

let dedicatedTabId = null;
// Serializes concurrent requests onto one queue so searches happen one at
// a time in one reused tab, like a real person searching sequentially.
let queue = Promise.resolve();

function randomDelay() {
  const ms = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSearchUrl(query, hl, gl) {
  const params = new URLSearchParams({ q: query, num: "10", hl, gl, pws: "0" });
  return `https://www.google.com/search?${params.toString()}`;
}

function waitForTabComplete(tabId, timeoutMs = NAV_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Navigation timed out"));
    }, timeoutMs);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function getOrCreateTab() {
  if (dedicatedTabId !== null) {
    try {
      await chrome.tabs.get(dedicatedTabId);
      return dedicatedTabId;
    } catch {
      dedicatedTabId = null;
    }
  }
  const tab = await chrome.tabs.create({ url: "https://www.google.com", active: false });
  dedicatedTabId = tab.id;
  await waitForTabComplete(tab.id);
  return tab.id;
}

// Runs inside the Google results page via chrome.scripting.executeScript.
// Mirrors the heuristics in lib/serp/parseSerp.ts on the Next.js side, but
// against the live rendered DOM instead of static HTML.
function extractSerpFromPage(searchedQuery) {
  const BLOCK_MARKERS = ["captcha-form", "unusual traffic", "recaptcha", "sorry/index"];
  const bodyText = document.body.innerText.toLowerCase();
  const blocked =
    BLOCK_MARKERS.some((m) => bodyText.includes(m)) || !!document.querySelector("form#captcha-form");

  if (blocked) {
    return { blocked: true, top10: [], paa: [], relatedSearches: [] };
  }

  const container = document.querySelector("#rso") || document.querySelector("#search");
  const top10 = [];
  const seen = new Set();

  if (container) {
    for (const h3 of Array.from(container.querySelectorAll("h3"))) {
      const title = h3.textContent.trim();
      if (!title) continue;

      const link = h3.closest("a[href]");
      if (!link || !link.href.startsWith("http") || seen.has(link.href)) continue;

      const block = h3.closest("div[data-hveid]") || h3.closest("div.g") || h3.closest("div");
      if (block && block.hasAttribute("data-text-ad")) continue;

      let snippet = "";
      if (block) {
        for (const c of block.querySelectorAll("div, span")) {
          const t = c.textContent.trim();
          if (t.length > snippet.length && t.length < 400) snippet = t;
        }
      }

      seen.add(link.href);
      top10.push({ position: top10.length + 1, title, url: link.href, snippet });
      if (top10.length >= 10) break;
    }
  }

  // data-q also fires on the search box's own query, not just PAA
  // questions — filter that out explicitly.
  const paa = [];
  const paaSeen = new Set();
  document.querySelectorAll("[data-q]").forEach((el) => {
    const q = (el.getAttribute("data-q") || "").trim();
    if (q && q !== searchedQuery && !paaSeen.has(q)) {
      paaSeen.add(q);
      paa.push(q);
    }
  });

  const relatedSearches = [];
  const relSeen = new Set();
  let marker = null;
  document.querySelectorAll("*").forEach((el) => {
    if (el.children.length > 0) return; // leaf text nodes only
    const text = el.textContent.trim().toLowerCase();
    if (
      text === "related searches" ||
      text === "people also search for" ||
      text.startsWith("searches related to")
    ) {
      marker = el;
    }
  });
  if (marker) {
    let ancestor = marker;
    for (let i = 0; i < 3 && ancestor.parentElement; i++) ancestor = ancestor.parentElement;
    ancestor.querySelectorAll("a").forEach((a) => {
      const text = a.textContent.trim();
      if (text && text.length < 100 && !relSeen.has(text)) {
        relSeen.add(text);
        relatedSearches.push(text);
      }
    });
  }

  // Best-effort: find the visible "AI Overview" label Google shows, then
  // within a nearby ancestor, take the single longest text-bearing child
  // as the actual generated answer — NOT the whole container's
  // concatenated text, which also picks up sibling UI chrome (an "AI
  // Overview isn't available" fallback message that can coexist in the
  // DOM, "AI Mode" prompt chips, duplicated result cards, and even raw
  // <script> text via textContent). The real answer is reliably the
  // longest single block, same technique organic snippets already use.
  let aiOverview = null;
  let aiOverviewMarker = null;
  document.querySelectorAll("*").forEach((el) => {
    if (aiOverviewMarker) return;
    if (el.children.length > 0) return;
    if (el.textContent.trim() === "AI Overview") aiOverviewMarker = el;
  });
  if (aiOverviewMarker) {
    let container = aiOverviewMarker;
    for (let i = 0; i < 5 && container.parentElement; i++) {
      container = container.parentElement;
      if (container.textContent.trim().length > 200) break;
    }

    let longest = "";
    container.querySelectorAll("div, span, p").forEach((el) => {
      if (el.querySelector("script, style")) return;
      const text = el.textContent.replace(/\s+/g, " ").trim();
      if (text.length > longest.length && text.length < 3000) longest = text;
    });

    if (longest.length >= 100 && !longest.toLowerCase().includes("ai overview is not available")) {
      const ownHost = location.hostname;
      const sources = [];
      const sourcesSeen = new Set();
      container.querySelectorAll("a[href^='http']").forEach((a) => {
        const url = a.href;
        if (sourcesSeen.has(url) || url.includes(ownHost) || url.includes("policies.google.com") || url.includes("support.google.com")) {
          return;
        }
        sourcesSeen.add(url);
        sources.push(url);
      });
      aiOverview = { text: longest, sources: sources.slice(0, 10) };
    }
  }

  return { blocked: false, top10, paa, relatedSearches, aiOverview };
}

async function handleSerpSearch({ query, hl, gl }) {
  await randomDelay();
  const tabId = await getOrCreateTab();
  const url = buildSearchUrl(query, hl || "en", gl || "us");

  await chrome.tabs.update(tabId, { url });
  await waitForTabComplete(tabId);
  await new Promise((resolve) => setTimeout(resolve, SETTLE_DELAY_MS));

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: extractSerpFromPage,
    args: [query],
  });

  if (result.blocked) {
    return {
      top10: [],
      paa: [],
      relatedSearches: [],
      blocked: true,
      error: "Google is showing a verification challenge in the bridge tab. Solve it there, then retry.",
    };
  }

  return result;
}

chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "SERP_SEARCH") return false;

  queue = queue
    .then(() => handleSerpSearch(message))
    .then(sendResponse)
    .catch((err) =>
      sendResponse({ top10: [], paa: [], relatedSearches: [], error: String(err && err.message ? err.message : err) })
    );

  return true; // keep the message channel open for the async sendResponse
});
