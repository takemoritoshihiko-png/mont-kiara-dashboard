// Contract for the luxury index (src/domain/luxury.js).
import { describe, it, expect } from 'vitest';
import { calcLuxury, calcNAge, luxTierFor } from '../src/domain/luxury.js';

const CURRENT_YEAR = new Date().getFullYear();

// Minimal record in the shape parseCondosCsv() produces.
// `age` is expressed relative to the current year so the tests do not drift.
const condo = (over = {}) => ({
  name: 'X', addr: '', year: CURRENT_YEAR - 6, units: 200,
  sizeMin: 1000, sizeMax: 2000, rentMin: 5000, rentMax: 9000,
  salePsfMin: 800, salePsfMax: 1200,
  developer: 'Other', brandScoreCSV: 0, blocks: 2, floors: 30, tenure: 'FH',
  premiumScoreCSV: 0,
  ...over,
});

describe('calcLuxury: derived fields', () => {
  const c = condo();
  calcLuxury([c]);

  it('computes the mid/composite measures', () => {
    expect(c.sizeMid).toBe(1500);
    expect(c.sizeComposite).toBe(1200);       // sizeMin*0.6 + sizeMid*0.4
    expect(c.salePsfMid).toBe(1000);
    expect(c.rentMid).toBe(7000);
    expect(c.estPriceMax).toBe(2400000);      // salePsfMax * sizeMax
    expect(c.rentPsfMid).toBeCloseTo(7000 / 1500, 10);
    expect(c.yield).toBeCloseTo((7000 * 12) / (1000 * 1500) * 100, 10);
    expect(c.density).toBe(100);              // units / blocks
    expect(c.buildingAge).toBe(6);
  });

  it('produces a rounded score and a tier letter', () => {
    expect(typeof c.luxScore).toBe('number');
    expect(Math.round(c.luxScore * 10) / 10).toBe(c.luxScore);
    expect(['S', 'A', 'B', 'C', 'D']).toContain(c.luxTier);
  });
});

describe('calcLuxury: brand score source', () => {
  it('falls back to the developer table when the CSV column is 0', () => {
    const c = condo({ developer: 'Other', brandScoreCSV: 0 });
    calcLuxury([c]);
    expect(c.brandScore).toBe(30);            // DEVELOPERS['Other'].score
  });

  it('prefers the CSV brand_score when it is set', () => {
    const c = condo({ developer: 'Other', brandScoreCSV: 77 });
    calcLuxury([c]);
    expect(c.brandScore).toBe(77);
  });

  it('treats an unknown developer as Other', () => {
    const c = condo({ developer: 'No Such Developer Sdn Bhd' });
    calcLuxury([c]);
    expect(c.brandScore).toBe(30);
  });
});

describe('calcLuxury: ranking of synthetic records', () => {
  const ultra = condo({
    name: 'ultra', year: CURRENT_YEAR - 1, units: 80, blocks: 2,
    sizeMin: 3000, sizeMax: 7500, rentMin: 20000, rentMax: 40000,
    salePsfMin: 1500, salePsfMax: 1800, developer: 'Pavilion Group',
    premiumScoreCSV: 15,
  });
  const mid = condo({ name: 'mid' });
  const basic = condo({
    name: 'basic', year: CURRENT_YEAR - 31, units: 900, blocks: 1,
    sizeMin: 500, sizeMax: 800, rentMin: 1500, rentMax: 2500,
    salePsfMin: 350, salePsfMax: 450,
  });
  const all = [ultra, mid, basic];
  calcLuxury(all);

  it('scores ultra > mid > basic', () => {
    expect(ultra.luxScore).toBeGreaterThan(mid.luxScore);
    expect(mid.luxScore).toBeGreaterThan(basic.luxScore);
  });

  it('puts the extremes in the S and D tiers', () => {
    expect(ultra.luxTier).toBe('S');
    expect(basic.luxTier).toBe('D');
  });

  it('assigns every tier from its own score', () => {
    for (const c of all) expect(c.luxTier).toBe(luxTierFor(c.luxScore));
  });
});

describe('luxTierFor: tier boundaries', () => {
  it.each([
    [100, 'S'], [67.1, 'S'], [67, 'S'],
    [66.9, 'A'], [57.1, 'A'], [57, 'A'],
    [56.9, 'B'], [47.1, 'B'], [47, 'B'],
    [46.9, 'C'], [37.1, 'C'], [37, 'C'],
    [36.9, 'D'], [0, 'D'],
  ])('%s -> %s', (score, tier) => {
    expect(luxTierFor(score)).toBe(tier);
  });
});

describe('calcNAge: age penalty', () => {
  it('gives a brand new (or future) building the full 100', () => {
    expect(calcNAge(0)).toBe(100);
    expect(calcNAge(-3)).toBe(100);
  });
  it('drops 3.2 per year for the first 15 years', () => {
    expect(calcNAge(10)).toBeCloseTo(68, 10);
    expect(calcNAge(15)).toBeCloseTo(52, 10);
  });
  it('drops faster (5.2/year) past 15 years and never goes below 0', () => {
    expect(calcNAge(16)).toBeCloseTo(46.8, 10);
    expect(calcNAge(100)).toBe(0);
  });
});
