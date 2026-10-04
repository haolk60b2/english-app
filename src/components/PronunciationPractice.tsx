"use client";

import { useEffect, useRef, useState } from "react";
import { scoreSpokenWord } from "@/lib/pronunciation";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

export default function PronunciationPractice({ word, phonetic, hideTarget = false, onRecognized }: { word: string; phonetic?: string; hideTarget?: boolean; onRecognized?: (text: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ heard: string; score: number } | null>(null);
  const [recordingUrl, setRecordingUrl] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const url = useRef<string | null>(null);
  const mounted = useRef(true);
  const starting = useRef(false);

  function releaseMic() {
    if (timer.current) clearTimeout(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      recognition.current?.abort();
      releaseMic();
      if (url.current) URL.revokeObjectURL(url.current);
    };
  }, []);

  async function start() {
    if (starting.current || recognition.current) return;
    const Constructor = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!Constructor) { setError("Trình duyệt chưa hỗ trợ nhận diện giọng nói. Hãy mở bằng Chrome hoặc Edge."); return; }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setError("Ghi âm cần HTTPS hoặc localhost và trình duyệt hỗ trợ microphone."); return; }
    starting.current = true;
    setBusy(true);
    setError("");
    setResult(null);
    if (url.current) URL.revokeObjectURL(url.current);
    setRecordingUrl("");
    try {
      window.speechSynthesis?.cancel();
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { mic.getTracks().forEach(track => track.stop()); return; }
      stream.current = mic;
      const chunks: Blob[] = [];
      const recording = new MediaRecorder(mic);
      recorder.current = recording;
      recording.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recording.onstop = () => {
        if (!mounted.current || !chunks.length) return;
        const blob = new Blob(chunks, { type: recording.mimeType });
        if (url.current) URL.revokeObjectURL(url.current);
        url.current = URL.createObjectURL(blob);
        setRecordingUrl(url.current);
      };
      const speech = new Constructor();
      recognition.current = speech;
      speech.lang = "en-US";
      speech.continuous = false;
      speech.interimResults = false;
      speech.maxAlternatives = 1;
      let received = false;
      let failed = false;
      speech.onresult = event => {
        if (!mounted.current) return;
        const heard = event.results[0]?.[0]?.transcript?.trim() || "";
        if (!heard) return;
        received = true;
        setResult({ heard, score: scoreSpokenWord(word, heard) });
        onRecognized?.(heard);
      };
      speech.onerror = event => {
        failed = true;
        if (!mounted.current) return;
        const messages: Record<string, string> = {
          "not-allowed": "Bạn cần cho phép microphone để luyện phát âm.",
          "no-speech": "Chưa nghe thấy giọng nói. Hãy đọc gần microphone và thử lại.",
          "network": "Dịch vụ nhận diện giọng nói không kết nối được. Kiểm tra mạng rồi thử lại.",
          "audio-capture": "Không tìm thấy microphone khả dụng.",
        };
        setError(messages[event.error] || "Không nhận diện được. Hãy thử lại.");
      };
      speech.onend = () => {
        releaseMic();
        recognition.current = null;
        if (!mounted.current) return;
        setBusy(false);
        setListening(false);
        if (!received && !failed) setError("Chưa nhận được từ nào. Hãy thử đọc lại.");
      };
      recording.start();
      speech.start();
      setListening(true);
      timer.current = setTimeout(() => { speech.stop(); releaseMic(); if (mounted.current) { setListening(false); setBusy(true); } }, 10000);
    } catch (cause) {
      recognition.current?.abort();
      recognition.current = null;
      releaseMic();
      if (mounted.current) { setListening(false); setError(cause instanceof DOMException && cause.name === "NotAllowedError" ? "Bạn cần cho phép microphone để luyện phát âm." : "Không khởi động được microphone. Hãy thử lại."); }
    } finally {
      starting.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <section className="mt-4 rounded-2xl border bg-white p-4" aria-label="Luyện phát âm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Kiểm tra phát âm từ</h3>
        <button type="button" disabled={busy} onClick={() => { if (listening) { recognition.current?.stop(); releaseMic(); setListening(false); setBusy(true); } else void start(); }} className={`rounded-full px-4 py-2 text-sm text-white disabled:opacity-50 ${listening ? "bg-rose-600" : "bg-zinc-900"}`}>
          {busy ? "Đang mở mic…" : listening ? "Dừng ghi âm" : "🎙 Đọc thử"}
        </button>
      </div>
      <p className="mt-2 text-sm text-zinc-600">{hideTarget ? "Nhìn nghĩa và tự nói từ tiếng Anh, không xem đáp án." : `Nghe mẫu, sau đó đọc “${word}” ${phonetic || ""}.`} Mỗi lượt tối đa 10 giây.</p>
      <div role="status" aria-live="polite" className="mt-2 text-sm">
        {listening && <p className="text-rose-700">Đang nghe…</p>}
        {error && <p className="text-rose-700">{error}</p>}
        {result && (
          <div className="mt-3 rounded-xl border bg-zinc-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">Điểm tham khảo · Độ khớp từ</p>
              <p className={`text-2xl font-bold tabular-nums ${result.score === 100 ? "text-emerald-700" : "text-amber-700"}`}>
                {result.score}<span className="text-sm font-normal text-zinc-500">/100</span>
              </p>
            </div>
            <div role="meter" aria-label="Điểm độ khớp từ" aria-valuemin={0} aria-valuemax={100} aria-valuenow={result.score} className="my-2 h-2 overflow-hidden rounded-full bg-zinc-200">
              <div className={`h-full rounded-full ${result.score === 100 ? "bg-emerald-600" : "bg-amber-500"}`} style={{ width: `${result.score}%` }} />
            </div>
            <p>Nghe được: <b>{result.heard}</b></p>
            <p className={`mt-1 ${result.score === 100 ? "text-emerald-700" : "text-amber-700"}`}>
              {result.score === 100 ? "✓ Nhận diện đúng từ. Hãy nghe lại để đối chiếu âm và trọng âm." : result.score >= 70 ? "Khá gần từ mục tiêu. Nghe mẫu, đọc chậm rồi thử lại." : "Chưa khớp từ mục tiêu. Nghe mẫu và thử đọc lại từng từ."}
            </p>
          </div>
        )}
      </div>
      {recordingUrl && <audio className="mt-3 w-full" controls src={recordingUrl} aria-label="Nghe lại giọng của bạn" />}
      <p className="mt-3 text-xs text-zinc-500">Điểm 0–100 dựa trên độ khớp văn bản được nhận diện với từ mục tiêu; 100 điểm không có nghĩa phát âm hoàn hảo. Chưa chấm từng âm IPA hoặc trọng âm. Nhận diện có thể dùng dịch vụ của trình duyệt qua mạng; bản ghi nghe lại nằm trong phiên này.</p>
    </section>
  );
}
