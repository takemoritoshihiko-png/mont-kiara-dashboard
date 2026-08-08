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
// 裁定E-1（2026-08-07夜）: 9分類目「カフェ・デザート」を新設（拡充分のカフェ/デザート店が所属）
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
  '日本料理': '日本・その他アジア', 'タイ': '日本・その他アジア', 'ベトナム': '日本・その他アジア', '中東': '中東',   // 2026-08-09裁定: 8店超で独立カテゴリ化
  '屋台街': '屋台街',
  // 拡充分（2026-08-07 D6）で使う cat
  '和牛焼肉': '日本・その他アジア', 'すき焼き・和牛': '日本・その他アジア', '居酒屋': '日本・その他アジア',
  'ラーメン': '日本・その他アジア', '四川火鍋': '中華', 'ステーキ': '洋食・グリル',
  'モダン・インディアン': 'インド・スリランカ', 'マレー・シーフード': 'マレーシア料理',
  'カフェ': 'カフェ・デザート', 'デザート': 'カフェ・デザート', 'パティスリー': 'カフェ・デザート',
  'スペイン': '洋食・グリル',
  // D7拡充(発見ロジック承認後)で使う cat
  '寿司': '日本・その他アジア', '精進（ヴィーガン）': '日本・その他アジア',
  'おまかせフュージョン': '日本・その他アジア', 'うどん': '日本・その他アジア',
  '焼肉ビュッフェ': '日本・その他アジア',
  '麺（モダン華人）': '麺・肉骨茶', 'パンミー': '麺・肉骨茶',
  'カフェ・ブランチ': 'カフェ・デザート', 'ベーカリー': 'カフェ・デザート',
  '抹茶': 'カフェ・デザート', 'ベーグル': 'カフェ・デザート',
  '北インド（菜食）': 'インド・スリランカ',
  '南米グリル': '洋食・グリル', 'ピザ': '洋食・グリル', '洋食ビストロ': '洋食・グリル',
  'インドネシア': '日本・その他アジア', 'ビュッフェ（マレー・多国籍）': 'マレーシア料理',
  // ミシュランKL完全網羅(2026-08-08)で使う cat
  '天ぷら': '日本・その他アジア', '日本料理（割烹）': '日本・その他アジア',
  '潮州': '中華', '上海料理': '中華',
  'イノベーティブ': '洋食・グリル', 'スイス': '洋食・グリル',
  'バー': 'バー',   // 10分類目(2026-08-08)
  // MK大衆口コミ再調査(2026-08-08)で使う cat
  '韓国焼肉': '日本・その他アジア', '火鍋': '中華',
};

// ベース50件のソースは2系統:
//  (a) v9原本HTMLがあれば D/VOX を抽出して変換（初回移植の経路）
//  (b) 無ければ、コミット済み restaurants.json の R0001〜R0050 をそのまま使う。
//     2026-08-07夜にデスクトップ整理で v9原本が移動/消失したが、全項目は既に
//     restaurants.json へ無損失で移植済みのため、以後は (b) が通常経路。
let out;
if (fs.existsSync(V9_PATH)) {
  const html = fs.readFileSync(V9_PATH, 'utf8');
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

  out = D.map((d, idx) => {
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
} else {
  out = JSON.parse(fs.readFileSync(OUT, 'utf8')).slice(0, 50);
  if (out.length !== 50 || out[0].id !== 'R0001') throw new Error('restaurants.json base is not the expected 50 v9 records');
  // catGroup は cat から毎回導出し直す(catがSSOT)。保存値を使い回すと、
  // グループ再編(例: 2026-08-09 中東の独立)がベース50行だけ効かない事故になる。
  for (const r of out) {
    const g = CAT_GROUP[r.cat];
    if (!g) throw new Error(`unknown cat "${r.cat}" (${r.name})`);
    r.catGroup = g;
  }
  console.log('v9原本なし → 既存 restaurants.json の R0001-R0050 をベースに再生成');
}

// D6 拡充分（検証パス通過店）: tools/dining-additions.json があれば R0051〜 として追記。
// 各レコードは v9由来と同じスキーマを名乗る（検証済みの実値のみ・捏造禁止は追加ファイル側の責務）。
const ADDITIONS = path.join(ROOT, 'tools/dining-additions.json');
if (fs.existsSync(ADDITIONS)) {
  const adds = JSON.parse(fs.readFileSync(ADDITIONS, 'utf8'));
  const required = ['placeId','name','nameJa','cat','michelin','rating','reviewCount','natCode','kidOk','venue','venueType','area','address','lat','lng','geoPrecision','priceLunch','priceDinner','priceConfidence','priceNote','editorNote','vox'];
  for (const a of adds) {
    for (const k of required) if (!(k in a)) throw new Error(`addition "${a.name}" missing ${k}`);
    const group = CAT_GROUP[a.cat];
    if (!group) throw new Error(`unknown cat "${a.cat}" (${a.name})`);
    out.push({ id: 'R' + String(out.length + 1).padStart(4, '0'), ...a, catGroup: group, tier: a.tier ?? 0, extraFlags: a.extraFlags ?? [] });
  }
}

// Mont Kiara からの車所要時間（tools/gen-drive-times.js の成果物）を焼き込む。
// 無い店(新規追加直後など)は null — UIは null を「—」で出す。数値を捏造しない。
// 更新手順: convert → gen-drive-times → convert（README「飲食データの更新」参照）。
const DRIVE = path.join(ROOT, 'tools/drive-times.json');
if (fs.existsSync(DRIVE)) {
  const dt = JSON.parse(fs.readFileSync(DRIVE, 'utf8')).times;
  let hit = 0;
  for (const r of out) {
    const d = dt[r.name];
    r.driveKm = d ? d.km : null;
    r.driveMinFree = d ? d.minFree : null;
    r.driveMinJam = d ? d.minJam : null;
    if (d) hit++;
  }
  console.log(`所要時間の焼き込み: ${hit}/${out.length}件`);
}

fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
const geo = out.filter(r => r.lat !== null).length;
console.log(`restaurants.json: ${out.length}件 (座標あり ${geo} / pending ${out.length - geo})`);
