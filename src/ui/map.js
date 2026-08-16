// Leaflet map: creation, markers, the map legend and area quick-jump.
import {
  CONDOS, filtered, markers, setMarkers, legendOpen, setLegendOpen,
  selectedCondo, activeLayer, appMode, setDiningNear, visibleLayers,
} from '../state.js';
import { NEAR_KM, recordLayer } from '../domain/filter.js';
import { haversineKm } from '../domain/geo.js';
import { YEAR_MIN, YEAR_MAX, YEAR_COLORS, TIER_COLORS, MICHELIN_BADGES } from '../data/inline.js';
import { selectCondo, closeInfo } from './info.js';
// Deferred-usage only (called inside functions): safe across the list.js<->map.js cycle.
import { cardHeroText, ratingText, num } from './list.js';
import { isVisited, getEntry } from '../data/personal.js';

// ============================================================
// ZOOM THRESHOLDS (tune here)
// Below CLUSTER_OFF_ZOOM markers are grouped into per-type clusters; at or
// above it markers stand alone except when they genuinely overlap (the
// cluster radius drops to 18px instead of switching off — see
// makeClusterGroups). LABEL_ZOOM does the same for the name labels:
// hover-only when zoomed out, always-on when zoomed in.
// ============================================================
export const CLUSTER_OFF_ZOOM = 16;
export const LABEL_ZOOM = 17;

/**
 * Pure helper: the tooltip mode that applies at a given zoom level.
 * 'permanent' = label always shown, 'hover' = label only on mouseover.
 */
export function labelModeForZoom(zoom) {
  return zoom >= LABEL_ZOOM ? 'permanent' : 'hover';
}

// ============================================================
// WHAT SELECTING A RECORD DOES TO THE MAP (2026-08-08 再改定・竹森氏の条件値)
// ルールは1本だけ: 選択 = その店を中心に、常に FOCUS_ZOOM で表示する。
//   ・必ず中心に来る(以前の panInside は「中心に来ないことがある」)
//   ・縮尺は毎回同じ(選択のたびに13や17がバラバラに混ざらない)
//   ・FOCUS_ZOOM = CLUSTER_OFF_ZOOM(16): クラスタの数字玉が解けて全店が
//     個別ピンになる、いちばん引いた縮尺。これより寄る(17)と周りが見えず、
//     引く(15)と選んだ店の周りが「13」「2」の玉に化ける。
// 選ばれたピン自身は常にクラスタ外+拡大+波紋(mk-pin-sel)で指させる。
// ============================================================
export const FOCUS_ZOOM = CLUSTER_OFF_ZOOM;

/** Pure helper: 選択が地図に指示する内容。常に「中心へ・FOCUS_ZOOMで」。 */
export function focusActionForZoom() {
  return { action: 'setView', zoom: FOCUS_ZOOM };
}

/** その店を中心に、決められた縮尺で見せる。 */
export function focusOnRecord(lat, lng) {
  if (!map) return;
  map.setView([lat, lng], FOCUS_ZOOM);
}

// Live binding: other modules import `map` and always see the current value.
export let map = null;

// Marker cluster groups, one per marker type. Created lazily in initMap()
// because Leaflet.markercluster is a browser-only CDN script.
let clusterGroups = null;
// The label mode currently bound to the markers; tooltips are only re-bound
// when a zoom change crosses the threshold, never on every zoom step.
let labelMode = null;

/**
 * Escape for an HTML attribute — the shared esc() under its map-side name.
 * A name like 「Pavilion Hilltop ("The Peak")」 must not break out of
 * aria-label. (Was a byte-identical local copy until src/format.js existed;
 * the alias is kept because divIcon markup reads as attribute-escaping.)
 */
export { esc as attrEsc } from '../format.js';
import { esc as attrEsc } from '../format.js';

// B3b (spec 2.9): the type colours live here, once. Markers, cluster bubbles
// and the legend all read them, so school navy / commercial orange can never
// drift apart again. They mirror --type-school / --type-commercial /
// --type-dining in the CSS; Leaflet builds icon HTML outside the document's
// cascade, so the values have to be literals here rather than var()
// references. Change one and change the token next to it.
export const MARKER_COLORS = {
  condo:      { bg:'#78909c', border:'#546e7a', radius:'50%' },
  commercial: { bg:'#e8710a', border:'#b85806', radius:'4px' },
  school:     { bg:'#1a3d7c', border:'#112a58', radius:'50%' },
  dining:     { bg:'#c2185b', border:'#8c1145', radius:'50% 50% 50% 0' },
};

// ミシュランのピンは「縁の色だけ」では見分けられなかった(2026-08-09 竹森さん
// 指摘)ので、ボディ色+グリフ+サイズの3信号で分離する:
//   星付き(1★/2★) = 金色ボディ + 黒★ + ひと回り大きい
//   ビブグルマン   = 琥珀色ボディ + 🍽 + ひと回り大きい
//   掲載店(sel)    = 淡い金ボディ + Ⓜ + ひと回り大きい (2026-08-15 竹森さん裁定A案)
//   通常           = 従来の暗赤ボディ + 🍽
// 琥珀は商業の明橙(#e8710a)より暗くし、四角い商業マーカーと混ざらない。
// 掲載店の淡金は琥珀・金より明るい側に置き、色が近いぶんグリフ(Ⓜ)で二重に
// 名乗る — 星なしの掲載が68店と最も多く、ここが読めないと「ミシュラン=星」の
// 誤解が残る(2026-08-15 竹森さん指摘)。
export const MICHELIN_STAR_BG = '#d4a51f';
export const MICHELIN_STAR_BORDER = '#7a5a10';
export const MICHELIN_BIB_BG = '#b45309';
export const MICHELIN_BIB_BORDER = '#6f3305';
export const MICHELIN_SEL_BG = '#ecd48a';
export const MICHELIN_SEL_BORDER = '#a17f24';

// ============================================================
// 商業施設と飲食店の重なり(2026-08-16 竹森氏指摘)
//
// モールの中や真上にある店は座標がほぼ同じなので、飲食のピンが商業の四角を
// 覆って「モールが消える」ことが起きていた(実測: 80m以内に飲食がある商業施設が
// 8件・Pavilion KLは6店)。裁定は「商業を優先に見せ、飲食はその横にずらす」。
//
// 手当ては3つ。
//   1. 商業マーカーに zIndexOffset を与え、常に飲食の上に描く
//   2. モールの近くにある飲食ピンは、アイコンだけ右へずらす(座標は動かさない
//      ので、選択したときは正しい位置に寄る)
//   3. まとまった数字玉も、中心がモールの近くなら同じだけ右へずらす
// ずらすのは表示だけで、データ側の緯度経度には一切触れない。
// ============================================================
/**
 * 重なりは「画面上の現象」なので、判定の半径は縮尺から出す。
 * 引いた地図では1pxが何十mにもなるため、固定の半径だと取りこぼす
 * (ズーム13では1px≒19m＝30px離れた玉は実距離570m先でも重なって見える)。
 *
 * @param {number} zoom @param {number} lat @param {number} iconPx 相手側の大きさ
 * @returns {number} この距離より近ければ画面上で重なる(m)
 */
export function overlapRadiusM(zoom, lat, iconPx){
  const mPerPx = 156543.03392 * Math.cos((lat || 0) * Math.PI / 180) / Math.pow(2, zoom);
  // モールの四角(最大30px)の半分 + 相手のアイコンの半分
  return (15 + iconPx / 2) * mPerPx;
}

/** 個別ピン用の既定半径(m)。ピンが1つずつ出るのはズーム16以上＝1px≒2.4m。 */
export const MALL_OVERLAP_M = 60;
/**
 * ずらす量(px)。四角(最大30px)の右端の外へ、数字玉(32px)の左端が出る幅。
 * 15(四角の半分) + 16(玉の半分) + 1(隙間) = 32。
 */
export const MALL_SHIFT_PX = 32;
/** 商業を常に上に描くための持ち上げ量。 */
export const COMMERCIAL_Z = 1000;
/**
 * これより寄ったら、ずらしをやめて本当の位置に戻す縮尺。
 * ズーム17では1pxがおよそ1.2mなので、60m離れた店は50px離れて描かれる＝もう
 * 重ならない。重なっていないのにずらすと、今度はそれが嘘になる。
 * LABEL_ZOOM と同じ値にしてあるのは偶然ではない: 名前ラベルは本当の座標に付く
 * ので、ラベルが常時出る縮尺でずらしていると、名前とピンが離れて見える。
 */
export const MALL_SHIFT_MAX_ZOOM = LABEL_ZOOM;
/** ずらす対象につけるclass。実際に動かすかはCSS(地図側のclass)が決める。 */
export const MALL_SHIFT_CLASS = 'mk-mall-shift';
/** この縮尺以上のときに地図コンテナへ付くclass。ずらしを打ち消す。 */
export const MALL_APART_CLASS = 'mk-mall-apart';

/** その縮尺では、もうずらす必要がないか。 */
export function mallShiftOff(zoom){ return zoom >= MALL_SHIFT_MAX_ZOOM; }

/**
 * ずらしの入り切りを地図コンテナのclassで切り替える。
 * マーカーを作り直さずに済むので、ズームのたびに数百個を作り直さない。
 */
function syncMallShift(){
  if(!map) return;
  const el = map.getContainer && map.getContainer();
  if(el) el.classList.toggle(MALL_APART_CLASS, mallShiftOff(map.getZoom()));
}

/**
 * その地点が、いま地図に出ている商業施設の近くにあるか。
 * @param {number} lat @param {number} lng
 * @param {{lat:number,lng:number}[]} malls 判定対象の商業施設
 * @param {number} [withinM]
 */
export function nearAnyMall(lat, lng, malls, withinM = MALL_OVERLAP_M){
  if(lat == null || lng == null || !malls || !malls.length) return false;
  const km = withinM / 1000;
  return malls.some(m => haversineKm(lat, lng, m.lat, m.lng) <= km);
}

// rebuild() が毎回作り直す「いま描く商業施設」の一覧。飲食ピンとクラスタ玉の
// 両方が読むので、モジュールの持ち物にしている(描画のたびに引き回さない)。
let mallPoints = [];

// Cluster bubbles reuse the marker colours so the type stays readable when
// several markers collapse into one.
const CLUSTER_STYLE = {
  condo:      { bg:MARKER_COLORS.condo.bg, radius:'50%' },
  commercial: { bg:MARKER_COLORS.commercial.bg, radius:'8px' },
  school:     { bg:MARKER_COLORS.school.bg, radius:'50%' },
  dining:     { bg:MARKER_COLORS.dining.bg, radius:'50%' },
};

/** What a cluster bubble is a cluster OF — read out instead of a bare number. */
const CLUSTER_LABELS = { condo: '物件', commercial: '商業施設', school: '学校', dining: '飲食店' };

function clusterIconFactory(type) {
  const st = CLUSTER_STYLE[type];
  return (cluster) => {
    const n = cluster.getChildCount();
    // Checked layers are all first-class (visibility is opt-in via the layer
    // check-boxes), so the old 主役/背景 ghosting went away with the forced
    // display it was softening.
    const sz = n >= 25 ? 46 : n >= 10 ? 38 : 32;
    const fs = n >= 25 ? 15 : n >= 10 ? 13 : 12;
    const mute = '';
    // 飲食の数字玉がモールの真上に来ると四角を隠すので、その分だけ右へずらす
    // (2026-08-16)。玉の位置(緯度経度)は動かさないので、押したときの挙動は同じ。
    // 数字玉はズームのたびに作り直されるので、そのときの縮尺で判定できる。
    const ll = cluster.getLatLng && cluster.getLatLng();
    const zoom = map ? map.getZoom() : CLUSTER_OFF_ZOOM;
    const shift = (type === 'dining' && ll
      && nearAnyMall(ll.lat, ll.lng, mallPoints, overlapRadiusM(zoom, ll.lat, sz)))
      ? ` ${MALL_SHIFT_CLASS}` : '';
    return L.divIcon({
      className: '',
      iconSize: [sz, sz],
      iconAnchor: [sz/2, sz/2],
      html: `<div role="button" class="mk-cluster${shift}" aria-label="${CLUSTER_LABELS[type]} ${n}件。押すと開きます" style="${mute}width:${sz}px;height:${sz}px;border-radius:${st.radius};background:${st.bg};border:2px solid rgba(255,255,255,0.9);box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;cursor:pointer">
        <span aria-hidden="true" style="color:#fff;font-size:${fs}px;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,0.35)">${n}</span>
      </div>`
    });
  };
}

function makeClusterGroups() {
  // Clustering never fully switches off. Above CLUSTER_OFF_ZOOM the radius
  // drops to 18px, so markers stand alone unless they genuinely overlap —
  // two towers of one development, two restaurants in one building. Those
  // used to stack unclickably (only the top one could ever be selected).
  //
  // Click handling is explicit because the library's default would not do
  // what the bubble promises: spiderfyOnMaxZoom fires only at the map's
  // maxZoom (19), so a same-point pair took FOUR clicks of zooming before it
  // fanned open. Instead: at detail zoom every bubble is an overlap bubble —
  // spiderfy it on the spot (one click); zoomed out, clicking a cluster
  // still dives into it like before.
  const mk = (type) => {
    const g = L.markerClusterGroup({
      maxClusterRadius: (zoom) => zoom >= CLUSTER_OFF_ZOOM ? 18 : 45,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: false,
      showCoverageOnHover: false,
      iconCreateFunction: clusterIconFactory(type),
    });
    g.on('clusterclick', (e) => {
      if (map.getZoom() >= CLUSTER_OFF_ZOOM) e.layer.spiderfy();
      else e.layer.zoomToBounds();
    });
    return g;
  };
  return { condo: mk('condo'), commercial: mk('commercial'), school: mk('school'), dining: mk('dining') };
}

/** Create the Leaflet map and inject the marker-tooltip style. */
export function initMap() {
  // First screen = a readable neighbourhood, not 30 anonymous cluster bubbles:
  // every ruled use case (housing hunt, guest guide, family ledger) orbits
  // Mont Kiara, so that is where the map wakes up. KL全体/Penang are one tap.
  map = L.map('map',{zoomControl:false}).setView([3.1710,101.6520],15);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{
    attribution:'&copy; OpenStreetMap &copy; CARTO',maxZoom:19
  }).addTo(map);

  clusterGroups = makeClusterGroups();
  Object.values(clusterGroups).forEach(g=>map.addLayer(g));
  labelMode = labelModeForZoom(map.getZoom());

  // Tapping empty map dismisses the detail card — the standard non-modal
  // popover behaviour (marker clicks stopPropagation inside Leaflet, so this
  // only fires on genuinely empty map).
  map.on('click', () => closeInfo());

  // Re-bind the labels only when the zoom crosses the threshold.
  map.on('zoomend', () => {
    syncMallShift();
    const mode = labelModeForZoom(map.getZoom());
    if (mode === labelMode) return;
    labelMode = mode;
    applyLabelMode(mode);
  });
  syncMallShift();

  // Add tooltip style dynamically
  const tipStyle = document.createElement('style');
  tipStyle.textContent = `.condo-label-tip{background:transparent!important;border:none!important;box-shadow:none!important;color:#37474f;font-size:var(--fs-label);font-weight:500;padding:0 1px!important;text-shadow:1px 1px 1px #fff,-1px -1px 1px #fff,1px -1px 1px #fff,-1px 1px 1px #fff,0 0 3px #fff}`;
  document.head.appendChild(tipStyle);
}

function getYearColor(year) {
  const t = Math.max(0, Math.min(1, (year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)));
  const idx = t * (YEAR_COLORS.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx), f = idx - lo;
  const a = hexRgb(YEAR_COLORS[lo]), b = hexRgb(YEAR_COLORS[hi]);
  return `rgb(${Math.round(a.r+(b.r-a.r)*f)},${Math.round(a.g+(b.g-a.g)*f)},${Math.round(a.b+(b.b-a.b)*f)})`;
}
function hexRgb(h){return{r:parseInt(h.slice(1,3),16),g:parseInt(h.slice(3,5),16),b:parseInt(h.slice(5,7),16)}}

// ============================================================
// AREA JUMP — quick navigation between KL/Penang neighborhoods
// ============================================================
// Exported so test/map.test.js can check that every jump button, every
// dropdown option and every center share one set of area keys.
export const AREA_CENTERS = {
  'mont-kiara':{lat:3.17150,lng:101.65200,zoom:15},
  'parkcity':  {lat:3.18500,lng:101.62850,zoom:15},
  'klcc':      {lat:3.15700,lng:101.71150,zoom:15},
  'bangsar':   {lat:3.12810,lng:101.67900,zoom:14},
  'damansara': {lat:3.14850,lng:101.66550,zoom:14},
  'klgcc':     {lat:3.16650,lng:101.63850,zoom:15},
  'ampang':    {lat:3.15450,lng:101.73950,zoom:14},
  'all-kl':    {lat:3.15500,lng:101.68500,zoom:11},
  'gurney':    {lat:5.43500,lng:100.31000,zoom:15},
  'tanjung':   {lat:5.46400,lng:100.28200,zoom:14},
  'ferringhi': {lat:5.47300,lng:100.25350,zoom:14},
  'bayan':     {lat:5.32900,lng:100.27900,zoom:12},
  // Centred on the condo centroid of each area; the zoom matches areas of a
  // similar span (George Town ~2km across like Tanjung, the Gelugor/Jelutong
  // corridor ~5km like Bayan).
  'george-town':{lat:5.42150,lng:100.32300,zoom:14},
  'gelugor':   {lat:5.38760,lng:100.31300,zoom:13},
  'all-pg':    {lat:5.40000,lng:100.28000,zoom:11}
};
/**
 * 🏝️ Penang ▸ — the Penang areas stay folded until asked for (2026-08-07
 * ruling: Penang is rarely used, so its seven buttons should not spend the
 * bar's width by default). Open/close only; jumping stays on the buttons.
 */
export function togglePenangAreas(){
  const wrap = document.getElementById('penangAreas');
  const btn = document.getElementById('penangToggle');
  if(!wrap || !btn) return;
  const open = wrap.classList.toggle('open');
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  btn.setAttribute('title', open ? 'ペナンのエリアを閉じる' : 'ペナンのエリアを開く');
  btn.textContent = open ? '🏝️ Penang ▾' : '🏝️ Penang ▸';
}

/** 全体 keys (KL全体 / PG全体) mean "stop narrowing", not "an area called 全体". */
const isWholeRegion = (key) => key.startsWith('all-');

export function jumpToArea(key){
  const a=AREA_CENTERS[key];if(!a)return;
  map.flyTo([a.lat,a.lng],a.zoom,{duration:0.8});
  document.querySelectorAll('.area-jump button').forEach(b=>b.classList.remove('active'));
  const btn=document.querySelector(`.area-jump button[data-area="${key}"]`);
  if(btn)btn.classList.add('active');
  // The jump also FILTERS the list (audit: the map flying to Bangsar while
  // the list still said 271件 meant the two halves answered different
  // questions). window.applyFilters avoids a circular import — main.js
  // exposes it for the inline handlers anyway.
  if(typeof window.applyFilters !== 'function') return;
  if(activeLayer === 'dining'){
    // 飲食 cannot use fArea: the condo area keys end in a Mont Kiara catch-all
    // that would misfile every city-centre restaurant, and the ledger's own
    // area labels (24 values) do not line up with the jump keys at all. So the
    // dining half of the jump narrows by DISTANCE from the centre it just flew
    // to — the same place the map is now showing. Before UX2 this branch did
    // nothing, and 「MK の近くの店」 could not be asked for in one tap.
    setDiningNear(isWholeRegion(key)
      ? null
      : { lat: a.lat, lng: a.lng, km: NEAR_KM, label: (btn && btn.textContent.trim()) || key });
    window.applyFilters();
    return;
  }
  // The jump keys and the fArea option values are 1:1 (test/map.test.js
  // guards it) except the parkcity spelling.
  const fArea = document.getElementById('fArea');
  if(fArea){
    fArea.value = isWholeRegion(key) ? '' : (key === 'parkcity' ? 'desa-parkcity' : key);
    window.applyFilters();
  }
}

// ============================================================
// LABELS & HOVER CARD — zoom-dependent tooltips
// Always-on mode (zoom >= LABEL_ZOOM, and the selected marker at any zoom)
// shows the short NAME beside the pin. Hover mode shows a compact PREVIEW
// CARD instead — pointing at a pin answers "what is this?" without a click,
// and moving off it clears the answer (PC-first ruling, 2026-08-07). The
// card reuses the list's own text builders, so the map can never quote a
// different number than the card list does.
// ============================================================
const labelOpts = (permanent, offsetX) => permanent
  ? { permanent: true, direction: 'right', offset: [offsetX, 0], className: 'condo-label-tip' }
  : { permanent: false, direction: 'top', offset: [0, -12], className: 'map-hover-card', opacity: 1 };

/** The hover preview: name, the record's one deciding line, a short sub. */
function hoverCardHtml(c){
  const e = attrEsc;
  const t = recordLayer(c);
  const rows = [`<div class="mhc-name">${e(c.name)}</div>`];
  if (c.nameJa) rows.push(`<div class="mhc-ja">${e(c.nameJa)}</div>`);
  const hero = cardHeroText(c);
  if (hero) rows.push(`<div class="mhc-hero">${e(hero)}</div>`);
  let sub = '';
  if (t === 'condo') sub = [c.luxTier ? `Tier ${c.luxTier}` : null, c.year ? `${c.year}年` : null, c.units > 0 ? `${num(c.units)}戸` : null].filter(Boolean).join(' ・ ');
  else if (t === 'school') sub = [c.curriculum, c.ageRange ? `${c.ageRange}歳` : null].filter(Boolean).join(' ・ ');
  else if (t === 'commercial') sub = [c.year ? `${c.year}年開業` : null, c.anchorTenants ? String(c.anchorTenants).split(';')[0].trim() : null].filter(Boolean).join(' ・ ');
  else if (t === 'dining') sub = [c.catGroup, MICHELIN_BADGES[c.michelin] || null, ratingText(c)].filter(Boolean).join(' ・ ');
  if (sub) rows.push(`<div class="mhc-sub">${e(sub)}</div>`);
  return `<div class="mhc">${rows.join('')}</div>`;
}

function bindLabel(m, name, text, offsetX) {
  m._labelName = name;
  m._labelText = text;
  m._labelOffsetX = offsetX;
  m._hoverHtml = null; // built lazily on first hover-mode bind
  // Dimmed context markers never carry an always-on label (spec 2.2), but
  // they DO answer to a hover — context you can point at is context you can
  const permanent = (labelMode || 'permanent') === 'permanent' || name === selectedCondo;
  m.bindTooltip(permanent ? text : (m._hoverHtml = m._hoverHtml || hoverCardHtml(m._rec)), labelOpts(permanent, offsetX));
  return m;
}

/** Re-bind every marker's tooltip for the given mode ('permanent' | 'hover'). */
function applyLabelMode(mode) {
  Object.values(markers).forEach(m => {
    const permanent = mode === 'permanent' || m._labelName === selectedCondo;
    const tip = m.getTooltip();
    if (tip && !!tip.options.permanent === permanent) return;
    m.unbindTooltip();
    m.bindTooltip(
      permanent ? m._labelText : (m._hoverHtml = m._hoverHtml || hoverCardHtml(m._rec)),
      labelOpts(permanent, m._labelOffsetX));
  });
}

// ============================================================
// SELECTED MARKER (spec 2.7 / audit D3)
// The selected pin gets an accent ring and grows slightly. It is done with a
// class on the divIcon rather than inline style because Leaflet owns the icon
// element's own `transform` (that is how it positions markers): the ring and
// the scale are applied to the pin INSIDE it, via `.mk-pin-sel > div` in the
// stylesheet. See index.html.
// ============================================================
/** Pure: the divIcon className for a pin, given whether it is the selected one. */
export function pinClassName(isSelected) {
  return isSelected ? 'mk-pin mk-pin-sel' : 'mk-pin';
}
// Selection is a CLASS on the icon so the CSS ring can follow it.
const pinClass = (c) => pinClassName(c.name === selectedCondo);

// ============================================================
// 同一住所ピンの選び直し(2026-08-09 竹森さん裁定)
// 選択ピンはクラスタ外の最前面に出るため、同座標のもう1店が下に隠れて
// 押せなくなる。選択中ピンの再クリックで同地点の店リストを分岐表示し、
// どの店にも1タップで乗り換えられるようにする。
// ============================================================
const CO_LOCATED_M = 30;   // この距離(m)以内は「同じ場所」— 同番地・同ビル想定

/** Pure-ish: いま地図に描かれている中で、cと同地点にいるレコード(自身含む)。 */
function coLocatedWith(c){
  const R = 6371e3, rad = x => x * Math.PI / 180;
  const near = (a, b) => {
    const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
      Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h)) <= CO_LOCATED_M;
  };
  return Object.values(markers).map(m => m._rec).filter(r => near(c, r));
}

/** 分岐ポップアップ: 同地点の店を並べ、押した店へ選択を乗り換える。 */
function openCoLocatedChooser(c){
  const sibs = coLocatedWith(c);
  if(sibs.length < 2) return;
  const box = document.createElement('div');
  box.className = 'colo-list';
  for(const r of sibs){
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'colo-item' + (r.name === selectedCondo ? ' on' : '');
    b.textContent = r.name + (r.cat ? `（${r.cat}）` : '');
    b.addEventListener('click', () => { map.closePopup(); selectCondo(r.name); });
    box.appendChild(b);
  }
  L.popup({ closeButton: true, offset: [0, -14] })
    .setLatLng([c.lat, c.lng]).setContent(box).openOn(map);
}

/** The tail every marker branch shares: build the Leaflet marker, wire the
 *  click, bind the name label. shortName is what the label prints. */
function attachMarker(c, icon, shortName, size){
  // 商業施設は常に飲食の上に描く(2026-08-16 竹森氏指示「商業施設を優先に見せる」)。
  // モール内の店と座標がほぼ同じになるため、放っておくと四角が雫に隠れていた。
  const zIndexOffset = recordLayer(c) === 'commercial' ? COMMERCIAL_Z : 0;
  const m = L.marker([c.lat,c.lng],{icon,keyboard:false,zIndexOffset});
  m._rec = c;
  m.on('click',()=>{
    // 選択中のピンをもう一度押したら、同地点の店を分岐表示して選び直せる
    if(c.name === selectedCondo){ openCoLocatedChooser(c); return; }
    selectCondo(c.name);
  });
  return bindLabel(m, c.name, shortName, size/2+2);
}

// Custom DivIcon with tier label inside circle
function mkMarker(c) {
  const yearColor = getYearColor(c.year);
  const tierColor = TIER_COLORS[c.luxTier];
  // Circle size based on units (min 26, max 42)
  const sz = Math.max(26, Math.min(42, 14 + Math.sqrt(c.units) * 1.0));
  const yr2 = String(c.year).slice(-2);
  const isUpcoming = c.status === 'upcoming';
  const isCommercial = c.status === 'commercial';

  const isSchool = c.status === 'school';

  if (isSchool) {
    const csz = 20;
    const icon = L.divIcon({
      className: pinClass(c),
      iconSize: [csz, csz],
      iconAnchor: [csz/2, csz/2],
      html: `<div role="button" aria-label="学校 ${attrEsc(c.name)}" style="width:${csz}px;height:${csz}px;border-radius:50%;background:${MARKER_COLORS.school.bg};border:2px solid ${MARKER_COLORS.school.border};display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,0.3);cursor:pointer">
        <span aria-hidden="true" style="color:#fff;font-size:10px">🎓</span>
      </div>`
    });
    return attachMarker(c, icon, c.name.replace(/International School/g,'IS').replace(/International/g,'Intl'), csz);
  }

  if (c.status === 'dining') {
    // B2 shape language: 物件=circle, 学校=circle+cap, 商業=rounded square,
    // 飲食=map pin. The teardrop is drawn on an INNER element so the outer div
    // — the one `.mk-pin-sel>div` scales when the record is selected — keeps a
    // transform of its own. Sharing one element would make the selection ring
    // silently un-rotate the pin.
    const mb = MICHELIN_BADGES[c.michelin];
    const isStar = c.michelin === '1star' || c.michelin === '2star';
    const isBib = c.michelin === 'bib';
    const isSel = c.michelin === 'sel';
    // ミシュランはボディ色ごと変える+ひと回り大きく(縁だけでは見分け不能だった)
    const csz = (isStar || isBib || isSel) ? 25 : 22;
    const bg = isStar ? MICHELIN_STAR_BG
      : isBib ? MICHELIN_BIB_BG : isSel ? MICHELIN_SEL_BG : MARKER_COLORS.dining.bg;
    const border = isStar ? MICHELIN_STAR_BORDER
      : isBib ? MICHELIN_BIB_BORDER : isSel ? MICHELIN_SEL_BORDER : MARKER_COLORS.dining.border;
    // 星の数をそのまま描く(2026-08-09 竹森さん指示: 2つ星・3つ星は★を増やす)。
    // KLは現在2★が最高だが、'3star'が来ても自動で3つ並ぶ。
    const starCount = c.michelin === '1star' ? 1 : c.michelin === '2star' ? 2 : c.michelin === '3star' ? 3 : 0;
    const glyph = c.catGroup === '屋台街' ? '📍'
      : isStar ? '★'.repeat(starCount) : isSel ? 'Ⓜ' : '🍽';
    const starFs = starCount >= 3 ? 7.5 : starCount === 2 ? 9.5 : 13;
    const glyphStyle = isStar
      ? `color:#3d2b00;font-size:${starFs}px;font-weight:700;letter-spacing:-1px;white-space:nowrap;text-shadow:0 1px 1px rgba(255,255,255,0.4)`
      // 淡金の上の白抜きは読めないので、掲載店のグリフだけ濃い文字色にする
      : isSel ? 'color:#3d2b00;font-size:12px;font-weight:700'
      : 'color:#fff;font-size:10px';
    // 訪問済みの店はピン自体に緑の✓バッジ（2026-08-07 依頼: 地図を見るだけで
    // 「もう行った」が分かるように）。行きたい店には反対側(左上)に同じ緑の
    // ♡バッジ（2026-08-16 依頼: 「行きたいが、まだ」も地図だけで分かる
    // ように。同じ店が両方立っても重ならない位置分け）。記録が変わると
    // applyFilters→rebuild が走るので、押した瞬間にバッジも追随する。色は
    // 再訪意向「また行く」と同じ緑 (--rv-again) のリテラルを✓・♡で共有する
    // （新色を増やさない契約 — test/visualSystem.test.js の色一覧固定）。
    // 外食モード限定: 住まいモードは個人記録を一切出さない契約（CLAUDE.md）
    // なので、住まい側で飲食レイヤーを重ねてもバッジは描かない。
    // 「行きたい」もisVisitedと同じ読み取り経路(personal.jsのgetEntry)・
    // 同じモードガードで揃える。personal.jsにisWant相当が無いためgetEntryを
    // 直接読む(mapは personal.js を編集できない — 用意されている読み取り
    // 関数を使う契約)。
    const visited = appMode === 'eatout' && isVisited(c);
    const want = appMode === 'eatout' && getEntry(c.id).w === 1;
    const badgeStyle = (side) => `position:absolute;top:-5px;${side}:-5px;width:13px;height:13px;border-radius:50%;background:#1d5f55;border:1.5px solid #fff;color:#fff;font-size:9px;font-weight:700;line-height:1;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,0.35)`;
    const badge = (visited ? `<span aria-hidden="true" style="${badgeStyle('right')}">✓</span>` : '')
      + (want ? `<span aria-hidden="true" style="${badgeStyle('left')}">♡</span>` : '');
    // モールの上に乗る店は、四角を覆わないようアイコンだけ右へずらす(2026-08-16)。
    // 座標は動かさないので、選ぶと従来どおり本当の位置が中心に来る。
    // 個別のピンが1つずつ出るのはズーム16以上。そこでの重なり幅で判定する。
    const shift = nearAnyMall(c.lat, c.lng, mallPoints,
      overlapRadiusM(map ? Math.max(map.getZoom(), CLUSTER_OFF_ZOOM) : CLUSTER_OFF_ZOOM, c.lat, csz))
      ? ` ${MALL_SHIFT_CLASS}` : '';
    const icon = L.divIcon({
      className: pinClass(c),
      iconSize: [csz, csz],
      iconAnchor: [csz/2, csz/2],
      html: `<div role="button" class="mk-dining-pin${shift}" aria-label="飲食店 ${attrEsc(c.name)}${mb ? '、' + mb : ''}${visited ? '、訪問済み' : ''}${want ? '、行きたい' : ''}" style="position:relative;width:${csz}px;height:${csz}px;display:flex;align-items:center;justify-content:center;cursor:pointer">
        <span aria-hidden="true" style="position:absolute;inset:0;border-radius:${MARKER_COLORS.dining.radius};background:${bg};border:2px solid ${border};box-shadow:0 2px 6px rgba(0,0,0,0.3);transform:rotate(-45deg)"></span>
        <span aria-hidden="true" style="position:relative;line-height:1;${glyphStyle}">${glyph}</span>${badge}
      </div>`
    });
    return attachMarker(c, icon, c.name.replace(/ \(.*\)/,''), csz);
  }

  if (isCommercial) {
    // Size based on NLA: large(>200K)=22, medium(50K-200K)=18, small(<50K)=14.
    // One step smaller than it used to be (28/22/16): a mall is context, not
    // the protagonist, and the saturated orange square already carries far
    // more visual weight per pixel than the muted condo circles.
    const nla = c.sizeMin || 0;
    // サイズ感はNLA(面積)で、中の数字はテナント数の目安(2026-08-09 竹森さん指示:
    // 123店なら「100」・350店なら「300」= 百の位への切り捨て。パッと見で規模が
    // 分かるように🛒グリフを数字に置換)。数字が読めるようひと回り拡大。
    const csz = nla >= 1000000 ? 30 : nla >= 400000 ? 26 : 22;
    const tenants = c.units || 0;
    // 100未満(MK付近の50店基準モール)は切り捨てると「0」になるので実数のまま。
    const rounded = tenants >= 100 ? Math.floor(tenants / 100) * 100 : tenants;
    const glyph = tenants > 0 ? String(rounded) : '🛒';
    const fsz = glyph.length >= 4 ? 9 : 10;
    const icon = L.divIcon({
      className: pinClass(c),
      iconSize: [csz, csz],
      iconAnchor: [csz/2, csz/2],
      html: `<div role="button" aria-label="商業施設 ${attrEsc(c.name)}${tenants ? '、店舗数の目安' + rounded : ''}" style="width:${csz}px;height:${csz}px;border-radius:${MARKER_COLORS.commercial.radius};background:${MARKER_COLORS.commercial.bg};border:2px solid ${MARKER_COLORS.commercial.border};display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer">
        <span aria-hidden="true" style="color:#fff;font-size:${fsz}px;font-weight:700;letter-spacing:-0.5px;text-shadow:0 1px 2px rgba(0,0,0,0.3)">${glyph}</span>
      </div>`
    });
    return attachMarker(c, icon, c.name.replace(/ \(.*\)/,''), csz);
  }

  const borderStyle = isUpcoming ? `3px dashed ${tierColor}` : `3px solid ${tierColor}`;
  const bgColor = isUpcoming ? 'rgba(255,255,255,0.85)' : yearColor;
  const textColor = isUpcoming ? '#333' : '#fff';
  const label1 = isUpcoming ? '🔜' : c.luxTier;
  const label2 = "'" + yr2;
  // The pin shows a tier letter and a two-digit year; spelled out, that is what
  // the label has to say, because "S '08" read literally is noise.
  const a11yLabel = isUpcoming
    ? `${attrEsc(c.name)}、${c.year}年 竣工予定`
    : `${attrEsc(c.name)}、Tier ${attrEsc(c.luxTier)}、${c.year}年`;

  const icon = L.divIcon({
    className: pinClass(c),
    iconSize: [sz, sz],
    iconAnchor: [sz/2, sz/2],
    html: `<div role="button" aria-label="${a11yLabel}" style="width:${sz}px;height:${sz}px;border-radius:50%;background:${bgColor};border:${borderStyle};display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer;line-height:1.1">
      <span aria-hidden="true" style="color:${textColor};font-size:${sz>34?11:9}px;font-weight:800;text-shadow:${isUpcoming?'none':'0 1px 2px rgba(0,0,0,0.5)'}">${label1}</span>
      <span aria-hidden="true" style="color:${isUpcoming?'#666':'rgba(255,255,255,0.85)'};font-size:${sz>34?8:7}px;font-weight:600;text-shadow:${isUpcoming?'none':'0 1px 2px rgba(0,0,0,0.5)'}">${label2}</span>
    </div>`
  });

  return attachMarker(c, icon, c.name.replace(/ Mont Kiara/g,'').replace(/ \(.*\)/,''), sz);
}

/** Every cluster group stays attached; which markers exist inside them is decided in rebuild(). */
function syncGroupVisibility(){
  Object.values(clusterGroups).forEach(g=>{ if(!map.hasLayer(g)) map.addLayer(g); });
}

export function rebuild(){
  // Drop the previous markers: clustered ones via their group, the selected
  // one (kept outside the clusters, see below) directly off the map.
  Object.values(markers).forEach(m=>map.removeLayer(m));
  Object.values(clusterGroups).forEach(g=>g.clearLayers());
  setMarkers({});
  labelMode = labelModeForZoom(map.getZoom());
  // ずらしの基準になる「いま描く商業施設」。外食モードは飲食しか描かないので
  // 空 = ずらしは起きない。商業のチェックを外したときも同じ(2026-08-16)。
  mallPoints = (appMode !== 'eatout' && visibleLayers.commercial)
    ? CONDOS.filter(c => recordLayer(c) === 'commercial' && c.lat != null && c.lng != null)
        .map(c => ({ lat: c.lat, lng: c.lng }))
    : [];
  const ns=new Set(filtered.map(c=>c.name));
  CONDOS.forEach(c=>{
    const type=recordLayer(c);
    // 外食モード draws restaurants only. 住まいモード draws exactly the layers
    // whose checkbox is on (2026-08-07 ruling: the layer tabs became
    // check-boxes — one, two or all four at once). What is checked is shown
    // at full strength: opt-in context does not need ghosting.
    // 閉店・休業の店はピンを出さない(地図は「行く」ための面。台帳一覧には残る)
    if(c.closed || c.delisted) return;
    if(appMode==='eatout'){ if(type!=='dining') return; }
    else if(!visibleLayers[type]) return;
    const isActive=type===activeLayer;
    if(isActive&&!ns.has(c.name))return;
    const m=mkMarker(c);markers[c.name]=m;
    // The selected marker stays unclustered so its always-on label survives
    // at every zoom level.
    if(c.name===selectedCondo)m.addTo(map);
    else clusterGroups[type].addLayer(m);
  });
  syncGroupVisibility();
  updateLegend();
}

export function toggleLegend(e){
  e&&e.stopPropagation();
  setLegendOpen(!legendOpen);
  const body=document.getElementById('legendBody');
  const tog=document.getElementById('legendToggle');
  const box=document.getElementById('mapLegend');
  if(body) body.style.display=legendOpen?'block':'none';
  if(tog) tog.textContent=legendOpen?'▼':'▶';
  // The ▶/▼ glyph and aria-expanded are set together so they cannot disagree.
  if(box) box.setAttribute('aria-expanded', legendOpen?'true':'false');
}
// B3b (audit A3): the year-colour scale used to be drawn twice — as a gradient
// bar inside the panel AND in this legend. The panel bar is gone; this legend
// is now the single place that explains what the marker colours mean.
/**
 * The legend explains ONLY the symbols currently on the map (audit: the old
 * version described the condo year-gradient and tier ring even in 外食モード,
 * where neither exists — a manual for a different map). Everything is in
 * Japanese: this is the app's one instruction sheet and its readers are
 * Japanese families, so English-only labels here defeated its purpose.
 */
export function updateLegend(){
  const ml=document.getElementById('mapLegend');
  if(!ml)return;
  const eatout = appMode === 'eatout';
  let h=`<div class="map-legend-title" style="display:flex;justify-content:space-between;align-items:center">凡例 <span id="legendToggle" aria-hidden="true">${legendOpen?'▼':'▶'}</span></div>`;
  h+=`<div id="legendBody" style="display:${legendOpen?'block':'none'}">`;
  if(eatout){
    h+=`<div class="map-legend-item"><div class="map-legend-dot" style="background:${MARKER_COLORS.dining.bg};border-radius:${MARKER_COLORS.dining.radius};transform:rotate(-45deg)"></div>飲食店</div>`;
    h+=`<div class="map-legend-item"><div class="map-legend-dot" style="background:${MICHELIN_STAR_BG};border-color:${MICHELIN_STAR_BORDER};border-radius:${MARKER_COLORS.dining.radius};transform:rotate(-45deg)"></div>ミシュラン星付き（金色ピン・★の数=星の数）</div>`;
    // 並びは 星付き → 掲載店 → ビブグルマン（2026-08-16 竹森氏指示）。
    // 絞り込みの選択肢(MICHELIN_FILTERS)と同じ順に揃える。
    h+=`<div class="map-legend-item"><div class="map-legend-dot" style="background:${MICHELIN_SEL_BG};border-color:${MICHELIN_SEL_BORDER};border-radius:${MARKER_COLORS.dining.radius};transform:rotate(-45deg)"></div>掲載店（淡い金ピン・Ⓜ／星もビブも無い掲載）</div>`;
    h+=`<div class="map-legend-item"><div class="map-legend-dot" style="background:${MICHELIN_BIB_BG};border-color:${MICHELIN_BIB_BORDER};border-radius:${MARKER_COLORS.dining.radius};transform:rotate(-45deg)"></div>ビブグルマン（琥珀色ピン・お値打ち店）</div>`;
    // ✓訪問済み・♡行きたい バッジ(2026-08-16): 凡例にこれまで無かったので
    // 2行に増やさず1行にまとめる(凡例が長いと地図を潰すため)。
    h+=`<div class="map-legend-item">✓ 訪問済み ／ ♡ 行きたい（ピン右上・左上のバッジ）</div>`;
    h+=`<div class="map-legend-item">数字の丸 = 重なった店。押すと開きます</div>`;
  } else {
    // The condo pin carries year (fill) + tier (letter/ring): explain both
    // only while the condo layer is active — school/commercial mode needs
    // neither.
    if(activeLayer === 'condo'){
      h+=`<div class="map-legend-title" style="margin-top:var(--s2)">塗り = 竣工年（${YEAR_MIN}–${YEAR_MAX}）</div>`;
      [{y:1993,l:'〜1993年'},{y:2001,l:'〜2001年'},{y:2009,l:'〜2009年'},{y:2017,l:'〜2017年'},{y:2025,l:'〜2025年'}].forEach(({y,l})=>{
        h+=`<div class="map-legend-item"><div class="map-legend-dot" style="background:${getYearColor(y)}"></div>${l}</div>`;
      });
      h+=`<div class="map-legend-section"><div class="map-legend-title">文字と枠 = Luxuryティア</div>`;
      [{t:'S',l:'最上位（70点以上）'},{t:'A',l:'60〜69点'},{t:'B',l:'50〜59点'},{t:'C',l:'40〜49点'},{t:'D',l:'40点未満'}].forEach(({t,l})=>{
        h+=`<div class="map-legend-item"><span class="tier-badge" style="background:${TIER_COLORS[t]}">${t}</span>${l}</div>`;
      });
      h+=`<div class="map-legend-item">ピンの「'08」= 竣工年の下2桁 ・ 円の大きさ = 戸数</div>`;
      h+=`</div>`;
    }
    h+=`<div class="map-legend-section"><div class="map-legend-title">種別</div>`;
    h+=`<div class="map-legend-item"><div class="map-legend-dot" style="background:${MARKER_COLORS.condo.bg}"></div>物件</div>`;
    h+=`<div class="map-legend-item"><div class="map-legend-dot" style="background:${MARKER_COLORS.school.bg}"></div>学校</div>`;
    h+=`<div class="map-legend-item"><div class="map-legend-dot" style="background:${MARKER_COLORS.commercial.bg};border-radius:4px"></div>商業施設（数字＝店舗数の目安・大きさ＝面積）</div>`;
    h+=`<div class="map-legend-item">数字の丸 = まとまり。押すと開きます</div>`;
    h+=`</div>`;
  }
  h+=`</div>`;
  ml.innerHTML=h;
}
