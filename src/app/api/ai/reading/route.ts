import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, getChatModel, chatWithFallback } from "@/lib/openai";

export async function POST(req: NextRequest) {
  const { level = "B1", topic = "daily habits", length = "short" } = await req.json();

  const client = getOpenAIClient(req.headers);
  if (!client) {
    return NextResponse.json({ error: "Thiếu OPENAI_API_KEY - nhập ở Cài đặt hoặc .env.local" }, { status: 401 });
  }

  try {
    const { completion, modelUsed } = await chatWithFallback(client, getChatModel(req.headers), {
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Tạo bài đọc tiếng Anh level ${level} về chủ đề "${topic}", độ dài ${length} (short=120-180 từ). Trả JSON với keys: title (tiếng Anh), body (tiếng Anh, không dịch), glossary (mảng 3-5 object {w, m, ipa} m là nghĩa tiếng Việt), quiz (mảng 2-3 object {q, a: string[3], correct: index}), listeningScript (bản rút gọn 1-2 câu để TTS).`,
        },
        { role: "user", content: `Tạo bài đọc ${level} - ${topic}` },
      ],
    }, req.headers);
    const data = JSON.parse(completion.choices[0]?.message?.content || "{}");
    return NextResponse.json({ ...data, mock: false, modelUsed });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const isSaturated = msg.toLowerCase().includes("429") || msg.toLowerCase().includes("503") || msg.includes("负载已饱和") || msg.includes("upstream");
    if (isSaturated) {
      return NextResponse.json({
        title: "The Power of Daily Habits (Fallback)",
        body: "Building a small daily habit is more powerful than a big goal you never start. For example, learning five new English words every day means you will know more than 150 words in a month. (Tạm fallback do ShopAikey upstream saturated — thử lại sau hoặc đổi sang Direct endpoint / gpt-5-mini)",
        glossary: [{ w: "consistency", m: "sự nhất quán", ipa: "/kənˈsɪs.tən.si/" }],
        quiz: [{ q: "Fallback quiz: How many words per month with 5/day?", a: ["50", "150+", "500"], correct: 1 }],
        mock: true, fallback: true, error: msg,
        hint: "Nhóm Cheap đang quá tải 429. Đã fallback mock, thử lại sau 30s hoặc đổi baseURL Direct.",
      }, { status: 200 });
    }
    return NextResponse.json({ error: msg, hint: "Thử đổi model ở /settings (gợi ý: gpt-5-mini, gpt-4o-2024-08-06) hoặc dùng Direct endpoint" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ hint: "POST {level, topic} để tạo bài đọc" });
}
