// 探测 calculate-price 返回格式
import { callToolJson } from '../engine/mcd-client.mjs';

// 板烧鸡腿堡(521903?) + 中薯条 + 无糖可乐 —— 先用详情里见过的 code
const r = await callToolJson('calculate-price', {
  storeCode: '1400956', orderType: 1, beType: 1,
  items: [
    { productCode: '521903', quantity: 1 },
    { productCode: '4810', quantity: 1 },
    { productCode: '3060', quantity: 1 },
  ],
});
console.log(JSON.stringify(r, null, 2).slice(0, 1500));
