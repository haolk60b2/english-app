"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLibraryProgress } from "@/lib/library-store";
import { LESSONS, type Lesson } from "@/lib/learning-materials";
import { speakStudyText } from "@/components/StudyRecall";
import PronunciationPractice from "@/components/PronunciationPractice";

export default function LibraryPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Tất cả");
  const [selected, setSelected] = useState(LESSONS[0].id);
  const read = useLibraryProgress(s => s.read);
  const filtered = LESSONS.filter(lesson => (category === "Tất cả" || lesson.category === category) && `${lesson.title} ${lesson.intro} ${lesson.notes.join(" ")}`.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi").trim()));
  const current = filtered.find(lesson => lesson.id === selected) || filtered[0];
  return <div className="space-y-6">
    <header className="rounded-3xl border bg-amber-50 p-6 md:p-8"><p className="text-sm font-semibold text-amber-800">TỦ TÀI LIỆU CỦA BẠN</p><h1 className="mt-2 font-serif text-3xl font-bold">Học cách đọc, nghe và dùng tiếng Anh</h1><p className="mt-3 max-w-2xl text-zinc-600">Bài ngắn bằng tiếng Việt, ví dụ tiếng Anh có nút nghe, bài tự kiểm tra và luyện nói. Học một bài mỗi ngày, rồi áp dụng vào buổi học 30 phút.</p><Link href="/study" className="mt-4 inline-block rounded-full bg-zinc-900 px-5 py-2.5 text-sm text-white">Vào buổi học 30 phút →</Link></header>
    <div className="grid gap-3 sm:grid-cols-2"><Link href="/reading" className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Luyện đọc · A1–B1 →</h2><p className="mt-2 text-sm text-zinc-500">Bài song ngữ, nghe theo đoạn, quiz và lưu từ để ôn.</p></Link><Link href="/podcasts" className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Podcast & luyện nghe →</h2><p className="mt-2 text-sm text-zinc-500">Hội thoại ngắn, chép chính tả và podcast người thật.</p></Link></div>
    <div className="flex flex-wrap items-center gap-3"><label htmlFor="lesson-search" className="text-sm font-medium">Tìm bài</label><input id="lesson-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="IPA, trọng âm, quá khứ…" className="min-w-0 flex-1 rounded-xl border bg-white px-4 py-2.5" /><p className="text-xs text-zinc-500">Đánh dấu đã học để lưu tiến độ</p></div>
    <div className="flex flex-wrap gap-2" aria-label="Chủ đề tài liệu">{["Tất cả", ...new Set(LESSONS.map(lesson => lesson.category))].map(item => <button key={item} aria-pressed={item === category} onClick={() => setCategory(item)} className={`rounded-full border px-4 py-2 text-sm ${item === category ? "bg-zinc-900 text-white" : "bg-white"}`}>{item}</button>)}</div>
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]"><aside aria-label="Danh sách bài học" className="space-y-2">{filtered.map(lesson => <button key={lesson.id} onClick={() => setSelected(lesson.id)} aria-pressed={current?.id === lesson.id} className={`block w-full rounded-xl border p-4 text-left ${current?.id === lesson.id ? "border-amber-400 bg-amber-50" : "bg-white"}`}><span className="text-xs text-zinc-500">{lesson.category} · {lesson.minutes} phút {read.includes(lesson.id) ? "· ✓ Đã học" : ""}</span><span className="mt-1 block text-sm font-semibold">{lesson.title}</span></button>)}{!filtered.length && <p className="rounded-xl border bg-white p-5 text-sm">Không có bài phù hợp. Thử từ khóa khác hoặc chọn “Tất cả”.</p>}</aside>
      {current && <LessonView key={current.id} lesson={current} />}
    </div>
  </div>;
}

function LessonView({ lesson }: { lesson: Lesson }) {
  const [choice, setChoice] = useState("");
  const [sample, setSample] = useState(lesson.samples[0].text);
  const [error, setError] = useState("");
  const read = useLibraryProgress(s => s.read);
  const toggle = useLibraryProgress(s => s.toggle);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  return <article className="min-w-0 rounded-2xl border bg-white p-5 md:p-7">
    <p className="text-xs font-semibold text-amber-700">{lesson.category.toUpperCase()} · {lesson.minutes} PHÚT</p><h2 className="mt-2 font-serif text-2xl font-bold">{lesson.title}</h2><p className="mt-3 text-zinc-600">{lesson.intro}</p>
    <h3 className="mt-6 font-semibold">Cần nhớ</h3><ul className="mt-3 list-disc space-y-3 pl-5 text-sm leading-6 text-zinc-700">{lesson.notes.map(note => <li key={note}>{note}</li>)}</ul>
    <h3 className="mt-6 font-semibold">Nghe và đọc lại</h3><p className="mt-1 text-xs text-zinc-500">Giọng tổng hợp của trình duyệt, có thể khác phiên âm và giọng trong nguồn tham khảo. Nghe từ/câu mẫu, không đọc ký hiệu IPA.</p>
    <div className="mt-3 space-y-2">{lesson.samples.map(item => <div key={item.text} className="flex items-start justify-between gap-3 rounded-xl bg-zinc-50 p-3"><div><p className="text-sm font-medium">{item.text}</p><p className="mt-1 text-xs text-zinc-500">{item.note}</p></div><button onClick={() => { setSample(item.text); try { speakStudyText(item.text); } catch (cause) { setError(String(cause)); } }} aria-label={`Nghe ${item.text}`} className="shrink-0 rounded-full border bg-white px-3 py-1.5 text-xs">🔊 Nghe</button></div>)}</div>
    {error && <p role="status" className="mt-2 text-sm text-rose-700">{error}</p>}
    <label htmlFor="practice-sample" className="mt-4 block text-sm font-medium">Chọn mẫu để luyện nói</label><select id="practice-sample" value={sample} onChange={event => setSample(event.target.value)} className="mt-2 w-full rounded-xl border p-2 text-sm">{lesson.samples.map(item => <option key={item.text}>{item.text}</option>)}</select><PronunciationPractice key={sample} word={sample} />
    <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="font-semibold">Tự kiểm tra</h3><p className="mt-2 text-sm">{lesson.exercise}</p><div className="mt-3 flex flex-wrap gap-2">{lesson.choices.map(item => <button key={item} onClick={() => setChoice(item)} aria-pressed={choice === item} className={`rounded-xl border px-3 py-2 text-sm ${choice === item ? "border-zinc-900 bg-zinc-900 text-white" : "bg-white"}`}>{item}</button>)}</div>{choice && <p role="status" className="mt-3 text-sm">{choice === lesson.answer ? "✓ Đúng. " : "Chưa đúng. "}{lesson.explanation}</p>}</section>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><button onClick={() => toggle(lesson.id)} className="rounded-full border px-4 py-2 text-sm">{read.includes(lesson.id) ? "✓ Đã học · Bỏ đánh dấu" : "Đánh dấu đã học"}</button><a href={lesson.source.url} target="_blank" rel="noopener noreferrer" className="text-sm underline">{lesson.source.title} ↗</a></div>
  </article>;
}
