import { describe, expect, it } from "vitest";
import { getSerpSource } from "@/lib/serp";

describe("serp source registry", () => {
  it("returns the default (direct-fetch) source when no name is given", () => {
    const source = getSerpSource();
    expect(source.name).toBe("direct-fetch");
    expect(typeof source.fetchSerp).toBe("function");
  });

  it("returns the local-bridge source when requested explicitly", () => {
    const source = getSerpSource("local-bridge");
    expect(source.name).toBe("local-bridge");
  });

  it("throws a clear error for an unregistered source name", () => {
    expect(() => getSerpSource("bing-scraper")).toThrow(/Unknown SERP source/);
  });

  it("local-bridge degrades gracefully when no bridge is running", async () => {
    const source = getSerpSource("local-bridge");
    const result = await source.fetchSerp("test query", "en");
    expect(result.error).toBeDefined();
    expect(result.top10).toEqual([]);
  });
});
