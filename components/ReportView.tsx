import { ContentOpportunities } from "./report/ContentOpportunities";
import { OutreachOpportunities } from "./report/OutreachOpportunities";
import { PageUnderstanding } from "./report/PageUnderstanding";
import { SearchLandscape } from "./report/SearchLandscape";
import type { RunReport } from "@/lib/shared/types";

export function ReportView({
  report,
  onRetryGap,
  retryingGaps,
  onRetrySerp,
  retryingSerp,
}: {
  report: RunReport;
  onRetryGap?: (pageUrl: string, query: string) => void;
  retryingGaps?: Set<string>;
  onRetrySerp?: (query: string) => void;
  retryingSerp?: Set<string>;
}) {
  return (
    <div>
      <PageUnderstanding report={report} />
      <SearchLandscape report={report} onRetrySerp={onRetrySerp} retryingSerp={retryingSerp} />
      <ContentOpportunities report={report} onRetryGap={onRetryGap} retryingGaps={retryingGaps} />
      <OutreachOpportunities report={report} />
    </div>
  );
}
