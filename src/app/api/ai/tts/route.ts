import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, getBaseURL } from "@/lib/openai";

function getShopAikeyOrigin(baseURL?: string): string | null {
  if (!baseURL) return null;
  if (baseURL.includes("shopaikey.com")) {
    try {
      const u = new URL(baseURL);
      return `${u.protocol}//${u.host}`; // https://api.shopaikey.com hoặc https://direct.shopaikey.com
    } catch { return baseURL.replace(/\/v1\/?$/, ""); }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { text, voice = "alloy", model = "tts-1", speed = 1, response_format = "mp3" } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "Thiếu text" }, { status: 400 });
  if (text.length > 4096) return NextResponse.json({ error: "Text quá dài (max 4096 ký tự)" }, { status: 400 });

  const baseURL = getBaseURL(req.headers);
  const key = req.headers.get("x-openai-key")?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!key) return NextResponse.json({ error: "Thiếu OPENAI_API_KEY" }, { status: 401 });

  const shopOrigin = getShopAikeyOrigin(baseURL);

  // ShopAIKey MiniMax TTS: POST /tts/minimax/t2a_v2 trả audio dạng hex.
  if (shopOrigin && model === "speech-02-hd") {
    try {
      const r = await fetch(`${shopOrigin}/tts/minimax/t2a_v2`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "speech-02-hd", text, stream: false,
          voice_setting: { voice_id: voice === "alloy" ? "male-qn-qingse" : voice, speed, vol: 1, pitch: 0 },
          audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3" },
          language_boost: "English",
        }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) return NextResponse.json({ error: data?.error || data?.base_resp?.status_msg || `MiniMax TTS HTTP ${r.status}`, raw: data }, { status: r.status });
      const hex = data?.data?.audio;
      if (!hex || typeof hex !== "string") return NextResponse.json({ error: "MiniMax không trả audio hex", raw: data }, { status: 502 });
      const buffer = Buffer.from(hex, "hex");
      return new NextResponse(buffer as unknown as BodyInit, { headers: { "Content-Type": "audio/mpeg", "Content-Length": String(buffer.length) } });
    } catch (e: unknown) {
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e), hint: "MiniMax endpoint: POST /tts/minimax/t2a_v2" }, { status: 502 });
    }
  }

  // Nếu là ShopAikey → dùng endpoint chuẩn theo docs: POST /tts/openai/speech (trả về {url})
  if (shopOrigin) {
    try {
      const r = await fetch(`${shopOrigin}/tts/openai/speech`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: text,
          model,
          voice,
          response_format,
          speed,
        }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        return NextResponse.json({ error: data?.error || data?.message || `ShopAikey TTS HTTP ${r.status}`, raw: data }, { status: r.status });
      }
      // data = {url, key, model, voice, format, mimeType}
      if (data?.url) {
        // Trả về JSON url để frontend tự play (theo docs), đồng thời hỗ trợ proxy nếu client muốn blob
        // Để tương thích với frontend cũ (expect audio blob), ta fetch và proxy audio
        try {
          const audioRes = await fetch(data.url);
          if (audioRes.ok) {
            const buf = Buffer.from(await audioRes.arrayBuffer());
            return new NextResponse(buf as unknown as BodyInit, {
              headers: {
                "Content-Type": audioRes.headers.get("content-type") || "audio/mpeg",
                "Content-Length": String(buf.length),
                "X-Audio-URL": data.url,
                "Cache-Control": "public, max-age=3600",
              },
            });
          }
        } catch {}
        // fallback trả JSON url nếu proxy fail
        return NextResponse.json({ url: data.url, provider: "shopaikey/openai", shopOrigin, ...data });
      }
      return NextResponse.json(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // fallback sang OpenAI SDK nếu custom endpoint lỗi
      console.warn("[tts] ShopAikey custom failed, fallback SDK:", msg);
    }
  }

  // Fallback: OpenAI SDK (dùng cho api.openai.com hoặc khi shop custom fail)
  const client = getOpenAIClient(req.headers);
  if (!client) return NextResponse.json({ error: "Thiếu OPENAI_API_KEY" }, { status: 401 });
  try {
    const mp3 = await client.audio.speech.create({
      model: model as "tts-1" | "tts-1-hd",
      voice: voice as any,
      input: text,
      response_format: response_format as any,
      speed,
    } as any);
    const buffer = Buffer.from(await (mp3 as any).arrayBuffer());
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: { "Content-Type": "audio/mpeg", "Content-Length": String(buffer.length) },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, hint: "Thử đổi voice/model hoặc kiểm tra ShopAikey docs /tts/openai/speech" }, { status: 500 });
  }
}
