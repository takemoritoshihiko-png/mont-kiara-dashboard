// Pure sort comparators for the list, one option set per layer.
//
// B3a replaced the six sort buttons with a single 「並び替え」 select, so the
// options have to be data. Every comparator falls back to the name so the
// order is deterministic when the primary key ties.

import { diningPriceCeiling, BUDGET_BASIS_NIGHT, BUDGET_BASIS_DAY } from './filter.js';

const byName = (a, b) => String(a.name).localeCompare(String(b.name));

// "安い順" must not be led by records whose value is unknown (0). Treat a
// missing/zero value as "the most expensive" so it sinks to the bottom.
const lo = (v) => (v > 0 ? v : Infinity);
const hi = (v) => (v > 0 ? v : 0);

// Budget order runs on the SAME figure the 価格帯 filter uses
// (diningPriceCeiling), read on the SAME basis — 夜 by default, 昼 while
// 「昼の予算で見る」 is on. Both come from one factory so a change of basis can
// never reach one of the two and not the other.
// The order's own name has to say which sitting it ran on, otherwise 「予算 安い
// 順」 quietly means two different things depending on a toggle elsewhere on
// the panel. Same table for both bases, so the two can never drift.
const BUDGET_LABELS = {
  budgetLow:  { [BUDGET_BASIS_NIGHT]: '予算 安い順（夜基準）', [BUDGET_BASIS_DAY]: '予算 安い順（昼基準）' },
  budgetHigh: { [BUDGET_BASIS_NIGHT]: '予算 高い順（夜基準）', [BUDGET_BASIS_DAY]: '予算 高い順（昼基準）' },
};

const BUDGET_FACTORIES = {
  budgetLow:  (basis) => (a, b) => lo(diningPriceCeiling(a, basis)) - lo(diningPriceCeiling(b, basis)) || byName(a, b),
  budgetHigh: (basis) => (a, b) => hi(diningPriceCeiling(b, basis)) - hi(diningPriceCeiling(a, basis)) || byName(a, b),
};

export const COMPARATORS = {
  name:         byName,
  // condo
  luxHigh:      (a, b) => b.luxScore - a.luxScore || byName(a, b),
  rentLow:      (a, b) => lo(a.rentMid) - lo(b.rentMid) || byName(a, b),
  rentHigh:     (a, b) => hi(b.rentMid) - hi(a.rentMid) || byName(a, b),
  psfLow:       (a, b) => lo(a.salePsfMid) - lo(b.salePsfMid) || byName(a, b),
  psfHigh:      (a, b) => hi(b.salePsfMid) - hi(a.salePsfMid) || byName(a, b),
  yearNew:      (a, b) => b.year - a.year || byName(a, b),
  yearOld:      (a, b) => a.year - b.year || byName(a, b),
  // school — annual fee lives in sizeMin/sizeMax, student count in units
  feeLow:       (a, b) => lo(a.sizeMin) - lo(b.sizeMin) || byName(a, b),
  feeHigh:      (a, b) => hi(b.sizeMin) - hi(a.sizeMin) || byName(a, b),
  studentsHigh: (a, b) => hi(b.units) - hi(a.units) || byName(a, b),
  // commercial — NLA lives in sizeMin, tenant count in units
  nlaHigh:      (a, b) => hi(b.sizeMin) - hi(a.sizeMin) || byName(a, b),
  tenantsHigh:  (a, b) => hi(b.units) - hi(a.units) || byName(a, b),
  // dining — a ★4.9 out of 12 reviews is not better than ★4.8 out of 2,237, so
  // the review count breaks the tie before the name does.
  ratingHigh:   (a, b) => hi(b.rating) - hi(a.rating) || hi(b.reviewCount) - hi(a.reviewCount) || byName(a, b),
  reviewsHigh:  (a, b) => hi(b.reviewCount) - hi(a.reviewCount) || byName(a, b),
  // The default-basis (夜) budget orders. comparatorFor() rebuilds them on the
  // day basis when the toggle is on.
  budgetLow:    BUDGET_FACTORIES.budgetLow(BUDGET_BASIS_NIGHT),
  budgetHigh:   BUDGET_FACTORIES.budgetHigh(BUDGET_BASIS_NIGHT),
  // 台帳スコア順 (D4). The score is not on the record — it depends on the whole
  // ledger's baseline — so the comparator reads a value the renderer stamped on
  // (`ledgerTotal`). A record without one sorts as 0 rather than NaN, which
  // would make the whole sort unstable.
  ledgerHigh:   (a, b) => hi(b.ledgerTotal) - hi(a.ledgerTotal) || hi(b.rating) - hi(a.rating) || byName(a, b),
};

export const SORT_OPTIONS = {
  condo: [
    { value: 'luxHigh',  label: 'おすすめ（Luxury順）' },
    { value: 'rentLow',  label: '家賃 安い順' },
    { value: 'rentHigh', label: '家賃 高い順' },
    { value: 'psfLow',   label: 'PSF 安い順' },
    { value: 'psfHigh',  label: 'PSF 高い順' },
    { value: 'yearNew',  label: '新しい順' },
    { value: 'yearOld',  label: '古い順' },
    { value: 'name',     label: '名前順' },
  ],
  school: [
    { value: 'feeLow',       label: '学費 安い順' },
    { value: 'feeHigh',      label: '学費 高い順' },
    { value: 'studentsHigh', label: '生徒数 多い順' },
    { value: 'name',         label: '名前順' },
  ],
  commercial: [
    { value: 'nlaHigh',     label: '規模 大きい順' },
    { value: 'tenantsHigh', label: '店舗数 多い順' },
    { value: 'yearNew',     label: '新しい順' },
    { value: 'name',        label: '名前順' },
  ],
  dining: [
    { value: 'ratingHigh',  label: '評価が高い順' },
    { value: 'reviewsHigh', label: 'レビュー数 多い順' },
    { value: 'budgetLow',   label: BUDGET_LABELS.budgetLow[BUDGET_BASIS_NIGHT] },
    { value: 'budgetHigh',  label: BUDGET_LABELS.budgetHigh[BUDGET_BASIS_NIGHT] },
    { value: 'name',        label: '名前順' },
  ],
};

/**
 * 台帳スコア順 is offered in 外食モード only, and there it leads.
 *
 * It is deliberately NOT in the base list: the score is only *shown* in 外食
 * モード, and an order you cannot see the key of is a list in an arbitrary
 * sequence. In 住まいモード the 飲食 layer answers "what is around this condo",
 * where the raw Google rating is the honest lead. See the mode note in
 * src/state.js.
 */
const LEDGER_SORT = { value: 'ledgerHigh', label: '台帳スコア順（総合点）' };

/**
 * The options a layer offers in a given mode.
 *
 * @param {string} layer
 * @param {string} [mode]   'home' | 'eatout'
 * @param {'night'|'day'} [basis]  which sitting the budget orders name
 */
export function sortOptionsFor(layer, mode = 'home', basis = BUDGET_BASIS_NIGHT){
  const base = SORT_OPTIONS[layer] || SORT_OPTIONS.condo;
  const opts = (layer === 'dining' && mode === 'eatout') ? [LEDGER_SORT, ...base] : base;
  if(basis === BUDGET_BASIS_NIGHT) return opts;
  return opts.map(o => (BUDGET_LABELS[o.value] ? { ...o, label: BUDGET_LABELS[o.value][basis] } : o));
}

/**
 * The comparator for a sort key; unknown keys fall back to the name order.
 * `basis` only reaches the two budget orders — everything else ignores it.
 */
export function comparatorFor(key, basis = BUDGET_BASIS_NIGHT){
  const factory = BUDGET_FACTORIES[key];
  if(factory) return factory(basis);
  return COMPARATORS[key] || byName;
}

/** First option of the layer = its default order. */
export function defaultSortFor(layer, mode = 'home'){
  return sortOptionsFor(layer, mode)[0].value;
}

/** True when `key` is offered by that layer's select in that mode. */
export function sortAvailable(layer, key, mode = 'home'){
  return sortOptionsFor(layer, mode).some(o => o.value === key);
}

/** Non-mutating sort, for tests and callers that need a copy. */
export function sortRecords(list, key, basis = BUDGET_BASIS_NIGHT){
  return [...list].sort(comparatorFor(key, basis));
}
