import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const script = new URL('../scripts/paperctl.py', import.meta.url).pathname;
function run(root,...args) {
  const result=spawnSync('python3',[script,...args],{env:{...process.env,PAPER_DAILY_ROOT:root},encoding:'utf8'});
  assert.equal(result.status,0,result.stderr || result.stdout);
}

test('initializes a private profile and builds a local catalog',async()=> {
  const root=await mkdtemp(join(tmpdir(),'paper-daily-'));
  const profile={version:1,reader:{language:'zh-CN',background:[],tools:[]},goals:[],topics:{strong:[],learning:[],avoid:[]},reading:{dailyMinutes:30,daysPerWeek:5},recommendation:{primaryCount:1,alternativeCount:2,explorationRate:0.2,recency:'balanced'}};
  const profilePath=join(root,'profile.json'); await writeFile(profilePath,JSON.stringify(profile));
  run(root,'init',profilePath);
  const paperDir=join(root,'.paper-daily','papers','test.0001'); await mkdir(paperDir,{recursive:true});
  await writeFile(join(paperDir,'paper.json'),JSON.stringify({id:'test.0001',title:'测试论文',englishTitle:'Test Paper',year:'2026',tags:['systems'],minutes:30,reason:'连接当前目标',source:'https://example.test/paper'}));
  await writeFile(join(paperDir,'article.md'),'## 核心问题\n\n正文。\n');
  run(root,'sync');
  const catalog=JSON.parse(await readFile(join(root,'public','local','catalog.json'),'utf8'));
  assert.equal(catalog.papers.length,1); assert.equal(catalog.papers[0].markdown,'## 核心问题\n\n正文。\n');
});
