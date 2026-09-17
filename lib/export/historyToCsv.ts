import type { AnalyzedPageRecord } from "@/lib/db/history";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowsToCsv(header: string[], rows: string[][]): string {
  return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}

export function historyToCsv(records: AnalyzedPageRecord[]): string {
  const rows: string[][] = [];

  for (const record of records) {
    if (record.queries.length === 0) {
      rows.push([
        record.siteUrl,
        record.pageUrl,
        record.primaryTopic,
        record.analyzedAt,
        "",
        "",
        "",
        String(record.gapReports.length),
        String(record.contacts.length),
      ]);
      continue;
    }

    for (const q of record.queries) {
      const ranking = q.serpBlocked || q.serpError ? "Unavailable" : (q.verifiedRank ?? "Not ranking");
      rows.push([
        record.siteUrl,
        record.pageUrl,
        record.primaryTopic,
        record.analyzedAt,
        q.query,
        `${Math.round(q.confidence * 100)}%`,
        String(ranking),
        String(record.gapReports.length),
        String(record.contacts.length),
      ]);
    }
  }

  return rowsToCsv(
    [
      "Site",
      "Page",
      "Primary Topic",
      "Analyzed At",
      "Query",
      "Confidence",
      "Verified Ranking",
      "Content Gaps Found",
      "Contacts Found",
    ],
    rows
  );
}
