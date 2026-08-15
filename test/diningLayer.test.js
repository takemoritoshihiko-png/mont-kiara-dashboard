// Contract for the 飲食 layer (D3): its filters, its price rule, its card and
// its sort order. Everything asserted here is a pure function, so the whole
// file runs without a DOM — same shape as filter/sort/card.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  matchesFilters, matchesDining, matchesMichelin, matchesPriceBand,
  AREA_BUCKETS, areaBucketOf, isBucketedArea,
  diningPriceCeiling, recordLayer, LAYERS, LAYER_LABELS, CAT_GROUPS, MICHELIN_FILTERS,
} from '../src/domain/filter.js';
import { SORT_OPTIONS, defaultSortFor, sortAvailable, sortRecords } from '../src/domain/sort.js';
import { cardBodyHtml, cardHeroText, cardAriaLabel, priceRangeText, ratingText } from '../src/ui/list.js';
import { googleMapsUrl, detailHtml } from '../src/ui/info.js';
import { parseRestaurants, RESTAURANTS_URL } from '../src/data/load.js';

const raw = readFileSync(new URL('../restaurants.json', import.meta.url), 'utf8');

/** A dining record in the shape parseRestaurants() produces. */
const eat = (over = {}) => ({
  name: 'akar', nameJa: 'アカル', addr: '52 Jalan Kampung Attap',
  status: 'dining', id: 'R0004', placeId: 'ChIJabc123',
  cat: 'モダン・マレーシアン', catGroup: 'マレーシア料理', michelin: '1star',
  rating: 4.8, reviewCount: 1178, kidOk: 0, venue: '路面店', venueType: 'street',
  area: 'Chinatown', priceLunch: [334, 334], priceDinner: [682, 682],
  priceConfidence: '公表', priceNote: 'コース制。', editorNote: '土着食材。',
  vox: { pros: '物語性', cons: '塩気が強い' },
  lat: 3.14, lng: 101.69, luxTier: 'D', luxScore: 0, year: 0, units: 0,
  sizeMin: 0, sizeMax: 0, rentMin: 0, rentMax: 0, salePsfMin: 0, salePsfMax: 0,
  ...over,
});

const fd = (over = {}) => ({
  layer: 'dining', q: '', catGroup: '', cat: '', michelin: '', priceBand: '',
  diningArea: '', kidOnly: false, ...over,
});

// ============================================================
// LAYER
// ============================================================
describe('the 飲食 layer', () => {
  it('is a layer of its own, routed by status', () => {
    expect(LAYERS).toContain('dining');
    expect(recordLayer(eat())).toBe('dining');
    expect(LAYER_LABELS.dining).toBe('飲食店');
  });

  it('never matches a record from another layer, and vice versa', () => {
    expect(matchesFilters({ ...eat(), status: 'commercial' }, fd())).toBe(false);
    expect(matchesFilters(eat(), { layer: 'condo' })).toBe(false);
  });

  it('does NOT run restaurants through the condo area filter', () => {
    // matchesArea() calls everything on the KL side that is not one of the
    // seven named neighbourhoods "Mont Kiara". A Chinatown restaurant would be
    // filed there, which is why the dining layer ignores fArea entirely.
    const chinatown = eat({ addr: 'Jalan Petaling, Chinatown', lat: 3.14, lng: 101.697 });
    expect(matchesFilters(chinatown, fd({ areaFilter: 'mont-kiara' }))).toBe(true);
    expect(matchesFilters(chinatown, fd({ areaFilter: 'bangsar' }))).toBe(true);
  });
});

// ============================================================
// PRICE
// ============================================================
describe('diningPriceCeiling — the one figure a budget is judged on', () => {
  it('is the top of the dinner range', () => {
    expect(diningPriceCeiling(eat({ priceLunch: [80, 150], priceDinner: [300, 450] }))).toBe(450);
  });

  it('falls back to lunch when dinner is not served ([0, 0])', () => {
    expect(diningPriceCeiling(eat({ priceLunch: [20, 35], priceDinner: [0, 0] }))).toBe(35);
  });

  it('is 0 when neither service has a figure — never a made-up number', () => {
    expect(diningPriceCeiling(eat({ priceLunch: [0, 0], priceDinner: [0, 0] }))).toBe(0);
  });

  it('survives a record with no price fields at all', () => {
    expect(diningPriceCeiling({})).toBe(0);
    expect(diningPriceCeiling(null)).toBe(0);
  });
});

describe('matchesPriceBand', () => {
  const band = (v, b) => matchesPriceBand(eat({ priceDinner: [0, v], priceLunch: [0, 0] }), b);

  it('an empty band keeps everything', () => {
    expect(band(9999, '')).toBe(true);
  });

  it('splits at 50 / 150 / 400, upper bound inclusive', () => {
    expect(band(50, '0-50')).toBe(true);
    expect(band(51, '0-50')).toBe(false);
    expect(band(51, '50-150')).toBe(true);
    expect(band(150, '50-150')).toBe(true);
    expect(band(151, '50-150')).toBe(false);
    expect(band(400, '150-400')).toBe(true);
    expect(band(401, '150-400')).toBe(false);
    expect(band(401, '400-')).toBe(true);
    expect(band(5000, '400-')).toBe(true);
  });

  it('judges a lunch-only place on its lunch price', () => {
    const lunchOnly = eat({ priceLunch: [20, 40], priceDinner: [0, 0] });
    expect(matchesPriceBand(lunchOnly, '0-50')).toBe(true);
    expect(matchesPriceBand(lunchOnly, '400-')).toBe(false);
  });

  it('never silently drops a place whose price is unknown', () => {
    const unknown = eat({ priceLunch: [0, 0], priceDinner: [0, 0] });
    for(const b of ['0-50', '50-150', '150-400', '400-']){
      expect(matchesPriceBand(unknown, b), `band ${b} hid an unpriced record`).toBe(true);
    }
  });

  it('ignores a band value it does not know rather than emptying the list', () => {
    expect(band(100, 'nonsense')).toBe(true);
  });
});

// ============================================================
// MICHELIN / CATEGORY / AREA / KIDS
// ============================================================
describe('matchesMichelin', () => {
  it('"star" means one star or two', () => {
    expect(matchesMichelin(eat({ michelin: '2star' }), 'star')).toBe(true);
    expect(matchesMichelin(eat({ michelin: '1star' }), 'star')).toBe(true);
    expect(matchesMichelin(eat({ michelin: 'bib' }), 'star')).toBe(false);
    expect(matchesMichelin(eat({ michelin: 'none' }), 'star')).toBe(false);
  });

  it('every other value is an exact match', () => {
    expect(matchesMichelin(eat({ michelin: 'bib' }), 'bib')).toBe(true);
    expect(matchesMichelin(eat({ michelin: 'sel' }), 'bib')).toBe(false);
    expect(matchesMichelin(eat({ michelin: 'none' }), 'none')).toBe(true);
  });

  it('an empty filter keeps everything', () => {
    expect(matchesMichelin(eat({ michelin: 'none' }), '')).toBe(true);
  });

  it('offers only values the filter understands', () => {
    MICHELIN_FILTERS.forEach(o => {
      expect(typeof o.label).toBe('string');
      expect(['star', 'bib', 'sel', 'none']).toContain(o.value);
    });
  });
});

describe('matchesDining', () => {
  it('matches the category group exactly', () => {
    expect(matchesDining(eat(), { catGroup: 'マレーシア料理' })).toBe(true);
    expect(matchesDining(eat(), { catGroup: '中華' })).toBe(false);
    expect(matchesDining(eat(), { catGroup: '' })).toBe(true);
  });

  // 2026-08-15 竹森さん依頼: 大分類を選んだあと、その中の小分類でも絞れる。
  // 台帳は cat(小分類69種) と catGroup(大分類11種) の2階建てで、店ごとに
  // 必ず1つずつ持つ(dining.test.js が両方の存在と一意性を守る)。
  it('matches the 小分類 exactly, and combines with the 大分類', () => {
    expect(matchesDining(eat(), { cat: 'モダン・マレーシアン' })).toBe(true);
    expect(matchesDining(eat(), { cat: 'ニョニャ' })).toBe(false);
    // 未選択(すべて)は何も狭めない
    expect(matchesDining(eat(), { cat: '' })).toBe(true);
    const steak = eat({ catGroup: '洋食・グリル', cat: 'ステーキ' });
    expect(matchesFilters(steak, fd({ catGroup: '洋食・グリル', cat: 'ステーキ' }))).toBe(true);
    expect(matchesFilters(steak, fd({ catGroup: '洋食・グリル', cat: 'フレンチ' }))).toBe(false);
  });

  it('offers the eleven ruled groups and nothing else (2026-08-09: 中東を独立)', () => {
    expect(CAT_GROUPS).toHaveLength(11);
    expect(new Set(CAT_GROUPS).size).toBe(11);
    expect(CAT_GROUPS).toContain('屋台街');
  });

  it('matches the ledger area exactly', () => {
    expect(matchesDining(eat(), { diningArea: 'Chinatown' })).toBe(true);
    expect(matchesDining(eat(), { diningArea: 'KLCC' })).toBe(false);
  });

  it('「子連れ◎のみ」 keeps kidOk === 1 and nothing else', () => {
    expect(matchesDining(eat({ kidOk: 1 }), { kidOnly: true })).toBe(true);
    expect(matchesDining(eat({ kidOk: 0 }), { kidOnly: true })).toBe(false);
    // Off, it narrows nothing — it is not a "kid-unfriendly" filter.
    expect(matchesDining(eat({ kidOk: 0 }), { kidOnly: false })).toBe(true);
  });

  it('combines every axis', () => {
    const c = eat({ catGroup: '中華', michelin: 'bib', kidOk: 1, area: 'Pudu', priceDinner: [80, 120] });
    expect(matchesFilters(c, fd({ catGroup: '中華', michelin: 'bib', priceBand: '50-150', diningArea: 'Pudu', kidOnly: true }))).toBe(true);
    expect(matchesFilters(c, fd({ catGroup: '中華', priceBand: '400-' }))).toBe(false);
  });

  it('searches the name, the Japanese name, the address, both categories, the area and the venue', () => {
    for(const q of ['akar', 'アカル', 'attap', 'モダン', 'マレーシア料理', 'chinatown', '路面店']){
      expect(matchesFilters(eat(), fd({ q })), `"${q}" found nothing`).toBe(true);
    }
    expect(matchesFilters(eat(), fd({ q: 'not in there' }))).toBe(false);
  });
});

// ============================================================
// CARD
// ============================================================
describe('the dining card', () => {
  it('leads with what one person pays, lunch and dinner', () => {
    expect(cardHeroText(eat())).toBe('昼 RM 334 ・ 夜 RM 682');
    expect(cardHeroText(eat({ priceLunch: [400, 510], priceDinner: [510, 790] })))
      .toBe('昼 RM 400–510 ・ 夜 RM 510–790');
  });

  it('says one figure once when lunch and dinner cost the same', () => {
    expect(cardHeroText(eat({ priceLunch: [80, 150], priceDinner: [80, 150] })))
      .toBe('昼夜 RM 80–150');
  });

  it('names a service that is not offered instead of pricing it at zero', () => {
    expect(cardHeroText(eat({ priceLunch: [0, 0] }))).toBe('夜のみ RM 682');
    expect(cardHeroText(eat({ priceDinner: [0, 0] }))).toBe('昼のみ RM 334');
    expect(cardHeroText(eat({ priceLunch: [0, 0], priceDinner: [0, 0] }))).toBe('予算 要確認');
  });

  it('never prints RM 0 anywhere on the card', () => {
    const h = cardBodyHtml(eat({ priceLunch: [0, 0], priceDinner: [0, 0], rating: 0, reviewCount: 0 }));
    expect(h).not.toContain('RM 0');
    expect(h).not.toContain('★0');
  });

  it('collapses a range whose ends are equal into one figure', () => {
    expect(priceRangeText([682, 682])).toBe('RM 682');
    expect(priceRangeText([510, 790])).toBe('RM 510–790');
    expect(priceRangeText([0, 0])).toBe('');
    expect(priceRangeText(undefined)).toBe('');
  });

  it('shows the michelin badge, the category chip and ★ with its sample size', () => {
    const h = cardBodyHtml(eat());
    expect(h).toContain('一つ星');
    expect(h).toContain('マレーシア料理');
    expect(h).toContain('★4.8 (1,178件)');
  });

  it('gives 掲載なし no badge at all', () => {
    const h = cardBodyHtml(eat({ michelin: 'none' }));
    expect(h).not.toContain('chip-michelin');
    expect(h).toContain('chip-dining');   // the category chip stays
  });

  it('drops the rating rather than showing ★ without a number', () => {
    expect(ratingText(eat({ rating: 0 }))).toBe('');
    expect(ratingText(eat({ reviewCount: 0 }))).toBe('★4.8');
  });

  it('describes itself to a screen reader with exactly what it shows', () => {
    expect(cardAriaLabel(eat())).toBe('akar、昼 RM 334 ・ 夜 RM 682');
    expect(cardBodyHtml(eat())).toContain(`>${cardHeroText(eat())}</div>`);
  });

  it('escapes a name and a category that contain markup', () => {
    const h = cardBodyHtml(eat({ name: 'A "B" & <C>' }));
    expect(h).toContain('A &quot;B&quot; &amp; &lt;C&gt;');
    expect(h).not.toContain('<C>');
  });
});

// ============================================================
// SORT
// ============================================================
describe('the 飲食 sort orders', () => {
  const list = [
    eat({ name: 'Quiet', rating: 4.9, reviewCount: 12, priceDinner: [0, 900] }),
    eat({ name: 'Loud', rating: 4.9, reviewCount: 2237, priceDinner: [0, 300] }),
    eat({ name: 'Mid', rating: 4.5, reviewCount: 400, priceDinner: [0, 60] }),
  ];
  const names = (key) => sortRecords(list, key).map(r => r.name);

  it('defaults to the highest rating', () => {
    expect(defaultSortFor('dining')).toBe('ratingHigh');
    expect(SORT_OPTIONS.dining[0].label).toBe('評価が高い順');
  });

  it('breaks a rating tie on the review count, not the name', () => {
    // ★4.9 out of 12 reviews is not the same claim as ★4.9 out of 2,237.
    expect(names('ratingHigh')).toEqual(['Loud', 'Quiet', 'Mid']);
  });

  it('orders by review count and by budget in both directions', () => {
    expect(names('reviewsHigh')).toEqual(['Loud', 'Mid', 'Quiet']);
    expect(names('budgetLow')).toEqual(['Mid', 'Loud', 'Quiet']);
    expect(names('budgetHigh')).toEqual(['Quiet', 'Loud', 'Mid']);
  });

  it('sinks an unpriced place to the bottom of the cheap-first order', () => {
    const withUnknown = [...list, eat({ name: 'Zulu', priceLunch: [0, 0], priceDinner: [0, 0] })];
    expect(sortRecords(withUnknown, 'budgetLow').map(r => r.name).at(-1)).toBe('Zulu');
  });

  it('does not offer an order that belongs to another layer', () => {
    expect(sortAvailable('dining', 'ratingHigh')).toBe(true);
    expect(sortAvailable('dining', 'rentLow')).toBe(false);
    expect(sortAvailable('condo', 'ratingHigh')).toBe(false);
  });
});

// ============================================================
// LOADING — the real file, through the real parser
// ============================================================
describe('parseRestaurants (restaurants.json → the app record shape)', () => {
  const recs = parseRestaurants(raw);

  it('reads every geocoded restaurant', () => {
    expect(RESTAURANTS_URL).toBe('restaurants.json');
    expect(recs.length).toBe(JSON.parse(raw).length);
    expect(recs.length).toBeGreaterThanOrEqual(50);
  });

  it('stamps them all as the dining layer', () => {
    recs.forEach(r => expect(recordLayer(r)).toBe('dining'));
  });

  it('renames `address` to the `addr` every other layer uses', () => {
    expect(recs.every(r => r.addr)).toBe(true);
    expect(recs[0].addr).toBe(JSON.parse(raw)[0].address);
  });

  it('keeps the dining-only fields the card and the panel need', () => {
    const r = recs.find(x => x.name === 'akar');
    expect(r.placeId).toBeTruthy();
    expect(r.catGroup).toBe('マレーシア料理');
    expect(r.michelin).toBe('1star');
    expect(r.priceDinner).toEqual([682, 682]);
    expect(r.vox.pros).toBeTruthy();
    expect(r.editorNote).toBeTruthy();
  });

  it('fills the common columns so a restaurant travels the shared code paths', () => {
    recs.forEach(r => {
      expect(Number.isFinite(r.lat) && Number.isFinite(r.lng)).toBe(true);
      expect(r.luxTier).toBe('D');
      expect(r.units).toBe(0);
    });
  });

  it('every record survives its own category and michelin filters (除名行は逆に絶対に出ない)', () => {
    recs.forEach(r => {
      // 台帳除名(★4.9裁定 2026-08-09): 行はID安定のため残るが、どの条件でも描かれない
      if(r.delisted){
        expect(matchesFilters(r, fd({})), r.name).toBe(false);
        return;
      }
      expect(matchesFilters(r, fd({ catGroup: r.catGroup })), r.name).toBe(true);
      expect(matchesFilters(r, fd({ diningArea: r.area })), r.name).toBe(true);
    });
  });

  it('除名(墓標)の契約: ★4.9の5店が安定IDで含まれ、全除名に理由がある', () => {
    const del = recs.filter(r => r.delisted).map(r => `${r.id}:${r.name}`);
    // ★4.9裁定(2026-08-09)の5店。IDが動いたら家族記録が壊れている
    for(const pin of [
      'R0053:MT Hotpot', 'R0055:Fire Izakaya', 'R0056:Cotta',
      'R0059:TTDI Meat Point', "R0123:En Yeoh's Bak Kut Teh",
    ]) expect(del).toContain(pin);
    // 件数条件裁定(2026-08-09)以降も含め、除名には必ず理由文字列がある
    for(const r of recs.filter(r => r.delisted)){
      expect(typeof r.delisted, r.name).toBe('string');
      expect(r.delisted.length, r.name).toBeGreaterThan(5);
    }
    // K KL（圭）は★4.9だがミシュラン掲載=完全網羅の既存裁定が勝ち、残留。
    // 日本人定番の宮武・Casa Rosaも件数条件裁定(2026-08-09)で残留
    for(const keep of ['K KL', 'Miyatake', 'Casa Rosa']){
      const r = recs.find(x => x.name.includes(keep));
      expect(r.delisted, r.name).toBe('');
    }
  });

  it('the four price bands cover every priced restaurant exactly once; an unpriced one shows under all', () => {
    const BANDS = ['0-50', '50-150', '150-400', '400-'];
    recs.forEach(r => {
      const hits = BANDS.filter(b => matchesPriceBand(r, b));
      // A record with no price at all (D6 expansion: Napa Thai) is shown under
      // every band by design — an unknown price is not a cheap one, and hiding
      // it would silently shrink the list.
      const expected = diningPriceCeiling(r) > 0 ? 1 : BANDS.length;
      expect(hits.length, `${r.name} matched [${hits.join(', ')}]`).toBe(expected);
    });
  });

  it('refuses a payload that is not an array rather than showing an empty layer', () => {
    expect(() => parseRestaurants('{"a":1}')).toThrow();
  });
});

// ============================================================
// DETAIL PANEL
// ============================================================
describe('the dining detail panel', () => {
  it('uses the guide\'s own wording for the michelin standing', () => {
    expect(detailHtml(eat({ michelin: '2star' }))).toContain('二つ星');
    expect(detailHtml(eat({ michelin: 'bib' }))).toContain('ビブグルマン');
    expect(detailHtml(eat({ michelin: 'sel' }))).toContain('掲載店');
    expect(detailHtml(eat({ michelin: 'none' }))).toContain('掲載なし');
  });

  it('shows both halves of the reputation, never only the praise', () => {
    const h = detailHtml(eat());
    expect(h).toContain('支持される点');
    expect(h).toContain('物語性');
    expect(h).toContain('割れる点・不満');
    expect(h).toContain('塩気が強い');
  });

  it('shows an em dash rather than dropping an empty vox section', () => {
    const h = detailHtml(eat({ vox: { pros: '', cons: '' } }));
    expect(h).toContain('支持される点');
    expect(h).toContain('割れる点・不満');
  });

  it('carries the price note, the editor note, the area and the venue', () => {
    const h = detailHtml(eat());
    expect(h).toContain('コース制。');
    expect(h).toContain('公表');
    expect(h).toContain('土着食材。');
    expect(h).toContain('Chinatown');
    expect(h).toContain('路面店');
  });

  it('says 大人向き (v9 wording) for a place that is not marked child-friendly', () => {
    expect(detailHtml(eat({ kidOk: 1 }))).toContain('◎ 向いている');
    expect(detailHtml(eat({ kidOk: 0 }))).toContain('大人向き');
  });

  it('never shows a zero as a price', () => {
    const h = detailHtml(eat({ priceLunch: [0, 0], priceDinner: [0, 0], rating: 0 }));
    expect(h).not.toContain('RM 0');
    expect(h).not.toContain('★0');
  });

  it('links out to Google Maps in a new tab, safely', () => {
    const h = detailHtml(eat());
    expect(h).toContain('https://www.google.com/maps/place/?q=place_id:ChIJabc123');
    expect(h).toContain('target="_blank"');
    expect(h).toContain('rel="noopener"');
  });

  it('without a Place ID there is no Google Maps link — but Waze still works off the coordinates', () => {
    const h = detailHtml(eat({ placeId: '' }));
    expect(h).not.toContain('google.com/maps');
    expect(h).toContain('waze.com/ul');
  });

  it('without coordinates there is no Waze link either', () => {
    expect(detailHtml(eat({ placeId: '', lat: null, lng: null }))).not.toContain('waze.com');
  });
});

describe('the Google Maps link', () => {
  it('is a place_id deep link', () => {
    expect(googleMapsUrl('ChIJD5ydgbdNzDERVeakzTjfpk8'))
      .toBe('https://www.google.com/maps/place/?q=place_id:ChIJD5ydgbdNzDERVeakzTjfpk8');
  });

  it('is nothing at all when there is no Place ID', () => {
    expect(googleMapsUrl('')).toBe('');
  });
});

// ── Google評価のリンク化（2026-08-08 依頼） ─────────────────────────
describe('the Google rating links out to the restaurant on Google Maps', () => {
  const eatWith = (over) => ({ status: 'dining', id: 'R0001', name: 'x', venueType: 'street',
    rating: 4.5, reviewCount: 100, placeId: 'ChIJtest123', michelin: 'none',
    cat: 'フレンチ', catGroup: '洋食・グリル', priceLunch: [0,0], priceDinner: [0,0],
    vox: { pros: '', cons: '' }, ...over });
  it('wraps the rating in a Maps link when the store has a real placeId', () => {
    const h = detailHtml(eatWith({}));
    expect(h).toContain('class="kv-link"');
    expect(h).toContain('place_id:ChIJtest123');
    expect(h).toContain('rel="noopener"');
  });
  it('stays plain text for a pending placeId and for an unrated store', () => {
    expect(detailHtml(eatWith({ placeId: 'pending:somewhere' }))).not.toContain('kv-link');
    expect(detailHtml(eatWith({ rating: null, reviewCount: 0 }))).not.toContain('kv-link');
  });
});

// ── 所要時間フィルタ + ビブ識別（ミシュラン網羅 P4・2026-08-08） ──────
import { matchesDriveTime } from '../src/domain/filter.js';
describe('matchesDriveTime — MKからの渋滞込み目安で絞る', () => {
  it('no limit passes everything, including unknown', () => {
    expect(matchesDriveTime({ driveMinJam: 41 }, '')).toBe(true);
    expect(matchesDriveTime({ driveMinJam: null }, '')).toBe(true);
  });
  it('bounded limit keeps within, drops beyond, and is honest about unknown', () => {
    expect(matchesDriveTime({ driveMinJam: 15 }, '15')).toBe(true);
    expect(matchesDriveTime({ driveMinJam: 16 }, '15')).toBe(false);
    expect(matchesDriveTime({ driveMinJam: null }, '15')).toBe(false);
  });
});

// 列を足したらパーサにも足す(2026-08-08のdrive列で実際に落ちた) — 再発防止の契約
describe('parseRestaurants carries the drive-time columns', () => {
  it('keeps driveKm/minFree/minJam and passes null through (never 0)', () => {
    const rows = JSON.stringify([{ id:'R0001', name:'x', address:'a', lat:3.1, lng:101.6,
      driveKm: 13.6, driveMinFree: 17, driveMinJam: 30 },
      { id:'R0002', name:'y', address:'a', lat:3.1, lng:101.61 }]);
    const [a, b] = parseRestaurants(rows);
    expect(a.driveMinJam).toBe(30);
    expect(a.driveKm).toBe(13.6);
    expect(b.driveMinJam).toBeNull();
  });
});

// ── 屋台街=エリアの明示マーク(2026-08-08 竹森さん指摘: Jalan Alorは店ではない) ──
describe('a hawker-street entry declares itself an AREA, not a restaurant', () => {
  it('swaps the category chip for the 📍 area mark', () => {
    const h = cardBodyHtml(eat({ name: 'Jalan Alor', catGroup: '屋台街', cat: '屋台街' }));
    expect(h).toContain('chip-area-mark');
    expect(h).toContain('個別の店ではありません');
    expect(h).not.toContain('chip-dining">屋台街');
  });
  it('an ordinary restaurant keeps the normal category chip', () => {
    const h = cardBodyHtml(eat());
    expect(h).not.toContain('chip-area-mark');
    expect(h).toContain('chip-dining');
  });
});

// ============================================================
// 評価下限フィルタ(2026-08-09 竹森さん依頼: ★4.3以上/★4.5以上)
// ============================================================
describe('minRating — Google評価の下限', () => {
  const recs = parseRestaurants(raw);
  const r43 = recs.find(r => !r.delisted && r.rating != null && r.rating >= 4.3 && r.rating < 4.5);
  const r42 = recs.find(r => !r.delisted && r.rating != null && r.rating < 4.3);
  // パース後の契約では「評価未集計」= rating 0 (load.jsが null→0 に潰す)
  const rNull = recs.find(r => !r.delisted && r.rating === 0);

  it('4.3以上で 4.3台は通り 4.3未満は落ちる', () => {
    expect(matchesFilters(r43, fd({ minRating: 4.3 })), r43.name).toBe(true);
    expect(matchesFilters(r42, fd({ minRating: 4.3 })), r42.name).toBe(false);
  });

  it('4.5以上では 4.3台も落ちる', () => {
    expect(matchesFilters(r43, fd({ minRating: 4.5 })), r43.name).toBe(false);
  });

  it('評価未集計(null)は絞り込み中は出ない(証明できない高評価は高評価ではない)', () => {
    expect(rNull, 'null評価の店が台帳にいる前提').toBeTruthy();
    expect(matchesFilters(rNull, fd({ minRating: 4.3 })), rNull.name).toBe(false);
    expect(matchesFilters(rNull, fd({})), rNull.name).toBe(true);   // 絞り込みなしなら出る
  });

  it('index.html に評価セレクトがあり、選択肢は 4.3 / 4.5(モバイル40pxも登録済み)', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    expect(html).toContain('id="fMinRating"');
    expect(html).toContain('★4.3以上');
    expect(html).toContain('★4.5以上');
    expect(html).toMatch(/#fMinRating[^{]*{min-height:40px}/);
  });

  // 2026-08-15: 小分類セレクトは大分類の隣に立ち、大分類が「すべて」の間は
  // 押せない(disabled)。選択肢は台帳から作るので、初期HTMLは空でよい。
  it('index.html に小分類セレクトがあり、初期状態は disabled・大分類は専用ハンドラ', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    expect(html).toContain('id="fCat"');
    expect(html).toContain('細分類');
    // 大分類が変わったら小分類を作り直す必要があるので applyFilters() 直呼びではない
    expect(html).toMatch(/id="fCatGroup"[^>]*onchange="onCatGroupChange\(\)"/);
    // 初期は選べない(大分類を選ぶまで中身が決まらない)
    expect(html).toMatch(/<select id="fCat"[^>]*disabled/);
    expect(html).toMatch(/#fCat[,{][^{]*{min-height:40px}/);
    // 4つ横並びのままだと選んだ値が読めない幅になるので、飲食の行だけ2列折り返し
    expect(html).toMatch(/<div class="filter-row filter-row-2col" data-layer-only="dining"/);
    expect(html).toContain('.filter-row-2col{flex-wrap:wrap}');
  });
});

// ============================================================
// エリア「〜付近」バケツ(2026-08-09 A案)
// ============================================================
describe('エリア付近バケツ', () => {
  const recs = parseRestaurants(raw);

  it('台帳の全エリア名が対応表に明示登録されている(意図せぬ「その他」行きの検出)', () => {
    const unmapped = [...new Set(recs.filter(r => !r.delisted && r.area).map(r => r.area))]
      .filter(a => !isBucketedArea(a));
    // 新調査でエリア名を増やしたら対応表にも足す。ここに出る=未裁定の「その他」行き。
    expect(unmapped).toEqual([]);
  });

  it('バケツ名でのフィルタは付近全体を通し、細エリア名(旧URL)は従来の完全一致', () => {
    const mk = eat({ area: 'Mont Kiara' });
    const hartamas = eat({ area: 'Desa Sri Hartamas' });
    const bangsar = eat({ area: 'Bangsar' });
    expect(matchesDining(mk, { diningArea: 'モントキアラ付近' })).toBe(true);
    expect(matchesDining(hartamas, { diningArea: 'モントキアラ付近' })).toBe(true);
    expect(matchesDining(bangsar, { diningArea: 'モントキアラ付近' })).toBe(false);
    // 旧URL互換: 細エリア名が来たら完全一致で絞る
    expect(matchesDining(mk, { diningArea: 'Mont Kiara' })).toBe(true);
    expect(matchesDining(hartamas, { diningArea: 'Mont Kiara' })).toBe(false);
  });

  it('未登録エリアは「その他」に落ちる', () => {
    expect(areaBucketOf('新開拓エリアXYZ')).toBe('その他');
    expect(AREA_BUCKETS[AREA_BUCKETS.length - 1]).toBe('その他');
  });
});
