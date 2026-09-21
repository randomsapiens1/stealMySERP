import { completeJson } from "@/lib/llm/client";
import { aiOverviewSourcesSystemPrompt, aiOverviewSourcesUserPrompt } from "@/lib/llm/prompts";
import type { AiOverview, AiOverviewSourceInsight, AiOverviewSourceReport } from "@/lib/shared/types";

interface RawSourcesResponse {
  insights: AiOverviewSourceInsight[];
}

// Returns null when there's nothing to analyze (no AI Overview, or no
// structured source cards for it) — callers should skip this query rather
// than record an empty/errored report.
export async function analyzeAiOverviewSources(
  query: string,
  aiOverview: AiOverview | null
): Promise<AiOverviewSourceReport | null> {
  const sourceCards = aiOverview?.sourceCards ?? [];
  if (!aiOverview || sourceCards.length === 0) return null;

  const base: AiOverviewSourceReport = { query, insights: [] };

  try {
    const result = await completeJson<RawSourcesResponse>(
      aiOverviewSourcesSystemPrompt(),
      aiOverviewSourcesUserPrompt({ query, aiOverviewText: aiOverview.text, sourceCards })
    );

    const byUrl = new Map((result.insights ?? []).map((i) => [i.url, i]));
    return {
      ...base,
      insights: sourceCards.map((card) => {
        const match = byUrl.get(card.url);
        return {
          url: card.url,
          title: card.title,
          whySuggested: match?.whySuggested ?? "",
          topicDrift: match?.topicDrift ?? false,
          driftReason: match?.driftReason ?? "",
        };
      }),
    };
  } catch (err) {
    return {
      ...base,
      error: err instanceof Error ? err.message : "AI Overview source analysis failed",
    };
  }
}
