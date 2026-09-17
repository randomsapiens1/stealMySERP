import type { AnalyzedPageRecord } from "@/lib/db/history";

function rankLabel(q: AnalyzedPageRecord["queries"][number]): string {
  if (q.serpBlocked || q.serpError) return "Unavailable";
  return q.verifiedRank === null ? "Not ranking" : `#${q.verifiedRank}`;
}

export function HistoryDetail({ record }: { record: AnalyzedPageRecord }) {
  return (
    <div className="border-t border-gray-200 dark:border-gray-800 p-4 text-sm space-y-4 bg-gray-50 dark:bg-gray-950">
      {record.queries.length > 0 && (
        <div>
          <div className="font-medium mb-1">Queries</div>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-gray-200 dark:border-gray-800">
                <th className="py-1 pr-4">Query</th>
                <th className="py-1 pr-4">Confidence</th>
                <th className="py-1 pr-4">Verified ranking</th>
              </tr>
            </thead>
            <tbody>
              {record.queries.map((q) => (
                <tr key={q.query} className="border-b border-gray-100 dark:border-gray-900">
                  <td className="py-1 pr-4">{q.query}</td>
                  <td className="py-1 pr-4">{Math.round(q.confidence * 100)}%</td>
                  <td className="py-1 pr-4">{rankLabel(q)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {record.gapReports.length > 0 && (
        <div>
          <div className="font-medium mb-1">Content gaps</div>
          <div className="space-y-2">
            {record.gapReports.map((gap) => (
              <div key={gap.query}>
                <div className="text-xs text-gray-500 mb-1">&quot;{gap.query}&quot;</div>
                {gap.error ? (
                  <p className="text-red-500">{gap.error}</p>
                ) : (
                  <ul className="list-disc list-inside">
                    {gap.contentGaps.map((g, i) => (
                      <li key={i}>
                        {g.topic} — {g.whyItMatters}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {record.contacts.length > 0 && (
        <div>
          <div className="font-medium mb-1">Contacts</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left border-b border-gray-200 dark:border-gray-800">
                  <th className="py-1 pr-4">Domain</th>
                  <th className="py-1 pr-4">Emails</th>
                  <th className="py-1 pr-4">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {record.contacts.map((c) => (
                  <tr key={c.domain} className="border-b border-gray-100 dark:border-gray-900">
                    <td className="py-1 pr-4">{c.domain}</td>
                    <td className="py-1 pr-4">{c.emails.join(", ") || "—"}</td>
                    <td className="py-1 pr-4">{c.confidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
