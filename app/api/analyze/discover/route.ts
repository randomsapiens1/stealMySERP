import { NextRequest, NextResponse } from "next/server";
import { getCrawler } from "@/lib/crawler";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(req: NextRequest) {
  const { siteUrl, limit } = await req.json();

  if (typeof siteUrl !== "string") {
    return NextResponse.json({ error: "siteUrl is required" }, { status: 400 });
  }

  try {
    const result = await getCrawler().discover(siteUrl, limit ?? 8);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Discovery failed" },
      { status: 500 }
    );
  }
}
