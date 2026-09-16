import type { Crawler } from "../types";
import { discoverPages } from "./discover";
import { extractPage } from "./extract";

/**
 * Default crawler: plain fetch() + cheerio HTML parsing. No JS rendering —
 * fast and free, but blind to content that only appears after client-side
 * rendering. Good fit for most content/marketing/service pages.
 */
export const fetchCheerioCrawler: Crawler = {
  name: "fetch-cheerio",
  discover: discoverPages,
  extract: extractPage,
};
