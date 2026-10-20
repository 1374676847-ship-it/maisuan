// 端到端验证线上页面：带 sharecode 走完 输入→推荐→便宜榜 流程
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/Administrator/.workbuddy/binaries/node/workspace/package.json');
const { chromium } = require('playwright-core');

const BASE = 'https://maisuan-mcd.app.workbuddy.host/?sharecode=MUGMZUYC3K';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 420, height: 920 } });
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('#go', { timeout: 30000 });

const storeText = await page.textContent('#storeBar').catch(() => '(未加载)');
console.log('门店栏:', storeText.slice(0, 50));

await page.fill('#budget', '25');
await page.click('#go');
await page.waitForSelector('.combo-card', { timeout: 15000 });
await page.click("button:has-text('便宜优先')");
await page.waitForTimeout(400);
const firstCard = await page.textContent('.combo-card .combo-name');
const firstPrice = await page.textContent('.combo-card .price');
console.log('线上便宜榜榜首:', firstCard.trim(), firstPrice);
await browser.close();
console.log(firstPrice.includes('13.9') || firstPrice.includes('14.9') ? '✅ 线上端到端通过' : '⚠ 结果异常');
