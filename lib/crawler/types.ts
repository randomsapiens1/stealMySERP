import type { PageContent } from "@/lib/shared/types";

export interface DiscoverResult {
  pages: string[];
  mode: "single-page" | "sitemap" | "link-crawl";
}

/**
 * Contract every crawler backend must satisfy. Swap implementations (e.g. a
 * headless-browser crawler for JS-rendered pages) by registering a new one
 * in lib/crawler/index.ts — nothing outside this folder needs to change.
 */
export interface Crawler {
  name: string;
  discover(siteUrl: string, limit?: number): Promise<DiscoverResult>;
  extract(url: string): Promise<PageContent>;
}
