import { completeJson } from "@/lib/llm/client";
import { gapAnalysisSystemPrompt, gapAnalysisUserPrompt } from "@/lib/llm/prompts";
import type { GapReport, PageContent, SerpResult } from "@/lib/shared/types";

const FULLY_FETCHED_COMPETITOR_LIMIT = 5;

interface RawGapResponse {
  coveredWell: string[];
  contentGaps: GapReport["contentGaps"];
  missingPaaQuestions: string[];
  structureSuggestions: string[];
  recommendedNewSections: string[];
}

export async function analyzeGap(
  userPage: PageContent,
  serp: SerpResult,
  fullyFetchedCompetitors: PageContent[]
): Promise<GapReport> {
  const base: GapReport = {
    query: serp.query,
    pageUrl: userPage.url,
    coveredWell: [],
    contentGaps: [],
    missingPaaQuestions: [],
    structureSuggestions: [],
    recommendedNewSections: [],
  };

  if (serp.blocked || serp.error) {
    return { ...base, error: serp.error ?? "SERP data unavailable" };
  }

  const competitors = fullyFetchedCompetitors
    .filter((c) => !c.error)
    .slice(0, FULLY_FETCHED_COMPETITOR_LIMIT);
  const fetchedUrls = new Set(competitors.map((c) => c.url));
  const snippetOnlyTitles = serp.top10
    .filter((r) => !fetchedUrls.has(r.url))
    .map((r) => r.title);

  try {
    const result = await completeJson<RawGapResponse>(
      gapAnalysisSystemPrompt(),
      gapAnalysisUserPrompt({
        query: serp.query,
        userPage,
        competitors,
        snippetOnlyTitles,
        paa: serp.paa,
        relatedSearches: serp.relatedSearches,
        aiOverview: serp.aiOverview,
      })
    );

    return {
      ...base,
      coveredWell: result.coveredWell ?? [],
      contentGaps: result.contentGaps ?? [],
      missingPaaQuestions: result.missingPaaQuestions ?? [],
      structureSuggestions: result.structureSuggestions ?? [],
      recommendedNewSections: result.recommendedNewSections ?? [],
    };
  } catch (err) {
    return {
      ...base,
      error: err instanceof Error ? err.message : "Gap analysis failed",
    };
  }
}
