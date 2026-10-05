import Link from "next/link";

export default function StudySkillsPlan() {
  return <section className="rounded-2xl border bg-white p-5">
    <h2 className="font-semibold">Buổi học đủ kỹ năng · 30 phút</h2>
    <p className="mt-2 text-sm text-zinc-600">Dùng lịch này khi muốn tập trung đọc và nghe. Học một bài ngắn mỗi mục; hôm sau ôn lại vài từ và câu đã chọn.</p>
    <ol className="mt-4 space-y-3 text-sm">
      <li><Link href="/flashcards" className="font-medium underline">5 phút · Ôn từ đến hạn →</Link><p className="mt-1 text-zinc-500">Thử nhớ nghĩa và nói từ trước khi lật thẻ.</p></li>
      <li><Link href="/library" className="font-medium underline">5 phút · Một điểm ngữ pháp hoặc phát âm →</Link><p className="mt-1 text-zinc-500">Đọc giải thích, làm câu hỏi và tự đặt một câu.</p></li>
      <li><Link href="/reading" className="font-medium underline">8 phút · Đọc hiểu →</Link><p className="mt-1 text-zinc-500">Đọc ý chính, làm quiz, lưu tối đa 3 cụm bạn muốn dùng.</p></li>
      <li><Link href="/podcasts" className="font-medium underline">8 phút · Nghe chủ động →</Link><p className="mt-1 text-zinc-500">Nghe trước, kiểm tra transcript sau, lặp một đoạn ngắn.</p></li>
      <li><Link href="/speaking" className="font-medium underline">4 phút · Nói lại bằng lời của bạn →</Link><p className="mt-1 text-zinc-500">Đọc theo một câu vừa nghe rồi nói 3 câu về bản thân.</p></li>
    </ol>
  </section>;
}
