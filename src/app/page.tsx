"use client";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { isDueToday, INTERVALS_DAYS } from "@/lib/leitner";
import Link from "next/link";

export default function Dashboard() {
  const { cards, progress, importSeed } = useStore();
  useEffect(() => { importSeed(); }, [importSeed]);

  const due = cards.filter(c => isDueToday(c.due)).length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const newToday = cards.filter(c => c.createdAt?.slice(0,10)===todayStr).length;
  const byStage: Record<number, number> = {0:0,1:0,2:0,3:0,4:0,5:0,6:0};
  cards.forEach(c=> {byStage[c.leitnerStage??0]++;});
  const kpiGoal = progress.dailyGoal || 20;
  const kpiPct = Math.min(100, Math.round(newToday/kpiGoal*100));

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-zinc-900 via-zinc-800 to-amber-900 text-white p-6 md:p-8">
        <div className="absolute -top-20 -right-20 h-64 w-64 bg-amber-500/20 rounded-full blur-3xl" />
        <p className="text-xs tracking-[0.2em] text-amber-200/70 font-semibold">HALLMARK EDITION</p>
        <h1 className="mt-1 text-2xl md:text-3xl font-serif font-bold">Chào mừng trở lại 👋</h1>
        <p className="text-zinc-300 mt-2">KPI <b>20 từ mới/ngày</b> • Lịch vàng 1–3–7–14–30–60 • 15 phút/ngày</p>
        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Streak" value={`${progress.streak} ngày`} sub="giữ lửa" />
          <Stat label="Đến hạn hôm nay" value={`${due} thẻ`} sub={`${cards.length} tổng`} highlight />
          <Stat label="KPI hôm nay" value={`${newToday}/${kpiGoal}`} sub={`${kpiPct}%`} />
        </div>
        <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-amber-400 to-rose-400" style={{width: `${kpiPct}%`}} />
        </div>
        <div className="flex gap-3 mt-6 flex-wrap">
          <Link href="/flashcards" className="bg-white text-zinc-900 px-6 py-2.5 rounded-full font-medium text-sm shadow">Học Hallmark →</Link>
          <Link href="/settings" className="bg-white/10 border border-white/20 text-white px-5 py-2.5 rounded-full text-sm">Cài đặt API</Link>
        </div>
      </div>

      <div className="rounded-2xl bg-white border p-5">
        <h2 className="font-serif font-semibold">Lịch ôn vàng (theo ảnh của bạn)</h2>
        <div className="mt-3 grid grid-cols-3 md:grid-cols-6 gap-2">
          {INTERVALS_DAYS.map((d,i)=> (
            <div key={i} className="rounded-2xl border bg-[#FFFBEB]/60 p-3 text-center">
              <div className="text-[11px] tracking-widest text-zinc-500">LẦN {i+1}</div>
              <div className="font-bold">{d} ngày</div>
              <div className="text-[11px] text-zinc-500">{["Ngày 1","Ngày 4","Ngày 11","Ngày 25","Ngày 55","60+ ngày"][i]}</div>
              <div className="mt-2 text-xs font-medium">{byStage[i+1]||0} thẻ</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-zinc-500 mt-2">Mới học → 1 ngày sau ôn lần 1, nhớ thì 3 ngày sau lần 2... Quên thì quay về Ngày 1. Đạt 60 ngày = master.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <CardLink href="/flashcards" title="Flashcard Hallmark" desc={`${cards.length} từ • ${due} đến hạn • ${newToday}/${kpiGoal} hôm nay`} badge="KPI 20/ngày" highlight />
        <CardLink href="/reading" title="Reading & Listening" desc="Bài đọc CEFR + TTS OpenAI/ShopAIKey" badge="AI TTS" />
        <CardLink href="/writing" title="AI Writing Coach" desc="Chấm gpt-4.1-mini, giải thích tiếng Việt" badge="GPT-4.1" />
      </div>

      <div className="bg-white rounded-2xl border p-5 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">XP • Level</h3>
          <p className="text-sm text-zinc-600">{progress.xp} XP • Lv.{progress.level} • {progress.totalReviews} lượt ôn</p>
        </div>
        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-400 to-rose-500 grid place-items-center text-white font-bold">{progress.level}</div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-3 ${highlight ? "bg-white text-zinc-900" : "bg-white/10"}`}>
      <div className="text-xs opacity-70">{label}</div>
      <div className="font-bold">{value}</div>
      {sub && <div className="text-[11px] opacity-60">{sub}</div>}
    </div>
  );
}
function CardLink({ href, title, desc, badge, highlight }: { href: string; title: string; desc: string; badge: string; highlight?: boolean }) {
  return (
    <Link href={href} className={`rounded-2xl border p-5 block hover:shadow-md transition ${highlight ? "bg-gradient-to-br from-amber-50 to-rose-50 border-amber-200" : "bg-white"}`}>
      <div className={`text-xs px-2 py-1 rounded-full inline-block ${highlight ? "bg-zinc-900 text-white" : "bg-zinc-900 text-white"}`}>{badge}</div>
      <h3 className="font-serif font-semibold mt-2">{title}</h3>
      <p className="text-sm text-zinc-500 mt-1">{desc}</p>
    </Link>
  );
}
