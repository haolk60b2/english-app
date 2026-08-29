import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, getKeySource, getBaseURLSource } from "@/lib/openai";

export async function GET(req: NextRequest) {
  const source = getKeySource(req.headers);
  const baseUrl = getBaseURLSource(req.headers);
  if (source === "none") return NextResponse.json({ ok: false, source, baseUrl, error: "Chưa có OPENAI_API_KEY" });
  try {
    const client = getOpenAIClient(req.headers)!;
    await client.models.list({} as unknown as Record<string, never>);
    return NextResponse.json({ ok: true, source, baseUrl });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, source, baseUrl, error: msg }, { status: 401 });
  }
}
