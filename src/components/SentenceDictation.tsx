"use client";
import { useEffect, useRef, useState } from "react";
import type { PracticeMaterial } from "@/lib/practice-materials";
import { gradeDictation } from "@/lib/podcast-import";
import { speakStudyText } from "./StudyRecall";

export default function SentenceDictation({ lines, audioSrc }: { lines: PracticeMaterial["lines"]; audioSrc?: string }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [error, setError] = useState("");
  const audio = useRef<HTMLAudioElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const line = lines[index];
  const result = gradeDictation(line.text, answers[index] || "");
  const timed = !!audioSrc && line.start !== undefined && line.end !== undefined;
  useEffect(() => {
    const player = audio.current; const timerRef = timer; const generationRef = generation;
    return () => { generationRef.current++; player?.pause(); if (timerRef.current) clearTimeout(timerRef.current); window.speechSynthesis?.cancel(); };
  }, []);
  function stop() { generation.current++; audio.current?.pause(); if (timer.current) clearTimeout(timer.current); window.speechSynthesis?.cancel(); }
  async function listen() {
    stop(); setError("");
    const token = generation.current;
    if (!timed) { try { speakStudyText(line.text); } catch { setError("Trình duyệt chưa hỗ trợ đọc mẫu."); } return; }
    const player = audio.current;
    if (!player) return;
    try { player.currentTime = line.start!; await player.play(); if (token !== generation.current) return; timer.current = setTimeout(() => player.pause(), (line.end! - line.start!) * 1000); }
    catch { if (token === generation.current) setError("Chưa phát được câu gốc. Thử tải lại audio hoặc nghe giọng tổng hợp."); }
  }
  return <section className="rounded-xl bg-zinc-50 p-4">
    <h3 className="font-semibold">Nghe và kiểm tra từng câu/đoạn</h3><p className="mt-2 text-xs text-zinc-500">{timed ? "Audio gốc theo mốc AI nhận diện; ranh giới có thể lệch nhẹ." : "Nghe giọng tổng hợp từ transcript; chưa có mốc để cắt câu trong audio gốc."} Điểm là độ khớp từ theo thứ tự, không chấm phát âm. Bỏ qua chữ hoa và dấu câu.</p>
    {audioSrc && <audio ref={audio} src={audioSrc} preload="none" onError={() => setError("Không đọc được file audio gốc.")} onTimeUpdate={() => { if (timed && audio.current && audio.current.currentTime >= line.end!) audio.current.pause(); }} />}
    <div className="mt-3 flex flex-wrap items-center gap-2"><label>Câu/đoạn <select className="ml-2 rounded-lg border bg-white p-2" value={index} onChange={event => { stop(); setIndex(Number(event.target.value)); }}>{lines.map((_, i) => <option key={i} value={i}>{i + 1}/{lines.length}</option>)}</select></label><button onClick={listen} className="rounded-full border bg-white px-4 py-2 text-sm">▶ Nghe câu này</button><button onClick={stop} className="rounded-full border bg-white px-3 py-2 text-sm">Dừng</button></div>
    <label htmlFor="sentence-dictation" className="mt-3 block text-sm">Gõ những gì bạn nghe được</label><textarea id="sentence-dictation" autoComplete="off" spellCheck={false} maxLength={1200} rows={2} value={answers[index] || ""} onChange={event => { setAnswers({ ...answers, [index]: event.target.value }); setChecked({ ...checked, [index]: false }); }} className="mt-2 w-full rounded-xl border bg-white p-3" />
    <button disabled={!answers[index]?.trim()} onClick={() => setChecked({ ...checked, [index]: true })} className="mt-2 rounded-full bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-40">Kiểm tra câu · 100 điểm</button>
    {checked[index] && <div role="status" className="mt-4 space-y-2 text-sm"><p className="font-semibold">{result.score}/100</p><p>{line.text}</p><div className="flex flex-wrap gap-1">{result.words.map((item, i) => <span key={i} className={`rounded px-1.5 py-1 ${item.correct ? "bg-emerald-100" : "bg-rose-100"}`}>{item.word}</span>)}</div><p className="text-xs text-zinc-500">Xanh: khớp theo thứ tự. Đỏ: thiếu, khác từ hoặc sai thứ tự.</p>{result.extra.length > 0 && <p>Từ cần kiểm tra trong câu bạn gõ: {result.extra.join(", ")}</p>}<p className="text-zinc-500">{line.vi}</p></div>}
    {error && <p role="status" className="mt-2 text-sm text-rose-700">{error}</p>}
    <p className="mt-3 text-xs text-zinc-500">Đã kiểm tra {Object.values(checked).filter(Boolean).length}/{lines.length} câu/đoạn. Nếu transcript AI nghe sai, sửa transcript và tạo lại bài trước khi dùng để chấm.</p>
  </section>;
}
