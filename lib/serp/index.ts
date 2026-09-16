import { directFetchSource } from "./sources/directFetch";
import { localBridgeSource } from "./sources/localBridge";
import type { SerpSource } from "./types";

const SOURCES: Record<string, SerpSource> = {
  [directFetchSource.name]: directFetchSource,
  [localBridgeSource.name]: localBridgeSource,
};

const DEFAULT_SOURCE = directFetchSource.name;

/**
 * Central place API routes get a SERP source from. Set SERP_SOURCE=
 * local-bridge (env var, e.g. in .env.local) to route through the local
 * Python/Playwright crawler instead of the built-in direct-fetch scraper.
 */
export function getSerpSource(name?: string): SerpSource {
  const key = name ?? process.env.SERP_SOURCE ?? DEFAULT_SOURCE;
  const source = SOURCES[key];
  if (!source) {
    throw new Error(
      `Unknown SERP source "${key}". Available: ${Object.keys(SOURCES).join(", ")}`
    );
  }
  return source;
}

export type { SerpSource } from "./types";
