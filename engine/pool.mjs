// buildPool — 从 MCP 缓存构建引擎单品池（单点 + 官方套餐），proxy/cli/self-check 三处共用
import { matchNutrition, satietyScore, classify } from './engine.mjs';

export function buildPool(menu, nutrition, priceCache) {
  const items = [];
  for (const [code, d] of Object.entries(menu.details)) {
    if (d.error || !d.name) continue;
    if (classify(d.cat, d.name) === 'other') continue;           // 周边商品剔除
    const price = priceCache.prices[code]?.priceCents != null
      ? priceCache.prices[code].priceCents / 100 : null;
    const image = d.image ?? null;

    if (d.rounds?.length) {
      // 官方套餐：取每轮默认选中项，营养 = 各默认子项之和
      const partNames = [];
      for (const r of d.rounds) {
        const def = (r.choices || []).find(c => c.isDefault === 1) ?? r.choices?.[0];
        if (def) partNames.push(def.name);
      }
      let kcal = 0, protein = 0, sodium = 0, mainMatched = false;
      partNames.forEach((pn, i) => {
        const n = matchNutrition(pn, nutrition);
        if (n) { kcal += n.kcal; protein += n.protein; sodium += n.sodium; if (i === 0) mainMatched = true; }
      });
      // 主食（第一轮）没有营养数据 → 整套餐营养不可靠，排除
      if (!mainMatched) continue;
      items.push({ code, name: d.name, cat: 'combo', image, parts: partNames.map(name => ({ name })),
        kcal, protein, sodium, price, satiety: satietyScore({ kcal, protein, sodium }) });
    } else {
      const n = matchNutrition(d.name, nutrition);
      if (!n) continue;
      items.push({ code, name: d.name, cat: classify(d.cat, d.name), image,
        kcal: n.kcal, protein: n.protein, sodium: n.sodium, price, satiety: satietyScore(n) });
    }
  }
  return items;
}
