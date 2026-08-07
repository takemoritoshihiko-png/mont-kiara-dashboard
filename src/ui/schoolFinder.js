// 「学費くらべ」 — pick an age, see what a year at every school costs.
//
// B3c (spec 2.8 / audit E4): this used to be the "Penang School Finder", nine
// hard-coded Penang schools with a hand-built age→fee table. schools_detail.json
// now carries per-grade fee tables for all 33 schools, KL included, so the list
// is built from that data through src/domain/fees.js instead. The SVG fee-curve
// chart still needs a value at EVERY age to draw a line, which only the nine
// curated Penang curves have, so it stays as it is — below the list, labelled
// for what it actually shows.
import {
  CONDOS, SCHOOLS, SCHOOLS_DETAIL, sfActive, setSfActive,
  sfSelectedSchool, setSfSelectedSchool,
} from '../state.js';
import { SF_SCHOOLS, SF_FEES } from '../data/inline.js';
import { feeComparison } from '../domain/fees.js';
import { recordLayer } from '../domain/filter.js';
import { nearby, formatDistance, BUCKET_LABELS } from '../domain/nearby.js';
import { num, esc, jsStr } from './list.js';
import { selectCondo, selectNearby } from './info.js';

const $ = (id) => document.getElementById(id);

// The default age the panel opens on when the select has no value yet.
const DEFAULT_AGE = 5;

/** The age currently chosen in the panel. */
function currentAge(){
  const el = $('sfAge');
  const n = parseInt(el ? el.value : '', 10);
  return Number.isFinite(n) ? n : DEFAULT_AGE;
}

// ============================================================
// OPEN / CLOSE
// The panel swaps places with the filters and the list. Everything that has to
// agree about that lives in one function, so no caller can leave the panel
// half-open (audit E2: the old inline `sfActive=false;toggleSchoolFinder()`
// flipped the flag back on and left the panel showing).
// ============================================================
function setPanel(on){
  setSfActive(on);
  const btn = $('sfToggle');
  if(btn){
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  const panel = $('schoolFinder');
  if(panel) panel.style.display = on ? 'flex' : 'none';
  const filters = document.querySelector('.filters');
  if(filters) filters.style.display = on ? 'none' : '';
  const list = $('condoList');
  if(list) list.style.display = on ? 'none' : '';
  // Opening no longer flies the map to Penang: the comparison spans both
  // islands now, so there is no single "overview" to jump to.
  if(on) renderSchoolFinder(currentAge());
}

export function openSchoolFinder(){ setPanel(true); }
export function closeSchoolFinder(){ setPanel(false); }
export function toggleSchoolFinder(){ setPanel(!sfActive); }

// ============================================================
// THE LIST
// ============================================================
function feeRowHtml(r){
  const selected = sfSelectedSchool === r.name;
  // exact = the school prints a price for this very year. Otherwise we show its
  // nearest published year and say which one — never a number nobody printed.
  const note = r.exact
    ? `${esc(r.gradeLabel)}の実額`
    : `※近い学年 ${esc(r.gradeLabel)} の実額`;
  return `<div class="sf-row${selected ? ' sf-selected' : ''}" onclick="sfSelectSchool('${jsStr(r.name)}')" title="${esc(r.name)}">` +
    `<div class="sf-row-top">` +
      `<span class="sf-area">${esc(r.area)}</span>` +
      `<span class="sf-name">${esc(r.name)}</span>` +
      `<span class="sf-fee">RM ${num(r.fee)}<span class="sf-per">/年</span></span>` +
    `</div>` +
    `<div class="sf-grade${r.exact ? '' : ' sf-grade-near'}">${note}</div>` +
    `</div>`;
}

export function renderSchoolFinder(age){
  const body = $('sfContent');
  if(!body) return;
  const a = Number.isFinite(age) ? age : currentAge();
  const { rows, noDataCount } = feeComparison(SCHOOLS, SCHOOLS_DETAIL, a);

  const count = $('sfCount');
  if(count) count.textContent = rows.length + '校対象';

  let h = rows.length
    ? rows.map(feeRowHtml).join('')
    : `<div class="sf-empty">この年齢の学費を公表している学校がありません</div>`;
  // The list is never allowed to look complete when it is not.
  if(noDataCount) h += `<div class="sf-nodata">学費データなし: ${num(noDataCount)}校</div>`;

  h += `<div class="sf-chart-wrap">`;
  h += `<div class="sf-chart-title">学費推移チャート（ペナン9校・年齢別）</div>`;
  h += renderFeeChart(a);
  h += `<div class="sf-legend">${SF_SCHOOLS.map(s => `<span style="color:${s.color}">● ${esc(s.key)}</span>`).join('')}</div>`;
  h += `</div>`;

  h += `<div id="sfCondoList"></div>`;
  body.innerHTML = h;

  if(sfSelectedSchool) sfShowCondos(sfSelectedSchool);
}

/**
 * Pick a school from the comparison list: highlight it here, list the condos
 * around it, and open its detail overlay through the normal selection flow.
 */
export function sfSelectSchool(name){
  setSfSelectedSchool(name);
  renderSchoolFinder(currentAge());
  selectCondo(name);
}

// ============================================================
// FEE CURVE CHART (the nine curated Penang curves — unchanged)
// ============================================================
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
    if(a===selAge) svg+=`<line x1="${x(a)}" y1="${PT}" x2="${x(a)}" y2="${H-PB}" stroke="#0a6cff" stroke-width="1.2" stroke-dasharray="3,2" opacity="0.4"/>`;
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

// ============================================================
// CONDOS AROUND THE CHOSEN SCHOOL
// B3c: the panel's own 3km haversine loop is gone. This is now one more use of
// the same 周辺 engine the detail overlay runs on, so "near" means the same
// thing everywhere in the app (audit E2 leftover).
// ============================================================
const SF_BUCKETS = [800, 2000, 3000];
// 800m / 2km wording is shared with the 周辺 tab; only the outer ring differs,
// because a school search is a daily-commute question, not a weekend one.
const SF_BUCKET_LABELS = { ...BUCKET_LABELS, 3000: '🚗 車で約10分 (3km)' };
const SF_MAX_PER_BUCKET = 5;

function condoRowHtml(item){
  const c = item.record;
  const tip = [
    c.rentMin > 0 ? `RM ${num(c.rentMin)}–${num(c.rentMax)}/月` : '',
    c.salePsfMin > 0 ? `PSF ${num(c.salePsfMin)}–${num(c.salePsfMax)}` : '',
  ].filter(Boolean).join(' ・ ') || c.name;
  return `<div class="sf-condo-row" onclick="sfSelectCondo('${jsStr(c.name)}')" title="${esc(tip)}">` +
    `<span class="sf-condo-name">${esc(c.name)}</span>` +
    `<span class="sf-condo-dist">${formatDistance(item.distanceM)}</span></div>`;
}

function sfShowCondos(name){
  const el = $('sfCondoList');
  if(!el) return;
  const school = SCHOOLS.find(x => x.name === name);
  if(!school){ el.innerHTML = ''; return; }

  const condos = CONDOS.filter(c => recordLayer(c) === 'condo');
  const buckets = nearby(school, condos, { buckets: SF_BUCKETS });

  let h = `<div class="sf-condo-section">`;
  h += `<div class="sf-condo-title">🏠 ${esc(school.name)} の周辺コンド</div>`;
  buckets.forEach(b => {
    const list = b.byLayer.condo;
    h += `<div class="sf-bucket-head">${SF_BUCKET_LABELS[b.maxM] || b.maxM + 'm'}<span class="sf-bucket-n">${num(list.length)}件</span></div>`;
    if(!list.length){ h += `<div class="sf-empty">なし</div>`; return; }
    h += list.slice(0, SF_MAX_PER_BUCKET).map(condoRowHtml).join('');
    if(list.length > SF_MAX_PER_BUCKET){
      h += `<div class="sf-condo-more">ほか ${num(list.length - SF_MAX_PER_BUCKET)}件</div>`;
    }
  });
  h += `</div>`;
  el.innerHTML = h;
}

/**
 * Click a condo listed under a school: close 学費くらべ first, THEN select.
 * Closing restores the filters and the list, so the app is in a normal state
 * by the time the detail overlay opens. selectNearby() carries the layer switch
 * (学校 → 物件) that makes the chosen condo the thing on screen rather than a
 * dimmed context marker — the same crossing the 周辺 tab does.
 */
export function sfSelectCondo(name){
  closeSchoolFinder();
  selectNearby(name);
}
