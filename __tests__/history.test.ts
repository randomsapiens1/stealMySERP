import { describe, expect, it } from "vitest";
import { saveRunReport, listAnalyzedPages, deleteAnalyzedPage } from "@/lib/db/history";
import type { RunReport } from "@/lib/shared/types";

function buildReport(): RunReport {
  return {
    siteUrl: "https://example.com",
    createdAt: "2026-09-17T00:00:00.000Z",
    pages: [],
    pageQueries: [
      {
        pageUrl: "https://example.com/page-a",
        primaryTopic: "Example topic",
        queries: [
          { query: "example query", intent: "informational", confidence: 0.9, languageOfQuery: "en" },
        ],
      },
    ],
    serpResults: [
      {
        query: "example query",
        hl: "en",
        gl: "us",
        top10: [
          { position: 1, title: "Other site", url: "https://other.com/x", snippet: "" },
          { position: 3, title: "Example page", url: "https://example.com/page-a", snippet: "" },
        ],
        paa: [],
        relatedSearches: [],
        aiOverview: null,
      },
    ],
    gapReports: [
      {
        query: "example query",
        pageUrl: "https://example.com/page-a",
        coveredWell: [],
        contentGaps: [{ topic: "Missing FAQ", whyItMatters: "Users ask about it", seenIn: ["other.com"] }],
        missingPaaQuestions: [],
        structureSuggestions: [],
        recommendedNewSections: [],
      },
    ],
    sourceInsights: [],
    contacts: [
      { domain: "other.com", emails: ["hi@other.com"], contactPageUrl: null, socialLinks: [], confidence: "high" },
    ],
  };
}

// These hit the real (Neon) database configured via DATABASE_URL — skip
// cleanly in any environment where it isn't set rather than hard-failing.
describe.skipIf(!process.env.DATABASE_URL)("history persistence", () => {
  it("saves a run and computes verified rank against the SERP results", async () => {
    const ids = await saveRunReport(buildReport());
    expect(ids).toHaveLength(1);

    const pages = await listAnalyzedPages("Example topic");
    const saved = pages.find((p) => p.id === ids[0]);
    expect(saved).toBeDefined();
    expect(saved?.pageUrl).toBe("https://example.com/page-a");
    expect(saved?.primaryTopic).toBe("Example topic");
    expect(saved?.queries[0].verifiedRank).toBe(3);
    expect(saved?.gapReports[0].contentGaps[0].topic).toBe("Missing FAQ");
    expect(saved?.contacts[0].domain).toBe("other.com");

    await deleteAnalyzedPage(ids[0]);
  });

  it("filters by search term across site/page/topic", async () => {
    const ids = await saveRunReport(buildReport());
    try {
      expect(await listAnalyzedPages("Example topic")).toHaveLength(1);
      expect(await listAnalyzedPages("nonexistent-search-term")).toHaveLength(0);
    } finally {
      await deleteAnalyzedPage(ids[0]);
    }
  });

  it("deletes a saved page", async () => {
    const [id] = await saveRunReport(buildReport());
    await deleteAnalyzedPage(id);
    const pages = await listAnalyzedPages("Example topic");
    expect(pages.find((p) => p.id === id)).toBeUndefined();
  });
});
