import * as cheerio from "cheerio";
import { fetchTextWithTimeout } from "@/lib/shared/fetchWithTimeout";
import { detectLang } from "@/lib/shared/lang";
import type { Heading, PageContent } from "@/lib/shared/types";

const BODY_EXCERPT_LENGTH = 3000;
const REMOVE_SELECTORS = "script, style, noscript, nav, header, footer, svg";

export async function extractPage(url: string): Promise<PageContent> {
  const base: PageContent = {
    url,
    title: "",
    metaDescription: "",
    headings: [],
    bodyTextExcerpt: "",
    wordCount: 0,
    lang: "und",
    fetchedAt: new Date().toISOString(),
  };

  try {
    const html = await fetchTextWithTimeout(url, { timeoutMs: 9000 });
    const $ = cheerio.load(html);

    const title = $("title").first().text().trim();
    const metaDescription =
      $('meta[name="description"]').attr("content")?.trim() ?? "";

    const headings: Heading[] = [];
    $("h1, h2, h3").each((_, el) => {
      const level = Number(el.tagName.slice(1));
      const text = $(el).text().trim().replace(/\s+/g, " ");
      if (text) headings.push({ level, text });
    });

    $(REMOVE_SELECTORS).remove();
    const contentRoot = $("main").length
      ? $("main")
      : $("article").length
        ? $("article")
        : $("body");
    const bodyText = contentRoot.text().replace(/\s+/g, " ").trim();

    return {
      ...base,
      title,
      metaDescription,
      headings,
      bodyTextExcerpt: bodyText.slice(0, BODY_EXCERPT_LENGTH),
      wordCount: bodyText.split(/\s+/).filter(Boolean).length,
      lang: detectLang(bodyText || title),
    };
  } catch (err) {
    return {
      ...base,
      error: err instanceof Error ? err.message : "Failed to fetch page",
    };
  }
}
