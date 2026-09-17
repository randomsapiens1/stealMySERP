import { NextRequest, NextResponse } from "next/server";
import { saveRunReport } from "@/lib/db/history";
import type { RunReport } from "@/lib/shared/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const report = (await req.json()) as RunReport;

  if (!report?.siteUrl || !Array.isArray(report.pageQueries)) {
    return NextResponse.json({ error: "A full RunReport is required" }, { status: 400 });
  }

  try {
    const ids = saveRunReport(report);
    return NextResponse.json({ savedIds: ids });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save history" },
      { status: 500 }
    );
  }
}
