// 行った店 — the aggregates and the grouping behind 外食モードの「記録」ビュー.
//
// One rule governs the whole file, and it is the fix for v9's 欠陥3:
//
//   **every figure counts 訪問済み（v===1）records and nothing else.**
//
// v9 had two populations. The header averaged the amount over all 50 places
// (anything with a number in it), while the Log tab averaged it over the
// visited ones. Un-ticking 訪問済み left the amount behind — on purpose, so an
// accidental tap is undoable — and from then on the two averages disagreed and
// neither was wrong on its own terms. Keeping the hidden data but counting one
// population keeps both properties: nothing is lost, and every screen agrees.
//
// Pure: records + a personal-record lookup in, numbers and arrays out.

import { REPEAT_VALUES, REPEAT_LABELS, amountValue } from '../data/personal.js';
import { num } from '../format.js';

/** Group order is fixed, so the list does not reshuffle as records change. */
export const REPEAT_GROUPS = [
  { key: 'a', label: REPEAT_LABELS.a, colorVar: '--rv-again' },
  { key: 'm', label: REPEAT_LABELS.m, colorVar: '--rv-maybe' },
  { key: 'n', label: REPEAT_LABELS.n, colorVar: '--rv-never' },
  { key: '', label: REPEAT_LABELS[''], colorVar: '--rv-none' },
];

/** `entries` may be a plain object or a function; both are read the same way. */
function lookup(entries){
  if(typeof entries === 'function') return entries;
  return (id) => (entries && entries[id]) || null;
}

/** The 訪問済み records, paired with what you wrote about them. */
export function visitedRecords(records, entries){
  const get = lookup(entries);
  const out = [];
  for(const r of (records || [])){
    const e = get(r && r.id);
    if(e && e.v === 1) out.push({ record: r, entry: e });
  }
  return out;
}

/**
 * The four tiles.
 *
 * 平均実額 is the mean over visited places that HAVE an amount — a place you
 * went to but never priced must not drag the average toward zero, and a 0 is
 * never a price in this app. When none of them has an amount the average is
 * null, which the tile prints as 「–」 rather than 「RM 0」.
 *
 * @returns {{visits:number, again:number, avgAmount:number|null,
 *            totalAmount:number, priced:number}}
 */
export function visitSummary(records, entries){
  const rows = visitedRecords(records, entries);
  const amounts = rows.map(r => amountValue(r.entry)).filter(v => v > 0);
  const total = amounts.reduce((s, v) => s + v, 0);
  return {
    visits: rows.length,
    again: rows.filter(r => r.entry.rv === 'a').length,
    priced: amounts.length,
    avgAmount: amounts.length ? Math.round(total / amounts.length) : null,
    totalAmount: total,
  };
}

/**
 * The visited places, split by 再訪意向 and ordered inside each group by the
 * most recent visit, then by the ledger score.
 *
 * Empty groups are dropped: four headings over one restaurant is furniture.
 *
 * @param {Function} scoreOf  record → 台帳スコア (number). Injected rather than
 *   imported so this stays independent of how the score is computed.
 * @returns {{key:string,label:string,colorVar:string,items:Array}[]}
 */
export function groupByRepeat(records, entries, scoreOf = () => 0){
  const rows = visitedRecords(records, entries);
  return REPEAT_GROUPS.map(g => ({
    ...g,
    items: rows
      .filter(r => (REPEAT_VALUES.includes(r.entry.rv) ? r.entry.rv : '') === g.key)
      .sort((a, b) =>
        String(b.entry.vd || '').localeCompare(String(a.entry.vd || '')) ||
        (scoreOf(b.record) - scoreOf(a.record)) ||
        String(a.record.name).localeCompare(String(b.record.name))),
  })).filter(g => g.items.length > 0);
}

/** 「2026-08-07 訪問 ・ 実額 RM 180／人 ・ 台帳スコア 82」 — one line, one source. */
export function logMetaText(row, score){
  const parts = [row.entry.vd ? `${row.entry.vd} 訪問` : '訪問日なし'];
  const amt = amountValue(row.entry);
  if(amt > 0) parts.push(`実額 RM ${num(amt)}／人`);
  if(score > 0) parts.push(`台帳スコア ${score}`);
  return parts.join(' ・ ');
}
