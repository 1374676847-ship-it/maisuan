// shoot-docs.mjs — 打开麦算页面，截三张使用说明图（遮官方商品图）
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/Administrator/.workbuddy/binaries/node/workspace/package.json');
const { chromium } = require('playwright-core');

const OUT = 'D:/workbuddy文件/2026-10-20-21-10-09/maisuan/docs/images';
const MASK = `document.querySelectorAll('.imgs img').forEach(i=>{i.style.visibility='hidden'})`;

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 420, height: 920 } });
await page.goto('http://127.0.0.1:8321/', { waitUntil: 'networkidle' });

// 1. 输入页
await page.evaluate(MASK);
await page.screenshot({ path: `${OUT}/step1-input.png`, fullPage: true });

// 2. 点「给我搭一餐」→ 饱腹优先结果
await page.click('#go');
await page.waitForSelector('.combo-card', { timeout: 10000 });
await page.evaluate(MASK);
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/step2-satiety.png`, fullPage: true });

// 3. 切便宜优先
await page.click("button:has-text('便宜优先')");
await page.waitForTimeout(300);
await page.evaluate(MASK);
await page.screenshot({ path: `${OUT}/step3-cheap.png`, fullPage: true });

await browser.close();
console.log('3 screenshots saved to', OUT);
