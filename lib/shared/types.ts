export type Lang = "bn" | "en" | "und";

export interface Heading {
  level: number;
  text: string;
}

export interface PageContent {
  url: string;
  title: string;
  metaDescription: string;
  headings: Heading[];
  bodyTextExcerpt: string;
  wordCount: number;
  lang: Lang;
  fetchedAt: string;
  error?: string;
}

export interface DiscoveredPage {
  url: string;
}

export type QueryIntent =
  | "informational"
  | "transactional"
  | "navigational"
  | "commercial";

export interface InferredQuery {
  query: string;
  intent: QueryIntent;
  confidence: number;
  languageOfQuery: Lang;
}

export interface ContentSummary {
  pageUrl: string;
  primaryTopic: string;
  summary: string;
  keyPoints: string[];
  error?: string;
}

export interface PageQueries {
  pageUrl: string;
  primaryTopic: string;
  // Only set by the quick-check flow's bilingual query inference.
  bangladeshRelevant?: boolean;
  queries: InferredQuery[];
}

export interface SerpOrganicResult {
  position: number;
  title: string;
  url: string;
  snippet: string;
}

export interface AiOverview {
  text: string;
  sources: string[];
}

export interface SerpResult {
  query: string;
  hl: string;
  gl: string;
  top10: SerpOrganicResult[];
  paa: string[];
  relatedSearches: string[];
  // Only reliably populated by the extension bridge (live rendered DOM in
  // a real browser) — Google's AI Overview is JS-rendered and often
  // absent from the other two sources' output. null = not present/not
  // extracted, not necessarily "Google didn't show one."
  aiOverview: AiOverview | null;
  blocked?: boolean;
  error?: string;
}

export interface ContentGap {
  topic: string;
  whyItMatters: string;
  seenIn: string[];
}

export interface GapReport {
  query: string;
  pageUrl: string;
  coveredWell: string[];
  contentGaps: ContentGap[];
  missingPaaQuestions: string[];
  structureSuggestions: string[];
  recommendedNewSections: string[];
  error?: string;
}

export interface ContactInfo {
  domain: string;
  emails: string[];
  contactPageUrl: string | null;
  socialLinks: string[];
  confidence: "high" | "low";
}

export interface RunReport {
  siteUrl: string;
  createdAt: string;
  pages: PageContent[];
  pageQueries: PageQueries[];
  serpResults: SerpResult[];
  gapReports: GapReport[];
  contacts: ContactInfo[];
}
