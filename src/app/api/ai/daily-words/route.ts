import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, getChatModel, chatWithFallback } from "@/lib/openai";
import { pickFallback } from "@/lib/fallback-words";

const TOPICS = ["workplace", "travel", "daily life", "technology", "health", "education", "environment", "finance"];

export async function POST(req: NextRequest) {
  const { count = 20, level = "B1", exclude = [], topic } = await req.json().catch(() => ({}));
  const n = Math.min(30, Math.max(5, Number(count) || 20));
  const client = getOpenAIClient(req.headers);

  const excludeSet = new Set((exclude as string[]).map(s => String(s).toLowerCase().trim()).filter(Boolean));

  if (!client) {
    const picked = pickFallback(excludeSet, n);
    return NextResponse.json({ words: picked, mock: true, model: "fallback", deduped: true, excludeCount: excludeSet.size });
  }

  const chosenTopic = topic || TOPICS[Math.floor(Math.random() * TOPICS.length)];
  const excludeStr = Array.from(excludeSet).slice(0, 150).join(", ");

  try {
    const { completion, modelUsed } = await chatWithFallback(client, getChatModel(req.headers), {
      temperature: 0.9,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Bạn là chuyên gia từ vựng CEFR ${level}. Tạo ${n} từ/cụm tiếng Anh MỚI TUYỆT ĐỐI KHÔNG TRÙNG với exclude list, chủ đề ${chosenTopic}, level ${level}, đa dạng loại từ. Trả JSON với key "words": mảng ${n} object {front, back, backEn, backVi, example, exampleVi, phonetic, level, tags}. back và backVi là nghĩa tiếng Việt ngắn gọn; backEn là định nghĩa bằng tiếng Anh đơn giản phù hợp level. example là câu tiếng Anh, exampleVi là bản dịch tiếng Việt. KHÔNG được trả lại bất kỳ từ nào trong exclude.`,
        },
        { role: "user", content: `Exclude (${excludeSet.size} từ đã học): ${excludeStr || "(none)"}\nTạo ${n} từ mới level ${level} chủ đề ${chosenTopic}, không trùng exclude.` },
      ],
    }, req.headers);
    const raw = completion.choices[0]?.message?.content || "{}";
    const data = JSON.parse(raw);
    let words = (data.words || data.data || []) as any[];

    const seen = new Set<string>();
    const cleaned: any[] = [];
    for (const w of words || []) {
      const front = String(w.front || "").trim();
      const key = front.toLowerCase();
      if (!front || !w.back) continue;
      if (excludeSet.has(key)) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      cleaned.push({
        front,
        back: String(w.back || w.meaning || "").trim(),
        backEn: String(w.backEn || "").trim(),
        backVi: String(w.backVi || w.back || "").trim(),
        example: String(w.example || "").trim(),
        exampleVi: String(w.exampleVi || w.translation || "").trim(),
        phonetic: String(w.phonetic || "/.../").trim(),
        level: w.level || level,
        tags: Array.isArray(w.tags) ? w.tags : ["vocab"],
      });
    }
    words = cleaned;

    if (words.length < n) {
      const need = n - words.length;
      words.forEach(w => excludeSet.add(w.front.toLowerCase()));
      const filler = pickFallback(excludeSet, need);
      words.push(...filler);
    }

    words = words.slice(0, n);

    return NextResponse.json({
      words,
      mock: false,
      model: modelUsed,
      topic: chosenTopic,
      deduped: true,
      requested: n,
      returned: words.length,
      filteredDuplicates: (data.words?.length || 0) - cleaned.length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const fallback = pickFallback(excludeSet, n);
    return NextResponse.json({ error: msg, words: fallback, fallback: true, deduped: true, hint: "ShopAikey báo 429 model_not_found / upstream saturated — đã fallback pool, thử đổi model ở /settings sang gpt-5-mini hoặc gpt-4o-2024-08-06 hoặc dùng Direct endpoint" }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({ hint: "POST {count:20, level:'B1', exclude:[...], topic?:string} - đảm bảo không trùng với exclude" });
}
