// Pure sort comparators for the list, one option set per layer.
//
// B3a replaced the six sort buttons with a single 「並び替え」 select, so the
// options have to be data. Every comparator falls back to the name so the
// order is deterministic when the primary key ties.

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
};

/** The comparator for a sort key; unknown keys fall back to the name order. */
export function comparatorFor(key){
  return COMPARATORS[key] || byName;
}

/** First option of the layer = its default order. */
export function defaultSortFor(layer){
  const opts = SORT_OPTIONS[layer] || SORT_OPTIONS.condo;
  return opts[0].value;
}

/** True when `key` is offered by that layer's select. */
export function sortAvailable(layer, key){
  return (SORT_OPTIONS[layer] || []).some(o => o.value === key);
}

/** Non-mutating sort, for tests and callers that need a copy. */
export function sortRecords(list, key){
  return [...list].sort(comparatorFor(key));
}
