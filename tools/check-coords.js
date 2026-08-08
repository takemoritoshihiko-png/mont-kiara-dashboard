// 飲食店座標の全数検査(2026-08-08 宮武うどん位置ズレ発覚を機に新設)
// 使い方: node tools/check-coords.js  → 住所をNominatimでジオコーディングし、
// 登録座標との距離を測って乖離を一覧にする。四半期の生存スイープと同じ頻度で回す。
// Nominatimは1リクエスト/秒厳守・User-Agent必須(利用規約)。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const rows = JSON.parse(fs.readFileSync(path.join(ROOT, 'restaurants.json'), 'utf8'));

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const dist = (a, b, c, d) => {
  const R = 6371, rad = x => x * Math.PI / 180;
  const h = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 1000);
};

async function geocode(q){
  const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=my&q=' + encodeURIComponent(q);
  const res = await fetch(url, { headers: { 'User-Agent': 'mont-kiara-dashboard/1.0 (family dining map; contact: takemoritoshihiko@gmail.com)' } });
  if(!res.ok) return null;
  const j = await res.json();
  return j[0] ? { lat: +j[0].lat, lng: +j[0].lon, label: j[0].display_name } : null;
}

const out = [];
for(const r of rows){
  if(r.lat == null) continue;
  // 住所そのもの → だめなら「店名 + エリア」で再試行(モール内ユニット等は住所が引けない)
  let hit = await geocode(r.address + ', Kuala Lumpur, Malaysia');
  await sleep(1100);
  let via = 'address';
  if(!hit){
    hit = await geocode(r.name + ', ' + r.area + ', Kuala Lumpur');
    await sleep(1100);
    via = 'name';
  }
  const d = hit ? dist(r.lat, r.lng, hit.lat, hit.lng) : null;
  out.push({ id: r.id, name: r.name, area: r.area, d, via: hit ? via : 'no-hit',
             geo: hit ? { lat: hit.lat, lng: hit.lng } : null });
  const mark = d == null ? '?' : d > 1000 ? '!!' : d > 250 ? '!' : 'ok';
  console.log(`${mark.padEnd(3)} ${r.id} ${r.name} ${d == null ? '(ヒットなし)' : d + 'm'} [${via}]`);
}
fs.writeFileSync(path.join(ROOT, 'tools/coord-check-result.json'), JSON.stringify(out, null, 1) + '\n');
const bad = out.filter(x => x.d == null || x.d > 250);
console.log(`\n合計 ${out.length}件 / 乖離250m超+ヒットなし ${bad.length}件 → tools/coord-check-result.json`);
