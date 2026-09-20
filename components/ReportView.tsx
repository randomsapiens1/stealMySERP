import { ContentOpportunities } from "./report/ContentOpportunities";
import { OutreachOpportunities } from "./report/OutreachOpportunities";
import { PageUnderstanding } from "./report/PageUnderstanding";
import { SearchLandscape } from "./report/SearchLandscape";
import type { RunReport } from "@/lib/shared/types";

export function ReportView({
  report,
  onRetryGap,
  retryingGaps,
}: {
  report: RunReport;
  onRetryGap?: (pageUrl: string, query: string) => void;
  retryingGaps?: Set<string>;
}) {
  return (
    <div>
      <PageUnderstanding report={report} />
      <SearchLandscape report={report} />
      <ContentOpportunities report={report} onRetryGap={onRetryGap} retryingGaps={retryingGaps} />
      <OutreachOpportunities report={report} />
    </div>
  );
}
