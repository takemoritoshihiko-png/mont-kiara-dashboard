// Side panel: layer control, per-layer filters, sort, the list and the summary.
import {
  CONDOS, filtered, setFiltered, selectedCondo, currentSort, setCurrentSort,
  activeLayer, setActiveLayer, moreOpen, setMoreOpen,
  showAwardOnly, setShowAwardOnly, showKidOkOnly, setShowKidOkOnly,
  showWantOnly, setShowWantOnly, showUndoneOnly, setShowUndoneOnly,
  appMode, setAppMode, homeLayer, setHomeLayer, listView, setListView,
  diningNear, setDiningNear, dayBudgetBasis, setDayBudgetBasis,
} from '../state.js';
import { TIER_COLORS, MICHELIN_BADGES } from '../data/inline.js';
import {
  parseR, matchesFilters, recordLayer, LAYER_LABELS, CURRICULA,
  CAT_GROUPS, MICHELIN_FILTERS, VENUE_TYPES, diningPriceCeiling, budgetBasisOf,
} from '../domain/filter.js';
import { sortOptionsFor, comparatorFor, defaultSortFor, sortAvailable } from '../domain/sort.js';
import { map, rebuild } from './map.js';
import { syncUrl } from './urlState.js';
import {
  eatoutActive, eatoutCardExtraHtml, eatoutCardScoreHtml, eatoutListHtml,
  isVisited, personalMap, renderSaveBar, toast,
} from './dining.js';

const $ = (id) => document.getElementById(id);
const val = (id) => { const el = $(id); return el ? el.value : ''; };
// Every user-facing number goes through this: thousands separators everywhere,
// no exceptions (audit C5). Shared with info.js and schoolFinder.js.
export const num = (n) => Number(n).toLocaleString('en-US');
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
  // The dining layer has its own エリア control (fDiningArea): its areas are the
  // ledger's curated values, not the condo areas fArea offers. See the comment
  // in matchesFilters() for why the two must not be shared.
  dining: [
    ['fCatGroup', 'カテゴリ'], ['fMichelin', 'ミシュラン'], ['fPriceBand', '価格帯'],
    ['fDiningArea', 'エリア'], ['fVenueType', '施設'],
  ],
};

/**
 * 昼 or 夜 — the single basis every budget reader uses this render.
 *
 * The price band, the budget sort and the 予算中央値 tile all call THIS, so
 * 「安い順に並べたのに価格帯フィルタは別の値を見ていた」 is not expressible.
 * test/uxDining.test.js holds that invariant.
 */
export function currentBudgetBasis(){ return budgetBasisOf(dayBudgetBasis); }

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
  } else if(layer === 'dining'){
    c.catGroup = val('fCatGroup');
    c.michelin = val('fMichelin');
    c.priceBand = val('fPriceBand');
    c.priceBasis = currentBudgetBasis();
    c.diningArea = val('fDiningArea');
    // 「近く: Mont Kiara」 lives in state, not in a control: it is set by the
    // map's area jump, and the chip is what removes it again.
    c.near = diningNear;
    c.venueType = val('fVenueType');
    c.kidOnly = showKidOkOnly;
    // The two personal conditions exist only in 外食モード, and the record map
    // is handed to the (pure) filter rather than read inside it.
    if(eatoutActive()){
      c.wantOnly = showWantOnly;
      c.undoneOnly = showUndoneOnly;
      if(showWantOnly || showUndoneOnly) c.personal = personalMap();
    }
  } else {
    c.nla = parseR(val('fNla'));
    c.openYear = parseR(val('fOpenYear'));
    c.anchorQ = val('fAnchor').toLowerCase();
  }
  return c;
}

let searchTimer = null;
/** 検索欄用: 1文字ごとに全マーカーを再生成しない（150ms合流） */
export function applyFiltersDebounced(){
  clearTimeout(searchTimer);
  searchTimer = setTimeout(applyFilters, 150);
}

export function applyFilters(){
  const crit = readCriteria();
  setFiltered(CONDOS.filter(c => matchesFilters(c, crit)));
  doSort(); rebuild(); renderList(); updateSummary(); renderChips(); renderSaveBar();
  // Filters are screen state too: keep the address bar in sync so a shared
  // link reproduces the narrowed view (replace — a filter tweak refines the
  // current view, it is not navigation).
  syncUrl({ replace: true });
}

export function doSort(){
  filtered.sort(comparatorFor(currentSort, currentBudgetBasis()));
}

// ============================================================
// LAYER CONTROL
// ============================================================
export function setLayer(layer){
  // 飲食 is not a 住まいモード layer (2026-08-07 ruling): anything that asks
  // for it there — an old ?layer=dining link, a dining row on the 周辺 tab —
  // is really asking for 外食モード, so go there instead of refusing.
  if(layer === 'dining' && appMode !== 'eatout'){
    setMode('eatout');
    // The whole chrome just changed under the user - say so (audit: silent
    // mode switch was the most disorienting single event in the app).
    toast('外食モードに切り替えました（右上の「住まい」で戻れます）');
    return;
  }
  if(!LAYER_CONTROLS[layer] || layer === activeLayer) { syncLayerUI(); return; }
  setActiveLayer(layer);
  // Keep the chosen order when the new layer also offers it, otherwise fall
  // back to that layer's default (e.g. "家賃 安い順" has no meaning for schools).
  if(!sortAvailable(layer, currentSort, appMode)) setCurrentSort(defaultSortFor(layer, appMode));
  syncLayerUI();
  applyFilters();
  // A layer switch refines the current view rather than navigating to a new
  // one, so it replaces the history entry instead of stacking one.
  syncUrl({ replace: true });
}

// ============================================================
// MODE — 住まい / 外食 (D4)
// ============================================================
/**
 * Switch the whole app between the two modes.
 *
 * 外食モード pins the layer to 飲食 (that is what the mode IS) and remembers the
 * layer you came from, so leaving it puts you back where you were rather than
 * on an arbitrary default. The personal record UI appears and disappears with
 * the mode and nowhere else — 住まいモード never shows it.
 *
 * @param {string} mode  'home' | 'eatout'
 * @param {{silent?: boolean}} [opts]  skip the URL write (restoring from a URL)
 */
export function setMode(mode, { silent = false } = {}){
  const next = mode === 'eatout' ? 'eatout' : 'home';
  if(next === appMode){ syncLayerUI(); return; }
  if(next === 'eatout'){
    setHomeLayer(activeLayer);
    setAppMode('eatout');
    setActiveLayer('dining');
    setListView('ledger');
    // 台帳スコア順 is only offered here, and here it is the point of the list.
    setCurrentSort(defaultSortFor('dining', 'eatout'));
  } else {
    setAppMode('home');
    setListView('ledger');
    setActiveLayer(homeLayer || 'condo');
    if(!sortAvailable(activeLayer, currentSort, 'home')) setCurrentSort(defaultSortFor(activeLayer, 'home'));
  }
  // The headline follows the mode — the audit flagged reading 「住まいマップ」
  // above a restaurant ledger as quiet disorientation.
  const h1 = document.querySelector('.header h1');
  if(h1 && h1.firstChild) h1.firstChild.textContent = next === 'eatout' ? 'KL 外食台帳 ' : 'KL・ペナン 住まいマップ ';
  syncLayerUI();
  applyFilters();
  if(!silent) syncUrl({ replace: true });
}

/** 台帳 / 行った店 / データ — the three views of 外食モード. */
export function setView(view){
  const next = ['ledger', 'log', 'data'].includes(view) ? view : 'ledger';
  if(next === listView){ syncLayerUI(); return; }
  setListView(next);
  syncLayerUI();
  // 行った店 and データ read the records rather than the filters, but the map
  // and the summary still follow the 台帳's result set, so nothing is stale
  // when you come back.
  applyFilters();
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

/**
 * The 飲食 layer's three fixed dropdowns come from the domain constants (same
 * reason as populateCurriculum: the options cannot drift from what the filter
 * knows). The エリア dropdown instead comes from the DATA — 20 curated areas is
 * too many to keep in sync by hand — ordered by how many restaurants each has,
 * so the areas you are most likely to want are at the top.
 *
 * Called from syncLayerUI(), which runs again once the JSON has landed; until
 * then there is nothing to build from and this is a no-op.
 */
function populateDiningFilters(){
  const cat = $('fCatGroup');
  if(cat && !cat.dataset.filled){
    const keep = cat.value;
    cat.innerHTML = '<option value="">すべて</option>' +
      CAT_GROUPS.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('');
    cat.value = keep;
    cat.dataset.filled = '1';
  }
  const mic = $('fMichelin');
  if(mic && !mic.dataset.filled){
    const keep = mic.value;
    mic.innerHTML = '<option value="">すべて</option>' +
      MICHELIN_FILTERS.map(o => `<option value="${o.value}">${esc(o.label)}</option>`).join('');
    mic.value = keep;
    mic.dataset.filled = '1';
  }
  const vt = $('fVenueType');
  if(vt && !vt.dataset.filled){
    const keep = vt.value;
    vt.innerHTML = '<option value="">すべて</option>' +
      VENUE_TYPES.map(o => `<option value="${o.value}">${esc(o.label)}</option>`).join('');
    vt.value = keep;
    vt.dataset.filled = '1';
  }
  const area = $('fDiningArea');
  if(area && !area.dataset.filled){
    const counts = new Map();
    CONDOS.filter(c => recordLayer(c) === 'dining' && c.area)
      .forEach(c => counts.set(c.area, (counts.get(c.area) || 0) + 1));
    if(!counts.size) return;   // data has not arrived yet
    const keep = area.value;
    area.innerHTML = '<option value="">すべて</option>' +
      [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([k, n]) => `<option value="${esc(k)}">${esc(k)} (${n})</option>`).join('');
    area.value = keep;
    area.dataset.filled = '1';
  }
}

/**
 * True when the panel is showing a LIST of records — always in 住まいモード, and
 * in 外食モード only on the 台帳 view. The search box, the filters, the sort, the
 * chips and the summary tiles all belong to a list and are hidden without one.
 */
export function isLedgerView(){ return !eatoutActive() || listView === 'ledger'; }

/** A segmented control: one button carries `active` + aria-selected. */
function syncSeg(selector, dataKey, current){
  document.querySelectorAll(selector).forEach(b => {
    const on = b.dataset[dataKey] === current;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}

/** Show the controls of the active layer, hide the others, rebuild the sort select. */
export function syncLayerUI(){
  populateCurriculum();
  populateDiningFilters();
  const eatout = eatoutActive();
  // 台帳 view is the only one that lists records; the other two read the
  // records directly and have no use for a filter, a sort or a summary.
  const ledgerView = isLedgerView();

  syncSeg('.mode-btn', 'mode', appMode);
  syncSeg('.seg-btn', 'layer', activeLayer);
  syncSeg('.view-btn', 'view', listView);
  // The two segmented controls share one slot: 外食モード has no layers to
  // choose (it IS the 飲食 layer), so its three views take the row instead.
  const layerSeg = $('layerSeg'), viewSeg = $('viewSeg');
  if(layerSeg) layerSeg.style.display = eatout ? 'none' : '';
  if(viewSeg) viewSeg.style.display = eatout ? '' : 'none';

  // `data-layer-only` takes one layer or a comma-separated list: the エリア row
  // belongs to three layers but not to 飲食, which has its own area control.
  document.querySelectorAll('[data-layer-only]').forEach(el => {
    const owners = el.dataset.layerOnly.split(',');
    el.style.display = (ledgerView && owners.includes(activeLayer)) ? '' : 'none';
  });
  // 外食モード-only rows (the personal condition toggles) never appear on the
  // public dashboard, whatever the layer.
  document.querySelectorAll('[data-mode-only]').forEach(el => {
    el.style.display = (ledgerView && el.dataset.modeOnly === appMode) ? '' : 'none';
  });
  const searchRow = $('searchRow');
  if(searchRow) searchRow.style.display = ledgerView ? '' : 'none';
  const sortRow = $('sortRow');
  if(sortRow) sortRow.style.display = ledgerView ? '' : 'none';
  const summary = $('summaryBar');
  if(summary) summary.style.display = ledgerView ? '' : 'none';

  const more = $('moreFilters');
  if(more) more.style.display = (moreOpen && ledgerView) ? '' : 'none';
  const mt = $('moreToggle');
  if(mt){
    mt.style.display = ledgerView ? '' : 'none';
    mt.innerHTML = moreOpen ? '－ 絞り込みを閉じる' : '＋ もっと絞り込む';
    // The chevron says "open" to a sighted user; aria-expanded says it to
    // everyone else. They are set together so they cannot disagree.
    mt.setAttribute('aria-expanded', moreOpen ? 'true' : 'false');
  }
  // Sort options follow the layer — and the mode, because 台帳スコア順 exists
  // only where the score is on screen.
  const sel = $('fSort');
  if(sel){
    // …and the basis, so 「予算 安い順（昼基準）」 says which sitting it ran on
    // instead of silently meaning something else once the toggle is pressed.
    sel.innerHTML = sortOptionsFor(activeLayer, appMode, currentBudgetBasis())
      .map(o => `<option value="${o.value}">${o.label}</option>`).join('');
    sel.value = currentSort;
  }
  syncAwardBtn();
  syncKidOkBtn();
  syncDayBudgetBtn();
  syncWantBtn();
  syncUndoneBtn();
  renderSaveBar();
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
  b.innerHTML = '🏆 受賞のみ';
}

export function toggleAward(){
  setShowAwardOnly(!showAwardOnly);
  syncAwardBtn();
  applyFilters();
}

// 「👶 子連れ◎のみ」 is the dining layer's 受賞のみ: a one-way narrowing toggle,
// so it follows the same pattern rather than inventing a second one.
function syncKidOkBtn(){
  const b = $('toggleKidOk');
  if(!b) return;
  b.classList.toggle('active', showKidOkOnly);
  b.setAttribute('aria-pressed', showKidOkOnly ? 'true' : 'false');
  b.innerHTML = '👶 子連れ◎のみ';
}

export function toggleKidOk(){
  setShowKidOkOnly(!showKidOkOnly);
  syncKidOkBtn();
  applyFilters();
}

// 「☀ 昼の予算」 is NOT a narrowing toggle — it changes which figure 価格帯 /
// 並び替え / 予算中央値 all read. 昼夜を2つのフィルタに割るほうは却下済み: the
// list would then be ordered on one sitting and filtered on the other, and no
// label on screen could explain the result.
function syncDayBudgetBtn(){
  const b = $('toggleDayBudget');
  if(b){
    b.classList.toggle('active', dayBudgetBasis);
    b.setAttribute('aria-pressed', dayBudgetBasis ? 'true' : 'false');
  }
  // The 価格帯 caption carries the basis too: the dropdown's own values
  // (「RM50-150」) are read long after the toggle was pressed.
  const lab = $('fPriceBandLabel');
  if(lab) lab.textContent = dayBudgetBasis ? '価格帯 (1人・昼基準)' : '価格帯 (1人・夜基準)';
}

export function toggleDayBudget(){
  setDayBudgetBasis(!dayBudgetBasis);
  // Through syncLayerUI(), not syncDayBudgetBtn() alone: the sort option
  // LABELS carry the basis too and have to be rebuilt with it.
  syncLayerUI();
  applyFilters();
}

// 「★ 行きたい」「まだ行っていない」 — 外食モードだけの2つ。v9 held these in a
// single-choice condition group, so 「行きたいのにまだ行っていない店」 — the one
// question you actually open the app with — could not be asked (欠陥4). They are
// two independent toggles here and they combine.
function syncWantBtn(){
  const b = $('toggleWant');
  if(!b) return;
  b.classList.toggle('active', showWantOnly);
  b.setAttribute('aria-pressed', showWantOnly ? 'true' : 'false');
  b.innerHTML = (showWantOnly ? '♥' : '♡') + ' 行きたい';
}

export function toggleWantFilter(){
  setShowWantOnly(!showWantOnly);
  syncWantBtn();
  applyFilters();
}

function syncUndoneBtn(){
  const b = $('toggleUndone');
  if(!b) return;
  b.classList.toggle('active', showUndoneOnly);
  b.setAttribute('aria-pressed', showUndoneOnly ? 'true' : 'false');
  b.innerHTML = '未訪問';
}

export function toggleUndoneFilter(){
  setShowUndoneOnly(!showUndoneOnly);
  syncUndoneBtn();
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
  // 「近く」 has no control of its own — the area jump sets it — so the chip is
  // the ONLY thing that says it is on and the only way to turn it off.
  if(activeLayer === 'dining' && diningNear){
    chips.push({ id: 'diningNear', label: `近く: ${diningNear.label || 'この辺'}（${diningNear.km || ''}km）` });
  }
  // Not a narrowing filter but it changes what 価格帯 means, and the toggle
  // that set it lives inside the folded 絞り込み — without a chip the basis is
  // invisible from the list.
  if(activeLayer === 'dining' && dayBudgetBasis) chips.push({ id: 'toggleDayBudget', label: '☀ 昼の予算' });
  if(activeLayer === 'dining' && showKidOkOnly) chips.push({ id: 'toggleKidOk', label: '👶 子連れ◎のみ' });
  if(eatoutActive() && showWantOnly) chips.push({ id: 'toggleWant', label: '★ 行きたい' });
  if(eatoutActive() && showUndoneOnly) chips.push({ id: 'toggleUndone', label: '未訪問' });
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
  // 行った店 / データ は絞り込みの結果ではないので、そこにチップを出すと
  // 「いま何で絞られているか」を嘘で説明することになる。
  el.style.display = (chips.length && isLedgerView()) ? '' : 'none';
}

export function removeFilter(id){
  if(id === 'toggleAward'){ setShowAwardOnly(false); syncAwardBtn(); }
  else if(id === 'toggleKidOk'){ setShowKidOkOnly(false); syncKidOkBtn(); }
  else if(id === 'toggleWant'){ setShowWantOnly(false); syncWantBtn(); }
  else if(id === 'toggleUndone'){ setShowUndoneOnly(false); syncUndoneBtn(); }
  else if(id === 'diningNear'){ setDiningNear(null); }
  // The map keeps the view it flew to — clearing the chip widens the LIST back
  // out, it does not undo the navigation (fArea behaves the same way).
  else if(id === 'toggleDayBudget'){ setDayBudgetBasis(false); syncLayerUI(); }
  else { const el = $(id); if(el) el.value = ''; }
  applyFilters();
}

export function clearAllFilters(){
  const search = $('fSearch');
  if(search) search.value = '';
  setShowAwardOnly(false);
  setShowKidOkOnly(false);
  setShowWantOnly(false);
  setShowUndoneOnly(false);
  setDiningNear(null);
  setDayBudgetBasis(false);
  syncAwardBtn();
  syncKidOkBtn();
  syncWantBtn();
  syncUndoneBtn();
  // Via syncLayerUI so the sort option labels lose 「（昼基準）」 with the basis.
  syncLayerUI();
  const ids = new Set();
  Object.values(LAYER_CONTROLS).forEach(list => list.forEach(([id]) => ids.add(id)));
  ids.forEach(id => { const el = $(id); if(el) el.value = ''; });
  applyFilters();
}

// ============================================================
// CARDS — one template per type (spec 2.5)
// A value that is missing or zero for its type is omitted, never printed as 0.
// ============================================================
function cardHead(c, badge, trailing, nameClass){
  return `<div class="card-head">${badge}` +
    `<span class="card-name${nameClass ? ' ' + nameClass : ''}">${esc(c.name)}</span>` +
    `${trailing || ''}</div>` +
    (c.nameJa ? `<div class="card-ja">${esc(c.nameJa)}</div>` : '');
}

// The hero line — the one number the card is built around — is computed apart
// from the markup so the card's accessible name can reuse it verbatim
// (cardAriaLabel below). One source, so the label can never describe a card
// differently from what the card shows.
/** @returns {string} plain text, '' when the record has nothing to lead with. */
function condoHeroText(c){
  // An unbuilt project has no price yet; whatever stale numbers a row carries
  // are not what will be asked for it.
  if(c.status === 'upcoming') return '価格 未定';
  const parts = [];
  if(c.rentMin > 0 && c.rentMax > 0) parts.push(`RM ${num(c.rentMin)}–${num(c.rentMax)}/月`);
  if(c.salePsfMin > 0 && c.salePsfMax > 0) parts.push(`PSF ${num(c.salePsfMin)}–${num(c.salePsfMax)}`);
  return parts.join(' ・ ');
}

function schoolHeroText(c){
  if(c.sizeMin > 0 && c.sizeMax > 0) return `学費 RM ${num(c.sizeMin)}–${num(c.sizeMax)}/年`;
  if(c.sizeMin > 0) return `学費 RM ${num(c.sizeMin)}〜/年`;
  return '学費 要問合せ';
}

function commercialHeroText(c){
  const parts = [];
  if(c.sizeMin > 0) parts.push(`NLA ${num(c.sizeMin)} sf`);
  if(c.units > 0) parts.push(`${num(c.units)}店`);
  return parts.join(' ・ ');
}

// ---- dining ----
/**
 * One price range as text. `[0, 0]` means the service is not offered (or the
 * price is unknown) and returns '' — a zero is never printed as a price.
 * A range whose ends are equal is one figure, not 「RM 334–334」.
 */
export function priceRangeText(range){
  const [lo, hi] = Array.isArray(range) ? range : [0, 0];
  if(!(hi > 0)) return '';
  return lo === hi ? `RM ${num(hi)}` : `RM ${num(lo)}–${num(hi)}`;
}

/**
 * 「昼 RM 334 ・ 夜 RM 682」 — what one person pays, which is the number you
 * choose a restaurant on.
 *
 * Two rules keep it honest: a service that is not offered is NAMED (「夜のみ」)
 * rather than priced at zero, and a place that charges the same at both
 * sittings (10 of the 50 do) says so once — printing the identical figure
 * twice is the "same information in two places" the visual system forbids.
 */
function diningHeroText(c){
  const lunch = priceRangeText(c.priceLunch);
  const dinner = priceRangeText(c.priceDinner);
  if(lunch && dinner) return lunch === dinner ? `昼夜 ${lunch}` : `昼 ${lunch} ・ 夜 ${dinner}`;
  if(dinner) return `夜のみ ${dinner}`;
  if(lunch) return `昼のみ ${lunch}`;
  return '予算 要確認';
}

/** 「★4.8 (1,178件)」 — the rating is meaningless without its sample size. */
export function ratingText(c){
  if(!(c.rating > 0)) return '';
  return `★${c.rating}` + (c.reviewCount > 0 ? ` (${num(c.reviewCount)}件)` : '');
}

/** The hero line of any record, chosen by its type. Pure. */
export function cardHeroText(c){
  const layer = recordLayer(c);
  return layer === 'school' ? schoolHeroText(c)
    : layer === 'commercial' ? commercialHeroText(c)
    : layer === 'dining' ? diningHeroText(c)
    : condoHeroText(c);
}

/**
 * What a screen reader reads out for a card. Name first — it is what you are
 * looking for — then the hero number, which is what you are comparing on.
 * The address, meta line and score are deliberately left out: that is what
 * opening the record is for, and a five-clause label is unusable at speed.
 */
export function cardAriaLabel(c){
  const hero = cardHeroText(c);
  return hero ? `${c.name}、${hero}` : String(c.name);
}

function condoCard(c){
  const tierColor = TIER_COLORS[c.luxTier] || '#999';
  const badge = `<span class="tier-badge" style="background:${tierColor}">${esc(c.luxTier)}</span>`;
  const award = c.fiabciAward
    ? `<span class="card-award" title="FIABCI MPA ${esc(c.fiabciAward.year)} ${esc(c.fiabciAward.category || '')}">🏆</span>` : '';
  const upcoming = c.status === 'upcoming';
  const hero = condoHeroText(c);
  const meta = [];
  if(c.year) meta.push(upcoming ? `${c.year}年完成予定` : `${c.year}年`);
  if(c.units > 0) meta.push(`${num(c.units)} units`);
  if(c.sizeMin > 0 && c.sizeMax > 0) meta.push(`${num(c.sizeMin)}–${num(c.sizeMax)} sf`);
  return cardHead(c, badge + award, '') +
    (hero ? `<div class="card-hero${upcoming ? ' card-hero-muted' : ''}">${hero}</div>` : '') +
    `<div class="card-addr">${esc(c.addr)}</div>` +
    (meta.length ? `<div class="card-meta">${esc(meta.join(' ・ '))}</div>` : '') +
    (c.luxScore > 0 ? `<div class="card-score">Luxury ${c.luxScore}</div>` : '');
}

function schoolCard(c){
  const badge = `<span class="type-badge type-school">🎓</span>`;
  const cur = c.curriculum || '';
  // The chip sits on its own line under the name. Sharing the line cost the
  // name 45% of the card and truncated 「Prince of Wales Island International
  // School (POWIIS) Tanjung Bungah」 to nothing useful; the school's identity
  // matters more than its curriculum.
  const chip = cur ? `<div class="card-chips"><span class="card-chip chip-school">${esc(cur)}</span></div>` : '';
  const hero = schoolHeroText(c);
  const meta = [];
  if(c.year) meta.push(`${c.year}年設立`);
  if(c.units > 0) meta.push(`生徒数 ${num(c.units)}名`);
  if(c.ageRange) meta.push(`${c.ageRange}歳`);
  // School names run long (「Prince of Wales Island International School (POWIIS)
  // Tanjung Bungah」) and there is no shorter form that still identifies the
  // campus, so they wrap to a second line instead of ending in an ellipsis.
  return cardHead(c, badge, '', 'card-name-wrap') + chip +
    `<div class="card-hero">${hero}</div>` +
    `<div class="card-addr">${esc(c.addr)}</div>` +
    (meta.length ? `<div class="card-meta">${esc(meta.join(' ・ '))}</div>` : '');
}

function commercialCard(c){
  const badge = `<span class="type-badge type-commercial">🛒</span>`;
  const hero = commercialHeroText(c);
  const meta = [];
  if(c.year) meta.push(`${c.year}年開業`);
  const anchors = (c.anchorTenants || '').split(';').map(s => s.trim()).filter(Boolean).slice(0, 2);
  if(anchors.length) meta.push(anchors.join(' ・ '));
  return cardHead(c, badge, '') +
    (hero ? `<div class="card-hero">${hero}</div>` : '') +
    `<div class="card-addr">${esc(c.addr)}</div>` +
    (meta.length ? `<div class="card-meta">${esc(meta.join(' ・ '))}</div>` : '');
}

function diningCard(c){
  const badge = `<span class="type-badge type-dining">🍽</span>`;
  const mb = MICHELIN_BADGES[c.michelin];
  // The michelin standing and the category sit on their own line under the
  // name, the same arrangement the school card uses: the name is what you are
  // looking for and must not be cut to half a card by chips beside it.
  const chips = [];
  if(mb) chips.push(`<span class="card-chip chip-michelin">${esc(mb)}</span>`);
  if(c.catGroup) chips.push(`<span class="card-chip chip-dining">${esc(c.catGroup)}</span>`);
  const hero = diningHeroText(c);
  const meta = [];
  // 外食モード prints the star with its sample size and its shrunk value on its
  // own line (ratingLineHtml), so repeating 「★4.8 (1,178件)」 here would be the
  // same information twice.
  const rating = eatoutActive() ? '' : ratingText(c);
  if(rating) meta.push(rating);
  if(c.area) meta.push(c.area);
  return eatoutCardScoreHtml(c) +
    cardHead(c, badge, '', 'card-name-wrap') +
    (chips.length ? `<div class="card-chips">${chips.join('')}</div>` : '') +
    `<div class="card-hero">${hero}</div>` +
    `<div class="card-addr">${esc(c.addr)}</div>` +
    (meta.length ? `<div class="card-meta">${esc(meta.join(' ・ '))}</div>` : '');
}

/**
 * The inside of a card, chosen by the record's type. Pure: same record in,
 * same HTML out — no DOM, no state. That is what the card tests exercise.
 */
export function cardBodyHtml(c){
  const layer = recordLayer(c);
  return layer === 'school' ? schoolCard(c)
    : layer === 'commercial' ? commercialCard(c)
    : layer === 'dining' ? diningCard(c)
    : condoCard(c);
}

/**
 * A card is a control, so it announces itself as one and answers Enter/Space
 * (the delegated handler in ui/a11y.js does the key part). It is not a native
 * <button> because a button cannot carry this block layout without a stack of
 * resets — role + tabindex buys the same semantics with none of that.
 */
export function cardHtml(c){
  const sel = selectedCondo === c.name ? ' selected' : '';
  // 外食モード hangs the record controls under the card. They must NOT sit
  // inside the role="button" element — a button containing buttons is not
  // operable by keyboard or screen reader — so the openable part becomes an
  // inner .card-main and the controls are its sibling.
  const extra = eatoutCardExtraHtml(c);
  const opener = `<div class="${extra ? 'card-main' : 'condo-card' + sel}" role="button" tabindex="0"` +
    ` aria-label="${esc(cardAriaLabel(c))}" onclick="selectCondo('${jsStr(c.name)}')">${cardBodyHtml(c)}</div>`;
  if(!extra) return opener;
  // 訪問済みの店は一覧で沈む（v9の .visited）。It dims the LISTING only: the
  // controls under it are what you came back to edit.
  return `<div class="condo-card record-card${sel}${isVisited(c) ? ' visited' : ''}">${opener}${extra}</div>`;
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
  // 外食モードの「行った店」「データ」は一覧ではないので、カードの代わりに
  // そのビューを描く。null が返れば通常のカード一覧（＝台帳／住まいモード）。
  const alt = eatoutListHtml();
  if(alt != null){ el.innerHTML = alt; return; }
  el.innerHTML = filtered.length ? filtered.map(cardHtml).join('') : emptyStateHtml();
}

// ============================================================
// LOADING SKELETON (spec 2.10 / audit E3)
// Four card-shaped placeholders instead of one line of text, so the panel keeps
// its shape while the CSVs arrive and the list does not jump when they land.
// ============================================================
const SKELETON_CARDS = 4;
/** @returns {string} the skeleton markup — pure, so it can be asserted on. */
export function skeletonHtml(n = SKELETON_CARDS){
  const card = '<div class="skel-card">' +
    '<div class="skel-line" style="width:70%"></div>' +
    '<div class="skel-line" style="width:45%;height:14px"></div>' +
    '<div class="skel-line" style="width:90%"></div>' +
    '</div>';
  return card.repeat(n);
}

/** Put the panel into its loading state: skeleton list, blank summary tiles. */
export function showLoading(){
  const el = $('condoList');
  if(el) el.innerHTML = skeletonHtml();
  ['sumTotal', 'sumFiltered', 'sumStat3', 'sumStat4']
    .forEach(id => { const t = $(id); if(t) t.textContent = TILE_EMPTY; });
}

// ============================================================
// SUMMARY — the four tiles follow the active layer
// ============================================================
const median = (arr) => {
  const s = arr.filter(v => v > 0).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

/** Placeholder shown in a tile with nothing to show (and while data loads). */
export const TILE_EMPTY = '–';

export function updateSummary(){
  // 「画面内」— what the map actually shows right now. The old tile said
  // 全件271 while 28% of the records sat off-screen at the initial view, and
  // before any filtering it just duplicated 表示中. main.js refreshes this on
  // every map moveend.
  const inView = (map && map.getBounds)
    ? filtered.filter(c => map.getBounds().contains([c.lat, c.lng])).length
    : filtered.length;
  $('sumTotal').textContent = num(inView);
  $('sumFiltered').textContent = num(filtered.length);

  let l3 = 'PSF中央値', l4 = '家賃中央値', v3 = TILE_EMPTY, v4 = TILE_EMPTY;
  if(activeLayer === 'condo'){
    // Median over PUBLISHED prices only — a null (unpublished) mid in the
    // population would drag the median toward zero for no real reason.
    const ms = median(filtered.map(c => c.salePsfMid).filter(v => v > 0));
    // MED.RENT is the median monthly rent in ringgit. It used to show the
    // median rent *per square foot* (「RM 2.75」) under a label that promised
    // the rent — a number nobody could interpret (audit C5).
    const mr = median(filtered.map(c => c.rentMid).filter(v => v > 0));
    v3 = ms ? 'RM ' + num(Math.round(ms)) : TILE_EMPTY;
    v4 = mr ? 'RM ' + num(Math.round(mr)) : TILE_EMPTY;
  } else if(activeLayer === 'school'){
    l3 = '学費中央値'; l4 = '生徒数合計';
    const mf = median(filtered.map(c => c.sizeMin || 0));
    const st = filtered.reduce((s, c) => s + (c.units || 0), 0);
    v3 = mf ? 'RM ' + num(mf) : TILE_EMPTY;
    v4 = st ? num(st) : TILE_EMPTY;
  } else if(activeLayer === 'dining'){
    if(eatoutActive()){
      // 外食モードの台帳ビューは「まだ行っていない店を探す」画面なので、
      // タイルは自分の記録の進み具合を出す。金額の集計は 行った店 ビューに
      // 一本化してある（母集団＝訪問済みのみ・v9の欠陥3の解消）ので、ここには
      // 出さない＝同じ数字を2箇所で組み立てない。
      l3 = '訪問済み'; l4 = '行きたい';
      const p = personalMap();
      const vis = filtered.filter(c => p[c.id] && p[c.id].v === 1).length;
      const want = filtered.filter(c => p[c.id] && p[c.id].w === 1).length;
      v3 = vis ? num(vis) : TILE_EMPTY;
      v4 = want ? num(want) : TILE_EMPTY;
    } else {
      l3 = '★中央値'; l4 = dayBudgetBasis ? '予算中央値(昼)' : '予算中央値';
      const mr = median(filtered.map(c => c.rating || 0));
      // Same figure AND same basis the 価格帯 filter and the budget sort use, so
      // the tile can never quote a price the list does not order by.
      const basis = currentBudgetBasis();
      const mp = median(filtered.map(c => diningPriceCeiling(c, basis)));
      v3 = mr ? mr.toFixed(1) : TILE_EMPTY;
      v4 = mp ? 'RM ' + num(mp) : TILE_EMPTY;
    }
  } else {
    l3 = 'NLA中央値'; l4 = 'テナント数';
    const mn = median(filtered.map(c => c.sizeMin || 0));
    const tn = filtered.reduce((s, c) => s + (c.units || 0), 0);
    v3 = mn ? num(mn) + ' sf' : TILE_EMPTY;
    v4 = tn ? num(tn) : TILE_EMPTY;
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
  const collapsed = p.classList.contains('collapsed');
  // Desktop: the panel slides RIGHT to close, so the closed state points
  // left ('bring it back') and the open state points right ('push it away').
  // While closed, the button also says what is hidden - layer + count.
  b.innerHTML = collapsed
    ? (isMobile ? '&#9650; 一覧' : `&#9664; ${LAYER_LABELS[activeLayer]} ${filtered.length}件`)
    : (isMobile ? '&#9660;' : '&#9654;');
  // The button's only content is an arrow glyph, which is no name at all — the
  // label and the expanded state are the whole of what a screen reader gets.
  b.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  b.setAttribute('aria-label', collapsed ? '一覧パネルを開く' : '一覧パネルを閉じる');
  setTimeout(() => map.invalidateSize(), 300);
}
