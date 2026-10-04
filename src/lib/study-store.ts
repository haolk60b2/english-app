"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { VocabCard } from "./store";
import { studyDate, type RecallQuestion } from "./study";

export type StudySession = {
  date: string;
  step: number;
  reviewCards: VocabCard[];
  newCards: VocabCard[];
  questions: RecallQuestion[];
  reviewed: string[];
  learned: string[];
  answers: { id: string; correct: boolean }[];
  elapsed: number[];
  sentences: string[];
  completed: boolean;
};
type StudyState = {
  session: StudySession | null;
  start: (session: StudySession) => void;
  update: (patch: Partial<StudySession>, date: string) => void;
};
export const useStudyStore = create<StudyState>()(persist((set, get) => ({
  session: null,
  start: session => set({ session }),
  update: (patch, date) => {
    const session = get().session;
    if (!session || session.date !== date || date !== studyDate()) return;
    set({ session: { ...session, ...patch } });
  },
}), { name: "english-app-study-session" }));
