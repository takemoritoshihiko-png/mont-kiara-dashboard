// UX2 — the two外食-side changes the task walk-through turned up as real blocks:
//
//   1. 「MK の近くの店」 could not be asked for at all. The area jump bar skipped
//      the dining layer entirely (`activeLayer !== 'dining'` guard), and the
//      ledger's own area labels do not line up with the jump keys, so the answer
//      is a RADIUS from the centre the map flew to.
//   2. 予算 was always judged on the dinner ceiling. 「昼の予算で見る」 switches
//      the basis — for the filter, the sort and the tile TOGETHER. Splitting it
//      into a 昼 filter and a 夜 filter was rejected: a list has one order, so
//      the two halves would disagree and no label could explain the result.
//
// Everything here is pure or reads index.html as text — the repo has no DOM.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  matchesDiningNear, matchesDining, matchesFilters, matchesPriceBand,
  diningPriceCeiling, budgetBasisOf, NEAR_KM, PRICE_BANDS,
  BUDGET_BASIS_DAY, BUDGET_BASIS_NIGHT,
} from '../src/domain/filter.js';
import { haversineKm } from '../src/domain/geo.js';
import { sortOptionsFor, comparatorFor, sortRecords } from '../src/domain/sort.js';
import { AREA_CENTERS } from '../src/ui/map.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const mapSrc = readFileSync(new URL('../src/ui/map.js', import.meta.url), 'utf8');
const LEDGER = JSON.parse(readFileSync(new URL('../restaurants.json', import.meta.url), 'utf8'));

// A dining record. Coordinates default to Mont Kiara's jump centre.
const eat = (over = {}) => ({
  status: 'dining', id: 'R0001', name: 'x',
  lat: 3.17150, lng: 101.65200,
  priceLunch: [0, 0], priceDinner: [0, 0],
  ...over,
});
const MK = AREA_CENTERS['mont-kiara'];
const near = (over = {}) => ({ lat: MK.lat, lng: MK.lng, km: NEAR_KM, label: 'Mont Kiara', ...over });

// ============================================================
// 1. 近く — the distance filter
// ============================================================
describe('matchesDiningNear — 「この辺の店」 answered by distance, not by label', () => {
  it('is off when there is no centre (every restaurant passes)', () => {
    expect(matchesDiningNear(eat(), null)).toBe(true);
    expect(matchesDiningNear(eat(), undefined)).toBe(true);
  });

  it('keeps a restaurant inside the radius', () => {
    expect(matchesDiningNear(eat(), near())).toBe(true);
  });

  it('drops a restaurant outside the radius', () => {
    // KLCC is ~6km from Mont Kiara — well outside 3km.
    const klcc = AREA_CENTERS.klcc;
    expect(matchesDiningNear(eat({ lat: klcc.lat, lng: klcc.lng }), near())).toBe(false);
  });

  it('is inclusive at the boundary, so a店 exactly 3km away is "near"', () => {
    // 0.02697° of latitude ≈ 3.0km; step just inside to stay clear of float noise.
    const justInside = eat({ lat: MK.lat + (NEAR_KM - 0.01) / 111.32, lng: MK.lng });
    const justOutside = eat({ lat: MK.lat + (NEAR_KM + 0.01) / 111.32, lng: MK.lng });
    expect(haversineKm(MK.lat, MK.lng, justInside.lat, justInside.lng)).toBeLessThan(NEAR_KM);
    expect(matchesDiningNear(justInside, near())).toBe(true);
    expect(matchesDiningNear(justOutside, near())).toBe(false);
  });

  it('honours a radius passed in, and falls back to NEAR_KM without one', () => {
    const klcc = AREA_CENTERS.klcc;
    const r = eat({ lat: klcc.lat, lng: klcc.lng });
    expect(matchesDiningNear(r, near({ km: 10 }))).toBe(true);
    expect(matchesDiningNear(r, near({ km: 0 }))).toBe(false);   // 0 = "unset", not "nothing passes"
    expect(matchesDiningNear(eat(), near({ km: undefined }))).toBe(true);
  });

  it('drops a record with no coordinates — unlike an unknown PRICE, an unknown position cannot answer "within 3km"', () => {
    expect(matchesDiningNear(eat({ lat: null, lng: null }), near())).toBe(false);
    expect(matchesDiningNear(null, near())).toBe(false);
  });

  it('ignores a malformed centre rather than emptying the list', () => {
    expect(matchesDiningNear(eat(), { km: 3 })).toBe(true);
    expect(matchesDiningNear(eat(), { lat: NaN, lng: NaN, km: 3 })).toBe(true);
  });
});

describe('近く is a SECOND axis, not a replacement for the ledger エリア', () => {
  it('combines with the ledger area label instead of overriding it', () => {
    const r = eat({ area: 'Mont Kiara' });
    const f = (over) => ({ layer: 'dining', ...over });
    expect(matchesDining(r, f({ near: near(), diningArea: 'Mont Kiara' }))).toBe(true);
    // Right radius, wrong label — both have to agree.
    expect(matchesDining(r, f({ near: near(), diningArea: 'KLCC' }))).toBe(false);
    // Right label, wrong radius.
    const far = eat({ area: 'Mont Kiara', lat: AREA_CENTERS.klcc.lat, lng: AREA_CENTERS.klcc.lng });
    expect(matchesDining(far, f({ near: near(), diningArea: 'Mont Kiara' }))).toBe(false);
  });

  it('combines with every other dining criterion', () => {
    const r = eat({ catGroup: '中華', michelin: 'bib', priceDinner: [80, 120] });
    const f = (over) => ({ layer: 'dining', near: near(), ...over });
    expect(matchesFilters(r, f({ catGroup: '中華' }))).toBe(true);
    expect(matchesFilters(r, f({ catGroup: '洋食・グリル' }))).toBe(false);
    expect(matchesFilters(r, f({ priceBand: '50-150' }))).toBe(true);
    expect(matchesFilters(r, f({ priceBand: '400-' }))).toBe(false);
  });

  it('never touches a non-dining layer — a condo is not filtered by it', () => {
    const condo = { status: 'completed', name: 'Tower', lat: 5.4, lng: 100.3, luxTier: 'A' };
    expect(matchesFilters(condo, { layer: 'condo', near: near() })).toBe(true);
  });
});

describe('3km returns a list worth reading for every KL jump button', () => {
  // The radius is only defensible if the buttons that set it actually produce
  // results. Measured against the real ledger, so it fails when either the
  // constant or the data moves out from under it.
  const KL_KEYS = ['mont-kiara', 'parkcity', 'klcc', 'bangsar', 'damansara', 'klgcc', 'ampang'];
  const within = (key, km) => LEDGER.filter(r =>
    haversineKm(AREA_CENTERS[key].lat, AREA_CENTERS[key].lng, r.lat, r.lng) <= km).length;

  it('is 3km — the walk-or-short-drive radius that matches the buttons’ zoom', () => {
    expect(NEAR_KM).toBe(3);
  });

  it('leaves no KL area empty', () => {
    for(const k of KL_KEYS) expect(within(k, NEAR_KM), `${k} is empty at ${NEAR_KM}km`).toBeGreaterThan(0);
  });

  it('still narrows — no KL area returns most of the ledger', () => {
    for(const k of KL_KEYS){
      expect(within(k, NEAR_KM), `${k} does not narrow`).toBeLessThan(LEDGER.length * 0.75);
    }
  });
});

describe('the jump bar wires the dining layer up at all (the block UX2 removed)', () => {
  it('jumpToArea sets the dining radius instead of skipping the layer', () => {
    const fn = mapSrc.slice(mapSrc.indexOf('export function jumpToArea'));
    const body = fn.slice(0, fn.indexOf('\n}'));
    expect(body).toContain('setDiningNear');
    expect(body).toContain('NEAR_KM');
    // The old guard turned the dining layer OFF; it must not have come back.
    expect(body).not.toContain(`activeLayer !== 'dining'`);
  });

  it('clears the radius for the 全体 keys rather than pinning the map centre', () => {
    const fn = mapSrc.slice(mapSrc.indexOf('export function jumpToArea'));
    expect(fn.slice(0, fn.indexOf('\n}'))).toContain('isWholeRegion(key)');
    for(const k of ['all-kl', 'all-pg']) expect(AREA_CENTERS[k]).toBeTruthy();
  });
});

// ============================================================
// 2. 昼の予算 — one basis, read by everything
// ============================================================
describe('diningPriceCeiling honours the basis', () => {
  const both = eat({ priceLunch: [80, 150], priceDinner: [300, 450] });

  it('leads with dinner by default (unchanged behaviour)', () => {
    expect(diningPriceCeiling(both)).toBe(450);
    expect(diningPriceCeiling(both, BUDGET_BASIS_NIGHT)).toBe(450);
  });

  it('leads with lunch on the day basis', () => {
    expect(diningPriceCeiling(both, BUDGET_BASIS_DAY)).toBe(150);
  });

  it('falls back to the other sitting when the lead one is not offered', () => {
    const dinnerOnly = eat({ priceLunch: [0, 0], priceDinner: [300, 450] });
    const lunchOnly = eat({ priceLunch: [20, 35], priceDinner: [0, 0] });
    // 昼だけ聞かれても、昼をやっていない店は「0円」ではなく夜の額で答える。
    expect(diningPriceCeiling(dinnerOnly, BUDGET_BASIS_DAY)).toBe(450);
    expect(diningPriceCeiling(lunchOnly, BUDGET_BASIS_NIGHT)).toBe(35);
  });

  it('returns 0 — never a price — when neither sitting has a figure', () => {
    for(const b of [BUDGET_BASIS_DAY, BUDGET_BASIS_NIGHT]){
      expect(diningPriceCeiling(eat(), b)).toBe(0);
      expect(diningPriceCeiling(null, b)).toBe(0);
      expect(diningPriceCeiling({}, b)).toBe(0);
    }
  });

  it('treats an unknown basis string as the default rather than throwing', () => {
    expect(diningPriceCeiling(both, 'whatever')).toBe(450);
  });
});

describe('budgetBasisOf — the boolean toggle has exactly one meaning', () => {
  it('maps the 昼 toggle onto the day basis and everything else onto 夜', () => {
    expect(budgetBasisOf(true)).toBe(BUDGET_BASIS_DAY);
    expect(budgetBasisOf(false)).toBe(BUDGET_BASIS_NIGHT);
    expect(budgetBasisOf(undefined)).toBe(BUDGET_BASIS_NIGHT);
  });
});

describe('the price band moves with the basis', () => {
  // 昼 RM 150 / 夜 RM 450 — two different bands depending on what you asked.
  const r = eat({ priceLunch: [80, 150], priceDinner: [300, 450] });

  it('bands the dinner ceiling by default', () => {
    expect(matchesPriceBand(r, '150-400')).toBe(false);
    expect(matchesPriceBand(r, '400-')).toBe(true);
  });

  it('bands the lunch ceiling on the day basis', () => {
    expect(matchesPriceBand(r, '50-150', BUDGET_BASIS_DAY)).toBe(true);
    expect(matchesPriceBand(r, '400-', BUDGET_BASIS_DAY)).toBe(false);
  });

  it('still shows an unpriced restaurant under every band, on both bases', () => {
    for(const b of [BUDGET_BASIS_DAY, BUDGET_BASIS_NIGHT]){
      for(const band of Object.keys(PRICE_BANDS)) expect(matchesPriceBand(eat(), band, b)).toBe(true);
    }
  });
});

describe('the budget SORT moves with the same basis', () => {
  // Cheap at night, dear at lunch, and the other way round — so a basis that
  // reached only one of sort/filter would show up as a different order here.
  const list = [
    eat({ name: 'Lunchy', priceLunch: [0, 400], priceDinner: [0, 60] }),
    eat({ name: 'Dinnery', priceLunch: [0, 40], priceDinner: [0, 600] }),
    eat({ name: 'Steady', priceLunch: [0, 200], priceDinner: [0, 200] }),
  ];
  const names = (key, basis) => sortRecords(list, key, basis).map(r => r.name);

  it('orders by the dinner ceiling by default', () => {
    expect(names('budgetLow')).toEqual(['Lunchy', 'Steady', 'Dinnery']);
    expect(names('budgetHigh')).toEqual(['Dinnery', 'Steady', 'Lunchy']);
  });

  it('orders by the lunch ceiling on the day basis', () => {
    expect(names('budgetLow', BUDGET_BASIS_DAY)).toEqual(['Dinnery', 'Steady', 'Lunchy']);
    expect(names('budgetHigh', BUDGET_BASIS_DAY)).toEqual(['Lunchy', 'Steady', 'Dinnery']);
  });

  it('keeps unpriced restaurants at the bottom of 安い順 on both bases', () => {
    const withUnknown = [...list, eat({ name: 'Zulu' })];
    for(const b of [BUDGET_BASIS_DAY, BUDGET_BASIS_NIGHT]){
      expect(sortRecords(withUnknown, 'budgetLow', b).map(r => r.name).at(-1)).toBe('Zulu');
    }
  });

  it('leaves every non-budget order untouched by the basis', () => {
    for(const key of ['ratingHigh', 'reviewsHigh', 'name', 'ledgerHigh']){
      const a = sortRecords(LEDGER, key, BUDGET_BASIS_NIGHT).map(r => r.id);
      const b = sortRecords(LEDGER, key, BUDGET_BASIS_DAY).map(r => r.id);
      expect(b, key).toEqual(a);
    }
  });
});

// ============================================================
// THE INVARIANT — filter and sort read the SAME number
// This is the whole reason 昼夜 is one basis and not two filters.
// ============================================================
describe('invariant: the price band and the budget order read one figure', () => {
  // '0-150' は今夜プリセット用の累積帯(2026-08-08): 意図的に 0-50 と 50-150 の
  // 和集合なので、分割(partition)の不変条件からは外し、和集合性そのものを固定する。
  const CUMULATIVE = ['0-150'];
  const BANDS = Object.keys(PRICE_BANDS).filter(b => !CUMULATIVE.includes(b));

  it('the cumulative band is exactly the union of its base bands', () => {
    for(const r of LEDGER){
      const inUnion = matchesPriceBand(r, '0-50') || matchesPriceBand(r, '50-150');
      expect(matchesPriceBand(r, '0-150'), r.name).toBe(inUnion);
    }
  });

  for(const basis of [BUDGET_BASIS_NIGHT, BUDGET_BASIS_DAY]){
    it(`every priced restaurant sits in exactly one base band on the ${basis} basis`, () => {
      for(const r of LEDGER){
        const hits = BANDS.filter(b => matchesPriceBand(r, b, basis));
        // Unpriced records are shown under every band on purpose.
        const expected = diningPriceCeiling(r, basis) > 0 ? 1 : BANDS.length;
        expect(hits.length, `${r.name} (${basis}) matched ${hits.join(',')}`).toBe(expected);
      }
    });

    it(`安い順 walks the bands in order on the ${basis} basis`, () => {
      // If the sort read a different figure from the filter, the band index of
      // the sorted list would not be monotonic.
      const priced = LEDGER.filter(r => diningPriceCeiling(r, basis) > 0);
      const sorted = sortRecords(priced, 'budgetLow', basis);
      const idx = (r) => BANDS.findIndex(b => matchesPriceBand(r, b, basis));
      for(let i = 1; i < sorted.length; i++){
        expect(idx(sorted[i]), `${sorted[i].name} after ${sorted[i - 1].name}`)
          .toBeGreaterThanOrEqual(idx(sorted[i - 1]));
      }
    });

    it(`filtering to one band leaves 安い順 sorted on the ${basis} basis`, () => {
      for(const band of BANDS){
        const inBand = LEDGER.filter(r => matchesPriceBand(r, band, basis)
          && diningPriceCeiling(r, basis) > 0);
        const vals = sortRecords(inBand, 'budgetLow', basis).map(r => diningPriceCeiling(r, basis));
        for(let i = 1; i < vals.length; i++) expect(vals[i]).toBeGreaterThanOrEqual(vals[i - 1]);
      }
    });
  }

  it('a comparator asked for the day basis really is a different function', () => {
    const night = comparatorFor('budgetLow', BUDGET_BASIS_NIGHT);
    const day = comparatorFor('budgetLow', BUDGET_BASIS_DAY);
    const a = eat({ name: 'A', priceLunch: [0, 400], priceDinner: [0, 60] });
    const b = eat({ name: 'B', priceLunch: [0, 40], priceDinner: [0, 600] });
    expect(Math.sign(night(a, b))).toBe(-1);
    expect(Math.sign(day(a, b))).toBe(1);
  });
});

describe('the order NAMES which sitting it ran on', () => {
  const labelOf = (opts, v) => opts.find(o => o.value === v).label;

  it('says 夜基準 by default', () => {
    const opts = sortOptionsFor('dining', 'home');
    expect(labelOf(opts, 'budgetLow')).toContain('夜基準');
    expect(labelOf(opts, 'budgetHigh')).toContain('夜基準');
  });

  it('says 昼基準 while the toggle is on', () => {
    const opts = sortOptionsFor('dining', 'home', BUDGET_BASIS_DAY);
    expect(labelOf(opts, 'budgetLow')).toContain('昼基準');
    expect(labelOf(opts, 'budgetLow')).not.toContain('夜基準');
    expect(labelOf(opts, 'budgetHigh')).toContain('昼基準');
  });

  it('renames nothing else, and keeps the option VALUES stable', () => {
    for(const mode of ['home', 'eatout']){
      const night = sortOptionsFor('dining', mode);
      const day = sortOptionsFor('dining', mode, BUDGET_BASIS_DAY);
      expect(day.map(o => o.value)).toEqual(night.map(o => o.value));
      night.forEach((o, i) => {
        if(o.value.startsWith('budget')) return;
        expect(day[i].label).toBe(o.label);
      });
    }
  });

  it('leaves the other layers’ options alone whatever the basis', () => {
    for(const layer of ['condo', 'school', 'commercial']){
      expect(sortOptionsFor(layer, 'home', BUDGET_BASIS_DAY))
        .toEqual(sortOptionsFor(layer, 'home'));
    }
  });
});

// ============================================================
// MARKUP CONTRACTS
// ============================================================
describe('住まいモードの層タブに飲食への入口がある', () => {
  const seg = html.slice(html.indexOf('id="layerSeg"'), html.indexOf('id="searchRow"'));

  it('offers a fourth button that goes to the dining side', () => {
    expect(seg).toContain('data-layer="dining"');
    expect(seg).toContain(`onclick="setLayer('dining')"`);
  });

  it('says on its face that it LEAVES this mode', () => {
    // The layer chips (UX3): the dining chip's NAME button is the door out.
    const chip = seg.slice(seg.indexOf('data-layer="dining"'));
    expect(chip).toContain('title="外食モードを開く"');
    expect(chip).toContain('↗');
  });

  it('is never the current layer of the home list', () => {
    const chip = seg.slice(seg.indexOf('data-layer="dining"'));
    expect(chip.slice(0, chip.indexOf('</div>'))).toContain('aria-current="false"');
  });

  it('keeps setLayer(dining) as the hand-over to 外食モード, not a home layer', () => {
    const list = readFileSync(new URL('../src/ui/list.js', import.meta.url), 'utf8');
    const fn = list.slice(list.indexOf('export function setLayer'));
    expect(fn.slice(0, fn.indexOf('\n}'))).toContain(`setMode('eatout')`);
  });
});

describe('「昼の予算」トグルの markup', () => {
  it('sits in the dining filters, next to the price band', () => {
    const row = html.slice(html.indexOf('id="fPriceBand"'));
    const upToRowEnd = row.slice(0, row.indexOf('</div>\n        <!--'));
    expect(upToRowEnd).toContain('id="toggleDayBudget"');
  });

  it('is a pressable toggle, announced as one', () => {
    // The whole opening tag — `class` sits before `id` in the markup.
    const i = html.indexOf('id="toggleDayBudget"');
    const tag = html.slice(html.lastIndexOf('<button', i), html.indexOf('>', i));
    expect(tag).toContain('class="chip-toggle"');
    expect(tag).toContain('aria-pressed="false"');
    expect(tag).toContain('onclick="toggleDayBudget()"');
  });

  it('has a 40px tap target on a phone', () => {
    const mobile = html.slice(html.indexOf('@media(max-width:768px)'));
    expect(mobile).toMatch(/#toggleDayBudget[^\n]*min-height:40px|\.chip-toggle[^\n]*min-height:40px/);
  });

  it('gives the 価格帯 caption an id, so the basis can be written into it', () => {
    expect(html).toContain('id="fPriceBandLabel"');
    expect(html).toContain('価格帯 (1人・夜基準)');
  });

  it('keeps the ledger エリア select as its own separate control', () => {
    expect(html).toContain('id="fDiningArea"');
  });
});
