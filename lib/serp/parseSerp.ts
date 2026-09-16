import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { SerpOrganicResult } from "@/lib/shared/types";

export interface ParsedSerp {
  top10: SerpOrganicResult[];
  paa: string[];
  relatedSearches: string[];
  blocked: boolean;
}

const BLOCK_MARKERS = [
  "id=\"captcha-form\"",
  "unusual traffic",
  "enablejs",
  "sorry/index",
];

export function looksBlocked(html: string): boolean {
  const lower = html.toLowerCase();
  return BLOCK_MARKERS.some((marker) => lower.includes(marker.toLowerCase()));
}

function longestTextChild<T extends AnyNode>(
  $: cheerio.CheerioAPI,
  block: cheerio.Cheerio<T>
): string {
  let longest = "";
  block.find("div, span").each((_, child) => {
    const text = $(child).text().trim();
    if (text.length > longest.length && text.length < 400) longest = text;
  });
  return longest;
}

function parseOrganicResults($: cheerio.CheerioAPI): SerpOrganicResult[] {
  const container = $("#rso").length ? $("#rso") : $("#search");
  const results: SerpOrganicResult[] = [];
  const seen = new Set<string>();

  container.find("h3").each((_, h3El) => {
    const h3 = $(h3El);
    const title = h3.text().trim();
    if (!title) return;

    const link = h3.closest("a[href]");
    const href = link.attr("href");
    if (!href || !href.startsWith("http")) return;
    if (seen.has(href)) return;

    // Skip ad blocks / "People also ask" blocks that sometimes contain h3s.
    const block = h3.closest("div[data-hveid], div.g, div");
    if (block.attr("data-text-ad") !== undefined) return;

    const snippet = longestTextChild($, block);

    seen.add(href);
    results.push({
      position: results.length + 1,
      title,
      url: href,
      snippet,
    });
  });

  return results.slice(0, 10);
}

function parsePeopleAlsoAsk($: cheerio.CheerioAPI): string[] {
  const questions = new Set<string>();

  $("[data-q]").each((_, el) => {
    const q = $(el).attr("data-q")?.trim();
    if (q) questions.add(q);
  });

  if (questions.size === 0) {
    $('div[role="button"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text.endsWith("?") && text.length < 200) questions.add(text);
    });
  }

  return Array.from(questions);
}

function parseRelatedSearches($: cheerio.CheerioAPI): string[] {
  const related = new Set<string>();

  const marker = $("*")
    .filter((_, el) => {
      const text = $(el).text().trim().toLowerCase();
      return (
        text === "related searches" ||
        text === "people also search for" ||
        text.startsWith("searches related to")
      );
    })
    .last();

  if (marker.length) {
    const container = marker.parent().parent();
    container.find("a").each((_, a) => {
      const text = $(a).text().trim();
      if (text && text.length < 100) related.add(text);
    });
  }

  return Array.from(related);
}

export function parseSerpHtml(html: string): ParsedSerp {
  if (looksBlocked(html)) {
    return { top10: [], paa: [], relatedSearches: [], blocked: true };
  }

  const $ = cheerio.load(html);
  return {
    top10: parseOrganicResults($),
    paa: parsePeopleAlsoAsk($),
    relatedSearches: parseRelatedSearches($),
    blocked: false,
  };
}
