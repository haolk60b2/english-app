"use client";
import { useEffect, useRef, useState } from "react";
import { useCloudSync } from "@/lib/cloud-sync";
import { sourceLines, type SourceLine } from "@/lib/podcast-import";
import { listPodcasts, savePodcast, deletePodcast, type SavedPodcast } from "@/lib/podcast-storage";
import type { PracticeMaterial } from "@/lib/practice-materials";
import { MaterialView } from "./PracticeLibrary";
import PodcastPlayer from "./PodcastPlayer";

function headers(json = false) {
  const result: Record<string, string> = json ? { "Content-Type": "application/json" } : {};
  for (const [name, key] of [["x-openai-key", "openai_api_key"], ["x-openai-base-url", "openai_base_url"], ["x-openai-model", "openai_model"]]) { const value = localStorage.getItem(key); if (value) result[name] = value; }
  return result;
}
export default function PodcastImport() {
  const owner = useCloudSync(state => state.user?.id || "guest");
  return <ImportWorkbench key={owner} owner={owner} />;
}
function ImportWorkbench({ owner }: { owner: string }) {
  const [records, setRecords] = useState<SavedPodcast[]>([]);
  const [selected, setSelected] = useState<SavedPodcast | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState("");
  const [timedLines, setTimedLines] = useState<SourceLine[] | null>(null);
  const [level, setLevel] = useState<PracticeMaterial["level"]>("A2");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const alive = useRef(true);
  const activeUrl = useRef("");
  const request = useRef<AbortController | null>(null);
  function choose(record: SavedPodcast | null) {
    if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
    activeUrl.current = record?.audio ? URL.createObjectURL(record.audio) : "";
    setAudioUrl(activeUrl.current); setSelected(record);
  }
  useEffect(() => {
    alive.current = true;
    const urlRef = activeUrl; const requestRef = request;
    listPodcasts(owner).then(items => { if (alive.current) setRecords(items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))); }).catch(cause => { if (alive.current) setError(String(cause)); });
    return () => { alive.current = false; requestRef.current?.abort(); if (urlRef.current) URL.revokeObjectURL(urlRef.current); };
  }, [owner]);
  async function transcribe() {
    if (!file || busy) return;
    if (file.size > 4 * 1024 * 1024) { setError("Chép lời AI nhận tối đa 4 MB. Chọn đoạn ngắn hoặc dán transcript có sẵn; file lớn vẫn có thể lưu/nghe trên máy."); return; }
    setBusy("Đang chép lời và tìm mốc audio…"); setError(""); setNotice("");
    const controller = new AbortController(); request.current = controller;
    try {
      const form = new FormData(); form.append("audio", file);
      const response = await fetch("/api/ai/podcast-transcribe", { method: "POST", headers: headers(), body: form, signal: controller.signal });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || "Không chép lời được.");
      if (!alive.current) return;
      setTranscript(data.transcript); setTimedLines(data.lines); setNotice(data.timed ? "Đã chép lời. Kiểm tra chỗ AI nhận nhầm trước khi tạo bài. Sửa transcript sẽ bỏ mốc audio để tránh cắt sai câu." : "Đã chép lời nhưng dịch vụ chưa trả mốc thời gian. Luyện từng câu bằng giọng tổng hợp; audio gốc vẫn nghe cả bài được.");
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : "Chưa chép lời được."); }
    finally { if (alive.current) setBusy(""); }
  }
  async function generate() {
    if (busy) return;
    setError(""); setNotice("");
    const controller = new AbortController(); request.current = controller;
    try {
      const lines = timedLines || sourceLines(transcript);
      setBusy("AI đang tạo câu hỏi, bản dịch và từ vựng…");
      const response = await fetch("/api/ai/podcast-lesson", { method: "POST", headers: headers(true), body: JSON.stringify({ lines, level }), signal: controller.signal });
      const data = await response.json();
      if (!response.ok || data.error || !data.material) throw new Error(data.error || "Chưa tạo được bài.");
      if (!alive.current) return;
      const material: PracticeMaterial = { ...data.material, id: `imported-${crypto.randomUUID()}` };
      const record: SavedPodcast = { key: `${owner}:${material.id}`, owner, material, ...(file ? { audio: file, audioName: file.name } : {}), createdAt: new Date().toISOString() };
      choose(record);
      await savePodcast(record);
      if (!alive.current) return;
      setRecords(previous => [record, ...previous]); setNotice("Đã lưu bài và audio trong trình duyệt. Lần sau mở Kho bài đã nhập để học lại.");
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : "Chưa tạo/lưu được bài."); }
    finally { if (alive.current) setBusy(""); }
  }
  async function remove(record: SavedPodcast) {
    try { await deletePodcast(owner, record.material.id); if (!alive.current) return; setRecords(previous => previous.filter(item => item.key !== record.key)); if (selected?.key === record.key) choose(null); }
    catch (cause) { if (alive.current) setError(String(cause)); }
  }
  return <div className="space-y-6">
    <section className="rounded-2xl border bg-white p-5"><h2 className="text-xl font-semibold">Nhập podcast → AI tạo bài học</h2><p className="mt-2 text-sm text-zinc-600">Dán transcript tiếng Anh có sẵn hoặc chọn audio và dùng AI chép lời. Nên bắt đầu với đoạn 1–3 phút. AI cần API key đã cấu hình; audio được gửi tới dịch vụ AI khi bạn bấm chép lời.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2"><div><label htmlFor="import-audio" className="block text-sm font-medium">Audio (không bắt buộc nếu có transcript)</label><input id="import-audio" type="file" accept="audio/*,.mp3,.m4a,.wav,.webm" disabled={!!busy} className="mt-2 max-w-full text-sm" onChange={event => { const audio = event.target.files?.[0] || null; setTimedLines(null); if (audio && audio.size > 80 * 1024 * 1024) { setError("Chọn file dưới 80 MB để lưu trên máy."); setFile(null); return; } setFile(audio); setError(""); }} /><button onClick={transcribe} disabled={!file || !!busy} className="mt-3 rounded-full border px-4 py-2 text-sm disabled:opacity-40">AI chép lời audio · tối đa 4 MB</button></div><label className="text-sm font-medium">Trình độ câu hỏi <select value={level} disabled={!!busy} onChange={event => setLevel(event.target.value as PracticeMaterial["level"])} className="ml-2 rounded-lg border p-2">{["A1", "A2", "B1"].map(item => <option key={item}>{item}</option>)}</select></label></div>
      <label htmlFor="import-transcript" className="mt-4 block text-sm font-medium">Transcript tiếng Anh · 2–60 câu/đoạn, tối đa 12.000 ký tự</label><textarea id="import-transcript" rows={8} maxLength={12000} disabled={!!busy} value={transcript} onChange={event => { setTranscript(event.target.value); setTimedLines(null); }} placeholder="Dán lời thoại. Chỉ giữ lời nói, bỏ nhãn người nói và hướng dẫn của trang nguồn." className="mt-2 w-full rounded-xl border p-3 text-sm" />
      <button onClick={generate} disabled={!!busy || !transcript.trim()} className="mt-3 rounded-full bg-zinc-900 px-5 py-2 text-sm text-white disabled:opacity-40">{busy || "AI tạo bài & lưu vào kho"}</button>
      {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}{notice && <p role="status" className="mt-3 text-sm text-emerald-700">{notice}</p>}
      <p className="mt-4 text-xs text-zinc-500">Kho bài nhập và audio lưu trong trình duyệt này, tách theo tài khoản; chưa đồng bộ nội dung podcast lên Supabase. AI có thể nhầm: kiểm tra câu nguồn đi kèm đáp án.</p>
    </section>
    <section className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Nguồn để tự tìm bài mới</h2><div className="mt-3 grid gap-3 sm:grid-cols-2"><a target="_blank" rel="noopener noreferrer" href="https://learnenglish.britishcouncil.org/general-english/audio-series/podcasts" className="rounded-xl border p-4 text-sm"><b>British Council · A2–B1 ↗</b><p className="mt-2 text-zinc-500">Podcast đời thường, transcript và bài tập ở trang mỗi tập.</p></a><a target="_blank" rel="noopener noreferrer" href="https://learningenglish.voanews.com/podcasts" className="rounded-xl border p-4 text-sm"><b>VOA Learning English ↗</b><p className="mt-2 text-zinc-500">Giọng Mỹ, các chương trình dùng từ vựng giới hạn và câu ngắn. Chọn bài có lời thoại đi kèm.</p></a></div></section>
    <section><h2 className="font-semibold">Kho bài đã nhập · {records.length}</h2><div className="mt-3 flex flex-wrap gap-2">{records.map(record => <div key={record.key} className="flex items-center gap-2 rounded-xl border bg-white p-2"><button onClick={() => choose(record)} className="px-2 py-1 text-sm" aria-pressed={selected?.key === record.key}>{record.material.title}</button><button disabled={!!busy} onClick={() => remove(record)} aria-label={`Xóa ${record.material.title}`} className="px-2 py-1 text-xs text-rose-700">Xóa</button></div>)}</div>{!records.length && <p className="mt-2 text-sm text-zinc-500">Bài tạo thành công sẽ xuất hiện ở đây.</p>}</section>
    {selected && <div className="space-y-5">{audioUrl && <PodcastPlayer key={audioUrl} src={audioUrl} title={selected.material.title + " · Audio gốc"} />}<MaterialView key={selected.key} material={selected.material} audioSrc={audioUrl || undefined} imported /></div>}
  </div>;
}
