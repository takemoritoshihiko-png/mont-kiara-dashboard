// Pure sort comparators for the list, one option set per layer.
//
// B3a replaced the six sort buttons with a single 「並び替え」 select, so the
// options have to be data. Every comparator falls back to the name so the
// order is deterministic when the primary key ties.

import { diningPriceCeiling } from './filter.js';

const byName = (a, b) => String(a.name).localeCompare(String(b.name));

// "安い順" must not be led by records whose value is unknown (0). Treat a
// missing/zero value as "the most expensive" so it sinks to the bottom.
const lo = (v) => (v > 0 ? v : Infinity);
const hi = (v) => (v > 0 ? v : 0);

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
  // Budget order runs on the SAME figure the 価格帯 filter uses
  // (diningPriceCeiling: the dinner ceiling, or lunch when dinner is not
  // served), so the sort and the filter can never disagree about a price.
  budgetLow:    (a, b) => lo(diningPriceCeiling(a)) - lo(diningPriceCeiling(b)) || byName(a, b),
  budgetHigh:   (a, b) => hi(diningPriceCeiling(b)) - hi(diningPriceCeiling(a)) || byName(a, b),
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
    { value: 'budgetLow',   label: '予算 安い順（夜基準）' },
    { value: 'budgetHigh',  label: '予算 高い順（夜基準）' },
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

/** The options a layer offers in a given mode. */
export function sortOptionsFor(layer, mode = 'home'){
  const base = SORT_OPTIONS[layer] || SORT_OPTIONS.condo;
  if(layer === 'dining' && mode === 'eatout') return [LEDGER_SORT, ...base];
  return base;
}

/** The comparator for a sort key; unknown keys fall back to the name order. */
export function comparatorFor(key){
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

/**
 * Which order to show a layer in when you arrive at it.
 *
 * The order matters, and it is not the obvious one:
 *   1. what you last chose ON THAT LAYER, when that layer still offers it.
 *      A layer you come back to looks the way you left it — otherwise a detour
 *      (a 学校 tapped on the 周辺 tab) silently deletes the order you built,
 *      because the detour's own fallback overwrote it on the way out.
 *   2. otherwise the order you are carrying, when this layer offers it too
 *      (「名前順」 means the same thing everywhere, so it travels).
 *   3. otherwise the layer's default.
 *
 * Pure: the remembered map is passed in rather than read from state.
 *
 * @param {string} layer          the layer being switched TO
 * @param {string} mode           'home' | 'eatout' — decides which options exist
 * @param {string|null} carried   the sort in effect right now ('' / null = do not carry)
 * @param {Object<string,string>} [remembered]  state.lastSortByLayer
 */
export function sortOnArrival(layer, mode, carried, remembered = {}){
  const memo = remembered && remembered[layer];
  if(memo && sortAvailable(layer, memo, mode)) return memo;
  if(carried && sortAvailable(layer, carried, mode)) return carried;
  return defaultSortFor(layer, mode);
}

/** Non-mutating sort, for tests and callers that need a copy. */
export function sortRecords(list, key){
  return [...list].sort(comparatorFor(key));
}
