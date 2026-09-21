import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
export const feedback = sqliteTable("feedback", {
  userId: text("user_id").notNull(), paperId: text("paper_id").notNull(),
  liked: integer("liked").notNull().default(0), saved: integer("saved").notNull().default(0),
  reason: text("reason").notNull().default(""), updatedAt: text("updated_at").notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.paperId] })]);
export const sessions = sqliteTable("reading_sessions", {
  userId: text("user_id").notNull(), paperId: text("paper_id").notNull(), sessionId: text("session_id").notNull(),
  seconds: integer("seconds").notNull().default(0), progress: integer("progress").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.paperId, t.sessionId] })]);
export const exposures = sqliteTable("exposures", {
  userId: text("user_id").notNull(), paperId: text("paper_id").notNull(), day: text("day").notNull(),
  position: integer("position").notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.paperId, t.day] })]);
