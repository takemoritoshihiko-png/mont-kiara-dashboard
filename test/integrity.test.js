// Data integrity contract for the three CSV datasets.
// Any change to the CSVs must keep these checks green ("異常0").
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './helpers/csv.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');

const condos = parseCsv(read('condos_data.csv'));
const commercials = parseCsv(read('commercial_data.csv'));
const schools = parseCsv(read('schools_data.csv'));

const CURRENT_YEAR = new Date().getFullYear();
const num = (v) => (v === '' || v == null ? null : Number(v));

// premium_score is a WEIGHTED formula (SSOT — see README):
// private_lift*7 + concierge*2 + low_density + pool + sky_lounge + ev_charging (max 15)
const premiumFormula = (r) =>
  num(r.premium_private_lift) * 7 +
  num(r.premium_concierge) * 2 +
  num(r.premium_low_density) +
  num(r.premium_pool) +
  num(r.premium_sky_lounge) +
  num(r.premium_ev_charging);

describe('record counts', () => {
  it('has the expected dataset sizes (update deliberately when adding data)', () => {
    expect(condos.length).toBeGreaterThanOrEqual(271);
    // 商業は2026-08-09裁定で「KL有名モールTOP10だけ」に絞った(旧88件は
    // docs/archive-commercial_data-88件-20260809.csv に保全)。ちょうど10を守る。
    expect(commercials.length).toBe(10);
    expect(schools.length).toBeGreaterThanOrEqual(33);
  });
});

describe.each([
  ['condos', condos, 28],
  ['commercial', commercials, 11],
  ['schools', schools, 12],
])('%s: structural checks', (label, rows, cols) => {
  it('every row has the full column count', () => {
    const bad = rows.filter((r) => r.__cellCount !== cols);
    expect(bad.map((r) => r.name)).toEqual([]);
  });
  it('names are unique and non-empty', () => {
    const names = rows.map((r) => r.name);
    expect(names.every((n) => n && n.trim() !== '')).toBe(true);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dupes).toEqual([]);
  });
  it('coordinates are inside Malaysia (KL/Penang bounds)', () => {
    const bad = rows.filter((r) => {
      const lat = num(r.lat), lng = num(r.lng);
      return lat === null || lng === null || lat < 2.5 || lat > 6.0 || lng < 99.5 || lng > 102.5;
    });
    expect(bad.map((r) => r.name)).toEqual([]);
  });
});

describe('condos: value checks', () => {
  it('min <= max for size / rent / salePsf (when present)', () => {
    for (const pair of [['sizeMin', 'sizeMax'], ['rentMin', 'rentMax'], ['salePsfMin', 'salePsfMax']]) {
      const bad = condos.filter((r) => {
        const a = num(r[pair[0]]), b = num(r[pair[1]]);
        return a !== null && b !== null && a > b;
      });
      expect(bad.map((r) => r.name), pair.join('/')).toEqual([]);
    }
  });

  it('premium_score matches the weighted formula (max 15)', () => {
    const bad = condos
      .filter((r) => num(r.premium_score) !== premiumFormula(r) || num(r.premium_score) > 15)
      .map((r) => `${r.name}: stored=${r.premium_score} formula=${premiumFormula(r)}`);
    expect(bad).toEqual([]);
  });

  it('status is a known value', () => {
    const bad = condos.filter((r) => !['completed', 'upcoming'].includes(r.status));
    expect(bad.map((r) => `${r.name}: ${r.status}`)).toEqual([]);
  });

  it('year in the past implies status=completed', () => {
    const bad = condos.filter((r) => num(r.year) < CURRENT_YEAR && r.status !== 'completed');
    expect(bad.map((r) => `${r.name}: year=${r.year} status=${r.status}`)).toEqual([]);
  });

  it('tenure is FH or LH', () => {
    const bad = condos.filter((r) => !['FH', 'LH'].includes(r.tenure));
    expect(bad.map((r) => `${r.name}: ${r.tenure}`)).toEqual([]);
  });
});

describe('schools_detail.json: contract with schools_data.csv', () => {
  const detail = JSON.parse(read('schools_detail.json'));
  const csvNames = schools.map((r) => r.name);

  it('every detail key matches a CSV school name exactly (app lookup key)', () => {
    const orphans = Object.keys(detail).filter((k) => !csvNames.includes(k));
    expect(orphans).toEqual([]);
  });
  it('every CSV school has a detail entry', () => {
    const missing = csvNames.filter((n) => !detail[n]);
    expect(missing).toEqual([]);
  });
  it('fees are numbers (8k-200k RM) or null', () => {
    const bad = [];
    for (const [name, d] of Object.entries(detail)) {
      for (const [grade, fee] of Object.entries(d.fees ?? {})) {
        if (fee !== null && (typeof fee !== 'number' || fee < 8000 || fee > 200000)) {
          bad.push(`${name}/${grade}: ${fee}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('commercial / schools: value checks', () => {
  it('commercial numeric fields are positive', () => {
    const bad = commercials.filter((r) => !(num(r.tenants) > 0) || !(num(r.nla_sqft) > 0));
    expect(bad.map((r) => r.name)).toEqual([]);
  });
  it('school fee min <= max and students > 0', () => {
    const bad = schools.filter((r) =>
      num(r.annual_fee_min) > num(r.annual_fee_max) || !(num(r.students) > 0));
    expect(bad.map((r) => r.name)).toEqual([]);
  });
});

// Two different buildings on the exact same point means one of them was
// geocoded by copy-paste — the nearby tab then reports the neighbour at
// "0m" (found live: Casa Kiara 1/2, Menara/Alfa Bangsar, Muze/Senze).
// Cross-dataset sharing is fine (Plaza Arkadia is one complex that is both
// a condo and a mall); within one dataset it never is.
describe.each([
  ['condos', () => condos],
  ['commercial', () => commercials],
  ['schools', () => schools],
])('%s: no two records share exact coordinates', (label, rows) => {
  it('every coordinate pair is unique within the dataset', () => {
    const seen = new Map();
    const clashes = [];
    for (const r of rows()) {
      const key = `${r.lat},${r.lng}`;
      if (seen.has(key)) clashes.push(`${r.name} = ${seen.get(key)} @ ${key}`);
      else seen.set(key, r.name);
    }
    expect(clashes).toEqual([]);
  });
});
