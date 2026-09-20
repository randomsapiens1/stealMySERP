import { completeJson } from "./client";
import {
  inferQueriesSystemPrompt,
  inferQueriesUserPrompt,
  quickQueriesSystemPrompt,
  quickQueriesUserPrompt,
} from "./prompts";
import type { InferredQuery, PageContent, PageQueries } from "@/lib/shared/types";

interface RawResponse {
  primaryTopic: string;
  queries: InferredQuery[];
}

interface QuickRawResponse extends RawResponse {
  bangladeshRelevant: boolean;
}

export async function inferQueriesForPage(
  page: PageContent
): Promise<PageQueries> {
  if (page.error || !page.bodyTextExcerpt) {
    return { pageUrl: page.url, primaryTopic: "", queries: [] };
  }

  try {
    const result = await completeJson<RawResponse>(
      inferQueriesSystemPrompt(),
      inferQueriesUserPrompt(page)
    );
    return {
      pageUrl: page.url,
      primaryTopic: result.primaryTopic ?? "",
      queries: (result.queries ?? []).slice(0, 8),
    };
  } catch {
    return { pageUrl: page.url, primaryTopic: "", queries: [] };
  }
}

export async function inferQuickQueries(page: PageContent): Promise<PageQueries> {
  if (page.error || !page.bodyTextExcerpt) {
    return { pageUrl: page.url, primaryTopic: "", queries: [] };
  }

  try {
    const result = await completeJson<QuickRawResponse>(
      quickQueriesSystemPrompt(),
      quickQueriesUserPrompt(page)
    );
    return {
      pageUrl: page.url,
      primaryTopic: result.primaryTopic ?? "",
      bangladeshRelevant: result.bangladeshRelevant ?? false,
      queries: (result.queries ?? []).slice(0, 10),
    };
  } catch {
    return { pageUrl: page.url, primaryTopic: "", queries: [] };
  }
}
