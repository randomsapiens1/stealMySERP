import { fetchSerp } from "../googleSearch";
import type { SerpSource } from "../types";

/**
 * Default source: a plain fetch() to Google's search HTML, no browser.
 * Free and zero-setup, but easily blocked — Google's bot detection can
 * gate even a real browser's non-JS requests behind a "JavaScript
 * required" interstitial, which this can never get past.
 */
export const directFetchSource: SerpSource = {
  name: "direct-fetch",
  fetchSerp,
};
