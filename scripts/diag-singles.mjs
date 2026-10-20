import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { matchNutrition, classify } from '../engine/engine.mjs';
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const nutrition = JSON.parse(readFileSync(join(ROOT, 'data-samples/cache-nutrition.json'), 'utf8'));
const menu = JSON.parse(readFileSync(join(ROOT, 'data-samples/cache-menu.json'), 'utf8'));
for (const [code, d] of Object.entries(menu.details)) {
  if (d.error || !d.name || d.rounds?.length) continue;
  const cls = classify(d.cat);
  const n = matchNutrition(d.name, nutrition);
  console.log(`${cls.padEnd(6)} | ${d.cat.replace(/\n/g, '/').padEnd(12)} | ${d.name} | ${n ? n.kcal + 'kcal' : '无营养数据'}`);
}
