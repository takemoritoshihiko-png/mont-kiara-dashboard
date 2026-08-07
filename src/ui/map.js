// Leaflet map: creation, markers, the map legend and area quick-jump.
import {
  CONDOS, filtered, markers, setMarkers, legendOpen, setLegendOpen,
  selectedCondo, activeLayer,
} from '../state.js';
import { YEAR_MIN, YEAR_MAX, YEAR_COLORS, TIER_COLORS } from '../data/inline.js';
import { selectCondo } from './info.js';

// ============================================================
// ZOOM THRESHOLDS (tune here)
// Below CLUSTER_OFF_ZOOM markers are grouped into per-type clusters; at or
// above it every marker is drawn individually. LABEL_ZOOM does the same for
// the name labels: hover-only when zoomed out, always-on when zoomed in.
// ============================================================
export const CLUSTER_OFF_ZOOM = 15;
export const LABEL_ZOOM = 15;

/**
 * Pure helper: the tooltip mode that applies at a given zoom level.
 * 'permanent' = label always shown, 'hover' = label only on mouseover.
 */
export function labelModeForZoom(zoom) {
  return zoom >= LABEL_ZOOM ? 'permanent' : 'hover';
}

// Live binding: other modules import `map` and always see the current value.
export let map = null;

// Marker cluster groups, one per marker type. Created lazily in initMap()
// because Leaflet.markercluster is a browser-only CDN script.
let clusterGroups = null;
// The label mode currently bound to the markers; tooltips are only re-bound
// when a zoom change crosses the threshold, never on every zoom step.
let labelMode = null;

/** condo | commercial | school — the visual language each marker follows. */
function markerType(c) {
  return c.status === 'school' ? 'school' : c.status === 'commercial' ? 'commercial' : 'condo';
}

/**
 * Escape for an HTML attribute. Leaflet builds divIcon content from a raw
 * string outside the document, so the shared esc() in ui/list.js is not
 * reachable here without importing the panel into the map. A name like
 * 「Pavilion Hilltop ("The Peak")」 must not break out of aria-label.
 */
export const attrEsc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// B3a: the layers the user is not looking at stay on the map as context, but
// dimmed and label-free. This is the single knob for "how faint is context".
export const DIM_OPACITY = 0.45;

// B3b (spec 2.9): the type colours live here, once. Markers, cluster bubbles
// and the legend all read them, so school navy / commercial orange can never
// drift apart again. They mirror --type-school / --type-commercial in the CSS;
// Leaflet builds icon HTML outside the document's cascade, so the values have
// to be literals here rather than var() references.
export const MARKER_COLORS = {
  condo:      { bg:'#78909c', border:'#546e7a', radius:'50%' },
  commercial: { bg:'#e8710a', border:'#b85806', radius:'4px' },
  school:     { bg:'#1a3d7c', border:'#112a58', radius:'50%' },
};

// Cluster bubbles reuse the marker colours so the type stays readable when
// several markers collapse into one.
const CLUSTER_STYLE = {
  condo:      { bg:MARKER_COLORS.condo.bg, radius:'50%' },
  commercial: { bg:MARKER_COLORS.commercial.bg, radius:'8px' },
  school:     { bg:MARKER_COLORS.school.bg, radius:'50%' },
};

/** What a cluster bubble is a cluster OF — read out instead of a bare number. */
const CLUSTER_LABELS = { condo: '物件', commercial: '商業施設', school: '学校' };

function clusterIconFactory(type) {
  const st = CLUSTER_STYLE[type];
  return (cluster) => {
    const n = cluster.getChildCount();
    const sz = n >= 25 ? 46 : n >= 10 ? 38 : 32;
    const fs = n >= 25 ? 15 : n >= 10 ? 13 : 12;
    // Read the layer at draw time: the clusters are re-rendered on every
    // rebuild(), so a layer switch re-dims them without any extra wiring.
    const op = type === activeLayer ? 1 : DIM_OPACITY;
    return L.divIcon({
      className: '',
      iconSize: [sz, sz],
      iconAnchor: [sz/2, sz/2],
      html: `<div role="button" aria-label="${CLUSTER_LABELS[type]} ${n}件。開くには拡大してください" style="opacity:${op};width:${sz}px;height:${sz}px;border-radius:${st.radius};background:${st.bg};border:2px solid rgba(255,255,255,0.9);box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;cursor:pointer">
        <span aria-hidden="true" style="color:#fff;font-size:${fs}px;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,0.35)">${n}</span>
      </div>`
    });
  };
}

function makeClusterGroups() {
  const mk = (type) => L.markerClusterGroup({
    maxClusterRadius: 45,
    disableClusteringAtZoom: CLUSTER_OFF_ZOOM,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    iconCreateFunction: clusterIconFactory(type),
  });
  return { condo: mk('condo'), commercial: mk('commercial'), school: mk('school') };
}

/** Create the Leaflet map and inject the marker-tooltip style. */
export function initMap() {
  map = L.map('map',{zoomControl:true}).setView([3.1550,101.6850],12);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{
    attribution:'&copy; OpenStreetMap &copy; CARTO',maxZoom:19
  }).addTo(map);

  clusterGroups = makeClusterGroups();
  Object.values(clusterGroups).forEach(g=>map.addLayer(g));
  labelMode = labelModeForZoom(map.getZoom());

  // Re-bind the labels only when the zoom crosses the threshold.
  map.on('zoomend', () => {
    const mode = labelModeForZoom(map.getZoom());
    if (mode === labelMode) return;
    labelMode = mode;
    applyLabelMode(mode);
  });

  // Add tooltip style dynamically
  const tipStyle = document.createElement('style');
  tipStyle.textContent = `.condo-label-tip{background:transparent!important;border:none!important;box-shadow:none!important;color:#37474f;font-size:8px;font-weight:500;padding:0 1px!important;text-shadow:1px 1px 1px #fff,-1px -1px 1px #fff,1px -1px 1px #fff,-1px 1px 1px #fff,0 0 3px #fff}`;
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
export function jumpToArea(key){
  const a=AREA_CENTERS[key];if(!a)return;
  map.flyTo([a.lat,a.lng],a.zoom,{duration:0.8});
  document.querySelectorAll('.area-jump button').forEach(b=>b.classList.remove('active'));
  const btn=document.querySelector(`.area-jump button[data-area="${key}"]`);
  if(btn)btn.classList.add('active');
}

// ============================================================
// LABELS — zoom-dependent tooltips
// The selected marker keeps its always-on label at any zoom.
// ============================================================
const labelOpts = (permanent, offsetX) => ({
  permanent, direction: 'right', offset: [offsetX, 0], className: 'condo-label-tip'
});

function bindLabel(m, name, text, offsetX, dim) {
  m._labelName = name;
  m._labelText = text;
  m._labelOffsetX = offsetX;
  m._dim = !!dim;
  // Dimmed context markers never carry an always-on label (spec 2.2).
  const permanent = !dim && ((labelMode || 'permanent') === 'permanent' || name === selectedCondo);
  m.bindTooltip(text, labelOpts(permanent, offsetX));
  if (dim) m.setOpacity(DIM_OPACITY);
  return m;
}

/** Re-bind every marker's tooltip for the given mode ('permanent' | 'hover'). */
function applyLabelMode(mode) {
  Object.values(markers).forEach(m => {
    const permanent = !m._dim && (mode === 'permanent' || m._labelName === selectedCondo);
    const tip = m.getTooltip();
    if (tip && !!tip.options.permanent === permanent) return;
    m.unbindTooltip();
    m.bindTooltip(m._labelText, labelOpts(permanent, m._labelOffsetX));
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
const pinClass = (c) => pinClassName(c.name === selectedCondo);

// Custom DivIcon with tier label inside circle
function mkMarker(c, dim) {
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
    const m = L.marker([c.lat,c.lng],{icon});
    m.on('click',()=>selectCondo(c.name));
    return bindLabel(m, c.name, c.name.replace(/International School/g,'IS').replace(/International/g,'Intl'), csz/2+2, dim);
  }

  if (isCommercial) {
    // Size based on NLA: large(>200K)=28, medium(50K-200K)=22, small(<50K)=16
    const nla = c.sizeMin || 0;
    const csz = nla >= 200000 ? 28 : nla >= 50000 ? 22 : 16;
    const fsz = nla >= 200000 ? 13 : nla >= 50000 ? 11 : 9;
    const icon = L.divIcon({
      className: pinClass(c),
      iconSize: [csz, csz],
      iconAnchor: [csz/2, csz/2],
      html: `<div role="button" aria-label="商業施設 ${attrEsc(c.name)}" style="width:${csz}px;height:${csz}px;border-radius:${MARKER_COLORS.commercial.radius};background:${MARKER_COLORS.commercial.bg};border:2px solid ${MARKER_COLORS.commercial.border};display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer">
        <span aria-hidden="true" style="color:#fff;font-size:${fsz}px">🛒</span>
      </div>`
    });
    const m = L.marker([c.lat,c.lng],{icon});
    m.on('click',()=>selectCondo(c.name));
    return bindLabel(m, c.name, c.name.replace(/ \(.*\)/,''), csz/2+2, dim);
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

  const m = L.marker([c.lat,c.lng],{icon});
  m.on('click',()=>selectCondo(c.name));

  // Name label (permanent when zoomed in / selected, hover-only otherwise)
  return bindLabel(m, c.name, c.name.replace(/ Mont Kiara/g,'').replace(/ \(.*\)/,''), sz/2+2, dim);
}

/** All three cluster groups stay on the map; the layer control dims, never hides. */
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
  // The active layer shows exactly what the filters left. The other two stay
  // on the map in full, dimmed, as "what else is around here" context.
  const ns=new Set(filtered.map(c=>c.name));
  CONDOS.forEach(c=>{
    const type=markerType(c);
    const isActive=type===activeLayer;
    if(isActive&&!ns.has(c.name))return;
    const m=mkMarker(c,!isActive);markers[c.name]=m;
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
export function updateLegend(){
  const ml=document.getElementById('mapLegend');
  if(!ml)return;
  let h=`<div class="map-legend-title" style="display:flex;justify-content:space-between;align-items:center">Legend <span id="legendToggle" aria-hidden="true">${legendOpen?'▼':'▶'}</span></div>`;
  h+=`<div id="legendBody" style="display:${legendOpen?'block':'none'}">`;
  h+=`<div class="map-legend-title" style="margin-top:var(--s2)">Year Built (${YEAR_MIN}–${YEAR_MAX})</div>`;
  [{y:1993,l:'~1993'},{y:2001,l:'~2001'},{y:2009,l:'~2009'},{y:2017,l:'~2017'},{y:2025,l:'~2025'}].forEach(({y,l})=>{
    h+=`<div class="map-legend-item"><div class="map-legend-dot" style="background:${getYearColor(y)}"></div>${l}</div>`;
  });
  h+=`<div class="map-legend-section"><div class="map-legend-title">Luxury Tier</div>`;
  [{t:'S',l:'Ultra Luxury (70+)'},{t:'A',l:'Super Luxury (60-69)'},{t:'B',l:'Luxury (50-59)'},{t:'C',l:'Upper Mid (40-49)'},{t:'D',l:'Standard (<40)'}].forEach(({t,l})=>{
    h+=`<div class="map-legend-item"><span class="tier-badge" style="background:${TIER_COLORS[t]}">${t}</span>${l}</div>`;
  });
  h+=`</div>`;
  h+=`<div class="map-legend-section"><div class="map-legend-title">Type</div>`;
  h+=`<div class="map-legend-item"><div class="map-legend-dot" style="background:${MARKER_COLORS.school.bg}"></div>学校</div>`;
  h+=`<div class="map-legend-item"><div class="map-legend-dot" style="background:${MARKER_COLORS.commercial.bg};border-radius:4px"></div>商業施設</div>`;
  h+=`<div class="map-legend-item">円の大きさ = 戸数</div>`;
  h+=`</div>`;
  h+=`</div>`;
  ml.innerHTML=h;
}
