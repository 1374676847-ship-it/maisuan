import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { matchNutrition, classify } from '../engine/engine.mjs';
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const nutrition = JSON.parse(readFileSync(join(ROOT, 'data-samples/cache-nutrition.json'), 'utf8'));
const menu = JSON.parse(readFileSync(join(ROOT, 'data-samples/cache-menu.json'), 'utf8'));
const items = [];
for (const [code, d] of Object.entries(menu.details)) {
  if (d.error || !d.name) { console.log('skip:', code, d.error ?? 'no name'); continue; }
  const parts = [];
  if (d.rounds?.length) {
    for (const r of d.rounds) {
      const def = (r.choices || []).find(c => c.isDefault === 1) ?? r.choices?.[0];
      if (def) parts.push(def.name);
    }
  } else parts.push(d.name);
  let kcal = 0, protein = 0, sodium = 0, hasNutri = false;
  for (const pn of parts) {
    const n = matchNutrition(pn, nutrition);
    if (n) { kcal += n.kcal; protein += n.protein; sodium += n.sodium; hasNutri = true; }
  }
  items.push({ code, name: d.name, cat: classify(d.cat, d.name), combo: !!d.rounds?.length, kcal: hasNutri ? kcal : null });
}
const mains = items.filter(i => !i.combo && i.kcal != null && i.cat === 'main');
console.log('engine mains:', mains.length);
for (const m of mains) console.log('  ', m.name, m.kcal);
