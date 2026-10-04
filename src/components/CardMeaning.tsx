"use client";
import { useState } from "react";
import { useStore, type VocabCard } from "@/lib/store";
import { withKeyHeaders } from "@/lib/client-key";

export default function CardMeaning({ card }: { card: VocabCard }) {
  const [showTranslation, setShowTranslation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const save = useStore(s => s.setCardMeanings);
  const preferVietnamese = card.level === "A1" || card.level === "A2";
  const primary = preferVietnamese ? card.backVi || card.backEn : card.backEn || card.backVi;
  const secondary = preferVietnamese ? card.backEn : card.backVi;

  async function enrich() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/ai/explain", withKeyHeaders({
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: card.front, level: card.level, context: card.example }),
        signal: AbortSignal.timeout(20000),
      }));
      const data = await response.json();
      if (!response.ok || data.mock || !data.backEn || !data.backVi) throw new Error("Chưa bổ sung được nghĩa song ngữ. Kiểm tra API key ở Cài đặt hoặc thử lại sau.");
      save(card.id, data.backEn, data.backVi);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được nghĩa."); }
    finally { setLoading(false); }
  }

  return (
    <div onClick={event => event.stopPropagation()} className="cursor-default">
      <p className="text-xs text-zinc-500">{primary ? (primary === card.backEn ? "English definition" : "Nghĩa tiếng Việt") : "Nghĩa đã lưu"}</p>
      <p className="mt-1 text-xl font-medium text-zinc-900">{primary || card.back}</p>
      {secondary && secondary !== primary && <button type="button" onClick={() => setShowTranslation(value => !value)} className="mt-3 rounded-full border px-3 py-1.5 text-xs">{showTranslation ? "Ẩn nghĩa bổ sung" : preferVietnamese ? "Xem định nghĩa tiếng Anh" : "Xem nghĩa tiếng Việt"}</button>}
      {showTranslation && secondary && <p className="mt-2 text-sm text-zinc-700">{secondary}</p>}
      {(!card.backEn || !card.backVi) && <button type="button" disabled={loading} onClick={() => void enrich()} className="mt-3 rounded-full border px-3 py-1.5 text-xs disabled:opacity-50">{loading ? "Đang bổ sung…" : "Bổ sung nghĩa Anh + Việt bằng AI"}</button>}
      {error && <p role="status" className="mt-2 text-xs text-rose-700">{error}</p>}
    </div>
  );
}
