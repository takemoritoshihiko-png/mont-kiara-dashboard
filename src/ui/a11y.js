// Keyboard behaviour for the parts of the UI that are not native controls.
//
// B4. Three things live here and nothing else:
//   1. Enter / Space activate anything marked role="button" tabindex="0".
//      Cards, 周辺 rows and 学費くらべ rows are block layouts that a native
//      <button> cannot carry without a pile of resets, so they borrow the role
//      instead — and the role obliges us to supply the key handling a real
//      button would have given for free.
//   2. Escape closes the detail overlay, the app's only overlay.
//   3. Both are ONE delegated listener on the document, not one per element.
//      The list is re-rendered on every keystroke in the search box; per-card
//      wiring would be attached and thrown away hundreds of times a session.
//
// Deliberately NOT here: keyboard navigation of the map markers. Leaflet's
// markers are absolutely-positioned divs in geographic order, so tabbing them
// walks the map at random and there are up to 392 of them. The list beside the
// map holds the same records, in a meaningful order, with the same click
// target — that is the accessible path to every record, and it is the one the
// map's own aria-label points at.
import { closeInfo } from './info.js';

/** Keys that activate a button, per the ARIA authoring practices. */
const ACTIVATE_KEYS = new Set(['Enter', ' ', 'Spacebar']);

/** The elements that borrow button semantics and therefore need key handling. */
const ROLE_BUTTON = '[role="button"][tabindex="0"]';

/**
 * @param {{doc?: Document, onEscape?: () => void}} [deps]  seams for the test:
 *   the handler is behaviour worth checking, and checking it should not need a
 *   whole DOM implementation. Defaults are evaluated at call time, so importing
 *   this module outside a browser is safe.
 */
export function initA11y({ doc = document, onEscape = closeInfo } = {}){
  doc.addEventListener('keydown', (e) => {
    if(e.key === 'Escape'){
      const ov = doc.getElementById('infoOverlay');
      if(ov && ov.classList.contains('active')){
        e.preventDefault();
        onEscape();
      }
      return;
    }
    if(!ACTIVATE_KEYS.has(e.key)) return;
    // A modified key press is a browser shortcut, not an activation.
    if(e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if(!t || typeof t.closest !== 'function') return;
    const el = t.closest(ROLE_BUTTON);
    if(!el) return;
    // Space would otherwise scroll the panel out from under the card.
    e.preventDefault();
    el.click();
  });
}
