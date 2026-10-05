"use client";
import { useEffect, useRef, useState } from "react";

export default function PodcastPlayer({ src, title }: { src: string; title: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [rate, setRate] = useState(1);
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(60);
  const [clip, setClip] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [error, setError] = useState("");
  const valid = Number.isFinite(from) && Number.isFinite(to) && from >= 0 && to > from;
  useEffect(() => {
    const player = audio.current;
    return () => { player?.pause(); };
  }, []);
  function jump(seconds: number) {
    const player = audio.current;
    if (!player || !Number.isFinite(player.duration)) return;
    player.currentTime = Math.max(0, Math.min(player.duration, player.currentTime + seconds));
  }
  return <section className="space-y-4 rounded-2xl border bg-white p-5">
    <h3 className="font-semibold">{title}</h3>
    <audio ref={audio} src={src} controls controlsList="nodownload" preload="none" className="w-full" aria-label={title}
      onLoadedMetadata={() => {
        const player = audio.current;
        if (!player) return;
        player.playbackRate = rate;
        if (clip && valid && from >= player.duration) { player.pause(); setClip(false); setError("Điểm bắt đầu phải nằm trong thời lượng audio."); }
      }}
      onError={() => setError("Không phát được audio. Với file trên máy, thử định dạng MP3. Với podcast online, bạn có thể mở trang gốc bên dưới để nghe.")}
      onTimeUpdate={() => {
        const player = audio.current;
        if (!player || !clip || !valid) return;
        const end = Number.isFinite(player.duration) ? Math.min(to, player.duration) : to;
        if (player.currentTime >= end) { if (!repeat) player.pause(); player.currentTime = from; }
      }} onEnded={() => { if (repeat && audio.current) { audio.current.currentTime = clip && valid ? from : 0; void audio.current.play().catch(() => setError("Bấm phát để nghe tiếp.")); } }} />
    <div className="flex flex-wrap items-center gap-3 text-sm"><button onClick={() => jump(-10)} className="rounded-full border px-3 py-2">−10 giây</button><button onClick={() => jump(10)} className="rounded-full border px-3 py-2">+10 giây</button><label>Tốc độ <select value={rate} onChange={event => { const value = Number(event.target.value); setRate(value); if (audio.current) audio.current.playbackRate = value; }} className="ml-2 rounded-lg border p-2">{[0.75, 1, 1.25, 1.5].map(value => <option key={value}>{value}</option>)}</select></label><label className="flex items-center gap-2"><input type="checkbox" checked={repeat} onChange={event => setRepeat(event.target.checked)} /> Lặp lại</label></div>
    <fieldset className="rounded-xl bg-amber-50 p-3"><legend className="text-sm font-medium">Chọn đoạn ngắn để luyện</legend><div className="flex flex-wrap items-center gap-3 text-sm"><label>Từ giây <input type="number" min={0} value={from} onChange={event => setFrom(Number(event.target.value))} className="ml-2 w-20 rounded-lg border bg-white p-2" /></label><label>Đến giây <input type="number" min={1} value={to} onChange={event => setTo(Number(event.target.value))} className="ml-2 w-20 rounded-lg border bg-white p-2" /></label><label className="flex items-center gap-2"><input type="checkbox" checked={clip} onChange={event => { audio.current?.pause(); setClip(event.target.checked); }} /> Chỉ nghe đoạn này</label><button disabled={!valid} className="rounded-full border bg-white px-3 py-2 disabled:opacity-40" onClick={() => {
      const player = audio.current;
      if (!player) return;
      if (Number.isFinite(player.duration) && from >= player.duration) { setError("Điểm bắt đầu phải nằm trong thời lượng audio."); return; }
      setError(""); setClip(true); player.currentTime = from;
      void player.play().catch(() => setError("Chưa phát được audio. Thử nút phát của trình nghe hoặc mở nguồn gốc."));
    }}>▶ Nghe đoạn</button></div>{!valid && <p role="status" className="mt-2 text-sm text-rose-700">Giây kết thúc phải lớn hơn giây bắt đầu; điểm bắt đầu từ 0 trở lên.</p>}</fieldset>
    {error && <p role="status" className="text-sm text-rose-700">{error}</p>}
  </section>;
}
