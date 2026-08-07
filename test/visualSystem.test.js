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
