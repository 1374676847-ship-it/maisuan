// 探测 query-meal-detail：看商品名/价格/图片/营养字段
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, 'data-samples');
const cfg = JSON.parse(readFileSync('C:/Users/Administrator/.workbuddy/mcp.json', 'utf8'));
const MCD = cfg.mcpServers['mcd-mcp'];
let seq = 200;
async function callTool(name, args) {
  const res = await fetch(MCD.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream', 'Authorization': MCD.headers.Authorization },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++seq, method: 'tools/call', params: { name, arguments: args } }),
  });
  const text = await res.text();
  let payload = text;
  if (text.includes('data:')) payload = text.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('');
  const r = JSON.parse(payload);
  return r?.result?.content?.[0]?.text ?? text;
}

const t = readFileSync(join(OUT, '11-meals-store.txt'), 'utf8');
const marker = '## Original Response';
const o = JSON.parse(t.slice(t.lastIndexOf(marker) + marker.length).trim());
const cats = (o.data?.data ?? o.data).categories;
const flat = cats.flatMap(c => (c.meals || c.products || []).map(p => ({ cat: c.name, code: p.code })));
console.log('total codes:', flat.length);

// 取三类样本：500大卡套餐分类、鸡肉汉堡、饮品
const picks = [];
const cat500 = cats.find(c => c.name.includes('500'));
picks.push(...(cat500?.meals || cat500?.products || []).slice(0, 2).map(p => p.code));
picks.push(flat.find(f => f.cat.includes('鸡肉'))?.code);
picks.push(flat.find(f => f.cat === '饮品')?.code);
picks.push(flat[0].code);

for (const code of picks.filter(Boolean)) {
  const txt = await callTool('query-meal-detail', { storeCode: '1400956', orderType: 1, beType: 1, code });
  writeFileSync(join(OUT, `20-detail-${code}.txt`), txt);
  const j = txt.slice(txt.lastIndexOf(marker) + marker.length).trim();
  try {
    const d = JSON.parse(j);
    const dd = d.data?.data ?? d.data;
    console.log(`\n=== ${code} ===`);
    console.log('detail keys:', Object.keys(dd ?? {}).join(','));
    console.log(JSON.stringify(dd, null, 1).slice(0, 700));
  } catch { console.log(`\n=== ${code} === parse fail, head:`, txt.slice(0, 200)); }
}
