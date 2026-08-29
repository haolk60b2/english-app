import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, getChatModel, chatWithFallback } from "@/lib/openai";

export async function POST(req: NextRequest) {
  const { text, level = "B1" } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "Thiếu text" }, { status: 400 });

  const client = getOpenAIClient(req.headers);
  if (!client) {
    return NextResponse.json({
      score: 72,
      corrected: "I go to school every day and I study English very hard. (mock - thiếu OPENAI_API_KEY)",
      explains: [
        "“everyday” ≠ “every day”: khi nói “mỗi ngày” phải dùng “every day”.",
        "“hardly” = hầu như không; muốn nói “rất chăm chỉ” dùng “very hard”.",
      ],
      mock: true,
    });
  }

  try {
    const { completion, modelUsed } = await chatWithFallback(client, getChatModel(req.headers), {
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Bạn là giáo viên IELTS chấm Writing. Người học level ${level}. Trả về JSON với keys: score (0-100), corrected (bản sửa đúng ngữ pháp, giữ ý gốc), explains (mảng 2-4 string tiếng Việt giải thích lỗi: ngữ pháp/từ vựng/collocation, mỗi mục có ví dụ ngắn), cefrFeedback (nhận xét ngắn để lên band tiếp theo), suggestions (2 gợi ý luyện tập). Chỉ trả JSON.`,
        },
        { role: "user", content: text },
      ],
    }, req.headers);
    const raw = completion.choices[0]?.message?.content || "{}";
    const data = JSON.parse(raw);
    return NextResponse.json({
      score: data.score ?? 70,
      corrected: data.corrected || text,
      explains: data.explains || data.reasons || [],
      cefrFeedback: data.cefrFeedback,
      suggestions: data.suggestions,
      mock: false,
      modelUsed,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const isSaturated = msg.toLowerCase().includes("429") || msg.toLowerCase().includes("503") || msg.includes("负载已饱和") || msg.includes("upstream");
    if (isSaturated) {
      return NextResponse.json({
        score: 72,
        corrected: text.replace(/\beveryday\b/gi, "every day").replace(/\bvery hardly\b/gi, "very hard") + " (tạm mock do upstream saturated)",
        explains: ["ShopAikey nhóm Cheap đang quá tải (429 upstream saturated) — tạm trả mock. Thử đổi baseURL sang https://direct.shopaikey.com/v1 hoặc model gpt-5-mini và thử lại sau 30s.", "Bạn vẫn có thể học tiếp, hệ thống tự fallback."],
        cefrFeedback: "Tạm thời dùng mock, thử lại sau.",
        mock: true, fallback: true, error: msg,
      }, { status: 200 });
    }
    return NextResponse.json({ error: msg, hint: "Thử đổi model ở /settings hoặc Direct endpoint" }, { status: 500 });
  }
}
