// Contract for the list filtering logic (src/domain/filter.js).
import { describe, it, expect } from 'vitest';
import { parseR, matchesArea, matchesFilters, TIER_ORDER } from '../src/domain/filter.js';

const CURRENT_YEAR = new Date().getFullYear();

const rec = (over = {}) => ({
  name: 'Some Condo', addr: 'Jalan Kiara, Mont Kiara', nameJa: '',
  status: 'completed', luxTier: 'B', luxScore: 50,
  salePsfMid: 800, rentMid: 6000, sizeMid: 1500, year: 2015,
  fiabciAward: null,
  ...over,
});

const base = {
  q: '', tierVal: '', sp: null, rn: null, yr: null, sz: null, age: null,
  statusFilter: '', areaFilter: '',
  showAwardOnly: false, showCommercial: true, showSchools: true,
  currentYear: CURRENT_YEAR,
};
const f = (over = {}) => ({ ...base, ...over });

describe('parseR', () => {
  it('returns null for an empty selection', () => {
    expect(parseR('')).toBeNull();
  });
  it('splits "min-max" into numbers', () => {
    expect(parseR('500-700')).toEqual({ min: 500, max: 700 });
    expect(parseR('2500-99999')).toEqual({ min: 2500, max: 99999 });
  });
});

describe('matchesArea', () => {
  const at = (addr, name = 'X') => rec({ addr, name });

  it('treats anything that is not another named area as Mont Kiara', () => {
    expect(matchesArea(at('Jalan Kiara, Mont Kiara'), 'mont-kiara')).toBe(true);
    expect(matchesArea(at('Jalan Bangsar'), 'mont-kiara')).toBe(false);
  });

  it('matches Desa ParkCity, Bangsar and Damansara Heights by address', () => {
    expect(matchesArea(at('Desa ParkCity, KL'), 'desa-parkcity')).toBe(true);
    expect(matchesArea(at('Jalan Maarof, Bangsar'), 'bangsar')).toBe(true);
    expect(matchesArea(at('Jalan Batai, Damansara Heights'), 'damansara')).toBe(true);
  });

  it('matches KLGCC by address or by name', () => {
    expect(matchesArea(at('Bukit Kiara, KL'), 'klgcc')).toBe(true);
    expect(matchesArea(at('Somewhere else', 'KLGCC Residence'), 'klgcc')).toBe(true);
  });

  it('matches the several KLCC and Ampang address spellings', () => {
    expect(matchesArea(at('Jalan Conlay, KL'), 'klcc')).toBe(true);
    expect(matchesArea(at('KL Sentral'), 'klcc')).toBe(true);
    expect(matchesArea(at('Jalan U-Thant'), 'ampang')).toBe(true);
    expect(matchesArea(at('Embassy Row, KL'), 'ampang')).toBe(true);
  });

  it('excludes a record that belongs to a different area', () => {
    expect(matchesArea(at('Desa ParkCity, KL'), 'bangsar')).toBe(false);
    expect(matchesArea(at('Jalan Maarof, Bangsar'), 'klcc')).toBe(false);
  });
});

describe('matchesFilters: numeric ranges', () => {
  it('keeps only records inside the Sale PSF range (inclusive)', () => {
    const sp = parseR('500-700');
    expect(matchesFilters(rec({ salePsfMid: 499 }), f({ sp }))).toBe(false);
    expect(matchesFilters(rec({ salePsfMid: 500 }), f({ sp }))).toBe(true);
    expect(matchesFilters(rec({ salePsfMid: 600 }), f({ sp }))).toBe(true);
    expect(matchesFilters(rec({ salePsfMid: 700 }), f({ sp }))).toBe(true);
    expect(matchesFilters(rec({ salePsfMid: 701 }), f({ sp }))).toBe(false);
  });

  it('filters on rent, year and size the same way', () => {
    expect(matchesFilters(rec({ rentMid: 2000 }), f({ rn: parseR('3000-5000') }))).toBe(false);
    expect(matchesFilters(rec({ rentMid: 4000 }), f({ rn: parseR('3000-5000') }))).toBe(true);
    expect(matchesFilters(rec({ year: 1998 }), f({ yr: parseR('2010-2020') }))).toBe(false);
    expect(matchesFilters(rec({ year: 2015 }), f({ yr: parseR('2010-2020') }))).toBe(true);
    expect(matchesFilters(rec({ sizeMid: 600 }), f({ sz: parseR('800-1500') }))).toBe(false);
    expect(matchesFilters(rec({ sizeMid: 1200 }), f({ sz: parseR('800-1500') }))).toBe(true);
  });

  it('applies the age filter only to completed buildings', () => {
    const age = parseR('0-5');
    const young = rec({ year: CURRENT_YEAR - 2 });
    const old = rec({ year: CURRENT_YEAR - 20 });
    expect(matchesFilters(young, f({ age }))).toBe(true);
    expect(matchesFilters(old, f({ age }))).toBe(false);
    // upcoming projects are exempt
    expect(matchesFilters(rec({ ...old, status: 'upcoming' }), f({ age }))).toBe(true);
  });
});

describe('matchesFilters: tier, search, status and toggles', () => {
  it('"A+" means A and above, "A" means A only', () => {
    expect(TIER_ORDER.S).toBeGreaterThan(TIER_ORDER.A);
    expect(matchesFilters(rec({ luxTier: 'S' }), f({ tierVal: 'A+' }))).toBe(true);
    expect(matchesFilters(rec({ luxTier: 'A' }), f({ tierVal: 'A+' }))).toBe(true);
    expect(matchesFilters(rec({ luxTier: 'B' }), f({ tierVal: 'A+' }))).toBe(false);
    expect(matchesFilters(rec({ luxTier: 'S' }), f({ tierVal: 'A' }))).toBe(false);
    expect(matchesFilters(rec({ luxTier: 'A' }), f({ tierVal: 'A' }))).toBe(true);
  });

  it('searches name, address, tier and the Japanese name', () => {
    const c = rec({ name: 'Seni Mont Kiara', addr: 'Jalan Kiara', nameJa: 'セニ・モントキアラ', luxTier: 'S' });
    expect(matchesFilters(c, f({ q: 'seni' }))).toBe(true);
    expect(matchesFilters(c, f({ q: 'jalan' }))).toBe(true);
    expect(matchesFilters(c, f({ q: 'モント' }))).toBe(true);
    expect(matchesFilters(c, f({ q: 'nothing here' }))).toBe(false);
  });

  it('hides non-award condos when the award toggle is on, but not shops/schools', () => {
    expect(matchesFilters(rec({ fiabciAward: null }), f({ showAwardOnly: true }))).toBe(false);
    expect(matchesFilters(rec({ fiabciAward: { year: 2013 } }), f({ showAwardOnly: true }))).toBe(true);
    expect(matchesFilters(rec({ status: 'commercial' }), f({ showAwardOnly: true }))).toBe(true);
    expect(matchesFilters(rec({ status: 'school' }), f({ showAwardOnly: true }))).toBe(true);
  });

  it('honours the commercial / school visibility toggles', () => {
    expect(matchesFilters(rec({ status: 'commercial' }), f({ showCommercial: false }))).toBe(false);
    expect(matchesFilters(rec({ status: 'school' }), f({ showSchools: false }))).toBe(false);
    expect(matchesFilters(rec({ status: 'school' }), f({ showCommercial: false }))).toBe(true);
  });

  it('matches records whose status equals the status filter', () => {
    expect(matchesFilters(rec({ status: 'completed' }), f({ statusFilter: 'completed' }))).toBe(true);
    expect(matchesFilters(rec({ status: 'upcoming' }), f({ statusFilter: 'completed' }))).toBe(false);
    expect(matchesFilters(rec({ status: 'commercial' }), f({ statusFilter: 'commercial' }))).toBe(true);
  });

  // KNOWN BUG, kept as-is by the B1 split (behaviour must not change):
  // "Residential Only" filters commercial/schools out via the dedicated branch,
  // but then also drops every condo because no condo has status 'residential'.
  // Result: the list comes back empty. Tracked for a later fix.
  it('"residential" currently excludes everything (existing bug, documented)', () => {
    expect(matchesFilters(rec({ status: 'commercial' }), f({ statusFilter: 'residential' }))).toBe(false);
    expect(matchesFilters(rec({ status: 'school' }), f({ statusFilter: 'residential' }))).toBe(false);
    expect(matchesFilters(rec({ status: 'completed' }), f({ statusFilter: 'residential' }))).toBe(false);
    expect(matchesFilters(rec({ status: 'upcoming' }), f({ statusFilter: 'residential' }))).toBe(false);
  });
});
