// Leaflet map: creation, markers, the map legend and area quick-jump.
import { CONDOS, filtered, markers, setMarkers, legendOpen, setLegendOpen } from '../state.js';
import { YEAR_MIN, YEAR_MAX, YEAR_COLORS, TIER_COLORS } from '../data/inline.js';
import { selectCondo } from './info.js';

// Live binding: other modules import `map` and always see the current value.
export let map = null;

/** Create the Leaflet map and inject the marker-tooltip style. */
export function initMap() {
  map = L.map('map',{zoomControl:true}).setView([3.1550,101.6850],12);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{
    attribution:'&copy; OpenStreetMap &copy; CARTO',maxZoom:19
  }).addTo(map);

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
const AREA_CENTERS = {
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
  'all-pg':    {lat:5.40000,lng:100.28000,zoom:11}
};
export function jumpToArea(key){
  const a=AREA_CENTERS[key];if(!a)return;
  map.flyTo([a.lat,a.lng],a.zoom,{duration:0.8});
  document.querySelectorAll('.area-jump button').forEach(b=>b.classList.remove('active'));
  const btn=document.querySelector(`.area-jump button[data-area="${key}"]`);
  if(btn)btn.classList.add('active');
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
      className: '',
      iconSize: [csz, csz],
      iconAnchor: [csz/2, csz/2],
      html: `<div style="width:${csz}px;height:${csz}px;border-radius:50%;background:#1565c0;border:2px solid #0d47a1;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,0.3);cursor:pointer">
        <span style="color:#fff;font-size:10px">🎓</span>
      </div>`
    });
    const m = L.marker([c.lat,c.lng],{icon});
    m.on('click',()=>selectCondo(c.name));
    m.bindTooltip(c.name.replace(/International School/g,'IS').replace(/International/g,'Intl'), {permanent:true,direction:'right',offset:[csz/2+2,0],className:'condo-label-tip'});
    return m;
  }

  if (isCommercial) {
    // Size based on NLA: large(>200K)=28, medium(50K-200K)=22, small(<50K)=16
    const nla = c.sizeMin || 0;
    const csz = nla >= 200000 ? 28 : nla >= 50000 ? 22 : 16;
    const fsz = nla >= 200000 ? 13 : nla >= 50000 ? 11 : 9;
    const icon = L.divIcon({
      className: '',
      iconSize: [csz, csz],
      iconAnchor: [csz/2, csz/2],
      html: `<div style="width:${csz}px;height:${csz}px;border-radius:4px;background:#ff6d00;border:2px solid #e65100;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer">
        <span style="color:#fff;font-size:${fsz}px">🛒</span>
      </div>`
    });
    const m = L.marker([c.lat,c.lng],{icon});
    m.on('click',()=>selectCondo(c.name));
    m.bindTooltip(c.name.replace(/ \(.*\)/,''), {permanent:true,direction:'right',offset:[csz/2+2,0],className:'condo-label-tip'});
    return m;
  }

  const borderStyle = isUpcoming ? `3px dashed ${tierColor}` : `3px solid ${tierColor}`;
  const bgColor = isUpcoming ? 'rgba(255,255,255,0.85)' : yearColor;
  const textColor = isUpcoming ? '#333' : '#fff';
  const label1 = isUpcoming ? '🔜' : c.luxTier;
  const label2 = "'" + yr2;

  const icon = L.divIcon({
    className: '',
    iconSize: [sz, sz],
    iconAnchor: [sz/2, sz/2],
    html: `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${bgColor};border:${borderStyle};display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer;line-height:1.1">
      <span style="color:${textColor};font-size:${sz>34?11:9}px;font-weight:800;text-shadow:${isUpcoming?'none':'0 1px 2px rgba(0,0,0,0.5)'}">${label1}</span>
      <span style="color:${isUpcoming?'#666':'rgba(255,255,255,0.85)'};font-size:${sz>34?8:7}px;font-weight:600;text-shadow:${isUpcoming?'none':'0 1px 2px rgba(0,0,0,0.5)'}">${label2}</span>
    </div>`
  });

  const m = L.marker([c.lat,c.lng],{icon});
  m.on('click',()=>selectCondo(c.name));

  // Permanent label
  m.bindTooltip(c.name.replace(/ Mont Kiara/g,'').replace(/ \(.*\)/,''), {
    permanent: true, direction: 'right', offset: [sz/2+2, 0],
    className: 'condo-label-tip'
  });

  return m;
}

export function rebuild(){
  Object.values(markers).forEach(m=>map.removeLayer(m));setMarkers({});
  const ns=new Set(filtered.map(c=>c.name));
  CONDOS.forEach(c=>{if(ns.has(c.name)){markers[c.name]=mkMarker(c);markers[c.name].addTo(map);}});
  updateLegend();
}

export function toggleLegend(e){
  e&&e.stopPropagation();
  setLegendOpen(!legendOpen);
  const body=document.getElementById('legendBody');
  const tog=document.getElementById('legendToggle');
  if(body) body.style.display=legendOpen?'block':'none';
  if(tog) tog.textContent=legendOpen?'▼':'▶';
}
export function updateLegend(){
  const bar=document.getElementById('legendBar');bar.innerHTML='';
  for(let i=0;i<24;i++){const d=document.createElement('div');d.style.background=getYearColor(YEAR_MIN+i/23*(YEAR_MAX-YEAR_MIN));bar.appendChild(d);}
  document.getElementById('legendLabels').innerHTML=`<span>${YEAR_MIN} (Oldest)</span><span>${Math.round((YEAR_MIN+YEAR_MAX)/2)}</span><span>${YEAR_MAX} (Newest)</span>`;

  const ml=document.getElementById('mapLegend');
  let h=`<div class="map-legend-title" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">Legend <span id="legendToggle" style="font-size:10px">${legendOpen?'▼':'▶'}</span></div>`;
  h+=`<div id="legendBody" style="display:${legendOpen?'block':'none'}">`;
  h+=`<div class="map-legend-title" style="margin-top:2px">Year Built</div>`;
  [{y:1993,l:'~1993'},{y:2001,l:'~2001'},{y:2009,l:'~2009'},{y:2017,l:'~2017'},{y:2025,l:'~2025'}].forEach(({y,l})=>{
    h+=`<div class="map-legend-item"><div class="map-legend-dot" style="background:${getYearColor(y)}"></div>${l}</div>`;
  });
  h+=`<div class="map-legend-section"><div class="map-legend-title">Luxury Tier</div></div>`;
  [{t:'S',l:'Ultra Luxury (70+)'},{t:'A',l:'Super Luxury (60-69)'},{t:'B',l:'Luxury (50-59)'},{t:'C',l:'Upper Mid (40-49)'},{t:'D',l:'Standard (<40)'}].forEach(({t,l})=>{
    h+=`<div class="map-legend-item"><span class="tier-badge" style="background:${TIER_COLORS[t]}">${t}</span>${l}</div>`;
  });
  h+=`<div class="map-legend-section"><div class="map-legend-title">Circle = Units</div></div>`;
  h+=`</div>`;
  ml.innerHTML=h;
}
