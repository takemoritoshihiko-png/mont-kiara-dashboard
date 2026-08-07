// URL = screen state. The address bar carries the active layer, the selected
// record and which detail tab is open, so a link reproduces the screen and the
// browser's back button walks the selection history.
//
// `?layer=condo|school|commercial&sel=<name>&tab=detail|nearby`
//
// Only writeUrlState() touches history; everything above it is pure and tested
// in test/urlState.test.js.
import { LAYERS } from '../domain/filter.js';
import { activeLayer, selectedCondo, activeTab } from '../state.js';

export const TABS = ['detail', 'nearby'];

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

/** @returns {string} the query string (no leading '?') for a screen state. */
export function buildQuery({ layer, sel, tab } = {}) {
  const p = new URLSearchParams();
  if (layer) p.set('layer', layer);
  if (sel) p.set('sel', sel);
  if (tab) p.set('tab', tab);
  return p.toString();
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
  return {
    layer: LAYERS.includes(layer) ? layer : null,
    sel: p.get('sel') || null,
    tab: TABS.includes(tab) ? tab : null,
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
    layer: activeLayer,
    sel: selectedCondo || null,
    // The tab only means something while something is selected.
    tab: selectedCondo ? activeTab : null,
  }, { replace });
}
