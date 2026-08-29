"use client";
export function HallmarkHeading({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-amber-200/60 bg-gradient-to-br from-[#FFFBEB] via-white to-[#FFF7ED] p-5 shadow-[0_12px_40px_-16px_rgba(120,53,15,0.2)]">
      <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-gradient-to-br from-amber-200/30 to-rose-200/30 blur-xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          {eyebrow && <p className="text-[11px] tracking-[0.2em] text-amber-700/70 font-semibold">{eyebrow}</p>}
          <h1 className="mt-1 font-serif text-2xl md:text-[26px] font-bold tracking-tight text-zinc-900">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-xl text-sm leading-6 text-zinc-600">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
export function HallmarkSectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <h2 className="font-serif text-[18px] font-bold text-zinc-900">{title}</h2>
      <span className="h-px flex-1 bg-gradient-to-r from-amber-200/60 to-transparent hidden md:block" />
      {subtitle && <span className="text-xs text-zinc-500">{subtitle}</span>}
    </div>
  );
}
