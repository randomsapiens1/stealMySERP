import { domainOf } from "@/lib/shared/chunk";
import { brandFromDomain, classifySource, findRank } from "@/lib/shared/serpInsights";
import type { RunReport } from "@/lib/shared/types";

function rankLabel(rank: number | null): string {
  return rank === null ? "Not ranking" : `#${rank}`;
}

export function toMarkdown(report: RunReport): string {
  const lines: string[] = [];
  const ownDomain = domainOf(report.siteUrl) ?? "";
  const ownBrand = brandFromDomain(ownDomain);

  lines.push(`# SEO Research Report: ${report.siteUrl}`);
  lines.push(`Generated: ${report.createdAt}\n`);

  lines.push("## 🔎 Page Understanding\n");
  for (const pq of report.pageQueries) {
    if (!pq.primaryTopic && pq.queries.length === 0) continue;
    lines.push(`### ${pq.pageUrl}`);
    if (pq.primaryTopic) lines.push(`**Primary topic:** ${pq.primaryTopic}\n`);
    if (pq.queries.length) {
      lines.push("| Likely query (AI inference) | Confidence | Verified ranking (real SERP) |");
      lines.push("|---|---|---|");
      for (const q of pq.queries) {
        const serp = report.serpResults.find((s) => s.query === q.query);
        const ranking = !serp
          ? "—"
          : serp.blocked || serp.error
            ? "Unavailable"
            : rankLabel(findRank(pq.pageUrl, serp.top10));
        lines.push(`| ${q.query} | ${Math.round(q.confidence * 100)}% | ${ranking} |`);
      }
    }
    lines.push("");
  }

  lines.push("## 🧠 Search Landscape\n");
  for (const serp of report.serpResults) {
    lines.push(`### Query: ${serp.query}`);
    if (serp.blocked || serp.error) {
      lines.push(`_Unavailable: ${serp.error}_\n`);
      continue;
    }
    const owningPage = report.pageQueries.find((pq) =>
      pq.queries.some((q) => q.query === serp.query)
    );
    const yourPosition = owningPage ? findRank(owningPage.pageUrl, serp.top10) : null;
    lines.push(`**Your position:** ${rankLabel(yourPosition)}\n`);

    if (serp.aiOverview) {
      lines.push(`**Google AI Overview:** ${serp.aiOverview.text}`);
      const sourceReport = report.sourceInsights.find((r) => r.query === serp.query);
      if (sourceReport && sourceReport.insights.length) {
        lines.push(`_Cited sources — why cited & fan-out check:_`);
        for (const insight of sourceReport.insights) {
          const drift = insight.topicDrift ? ` (fanned out: ${insight.driftReason})` : "";
          lines.push(`- ${insight.title || insight.url} — ${insight.whySuggested}${drift}`);
        }
      } else if (serp.aiOverview.sourceCards?.length) {
        lines.push(
          `_Cited: ${serp.aiOverview.sourceCards.map((c) => c.title || c.url).join(", ")}_`
        );
      } else if (serp.aiOverview.sources.length) {
        lines.push(`_Cited: ${serp.aiOverview.sources.join(", ")}_`);
      }
      lines.push("");
    }

    if (serp.top10.length) {
      lines.push("**Top 10:**");
      for (const r of serp.top10) {
        lines.push(`${r.position}. ${classifySource(r.url, ownDomain, ownBrand)} — ${r.title}`);
      }
      lines.push("");
    }

    if (serp.paa.length) {
      lines.push("**People Also Ask:**");
      for (const q of serp.paa) lines.push(`- ${q}`);
      lines.push("");
    }
  }

  lines.push("## Content Opportunities\n");
  for (const gap of report.gapReports) {
    lines.push(`### "${gap.query}" — ${gap.pageUrl}`);
    if (gap.error) {
      lines.push(`_Unavailable: ${gap.error}_\n`);
      continue;
    }
    if (gap.coveredWell.length) {
      lines.push(`**Covered well:** ${gap.coveredWell.join(", ")}`);
    }
    if (gap.contentGaps.length) {
      lines.push(`**Content gaps:**`);
      for (const g of gap.contentGaps) {
        lines.push(`- ${g.topic} — ${g.whyItMatters} (seen in: ${g.seenIn.join(", ")})`);
      }
    }
    if (gap.missingPaaQuestions.length) {
      lines.push(`**Unanswered PAA questions:** ${gap.missingPaaQuestions.join("; ")}`);
    }
    if (gap.structureSuggestions.length) {
      lines.push(`**Structure suggestions:** ${gap.structureSuggestions.join("; ")}`);
    }
    if (gap.recommendedNewSections.length) {
      lines.push(`**Recommended new sections:** ${gap.recommendedNewSections.join("; ")}`);
    }
    lines.push("");
  }

  lines.push("## Outreach Opportunities\n");
  lines.push("| Domain | Emails | Contact page | Social | Confidence |");
  lines.push("|---|---|---|---|---|");
  for (const c of report.contacts) {
    lines.push(
      `| ${c.domain} | ${c.emails.join(", ") || "-"} | ${c.contactPageUrl ?? "-"} | ${c.socialLinks.join(", ") || "-"} | ${c.confidence} |`
    );
  }

  return lines.join("\n");
}
