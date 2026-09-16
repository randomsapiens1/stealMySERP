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
    // Point at a port nothing binds to, rather than the real default
    // (localhost:8787) — if the actual crawler-service happens to be
    // running locally (as intended, when someone's using the feature),
    // this test would otherwise hang waiting on a real, slow response
    // instead of testing the fast-fail path.
    const original = process.env.SERP_BRIDGE_URL;
    process.env.SERP_BRIDGE_URL = "http://127.0.0.1:1";
    try {
      const source = getSerpSource("local-bridge");
      const result = await source.fetchSerp("test query", "en");
      expect(result.error).toBeDefined();
      expect(result.top10).toEqual([]);
    } finally {
      process.env.SERP_BRIDGE_URL = original;
    }
  });
});
