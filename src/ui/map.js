// Leaflet map: creation, markers, the map legend and area quick-jump.
import {
  CONDOS, filtered, markers, setMarkers, legendOpen, setLegendOpen,
  selectedCondo, activeLayer, appMode, setDiningNear, visibleLayers,
} from '../state.js';
import { NEAR_KM, recordLayer } from '../domain/filter.js';
import { YEAR_MIN, YEAR_MAX, YEAR_COLORS, TIER_COLORS, MICHELIN_BADGES } from '../data/inline.js';
import { selectCondo, closeInfo } from './info.js';
// Deferred-usage only (called inside functions): safe across the list.js<->map.js cycle.
import { cardHeroText, ratingText, num } from './list.js';
import { isVisited } from '../data/personal.js';

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
// WHAT SELECTING A RECORD DOES TO THE MAP
// The rule is: do not move what the user just pressed.
// Below OVERVIEW_ZOOM the map is a city and the pin you tapped is one of a
// cluster of hundreds — there, zooming in to SELECT_ZOOM is the whole point of
// the tap. At OVERVIEW_ZOOM and above you have already framed a neighbourhood
// and are comparing inside it: re-centring would throw that frame away and
// slide the pin out from under your finger. So the map only pans, and only if
// the pin would otherwise sit under the detail overlay.
// ============================================================
export const OVERVIEW_ZOOM = 14;
export const SELECT_ZOOM = 15;
// The detail overlay is 300px wide at the map's top-left (48px below the top of
// .main). The padding keeps the pin clear of it, plus a small margin.
export const SELECT_PAN_PADDING = { paddingTopLeft: [320, 60], paddingBottomRight: [20, 20] };

/**
 * Pure helper: what a selection should do to the map at a given zoom.
 * @returns {{action:'setView', zoom:number}|{action:'panInside'}}
 */
export function focusActionForZoom(zoom) {
  return zoom < OVERVIEW_ZOOM ? { action: 'setView', zoom: SELECT_ZOOM } : { action: 'panInside' };
}

/**
 * Pure helper: the padding to pan inside, given the map's pixel size.
 *
 * The overlay's 320px is a desktop measurement. On a 360px phone it would leave
 * a 20px strip — and on anything narrower the padded rectangle would invert,
 * which makes Leaflet's offset arithmetic pan the map somewhere arbitrary. So
 * the padding never claims more than 60% of the width or 40% of the height:
 * below that the pin may end up under the panel, which is recoverable, while a
 * map that jumps is not.
 *
 * @param {{x:number,y:number}} size  map.getSize()
 */
export function panPaddingFor(size) {
  const [x, y] = SELECT_PAN_PADDING.paddingTopLeft;
  return {
    paddingTopLeft: [
      Math.min(x, Math.floor((size.x || 0) * 0.6)),
      Math.min(y, Math.floor((size.y || 0) * 0.4)),
    ],
    paddingBottomRight: SELECT_PAN_PADDING.paddingBottomRight,
  };
}

/**
 * Bring a record into view without stealing the view the user built.
 * Applies focusActionForZoom(); panInside() is Leaflet 1.9's "move the least
 * amount that makes this point visible inside these paddings".
 */
export function focusOnRecord(lat, lng) {
  if (!map) return;
  const plan = focusActionForZoom(map.getZoom());
  if (plan.action === 'setView') { map.setView([lat, lng], plan.zoom); return; }
  // Guard against a CDN version without panInside: falling back to panTo still
  // never changes the zoom, which is the part that must not be lost.
  if (typeof map.panInside === 'function') map.panInside([lat, lng], panPaddingFor(map.getSize()));
  else map.panTo([lat, lng]);
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

// A michelin-starred restaurant keeps the dining colour but is ringed in gold,
// so "there is a starred place here" is readable without opening anything.
export const MICHELIN_STAR_BORDER = '#c9a227';

// ビブグルマンも縁で読めるように(2026-08-08 ミシュラン網羅と同時採用)。
// 商業のオレンジ(#e8710a)より暗い橙にして、四角い商業マーカーと混ざらない。
export const MICHELIN_BIB_BORDER = '#b45309';

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
    return L.divIcon({
      className: '',
      iconSize: [sz, sz],
      iconAnchor: [sz/2, sz/2],
      html: `<div role="button" aria-label="${CLUSTER_LABELS[type]} ${n}件。押すと開きます" style="${mute}width:${sz}px;height:${sz}px;border-radius:${st.radius};background:${st.bg};border:2px solid rgba(255,255,255,0.9);box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;cursor:pointer">
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
    const mode = labelModeForZoom(map.getZoom());
    if (mode === labelMode) return;
    labelMode = mode;
    applyLabelMode(mode);
  });

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

/** The tail every marker branch shares: build the Leaflet marker, wire the
 *  click, bind the name label. shortName is what the label prints. */
function attachMarker(c, icon, shortName, size){
  const m = L.marker([c.lat,c.lng],{icon,keyboard:false});
  m._rec = c;
  m.on('click',()=>selectCondo(c.name));
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
    const csz = 22;
    const mb = MICHELIN_BADGES[c.michelin];
    const border = (c.michelin === '1star' || c.michelin === '2star') ? MICHELIN_STAR_BORDER
      : c.michelin === 'bib' ? MICHELIN_BIB_BORDER : MARKER_COLORS.dining.border;
    // 訪問済みの店はピン自体に緑の✓バッジ（2026-08-07 依頼: 地図を見るだけで
    // 「もう行った」が分かるように）。記録が変わると applyFilters→rebuild が
    // 走るので、押した瞬間にバッジも追随する。色は再訪意向「また行く」と同じ
    // 緑 (--rv-again) のリテラル。
    // 外食モード限定: 住まいモードは個人記録を一切出さない契約（CLAUDE.md）
    // なので、住まい側で飲食レイヤーを重ねてもバッジは描かない。
    const visited = appMode === 'eatout' && isVisited(c);
    const badge = visited
      ? `<span aria-hidden="true" style="position:absolute;top:-5px;right:-5px;width:13px;height:13px;border-radius:50%;background:#1d5f55;border:1.5px solid #fff;color:#fff;font-size:9px;font-weight:700;line-height:1;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,0.35)">✓</span>`
      : '';
    const icon = L.divIcon({
      className: pinClass(c),
      iconSize: [csz, csz],
      iconAnchor: [csz/2, csz/2],
      html: `<div role="button" aria-label="飲食店 ${attrEsc(c.name)}${mb ? '、' + mb : ''}${visited ? '、訪問済み' : ''}" style="position:relative;width:${csz}px;height:${csz}px;display:flex;align-items:center;justify-content:center;cursor:pointer">
        <span aria-hidden="true" style="position:absolute;inset:0;border-radius:${MARKER_COLORS.dining.radius};background:${MARKER_COLORS.dining.bg};border:2px solid ${border};box-shadow:0 2px 6px rgba(0,0,0,0.3);transform:rotate(-45deg)"></span>
        <span aria-hidden="true" style="position:relative;color:#fff;font-size:10px;line-height:1">🍽</span>${badge}
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
    const csz = nla >= 200000 ? 22 : nla >= 50000 ? 18 : 14;
    const fsz = nla >= 200000 ? 11 : nla >= 50000 ? 10 : 8;
    const icon = L.divIcon({
      className: pinClass(c),
      iconSize: [csz, csz],
      iconAnchor: [csz/2, csz/2],
      html: `<div role="button" aria-label="商業施設 ${attrEsc(c.name)}" style="width:${csz}px;height:${csz}px;border-radius:${MARKER_COLORS.commercial.radius};background:${MARKER_COLORS.commercial.bg};border:2px solid ${MARKER_COLORS.commercial.border};display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer">
        <span aria-hidden="true" style="color:#fff;font-size:${fsz}px">🛒</span>
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
  const ns=new Set(filtered.map(c=>c.name));
  CONDOS.forEach(c=>{
    const type=recordLayer(c);
    // 外食モード draws restaurants only. 住まいモード draws exactly the layers
    // whose checkbox is on (2026-08-07 ruling: the layer tabs became
    // check-boxes — one, two or all four at once). What is checked is shown
    // at full strength: opt-in context does not need ghosting.
    // 閉店・休業の店はピンを出さない(地図は「行く」ための面。台帳一覧には残る)
    if(c.closed) return;
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
    h+=`<div class="map-legend-item"><div class="map-legend-dot" style="background:${MARKER_COLORS.dining.bg};border-color:${MICHELIN_STAR_BORDER};border-radius:${MARKER_COLORS.dining.radius};transform:rotate(-45deg)"></div>ミシュラン星付き（金の縁）</div>`;
    h+=`<div class="map-legend-item"><div class="map-legend-dot" style="background:${MARKER_COLORS.dining.bg};border-color:${MICHELIN_BIB_BORDER};border-radius:${MARKER_COLORS.dining.radius};transform:rotate(-45deg)"></div>ビブグルマン（橙の縁）</div>`;
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
    h+=`<div class="map-legend-item"><div class="map-legend-dot" style="background:${MARKER_COLORS.commercial.bg};border-radius:4px"></div>商業施設</div>`;
    h+=`<div class="map-legend-item">数字の丸 = まとまり。押すと開きます</div>`;
    h+=`</div>`;
  }
  h+=`</div>`;
  ml.innerHTML=h;
}
