// 商業施設と飲食店のピンが重なる問題（2026-08-16 竹森氏指摘）。
//
// モールの中や真上にある店は座標がほぼ同じなので、飲食の雫が商業の四角を覆って
// 「モールが消える」ことが起きていた。裁定は「商業を優先に見せ、飲食はその横に
// ずらす」。ずらすのは**表示だけ**で、データの緯度経度には触れない。
//
// 地図本体は Leaflet 依存で DOM 無しでは動かないので、ここでは
//   ①判定の純関数 ②ソースに刻んだ契約
// を押さえる。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  nearAnyMall, mallShiftOff, overlapRadiusM, MALL_OVERLAP_M, MALL_SHIFT_PX, COMMERCIAL_Z,
  MALL_SHIFT_CLASS, MALL_APART_CLASS, MALL_SHIFT_MAX_ZOOM, LABEL_ZOOM,
  spotOffsets, SAME_SPOT_M, SAME_SPOT_RADIUS_PX, SPOT_PRIORITY,
} from '../src/ui/map.js';
import { haversineKm } from '../src/domain/geo.js';

const src = readFileSync(new URL('../src/ui/map.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const restaurants = JSON.parse(readFileSync(new URL('../restaurants.json', import.meta.url), 'utf8').replace(/\r\n/g, '\n'));

// Pavilion KL（実データで最も飲食が重なっている商業施設）
const PAVILION = { lat: 3.1490, lng: 101.7130 };

describe('nearAnyMall — ずらすかどうかの判定', () => {
  it('モールが1つも無ければ、どこにいても false（＝ずらさない）', () => {
    expect(nearAnyMall(3.149, 101.713, [])).toBe(false);
    expect(nearAnyMall(3.149, 101.713, null)).toBe(false);
  });

  it('座標が無いレコードは false（ずらす対象にしない）', () => {
    expect(nearAnyMall(null, null, [PAVILION])).toBe(false);
    expect(nearAnyMall(undefined, 101.713, [PAVILION])).toBe(false);
  });

  it('同じ地点は true、遠い地点は false', () => {
    expect(nearAnyMall(PAVILION.lat, PAVILION.lng, [PAVILION])).toBe(true);
    // 1km 離れれば重ならない
    expect(nearAnyMall(PAVILION.lat + 0.009, PAVILION.lng, [PAVILION])).toBe(false);
  });

  it('境界は半径ちょうどまで含む（内側 true / 外側 false）', () => {
    // 緯度1度 ≈ 111.2km。半径ぴったりの内側と外側を作る。
    const dLat = (MALL_OVERLAP_M / 1000) / 111.195;
    const inside = { lat: PAVILION.lat + dLat * 0.9, lng: PAVILION.lng };
    const outside = { lat: PAVILION.lat + dLat * 1.1, lng: PAVILION.lng };
    expect(haversineKm(inside.lat, inside.lng, PAVILION.lat, PAVILION.lng) * 1000)
      .toBeLessThan(MALL_OVERLAP_M);
    expect(nearAnyMall(inside.lat, inside.lng, [PAVILION])).toBe(true);
    expect(nearAnyMall(outside.lat, outside.lng, [PAVILION])).toBe(false);
  });

  it('複数のモールのうち1つでも近ければ true', () => {
    const far = { lat: 5.42, lng: 100.33 };   // ペナン
    expect(nearAnyMall(PAVILION.lat, PAVILION.lng, [far, PAVILION])).toBe(true);
  });

  it('実データで、ずらす対象が「一部の店だけ」に収まっている', () => {
    const live = restaurants.filter(r => !r.delisted && r.lat != null);
    const hit = live.filter(r => nearAnyMall(r.lat, r.lng, [PAVILION]));
    // Pavilion の周りには実際に重なる店がある（0件ならこの機能は無意味）
    expect(hit.length).toBeGreaterThan(0);
    // かつ、台帳の大半をずらしてしまってはいない（半径が広すぎないことの検査）
    expect(hit.length).toBeLessThan(live.length * 0.05);
  });
});

describe('overlapRadiusM — 縮尺から出す重なり半径', () => {
  it('引くほど半径が広がる（1pxが何十mにもなるため）', () => {
    const z13 = overlapRadiusM(13, 3.14, 32);
    const z16 = overlapRadiusM(16, 3.14, 32);
    const z18 = overlapRadiusM(18, 3.14, 32);
    expect(z13).toBeGreaterThan(z16);
    expect(z16).toBeGreaterThan(z18);
    // ズームが1段変わると倍・半分になる
    expect(overlapRadiusM(15, 3.14, 32) / z16).toBeCloseTo(2, 1);
  });

  it('大きいアイコンほど広く見る', () => {
    expect(overlapRadiusM(16, 3.14, 46)).toBeGreaterThan(overlapRadiusM(16, 3.14, 22));
  });

  it('ズーム16の値が、個別ピン用の既定(60m)とおおむね同じ桁になる', () => {
    // 個別ピンが1つずつ出るのがズーム16。ここが両者の接点。
    const r = overlapRadiusM(16, 3.14, 25);
    expect(r).toBeGreaterThan(MALL_OVERLAP_M * 0.5);
    expect(r).toBeLessThan(MALL_OVERLAP_M * 2);
  });

  it('引いた地図では、実距離が離れていても重なりとして拾う', () => {
    // ズーム13で 400m 先の店は、画面上ではモールの四角に重なって見える
    expect(nearAnyMall(PAVILION.lat + 0.0036, PAVILION.lng, [PAVILION],
      overlapRadiusM(13, PAVILION.lat, 32))).toBe(true);
    // 同じ店でも、寄れば重ならない
    expect(nearAnyMall(PAVILION.lat + 0.0036, PAVILION.lng, [PAVILION],
      overlapRadiusM(17, PAVILION.lat, 32))).toBe(false);
  });
});

describe('地図側の契約（ソースに刻んだもの）', () => {
  it('商業マーカーは常に飲食の上に描く', () => {
    expect(COMMERCIAL_Z).toBeGreaterThan(0);
    expect(src).toContain("recordLayer(c) === 'commercial' ? COMMERCIAL_Z : 0");
    expect(src).toMatch(/L\.marker\(\[c\.lat,c\.lng\],\{icon,keyboard:false,zIndexOffset\}\)/);
  });

  it('ずらすのは表示だけ（マーカーの緯度経度は本物のまま）', () => {
    // 見た目は class + CSS の translateX。座標そのものは作り替えていないこと。
    expect(MALL_SHIFT_PX).toBeGreaterThan(0);
    expect(src).toContain('${MALL_SHIFT_CLASS}');
    expect(src).not.toMatch(/L\.marker\(\[c\.lat \+/);
    expect(src).not.toMatch(/L\.marker\(\[c\.lat-/);
    // CSS 側に、ずらしと打ち消しの両方がある
    const css = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    expect(css).toContain(`.${MALL_SHIFT_CLASS}{transform:translateX(${MALL_SHIFT_PX}px)}`);
    expect(css).toContain(`.leaflet-container.${MALL_APART_CLASS} .${MALL_SHIFT_CLASS}{transform:none}`);
  });

  it('十分に寄ったら、ずらしをやめて本当の位置に戻す', () => {
    expect(mallShiftOff(MALL_SHIFT_MAX_ZOOM)).toBe(true);
    expect(mallShiftOff(MALL_SHIFT_MAX_ZOOM + 1)).toBe(true);
    expect(mallShiftOff(MALL_SHIFT_MAX_ZOOM - 1)).toBe(false);
    expect(mallShiftOff(16)).toBe(false);   // 数字玉が出る縮尺ではずらす
    // 名前ラベルは本当の座標に付くので、ラベルが常時出る縮尺ではずらさない
    // （ずらしたままだと名前とピンが離れて見える）
    expect(MALL_SHIFT_MAX_ZOOM).toBe(LABEL_ZOOM);
    // ズームのたびにマーカーを作り直さず、地図コンテナのclassだけ切り替える
    expect(src).toContain('el.classList.toggle(MALL_APART_CLASS, mallShiftOff(map.getZoom()))');
  });

  it('個別の飲食ピンと、まとまった数字玉の両方をずらす', () => {
    const dining = src.slice(src.indexOf("if (c.status === 'dining')"));
    expect(dining).toContain('nearAnyMall(c.lat, c.lng, mallPoints,');
    const cluster = src.slice(src.indexOf('function clusterIconFactory'));
    expect(cluster.slice(0, cluster.indexOf('function makeClusterGroups')))
      .toContain("nearAnyMall(ll.lat, ll.lng, mallPoints, overlapRadiusM(zoom, ll.lat, sz))");
  });

  it('商業を出していないときは、ずらしの基準が空になる', () => {
    // 外食モード（飲食だけ）と、商業のチェックを外したときは重なりが起きない
    expect(src).toContain("mallPoints = (appMode !== 'eatout' && visibleLayers.commercial)");
  });
});

// ============================================================
// 同じ地点に複数ある場合（2026-08-16 竹森氏指示）
// 「めっちゃ拡大しても完全に重なる」組を、表示だけ扇状に散らす。
// ============================================================
describe('spotOffsets — 完全に同じ地点の散らし', () => {
  it('1件だけの地点は動かさない（ずらす必要が無い）', () => {
    const out = spotOffsets([{ key: 'A', lat: 3.16, lng: 101.65, layer: 'condo' }]);
    expect(out.size).toBe(0);
  });

  it('離れた2件も動かさない（3mより遠ければ寄れば分かれる）', () => {
    const out = spotOffsets([
      { key: 'A', lat: 3.16, lng: 101.65, layer: 'condo' },
      { key: 'B', lat: 3.161, lng: 101.65, layer: 'dining' },   // 約111m
    ]);
    expect(out.size).toBe(0);
  });

  it('完全に同じ座標の2件は、片方だけ動かす（もう片方は本当の位置に残る）', () => {
    const out = spotOffsets([
      { key: '商業', lat: 3.16, lng: 101.65, layer: 'commercial' },
      { key: '飲食', lat: 3.16, lng: 101.65, layer: 'dining' },
    ]);
    expect(out.size).toBe(1);
    expect(out.has('商業')).toBe(false);   // 優先度が高い方が真ん中
    expect(out.has('飲食')).toBe(true);
  });

  it('真ん中に残るのは 商業 > 学校 > 物件 > 飲食 の順', () => {
    const at = (key, layer) => ({ key, layer, lat: 3.16, lng: 101.65 });
    expect(spotOffsets([at('学校', 'school'), at('飲食', 'dining')]).has('学校')).toBe(false);
    expect(spotOffsets([at('物件', 'condo'), at('飲食', 'dining')]).has('物件')).toBe(false);
    expect(spotOffsets([at('学校', 'school'), at('物件', 'condo')]).has('学校')).toBe(false);
    expect(spotOffsets([at('商業', 'commercial'), at('学校', 'school')]).has('商業')).toBe(false);
  });

  it('ずらし量は 0 ではない（「少しずらす」＝必ず動く）', () => {
    const out = spotOffsets([
      { key: 'A', lat: 3.16, lng: 101.65, layer: 'commercial' },
      { key: 'B', lat: 3.16, lng: 101.65, layer: 'dining' },
    ]);
    const { dx, dy } = out.get('B');
    expect(Math.hypot(dx, dy)).toBeGreaterThan(0);
  });

  it('3件以上でも全員が別の位置になる（重ねたまま散らさない）', () => {
    const at = (key, layer) => ({ key, layer, lat: 3.16, lng: 101.65 });
    const out = spotOffsets([at('a', 'commercial'), at('b', 'dining'), at('c', 'dining'), at('d', 'condo')]);
    expect(out.size).toBe(3);
    const seen = new Set([...out.values()].map(v => `${v.dx},${v.dy}`));
    expect(seen.size).toBe(3);            // ずらした先が誰ともかぶらない
    expect(seen.has('0,0')).toBe(false);  // 真ん中にも戻らない
  });

  it('同じ入力なら毎回同じ結果（描き直しでピンが飛び回らない）', () => {
    const recs = [
      { key: 'z', lat: 3.16, lng: 101.65, layer: 'dining' },
      { key: 'a', lat: 3.16, lng: 101.65, layer: 'dining' },
      { key: 'm', lat: 3.16, lng: 101.65, layer: 'dining' },
    ];
    const j = m => JSON.stringify([...m].sort());
    expect(j(spotOffsets(recs))).toBe(j(spotOffsets([...recs].reverse())));
  });

  it('緯度経度が無いレコードは黙って飛ばす（落ちない）', () => {
    expect(() => spotOffsets([{ key: 'A', lat: null, lng: null, layer: 'condo' }, null])).not.toThrow();
  });
});

describe('同じ地点の散らし — ソースに刻んだ契約', () => {
  it('動かすのは表示だけ（L.marker には元の lat/lng を渡す）', () => {
    expect(src).toContain('L.marker([c.lat,c.lng]');
    expect(src).not.toMatch(/L\.marker\(\[c\.lat\s*\+/);
  });

  it('4層すべてのピンにずらしが効く', () => {
    // 学校・商業・物件は style の先頭、飲食は spot 変数経由
    expect(src.match(/\$\{spotStyle\(c\)\}/g).length).toBe(3);
    expect(src).toContain('const spot = spotStyle(c);');
    expect(src).toContain('style="${spot}position:relative;');
  });

  it('モールのずらしとは二重に掛からない（どちらか一方）', () => {
    expect(src).toContain("const shift = spot ? '' : (nearAnyMall(");
  });

  it('どの縮尺でも効く（MALL_SHIFT と違い、打ち消すclassを持たない）', () => {
    // 散らしは inline style。MALL_APART_CLASS のような無効化の口を作らない
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    expect(html).not.toContain('mk-spot-shift');
  });

  it('いま描くものだけで判定する（見えないピンを避けて動かさない）', () => {
    expect(src).toContain('spotShift = spotOffsets(drawn.map(');
  });
});

describe('実データ — 層をまたいで完全に重なる組', () => {
  it('見つかった組はすべて散らされる（1件も取りこぼさない）', () => {
    const condos = readFileSync(new URL('../condos_data.csv', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const rows = condos.trim().split('\n').slice(1);
    const head = condos.trim().split('\n')[0].split(',');
    const iLat = head.indexOf('lat'), iLng = head.indexOf('lng'), iName = head.indexOf('name');
    const recs = rows.map(r => r.split(',')).filter(f => f[iLat] && f[iLng])
      .map(f => ({ key: f[iName], lat: +f[iLat], lng: +f[iLng], layer: 'condo' }));
    for(const r of restaurants){
      if(r.lat == null || r.lng == null) continue;
      recs.push({ key: r.name, lat: +r.lat, lng: +r.lng, layer: 'dining' });
    }
    // 3m以内の層をまたぐ組を素朴に数える
    let pairs = 0;
    for(let i = 0; i < recs.length; i++)
      for(let j = i + 1; j < recs.length; j++)
        if(recs[i].layer !== recs[j].layer &&
           haversineKm(recs[i].lat, recs[i].lng, recs[j].lat, recs[j].lng) <= 0.003) pairs++;
    const out = spotOffsets(recs);
    expect(pairs).toBeGreaterThan(0);           // 実データに本当にある問題
    expect(out.size).toBeGreaterThanOrEqual(pairs);
  });
});
