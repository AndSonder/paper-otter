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
    title: "Paper Otter · 你的个性化论文阅读",
    description: "用本地画像和真实阅读反馈，持续改进每天的一篇论文推荐。",
    icons: { icon: "/favicon.png" },
    openGraph: { title: "Paper Otter", description: "每天替你捞一篇值得读的论文", images: [new URL("/og.png",origin).href] },
    twitter: { card: "summary_large_image", title: "Paper Otter", images: [new URL("/og.png",origin).href] },
  };
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
