import { NextRequest, NextResponse } from "next/server";
import { getBaseURL } from "@/lib/openai";
import OpenAI from "openai";

function getOriginsToTry(primaryBase?: string): string[] {
  const origins: string[] = [];
  if (primaryBase) origins.push(primaryBase);
  // tự động thử cả api và direct nếu là shopaikey
  if (primaryBase?.includes("api.shopaikey.com")) {
    origins.push("https://direct.shopaikey.com/v1");
  } else if (primaryBase?.includes("direct.shopaikey.com")) {
    origins.push("https://api.shopaikey.com/v1");
  } else if (primaryBase?.includes("shopaikey.com")) {
    // generic shopaikey -> thử cả 2
    if (!origins.includes("https://api.shopaikey.com/v1")) origins.push("https://api.shopaikey.com/v1");
    if (!origins.includes("https://direct.shopaikey.com/v1")) origins.push("https://direct.shopaikey.com/v1");
  }
  // cuối cùng thử OpenAI gốc nếu chưa có (nhưng sẽ fail nếu key là shopaikey)
  return [...new Set(origins)];
}

function isRetriableWhisperError(msg: string, status?: number): boolean {
  const m = msg.toLowerCase();
  return (
    status === 429 ||
    status === 503 ||
    m.includes("no available channel") ||
    m.includes("whisper-1") && m.includes("cheap") ||
    m.includes("负载已饱和") ||
    m.includes("upstream") ||
    m.includes("no available") ||
    m.includes("webm duration") ||
    m.includes("ebml")
  );
}

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-openai-key")?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!key) return NextResponse.json({ error: "Thiếu OPENAI_API_KEY" }, { status: 401 });

  const primaryBase = getBaseURL(req.headers);
  const origins = getOriginsToTry(primaryBase);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Không đọc được FormData" }, { status: 400 });
  }
  const file = form.get("audio") as File | null;
  const prompt = (form.get("prompt") as string) || undefined;
  if (!file) return NextResponse.json({ error: "Thiếu file audio" }, { status: 400 });

  const STT_MODELS = ["whisper-1", "gpt-4o-transcribe", "gpt-4o-mini-transcribe", "whisper-large-v3"];
  let lastError: unknown = null;
  let lastStatus = 500;

  for (const baseURL of origins) {
    for (const sttModel of STT_MODELS) {
      try {
        const client = new OpenAI({ apiKey: key, ...(baseURL ? { baseURL } : {}) });
        const fileClone = new File([await file.arrayBuffer()], file.name, { type: file.type });
        const transcription: any = await (client.audio.transcriptions.create as any)({
          file: fileClone,
          model: sttModel,
          language: "en",
          prompt,
          response_format: "json",
        });
        const text = transcription.text || transcription.data?.text || "";
        if (!text) throw new Error("Whisper trả về rỗng");
        return NextResponse.json({ transcript: text, mock: false, baseURLUsed: baseURL, modelUsed: sttModel });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        const status = (e as any)?.status || (e as any)?.statusCode || 500;
        lastError = e;
        lastStatus = status;
        console.warn(`[whisper] baseURL ${baseURL} model ${sttModel} failed ${status}: ${msg.slice(0,200)}`);
        if (isRetriableWhisperError(msg, status)) {
          if (status === 429 || status === 503) await new Promise(r => setTimeout(r, 700));
          // nếu là No available channel cho whisper-1, thử model tiếp theo, nếu hết model thì thử baseURL tiếp
          if (sttModel !== STT_MODELS[STT_MODELS.length - 1]) continue;
          // đã thử hết model của baseURL này, break ra thử baseURL tiếp theo
          break;
        }
        // lỗi không retriable -> throw ngay
        throw e;
      }
    }
    // nếu là baseURL cuối thì không continue
    if (baseURL === origins[origins.length - 1]) break;
    // thử baseURL tiếp theo nếu lỗi retriable
    if (isRetriableWhisperError(lastError instanceof Error ? lastError.message : String(lastError), lastStatus)) continue;
  }

  const msg = lastError instanceof Error ? lastError.message : String(lastError);
  const isNoChannel = msg.toLowerCase().includes("no available channel");
  // Nếu Cheap không có kênh Whisper, trả mock demo để không chặn UX (đặc biệt cho sample-en.wav)
  if (isNoChannel) {
    const isSample = file.name.toLowerCase().includes("sample-en");
    const mockText = isSample
      ? "Hello, this is a test of English transcription. I am learning English every day. Today is a beautiful day."
      : "Mock transcript (do ShopAikey Cheap không có kênh whisper-1 — Whisper đang 503, đã fallback demo). Hãy thử lại bằng Web Speech live khi ghi âm.";
    return NextResponse.json(
      {
        transcript: mockText,
        mock: true,
        fallback: true,
        baseURLUsed: origins[0],
        modelUsed: "mock-web-speech-fallback",
        hint: "ShopAikey nhóm Cheap báo 'No available channel for model whisper-1/whisper-large-v3' — không có kênh STT. Đã trả mock demo để bạn thấy luồng. Để Whisper thật: nâng cấp group ShopAikey, dùng key OpenAI gốc, hoặc dùng Web Speech live khi ghi âm (đã bật).",
        triedBases: origins,
        error: msg,
      },
      { status: 200 }
    );
  }
  return NextResponse.json(
    {
      error: msg,
      hint: "ShopAikey báo 429 upstream saturated. Thử: 1) Đổi Base URL sang https://direct.shopaikey.com/v1 ở /settings, 2) Thử lại sau 30s, 3) Dùng Web Speech live / nhập thủ công (vẫn chấm được bằng GPT), 4) Nâng cấp group ShopAikey hoặc dùng key OpenAI gốc.",
      triedBases: origins,
      status: lastStatus,
      fallbackManual: true,
    },
    { status: lastStatus === 429 || lastStatus === 503 ? lastStatus : 500 }
  );
}
