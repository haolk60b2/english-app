"use client";
import { useEffect, useState } from "react";
import CloudSyncSettings from "@/components/CloudSyncSettings";
import { getClientKey, setClientKey, getClientBaseURL, setClientBaseURL, getClientModel, setClientModel } from "@/lib/client-key";

const PRESETS: Record<string, string> = {
  "OpenAI chính thức": "https://api.openai.com/v1",
  "ShopAIKey (rẻ 5-8x, khuyên dùng)": "https://api.shopaikey.com/v1",
  "ShopAIKey Direct (ít delay)": "https://direct.shopaikey.com/v1",
};

export default function SettingsPage() {
  const [key, setKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.shopaikey.com/v1");
  const [model, setModel] = useState("gpt-4.1-mini");
  const [status, setStatus] = useState<null | { ok: boolean; source?: string; baseUrl?: string; error?: string }>(null);
  const [checking, setChecking] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    setKey(getClientKey() || "");
    setBaseUrl(getClientBaseURL() || "https://api.shopaikey.com/v1");
    setModel(getClientModel() || "gpt-4.1-mini");
    // delay để state set xong
    setTimeout(check, 100);
  }, []);

  const check = async () => {
    setChecking(true);
    try {
      const k = getClientKey();
      const b = getClientBaseURL();
      const m = getClientModel();
      const headers: Record<string, string> = {};
      if (k) headers["x-openai-key"] = k;
      if (b) headers["x-openai-base-url"] = b;
      if (m) headers["x-openai-model"] = m;
      const res = await fetch("/api/ai/check", { headers });
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      setStatus({ ok: false, error: String(e) });
    } finally { setChecking(false); }
  };

  const save = () => {
    setClientKey(key);
    setClientBaseURL(baseUrl);
    setClientModel(model);
    check();
  };

  const clear = () => {
    setClientKey("");
    setClientBaseURL("");
    setClientModel("");
    setKey("");
    setBaseUrl("https://api.shopaikey.com/v1");
    setModel("gpt-4.1-mini");
    check();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <CloudSyncSettings />
      <h1 className="text-2xl font-bold">Cài đặt • AI Gateway</h1>
      <p className="text-sm text-zinc-600">Chọn <b>ShopAIKey</b> để tiết kiệm 5-8x so với OpenAI gốc. Một key dùng cho tất cả: GPT + Whisper + TTS. Lưu ở <b>localStorage</b> (header <code>x-openai-key</code> + <code>x-openai-base-url</code>), ưu tiên hơn <code>.env.local</code>.</p>

      <div className="bg-white border rounded-2xl p-5 space-y-4">
        <div>
          <label className="text-sm font-medium">API Provider / Base URL</label>
          <div className="flex gap-2 mt-1 flex-wrap">
            {Object.entries(PRESETS).map(([label, url]) => (
              <button key={url} onClick={() => setBaseUrl(url)} className={`px-3 py-1.5 rounded-full text-xs border ${baseUrl === url ? "bg-zinc-900 text-white border-zinc-900" : "bg-white"}`}>{label}</button>
            ))}
          </div>
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.shopaikey.com/v1" className="w-full mt-2 border rounded-lg px-3 py-2 text-sm font-mono" />
          <p className="text-xs text-zinc-500 mt-1">ShopAIKey: <code>https://api.shopaikey.com/v1</code> • OpenAI gốc: <code>https://api.openai.com/v1</code> — chỉ cần dán key tương ứng.</p>
        </div>

        <div>
          <label className="text-sm font-medium">API Key</label>
          <div className="flex gap-2 mt-1">
            <input type={show ? "text" : "password"} value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-... (ShopAIKey hoặc OpenAI)" className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono" />
            <button onClick={() => setShow(!show)} className="px-3 py-2 border rounded-lg text-sm">{show ? "Ẩn" : "Hiện"}</button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Chat Model (fix lỗi 503)</label>
          <div className="flex gap-2 mt-1 flex-wrap">
            {["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "gpt-4o"].map((m) => (
              <button key={m} onClick={() => setModel(m)} className={`px-3 py-1.5 rounded-full text-xs border ${model === m ? "bg-zinc-900 text-white border-zinc-900" : "bg-white"}`}>{m}</button>
            ))}
          </div>
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4.1-mini" className="w-full mt-2 border rounded-lg px-3 py-2 text-sm font-mono" />
          <p className="text-xs text-zinc-500 mt-1">ShopAIKey hiện lỗi 503 với <code>gpt-4o-mini</code> — đã đổi mặc định sang <code>gpt-4.1-mini</code>. Có thể nhập model bất kỳ (ví dụ: <code>gpt-4.1-nano</code>).</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button onClick={save} className="px-5 py-2 bg-zinc-900 text-white rounded-full text-sm">Lưu & kiểm tra</button>
          <button onClick={clear} className="px-5 py-2 border rounded-full text-sm">Xóa</button>
          <button onClick={check} disabled={checking} className="px-5 py-2 border rounded-full text-sm disabled:opacity-50">{checking ? "Đang check..." : "Kiểm tra lại"}</button>
        </div>

        {status && (
          <div className={`rounded-lg p-3 text-sm border ${status.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
            {status.ok ? `✅ Key hợp lệ • nguồn: ${status.source} • baseURL: ${status.baseUrl}` : `❌ ${status.error || "Key không hợp lệ"} • baseURL: ${status.baseUrl || baseUrl}`}
          </div>
        )}

        <div className="bg-zinc-50 border rounded-lg p-3 text-xs text-zinc-600 space-y-2">
          <p><b>Hướng dẫn ShopAIKey:</b> Mua key tại <a href="https://shopaikey.com/en" target="_blank" className="underline">shopaikey.com</a> → copy API key → dán ở trên → chọn baseURL <code>https://api.shopaikey.com/v1</code> + model <code>gpt-4.1-mini</code> → Lưu.</p>
          <p><b>Cách server (.env.local):</b></p>
          <pre className="bg-zinc-900 text-zinc-100 p-2 rounded overflow-auto">OPENAI_API_KEY=sk-...&#10;OPENAI_BASE_URL=https://api.shopaikey.com/v1&#10;OPENAI_MODEL=gpt-4.1-mini</pre>
          <p>Mọi <code>/api/ai/*</code> đã đọc cả 2 nguồn — header luôn thắng ENV.</p>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-5">
        <h3 className="font-semibold text-sm">Test nhanh (gọi /explain với baseURL hiện tại)</h3>
        <TestBox baseUrl={baseUrl} />
      </div>
    </div>
  );
}

function TestBox({ baseUrl }: { baseUrl: string }) {
  const [word, setWord] = useState("perseverance");
  const [out, setOut] = useState("");
  const [loading, setLoading] = useState(false);
  const test = async () => {
    setLoading(true); setOut("");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const k = localStorage.getItem("openai_api_key");
      const b = localStorage.getItem("openai_base_url");
      const m = localStorage.getItem("openai_model");
      if (k) headers["x-openai-key"] = k;
      if (b) headers["x-openai-base-url"] = b;
      else headers["x-openai-base-url"] = baseUrl;
      if (m) headers["x-openai-model"] = m;
      const res = await fetch("/api/ai/explain", { method: "POST", headers, body: JSON.stringify({ word }) });
      const data = await res.json();
      setOut(JSON.stringify(data, null, 2));
    } catch (e) { setOut(String(e)); } finally { setLoading(false); }
  };
  return (
    <div className="space-y-2 mt-2">
      <div className="flex gap-2">
        <input value={word} onChange={(e) => setWord(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1" placeholder="Từ cần test" />
        <button onClick={test} disabled={loading} className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm disabled:opacity-50">{loading ? "..." : "Gọi /explain"}</button>
      </div>
      {out && <pre className="bg-zinc-900 text-green-300 p-3 rounded-lg text-xs overflow-auto max-h-60">{out}</pre>}
    </div>
  );
}
