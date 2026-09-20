import { RefreshIcon } from "@/components/history/icons";
import type { RunReport } from "@/lib/shared/types";
import { Section } from "./Section";

function gapKey(pageUrl: string, query: string): string {
  return `${pageUrl}::${query}`;
}

export function ContentOpportunities({
  report,
  onRetryGap,
  retryingGaps,
}: {
  report: RunReport;
  onRetryGap?: (pageUrl: string, query: string) => void;
  retryingGaps?: Set<string>;
}) {
  return (
    <Section title="Content Opportunities">
      {report.gapReports.length === 0 ? (
        <p className="text-sm text-gray-500">No gap analysis available.</p>
      ) : (
        <div className="space-y-4">
          {report.gapReports.map((gap) => {
            const key = gapKey(gap.pageUrl, gap.query);
            const retrying = retryingGaps?.has(key) ?? false;
            return (
              <div
                key={key}
                className="border border-gray-200 dark:border-gray-800 rounded-md p-4"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="text-sm font-medium">&quot;{gap.query}&quot;</div>
                  {onRetryGap && (
                    <button
                      type="button"
                      onClick={() => onRetryGap(gap.pageUrl, gap.query)}
                      disabled={retrying}
                      title="Retry this query's gap analysis"
                      aria-label={`Retry gap analysis for "${gap.query}"`}
                      className="shrink-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-40 disabled:cursor-wait"
                    >
                      <RefreshIcon className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
                    </button>
                  )}
                </div>
                <div className="text-xs text-gray-500 mb-3 break-all">
                  <a href={gap.pageUrl} target="_blank" rel="noreferrer" className="hover:underline">
                    {gap.pageUrl}
                  </a>
                </div>
                {gap.error ? (
                  <p className="text-sm text-red-500">{gap.error}</p>
                ) : (
                  <div className="space-y-2 text-sm">
                    {gap.contentGaps.length > 0 && (
                      <div>
                        <div className="font-medium">Content gaps</div>
                        <ul className="list-disc list-inside">
                          {gap.contentGaps.map((g, i) => (
                            <li key={i}>
                              {g.topic} — {g.whyItMatters}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {gap.missingPaaQuestions.length > 0 && (
                      <div>
                        <div className="font-medium">Unanswered PAA questions</div>
                        <ul className="list-disc list-inside">
                          {gap.missingPaaQuestions.map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {gap.recommendedNewSections.length > 0 && (
                      <div>
                        <div className="font-medium">Recommended new sections</div>
                        <ul className="list-disc list-inside">
                          {gap.recommendedNewSections.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
