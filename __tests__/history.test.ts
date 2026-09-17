import { beforeAll, describe, expect, it } from "vitest";

process.env.STEALMYSERP_DB_PATH = ":memory:";

const { saveRunReport, listAnalyzedPages, deleteAnalyzedPage } = await import(
  "@/lib/db/history"
);
const { getDb } = await import("@/lib/db/client");

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
    contacts: [
      { domain: "other.com", emails: ["hi@other.com"], contactPageUrl: null, socialLinks: [], confidence: "high" },
    ],
  };
}

beforeAll(() => {
  // Force a fresh in-memory db for this test file.
  getDb();
});

describe("history persistence", () => {
  it("saves a run and computes verified rank against the SERP results", () => {
    const ids = saveRunReport(buildReport());
    expect(ids).toHaveLength(1);

    const pages = listAnalyzedPages();
    expect(pages).toHaveLength(1);
    expect(pages[0].pageUrl).toBe("https://example.com/page-a");
    expect(pages[0].primaryTopic).toBe("Example topic");
    expect(pages[0].queries[0].verifiedRank).toBe(3);
    expect(pages[0].gapReports[0].contentGaps[0].topic).toBe("Missing FAQ");
    expect(pages[0].contacts[0].domain).toBe("other.com");
  });

  it("filters by search term across site/page/topic", () => {
    expect(listAnalyzedPages("Example topic")).toHaveLength(1);
    expect(listAnalyzedPages("nonexistent")).toHaveLength(0);
  });

  it("deletes a saved page", () => {
    const [{ id }] = listAnalyzedPages();
    deleteAnalyzedPage(id);
    expect(listAnalyzedPages()).toHaveLength(0);
  });
});
