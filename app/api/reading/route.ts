import { getChatGPTUser } from "../../chatgpt-auth";
import { readRecords, saveAction } from "../../../db/reading-store";
import { parseAction } from "../../../lib/reading";

async function currentUser() {
  const user = await getChatGPTUser();
  if (user) return user.userId;
  return process.env.NODE_ENV === "development" ? "local-preview" : null;
}
export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "请登录后读取阅读记录" }, { status: 401 });
  try {
    return Response.json(await readRecords(user), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Reading load failed", error);
    return Response.json({ error: "阅读记录暂时不可用，请重试" }, { status: 503 });
  }
}
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Invalid origin" }, { status: 403 });
  const user = await currentUser();
  if (!user) return Response.json({ error: "请登录后保存阅读记录" }, { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return Response.json({ error: "Request too large" }, { status: 413 });
  let payload: unknown;
  try { const raw = await request.text(); if (raw.length > 4096) throw new Error("Too large"); payload = JSON.parse(raw); }
  catch { return Response.json({ error: "无效请求" }, { status: 400 }); }
  const action = parseAction(payload);
  if (!action) return Response.json({ error: "无效的阅读反馈" }, { status: 400 });
  try {
    await saveAction(user, action);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Reading save failed", error);
    return Response.json({ error: "尚未保存，请重试" }, { status: 503 });
  }
}
