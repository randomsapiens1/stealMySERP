import { NextRequest, NextResponse } from "next/server";
import { extractPage } from "@/lib/crawl/extract";

export const runtime = "nodejs";
export const maxDuration = 50;

export async function POST(req: NextRequest) {
  const { urls } = await req.json();

  if (!Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json({ error: "urls[] is required" }, { status: 400 });
  }

  const extracted = await Promise.all(urls.map((url: string) => extractPage(url)));
  return NextResponse.json({ extracted });
}
