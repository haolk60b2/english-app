import Link from "next/link";
import { BookOpen, Mic, PenLine, BookText, LayoutDashboard, Settings, Languages, Timer, Library, Headphones } from "lucide-react";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/study", label: "Học 30 phút", icon: Timer },
  { href: "/library", label: "Tài liệu", icon: Library },
  { href: "/flashcards", label: "Flashcards", icon: BookOpen },
  { href: "/speaking", label: "Luyện nói", icon: Mic },
  { href: "/translate", label: "Dịch audio", icon: Languages },
  { href: "/reading", label: "Luyện đọc", icon: BookText },
  { href: "/podcasts", label: "Podcast", icon: Headphones },
  { href: "/writing", label: "Writing Coach", icon: PenLine },
  { href: "/settings", label: "Cài đặt", icon: Settings },
];

export default function Navbar() {
  return (
    <nav aria-label="Điều hướng chính" className="flex items-center gap-1 p-3 border-b bg-white/95 sticky top-0 z-10 overflow-x-auto whitespace-nowrap">
      <Link href="/" className="font-bold text-lg mr-4 flex items-center gap-2">
        <span className="bg-black text-white px-2 py-1 rounded text-sm">EN</span> Cấp Tốc
      </Link>
      {nav.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className="px-3 py-2 rounded-lg text-sm font-medium hover:bg-zinc-100 flex items-center gap-1.5 text-zinc-700"
        >
          <n.icon size={16} /> {n.label}
        </Link>
      ))}
    </nav>
  );
}
