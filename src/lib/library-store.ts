"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useLibraryProgress = create<{ read: string[]; toggle: (id: string) => void }>()(persist((set, get) => ({
  read: [],
  toggle: id => set({ read: get().read.includes(id) ? get().read.filter(value => value !== id) : [...get().read, id] }),
}), { name: "english-app-library-progress" }));
