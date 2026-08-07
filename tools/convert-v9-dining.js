// 台帳v9 (kl-dining-ledger-v9.html) → restaurants.json 変換（D2）
// 使い方: node tools/convert-v9-dining.js [v9のHTMLパス]
// 座標は docs/superpowers/specs/2026-08-07-dining-d1-coordinates.md の ✅行のみ採用。
// ⚠/❌の店は lat/lng=null で出力し、再検証パスの結果で上書きする（誤座標を地図に載せない）。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const V9_PATH = process.argv[2] || 'C:/Users/takem/OneDrive/デスクトップ/kl-dining-ledger-v9.html';
const COORD_MD = path.join(ROOT, 'docs/superpowers/specs/2026-08-07-dining-d1-coordinates.md');
const OUT = path.join(ROOT, 'restaurants.json');

// 裁定1（2026-08-07確定）: 33種の cat → 8大分類。未知の cat が来たら失敗させる（無言で落とさない）
const CAT_GROUP = {
  'モダン・マレーシアン': 'マレーシア料理', 'ニョニャ': 'マレーシア料理', 'ニョニャ・マレー': 'マレーシア料理',
  'マレー・ジャワ': 'マレーシア料理', 'マレー': 'マレーシア料理', 'ナシレマ': 'マレーシア料理',
  'フレンチ': '洋食・グリル', '炭火・薪火': '洋食・グリル', 'イタリアン': '洋食・グリル',
  'モダン・ヨーロピアン': '洋食・グリル', 'ヨーロピアン': '洋食・グリル', 'グリル': '洋食・グリル', 'ボーダーレス': '洋食・グリル',
  '広東・点心': '中華', '広東（老舗）': '中華', '中華（モダン）': '中華', '客家（擂茶）': '中華', '焼味': '中華',
  'インド': 'インド・スリランカ', '南インド（菜食）': 'インド・スリランカ', '北インド': 'インド・スリランカ',
  'バナナリーフ': 'インド・スリランカ', 'スリランカ': 'インド・スリランカ',
  '土鍋鶏飯': '鶏飯・ご飯もの', '海南鶏飯': '鶏飯・ご飯もの',
  '麺': '麺・肉骨茶', '肉骨茶': '麺・肉骨茶', '魚頭麺': '麺・肉骨茶',
  '日本料理': '日本・その他アジア', 'タイ': '日本・その他アジア', 'ベトナム': '日本・その他アジア', '中東': '日本・その他アジア',
  '屋台街': '屋台街',
};

const html = fs.readFileSync(V9_PATH, 'utf8');

// D と VOX を sandbox で評価（自分の台帳ファイル＝信頼できるソース）
const dSrc = html.slice(html.indexOf('const D=['), html.indexOf('];', html.indexOf('const D=[')) + 2);
const voxSrc = html.slice(html.indexOf('const VOX={'), html.indexOf('\n};', html.indexOf('const VOX={')) + 3);
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(dSrc.replace('const D=', 'this.D=') , sandbox);
vm.runInContext(voxSrc.replace('const VOX=', 'this.VOX='), sandbox);
const D = sandbox.D, VOX = sandbox.VOX;
if (!Array.isArray(D) || D.length !== 50) throw new Error(`D length ${D && D.length} != 50`);

// D1座標表の ✅ 行を読む
const coordRows = fs.readFileSync(COORD_MD, 'utf8').split('\n')
  .filter(l => l.startsWith('|') && !l.startsWith('|---') && !l.startsWith('| Name'))
  .map(l => l.split('|').map(c => c.trim()))
  .map(c => ({ name: c[1], lat: c[3], lng: c[4], precision: c[5], verdict: c[6] }));
// v9側の「K KL（圭）」のような括弧付き表記を正規化して突合
const norm = s => s.replace(/（[^）]*）/g, '').trim();
const coordByName = new Map(coordRows.map(r => [norm(r.name), r]));

const out = D.map((d, idx) => {
  const group = CAT_GROUP[d.cat];
  if (!group) throw new Error(`unknown cat "${d.cat}" (${d.n})`);
  const co = coordByName.get(norm(d.n));
  if (!co) throw new Error(`no coordinate row for "${d.n}"`);
  const ok = co.verdict.startsWith('✅');
  return {
    id: 'R' + String(idx + 1).padStart(4, '0'),
    placeId: d.i, name: d.n, nameJa: d.j,
    cat: d.cat, catGroup: group,
    michelin: d.m, tier: d.t, extraFlags: d.ex,
    rating: d.r, reviewCount: d.c, natCode: d.nat, kidOk: d.kid,
    venue: d.v, venueType: d.vt, area: d.ar, address: d.ad,
    lat: ok ? Number(co.lat) : null, lng: ok ? Number(co.lng) : null,
    geoPrecision: ok ? co.precision : 'pending',
    priceLunch: [d.lL, d.lH], priceDinner: [d.dL, d.dH],
    priceConfidence: d.pc, priceNote: d.pn, editorNote: d.note,
    vox: VOX[d.i] ? { pros: VOX[d.i].p || '', cons: VOX[d.i].c || '' } : { pros: '', cons: '' },
  };
});

fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
const geo = out.filter(r => r.lat !== null).length;
console.log(`restaurants.json: ${out.length}件 (座標あり ${geo} / pending ${out.length - geo})`);
