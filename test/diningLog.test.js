// Contract for 行った店 (src/domain/diningLog.js).
//
// The point of this file is the sentence at the top of the module: EVERY figure
// counts 訪問済み records and nothing else. 台帳v9 had two populations — the
// header averaged the amount over all 50 places, the Log tab over the visited
// ones — and un-ticking 訪問済み deliberately left the amount behind, so from
// then on the two numbers disagreed and neither was wrong on its own terms.
// Most of what follows is that one rule, checked from several directions.
import { describe, it, expect } from 'vitest';
import {
  REPEAT_GROUPS, visitedRecords, visitSummary, groupByRepeat, logMetaText,
} from '../src/domain/diningLog.js';

const rec = (id, name, over = {}) => ({ id, name, status: 'dining', ...over });
const e = (over = {}) => ({ w: 0, v: 0, vd: '', rv: '', m: '', amt: '', ...over });

const LEDGER = [
  rec('R0001', 'Dewakan'), rec('R0002', 'akar'), rec('R0003', 'Yut Kee'),
  rec('R0004', 'Kanna'), rec('R0005', 'Wong Ah Wah'),
];

// ============================================================
// POPULATION
// ============================================================
describe('the population is 訪問済み and nothing else', () => {
  it('leaves out a place that is only on the 行きたい list', () => {
    const p = { R0001: e({ w: 1 }), R0002: e({ v: 1 }) };
    expect(visitedRecords(LEDGER, p).map(r => r.record.id)).toEqual(['R0002']);
  });

  it('leaves out an un-ticked place even though its amount is still stored', () => {
    // This is the exact v9 divergence: the amount survives the un-tick (so an
    // accidental tap costs nothing) and must stop counting the moment it does.
    const p = { R0001: e({ v: 0, vd: '2026-08-01', rv: 'a', amt: '500', m: '残っている' }) };
    expect(visitedRecords(LEDGER, p)).toEqual([]);
    expect(visitSummary(LEDGER, p)).toMatchObject({ visits: 0, again: 0, avgAmount: null, totalAmount: 0 });
  });

  it('accepts either a lookup object or a function', () => {
    const p = { R0002: e({ v: 1 }) };
    expect(visitedRecords(LEDGER, (id) => p[id]).map(r => r.record.id)).toEqual(['R0002']);
  });

  it('is empty, not broken, when nothing has been recorded at all', () => {
    expect(visitSummary(LEDGER, {})).toEqual({ visits: 0, again: 0, priced: 0, avgAmount: null, totalAmount: 0 });
    expect(groupByRepeat(LEDGER, {})).toEqual([]);
  });
});

// ============================================================
// THE FOUR TILES
// ============================================================
describe('集計4タイル', () => {
  const p = {
    R0001: e({ v: 1, vd: '2026-08-01', rv: 'a', amt: '790' }),
    R0002: e({ v: 1, vd: '2026-08-03', rv: 'a', amt: '340' }),
    R0003: e({ v: 1, vd: '2026-08-05', rv: 'm', amt: '' }),     // visited, never priced
    R0004: e({ w: 1 }),                                          // wanted, not visited
  };

  it('counts visits and また行く', () => {
    expect(visitSummary(LEDGER, p)).toMatchObject({ visits: 3, again: 2 });
  });

  it('averages over the visits that HAVE an amount, not over all visits', () => {
    // (790 + 340) / 2 = 565. Dividing by 3 would call the unpriced meal free.
    expect(visitSummary(LEDGER, p)).toMatchObject({ priced: 2, avgAmount: 565, totalAmount: 1130 });
  });

  it('rounds the average to whole ringgit', () => {
    const q = { R0001: e({ v: 1, amt: '100' }), R0002: e({ v: 1, amt: '101' }), R0003: e({ v: 1, amt: '100' }) };
    expect(visitSummary(LEDGER, q).avgAmount).toBe(100);   // 301/3 = 100.33…
  });

  it('gives null — not 0 — when no visit has a price on it', () => {
    // The tile prints 「–」 for null. 「RM 0」 would be a price nobody paid.
    expect(visitSummary(LEDGER, { R0001: e({ v: 1 }) }).avgAmount).toBeNull();
  });

  it('ignores an amount that is not a number', () => {
    const q = { R0001: e({ v: 1, amt: 'ごちそうになった' }), R0002: e({ v: 1, amt: '200' }) };
    expect(visitSummary(LEDGER, q)).toMatchObject({ priced: 1, avgAmount: 200, totalAmount: 200 });
  });
});

// ============================================================
// GROUPING
// ============================================================
describe('再訪意向でのグループ分け', () => {
  it('keeps the four groups in a fixed order, so the list never reshuffles', () => {
    expect(REPEAT_GROUPS.map(g => g.key)).toEqual(['a', 'm', 'n', '']);
    expect(REPEAT_GROUPS.map(g => g.label)).toEqual(['また行く', '機会があれば', 'もういい', '未回答']);
  });

  it('gives each group its own colour token, never a literal', () => {
    for(const g of REPEAT_GROUPS) expect(g.colorVar).toMatch(/^--rv-/);
  });

  it('hides an empty group instead of printing a heading over nothing', () => {
    const p = { R0001: e({ v: 1, rv: 'a' }), R0002: e({ v: 1, rv: 'a' }) };
    const gs = groupByRepeat(LEDGER, p);
    expect(gs).toHaveLength(1);
    expect(gs[0].key).toBe('a');
    expect(gs[0].items).toHaveLength(2);
  });

  it('files a visited place with no verdict under 未回答', () => {
    const p = { R0001: e({ v: 1 }), R0002: e({ v: 1, rv: 'zzz' }) };
    const gs = groupByRepeat(LEDGER, p);
    expect(gs.map(g => g.key)).toEqual(['']);
    expect(gs[0].items).toHaveLength(2);
  });

  it('orders inside a group by the most recent visit', () => {
    const p = {
      R0001: e({ v: 1, rv: 'a', vd: '2026-07-01' }),
      R0002: e({ v: 1, rv: 'a', vd: '2026-08-09' }),
      R0003: e({ v: 1, rv: 'a', vd: '2026-08-02' }),
    };
    expect(groupByRepeat(LEDGER, p)[0].items.map(r => r.record.id)).toEqual(['R0002', 'R0003', 'R0001']);
  });

  it('breaks a date tie on the 台帳スコア, then on the name', () => {
    const p = {
      R0001: e({ v: 1, rv: 'a', vd: '2026-08-01' }),
      R0002: e({ v: 1, rv: 'a', vd: '2026-08-01' }),
      R0003: e({ v: 1, rv: 'a', vd: '2026-08-01' }),
    };
    // akar scores 90 and leads; Dewakan and Yut Kee tie at 50 and fall back to
    // the name, so D comes before Y.
    const score = (r) => ({ R0001: 50, R0002: 90, R0003: 50 })[r.id];
    expect(groupByRepeat(LEDGER, p, score)[0].items.map(r => r.record.name))
      .toEqual(['akar', 'Dewakan', 'Yut Kee']);
  });

  it('sinks a visit with no date to the bottom of its group', () => {
    const p = {
      R0001: e({ v: 1, rv: 'a', vd: '' }),
      R0002: e({ v: 1, rv: 'a', vd: '2026-08-01' }),
    };
    expect(groupByRepeat(LEDGER, p)[0].items.map(r => r.record.id)).toEqual(['R0002', 'R0001']);
  });

  it('keeps the groups in order even when the data arrives in another one', () => {
    const p = { R0001: e({ v: 1, rv: 'n' }), R0002: e({ v: 1, rv: '' }), R0003: e({ v: 1, rv: 'a' }) };
    expect(groupByRepeat(LEDGER, p).map(g => g.key)).toEqual(['a', 'n', '']);
  });
});

// ============================================================
// THE ROW'S META LINE
// ============================================================
describe('行の一行メタ', () => {
  const row = (over = {}) => ({ record: LEDGER[0], entry: e(over) });

  it('reads 「日付 訪問 ・ 実額 ・ 台帳スコア」', () => {
    expect(logMetaText(row({ v: 1, vd: '2026-08-07', amt: '180' }), 82))
      .toBe('2026-08-07 訪問 ・ 実額 RM 180／人 ・ 台帳スコア 82');
  });

  it('says 訪問日なし rather than printing an empty date', () => {
    expect(logMetaText(row({ v: 1 }), 82)).toBe('訪問日なし ・ 台帳スコア 82');
  });

  it('leaves the amount out entirely rather than printing RM 0', () => {
    expect(logMetaText(row({ v: 1, vd: '2026-08-07', amt: '' }), 82))
      .toBe('2026-08-07 訪問 ・ 台帳スコア 82');
    expect(logMetaText(row({ v: 1, vd: '2026-08-07', amt: '0' }), 82)).not.toContain('RM');
  });

  it('separates the thousands in the amount', () => {
    expect(logMetaText(row({ v: 1, vd: '2026-08-07', amt: '1200' }), 0)).toContain('RM 1,200／人');
  });
});
