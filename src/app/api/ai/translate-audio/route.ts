import { NextRequest, NextResponse } from "next/server";
import { getBaseURL } from "@/lib/openai";

function originFromBase(baseURL?: string) {
  if (!baseURL) return "https://api.openai.com";
  const url = new URL(baseURL);
  return `${url.protocol}//${url.host}`;
}

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-openai-key")?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!key) return NextResponse.json({ error: "Thiếu API key. Vào /settings để nhập key." }, { status: 401 });

  const incoming = await req.formData();
  const file = incoming.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Thiếu file âm thanh (field bắt buộc: file)" }, { status: 400 });

  const audioBytes = await file.arrayBuffer();
  // Theo yêu cầu thử TTS model cho STT để kiểm tra Cheap group
  const rawModel = String(incoming.get("model") || "whisper-1").trim();
  const model = rawModel === "tts-1-hd-1106" ? "tts-1-hd-1106" : rawModel;
  const responseFormat = String(incoming.get("response_format") || "json");
  const optionalFields: Record<string, string> = {};
  for (const name of ["language", "prompt", "temperature"]) {
    const value = incoming.get(name);
    if (value !== null && value !== "") optionalFields[name] = String(value);
  }

  const configuredBase = getBaseURL(req.headers);
  const origins = [originFromBase(configuredBase)];
  if (origins[0] === "https://api.shopaikey.com") origins.push("https://direct.shopaikey.com");
  if (origins[0] === "https://direct.shopaikey.com") origins.push("https://api.shopaikey.com");

  let last: { status: number; body: string; origin: string } | null = null;
  for (const origin of [...new Set(origins)]) {
    try {
      // Tạo FormData mới cho mỗi lần thử vì fetch consume request body.
      const body = new FormData();
      body.append("file", new File([audioBytes], file.name, { type: file.type }));
      body.append("model", model);
      body.append("response_format", responseFormat);
      for (const [name, value] of Object.entries(optionalFields)) body.append(name, value);
      const response = await fetch(`${origin}/v1/audio/translations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body,
      });
      const text = await response.text();
      if (response.ok) {
        let data: unknown;
        try { data = JSON.parse(text); } catch { data = { text }; }
        return NextResponse.json({ ...(data as object), provider: "shopaikey/openai-format", origin });
      }
      last = { status: response.status, body: text, origin };
    } catch (error) {
      last = { status: 502, body: error instanceof Error ? error.message : String(error), origin };
    }
  }

  return NextResponse.json({
    error: `Dịch âm thanh thất bại HTTP ${last?.status}`,
    details: last?.body,
    endpoint: `${last?.origin || origins[0]}/v1/audio/translations`,
    hint: "API này yêu cầu nhóm ShopAIKey có kênh whisper-1. Đây là dịch âm thanh sang tiếng Anh, không phải transcription giữ nguyên ngôn ngữ.",
  }, { status: last?.status || 502 });
}
