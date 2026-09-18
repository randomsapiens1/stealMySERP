import { getDb } from "./client";
import { findRank } from "@/lib/shared/serpInsights";
import type { ContactInfo, GapReport, InferredQuery, RunReport } from "@/lib/shared/types";

export interface SavedQuery extends InferredQuery {
  verifiedRank: number | null;
  serpBlocked: boolean;
  serpError: string | null;
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
      };
    });

    const gapReports = report.gapReports.filter((g) => g.pageUrl === pq.pageUrl);

    return sql`
      INSERT INTO analyzed_pages
        (site_url, page_url, primary_topic, analyzed_at, queries_json, gap_reports_json, contacts_json)
      VALUES (
        ${report.siteUrl}, ${pq.pageUrl}, ${pq.primaryTopic}, ${report.createdAt},
        ${JSON.stringify(queries)}, ${JSON.stringify(gapReports)}, ${JSON.stringify(report.contacts)}
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

export async function deleteAnalyzedPage(id: number): Promise<void> {
  const sql = await getDb();
  await sql`DELETE FROM analyzed_pages WHERE id = ${id}`;
}
