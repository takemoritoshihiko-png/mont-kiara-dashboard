// Pure filtering logic for the list.
//
// B3a: filtering is now *per layer*. The active layer (物件 / 学校 / 商業) picks
// which records are listed at all, and each layer brings its own criteria.
// A record never matches a layer it does not belong to.

import { haversineKm } from './geo.js';

export function parseR(v){if(!v)return null;const[a,b]=v.split('-').map(Number);return{min:a,max:b}}
export const TIER_ORDER = {S:5, A:4, B:3, C:2, D:1};

// ============================================================
// LAYERS
// ============================================================
export const LAYERS = ['condo', 'school', 'commercial', 'dining'];

/** Japanese label used in headings and the empty-result message. */
export const LAYER_LABELS = { condo: '物件', school: '学校', commercial: '商業施設', dining: '飲食店' };

/** Which layer a record belongs to. `status` is the discriminator in the data. */
export function recordLayer(c){
  return c.status === 'school' ? 'school'
    : c.status === 'commercial' ? 'commercial'
    : c.status === 'dining' ? 'dining'
    : 'condo';
}

// Distinct curriculum substrings across schools_data.csv. Matching is by
// substring because a school's curriculum field combines several
// ("British / IB", "IB (PYP/IGCSE/DP)").
export const CURRICULA = ['American', 'IB', 'British', 'Australian', 'French', 'Canadian', 'Japanese'];

// ============================================================
// AREA
// ============================================================
/**
 * Area quick-filter test. Returns false when the record is outside the area.
 * Area keys are the same ones the map's jump buttons use, plus the historical
 * 'desa-parkcity' spelling of the dropdown.
 *
 * The six Penang areas must cover EVERY Penang record: a record no area claims
 * is invisible under every area filter and nobody notices. `test/filter.test.js`
 * walks condos_data.csv and fails when a Penang record matches none — or more
 * than one. When it fires, add the missing neighbourhood keyword below; do not
 * relax the test.
 */
export function matchesArea(c, areaFilter){
  if(!areaFilter) return true;
  const a=(c.addr||'').toLowerCase();
  const n=(c.name||'').toLowerCase();
  // KL sits near lat 3.1, Penang near 5.4. Geography (not spelling) decides the
  // island, because KL addresses can contain the word "Penang" (Jalan Penang).
  const isPenang=(c.lat||0)>4;
  // -- Penang --
  // The name is consulted too (as it already is for KLGCC/KLCC): a few Penang
  // towers carry the neighbourhood in the name but not in the street address
  // (e.g. "Gurney Palace", Jalan Concordia).
  const isGurney=isPenang&&(a.includes('gurney')||a.includes('pulau tikus')||a.includes('kelawei')||n.includes('gurney'));
  const isTanjung=isPenang&&(a.includes('tanjung tokong')||a.includes('tanjung bungah')||a.includes('tanjung bunga')||a.includes('tanjung pinang'));
  const isFerringhi=isPenang&&(a.includes('ferringhi')||n.includes('ferringhi'));
  const isBayan=isPenang&&(a.includes('bayan lepas')||a.includes('bayan baru')||a.includes('bayan indah')||a.includes('bayan jambul')||a.includes('bukit jambul')||a.includes('sungai ara'));
  // Gelugor / Jelutong: the south-east corridor along the Tun Dr Lim Chong Eu
  // expressway, between the city core and the airport road. Karpal Singh Drive
  // is Jelutong reclaimed land; Paya Terubong is the inland valley that hangs
  // off the same corridor (with Air Itam / Farlim next door to it). Bayan wins
  // where the two could ever overlap.
  const isGelugor=isPenang&&!isBayan&&(a.includes('gelugor')||a.includes('jelutong')||a.includes('karpal singh')||a.includes('paya terubong')||a.includes('air itam')||a.includes('ayer itam')||a.includes('sungai nibong')||a.includes('batu uban')||a.includes('bukit gambier')||a.includes('bukit gambir'));
  // George Town city core. "George Town" is the whole city's administrative
  // name, so Gurney / Pulau Tikus addresses carry it too — the core is what is
  // LEFT once the named neighbourhoods are taken out, which is why every other
  // Penang area is subtracted here rather than listed as a street keyword.
  const isGeorgeTown=isPenang&&!isGurney&&!isTanjung&&!isFerringhi&&!isBayan&&!isGelugor&&a.includes('george town');
  // -- KL --
  const isKLGCC=!isPenang&&(a.includes('bukit kiara')||n.includes('klgcc'));
  const isDPC=!isPenang&&a.includes('desa parkcity');
  const isBangsar=!isPenang&&a.includes('bangsar');
  const isKLCC=!isPenang&&(a.includes('klcc')||a.includes('bukit bintang')||a.includes('jalan conlay')||a.includes('jalan imbi')||a.includes('jalan pinang')||a.includes('kl sentral')||n.includes('klcc'));
  // KLCC wins where the two could overlap: Kia Peng / Stonor towers that carry
  // "KLCC" in the address or name are KLCC, not Ampang — a record must belong
  // to exactly one KL area, same as the Penang rule above.
  const isAmpang=!isPenang&&!isKLCC&&(a.includes('u-thant')||a.includes('ampang hilir')||a.includes('embassy row')||a.includes('kia peng')||a.includes('persiaran stonor')||a.includes('lorong kuda'));
  const isDH=!isPenang&&(a.includes('damansara heights')||a.includes('jalan batai')||a.includes('changkat semantan'));
  // Mont Kiara is the KL catch-all: anything on the KL side that is not one of
  // the other named areas. Penang records are never Mont Kiara.
  const isMK=!isPenang&&!isDPC&&!isBangsar&&!isKLGCC&&!isKLCC&&!isAmpang&&!isDH;
  if(areaFilter==='mont-kiara'&&!isMK) return false;
  if((areaFilter==='desa-parkcity'||areaFilter==='parkcity')&&!isDPC) return false;
  if(areaFilter==='bangsar'&&!isBangsar) return false;
  if(areaFilter==='klgcc'&&!isKLGCC) return false;
  if(areaFilter==='klcc'&&!isKLCC) return false;
  if(areaFilter==='ampang'&&!isAmpang) return false;
  if(areaFilter==='damansara'&&!isDH) return false;
  if(areaFilter==='gurney'&&!isGurney) return false;
  if(areaFilter==='tanjung'&&!isTanjung) return false;
  if(areaFilter==='ferringhi'&&!isFerringhi) return false;
  if(areaFilter==='bayan'&&!isBayan) return false;
  if(areaFilter==='gelugor'&&!isGelugor) return false;
  if(areaFilter==='george-town'&&!isGeorgeTown) return false;
  return true;
}

// ============================================================
// SCHOOL helpers
// ============================================================
// "3-18" -> {min:3, max:18}。パーサは fees.js と共有(1本)。あちらは en/em ダッシュも
// 読むため、CSVに – が紛れても「学費くらべには出るのに年齢フィルタでは消える」が起きない。
import { parseAgeRange } from './fees.js';
export { parseAgeRange };

/** The school accepts a child of `age` (its age_range covers that age). */
export function matchesSchoolAge(c, age){
  if(age===''||age==null) return true;
  const r=parseAgeRange(c.ageRange);
  if(!r) return false;
  return age>=r.min && age<=r.max;
}

/** Curriculum is matched as a substring ("IB" matches "British / IB"). */
export function matchesCurriculum(c, cur){
  if(!cur) return true;
  return (c.curriculum||'').toLowerCase().includes(cur.toLowerCase());
}

// ============================================================
// DINING helpers
// ============================================================
/**
 * The ruled category groups, in the order the plan's table lists them.
 * 8 groups ruled on 2026-08-07; カフェ・デザート added the same evening
 * (ruling E-1) when the verified expansion brought its first cafés in.
 */
export const CAT_GROUPS = [
  'マレーシア料理', '洋食・グリル', '中華', 'インド・スリランカ',
  '鶏飯・ご飯もの', '麺・肉骨茶', '日本・その他アジア', '中東', '屋台街',
  'カフェ・デザート',
  'バー',   // 10分類目(2026-08-08裁定: Asia's 50 Best Bars 6店の受け皿)
];

/** Michelin filter values. 'star' covers both star levels; '' is everything. */
export const MICHELIN_FILTERS = [
  { value: 'star', label: '星付き（★1・★2）' },
  { value: 'bib',  label: 'ビブグルマン' },
  { value: 'sel',  label: '掲載店（セレクテッド）' },
  { value: 'none', label: '掲載なし' },
];

/**
 * Which sitting the budget is judged on. 夜 is the default everywhere; 昼 is
 * the 「昼の予算で見る」 toggle. There is deliberately no third value and no
 * "both": the price band, the budget sort and the 予算中央値 tile all read this
 * ONE basis, so the list can never be ordered by a number the filter did not
 * use (that split is why a 昼/夜 pair of separate filters was rejected).
 */
export const BUDGET_BASIS_NIGHT = 'night';
export const BUDGET_BASIS_DAY = 'day';

/** The basis a boolean 「昼の予算」 toggle means. One place, so all readers agree. */
export function budgetBasisOf(dayFlag){
  return dayFlag ? BUDGET_BASIS_DAY : BUDGET_BASIS_NIGHT;
}

/**
 * The one figure a price band is judged on: the TOP of a service's range.
 *
 * Dinner leads by default because it is the fuller offering and the number
 * people budget against; a place that does not serve dinner carries
 * `priceDinner: [0, 0]`, and then the top of the LUNCH range stands in for it.
 * With `basis === 'day'` the two swap round — lunch leads, dinner stands in —
 * which is what 「昼の予算で見る」 asks for. `0` means "not offered / unknown"
 * throughout restaurants.json, never "free", so a zero never wins the lead.
 *
 * @param {object} c
 * @param {'night'|'day'} [basis]
 * @returns {number} ringgit per head, or 0 when neither service has a figure.
 */
export function diningPriceCeiling(c, basis = BUDGET_BASIS_NIGHT){
  const lunch = (c && c.priceLunch && c.priceLunch[1]) || 0;
  const dinner = (c && c.priceDinner && c.priceDinner[1]) || 0;
  const [lead, fallback] = basis === BUDGET_BASIS_DAY ? [lunch, dinner] : [dinner, lunch];
  return lead > 0 ? lead : fallback;
}

/**
 * The radius 「近く」 means, in km.
 *
 * 3km is the walk-or-short-drive radius that matches what the jump buttons
 * SHOW: at their zoom 14–15 a 390px phone screen spans roughly 2–5km, so the
 * list ends up holding the restaurants the map is actually displaying. Measured
 * against restaurants.json it returns 12–31 places for the six KL areas and 4
 * for Desa ParkCity — enough to choose from, few enough to read. 2km empties
 * ParkCity (1件); 5km makes every KL area bleed into its neighbour (Damansara
 * Heights would return 39 of 67).
 */
export const NEAR_KM = 3;

/**
 * 「Mont Kiara の近く」 — the distance filter behind the area jump buttons.
 *
 * The ledger's own `area` field is a curated LABEL (24 distinct values across
 * 67 restaurants); the jump bar's keys are map CENTRES. The two do not line up
 * and never will, so 「この辺の店」 is answered geometrically instead of by
 * string matching.
 *
 * Unlike an unknown price, a missing coordinate is NOT waved through: "within
 * 3km of here" is a question a record with no position cannot answer, and
 * pretending otherwise would put it on a list it is not on the map for. Today
 * every restaurant has coordinates (src/data/load.js drops the ones that do
 * not), so this branch is a guard, not a filter.
 *
 * @param {object} c
 * @param {{lat:number,lng:number,km?:number}|null} near
 */
export function matchesDiningNear(c, near){
  if(!near || !Number.isFinite(near.lat) || !Number.isFinite(near.lng)) return true;
  if(!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return false;
  const km = near.km > 0 ? near.km : NEAR_KM;
  return haversineKm(near.lat, near.lng, c.lat, c.lng) <= km;
}

/** The bands offered by the 価格帯 dropdown, as [min exclusive, max inclusive]. */
export const PRICE_BANDS = {
  '0-50':    [0, 50],
  '0-150': [0, 150],   // 累積帯(今夜プリセット): 〜RM150
  '50-150':  [50, 150],
  '150-400': [150, 400],
  '400-':    [400, Infinity],
};

/**
 * Price-band test. A restaurant whose two services are BOTH unpriced is never
 * dropped by this filter: an unknown price is not a cheap one, and silently
 * hiding it would be exactly the "無言で件数を減らす" the repo forbids.
 */
export function matchesPriceBand(c, band, basis = BUDGET_BASIS_NIGHT){
  if(!band) return true;
  const range = PRICE_BANDS[band];
  if(!range) return true;
  const v = diningPriceCeiling(c, basis);
  if(v <= 0) return true;      // unknown price — shown under every band
  return v > range[0] && v <= range[1];
}

/** 施設タイプ — where the restaurant physically is. The ledger's own column. */
export const VENUE_TYPES = [
  { value: 'mall', label: 'モール内' },
  { value: 'hotel', label: 'ホテル内' },
  { value: 'tower', label: 'オフィス・タワー内' },
  { value: 'street', label: '路面店' },
  { value: 'stall', label: '屋台・フードコート' },
];

/** 'star' means one star OR two; every other value is an exact michelin match. */
export function matchesMichelin(c, m){
  if(!m) return true;
  if(m === 'star') return c.michelin === '1star' || c.michelin === '2star';
  return c.michelin === m;
}

// ============================================================
// SEARCH
// ============================================================
function matchesQuery(c, q, layer){
  const hay=[c.name, c.addr, c.nameJa||''];
  if(layer==='condo') hay.push(c.luxTier||'');
  if(layer==='school') hay.push(c.curriculum||'');
  if(layer==='commercial') hay.push(c.anchorTenants||'');
  if(layer==='dining') hay.push(c.cat||'', c.catGroup||'', c.area||'', c.venue||'');
  return hay.some(v=>String(v).toLowerCase().includes(q));
}

// ============================================================
// PER-LAYER CRITERIA
// ============================================================
function matchesCondo(c, f){
  if(f.showAwardOnly && !c.fiabciAward) return false;
  // Tier filter: "A+" means A and above (A, S)
  if(f.tierVal){
    if(f.tierVal.endsWith('+')){
      const minTier=f.tierVal[0];
      if(TIER_ORDER[c.luxTier] < TIER_ORDER[minTier]) return false;
    } else if(c.luxTier !== f.tierVal) return false;
  }
  // A null mid means the price is not published (upcoming towers): an unknown
  // price matches no price band — it must never pass as "mid-market".
  if(f.sp&&(c.salePsfMid==null||c.salePsfMid<f.sp.min||c.salePsfMid>f.sp.max))return false;
  if(f.rn&&(c.rentMid==null||c.rentMid<f.rn.min||c.rentMid>f.rn.max))return false;
  if(f.yr&&(c.year<f.yr.min||c.year>f.yr.max))return false;
  if(f.sz&&(c.sizeMid<f.sz.min||c.sizeMid>f.sz.max))return false;
  // Age filter (skip for upcoming — an unbuilt project has no age)
  if(f.age&&c.status==='completed'){const a=f.currentYear-c.year; if(a<f.age.min||a>f.age.max) return false;}
  // Lifecycle only: completed / upcoming. The old 'commercial' / 'residential'
  // options moved to the layer control.
  if(f.statusFilter&&c.status!==f.statusFilter) return false;
  return true;
}

function matchesSchool(c, f){
  if(!matchesSchoolAge(c, f.schoolAge)) return false;
  if(!matchesCurriculum(c, f.curriculum)) return false;
  // Annual fee is matched on the *entry* fee (annual_fee_min), the same value
  // the summary bar takes its median from.
  if(f.fee&&(c.sizeMin<f.fee.min||c.sizeMin>f.fee.max)) return false;
  return true;
}

function matchesCommercial(c, f){
  if(f.nla&&(c.sizeMin<f.nla.min||c.sizeMin>f.nla.max)) return false;
  if(f.openYear&&(c.year<f.openYear.min||c.year>f.openYear.max)) return false;
  if(f.anchorQ&&!(c.anchorTenants||'').toLowerCase().includes(f.anchorQ)) return false;
  return true;
}

/**
 * The dining layer's own criteria. Note what is NOT here: the 8-way category,
 * the michelin tier and the price band all come from the ledger's own columns,
 * so none of them needs a keyword heuristic.
 */
/**
 * 所要時間フィルタ — Mont Kiaraから車で「渋滞込み目安(driveMinJam)」が
 * limit分以内か。値が無い(null)店は絞り込みに応えられないので、上限を
 * 指定されたときは正直に外す(不明を「近い」と偽らない)。
 */
export function matchesDriveTime(c, limit){
  if(!limit) return true;
  const m = c && c.driveMinJam;
  return m != null && m <= Number(limit);
}

export function matchesDining(c, f){
  // 台帳除名(2026-08-09 ★4.9裁定): 行はID安定のため残るが、両モードとも一切描かない
  if(c.delisted) return false;
  // オーナー除外(2026-08-08): 「ここは違う」と消した店は外食モードの一覧/地図に出さない
  if(f.hiddenIds && f.hiddenIds.has(c.id)) return false;
  if(f.catGroup && c.catGroup !== f.catGroup) return false;
  if(!matchesMichelin(c, f.michelin)) return false;
  // Google評価の下限(2026-08-09 竹森さん依頼: ★4.3以上/★4.5以上)。評価未集計
  // (rating=null)の店は「下限を満たすと証明できない」ので、絞り込み中は出さない
  // — 価格帯の「不明は全帯に出す」とは逆だが、この絞り込みは“証明済みの高評価
  // だけ見たい”という問いなので未知を混ぜたら答えにならない。
  if(f.minRating && !(c.rating != null && c.rating >= f.minRating)) return false;
  if(!matchesPriceBand(c, f.priceBand, f.priceBasis)) return false;
  // The ledger's own `area` field (KLCC / Bangsar / Chinatown …). Exact match:
  // it is a controlled value, not free text.
  if(f.diningArea && c.area !== f.diningArea) return false;
  // 「近く: Mont Kiara」 — a SECOND, independent axis from f.diningArea above.
  // The two coexist on purpose: the label answers "which district is this
  // place in", the radius answers "what can we get to from here", and the
  // ledger's labels do not tile the map finely enough to answer the second.
  if(!matchesDiningNear(c, f.near)) return false;
  if(f.venueType && c.venueType !== f.venueType) return false;
  if(!matchesDriveTime(c, f.driveTime)) return false;
  // kidOk is 0/1 in restaurants.json. The filter is one-way — 「子連れ◎のみ」
  // narrows, it never asks for the places that are NOT child-friendly.
  if(f.kidOnly && c.kidOk !== 1) return false;
  // D4: the two personal conditions. They are INDEPENDENT toggles that combine
  // (v9 could only hold one condition at a time — 欠陥4 — so 「行きたいのにまだ
  // 行っていない店」, the single most useful question, could not be asked).
  // `f.personal` is the record map from src/data/personal.js; this function
  // stays pure by being handed it rather than reading storage itself. Absent
  // (住まいモード) it is undefined and both toggles are simply off.
  if(f.wantOnly || f.undoneOnly || f.visitedOnly){
    const p = (f.personal && f.personal[c.id]) || null;
    if(f.wantOnly && !(p && p.w === 1)) return false;
    if(f.undoneOnly && p && p.v === 1) return false;
    // ✓行った店(2026-08-08: 行った店ビューを廃止し、このトグルが代替)
    if(f.visitedOnly && !(p && p.v === 1)) return false;
  }
  return true;
}

/**
 * @param {object} c  a condo / commercial / school / dining record
 * @param {object} f  criteria:
 *   common      — layer, q, areaFilter
 *   condo       — tierVal, sp, rn, yr, sz, age, statusFilter, showAwardOnly, currentYear
 *   school      — schoolAge, curriculum, fee
 *   commercial  — nla, openYear, anchorQ
 *   dining      — catGroup, michelin, priceBand, priceBasis, diningArea, near,
 *                 venueType, kidOnly
 *                 and (外食モードのみ) wantOnly, undoneOnly + the `personal` map
 */
export function matchesFilters(c, f){
  const layer=f.layer||'condo';
  if(recordLayer(c)!==layer) return false;
  if(f.q&&!matchesQuery(c,f.q,layer)) return false;
  // The dining layer deliberately does NOT go through matchesArea(). That
  // function's KL half ends in a catch-all — anything on the KL side that is
  // not one of the seven named neighbourhoods is called "Mont Kiara" — which is
  // harmless for condos (they are all IN those areas) and badly wrong for
  // restaurants: Chinatown, Pudu, Imbi and Chow Kit would every one of them be
  // filed under Mont Kiara. The ledger already carries a curated `area` per
  // restaurant, so the dining layer filters on that instead (f.diningArea).
  if(layer==='dining') return matchesDining(c,f);
  if(f.areaFilter&&!matchesArea(c,f.areaFilter)) return false;
  if(layer==='school') return matchesSchool(c,f);
  if(layer==='commercial') return matchesCommercial(c,f);
  return matchesCondo(c,f);
}
