import type { Metadata } from "next";
import { Nunito, Inter } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  weight: ["600", "700", "800"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "LearnEnglish - Học Tiếng Anh Qua Video",
  description: "Nền tảng học tiếng Anh qua video YouTube với phụ đề tương tác, từ vựng và nhiều chế độ học tập.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${nunito.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-slate-50">
        {children}
      </body>
    </html>
  );
}
