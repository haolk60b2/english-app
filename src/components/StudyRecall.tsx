"use client";
import { useEffect, useState } from "react";
import type { VocabCard } from "@/lib/store";
import type { RecallQuestion } from "@/lib/study";
import { normalizeSpeech } from "@/lib/pronunciation";
import PronunciationPractice from "./PronunciationPractice";

export function speakStudyText(text: string, rate = 0.85) {
  if (!("speechSynthesis" in window)) throw new Error("Trình duyệt chưa hỗ trợ nghe mẫu. Hãy mở bằng Chrome hoặc Edge.");
  window.speechSynthesis.cancel();
  const speech = new SpeechSynthesisUtterance(text);
  speech.lang = "en-US";
  speech.rate = rate;
  window.speechSynthesis.speak(speech);
}

export default function StudyRecall({ question, card, onNext }: { question: RecallQuestion; card: VocabCard; onNext: (correct: boolean) => void }) {
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const correct = normalizeSpeech(answer) === normalizeSpeech(card.front);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  return (
    <section className="rounded-2xl border bg-white p-5 md:p-7">
      <p className="text-xs font-semibold text-amber-700">{question.kind === "cloze" ? "ĐIỀN TỪ" : question.kind === "listen" ? "NGHE RỒI GÕ" : "NHÌN NGHĨA → NÓI TIẾNG ANH"}</p>
      <h2 className="mt-2 text-xl font-semibold">{question.kind === "cloze" ? "Điền từ đã học vào chỗ trống" : question.kind === "listen" ? "Bạn nghe được từ gì?" : "Tự nhớ từ tiếng Anh trên thẻ"}</h2>
      {question.kind === "cloze" && <p className="my-5 text-lg">{question.prompt}</p>}
      {question.kind === "reverse" && <p className="my-5 text-lg">{card.backVi || card.back}</p>}
      {question.kind === "listen" && <button onClick={() => { try { speakStudyText(card.front); } catch (cause) { setError(String(cause)); } }} className="my-5 rounded-full bg-zinc-900 px-5 py-2 text-white">🔊 Nghe từ</button>}
      <form onSubmit={event => { event.preventDefault(); if (answer.trim()) setChecked(true); }}>
        <label className="block text-sm font-medium" htmlFor="recall-answer">Từ / cụm từ tiếng Anh trên thẻ</label>
        <input id="recall-answer" value={answer} onChange={event => setAnswer(event.target.value)} disabled={checked} autoComplete="off" autoCorrect="off" spellCheck={false} className="mt-2 w-full rounded-xl border px-4 py-3 disabled:bg-zinc-50" />
        {!checked && <button disabled={!answer.trim()} className="mt-3 rounded-full bg-zinc-900 px-5 py-2 text-white disabled:opacity-40">Kiểm tra đáp án</button>}
      </form>
      {question.kind === "reverse" && !checked && <PronunciationPractice hideTarget word={card.front} onRecognized={setAnswer} />}
      {error && <p role="status" className="mt-2 text-rose-700">{error}</p>}
      {checked && <div role="status" className={`mt-5 rounded-xl p-4 ${correct ? "bg-emerald-50" : "bg-amber-50"}`}>
        <p className="font-semibold">{correct ? "✓ Bạn đã nhớ đúng!" : "Chưa đúng từ trên thẻ — cùng ôn lại."}</p>
        <p className="mt-2"><b>{card.front}</b> {card.phonetic} — {card.backVi || card.back}</p>
        {card.example && <p className="mt-2 text-sm italic">{card.example}</p>}
        <button onClick={() => onNext(correct)} className="mt-3 rounded-full bg-zinc-900 px-5 py-2 text-white">Câu tiếp theo →</button>
      </div>}
    </section>
  );
}
