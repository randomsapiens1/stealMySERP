import { findRank } from "@/lib/shared/serpInsights";
import type { RunReport, SerpResult } from "@/lib/shared/types";
import { Section } from "./Section";

function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "" ? "/" : u.pathname;
  } catch {
    return url;
  }
}

function rankLabel(rank: number | null): string {
  return rank === null ? "Not ranking" : `#${rank}`;
}

export function PageUnderstanding({ report }: { report: RunReport }) {
  const findSerpForQuery = (query: string): SerpResult | undefined =>
    report.serpResults.find((s) => s.query === query);

  const pagesWithInsight = report.pageQueries.filter(
    (pq) => pq.primaryTopic || pq.queries.length > 0
  );

  return (
    <Section title="🔎 Page Understanding">
      {pagesWithInsight.length === 0 ? (
        <p className="text-sm text-gray-500">No pages could be analyzed.</p>
      ) : (
        <div className="space-y-4">
          {pagesWithInsight.map((pq) => (
            <div
              key={pq.pageUrl}
              className="border border-gray-200 dark:border-gray-800 rounded-md p-4"
            >
              <div className="text-sm font-mono text-gray-500 mb-1 break-all">
                <a
                  href={pq.pageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  {pathOf(pq.pageUrl)}
                </a>
              </div>
              <div className="text-sm mb-3">
                <span className="font-medium">Primary topic:</span>{" "}
                {pq.primaryTopic || "—"}
              </div>

              {pq.queries.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-left border-b border-gray-200 dark:border-gray-800">
                        <th className="py-1.5 pr-4">Likely query (AI inference)</th>
                        <th className="py-1.5 pr-4">Confidence</th>
                        <th className="py-1.5 pr-4">Verified ranking (real SERP)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pq.queries.map((q) => {
                        const serp = findSerpForQuery(q.query);
                        const ranking = !serp
                          ? "—"
                          : serp.blocked || serp.error
                            ? "Unavailable"
                            : rankLabel(findRank(pq.pageUrl, serp.top10));
                        return (
                          <tr
                            key={q.query}
                            className="border-b border-gray-100 dark:border-gray-900"
                          >
                            <td className="py-1.5 pr-4">{q.query}</td>
                            <td className="py-1.5 pr-4">
                              {Math.round(q.confidence * 100)}%
                            </td>
                            <td className="py-1.5 pr-4">{ranking}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
