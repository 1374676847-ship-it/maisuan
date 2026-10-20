// 一次性算价：所有单品放一个购物车，从 productList 拆出单价 → cache-prices.json
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { callToolJson } from '../engine/mcd-client.mjs';
import { classify, matchNutrition } from '../engine/engine.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, 'data-samples');
const menu = JSON.parse(readFileSync(join(OUT, 'cache-menu.json'), 'utf8'));
const nutrition = JSON.parse(readFileSync(join(OUT, 'cache-nutrition.json'), 'utf8'));

const singles = [];
for (const [code, d] of Object.entries(menu.details)) {
  if (d.error || !d.name || d.rounds?.length) continue;
  if (classify(d.cat, d.name) === 'other') continue;
  if (!matchNutrition(d.name, nutrition)) continue;  // 只要引擎会用的
  singles.push({ code, name: d.name });
}
console.log('pricing singles:', singles.length);

const r = await callToolJson('calculate-price', {
  storeCode: '1400956', orderType: 1, beType: 1,
  items: singles.map(s => ({ productCode: s.code, quantity: 1 })),
});
const byCode = {};
for (const p of r.data.productList) byCode[p.productCode] = { name: p.productName, priceCents: p.subtotal };
writeFileSync(join(OUT, 'cache-prices.json'), JSON.stringify({
  storeCode: '1400956', fetchedAt: r.datetime, currency: 'CNY-fen', prices: byCode,
}, null, 1));
console.log('priced:', Object.keys(byCode).length, 'total cart:', r.data.price / 100, '元');
console.log('samples:', Object.entries(byCode).slice(0, 5).map(([c, p]) => `${p.name}=${p.priceCents / 100}元`).join(' | '));
