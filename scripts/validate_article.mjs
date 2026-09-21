import { readFile } from 'node:fs/promises';
import katex from 'katex';

const path=process.argv[2];
if (!path) throw new Error('Usage: validate_article.mjs <article.md>');
const markdown=await readFile(path,'utf8');
const errors=[];

if (/\\\[|\\\]/.test(markdown)) errors.push('use $$...$$ instead of \\[...\\]');
if (/\\\(|\\\)/.test(markdown)) errors.push('use $...$ instead of \\(...\\)');

const withoutFences=markdown.replace(/```[\s\S]*?```/g,'');
const math=[];
let index=0;
while (index<withoutFences.length) {
  if (withoutFences.startsWith('$$',index)) {
    const end=withoutFences.indexOf('$$',index+2);
    if (end<0) { errors.push('unclosed $$ display-math delimiter'); break; }
    math.push({value:withoutFences.slice(index+2,end),display:true}); index=end+2; continue;
  }
  if (withoutFences[index]==='$' && withoutFences[index-1]!=="\\") {
    let end=index+1;
    while (end<withoutFences.length && !(withoutFences[end]==='$' && withoutFences[end-1]!=="\\")) end++;
    if (end>=withoutFences.length) { errors.push('unclosed $ inline-math delimiter'); break; }
    math.push({value:withoutFences.slice(index+1,end),display:false}); index=end+1; continue;
  }
  index++;
}

for (const expression of math) {
  try { katex.renderToString(expression.value,{displayMode:expression.display,throwOnError:true}); }
  catch (error) { errors.push(`invalid KaTeX: ${error.message}`); }
}

if (errors.length) {
  for (const error of errors) console.error(error);
  process.exit(1);
}
console.log(`Validated article format: ${math.length} math expressions`);
