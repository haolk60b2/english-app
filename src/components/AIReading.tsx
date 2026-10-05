"use client";
import { useEffect, useState } from "react";
import { HallmarkHeading, HallmarkSectionTitle } from "@/components/HallmarkHeading";

const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;

const MOCK_ARTICLE: Record<string, { title: string; body: string; glossary: { w: string; m: string; ipa?: string }[]; quiz: { q: string; a: string[]; correct: number }[] }> = {
  B1: {
    title: "The Power of Daily Habits",
    body: "Building a small daily habit is more powerful than a big goal you never start. For example, learning five new English words every day means you will know more than 150 words in a month. The key is consistency, not intensity.",
    glossary: [
      { w: "consistency", m: "sự nhất quán" },
      { w: "intensity", m: "cường độ" },
      { w: "streak", m: "chuỗi ngày liên tiếp" },
    ],
    quiz: [{ q: "How many words will you know after a month (5/day)?", a: ["50", "150+", "500"], correct: 1 }],
  },
};

export default function AIReading() {
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("B1");
  const [topic, setTopic] = useState("daily habits");
  const [article, setArticle] = useState(MOCK_ARTICLE.B1);
  const [loading, setLoading] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState("");
  const [rate, setRate] = useState(0.9);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const authHeaders = () => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    const k = localStorage.getItem("openai_api_key"); if (k) h["x-openai-key"] = k;
    const b = localStorage.getItem("openai_base_url"); const m = localStorage.getItem("openai_model"); if (b) h["x-openai-base-url"] = b; if (m) h["x-openai-model"] = m;
    return h;
  };

  useEffect(() => {
    const load = () => {
      const vs = window.speechSynthesis?.getVoices() || [];
      const en = vs.filter(v=> v.lang.toLowerCase().startsWith("en"));
      setVoices(en.length? en : vs);
      if (!voiceURI && en.length) setVoiceURI(en[0].voiceURI);
    };
    load();
    window.speechSynthesis?.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", load);
  }, [voiceURI]);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/reading", { method: "POST", headers: authHeaders(), body: JSON.stringify({ level, topic }) });
      const data = await res.json();
      if (data.error && !data.title) { alert(data.error); return; }
      // Nếu fallback mock (do 429 upstream) vẫn hiển thị được
      setArticle({ title: data.title, body: data.body, glossary: data.glossary, quiz: data.quiz });
      setShowQuiz(false); setAnswers([]);
    } finally { setLoading(false); }
  };

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  // Audio uses browser synthesis; some voices may require a network connection.
  const speak = (text: string) => {
    if (!text.trim()) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = rate;
    const v = voices.find(v=> v.voiceURI === voiceURI);
    if (v) u.voice = v;
    u.onstart = () => setIsSpeaking(true);
    u.onend = () => setIsSpeaking(false);
    u.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(u);
  };
  const stop = () => { window.speechSynthesis.cancel(); setIsSpeaking(false); };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <HallmarkHeading
        eyebrow="BÀI ĐỌC THEO CHỦ ĐỀ"
        title="Reading & Listening"
        subtitle="Tạo bài đọc bằng AI theo trình độ và chủ đề bạn chọn. Âm mẫu dùng giọng tổng hợp trình duyệt; có bài mẫu dự phòng khi dịch vụ tạo bài không khả dụng."
        action={<div className="flex gap-1 bg-white border rounded-full p-1">{LEVELS.map(lv=> <button key={lv} onClick={()=> setLevel(lv)} className={`px-3 py-1 rounded-full text-xs font-medium ${level===lv ? "bg-zinc-900 text-white" : "text-zinc-600"}`}>{lv}</button>)}</div>}
      />

      <div className="bg-white border rounded-2xl p-4 flex gap-2 flex-wrap">
        <input value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Chủ đề: travel, technology, habits..." className="flex-1 border rounded-xl px-3 py-2 text-sm min-w-[200px]" />
        <button onClick={generate} disabled={loading} className="px-5 py-2.5 bg-zinc-900 text-white rounded-full text-sm font-medium disabled:opacity-50">{loading ? "Đang tạo bài..." : "Tạo bài (AI, có mock fallback)"}</button>
      </div>

      <div className="bg-white border rounded-2xl p-6 shadow-sm">
        <HallmarkSectionTitle title={article.title} subtitle={`${level} • ${article.body.split(" ").length} từ`} />
        <p className="mt-3 leading-7 text-zinc-800 font-serif">{article.body}</p>

        <div className="mt-5 rounded-2xl border-2 border-amber-100 bg-[#FFFBEB]/40 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={()=> isSpeaking ? stop() : speak(article.body)} className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${isSpeaking ? "bg-red-600 text-white" : "bg-zinc-900 text-white"}`}>
              {isSpeaking ? "⏹ Dừng" : "🔊 Nghe (Browser, không AI)"}
            </button>
            <select value={voiceURI} onChange={e=> setVoiceURI(e.target.value)} className="border rounded-full px-3 py-1.5 text-xs bg-white max-w-[200px]">
              {voices.map(v=> <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
            </select>
            <label className="text-xs flex items-center gap-1">Tốc độ <input type="range" min={0.6} max={1.2} step={0.1} value={rate} onChange={e=> setRate(parseFloat(e.target.value))} /> {rate.toFixed(1)}</label>
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">Web Speech API — không tốn AI</span>
          </div>
          <p className="text-xs text-zinc-500 mt-2">Chọn giọng en-US (Google US English / Microsoft Zira) để nghe chuẩn. Không gọi <code>/api/ai/tts</code>, không 429/503.</p>
        </div>
      </div>

      <div className="bg-white border rounded-2xl p-5">
        <HallmarkSectionTitle title="Glossary" subtitle="từ khó" />
        <div className="grid gap-2 mt-3">
          {article.glossary.map(g=> (
            <div key={g.w} className="flex items-center justify-between text-sm border rounded-xl px-3 py-2 bg-[#FFFBEB]/30">
              <span className="font-medium font-serif">{g.w} {g.ipa && <span className="text-amber-700/60 font-mono text-xs">{g.ipa}</span>}</span>
              <span className="flex items-center gap-2">
                <span className="text-zinc-600">{g.m}</span>
                <button onClick={()=> speak(g.w)} className="px-2 py-1 rounded-full bg-white border text-xs">🔊</button>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <HallmarkSectionTitle title="Comprehension Quiz" />
          <button onClick={()=> setShowQuiz(!showQuiz)} className="text-sm px-4 py-1.5 bg-zinc-900 text-white rounded-full">{showQuiz ? "Ẩn" : "Làm quiz"}</button>
        </div>
        {showQuiz && (
          <div className="space-y-3 mt-4">
            {article.quiz.map((q,qi)=> (
              <div key={qi} className="border rounded-xl p-3 bg-zinc-50/50">
                <p className="text-sm font-medium font-serif">{qi+1}. {q.q}</p>
                <div className="grid gap-1.5 mt-2">
                  {q.a.map((opt,oi)=> (
                    <label key={oi} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl cursor-pointer border-2 ${answers[qi]===oi ? (oi===q.correct ? "bg-emerald-50 border-emerald-300" : "bg-red-50 border-red-300") : "bg-white border-zinc-200"}`}>
                      <input type="radio" name={`q-${qi}`} checked={answers[qi]===oi} onChange={()=> setAnswers(prev=>{ const n=[...prev]; n[qi]=oi; return n; })} />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
