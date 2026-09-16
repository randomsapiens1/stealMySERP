import * as cheerio from "cheerio";
import { fetchTextWithTimeout } from "@/lib/shared/fetchWithTimeout";
import type { ContactInfo } from "@/lib/shared/types";

const CANDIDATE_PATHS = ["/", "/contact", "/contact-us", "/about", "/about-us"];
const MAX_PAGES_PER_DOMAIN = 3;

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const IGNORED_EMAIL_DOMAINS =
  /(example\.com|sentry\.io|wixpress\.com|godaddy\.com|schema\.org|w3\.org)$/i;
const IMAGE_LIKE_EMAIL = /\.(png|jpg|jpeg|gif|svg|webp)$/i;

const SOCIAL_HOST_PATTERNS = [
  /(^|\.)facebook\.com$/,
  /(^|\.)(twitter|x)\.com$/,
  /(^|\.)linkedin\.com$/,
  /(^|\.)instagram\.com$/,
];

function isRealEmail(email: string): boolean {
  const domain = email.split("@")[1] ?? "";
  if (IGNORED_EMAIL_DOMAINS.test(domain) || IMAGE_LIKE_EMAIL.test(email)) return false;

  // Filters out JS/CSS library version strings embedded in page source
  // that happen to match the email regex, e.g. "slick-carousel@1.8.1",
  // "bootstrap@4.6.0", "wght@300..900" — real domains end in an
  // alphabetic TLD and have no empty labels between dots.
  const labels = domain.split(".");
  const tld = labels[labels.length - 1] ?? "";
  if (!/^[a-z]{2,}$/i.test(tld)) return false;
  if (labels.some((label) => label.length === 0)) return false;

  return true;
}

function extractEmails(
  $: cheerio.CheerioAPI,
  html: string
): { emails: Set<string>; viaMailto: boolean } {
  const emails = new Set<string>();
  let viaMailto = false;

  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const email = href.replace("mailto:", "").split("?")[0].trim();
    if (email && isRealEmail(email)) {
      emails.add(email.toLowerCase());
      viaMailto = true;
    }
  });

  const textMatches = html.match(EMAIL_RE) ?? [];
  for (const match of textMatches) {
    if (isRealEmail(match)) emails.add(match.toLowerCase());
  }

  return { emails, viaMailto };
}

function extractSocialLinks($: cheerio.CheerioAPI): Set<string> {
  const links = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const url = new URL(href, "https://placeholder.invalid");
      const isSocial = SOCIAL_HOST_PATTERNS.some((re) => re.test(url.hostname));
      const isShareIntent = /\/(sharer|share|intent)/.test(url.pathname);
      if (isSocial && !isShareIntent) {
        links.add(url.toString().replace("https://placeholder.invalid", ""));
      }
    } catch {
      // ignore malformed hrefs
    }
  });

  return links;
}

function findContactLikeLinks($: cheerio.CheerioAPI, origin: string): string[] {
  const found: string[] = [];
  $("a[href]").each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    const href = $(el).attr("href");
    if (!href) return;
    if (/contact|about/i.test(text)) {
      try {
        found.push(new URL(href, origin).toString());
      } catch {
        // ignore malformed hrefs
      }
    }
  });
  return found;
}

export async function findContactsForDomain(domain: string): Promise<ContactInfo> {
  const origin = `https://${domain}`;
  const emails = new Set<string>();
  const social = new Set<string>();
  let contactPageUrl: string | null = null;
  let highConfidence = false;
  let pagesFetched = 0;
  const visited = new Set<string>();
  const toVisit = CANDIDATE_PATHS.map((p) => new URL(p, origin).toString());

  for (const url of toVisit) {
    if (pagesFetched >= MAX_PAGES_PER_DOMAIN || visited.has(url)) continue;
    visited.add(url);

    try {
      const html = await fetchTextWithTimeout(url, { timeoutMs: 7000 });
      pagesFetched++;
      const $ = cheerio.load(html);
      const isContactLikePage = /contact|about/i.test(url);

      const { emails: pageEmails, viaMailto } = extractEmails($, html);
      for (const e of pageEmails) emails.add(e);
      for (const s of extractSocialLinks($)) social.add(s);

      if (viaMailto || (isContactLikePage && pageEmails.size > 0)) {
        highConfidence = true;
      }
      if (isContactLikePage && pageEmails.size > 0 && !contactPageUrl) {
        contactPageUrl = url;
      }

      if (url === origin) {
        for (const link of findContactLikeLinks($, origin)) {
          if (!visited.has(link) && !toVisit.includes(link)) {
            toVisit.push(link);
          }
        }
      }
    } catch {
      // page fetch failed, move on
    }
  }

  return {
    domain,
    emails: Array.from(emails),
    contactPageUrl,
    socialLinks: Array.from(social),
    confidence: highConfidence ? "high" : "low",
  };
}
