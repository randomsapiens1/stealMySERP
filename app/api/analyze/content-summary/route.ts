import { NextRequest, NextResponse } from "next/server";
import { summarizeContent } from "@/lib/llm/summarizeContent";
import type { PageContent } from "@/lib/shared/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { page } = await req.json();

  if (!page || typeof page.url !== "string") {
    return NextResponse.json({ error: "page is required" }, { status: 400 });
  }

  const summary = await summarizeContent(page as PageContent);
  return NextResponse.json({ summary });
}
