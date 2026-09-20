import type { ReactNode } from "react";
import { FileIcon, GlobeIcon, SearchIcon } from "@/components/history/icons";

export type Mode = "full" | "quick" | "content";

export interface ModeDef {
  id: Mode;
  label: string;
  description: string;
  icon: ReactNode;
  buttonLabel: string;
}

export const MODES: ModeDef[] = [
  {
    id: "full",
    label: "Full analysis",
    description:
      "Crawl your site, infer queries, check real Google results, find content gaps and outreach contacts.",
    icon: <GlobeIcon />,
    buttonLabel: "Start full analysis",
  },
  {
    id: "quick",
    label: "Get queries",
    description:
      "Infer ~10 likely search queries (English + Bangla) for one link and pull real Google People Also Ask questions.",
    icon: <SearchIcon />,
    buttonLabel: "Get queries",
  },
  {
    id: "content",
    label: "Analyze content",
    description:
      "Just read the page and summarize what it covers — no Google calls, the fastest option.",
    icon: <FileIcon />,
    buttonLabel: "Analyze content",
  },
];

export function modeHref(mode: Mode, url: string, maxPages: number): string {
  const trimmed = url.trim();
  if (mode === "full") {
    return `/analyze?${new URLSearchParams({ url: trimmed, maxPages: String(maxPages) }).toString()}`;
  }
  if (mode === "quick") {
    return `/quick-check?${new URLSearchParams({ url: trimmed }).toString()}`;
  }
  return `/content-summary?${new URLSearchParams({ url: trimmed }).toString()}`;
}
