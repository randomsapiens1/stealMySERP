import type { PageContent } from "@/lib/shared/types";

function headingsToOutline(page: PageContent): string {
  return page.headings.map((h) => `${"  ".repeat(h.level - 1)}- ${h.text}`).join("\n");
}

export function inferQueriesSystemPrompt(): string {
  return `You are an SEO analyst. Given a web page's content, identify its primary topic in plain English (a short human-readable label, not a search query), and infer up to 3 search queries this page is realistically trying to rank for on Google.
If the page is in Bangla, infer queries in Bangla as a real Bangla searcher would type them, not translated English queries.
Respond with ONLY valid JSON, no prose, no markdown fences, matching this shape:
{"primaryTopic": string, "queries": [{"query": string, "intent": "informational"|"transactional"|"navigational"|"commercial", "confidence": number between 0 and 1, "languageOfQuery": "bn"|"en"}]}`;
}

export function inferQueriesUserPrompt(page: PageContent): string {
  return `URL: ${page.url}
Detected language: ${page.lang}
Title: ${page.title}
Meta description: ${page.metaDescription}
Headings:
${headingsToOutline(page)}

Body excerpt:
${page.bodyTextExcerpt.slice(0, 1500)}`;
}

export function gapAnalysisSystemPrompt(): string {
  return `You are an SEO content strategist. Compare a website's page against its top Google competitors for a target query, plus "People Also Ask" questions, related searches, and Google's AI Overview (if shown) for that query.
Identify what the page already covers well, concrete content gaps (topics/subtopics covered by competitors OR by Google's AI Overview that this page doesn't cover), which PAA questions the page fails to answer, and structure/format suggestions.
Treat the AI Overview as a strong signal of what Google considers a complete answer — if it's present, explicitly flag anything it covers that neither the page nor competitors do, tagging those gaps with "seenIn": ["Google AI Overview"]. Also note in structureSuggestions if concise, directly-answerable sections would improve the page's odds of being cited as an AI Overview source (short, direct-answer paragraphs near the top of a section tend to get cited; long unstructured prose tends not to).
Respond with ONLY valid JSON, no prose, no markdown fences, matching this shape:
{"coveredWell": string[], "contentGaps": [{"topic": string, "whyItMatters": string, "seenIn": string[]}], "missingPaaQuestions": string[], "structureSuggestions": string[], "recommendedNewSections": string[]}`;
}

export function gapAnalysisUserPrompt(params: {
  query: string;
  userPage: PageContent;
  competitors: PageContent[];
  snippetOnlyTitles: string[];
  paa: string[];
  relatedSearches: string[];
  aiOverview: { text: string; sources: string[] } | null;
}): string {
  const { query, userPage, competitors, snippetOnlyTitles, paa, relatedSearches, aiOverview } =
    params;

  const competitorBlocks = competitors
    .map(
      (c, i) => `Competitor ${i + 1} (${c.url}):
Title: ${c.title}
Headings:
${headingsToOutline(c)}
Excerpt: ${c.bodyTextExcerpt.slice(0, 1200)}`
    )
    .join("\n\n");

  return `Target query: "${query}"

Our page (${userPage.url}):
Title: ${userPage.title}
Headings:
${headingsToOutline(userPage)}
Excerpt: ${userPage.bodyTextExcerpt.slice(0, 2000)}

Top competitors (fully analyzed):
${competitorBlocks}

Other ranking pages (titles only, not fetched): ${snippetOnlyTitles.join(" | ") || "none"}

People Also Ask questions Google shows for this query:
${paa.map((q) => `- ${q}`).join("\n") || "none"}

Related searches Google shows for this query:
${relatedSearches.join(", ") || "none"}

Google's AI Overview for this query:
${aiOverview ? `${aiOverview.text}\nCited sources: ${aiOverview.sources.join(", ") || "none shown"}` : "not shown for this query"}`;
}
