import { NextRequest, NextResponse } from "next/server";
import { inferQueriesForPage } from "@/lib/llm/inferQueries";
import type { PageContent } from "@/lib/shared/types";

export const runtime = "nodejs";
// Up to 5 pages processed sequentially, each with its own completeJson
// call — generous headroom for OpenRouter's free-tier latency (Vercel now
// allows up to 300s/function on all plans).
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  const { pages } = await req.json();

  if (!Array.isArray(pages) || pages.length === 0) {
    return NextResponse.json({ error: "pages[] is required" }, { status: 400 });
  }

  const pageQueries = [];
  for (const page of pages as PageContent[]) {
    pageQueries.push(await inferQueriesForPage(page));
  }

  return NextResponse.json({ pageQueries });
}
