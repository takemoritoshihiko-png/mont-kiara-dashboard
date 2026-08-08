// Contract for 台帳スコア (src/domain/diningScore.js, ported from 台帳v9 §3).
//
// A score is the one thing on a card that nobody can check by looking at it.
// If the arithmetic drifts — a constant nudged, a tag renamed in the data, a
// rounding moved — every restaurant is quietly reordered and the screen still
// looks right. So the constants, the enum and a set of HAND-COMPUTED fixtures
// are pinned here, and the enum is checked against restaurants.json itself.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  PRIOR_WEIGHT, MICHELIN_POINTS, TIER_POINTS, EX_TAG_POINTS,
  AUTHORITY_MAX, EVALUATION_MAX, EV_FLOOR, EV_SPAN,
  baselineRating, BASELINE_STAR, knownExTags, authorityPoints, continuityPoints,
  shrunkRating, evaluationPoints, ledgerScore, scoreBreakdownText, scoreBars,
  reviewDepthLabel, ratingMetaText, calcLedgerScores,
} from '../src/domain/diningScore.js';
import { parseRestaurants } from '../src/data/load.js';

const RAW = readFileSync(new URL('../restaurants.json', import.meta.url), 'utf8');
const LEDGER = parseRestaurants(RAW);
// The baseline's provenance: v9's original 50 records (R0001-R0050). The D6
// expansion grows the file past them, but the pinned BASELINE_STAR keeps
// pointing at this figure — recomputing over a growing ledger would let one
// 25k-review addition move every other store's score.
const C_REAL = baselineRating(LEDGER.slice(0, 50));

const eat = (over = {}) => ({
  name: 'Test', michelin: 'none', tier: 0, extraFlags: [],
  rating: 4.0, reviewCount: 100, ...over,
});

// ============================================================
// CONSTANTS
// ============================================================
describe('the constants are the ledger\'s, not something that drifted', () => {
  it('keeps v9\'s prior weight and its two ceilings', () => {
    expect(PRIOR_WEIGHT).toBe(800);
    expect(AUTHORITY_MAX).toBe(35);
    expect(EVALUATION_MAX).toBe(40);
  });

  it('keeps the michelin and tier tables exactly', () => {
    expect(MICHELIN_POINTS).toEqual({ '2star': 35, '1star': 29, bib: 21, sel: 16, none: 8 });
    expect(TIER_POINTS).toEqual({ 4: 25, 3: 19, 2: 12, 1: 6, 0: 0 });
  });

  it('puts the evaluation floor at ★3.90 and full marks at ★4.70', () => {
    expect(EV_FLOOR).toBe(3.90);
    expect(EV_FLOOR + EV_SPAN).toBeCloseTo(4.70, 10);
  });
});

// ============================================================
// C — the baseline
// ============================================================
describe('C, the ledger-wide baseline star', () => {
  it('BASELINE_STAR stays pinned at 4.36; the live first-50 recompute may drift', () => {
    // 2026-08-08: 旧Heun Kee(先頭50の一員)がYan Keeとして再生し評価がリセット
    // されたため、先頭50からの再計算値は完全一致しなくなった。アプリが使うのは
    // ピン(BASELINE_STAR)だけであり、そこは動かさないのが契約。
    expect(BASELINE_STAR).toBe(4.36);
    expect(C_REAL).toBeCloseTo(4.36, 1);   // 来歴の緩い整合(±0.05)
  });

  it('is weighted by review count, not a plain mean of the stars', () => {
    // A plain mean of 5.0 and 3.0 is 4.0; weighted 1:9 it is 3.2.
    const recs = [eat({ rating: 5.0, reviewCount: 100 }), eat({ rating: 3.0, reviewCount: 900 })];
    expect(baselineRating(recs)).toBeCloseTo(3.2, 10);
  });

  it('ignores records with no reviews or no rating rather than counting them as 0', () => {
    const recs = [eat({ rating: 4.5, reviewCount: 200 }), eat({ rating: 0, reviewCount: 900 }),
      eat({ rating: 4.9, reviewCount: 0 })];
    expect(baselineRating(recs)).toBeCloseTo(4.5, 10);
  });

  it('is 0 — not NaN — for an empty ledger', () => {
    expect(baselineRating([])).toBe(0);
    expect(baselineRating(null)).toBe(0);
  });
});

// ============================================================
// au — the ENUM (v9 pattern-matched free text; this must not)
// ============================================================
describe('権威点 au', () => {
  it('scores every one of the six tags the data actually carries', () => {
    expect(EX_TAG_POINTS).toEqual({
      '国際評価': 3,
      "Asia's 50 Best Bars": 4,
      'Tatler Best 20': 4,
      'Tatler Best-in-Class': 2,
      '2026 Service Award': 2,
      '屋号は要確認': 0,
    });
  });

  it('knows every tag in restaurants.json — a new one must be scored on purpose', () => {
    const inData = new Set();
    LEDGER.forEach(r => (r.extraFlags || []).forEach(t => inData.add(t)));
    const unscored = [...inData].filter(t => !(t in EX_TAG_POINTS));
    expect(unscored, 'restaurants.json grew a tag diningScore.js does not know').toEqual([]);
  });

  it('adds every known tag, and ignores a tag that is not in the table', () => {
    expect(authorityPoints(eat({ michelin: 'sel', extraFlags: ['国際評価'] }))).toBe(19);
    expect(authorityPoints(eat({ michelin: 'sel', extraFlags: ['Tatler Best 20'] }))).toBe(20);
    expect(authorityPoints(eat({ michelin: 'sel', extraFlags: ['Tatler Best-in-Class'] }))).toBe(18);
    expect(authorityPoints(eat({ michelin: 'sel', extraFlags: ['2026 Service Award'] }))).toBe(18);
    expect(authorityPoints(eat({ michelin: 'sel', extraFlags: ['屋号は要確認'] }))).toBe(16);
    // v9 matched the substring "Award", so any new award-shaped string scored.
    expect(authorityPoints(eat({ michelin: 'sel', extraFlags: ['2030 Service Award'] }))).toBe(16);
    expect(knownExTags(eat({ extraFlags: ['国際評価', 'なにか'] }))).toEqual(['国際評価']);
  });

  it('sums two tags on the same record', () => {
    // K KL（圭）carries both Tatler Best-in-Class and 2026 Service Award.
    expect(authorityPoints(eat({ michelin: 'bib', extraFlags: ['Tatler Best-in-Class', '2026 Service Award'] })))
      .toBe(21 + 2 + 2);
  });

  it('caps at 35: ★2 already spends the whole budget', () => {
    expect(authorityPoints(eat({ michelin: '2star', extraFlags: ['国際評価'] }))).toBe(35);
    expect(authorityPoints(eat({ michelin: '2star', extraFlags: ['Tatler Best 20', '国際評価'] }))).toBe(35);
  });

  it('treats an unknown / missing michelin value as 掲載なし rather than crashing', () => {
    expect(authorityPoints(eat({ michelin: '' }))).toBe(8);
    expect(authorityPoints({})).toBe(8);
  });
});

describe('継続性点 ct', () => {
  it('reads the tier straight off the record', () => {
    for(const [t, v] of Object.entries(TIER_POINTS)) expect(continuityPoints(eat({ tier: Number(t) }))).toBe(v);
  });

  it('is 0 for a tier the table does not know', () => {
    expect(continuityPoints(eat({ tier: 9 }))).toBe(0);
    expect(continuityPoints({})).toBe(0);
  });
});

// ============================================================
// rb / ev
// ============================================================
describe('rb, the shrunk star', () => {
  it('is the ledger average when a place has no reviews of its own', () => {
    expect(shrunkRating(eat({ reviewCount: 0 }), 4.36)).toBe(4.36);
    expect(shrunkRating(eat({ rating: 0 }), 4.36)).toBe(4.36);
  });

  it('sits halfway when a place has exactly the prior weight in reviews', () => {
    // (800×4.8 + 800×4.0) / 1600 = 4.4
    expect(shrunkRating(eat({ rating: 4.8, reviewCount: 800 }), 4.0)).toBeCloseTo(4.4, 10);
  });

  it('barely moves for a thin sample, and nearly reaches the raw star for a thick one', () => {
    expect(shrunkRating(eat({ rating: 5.0, reviewCount: 20 }), 4.0)).toBeCloseTo(4.024390, 5);
    expect(shrunkRating(eat({ rating: 5.0, reviewCount: 20000 }), 4.0)).toBeCloseTo(4.961538, 5);
  });
});

describe('評価点 ev', () => {
  it('is 0 at the floor and full at the top of the span', () => {
    expect(evaluationPoints(3.90)).toBe(0);
    expect(evaluationPoints(4.70)).toBe(40);
  });

  it('clamps at both ends instead of going negative or past 40', () => {
    expect(evaluationPoints(3.0)).toBe(0);
    expect(evaluationPoints(0)).toBe(0);
    expect(evaluationPoints(5.0)).toBe(40);
    expect(evaluationPoints(99)).toBe(40);
  });

  it('is linear in between', () => {
    expect(evaluationPoints(4.30)).toBeCloseTo(20, 10);
    expect(evaluationPoints(4.00)).toBeCloseTo(5, 10);
    expect(evaluationPoints(4.50)).toBeCloseTo(30, 10);
  });
});

// ============================================================
// HAND-COMPUTED FIXTURES
// Each one is worked out in the comment, so a future change has to argue with
// arithmetic rather than with a magic number.
// ============================================================
describe('hand-computed totals', () => {
  it('掲載店 / tier2 / ★4.0 out of 200, on a ledger averaging 4.0 → 33', () => {
    // au = 16, ct = 12
    // rb = (200×4.0 + 800×4.0) / 1000 = 4.00
    // ev = 40 × (4.00 − 3.90) / 0.80 = 40 × 0.125 = 5
    // total = round(16 + 12 + 5) = 33
    const s = ledgerScore(eat({ michelin: 'sel', tier: 2, rating: 4.0, reviewCount: 200 }), 4.0);
    expect(s.au).toBe(16);
    expect(s.ct).toBe(12);
    expect(s.rb).toBeCloseTo(4.00, 10);
    expect(s.ev).toBeCloseTo(5, 10);
    expect(s.total).toBe(33);
  });

  it('★1 + Tatler Best 20 / tier3 / ★4.7 out of 800, ledger 4.3 → 82', () => {
    // au = 29 + 4 = 33, ct = 19
    // rb = (800×4.7 + 800×4.3) / 1600 = 4.50
    // ev = 40 × (4.50 − 3.90) / 0.80 = 40 × 0.75 = 30
    // total = round(33 + 19 + 30) = 82
    const s = ledgerScore(eat({ michelin: '1star', tier: 3, extraFlags: ['Tatler Best 20'],
      rating: 4.7, reviewCount: 800 }), 4.3);
    expect(s).toMatchObject({ au: 33, ct: 19, total: 82 });
    expect(s.rb).toBeCloseTo(4.50, 10);
  });

  it('a place nobody has reviewed lands on the ledger average, not on zero', () => {
    // rb = C = 4.36 → ev = 40 × (0.46/0.80) = 23
    // total = round(8 + 0 + 23) = 31
    const s = ledgerScore(eat({ michelin: 'none', tier: 0, rating: 0, reviewCount: 0 }), 4.36);
    expect(s.rb).toBe(4.36);
    expect(s.total).toBe(31);
  });

  it('Dewakan, from the real file: ★2 + 国際評価 / tier4 / ★4.2 of 548 → 80', () => {
    // au = min(35, 35 + 3) = 35, ct = 25
    // rb = (548×4.2 + 800×4.360029…) / 1348 = 4.29497…
    // ev = 40 × (4.29497 − 3.90) / 0.80 = 19.7486…
    // total = round(35 + 25 + 19.7486) = 80
    const r = LEDGER.find(x => x.name === 'Dewakan');
    const s = ledgerScore(r, BASELINE_STAR);
    expect(s.au).toBe(35);
    expect(s.ct).toBe(25);
    expect(s.rb).toBeCloseTo(4.29496, 4);
    expect(s.total).toBe(80);
  });

  it('akar, from the real file: ★1 / tier1 / ★4.8 of 1,178 → 71', () => {
    // au = 29, ct = 6
    // rb = (1178×4.8 + 800×C_REAL) / 1978 = 4.62204…
    //   C_REAL は先頭50店の実データから再計算される来歴チェック。2026-08-08 に
    //   Kappo Hiyori→Wagyu Kappo Yoshida の改名で評価値を実勢へ直したため
    //   小数第5位が動いた(アプリ本体は BASELINE_STAR=4.36 固定で無影響)。
    // ev = 40 × 0.72205/0.80 = 36.102…
    // total = round(29 + 6 + 36.102) = 71
    const s = ledgerScore(LEDGER.find(x => x.name === 'akar'), BASELINE_STAR);
    expect(s).toMatchObject({ au: 29, ct: 6, total: 71 });
    expect(s.rb).toBeCloseTo(4.62204, 4);
  });
});

// ============================================================
// THE PRINTED BREAKDOWN
// ============================================================
describe('the breakdown adds up to the number beside it (v9 欠陥5)', () => {
  it('derives the printed ev from the total instead of rounding it separately', () => {
    const s = ledgerScore(LEDGER.find(x => x.name === 'Dewakan'), C_REAL);
    expect(scoreBreakdownText(s)).toBe('35 + 25 + 20');
    const parts = scoreBreakdownText(s).split(' + ').map(Number);
    expect(parts[0] + parts[1] + parts[2]).toBe(s.total);
  });

  it('holds for every restaurant in the file, not just the one that was checked', () => {
    for(const r of LEDGER){
      const s = ledgerScore(r, BASELINE_STAR);
      const sum = scoreBreakdownText(s).split(' + ').map(Number).reduce((a, b) => a + b, 0);
      expect(sum, r.name).toBe(s.total);
    }
  });

  it('gives each bar its own ceiling so the three are comparable at a glance', () => {
    const bars = scoreBars(ledgerScore(eat(), 4.36));
    expect(bars.map(b => b.key)).toEqual(['au', 'ct', 'ev']);
    expect(bars.map(b => b.max)).toEqual([35, 25, 40]);
  });
});

// ============================================================
// 母数 / the meta line
// ============================================================
describe('レビュー母数の厚み', () => {
  it('uses v9\'s thresholds', () => {
    expect(reviewDepthLabel(3000)).toBe('厚い');
    expect(reviewDepthLabel(2999)).toBe('標準');
    expect(reviewDepthLabel(1000)).toBe('標準');
    expect(reviewDepthLabel(999)).toBe('やや薄い');
    expect(reviewDepthLabel(300)).toBe('やや薄い');
    expect(reviewDepthLabel(299)).toBe('薄い');
    expect(reviewDepthLabel(0)).toBe('薄い');
  });

  it('prints the star, the sample size, its thickness and the shrunk value', () => {
    expect(ratingMetaText(LEDGER.find(x => x.name === 'akar'), BASELINE_STAR))
      .toBe('Google ★4.8 / 1,178件（母数 標準） → 縮約後 4.62');
  });

  it('says nothing at all when there is no rating — rather than 「★0」', () => {
    expect(ratingMetaText(eat({ rating: 0 }), 4.36)).toBe('');
  });
});

// ============================================================
// STAMPING
// ============================================================
describe('calcLedgerScores', () => {
  it('stamps every record with its score, its total and the baseline used', () => {
    const recs = parseRestaurants(RAW);
    const C = calcLedgerScores(recs);
    expect(C).toBeCloseTo(4.36, 2);
    for(const r of recs){
      expect(r.ledgerTotal, r.name).toBe(r.ledgerScore.total);
      expect(r.ledgerBaseline).toBe(C);
      expect(r.ledgerTotal).toBeGreaterThan(0);
      expect(r.ledgerTotal).toBeLessThanOrEqual(100);
    }
  });

  it('produces a spread worth sorting by, not near-identical numbers', () => {
    const recs = parseRestaurants(RAW);
    calcLedgerScores(recs);
    const totals = recs.map(r => r.ledgerTotal);
    // 台帳はデータ追加で伸びる(2026-08-09に131→217行)ので、正確な最小/最大の
    // ピン留めではなく「分布の幅」を守る。40点以上の開きがあればソートは機能する。
    expect(Math.min(...totals)).toBeLessThanOrEqual(35);
    expect(Math.max(...totals)).toBeGreaterThanOrEqual(85);
    expect(Math.max(...totals) - Math.min(...totals)).toBeGreaterThanOrEqual(40);
  });
});
