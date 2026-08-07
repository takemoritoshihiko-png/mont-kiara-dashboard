// 学費くらべ engine — "what does one year at this school cost for a child of
// age N?"
//
// Pure: fee tables in, comparison rows out. No DOM, no state, no fetching, so
// test/fees.test.js can hold it against the real schools_detail.json.
//
// WHY THIS EXISTS
// The published fee tables are messy in a way no single school is to blame for.
// British schools bill by 「Year 3-4」, American ones by 「Grade 1-2」, the French
// lycée by 「Elementary」/「Middle School」, the Japanese school by 「小学部」, IB
// schools by 「PYP 2-3」, and early years arrive as Nursery / Reception / EYFS 1-2
// / Kindergarten 1 / Prep Senior. This module maps every one of those labels
// onto ONE ladder of school years, so a parent can pick an age and compare.
//
// THE ONE RULE: never invent a number. Every fee this module returns is a
// number the school actually published. When a school does not price the exact
// year you asked about, you get its nearest published year — together with the
// label it was published under, and `exact: false` so the UI can say so. No
// interpolation, no averaging, no extrapolation.

// ============================================================
// THE LADDER
// index 0 = age 3 (Nursery) … index 14 = age 17 (Year 13 / Grade 12).
// Anchored on the two conventions used in Malaysia, both of which end at 17:
//   British  Year N  ≈ age N+4   (Year 1 = 5, Year 13 = 17)
//   American Grade N ≈ age N+5   (Grade 1 = 6, Grade 12 = 17)
// The age select in index.html labels 5歳 as (Year 1) — the same anchor.
// ============================================================
export const MIN_AGE = 3;
export const MAX_AGE = 17;
export const MAX_INDEX = MAX_AGE - MIN_AGE;

/** @returns {number|null} the ladder index for an age, or null outside 3–17. */
export function gradeForAge(age) {
  const a = Number(age);
  if (!Number.isFinite(a)) return null;
  const i = Math.round(a) - MIN_AGE;
  return i >= 0 && i <= MAX_INDEX ? i : null;
}

/** Inverse of gradeForAge. */
export const ageForGrade = (i) => i + MIN_AGE;

/** British Year N → ladder index (Year 1 = age 5). */
export const britishYearIndex = (n) => n + 1;
/** American Grade N → ladder index (Grade 1 = age 6). */
export const americanGradeIndex = (n) => n + 2;

const clampIndex = (i) => Math.max(0, Math.min(MAX_INDEX, i));
const span = (a, b) => ({ min: clampIndex(Math.min(a, b)), max: clampIndex(Math.max(a, b)) });

// ============================================================
// LABEL → LADDER
// ============================================================
// A dash in a fee key can be an en dash or an em dash depending on who typed it.
const D = '[-–—]';
const RANGE = (word) => new RegExp(`\\b(?:${word})\\s*(\\d{1,2})(?:\\s*${D}\\s*(\\d{1,2}))?`, 'i');

const YEAR_RE  = RANGE('years?|yrs?');
const GRADE_RE = RANGE('grades?');
const PYP_RE   = RANGE('pyp');
const MYP_RE   = RANGE('myp');
const EYFS_RE  = RANGE('eyfs');
// 「Preschool 3-4」 (Dalat) is the one place where the numbers after the level
// word are AGES, not year numbers — "preschool 3" is not a third year of
// preschool. Matched before the plain-word table so it keeps its own range.
const PRESCHOOL_AGES_RE = new RegExp(`pre[\\s-]*school\\s*(\\d{1,2})\\s*${D}\\s*(\\d{1,2})`, 'i');
// K1 / K2 / K3 / Kindergarten 1. K1 is the year before the last pre-primary
// year, so it caps at index 2 (age 5) — nothing sits between it and Grade 1.
const KINDER_N_RE = /\b(?:kindergarten|k)\s*(\d)\b/i;

// Level words with no number of their own, most specific first: 「Prep Senior」
// must not be read as the generic 「Prep」, and 「Prep Reception」 is a Reception.
const WORD_LEVELS = [
  [/prep\s*senior/i,                              span(2, 2)],   // 5
  [/prep\s*junior/i,                              span(1, 1)],   // 4
  [/pre[\s-]*nursery|playgroup/i,                 span(0, 0)],   // 3
  [/nursery/i,                                    span(0, 0)],   // 3
  [/reception/i,                                  span(1, 1)],   // 4
  [/early\s*years|eyfs|pre[\s-]*school|pre[\s-]*k\b/i, span(0, 1)],  // 3–4
  [/kindergarten|幼稚部/i,                        span(0, 2)],   // 3–5
  [/junior\s*high|中学部/i,                       span(9, 11)],  // 12–14
  [/senior\s*high|high\s*school|lyc[eé]e|高等部/i, span(11, 14)], // 14–17
  [/middle\s*school|coll[eè]ge/i,                 span(8, 10)],  // 11–13
  [/elementary/i,                                 span(3, 7)],   // 6–10
  [/primary|小学部/i,                             span(3, 8)],   // 6–11
  [/secondary/i,                                  span(9, 14)],  // 12–17
  [/\bprep\b/i,                                   span(1, 2)],   // 4–5
];

/**
 * Turn one published fee-table key into the range of school years it covers.
 *
 * Explicit Year / Grade numbers win over everything else, wherever they appear
 * in the string — that is what makes 「MYP 1-3 (Year 7-9)」 and 「PYP 1 (Year 1)」
 * resolve to the years their own parentheses spell out instead of to an IB
 * programme stage.
 *
 * @param {string} key  e.g. 'Year 3-4', 'Grade 12', 'Kindergarten (幼稚部)'
 * @returns {{min:number,max:number}|null}  ladder indices, or null if the label
 *   means nothing to us (better to drop a row than to guess at it).
 */
export function parseFeeLevel(key) {
  const s = String(key == null ? '' : key);
  if (!s.trim()) return null;

  const m = (re) => s.match(re);
  const pair = (mm, toIndex) => {
    const a = toIndex(parseInt(mm[1], 10));
    const b = mm[2] == null ? a : toIndex(parseInt(mm[2], 10));
    return span(a, b);
  };

  let mm;
  if ((mm = m(YEAR_RE)))  return pair(mm, britishYearIndex);
  if ((mm = m(GRADE_RE))) return pair(mm, americanGradeIndex);
  // IB programme stages, when no Year/Grade is spelled out beside them.
  // Fairview names its primary years PYP 1..PYP 6 = Year 1..Year 6; MYP 1
  // is Year 7.
  if ((mm = m(PYP_RE)))   return pair(mm, britishYearIndex);
  if ((mm = m(MYP_RE)))   return pair(mm, (n) => britishYearIndex(n + 6));
  if ((mm = m(PRESCHOOL_AGES_RE))) return span(mm[1] - MIN_AGE, mm[2] - MIN_AGE);
  // EYFS 1 = Nursery, EYFS 2 = Reception.
  if ((mm = m(EYFS_RE)))  return pair(mm, (n) => n - 1);
  if ((mm = m(KINDER_N_RE))) {
    const i = Math.min(Math.max(parseInt(mm[1], 10), 1), 2);
    return span(i, i);
  }

  for (const [re, level] of WORD_LEVELS) if (re.test(s)) return level;
  return null;
}

// ============================================================
// AGE RANGE (schools_data.csv `age_range`, e.g. "3-18")
// ============================================================
/** @returns {{min:number,max:number}|null} */
export function parseAgeRange(text) {
  const m = String(text == null ? '' : text).match(/(\d{1,2})\s*[-–—]\s*(\d{1,2})/);
  if (!m) return null;
  const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

// ============================================================
// MATCHING
// ============================================================
/** The rows of a fee table we can place on the ladder, in published order. */
function candidates(fees) {
  const out = [];
  if (!fees || typeof fees !== 'object') return out;
  let order = 0;
  for (const [key, value] of Object.entries(fees)) {
    const fee = Number(value);
    // A missing or zero fee is "not published", never "free" (audit C1: the
    // app must not print RM 0 as if it were a price).
    if (!Number.isFinite(fee) || fee <= 0) continue;
    const level = parseFeeLevel(key);
    if (!level) continue;
    out.push({ key, fee, min: level.min, max: level.max, span: level.max - level.min, order: order++ });
  }
  return out;
}

/** How many ladder steps away `i` is from a candidate's range (0 = inside). */
const distanceTo = (c, i) => (i < c.min ? c.min - i : i > c.max ? i - c.max : 0);

/**
 * The annual fee a school publishes for a child of the given age.
 *
 * @param {{fees?:object, ageRange?:string, age_range?:string}} entry
 *   a schools_detail.json entry, optionally carrying the CSV's age_range.
 * @param {number} age  3–17
 * @returns {{fee:number, gradeLabel:string, exact:boolean}|null}
 *   `gradeLabel` is the school's OWN published label for the number returned.
 *   `exact:false` means the school does not price this age and the number is
 *   its nearest published year — the caller must say so.
 *   null = out of the school's age range, or no usable fee data at all.
 */
export function annualFeeForAge(entry, age) {
  const i = gradeForAge(age);
  if (i == null || !entry) return null;

  const range = parseAgeRange(entry.ageRange != null ? entry.ageRange : entry.age_range);
  if (range && (age < range.min || age > range.max)) return null;

  const cands = candidates(entry.fees);
  if (!cands.length) return null;

  const best = cands.slice().sort((a, b) => {
    const da = distanceTo(a, i), db = distanceTo(b, i);
    if (da !== db) return da - db;
    // Both cover the age: the more specific label wins. Dalat prints
    // 「Preschool 3-4」 inside its wider 「Kindergarten」 band, and the narrow one
    // is the price a 3-year-old actually pays.
    if (da === 0) return a.span - b.span || a.order - b.order;
    // Neither covers it and both are equally far: take the lower year. Fee
    // tables are printed in ascending order, so the earlier row is the lower
    // one — the year the child has just finished rather than one not reached.
    return a.order - b.order;
  })[0];

  return { fee: best.fee, gradeLabel: best.key, exact: distanceTo(best, i) === 0 };
}

// ============================================================
// THE COMPARISON TABLE
// ============================================================
/** KL sits near lat 3.1, Penang near 5.4 — geography decides, never spelling. */
export const areaTag = (lat) => (Number(lat) || 0) > 4 ? 'ペナン' : 'KL';

/**
 * Every school that publishes a usable fee for this age, cheapest first.
 *
 * @param {object[]} schools  school records (name, lat, ageRange, curriculum…)
 * @param {object} detailMap  schools_detail.json, keyed by the same name
 * @param {number} age
 * @returns {{rows:object[], noDataCount:number}}
 *   noDataCount = schools deliberately left out because they publish nothing
 *   usable for this age. Shown in the UI so the list never looks complete when
 *   it is not.
 */
export function feeComparison(schools, detailMap, age) {
  const rows = [];
  let noDataCount = 0;
  for (const s of (schools || [])) {
    if (!s || !s.name) continue;
    const detail = (detailMap || {})[s.name];
    const hit = annualFeeForAge({ fees: detail && detail.fees, ageRange: s.ageRange }, age);
    if (!hit) { noDataCount++; continue; }
    rows.push({
      name: s.name,
      nameJa: s.nameJa || '',
      area: areaTag(s.lat),
      curriculum: s.curriculum || '',
      fee: hit.fee,
      gradeLabel: hit.gradeLabel,
      exact: hit.exact,
    });
  }
  rows.sort((a, b) => a.fee - b.fee || a.name.localeCompare(b.name));
  return { rows, noDataCount };
}
