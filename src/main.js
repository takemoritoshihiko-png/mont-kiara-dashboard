// Entry point: boots the map, exposes the inline-handler globals and loads data.
import {
  CONDOS, COMMERCIALS, SCHOOLS, sfActive,
  setCondos, setCommercials, setSchools, setSchoolsDetail, setFiltered, setSfActive,
} from './state.js';
import {
  CONDOS_CSV_URL, COMMERCIAL_CSV_URL, SCHOOLS_CSV_URL, SCHOOLS_DETAIL_URL,
  fetchText, parseCondosCsv, parseCommercialCsv, parseSchoolsCsv,
} from './data/load.js';
import { calcLuxury } from './domain/luxury.js';
import { initMap, jumpToArea, toggleLegend } from './ui/map.js';
import {
  applyFilters, setSort, setLayer, syncLayerUI, toggleMore, toggleAward, togglePanel,
  clearSearch, removeFilter, clearAllFilters,
} from './ui/list.js';
import { selectCondo, closeInfo } from './ui/info.js';
import { toggleSchoolFinder, renderSchoolFinder, sfSelectSchool } from './ui/schoolFinder.js';

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
window.toggleSchoolFinder = toggleSchoolFinder;
window.renderSchoolFinder = renderSchoolFinder;
window.sfSelectSchool = sfSelectSchool;

// One inline handler *assigns* a global: the School Finder's nearby-condo rows
// run `sfActive=false;toggleSchoolFinder();selectCondo(...)`. In the original
// single <script> that assignment hit the top-level `let sfActive`; this
// accessor reproduces the same behaviour from module scope.
Object.defineProperty(window, 'sfActive', {
  configurable: true,
  get: () => sfActive,
  set: (v) => setSfActive(v),
});

initMap();
// Build the sort options / show the condo layer's controls before any data
// arrives, so the panel is never in a half-wired state.
syncLayerUI();

// ============================================================
// INIT: Fetch the data files, then render
// ============================================================
(async function init() {
  const listEl = document.getElementById('condoList');
  listEl.innerHTML = '<div style="padding:20px;text-align:center;color:#80868b">Loading data...</div>';

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

    if (loadErrors.length > 0) {
      const warn = document.createElement('div');
      warn.style.cssText = 'margin:8px;padding:10px 12px;background:#fdecea;border:1px solid #ea4335;border-radius:8px;color:#b3261e;font-size:12px;line-height:1.5';
      warn.innerHTML = '<b>⚠ 一部のデータを読み込めませんでした</b><br>' +
        loadErrors.map(m => '・' + m).join('<br>') +
        '<br>表示中の件数は不完全です。再読み込みで直らない場合はデータファイルを確認してください。';
      listEl.parentNode.insertBefore(warn, listEl);
    }
  } catch(e) {
    listEl.innerHTML = '<div style="padding:20px;text-align:center;color:#ea4335">Failed to load data: ' + e.message + '<br><br><small style="color:#80868b">Check repository CSV files.</small></div>';
  }
})();
