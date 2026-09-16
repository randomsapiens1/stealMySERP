import type { RunReport } from "@/lib/shared/types";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowsToCsv(header: string[], rows: string[][]): string {
  return [header, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");
}

export function contentGapsToCsv(report: RunReport): string {
  const rows: string[][] = [];
  for (const gap of report.gapReports) {
    if (gap.error) continue;
    for (const g of gap.contentGaps) {
      rows.push([gap.pageUrl, gap.query, g.topic, g.whyItMatters, g.seenIn.join("; ")]);
    }
  }
  return rowsToCsv(
    ["Page", "Query", "Content Gap", "Why It Matters", "Seen In"],
    rows
  );
}

export function contactsToCsv(report: RunReport): string {
  const rows = report.contacts.map((c) => [
    c.domain,
    c.emails.join("; "),
    c.contactPageUrl ?? "",
    c.socialLinks.join("; "),
    c.confidence,
  ]);
  return rowsToCsv(
    ["Domain", "Emails", "Contact Page", "Social Links", "Confidence"],
    rows
  );
}
