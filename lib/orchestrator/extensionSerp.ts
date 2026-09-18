"use client";

import { localeForLang } from "@/lib/shared/lang";
import type { Lang, SerpResult } from "@/lib/shared/types";

// Extension messaging (chrome.runtime.sendMessage) is a browser-page-only
// capability — it can't run in a Next.js API route (server/Node runtime).
// This is why the extension bridge is called directly from AnalyzeClient
// instead of going through /api/analyze/serp like the other SERP sources.

const RESPONSE_TIMEOUT_MS = 60_000;

interface ChromeRuntimeLike {
  sendMessage(
    extensionId: string,
    message: unknown,
    callback: (response: unknown) => void
  ): void;
  lastError?: { message: string };
}

declare global {
  interface Window {
    chrome?: { runtime?: ChromeRuntimeLike };
  }
}

const PING_TIMEOUT_MS = 1500;

// chrome.runtime.sendMessage is exposed by Chrome on every page regardless
// of whether the target extension is installed — delivery success depends
// on the extension actually being installed AND its externally_connectable
// allowlist covering this origin, neither of which is knowable without
// actually trying. A real ping is the only reliable presence check.
export async function pingExtensionBridge(): Promise<boolean> {
  const extensionId = process.env.NEXT_PUBLIC_EXTENSION_ID;
  const runtime = typeof window !== "undefined" ? window.chrome?.runtime : undefined;
  if (!extensionId || !runtime?.sendMessage) return false;

  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(false);
    }, PING_TIMEOUT_MS);

    try {
      runtime.sendMessage(extensionId, { type: "PING" }, (response) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(!runtime.lastError && !!response && (response as { pong?: boolean }).pong === true);
      });
    } catch {
      settled = true;
      clearTimeout(timer);
      resolve(false);
    }
  });
}

export async function fetchSerpViaExtension(query: string, lang: Lang): Promise<SerpResult> {
  const { hl, gl } = localeForLang(lang);
  const base: SerpResult = {
    query,
    hl,
    gl,
    top10: [],
    paa: [],
    relatedSearches: [],
    aiOverview: null,
  };

  const extensionId = process.env.NEXT_PUBLIC_EXTENSION_ID;
  const runtime = window.chrome?.runtime;

  if (!extensionId || !runtime?.sendMessage) {
    return {
      ...base,
      error:
        "Extension bridge not available — check the StealMySERP Crawler Bridge extension is installed and NEXT_PUBLIC_EXTENSION_ID is set.",
    };
  }

  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ ...base, error: "Extension didn't respond in time." });
    }, RESPONSE_TIMEOUT_MS);

    runtime.sendMessage(extensionId, { type: "SERP_SEARCH", query, hl, gl }, (response) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (runtime.lastError) {
        resolve({ ...base, error: `Extension messaging error: ${runtime.lastError.message}` });
        return;
      }
      if (!response || typeof response !== "object") {
        resolve({ ...base, error: "Extension returned no response." });
        return;
      }
      resolve({ ...base, ...(response as Partial<SerpResult>) });
    });
  });
}
