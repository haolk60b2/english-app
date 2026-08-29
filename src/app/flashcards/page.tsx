"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { INTERVALS_DAYS, stageLabel, stageColor, isDueToday } from "@/lib/leitner";

// Hallmark premium palette
export default function FlashcardsPage() {
  const { cards, reviewLeitner, addCardsBulk, addCard, importSeed, progress, markDailyGen } = useStore();
  const [showBack, setShowBack] = useState(false);
  const [mode, setMode] = useState<"learn" | "review" | "all">("review");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [level, setLevel] = useState("B1");
  const [aiLoading, setAiLoading] = useState(false);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [ttsLoading, setTtsLoading] = useState<string | null>(null);
  const [ttsVoice, setTtsVoice] = useState("alloy");
  const [ttsModel, setTtsModel] = useState("browser"); // browser = Web Speech API (miễn phí, không AI)
  const [webVoices, setWebVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [webVoiceURI, setWebVoiceURI] = useState<string>("");

  useEffect(() => { importSeed(); }, [importSeed]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(""), 2500); return () => clearTimeout(t); } }, [toast]);
  useEffect(() => {
    const loadVoices = () => {
      const vs = window.speechSynthesis?.getVoices() || [];
      const en = vs.filter(v=> v.lang.toLowerCase().startsWith("en"));
      setWebVoices(en.length? en : vs);
      if (!webVoiceURI && en.length) setWebVoiceURI(en[0].voiceURI);
    };
    loadVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const newToday = cards.filter(c => c.createdAt?.slice(0, 10) === todayStr);
  const dueCards = cards.filter(c => isDueToday(c.due)).sort((a, b) => a.leitnerStage - b.leitnerStage || new Date(a.due).getTime() - new Date(b.due).getTime());
  const byStage: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  cards.forEach(c => { byStage[c.leitnerStage ?? 0] = (byStage[c.leitnerStage ?? 0] || 0) + 1; });
  const kpiGoal = progress.dailyGoal || 20;
  const kpiNew = newToday.length;
  const kpiProgress = Math.min(100, Math.round((kpiNew / kpiGoal) * 100));
  const dueProgress = cards.length ? Math.round(((cards.length - dueCards.length) / cards.length) * 100) : 0;

  // queue theo mode
  const queue = mode === "learn" ? cards.filter(c => c.createdAt?.slice(0, 10) === todayStr).sort((a,b)=> new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) : mode === "review" ? dueCards : cards;
  const current = queue[0];

  const handleAnswer = (correct: boolean) => {
    if (!current) return;
    reviewLeitner(current.id, correct);
    setShowBack(false);
    if (correct) setToast("✨ +10 XP • Lên lịch " + INTERVALS_DAYS[Math.min(current.leitnerStage, 5)] + " ngày sau");
    else setToast("💪 Không sao, ôn lại sau 1 ngày nhé!");
  };

  const generateDaily = async () => {
    setDailyLoading(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const k = localStorage.getItem("openai_api_key"); if (k) headers["x-openai-key"] = k;
      const b = localStorage.getItem("openai_base_url"); if (b) headers["x-openai-base-url"] = b;
      const m = localStorage.getItem("openai_model"); if (m) headers["x-openai-model"] = m;
      // Gửi toàn bộ từ đã học (mọi ngày) để đảm bảo không trùng tuyệt đối
      const exclude = cards.map(c => c.front);
      const remaining = Math.max(1, kpiGoal - kpiNew);
      const count = kpiNew >= kpiGoal ? kpiGoal : remaining; // nếu đã đủ KPI, tạo thêm 1 batch mới
      const before = cards.length;
      const res = await fetch("/api/ai/daily-words", { method: "POST", headers, body: JSON.stringify({ count, level, exclude }) });
      const data = await res.json();
      if (data.error && !data.words && !data.fallback) { alert(data.error); return; }
      const words = data.words || data.fallback || [];
      addCardsBulk(words);
      // tính thực tế đã thêm (store đã tự loại trùng)
      const after = useStore.getState().cards.length;
      const actuallyAdded = after - before;
      const dupFiltered = words.length - actuallyAdded;
      markDailyGen(todayStr);
      if (actuallyAdded === 0) setToast(`⚠️ Tất cả ${words.length} từ AI trả về đều đã học rồi — đã tự loại bỏ trùng, thử đổi level/chủ đề nhé!`);
      else if (dupFiltered > 0) setToast(`🎉 Đã thêm ${actuallyAdded}/${words.length} từ mới • ${dupFiltered} từ trùng đã tự loại • ${data.mock ? "fallback" : data.topic}`);
      else setToast(`🎉 Đã thêm ${actuallyAdded} từ mới level ${level} • ${data.mock ? "fallback ✓" : data.topic + " • " + data.model} • Không trùng ngày trước ✓`);
    } catch (e) { alert(String(e)); } finally { setDailyLoading(false); }
  };

  const handleAiSingle = async () => {
    if (!front) return;
    setAiLoading(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const k = localStorage.getItem("openai_api_key"); if (k) headers["x-openai-key"] = k;
      const b = localStorage.getItem("openai_base_url"); if (b) headers["x-openai-base-url"] = b;
      const m = localStorage.getItem("openai_model"); if (m) headers["x-openai-model"] = m;
      const res = await fetch("/api/ai/explain", { method: "POST", headers, body: JSON.stringify({ word: front, level }) });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { if (data.backVi) setBack(data.backVi); if (data.phonetic) setToast(`IPA ${data.phonetic}`); }
    } finally { setAiLoading(false); }
  };

  const playTts = async (text: string, key?: string) => {
    if (!text.trim()) return;
    const id = key || text;
    setTtsLoading(id);
    // Ưu tiên Web Speech API (miễn phí, không AI, không 429/503) — đúng yêu cầu "đừng xài AI"
    if (ttsModel === "browser") {
      try {
        if (!("speechSynthesis" in window)) throw new Error("Trình duyệt không hỗ trợ Web Speech");
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text.slice(0, 400));
        u.lang = "en-US";
        u.rate = 0.9;
        u.pitch = 1;
        const v = webVoices.find(v=> v.voiceURI === webVoiceURI);
        if (v) u.voice = v;
        window.speechSynthesis.speak(u);
        setTimeout(()=> setTtsLoading(null), 800);
        return;
      } catch (e) { setToast(String(e).slice(0,120)); setTtsLoading(null); return; }
    }
    // Fallback AI (khi user chọn AI)
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const k = localStorage.getItem("openai_api_key"); if (k) headers["x-openai-key"] = k;
      const b = localStorage.getItem("openai_base_url"); if (b) headers["x-openai-base-url"] = b;
      const payload: any = { text: text.slice(0, 400), model: ttsModel, voice: ttsVoice };
      if (ttsModel === "speech-02-hd" && ttsVoice === "alloy") payload.voice = "male-qn-qingse";
      const res = await fetch("/api/ai/tts", { method: "POST", headers, body: JSON.stringify(payload) });
      if (!res.ok) {
        const err = await res.json().catch(()=>({error: res.statusText}));
        setToast(`TTS AI lỗi 429/503: ${err.error || JSON.stringify(err).slice(0,100)} → thử chuyển sang Browser`);
        // tự fallback sang browser
        if ("speechSynthesis" in window) {
          const u = new SpeechSynthesisUtterance(text.slice(0,400)); u.lang="en-US"; u.rate=0.9; window.speechSynthesis.speak(u);
        }
        return;
      }
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const data = await res.json();
        if (data.url) { new Audio(data.url).play(); return; }
      }
      const blob = await res.blob();
      new Audio(URL.createObjectURL(blob)).play();
    } catch (e) { setToast(String(e).slice(0,120)); } finally { setTtsLoading(null); }
  };

  return (
    <div className="space-y-6">
      {/* Hallmark Hero KPI */}
      <div className="relative overflow-hidden rounded-[28px] border border-amber-200/60 bg-gradient-to-br from-[#FFFBEB] via-white to-[#FFF7ED] p-5 md:p-7 shadow-[0_20px_60px_-20px_rgba(120,53,15,0.25)]">
        <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-gradient-to-br from-amber-200/40 to-rose-200/40 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-amber-100 blur-xl" />
        <div className="relative flex flex-wrap gap-4 items-start justify-between">
          <div>
            <p className="text-xs tracking-[0.2em] text-amber-700/70 font-semibold">HALLMARK • HỌC LÀ QUÀ TẶNG</p>
            <h1 className="mt-1 text-2xl md:text-3xl font-serif font-bold text-zinc-900">Mỗi ngày 20 từ — Nhớ cả đời</h1>
            <p className="mt-2 text-sm text-zinc-600 max-w-xl">Lịch vàng <b>1–3–7–14–30–60 ngày</b> như thiệp Hallmark: càng mở, càng nhớ. Hoàn thành KPI hôm nay để giữ lửa streak 🔥</p>
            <p className="mt-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 inline-block px-2 py-1 rounded-full">✓ Quy tắc mới: 20 từ mỗi ngày <b>tuyệt đối không trùng</b> với bất kỳ ngày trước nào — hệ thống tự loại bỏ trùng trước khi lưu</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="px-3 py-1.5 rounded-full bg-zinc-900 text-white text-xs font-medium">🔥 Streak {progress.streak} ngày</span>
              <span className="px-3 py-1.5 rounded-full bg-white border text-xs">⭐ XP {progress.xp} • Lv.{progress.level}</span>
              <span className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 text-xs border border-amber-200">{dueCards.length} từ đến hạn</span>
              <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs border border-emerald-200">{kpiNew}/{kpiGoal} từ mới hôm nay</span>
            </div>
          </div>
          <div className="flex gap-3">
            <KpiRing label="KPI hôm nay" value={kpiProgress} sub={`${kpiNew}/${kpiGoal}`} color="#d97706" />
            <KpiRing label="Đã ôn" value={dueProgress} sub={`${cards.length - dueCards.length}/${cards.length}`} color="#059669" />
          </div>
        </div>

        {/* Timeline 1-3-7-14-30-60 */}
        <div className="relative mt-6 grid grid-cols-3 md:grid-cols-6 gap-2">
          {INTERVALS_DAYS.map((d, i) => {
            const stage = (i + 1) as any;
            const count = byStage[stage] || 0;
            const isNext = dueCards[0]?.leitnerStage === stage;
            return (
              <div key={i} className={`rounded-2xl border p-3 text-center bg-white/80 backdrop-blur ${isNext ? "ring-2 ring-amber-400 border-amber-300" : "border-zinc-200"}`}>
                <div className="text-[11px] tracking-widest text-zinc-500">LẦN {i + 1}</div>
                <div className="font-bold text-zinc-900">{d} ngày</div>
                <div className="text-[11px] text-zinc-500">{["Ngày 1","Ngày 4","Ngày 11","Ngày 25","Ngày 55","60+ ngày"][i]}</div>
                <div className={`mt-2 inline-flex px-2 py-1 rounded-full text-xs font-medium ${stageColor(stage)}`}>{count} thẻ</div>
                {isNext && <div className="mt-1 text-[10px] text-amber-700 font-semibold">— đang ôn —</div>}
              </div>
            );
          })}
        </div>
        <div className="mt-3 text-xs text-zinc-500 text-center">Ảnh bạn gửi: sau mỗi lần nhớ, khoảng cách tăng dần — tổng 1 → 4 → 11 → 25 → 55 → 4-6 tháng. Quên thì quay về Ngày 1.</div>
      </div>

      {/* Actions bar */}
      <div className="flex flex-wrap gap-2 items-center justify-between bg-white border rounded-2xl p-3">
        <div className="flex gap-1 bg-zinc-100 p-1 rounded-full">
          {(["review","learn","all"] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setShowBack(false); }} className={`px-4 py-1.5 rounded-full text-sm font-medium ${mode===m ? "bg-zinc-900 text-white shadow" : "text-zinc-600"}`}>
              {m==="review" ? `Ôn tập • ${dueCards.length}` : m==="learn" ? `20 từ mới • ${newToday.length}` : `Tất cả • ${cards.length}`}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <select value={level} onChange={e=>setLevel(e.target.value)} className="border rounded-full px-3 py-1.5 text-sm bg-white">
            {["A1","A2","B1","B2","C1"].map(l=> <option key={l} value={l}>{l}</option>)}
          </select>
          <select value={ttsModel} onChange={e=>setTtsModel(e.target.value)} className="border rounded-full px-2 py-1.5 text-xs bg-white" title="TTS model">
            <option value="browser">🔊 Browser (Web Speech - Miễn phí, không AI)</option>
            <option value="tts-1">tts-1 (OpenAI AI)</option>
            <option value="speech-02-hd">speech-02-hd (MiniMax AI)</option>
          </select>
          {ttsModel === "browser" ? (
            <select value={webVoiceURI} onChange={e=>setWebVoiceURI(e.target.value)} className="border rounded-full px-2 py-1.5 text-xs bg-white max-w-[160px]" title="Giọng browser">
              {webVoices.map(v=> <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
            </select>
          ) : (
            <select value={ttsVoice} onChange={e=>setTtsVoice(e.target.value)} className="border rounded-full px-2 py-1.5 text-xs bg-white" title="Giọng AI">
              <option value="alloy">alloy</option>
              <option value="nova">nova</option>
              <option value="shimmer">shimmer</option>
              <option value="echo">echo</option>
              <option value="fable">fable</option>
              <option value="onyx">onyx</option>
            </select>
          )}
          <button onClick={generateDaily} disabled={dailyLoading} className="px-5 py-2 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 text-white text-sm font-medium shadow hover:opacity-95 disabled:opacity-50">
            {dailyLoading ? "Đang tạo 20 từ..." : kpiNew >= kpiGoal ? "✨ Đã đủ KPI • Tạo thêm?" : `🎁 Tạo ${kpiGoal - kpiNew} từ còn lại`}
          </button>
        </div>
      </div>

      {/* Card Hallmark */}
      {!current ? (
        <div className="rounded-[28px] border border-dashed bg-white p-8 text-center">
          <p className="text-3xl">🎉</p>
          <p className="mt-2 text-lg font-serif font-semibold">{mode==="learn" ? "Chưa có từ mới hôm nay" : mode==="review" ? "Hết từ đến hạn — xuất sắc!" : "Chưa có thẻ nào"}</p>
          <p className="text-sm text-zinc-500 mt-1">{mode==="review" ? "Quay lại sau nhé, FSRS/Leitner đã lên lịch cho ngày tới." : `Bấm "Tạo ${kpiGoal} từ" để bắt đầu hành trình Hallmark hôm nay.`}</p>
          {mode!=="learn" && kpiNew < kpiGoal && <button onClick={()=>setMode("learn")} className="mt-4 px-5 py-2 bg-zinc-900 text-white rounded-full text-sm">Sang học 20 từ mới →</button>}
        </div>
      ) : (
        <div className="max-w-[640px] mx-auto">
          <div className="text-center text-xs text-zinc-500 mb-2">{queue.indexOf(current)+1} / {queue.length} • {mode==="learn" ? "HỌC MỚI" : "ÔN TẬP"} • Nhấn thẻ để lật</div>
          <div
            onClick={() => setShowBack(!showBack)}
            className={`relative cursor-pointer rounded-[24px] border-2 bg-[#FFFBEB] p-[1px] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.25)] transition-all duration-300 ${showBack ? "scale-[0.99]" : "hover:scale-[1.01]"}`}
          >
            <div className="rounded-[22px] bg-white p-6 md:p-8" style={{ backgroundImage: "radial-gradient(#fff7ed 1px, transparent 1px)", backgroundSize: "18px 18px" }}>
              <div className="flex items-center justify-between text-xs">
                <span className={`px-2.5 py-1 rounded-full border text-xs font-medium ${stageColor(current.leitnerStage as any)}`}>{stageLabel(current.leitnerStage as any)} • due {new Date(current.due).toLocaleDateString("vi-VN")}</span>
                <span className="px-2.5 py-1 rounded-full bg-zinc-900 text-white">{current.level} • {current.tags?.[0] || "vocab"}</span>
              </div>

              <div className="mt-6 text-center">
                <p className="font-serif text-[28px] md:text-[34px] font-bold tracking-tight text-zinc-900 leading-tight">{current.front}</p>
                {current.phonetic && <p className="mt-1 text-sm text-amber-700/70 font-mono">{current.phonetic}</p>}
                <div className="mt-2 flex justify-center gap-2">
                  <button onClick={(e)=>{ e.stopPropagation(); playTts(current.front, current.id); }} disabled={ttsLoading===current.id} className="px-3 py-1.5 rounded-full bg-zinc-900 text-white text-xs flex items-center gap-1.5 disabled:opacity-50">
                    {ttsLoading===current.id ? "⏳" : "🔊"} Nghe từ
                  </button>
                  {current.example && <button onClick={(e)=>{ e.stopPropagation(); playTts(current.example!, current.id+"-ex"); }} disabled={ttsLoading===current.id+"-ex"} className="px-3 py-1.5 rounded-full border bg-white text-xs flex items-center gap-1.5 disabled:opacity-50">🔊 Nghe câu</button>}
                </div>
                <div className="mx-auto mt-4 h-px w-24 bg-gradient-to-r from-transparent via-amber-200 to-transparent" />
                {!showBack ? (
                  <p className="mt-6 text-sm text-zinc-400 italic">Chạm để xem nghĩa — Active Recall: cố nhớ 5 giây trước khi lật 💭</p>
                ) : (
                  <div className="mt-6 animate-in fade-in">
                    <p className="text-xl font-medium text-zinc-900">{current.back}</p>
                    {current.example && (
                      <div className="mt-3 rounded-2xl bg-amber-50 border border-amber-100 p-3 text-left">
                        <p className="text-sm text-zinc-800 italic">“{current.example}”</p>
                        {current.exampleVi && <p className="text-xs text-zinc-500 mt-1">→ {current.exampleVi}</p>}
                        <button onClick={()=> playTts(current.example!, current.id+"-ex2")} disabled={ttsLoading===current.id+"-ex2"} className="mt-2 text-xs px-2 py-1 rounded-full bg-white border">🔊 Nghe</button>
                      </div>
                    )}
                    <p className="mt-3 text-xs text-zinc-500">Khoảng cách tiếp theo nếu nhớ: <b>{INTERVALS_DAYS[Math.min(current.leitnerStage, 5)]} ngày</b> • Quên: quay về 1 ngày</p>
                  </div>
                )}
              </div>

              {/* Hallmark foil corner */}
              <div className="absolute right-4 top-4 h-8 w-8 rounded-full bg-gradient-to-br from-amber-300 to-rose-300 opacity-20 blur-sm" />
            </div>
          </div>

          {showBack ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button onClick={() => handleAnswer(false)} className="rounded-2xl bg-white border-2 border-rose-200 p-4 text-left hover:bg-rose-50 transition">
                <div className="text-sm font-bold text-rose-700">😵 Quên rồi</div>
                <div className="text-xs text-rose-600/70">Về Ngày 1 • 1 ngày sau gặp lại</div>
              </button>
              <button onClick={() => handleAnswer(true)} className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-4 text-left text-white shadow-lg hover:opacity-95 transition">
                <div className="text-sm font-bold">😊 Nhớ rồi!</div>
                <div className="text-xs text-white/80">Lên {stageLabel(((Math.min(6, (current.leitnerStage||0)+1)) as any))} • +10 XP</div>
              </button>
            </div>
          ) : (
            <button onClick={() => setShowBack(true)} className="mx-auto mt-4 block px-6 py-2.5 rounded-full bg-zinc-900 text-white text-sm font-medium">Lật thẻ ✨</button>
          )}

          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-zinc-400">
            <span>Phím tắt:</span>
            <kbd className="px-1.5 py-0.5 bg-white border rounded text-[11px]">Space</kbd> lật •
            <kbd className="px-1.5 py-0.5 bg-white border rounded text-[11px]">1</kbd> Quên •
            <kbd className="px-1.5 py-0.5 bg-white border rounded text-[11px]">2</kbd> Nhớ
          </div>
        </div>
      )}

      {/* Add single word (Hallmark craft) */}
      <div className="rounded-2xl bg-white border p-5 max-w-[640px] mx-auto">
        <h3 className="font-serif font-semibold">Thêm thủ công ✍️</h3>
        <div className="grid gap-2 mt-3">
          <div className="grid md:grid-cols-2 gap-2">
            <input value={front} onChange={e=>setFront(e.target.value)} placeholder="Từ tiếng Anh (ví dụ: serendipity)" className="border rounded-xl px-3 py-2 text-sm" />
            <input value={back} onChange={e=>setBack(e.target.value)} placeholder="Nghĩa tiếng Việt" className="border rounded-xl px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAiSingle} disabled={aiLoading || !front} className="px-4 py-2 bg-zinc-900 text-white rounded-full text-sm disabled:opacity-50">{aiLoading ? "..." : "AI gợi ý nghĩa"}</button>
            <button onClick={()=>{
              if(!front||!back) return;
              const key = front.toLowerCase().trim();
              if (cards.some(c=> c.front.toLowerCase().trim()===key)) { setToast(`⚠️ "${front}" đã học rồi — không thêm trùng!`); return; }
              addCard(front, back, undefined, level); setFront(""); setBack(""); setToast("Đã thêm thẻ mới! ✓ Không trùng");
            }} className="px-4 py-2 border rounded-full text-sm bg-white">Thêm thẻ</button>
          </div>
        </div>
      </div>

      {/* Hallmark gallery */}
      <details className="rounded-2xl bg-white border p-5">
        <summary className="font-serif font-semibold cursor-pointer">Bộ sưu tập Hallmark • {cards.length} thẻ</summary>
        <div className="mt-3 grid md:grid-cols-3 gap-2">
          {cards.slice(0, 30).map(c=> (
            <div key={c.id} className="rounded-xl border bg-[#FFFBEB]/50 p-3 text-sm flex flex-col">
              <div className="font-medium font-serif flex items-center gap-1">{c.front} <button onClick={()=> playTts(c.front, c.id)} disabled={ttsLoading===c.id} className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-white border hover:bg-zinc-900 hover:text-white transition">🔊</button> <span className="text-zinc-500 font-sans">— {c.back}</span></div>
              <div className="mt-1 flex gap-1 flex-wrap">
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${stageColor(c.leitnerStage as any)}`}>{stageLabel(c.leitnerStage as any)}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white border">{c.level}</span>
                <span className="text-[11px] text-zinc-400">due {new Date(c.due).toLocaleDateString("vi-VN")}</span>
              </div>
            </div>
          ))}
        </div>
        {cards.length>30 && <p className="text-xs text-zinc-500 mt-2">+ {cards.length-30} thẻ nữa...</p>}
      </details>

      {toast && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-zinc-900 text-white px-4 py-2 rounded-full text-sm shadow-lg z-50">{toast}</div>}
    </div>
  );
}

function KpiRing({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  const r = 28, c = 2 * Math.PI * r, off = c - (value / 100) * c;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white border px-3 py-2">
      <div className="relative h-14 w-14">
        <svg className="h-14 w-14 -rotate-90">
          <circle cx="28" cy="28" r={r} stroke="#f4f4f5" strokeWidth="6" fill="none" />
          <circle cx="28" cy="28" r={r} stroke={color} strokeWidth="6" fill="none" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-xs font-bold">{value}%</span>
      </div>
      <div>
        <div className="text-xs text-zinc-500">{label}</div>
        <div className="text-sm font-bold">{sub}</div>
      </div>
    </div>
  );
}
