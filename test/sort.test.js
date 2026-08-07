// Contract for the unified 「並び替え」 comparators (src/domain/sort.js).
import { describe, it, expect } from 'vitest';
import {
  SORT_OPTIONS, COMPARATORS, comparatorFor, defaultSortFor, sortAvailable, sortRecords,
  sortOnArrival,
} from '../src/domain/sort.js';

const names = (list) => list.map(r => r.name);

const condos = [
  { name: 'Bravo', luxScore: 70, rentMid: 4000, salePsfMid: 900, year: 2020 },
  { name: 'Alfa',  luxScore: 50, rentMid: 9000, salePsfMid: 600, year: 2005 },
  { name: 'Charlie', luxScore: 60, rentMid: 2000, salePsfMid: 1200, year: 2015 },
];

const schools = [
  { name: 'Sierra', sizeMin: 45000, units: 800 },
  { name: 'Romeo',  sizeMin: 20000, units: 1700 },
  { name: 'Tango',  sizeMin: 75000, units: 500 },
];

const shops = [
  { name: 'Mall A', sizeMin: 320000, units: 250, year: 2012 },
  { name: 'Mall B', sizeMin: 900000, units: 400, year: 2006 },
  { name: 'Mall C', sizeMin: 73000, units: 50, year: 2000 },
];

describe('sort option sets', () => {
  it('offers one option set per layer, each starting with its default', () => {
    ['condo', 'school', 'commercial'].forEach(layer => {
      expect(SORT_OPTIONS[layer].length).toBeGreaterThan(0);
      expect(defaultSortFor(layer)).toBe(SORT_OPTIONS[layer][0].value);
    });
  });

  it('every offered option has a comparator', () => {
    Object.values(SORT_OPTIONS).flat().forEach(o => {
      expect(typeof COMPARATORS[o.value]).toBe('function');
    });
  });

  it('every option has a Japanese label and a unique value inside its layer', () => {
    Object.entries(SORT_OPTIONS).forEach(([, opts]) => {
      opts.forEach(o => expect(o.label.length).toBeGreaterThan(0));
      expect(new Set(opts.map(o => o.value)).size).toBe(opts.length);
    });
  });

  it('knows which options belong to which layer', () => {
    expect(sortAvailable('condo', 'rentLow')).toBe(true);
    expect(sortAvailable('school', 'rentLow')).toBe(false);
    expect(sortAvailable('school', 'feeLow')).toBe(true);
    expect(sortAvailable('commercial', 'nlaHigh')).toBe(true);
    expect(sortAvailable('condo', 'name')).toBe(true);
  });

  it('falls back to the name order for an unknown key', () => {
    expect(names(sortRecords(condos, 'no-such-sort'))).toEqual(['Alfa', 'Bravo', 'Charlie']);
  });
});

describe('condo comparators — both directions', () => {
  it('おすすめ = highest Luxury score first', () => {
    expect(names(sortRecords(condos, 'luxHigh'))).toEqual(['Bravo', 'Charlie', 'Alfa']);
  });
  it('家賃 安い順 / 高い順 are exact mirrors', () => {
    expect(names(sortRecords(condos, 'rentLow'))).toEqual(['Charlie', 'Bravo', 'Alfa']);
    expect(names(sortRecords(condos, 'rentHigh'))).toEqual(['Alfa', 'Bravo', 'Charlie']);
  });
  it('PSF 安い順 / 高い順 are exact mirrors', () => {
    expect(names(sortRecords(condos, 'psfLow'))).toEqual(['Alfa', 'Bravo', 'Charlie']);
    expect(names(sortRecords(condos, 'psfHigh'))).toEqual(['Charlie', 'Bravo', 'Alfa']);
  });
  it('新しい順 / 古い順 are exact mirrors', () => {
    expect(names(sortRecords(condos, 'yearNew'))).toEqual(['Bravo', 'Charlie', 'Alfa']);
    expect(names(sortRecords(condos, 'yearOld'))).toEqual(['Alfa', 'Charlie', 'Bravo']);
  });
  it('名前順 is alphabetical', () => {
    expect(names(sortRecords(condos, 'name'))).toEqual(['Alfa', 'Bravo', 'Charlie']);
  });

  // "安い順" must not be led by records whose price is simply unknown.
  it('a missing price sinks to the bottom of an ascending sort', () => {
    const withUnknown = [...condos, { name: 'Zulu', rentMid: 0, salePsfMid: 0, luxScore: 0, year: 2030 }];
    expect(names(sortRecords(withUnknown, 'rentLow')).at(-1)).toBe('Zulu');
    expect(names(sortRecords(withUnknown, 'psfLow')).at(-1)).toBe('Zulu');
  });
});

describe('school comparators', () => {
  it('学費 安い順 / 高い順 use the annual entry fee', () => {
    expect(names(sortRecords(schools, 'feeLow'))).toEqual(['Romeo', 'Sierra', 'Tango']);
    expect(names(sortRecords(schools, 'feeHigh'))).toEqual(['Tango', 'Sierra', 'Romeo']);
  });
  it('生徒数 多い順 uses the student count', () => {
    expect(names(sortRecords(schools, 'studentsHigh'))).toEqual(['Romeo', 'Sierra', 'Tango']);
  });
  it('a school with no published fee is not shown as the cheapest', () => {
    const withUnknown = [...schools, { name: 'Zulu', sizeMin: 0, units: 0 }];
    expect(names(sortRecords(withUnknown, 'feeLow')).at(-1)).toBe('Zulu');
  });
});

describe('commercial comparators', () => {
  it('規模 大きい順 uses NLA', () => {
    expect(names(sortRecords(shops, 'nlaHigh'))).toEqual(['Mall B', 'Mall A', 'Mall C']);
  });
  it('店舗数 多い順 uses the tenant count', () => {
    expect(names(sortRecords(shops, 'tenantsHigh'))).toEqual(['Mall B', 'Mall A', 'Mall C']);
  });
  it('新しい順 uses the opening year', () => {
    expect(names(sortRecords(shops, 'yearNew'))).toEqual(['Mall A', 'Mall B', 'Mall C']);
  });
});

describe('determinism', () => {
  it('ties break on the name, so the order never flickers between renders', () => {
    const tied = [
      { name: 'Charlie', luxScore: 60, rentMid: 5000, salePsfMid: 700, year: 2010, sizeMin: 1, units: 1 },
      { name: 'Alfa', luxScore: 60, rentMid: 5000, salePsfMid: 700, year: 2010, sizeMin: 1, units: 1 },
      { name: 'Bravo', luxScore: 60, rentMid: 5000, salePsfMid: 700, year: 2010, sizeMin: 1, units: 1 },
    ];
    Object.keys(COMPARATORS).forEach(key => {
      expect(names(sortRecords(tied, key))).toEqual(['Alfa', 'Bravo', 'Charlie']);
    });
  });

  it('comparatorFor returns a usable function for every option', () => {
    Object.values(SORT_OPTIONS).flat().forEach(o => {
      expect(() => sortRecords(condos, o.value)).not.toThrow();
      expect(typeof comparatorFor(o.value)).toBe('function');
    });
  });
});

// ============================================================
// COMING BACK TO A LAYER (sortOnArrival)
// The bug it fixes, walked through: 物件 in 「PSF 高い順」 → a 学校 tapped on the
// 周辺 tab (学校 has no PSF order, so it falls back to 学費 安い順) → back to
// 物件. Without a per-layer memory the carried order is now feeLow, 物件 does
// not offer that either, and the list silently lands on おすすめ順 — the order
// the user built is gone and nothing on screen says so.
// ============================================================
describe('sortOnArrival', () => {
  it('restores what you last chose on that layer', () => {
    expect(sortOnArrival('condo', 'home', 'feeLow', { condo: 'psfHigh' })).toBe('psfHigh');
  });

  it('walks the whole 物件 → 学校 → 物件 detour without losing the order', () => {
    const remembered = {};
    // 物件, 「PSF 高い順」 chosen.
    remembered.condo = 'psfHigh';
    // → 学校: psfHigh does not exist there, nothing remembered yet → its default.
    const onSchool = sortOnArrival('school', 'home', 'psfHigh', remembered);
    expect(onSchool).toBe('feeLow');
    remembered.school = onSchool;
    // → back to 物件: the memory wins over the carried (and impossible) feeLow.
    expect(sortOnArrival('condo', 'home', onSchool, remembered)).toBe('psfHigh');
  });

  it('carries the current order when the layer has no memory but offers it', () => {
    expect(sortOnArrival('school', 'home', 'name', {})).toBe('name');
  });

  it('falls back to the layer default when neither applies', () => {
    expect(sortOnArrival('school', 'home', 'psfHigh', {})).toBe(defaultSortFor('school'));
    expect(sortOnArrival('commercial', 'home', 'rentLow', {})).toBe(defaultSortFor('commercial'));
  });

  it('never restores an order the layer cannot offer', () => {
    // A stale memory (the layer's options changed, or the mode did) is ignored
    // rather than set — a sort key with no matching <option> would leave the
    // select showing one order while the list used another.
    expect(sortOnArrival('school', 'home', null, { school: 'psfHigh' })).toBe('feeLow');
    expect(sortOnArrival('dining', 'home', null, { dining: 'ledgerHigh' })).toBe(defaultSortFor('dining'));
  });

  it('honours the mode: 台帳スコア順 can be restored in 外食モード only', () => {
    expect(sortOnArrival('dining', 'eatout', null, { dining: 'budgetLow' })).toBe('budgetLow');
    expect(sortOnArrival('dining', 'eatout', null, {})).toBe('ledgerHigh');
  });

  it('is pure: it never writes to the remembered map', () => {
    const remembered = { condo: 'psfHigh' };
    sortOnArrival('school', 'home', 'psfHigh', remembered);
    expect(remembered).toEqual({ condo: 'psfHigh' });
  });

  it('works with no memory argument at all', () => {
    expect(sortOnArrival('condo', 'home', 'name')).toBe('name');
    expect(sortOnArrival('condo', 'home', null)).toBe(defaultSortFor('condo'));
  });
});
