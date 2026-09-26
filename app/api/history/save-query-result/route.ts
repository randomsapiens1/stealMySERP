import { NextRequest, NextResponse } from "next/server";
import { updateQueryResult, type SavedQuery } from "@/lib/db/history";
import type { AiOverviewSourceReport, GapReport } from "@/lib/shared/types";

export const runtime = "nodejs";

// Pure persistence — the actual crawl/SERP/gap-analysis work for a single
// keyword runs client-side (components/history/SiteHistoryView.tsx), since
// the richest SERP source (the browser extension bridge) can only be
// reached from the page, not from this server route. This just saves the
// already-computed result onto the matching history row.
export async function POST(req: NextRequest) {
  const { id, query, updatedQuery, gapReport, sourceReport } = await req.json();
  const numericId = Number(id);

  if (!Number.isInteger(numericId) || typeof query !== "string" || !updatedQuery || !gapReport) {
    return NextResponse.json(
      { error: "id, query, updatedQuery, and gapReport are required" },
      { status: 400 }
    );
  }

  try {
    await updateQueryResult(
      numericId,
      query,
      updatedQuery as SavedQuery,
      gapReport as GapReport,
      (sourceReport ?? null) as AiOverviewSourceReport | null
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save result" },
      { status: 500 }
    );
  }
}
