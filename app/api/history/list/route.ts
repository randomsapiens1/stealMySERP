import { NextRequest, NextResponse } from "next/server";
import { listAnalyzedPages } from "@/lib/db/history";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("search") ?? undefined;

  try {
    const pages = listAnalyzedPages(search);
    return NextResponse.json({ pages });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load history" },
      { status: 500 }
    );
  }
}
