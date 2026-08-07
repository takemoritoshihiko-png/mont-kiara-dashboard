// Contract for the list filtering logic (src/domain/filter.js).
import { describe, it, expect } from 'vitest';
import {
  parseR, matchesArea, matchesFilters, TIER_ORDER,
  recordLayer, LAYERS, LAYER_LABELS, CURRICULA,
  parseAgeRange, matchesSchoolAge, matchesCurriculum,
} from '../src/domain/filter.js';

const CURRENT_YEAR = new Date().getFullYear();

const rec = (over = {}) => ({
  name: 'Some Condo', addr: 'Jalan Kiara, Mont Kiara', nameJa: '',
  status: 'completed', luxTier: 'B', luxScore: 50,
  salePsfMid: 800, rentMid: 6000, sizeMid: 1500, year: 2015,
  lat: 3.17, lng: 101.65,
  fiabciAward: null,
  ...over,
});

const school = (over = {}) => rec({
  status: 'school', name: 'Some School', curriculum: 'British / IB',
  ageRange: '3-18', units: 800, sizeMin: 45000, sizeMax: 95000, ...over,
});

const shop = (over = {}) => rec({
  status: 'commercial', name: 'Some Mall', units: 250, sizeMin: 320000,
  anchorTenants: 'BIG Supermarket; Art Galleries; F&B', ...over,
});

const base = {
  layer: 'condo',
  q: '', tierVal: '', sp: null, rn: null, yr: null, sz: null, age: null,
  statusFilter: '', areaFilter: '',
  showAwardOnly: false,
  currentYear: CURRENT_YEAR,
};
const f = (over = {}) => ({ ...base, ...over });
const fs = (over = {}) => ({ layer: 'school', q: '', areaFilter: '', schoolAge: null, curriculum: '', fee: null, ...over });
const fc = (over = {}) => ({ layer: 'commercial', q: '', areaFilter: '', nla: null, openYear: null, anchorQ: '', ...over });

describe('parseR', () => {
  it('returns null for an empty selection', () => {
    expect(parseR('')).toBeNull();
  });
  it('splits "min-max" into numbers', () => {
    expect(parseR('500-700')).toEqual({ min: 500, max: 700 });
    expect(parseR('2500-99999')).toEqual({ min: 2500, max: 99999 });
  });
});

describe('layers', () => {
  it('routes each record to exactly one layer via its status', () => {
    expect(recordLayer(rec({ status: 'completed' }))).toBe('condo');
    expect(recordLayer(rec({ status: 'upcoming' }))).toBe('condo');
    expect(recordLayer(school())).toBe('school');
    expect(recordLayer(shop())).toBe('commercial');
  });

  it('has a Japanese label for every layer', () => {
    LAYERS.forEach(l => expect(LAYER_LABELS[l]).toBeTruthy());
  });

  it('never matches a record that belongs to another layer', () => {
    expect(matchesFilters(school(), f())).toBe(false);
    expect(matchesFilters(shop(), f())).toBe(false);
    expect(matchesFilters(rec(), fs())).toBe(false);
    expect(matchesFilters(school(), fc())).toBe(false);
  });
});

describe('matchesArea', () => {
  const at = (addr, name = 'X') => rec({ addr, name });
  const pg = (addr, name = 'X') => rec({ addr, name, lat: 5.43, lng: 100.31 });

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

  it('an empty area filter keeps everything', () => {
    expect(matchesArea(at('anywhere'), '')).toBe(true);
  });

  // --- Penang (B3a: the dropdown finally has the four jump-bar areas) ---
  it('matches the four Penang areas the jump bar offers', () => {
    expect(matchesArea(pg('Persiaran Gurney 10250 George Town Penang'), 'gurney')).toBe(true);
    expect(matchesArea(pg('46 Jalan Kelawei Pulau Tikus 10250 George Town Penang'), 'gurney')).toBe(true);
    expect(matchesArea(pg('Jalan Seri Tanjung Pinang Tanjung Tokong 10470 Penang'), 'tanjung')).toBe(true);
    expect(matchesArea(pg('Jalan Tanjung Bungah 11200 Tanjung Bungah Penang'), 'tanjung')).toBe(true);
    expect(matchesArea(pg('10 Solok Batu Ferringhi 11100 Batu Ferringhi Penang'), 'ferringhi')).toBe(true);
    expect(matchesArea(pg('Persiaran Bayan Indah 11900 Bayan Lepas Penang'), 'bayan')).toBe(true);
  });

  it('falls back to the name when the street address omits the neighbourhood', () => {
    // "Gurney Palace" sits on Jalan Concordia; the address never says Gurney.
    expect(matchesArea(pg('10 Jalan Concordia 10250 George Town Penang', 'Gurney Palace'), 'gurney')).toBe(true);
    expect(matchesArea(pg('Jalan Bayu 1 Penang', 'Bayu Ferringhi'), 'ferringhi')).toBe(true);
  });

  it('keeps the Penang areas apart from each other', () => {
    expect(matchesArea(pg('Persiaran Gurney 10250 George Town Penang'), 'tanjung')).toBe(false);
    expect(matchesArea(pg('Jalan Batu Ferringhi 11100 Batu Ferringhi Penang'), 'bayan')).toBe(false);
  });

  it('a Penang record is never Mont Kiara (the KL catch-all stops at the strait)', () => {
    expect(matchesArea(pg('Persiaran Gurney 10250 George Town Penang'), 'mont-kiara')).toBe(false);
    expect(matchesArea(pg('Jalan Macalister George Town 10400 Penang'), 'mont-kiara')).toBe(false);
  });

  it('a KL record never matches a Penang area', () => {
    expect(matchesArea(at('Jalan Kiara, Mont Kiara'), 'gurney')).toBe(false);
    expect(matchesArea(at('Jalan Kiara, Mont Kiara'), 'bayan')).toBe(false);
  });

  it('the area filter applies to every layer, not just condos', () => {
    const s = school({ addr: 'Jalan Sungai Satu Batu Ferringhi 11100 Penang', lat: 5.47 });
    expect(matchesFilters(s, fs({ areaFilter: 'ferringhi' }))).toBe(true);
    expect(matchesFilters(s, fs({ areaFilter: 'gurney' }))).toBe(false);
    const m = shop({ addr: '170 Persiaran Gurney 10250 George Town Penang', lat: 5.43 });
    expect(matchesFilters(m, fc({ areaFilter: 'gurney' }))).toBe(true);
  });
});

describe('matchesFilters: condo numeric ranges', () => {
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

describe('matchesFilters: condo tier, search, status and award', () => {
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

  it('hides non-award condos when the award chip is on', () => {
    expect(matchesFilters(rec({ fiabciAward: null }), f({ showAwardOnly: true }))).toBe(false);
    expect(matchesFilters(rec({ fiabciAward: { year: 2013 } }), f({ showAwardOnly: true }))).toBe(true);
  });

  // B3a: STATUS is lifecycle only. 'commercial' / 'residential' moved to the
  // layer control, which is what killed the always-empty "Residential Only".
  it('the status filter only knows completed / upcoming', () => {
    expect(matchesFilters(rec({ status: 'completed' }), f({ statusFilter: 'completed' }))).toBe(true);
    expect(matchesFilters(rec({ status: 'upcoming' }), f({ statusFilter: 'completed' }))).toBe(false);
    expect(matchesFilters(rec({ status: 'upcoming' }), f({ statusFilter: 'upcoming' }))).toBe(true);
  });

  it('the condo layer already excludes shops and schools without a status filter', () => {
    expect(matchesFilters(shop(), f())).toBe(false);
    expect(matchesFilters(school(), f())).toBe(false);
  });
});

describe('school filters', () => {
  it('parses an age_range field', () => {
    expect(parseAgeRange('3-18')).toEqual({ min: 3, max: 18 });
    expect(parseAgeRange('')).toBeNull();
    expect(parseAgeRange('n/a')).toBeNull();
  });

  it('keeps schools whose age range covers the child (inclusive on both ends)', () => {
    const s = school({ ageRange: '11-18' });
    expect(matchesSchoolAge(s, 10)).toBe(false);
    expect(matchesSchoolAge(s, 11)).toBe(true);
    expect(matchesSchoolAge(s, 18)).toBe(true);
    expect(matchesSchoolAge(s, 19)).toBe(false);
    expect(matchesSchoolAge(s, null)).toBe(true);
  });

  it('drops a school with no usable age range once an age is chosen', () => {
    expect(matchesSchoolAge(school({ ageRange: '' }), 5)).toBe(false);
  });

  it('matches curriculum as a substring of the combined field', () => {
    expect(matchesCurriculum(school({ curriculum: 'British / IB' }), 'IB')).toBe(true);
    expect(matchesCurriculum(school({ curriculum: 'British / IB' }), 'British')).toBe(true);
    expect(matchesCurriculum(school({ curriculum: 'IB (PYP/IGCSE/DP)' }), 'IB')).toBe(true);
    expect(matchesCurriculum(school({ curriculum: 'American' }), 'British')).toBe(false);
    expect(matchesCurriculum(school({ curriculum: 'American' }), '')).toBe(true);
  });

  it('offers every curriculum the data actually contains', () => {
    expect(CURRICULA).toContain('IB');
    expect(CURRICULA).toContain('Japanese');
    expect(new Set(CURRICULA).size).toBe(CURRICULA.length);
  });

  it('filters on the annual entry fee band', () => {
    const cheap = school({ sizeMin: 20000, sizeMax: 40000 });
    const mid = school({ sizeMin: 45000, sizeMax: 95000 });
    expect(matchesFilters(cheap, fs({ fee: parseR('1-40000') }))).toBe(true);
    expect(matchesFilters(mid, fs({ fee: parseR('1-40000') }))).toBe(false);
    expect(matchesFilters(mid, fs({ fee: parseR('40000-80000') }))).toBe(true);
  });

  it('combines age, curriculum and fee', () => {
    const s = school({ ageRange: '3-13', curriculum: 'British (IPC)', sizeMin: 17040 });
    expect(matchesFilters(s, fs({ schoolAge: 5, curriculum: 'British', fee: parseR('1-40000') }))).toBe(true);
    expect(matchesFilters(s, fs({ schoolAge: 16, curriculum: 'British' }))).toBe(false);
    expect(matchesFilters(s, fs({ curriculum: 'IB' }))).toBe(false);
  });

  it('searches the curriculum field too', () => {
    expect(matchesFilters(school({ curriculum: 'French' }), fs({ q: 'french' }))).toBe(true);
  });
});

describe('commercial filters', () => {
  it('filters on the NLA size band', () => {
    expect(matchesFilters(shop({ sizeMin: 100000 }), fc({ nla: parseR('1-150000') }))).toBe(true);
    expect(matchesFilters(shop({ sizeMin: 320000 }), fc({ nla: parseR('1-150000') }))).toBe(false);
    expect(matchesFilters(shop({ sizeMin: 320000 }), fc({ nla: parseR('150000-500000') }))).toBe(true);
    expect(matchesFilters(shop({ sizeMin: 900000 }), fc({ nla: parseR('500000-99999999') }))).toBe(true);
  });

  it('an unknown NLA (0) matches no band', () => {
    expect(matchesFilters(shop({ sizeMin: 0 }), fc({ nla: parseR('1-150000') }))).toBe(false);
    expect(matchesFilters(shop({ sizeMin: 0 }), fc())).toBe(true);
  });

  it('filters on the opening-year band', () => {
    expect(matchesFilters(shop({ year: 1998 }), fc({ openYear: parseR('0-2000') }))).toBe(true);
    expect(matchesFilters(shop({ year: 2012 }), fc({ openYear: parseR('2011-2020') }))).toBe(true);
    expect(matchesFilters(shop({ year: 2012 }), fc({ openYear: parseR('2021-2100') }))).toBe(false);
  });

  it('searches anchor tenants case-insensitively', () => {
    expect(matchesFilters(shop(), fc({ anchorQ: 'big supermarket' }))).toBe(true);
    expect(matchesFilters(shop(), fc({ anchorQ: 'village grocer' }))).toBe(false);
  });
});
