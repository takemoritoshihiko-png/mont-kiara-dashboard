// Entry point: boots the map, exposes the inline-handler globals and loads data.
import {
  CONDOS, COMMERCIALS, SCHOOLS,
  setCondos, setCommercials, setSchools, setSchoolsDetail, setFiltered,
} from './state.js';
import {
  CONDOS_CSV_URL, COMMERCIAL_CSV_URL, SCHOOLS_CSV_URL, SCHOOLS_DETAIL_URL,
  fetchText, parseCondosCsv, parseCommercialCsv, parseSchoolsCsv,
} from './data/load.js';
import { calcLuxury } from './domain/luxury.js';
import { initMap, jumpToArea, toggleLegend } from './ui/map.js';
import {
  applyFilters, setSort, setLayer, syncLayerUI, toggleMore, toggleAward, togglePanel,
  clearSearch, removeFilter, clearAllFilters, showLoading,
} from './ui/list.js';
import { selectCondo, closeInfo, setInfoTab, selectNearby, applyUrlState } from './ui/info.js';
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
window.toggleLegend = toggleLegend;
window.togglePanel = togglePanel;
window.applyFilters = applyFilters;
window.setSort = setSort;
window.setLayer = setLayer;
window.toggleMore = toggleMore;
window.toggleAward = toggleAward;
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
// Build the sort options / show the condo layer's controls before any data
// arrives, so the panel is never in a half-wired state.
syncLayerUI();

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

    // Merge for display
    setCondos([...CONDOS, ...COMMERCIALS, ...SCHOOLS]);
    setFiltered([...CONDOS]);
    applyFilters();

    // A shared link only becomes reproducible once the data it names exists.
    withUrlWritesSuspended(() => applyUrlState(readUrlState()));

    if (loadErrors.length > 0) {
      const warn = document.createElement('div');
      warn.className = 'load-warn';
      warn.innerHTML = '<b>⚠ 一部のデータを読み込めませんでした</b><br>' +
        loadErrors.map(m => '・' + m).join('<br>') +
        '<br>表示中の件数は不完全です。再読み込みで直らない場合はデータファイルを確認してください。';
      listEl.parentNode.insertBefore(warn, listEl);
    }
  } catch(e) {
    listEl.innerHTML = '<div class="load-error">データを読み込めませんでした: ' + e.message +
      '<br><br><small>リポジトリのCSVファイルを確認してください。</small></div>';
  }
})();
