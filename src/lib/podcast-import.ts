import type { PracticeMaterial } from "./practice-materials";
import { normalizeSpeech } from "./pronunciation";

export type SourceLine = { text: string; start?: number; end?: number };
export function sourceLines(transcript: string): SourceLine[] {
  if (transcript.length > 12000) throw new Error("Chọn đoạn transcript tối đa 12.000 ký tự cho một bài.");
  const lines = transcript.trim().split(/\n+/).flatMap(line => Array.from(new Intl.Segmenter("en", { granularity: "sentence" }).segment(line), item => ({ text: item.segment.trim() }))).filter(line => line.text);
  return validateSource(lines);
}
export function validateSource(value: unknown): SourceLine[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 60) throw new Error("Mỗi bài cần 2–60 câu/đoạn. Chia podcast dài thành nhiều bài.");
  let lastStart = -1;
  const result = value.map(item => {
    if (!item || typeof item.text !== "string" || !item.text.trim() || item.text.length > 1200) throw new Error("Câu/đoạn không hợp lệ hoặc dài quá 1.200 ký tự.");
    const line: SourceLine = { text: item.text.trim() };
    if (item.start !== undefined || item.end !== undefined) {
      if (!Number.isFinite(item.start) || !Number.isFinite(item.end) || item.start < 0 || item.end <= item.start || item.start < lastStart) throw new Error("Mốc thời gian audio không hợp lệ.");
      line.start = item.start; line.end = item.end; lastStart = item.start;
    }
    return line;
  });
  if (result.reduce((size, line) => size + line.text.length, 0) > 12000) throw new Error("Transcript dài quá 12.000 ký tự. Chọn đoạn ngắn hơn.");
  return result;
}

function text(value: unknown, max = 1000): value is string { return typeof value === "string" && !!value.trim() && value.length <= max; }
export function makeImportedMaterial(value: unknown, lines: SourceLine[], level: PracticeMaterial["level"]): PracticeMaterial {
  const data = value as Record<string, unknown> | null;
  if (!data || !text(data.title, 150) || !text(data.goal) || !text(data.task) || !Array.isArray(data.translations) || data.translations.length !== lines.length || !data.translations.every(item => text(item, 2000))) throw new Error("AI trả thiếu bản dịch hoặc nội dung bài. Thử tạo lại.");
  if (!Array.isArray(data.questions) || data.questions.length < 3 || data.questions.length > 8) throw new Error("AI chưa trả đủ câu hỏi hợp lệ.");
  const questions = data.questions.map(item => {
    if (!item || !text(item.prompt) || !Array.isArray(item.options) || item.options.length < 2 || item.options.length > 4 || !item.options.every((option: unknown) => text(option)) || !Number.isInteger(item.answer) || item.answer < 0 || item.answer >= item.options.length || !text(item.explanation) || !Number.isInteger(item.evidenceIndex) || item.evidenceIndex < 0 || item.evidenceIndex >= lines.length) throw new Error("AI trả câu hỏi/đáp án không hợp lệ.");
    return { prompt: item.prompt, options: item.options as string[], answer: item.answer as number, explanation: item.explanation, evidenceIndex: item.evidenceIndex as number };
  });
  const original = normalizeSpeech(lines.map(line => line.text).join(" "));
  if (!Array.isArray(data.vocabulary) || data.vocabulary.length > 8) throw new Error("Danh sách từ vựng không hợp lệ.");
  const vocabulary = data.vocabulary.map(item => {
    if (!item || !text(item.word, 100) || !text(item.meaning, 300) || !text(item.example, 500) || !(` ${original} `).includes(` ${normalizeSpeech(item.word)} `)) throw new Error("AI chọn từ không xuất hiện trong transcript. Thử tạo lại.");
    return { word: item.word, meaning: item.meaning, example: item.example };
  });
  return { id: "podcast-import", kind: "podcast", level, title: data.title, goal: data.goal, task: data.task, minutes: 8,
    lines: lines.map((line, index) => ({ ...line, vi: (data.translations as string[])[index] })), questions, vocabulary };
}

// Word order matters; punctuation/case do not. Compare against the reviewed transcript.
export function gradeDictation(expected: string, answer: string) {
  const normalise = (value: string) => normalizeSpeech(value.replace(/’/g, "'").replace(/\b(can't|cannot)\b/gi, "can not").replace(/\bwon't\b/gi, "will not").replace(/n't\b/gi, " not").replace(/\bI'm\b/gi, "I am").replace(/'re\b/gi, " are").replace(/'ve\b/gi, " have").replace(/'ll\b/gi, " will"));
  const target = normalise(expected).split(" ").filter(Boolean);
  const heard = normalise(answer).split(" ").filter(Boolean);
  const matrix = Array.from({ length: target.length + 1 }, () => Array(heard.length + 1).fill(0));
  for (let i = 1; i <= target.length; i++) for (let j = 1; j <= heard.length; j++) matrix[i][j] = target[i - 1] === heard[j - 1] ? matrix[i - 1][j - 1] + 1 : Math.max(matrix[i - 1][j], matrix[i][j - 1]);
  const matched = new Set<number>(); const matchedHeard = new Set<number>();
  let i = target.length, j = heard.length;
  while (i && j) { if (target[i - 1] === heard[j - 1]) { matched.add(--i); matchedHeard.add(--j); } else if (matrix[i - 1][j] >= matrix[i][j - 1]) i--; else j--; }
  return { score: target.length && heard.length ? Math.round(100 * matched.size / Math.max(target.length, heard.length)) : 0,
    words: target.map((word, index) => ({ word, correct: matched.has(index) })), extra: heard.filter((_, index) => !matchedHeard.has(index)) };
}
