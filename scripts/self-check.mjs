// self-check.mjs — 搭配引擎自检：真实缓存数据 + 断言验证
// 用法: node scripts/self-check.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { calcTdee, dailyTargets, buildCombos, sodiumAdvice } from '../engine/engine.mjs';
import { buildPool } from '../engine/pool.mjs';

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

// ---------- 2. 单品池（单点 + 官方套餐）----------
const pool = buildPool(menu, nutrition, priceCache);
const mains = pool.filter(i => i.cat === 'main');
const sides = pool.filter(i => i.cat === 'side');
const drinks = pool.filter(i => i.cat === 'drink');
const combos = pool.filter(i => i.cat === 'combo');
console.log(`[2] 单品池: 主食 ${mains.length} · 配餐 ${sides.length} · 饮品 ${drinks.length} · 官方套餐 ${combos.length}`);
ok(mains.length >= 10, '主食类单品太少');
ok(sides.length >= 5, '配餐类单品太少');
ok(drinks.length >= 5, '饮品类单品太少');
ok(combos.length >= 10, '官方套餐入库太少');
ok(pool.every(i => i.price != null), '单品池存在无价格商品');
const sui = combos.find(c => c.name.includes('随心配'));
ok(!!sui, '随心配未入库');
if (sui) console.log(`    随心配样本: ${sui.name} ¥${sui.price} ${sui.kcal}kcal 蛋白${sui.protein}g`);

// ---------- 3. 引擎全链路：70kg 男 减脂 ----------
const profile = { heightCm: 170, weightKg: 70, age: 30, sex: 'male', activity: 'light', goal: 'cut' };
const targets = dailyTargets(profile);
console.log(`[3] 目标: TDEE ${targets.tdee} · 日摄入 ${targets.kcalDay} · 单餐 ≤${targets.kcalMeal} kcal · 单餐蛋白 ≥${targets.proteinMeal} g`);

const { bySatiety, byPrice, total } = buildCombos(pool, targets);
console.log(`    合法组合数: ${total}（单点组合 + 官方套餐）`);
ok(total > 100, `合法组合太少: ${total}`);
ok(bySatiety.every(c => c.kcal <= targets.kcalMeal), '饱腹榜存在超热量组合');
ok(byPrice.length > 0, '便宜榜为空');
ok(bySatiety.every(c => c.protein >= targets.proteinMeal * 0.6 - 1), '存在蛋白严重不达标组合');

const fmt = c => `  ${c.parts.map(p => p.name).join(' + ')} | ${c.kcal}kcal 蛋白${c.protein}g 钠${Math.round(c.sodiumRatio * 100)}% 饱腹${c.satiety}分 ¥${c.price?.toFixed(1)}`;
console.log('\n  --- 饱腹优先 Top5 ---');
bySatiety.slice(0, 5).forEach(c => console.log(fmt(c)));
console.log('\n  --- 便宜优先 Top5 ---');
byPrice.slice(0, 5).forEach(c => console.log(fmt(c)));
const full = c => c.parts.length >= 2 || c.parts[0].cat === 'combo';
ok(byPrice.slice(0, 3).every(full), '便宜榜 Top3 应都含饮品或是官方套餐（单汉堡不像一餐）');

// ---------- 4. 官方套餐进入便宜榜 ----------
const cheapHasCombo = byPrice.slice(0, 5).some(c => c.parts[0].cat === 'combo');
ok(cheapHasCombo, '便宜榜 Top5 应包含官方套餐（随心配/三件套是真实便宜货）');

// ---------- 5. 预算硬约束 ----------
const t25 = { ...targets, budget: 25 };
const r25 = buildCombos(pool, t25);
console.log(`\n[4] 预算 25 元: 合法 ${r25.total} 个, 最便宜 ${r25.byPrice[0]?.price} 元 (${r25.byPrice[0]?.parts.map(p => p.name).join(' + ')})`);
ok(r25.byPrice.every(c => c.price <= 25), '预算 25 却推荐超价套餐（预算约束失效）');
ok(r25.byPrice.length > 0, '预算 25 无合法组合');
ok(r25.byPrice[0] && (r25.byPrice[0].parts[0].cat === 'combo' || full(r25.byPrice[0])),
  '预算 25 榜首应是官方套餐或含饮品的组合（便宜榜首不该是干 burger）');

// ---------- 6. 钠提示 ----------
const mid = sodiumAdvice(0.62), high = sodiumAdvice(0.78), lowN = sodiumAdvice(0.5);
ok(mid.level === 'mid' && mid.text, '钠 62% 提示缺失');
ok(high.level === 'high', '钠 78% 应判 high');
ok(lowN.level === 'ok' && lowN.text === null, '钠 50% 不应提示');
console.log(`\n[5] 钠提示: 62%→"${mid.text}" / 78%→"${high.text}"`);

console.log(`\n========== 自检结果: ${pass} 通过, ${fail} 失败 ==========`);
process.exit(fail ? 1 : 0);
