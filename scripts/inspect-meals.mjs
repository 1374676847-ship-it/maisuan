// 分析菜单样本结构：分类、商品字段、价格字段
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const t = readFileSync(join(ROOT, 'data-samples/11-meals-store.txt'), 'utf8');

const marker = '## Original Response';
const idx = t.lastIndexOf(marker);
const jsonText = t.slice(idx + marker.length).trim();
const o = JSON.parse(jsonText);
const d = o.data?.data ?? o.data;
const cats = d.categories ?? [];
console.log('categories:', cats.map(c => `${c.name}(${(c.products || c.items || c.meals || []).length})`).join(' | '));

const prods = cats.flatMap(c => c.products || c.items || c.meals || []);
console.log('total products:', prods.length);
if (prods.length) {
  console.log('product keys:', Object.keys(prods[0]).join(', '));
  console.log('\nsample:', JSON.stringify(prods[0], null, 2).slice(0, 900));
  const withPrice = prods.filter(p => p.price != null);
  console.log('\nwith price:', withPrice.length, 'sample price obj:', JSON.stringify(withPrice[0]?.price ?? withPrice[0]?.prices ?? null).slice(0, 200));
}
