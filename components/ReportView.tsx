import type { ReactNode } from "react";
import { domainOf } from "@/lib/shared/chunk";
import { brandFromDomain, classifySource, findRank } from "@/lib/shared/serpInsights";
import type { RunReport, SerpResult } from "@/lib/shared/types";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      {children}
    </section>
  );
}

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

export function ReportView({ report }: { report: RunReport }) {
  const ownDomain = domainOf(report.siteUrl) ?? "";
  const ownBrand = brandFromDomain(ownDomain);

  const findSerpForQuery = (query: string): SerpResult | undefined =>
    report.serpResults.find((s) => s.query === query);

  const pagesWithInsight = report.pageQueries.filter(
    (pq) => pq.primaryTopic || pq.queries.length > 0
  );

  return (
    <div>
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
                  {pathOf(pq.pageUrl)}
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

      <Section title="Content Opportunities">
        {report.gapReports.length === 0 ? (
          <p className="text-sm text-gray-500">No gap analysis available.</p>
        ) : (
          <div className="space-y-4">
            {report.gapReports.map((gap) => (
              <div
                key={`${gap.pageUrl}-${gap.query}`}
                className="border border-gray-200 dark:border-gray-800 rounded-md p-4"
              >
                <div className="text-sm font-medium mb-1">&quot;{gap.query}&quot;</div>
                <div className="text-xs text-gray-500 mb-3 break-all">{gap.pageUrl}</div>
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
            ))}
          </div>
        )}
      </Section>

      <Section title="Outreach Opportunities">
        {report.contacts.length === 0 ? (
          <p className="text-sm text-gray-500">No competitor contacts found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left border-b border-gray-200 dark:border-gray-800">
                  <th className="py-2 pr-4">Domain</th>
                  <th className="py-2 pr-4">Emails</th>
                  <th className="py-2 pr-4">Contact page</th>
                  <th className="py-2 pr-4">Social</th>
                  <th className="py-2 pr-4">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {report.contacts.map((c) => (
                  <tr key={c.domain} className="border-b border-gray-100 dark:border-gray-900">
                    <td className="py-2 pr-4">{c.domain}</td>
                    <td className="py-2 pr-4">{c.emails.join(", ") || "—"}</td>
                    <td className="py-2 pr-4 break-all">{c.contactPageUrl ?? "—"}</td>
                    <td className="py-2 pr-4">{c.socialLinks.length || "—"}</td>
                    <td className="py-2 pr-4">{c.confidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
