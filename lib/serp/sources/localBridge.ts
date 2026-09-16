import { localeForLang } from "@/lib/shared/lang";
import type { Lang, SerpResult } from "@/lib/shared/types";
import type { SerpSource } from "../types";

const DEFAULT_BRIDGE_URL = "http://localhost:8787";
// A headed browser + a possible manual CAPTCHA solve can take a while —
// give this much more room than the direct-fetch source needs.
const BRIDGE_TIMEOUT_MS = 210_000;

/**
 * Delegates to a locally-running Python/Playwright crawler (see
 * crawler-service/) that drives a real, visible Chrome browser from your
 * own machine. Meant for local personal use only — it's pointless on a
 * deployed serverless function since there's no browser window to show.
 * Enable with SERP_SOURCE=local-bridge (and optionally SERP_BRIDGE_URL).
 */
export const localBridgeSource: SerpSource = {
  name: "local-bridge",
  async fetchSerp(query: string, lang: Lang = "en"): Promise<SerpResult> {
    const { hl, gl } = localeForLang(lang);
    const bridgeUrl = process.env.SERP_BRIDGE_URL ?? DEFAULT_BRIDGE_URL;
    const base: SerpResult = { query, hl, gl, top10: [], paa: [], relatedSearches: [] };

    try {
      const res = await fetch(`${bridgeUrl}/serp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, hl, gl }),
        signal: AbortSignal.timeout(BRIDGE_TIMEOUT_MS),
      });

      if (!res.ok) {
        return { ...base, error: `Crawler bridge responded with status ${res.status}` };
      }

      const data = (await res.json()) as Partial<SerpResult>;
      return { ...base, ...data };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return {
        ...base,
        error: `Couldn't reach the local crawler bridge at ${bridgeUrl} (${detail}). Is crawler-service/server.py running?`,
      };
    }
  },
};
