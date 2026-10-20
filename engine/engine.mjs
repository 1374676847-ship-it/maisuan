// engine.mjs — 麦算搭配引擎（纯函数，无副作用，可单测）
// 输入: 用户参数 + 商品列表(含营养) → 输出: 约束满足的套餐组合，按饱腹/便宜排序

// ---------- 人体目标计算 ----------
// Mifflin-St Jeor 公式（通用运动营养公开公式，非医疗建议）
export function calcTdee({ heightCm, weightKg, age, sex, activity = 'light' }) {
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
  const factor = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 }[activity] ?? 1.375;
  return Math.round(bmr * factor);
}

// 减脂: 每日赤字 20%（封顶 500 kcal）；维持: 0
export function dailyTargets(profile) {
  const tdee = calcTdee(profile);
  const deficit = profile.goal === 'cut' ? Math.min(500, Math.round(tdee * 0.2)) : 0;
  const kcalDay = tdee - deficit;
  return {
    tdee,
    kcalDay,
    kcalMeal: Math.round(kcalDay * 0.35),          // 单餐按 35%
    proteinDay: Math.round(profile.weightKg * 1.6), // 减脂保肌底线 1.6 g/kg
    proteinMeal: Math.round(profile.weightKg * 1.6 * 0.35),
    sodiumDay: 2000,                                 // 每日钠参考（一餐占比 = 钠/2000）
  };
}

// ---------- 商品标准化 ----------
// 营养来自 list-nutrition-foods（按品名匹配）；没有营养的单品也能参与但标 nutrition:null
export function matchNutrition(name, nutritionDb) {
  if (!nutritionDb) return null;
  const stripSize = s => s.replace(/[(（]?(小|中|大)杯?[)）]?/g, '');
  const norm = s => s
    .replace(/[（(【\[][^）)】\]]*[）)】\]]/g, '')   // 去括号内容
    .replace(/[“”"'\s™®]/g, '')                       // 去引号/空格/商标
    .replace(/[-—]?\d+块?$/, '')                     // 去数量词: 麦辣鸡翅-2块 → 麦辣鸡翅
    .replace(/^麦咖啡/, '');                          // 咖啡前缀差异
  const n = norm(name);
  const exact = nutritionDb.find(x => norm(x.name) === n);
  if (exact) return exact;
  // 去杯型后精确匹配（如 雪碧（小杯）→ 雪碧）；多个命中优先中杯
  const ns = stripSize(n);
  if (ns.length >= 2) {
    const pool = nutritionDb.filter(x => stripSize(norm(x.name)) === ns);
    if (pool.length) {
      return pool.find(x => /中/.test(x.name)) ?? pool[0];
    }
  }
  return nutritionDb.find(x => n.length >= 3 && (n.startsWith(norm(x.name)) || norm(x.name).startsWith(n)))
      ?? null;
}

// 饱腹分启发式（0-100）：蛋白主导，低能量密度加分，高钠扣分
// 数据无纤维/重量字段，这是文档化的近似，不是精确科学
export function satietyScore(nutri) {
  if (!nutri) return 30;
  let s = nutri.protein * 1.8;                 // 蛋白最有饱腹感
  s += Math.max(0, (320 - nutri.kcal) / 25);   // 低卡密度加分（蔬菜/玉米杯类）
  s -= Math.max(0, (nutri.sodium - 500) / 60); // 高钠通常意味着高加工
  return Math.max(5, Math.min(100, Math.round(s)));
}

// ---------- 组合枚举 ----------
// 商品分类（按 category + 品名粗分；周边商品归 other 剔除）
export function classify(cat, name = '') {
  const text = `${cat} ${name}`;
  // 周边/非食品优先剔除
  if (/徽章|玩具|按摩捶|水手帽|杯子|贴纸/.test(name)) return 'other';
  // 官方套餐按分类识别（随心配/单人餐/多人餐/拼盘/乐园餐/大卡套餐）
  if (/套餐|随心配|单人餐|多人餐|拼盘|乐园/.test(cat)) return 'combo';
  if (/堡|汉堡|麦满分|多笋卷/.test(name) || /汉堡|早餐|猪柳|牛/.test(cat)) return 'main';
  if (/薯条|玉米杯|苹果片|派|新地|麦旋风|冰淇淋|圆筒|芝士条|V翅|鸡翅|鸡排|鸡块|鸡球|麦乐鸡/.test(name) ||
      /小食|甜品|其他|炸鸡/.test(cat)) return 'side';
  if (/饮品|咖啡|可乐|雪碧|茶|牛奶|果汁|奶|水|红茶|黑巧/.test(text)) return 'drink';
  return 'other';
}

// 生成候选组合: 单品(主食+配餐?+饮品?) 与 套餐默认组合
// items: [{ name, cat, kcal, protein, sodium, price, satiety, image, code }]
export function buildCombos(items, targets, { maxResults = 10 } = {}) {
  const mains = items.filter(i => i.cat === 'main' && i.kcal != null);
  const sides = items.filter(i => i.cat === 'side' && i.kcal != null);
  const drinks = items.filter(i => i.cat === 'drink' && i.kcal != null);
  const combos = items.filter(i => i.cat === 'combo' && i.kcal != null); // 官方套餐

  const candidates = [];
  const push = (parts) => {
    const kcal = parts.reduce((s, p) => s + p.kcal, 0);
    if (kcal > targets.kcalMeal) return;
    const protein = parts.reduce((s, p) => s + p.protein, 0);
    if (protein < targets.proteinMeal * 0.6) return; // 低于底线60%直接剔除
    const sodium = parts.reduce((s, p) => s + p.sodium, 0);
    const price = parts.reduce((s, p) => s + (p.price ?? 0), 0);
    if (targets.budget && price > targets.budget) return;
    const satiety = Math.min(100, Math.round(
      parts.reduce((s, p) => s + p.satiety, 0) / Math.sqrt(parts.length)));
    candidates.push({ parts, kcal, protein, sodium, price, satiety,
      kcalRatio: kcal / targets.kcalMeal,
      sodiumRatio: sodium / (targets.sodiumDay ?? 2000) });
  };

  for (const m of mains) {
    push([m]);
    for (const s of sides) { push([m, s]); for (const d of drinks) push([m, s, d]); }
    for (const d of drinks) push([m, d]);
  }
  for (const cb of combos) push([cb]); // 官方套餐原样参与比价

  // 去重（同样单品集合只留一次）
  const seen = new Set();
  const uniq = candidates.filter(c => {
    const key = c.parts.map(p => p.name).sort().join('|');
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  // 折叠「同主食同配餐只差零卡饮品」的近似重复，保留饱腹分最高者
  const bestByCore = new Map();
  for (const c of uniq) {
    const core = c.parts.filter(p => p.kcal > 20).map(p => p.name).sort().join('|');
    const prev = bestByCore.get(core);
    if (!prev || c.satiety > prev.satiety) bestByCore.set(core, c);
  }
  const folded = [...bestByCore.values()];

  // 业务规则：光秃秃一个汉堡不像一餐，用户容易放弃购买。
  // 「仅主食」的组合自动搭配全池最便宜且 ≤30 kcal 的饮料；但若因此超出预算则不硬塞（诚实优先于好看）
  const cheapestLowCalDrink = drinks.filter(d => d.kcal <= 30 && d.price != null)
    .sort((a, b) => a.price - b.price)[0];
  const withDrink = folded.map(c => {
    if (c.parts.length !== 1 || c.parts[0].cat !== 'main' || !cheapestLowCalDrink) return c;
    const d = cheapestLowCalDrink;
    const newPrice = c.price + d.price;
    if (targets.budget && newPrice > targets.budget) return c;
    const parts = [...c.parts, d];
    const kcal = c.kcal + d.kcal, protein = c.protein + d.protein, sodium = c.sodium + d.sodium;
    const satiety = Math.min(100, Math.round(parts.reduce((s, p) => s + p.satiety, 0) / Math.sqrt(parts.length)));
    return { parts, kcal, protein, sodium, price: newPrice, satiety,
      kcalRatio: kcal / targets.kcalMeal,
      sodiumRatio: sodium / (targets.sodiumDay ?? 2000) };
  });
  const bySatiety = [...withDrink].sort((a, b) => b.satiety - a.satiety || a.price - b.price).slice(0, maxResults);
  const byPrice = [...withDrink].sort((a, b) => a.price - b.price || b.satiety - a.satiety).slice(0, maxResults);
  return { bySatiety, byPrice, total: uniq.length };
}

// 钠提示文案
export function sodiumAdvice(ratio) {
  if (ratio >= 0.78) return { level: 'high', text: '这顿很咸，今天其他餐清淡点' };
  if (ratio > 0.6) return { level: 'mid', text: '有点咸，晚上建议清淡' };
  return { level: 'ok', text: null };
}
