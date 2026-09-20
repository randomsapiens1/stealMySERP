import { completeJson } from "./client";
import { contentSummarySystemPrompt, contentSummaryUserPrompt } from "./prompts";
import type { ContentSummary, PageContent } from "@/lib/shared/types";

interface RawResponse {
  primaryTopic: string;
  summary: string;
  keyPoints: string[];
}

export async function summarizeContent(page: PageContent): Promise<ContentSummary> {
  if (page.error || !page.bodyTextExcerpt) {
    return { pageUrl: page.url, primaryTopic: "", summary: "", keyPoints: [] };
  }

  try {
    const result = await completeJson<RawResponse>(
      contentSummarySystemPrompt(),
      contentSummaryUserPrompt(page)
    );
    return {
      pageUrl: page.url,
      primaryTopic: result.primaryTopic ?? "",
      summary: result.summary ?? "",
      keyPoints: (result.keyPoints ?? []).slice(0, 6),
    };
  } catch (err) {
    return {
      pageUrl: page.url,
      primaryTopic: "",
      summary: "",
      keyPoints: [],
      error: err instanceof Error ? err.message : "Content summary failed",
    };
  }
}
