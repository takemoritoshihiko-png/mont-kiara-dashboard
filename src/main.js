// Entry point: boots the map, exposes the inline-handler globals and loads data.
import {
  CONDOS, COMMERCIALS, SCHOOLS, RESTAURANTS,
  setCondos, setCommercials, setSchools, setSchoolsDetail, setRestaurants, setFiltered,
} from './state.js';
import {
  CONDOS_CSV_URL, COMMERCIAL_CSV_URL, SCHOOLS_CSV_URL, SCHOOLS_DETAIL_URL, RESTAURANTS_URL,
  fetchText, parseCondosCsv, parseCommercialCsv, parseSchoolsCsv, parseRestaurants,
} from './data/load.js';
import { calcLuxury } from './domain/luxury.js';
import { calcLedgerScores } from './domain/diningScore.js';
import { initMap, jumpToArea, toggleLegend, togglePenangAreas } from './ui/map.js';
import {
  applyFilters, applyFiltersDebounced, setSort, setLayer, setMode, setView, syncLayerUI, toggleMore,
  toggleAward, toggleKidOk, toggleDayBudget, toggleWantFilter, toggleUndoneFilter,
  togglePanel, clearSearch, removeFilter, clearAllFilters, showLoading,
} from './ui/list.js';
import {
  setOnPersonalChange, dineVisit, dineWant, dineRepeat, dineAmount, dineMemo,
  dineImport, dineClearAll, dineDownload, dineSelectExport, renderSaveBar, toast,
} from './ui/dining.js';
import { initPersonal, flush, onPersonalChange } from './data/personal.js';
import { selectCondo, closeInfo, setInfoTab, selectNearby, applyUrlState } from './ui/info.js';
import { initA11y } from './ui/a11y.js';
import { readUrlState, withUrlWritesSuspended } from './ui/urlState.js';
import {
  toggleSchoolFinder, closeSchoolFinder, renderSchoolFinder, sfSelectSchool, sfSelectCondo,
} from './ui/schoolFinder.js';

// ============================================================
// GLOBALS FOR INLINE HANDLERS
// index.html still uses inline on* attributes (both in the static markup and
// in the HTML that renderList() / renderSchoolFinder() generate). Those run in
// global scope, so every function they name must live on `window`.
// B2/B3 will replace the inline attributes with addEventListener wiring; this
// block goes away then.
// ============================================================
window.jumpToArea = jumpToArea;
window.togglePenangAreas = togglePenangAreas;
window.toggleLegend = toggleLegend;
window.togglePanel = togglePanel;
window.applyFilters = applyFilters;
window.applyFiltersDebounced = applyFiltersDebounced;
window.setSort = setSort;
window.setLayer = setLayer;
window.setMode = setMode;
window.setView = setView;
window.toggleMore = toggleMore;
window.toggleAward = toggleAward;
window.toggleKidOk = toggleKidOk;
window.toggleDayBudget = toggleDayBudget;
window.toggleWantFilter = toggleWantFilter;
window.toggleUndoneFilter = toggleUndoneFilter;
// D4 外食モード: every one of these writes through src/data/personal.js and
// nothing else. They exist on window for the same reason the rest do — the
// generated card markup uses inline on* attributes.
window.dineVisit = dineVisit;
window.dineWant = dineWant;
window.dineRepeat = dineRepeat;
window.dineAmount = dineAmount;
window.dineMemo = dineMemo;
window.dineImport = dineImport;
window.dineClearAll = dineClearAll;
window.dineDownload = dineDownload;
window.dineSelectExport = dineSelectExport;
window.clearSearch = clearSearch;
window.removeFilter = removeFilter;
window.clearAllFilters = clearAllFilters;
window.selectCondo = selectCondo;
window.closeInfo = closeInfo;
window.setInfoTab = setInfoTab;
window.selectNearby = selectNearby;
window.toggleSchoolFinder = toggleSchoolFinder;
window.closeSchoolFinder = closeSchoolFinder;
window.renderSchoolFinder = renderSchoolFinder;
window.sfSelectSchool = sfSelectSchool;
// B3c: the nearby-condo rows used to run `sfActive=false;toggleSchoolFinder()`
// inline, which needed a writable window.sfActive accessor here — and flipped
// the flag the wrong way round (audit E2). They call this function now, so the
// accessor is gone: state is written through state.js and nowhere else.
window.sfSelectCondo = sfSelectCondo;

initMap();

// ============================================================
// 個人記録 (D4)
// The storage is probed BEFORE anything can be typed into it, so a browser
// that reads but refuses writes (private mode, a full quota) says so on the
// save bar instead of losing the first evening's notes in silence.
// ============================================================
const personal = initPersonal();
setOnPersonalChange(() => { applyFilters(); });
onPersonalChange(() => renderSaveBar());
if(!personal.writable && personal.error){
  // The save bar carries it permanently; the toast makes sure it is seen once.
  setTimeout(() => toast('⚠ ' + personal.error), 400);
}
// Nothing is lost on the way out: typed fields save on a 250ms debounce, and
// closing the tab can beat it.
['pagehide', 'beforeunload'].forEach(ev => window.addEventListener(ev, () => flush()));
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') flush(); });

// Build the sort options / show the condo layer's controls before any data
// arrives, so the panel is never in a half-wired state.
syncLayerUI();
// Enter/Space on the card-shaped controls, Escape on the overlay. One
// delegated listener, so it survives every re-render of the list.
initA11y();

// ============================================================
// URL = SCREEN STATE
// Back/forward walk the selection history. Restoration drives the same
// functions a click would, so URL writes are suspended while it runs —
// otherwise every popstate would push a new entry and back would never move.
// ============================================================
window.addEventListener('popstate', () => {
  withUrlWritesSuspended(() => applyUrlState(readUrlState()));
});

// ============================================================
// INIT: Fetch the data files, then render
// ============================================================
(async function init() {
  const listEl = document.getElementById('condoList');
  // The panel keeps its shape while the CSVs arrive (spec 2.10 / audit E3).
  showLoading();

  // Partial-load failures must NEVER be silent: collect and show them.
  const loadErrors = [];

  try {
    // Load condos (required — hard failure if missing)
    setCondos(parseCondosCsv(await fetchText(CONDOS_CSV_URL)));
    if (CONDOS.length === 0) throw new Error('No condo data parsed');
    calcLuxury(CONDOS);

    // Load commercial
    try {
      setCommercials(parseCommercialCsv(await fetchText(COMMERCIAL_CSV_URL)));
    } catch(e) { setCommercials([]); loadErrors.push('商業施設データ (commercial_data.csv): ' + e.message); }

    // Load schools
    try {
      setSchools(parseSchoolsCsv(await fetchText(SCHOOLS_CSV_URL)));
    } catch(e) { setSchools([]); loadErrors.push('学校データ (schools_data.csv): ' + e.message); }

    // Load school details
    try {
      setSchoolsDetail(JSON.parse(await fetchText(SCHOOLS_DETAIL_URL)));
    } catch(e) { setSchoolsDetail({}); loadErrors.push('学校詳細 (schools_detail.json): ' + e.message); }

    // Load restaurants (dining layer, D3)
    try {
      setRestaurants(parseRestaurants(await fetchText(RESTAURANTS_URL)));
      // 台帳スコアは台帳全体の平均★を必要とするので、全件そろってから一度だけ
      // 計算してレコードに焼き付ける（calcLuxury と同じやり方）。
      calcLedgerScores(RESTAURANTS);
    } catch(e) { setRestaurants([]); loadErrors.push('飲食店データ (restaurants.json): ' + e.message); }

    // Merge for display
    setCondos([...CONDOS, ...COMMERCIALS, ...SCHOOLS, ...RESTAURANTS]);
    setFiltered([...CONDOS]);
    // The 飲食 layer's エリア dropdown is built from the data that just landed,
    // so the controls are re-synced once before the first render.
    syncLayerUI();
    applyFilters();

    // A shared link only becomes reproducible once the data it names exists.
    withUrlWritesSuspended(() => applyUrlState(readUrlState()));

    if (loadErrors.length > 0) {
      const warn = document.createElement('div');
      warn.className = 'load-warn';
      warn.innerHTML = '<b>⚠ 一部のデータを読み込めませんでした</b><br>' +
        loadErrors.map(m => '・' + m).join('<br>') +
        '<br>表示中の件数は不完全です。通信環境をご確認のうえ、再読み込みしてください。 <button onclick="location.reload()" style="cursor:pointer">再読み込み</button>';
      listEl.parentNode.insertBefore(warn, listEl);
    }
  } catch(e) {
    listEl.innerHTML = '<div class="load-error">データを読み込めませんでした: ' + e.message +
      '<br><br><small>リポジトリのCSVファイルを確認してください。</small></div>';
  }
})();
