import { getDb } from "./client";
import { findRank } from "@/lib/shared/serpInsights";
import type {
  AiOverview,
  AiOverviewSourceReport,
  ContactInfo,
  GapReport,
  InferredQuery,
  RunReport,
} from "@/lib/shared/types";

export interface SavedQuery extends InferredQuery {
  verifiedRank: number | null;
  serpBlocked: boolean;
  serpError: string | null;
  // Populated whenever this query's SERP was fetched with AI Overview
  // capture available (reliably only via the extension bridge) — null just
  // means "no AI Overview was shown," not "never checked."
  aiOverview: AiOverview | null;
}

export interface AnalyzedPageRecord {
  id: number;
  siteUrl: string;
  pageUrl: string;
  primaryTopic: string;
  analyzedAt: string;
  queries: SavedQuery[];
  gapReports: GapReport[];
  contacts: ContactInfo[];
  sourceReports: AiOverviewSourceReport[];
}

interface AnalyzedPageRow {
  id: number;
  site_url: string;
  page_url: string;
  primary_topic: string;
  analyzed_at: string;
  queries_json: string;
  gap_reports_json: string;
  contacts_json: string;
  source_reports_json: string;
}

function rowToRecord(row: AnalyzedPageRow): AnalyzedPageRecord {
  return {
    id: row.id,
    siteUrl: row.site_url,
    pageUrl: row.page_url,
    primaryTopic: row.primary_topic,
    analyzedAt: row.analyzed_at,
    queries: JSON.parse(row.queries_json),
    gapReports: JSON.parse(row.gap_reports_json),
    contacts: JSON.parse(row.contacts_json),
    // Rows saved before this column existed have no source reports.
    sourceReports: row.source_reports_json ? JSON.parse(row.source_reports_json) : [],
  };
}

export async function saveRunReport(report: RunReport): Promise<number[]> {
  const sql = await getDb();

  const pagesWithData = report.pageQueries.filter(
    (pq) => pq.primaryTopic || pq.queries.length > 0
  );
  if (pagesWithData.length === 0) return [];

  const inserts = pagesWithData.map((pq) => {
    const queries: SavedQuery[] = pq.queries.map((q) => {
      const serp = report.serpResults.find((s) => s.query === q.query);
      return {
        ...q,
        verifiedRank: serp && !serp.blocked && !serp.error ? findRank(pq.pageUrl, serp.top10) : null,
        serpBlocked: !!serp?.blocked,
        serpError: serp?.error ?? null,
        aiOverview: serp?.aiOverview ?? null,
      };
    });

    const gapReports = report.gapReports.filter((g) => g.pageUrl === pq.pageUrl);
    // AiOverviewSourceReport only carries a query string, not a pageUrl, so
    // a report belongs to this page iff this page is the one that owns
    // that query (matches how gapReports are matched everywhere else).
    const sourceReports = report.sourceInsights.filter((sr) =>
      pq.queries.some((q) => q.query === sr.query)
    );

    return sql`
      INSERT INTO analyzed_pages
        (site_url, page_url, primary_topic, analyzed_at, queries_json, gap_reports_json, contacts_json, source_reports_json)
      VALUES (
        ${report.siteUrl}, ${pq.pageUrl}, ${pq.primaryTopic}, ${report.createdAt},
        ${JSON.stringify(queries)}, ${JSON.stringify(gapReports)}, ${JSON.stringify(report.contacts)},
        ${JSON.stringify(sourceReports)}
      )
      RETURNING id
    `;
  });

  // Single-round-trip transaction, mirroring the previous synchronous
  // better-sqlite3 transaction: either every page in this run is saved, or
  // none are.
  const results = (await sql.transaction(inserts)) as Array<Array<{ id: number }>>;
  return results.map((rows) => rows[0].id);
}

export async function listAnalyzedPages(search?: string): Promise<AnalyzedPageRecord[]> {
  const sql = await getDb();
  const rows = search
    ? ((await sql`
        SELECT * FROM analyzed_pages
        WHERE site_url ILIKE ${`%${search}%`}
           OR page_url ILIKE ${`%${search}%`}
           OR primary_topic ILIKE ${`%${search}%`}
        ORDER BY analyzed_at DESC
      `) as AnalyzedPageRow[])
    : ((await sql`SELECT * FROM analyzed_pages ORDER BY analyzed_at DESC`) as AnalyzedPageRow[]);

  return rows.map(rowToRecord);
}

export async function getAnalyzedPage(id: number): Promise<AnalyzedPageRecord | null> {
  const sql = await getDb();
  const rows = (await sql`SELECT * FROM analyzed_pages WHERE id = ${id}`) as AnalyzedPageRow[];
  return rows[0] ? rowToRecord(rows[0]) : null;
}

// Replaces one query's rank/AI-Overview/gap data in place — used by the
// history "check this keyword" action, which re-runs a single query (fresh
// SERP, gap analysis, and AI Overview source analysis) instead of the whole
// site, whether it's fixing a timed-out item or checking one for the first
// time.
export async function updateQueryResult(
  id: number,
  query: string,
  updatedQuery: SavedQuery,
  updatedGap: GapReport,
  updatedSourceReport: AiOverviewSourceReport | null
): Promise<void> {
  const record = await getAnalyzedPage(id);
  if (!record) throw new Error("Record not found");

  const queries = record.queries.map((q) => (q.query === query ? updatedQuery : q));
  const gapReports = record.gapReports.some((g) => g.query === query)
    ? record.gapReports.map((g) => (g.query === query ? updatedGap : g))
    : [...record.gapReports, updatedGap];

  let sourceReports = record.sourceReports;
  if (updatedSourceReport) {
    sourceReports = record.sourceReports.some((r) => r.query === query)
      ? record.sourceReports.map((r) => (r.query === query ? updatedSourceReport : r))
      : [...record.sourceReports, updatedSourceReport];
  } else {
    // No sourceReport this time (e.g. no AI Overview shown) — drop any
    // stale one from a previous check rather than leave it looking current.
    sourceReports = record.sourceReports.filter((r) => r.query !== query);
  }

  const sql = await getDb();
  await sql`
    UPDATE analyzed_pages
    SET queries_json = ${JSON.stringify(queries)},
        gap_reports_json = ${JSON.stringify(gapReports)},
        source_reports_json = ${JSON.stringify(sourceReports)}
    WHERE id = ${id}
  `;
}

export async function deleteAnalyzedPage(id: number): Promise<void> {
  const sql = await getDb();
  await sql`DELETE FROM analyzed_pages WHERE id = ${id}`;
}
