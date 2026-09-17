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

export function saveRunReport(report: RunReport): number[] {
  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO analyzed_pages
      (site_url, page_url, primary_topic, analyzed_at, queries_json, gap_reports_json, contacts_json)
    VALUES (@siteUrl, @pageUrl, @primaryTopic, @analyzedAt, @queriesJson, @gapReportsJson, @contactsJson)
  `);

  const insertedIds: number[] = [];

  const pagesWithData = report.pageQueries.filter(
    (pq) => pq.primaryTopic || pq.queries.length > 0
  );

  const runAll = db.transaction(() => {
    for (const pq of pagesWithData) {
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

      const result = insert.run({
        siteUrl: report.siteUrl,
        pageUrl: pq.pageUrl,
        primaryTopic: pq.primaryTopic,
        analyzedAt: report.createdAt,
        queriesJson: JSON.stringify(queries),
        gapReportsJson: JSON.stringify(gapReports),
        contactsJson: JSON.stringify(report.contacts),
      });
      insertedIds.push(Number(result.lastInsertRowid));
    }
  });

  runAll();
  return insertedIds;
}

export function listAnalyzedPages(search?: string): AnalyzedPageRecord[] {
  const db = getDb();
  const rows = search
    ? (db
        .prepare(
          `SELECT * FROM analyzed_pages
           WHERE site_url LIKE @needle OR page_url LIKE @needle OR primary_topic LIKE @needle
           ORDER BY analyzed_at DESC`
        )
        .all({ needle: `%${search}%` }) as AnalyzedPageRow[])
    : (db.prepare(`SELECT * FROM analyzed_pages ORDER BY analyzed_at DESC`).all() as AnalyzedPageRow[]);

  return rows.map(rowToRecord);
}

export function deleteAnalyzedPage(id: number): void {
  getDb().prepare(`DELETE FROM analyzed_pages WHERE id = ?`).run(id);
}
