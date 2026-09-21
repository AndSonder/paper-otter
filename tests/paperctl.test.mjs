import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const script = new URL('../scripts/paperctl.py', import.meta.url).pathname;
const metadata = id => ({id,title:'测试论文',englishTitle:'Test Paper',year:'2026',tags:['systems'],minutes:30,reason:'连接当前目标',source:'https://example.test/paper'});
function execute(root,...args) { return spawnSync('python3',[script,...args],{env:{...process.env,PAPER_DAILY_ROOT:root},encoding:'utf8'}); }
function run(root,...args) { const result=execute(root,...args); assert.equal(result.status,0,result.stderr || result.stdout); }
async function completeWriting(root,paperDir,article) {
  run(root,'writing-begin',paperDir.split('/').at(-1));
  for (const stage of ['evidence','logic-draft','logic-review','reader-draft','reader-report','revision-notes','article']) {
    await writeFile(join(paperDir,`${stage}.md`),stage==='article'?article:`# ${stage}\n`);
    run(root,'writing-record',paperDir.split('/').at(-1),stage);
  }
}

test('does not publish recommendation metadata as an empty website article',async()=> {
  const root=await mkdtemp(join(tmpdir(),'paper-otter-metadata-'));
  const paperDir=join(root,'.paper-daily','papers','test.0001'); await mkdir(paperDir,{recursive:true});
  await writeFile(join(paperDir,'paper.json'),JSON.stringify(metadata('test.0001')));
  run(root,'sync');
  const catalog=JSON.parse(await readFile(join(root,'public','local','catalog.json'),'utf8'));
  assert.deepEqual(catalog.papers,[]);
});

test('publishes an article only after the complete writing workflow',async()=> {
  const root=await mkdtemp(join(tmpdir(),'paper-otter-writing-'));
  const paperDir=join(root,'.paper-daily','papers','test.0002'); await mkdir(paperDir,{recursive:true});
  await writeFile(join(paperDir,'paper.json'),JSON.stringify(metadata('test.0002')));
  const article='## 核心问题\n\n经过完整流程的正文。\n';
  await completeWriting(root,paperDir,article);
  run(root,'sync');
  const catalog=JSON.parse(await readFile(join(root,'public','local','catalog.json'),'utf8'));
  assert.equal(catalog.papers[0].markdown,article);
  assert.equal(catalog.papers[0].contentStatus,'reviewed');
});

test('rewrites private relative image paths to published paper assets',async()=> {
  const root=await mkdtemp(join(tmpdir(),'paper-otter-images-'));
  const paperDir=join(root,'.paper-daily','papers','image-paper'); await mkdir(join(paperDir,'assets'),{recursive:true});
  await writeFile(join(paperDir,'paper.json'),JSON.stringify(metadata('image-paper')));
  await writeFile(join(paperDir,'assets','figure.png'),'png-bytes');
  await completeWriting(root,paperDir,'![机制图](assets/figure.png)\n');
  run(root,'sync');
  const catalog=JSON.parse(await readFile(join(root,'public','local','catalog.json'),'utf8'));
  assert.match(catalog.papers[0].markdown,/\/local\/papers\/image-paper\/figure\.png/);
  assert.equal(await readFile(join(root,'public','local','papers','image-paper','figure.png'),'utf8'),'png-bytes');
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
  await completeWriting(root,paperDir,'content');
  await writeFile(join(paperDir,'article.md'),'edited after completion');
  const result=execute(root,'sync');
  assert.notEqual(result.status,0);
  assert.match(result.stderr + result.stdout,/stale or invalid checkpoint for article/);
});

test('rejects a retrofitted workflow with future drafts already present',async()=> {
  const root=await mkdtemp(join(tmpdir(),'paper-otter-retrofit-'));
  const paperDir=join(root,'.paper-daily','papers','test.0005'); await mkdir(paperDir,{recursive:true});
  await writeFile(join(paperDir,'paper.json'),JSON.stringify(metadata('test.0005')));
  run(root,'writing-begin','test.0005');
  await writeFile(join(paperDir,'evidence.md'),'evidence');
  await writeFile(join(paperDir,'article.md'),'final text written too early');
  const result=execute(root,'writing-record','test.0005','evidence');
  assert.notEqual(result.status,0);
  assert.match(result.stderr + result.stdout,/Future writing stages already exist/);
});

test('rejects unsupported math delimiters before completing an article',async()=> {
  const root=await mkdtemp(join(tmpdir(),'paper-otter-math-delimiter-'));
  const paperDir=join(root,'.paper-daily','papers','bad-math'); await mkdir(paperDir,{recursive:true});
  await writeFile(join(paperDir,'paper.json'),JSON.stringify(metadata('bad-math')));
  run(root,'writing-begin','bad-math');
  for (const stage of ['evidence','logic-draft','logic-review','reader-draft','reader-report','revision-notes']) {
    await writeFile(join(paperDir,`${stage}.md`),`# ${stage}\n`); run(root,'writing-record','bad-math',stage);
  }
  await writeFile(join(paperDir,'article.md'),'\\[x=1\\]\n');
  const result=execute(root,'writing-record','bad-math','article');
  assert.notEqual(result.status,0);
  assert.match(result.stderr + result.stdout,/use \$\$\.\.\.\$\$ instead/);
  assert.equal(await readFile(join(paperDir,'writing.json'),'utf8').catch(()=>''),'');
});

test('rejects invalid KaTeX before completing an article',async()=> {
  const root=await mkdtemp(join(tmpdir(),'paper-otter-invalid-katex-'));
  const paperDir=join(root,'.paper-daily','papers','invalid-katex'); await mkdir(paperDir,{recursive:true});
  await writeFile(join(paperDir,'paper.json'),JSON.stringify(metadata('invalid-katex')));
  run(root,'writing-begin','invalid-katex');
  for (const stage of ['evidence','logic-draft','logic-review','reader-draft','reader-report','revision-notes']) {
    await writeFile(join(paperDir,`${stage}.md`),`# ${stage}\n`); run(root,'writing-record','invalid-katex',stage);
  }
  await writeFile(join(paperDir,'article.md'),'$$\\frac{1{$$\n');
  const result=execute(root,'writing-record','invalid-katex','article');
  assert.notEqual(result.status,0);
  assert.match(result.stderr + result.stdout,/invalid KaTeX/);
});

test('orders the latest daily primary first instead of using folder order',async()=> {
  const root=await mkdtemp(join(tmpdir(),'paper-otter-daily-order-'));
  for (const id of ['01-older','deepseek-v41']) {
    const paperDir=join(root,'.paper-daily','papers',id); await mkdir(paperDir,{recursive:true});
    await writeFile(join(paperDir,'paper.json'),JSON.stringify(metadata(id)));
    await completeWriting(root,paperDir,`# ${id}\n`);
  }
  const dailyDir=join(root,'.paper-daily','daily'); await mkdir(dailyDir,{recursive:true});
  await writeFile(join(dailyDir,'2026-09-20.json'),JSON.stringify({primary:'01-older',alternatives:[]}));
  await writeFile(join(dailyDir,'2026-09-21.json'),JSON.stringify({primary:'deepseek-v41',alternatives:['01-older']}));
  run(root,'sync');
  const catalog=JSON.parse(await readFile(join(root,'public','local','catalog.json'),'utf8'));
  assert.deepEqual(catalog.papers.map(paper=>paper.id),['deepseek-v41','01-older']);
});

test('rejects paper metadata that the browser would silently filter',async()=> {
  const root=await mkdtemp(join(tmpdir(),'paper-otter-browser-schema-'));
  const paperDir=join(root,'.paper-daily','papers','bad-year'); await mkdir(paperDir,{recursive:true});
  await writeFile(join(paperDir,'paper.json'),JSON.stringify({...metadata('bad-year'),year:2026}));
  const result=execute(root,'sync');
  assert.notEqual(result.status,0);
  assert.match(result.stderr + result.stdout,/year must be a string/);
});
