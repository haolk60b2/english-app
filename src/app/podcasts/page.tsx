"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import PracticeLibrary from "@/components/PracticeLibrary";
import PodcastPlayer from "@/components/PodcastPlayer";

const episodes = [
  { id: "01", title: "Episode 01 · Introductions", goal: "Tập trung vào phần mở đầu: ai đang nói, họ giới thiệu nhau thế nào?", url: "https://learnenglish.britishcouncil.org/free-resources/general/audio-series/podcasts/s1/episode-01", audio: "https://learnenglish.britishcouncil.org/sites/podcasts/files/podcast/elementary-podcasts-s01-e01.mp3" },
  { id: "02", title: "Episode 02 · Weekends away", goal: "Nghe một đoạn về chuyến đi cuối tuần; ghi nơi đến và hoạt động được nhắc tới.", url: "https://learnenglish.britishcouncil.org/free-resources/general/audio-series/podcasts/s1/episode-02", audio: "https://learnenglish.britishcouncil.org/sites/podcasts/files/podcast/elementary-podcasts-s01-e02.mp3" },
];

export default function PodcastsPage() {
  const [mode, setMode] = useState("short");
  const [selected, setSelected] = useState(0);
  const [localAudio, setLocalAudio] = useState<{ url: string; name: string } | null>(null);
  const [fileError, setFileError] = useState("");
  useEffect(() => {
    const url = localAudio?.url;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [localAudio]);
  const episode = episodes[selected];
  return <div className="space-y-6">
    <header className="rounded-3xl border bg-amber-50 p-6 md:p-8"><p className="text-sm font-semibold text-amber-800">NGHE CÓ MỤC TIÊU</p><h1 className="mt-2 font-serif text-3xl font-bold">Podcast & luyện nghe</h1><p className="mt-3 max-w-2xl text-zinc-600">Nghe một đoạn vừa sức, kiểm tra ý chính rồi đọc theo một câu hữu ích. Bắt đầu 7–8 phút; không cần nghe hết một tập dài trong ngày.</p><Link href="/study" className="mt-4 inline-block text-sm underline">Quay lại lịch học 30 phút →</Link></header>
    <div className="flex flex-wrap gap-2">{[["short", "Hội thoại ngắn · A1–B1"], ["real", "Podcast người thật · A2–B1"], ["file", "Audio của tôi"]].map(([value, label]) => <button key={value} aria-pressed={mode === value} onClick={() => setMode(value)} className={`rounded-full border px-4 py-2 text-sm ${mode === value ? "bg-zinc-900 text-white" : "bg-white"}`}>{label}</button>)}</div>
    {mode === "file" ? <section className="space-y-4 rounded-2xl border bg-white p-5"><label className="block font-semibold" htmlFor="podcast-file">Mở MP3 hoặc audio trên máy</label><p className="text-sm text-zinc-600">File phát tại trình duyệt, không tải lên máy chủ. Bạn cần chọn lại file sau khi tải lại trang.</p><input id="podcast-file" type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg" className="max-w-full text-sm" onChange={event => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("audio/") && !/\.(mp3|m4a|wav|ogg)$/i.test(file.name)) { setFileError("Hãy chọn file audio như MP3, M4A, WAV hoặc OGG."); return; }
      setFileError(""); setLocalAudio({ url: URL.createObjectURL(file), name: file.name });
    }} />{fileError && <p role="status" className="text-sm text-rose-700">{fileError}</p>}{localAudio && <PodcastPlayer key={localAudio.url} src={localAudio.url} title={localAudio.name} />}</section> : mode === "short" ? <PracticeLibrary kind="podcast" /> : <div className="space-y-5">
      <p className="rounded-xl border bg-white p-4 text-sm text-zinc-600">British Council LearnEnglish · audio phát từ trang nguồn, cần mạng. Transcript và bài tập đầy đủ mở ở nguồn gốc. Chọn 30–60 giây để nghe kỹ trước khi chuyển đoạn.</p>
      <div className="flex flex-wrap gap-2">{episodes.map((item, index) => <button key={item.id} onClick={() => setSelected(index)} aria-pressed={index === selected} className={`rounded-xl border p-3 text-sm ${index === selected ? "border-amber-400 bg-amber-50" : "bg-white"}`}>{item.title}</button>)}</div>
      <PodcastPlayer key={episode.id} src={episode.audio} title={episode.title} />
      <section className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Bài luyện 8 phút</h2><p className="mt-2 text-sm">{episode.goal}</p><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-600"><li>2 phút: nghe đoạn ngắn không nhìn transcript, viết một câu tóm tắt.</li><li>3 phút: nghe lại, ghi 3 từ/cụm, mở transcript để đối chiếu.</li><li>3 phút: chọn một câu, nghe rồi dừng audio để đọc theo; tự đổi một chi tiết.</li></ol><a href={episode.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm underline">Mở transcript và bài tập của British Council ↗</a></section>
    </div>}
  </div>;
}
