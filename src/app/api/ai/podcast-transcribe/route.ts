import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai";
import { validateSource, sourceLines } from "@/lib/podcast-import";

export const maxDuration = 60;
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File) || !audio.size) return NextResponse.json({ error: "Chọn file audio." }, { status: 400 });
    if (audio.size > 4 * 1024 * 1024) return NextResponse.json({ error: "Chép lời AI nhận file tối đa 4 MB. Chọn đoạn MP3 ngắn hoặc dán transcript có sẵn." }, { status: 413 });
    if (!/\.(mp3|mp4|mpeg|mpga|m4a|wav|webm)$/i.test(audio.name)) return NextResponse.json({ error: "Định dạng chưa hỗ trợ chép lời. Dùng MP3, M4A, WAV hoặc WebM." }, { status: 400 });
    const client = getOpenAIClient(req.headers);
    if (!client) return NextResponse.json({ error: "Chưa cấu hình AI trong Cài đặt." }, { status: 401 });
    let result;
    try {
      result = await client.audio.transcriptions.create({ file: audio, model: "whisper-1", language: "en", response_format: "verbose_json", timestamp_granularities: ["segment"] }, { timeout: 25000, maxRetries: 0 });
    } catch {
      const plain = await client.audio.transcriptions.create({ file: audio, model: "gpt-4o-mini-transcribe", language: "en", response_format: "json" }, { timeout: 25000, maxRetries: 0 });
      const lines = sourceLines(plain.text);
      return NextResponse.json({ lines, transcript: lines.map(line => line.text).join("\n"), timed: false });
    }
    const lines = result.segments?.length ? validateSource(result.segments.map(item => ({ text: item.text, start: item.start, end: item.end }))) : sourceLines(result.text);
    return NextResponse.json({ lines, transcript: lines.map(line => line.text).join("\n"), timed: lines.every(line => line.start !== undefined) });
  } catch { return NextResponse.json({ error: "Chép lời AI chưa sẵn sàng với nhà cung cấp hiện tại. Dán transcript từ trang podcast để tạo câu hỏi, hoặc dùng dịch vụ hỗ trợ whisper-1 / gpt-4o-mini-transcribe." }, { status: 502 }); }
}
