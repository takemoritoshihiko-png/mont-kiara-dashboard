// Contract for the list filtering logic (src/domain/filter.js).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  parseR, matchesArea, matchesFilters, TIER_ORDER,
  recordLayer, LAYERS, LAYER_LABELS, CURRICULA,
  parseAgeRange, matchesSchoolAge, matchesCurriculum,
} from '../src/domain/filter.js';
import { parseCsv } from './helpers/csv.js';

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

  // --- Penang: the two areas added for the 26 condos no area claimed ---
  it('matches the George Town city core', () => {
    expect(matchesArea(pg('218 Jalan Macalister George Town 10400 Penang'), 'george-town')).toBe(true);
    expect(matchesArea(pg('1 Gat Lebuh Leith George Town 10200 Penang'), 'george-town')).toBe(true);
    expect(matchesArea(pg('Jalan Dato Keramat 10150 George Town Penang'), 'george-town')).toBe(true);
  });

  it('does not hand Gurney or Pulau Tikus to George Town', () => {
    // "George Town" is the whole city's name, so it is in those addresses too.
    // The core is what is left once the named neighbourhoods are taken out.
    expect(matchesArea(pg('Persiaran Gurney 10250 George Town Penang'), 'george-town')).toBe(false);
    expect(matchesArea(pg('46 Jalan Kelawei Pulau Tikus 10250 George Town Penang'), 'george-town')).toBe(false);
    expect(matchesArea(pg('Persiaran Gurney 10250 George Town Penang'), 'gurney')).toBe(true);
  });

  it('matches the Gelugor / Jelutong corridor by its several place names', () => {
    expect(matchesArea(pg('Jalan Pantai Sinaran Gelugor 11700 Penang'), 'gelugor')).toBe(true);
    expect(matchesArea(pg('Jalan Jelutong 11600 Jelutong Penang'), 'gelugor')).toBe(true);
    expect(matchesArea(pg('Persiaran Karpal Singh 2 Jelutong 11600 Penang'), 'gelugor')).toBe(true);
    expect(matchesArea(pg('Jalan Paya Terubong 11060 Paya Terubong Penang'), 'gelugor')).toBe(true);
    expect(matchesArea(pg('3 Jalan Bukit Gambier 11700 Gelugor Penang'), 'gelugor')).toBe(true);
    // ...and stays out of the neighbouring areas.
    expect(matchesArea(pg('Jalan Jelutong 11600 Jelutong Penang'), 'george-town')).toBe(false);
    expect(matchesArea(pg('Jalan Pantai Sinaran Gelugor 11700 Penang'), 'bayan')).toBe(false);
  });

  it('gives Sungai Ara to Bayan Lepas, the town it sits next to', () => {
    expect(matchesArea(pg('Lintang Sungai Ara 7 Sungai Ara 11900 Penang'), 'bayan')).toBe(true);
    expect(matchesArea(pg('Lintang Sungai Ara 7 Sungai Ara 11900 Penang'), 'gelugor')).toBe(false);
    // Bayan already claimed the ones spelled "Bayan Lepas" — unchanged.
    expect(matchesArea(pg('Jalan Sungai Ara 10 11900 Bayan Lepas Penang'), 'bayan')).toBe(true);
  });

  it('the area filter applies to every layer, not just condos', () => {
    const s = school({ addr: 'Jalan Sungai Satu Batu Ferringhi 11100 Penang', lat: 5.47 });
    expect(matchesFilters(s, fs({ areaFilter: 'ferringhi' }))).toBe(true);
    expect(matchesFilters(s, fs({ areaFilter: 'gurney' }))).toBe(false);
    const m = shop({ addr: '170 Persiaran Gurney 10250 George Town Penang', lat: 5.43 });
    expect(matchesFilters(m, fc({ areaFilter: 'gurney' }))).toBe(true);
  });
});

// ============================================================
// Penang coverage — the real data, not fixtures.
//
// A condo that no area claims is invisible under every area filter and nobody
// notices: that is exactly how 26 Penang condos sat unreachable until the
// George Town / Gelugor areas were added. These two checks are the tripwire.
// When one fires, add the missing neighbourhood keyword to matchesArea — do
// not relax the assertion.
// ============================================================
// The same exactly-one rule on the KL side. Mont Kiara is the catch-all, so a
// KL condo always matches at least one area; the failure mode here is TWO
// (found live: four Kia Peng / Stonor towers sat in both klcc and ampang).
describe('the KL areas claim each KL condo exactly once', () => {
  const KL_AREAS = ['mont-kiara', 'parkcity', 'bangsar', 'klgcc', 'klcc', 'ampang', 'damansara'];
  const condos = parseCsv(readFileSync(new URL('../condos_data.csv', import.meta.url), 'utf8'));
  const kl = condos.filter(c => Number(c.lat) > 1 && Number(c.lat) < 4);
  const areasOf = (c) => KL_AREAS.filter(a => matchesArea({ ...c, lat: Number(c.lat) }, a));

  it('puts every KL condo in exactly one area', () => {
    const bad = kl
      .map(c => ({ name: c.name, areas: areasOf(c) }))
      .filter(r => r.areas.length !== 1)
      .map(r => `${r.name} -> [${r.areas.join(', ')}]`);
    expect(bad).toEqual([]);
  });
});

describe('the Penang areas cover the Penang condos', () => {
  const PENANG_AREAS = ['gurney', 'tanjung', 'ferringhi', 'bayan', 'george-town', 'gelugor'];
  const condos = parseCsv(readFileSync(new URL('../condos_data.csv', import.meta.url), 'utf8'));
  // lat > 4 is the island: KL sits near 3.1, Penang near 5.4.
  const penang = condos.filter(c => Number(c.lat) > 4);
  const areasOf = (c) => PENANG_AREAS.filter(a => matchesArea({ ...c, lat: Number(c.lat) }, a));

  it('has Penang condos to check at all', () => {
    expect(penang.length).toBe(75);
  });

  it('puts every Penang condo in exactly one area', () => {
    const bad = penang
      .map(c => ({ name: c.name, addr: c.addr, areas: areasOf(c) }))
      .filter(r => r.areas.length !== 1)
      .map(r => `${r.name} (${r.addr}) -> [${r.areas.join(', ')}]`);
    expect(bad).toEqual([]);
  });

  it('keeps the membership of each area where it is', () => {
    // Snapshot of the split. The first four are unchanged by the George Town /
    // Gelugor work except Bayan, which gained Sungai Ara (7 -> 8).
    const counts = Object.fromEntries(
      PENANG_AREAS.map(a => [a, penang.filter(c => areasOf(c).includes(a)).length])
    );
    expect(counts).toEqual({
      gurney: 22, tanjung: 14, ferringhi: 6, bayan: 8, 'george-town': 6, gelugor: 19,
    });
  });

  it('does not let a Penang area leak onto the KL side', () => {
    const kl = condos.filter(c => Number(c.lat) < 4);
    kl.forEach(c => expect(areasOf(c)).toEqual([]));
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

  // An unpublished price (null mid — mostly upcoming towers) must match NO
  // price band. Before this, load.js invented rent 2000-5000 / PSF 500-700 for
  // blank cells and 13 priceless records answered to 「RM3,000–4,000」.
  it('never matches a price band when the price is not published', () => {
    expect(matchesFilters(rec({ rentMid: null }), f({ rn: parseR('3000-5000') }))).toBe(false);
    expect(matchesFilters(rec({ salePsfMid: null }), f({ sp: parseR('500-700') }))).toBe(false);
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

  // A school no CURRICULA keyword matches is unreachable under the curriculum
  // filter and nobody notices (found live: Pelita's bare "Cambridge (IGCSE)").
  // Walk the CSV: every school must be findable through at least one option.
  it('every school in the CSV matches at least one curriculum option', () => {
    const rows = parseCsv(readFileSync(new URL('../schools_data.csv', import.meta.url), 'utf8'));
    const orphans = rows.filter(
      (r) => !CURRICULA.some((c) => (r.curriculum || '').toLowerCase().includes(c.toLowerCase()))
    );
    expect(orphans.map((r) => `${r.name}: ${r.curriculum}`)).toEqual([]);
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
