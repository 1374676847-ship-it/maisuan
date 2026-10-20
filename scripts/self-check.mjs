// self-check.mjs — 搭配引擎自检：真实缓存数据 + 断言验证
// 用法: node scripts/self-check.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { calcTdee, dailyTargets, matchNutrition, satietyScore, buildCombos, sodiumAdvice, classify } from '../engine/engine.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const nutrition = JSON.parse(readFileSync(join(ROOT, 'data-samples/cache-nutrition.json'), 'utf8'));
const menu = JSON.parse(readFileSync(join(ROOT, 'data-samples/cache-menu.json'), 'utf8'));
const priceCache = JSON.parse(readFileSync(join(ROOT, 'data-samples/cache-prices.json'), 'utf8'));

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; } else { fail++; console.log('  ✗ FAIL:', label); } };

// ---------- 1. TDEE 公式验证（教科书标准值）----------
// 男 25岁 170cm 70kg 轻度活动: BMR = 700+1062.5-125+5 = 1642.5, ×1.375 = 2258.4
const tdee = calcTdee({ heightCm: 170, weightKg: 70, age: 25, sex: 'male', activity: 'light' });
ok(Math.abs(tdee - 2258) <= 2, `TDEE 标准值偏差过大: ${tdee} ≠ 2258`);
// 女 30岁 160cm 55kg 久坐: BMR = 550+1000-150-161=1239, ×1.2 = 1486.8
const tdeeF = calcTdee({ heightCm: 160, weightKg: 55, age: 30, sex: 'female', activity: 'sedentary' });
ok(Math.abs(tdeeF - 1487) <= 3, `TDEE(女) 偏差: ${tdeeF} ≠ 1487`);
console.log(`[1] TDEE 公式: ${tdee} kcal(男70kg) / ${tdeeF} kcal(女55kg)`);

// ---------- 2. 商品标准化 ----------
// 单品（无套餐轮次）从详情提取；套餐提取默认选中组合
const items = [];
let matched = 0, unmatched = [];
for (const [code, d] of Object.entries(menu.details)) {
  if (d.error || !d.name) continue;
  const parts = [];
  if (d.rounds?.length) {
    for (const r of d.rounds) {
      const def = (r.choices || []).find(c => c.isDefault === 1) ?? r.choices?.[0];
      if (def) parts.push(def.name);
    }
  } else {
    parts.push(d.name);
  }
  const cat = classify(d.cat, d.name);
  // 每个 part 匹配营养；套餐的营养 = 各默认子项之和
  let kcal = 0, protein = 0, sodium = 0, hasNutri = false;
  for (const pn of parts) {
    const n = matchNutrition(pn, nutrition);
    if (n) { kcal += n.kcal; protein += n.protein; sodium += n.sodium; hasNutri = true; matched++; }
    else unmatched.push(pn);
  }
  const image = d.image ?? null;
  if (d.rounds?.length) {
    items.push({ code, name: d.name, cat, combo: true, parts, image,
      kcal: hasNutri ? kcal : null, protein, sodium });
  } else {
    items.push({ code, name: d.name, cat, combo: false, image,
      kcal: hasNutri ? kcal : null, protein, sodium });
  }
}
console.log(`[2] 菜单单品营养匹配: ${matched} 命中, ${unmatched.length} 未命中`);
console.log('    未命中样本:', [...new Set(unmatched)].slice(0, 12).join(' | '));
ok(matched > 120, `营养匹配率过低: ${matched}`);

// ---------- 3. 单品池 + 饱腹分 ----------
const singles = items.filter(i => !i.combo && i.kcal != null)
  .map(i => ({ ...i, price: priceCache.prices[i.code]?.priceCents != null ? priceCache.prices[i.code].priceCents / 100 : null, satiety: satietyScore({ kcal: i.kcal, protein: i.protein, sodium: i.sodium }) }));
const mains = singles.filter(i => i.cat === 'main');
const sides = singles.filter(i => i.cat === 'side');
const drinks = singles.filter(i => i.cat === 'drink');
console.log(`[3] 单品池: 主食类 ${mains.length} · 配餐类 ${sides.length} · 饮品类 ${drinks.length}`);
ok(mains.length >= 10, '主食类单品太少');
ok(sides.length >= 5, '配餐类单品太少');
ok(drinks.length >= 5, '饮品类单品太少');

// ---------- 4. 引擎全链路：70kg 男 减脂 ----------
const profile = { heightCm: 170, weightKg: 70, age: 30, sex: 'male', activity: 'light', goal: 'cut' };
const targets = dailyTargets(profile);
console.log(`[4] 目标: TDEE ${targets.tdee} · 日摄入 ${targets.kcalDay} · 单餐 ≤${targets.kcalMeal} kcal · 单餐蛋白 ≥${targets.proteinMeal} g`);

const pool = [...mains, ...sides, ...drinks];
const { bySatiety, byPrice, total } = buildCombos(pool, targets);
console.log(`    合法组合数: ${total}（枚举后约束过滤）`);
ok(total > 30, `合法组合太少: ${total}`);
ok(bySatiety.every(c => c.kcal <= targets.kcalMeal), '饱腹榜存在超热量组合');
ok(byPrice.length > 0, '便宜榜为空');
ok(bySatiety.every(c => c.protein >= targets.proteinMeal * 0.6), '存在蛋白不达标的组合');

const fmt = c => `  ${c.parts.map(p => p.name).join(' + ')} | ${c.kcal}kcal 蛋白${c.protein}g 钠${Math.round(c.sodiumRatio * 100)}% 饱腹${c.satiety}分 ¥${c.price?.toFixed(1)}`;
console.log('\n  --- 饱腹优先 Top5 ---');
bySatiety.slice(0, 5).forEach(c => console.log(fmt(c)));
console.log('\n  --- 便宜优先 Top5 ---');
byPrice.slice(0, 5).forEach(c => console.log(fmt(c)));
ok(byPrice.every(c => c.price != null), '便宜榜存在无价格组合');
ok(JSON.stringify(byPrice.map(c => c.parts.map(p => p.name).join('+')))
  !== JSON.stringify(bySatiety.map(c => c.parts.map(p => p.name).join('+'))),
  '便宜榜与饱腹榜应不同（价格管道未生效）');

// ---------- 5. 钠提示 ----------
const mid = sodiumAdvice(0.62), high = sodiumAdvice(0.78), lowN = sodiumAdvice(0.5);
ok(mid.level === 'mid' && mid.text, '钠 62% 提示缺失');
ok(high.level === 'high', '钠 78% 应判 high');
ok(lowN.level === 'ok' && lowN.text === null, '钠 50% 不应提示');
console.log(`\n[5] 钠提示: 62%→"${mid.text}" / 78%→"${high.text}"`);

console.log(`\n========== 自检结果: ${pass} 通过, ${fail} 失败 ==========`);
process.exit(fail ? 1 : 0);
