// Side panel: layer control, per-layer filters, sort, the list and the summary.
import {
  CONDOS, filtered, setFiltered, selectedCondo, currentSort, setCurrentSort,
  activeLayer, setActiveLayer, moreOpen, setMoreOpen,
  showAwardOnly, setShowAwardOnly,
} from '../state.js';
import { TIER_COLORS } from '../data/inline.js';
import { parseR, matchesFilters, recordLayer, LAYER_LABELS, CURRICULA } from '../domain/filter.js';
import { SORT_OPTIONS, comparatorFor, defaultSortFor, sortAvailable } from '../domain/sort.js';
import { map, rebuild } from './map.js';
import { syncUrl } from './urlState.js';

const $ = (id) => document.getElementById(id);
const val = (id) => { const el = $(id); return el ? el.value : ''; };
const num = (n) => Number(n).toLocaleString('en-US');
// Shared with info.js so both renderers escape identically.
export const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const jsStr = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

// ============================================================
// CRITERIA — which controls belong to which layer
// Each entry: [element id, chip label]. Only the active layer's controls are
// read, so a hidden layer's leftover value can never filter the list.
// ============================================================
const LAYER_CONTROLS = {
  condo: [
    ['fRent', '家賃'], ['fTier', 'Tier'], ['fSalePsf', 'PSF'], ['fYear', '築年'],
    ['fAge', '築年数'], ['fSize', '広さ'], ['fStatus', '状態'], ['fArea', 'エリア'],
  ],
  school: [
    ['fSchoolAge', '年齢'], ['fCurriculum', 'カリキュラム'], ['fFee', '学費'], ['fArea', 'エリア'],
  ],
  commercial: [
    ['fNla', '規模'], ['fOpenYear', '開業年'], ['fAnchor', 'アンカー'], ['fArea', 'エリア'],
  ],
};

/** Read every control of the active layer into the criteria object. */
export function readCriteria(){
  const layer = activeLayer;
  const c = {
    layer,
    q: val('fSearch').toLowerCase(),
    areaFilter: val('fArea'),
    currentYear: new Date().getFullYear(),
  };
  if(layer === 'condo'){
    c.tierVal = val('fTier');
    c.sp = parseR(val('fSalePsf'));
    c.rn = parseR(val('fRent'));
    c.yr = parseR(val('fYear'));
    c.sz = parseR(val('fSize'));
    c.age = parseR(val('fAge'));
    c.statusFilter = val('fStatus');
    c.showAwardOnly = showAwardOnly;
  } else if(layer === 'school'){
    c.schoolAge = val('fSchoolAge') === '' ? null : parseInt(val('fSchoolAge'), 10);
    c.curriculum = val('fCurriculum');
    c.fee = parseR(val('fFee'));
  } else {
    c.nla = parseR(val('fNla'));
    c.openYear = parseR(val('fOpenYear'));
    c.anchorQ = val('fAnchor').toLowerCase();
  }
  return c;
}

export function applyFilters(){
  const crit = readCriteria();
  setFiltered(CONDOS.filter(c => matchesFilters(c, crit)));
  doSort(); rebuild(); renderList(); updateSummary(); renderChips();
}

export function doSort(){
  filtered.sort(comparatorFor(currentSort));
}

// ============================================================
// LAYER CONTROL
// ============================================================
export function setLayer(layer){
  if(!LAYER_CONTROLS[layer] || layer === activeLayer) { syncLayerUI(); return; }
  setActiveLayer(layer);
  // Keep the chosen order when the new layer also offers it, otherwise fall
  // back to that layer's default (e.g. "家賃 安い順" has no meaning for schools).
  if(!sortAvailable(layer, currentSort)) setCurrentSort(defaultSortFor(layer));
  syncLayerUI();
  applyFilters();
  // A layer switch refines the current view rather than navigating to a new
  // one, so it replaces the history entry instead of stacking one.
  syncUrl({ replace: true });
}

/**
 * The curriculum options come from the domain constant, so the dropdown can
 * never drift from what matchesCurriculum() actually knows about.
 */
function populateCurriculum(){
  const sel = $('fCurriculum');
  if(!sel || sel.dataset.filled) return;
  const keep = sel.value;
  sel.innerHTML = '<option value="">すべて</option>' +
    CURRICULA.map(c => `<option value="${c}">${c}</option>`).join('');
  sel.value = keep;
  sel.dataset.filled = '1';
}

/** Show the controls of the active layer, hide the others, rebuild the sort select. */
export function syncLayerUI(){
  populateCurriculum();
  document.querySelectorAll('.seg-btn').forEach(b => {
    const on = b.dataset.layer === activeLayer;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  document.querySelectorAll('[data-layer-only]').forEach(el => {
    el.style.display = el.dataset.layerOnly === activeLayer ? '' : 'none';
  });
  const more = $('moreFilters');
  if(more) more.style.display = moreOpen ? '' : 'none';
  const mt = $('moreToggle');
  if(mt) mt.innerHTML = '絞り込み ' + (moreOpen ? '⌃' : '⌄');
  // Sort options follow the layer
  const sel = $('fSort');
  if(sel){
    sel.innerHTML = SORT_OPTIONS[activeLayer]
      .map(o => `<option value="${o.value}">${o.label}</option>`).join('');
    sel.value = currentSort;
  }
  syncAwardBtn();
}

export function toggleMore(){
  setMoreOpen(!moreOpen);
  syncLayerUI();
}

// ============================================================
// SORT / SEARCH / AWARD
// ============================================================
export function setSort(sel){
  setCurrentSort(sel.value);
  doSort(); renderList();
}

export function clearSearch(){
  const el = $('fSearch');
  if(el) el.value = '';
  applyFilters();
}

function syncAwardBtn(){
  const b = $('toggleAward');
  if(!b) return;
  b.classList.toggle('active', showAwardOnly);
  b.setAttribute('aria-pressed', showAwardOnly ? 'true' : 'false');
  b.innerHTML = (showAwardOnly ? '✓ ' : '') + '🏆 受賞のみ';
}

export function toggleAward(){
  setShowAwardOnly(!showAwardOnly);
  syncAwardBtn();
  applyFilters();
}

// ============================================================
// ACTIVE FILTER CHIPS — one per applied filter, each removable
// ============================================================
/** @returns {{id:string,label:string}[]} the filters currently narrowing the list. */
export function activeChips(){
  const chips = [];
  const q = val('fSearch');
  if(q) chips.push({ id: 'fSearch', label: '検索: ' + q });
  (LAYER_CONTROLS[activeLayer] || []).forEach(([id, label]) => {
    const el = $(id);
    if(!el || !el.value) return;
    const text = el.tagName === 'SELECT'
      ? (el.selectedOptions[0] ? el.selectedOptions[0].textContent : el.value)
      : el.value;
    chips.push({ id, label: label + ': ' + text });
  });
  if(activeLayer === 'condo' && showAwardOnly) chips.push({ id: 'toggleAward', label: '🏆 受賞のみ' });
  return chips;
}

function chipsHtml(chips){
  if(!chips.length) return '';
  let h = chips.map(c =>
    `<span class="fchip">${esc(c.label)}<button type="button" class="fchip-x" aria-label="${esc(c.label)}を解除" onclick="removeFilter('${jsStr(c.id)}')">✕</button></span>`
  ).join('');
  if(chips.length >= 2) h += `<button type="button" class="fchip-clear" onclick="clearAllFilters()">すべてクリア</button>`;
  return h;
}

export function renderChips(){
  const el = $('filterChips');
  if(!el) return;
  const chips = activeChips();
  el.innerHTML = chipsHtml(chips);
  el.style.display = chips.length ? '' : 'none';
}

export function removeFilter(id){
  if(id === 'toggleAward'){ setShowAwardOnly(false); syncAwardBtn(); }
  else { const el = $(id); if(el) el.value = ''; }
  applyFilters();
}

export function clearAllFilters(){
  const search = $('fSearch');
  if(search) search.value = '';
  setShowAwardOnly(false);
  syncAwardBtn();
  const ids = new Set();
  Object.values(LAYER_CONTROLS).forEach(list => list.forEach(([id]) => ids.add(id)));
  ids.forEach(id => { const el = $(id); if(el) el.value = ''; });
  applyFilters();
}

// ============================================================
// CARDS — one template per type (spec 2.5)
// A value that is missing or zero for its type is omitted, never printed as 0.
// ============================================================
function cardHead(c, badge, trailing){
  return `<div class="card-head">${badge}<span class="card-name">${esc(c.name)}</span>${trailing || ''}</div>` +
    (c.nameJa ? `<div class="card-ja">${esc(c.nameJa)}</div>` : '');
}

function condoCard(c){
  const tierColor = TIER_COLORS[c.luxTier] || '#999';
  const badge = `<span class="tier-badge" style="background:${tierColor}">${esc(c.luxTier)}</span>`;
  const award = c.fiabciAward
    ? `<span class="card-award" title="FIABCI MPA ${esc(c.fiabciAward.year)} ${esc(c.fiabciAward.category || '')}">🏆</span>` : '';
  const upcoming = c.status === 'upcoming';
  const hero = [];
  if(!upcoming && c.rentMin > 0 && c.rentMax > 0) hero.push(`RM ${num(c.rentMin)}–${num(c.rentMax)}/月`);
  if(!upcoming && c.salePsfMin > 0 && c.salePsfMax > 0) hero.push(`PSF ${num(c.salePsfMin)}–${num(c.salePsfMax)}`);
  const meta = [];
  if(c.year) meta.push(upcoming ? `${c.year}年完成予定` : `${c.year}年`);
  if(c.units > 0) meta.push(`${num(c.units)} units`);
  if(c.sizeMin > 0 && c.sizeMax > 0) meta.push(`${num(c.sizeMin)}–${num(c.sizeMax)} sf`);
  return cardHead(c, badge + award, '') +
    (hero.length ? `<div class="card-hero">${hero.join(' ・ ')}</div>`
                 : (upcoming ? `<div class="card-hero card-hero-muted">価格 未定</div>` : '')) +
    `<div class="card-addr">${esc(c.addr)}</div>` +
    (meta.length ? `<div class="card-meta">${esc(meta.join(' ・ '))}</div>` : '') +
    (c.luxScore > 0 ? `<div class="card-score">Luxury ${c.luxScore}</div>` : '');
}

function schoolCard(c){
  const badge = `<span class="type-badge type-school">🎓</span>`;
  const cur = c.curriculum || '';
  const chip = cur ? `<span class="card-chip chip-school">${esc(cur)}</span>` : '';
  let hero = '';
  if(c.sizeMin > 0 && c.sizeMax > 0) hero = `学費 RM ${num(c.sizeMin)}–${num(c.sizeMax)}/年`;
  else if(c.sizeMin > 0) hero = `学費 RM ${num(c.sizeMin)}〜/年`;
  else hero = '学費 要問合せ';
  const meta = [];
  if(c.year) meta.push(`${c.year}年設立`);
  if(c.units > 0) meta.push(`生徒数 ${num(c.units)}名`);
  if(c.ageRange) meta.push(`${c.ageRange}歳`);
  return cardHead(c, badge, chip) +
    `<div class="card-hero">${hero}</div>` +
    `<div class="card-addr">${esc(c.addr)}</div>` +
    (meta.length ? `<div class="card-meta">${esc(meta.join(' ・ '))}</div>` : '');
}

function commercialCard(c){
  const badge = `<span class="type-badge type-commercial">🛒</span>`;
  const hero = [];
  if(c.sizeMin > 0) hero.push(`NLA ${num(c.sizeMin)} sf`);
  if(c.units > 0) hero.push(`${num(c.units)}店`);
  const meta = [];
  if(c.year) meta.push(`${c.year}年開業`);
  const anchors = (c.anchorTenants || '').split(';').map(s => s.trim()).filter(Boolean).slice(0, 2);
  if(anchors.length) meta.push(anchors.join(' ・ '));
  return cardHead(c, badge, '') +
    (hero.length ? `<div class="card-hero">${hero.join(' ・ ')}</div>` : '') +
    `<div class="card-addr">${esc(c.addr)}</div>` +
    (meta.length ? `<div class="card-meta">${esc(meta.join(' ・ '))}</div>` : '');
}

/**
 * The inside of a card, chosen by the record's type. Pure: same record in,
 * same HTML out — no DOM, no state. That is what the card tests exercise.
 */
export function cardBodyHtml(c){
  const layer = recordLayer(c);
  return layer === 'school' ? schoolCard(c) : layer === 'commercial' ? commercialCard(c) : condoCard(c);
}

export function cardHtml(c){
  return `<div class="condo-card ${selectedCondo === c.name ? 'selected' : ''}" onclick="selectCondo('${jsStr(c.name)}')">${cardBodyHtml(c)}</div>`;
}

function emptyStateHtml(){
  const chips = activeChips();
  return `<div class="empty-state">
    <div class="empty-title">条件に合う${LAYER_LABELS[activeLayer]}がありません</div>
    <div class="empty-sub">適用中の絞り込み:</div>
    <div class="empty-chips">${chips.length ? chipsHtml(chips) : '<span class="empty-none">なし（この層にデータがありません）</span>'}</div>
    <button type="button" class="btn-clear-all" onclick="clearAllFilters()">すべてクリア</button>
  </div>`;
}

export function renderList(){
  const el = $('condoList');
  if(!el) return;
  el.innerHTML = filtered.length ? filtered.map(cardHtml).join('') : emptyStateHtml();
}

// ============================================================
// SUMMARY — the four tiles follow the active layer
// ============================================================
const median = (arr) => {
  const s = arr.filter(v => v > 0).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

export function updateSummary(){
  const total = CONDOS.filter(c => recordLayer(c) === activeLayer).length;
  $('sumTotal').textContent = num(total);
  $('sumFiltered').textContent = num(filtered.length);
  $('totalCount').textContent = num(total);

  let l3 = 'Med.PSF', l4 = 'Med.Rent', v3 = '-', v4 = '-';
  if(activeLayer === 'condo'){
    const ms = median(filtered.map(c => c.salePsfMid || 0));
    const mr = median(filtered.map(c => c.rentPsfMid || 0));
    v3 = ms ? 'RM ' + num(Math.round(ms)) : '-';
    v4 = mr ? 'RM ' + mr.toFixed(2) : '-';
    if(ms) $('medianPsf').textContent = 'RM ' + num(Math.round(ms));
  } else if(activeLayer === 'school'){
    l3 = '学費中央値'; l4 = '生徒数合計';
    const mf = median(filtered.map(c => c.sizeMin || 0));
    const st = filtered.reduce((s, c) => s + (c.units || 0), 0);
    v3 = mf ? 'RM ' + num(mf) : '-';
    v4 = st ? num(st) : '-';
  } else {
    l3 = 'NLA中央値'; l4 = 'テナント数';
    const mn = median(filtered.map(c => c.sizeMin || 0));
    const tn = filtered.reduce((s, c) => s + (c.units || 0), 0);
    v3 = mn ? num(mn) + ' sf' : '-';
    v4 = tn ? num(tn) : '-';
  }
  $('sumStat3').textContent = v3;
  $('sumStat4').textContent = v4;
  $('sumStat3Label').textContent = l3;
  $('sumStat4Label').textContent = l4;
}

export function togglePanel(){
  const p = $('panel'), b = $('toggleBtn');
  const isMobile = window.innerWidth <= 768;
  p.classList.toggle('collapsed'); b.classList.toggle('collapsed');
  b.innerHTML = p.classList.contains('collapsed') ? (isMobile ? '&#9650;' : '&#9654;') : (isMobile ? '&#9660;' : '&#9664;');
  setTimeout(() => map.invalidateSize(), 300);
}
