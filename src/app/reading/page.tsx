"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import PracticeLibrary from "@/components/PracticeLibrary";

const AIReading = dynamic(() => import("@/components/AIReading"), { loading: () => <p>Đang mở công cụ tạo bài…</p> });

export default function ReadingPage() {
  const [mode, setMode] = useState("library");
  return <div className="space-y-6">
    <header className="rounded-3xl border bg-amber-50 p-6 md:p-8"><p className="text-sm font-semibold text-amber-800">ĐỌC HIỂU & ĐỌC THÀNH TIẾNG</p><h1 className="mt-2 font-serif text-3xl font-bold">Đọc một bài, dùng được một câu</h1><p className="mt-3 max-w-2xl text-zinc-600">Bài ngắn A1–B1 có nghĩa tiếng Việt, nghe từng đoạn, câu hỏi hiểu bài và lưu từ vào Flashcards. Bắt đầu từ bài bạn hiểu phần lớn nội dung; nâng trình độ khi thấy dễ.</p><div className="mt-4 flex flex-wrap gap-4 text-sm"><Link href="/podcasts" className="underline">Luyện nghe podcast →</Link><Link href="/library" className="underline">Tra ngữ pháp & phát âm →</Link></div></header>
    <div className="flex flex-wrap gap-2">{[["library", "Bài có sẵn · học ngay"], ["ai", "Tạo bài theo chủ đề"]].map(([value, label]) => <button key={value} aria-pressed={mode === value} onClick={() => setMode(value)} className={`rounded-full border px-4 py-2 text-sm ${mode === value ? "bg-zinc-900 text-white" : "bg-white"}`}>{label}</button>)}</div>
    {mode === "library" ? <PracticeLibrary kind="reading" /> : <AIReading />}
  </div>;
}
