import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "English Cấp Tốc - Tự học tại nhà",
  description: "Flashcard FSRS + AI Speaking + Reading + Writing Coach",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <Navbar />
        <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6">{children}</main>
        <footer className="text-center text-xs text-zinc-400 py-6 border-t bg-white">
          Xây dựng bởi Next.js 16 • Tailwind 4 • Supabase • FSRS • Whisper/TTS • LocalStorage fallback
        </footer>
      </body>
    </html>
  );
}
