import { NextRequest, NextResponse } from "next/server";
import { fetchSerp } from "@/lib/serp/googleSearch";
import type { Lang } from "@/lib/shared/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { query, lang } = await req.json();

  if (typeof query !== "string" || query.trim().length === 0) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const result = await fetchSerp(query, (lang as Lang) ?? "en");
  return NextResponse.json(result);
}
