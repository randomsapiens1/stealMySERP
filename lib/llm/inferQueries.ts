import { completeJson } from "./client";
import { inferQueriesSystemPrompt, inferQueriesUserPrompt } from "./prompts";
import type { InferredQuery, PageContent, PageQueries } from "@/lib/shared/types";

interface RawResponse {
  primaryTopic: string;
  queries: InferredQuery[];
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
      queries: (result.queries ?? []).slice(0, 3),
    };
  } catch {
    return { pageUrl: page.url, primaryTopic: "", queries: [] };
  }
}
