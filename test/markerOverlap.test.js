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
} from '../src/ui/map.js';
import { haversineKm } from '../src/domain/geo.js';

const src = readFileSync(new URL('../src/ui/map.js', import.meta.url), 'utf8');
const restaurants = JSON.parse(readFileSync(new URL('../restaurants.json', import.meta.url), 'utf8'));

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
    const css = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
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
