"use client";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { isPaper, type Paper } from "../lib/papers";
import { reasons } from "../lib/reading";
import { useReading } from "./useReading";
import Timeline from "./Timeline";
import MarkdownArticle from "./MarkdownArticle";

type View = "today" | "library" | "saved" | "history";
const navItems: { id: View; label: string }[] = [{ id: "today", label: "今日" }, { id: "library", label: "阅读库" }, { id: "saved", label: "我的收藏" }];

export default function Reader() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [catalogReady, setCatalogReady] = useState(false);
  const [selected, setSelected] = useState("");
  const [view, setView] = useState<View>("today");
  const [focus, setFocus] = useState(false);
  const [bilingual, setBilingual] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const [date, setDate] = useState("今日阅读");
  const [size, setSize] = useState(18);
  const rejectDialog = useRef<HTMLDialogElement>(null);
  const paper = papers.find(p => p.id === selected);
  const paperIds = useMemo(() => papers.map(item => item.id), [papers]);
  const outline = paper?.outline ?? paper?.sections.map((section, index) => ({ title: section.title, id: `section-${index}` })) ?? [];
  const reading = useReading(view === "today" && selected ? selected : null, paperIds);
  const record = reading.records.find(r => r.paperId === selected);
  const visible = papers.filter(p => (!query || `${p.title} ${p.englishTitle} ${p.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase())) && (view !== "saved" || reading.records.some(r => r.paperId === p.id && r.saved)));

  useEffect(() => {
    fetch("/local/catalog.json", { cache: "no-store" })
      .then(response => response.ok ? response.json() : { papers: [] })
      .then(value => {
        const catalog = value as { papers?: unknown[] };
        const loaded = Array.isArray(catalog.papers) ? catalog.papers.filter(isPaper) : [];
        setPapers(loaded);
        setSelected(current => current || loaded[0]?.id || "");
      })
      .catch(() => setPapers([]))
      .finally(() => setCatalogReady(true));
    // The date is client-only so SSR output stays deterministic across runtimes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDate(new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long", timeZone: "Asia/Shanghai" }).format(new Date()));
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") { setFocus(false); setSearching(false); } };
    window.addEventListener("keydown",escape);
    return () => window.removeEventListener("keydown",escape);
  }, []);
  useEffect(() => {
    if (view !== "today") return;
    const observer = new IntersectionObserver(entries => {
      const entry = entries.find(e => e.isIntersecting);
      if (entry) setActiveSection(Number(entry.target.getAttribute("data-section-index")));
    }, { rootMargin: "-100px 0px -55% 0px" });
    document.querySelectorAll("[data-section]").forEach((el, index) => {
      el.setAttribute("data-section-index", String(index));
      observer.observe(el);
    });
    return () => observer.disconnect();
  }, [selected,view]);

  function openPaper(p: Paper) { setSelected(p.id); setView("today"); setActiveSection(0); setSearching(false); setQuery(""); window.scrollTo({ top: 0 }); }
  function changeView(next: View) { setView(next); setFocus(false); void reading.reload(); window.scrollTo({ top: 0 }); }
  const feedback = (field: "liked" | "saved" | "reason", value: string | number) => reading.feedback(selected,field,value);

  if (!paper) return <div className="app">
    <header className="topbar"><span className="brand"><Image className="brand-logo" src="/paper-otter-logo.png" width={42} height={42} alt="" priority />Paper Otter</span><div className="header-tools"><span className="header-caption">让推荐从你的真实问题开始。</span><span className="avatar">阅</span></div></header>
    <main className="setup-empty"><span className="eyebrow">PERSONAL READING SYSTEM</span><h1>{catalogReady ? "先挑几篇你会点开的论文" : "正在读取本地阅读空间…"}</h1>{catalogReady && <><p>这个仓库不预装论文。使用 <code>$daily-paper-recommender</code> 获取一组真实候选，凭第一感觉选几篇即可；大模型会从这些选择和后续阅读中慢慢认识你。</p><ol><li>从具体论文卡片中选出想打开的内容</li><li>获得今天的一篇主读和少量备选</li><li>运行 <code>python3 scripts/paperctl.py sync</code>，回到这里阅读</li></ol><div className="setup-command">$daily-paper-recommender 给我一组候选，初始化阅读系统</div></>}</main>
  </div>;

  return <div className={focus ? "app focused" : "app"}>
    <a className="skip-link" href="#main">跳到正文</a>
    <header className="topbar">
      <button className="brand" onClick={() => changeView("today")} aria-label="Paper Otter 首页"><Image className="brand-logo" src="/paper-otter-logo.png" width={42} height={42} alt="" priority />Paper Otter</button>
      <nav aria-label="主导航">{navItems.map(item => <button key={item.id} className={view === item.id ? "nav-active" : ""} onClick={() => changeView(item.id)}>{item.label}</button>)}</nav>
      <div className="header-tools"><span className="header-caption">留半小时，给一个好问题。</span><button className="icon-button" aria-label="搜索论文" onClick={() => { setSearching(!searching); setView("library"); setFocus(false); }}>⌕</button><span className="avatar" aria-label="个人阅读空间">阅</span></div>
    </header>
    {searching && <div className="search-bar"><label htmlFor="search">搜索阅读库</label><input autoFocus id="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="论文、主题或关键词…" /><button onClick={() => { setSearching(false); setQuery(""); }}>关闭</button></div>}
    {reading.error && <div className="notice" role="alert">{reading.error}<button onClick={() => void reading.reload()}>重试</button></div>}
    <div className="workspace">
      <aside className="paper-sidebar" aria-label="今日论文选择">
        <div className="issue-date">{date}</div><div className="eyebrow">YOUR DAILY READING</div>
        <h2 className="sidebar-heading">今日推荐 <span>{String(papers.length).padStart(2,"0")}</span></h2>
        <button className={`paper-choice primary ${selected === papers[0].id && view === "today" ? "selected" : ""}`} onClick={() => openPaper(papers[0])}>
          <span className="choice-label">▤ 今日主读 · 完整精读</span><strong>{papers[0].title}<span>›</span></strong><small>{papers[0].tags.join(" / ")}</small><span className="choice-footer">约 {papers[0].minutes} 分钟 · 含原图与推导</span>
        </button>
        <h3 className="alternative-title">换一篇读</h3>
        {papers.slice(1).map(p => <button key={p.id} className={`paper-choice alternative ${selected === p.id && view === "today" ? "selected" : ""}`} onClick={() => openPaper(p)}><strong><span className="paper-symbol">▤</span>{p.title}</strong><small>{p.tags.join(" / ")}<span>{p.minutes} 分钟</span></small>{reading.records.find(r => r.paperId === p.id)?.reason && <span className="muted">已标记 · 不感兴趣</span>}</button>)}
        <div className="sidebar-bottom"><p>从一个问题开始，<br />让每次阅读有所积累。</p><button onClick={() => changeView("history")}>◷ <span>查看阅读记录</span> ↗</button></div>
      </aside>
      <main id="main" className={view === "today" ? "reading-main" : "collection-main"}>
        {view === "today" ? <>
          <div className="article-topline"><span>阅读库 <b>/</b> 个性化推荐 <b>/</b> {paper.tags[0]}</span><button className="quiet" onClick={() => setFocus(!focus)}>{focus ? "↙ 退出专注" : "⛶ 专注阅读"}</button></div>
          <article id="paper-article" style={{ "--reading-size": `${size}px` } as React.CSSProperties}>
            <div className="article-meta"><span className="badge">{paper.markdown ? "今日精读" : "经典论文"}</span><span>{paper.year}</span><span>·</span><span>阅读约 {paper.minutes} 分钟</span></div>
            <h1>{paper.title}</h1><p className="english-title">{paper.englishTitle}</p>
            <div className="reading-toolbar">{!paper.markdown && <div className="mode-switch" aria-label="导读语言"><button aria-pressed={!bilingual} className={!bilingual ? "active" : ""} onClick={() => setBilingual(false)}>中文导读</button><button aria-pressed={bilingual} className={bilingual ? "active" : ""} onClick={() => setBilingual(true)}>双语导读</button></div>}<div className="feedback-actions"><button disabled={!reading.ready || reading.pending} aria-pressed={!!record?.saved} onClick={() => feedback("saved",record?.saved ? 0 : 1)}>{record?.saved ? "▣ 已收藏" : "♧ 收藏"}</button><button disabled={!reading.ready || reading.pending} aria-pressed={!!record?.liked} onClick={() => feedback("liked",record?.liked ? 0 : 1)}>{record?.liked ? "♥ 已点赞" : "♡ 点赞"}</button><span className="divider" /><button disabled={!reading.ready || reading.pending} aria-pressed={!!record?.reason} onClick={() => rejectDialog.current?.showModal()}>{record?.reason ? "⊘ 已反馈" : "⊘ 不感兴趣"}</button></div></div>
            <div className="recommendation"><span className="leaf" aria-hidden="true">❧</span><div><strong>为什么推荐给你</strong><p>{paper.reason}</p></div></div>
            {!paper.markdown && bilingual && <p className="translation-note">英文为导读的英文释义；论文原文请通过章节下方链接查看。</p>}
            {paper.markdown ? <MarkdownArticle markdown={paper.markdown} /> : paper.sections.map((section,i) => <section key={`${paper.id}-${i}`} id={`section-${i}`} data-section className="article-section"><h2><span>{String(i+1).padStart(2,"0")}</span>{section.title}</h2><div className="section-content">{section.paragraphs.map(text => <p key={text}>{text}</p>)}{section.diagram && <Timeline />}{bilingual && <blockquote lang="en">{section.english}</blockquote>}<a className="source-link" href={paper.source} target="_blank" rel="noreferrer">来源：论文摘要 ↗</a></div></section>)}
            <footer className="article-footer"><div><span className="eyebrow">ONE PAPER, ONE THOUGHT</span><h3>今天，带走一个新的理解。</h3><p>你的阅读和反馈，会成为下一次选文的参考。</p></div><button className="outline-button" onClick={() => changeView("library")}>回到阅读库 →</button></footer>
          </article>
        </> : <>
          <div className="eyebrow">YOUR READING SPACE</div><h1>{view === "library" ? "阅读库" : view === "saved" ? "我的收藏" : "阅读记录"}</h1><p className="collection-description">{view === "history" ? "保存走过的阅读路径，也让下一次推荐更懂你。" : "值得读的问题，留在这里慢慢理解。"}</p>
          {view === "history" && <button className="outline-button export" onClick={() => void reading.exportHistory()}>↓ 导出阅读记录</button>}
          <div className="collection-list">{visible.map(p => { const r = reading.records.find(r => r.paperId === p.id); if (view === "history" && !r) return null; return <button className="collection-card" key={p.id} onClick={() => openPaper(p)}><div className="card-meta">{p.year} · {p.tags.join(" / ")}</div><h2>{p.title}<span>↗</span></h2><p>{p.englishTitle}</p><div className="card-footer"><span>{r?.saved ? "已收藏 · " : ""}{r?.liked ? "已点赞 · " : ""}{r?.reason || `示例导读 ${p.minutes} 分钟`}</span><span>{r ? `有效阅读 ${Math.floor(r.seconds / 60)} 分 ${r.seconds % 60} 秒 · 浏览 ${r.progress}%` : "尚未阅读"}</span></div></button>; })}</div>
          {((view === "saved" && !visible.length) || (view === "history" && !reading.records.length) || (query && !visible.length)) && <div className="empty-state"><span>▤</span><h2>{query ? "没有找到相关论文" : view === "saved" ? "把想再读的论文留在这里" : "从今天的第一篇开始"}</h2><p>{query ? "换一个主题、作者或关键词试试。" : "打开一篇论文，读一会儿，或收藏下来。"}</p><button className="outline-button" onClick={() => openPaper(papers[0])}>开始阅读 →</button></div>}
        </>}
      </main>
      {view === "today" && <aside className="reading-aside" aria-label="阅读辅助"><h2>本篇导航</h2><nav className="outline-nav" aria-label="章节导航">{outline.map((item,i) => <a className={activeSection === i ? "active" : ""} key={item.id} href={`#${item.id}`} onClick={() => setActiveSection(i)}>{item.title}</a>)}</nav><div className="aside-block"><h3>阅读进度</h3><progress value={reading.progress} max={100} aria-label="当前浏览进度" /><p>本次有效阅读 {Math.floor(reading.elapsed/60)} 分 {reading.elapsed%60} 秒</p></div><div className="aside-block terms"><h3>遇到术语？</h3>{paper.terms.map(term => <details key={term.name}><summary>{term.name}<span>＋</span></summary><p>{term.meaning}</p></details>)}</div><div className="font-controls"><span>正文字号</span><button aria-label="缩小字号" disabled={size <= 16} onClick={() => setSize(size-1)}>A−</button><button aria-label="放大字号" disabled={size >= 23} onClick={() => setSize(size+1)}>A＋</button></div><a className="outline-button original-link" href={paper.source} target="_blank" rel="noreferrer">查看论文原文 ↗</a><p className="aside-footnote">英文摘要与 PDF 均可从原文页打开</p></aside>}
    </div>
    <dialog ref={rejectDialog} className="feedback-dialog"><form method="dialog"><button className="dialog-close" aria-label="关闭反馈窗口">×</button></form><span className="eyebrow">HELP SHAPE YOUR READING</span><h2>这篇不太适合你？</h2><p>留下原因，方便后续调整选文。没有点赞不会被当成负反馈。</p><div className="reason-options">{reasons.map(reason => <button key={reason} disabled={reading.pending} onClick={() => { feedback("reason",reason); rejectDialog.current?.close(); }}>{reason}</button>)}</div>{record?.reason && <button className="quiet" onClick={() => { feedback("reason",""); rejectDialog.current?.close(); }}>撤销“不感兴趣”</button>}</dialog>
  </div>;
}
