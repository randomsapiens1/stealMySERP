import { describe, expect, it } from "vitest";
import { cleanAiOverviewText } from "@/lib/shared/aiOverviewText";

// Real extraction artifact reported by a user: the source-card carousel
// exists in the DOM in both its collapsed and expanded states, so the
// scraped text is the same cards twice, bracketed by the button labels.
const DUPLICATED_SOURCE_CAROUSEL =
  "Shared0 filesLaws of BangladeshThe Dowry Prohibition Act, 1980Dec 26, 1980 — The Dowry Prohibition Act of 1980 prohibits the taking or giving of dowry in marriages. The act defines dowry as any property or v...RefworldBangladesh: The Dowry Prohibition Act, 2018 - Refworldyear, or with fine not exceeding 50,000 (fifty thousand) Taka, or with both. 4. Penalty for giving or taking dowry, etc. If any p...Laws of BangladeshThe Dowry Prohibition Act, 1980 | 2.Definition - Laws of BangladeshDec 26, 1980 — ( ACT NO. XXXV OF 1980 ) ... (b) by the parents of either party to a marriage or by any other person to either party to the marria...Laws of BangladeshThe Dowry Prohibition Act, 1980Dec 26, 1980 — An Act to prohibit the taking or giving of dowry in marriages. * Short title and commencement. (1) This Act may be called the Dowr...Show lessLaws of BangladeshThe Dowry Prohibition Act, 1980Dec 26, 1980 — The Dowry Prohibition Act of 1980 prohibits the taking or giving of dowry in marriages. The act defines dowry as any property or v...RefworldBangladesh: The Dowry Prohibition Act, 2018 - Refworldyear, or with fine not exceeding 50,000 (fifty thousand) Taka, or with both. 4. Penalty for giving or taking dowry, etc. If any p...Show all";

describe("cleanAiOverviewText", () => {
  it("truncates at the first Show less/Show all marker", () => {
    const cleaned = cleanAiOverviewText(DUPLICATED_SOURCE_CAROUSEL);
    expect(cleaned).not.toContain("Show less");
    expect(cleaned).not.toContain("Show all");
    expect(cleaned.startsWith("Shared0 filesLaws of Bangladesh")).toBe(true);
  });

  it("removes duplicated content even without an expand/collapse marker", () => {
    const block =
      "PageRank is Google's algorithm for evaluating the importance and quality of web pages, based on links.";
    const cleaned = cleanAiOverviewText(block + block);
    expect(cleaned).toBe(block);
  });

  it("leaves clean prose untouched", () => {
    const prose =
      "A backlink is a hyperlink from one website to another, used as a ranking signal by search engines.";
    expect(cleanAiOverviewText(prose)).toBe(prose);
  });

  it("collapses internal whitespace", () => {
    expect(cleanAiOverviewText("Some   text\nwith   odd\nspacing")).toBe(
      "Some text with odd spacing"
    );
  });

  it("returns an empty string unchanged", () => {
    expect(cleanAiOverviewText("")).toBe("");
  });
});
