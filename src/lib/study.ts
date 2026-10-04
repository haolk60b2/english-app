import type { VocabCard } from "./store";

export const STUDY_STEPS = [
  { title: "Ôn từ đến hạn", minutes: 8, description: "Cố nhớ nghĩa trước khi xem đáp án." },
  { title: "Học từ mới", minutes: 7, description: "Nghe mẫu, đọc lại và hiểu câu ví dụ." },
  { title: "Kiểm tra nhớ", minutes: 7, description: "Điền từ, nghe rồi gõ, nhìn nghĩa rồi nói." },
  { title: "Dùng từ của bạn", minutes: 8, description: "Viết 3 câu về cuộc sống của bạn, rồi đọc thành tiếng." },
] as const;

export function studyDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function makeCloze(example: string | undefined, word: string): string | null {
  if (!example || !word.trim()) return null;
  const escaped = word.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?<![a-zA-Z])${escaped}(?![a-zA-Z])`, "gi");
  if (!pattern.test(example)) return null;
  return example.replace(pattern, "______");
}

export type RecallQuestion = { id: string; cardId: string; kind: "cloze" | "listen" | "reverse"; prompt?: string };
export function makeQuestions(cards: VocabCard[]): RecallQuestion[] {
  return cards.map((card, index) => {
    const cloze = makeCloze(card.example, card.front);
    const kind = index % 3 === 1 ? "listen" : index % 3 === 2 || !cloze ? "reverse" : "cloze";
    return { id: `${index}-${card.id}`, cardId: card.id, kind, prompt: kind === "cloze" ? cloze! : undefined };
  });
}

export function sentenceUsesWord(sentence: string, word: string): boolean {
  const escaped = word.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return !!word.trim() && new RegExp(`(?<![a-zA-Z])${escaped}(?![a-zA-Z])`, "i").test(sentence);
}

export function validStudySentences(sentences: string[], words: string[]): boolean {
  const normalized = sentences.map(text => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim());
  return sentences.length === 3 && new Set(normalized).size === 3 && sentences.every(text => text.trim().split(/\s+/).length >= 3 && words.some(word => sentenceUsesWord(text, word)));
}
