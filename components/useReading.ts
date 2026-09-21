"use client";
import { useEffect, useRef, useState } from "react";
import type { ReadingAction, ReadingRecord } from "../lib/reading";

type ReadingResponse = { records: ReadingRecord[]; exposures: { paperId: string; day: string; position: number }[]; error?: string };

export function useReading(paperId: string | null, exposedPaperIds: string[]) {
  const [records, setRecords] = useState<ReadingRecord[]>([]);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState(0);
  const serial = useRef(Promise.resolve());
  const reload = async () => {
    try {
      const response = await fetch("/api/reading");
      const body = await response.json() as ReadingResponse;
      if (!response.ok) throw new Error(body.error);
      setRecords(body.records); setError(""); setReady(true);
    } catch (e) { setError(e instanceof Error ? e.message : "记录加载失败"); }
  };
  useEffect(() => { queueMicrotask(() => void reload()); }, []);

  async function send(action: ReadingAction, keepalive = false) {
    const response = await fetch("/api/reading", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action), keepalive });
    if (!response.ok) { const body = await response.json() as { error?: string }; throw new Error(body.error || "保存失败"); }
  }
  useEffect(() => {
    if (ready && exposedPaperIds.length) void send({ type: "exposure", paperIds: exposedPaperIds }).catch(e => setError(e.message));
  }, [ready, exposedPaperIds]);

  useEffect(() => {
    queueMicrotask(() => { setElapsed(0); setProgress(0); });
    if (!ready || !paperId) return;
    const sessionId = crypto.randomUUID();
    let seconds = 0, maxProgress = 0, lastInteraction = Date.now(), lastTick = Date.now();
    const interact = () => { lastInteraction = Date.now(); };
    const measure = () => {
      const article = document.getElementById("paper-article");
      if (!article) return;
      const box = article.getBoundingClientRect();
      const value = Math.min(100, Math.max(0, Math.round((innerHeight - box.top) / box.height * 100)));
      maxProgress = Math.max(maxProgress,value); setProgress(value);
    };
    const flush = () => {
      if (!seconds) return;
      void send({ type: "session", paperId, sessionId, seconds: Math.floor(seconds), progress: maxProgress }, true).catch(e => setError(e.message));
    };
    const visibility = () => { lastTick = Date.now(); if (document.hidden) flush(); else interact(); };
    const interval = setInterval(() => {
      const now = Date.now(), delta = Math.min(1000, now - lastTick); lastTick = now;
      if (!document.hidden && document.hasFocus() && now - lastInteraction < 60000) {
        seconds += delta / 1000; setElapsed(Math.floor(seconds)); measure();
      }
    }, 1000);
    const saveInterval = setInterval(flush,15000);
    const events = ["pointerdown","pointermove","keydown","scroll"];
    events.forEach(e => window.addEventListener(e,interact,{ passive: true }));
    window.addEventListener("scroll",measure,{ passive: true });
    window.addEventListener("pagehide",flush);
    document.addEventListener("visibilitychange",visibility);
    measure();
    return () => {
      clearInterval(interval); clearInterval(saveInterval); flush();
      events.forEach(e => window.removeEventListener(e,interact));
      window.removeEventListener("scroll",measure); window.removeEventListener("pagehide",flush);
      document.removeEventListener("visibilitychange",visibility);
    };
  }, [paperId,ready]);

  function feedback(id: string, field: "liked" | "saved" | "reason", value: number | string) {
    setPending(true);
    serial.current = serial.current.then(async () => {
      try { await send({ type: "feedback", paperId: id, field, value }); await reload(); }
      catch (e) { setError(e instanceof Error ? e.message : "保存失败"); }
      finally { setPending(false); }
    });
  }
  async function exportHistory() {
    try {
      const response = await fetch("/api/reading");
      if (!response.ok) throw new Error("导出失败，请重试");
      const history = await response.json() as ReadingResponse;
      const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), ...history },null,2)], { type: "application/json" });
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = "paper-otter-reading.json"; link.click(); URL.revokeObjectURL(url);
    } catch(e) { setError(e instanceof Error ? e.message : "导出失败"); }
  }
  return { records, error, ready, pending, elapsed, progress, feedback, reload, exportHistory };
}
