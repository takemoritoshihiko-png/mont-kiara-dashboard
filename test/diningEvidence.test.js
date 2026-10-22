import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { attachDiningEvidence, normalizeDiningEvidence } from '../src/domain/diningEvidence.js';
import { parseRestaurants } from '../src/data/load.js';
import { restaurantEvidenceHtml } from '../src/ui/restaurantEvidence.js';

const read = name => JSON.parse(readFileSync(new URL('../' + name, import.meta.url), 'utf8'));
const entries = read('tools/dining-evidence.json');
const rows = read('restaurants.json');
const clone = obj => JSON.parse(JSON.stringify(obj));
const withoutEvidence = ({ diningEvidence, ...r }) => r;

describe('public dining research publication contract', () => {
  it('covers all 20 approved branches, preserves all other data and is idempotent', () => {
    expect(entries).toHaveLength(20);
    expect(new Set(entries.map(e => e.id)).size).toBe(20);
    const before = clone(rows);
    const out = attachDiningEvidence(rows, entries);
    expect(out).toEqual(rows); // The published JSON must not lag behind its source.
    expect(out.filter(r => r.diningEvidence)).toHaveLength(20);
    expect(out.map(withoutEvidence)).toEqual(rows.map(withoutEvidence));
    expect(rows).toEqual(before);
    expect(attachDiningEvidence(out, entries)).toEqual(out);
    const loaded = parseRestaurants(JSON.stringify(out));
    for(const entry of entries){
      const evidence = loaded.find(r => r.id === entry.id).diningEvidence;
      expect(evidence).toEqual(normalizeDiningEvidence(entry));
      expect(restaurantEvidenceHtml(evidence)).toContain(entry.checkedAt);
    }
  });
  it.each(['missing', 'wrong-name', 'delisted', 'duplicate'])('refuses %s branch references', kind => {
    const input = clone(entries);
    const records = clone(rows);
    if(kind === 'missing') input[0].id = 'R9999';
    if(kind === 'wrong-name') input[0].name += ' another branch';
    if(kind === 'delisted') records.find(r => r.id === input[0].id).delisted = true;
    if(kind === 'duplicate') input.push(clone(input[0]));
    expect(() => attachDiningEvidence(records, input)).toThrow(/飲食調査/);
  });
  it.each(['unlisted-source', 'unsafe-url', 'invalid-date', 'duplicate-url', 'missing-limits'])('refuses %s evidence', kind => {
    const e = clone(entries[0]);
    if(kind === 'unlisted-source') e.dishes[0].sourceUrls.push('https://example.com/wrong');
    if(kind === 'unsafe-url') e.sources[0].url = 'javascript:alert(1)';
    if(kind === 'invalid-date') e.checkedAt = '2026-99-99';
    if(kind === 'duplicate-url') e.sources.push(clone(e.sources[0]));
    if(kind === 'missing-limits') e.tasteEvidence.limits = '';
    expect(() => normalizeDiningEvidence(e)).toThrow(/飲食調査/);
  });
  it('keeps information-check dates separate from publication dates and escapes text', () => {
    const e = clone(entries[0]);
    e.dishes[0].name = '<img src=x onerror=alert(1)>';
    const html = restaurantEvidenceHtml(normalizeDiningEvidence(e));
    expect(html).toContain('情報確認: 2026-10-22');
    expect(html).toContain('公表: 2025-06-05');
    expect(html).toContain('公表日不明');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});
