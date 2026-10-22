// Publish only the public research field. Default is a dry run.
import { readFileSync, writeFileSync } from 'node:fs';
import { attachDiningEvidence } from '../src/domain/diningEvidence.js';

const target = new URL('../restaurants.json', import.meta.url);
const source = new URL('./dining-evidence.json', import.meta.url);
const original = readFileSync(target, 'utf8');
const records = JSON.parse(original);
if(JSON.stringify(records, null, 1) + '\n' !== original) throw new Error('restaurants.jsonの整形往復が一致しません');
const entries = JSON.parse(readFileSync(source, 'utf8'));
const next = attachDiningEvidence(records, entries);
const changed = next.filter((r, i) => JSON.stringify(r) !== JSON.stringify(records[i]));
console.log(`調査 ${entries.length}店 / 更新 ${changed.length}店 / 全店舗 ${next.length}店`);
for(const r of changed) console.log(`  ${r.id} ${r.name}`);
if(process.argv.includes('--write')){
  if(changed.length) writeFileSync(target, JSON.stringify(next, null, 1) + '\n');
  console.log('restaurants.jsonへ反映しました');
} else console.log('下読みのみ。書き込みは --write');
