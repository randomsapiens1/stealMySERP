import { NextRequest, NextResponse } from "next/server";
import { getSerpSource } from "@/lib/serp";
import type { Lang } from "@/lib/shared/types";

export const runtime = "nodejs";
// Only bounds the direct-fetch source in a deployed (Vercel) setting.
// The local-bridge source is for `next dev` only, where this limit doesn't
// apply — see lib/serp/sources/localBridge.ts.
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { query, lang } = await req.json();

  if (typeof query !== "string" || query.trim().length === 0) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const result = await getSerpSource().fetchSerp(query, (lang as Lang) ?? "en");
  return NextResponse.json(result);
}
