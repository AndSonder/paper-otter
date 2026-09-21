import type { Metadata } from "next";
import { headers } from "next/headers";
import "katex/dist/katex.min.css";
import "./globals.css";
export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const origin = new URL(`${protocol}://${host}`);
  return {
    metadataBase: origin,
    title: "每日论文 · 你的个性化学术阅读",
    description: "用本地画像和真实阅读反馈，持续改进每天的一篇论文推荐。",
    openGraph: { title: "每日论文", description: "让推荐从你的真实问题开始", images: [new URL("/og.png",origin).href] },
    twitter: { card: "summary_large_image", title: "每日论文", images: [new URL("/og.png",origin).href] },
  };
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
