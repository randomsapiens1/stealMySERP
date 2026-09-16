import { fetchWithTimeout } from "@/lib/shared/fetchWithTimeout";
import { localeForLang } from "@/lib/shared/lang";
import type { Lang, SerpResult } from "@/lib/shared/types";
import { looksBlocked, parseSerpHtml } from "./parseSerp";

function buildSearchUrl(query: string, hl: string, gl: string): string {
  const params = new URLSearchParams({
    q: query,
    num: "10",
    hl,
    gl,
    pws: "0",
  });
  return `https://www.google.com/search?${params.toString()}`;
}

export async function fetchSerp(
  query: string,
  lang: Lang = "en"
): Promise<SerpResult> {
  const { hl, gl } = localeForLang(lang);
  const url = buildSearchUrl(query, hl, gl);
  const base: SerpResult = {
    query,
    hl,
    gl,
    top10: [],
    paa: [],
    relatedSearches: [],
  };

  try {
    const res = await fetchWithTimeout(url, {
      timeoutMs: 8000,
      headers: {
        "Accept-Language": `${hl};q=0.9`,
        Cookie: "CONSENT=YES+1",
      },
    });

    if (!res.ok) {
      return { ...base, error: `Google responded with status ${res.status}` };
    }

    const html = await res.text();
    if (looksBlocked(html)) {
      return {
        ...base,
        blocked: true,
        error:
          "Google blocked or challenged this request (rate-limited/JS-check). Try again later.",
      };
    }

    const parsed = parseSerpHtml(html);
    return {
      ...base,
      top10: parsed.top10,
      paa: parsed.paa,
      relatedSearches: parsed.relatedSearches,
    };
  } catch (err) {
    return {
      ...base,
      error: err instanceof Error ? err.message : "Failed to fetch SERP",
    };
  }
}
