import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { AiOverview, SerpOrganicResult } from "@/lib/shared/types";

export interface ParsedSerp {
  top10: SerpOrganicResult[];
  paa: string[];
  relatedSearches: string[];
  aiOverview: AiOverview | null;
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

function parsePeopleAlsoAsk($: cheerio.CheerioAPI, searchedQuery: string): string[] {
  const questions = new Set<string>();

  // data-q also fires on the search box's own query, not just PAA
  // questions — filter that out explicitly.
  $("[data-q]").each((_, el) => {
    const q = $(el).attr("data-q")?.trim();
    if (q && q !== searchedQuery) questions.add(q);
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

// Best-effort only: Google's AI Overview is JS-rendered and frequently
// absent from a plain fetch()'s static HTML response entirely — this is
// the least reliable field this parser extracts. Heuristic: find the
// visible "AI Overview" label Google shows, then within a nearby
// ancestor, take the single longest text-bearing child as the actual
// generated answer — NOT the whole container's concatenated text, which
// also picks up sibling UI chrome (an "AI Overview isn't available"
// fallback message that can coexist in the DOM, prompt chips, duplicated
// cards). The real answer is reliably the longest single block, same
// technique organic snippets already use.
function parseAiOverview($: cheerio.CheerioAPI): AiOverview | null {
  const marker = $("*")
    .filter((_, el) => $(el).text().trim() === "AI Overview")
    .first();

  if (!marker.length) return null;

  let container = marker;
  for (let i = 0; i < 5; i++) {
    const parent = container.parent();
    if (!parent.length) break;
    container = parent;
    if (container.text().trim().length > 200) break;
  }

  let longest = "";
  container.find("div, span, p").each((_, el) => {
    const node = $(el);
    if (node.find("script, style").length) return;
    const text = node.text().replace(/\s+/g, " ").trim();
    if (text.length > longest.length && text.length < 3000) longest = text;
  });

  if (longest.length < 100 || longest.toLowerCase().includes("ai overview is not available")) {
    return null;
  }

  const sources = new Set<string>();
  container.find("a[href^='http']").each((_, a) => {
    const href = $(a).attr("href");
    if (href && !href.includes("policies.google.com") && !href.includes("support.google.com")) {
      sources.add(href);
    }
  });

  return { text: longest, sources: Array.from(sources).slice(0, 10) };
}

export function parseSerpHtml(html: string, searchedQuery = ""): ParsedSerp {
  if (looksBlocked(html)) {
    return { top10: [], paa: [], relatedSearches: [], aiOverview: null, blocked: true };
  }

  const $ = cheerio.load(html);
  return {
    top10: parseOrganicResults($),
    paa: parsePeopleAlsoAsk($, searchedQuery),
    relatedSearches: parseRelatedSearches($),
    aiOverview: parseAiOverview($),
    blocked: false,
  };
}
