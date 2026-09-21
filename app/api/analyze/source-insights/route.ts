import { NextRequest, NextResponse } from "next/server";
import { analyzeAiOverviewSources } from "@/lib/analysis/aiOverviewSources";
import type { SerpResult } from "@/lib/shared/types";

export const runtime = "nodejs";
// One completeJson call per invocation — generous headroom for OpenRouter's
// free-tier latency (Vercel now allows up to 300s/function on all plans).
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  const { serp } = await req.json();

  if (!serp) {
    return NextResponse.json({ error: "serp is required" }, { status: 400 });
  }

  const typedSerp = serp as SerpResult;
  const sourceReport = await analyzeAiOverviewSources(typedSerp.query, typedSerp.aiOverview);
  return NextResponse.json({ sourceReport });
}
