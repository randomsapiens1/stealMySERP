import { NextRequest, NextResponse } from "next/server";
import { analyzeGap } from "@/lib/analysis/gapAnalysis";
import type { PageContent, SerpResult } from "@/lib/shared/types";

export const runtime = "nodejs";
// One completeJson call per invocation — generous headroom for OpenRouter's
// free-tier latency (Vercel now allows up to 300s/function on all plans).
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  const { userPage, serp, competitors } = await req.json();

  if (!userPage || !serp) {
    return NextResponse.json(
      { error: "userPage and serp are required" },
      { status: 400 }
    );
  }

  const gapReport = await analyzeGap(
    userPage as PageContent,
    serp as SerpResult,
    (competitors ?? []) as PageContent[]
  );
  return NextResponse.json({ gapReport });
}
