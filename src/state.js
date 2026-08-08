// Shared mutable application state.
//
// index.html originally kept these as top-level `let` bindings inside one
// classic <script>, so every function on the page saw the same variables.
// ES modules have no shared global scope, but ES module *live bindings* give
// the same semantics: importers always read the current value. Only writes
// have to go through the setters below.
export let CONDOS = [];
export let COMMERCIALS = [];
export let SCHOOLS = [];
export let SCHOOLS_DETAIL = {};
export let RESTAURANTS = [];

export let filtered = [];
export let markers = {};
export let selectedCondo = null;

// B3a: the active layer (物件 / 学校 / 商業) drives the list, the filters, the
// sort options, the summary tiles and which markers are drawn at full opacity.
export let activeLayer = 'condo';
// 2026-08-07 裁定: 層は単一選択タブでなくチェックボックス=複数を同時に地図表示。
// アクティブ層(一覧・フィルタが従う層)は常に表示に含まれる。
export let visibleLayers = { condo: true, school: false, commercial: false, dining: false };
// B3a-2: which tab of the detail overlay is open — 'detail' or 'nearby'.
// Part of the screen state, so it travels in the URL.
export let activeTab = 'detail';
export let currentSort = 'luxHigh';
// The order you last chose ON EACH LAYER, keyed by layer name.
//
// Without this a detour through another layer silently threw your order away:
// looking at 物件 in 「PSF 高い順」, tapping a 学校 on the 周辺 tab (学校 has no
// PSF order, so it fell back to 学費 安い順) and coming back to 物件 left you in
// 「おすすめ順」 — the list you had built was gone and nothing said so.
// Written only through setLastSortForLayer(); read by sortOnArrival().
export let lastSortByLayer = {};
// 「絞り込み ⌄」 open/closed. In memory only — deliberately not persisted.
export let moreOpen = false;

// D4: which of the two apps this is right now.
//   'home'   住まいモード — the published dashboard. No personal records, ever.
//   'eatout' 外食モード   — the layer is pinned to 飲食 and the private ledger
//                          (訪問済み・行きたい・実額・感想) appears.
// One codebase, two modes, because they answer two different questions with the
// same 50 restaurants. See docs/superpowers/specs/2026-08-07-dining-d4-plan.md.
export let appMode = 'home';
// The layer to come back to when 外食モード is left again.
export let homeLayer = 'condo';
// 外食モード's three views (v9's three tabs): 台帳 / 行った店 / データ.
export let listView = 'ledger';

export let showAwardOnly = false;
// 「👶 子連れ◎のみ」 — the dining layer's counterpart to showAwardOnly.
export let showKidOkOnly = false;
// D4: 「行きたい」「未訪問」are INDEPENDENT toggles, not one radio group — v9
// let you pick only one condition flag at a time (欠陥4), so "行きたいのに
// まだ行っていない店" could not be asked for at all.
export let showWantOnly = false;
export let showUndoneOnly = false;
export let showVisitedOnly = false;   // ✓行った店(旧・行った店ビューの代替 2026-08-08)
// Open by default on desktop — the legend is the only place the pin symbols
// are explained, and a first-time visitor needs it in the first screen.
// On a phone the same open legend covers two thirds of the map (measured in
// a real 390px render), so there it starts folded instead.
export let legendOpen = typeof window === 'undefined' || !window.matchMedia
  ? true : !window.matchMedia('(max-width: 768px)').matches;

// UX2: 「近く: Mont Kiara」 — the dining layer's distance filter, set by the
// area jump buttons. `{lat, lng, km, label}` or null. It is NOT the same axis
// as fDiningArea (the ledger's own area label): the labels name a district,
// this names a radius around where the map just flew to.
export let diningNear = null;
// UX2: 「昼の予算」. false = 夜基準 (the default). ONE flag, read by the price
// band, the budget sort and the 予算中央値 tile alike — see budgetBasisOf() in
// src/domain/filter.js for why there is no pair of 昼/夜 filters instead.
export let dayBudgetBasis = false;

export let sfActive = false;
export let sfSelectedSchool = null;

export function setCondos(v) { CONDOS = v; }
export function setCommercials(v) { COMMERCIALS = v; }
export function setSchools(v) { SCHOOLS = v; }
export function setSchoolsDetail(v) { SCHOOLS_DETAIL = v; }
export function setRestaurants(v) { RESTAURANTS = v; }
export function setFiltered(v) { filtered = v; }
export function setMarkers(v) { markers = v; }
export function setSelectedCondo(v) { selectedCondo = v; }
export function setCurrentSort(v) { currentSort = v; }
/** Remember `sort` as the order of `layer`. A new object, so the binding change
 *  is visible to importers the same way every other setter's is. */
export function setLastSortForLayer(layer, sort) {
  if (!layer || !sort) return;
  lastSortByLayer = { ...lastSortByLayer, [layer]: sort };
}
export function setActiveLayer(v) { activeLayer = v; if(visibleLayers[v] === false) visibleLayers = { ...visibleLayers, [v]: true }; }
export function setLayerVisible(layer, on) { if(layer in visibleLayers) visibleLayers = { ...visibleLayers, [layer]: !!on }; }
export function setActiveTab(v) { activeTab = v; }
export function setMoreOpen(v) { moreOpen = v; }
export function setShowAwardOnly(v) { showAwardOnly = v; }
export function setShowKidOkOnly(v) { showKidOkOnly = v; }
export function setShowWantOnly(v) { showWantOnly = v; }
export function setShowUndoneOnly(v) { showUndoneOnly = v; }
export function setShowVisitedOnly(v) { showVisitedOnly = v; }
export function setAppMode(v) { appMode = v; }
export function setHomeLayer(v) { homeLayer = v; }
export function setListView(v) { listView = v; }
export function setLegendOpen(v) { legendOpen = v; }
export function setDiningNear(v) { diningNear = v || null; }
export function setDayBudgetBasis(v) { dayBudgetBasis = !!v; }
export function setSfActive(v) { sfActive = v; }
export function setSfSelectedSchool(v) { sfSelectedSchool = v; }
