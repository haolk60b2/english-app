"use client";
import { useEffect, useRef, useState } from "react";

export default function SentenceAudio({ lines, onLine }: { lines: string[]; onLine?: (index: number) => void }) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voice, setVoice] = useState("");
  const [rate, setRate] = useState(0.85);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<"idle" | "playing" | "paused">("idle");
  const [repeat, setRepeat] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const current = useRef(0);
  const repeatRef = useRef(false);
  const startRef = useRef<(position: number, token: number) => void>(() => {});

  useEffect(() => {
    const playbackGeneration = generation;
    const synth = window.speechSynthesis;
    if (!synth) return;
    const load = () => setVoices(synth.getVoices().filter(item => item.lang.toLowerCase().startsWith("en")));
    load();
    synth.addEventListener("voiceschanged", load);
    return () => { playbackGeneration.current++; synth.removeEventListener("voiceschanged", load); synth.cancel(); };
  }, []);

  function stop() {
    generation.current++;
    window.speechSynthesis?.cancel();
    setStatus("idle");
  }

  function speak(position: number, token: number) {
    if (token !== generation.current || !lines[position]) return;
    current.current = position;
    setIndex(position);
    onLine?.(position);
    const utterance = new SpeechSynthesisUtterance(lines[position]);
    utterance.lang = "en-US";
    utterance.rate = rate;
    utterance.voice = voices.find(item => item.voiceURI === voice) || voices[0] || null;
    utterance.onend = () => {
      if (token !== generation.current) return;
      if (repeatRef.current) startRef.current(position, token);
      else if (position + 1 < lines.length) startRef.current(position + 1, token);
      else { setStatus("idle"); current.current = 0; setIndex(0); onLine?.(-1); }
    };
    utterance.onerror = event => {
      if (token !== generation.current) return;
      setStatus("idle");
      if (event.error !== "canceled" && event.error !== "interrupted") setError("Không phát được âm mẫu. Thử giọng khác hoặc mở bằng Chrome/Edge.");
    };
    window.speechSynthesis.speak(utterance);
    setStatus("playing");
  }

  function play(position = current.current) {
    if (!("speechSynthesis" in window)) { setError("Trình duyệt chưa hỗ trợ đọc văn bản. Hãy thử Chrome hoặc Edge."); return; }
    setError("");
    generation.current++;
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();
    startRef.current = speak;
    speak(position, generation.current);
  }

  const small = "rounded-full border bg-white px-3 py-2 text-sm disabled:opacity-40";
  return <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4" aria-label="Trình phát bài học">
    <p className="text-xs text-amber-900">Giọng tổng hợp trình duyệt · câu/đoạn {index + 1}/{lines.length}</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <button className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-white" onClick={() => {
        if (status === "playing") { window.speechSynthesis.pause(); setStatus("paused"); }
        else if (status === "paused") { window.speechSynthesis.resume(); setStatus("playing"); }
        else play();
      }}>{status === "playing" ? "Tạm dừng" : status === "paused" ? "Tiếp tục" : "▶ Nghe bài"}</button>
      <button className={small} onClick={() => { stop(); play(Math.max(0, current.current - 1)); }} disabled={index === 0}>← Câu trước</button>
      <button className={small} onClick={() => play(current.current)}>Nghe lại câu</button>
      <button className={small} onClick={() => play(Math.min(lines.length - 1, current.current + 1))} disabled={index === lines.length - 1}>Câu sau →</button>
      <button className={small} onClick={() => { stop(); current.current = 0; setIndex(0); }}>Dừng</button>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
      <label>Tốc độ <select className="ml-2 rounded-lg border bg-white p-1.5" value={rate} onChange={event => { stop(); setRate(Number(event.target.value)); }}>{[0.65, 0.85, 1, 1.15].map(value => <option key={value} value={value}>{value}×</option>)}</select></label>
      <label>Giọng <select className="ml-2 max-w-52 rounded-lg border bg-white p-1.5" value={voice} onChange={event => { stop(); setVoice(event.target.value); }}><option value="">Giọng tiếng Anh mặc định</option>{voices.map(item => <option key={item.voiceURI} value={item.voiceURI}>{item.name} · {item.lang}</option>)}</select></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={repeat} onChange={event => { repeatRef.current = event.target.checked; setRepeat(event.target.checked); }} /> Lặp câu đang nghe</label>
    </div>
    {error && <p role="status" className="mt-2 text-sm text-rose-700">{error}</p>}
  </section>;
}
