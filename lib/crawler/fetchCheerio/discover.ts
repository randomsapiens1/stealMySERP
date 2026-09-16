import * as cheerio from "cheerio";
import { XMLParser } from "fast-xml-parser";
import type { DiscoverResult } from "@/lib/crawler/types";
import { fetchTextWithTimeout } from "@/lib/shared/fetchWithTimeout";
import { getRobotsInfo } from "./robots";

const NON_CONTENT_EXTENSIONS =
  /\.(jpg|jpeg|png|gif|svg|webp|pdf|zip|css|js|xml|ico|mp4|mp3)$/i;
const SKIP_PATH_PATTERNS =
  /\/(wp-admin|wp-login|cart|checkout|login|logout|signin|signup|account)(\/|$)/i;

const xmlParser = new XMLParser({ ignoreAttributes: true });

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

async function fetchSitemapUrls(
  sitemapUrl: string,
  depth = 0
): Promise<string[]> {
  if (depth > 1) return [];
  try {
    const xml = await fetchTextWithTimeout(sitemapUrl, { timeoutMs: 8000 });
    const parsed = xmlParser.parse(xml);

    if (parsed.sitemapindex) {
      const children = toArray(parsed.sitemapindex.sitemap)
        .map((s) => s?.loc)
        .filter(Boolean)
        .slice(0, 5);
      const nested = await Promise.all(
        children.map((loc: string) => fetchSitemapUrls(loc, depth + 1))
      );
      return nested.flat();
    }

    if (parsed.urlset) {
      return toArray(parsed.urlset.url)
        .map((u) => u?.loc)
        .filter(Boolean);
    }

    return [];
  } catch {
    return [];
  }
}

async function discoverViaSitemap(origin: string): Promise<string[]> {
  const robots = await getRobotsInfo(origin);
  const candidates = [
    ...robots.sitemaps,
    new URL("/sitemap.xml", origin).toString(),
    new URL("/sitemap_index.xml", origin).toString(),
  ];

  for (const candidate of candidates) {
    const urls = await fetchSitemapUrls(candidate);
    if (urls.length > 0) return urls;
  }
  return [];
}

async function discoverViaLinkCrawl(origin: string): Promise<string[]> {
  try {
    const html = await fetchTextWithTimeout(origin, { timeoutMs: 8000 });
    const $ = cheerio.load(html);
    const found = new Set<string>();

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      try {
        const abs = new URL(href, origin);
        if (abs.origin === new URL(origin).origin) {
          abs.hash = "";
          abs.search = "";
          found.add(abs.toString());
        }
      } catch {
        // ignore malformed hrefs
      }
    });

    return [origin, ...Array.from(found)];
  } catch {
    return [origin];
  }
}

function isUsablePage(url: string): boolean {
  return !NON_CONTENT_EXTENSIONS.test(url) && !SKIP_PATH_PATTERNS.test(url);
}

function hasSpecificPath(siteUrl: string): boolean {
  const path = new URL(siteUrl).pathname.replace(/\/$/, "");
  return path.length > 0;
}

export async function discoverPages(
  siteUrl: string,
  limit = 8
): Promise<DiscoverResult> {
  // If the user pointed at a specific page (not just the site's homepage),
  // analyze that one page rather than crawling the whole site's sitemap —
  // that's almost always the actual intent when a path is given.
  if (hasSpecificPath(siteUrl)) {
    return { pages: [siteUrl], mode: "single-page" };
  }

  const origin = new URL(siteUrl).origin;
  const robots = await getRobotsInfo(origin);

  let pages = await discoverViaSitemap(origin);
  const usedSitemap = pages.length > 0;

  if (!usedSitemap) {
    pages = await discoverViaLinkCrawl(origin);
  }

  const deduped = Array.from(new Set(pages))
    .filter(isUsablePage)
    .filter((url) => robots.isAllowed(url))
    .sort((a, b) => a.split("/").length - b.split("/").length)
    .slice(0, limit);

  return {
    pages: deduped.length > 0 ? deduped : [origin],
    mode: usedSitemap ? "sitemap" : "link-crawl",
  };
}
