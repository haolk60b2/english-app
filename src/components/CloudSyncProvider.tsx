"use client";
import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { startCloudSync, useCloudSync } from "@/lib/cloud-sync";

export default function CloudSyncProvider({ children }: { children: ReactNode }) {
  const ready = useCloudSync(state => state.ready);
  const user = useCloudSync(state => state.user);
  const status = useCloudSync(state => state.status);
  const error = useCloudSync(state => state.error);
  useEffect(() => startCloudSync(), []);
  if (!ready) return <p className="p-6 text-sm text-zinc-500" role="status">Đang mở dữ liệu học của bạn…</p>;
  return <><div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white px-4 py-2 text-xs"><span role="status" className={error ? "text-amber-800" : "text-zinc-500"}>{status}</span><Link href="/settings" className="underline">{user ? "Tài khoản & đồng bộ" : "Đăng nhập để lưu lên Supabase"}</Link></div><div key={user?.id || "guest"}>{children}</div></>;
}
