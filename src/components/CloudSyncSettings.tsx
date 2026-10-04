"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { downloadLearningBackup, syncNow, useCloudSync } from "@/lib/cloud-sync";

export default function CloudSyncSettings() {
  const { user, status, error, busy, conflict, lastSynced } = useCloudSync();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState<"link" | "password">("link");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  async function login(event: React.FormEvent) {
    event.preventDefault(); if (!supabase) return;
    setSending(true); setNotice("");
    try {
      const result = method === "link"
        ? await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/settings` } })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      setPassword("");
      setNotice(method === "link" ? "Đã gửi liên kết đăng nhập. Mở email và bấm liên kết trên thiết bị này." : "Đăng nhập thành công.");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : String(cause)); }
    finally { setSending(false); }
  }
  async function logout() {
    if (!supabase) return;
    setSending(true);
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) setNotice(error.message);
    setSending(false);
  }
  return <section className="rounded-2xl border bg-white p-5 space-y-4">
    <div><h2 className="text-xl font-semibold">Tài khoản & đồng bộ Supabase</h2><p className="mt-2 text-sm text-zinc-600">Lưu từ vựng, lịch ôn, XP, buổi học 30 phút và bài tài liệu đã học vào tài khoản. Khi mất mạng, bạn vẫn học trên máy và đồng bộ khi có mạng trở lại.</p></div>
    {!supabase ? <p className="text-sm text-amber-800">Cần cấu hình NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY rồi khởi động lại ứng dụng.</p> : user ? <>
      <p className="text-sm">Đã đăng nhập: <b>{user.email || user.id}</b></p>
      <p role="status" className="text-sm">{status}{lastSynced && <> · {new Date(lastSynced).toLocaleString("vi-VN")}</>}</p>
      <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => void syncNow()} className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? "Đang đồng bộ…" : "Đồng bộ ngay"}</button><button onClick={downloadLearningBackup} className="rounded-full border px-4 py-2 text-sm">Tải bản sao dữ liệu</button><button disabled={busy || sending} onClick={() => void logout()} className="rounded-full border px-4 py-2 text-sm disabled:opacity-50">Đăng xuất</button></div>
      {conflict && <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm"><p>Thiết bị khác và máy này đều có thay đổi. Tải bản sao trước khi chọn bản dùng tiếp. Bản trên máy cũng được giữ trong bản sao nội bộ khi bạn chọn.</p><div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} onClick={() => void syncNow("cloud")} className="rounded-full border bg-white px-3 py-2">Dùng bản Supabase</button><button disabled={busy} onClick={() => void syncNow("local")} className="rounded-full border bg-white px-3 py-2">Dùng bản máy này cho tài khoản</button></div></div>}
    </> : <form onSubmit={login} className="space-y-3">
      <p className="text-sm text-zinc-600">Lần đăng nhập đầu tiên sẽ nhập dữ liệu đang học trên máy vào tài khoản. Dùng cùng email trên các thiết bị để mở dữ liệu của bạn.</p>
      <label className="block text-sm">Email<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" placeholder="Email của bạn" /></label>
      {method === "password" && <label className="block text-sm">Mật khẩu tài khoản đã có<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>}
      <div className="flex flex-wrap gap-3"><button disabled={sending} className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50">{sending ? "Đang gửi…" : method === "link" ? "Gửi liên kết đăng nhập" : "Đăng nhập"}</button><button type="button" onClick={() => { setMethod(method === "link" ? "password" : "link"); setPassword(""); setNotice(""); }} className="text-sm underline">{method === "link" ? "Tôi đã có mật khẩu" : "Dùng liên kết qua email"}</button><button type="button" onClick={downloadLearningBackup} className="text-sm underline">Tải bản sao dữ liệu</button></div>
    </form>}
    {error && <p role="alert" className="text-sm text-amber-800">{error}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    <p className="text-xs text-zinc-500">Chỉ dữ liệu học được đồng bộ. Khóa AI, mật khẩu và bản ghi âm không nằm trong dữ liệu học gửi lên Supabase.</p>
  </section>;
}
