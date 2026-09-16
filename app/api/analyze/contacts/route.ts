import { NextRequest, NextResponse } from "next/server";
import { findContactsForDomain } from "@/lib/contacts/findContacts";

export const runtime = "nodejs";
export const maxDuration = 50;

export async function POST(req: NextRequest) {
  const { domains } = await req.json();

  if (!Array.isArray(domains) || domains.length === 0) {
    return NextResponse.json({ error: "domains[] is required" }, { status: 400 });
  }

  const contacts = await Promise.all(
    domains.map((domain: string) => findContactsForDomain(domain))
  );
  return NextResponse.json({ contacts });
}
