"use client";
import { useState, useRef } from "react";
import { HallmarkHeading } from "@/components/HallmarkHeading";

export default function SpeakingPage() {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [feedback, setFeedback] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [target] = useState("Introduce yourself in 30 seconds");
  const [whisperError, setWhisperError] = useState<string | null>(null);
  const [manualTranscript, setManualTranscript] = useState("");
  const [webSpeechTranscript, setWebSpeechTranscript] = useState("");
  const [webSpeechActive, setWebSpeechActive] = useState(false);
  const [sttMode, setSttMode] = useState<"browser" | "ai">("browser"); // browser = Web Speech không AI, ai = Whisper
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const speechRef = useRef<any>(null);

  const authHeaders = () => {
    const h: Record<string, string> = {};
    const k = localStorage.getItem("openai_api_key"); if (k) h["x-openai-key"] = k;
    const b = localStorage.getItem("openai_base_url"); const m = localStorage.getItem("openai_model"); if (b) h["x-openai-base-url"] = b; if (m) h["x-openai-model"] = m;
    return h;
  };

  async function toWavBlob(inputBlob: Blob): Promise<Blob> {
    try {
      const arrayBuffer = await inputBlob.arrayBuffer();
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      const numChannels = audioBuffer.numberOfChannels;
      const sampleRate = audioBuffer.sampleRate;
      const format = 1;
      const bitDepth = 16;
      const bytesPerSample = bitDepth / 8;
      const blockAlign = numChannels * bytesPerSample;
      const byteRate = sampleRate * blockAlign;
      const dataLength = audioBuffer.length * blockAlign;
      const buffer = new ArrayBuffer(44 + dataLength);
      const view = new DataView(buffer);
      writeString(view, 0, "RIFF");
      view.setUint32(4, 36 + dataLength, true);
      writeString(view, 8, "WAVE");
      writeString(view, 12, "fmt ");
      view.setUint32(16, 16, true);
      view.setUint16(20, format, true);
      view.setUint16(22, numChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, byteRate, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, bitDepth, true);
      writeString(view, 36, "data");
      view.setUint32(40, dataLength, true);
      let offset = 44;
      for (let i = 0; i < audioBuffer.length; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
          const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(ch)[i]));
          view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
          offset += 2;
        }
      }
      await ctx.close();
      return new Blob([buffer], { type: "audio/wav" });
    } catch (e) {
      console.warn("[wav convert] failed, fallback to original", e);
      return inputBlob;
    }
  }
  function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  const getFeedback = async (text: string) => {
    const h = authHeaders();
    const fbRes = await fetch("/api/ai/speaking-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...h },
      body: JSON.stringify({ transcript: text, target, level: "B1" }),
    });
    const fbData = await fbRes.json();
    setFeedback(fbData.error ? { error: fbData.error } : fbData);
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const mr = new MediaRecorder(stream, { mimeType: mime });
      mediaRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      // Web Speech API fallback live (Chrome/Edge)
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      let liveTranscript = "";
      if (SR) {
        try {
          const rec = new SR();
          speechRef.current = rec;
          rec.lang = "en-US";
          rec.continuous = true;
          rec.interimResults = true;
          rec.onresult = (event: any) => {
            let interim = "";
            let final = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const res = event.results[i];
              if (res.isFinal) final += res[0].transcript + " ";
              else interim += res[0].transcript + " ";
            }
            const combined = (final || interim).trim();
            if (combined) {
              liveTranscript = combined;
              setWebSpeechTranscript(combined);
            }
          };
          rec.onerror = (e: any) => console.warn("[web speech] error", e.error);
          rec.start();
          setWebSpeechActive(true);
          setWebSpeechTranscript("");
        } catch (e) { console.warn("Web Speech not available", e); }
      }

      mr.onstop = async () => {
        setLoading(true);
        setWhisperError(null);
        try {
          try { speechRef.current?.stop(); setWebSpeechActive(false); } catch {}
          const live = liveTranscript || webSpeechTranscript;

          // Nếu chọn Browser STT → không gọi AI Whisper, dùng live transcript ngay (đúng yêu cầu: không dùng AI để ra text)
          if (sttMode === "browser") {
            if (!live || !live.trim()) {
              setWhisperError("Web Speech không nhận được giọng nói — thử nói to/rõ hơn, kiểm tra quyền mic, hoặc chuyển sang AI Whisper.");
              setTranscript("");
              return;
            }
            setTranscript(live);
            setWhisperError(null);
            await getFeedback(live);
            return;
          }

          // AI Whisper mode
          const rawBlob = new Blob(chunksRef.current, { type: mr.mimeType });
          const wavBlob = await toWavBlob(rawBlob);
          const isWav = wavBlob.type.includes("wav");
          const fileName = isWav ? "recording.wav" : (mime.includes("mp4") ? "recording.m4a" : "recording.webm");
          const h = authHeaders();
          const fd = new FormData();
          fd.append("audio", wavBlob, fileName);
          fd.append("prompt", target);
          const tr = await fetch("/api/ai/transcribe", { method: "POST", headers: h, body: fd });
          const trData = await tr.json();
          if (trData.error) {
            const isNoChannel = String(trData.error).includes("No available channel") || String(trData.error).includes("whisper");
            const isSaturated = String(trData.error).includes("负载已饱和") || String(trData.error).includes("429");
            if ((isNoChannel || isSaturated) && live) {
              setTranscript(live);
              setWhisperError(`Whisper Cheap không có kênh (${trData.error.slice(0,120)}...) — đã tự fallback sang Web Speech.`);
              await getFeedback(live);
              return;
            }
            if (isNoChannel || isSaturated) {
              setWhisperError(`${trData.error} ${trData.hint ? "\n" + trData.hint : ""}`);
              setTranscript("");
              if (live) setManualTranscript(live);
              else setManualTranscript("");
              return;
            }
            setTranscript(`Lỗi Whisper: ${trData.error}`);
            setWhisperError(trData.error + (trData.hint ? "\n" + trData.hint : ""));
            return;
          }
          setTranscript(trData.transcript);
          setWhisperError(null);
          await getFeedback(trData.transcript);
        } catch (e) { setTranscript(String(e)); } finally { setLoading(false); }
      };
      mr.start();
      setRecording(true);
      setTranscript("");
      setFeedback(null);
      setWhisperError(null);
      setManualTranscript("");
    } catch (e) { alert("Không truy cập được micro: " + String(e)); }
  };
  const stop = () => {
    mediaRef.current?.stop();
    mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
    try { speechRef.current?.stop(); } catch {}
    setWebSpeechActive(false);
    setRecording(false);
  };
  const tts = (text: string) => {
    // Nghe không dùng AI — Web Speech API
    if (!text.trim()) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.slice(0, 400));
    u.lang = "en-US"; u.rate = 0.9;
    window.speechSynthesis.speak(u);
  };

  const SRCheck = typeof window !== "undefined" ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;
  const [fileTesting, setFileTesting] = useState(false);
  const [fileTranscript, setFileTranscript] = useState("");

  const testFile = async (file: File) => {
    setFileTesting(true);
    setFileTranscript("");
    try {
      const h = authHeaders();
      const fd = new FormData();
      fd.append("audio", file, file.name);
      fd.append("prompt", "English test");
      const tr = await fetch("/api/ai/transcribe", { method: "POST", headers: h, body: fd });
      const data = await tr.json();
      if (data.error) {
        setFileTranscript(`Lỗi: ${data.error}\nHint: ${data.hint || ""}`);
      } else {
        setFileTranscript(data.transcript);
        // tự chấm luôn
        const fbRes = await fetch("/api/ai/speaking-feedback", { method: "POST", headers: { "Content-Type": "application/json", ...h }, body: JSON.stringify({ transcript: data.transcript, target, level: "B1" }) });
        const fb = await fbRes.json();
        setTranscript(data.transcript);
        setFeedback(fb.error ? { error: fb.error } : fb);
      }
    } catch (e) { setFileTranscript(String(e)); } finally { setFileTesting(false); }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <HallmarkHeading eyebrow="HALLMARK • NÓI & NGHE — KHÔNG AI CHO STT/TTS" title="Luyện nói với AI" subtitle="Ghi âm → Browser STT (Web Speech, không AI) ra text → AI chỉ chấm điểm (GPT). Nghe lại cũng bằng Web Speech của trình duyệt, không gọi /api/ai/tts." />
      <div className="bg-white border rounded-2xl p-4">
        <p className="text-xs font-semibold text-zinc-700">Thư viện STT (mic → text) không dùng AI:</p>
        <div className="mt-2 flex gap-1 bg-zinc-100 p-1 rounded-full w-fit">
          <button onClick={()=> setSttMode("browser")} className={`px-3 py-1.5 rounded-full text-xs font-medium ${sttMode==="browser" ? "bg-zinc-900 text-white" : "text-zinc-600"}`}>🌐 Browser Web Speech (miễn phí, offline, Chrome/Edge)</button>
          <button onClick={()=> setSttMode("ai")} className={`px-3 py-1.5 rounded-full text-xs font-medium ${sttMode==="ai" ? "bg-zinc-900 text-white" : "text-zinc-600"}`}>🤖 AI Whisper (cần API)</button>
        </div>
        <p className="text-[11px] text-zinc-500 mt-1">{sttMode==="browser" ? "Dùng Web Speech API (SpeechRecognition) — không gửi audio lên server, không 429, AI chỉ chấm qua /speaking-feedback." : "Gửi WAV tới ShopAikey/OpenAI Whisper — hay 503 nếu nhóm Cheap không có kênh."} • Thư viện khác: <code>annyang</code>, <code>Vosk (vosk-browser)</code>, <code>whisper.cpp WASM</code> đều offline nhưng Web Speech là nhẹ nhất.</p>
      </div>
      <div className="bg-white border rounded-2xl p-6 text-center space-y-4">
        <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center text-3xl ${recording ? "bg-red-500 text-white animate-pulse" : "bg-zinc-100"}`}>🎤</div>
        <p className="text-sm text-zinc-500">Chủ đề: &quot;{target}&quot; • Level B1 {SRCheck ? `• ${sttMode==="browser" ? "Browser STT sẵn sàng" : "Web Speech fallback sẵn sàng"}` : "• Web Speech không hỗ trợ (Firefox) → dùng nhập tay"}</p>
        {recording && webSpeechActive && webSpeechTranscript && <p className="text-xs bg-blue-50 border border-blue-200 rounded-lg px-3 py-1 text-blue-700">Web Speech live: “{webSpeechTranscript.slice(0,80)}...”</p>}
        <div className="flex justify-center gap-3">
          {!recording ? <button onClick={start} disabled={loading} className="px-6 py-2.5 bg-zinc-900 text-white rounded-full text-sm disabled:opacity-50">{loading ? "Đang xử lý..." : sttMode==="browser" ? "Bắt đầu ghi (Browser)" : "Bắt đầu ghi (AI Whisper)"}</button> : <button onClick={stop} className="px-6 py-2.5 bg-red-600 text-white rounded-full text-sm">Dừng & chấm</button>}
        </div>
        {loading && <p className="text-xs text-zinc-500">{sttMode==="browser" ? "Đang lấy transcript từ Browser → gửi GPT chấm..." : "Đang xử lý WAV → Whisper (thử api/direct) → GPT..."}</p>}
      </div>

      <div className="bg-white border rounded-xl p-5 space-y-3">
        <h3 className="font-semibold">Thử tệp âm thanh (đúng spec AudioTranscriptionRequest)</h3>
        <p className="text-xs text-zinc-600">Body: <code>multipart/form-data</code> với <code>file</code> (binary, required) + <code>model=whisper-1</code> + <code>language</code> + <code>prompt</code> + <code>response_format=json</code> → 200 <code>{`{text: string}`}</code>. Đã tạo sẵn <a href="/sample-en.wav" download className="underline">sample-en.wav</a> (giọng Zira: “Hello, this is a test...”) để bạn thử.</p>
        <div className="flex items-center gap-2">
          <audio controls src="/sample-en.wav" className="flex-1" />
          <a href="/sample-en.wav" download className="text-xs px-3 py-1 border rounded-full">Tải</a>
        </div>
        <input type="file" accept="audio/*,.wav,.mp3,.m4a,.webm,.ogg" onChange={e=>{ const f=e.target.files?.[0]; if(f) testFile(f); }} className="block w-full text-sm file:mr-3 file:px-3 file:py-1 file:rounded-full file:border-0 file:bg-zinc-900 file:text-white" />
        {fileTesting && <p className="text-xs text-zinc-500">Đang gửi file tới POST /v1/audio/transcriptions (qua /api/ai/transcribe)...</p>}
        {fileTranscript && <div className="rounded-lg bg-zinc-50 border p-3 text-sm whitespace-pre-wrap"><b>Kết quả phiên âm:</b> {fileTranscript}</div>}
        <button onClick={()=>{ const a=document.createElement("a"); a.href="/sample-en.wav"; a.download="sample-en.wav"; a.click(); setTimeout(()=>{ fetch("/sample-en.wav").then(r=>r.blob()).then(b=> testFile(new File([b],"sample-en.wav",{type:"audio/wav"}))); },300); }} disabled={fileTesting} className="px-4 py-2 bg-zinc-900 text-white rounded-full text-xs disabled:opacity-50">Thử ngay sample-en.wav →</button>
      </div>
      {whisperError && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-amber-900">Whisper Cheap tạm lỗi — đã bật fallback</h3>
          <p className="text-xs text-amber-800 whitespace-pre-wrap break-words">{whisperError}</p>
          {webSpeechTranscript && <p className="text-xs bg-white border rounded-lg p-2">Web Speech vừa nghe: <b>{webSpeechTranscript}</b> → bấm “Dùng Web Speech” để chấm ngay.</p>}
          <div className="space-y-2">
            <label className="text-sm font-medium">Nhập/sửa transcript (vẫn chấm được bằng GPT):</label>
            <textarea value={manualTranscript} onChange={e=>setManualTranscript(e.target.value)} placeholder={webSpeechTranscript || "I introduced myself for 30 seconds..."} rows={3} className="w-full border rounded-lg p-2 text-sm" />
            <div className="flex gap-2 flex-wrap">
              {webSpeechTranscript && <button onClick={async ()=>{
                setLoading(true);
                try { await getFeedback(webSpeechTranscript); setTranscript(webSpeechTranscript); setWhisperError(null); } finally {setLoading(false);}
              }} className="px-4 py-2 bg-blue-600 text-white rounded-full text-sm">Dùng Web Speech →</button>}
              <button onClick={async ()=>{
                if(!manualTranscript.trim() && !webSpeechTranscript.trim()) return;
                const txt = manualTranscript.trim() || webSpeechTranscript;
                setLoading(true);
                try { await getFeedback(txt); setTranscript(txt); setWhisperError(null); } finally {setLoading(false);}
              }} disabled={loading} className="px-4 py-2 bg-zinc-900 text-white rounded-full text-sm disabled:opacity-50">Gửi chấm GPT →</button>
              <button onClick={()=>{ setWhisperError(null); setManualTranscript(""); }} className="px-4 py-2 border rounded-full text-sm">Đóng</button>
            </div>
            <p className="text-xs text-zinc-500">ShopAikey Cheap hiện báo <code>No available channel for model whisper-*</code> — Whisper không có kênh. Web Speech API chạy <b>offline trên trình duyệt</b> (Chrome/Edge) nên vẫn học được. Để Whisper hoạt động: nâng cấp group ShopAikey hoặc dùng key OpenAI gốc.</p>
          </div>
        </div>
      )}
      {transcript && (
        <div className="bg-white border rounded-xl p-5 space-y-3">
          <h3 className="font-semibold">Kết quả</h3>
          <p className="text-sm"><b>Transcript:</b> {transcript} {whisperError && webSpeechTranscript && <span className="text-xs text-blue-600">(từ Web Speech)</span>}</p>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => tts(transcript)} className="text-xs px-3 py-1 border rounded-full bg-zinc-900 text-white">🔊 Nghe (Browser, không AI)</button>
            <span className="text-xs text-zinc-500 self-center">Web Speech API • en-US • không tốn AI</span>
          </div>
          {feedback && (
            <div className="space-y-2">
              {feedback.error ? <p className="text-sm text-red-600">{feedback.error}</p> : (
                <>
                  <p className="text-sm">Điểm: <b>{feedback.score}/100</b> • Sửa: <i>{feedback.correctedTranscript}</i></p>
                  {feedback.pronunciation && <div className="text-xs bg-zinc-50 border rounded-lg p-3">{feedback.pronunciation.map((p: any, i: number) => <div key={i}><b>{p.word}</b> {p.ipa} — {p.tip}</div>)}</div>}
                  {feedback.grammarFixes && <ul className="text-sm list-disc pl-5">{feedback.grammarFixes.map((g: string, i: number) => <li key={i}>{g}</li>)}</ul>}
                  {feedback.nextExercise && <p className="text-sm bg-blue-50 border border-blue-200 rounded-lg p-3">Bài tập: {feedback.nextExercise}</p>}
                </>
              )}
            </div>
          )}
        </div>
      )}
      <div className="bg-zinc-50 border rounded-xl p-3 text-xs text-zinc-600">
        <b>Lưu ý ShopAikey:</b> TTS <code>/tts/openai/speech</code> vẫn OK (trả S3 url) — chỉ STT <code>/v1/audio/transcriptions</code> với <code>whisper-*</code> trên nhóm Cheap là <b>503 No available channel</b>. Đã bật Web Speech fallback để không chặn luyện nói.
      </div>
    </div>
  );
}
