"use client";

import { useState } from "react";
import { HallmarkHeading } from "@/components/HallmarkHeading";

export default function TranslateAudioPage() {
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState("whisper-1");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const translate = async (selected = file) => {
    if (!selected) return;
    setLoading(true); setResult(""); setError("");
    try {
      const form = new FormData();
      form.append("file", selected, selected.name);
      form.append("model", model);
      form.append("response_format", "json");
      const key = localStorage.getItem("openai_api_key");
      const base = localStorage.getItem("openai_base_url");
      const headers: Record<string, string> = {};
      if (key) headers["x-openai-key"] = key;
      if (base) headers["x-openai-base-url"] = base;
      const response = await fetch("/api/ai/translate-audio", { method: "POST", headers, body: form });
      const data = await response.json();
      if (!response.ok || data.error) setError(`${data.error || "Lỗi không xác định"}\n${data.details || ""}`);
      else setResult(data.text || JSON.stringify(data, null, 2));
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <HallmarkHeading eyebrow="HALLMARK • DỊCH ÂM THANH" title="Dịch âm thanh" subtitle="Chuyển tệp âm thanh sang văn bản tiếng Anh bằng POST /v1/audio/translations — vẫn cần Whisper (nếu Cheap không có kênh sẽ fallback)." />

      <div className="bg-white border rounded-2xl p-6 space-y-4">
        <div className="rounded-xl bg-zinc-950 text-zinc-100 p-4 font-mono text-xs overflow-auto">
          <div className="text-emerald-400">POST /v1/audio/translations</div>
          <div>Authorization: Bearer YOUR_SECRET_TOKEN</div>
          <div>Content-Type: multipart/form-data</div>
          <div>file: audio.wav • model: {model} • response_format: json</div>
        </div>
        <div className="flex gap-2">
          <select value={model} onChange={e=>setModel(e.target.value)} className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white">
            <option value="whisper-1">whisper-1 (đúng cho STT/dịch)</option>
            <option value="tts-1-hd-1106">tts-1-hd-1106 (thử theo yêu cầu — sẽ báo lỗi vì là TTS)</option>
          </select>
          <span className="text-xs text-zinc-500 self-center">Thử tts-1-hd-1106 để thấy lỗi</span>
        </div>
        <label className="block border-2 border-dashed border-amber-200 rounded-2xl p-8 text-center cursor-pointer hover:bg-amber-50/50">
          <input type="file" accept="audio/*,.wav,.mp3,.m4a,.webm,.ogg" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
          <div className="text-3xl">🎧</div>
          <div className="mt-2 text-sm font-medium">Chọn file âm thanh tiếng Anh</div>
          <div className="mt-1 text-xs text-zinc-500">WAV, MP3, M4A, WebM, OGG</div>
          {file && <div className="mt-3 text-sm text-amber-700">{file.name} • {(file.size / 1024).toFixed(0)} KB</div>}
        </label>
        <button onClick={() => translate()} disabled={!file || loading} className="w-full px-5 py-3 bg-zinc-900 text-white rounded-xl text-sm font-medium disabled:opacity-50">
          {loading ? "Đang dịch âm thanh..." : "Dịch sang tiếng Anh →"}
        </button>
      </div>

      {result && <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5"><h2 className="font-semibold text-emerald-900">Dịch thành công</h2><p className="mt-3 text-sm leading-7 whitespace-pre-wrap">{result}</p><button onClick={() => speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance(result), { lang: "en-US" }))} className="mt-4 px-4 py-2 border border-emerald-300 rounded-full text-xs">🔊 Nghe kết quả</button></div>}
      {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-5"><h2 className="font-semibold text-red-900">Dịch thất bại</h2><p className="mt-2 text-xs text-red-700 whitespace-pre-wrap break-words">{error}</p><p className="mt-3 text-xs text-zinc-600">Nếu báo <code>No available channel</code>, key ShopAIKey hiện tại không có kênh Whisper. Đổi Direct, đợi upstream hồi phục, hoặc dùng group có Whisper/OpenAI key.</p></div>}

      <div className="bg-zinc-50 border rounded-xl p-4 text-xs text-zinc-600"><b>Khác với Phiên âm:</b> endpoint <code>translations</code> dịch audio sang tiếng Anh; endpoint <code>transcriptions</code> giữ nguyên ngôn ngữ gốc. Cả hai đều yêu cầu <code>file</code> và <code>model=whisper-1</code>.</div>
    </div>
  );
}
