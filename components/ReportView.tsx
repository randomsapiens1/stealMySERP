import { ContentOpportunities } from "./report/ContentOpportunities";
import { OutreachOpportunities } from "./report/OutreachOpportunities";
import { PageUnderstanding } from "./report/PageUnderstanding";
import { SearchLandscape } from "./report/SearchLandscape";
import type { RunReport } from "@/lib/shared/types";

export function ReportView({ report }: { report: RunReport }) {
  return (
    <div>
      <PageUnderstanding report={report} />
      <SearchLandscape report={report} />
      <ContentOpportunities report={report} />
      <OutreachOpportunities report={report} />
    </div>
  );
}
