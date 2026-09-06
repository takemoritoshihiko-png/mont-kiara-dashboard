#!/usr/bin/env node
/**
 * 採取した Place ID を台帳へ入れる。既定は下読みだけ（--write で書く）。
 *
 * 守ること:
 *   - `verdict: ok` のものしか入れない。要確認・失敗は pending: のまま残す
 *   - 墓標（delisted）の行には触らない
 *   - 既に入っている ID を書き換えるときは、必ず 前→後 を印字する（黙って直さない）
 *   - 書き出しは JSON.stringify(…, null, 1) で元ファイルと1バイト差なく往復する
 *     ことを事前に確かめてから行う（整形の巻き添え変更を出さない）
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url);
const LEDGER = new URL('restaurants.json', ROOT);
// 手で決めたぶん（place-id-manual.json）を最後に置く＝自動より人の裁定が勝つ。
const SOURCES = ['place-id-harvest.json', 'place-id-harvest-existing.json', 'place-id-manual.json']
  .map(f => new URL(f, import.meta.url)).filter(u => existsSync(u));

const write = process.argv.includes('--write');
const text = readFileSync(LEDGER, 'utf8');
const rows = JSON.parse(text);

// 整形の往復を先に確かめる。ここが合わないと、ID 以外の何かが道連れで変わる。
if(JSON.stringify(rows, null, 1) + '\n' !== text){
  console.error('中止: restaurants.json が想定の整形と一致しない（往復で差が出る）');
  process.exit(1);
}

const picks = new Map();
for(const src of SOURCES){
  for(const r of JSON.parse(readFileSync(src, 'utf8')).results){
    if(r.verdict === 'ok' && r.picked?.placeId) picks.set(r.id, r);
  }
}

const filled = [], fixed = [], same = [], skipped = [];
for(const row of rows){
  const p = picks.get(row.id);
  if(!p) continue;
  if(row.delisted){ skipped.push(row.name); continue; }
  const before = row.placeId || '';
  if(before === p.picked.placeId){ same.push(row.name); continue; }
  (before.startsWith('pending:') || !before ? filled : fixed)
    .push({ name: row.name, before, after: p.picked.placeId, google: p.picked.name, dist: p.picked.dist });
  row.placeId = p.picked.placeId;
}

const stillPending = rows.filter(r => !r.delisted && String(r.placeId).startsWith('pending:'));

console.log(`新たに入れた   ${filled.length}`);
console.log(`元から同じ     ${same.length}`);
console.log(`書き換えた     ${fixed.length}`);
for(const f of fixed) console.log(`   ${f.name}: ${f.before} → ${f.after}（${f.google} / ${f.dist}m）`);
console.log(`墓標なので除外 ${skipped.length}`);
console.log(`pending のまま ${stillPending.length}`);
for(const s of stillPending) console.log(`   - ${s.name}（${s.placeId}）`);

if(write){
  writeFileSync(LEDGER, JSON.stringify(rows, null, 1) + '\n');
  console.log('\n書き込みました → restaurants.json');
} else {
  console.log('\n（下読みのみ。書くには --write）');
}
