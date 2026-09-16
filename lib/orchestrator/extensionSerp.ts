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

export function isExtensionBridgeConfigured(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.chrome?.runtime?.sendMessage &&
    !!process.env.NEXT_PUBLIC_EXTENSION_ID
  );
}

export async function fetchSerpViaExtension(query: string, lang: Lang): Promise<SerpResult> {
  const { hl, gl } = localeForLang(lang);
  const base: SerpResult = { query, hl, gl, top10: [], paa: [], relatedSearches: [] };

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
