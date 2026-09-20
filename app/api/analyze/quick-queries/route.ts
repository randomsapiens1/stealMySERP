import { NextRequest, NextResponse } from "next/server";
import { inferQuickQueries } from "@/lib/llm/inferQueries";
import type { PageContent } from "@/lib/shared/types";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  const { page } = await req.json();

  if (!page || typeof page.url !== "string") {
    return NextResponse.json({ error: "page is required" }, { status: 400 });
  }

  const pageQueries = await inferQuickQueries(page as PageContent);
  return NextResponse.json({ pageQueries });
}
