#!/usr/bin/env node
/**
 * Google Place ID を、鍵なしで採取する道具。
 *
 * なぜ必要か: 2026-08-09 の飲食拡充で店は 350 まで増えたが Place ID は取らずに
 * `pending:<slug>` を置いたままだった。ID が無い店は詳細パネルから Google への
 * リンクが丸ごと消える（src/ui/info.js の googleMapsUrl が '' を返す設計）。
 *
 * やり方: Google マップの内部検索エンドポイント（`/search?tbm=map`）は JSON を
 * 素の HTTP で返す。そこに 店名・緯度経度・CID・Place ID が入っている。
 *
 * 別の店を掴まないための二重の関門（ここが本体）:
 *   1) 距離   — 台帳の座標（全数検証済み）から一定距離いないの候補しか採らない
 *   2) 名前   — 正規化した店名が前方一致・部分一致すること
 * どちらかが欠けたら採用せず `review` に落とす。黙って当てずっぽうを書かない。
 *
 *   node tools/fetch-place-ids.js --check   # 既知 ID の店で答え合わせ（精度測定）
 *   node tools/fetch-place-ids.js --fill    # pending: の店を採取して out へ書く
 *   node tools/fetch-place-ids.js --limit N # 先頭 N 件だけ
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url);
const OUT = new URL('place-id-harvest.json', import.meta.url);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// 座標の出どころが違えば、許される「ずれ」も違う。venue は施設の中心、street は
// 通り単位なので、建物ピンより広く見ないと正解を弾いてしまう。
const RADIUS_M = { building: 250, venue: 450, street: 700 };

// ── 候補の取り出し ────────────────────────────────────────────
// 応答は「配列だけの JSON」で、位置で読むと Google の都合で簡単に壊れる。
// 代わりに、隣り合って必ず現れる 座標→CID→店名 の並びを錨にする。
const CAND_RE = /\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\],"(0x[0-9a-f]+:0x[0-9a-f]+)","((?:[^"\\]|\\.)*)"/g;
// CID と Place ID を結ぶ組。/g/… の特徴 ID は在ったり無かったりする。
const PID_RE = /"(0x[0-9a-f]+:0x[0-9a-f]+)"(?:,(?:null|"[^"]*")){1,4},"(ChIJ[A-Za-z0-9_-]+)"/g;

function extract(html){
  const byCid = new Map();
  for(const m of html.matchAll(PID_RE)) if(!byCid.has(m[1])) byCid.set(m[1], m[2]);
  const seen = new Set(), out = [];
  for(const m of html.matchAll(CAND_RE)){
    const cid = m[3];
    if(seen.has(cid)) continue;
    seen.add(cid);
    out.push({
      lat: Number(m[1]), lng: Number(m[2]), cid,
      name: JSON.parse('"' + m[4] + '"'),
      placeId: byCid.get(cid) || '',
    });
  }
  return out;
}

// ── 突き合わせ ────────────────────────────────────────────────
const R = 6371000;
const rad = d => d * Math.PI / 180;
function metres(a, b, c, d){
  const dLat = rad(c - a), dLng = rad(d - b);
  const h = Math.sin(dLat/2)**2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** 「宮武讃岐うどん」と「Miyatake Sanuki Udon」は照合できないので、記号と大小と
 *  空白だけを均す。日本語名は別枠で当てる（呼び出し側が nameJa も渡す）。 */
const norm = s => String(s || '').toLowerCase()
  // Bōl と Bol、Café と Cafe を同じ語として読む（実際に取りこぼした）。
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[|｜(){}[\]〈〉「」『』]/g, ' ')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

function nameMatches(want, got){
  const a = norm(want), b = norm(got);
  if(!a || !b) return false;
  if(a === b) return true;
  // 前方一致は「語の切れ目」でしか認めない。素の部分一致を許すと
  // 「Ushi」が「SUSHI TAKA」に含まれて別の店を掴む（実際に起きた）。
  if(a.startsWith(b + ' ') || b.startsWith(a + ' ')) return true;
  // 「Nipah (EQ…)」対「Nipah at EQ」のような語の重なりで見る。短い語だけの
  // 一致（KL・by・at）で通らないよう、4文字以上の語を1つは共有させる。
  const A = new Set(a.split(' ').filter(w => w.length >= 2));
  const B = new Set(b.split(' ').filter(w => w.length >= 2));
  if(!A.size || !B.size) return false;
  const shared = [...A].filter(w => B.has(w));
  return shared.length / Math.min(A.size, B.size) >= 0.6
    && shared.some(w => w.length >= 4);
}

function judge(row, cands){
  const limit = RADIUS_M[row.geoPrecision] || 450;
  const scored = cands
    .filter(c => c.placeId)
    .map(c => ({ ...c, dist: Math.round(metres(row.lat, row.lng, c.lat, c.lng)) }))
    .sort((x, y) => x.dist - y.dist);
  for(const c of scored){
    const near = c.dist <= limit;
    const named = nameMatches(row.name, c.name) || nameMatches(row.nameJa, c.name);
    if(near && named) return { verdict: 'ok', pick: c, limit };
  }
  return { verdict: 'review', pick: scored[0] || null, limit, all: scored.slice(0, 3) };
}

// ── 取得 ──────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function search(query, attempt = 0){
  const url = 'https://www.google.com/search?tbm=map&hl=en&gl=my&q=' + encodeURIComponent(query);
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } });
  if(res.status === 429 || res.status === 503){
    if(attempt >= 3) throw new Error('rate limited: ' + res.status);
    await sleep(20000 * (attempt + 1));
    return search(query, attempt + 1);
  }
  if(!res.ok) throw new Error('http ' + res.status);
  return res.text();
}

// 台帳の venue には「路面店（Metro Prima 前）」「屋台街（通り全体）」のような
// 日本語の但し書きが混ざっている。そのまま検索語に入れると Google は 0 件を返す。
const CJK = /[　-ヿ㐀-鿿＀-￯]/;
const ascii = s => String(s || '').replace(/[（(][^）)]*[）)]/g, ' ')
  .split(/[\/、,]/).map(t => t.trim()).filter(t => t && !CJK.test(t)).join(' ').trim();

/** 1つの検索語で駄目なら次を試す。長い順に落としていく（絞りすぎが 0 件の主因）。 */
function queriesFor(row){
  const name = ascii(row.name) || row.name;
  const bare = name.replace(/[（(][^）)]*[）)]/g, ' ').trim();
  const venue = ascii(row.venue);
  const addr = ascii(row.address);
  const area = ascii(row.area);
  const tail = 'Kuala Lumpur Malaysia';
  const list = [
    [name, venue, addr, tail],
    [name, addr, tail],
    [name, venue, tail],
    [bare, area, tail],
    [bare, tail],
  ].map(p => p.filter(Boolean).join(', '));
  return [...new Set(list)];
}

// ── 実行 ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
const mode = args.includes('--check') ? 'check' : 'fill';
const limitArg = args.indexOf('--limit');
const cap = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity;

const all = JSON.parse(readFileSync(new URL('restaurants.json', ROOT), 'utf8'));
const live = all.filter(r => !r.delisted);
const isPending = r => String(r.placeId || '').startsWith('pending:');
const targets = (mode === 'check'
  ? live.filter(r => !isPending(r) && String(r.placeId).startsWith('ChIJ'))
  : live.filter(isPending)).slice(0, cap);

console.log(`[${mode}] ${targets.length} 件`);
const results = [];
for(const [i, row] of targets.entries()){
  let rec = { id: row.id, name: row.name };
  try {
    let j = null, used = '', tried = [];
    for(const q of queriesFor(row)){
      tried.push(q);
      const cands = extract(await search(q));
      const got = judge(row, cands);
      if(!j || (got.verdict === 'ok' && j.verdict !== 'ok') || (!j.pick && got.pick)) j = got, used = q;
      if(got.verdict === 'ok') break;
      await sleep(900);
    }
    rec = { ...rec, query: used, tried: tried.length, verdict: j.verdict, radius: j.limit,
      picked: j.pick ? { placeId: j.pick.placeId, name: j.pick.name, dist: j.pick.dist } : null,
      near: j.all };
    if(mode === 'check') rec.truth = row.placeId, rec.hit = j.verdict === 'ok' && j.pick.placeId === row.placeId;
  } catch(e){
    rec.verdict = 'error'; rec.error = String(e.message);
  }
  results.push(rec);
  const mark = rec.verdict === 'ok' ? (mode === 'check' ? (rec.hit ? '✓' : '✗ WRONG') : '✓') : rec.verdict;
  console.log(`${String(i + 1).padStart(3)}/${targets.length} ${mark} ${row.name}` +
    (rec.picked ? ` → ${rec.picked.name} (${rec.picked.dist}m)` : ''));
  await sleep(1200 + Math.floor(Math.random() * 800));
}

writeFileSync(OUT, JSON.stringify({ mode, generated: new Date().toISOString(), results }, null, 2));
const ok = results.filter(r => r.verdict === 'ok');
console.log(`\n採用 ${ok.length} / 要確認 ${results.filter(r => r.verdict === 'review').length} / 失敗 ${results.filter(r => r.verdict === 'error').length}`);
if(mode === 'check'){
  const wrong = ok.filter(r => !r.hit);
  console.log(`正解 ${ok.filter(r => r.hit).length} / 誤り ${wrong.length}`);
  for(const w of wrong) console.log('  ✗', w.name, w.truth, '→', w.picked.placeId, w.picked.name);
}
console.log('→', OUT.pathname);
