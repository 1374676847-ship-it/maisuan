// 一次性拉全量菜单数据并缓存：门店 → 菜单 code 列表 → 140 个商品详情
// 产物: data-samples/cache-menu.json
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { callToolJson, fetchNutrition } from '../engine/mcd-client.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, 'data-samples');

// 1) 营养数据
const nutrition = await fetchNutrition();
console.log('nutrition items:', nutrition.length);
writeFileSync(join(OUT, 'cache-nutrition.json'), JSON.stringify(nutrition, null, 1));

// 2) 门店（佛山祖庙）
const stores = await callToolJson('query-nearby-stores', { searchType: 2, city: '佛山', keyword: '祖庙', beType: 1 });
const store = stores.data[0];
console.log('store:', store.storeName, store.storeCode);

// 3) 菜单 code + 分类
const meals = await callToolJson('query-meals', { storeCode: store.storeCode, orderType: 1, beType: 1 });
const cats = meals.data.categories;
const flat = cats.flatMap(c => (c.meals || []).map(p => ({ cat: c.name, code: p.code, tags: p.tags || [] })));
console.log('menu codes:', flat.length);

// 4) 逐个拉详情（带进度， rate limit 600/min 足够）
const details = {};
let done = 0;
for (const f of flat) {
  try {
    const d = await callToolJson('query-meal-detail', { storeCode: store.storeCode, orderType: 1, beType: 1, code: f.code });
    details[f.code] = { cat: f.cat, tags: f.tags, ...(d.data ?? {}) };
  } catch (e) {
    details[f.code] = { cat: f.cat, error: String(e).slice(0, 120) };
  }
  if (++done % 20 === 0) console.log(`details ${done}/${flat.length}`);
}
writeFileSync(join(OUT, 'cache-menu.json'), JSON.stringify({ store, cats: cats.map(c => c.name), details }, null, 1));
console.log('done. saved cache-menu.json, failed:', Object.values(details).filter(d => d.error).length);
