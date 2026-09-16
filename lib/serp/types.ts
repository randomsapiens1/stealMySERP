import type { Lang, SerpResult } from "@/lib/shared/types";

/**
 * Contract every SERP data source must satisfy. Swap sources (e.g. a local
 * Python/Playwright bridge instead of a direct scrape) by registering one
 * in lib/serp/index.ts — nothing outside this folder needs to change.
 */
export interface SerpSource {
  name: string;
  fetchSerp(query: string, lang: Lang): Promise<SerpResult>;
}
