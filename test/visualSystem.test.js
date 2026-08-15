// Contract for the shared visual system (B3b / spec 0, 2.1, 2.9, 2.10).
//
// Most of it is CSS, which no unit test can judge. What a test CAN hold is the
// part that keeps drifting back: the page's identity, the "same information in
// two places" duplication the audit found, and the rule that there is exactly
// one accent colour. So this file reads index.html as text and asserts the
// invariants — plus the one piece of markup the loading state generates.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { skeletonHtml, num, TILE_EMPTY } from '../src/ui/list.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
// Everything between <style> and </style> — the whole design system lives there.
const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));

describe('page identity (audit A1)', () => {
  it('is titled for what it actually shows: KL + Penang, four record types', () => {
    expect(html).toContain('<title>KL・ペナン 住まいマップ | KL &amp; Penang Living Map</title>');
  });

  it('no longer calls itself a Mont Kiara condominium dashboard', () => {
    expect(html).not.toContain('Mont Kiara Condominium Dashboard');
  });

  it('shows the Japanese name with the English one under it in the header', () => {
    expect(html).toContain('<h1>KL・ペナン 住まいマップ<span class="en">KL &amp; Penang Living Map</span></h1>');
  });
});

describe('no information in two places', () => {
  it('drops the header stats that repeated the summary tiles (audit A2)', () => {
    expect(html).not.toContain('id="totalCount"');
    expect(html).not.toContain('id="medianPsf"');
    expect(html).not.toContain('class="stats"');
  });

  it('drops the in-panel year gradient; the map legend is the only year scale (audit A3)', () => {
    expect(html).not.toContain('id="legendBar"');
    expect(html).not.toContain('id="legendLabels"');
    expect(html).toContain('id="mapLegend"');
  });

  it('states its sources once, in a footer under the list (spec 2.1)', () => {
    expect(html).toContain('出典: iProperty / PropertyGuru / EdgeProp (2025-2026), MICHELIN Guide, 各公式サイト');
  });
});

describe('design tokens (spec 2.9)', () => {
  const token = (name) => new RegExp(`--${name}\\s*:`).test(css);

  it('defines the type, colour, spacing, shape and motion tokens in :root', () => {
    for(const t of ['font', 'fs-xs', 'fs-sm', 'fs-md', 'fs-lg', 'fs-xl', 'accent',
      'text', 'text-2', 'hairline', 'bg', 'surface', 'type-school', 'type-commercial',
      's1', 's2', 's3', 's4', 'r-card', 'r-control', 'dur', 'ease']){
      expect(token(t), `missing --${t}`).toBe(true);
    }
  });

  it('uses the system font stack the spec names', () => {
    expect(css).toContain('--font:-apple-system,"Segoe UI","Hiragino Sans","Noto Sans JP",sans-serif');
  });

  it('sets exactly one accent colour', () => {
    expect(css).toContain('--accent:#0a6cff');
  });

  it('carries none of the old mixed blues / greens / oranges outside the tokens', () => {
    // The pre-B3b palette: Google blue, Material blues, the three link-button
    // fills and the two grays that competed with --text-2.
    for(const legacy of ['#1a73e8', '#1565c0', '#0d47a1', '#ff6d00', '#e65100',
      '#34a853', '#2e7d32', '#5f6368', '#80868b', '#e8eaed', '#f8f9fb']){
      expect(css.toLowerCase(), `legacy colour ${legacy} still in the stylesheet`)
        .not.toContain(legacy);
    }
  });

  it('defines the scale as 12/13/15/17/22 plus the 11px all-caps label', () => {
    for(const [name, px] of [['fs-label', '11px'], ['fs-xs', '12px'], ['fs-sm', '13px'],
      ['fs-md', '15px'], ['fs-lg', '17px'], ['fs-xl', '22px']]){
      expect(css, `--${name} should be ${px}`).toContain(`--${name}:${px}`);
    }
  });

  it('sets every font-size from the scale — no ad-hoc px anywhere', () => {
    const decls = [...css.matchAll(/font-size:\s*([^;}!]+)/g)].map(m => m[1].trim());
    expect(decls.length).toBeGreaterThan(20);
    // The single documented exception: the mobile tier badge is a marker glyph
    // inside a 12px circle, not text on the type scale.
    const offScale = decls.filter(d => !d.startsWith('var(--fs-') && d !== '8px');
    expect(offScale).toEqual([]);
  });

  it('reserves motion for 150ms ease-out nudges and honours prefers-reduced-motion', () => {
    expect(css).toContain('--dur:150ms');
    expect(css).toContain('prefers-reduced-motion:reduce');
  });
});

describe('numbers read as numbers (audit C5)', () => {
  it('separates thousands', () => {
    expect(num(45000)).toBe('45,000');
    expect(num(320000)).toBe('320,000');
    expect(num(652)).toBe('652');
  });

  it('gives prices and counts tabular figures so columns line up', () => {
    for(const cls of ['.summary-val', '.card-hero', '.kv-val', '.sf-fee']){
      const rule = css.slice(css.indexOf(cls + '{'));
      expect(rule.slice(0, rule.indexOf('}')), `${cls} is not tabular`)
        .toContain('font-variant-numeric:tabular-nums');
    }
  });
});

describe('B3c: 学費くらべ, the selected marker and the sticky header', () => {
  it('names the panel for what it now covers — KL as well as Penang (audit E4)', () => {
    expect(html).toContain('🎓 学費くらべ');
    expect(html).toContain('🎓 学費くらべ (KL・ペナン)');
    expect(html).not.toContain('Penang School Finder');
  });

  it('closes the panel through its own function, never by assigning a global (audit E2)', () => {
    expect(html).toContain('onclick="closeSchoolFinder()"');
    expect(html).not.toContain('sfActive=false');
  });

  it('rings the selected marker in the accent colour and scales it (spec 2.7 / D3)', () => {
    // Solid ring: the old 40%-alpha accent measured 1.64:1 against the map
    // tiles - below WCAG 1.4.11's 3:1 for non-text UI. White inner + solid
    // accent outer clears it on every marker colour.
    expect(css).toContain('--ring-accent:0 0 0 2px var(--surface), 0 0 0 4.5px var(--accent)');
    const rule = css.slice(css.indexOf('.mk-pin-sel>div{'));
    const body = rule.slice(0, rule.indexOf('}'));
    expect(body).toContain('transform:scale(1.45)');   // 2026-08-08 選択強調の増強
    expect(body).toContain('var(--ring-accent)');
    // The nudge is the shared 150ms, applied to every pin so it animates both
    // on and off.
    const base = css.slice(css.indexOf('.mk-pin>div{'));
    expect(base.slice(0, base.indexOf('}'))).toContain('var(--dur)');
  });

  it('keeps the detail overlay close button reachable at any scroll position', () => {
    const rule = css.slice(css.indexOf('.info-sticky{'));
    const body = rule.slice(0, rule.indexOf('}'));
    expect(body).toContain('position:sticky');
    expect(body).toContain('top:0');
    expect(body).toContain('background:var(--surface)');
    expect(body).toContain('border-bottom:1px solid var(--hairline)');
    // The ✕ moved into the rendered header so it travels with the sticky block.
    expect(html).not.toContain('<button class="info-close"');
  });
});

describe('loading state (audit E3 / spec 2.10)', () => {
  it('draws four card-shaped placeholders, not a line of text', () => {
    const h = skeletonHtml();
    expect(h.match(/class="skel-card"/g)).toHaveLength(4);
    expect(h).not.toContain('Loading');
  });

  it('is configurable but never negative', () => {
    expect(skeletonHtml(1).match(/class="skel-card"/g)).toHaveLength(1);
    expect(skeletonHtml(0)).toBe('');
  });

  it('blanks the summary tiles with an en dash rather than a fake 0', () => {
    expect(TILE_EMPTY).toBe('–');
    expect(html).not.toContain('<div class="summary-val" id="sumTotal">0</div>');
  });
});

// ============================================================
// The map's colours live in JS (Leaflet builds icon HTML outside the CSS
// cascade), which put them outside this file's checks — and sure enough,
// colours this test bans from the CSS (#1565c0, #2e7d32, #e65100) turned out
// to be alive in inline.js. This snapshot is the tripwire: a NEW colour in
// either file fails here and must be added deliberately, next to the token
// it mirrors. Shrinking the list is always welcome.
// ============================================================
describe('JS-side colours are inventoried (map.js / inline.js)', () => {
  const hexesOf = (rel) => [...new Set(
    (readFileSync(new URL(rel, import.meta.url), 'utf8').match(/#[0-9a-fA-F]{3,6}\b/g) || [])
  )].sort();

  it('src/ui/map.js introduces no unlisted colour', () => {
    expect(hexesOf('../src/ui/map.js')).toEqual([
      '#112a58', '#1a3d7c', '#1d5f55', '#333', '#37474f', '#3d2b00', '#546e7a', '#666',
      '#6f3305', '#78909c', '#7a5a10', '#8c1145',
      // 2026-08-15: ミシュラン掲載店(sel)の淡金ピン。金(#d4a51f)・琥珀(#b45309)と
      // 同系で並べ、縁は本体より暗く取る。
      '#a17f24', '#b45309', '#b85806', '#c2185b',
      '#d4a51f', '#e8710a', '#ecd48a', '#fff',
    ]);
  });

  it('src/ui/schoolFinder.js introduces no unlisted colour', () => {
    expect(hexesOf('../src/ui/schoolFinder.js')).toEqual(['#0a6cff', '#bbb', '#e0e0e0', '#fff']);
  });

  it('src/data/inline.js introduces no unlisted colour (legacy blues/greens are grandfathered pending the marker redesign)', () => {
    expect(hexesOf('../src/data/inline.js')).toEqual([
      '#00838f', '#1565c0', '#2e7d32', '#64b5f6', '#78909c', '#7b1fa2',
      '#8d6e63', '#90a4ae', '#bcaaa4', '#bdbdbd', '#bf360c', '#c62828',
      '#e65100', '#f57f17',
    ]);
  });
});
