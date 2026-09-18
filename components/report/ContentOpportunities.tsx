import type { RunReport } from "@/lib/shared/types";
import { Section } from "./Section";

export function ContentOpportunities({ report }: { report: RunReport }) {
  return (
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
          ))}
        </div>
      )}
    </Section>
  );
}
