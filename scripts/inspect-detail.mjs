import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const t = readFileSync(join(ROOT, 'data-samples/20-detail-9900016075.txt'), 'utf8');
const m = '## Original Response';
const o = JSON.parse(t.slice(t.lastIndexOf(m) + m.length).trim());
const d = o.data;
console.log('data keys:', Object.keys(d).join(', '));
console.log('name:', d.name);
console.log('image:', d.image);
for (const r of d.rounds || []) {
  console.log(`\nround ${r.id} ${r.name} (选${r.quantity}/${r.minQuantity}-${r.maxQuantity})`);
  for (const c of (r.choices || []).slice(0, 8)) {
    console.log(`  ${c.isDefault ? '[默认]' : '     '} ${c.name} 差价:${c.diffPrice} 可特调:${c.supportModify}`);
  }
}
