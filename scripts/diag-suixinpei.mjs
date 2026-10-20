import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { matchNutrition } from '../engine/engine.mjs';
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const menu = JSON.parse(readFileSync(join(ROOT, 'data-samples/cache-menu.json'), 'utf8'));
const nutrition = JSON.parse(readFileSync(join(ROOT, 'data-samples/cache-nutrition.json'), 'utf8'));
for (const code of ['9900013304', '9900015568']) {
  const d = menu.details[code];
  console.log(`\n=== ${d.name} (${code}) ¥? ===`);
  for (const r of d.rounds) {
    console.log(`轮次「${r.name}」默认: `, (r.choices || []).filter(c => c.isDefault === 1).map(c => c.name).join(' / '));
    console.log('  全部选项:', (r.choices || []).map(c => c.name).slice(0, 10).join(' | '));
  }
  const defaults = d.rounds.map(r => (r.choices || []).find(c => c.isDefault === 1)?.name ?? r.choices?.[0]?.name);
  let kcal = 0, protein = 0;
  for (const pn of defaults) {
    const n = matchNutrition(pn, nutrition);
    console.log(`  ${pn} → ${n ? n.kcal + 'kcal 蛋白' + n.protein : '无营养数据'}`);
    if (n) { kcal += n.kcal; protein += n.protein; }
  }
  console.log(`  合计: ${kcal}kcal 蛋白${protein}g`);
}
