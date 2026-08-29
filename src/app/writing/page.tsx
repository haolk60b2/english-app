"use client";
import { useState } from "react";
import { HallmarkHeading } from "@/components/HallmarkHeading";

export default function WritingPage() {
  const [text, setText] = useState("I go to school everyday and I learn English very hardly.");
  const [result, setResult] = useState<null | { score: number; corrected: string; explains: string[] }>(null);
  const [loading, setLoading] = useState(false);

  const handleCheck = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const k = typeof window !== "undefined" ? localStorage.getItem("openai_api_key") : null; const b = typeof window !== "undefined" ? localStorage.getItem("openai_base_url") : null; if (k) headers["x-openai-key"] = k; if (b) headers["x-openai-base-url"] = b; const m = typeof window !== "undefined" ? localStorage.getItem("openai_model") : null; if (m) headers["x-openai-model"] = m;
      const res = await fetch("/api/ai/writing", { method: "POST", headers, body: JSON.stringify({ text }) });
      const data = await res.json();
      if (data.error) alert(data.error);
      else setResult(data);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <HallmarkHeading eyebrow="HALLMARK • VIẾT & SỬA" title="AI Writing Coach" subtitle="Viết câu/đoạn → AI chấm gpt-5-mini/gpt-4.1-mini, giải thích ngữ pháp tiếng Việt, cho điểm CEFR." />

      <div className="bg-white border rounded-2xl p-5 space-y-3">
        <label className="text-sm font-medium">Bài viết của bạn</label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="w-full border rounded-xl p-3 text-sm" placeholder="Write something in English..." />
        <button onClick={handleCheck} disabled={loading || !text.trim()} className="px-5 py-2.5 bg-zinc-900 text-white rounded-full text-sm disabled:opacity-50">{loading ? "Đang chấm..." : "Chấm bài"}</button>
      </div>

      {result && (
        <div className="bg-white border rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2"><span className="text-sm font-semibold">Điểm:</span><span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-bold">{result.score}/100</span></div>
          <div>
            <h3 className="text-sm font-semibold">Bản sửa</h3>
            <p className="mt-1 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">{result.corrected}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Giải thích</h3>
            <ul className="list-disc pl-5 mt-1 space-y-1 text-sm text-zinc-700">
              {result.explains.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        </div>
      )}

      <div className="bg-zinc-900 text-zinc-100 rounded-xl p-4 text-xs">
        API stub hiện trả mock. Khi có OPENAI_API_KEY, route <code>/api/ai/writing</code> sẽ gọi LLM với prompt: &quot;Bạn là giáo viên IELTS, sửa lỗi, giải thích tại sao, cho IPA nếu cần&quot;.
      </div>
    </div>
  );
}
