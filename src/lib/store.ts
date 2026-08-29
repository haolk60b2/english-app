"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Card, Rating } from "ts-fsrs";
import { INTERVALS_DAYS, dueDateForStage, LeitnerStage } from "./leitner";

export type VocabCard = Card & {
  id: string;
  front: string;
  back: string;
  example?: string;
  phonetic?: string;
  exampleVi?: string;
  level: string;
  tags: string[];
  leitnerStage: LeitnerStage;
  createdAt: string; // ISO date
};

type Progress = {
  streak: number;
  lastStudyDate: string | null;
  totalReviews: number;
  xp: number;
  level: number;
  dailyGoal: number; // 20
  lastDailyGen: string | null; // YYYY-MM-DD
};

type State = {
  cards: VocabCard[];
  progress: Progress;
  addCard: (front: string, back: string, example?: string, level?: string, phonetic?: string, exampleVi?: string) => void;
  addCardsBulk: (words: { front: string; back: string; example?: string; phonetic?: string; exampleVi?: string; level?: string; tags?: string[] }[]) => void;
  review: (id: string, rating: Rating) => void;
  reviewLeitner: (id: string, correct: boolean) => void;
  importSeed: () => void;
  setDailyGoal: (n: number) => void;
  markDailyGen: (date: string) => void;
  // computed helpers (non-persisted, but for convenience)
  getDueCards: () => VocabCard[];
  getNewToday: () => VocabCard[];
  getKpi: () => { due: number; newToday: number; learnedToday: number; total: number; byStage: Record<number, number> };
};

const SEED: Omit<VocabCard, keyof Card | "id" | "createdAt" | "leitnerStage">[] = [
  { front: "accomplish", back: "hoàn thành, đạt được", example: "She accomplished her goal of learning English in 3 months.", phonetic: "/əˈkʌm.plɪʃ/", exampleVi: "Cô ấy đã hoàn thành mục tiêu học tiếng Anh trong 3 tháng.", level: "B1", tags: ["verb"] },
  { front: "diligent", back: "chăm chỉ, siêng năng", example: "A diligent student reviews flashcards every day.", phonetic: "/ˈdɪl.ɪ.dʒənt/", level: "B1", tags: ["adj"] },
  { front: "procrastinate", back: "trì hoãn", example: "Don't procrastinate — start speaking today!", phonetic: "/prəˈkræs.tɪ.neɪt/", level: "B2", tags: ["verb"] },
  { front: "perseverance", back: "sự kiên trì", example: "Perseverance is key to mastering pronunciation.", phonetic: "/ˌpɜː.sɪˈvɪə.rəns/", level: "B2", tags: ["noun"] },
  { front: "What do you do for a living?", back: "Bạn làm nghề gì?", example: "A: What do you do for a living? B: I'm a developer.", level: "A2", tags: ["phrase"] },
];

import { fsrs, createEmptyCard } from "ts-fsrs";
const f = fsrs();

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      cards: [],
      progress: { streak: 0, lastStudyDate: null, totalReviews: 0, xp: 0, level: 1, dailyGoal: 20, lastDailyGen: null },

      addCard: (front, back, example, level = "B1", phonetic, exampleVi) => {
        const key = String(front).toLowerCase().trim();
        if (get().cards.some(c => c.front.toLowerCase().trim() === key)) {
          console.warn(`[store] Từ "${front}" đã tồn tại — bỏ qua để giữ không trùng`);
          return;
        }
        const base = createEmptyCard(new Date()) as Card;
        const now = new Date();
        const card: VocabCard = {
          ...base,
          id: Math.random().toString(36).slice(2, 9),
          front: String(front).trim(), back: String(back).trim(), example, phonetic, exampleVi, level, tags: [],
          leitnerStage: 0,
          createdAt: now.toISOString(),
          due: now,
        };
        set({ cards: [...get().cards, card] });
      },

      addCardsBulk: (words) => {
        const now = new Date();
        const existingFronts = new Set(get().cards.map(c => c.front.toLowerCase().trim()));
        // dedup trong batch trước (giữ cái đầu tiên)
        const seen = new Set<string>();
        const deduped = words.filter(w => {
          const key = String(w.front || "").toLowerCase().trim();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const filtered = deduped.filter(w => !existingFronts.has(String(w.front).toLowerCase().trim()));
        // log nếu có trùng bị loại (để UI biết)
        if (filtered.length < words.length) {
          console.log(`[store] Loại ${words.length - filtered.length} từ trùng (đã học ngày trước hoặc trùng trong batch)`);
        }
        const newCards: VocabCard[] = filtered.map(w => {
          const base = createEmptyCard(new Date()) as Card;
          return {
            ...base,
            id: Math.random().toString(36).slice(2, 9),
            front: String(w.front).trim(), back: String(w.back).trim(), example: w.example, phonetic: w.phonetic, exampleVi: w.exampleVi,
            level: w.level || "B1", tags: w.tags || [],
            leitnerStage: 0,
            createdAt: now.toISOString(),
            due: now,
          } as VocabCard;
        });
        if (newCards.length === 0) return;
        set({ cards: [...get().cards, ...newCards] });
      },

      // FSRS review (giữ lại cho power users, nhưng mặc định dùng leitner)
      review: (id, rating) => {
        const now = new Date();
        const cards = get().cards.map((c) => {
          if (c.id !== id) return c;
          const res: any = (f.repeat(c, now) as any)[rating];
          // đồng bộ leitnerStage theo FSRS: Good/Easy -> +1, Hard -> giữ, Again -> 0
          let ns = c.leitnerStage;
          if (rating === Rating.Again) ns = 0;
          else if (rating >= Rating.Good) ns = Math.min(6, (ns + 1) as LeitnerStage) as LeitnerStage;
          return { ...res.card, id: c.id, front: c.front, back: c.back, example: c.example, phonetic: c.phonetic, exampleVi: c.exampleVi, level: c.level, tags: c.tags, leitnerStage: ns, createdAt: c.createdAt } as VocabCard;
        });
        const prog = get().progress;
        const today = new Date().toISOString().slice(0, 10);
        const isNewDay = prog.lastStudyDate !== today;
        set({
          cards,
          progress: {
            ...prog,
            streak: isNewDay ? prog.streak + 1 : prog.streak,
            lastStudyDate: today,
            totalReviews: prog.totalReviews + 1,
            xp: prog.xp + (rating >= Rating.Good ? 10 : 5),
            level: Math.floor((prog.xp + 10) / 100) + 1,
          },
        });
      },

      // Leitner đúng lịch ảnh: correct -> lên stage, sai -> về 0
      reviewLeitner: (id, correct) => {
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        const cards = get().cards.map(c => {
          if (c.id !== id) return c;
          const cur = (c.leitnerStage ?? 0) as LeitnerStage;
          const next = correct ? (Math.min(6, cur + 1) as LeitnerStage) : 0 as LeitnerStage;
          const due = dueDateForStage(next, now);
          // cũng cập nhật FSRS fields để đồng bộ
          const fsrsCard = { ...c, due } as Card;
          return { ...fsrsCard, id: c.id, front: c.front, back: c.back, example: c.example, phonetic: c.phonetic, exampleVi: c.exampleVi, level: c.level, tags: c.tags, leitnerStage: next, createdAt: c.createdAt } as VocabCard;
        });
        const prog = get().progress;
        const isNewDay = prog.lastStudyDate !== todayStr;
        set({
          cards,
          progress: {
            ...prog,
            streak: isNewDay ? prog.streak + 1 : prog.streak,
            lastStudyDate: todayStr,
            totalReviews: prog.totalReviews + 1,
            xp: prog.xp + (correct ? 10 : 3),
            level: Math.floor((prog.xp + (correct ? 10 : 3)) / 100) + 1,
          }
        });
      },

      importSeed: () => {
        if (get().cards.length > 0) return;
        const cards: VocabCard[] = SEED.map((s) => {
          const base = createEmptyCard(new Date()) as Card;
          const due = new Date(Date.now() - Math.random() * 86400000);
          return { ...base, due, id: Math.random().toString(36).slice(2, 9), ...s, leitnerStage: 0 as LeitnerStage, createdAt: new Date().toISOString() } as VocabCard;
        });
        set({ cards });
      },

      setDailyGoal: (n) => set({ progress: { ...get().progress, dailyGoal: Math.max(5, Math.min(50, n)) } }),
      markDailyGen: (date) => set({ progress: { ...get().progress, lastDailyGen: date } }),

      getDueCards: () => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        return get().cards.filter(c => new Date(c.due).getTime() <= today.getTime()).sort((a, b) => a.leitnerStage - b.leitnerStage);
      },
      getNewToday: () => {
        const todayStr = new Date().toISOString().slice(0, 10);
        return get().cards.filter(c => c.createdAt.slice(0, 10) === todayStr && c.leitnerStage === 0);
      },
      getKpi: () => {
        const all = get().cards;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const due = all.filter(c => new Date(c.due).getTime() <= today.getTime()).length;
        const todayStr = new Date().toISOString().slice(0, 10);
        const newToday = all.filter(c => c.createdAt.slice(0, 10) === todayStr).length;
        const byStage: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        all.forEach(c => { byStage[c.leitnerStage ?? 0] = (byStage[c.leitnerStage ?? 0] || 0) + 1; });
        return { due, newToday, learnedToday: newToday, total: all.length, byStage };
      },
    }),
    { name: "english-app-storage" }
  )
);
