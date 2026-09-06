#!/usr/bin/env node
/**
 * 自動では決めきれなかった店だけを、人が裁くための下調べ。
 * 関門（距離・名前）を掛けずに候補をそのまま並べる。採用の判断は人がやる。
 *
 *   node tools/probe-place-ids.js R0094 R0095 …
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const CAND_RE = /\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\],"(0x[0-9a-f]+:0x[0-9a-f]+)","((?:[^"\\]|\\.)*)"/g;
const PID_RE = /"(0x[0-9a-f]+:0x[0-9a-f]+)"(?:,(?:null|"[^"]*")){1,4},"(ChIJ[A-Za-z0-9_-]+)"/g;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rad = d => d * Math.PI / 180;
const metres = (a, b, c, d) => {
  const h = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};

function extract(html){
  const byCid = new Map();
  for(const m of html.matchAll(PID_RE)) if(!byCid.has(m[1])) byCid.set(m[1], m[2]);
  const seen = new Set(), out = [];
  for(const m of html.matchAll(CAND_RE)){
    if(seen.has(m[3])) continue;
    seen.add(m[3]);
    out.push({ lat: +m[1], lng: +m[2], name: JSON.parse('"' + m[4] + '"'), placeId: byCid.get(m[3]) || '' });
  }
  return out;
}

const rows = JSON.parse(readFileSync(new URL('restaurants.json', ROOT), 'utf8'));
const wanted = process.argv.slice(2);
const out = [];
for(const id of wanted){
  const row = rows.find(r => r.id === id);
  if(!row){ console.log(id, '見つからない'); continue; }
  const seen = new Map();
  // 「Restoran 〜」「〜 HQ」「〜 (Ampang)」のような台帳側の飾りが検索を空振りさせる。
  // 飾りを落とした短い名前と、通り名だけの組み合わせも順に当てる。
  const plain = row.name.replace(/^Restoran\s+/i, '')
    .replace(/[（(][^）)]*[）)]/g, ' ').replace(/\s*[•|].*$/, '')
    .replace(/\s+HQ$/i, '').trim();
  const street = (row.address.match(/(Jalan|Jln|Lorong|Persiaran)[^,]*/i) || [''])[0].trim();
  for(const q of [
    `${row.name}, ${row.venue || ''}, ${row.address}, Kuala Lumpur Malaysia`,
    `${row.name}, ${row.area}, Kuala Lumpur Malaysia`,
    `${plain} ${street} Kuala Lumpur`,
    `${plain} Kuala Lumpur`,
    `${row.name} Malaysia`,
  ]){
    const res = await fetch('https://www.google.com/search?tbm=map&hl=en&gl=my&q=' + encodeURIComponent(q),
      { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } });
    if(res.ok) for(const c of extract(await res.text())){
      if(c.placeId && !seen.has(c.placeId)) seen.set(c.placeId, { ...c, dist: Math.round(metres(row.lat, row.lng, c.lat, c.lng)) });
    }
    await sleep(1400);
  }
  const cands = [...seen.values()].sort((a, b) => a.dist - b.dist).slice(0, 6);
  out.push({ id, name: row.name, addr: row.address, area: row.area, lat: row.lat, lng: row.lng, cands });
  console.log(`\n[${id}] ${row.name} — ${row.address} (${row.area})`);
  for(const c of cands) console.log(`   ${String(c.dist).padStart(6)}m  ${c.name}  ${c.placeId}`);
}
writeFileSync(new URL('place-id-probe.json', import.meta.url), JSON.stringify(out, null, 2));
