import type { AnalyzedPageRecord } from "@/lib/db/history";

export function siteLabel(siteUrl: string): string {
  try {
    return new URL(siteUrl).hostname.replace(/^www\./, "");
  } catch {
    return siteUrl;
  }
}

export function pageKey(pageUrl: string): string {
  try {
    const pathname = new URL(pageUrl).pathname;
    const trimmed = pathname.replace(/\/+$/, "");
    return trimmed === "" ? "/" : trimmed;
  } catch {
    return pageUrl;
  }
}

export function pagePathLabel(key: string): string {
  return key === "/" ? "/ (home)" : key;
}

export function runHeaderLabel(analyzedAt: string): { date: string; time: string } {
  const d = new Date(analyzedAt);
  return {
    date: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    time: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
  };
}

const RELATIVE_UNITS: Array<{ ms: number; label: string }> = [
  { ms: 1000 * 60 * 60 * 24 * 30, label: "mo" },
  { ms: 1000 * 60 * 60 * 24 * 7, label: "w" },
  { ms: 1000 * 60 * 60 * 24, label: "d" },
  { ms: 1000 * 60 * 60, label: "h" },
  { ms: 1000 * 60, label: "m" },
];

export function relativeTimeFromNow(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  for (const { ms, label } of RELATIVE_UNITS) {
    const value = Math.floor(diff / ms);
    if (value >= 1) return `${value}${label} ago`;
  }
  return "just now";
}

export function bestRank(record: AnalyzedPageRecord): number | null {
  const ranks = record.queries
    .filter((q) => !q.serpBlocked && !q.serpError && q.verifiedRank !== null)
    .map((q) => q.verifiedRank as number);
  return ranks.length === 0 ? null : Math.min(...ranks);
}

export function rankTierClasses(rank: number): string {
  if (rank <= 3) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400";
  if (rank <= 10) return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400";
  return "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400";
}

// A site is often audited page-by-page rather than all at once, so "current
// state" is the latest record per page, not the latest single run timestamp.
export function latestRecordsByPage(records: AnalyzedPageRecord[]): AnalyzedPageRecord[] {
  const map = new Map<string, AnalyzedPageRecord>();
  for (const r of records) {
    const key = pageKey(r.pageUrl);
    const existing = map.get(key);
    if (!existing || r.analyzedAt > existing.analyzedAt) map.set(key, r);
  }
  return Array.from(map.values()).sort((a, b) => pageKey(a.pageUrl).localeCompare(pageKey(b.pageUrl)));
}

export interface SiteStats {
  site: string;
  records: AnalyzedPageRecord[];
  auditCount: number;
  lastAnalyzedAt: string;
  pageCount: number;
  top3Pct: number;
  top10Pct: number;
  coveragePct: number;
  bestRank: number | null;
  gapCount: number;
  contactCount: number;
}

function computeSiteStats(site: string, records: AnalyzedPageRecord[]): SiteStats {
  const latest = latestRecordsByPage(records);
  const queries = latest.flatMap((r) => r.queries);
  const rankedQueries = queries.filter((q) => q.verifiedRank !== null);
  const top10 = rankedQueries.filter((q) => (q.verifiedRank as number) <= 10).length;
  const top3 = rankedQueries.filter((q) => (q.verifiedRank as number) <= 3).length;
  const pagesWithRank = latest.filter((r) => bestRank(r) !== null).length;
  const gapCount = latest.reduce(
    (n, r) => n + r.gapReports.reduce((m, g) => m + g.contentGaps.length, 0),
    0
  );
  // contacts are saved per analysis run (same list on every page row from
  // that run), so dedupe by domain instead of summing across pages.
  const contactDomains = new Set(latest.flatMap((r) => r.contacts.map((c) => c.domain)));
  const runs = new Set(records.map((r) => r.analyzedAt));

  return {
    site,
    records,
    auditCount: runs.size,
    lastAnalyzedAt: records.reduce(
      (latestAt, r) => (r.analyzedAt > latestAt ? r.analyzedAt : latestAt),
      records[0].analyzedAt
    ),
    pageCount: latest.length,
    top3Pct: queries.length === 0 ? 0 : Math.round((top3 / queries.length) * 100),
    top10Pct: queries.length === 0 ? 0 : Math.round((top10 / queries.length) * 100),
    coveragePct: latest.length === 0 ? 0 : Math.round((pagesWithRank / latest.length) * 100),
    bestRank: rankedQueries.length === 0 ? null : Math.min(...rankedQueries.map((q) => q.verifiedRank as number)),
    gapCount,
    contactCount: contactDomains.size,
  };
}

export function groupBySite(records: AnalyzedPageRecord[]): SiteStats[] {
  const groups = new Map<string, AnalyzedPageRecord[]>();
  for (const record of records) {
    const key = siteLabel(record.siteUrl);
    const existing = groups.get(key);
    if (existing) existing.push(record);
    else groups.set(key, [record]);
  }

  return Array.from(groups.entries())
    .map(([site, siteRecords]) => computeSiteStats(site, siteRecords))
    .sort((a, b) => (a.lastAnalyzedAt > b.lastAnalyzedAt ? -1 : 1));
}

