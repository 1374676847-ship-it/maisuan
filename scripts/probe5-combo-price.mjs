// 探测：官方套餐（rounds组合）能否直接按 code 算默认价
import { callToolJson } from '../engine/mcd-client.mjs';
const r = await callToolJson('calculate-price', {
  storeCode: '1400956', orderType: 1, beType: 1,
  items: [{ productCode: '9900016075', quantity: 1 }],   // 龙焰芝士棒鸡腿堡三件套
});
console.log('套餐价格:', r.data.price / 100, '元 原价:', r.data.originalPrice / 100, '元');
console.log(JSON.stringify(r.data.productList, null, 1).slice(0, 400));

// 再试随心配
const r2 = await callToolJson('query-meals', { storeCode: '1400956', orderType: 1, beType: 1 });
import { readFileSync, writeFileSync } from 'node:fs';
// 从缓存找随心配分类下的 code
const cache = JSON.parse(readFileSync(new URL('../data-samples/cache-menu.json', import.meta.url)));
const sui = Object.entries(cache.details).filter(([, d]) => d.cat?.includes('随心配'));
console.log('随心配商品:', sui.map(([c, d]) => `${d.name}(${c})`).join(' | '));
for (const [code] of sui.slice(0, 2)) {
  const rr = await callToolJson('calculate-price', { storeCode: '1400956', orderType: 1, beType: 1, items: [{ productCode: code, quantity: 1 }] });
  console.log(`  ${code} → ¥${rr.data.price / 100}`);
}
