// mcd-client.mjs — 麦当劳 MCP 客户端 + 响应解析工具
// 开发期 token 从本机 ~/.workbuddy/mcp.json 读取；仓库版只从环境变量读
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function loadToken() {
  if (process.env.MCD_TOKEN) return process.env.MCD_TOKEN;
  const cfgPath = join(homedir(), '.workbuddy/mcp.json');
  try {
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
    return cfg.mcpServers['mcd-mcp'].headers.Authorization;
  } catch {
    throw new Error('未找到 MCP token：请设置环境变量 MCD_TOKEN');
  }
}

const URL_ = 'https://mcp.mcd.cn';
let seq = 0;

async function rpc(method, params = {}) {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': loadToken(),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++seq, method, params }),
  });
  const text = await res.text();
  let payload = text;
  if (text.includes('data:')) {
    payload = text.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('');
  }
  const r = JSON.parse(payload);
  if (r.error) throw new Error(`RPC error: ${JSON.stringify(r.error)}`);
  return r;
}

export async function callTool(name, args) {
  const r = await rpc('tools/call', { name, arguments: args });
  const text = r?.result?.content?.[0]?.text;
  if (text == null) throw new Error(`工具 ${name} 返回异常: ${JSON.stringify(r).slice(0, 200)}`);
  return text;
}

// 从工具响应文本中提取 API 原始 JSON（兼容尾部附带的规则说明）
export function extractApiJson(text) {
  const marker = '## Original Response';
  const startIdx = text.includes(marker) ? text.lastIndexOf(marker) : 0;
  const from = text.indexOf('{', startIdx);
  if (from < 0) throw new Error('响应中未找到 JSON');
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return JSON.parse(text.slice(from, i + 1));
    }
  }
  throw new Error('JSON 括号不匹配');
}

export async function callToolJson(name, args) {
  return extractApiJson(await callTool(name, args));
}

// TOON 解析："[N]{col,...}:\n  v,v,...\n..." → 对象数组
export function parseToon(text) {
  const m = text.match(/\[\d+\]\{([^}]+)\}:\s*\n([\s\S]*)/);
  if (!m) throw new Error('TOON header not found');
  const cols = m[1].split(',');
  const rows = [];
  for (const line of m[2].split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // 简单切分：TOON 行内值不含半角逗号（品名用全角标点）
    const vals = trimmed.split(',');
    if (vals.length < cols.length) continue;
    const row = {};
    cols.forEach((c, i) => { row[c.trim()] = vals[i]?.trim() ?? null; });
    rows.push(row);
  }
  return rows;
}

// 拉全量营养数据（真实 API）
export async function fetchNutrition() {
  const r = await callToolJson('list-nutrition-foods', {});
  return parseToon(r.data).map(x => ({
    name: x.productName,
    kcal: Number(x.energyKcal),
    protein: Number(x.protein),
    fat: Number(x.fat),
    carb: Number(x.carbohydrate),
    sodium: Number(x.sodium),
    calcium: Number(x.calcium),
  }));
}
