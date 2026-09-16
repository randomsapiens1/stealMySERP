import { domainOf } from "@/lib/shared/chunk";
import { brandFromDomain, classifySource, findRank } from "@/lib/shared/serpInsights";
import type { RunReport } from "@/lib/shared/types";
import { Section } from "./Section";

function rankLabel(rank: number | null): string {
  return rank === null ? "Not ranking" : `#${rank}`;
}

export function SearchLandscape({ report }: { report: RunReport }) {
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

            return (
              <div
                key={serp.query}
                className="border border-gray-200 dark:border-gray-800 rounded-md p-4"
              >
                <div className="text-sm font-medium mb-1">Query: {serp.query}</div>

                {serp.blocked || serp.error ? (
                  <p className="text-sm text-red-500">{serp.error}</p>
                ) : (
                  <>
                    <div className="text-sm mb-3">
                      <span className="font-medium">Your position:</span>{" "}
                      {rankLabel(yourPosition)}
                    </div>

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
                                <span className="text-gray-500">— {r.title}</span>
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
