// 探测 round2：修正参数（searchType=2 需 city+keyword）拉门店和菜单
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, 'data-samples');
const cfg = JSON.parse(readFileSync('C:/Users/Administrator/.workbuddy/mcp.json', 'utf8'));
const MCD = cfg.mcpServers['mcd-mcp'];
const TOKEN = MCD.headers.Authorization;

let seq = 100;
async function mcdCall(method, params = {}) {
  const res = await fetch(MCD.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream', 'Authorization': TOKEN },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++seq, method, params }),
  });
  const text = await res.text();
  let payload = text;
  if (text.includes('data:')) {
    payload = text.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('');
  }
  try { return JSON.parse(payload); } catch { return { _raw: text }; }
}

const callTool = async (name, args) => {
  const r = await mcdCall('tools/call', { name, arguments: args });
  return r?.result?.content?.[0]?.text ?? JSON.stringify(r);
};

// 1) 门店：佛山 + 祖庙关键词
const storeText = await callTool('query-nearby-stores', { searchType: 2, city: '佛山', keyword: '祖庙', beType: 1 });
writeFileSync(join(OUT, '10-stores-foshan.txt'), storeText);
console.log('stores:', storeText.slice(0, 500));

// 2) 解析门店 code
let storeCode = null;
const codeMatch = storeText.match(/storeCode[^\n]*/i);
console.log('storeCode line:', codeMatch?.[0]?.slice(0, 120));
const jsonMatch = storeText.match(/\{[\s\S]*\}/);
if (jsonMatch) {
  try {
    const obj = JSON.parse(jsonMatch[0]);
    const arr = obj.data ?? obj;
    if (Array.isArray(arr) && arr.length) storeCode = arr[0].storeCode;
  } catch (e) { console.log('parse fail', e.message); }
}
console.log('storeCode =', storeCode);

// 3) 菜单
if (storeCode) {
  const meals = await callTool('query-meals', { storeCode, orderType: 1, beType: 1 });
  writeFileSync(join(OUT, '11-meals-store.txt'), meals);
  console.log('meals head:', meals.slice(0, 400));
  const imgKeys = meals.match(/"([a-zA-Z]*(?:image|img|pic|photo|icon|url)[a-zA-Z]*)"\s*:/gi);
  console.log('image-like keys:', imgKeys ? [...new Set(imgKeys)] : 'NONE');
}
