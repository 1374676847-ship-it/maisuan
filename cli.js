#!/usr/bin/env node
// cli.js — 麦算命令行入口
// 用法: node cli.js --height 170 --weight 70 [--age 30 --sex male --goal cut --activity light --budget 25] [--cheap]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { dailyTargets, matchNutrition, satietyScore, buildCombos, sodiumAdvice, classify } from './engine/engine.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; };

const profile = {
  heightCm: Number(arg('height', 170)), weightKg: Number(arg('weight', 70)),
  age: Number(arg('age', 30)), sex: arg('sex', 'male'),
  goal: arg('goal', 'cut'), activity: arg('activity', 'light'),
};
const budget = arg('budget', null);

const nutrition = JSON.parse(readFileSync(join(ROOT, 'data-samples/cache-nutrition.json'), 'utf8'));
const menu = JSON.parse(readFileSync(join(ROOT, 'data-samples/cache-menu.json'), 'utf8'));
const priceCache = JSON.parse(readFileSync(join(ROOT, 'data-samples/cache-prices.json'), 'utf8'));

const pool = [];
for (const [code, d] of Object.entries(menu.details)) {
  if (d.error || !d.name || d.rounds?.length) continue;
  const cat = classify(d.cat, d.name);
  const n = matchNutrition(d.name, nutrition);
  if (!n || cat === 'other') continue;
  pool.push({ code, name: d.name, cat,
    kcal: n.kcal, protein: n.protein, sodium: n.sodium,
    price: priceCache.prices[code]?.priceCents != null ? priceCache.prices[code].priceCents / 100 : null,
    satiety: satietyScore(n) });
}

const targets = dailyTargets(profile);
if (budget) targets.budget = Number(budget);
const { bySatiety, byPrice, total } = buildCombos(pool, targets, { maxResults: 5 });
const list = process.argv.includes('--cheap') ? byPrice : bySatiety;

console.log(`目标: 单餐 ≤${targets.kcalMeal} kcal · 蛋白 ≥${targets.proteinMeal} g/餐 · 合法组合 ${total} 个\n`);
for (const [i, c] of list.entries()) {
  const na = sodiumAdvice(c.sodiumRatio);
  console.log(`${i + 1}. ${c.parts.map(p => p.name).join(' + ')}`);
  console.log(`   ${c.kcal}kcal | 蛋白${c.protein}g | 钠${Math.round(c.sodiumRatio * 100)}%${na.text ? '（' + na.text + '）' : ''} | 饱腹${c.satiety}分 | ¥${c.price?.toFixed(1)}`);
}
console.log('\n本工具仅做通用营养算术，非医疗建议；特殊人群请咨询医生或营养师。');
