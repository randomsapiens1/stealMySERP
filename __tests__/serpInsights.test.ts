import { describe, expect, it } from "vitest";
import { brandFromDomain, classifySource, findRank } from "@/lib/shared/serpInsights";
import type { SerpOrganicResult } from "@/lib/shared/types";

const top10: SerpOrganicResult[] = [
  { position: 1, title: "Gov result", url: "https://bdris.gov.bd/death-certificate", snippet: "" },
  { position: 2, title: "News guide", url: "https://www.thedailystar.net/how-to-guide", snippet: "" },
  { position: 7, title: "Our page", url: "https://www.docket.bd/services/death-certificate-bangladesh/", snippet: "" },
  { position: 9, title: "Competitor", url: "https://other-legal-site.com/guide", snippet: "" },
];

describe("findRank", () => {
  it("finds the matching page's rank ignoring protocol/www/trailing slash", () => {
    const rank = findRank(
      "http://docket.bd/services/death-certificate-bangladesh",
      top10
    );
    expect(rank).toBe(7);
  });

  it("returns null when the page isn't in the results", () => {
    const rank = findRank("https://docket.bd/not-ranking-page", top10);
    expect(rank).toBeNull();
  });
});

describe("classifySource", () => {
  it("labels the site's own domain with its brand", () => {
    expect(classifySource("https://www.docket.bd/services/x", "docket.bd", "Docket")).toBe(
      "Docket"
    );
  });

  it("labels government domains", () => {
    expect(
      classifySource("https://bdris.gov.bd/death-certificate", "docket.bd", "Docket")
    ).toBe("Government site");
  });

  it("labels known news-style domains", () => {
    expect(
      classifySource("https://www.thedailystar.net/how-to-guide", "docket.bd", "Docket")
    ).toBe("News/guide");
  });

  it("falls back to Competitor for everything else", () => {
    expect(
      classifySource("https://other-legal-site.com/guide", "docket.bd", "Docket")
    ).toBe("Competitor");
  });
});

describe("brandFromDomain", () => {
  it("title-cases the second-level domain label", () => {
    expect(brandFromDomain("docket.bd")).toBe("Docket");
  });
});
