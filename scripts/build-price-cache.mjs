// 全量算价 v2：单品 + 官方套餐，20 个一车分批发（避免单个失败拖垮全部）
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { callToolJson } from '../engine/mcd-client.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, 'data-samples');
const menu = JSON.parse(readFileSync(join(OUT, 'cache-menu.json'), 'utf8'));
const codes = Object.keys(menu.details).filter(c => !menu.details[c].error && menu.details[c].name);
console.log('pricing all:', codes.length, 'items');

const prices = {};
const CHUNK = 20;
for (let i = 0; i < codes.length; i += CHUNK) {
  const batch = codes.slice(i, i + CHUNK);
  try {
    const r = await callToolJson('calculate-price', {
      storeCode: '1400956', orderType: 1, beType: 1,
      items: batch.map(c => ({ productCode: c, quantity: 1 })),
    });
    for (const p of r.data.productList) prices[p.productCode] = { name: p.productName, priceCents: p.subtotal };
    console.log(`  batch ${i / CHUNK + 1}: ${batch.length} priced, cart ¥${r.data.price / 100}`);
  } catch (e) {
    console.log(`  batch ${i / CHUNK + 1} FAILED:`, String(e).slice(0, 120));
    for (const c of batch) {
      try {
        const r = await callToolJson('calculate-price', { storeCode: '1400956', orderType: 1, beType: 1, items: [{ productCode: c, quantity: 1 }] });
        prices[c] = { name: r.data.productList[0].productName, priceCents: r.data.price };
      } catch (e2) { console.log('    item failed:', c, String(e2).slice(0, 80)); }
    }
  }
}
writeFileSync(join(OUT, 'cache-prices.json'), JSON.stringify({
  storeCode: '1400956', currency: 'CNY-fen', prices,
}, null, 1));
console.log('done. priced:', Object.keys(prices).length, '/', codes.length);
