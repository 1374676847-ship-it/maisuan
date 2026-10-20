# MCP 集成说明（MCP_INTEGRATION）

本项目真实调用了麦当劳官方 MCP Server（`mcd-mcp`，streamablehttp，`https://mcp.mcd.cn`，当前 35 个工具）。以下为实际使用的工具、调用时序与业务价值。

## 调用时序

```
初始化（每次会话）
└── initialize → 握手确认 serverInfo: mcd-mcp v1.0.0

数据缓存阶段（scripts/build-menu-cache.mjs）
├── query-nearby-stores  searchType=2, city=佛山, keyword=祖庙, beType=1
│   └── 获得门店列表 → storeCode=1400956（麦当劳佛山禅城岭南天地璟廷餐厅）
├── query-meals  storeCode, orderType=1, beType=1
│   └── 获得 140 个在售商品 code + 分类（14 个分类，含"500大卡套餐"）
├── query-meal-detail  ×140（每个 code 一次）
│   └── 获得商品名称、官方商品图 URL(data.image)、套餐默认组成(rounds)、
│       换购差价(diffPrice)、特调选项(modification/selectedKey)
└── list-nutrition-foods
    └── 获得 160 个常见餐品的 TOON 格式营养数据
       （能量/蛋白/脂肪/碳水/钠/钙），经自研 TOON 解析器转 JSON

价格阶段（scripts/build-price-cache.mjs）
└── calculate-price  ×1（38 个单品合并一次购物车）
    └── 利用返回的 productList 逐项小计，拆出每个单品的单点实付价（单位：分）

推荐阶段（proxy/server.mjs / cli.js，纯本地计算）
└── 组合枚举 + 约束过滤 + 排序 → TopN 推荐（不再消耗 MCP 配额）
```

## 工具清单与业务价值

| 工具 | 用途 | 业务价值 |
|---|---|---|
| `query-nearby-stores` | 定位门店 | 菜单因店而异，推荐必须基于真实在售门店 |
| `query-meals` | 拉在售菜单 code | 保证推荐的是"现在这家店能买到"的东西 |
| `query-meal-detail` | 商品名/图片/套餐组成 | 商品图直接驱动网页卡片展示；套餐默认组成用于营养聚合 |
| `list-nutrition-foods` | 营养数据库 | 减脂引擎的核心燃料；TOON 格式解析是本项目的技术点之一 |
| `calculate-price` | 真实价格 | 所有价格展示均为官方接口实算，非人工维护的静态价目表 |

## 关键技术点

1. **TOON 解析**：`list-nutrition-foods` 返回 Token-Oriented Object Notation（`[160]{col,...}:` 行式结构），非标准 JSON，本项目在 `engine/mcd-client.mjs` 中实现了解析器并配了 160 行真实数据的解析验证。
2. **响应净化**：MCP 工具响应文本中混杂了字段说明与规则提示，且 JSON 尾部可能追加 markdown。`extractApiJson` 采用括号深度扫描提取纯净的 API JSON，对全部 5 类响应实测有效。
3. **品名归一化**：菜单品名与营养库品名存在杯型（雪碧（小杯）vs 雪碧小杯）、数量词（麦辣鸡翅2块）、商标符号差异，`matchNutrition` 做了去括号/去商标/去数量词/去杯型四级归一，实测 222 个子项命中。
4. **限流友好**：数据缓存阶段 140 次 detail 调用 + 1 次合并算价，远低于 600 次/分钟的接口限流；推荐阶段零接口消耗，可无限次重算。

## 真实调用日志（节选）

```
initialize → 200 { name: 'mcd-mcp', version: '1.0.0' }
query-nearby-stores → data[5] 门店，取 storeCode=1400956
query-meals → 14 分类 / 140 商品
query-meal-detail ×140 → 0 失败（缓存为 data-samples/cache-menu.json）
list-nutrition-foods → TOON 6666 字符 / 160 餐品
calculate-price(38 单品合并) → productOriginalPrice 5500… 逐项拆价成功
```

以上调用均可在 `scripts/probe*.mjs` 与缓存构建脚本中复现（需自备 MCP Token）。
