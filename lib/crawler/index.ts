import { fetchCheerioCrawler } from "./fetchCheerio";
import type { Crawler } from "./types";

const CRAWLERS: Record<string, Crawler> = {
  [fetchCheerioCrawler.name]: fetchCheerioCrawler,
};

const DEFAULT_CRAWLER = fetchCheerioCrawler.name;

/**
 * Central place API routes get a crawler from. Pass `name` (or set
 * CRAWLER env var) to pick a different registered implementation — e.g.
 * once a headless-browser crawler is added, swap it in without touching
 * any route handler.
 */
export function getCrawler(name?: string): Crawler {
  const key = name ?? process.env.CRAWLER ?? DEFAULT_CRAWLER;
  const crawler = CRAWLERS[key];
  if (!crawler) {
    throw new Error(
      `Unknown crawler "${key}". Available: ${Object.keys(CRAWLERS).join(", ")}`
    );
  }
  return crawler;
}

export type { Crawler, DiscoverResult } from "./types";
