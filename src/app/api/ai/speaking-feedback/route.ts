import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, getChatModel, chatWithFallback } from "@/lib/openai";

export async function POST(req: NextRequest) {
  const { transcript, target, level = "B1" } = await req.json();
  if (!transcript?.trim()) return NextResponse.json({ error: "Thiếu transcript" }, { status: 400 });

  const client = getOpenAIClient(req.headers);
  if (!client) return NextResponse.json({ error: "Thiếu OPENAI_API_KEY" }, { status: 401 });

  try {
    const { completion, modelUsed } = await chatWithFallback(client, getChatModel(req.headers), {
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Bạn là giáo viên phát âm + ngữ pháp. Level ${level}. ${target ? `Câu mục tiêu: "${target}". ` : ""}Trả JSON với keys: score (0-100), correctedTranscript (sửa ngữ pháp), pronunciation (mảng {word, ipa, tip} cho 2-3 từ khó), grammarFixes (mảng string tiếng Việt), encouragement (1 câu động viên), nextExercise (1 bài tập shadowing 15s).`,
        },
        { role: "user", content: transcript },
      ],
    }, req.headers);
    const data = JSON.parse(completion.choices[0]?.message?.content || "{}");
    return NextResponse.json({ ...data, mock: false, modelUsed });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const isSaturated = msg.toLowerCase().includes("429") || msg.toLowerCase().includes("503") || msg.includes("负载已饱和") || msg.includes("upstream");
    if (isSaturated) {
      return NextResponse.json({
        score: 75,
        correctedTranscript: transcript + " (tạm mock do upstream saturated)",
        pronunciation: [{ word: "pronunciation", ipa: "/prəˌnʌn.siˈeɪ.ʃən/", tip: "Chú ý âm /ʌ/ và /ʃ/" }],
        grammarFixes: ["ShopAikey nhóm Cheap đang quá tải 429 — tạm trả mock. Thử đổi baseURL Direct hoặc model gpt-5-mini và thử lại sau 30s."],
        encouragement: "Bạn vẫn đang tiến bộ! Thử lại sau nhé.",
        nextExercise: "Shadow 1 câu: 'The quick brown fox jumps over the lazy dog' 3 lần.",
        mock: true, fallback: true, error: msg,
      }, { status: 200 });
    }
    return NextResponse.json({ error: msg, hint: "Thử đổi model ở /settings" }, { status: 500 });
  }
}
