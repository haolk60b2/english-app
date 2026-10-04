import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, getChatModel, chatWithFallback } from "@/lib/openai";

export async function POST(req: NextRequest) {
  const { word, level = "B1", context } = await req.json();
  if (!word?.trim()) return NextResponse.json({ error: "Thiếu word" }, { status: 400 });

  const client = getOpenAIClient(req.headers);
  if (!client) {
    return NextResponse.json({
      backVi: `Nghĩa của "${word}" (mock - chưa có OPENAI_API_KEY)`,
      example: `Example: I learned the word "${word}" today and used it in a sentence.`,
      phonetic: "/.../",
      level,
      mock: true,
    });
  }

  try {
    const { completion, modelUsed } = await chatWithFallback(client, getChatModel(req.headers), {
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Bạn là giáo viên tiếng Anh. Trả về JSON duy nhất với keys: backVi (nghĩa tiếng Việt ngắn gọn), backEn (định nghĩa bằng tiếng Anh đơn giản phù hợp level ${level}), phonetic (IPA), example (1 câu ví dụ level ${level}), exampleVi (dịch câu ví dụ), cefr (A1-C2), tags (array loại từ).${context ? ` Ngữ cảnh: ${context}` : ""}`,
        },
        { role: "user", content: `Từ/cụm: "${word}"` },
      ],
    }, req.headers);
    const raw = completion.choices[0]?.message?.content || "{}";
    const data = JSON.parse(raw);
    return NextResponse.json({
      backVi: data.backVi || data.meaning,
      backEn: data.backEn,
      example: data.example,
      exampleVi: data.exampleVi,
      phonetic: data.phonetic,
      level: data.cefr || level,
      tags: data.tags,
      mock: false,
      modelUsed,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const isSaturated = msg.toLowerCase().includes("429") || msg.toLowerCase().includes("503") || msg.includes("负载已饱和") || msg.includes("upstream") || msg.includes("model_not_found");
    if (isSaturated) {
      return NextResponse.json({
        backVi: `Nghĩa của "${word}" (tạm mock do ShopAikey upstream saturated — thử lại sau hoặc đổi model sang gpt-5-mini / gpt-4o-2024-08-06, Direct endpoint)`,
        example: `Example: I learned the word "${word}" today (fallback).`,
        exampleVi: `Ví dụ: Tôi đã học từ "${word}" hôm nay (tạm).`,
        phonetic: "/.../",
        level,
        mock: true,
        fallback: true,
        error: msg,
        hint: "Nhóm Cheap đang quá tải (429). Đã tự fallback mock, bạn vẫn học được. Thử đổi baseURL sang https://direct.shopaikey.com/v1 hoặc model gpt-5-mini ở /settings và thử lại sau 30s.",
      }, { status: 200 });
    }
    return NextResponse.json({ error: msg, hint: "Thử đổi model ở /settings (gợi ý: gpt-5-mini, gpt-4o-2024-08-06) hoặc dùng Direct endpoint https://direct.shopaikey.com/v1" }, { status: 500 });
  }
}
