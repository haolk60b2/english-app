"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useStore, type VocabCard } from "@/lib/store";
import { useStudyStore, type StudySession } from "@/lib/study-store";
import { STUDY_STEPS, makeQuestions, validStudySentences, studyDate } from "@/lib/study";
import { isDueToday } from "@/lib/leitner";
import { pickFallback } from "@/lib/fallback-words";
import StudyRecall, { speakStudyText } from "@/components/StudyRecall";
import PronunciationPractice from "@/components/PronunciationPractice";

const subscribe = () => () => {};
const button = "rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40";
const timeLabel = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export default function StudyPage() {
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const session = useStudyStore(s => s.session);
  const update = useStudyStore(s => s.update);
  const [running, setRunning] = useState(false);
  const [startError, setStartError] = useState("");
  const [sentenceToPractise, setSentenceToPractise] = useState(0);
  const [audioError, setAudioError] = useState("");
  const today = studyDate();
  const active = session?.date === today ? session : null;

  function begin() {
    const store = useStore.getState();
    store.importSeed();
    let cards = useStore.getState().cards;
    const reviewCards = cards.filter(c => (c.leitnerStage > 0 || c.last_review) && isDueToday(c.due)).sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime()).slice(0, 15);
    const newGoal = reviewCards.length >= 10 ? 5 : 8;
    const unlearned = cards.filter(c => c.leitnerStage === 0 && !c.last_review);
    if (unlearned.length < newGoal) {
      const words = pickFallback(new Set(cards.map(c => c.front.toLowerCase().trim())), newGoal - unlearned.length);
      store.addCardsBulk(words.map(w => ({ ...w, backVi: w.back })));
      cards = useStore.getState().cards;
    }
    const newCards = cards.filter(c => c.leitnerStage === 0 && !c.last_review).slice(0, newGoal);
    if (!newCards.length && !reviewCards.length) { setStartError("Bạn đã học hết kho từ hiện có và chưa có từ đến hạn. Thêm từ ở Flashcards hoặc luyện trong Tài liệu rồi quay lại nhé."); return; }
    useStudyStore.getState().start({ date: today, step: 0, reviewCards, newCards, questions: makeQuestions([...newCards, ...reviewCards.slice(0, 3)]), reviewed: [], learned: [], answers: [], elapsed: [0, 0, 0, 0], sentences: ["", "", ""], completed: false });
    setRunning(true);
  }

  if (!ready) return <p className="p-6 text-zinc-500">Đang mở buổi học…</p>;
  if (!active) return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-3xl bg-zinc-900 p-7 text-white">
        <p className="text-sm text-amber-200">LỊCH HỌC CỦA BẠN</p>
        <h1 className="mt-2 font-serif text-3xl font-bold">30 phút cho tiếng Anh mỗi ngày</h1>
        <p className="mt-3 text-zinc-300">Ôn trước, học vừa đủ, tự nhớ lại, rồi dùng từ trong câu của bạn. 5–8 từ mới tùy lượng bài ôn. Không cần API để bắt đầu.</p>
        <button onClick={begin} className="mt-6 rounded-full bg-white px-6 py-3 font-semibold text-zinc-900">Bắt đầu hôm nay →</button>
        {startError && <p role="status" className="mt-3 text-sm text-amber-200">{startError} <Link href="/flashcards" className="underline">Mở Flashcards</Link></p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{STUDY_STEPS.map((step, i) => <div key={step.title} className="rounded-2xl border bg-white p-5"><p className="text-sm text-amber-700">Chặng {i + 1} · {step.minutes} phút</p><h2 className="mt-1 font-semibold">{step.title}</h2><p className="mt-2 text-sm text-zinc-600">{step.description}</p></div>)}</div>
      <p className="text-sm text-zinc-500">Tiến độ lưu trên trình duyệt này. Đồng hồ tạm dừng khi tab bị ẩn; thời gian từng chặng là gợi ý, không bắt bạn chờ hết phút.</p>
      <Link className="inline-block text-sm underline" href="/library">Mở tài liệu phát âm và ngữ pháp →</Link>
    </div>
  );

  if (active.completed) {
    const correct = active.answers.filter(a => a.correct).length;
    return <div className="mx-auto max-w-3xl rounded-3xl border bg-white p-7">
      <p className="text-sm text-emerald-700">ĐÃ HOÀN THÀNH HÔM NAY</p><h1 className="mt-2 font-serif text-3xl font-bold">Bạn đã dùng tiếng Anh hôm nay!</h1>
      <div className="my-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Đã ôn", active.reviewed.length], ["Từ mới", active.learned.length], ["Nhớ đúng", `${correct}/${active.answers.length}`], ["Thời gian", timeLabel(active.elapsed.reduce((a, b) => a + b, 0))]].map(([label, value]) => <div key={label} className="rounded-xl bg-zinc-50 p-3"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>)}</div>
      <h2 className="font-semibold">3 câu của bạn</h2><ul className="mt-3 list-inside list-disc space-y-2">{active.sentences.map((sentence, i) => <li key={i}>{sentence}</li>)}</ul>
      <p className="mt-5 text-sm text-zinc-600">Các từ đã được lên lịch ôn. Ngày mai mở lại để bắt đầu buổi mới.</p>
      <div className="mt-5 flex flex-wrap gap-3"><Link className={button} href="/library">Đọc thêm tài liệu</Link><Link className="rounded-full border px-5 py-2.5 text-sm" href="/flashcards">Luyện thêm flashcard</Link></div>
    </div>;
  }

  const stepCards = active.step === 0 ? active.reviewCards : active.newCards;
  const finishedIds = active.step === 0 ? active.reviewed : active.learned;
  const current = stepCards.find(c => !finishedIds.includes(c.id));
  const question = active.questions.find(q => !active.answers.some(answer => answer.id === q.id));
  const questionCard = [...active.newCards, ...active.reviewCards].find(c => c.id === question?.cardId);
  const practiceWords = [...active.newCards, ...active.reviewCards].slice(0, 8);
  const stepDone = active.step < 2 ? !current : active.step === 2 ? !question : validStudySentences(active.sentences, practiceWords.map(card => card.front));

  function review(card: VocabCard, correct: boolean) {
    useStore.getState().reviewLeitner(card.id, correct);
    update(active!.step === 0 ? { reviewed: [...active!.reviewed, card.id] } : { learned: [...active!.learned, card.id] }, today);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-amber-700">BUỔI HỌC 30 PHÚT</p><h1 className="mt-1 font-serif text-2xl font-bold">{STUDY_STEPS[active.step].title}</h1></div><button onClick={() => setRunning(value => !value)} className="rounded-full border bg-white px-4 py-2 text-sm">{running ? "Tạm dừng" : "Tiếp tục học"}</button></div>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">{STUDY_STEPS.map((step, index) => <li key={step.title} aria-current={active.step === index ? "step" : undefined} className={`rounded-xl border p-3 text-sm ${active.step === index ? "border-zinc-900 bg-zinc-900 text-white" : "bg-white text-zinc-500"}`}><span className="block text-xs">{index < active.step ? "✓" : index + 1} · {step.minutes} phút</span>{step.title}</li>)}</ol>
      <StudyClock key={`${today}-${active.step}`} session={active} running={running} />
      {!running && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Đồng hồ đang tạm dừng. Bấm “Tiếp tục học” khi bạn sẵn sàng.</p>}
      {active.step < 2 && stepCards.length > 0 && <p className="text-sm text-zinc-500">Đã hoàn thành {finishedIds.length}/{stepCards.length} từ trong chặng.</p>}
      {active.step < 2 && (current ? <StudyWord key={current.id} card={current} learning={active.step === 1} onAnswer={correct => review(current, correct)} /> : <div className="rounded-2xl border bg-white p-6"><h2 className="font-semibold">{stepCards.length ? "✓ Đã xong các từ trong chặng này" : "Không có từ đến hạn — chuyển sang học mới nhé!"}</h2><p className="mt-2 text-sm text-zinc-500">Bấm chuyển chặng bên dưới. Bạn không cần chờ hết thời gian gợi ý.</p></div>)}
      {active.step === 2 && (question && questionCard ? <><p className="text-sm text-zinc-500">Câu {active.answers.length + 1}/{active.questions.length} · Đáp án ẩn đến khi bạn trả lời.</p><StudyRecall key={question.id} question={question} card={questionCard} onNext={correct => update({ answers: [...active.answers, { id: question.id, correct }] }, today)} /></> : <div className="rounded-2xl border bg-white p-6"><h2 className="font-semibold">✓ Hoàn thành kiểm tra nhớ</h2><p className="mt-2">Đúng {active.answers.filter(a => a.correct).length}/{active.answers.length} câu. Tiếp theo: dùng từ trong câu của bạn.</p></div>)}
      {active.step === 3 && <section className="rounded-2xl border bg-white p-5 md:p-7"><h2 className="text-xl font-semibold">Viết 3 câu về bản thân</h2><p className="mt-2 text-sm text-zinc-600">Viết 3 câu khác nhau. Mỗi câu dùng ít nhất một từ bên dưới, ít nhất 3 từ/câu. Đây là kiểm tra bạn có dùng từ, chưa chấm ngữ pháp.</p><div className="my-4 flex flex-wrap gap-2">{practiceWords.map(c => <span key={c.id} className="rounded-full bg-amber-50 px-3 py-1 text-sm">{c.front}</span>)}</div>
        {active.sentences.map((text, i) => <div key={i} className="mt-4"><label htmlFor={`sentence-${i}`} className="text-sm font-medium">Câu {i + 1}</label><textarea id={`sentence-${i}`} rows={2} maxLength={500} value={text} onChange={event => update({ sentences: active.sentences.map((s, index) => index === i ? event.target.value : s) }, today)} placeholder="Ví dụ: I want to accomplish my goals this month." className="mt-1 w-full rounded-xl border p-3" /><button disabled={!text.trim()} onClick={() => { try { speakStudyText(text); } catch (cause) { setAudioError(String(cause)); } }} className="mt-1 text-sm underline disabled:opacity-40">🔊 Nghe câu của tôi</button></div>)}
        {audioError && <p role="status" className="mt-2 text-sm text-rose-700">{audioError}</p>}
        <label htmlFor="sentence-practice" className="mt-4 block text-sm font-medium">Chọn câu của bạn để đọc thành tiếng</label><select id="sentence-practice" value={sentenceToPractise} onChange={event => setSentenceToPractise(Number(event.target.value))} className="mt-2 rounded-xl border p-2 text-sm">{active.sentences.map((_, i) => <option key={i} value={i}>Câu {i + 1}</option>)}</select>
        {active.sentences[sentenceToPractise].trim() && <PronunciationPractice key={active.sentences[sentenceToPractise]} word={active.sentences[sentenceToPractise]} />}
        <Link href="/writing" className="mt-4 inline-block text-sm underline">Mở Writing Coach để sửa ngữ pháp →</Link>
      </section>}
      <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/library" className="text-sm underline">Tra cứu tài liệu học</Link><button disabled={!stepDone} className={button} onClick={() => { window.speechSynthesis?.cancel(); if (active.step === 3) { setRunning(false); update({ completed: true }, today); } else update({ step: active.step + 1 }, today); }}>{active.step === 3 ? "Hoàn thành buổi học ✓" : `Sang chặng ${active.step + 2} →`}</button></div>
      {!stepDone && <p className="text-xs text-zinc-500">{active.step === 3 ? "Điền đủ 3 câu khác nhau và dùng từ đã học để hoàn thành." : "Hoàn thành các từ / câu hỏi trong chặng trước khi chuyển tiếp."}</p>}
    </div>
  );
}

function StudyWord({ card, learning, onAnswer }: { card: VocabCard; learning: boolean; onAnswer: (correct: boolean) => void }) {
  const [revealed, setRevealed] = useState(learning);
  const [error, setError] = useState("");
  return <section className="rounded-2xl border bg-white p-6 text-center">
    <p className="text-xs text-zinc-500">{learning ? "TỪ MỚI" : "TỰ NHỚ NGHĨA TRƯỚC KHI XEM"} · {card.level}</p><h2 className="mt-4 font-serif text-3xl font-bold">{card.front}</h2><p className="mt-2 font-mono text-sm text-amber-700">{card.phonetic}</p>
    <button onClick={() => { try { speakStudyText(card.front); } catch (cause) { setError(String(cause)); } }} className="mt-3 rounded-full border px-4 py-2 text-sm">🔊 Nghe mẫu</button>
    {error && <p role="status" className="mt-2 text-sm text-rose-700">{error}</p>}
    {revealed ? <><p className="mt-5 text-lg">{card.backEn || card.backVi || card.back}</p>{card.backEn && <p className="mt-2 text-sm text-zinc-500">{card.backVi || card.back}</p>}{card.example && <blockquote className="mt-4 rounded-xl bg-amber-50 p-4 text-sm italic">{card.example}</blockquote>}
      {learning && <PronunciationPractice word={card.front} phonetic={card.phonetic} />}
      <div className="mt-5 flex justify-center gap-3">{!learning && <button onClick={() => onAnswer(false)} className="rounded-full border border-rose-200 px-4 py-2 text-sm text-rose-700">Chưa nhớ</button>}<button onClick={() => onAnswer(true)} className={button}>{learning ? "Đã học & đọc lại →" : "Đã nhớ →"}</button></div>
    </> : <button onClick={() => setRevealed(true)} className={`mt-5 ${button}`}>Tôi đã thử nhớ — xem nghĩa</button>}
  </section>;
}

function StudyClock({ session, running }: { session: StudySession; running: boolean }) {
  const [seconds, setSeconds] = useState(session.elapsed[session.step]);
  const elapsed = useRef(session.elapsed[session.step]);
  useEffect(() => {
    let previous = Date.now();
    let lastSave = elapsed.current;
    const save = () => {
      const store = useStudyStore.getState();
      if (store.session?.date !== session.date) return;
      store.update({ elapsed: store.session.elapsed.map((value, i) => i === session.step ? Math.floor(elapsed.current) : value) }, session.date);
    };
    const interval = setInterval(() => {
      const now = Date.now();
      if (running && !document.hidden) {
        elapsed.current += Math.min(2, (now - previous) / 1000);
        setSeconds(Math.floor(elapsed.current));
        if (elapsed.current - lastSave >= 15) { save(); lastSave = elapsed.current; }
      }
      previous = now;
    }, 1000);
    const onHide = () => { previous = Date.now(); save(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", save);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onHide); window.removeEventListener("pagehide", save); save(); };
  }, [session.date, session.step, running]);
  const goal = STUDY_STEPS[session.step].minutes * 60;
  return <div className="rounded-xl border bg-white px-4 py-3"><div className="flex justify-between text-sm"><span>{running ? "Đang học" : "Đã tạm dừng"}</span><span className="tabular-nums">{timeLabel(seconds)} / {timeLabel(goal)} gợi ý</span></div><div className="mt-2 h-1.5 rounded-full bg-zinc-100"><div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, seconds / goal * 100)}%` }} /></div>{seconds >= goal && <p className="mt-2 text-xs text-amber-700">Đã đủ thời gian gợi ý. Bạn có thể hoàn tất bài còn lại rồi chuyển chặng.</p>}</div>;
}
