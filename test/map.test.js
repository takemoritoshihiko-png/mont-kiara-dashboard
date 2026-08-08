// Contract for the map's zoom thresholds (src/ui/map.js).
// Only the pure helper is exercised here: Leaflet and Leaflet.markercluster
// are browser-only CDN scripts, so every call into them lives inside a
// function and never runs at import time.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  labelModeForZoom, LABEL_ZOOM, CLUSTER_OFF_ZOOM, pinClassName, AREA_CENTERS,
  focusActionForZoom, FOCUS_ZOOM,
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
// WHAT A SELECTION DOES TO THE MAP (2026-08-08 再改定)
// 竹森氏の条件値: 選択=必ず中心+毎回同じ縮尺。縮尺は「全店が個別ピンに
// なる、いちばん引いたズーム」= CLUSTER_OFF_ZOOM。
// ============================================================
describe('focusActionForZoom — 選択は常に「中心へ・FOCUS_ZOOMで」', () => {
  it('returns the same instruction at every starting zoom (縮尺が混ざらない)', () => {
    for (let z = 10; z <= 19; z++) {
      expect(focusActionForZoom(z)).toEqual({ action: 'setView', zoom: FOCUS_ZOOM });
    }
  });

  it('FOCUS_ZOOM is exactly where clusters dissolve into individual pins — and no closer', () => {
    expect(FOCUS_ZOOM).toBe(CLUSTER_OFF_ZOOM);   // 15だと数字玉に混ざり、17だと周りが見えない
    expect(FOCUS_ZOOM).toBeLessThan(LABEL_ZOOM); // できるだけ広く=常時ラベルより1段引く
  });
});

// 同一住所ピンの選び直し(2026-08-09): 選択ピン再クリックで同地点の店リストが出る。
// ロジックはLeaflet依存のため実画面で検証済み。ここでは部品のCSS契約だけ固定する
// (新UI要素はモバイル40pxブロックにも入れる — CLAUDE.md の作法)。
describe('同一住所ピンの選び直しポップアップ', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  it('colo-list/colo-item のスタイルがあり、モバイルのタップ標的も登録済み', () => {
    expect(html).toContain('.colo-list{');
    expect(html).toContain('.colo-item{');
    // モバイルブロック(@media max-width:768px)より後に 40px 標的があること
    const mobileAt = html.indexOf('@media(max-width:768px)');
    expect(mobileAt).toBeGreaterThan(-1);
    expect(html.indexOf('.colo-item{min-height:40px}', mobileAt)).toBeGreaterThan(mobileAt);
  });
});
