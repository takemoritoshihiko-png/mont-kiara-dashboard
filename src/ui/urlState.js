// URL = screen state. The address bar carries the active layer, the selected
// record and which detail tab is open, so a link reproduces the screen and the
// browser's back button walks the selection history.
//
// `?layer=condo|school|commercial&sel=<name>&tab=detail|nearby`
//
// Only writeUrlState() touches history; everything above it is pure and tested
// in test/urlState.test.js.
import { LAYERS } from '../domain/filter.js';
import { activeLayer, selectedCondo, activeTab, appMode } from '../state.js';

export const TABS = ['detail', 'nearby'];
/** D4: the two modes. 住まい is the default and is left out of the URL. */
export const MODES = ['home', 'eatout'];
export const DEFAULT_MODE = 'home';

// Re-entrancy guard. Restoring a state from the URL drives the same functions
// the user's clicks do, and those functions write the URL — without this flag a
// popstate would push a fresh entry and the back button would never move.
let suspended = false;

/** Run `fn` with every URL write turned into a no-op. */
export function withUrlWritesSuspended(fn) {
  const prev = suspended;
  suspended = true;
  try { return fn(); } finally { suspended = prev; }
}

/**
 * @returns {string} the query string (no leading '?') for a screen state.
 *
 * `mode` comes first because it is the coarsest thing about the screen, and it
 * is omitted when it is 住まい: the published dashboard's links must keep the
 * shape they already have.
 */
export function buildQuery({ mode, layer, sel, tab, f } = {}) {
  const p = new URLSearchParams();
  if (mode && mode !== DEFAULT_MODE && MODES.includes(mode)) p.set('mode', mode);
  if (layer) p.set('layer', layer);
  if (sel) p.set('sel', sel);
  if (tab) p.set('tab', tab);
  if (f) p.set('f', f);
  return p.toString();
}

// ============================================================
// FILTERS IN THE URL
// 「学費8万以下・IB」まで絞ったリンクを家族に送っても、受け手には全件が
// 出ていた（タスク検証で確認）。案内資料・公開サイトの用途には絞り込みも
// 画面状態の一部なので、選択系コントロールの値を `f` に載せる。
// 形式: "fRent:0-20000|fArea:mont-kiara|fSearch:vista"（値はencode済み）。
// トグル（受賞のみ等）は対象外 — 下の許可リストが受け口のすべて。
// ============================================================
const FILTER_IDS = [
  'fSearch', 'fArea', 'fRent', 'fTier', 'fSalePsf', 'fYear', 'fAge', 'fSize',
  'fStatus', 'fSchoolAge', 'fCurriculum', 'fFee', 'fNla', 'fOpenYear',
  // fCat(小分類)は fCatGroup の直後。復元は「大分類を書く→小分類の選択肢が
  // 生まれる→小分類を書く」の順でなければ効かないので、順番に意味がある
  // (受け手側の二度書きは src/ui/info.js の applyUrlState)。
  'fAnchor', 'fCatGroup', 'fCat', 'fMichelin', 'fPriceBand', 'fDiningArea', 'fVenueType',
  // 並び替えも画面状態(2026-08-16)。「予算 安い順」で送ったのに受け手には
  // 別の順で並ぶ、が起きていた。トグル(子連れ・昼の予算・自分の記録)は
  // 引き続き載せない — 自分の記録は受け手にとって意味が違うため。
  'fSort',
];

/** The non-empty filter controls, serialized. '' when nothing is set. */
export function currentFilterParam(doc) {
  const d = doc || (typeof document !== 'undefined' ? document : null);
  if (!d) return '';
  const parts = [];
  for (const id of FILTER_IDS) {
    const el = d.getElementById(id);
    if (!el || !el.value) continue;
    // 並び替えは既定値が常に入っているので、そのままだと全リンクに
    // `?f=fSort:…` が付いて公開サイトのURLの形が変わってしまう。
    // 既定（そのレイヤーの先頭の選択肢）のときは載せない（2026-08-16）。
    if (id === 'fSort' && el.options && el.options[0] && el.value === el.options[0].value) continue;
    parts.push(id + ':' + encodeURIComponent(el.value));
  }
  return parts.join('|');
}

/**
 * Parse the `f` param back into [id, value] pairs. Unknown ids are dropped —
 * a hand-edited URL must not reach elements this module never wrote.
 */
export function parseFilterParam(f) {
  if (!f) return [];
  return f.split('|').map((pair) => {
    const i = pair.indexOf(':');
    if (i < 1) return null;
    const id = pair.slice(0, i);
    if (!FILTER_IDS.includes(id)) return null;
    try { return [id, decodeURIComponent(pair.slice(i + 1))]; }
    catch { return null; }
  }).filter(Boolean);
}

/** Write parsed filter pairs into the controls. Returns how many applied. */
export function applyFilterParam(f, doc) {
  const d = doc || (typeof document !== 'undefined' ? document : null);
  if (!d) return 0;
  let n = 0;
  for (const [id, value] of parseFilterParam(f)) {
    const el = d.getElementById(id);
    if (el) { el.value = value; n++; }
  }
  return n;
}

/**
 * Parse a query string into a screen state. Unknown layers/tabs are dropped
 * rather than trusted — a hand-edited URL must not put the UI in a state the
 * rest of the app has no controls for.
 *
 * @param {string} [search]  defaults to the live location.search
 */
export function readUrlState(search) {
  const s = search != null ? search : (typeof location !== 'undefined' ? location.search : '');
  const p = new URLSearchParams(s);
  const layer = p.get('layer');
  const tab = p.get('tab');
  const mode = p.get('mode');
  return {
    // An unknown mode is dropped, not trusted: 外食モード shows a private
    // ledger, and only the literal string 'eatout' may turn it on.
    mode: MODES.includes(mode) ? mode : null,
    layer: LAYERS.includes(layer) ? layer : null,
    sel: p.get('sel') || null,
    tab: TABS.includes(tab) ? tab : null,
    f: p.get('f') || null,
  };
}

/**
 * Write a screen state to the address bar.
 *
 * @param {object} state  {layer, sel, tab}
 * @param {{replace?: boolean}} [opts]  replace the current entry instead of
 *   pushing a new one. Selections push (they are navigation); layer and tab
 *   switches replace (they refine what you are already looking at).
 * @returns {string} the URL that was (or would have been) written.
 */
export function writeUrlState(state, { replace = false } = {}) {
  const q = buildQuery(state);
  const path = (typeof location !== 'undefined' && location.pathname) ? location.pathname : '';
  const url = path + (q ? '?' + q : '');
  if (suspended || !url) return url;
  // Re-selecting what is already selected must not stack up history entries.
  if (typeof location !== 'undefined' && location.pathname + location.search === url) return url;
  if (typeof history !== 'undefined' && history.pushState) {
    if (replace) history.replaceState(null, '', url);
    else history.pushState(null, '', url);
  }
  return url;
}

/** Write the state the app is actually in right now. */
export function syncUrl({ replace = false } = {}) {
  return writeUrlState({
    mode: appMode,
    layer: activeLayer,
    sel: selectedCondo || null,
    // The tab only means something while something is selected.
    tab: selectedCondo ? activeTab : null,
    f: currentFilterParam(),
  }, { replace });
}
