import assert from 'node:assert/strict';
import test from 'node:test';
const origin = process.env.PAPER_DAILY_TEST_URL ?? 'http://localhost:3000';
const headers = { 'oai-authenticated-user-id': 'integration-test', 'oai-authenticated-user-email': 'test@example.invalid', 'Content-Type':'application/json', Origin: origin };
async function post(action) { return fetch(`${origin}/api/reading`, { method:'POST', headers, body:JSON.stringify(action) }); }
async function records(customHeaders=headers) { const response = await fetch(`${origin}/api/reading`,{headers:customHeaders}); assert.equal(response.status,200); return response.json(); }

test('serves the personalized reader onboarding without bundled papers',async()=> {
  const response = await fetch(origin); assert.equal(response.status,200);
  const html = await response.text(); assert.match(html,/Paper Otter/); assert.match(html,/PERSONAL READING SYSTEM/); assert.doesNotMatch(html,/FLUX 如何把跨卡搬运塞进 GEMM|codex-preview|Building your site/);
});
test('persists independent feedback, makes session retries idempotent, isolates readers',async()=> {
  const paperId='2404.19429', sessionId=crypto.randomUUID();
  assert.equal((await post({type:'exposure',paperIds:['2406.06858','2404.19429','1910.02054','1811.06965']})).status,200);
  for (const action of [{type:'feedback',paperId,field:'saved',value:1},{type:'feedback',paperId,field:'liked',value:1},{type:'feedback',paperId,field:'reason',value:'太基础'}]) assert.equal((await post(action)).status,200);
  const before = (await records()).records.find(r=>r.paperId===paperId)?.seconds ?? 0;
  for(const seconds of [30,30,15]) assert.equal((await post({type:'session',paperId,sessionId,seconds,progress:45})).status,200);
  const record=(await records()).records.find(r=>r.paperId===paperId);
  assert.equal(record.seconds,before+30); assert.equal(record.saved,1); assert.equal(record.liked,1); assert.equal(record.reason,'太基础'); assert.ok(record.progress>=45);
  const other=await records({...headers,'oai-authenticated-user-id':crypto.randomUUID()}); assert.equal(other.records.length,0);
  assert.equal((await post({type:'session',paperId,sessionId,seconds:-1,progress:200})).status,400);
  assert.equal((await post({type:'feedback',paperId,field:'user_id',value:'attacker'})).status,400);
  const crossSite=await fetch(`${origin}/api/reading`,{method:'POST',headers:{...headers,Origin:'https://other.invalid'},body:JSON.stringify({type:'feedback',paperId,field:'saved',value:0})}); assert.equal(crossSite.status,403);
});
