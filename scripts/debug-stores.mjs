import { callTool, extractApiJson } from '../engine/mcd-client.mjs';
const text = await callTool('query-nearby-stores', { searchType: 2, city: '佛山', keyword: '祖庙', beType: 1 });
console.log('has marker:', text.includes('## Original Response'));
const j = extractApiJson(text);
console.log('top keys:', Object.keys(j));
console.log('data type:', Array.isArray(j.data) ? `array[${j.data.length}]` : typeof j.data);
if (Array.isArray(j.data)) console.log('first store:', JSON.stringify(j.data[0]).slice(0, 200));
