// Contract for the 学費くらべ engine (src/domain/fees.js).
//
// Two halves: the label parser (messy published keys → school years) and the
// promise that no number is ever invented. The second half runs against the
// REAL schools_detail.json, because that is where the mess actually lives.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  gradeForAge, ageForGrade, parseFeeLevel, parseAgeRange,
  annualFeeForAge, feeComparison, areaTag, MIN_AGE, MAX_AGE,
} from '../src/domain/fees.js';
import { parseCsv } from './helpers/csv.js';

// Levels are easier to read as the ages they cover than as ladder indices.
const ages = (key) => {
  const l = parseFeeLevel(key);
  return l ? [ageForGrade(l.min), ageForGrade(l.max)] : null;
};

describe('the ladder', () => {
  it('runs from age 3 to age 17', () => {
    expect(gradeForAge(MIN_AGE)).toBe(0);
    expect(gradeForAge(MAX_AGE)).toBe(14);
    expect(gradeForAge(2)).toBeNull();
    expect(gradeForAge(18)).toBeNull();
    expect(gradeForAge('nope')).toBeNull();
  });
});

describe('British Year vs American Grade (the two conventions in Malaysia)', () => {
  it('puts Year 1 at 5 and Year 13 at 17', () => {
    expect(ages('Year 1')).toEqual([5, 5]);
    expect(ages('Year 13')).toEqual([17, 17]);
  });

  it('puts Grade 1 at 6 and Grade 12 at 17 — one year later than the Year scale', () => {
    expect(ages('Grade 1')).toEqual([6, 6]);
    expect(ages('Grade 12')).toEqual([17, 17]);
  });

  it('reads a range key as the whole range it covers', () => {
    expect(ages('Year 1-2')).toEqual([5, 6]);
    expect(ages('Year 10-13')).toEqual([14, 17]);
    expect(ages('Grade 1-2')).toEqual([6, 7]);
    expect(ages('Grade 9-12')).toEqual([14, 17]);
  });

  it('ignores the exam name a school appends to the key', () => {
    expect(ages('Year 7-11 (IGCSE)')).toEqual([11, 15]);
    expect(ages('Year 12-13 (IB DP)')).toEqual([16, 17]);
    expect(ages('Year 10 (IGCSE)')).toEqual([14, 14]);
  });

  it('accepts an en dash as well as a hyphen', () => {
    expect(ages('Year 3–4')).toEqual([7, 8]);
  });
});

describe('word keys (no year number at all)', () => {
  it.each([
    ['Nursery',              [3, 3]],
    ['Reception',            [4, 4]],
    ['Early Years',          [3, 4]],
    ['EYFS 1-2',             [3, 4]],
    ['Kindergarten',         [3, 5]],
    ['Kindergarten 1',       [4, 4]],
    ['Kindergarten 3 (K3)',  [5, 5]],
    ['Prep Reception',       [4, 4]],
    ['Prep Senior',          [5, 5]],
    ['Preschool 3-4',        [3, 4]],
    ['Elementary',           [6, 10]],
    ['Middle School',        [11, 13]],
    ['High School',          [14, 17]],
    ['Kindergarten (幼稚部)', [3, 5]],
    ['Primary (小学部)',      [6, 11]],
    ['Junior High (中学部)',  [12, 14]],
  ])('reads %s as ages %s', (key, expected) => {
    expect(ages(key)).toEqual(expected);
  });

  it('lets an explicit Year in the parentheses win over the IB stage name', () => {
    expect(ages('MYP 1-3 (Year 7-9)')).toEqual([11, 13]);
    expect(ages('MYP 4-5 (Year 10-11)')).toEqual([14, 15]);
    expect(ages('PYP 1 (Year 1)')).toEqual([5, 5]);
  });

  it('falls back to the IB stage when no Year is spelled out', () => {
    expect(ages('PYP 2-3')).toEqual([6, 7]);
  });

  it('returns null for a label it cannot place, rather than guessing', () => {
    expect(parseFeeLevel('Application Fee')).toBeNull();
    expect(parseFeeLevel('')).toBeNull();
    expect(parseFeeLevel(null)).toBeNull();
  });
});

describe('parseAgeRange', () => {
  it('reads the CSV age_range column', () => {
    expect(parseAgeRange('3-18')).toEqual({ min: 3, max: 18 });
    expect(parseAgeRange('11-18')).toEqual({ min: 11, max: 18 });
    expect(parseAgeRange('')).toBeNull();
  });
});

// ============================================================
describe('annualFeeForAge', () => {
  const british = {
    ageRange: '3-18',
    fees: { 'Nursery': 10000, 'Reception': 12000, 'Year 1-2': 20000, 'Year 7-11 (IGCSE)': 50000 },
  };

  it('returns the published number and its own label on an exact hit', () => {
    expect(annualFeeForAge(british, 5)).toEqual({ fee: 20000, gradeLabel: 'Year 1-2', exact: true });
    expect(annualFeeForAge(british, 3)).toEqual({ fee: 10000, gradeLabel: 'Nursery', exact: true });
    expect(annualFeeForAge(british, 15)).toEqual({ fee: 50000, gradeLabel: 'Year 7-11 (IGCSE)', exact: true });
  });

  it('falls back to the NEAREST published year and says which one — never interpolates', () => {
    // Age 8 (Year 4) is not priced: the table jumps Year 2 → Year 7.
    const hit = annualFeeForAge(british, 8);
    expect(hit).toEqual({ fee: 20000, gradeLabel: 'Year 1-2', exact: false });
    // The number is one the school actually printed, not an average of 20k/50k.
    expect(Object.values(british.fees)).toContain(hit.fee);
  });

  it('reaches upward when the gap above is the shorter one', () => {
    expect(annualFeeForAge(british, 9)).toEqual({ fee: 50000, gradeLabel: 'Year 7-11 (IGCSE)', exact: false });
  });

  it('excludes an age outside the school age range', () => {
    const senior = { ageRange: '11-18', fees: { 'Year 9': 57720, 'Year 12-13 (A-Level)': 62970 } };
    expect(annualFeeForAge(senior, 6)).toBeNull();
    expect(annualFeeForAge(senior, 11)).not.toBeNull();
    const jp = { ageRange: '6-15', fees: { 'Kindergarten (幼稚部)': 32496, 'Primary (小学部)': 32496 } };
    expect(annualFeeForAge(jp, 4)).toBeNull();
  });

  it('treats a null or zero fee as "not published", never as free', () => {
    const partial = { ageRange: '3-18', fees: { 'Year 1': null, 'Year 2': 0, 'Year 3': 30000 } };
    expect(annualFeeForAge(partial, 5)).toEqual({ fee: 30000, gradeLabel: 'Year 3', exact: false });
  });

  it('returns null when there is no usable fee data at all', () => {
    expect(annualFeeForAge({ ageRange: '3-18' }, 6)).toBeNull();
    expect(annualFeeForAge({ ageRange: '3-18', fees: {} }, 6)).toBeNull();
    expect(annualFeeForAge({ ageRange: '3-18', fees: { 'Application Fee': 800 } }, 6)).toBeNull();
    expect(annualFeeForAge(null, 6)).toBeNull();
    expect(annualFeeForAge({ fees: { 'Year 1': 100 } }, 25)).toBeNull();
  });

  it('breaks a nearest-neighbour tie downward, to the year already finished', () => {
    // GEMS prices Year 1-3, Year 7-9 and Year 13 only. A 15-year-old (Year 11)
    // sits exactly two steps from Year 9 and from Year 13.
    const gems = { ageRange: '3-18', fees: { 'Year 1-3': 30625, 'Year 7-9': 42850, 'Year 13': 47875 } };
    expect(annualFeeForAge(gems, 15)).toEqual({ fee: 42850, gradeLabel: 'Year 7-9', exact: false });
  });

  it('prefers the more specific label when two ranges overlap', () => {
    // Dalat prices 「Preschool 3-4」 inside the wider 「Kindergarten」 band.
    const dalat = { ageRange: '3-18', fees: { 'Preschool 3-4': 21000, 'Kindergarten': 26000, 'Grade 1-2': 30500 } };
    expect(annualFeeForAge(dalat, 3).gradeLabel).toBe('Preschool 3-4');
    expect(annualFeeForAge(dalat, 5).gradeLabel).toBe('Kindergarten');
    expect(annualFeeForAge(dalat, 6).gradeLabel).toBe('Grade 1-2');
  });
});

// ============================================================
describe('feeComparison', () => {
  const schools = [
    { name: 'Cheap School', lat: 3.15, ageRange: '3-18', curriculum: 'British' },
    { name: 'Pricey School', lat: 5.45, ageRange: '3-18', curriculum: 'IB' },
    { name: 'Senior Only', lat: 3.15, ageRange: '11-18', curriculum: 'British' },
    { name: 'No Data School', lat: 3.15, ageRange: '3-18', curriculum: 'British' },
  ];
  const detail = {
    'Cheap School':  { fees: { 'Year 1': 20000 } },
    'Pricey School': { fees: { 'Year 1': 90000 } },
    'Senior Only':   { fees: { 'Year 9': 57000 } },
    'No Data School': {},
  };

  it('lists every school with a usable fee, cheapest first', () => {
    const { rows } = feeComparison(schools, detail, 5);
    expect(rows.map(r => r.name)).toEqual(['Cheap School', 'Pricey School']);
    expect(rows[0].fee).toBe(20000);
  });

  it('tags each row with the island it is on', () => {
    const { rows } = feeComparison(schools, detail, 5);
    expect(rows.find(r => r.name === 'Cheap School').area).toBe('KL');
    expect(rows.find(r => r.name === 'Pricey School').area).toBe('ペナン');
    expect(areaTag(5.4)).toBe('ペナン');
    expect(areaTag(3.1)).toBe('KL');
  });

  it('counts the schools it left out instead of hiding them', () => {
    const { rows, noDataCount } = feeComparison(schools, detail, 5);
    // Senior Only is out of range at 5, No Data School has no table.
    expect(noDataCount).toBe(2);
    expect(rows).toHaveLength(2);
  });

  it('includes an age-eligible senior school once the child is old enough', () => {
    const { rows } = feeComparison(schools, detail, 13);
    expect(rows.map(r => r.name)).toContain('Senior Only');
  });

  it('survives empty inputs', () => {
    expect(feeComparison(null, null, 5)).toEqual({ rows: [], noDataCount: 0 });
  });
});

// ============================================================
// REAL DATA — the mess this module exists for
// ============================================================
const root = new URL('../', import.meta.url);
const detail = JSON.parse(readFileSync(new URL('schools_detail.json', root), 'utf8').replace(/\r\n/g, '\n'));
const schools = parseCsv(readFileSync(new URL('schools_data.csv', root), 'utf8').replace(/\r\n/g, '\n')).map(r => ({
  name: r.name, lat: Number(r.lat), ageRange: r.age_range, curriculum: r.curriculum, nameJa: r.name_ja,
}));

describe('against the real fee tables (33 schools, KL + Penang)', () => {
  it('places every published fee-table key on the ladder', () => {
    const unparsed = [];
    for (const [school, d] of Object.entries(detail)) {
      for (const key of Object.keys(d.fees || {})) {
        if (!parseFeeLevel(key)) unparsed.push(`${school}: ${key}`);
      }
    }
    expect(unparsed).toEqual([]);
  });

  it('every school with a fee table appears at some age', () => {
    const withFees = Object.entries(detail).filter(([, d]) => Object.keys(d.fees || {}).length);
    const missing = withFees.map(([name]) => name).filter((name) => {
      for (let age = MIN_AGE; age <= MAX_AGE; age++) {
        if (feeComparison(schools, detail, age).rows.some(r => r.name === name)) return false;
      }
      return true;
    });
    expect(missing).toEqual([]);
  });

  it('never returns a number the school did not publish, at any age', () => {
    for (let age = MIN_AGE; age <= MAX_AGE; age++) {
      for (const row of feeComparison(schools, detail, age).rows) {
        const published = Object.values(detail[row.name].fees);
        expect(published, `${row.name} @ ${age}`).toContain(row.fee);
        expect(detail[row.name].fees[row.gradeLabel]).toBe(row.fee);
      }
    }
  });

  it('covers both islands and stays sorted cheapest-first', () => {
    for (const age of [6, 15]) {
      const { rows } = feeComparison(schools, detail, age);
      expect(rows.length).toBeGreaterThan(20);
      expect(new Set(rows.map(r => r.area))).toEqual(new Set(['KL', 'ペナン']));
      const fees = rows.map(r => r.fee);
      expect(fees).toEqual([...fees].sort((a, b) => a - b));
    }
  });

  it('honours each school age range: a 6-year-old sees no senior-only campus', () => {
    const names = feeComparison(schools, detail, 6).rows.map(r => r.name);
    // POWIIS Balik Pulau is 11-18; Sunway is 7-18; JSKL is 6-15.
    expect(names).not.toContain('Prince of Wales Island International School (POWIIS) Balik Pulau');
    expect(names).not.toContain('Sunway International School');
    expect(names).toContain('Japanese School of Kuala Lumpur (JSKL)');
  });

  it('rows carry the school own label so the UI can print 「近い学年」 honestly', () => {
    const { rows } = feeComparison(schools, detail, 6);
    for (const r of rows) {
      expect(typeof r.gradeLabel).toBe('string');
      expect(r.gradeLabel.length).toBeGreaterThan(0);
      expect(typeof r.exact).toBe('boolean');
    }
  });
});
