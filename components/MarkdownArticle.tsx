/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

function headingId(children: ReactNode): string {
  return String(children).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase();
}

export default function MarkdownArticle({ markdown }: { markdown: string }) {
  return <div className="markdown-article">
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        h1: () => null,
        h2: ({ children }) => <h2 id={headingId(children)} data-section>{children}</h2>,
        h3: ({ children }) => <h3 id={headingId(children)}>{children}</h3>,
        p: ({ node, children }) => node?.children.some(child => child.type === "element" && child.tagName === "img") ? <>{children}</> : <p>{children}</p>,
        img: ({ alt, src }) => <figure><img src={src} alt={alt ?? "论文插图"} loading="lazy" /><figcaption>{alt}</figcaption></figure>,
        a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
      }}
    >{markdown}</ReactMarkdown>
  </div>;
}
