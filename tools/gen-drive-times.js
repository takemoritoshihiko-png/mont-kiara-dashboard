// Mont Kiara からの車所要時間を全飲食店に付ける（ミシュラン網羅 P2/P4・2026-08-08）
// 使い方: node tools/gen-drive-times.js   → tools/drive-times.json を再生成
// その後 node tools/convert-v9-dining.js を再実行すると restaurants.json に焼き込まれる。
//
// - OSRM 公開デモサーバーの table サービス（APIキー不要）。リクエストは80地点ずつ
//   まとめるので全店で2〜3回。連発しない（公開サーバーへのマナー）。
// - OSRM は渋滞を知らない free-flow 値。KLの実勢に合わせ×1.8 を「渋滞込み目安」
//   として別フィールドで持つ（UIは目安を主表示し、注記を添える）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// 基点 = アプリの地図初期表示（src/ui/map.js initMap の setView）と同じ Mont Kiara 中心。
const MK = { lat: 3.1710, lng: 101.6520 };
const JAM_FACTOR = 1.8;

const restaurants = JSON.parse(fs.readFileSync(path.join(ROOT, 'restaurants.json'), 'utf8'));
const pts = restaurants.filter(r => r.lat != null).map(r => ({ name: r.name, lat: r.lat, lng: r.lng }));

async function table(batch){
  const coords = [MK, ...batch].map(p => `${p.lng},${p.lat}`).join(';');
  const url = `https://router.project-osrm.org/table/v1/driving/${coords}?sources=0&annotations=duration,distance`;
  const res = await fetch(url, { headers: { 'User-Agent': 'mont-kiara-dashboard/1.0 (family dining map)' } });
  if(!res.ok) throw new Error('OSRM ' + res.status);
  return res.json();
}

const out = {};
for(let i = 0; i < pts.length; i += 80){
  const batch = pts.slice(i, i + 80);
  const j = await table(batch);
  batch.forEach((p, k) => {
    const sec = j.durations[0][k + 1], m = j.distances[0][k + 1];
    out[p.name] = {
      km: m == null ? null : Math.round(m / 100) / 10,
      minFree: sec == null ? null : Math.round(sec / 60),
      minJam: sec == null ? null : Math.round(sec * JAM_FACTOR / 60),
    };
  });
  console.log(`batch ${i / 80 + 1}: ${batch.length}件`);
  if(i + 80 < pts.length) await new Promise(r => setTimeout(r, 2000));
}

fs.writeFileSync(path.join(ROOT, 'tools/drive-times.json'),
  JSON.stringify({ base: MK, jamFactor: JAM_FACTOR, computed: new Date().toISOString().slice(0, 10), times: out }, null, 1) + '\n');
console.log(`drive-times.json: ${Object.keys(out).length}件`);
