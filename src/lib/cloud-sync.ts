"use client";
import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { useStore } from "./store";
import { useStudyStore } from "./study-store";
import { useLibraryProgress } from "./library-store";
import { importGuestData, isLearningData, type LearningData } from "./learning-data";

type Cache = { data: LearningData; base: LearningData | null; revision: number };
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
  if (/schema cache|42P01|relation .*does not exist/.test(text)) return "Chưa có bảng learning_data. Chạy file supabase/migrations/20261004_learning_sync.sql trong SQL Editor của đúng dự án.";
  if (/permission denied|row-level security|42501/.test(text)) return "Supabase đang chặn quyền lưu dữ liệu. Kiểm tra chính sách RLS của learning_data theo file migration; dữ liệu trên máy vẫn được giữ.";
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
    const { data: remote, error } = await supabase.from("learning_data").select("payload,revision,updated_at").eq("user_id", user.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (generation !== epoch) return;
    if (remote && !isLearningData(remote.payload)) throw new Error("Dữ liệu Supabase không đúng định dạng. Bản trên máy vẫn được giữ.");
    const local = snapshot();
    let outgoing = local;
    if (remote) {
      const localChanged = !cache.base || JSON.stringify(local) !== JSON.stringify(cache.base);
      const cloudChanged = remote.revision !== cache.revision;
      if (resolve) {
        localStorage.setItem(`english-app-cloud-backup:${user.id}:${Date.now()}`, JSON.stringify({ local, cloud: remote.payload }));
        outgoing = resolve === "cloud" ? remote.payload : local;
      } else if (!cache.base && importedGuest) {
        outgoing = importGuestData(remote.payload, local);
      } else if (cloudChanged && localChanged && JSON.stringify(local) !== JSON.stringify(remote.payload)) {
        useCloudSync.setState({ conflict: true, status: "Hai thiết bị có thay đổi · Cần chọn bản dữ liệu" });
        return;
      } else if (cloudChanged || !localChanged) outgoing = remote.payload;
      if (JSON.stringify(outgoing) === JSON.stringify(remote.payload)) {
        // Only replace the local snapshot if no learning happened during the request.
        if (JSON.stringify(snapshot()) === JSON.stringify(local)) apply(outgoing);
        cache.base = remote.payload; cache.revision = remote.revision;
        saveCache(user.id); importedGuest = false;
        useCloudSync.setState({ conflict: false, lastSynced: remote.updated_at, status: "Đã đồng bộ" });
        return;
      }
    }
    const updatedAt = new Date().toISOString();
    const revision = (remote?.revision || 0) + 1;
    const values = { user_id: user.id, payload: outgoing, revision, updated_at: updatedAt };
    const result = remote
      ? await supabase.from("learning_data").update(values).eq("user_id", user.id).eq("revision", remote.revision).select("revision").maybeSingle()
      : await supabase.from("learning_data").insert(values).select("revision").single();
    if (generation !== epoch) return;
    if (result.error?.code === "23505" || (!result.error && !result.data)) {
      useCloudSync.setState({ conflict: true, status: "Thiết bị khác vừa cập nhật · Đồng bộ lại để chọn bản" }); return;
    }
    if (result.error) throw new Error(result.error.message);
    if (JSON.stringify(snapshot()) === JSON.stringify(local)) apply(outgoing);
    cache.base = outgoing; cache.revision = revision; saveCache(user.id); importedGuest = false;
    useCloudSync.setState({ conflict: false, lastSynced: updatedAt, status: "Đã đồng bộ" });
  } catch (cause) {
    if (generation === epoch) useCloudSync.setState({ status: "Chưa đồng bộ · Dữ liệu vẫn ở trên máy", error: message(cause) });
  } finally {
    syncing = false;
    if (generation === epoch) {
      useCloudSync.setState({ busy: false });
      if (!useCloudSync.getState().error && !useCloudSync.getState().conflict && cache?.base &&
        JSON.stringify(snapshot()) !== JSON.stringify(cache.base)) schedule();
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
