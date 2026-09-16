import { describe, expect, it } from "vitest";
import { getCrawler } from "@/lib/crawler";

describe("crawler registry", () => {
  it("returns the default crawler when no name is given", () => {
    const crawler = getCrawler();
    expect(crawler.name).toBe("fetch-cheerio");
    expect(typeof crawler.discover).toBe("function");
    expect(typeof crawler.extract).toBe("function");
  });

  it("returns the named crawler when requested explicitly", () => {
    const crawler = getCrawler("fetch-cheerio");
    expect(crawler.name).toBe("fetch-cheerio");
  });

  it("throws a clear error for an unregistered crawler name", () => {
    expect(() => getCrawler("headless-browser")).toThrow(/Unknown crawler/);
  });
});
