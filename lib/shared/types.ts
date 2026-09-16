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

export interface PageQueries {
  pageUrl: string;
  primaryTopic: string;
  queries: InferredQuery[];
}

export interface SerpOrganicResult {
  position: number;
  title: string;
  url: string;
  snippet: string;
}

export interface SerpResult {
  query: string;
  hl: string;
  gl: string;
  top10: SerpOrganicResult[];
  paa: string[];
  relatedSearches: string[];
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
