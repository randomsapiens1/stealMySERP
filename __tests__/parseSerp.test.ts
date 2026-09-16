import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { looksBlocked, parseSerpHtml } from "@/lib/serp/parseSerp";

const FIXTURES_DIR = join(process.cwd(), "lib/serp/__fixtures__");

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), "utf-8");
}

describe("parseSerpHtml", () => {
  it("extracts organic results, excluding ads, from a results page", () => {
    const html = loadFixture("serp-synthetic.html");
    const parsed = parseSerpHtml(html);

    expect(parsed.blocked).toBe(false);
    expect(parsed.top10).toHaveLength(3);
    expect(parsed.top10.map((r) => r.url)).not.toContain(
      "https://example-ad.com/shoes"
    );
    expect(parsed.top10[0]).toMatchObject({
      position: 1,
      title: "Best Running Shoes for Beginners in 2026",
      url: "https://example-competitor-1.com/best-running-shoes",
    });
    expect(parsed.top10[0].snippet.length).toBeGreaterThan(0);
  });

  it("extracts People Also Ask questions", () => {
    const html = loadFixture("serp-synthetic.html");
    const parsed = parseSerpHtml(html);

    expect(parsed.paa).toContain("How do I know my running shoe size?");
    expect(parsed.paa.length).toBeGreaterThanOrEqual(3);
  });

  it("extracts related searches", () => {
    const html = loadFixture("serp-synthetic.html");
    const parsed = parseSerpHtml(html);

    expect(parsed.relatedSearches).toContain(
      "cheap running shoes for beginners"
    );
  });

  it("detects a real captured Google JS-challenge/block page", () => {
    const html = loadFixture("serp-blocked-real.html");
    expect(looksBlocked(html)).toBe(true);

    const parsed = parseSerpHtml(html);
    expect(parsed.blocked).toBe(true);
    expect(parsed.top10).toHaveLength(0);
  });
});
