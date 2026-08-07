// Contract for the map's zoom thresholds (src/ui/map.js).
// Only the pure helper is exercised here: Leaflet and Leaflet.markercluster
// are browser-only CDN scripts, so every call into them lives inside a
// function and never runs at import time.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  labelModeForZoom, LABEL_ZOOM, CLUSTER_OFF_ZOOM, pinClassName, AREA_CENTERS,
  focusActionForZoom, OVERVIEW_ZOOM, SELECT_ZOOM, SELECT_PAN_PADDING, panPaddingFor,
} from '../src/ui/map.js';

describe('labelModeForZoom', () => {
  it('hides the labels below the threshold (hover only)', () => {
    expect(labelModeForZoom(14)).toBe('hover');
  });

  it('turns the labels on at the threshold', () => {
    expect(labelModeForZoom(LABEL_ZOOM)).toBe("permanent");
  });

  it('keeps the labels on above the threshold', () => {
    expect(labelModeForZoom(LABEL_ZOOM + 1)).toBe("permanent");
  });

  it('is hover-only at the initial KL-wide zoom (12) — 392 labels would collide', () => {
    expect(labelModeForZoom(12)).toBe('hover');
  });

  it('handles fractional zooms on both sides of the threshold', () => {
    expect(labelModeForZoom(LABEL_ZOOM - 0.1)).toBe("hover");
    expect(labelModeForZoom(LABEL_ZOOM + 0.1)).toBe("permanent");
  });

  it('returns permanent for every zoom >= LABEL_ZOOM and hover below it', () => {
    for (let z = 0; z <= 19; z++) {
      expect(labelModeForZoom(z)).toBe(z >= LABEL_ZOOM ? 'permanent' : 'hover');
    }
  });
});

describe('selected marker ring (spec 2.7 / audit D3)', () => {
  it('marks the selected pin with an extra class, never a different element', () => {
    expect(pinClassName(false)).toBe('mk-pin');
    expect(pinClassName(true)).toBe('mk-pin mk-pin-sel');
    // The base class must survive, otherwise the shared transition is lost.
    expect(pinClassName(true).split(' ')).toContain('mk-pin');
  });
});

describe('zoom threshold constants', () => {
  it('labels never precede the un-clustering (pins first at 16, names at 17)', () => {
    expect(LABEL_ZOOM).toBeGreaterThanOrEqual(CLUSTER_OFF_ZOOM);
  });

  it('the thresholds sit inside Leaflet’s zoom range', () => {
    expect(LABEL_ZOOM).toBeGreaterThan(0);
    expect(LABEL_ZOOM).toBeLessThanOrEqual(19);
  });
});

// ============================================================
// AREA JUMP — the jump bar, the エリア dropdown and the fly-to centers all
// speak the same set of keys. They live in three files, so nothing but a test
// notices when one of them gains an area and the others do not.
// ============================================================
describe('area keys stay in sync across the jump bar, the dropdown and the map', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const buttons = [...html.matchAll(/data-area="([^"]+)"/g)].map(m => m[1]);
  const select = html.slice(html.indexOf('id="fArea"'));
  const options = [...select.slice(0, select.indexOf('</select>')).matchAll(/<option value="([^"]*)"/g)]
    .map(m => m[1]).filter(Boolean);
  // The dropdown kept the older spelling of one key when the jump bar was added.
  const ALIAS = { 'desa-parkcity': 'parkcity' };

  it('every jump button can fly somewhere', () => {
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach(k => expect(AREA_CENTERS[k], `no center for "${k}"`).toBeTruthy());
  });

  it('every dropdown area is reachable from the jump bar', () => {
    options.forEach(k => {
      const key = ALIAS[k] || k;
      expect(AREA_CENTERS[key], `dropdown area "${k}" has no jump target`).toBeTruthy();
    });
  });

  it('offers both Penang areas added for the George Town / Gelugor condos', () => {
    ['george-town', 'gelugor'].forEach(k => {
      expect(buttons).toContain(k);
      expect(options).toContain(k);
      expect(AREA_CENTERS[k].lat).toBeGreaterThan(4);   // on the island
      expect(AREA_CENTERS[k].zoom).toBeGreaterThanOrEqual(12);
    });
  });
});

// ============================================================
// WHAT A SELECTION DOES TO THE MAP
// The rule under test: do not move what the user just pressed. Only the pure
// decision is exercised — map.setView / map.panInside are Leaflet.
// ============================================================
describe('focusActionForZoom (selection must not steal the view)', () => {
  it('zooms in from a city-wide view, where you cannot see what you picked', () => {
    expect(focusActionForZoom(12)).toEqual({ action: 'setView', zoom: SELECT_ZOOM });
    expect(focusActionForZoom(OVERVIEW_ZOOM - 0.1)).toEqual({ action: 'setView', zoom: SELECT_ZOOM });
  });

  it('only pans once you are framing a neighbourhood — the zoom is yours', () => {
    expect(focusActionForZoom(OVERVIEW_ZOOM)).toEqual({ action: 'panInside' });
    expect(focusActionForZoom(17)).toEqual({ action: 'panInside' });
  });

  it('never zooms OUT of a close-up: comparing at 18 stays at 18', () => {
    for (let z = OVERVIEW_ZOOM; z <= 19; z++) {
      expect(focusActionForZoom(z).action).toBe('panInside');
    }
  });

  it('lands short of the un-clustering zoom, so a selection is a nudge not a dive', () => {
    expect(SELECT_ZOOM).toBeGreaterThan(OVERVIEW_ZOOM - 2);
    expect(SELECT_ZOOM).toBeLessThan(CLUSTER_OFF_ZOOM);
  });

  it('keeps the pin clear of the 300px detail overlay at the map\'s top-left', () => {
    const [x, y] = SELECT_PAN_PADDING.paddingTopLeft;
    expect(x).toBeGreaterThanOrEqual(300);
    expect(y).toBeGreaterThanOrEqual(48);
    expect(SELECT_PAN_PADDING.paddingBottomRight).toEqual([20, 20]);
  });
});

describe('panPaddingFor (the padding has to fit the screen it is on)', () => {
  it('uses the overlay width in full on a desktop map', () => {
    expect(panPaddingFor({ x: 1264, y: 900 }).paddingTopLeft).toEqual([320, 60]);
  });

  it('shrinks it on a phone rather than inverting the padded rectangle', () => {
    const p = panPaddingFor({ x: 390, y: 450 });
    expect(p.paddingTopLeft[0]).toBe(234);
    expect(p.paddingBottomRight).toEqual([20, 20]);
  });

  it('always leaves a usable area, at every width the app is used at', () => {
    for (const x of [280, 320, 360, 390, 768, 1440]) {
      const [px] = panPaddingFor({ x, y: 400 }).paddingTopLeft;
      expect(px + 20, `padding must not exceed the map at ${x}px`).toBeLessThan(x);
    }
  });

  it('survives a zero-size map (called before the first layout)', () => {
    expect(panPaddingFor({ x: 0, y: 0 }).paddingTopLeft).toEqual([0, 0]);
  });
});
