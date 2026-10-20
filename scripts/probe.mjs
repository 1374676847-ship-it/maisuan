// 探测 mcp.mcd.cn 真实数据结构（开发用，token 从本机 mcp.json 读取，不入库）
// 用法: node scripts/probe.mjs
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, 'data-samples');
mkdirSync(OUT, { recursive: true });

const cfg = JSON.parse(readFileSync('C:/Users/Administrator/.workbuddy/mcp.json', 'utf8'));
const MCD = cfg.mcpServers['mcd-mcp'];
const TOKEN = MCD.headers.Authorization;

let seq = 0;
async function mcdCall(method, params = {}) {
  const id = ++seq;
  const res = await fetch(MCD.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': TOKEN,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  const text = await res.text();
  // 兼容 SSE 包装：取 data: 行
  let payload = text;
  if (text.includes('data:')) {
    const lines = text.split('\n').filter(l => l.startsWith('data:'));
    payload = lines.map(l => l.slice(5).trim()).join('');
  }
  try {
    return { status: res.status, json: JSON.parse(payload), raw: text };
  } catch {
    return { status: res.status, json: null, raw: text };
  }
}

function save(name, obj) {
  writeFileSync(join(OUT, name), typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2));
  console.log('saved', name);
}

// 1) initialize
const init = await mcdCall('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'maisuan-probe', version: '0.1.0' } });
console.log('initialize:', init.status, init.json?.result?.serverInfo);
save('01-initialize.json', init.json ?? init.raw);

// 2) tools/list 全量 schema
const tools = await mcdCall('tools/list');
save('02-tools-list.json', tools.json ?? tools.raw);
const list = tools.json?.result?.tools ?? [];
console.log('tools count:', list.length);
console.log('tool names:', list.map(t => t.name).join(', '));

// 3) list-nutrition-foods（TOON 原始样本）
const nutri = await mcdCall('tools/call', { name: 'list-nutrition-foods', arguments: {} });
save('03-list-nutrition-foods.txt', nutri.json?.result?.content?.[0]?.text ?? nutri.raw);
console.log('nutrition sample chars:', (nutri.json?.result?.content?.[0]?.text ?? '').length);

// 4) query-nearby-stores（佛山祖庙附近 lat 23.03, lng 113.12）
const stores = await mcdCall('tools/call', { name: 'query-nearby-stores', arguments: { searchType: 3, beType: 1, lat: 23.03, lng: 113.12 } });
save('04-query-nearby-stores.json', stores.json ?? stores.raw);
const storeText = stores.json?.result?.content?.[0]?.text ?? '';
console.log('stores sample:', storeText.slice(0, 300));

// 5) query-meals（取第一个门店，验证商品图字段）
let storeCode = null;
try {
  const parsed = JSON.parse(storeText);
  const arr = parsed.stores ?? parsed.data ?? parsed;
  if (Array.isArray(arr) && arr.length) storeCode = arr[0].storeCode ?? arr[0].code ?? arr[0].storeId ?? null;
} catch {}
console.log('storeCode guess:', storeCode);
if (storeCode) {
  const meals = await mcdCall('tools/call', { name: 'query-meals', arguments: { storeCode } });
  save('05-query-meals.json', meals.json ?? meals.raw);
  const mealText = meals.json?.result?.content?.[0]?.text ?? '';
  console.log('meals sample:', mealText.slice(0, 300));
  // 商品图字段探测
  const imgKeys = mealText.match(/"(image\w*|img\w*|pic\w*|photo\w*)"\s*:/gi);
  console.log('image-like keys in meals:', imgKeys ? [...new Set(imgKeys)] : 'NONE');
}
