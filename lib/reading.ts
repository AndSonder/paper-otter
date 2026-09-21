export type ReadingRecord = { paperId: string; liked: number; saved: number; reason: string; seconds: number; progress: number; updatedAt: string };
export type ReadingAction =
  | { type: "feedback"; paperId: string; field: "liked" | "saved" | "reason"; value: number | string }
  | { type: "session"; paperId: string; sessionId: string; seconds: number; progress: number }
  | { type: "exposure"; paperIds: string[] };
export const reasons = ["主题无关", "太基础", "太难", "暂时不想读"];
const paperIdPattern = /^[a-zA-Z0-9._/-]{1,100}$/;
export function parseAction(value: unknown): ReadingAction | null {
  if (!value || typeof value !== "object") return null;
  const a = value as Record<string, unknown>;
  if (a.type === "exposure") return Array.isArray(a.paperIds) && a.paperIds.length <= 20 && a.paperIds.every(id => typeof id === "string" && paperIdPattern.test(id)) ? a as ReadingAction : null;
  if (typeof a.paperId !== "string" || !paperIdPattern.test(a.paperId)) return null;
  if (a.type === "feedback") {
    if ((a.field === "liked" || a.field === "saved") && (a.value === 0 || a.value === 1)) return a as ReadingAction;
    if (a.field === "reason" && typeof a.value === "string" && [...reasons, ""].includes(a.value)) return a as ReadingAction;
  }
  if (a.type === "session" && typeof a.sessionId === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(a.sessionId) && Number.isInteger(a.seconds) && Number.isInteger(a.progress) && Number(a.seconds) >= 0 && Number(a.seconds) <= 86400 && Number(a.progress) >= 0 && Number(a.progress) <= 100) return a as ReadingAction;
  return null;
}
