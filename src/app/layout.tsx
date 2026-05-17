import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'LiveMent — 实时互动投票 & 问答平台',
  description: '三秒发起，零摩擦加入。支持投票、问答、词云、评分、排行榜的实时互动工具。',
  openGraph: {
    title: 'LiveMent — 实时互动投票 & 问答平台',
    description: '三秒发起，零摩擦加入。支持投票、问答、词云、评分、排行榜的实时互动工具。',
    type: 'website',
    locale: 'zh_CN',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LiveMent — 实时互动投票 & 问答平台',
    description: '三秒发起，零摩擦加入。支持投票、问答、词云、评分、排行榜的实时互动工具。',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><Providers>{children}</Providers></body>
    </html>
  );
}
