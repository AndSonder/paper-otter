import { env } from "cloudflare:workers";
import type { ReadingAction, ReadingRecord } from "../lib/reading";

export async function readingDb() {
  const db = env.DB;
  if (!db) throw new Error("Reading database unavailable");
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS feedback (user_id TEXT NOT NULL, paper_id TEXT NOT NULL, liked INTEGER NOT NULL DEFAULT 0, saved INTEGER NOT NULL DEFAULT 0, reason TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL, PRIMARY KEY(user_id,paper_id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS reading_sessions (user_id TEXT NOT NULL,paper_id TEXT NOT NULL,session_id TEXT NOT NULL,seconds INTEGER NOT NULL DEFAULT 0,progress INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,PRIMARY KEY(user_id,paper_id,session_id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS exposures (user_id TEXT NOT NULL,paper_id TEXT NOT NULL,day TEXT NOT NULL,position INTEGER NOT NULL,PRIMARY KEY(user_id,paper_id,day))"),
  ]);
  return db;
}

export async function readRecords(userId: string) {
  const db = await readingDb();
  const result = await db.prepare(`WITH ids AS (
    SELECT paper_id FROM feedback WHERE user_id=? UNION SELECT paper_id FROM reading_sessions WHERE user_id=?
  ), activity AS (
    SELECT paper_id,SUM(seconds) seconds,MAX(progress) progress,MAX(updated_at) updated_at FROM reading_sessions WHERE user_id=? GROUP BY paper_id
  ) SELECT ids.paper_id paperId,COALESCE(f.liked,0) liked,COALESCE(f.saved,0) saved,COALESCE(f.reason,'') reason,
  COALESCE(a.seconds,0) seconds,COALESCE(a.progress,0) progress,MAX(COALESCE(a.updated_at,''),COALESCE(f.updated_at,'')) updatedAt
  FROM ids LEFT JOIN feedback f ON f.paper_id=ids.paper_id AND f.user_id=? LEFT JOIN activity a ON a.paper_id=ids.paper_id`).bind(userId,userId,userId,userId).all<ReadingRecord>();
  const exposures = await db.prepare("SELECT paper_id paperId,day,position FROM exposures WHERE user_id=? ORDER BY day DESC,position").bind(userId).all();
  return { records: result.results, exposures: exposures.results };
}

export async function saveAction(userId: string, action: ReadingAction) {
  const db = await readingDb();
  const now = new Date().toISOString();
  if (action.type === "exposure") {
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    if (action.paperIds.length) await db.batch(action.paperIds.map((id,i) => db.prepare("INSERT OR IGNORE INTO exposures(user_id,paper_id,day,position) VALUES(?,?,?,?)").bind(userId,id,day,i)));
    return;
  }
  if (action.type === "session") {
    await db.prepare(`INSERT INTO reading_sessions(user_id,paper_id,session_id,seconds,progress,updated_at) VALUES(?,?,?,?,?,?)
      ON CONFLICT(user_id,paper_id,session_id) DO UPDATE SET seconds=MAX(seconds,excluded.seconds),progress=MAX(progress,excluded.progress),updated_at=excluded.updated_at`)
      .bind(userId,action.paperId,action.sessionId,action.seconds,action.progress,now).run();
    return;
  }
  // field is constrained by parseAction; values always use SQL parameters.
  await db.prepare(`INSERT INTO feedback(user_id,paper_id,${action.field},updated_at) VALUES(?,?,?,?)
    ON CONFLICT(user_id,paper_id) DO UPDATE SET ${action.field}=excluded.${action.field},updated_at=excluded.updated_at`)
    .bind(userId,action.paperId,action.value,now).run();
}
