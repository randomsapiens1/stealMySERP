import robotsParser from "robots-parser";
import { fetchTextWithTimeout } from "@/lib/shared/fetchWithTimeout";

export interface RobotsInfo {
  isAllowed: (url: string) => boolean;
  sitemaps: string[];
}

const ALLOW_ALL: RobotsInfo = {
  isAllowed: () => true,
  sitemaps: [],
};

export async function getRobotsInfo(origin: string): Promise<RobotsInfo> {
  const robotsUrl = new URL("/robots.txt", origin).toString();
  try {
    const body = await fetchTextWithTimeout(robotsUrl, { timeoutMs: 6000 });
    const robots = robotsParser(robotsUrl, body);
    return {
      isAllowed: (url: string) => robots.isAllowed(url, "*") ?? true,
      sitemaps: robots.getSitemaps(),
    };
  } catch {
    return ALLOW_ALL;
  }
}
