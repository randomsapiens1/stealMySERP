import type { AnalyzedPageRecord } from "@/lib/db/history";

function rankLabel(q: AnalyzedPageRecord["queries"][number]): string {
  if (q.serpBlocked || q.serpError) return "Unavailable";
  return q.verifiedRank === null ? "Not ranking" : `#${q.verifiedRank}`;
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
        {title}
      </div>
      {children}
    </div>
  );
}

export function HistoryDetail({ record }: { record: AnalyzedPageRecord }) {
  return (
    <div className="p-4 pt-0 text-sm grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {record.queries.length > 0 && (
        <DetailCard title="Queries">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
                <th className="py-1 pr-3 font-medium">Query</th>
                <th className="py-1 pr-3 font-medium">Conf.</th>
                <th className="py-1 font-medium">Rank</th>
              </tr>
            </thead>
            <tbody>
              {record.queries.map((q) => (
                <tr key={q.query} className="border-b border-gray-100 dark:border-gray-900 last:border-0">
                  <td className="py-1.5 pr-3">{q.query}</td>
                  <td className="py-1.5 pr-3 text-gray-500 dark:text-gray-400 tabular-nums">
                    {Math.round(q.confidence * 100)}%
                  </td>
                  <td className="py-1.5 tabular-nums">{rankLabel(q)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DetailCard>
      )}

      {record.gapReports.length > 0 && (
        <DetailCard title="Content gaps">
          <div className="space-y-3">
            {record.gapReports.map((gap) => (
              <div key={gap.query}>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">&quot;{gap.query}&quot;</div>
                {gap.error ? (
                  <p className="text-red-500">{gap.error}</p>
                ) : (
                  <ul className="list-disc list-inside space-y-0.5">
                    {gap.contentGaps.map((g, i) => (
                      <li key={i}>
                        <span className="font-medium">{g.topic}</span>{" "}
                        <span className="text-gray-500 dark:text-gray-400">— {g.whyItMatters}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </DetailCard>
      )}

      {record.contacts.length > 0 && (
        <DetailCard title="Contacts">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
                <th className="py-1 pr-3 font-medium">Domain</th>
                <th className="py-1 pr-3 font-medium">Emails</th>
                <th className="py-1 font-medium">Conf.</th>
              </tr>
            </thead>
            <tbody>
              {record.contacts.map((c) => (
                <tr key={c.domain} className="border-b border-gray-100 dark:border-gray-900 last:border-0">
                  <td className="py-1.5 pr-3 break-all">{c.domain}</td>
                  <td className="py-1.5 pr-3 break-all">{c.emails.join(", ") || "—"}</td>
                  <td className="py-1.5">{c.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DetailCard>
      )}
    </div>
  );
}
