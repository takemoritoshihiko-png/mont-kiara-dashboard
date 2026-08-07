// Penang School Finder panel: school comparison, fee chart, nearby condos.
import {
  CONDOS, sfActive, setSfActive, sfSelectedSchool, setSfSelectedSchool,
} from '../state.js';
import { SF_SCHOOLS, SF_FEES } from '../data/inline.js';
import { haversineKm } from '../domain/geo.js';
import { map } from './map.js';

export function toggleSchoolFinder(){
  setSfActive(!sfActive);
  const btn=document.getElementById('sfToggle');
  btn.style.background=sfActive?'#1565c0':'#e8f0fe';
  btn.style.color=sfActive?'#fff':'#1565c0';
  document.getElementById('schoolFinder').style.display=sfActive?'flex':'none';
  document.querySelector('.filters').style.display=sfActive?'none':'';
  document.querySelector('.legend').style.display=sfActive?'none':'';
  document.getElementById('condoList').style.display=sfActive?'none':'';
  if(sfActive){
    renderSchoolFinder(parseInt(document.getElementById('sfAge').value)||5);
    map.setView([5.40,100.28],12);
  }
}

export function renderSchoolFinder(age){
  const eligible=SF_SCHOOLS.filter(s=>SF_FEES[s.key]&&SF_FEES[s.key][age]);
  eligible.sort((a,b)=>SF_FEES[a.key][age]-SF_FEES[b.key][age]);
  document.getElementById('sfCount').textContent=eligible.length+'校対象';
  let h='';
  // Comparison rows
  eligible.forEach(s=>{
    const fee=SF_FEES[s.key][age];
    const sel=sfSelectedSchool===s.key;
    h+=`<div class="sf-row ${sel?'sf-selected':''}" onclick="sfSelectSchool('${s.key}',${age})">`;
    h+=`<span class="sf-dot" style="background:${s.color}"></span>`;
    h+=`<span class="sf-name">${s.name}</span>`;
    h+=`<span class="sf-cur">${s.curriculum}</span>`;
    h+=`<span class="sf-fee">RM${fee.toLocaleString()}</span>`;
    h+=`<span class="sf-max">～${s.maxLevel}</span>`;
    h+=`</div>`;
  });
  // Chart
  h+=`<div class="sf-chart-wrap">`;
  h+=`<div class="sf-chart-title">学費推移チャート（全校・年齢別）</div>`;
  h+=renderFeeChart(age);
  h+=`<div class="sf-legend">${SF_SCHOOLS.map(s=>`<span style="color:${s.color}">● ${s.key}</span>`).join('')}</div>`;
  h+=`</div>`;
  // Condo list placeholder
  h+=`<div id="sfCondoList"></div>`;
  document.getElementById('sfContent').innerHTML=h;
  // Restore condo list if school was selected
  if(sfSelectedSchool) sfShowCondos(sfSelectedSchool);
}

function renderFeeChart(selAge){
  const W=310,H=190,PL=38,PR=8,PT=8,PB=22;
  const pw=W-PL-PR,ph=H-PT-PB;
  const maxFee=90000;
  const x=a=>PL+(a-3)/(17-3)*pw;
  const y=f=>PT+(1-f/maxFee)*ph;
  let svg=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;font-family:sans-serif">`;
  // Grid
  [0,30000,60000,90000].forEach(f=>{
    svg+=`<line x1="${PL}" y1="${y(f)}" x2="${W-PR}" y2="${y(f)}" stroke="#e0e0e0" stroke-width="0.5"/>`;
    svg+=`<text x="${PL-3}" y="${y(f)+3}" text-anchor="end" fill="#bbb" font-size="7">${f/1000}K</text>`;
  });
  // Age labels
  for(let a=3;a<=17;a++){
    svg+=`<text x="${x(a)}" y="${H-PB+12}" text-anchor="middle" fill="#bbb" font-size="6.5">${a}歳</text>`;
    if(a===selAge) svg+=`<line x1="${x(a)}" y1="${PT}" x2="${x(a)}" y2="${H-PB}" stroke="#1a73e8" stroke-width="1.2" stroke-dasharray="3,2" opacity="0.4"/>`;
  }
  // Lines
  SF_SCHOOLS.forEach(s=>{
    const fees=SF_FEES[s.key];if(!fees)return;
    const pts=[];for(let a=3;a<=17;a++){if(fees[a])pts.push(`${x(a)},${y(fees[a])}`);}
    if(pts.length>1) svg+=`<polyline points="${pts.join(' ')}" fill="none" stroke="${s.color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.75"/>`;
  });
  // Dots at selected age
  SF_SCHOOLS.forEach(s=>{
    const fees=SF_FEES[s.key];if(!fees||!fees[selAge])return;
    svg+=`<circle cx="${x(selAge)}" cy="${y(fees[selAge])}" r="3" fill="${s.color}" stroke="#fff" stroke-width="1"/>`;
  });
  svg+=`</svg>`;
  return svg;
}

export function sfSelectSchool(key,age){
  setSfSelectedSchool(key);
  renderSchoolFinder(age||parseInt(document.getElementById('sfAge').value)||5);
  const s=SF_SCHOOLS.find(x=>x.key===key);
  if(s) map.setView([s.lat,s.lng],14);
}

function sfShowCondos(key){
  const s=SF_SCHOOLS.find(x=>x.key===key);
  if(!s)return;
  const nearby=CONDOS.filter(c=>c.status==='completed'&&c.lat>5&&c.salePsfMid>0)
    .map(c=>({name:c.name,dist:haversineKm(s.lat,s.lng,c.lat,c.lng),psf:`RM${c.salePsfMin}-${c.salePsfMax}`,rent:`RM${c.rentMin.toLocaleString()}-${c.rentMax.toLocaleString()}`}))
    .filter(c=>c.dist<=3).sort((a,b)=>a.dist-b.dist).slice(0,10);
  const el=document.getElementById('sfCondoList');
  if(!el)return;
  let h=`<div class="sf-condo-section">`;
  h+=`<div class="sf-condo-title">🏠 ${s.name}から3km以内のコンド (${nearby.length}件)</div>`;
  if(!nearby.length){h+=`<div style="font-size:10px;color:#5f6368">近隣データなし</div>`;}
  else{nearby.forEach(c=>{
    h+=`<div class="sf-condo-row" onclick="sfActive=false;toggleSchoolFinder();selectCondo('${c.name.replace(/'/g,"\\'")}')">`;
    h+=`<span style="font-weight:600">${c.name}</span>`;
    h+=`<span style="color:#5f6368">${c.dist.toFixed(1)}km</span>`;
    h+=`</div>`;
  });}
  h+=`</div>`;
  el.innerHTML=h;
}
