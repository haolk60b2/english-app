"use client";
import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { useStore } from "./store";
import { useStudyStore } from "./study-store";
import { useLibraryProgress } from "./library-store";
import { importGuestData, isLearningData, type LearningData } from "./learning-data";
import { readLearningData, writeLearningChanges, sameLearningData } from "./learning-repository";

type Cache = { data: LearningData; base: LearningData | null; revision: number; protocol?: 2 };
type SyncState = { user: User | null; ready: boolean; status: string; error: string;
  conflict: boolean; lastSynced: string | null; busy: boolean };
export const useCloudSync = create<SyncState>(() => ({ user: null, ready: false,
  status: "Đang kiểm tra tài khoản…", error: "", conflict: false, lastSynced: null, busy: false }));
const OWNER = "english-app-cloud-owner";
const GUEST = "english-app-cloud-guest";
const cacheKey = (id: string) => `english-app-cloud-cache:${id}`;
let cache: Cache | null = null;
let applying = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let active = false;
let epoch = 0;
let syncing = false;
let importedGuest = false;

export function snapshot(): LearningData {
  return JSON.parse(JSON.stringify({ version: 1, cards: useStore.getState().cards,
    progress: useStore.getState().progress, session: useStudyStore.getState().session,
    read: useLibraryProgress.getState().read }));
}
function apply(data: LearningData) {
  applying = true;
  try {
    useStore.setState({ cards: data.cards, progress: data.progress });
    useStudyStore.setState({ session: data.session });
    useLibraryProgress.setState({ read: data.read });
  } finally { applying = false; }
}
function stored<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  try { return raw ? JSON.parse(raw) as T : null; } catch { return null; }
}
function empty(): LearningData {
  return { version: 1, cards: [], session: null, read: [], progress: {
    streak: 0, lastStudyDate: null, totalReviews: 0, xp: 0, level: 1, dailyGoal: 20, lastDailyGen: null } };
}
function saveCache(id: string) {
  if (!cache) return;
  cache.data = snapshot();
  localStorage.setItem(cacheKey(id), JSON.stringify(cache));
}
function message(cause: unknown) {
  const text = cause instanceof Error ? cause.message : String(cause);
  if (/schema cache|42P01|relation .*does not exist/.test(text)) return "Chưa có chức năng đồng bộ từng thẻ trên Supabase. Cần áp dụng migration normalize_learning_sync; dữ liệu trên máy vẫn được giữ.";
  if (/permission denied|row-level security|42501/.test(text)) return "Supabase đang chặn quyền lưu dữ liệu. Kiểm tra chính sách RLS theo migration normalize_learning_sync; dữ liệu trên máy vẫn được giữ.";
  return text;
}
async function connect(user: User | null) {
  const generation = ++epoch;
  clearTimeout(timer);
  useCloudSync.setState({ ready: false, user, error: "", conflict: false, busy: false, lastSynced: null });
  try {
    const owner = localStorage.getItem(OWNER);
    if (owner && cache) saveCache(owner);
    const current = snapshot();
    if (!owner) localStorage.setItem(GUEST, JSON.stringify(current));
    if (!user) {
      const guest = stored<LearningData>(GUEST);
      if (owner) apply(guest && isLearningData(guest) ? guest : empty());
      localStorage.removeItem(OWNER); cache = null;
      useCloudSync.setState({ ready: true, status: "Đang lưu trên máy · Đăng nhập để đồng bộ" });
      return;
    }
    const previous = stored<Cache>(cacheKey(user.id));
    importedGuest = !previous && !owner;
    cache = previous && isLearningData(previous.data) ? previous :
      { data: importedGuest ? current : empty(), base: null, revision: 0 };
    // Old snapshot revisions belong to a different protocol. Keep pending local
    // changes and the old baseline, but fetch the normalized cloud rows in full.
    if (cache.protocol !== 2) { cache.revision = 0; cache.protocol = 2; }
    if (owner === user.id) cache.data = current;
    else apply(cache.data);
    localStorage.setItem(OWNER, user.id);
    saveCache(user.id);
    if (generation !== epoch) return;
    useCloudSync.setState({ ready: true, status: "Chờ đồng bộ…" });
    await syncNow();
  } catch (cause) {
    if (generation === epoch) useCloudSync.setState({ ready: true, status: "Chưa đồng bộ", error: message(cause) });
  }
}

export async function syncNow(resolve?: "local" | "cloud") {
  const user = useCloudSync.getState().user;
  if (!supabase || !user || !cache || syncing || localStorage.getItem(OWNER) !== user.id) return;
  if (useCloudSync.getState().conflict && !resolve) return;
  if (!navigator.onLine) { useCloudSync.setState({ status: "Mất mạng · Đã lưu trên máy" }); return; }
  const generation = epoch;
  syncing = true;
  useCloudSync.setState({ busy: true, error: "", status: "Đang đồng bộ…" });
  try {
    const remote = await readLearningData(cache.revision ? cache.base || empty() : empty(), cache.revision);
    if (generation !== epoch) return;
    const local = snapshot();
    let outgoing = local;
    if (remote) {
      const localChanged = !cache.base || !sameLearningData(local, cache.base);
      const cloudChanged = !cache.base || !sameLearningData(remote.payload, cache.base);
      if (resolve) {
        localStorage.setItem(`english-app-cloud-backup:${user.id}:${Date.now()}`, JSON.stringify({ local, cloud: remote.payload }));
        outgoing = resolve === "cloud" ? remote.payload : local;
      } else if (!cache.base && importedGuest) {
        outgoing = importGuestData(remote.payload, local);
      } else if (cache.base && cloudChanged && localChanged && !sameLearningData(local, remote.payload)) {
        useCloudSync.setState({ conflict: true, status: "Hai thiết bị có thay đổi · Cần chọn bản dữ liệu" });
        return;
      } else if (cloudChanged || !localChanged) outgoing = remote.payload;
      if (sameLearningData(outgoing, remote.payload)) {
        // Only replace the local snapshot if no learning happened during the request.
        if (sameLearningData(snapshot(), local)) apply(outgoing);
        cache.base = remote.payload; cache.revision = remote.revision;
        saveCache(user.id); importedGuest = false;
        useCloudSync.setState({ conflict: false, lastSynced: remote.updated_at, status: "Đã đồng bộ" });
        return;
      }
    }
    const result = await writeLearningChanges(remote.payload, outgoing, remote.revision);
    if (generation !== epoch) return;
    if (result.conflict) {
      useCloudSync.setState({ conflict: true, status: "Thiết bị khác vừa cập nhật · Đồng bộ lại để chọn bản" }); return;
    }
    if (sameLearningData(snapshot(), local)) apply(outgoing);
    cache.base = outgoing; cache.revision = result.revision; saveCache(user.id); importedGuest = false;
    useCloudSync.setState({ conflict: false, lastSynced: result.updated_at, status: "Đã đồng bộ" });
  } catch (cause) {
    if (generation === epoch) useCloudSync.setState({ status: "Chưa đồng bộ · Dữ liệu vẫn ở trên máy", error: message(cause) });
  } finally {
    syncing = false;
    if (generation === epoch) {
      useCloudSync.setState({ busy: false });
      if (!useCloudSync.getState().error && !useCloudSync.getState().conflict && cache?.base &&
        !sameLearningData(snapshot(), cache.base)) schedule();
    } else if (active) schedule();
  }
}
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), 1800);
}
export function startCloudSync() {
  if (active) return () => {};
  active = true;
  const change = () => {
    if (applying || !useCloudSync.getState().ready) return;
    try {
      const user = useCloudSync.getState().user;
      if (user && localStorage.getItem(OWNER) === user.id) {
        saveCache(user.id);
        useCloudSync.setState({ status: navigator.onLine ? "Có thay đổi · Chờ đồng bộ" : "Mất mạng · Đã lưu trên máy" });
        schedule();
      } else if (!user) localStorage.setItem(GUEST, JSON.stringify(snapshot()));
    } catch (cause) { useCloudSync.setState({ error: message(cause) }); }
  };
  const unsub = [useStore.subscribe(change), useStudyStore.subscribe(change), useLibraryProgress.subscribe(change)];
  const retry = () => void syncNow();
  const storage = (event: StorageEvent) => { if (event.key === OWNER) window.location.reload(); };
  window.addEventListener("online", retry); window.addEventListener("focus", retry);
  window.addEventListener("storage", storage);
  const interval = setInterval(retry, 60000);
  // getSession reads the locally persisted session, including while offline.
  // Do not await Supabase calls from inside onAuthStateChange (auth lock).
  let authTimer: ReturnType<typeof setTimeout> | undefined;
  const { data } = supabase?.auth.onAuthStateChange((event, session) => {
    if (event === "TOKEN_REFRESHED") { schedule(); return; }
    if (event !== "INITIAL_SESSION" && session?.user.id === useCloudSync.getState().user?.id) return;
    clearTimeout(authTimer);
    authTimer = setTimeout(() => { if (active) void connect(session?.user || null); }, 0);
  }) || { data: null };
  if (!supabase) useCloudSync.setState({ ready: true, status: "Chưa cấu hình Supabase" });
  return () => {
    active = false; ++epoch; clearTimeout(timer); clearTimeout(authTimer); clearInterval(interval);
    unsub.forEach(fn => fn()); data?.subscription.unsubscribe();
    window.removeEventListener("online", retry); window.removeEventListener("focus", retry);
    window.removeEventListener("storage", storage);
  };
}

export function downloadLearningBackup() {
  const blob = new Blob([JSON.stringify(snapshot(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url;
  link.download = `english-learning-${new Date().toISOString().slice(0, 10)}.json`;
  link.click(); URL.revokeObjectURL(url);
}
