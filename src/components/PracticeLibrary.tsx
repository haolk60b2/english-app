"use client";
import { useState } from "react";
import { PRACTICE_MATERIALS, type PracticeMaterial } from "@/lib/practice-materials";
import { useLibraryProgress } from "@/lib/library-store";
import { useStore } from "@/lib/store";
import SentenceAudio from "./SentenceAudio";
import PronunciationPractice from "./PronunciationPractice";

export default function PracticeLibrary({ kind }: { kind: PracticeMaterial["kind"] }) {
  const [level, setLevel] = useState("Tất cả");
  const [selected, setSelected] = useState("");
  const read = useLibraryProgress(state => state.read);
  const materials = PRACTICE_MATERIALS.filter(item => item.kind === kind && (level === "Tất cả" || item.level === level));
  const current = materials.find(item => item.id === selected) || materials[0];
  return <div className="space-y-5">
    <div className="flex flex-wrap gap-2" aria-label="Chọn trình độ">{["Tất cả", "A1", "A2", "B1"].map(item => <button key={item} aria-pressed={level === item} onClick={() => setLevel(item)} className={`rounded-full border px-4 py-2 text-sm ${level === item ? "bg-zinc-900 text-white" : "bg-white"}`}>{item}</button>)}</div>
    <div className="grid gap-5 lg:grid-cols-[250px_1fr]">
      <aside className="space-y-2" aria-label="Chọn bài luyện">{materials.map(item => <button key={item.id} onClick={() => setSelected(item.id)} aria-pressed={item.id === current?.id} className={`w-full rounded-xl border p-4 text-left ${item.id === current?.id ? "border-amber-400 bg-amber-50" : "bg-white"}`}><span className="text-xs text-zinc-500">{item.level} · {item.minutes} phút {read.includes(item.id) && "· ✓ Đã học"}</span><span className="mt-1 block font-semibold">{item.title}</span><span className="mt-2 block text-xs leading-5 text-zinc-600">{item.goal}</span></button>)}</aside>
      {current ? <MaterialView key={current.id} material={current} /> : <p>Chưa có bài cho trình độ này.</p>}
    </div>
  </div>;
}

function MaterialView({ material }: { material: PracticeMaterial }) {
  const listening = material.kind === "podcast";
  const [transcript, setTranscript] = useState(!listening);
  const [translation, setTranslation] = useState(false);
  const [active, setActive] = useState(-1);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState(false);
  const [dictation, setDictation] = useState("");
  const [reveal, setReveal] = useState(false);
  const [sample, setSample] = useState(0);
  const [notice, setNotice] = useState("");
  const read = useLibraryProgress(state => state.read);
  const toggle = useLibraryProgress(state => state.toggle);
  const score = Math.round(material.questions.filter((question, index) => question.answer === answers[index]).length / material.questions.length * 100);
  const allAnswered = material.questions.every((_, index) => answers[index] !== undefined);
  function saveWord(item: PracticeMaterial["vocabulary"][number]) {
    const store = useStore.getState();
    if (store.cards.some(card => card.front.toLowerCase().trim() === item.word.toLowerCase().trim())) { setNotice(`“${item.word}” đã có trong Flashcards.`); return; }
    store.addCardsBulk([{ front: item.word, back: item.meaning, backVi: item.meaning, example: item.example, level: material.level, tags: [listening ? "podcast" : "reading"] }]);
    setNotice(`Đã lưu “${item.word}” vào Flashcards để ôn lại.`);
  }
  return <article className="min-w-0 space-y-6 rounded-2xl border bg-white p-5 md:p-7">
    <header><p className="text-xs font-semibold text-amber-700">{material.level} · BÀI TỰ BIÊN SOẠN · {material.minutes} PHÚT</p><h2 className="mt-2 font-serif text-2xl font-bold">{material.title}</h2><p className="mt-2 text-sm text-zinc-600">{material.goal}</p><p className="mt-3 rounded-xl bg-zinc-50 p-3 text-sm">{listening ? "1. Nghe ý chính, chưa mở transcript. 2. Trả lời câu hỏi. 3. Nghe lại, kiểm tra lời thoại và đọc theo một câu." : "1. Đọc tìm ý chính, chưa mở bản dịch. 2. Trả lời câu hỏi. 3. Tra vài từ cần thiết, đọc lại và tóm tắt."}</p></header>
    <SentenceAudio lines={material.lines.map(item => item.text)} onLine={setActive} />
    <section><div className="flex flex-wrap gap-3"><button className="rounded-full border px-4 py-2 text-sm" onClick={() => setTranscript(!transcript)} aria-expanded={transcript}>{transcript ? "Ẩn nội dung tiếng Anh" : listening ? "Mở transcript sau khi nghe" : "Mở bài đọc"}</button>{transcript && <button className="rounded-full border px-4 py-2 text-sm" onClick={() => setTranslation(!translation)} aria-pressed={translation}>{translation ? "Ẩn nghĩa tiếng Việt" : "Hiện nghĩa tiếng Việt"}</button>}</div>
      {transcript && <div className="mt-4 space-y-3">{material.lines.map((line, index) => <div key={index} className={`rounded-xl p-3 ${active === index ? "bg-amber-50 ring-1 ring-amber-300" : "bg-zinc-50"}`}><p className="font-serif text-lg leading-8">{line.text}</p>{translation && <p className="mt-2 text-sm leading-6 text-zinc-500">{line.vi}</p>}</div>)}</div>}
    </section>
    <section><h3 className="font-semibold">Kiểm tra hiểu bài · thang 100</h3><div className="mt-3 space-y-4">{material.questions.map((question, index) => <fieldset key={question.prompt} className="rounded-xl border p-4"><legend className="px-1 text-sm font-medium">{index + 1}. {question.prompt}</legend><div className="space-y-2">{question.options.map((option, optionIndex) => <label key={option} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm ${checked && optionIndex === question.answer ? "border-emerald-300 bg-emerald-50" : checked && answers[index] === optionIndex ? "border-rose-300 bg-rose-50" : ""}`}><input type="radio" name={`${material.id}-${index}`} disabled={checked} checked={answers[index] === optionIndex} onChange={() => setAnswers({ ...answers, [index]: optionIndex })} />{option}</label>)}</div>{checked && <p className="mt-3 text-sm text-zinc-600">{question.explanation}</p>}</fieldset>)}</div>
      <button disabled={!allAnswered} onClick={() => { if (checked) { setChecked(false); setAnswers({}); } else setChecked(true); }} className="mt-4 rounded-full bg-zinc-900 px-5 py-2 text-sm text-white disabled:opacity-40">{checked ? "Làm lại" : "Chấm bài"}</button>{checked && <p role="status" className="mt-3 font-semibold">Hiểu bài: {score}/100 · {score === 100 ? "Đúng tất cả. Thử tóm tắt bằng lời của bạn." : "Đọc giải thích rồi nghe/đọc lại phần chưa đúng."}</p>}
    </section>
    {listening && <section className="rounded-xl bg-zinc-50 p-4"><h3 className="font-semibold">Nghe chép chính tả</h3><p className="mt-2 text-sm text-zinc-600">Bấm “Dừng”, rồi “Nghe bài” để nghe câu đầu. Gõ lại câu đầu, sau đó tự đối chiếu.</p><label htmlFor="dictation" className="mt-3 block text-sm">Câu bạn nghe được</label><textarea id="dictation" value={dictation} onChange={event => setDictation(event.target.value)} rows={2} className="mt-2 w-full rounded-xl border bg-white p-3" /><button disabled={!dictation.trim()} onClick={() => setReveal(!reveal)} className="mt-2 text-sm underline disabled:opacity-40">{reveal ? "Ẩn câu mẫu" : "Đối chiếu câu mẫu"}</button>{reveal && <p className="mt-3 text-sm">{material.lines[0].text}</p>}</section>}
    <section><h3 className="font-semibold">Từ/cụm đáng học</h3><p className="mt-1 text-xs text-zinc-500">Chọn vài từ hữu ích để ôn, thay vì lưu mọi từ lạ.</p><div className="mt-3 space-y-2">{material.vocabulary.map(item => <div key={item.word} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-zinc-50 p-3"><div><p className="text-sm"><b>{item.word}</b> · {item.meaning}</p><p className="mt-1 text-xs text-zinc-500">{item.example}</p></div><button onClick={() => saveWord(item)} className="rounded-full border bg-white px-3 py-2 text-xs">+ Flashcards</button></div>)}</div>{notice && <p role="status" className="mt-2 text-sm text-emerald-700">{notice}</p>}</section>
    <section><h3 className="font-semibold">Đọc thành tiếng và dùng câu của bạn</h3><p className="mt-2 text-sm text-zinc-600">{material.task}</p><label className="mt-3 block text-sm" htmlFor="shadowing">Chọn câu/đoạn để luyện nói</label><select id="shadowing" value={sample} onChange={event => setSample(Number(event.target.value))} className="mt-2 w-full rounded-xl border p-2 text-sm">{material.lines.map((line, index) => <option value={index} key={index}>{index + 1}. {line.text}</option>)}</select><PronunciationPractice key={sample} word={material.lines[sample].text} /></section>
    <button disabled={!checked && !read.includes(material.id)} onClick={() => toggle(material.id)} className="rounded-full border px-4 py-2 text-sm disabled:opacity-40">{read.includes(material.id) ? "✓ Đã học · Bỏ đánh dấu" : "Đánh dấu đã học sau khi chấm bài"}</button>
  </article>;
}
