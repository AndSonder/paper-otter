import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const script = new URL('../scripts/paperctl.py', import.meta.url).pathname;
const metadata = id => ({id,title:'测试论文',englishTitle:'Test Paper',year:'2026',tags:['systems'],minutes:30,reason:'连接当前目标',source:'https://example.test/paper'});
function execute(root,...args) { return spawnSync('python3',[script,...args],{env:{...process.env,PAPER_DAILY_ROOT:root},encoding:'utf8'}); }
function run(root,...args) { const result=execute(root,...args); assert.equal(result.status,0,result.stderr || result.stdout); }

test('publishes recommendation metadata without pretending it is an article',async()=> {
  const root=await mkdtemp(join(tmpdir(),'paper-otter-metadata-'));
  const paperDir=join(root,'.paper-daily','papers','test.0001'); await mkdir(paperDir,{recursive:true});
  await writeFile(join(paperDir,'paper.json'),JSON.stringify(metadata('test.0001')));
  run(root,'sync');
  const catalog=JSON.parse(await readFile(join(root,'public','local','catalog.json'),'utf8'));
  assert.equal(catalog.papers[0].markdown,'');
  assert.equal(catalog.papers[0].contentStatus,'metadata');
});

test('publishes an article only after the complete writing workflow',async()=> {
  const root=await mkdtemp(join(tmpdir(),'paper-otter-writing-'));
  const paperDir=join(root,'.paper-daily','papers','test.0002'); await mkdir(paperDir,{recursive:true});
  await writeFile(join(paperDir,'paper.json'),JSON.stringify(metadata('test.0002')));
  const article='## 核心问题\n\n经过完整流程的正文。\n';
  for (const name of ['article.md','evidence.md','logic-draft.md','logic-review.md','reader-draft.md','reader-report.md','revision-notes.md']) await writeFile(join(paperDir,name),name==='article.md'?article:`# ${name}\n`);
  await writeFile(join(paperDir,'writing.json'),JSON.stringify({version:1,status:'complete',pipeline:'sujianlin-write-skills',articleSha256:createHash('sha256').update(article).digest('hex')}));
  run(root,'sync');
  const catalog=JSON.parse(await readFile(join(root,'public','local','catalog.json'),'utf8'));
  assert.equal(catalog.papers[0].markdown,article);
  assert.equal(catalog.papers[0].contentStatus,'reviewed');
});

test('rejects an article that bypasses the writing workflow',async()=> {
  const root=await mkdtemp(join(tmpdir(),'paper-otter-incomplete-'));
  const paperDir=join(root,'.paper-daily','papers','test.0003'); await mkdir(paperDir,{recursive:true});
  await writeFile(join(paperDir,'paper.json'),JSON.stringify(metadata('test.0003')));
  await writeFile(join(paperDir,'article.md'),'占位正文');
  const result=execute(root,'sync');
  assert.notEqual(result.status,0);
  assert.match(result.stderr + result.stdout,/article\.md and writing\.json must be created together/);
});

test('rejects a stale completion manifest after article edits',async()=> {
  const root=await mkdtemp(join(tmpdir(),'paper-otter-stale-'));
  const paperDir=join(root,'.paper-daily','papers','test.0004'); await mkdir(paperDir,{recursive:true});
  await writeFile(join(paperDir,'paper.json'),JSON.stringify(metadata('test.0004')));
  for (const name of ['article.md','evidence.md','logic-draft.md','logic-review.md','reader-draft.md','reader-report.md','revision-notes.md']) await writeFile(join(paperDir,name),'content');
  await writeFile(join(paperDir,'writing.json'),JSON.stringify({version:1,status:'complete',pipeline:'sujianlin-write-skills',articleSha256:'stale'}));
  const result=execute(root,'sync');
  assert.notEqual(result.status,0);
  assert.match(result.stderr + result.stdout,/article hash does not match/);
});
