// proxy/server.mjs — 本地代理 + API 服务（只绑 127.0.0.1）
// 职责: ①托管 web/ 静态页面 ②/api/recommend 跑搭配引擎（真实 MCP 缓存数据） ③/api/health 自检
// token 只存在于本机，绝不发给浏览器
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { dailyTargets, buildCombos, sodiumAdvice } from '../engine/engine.mjs';
import { buildPool } from '../engine/pool.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const WEB = join(ROOT, 'web');
const DATA = join(ROOT, 'data-samples');
const PORT = process.env.PORT ?? 8321;

const nutrition = JSON.parse(readFileSync(join(DATA, 'cache-nutrition.json'), 'utf8'));
const menu = JSON.parse(readFileSync(join(DATA, 'cache-menu.json'), 'utf8'));
const priceCache = JSON.parse(readFileSync(join(DATA, 'cache-prices.json'), 'utf8'));
const pool = buildPool(menu, nutrition, priceCache);

function recommend(params) {
  const profile = {
    heightCm: Number(params.heightCm), weightKg: Number(params.weightKg),
    age: Number(params.age ?? 30), sex: params.sex === 'female' ? 'female' : 'male',
    activity: params.activity ?? 'light',
    goal: params.goal === 'maintain' ? 'maintain' : 'cut',
  };
  const targets = dailyTargets(profile);
  if (params.budget) targets.budget = Number(params.budget);
  const { bySatiety, byPrice, total } = buildCombos(pool, targets, { maxResults: 8 });
  const shape = c => ({
    ...c, sodiumAdvice: sodiumAdvice(c.sodiumRatio),
    parts: c.parts.map(p => ({ name: p.name, image: p.image, kcal: p.kcal, price: p.price })),
  });
  return { profile, targets, total, bySatiety: bySatiety.map(shape), byPrice: byPrice.map(shape) };
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const server = createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    if (url.pathname === '/api/health') {
      res.end(JSON.stringify({ ok: true, store: menu.store.storeName, poolSize: pool.length, nutritionItems: nutrition.length }));
    } else if (url.pathname === '/api/recommend') {
      res.end(JSON.stringify(recommend(Object.fromEntries(url.searchParams))));
    } else {
      const path = url.pathname === '/' ? '/index.html' : url.pathname;
      const file = join(WEB, path.replace(/\.\./g, ''));
      const body = readFileSync(file);
      res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
      res.end(body);
    }
  } catch (e) {
    res.statusCode = url.pathname.startsWith('/api/') ? 400 : 404;
    res.end(JSON.stringify({ error: String(e.message ?? e) }));
  }
});
server.listen(PORT, '127.0.0.1', () => console.log(`麦算 proxy @ http://127.0.0.1:${PORT}`));
