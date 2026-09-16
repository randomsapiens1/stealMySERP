import type { SerpOrganicResult } from "./types";

const GOV_PATTERNS = /\.gov(\.[a-z]{2})?$|\.mil$/i;
const NEWS_PATTERNS =
  /(news|times|herald|tribune|post|gazette|chronicle|dailies?|prothomalo|thedailystar|bdnews24)/i;

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, "");
    return `${u.hostname.replace(/^www\./, "")}${path}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export function findRank(
  pageUrl: string,
  top10: SerpOrganicResult[]
): number | null {
  const target = normalizeUrl(pageUrl);
  const match = top10.find((r) => normalizeUrl(r.url) === target);
  return match ? match.position : null;
}

export function brandFromDomain(domain: string): string {
  const label = domain.split(".")[0];
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function classifySource(
  url: string,
  ownDomain: string,
  ownBrand: string
): string {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Competitor";
  }

  if (hostname === ownDomain) return ownBrand;
  if (GOV_PATTERNS.test(hostname)) return "Government site";
  if (NEWS_PATTERNS.test(hostname)) return "News/guide";
  return "Competitor";
}
