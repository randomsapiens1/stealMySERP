import { RefreshIcon } from "@/components/history/icons";
import { domainOf } from "@/lib/shared/chunk";
import { brandFromDomain, classifySource, findRank } from "@/lib/shared/serpInsights";
import type { RunReport } from "@/lib/shared/types";
import { Section } from "./Section";

function rankLabel(rank: number | null): string {
  return rank === null ? "Not ranking" : `#${rank}`;
}

export function SearchLandscape({
  report,
  onRetrySerp,
  retryingSerp,
}: {
  report: RunReport;
  onRetrySerp?: (query: string) => void;
  retryingSerp?: Set<string>;
}) {
  const ownDomain = domainOf(report.siteUrl) ?? "";
  const ownBrand = brandFromDomain(ownDomain);

  return (
    <Section title="🧠 Search Landscape">
      {report.serpResults.length === 0 ? (
        <p className="text-sm text-gray-500">No queries were checked against Google.</p>
      ) : (
        <div className="space-y-6">
          {report.serpResults.map((serp) => {
            const owningPage = report.pageQueries.find((pq) =>
              pq.queries.some((q) => q.query === serp.query)
            );
            const yourPosition =
              serp.blocked || serp.error
                ? null
                : owningPage
                  ? findRank(owningPage.pageUrl, serp.top10)
                  : null;

            const retrying = retryingSerp?.has(serp.query) ?? false;

            return (
              <div
                key={serp.query}
                className="border border-gray-200 dark:border-gray-800 rounded-md p-4"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="text-sm font-medium">Query: {serp.query}</div>
                  {onRetrySerp && (
                    <button
                      type="button"
                      onClick={() => onRetrySerp(serp.query)}
                      disabled={retrying}
                      title="Retry this query's Google search"
                      aria-label={`Retry Google search for "${serp.query}"`}
                      className="shrink-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-40 disabled:cursor-wait"
                    >
                      <RefreshIcon className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
                    </button>
                  )}
                </div>

                {serp.blocked || serp.error ? (
                  <p className="text-sm text-red-500">{serp.error}</p>
                ) : (
                  <>
                    <div className="text-sm mb-3">
                      <span className="font-medium">Your position:</span>{" "}
                      {rankLabel(yourPosition)}
                    </div>

                    {serp.aiOverview && (
                      <div className="mb-3 rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 p-3">
                        <div className="text-sm font-medium mb-1">
                          🤖 Google AI Overview
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {serp.aiOverview.text}
                        </p>
                        {serp.aiOverview.sources.length > 0 && (
                          <p className="text-xs text-gray-500 mt-2 break-all">
                            Cited:{" "}
                            {serp.aiOverview.sources.map((url, i) => (
                              <span key={url}>
                                {i > 0 && ", "}
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="hover:underline"
                                >
                                  {url}
                                </a>
                              </span>
                            ))}
                          </p>
                        )}
                      </div>
                    )}

                    {serp.top10.length > 0 && (
                      <div className="mb-3">
                        <div className="text-sm font-medium mb-1">Top 10</div>
                        <ol className="list-decimal list-inside text-sm space-y-0.5">
                          {serp.top10.map((r) => {
                            const label = classifySource(r.url, ownDomain, ownBrand);
                            const isOwn = label === ownBrand;
                            return (
                              <li key={r.url}>
                                <span className={isOwn ? "font-semibold" : ""}>
                                  {label}
                                </span>{" "}
                                <span className="text-gray-500">
                                  —{" "}
                                  <a
                                    href={r.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="hover:underline"
                                  >
                                    {r.title}
                                  </a>
                                </span>
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    )}

                    {serp.paa.length > 0 && (
                      <div>
                        <div className="text-sm font-medium mb-1">People Also Ask</div>
                        <ul className="list-disc list-inside text-sm space-y-0.5">
                          {serp.paa.map((q) => (
                            <li key={q}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
