// 台帳スコア — the dining ledger's 100-point total, ported from 台帳v9 §3.
//
// The number answers one question: "how much does this place's reputation
// actually stand up?" It is built from three things that can be checked, and
// nothing that cannot:
//
//   au  権威    ミシュランの区分 + 外部の受賞・国際評価        max 35
//   ct  継続性  Tier（何年続いているか・のれんの厚み）         max 25
//   ev  評価    Google★をレビュー母数で縮約した値              max 40
//
// The evaluation term is the interesting one. A ★4.9 out of 12 reviews is not
// better than a ★4.8 out of 2,237, so the raw star is pulled toward the
// ledger-wide average by a Bayesian prior: with M = 800 phantom reviews sitting
// at the ledger average C, a店 needs real volume before its own average moves
// the number much. That shrunk figure (rb) is what the points are cut from.
//
// Everything here is pure: records in, numbers out. No DOM, no storage, no
// module-level cache — the caller passes the baseline C it computed once.
// test/diningScore.test.js pins the constants, the enum and hand-computed
// fixtures, because a silent drift in a score is invisible on screen.

/** Bayesian prior weight: how many "average" reviews every place starts with. */
export const PRIOR_WEIGHT = 800;

/** ミシュランの区分 → 権威点. 'none' is 8, not 0: the ledger only lists places
 *  that were already selected by someone, so being in it is worth something. */
export const MICHELIN_POINTS = { '2star': 35, '1star': 29, bib: 21, sel: 16, none: 8 };

/** Tier（継続性）→ 点. Tier 0 is a place with no track record to speak of. */
export const TIER_POINTS = { 4: 25, 3: 19, 2: 12, 1: 6, 0: 0 };

/**
 * 追加評価タグ → 加点. An ENUM, not a substring match.
 *
 * v9 scored these with a chain of `indexOf` tests on free text ("Best 20" →
 * +4, "Best-in-Class" or "Award" → +2 …), so a tag renamed in the data would
 * have changed a score in silence — and "2026 Service Award" only scored +2
 * because it happened to contain the word "Award". Here an unknown tag scores
 * nothing and test/diningScore.test.js fails when restaurants.json grows a tag
 * this table does not know.
 *
 * 「屋号は要確認」 is a data-quality note, not a distinction: 0 by design.
 */
export const EX_TAG_POINTS = {
  '国際評価': 3,
  'Tatler Best 20': 4,
  'Tatler Best-in-Class': 2,
  '2026 Service Award': 2,
  '屋号は要確認': 0,
};

/** Ceilings. au is capped because ★2 alone already spends the whole budget. */
export const AUTHORITY_MAX = 35;
export const CONTINUITY_MAX = 25;
export const EVALUATION_MAX = 40;

/** The shrunk star that scores 0 points, and the span that reaches full marks. */
export const EV_FLOOR = 3.90;
export const EV_SPAN = 0.80;   // 3.90 → 0 点, 4.70 以上 → 満点

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * C — the ledger-wide baseline star, weighted by review count.
 *
 * Weighted, not a plain mean of the 50 stars: the prior is meant to say "what
 * a review from this pool looks like", and a place with 13,488 reviews carries
 * more of that pool than one with 35.
 *
 * @param {Array} records  dining records (rating + reviewCount)
 * @returns {number} the weighted mean, or 0 when there is nothing to average.
 */
export function baselineRating(records){
  let num = 0, den = 0;
  for(const r of (records || [])){
    const c = Number(r && r.reviewCount) || 0;
    const v = Number(r && r.rating) || 0;
    if(c > 0 && v > 0){ num += v * c; den += c; }
  }
  return den > 0 ? num / den : 0;
}

/** The ex-tags of a record, as the enum knows them. Unknown tags are dropped. */
export function knownExTags(rec){
  const tags = (rec && rec.extraFlags) || [];
  return tags.filter(t => Object.prototype.hasOwnProperty.call(EX_TAG_POINTS, t));
}

/** 権威点 au: ミシュラン区分 + 追加評価タグ, capped at 35. */
export function authorityPoints(rec){
  const base = MICHELIN_POINTS[(rec && rec.michelin) || 'none'] ?? MICHELIN_POINTS.none;
  const extra = knownExTags(rec).reduce((s, t) => s + EX_TAG_POINTS[t], 0);
  return Math.min(AUTHORITY_MAX, base + extra);
}

/** 継続性点 ct: the Tier column, straight. */
export function continuityPoints(rec){
  const t = Number(rec && rec.tier);
  return TIER_POINTS[t] ?? 0;
}

/**
 * rb — the shrunk star. (c×r + M×C) / (c + M).
 *
 * A place with no reviews at all lands exactly on C: the ledger's opinion of an
 * unknown is "average", never "bad".
 */
export function shrunkRating(rec, baseline){
  const c = Number(rec && rec.reviewCount) || 0;
  const r = Number(rec && rec.rating) || 0;
  const C = Number(baseline) || 0;
  if(c <= 0 || r <= 0) return C;
  return (c * r + PRIOR_WEIGHT * C) / (c + PRIOR_WEIGHT);
}

/** 評価点 ev: 40 × clamp((rb − 3.90) / 0.80). Not rounded — the total is. */
export function evaluationPoints(rb){
  return EVALUATION_MAX * clamp01(((Number(rb) || 0) - EV_FLOOR) / EV_SPAN);
}

/**
 * The whole score of one record.
 *
 * `total` is rounded ONCE, from the unrounded sum — rounding the three parts
 * first and adding them can land a point away. The parts are returned
 * unrounded too, so a caller that wants to print an internally consistent
 * breakdown can use evShown (see scoreBreakdownText).
 *
 * @returns {{au:number, ct:number, rb:number, ev:number, total:number}}
 */
export function ledgerScore(rec, baseline){
  const au = authorityPoints(rec);
  const ct = continuityPoints(rec);
  const rb = shrunkRating(rec, baseline);
  const ev = evaluationPoints(rb);
  return { au, ct, rb, ev, total: Math.round(au + ct + ev) };
}

/**
 * 「35 + 25 + 20」 — the breakdown, made to add up to the printed total.
 *
 * v9 printed round(ev) beside round(au+ct+ev) and the two could disagree by a
 * point (欠陥5). au and ct are whole numbers by construction, so the printed ev
 * is derived from the total instead of rounded on its own: the line always
 * sums to the big number next to it.
 */
export function scoreBreakdownText(s){
  const evShown = s.total - s.au - s.ct;
  return `${s.au} + ${s.ct} + ${evShown}`;
}

/** The three bars, as fractions of their own ceilings (for the meters). */
export function scoreBars(s){
  return [
    { key: 'au', label: '権威', value: s.au, max: AUTHORITY_MAX },
    { key: 'ct', label: '継続性', value: s.ct, max: CONTINUITY_MAX },
    { key: 'ev', label: '評価', value: s.ev, max: EVALUATION_MAX },
  ];
}

/**
 * How much a star is worth trusting, in words. The thresholds are v9's.
 * A number without this qualifier invites reading ★4.9 (35 reviews) as fact.
 */
export const REVIEW_DEPTH = [
  { min: 3000, label: '厚い' },
  { min: 1000, label: '標準' },
  { min: 300, label: 'やや薄い' },
  { min: 0, label: '薄い' },
];

export function reviewDepthLabel(reviewCount){
  const c = Number(reviewCount) || 0;
  return (REVIEW_DEPTH.find(b => c >= b.min) || REVIEW_DEPTH[REVIEW_DEPTH.length - 1]).label;
}

/**
 * 「Google ★4.8 / 1,178件（母数 標準）→ 縮約後 4.44」 — the whole reasoning of
 * the evaluation term on one line. Plain text; the callers escape it.
 *
 * Built here rather than in two renderers, so the card and the detail panel can
 * never quote different figures for the same restaurant.
 */
/**
 * Stamp the score onto the records, the way calcLuxury() stamps luxScore.
 *
 * The score needs the whole ledger (C), so it cannot be a property of one row
 * computed at parse time — and re-deriving it inside a comparator would run it
 * 50·log(50) times per sort. Called once when restaurants.json lands.
 *
 * @param {Array} records  the dining records, mutated in place.
 * @returns {number} the baseline C that was used.
 */
export function calcLedgerScores(records){
  const list = records || [];
  const C = baselineRating(list);
  for(const r of list){
    if(!r) continue;
    r.ledgerScore = ledgerScore(r, C);
    r.ledgerTotal = r.ledgerScore.total;
    r.ledgerBaseline = C;
  }
  return C;
}

export function ratingMetaText(rec, baseline){
  const r = Number(rec && rec.rating) || 0;
  const c = Number(rec && rec.reviewCount) || 0;
  if(!(r > 0)) return '';
  const rb = shrunkRating(rec, baseline);
  const count = c > 0 ? `${c.toLocaleString('en-US')}件（母数 ${reviewDepthLabel(c)}）` : 'レビュー数不明';
  return `Google ★${r} / ${count} → 縮約後 ${rb.toFixed(2)}`;
}
