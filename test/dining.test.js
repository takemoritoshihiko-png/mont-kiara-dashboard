// Data integrity contract for restaurants.json (dining ledger, D2).
// Source of truth: kl-dining-ledger-v9.html (converted by tools/convert-v9-dining.js).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const restaurants = JSON.parse(readFileSync(join(root, 'restaurants.json'), 'utf8'));

const CAT_GROUPS = [
  'マレーシア料理', '洋食・グリル', '中華', 'インド・スリランカ',
  '鶏飯・ご飯もの', '麺・肉骨茶', '日本・その他アジア', '屋台街',
  'カフェ・デザート', // ruled 2026-08-07 evening (E-1)
  'バー',           // ruled 2026-08-08 (Asia's 50 Best Bars 6店の受け皿)
];
const MICHELIN = ['2star', '1star', 'bib', 'sel', 'none'];
const VENUE_TYPES = ['mall', 'hotel', 'tower', 'street', 'stall'];

describe('restaurants.json', () => {
  it('has at least the 50 ledger-v9 records (update deliberately when adding data)', () => {
    expect(restaurants.length).toBeGreaterThanOrEqual(50);
  });

  it('ids are R#### format, unique, and sequential from R0001', () => {
    restaurants.forEach((r, i) => {
      expect(r.id).toBe('R' + String(i + 1).padStart(4, '0'));
    });
  });

  it('names and placeIds are unique and non-empty', () => {
    for (const key of ['name', 'placeId']) {
      const vals = restaurants.map((r) => r[key]);
      expect(vals.every((v) => v && v.trim() !== '')).toBe(true);
      expect(vals.filter((v, i) => vals.indexOf(v) !== i)).toEqual([]);
    }
  });

  it('every catGroup is one of the ruled groups', () => {
    const bad = restaurants.filter((r) => !CAT_GROUPS.includes(r.catGroup));
    expect(bad.map((r) => `${r.name}:${r.catGroup}`)).toEqual([]);
  });

  it('michelin and venueType are valid enums', () => {
    expect(restaurants.filter((r) => !MICHELIN.includes(r.michelin))).toEqual([]);
    expect(restaurants.filter((r) => !VENUE_TYPES.includes(r.venueType))).toEqual([]);
  });

  it('coordinates are inside the Klang Valley, or null with geoPrecision=pending', () => {
    for (const r of restaurants) {
      if (r.lat === null || r.lng === null) {
        expect(r.geoPrecision, r.name).toBe('pending');
      } else {
        expect(r.lat, r.name).toBeGreaterThan(2.9);
        expect(r.lat, r.name).toBeLessThan(3.4);
        expect(r.lng, r.name).toBeGreaterThan(101.5);
        expect(r.lng, r.name).toBeLessThan(101.9);
      }
    }
  });

  it('non-null coordinates are not duplicated across restaurants (area-centroid trap)', () => {
    // Legit shared points: Chinatown street-precision trio (block centroid),
    // Yun House + Nadodi (both inside the Four Seasons building), and
    // Jhol KL + Lachér Patisserie (both inside The MET, KL Metropolis).
    const allowShared = [
      'Yun House', 'Nadodi',
      'Jhol KL', 'Lachér Patisserie',
      'Jwala', 'Seed',   // The Five@KPD Block E — 同一複合の同座標
      'Sae Ma Eul BBQ', 'Seng Kee Chicken Rice', "En Yeoh's Bak Kut Teh",   // Solaris Mont Kiara(venue精度)
      'Fei Fan Hotpot', 'QingHeGu Korean BBQ',   // 163 Retail Park(venue精度)
      'The Barn', 'Mercat Barcelona Gastrobar',   // 1 Mont Kiara(venue精度)
      'Muska',   // Verve Shops(Cottaと同建物venue精度)
      'Cotta',
      'Restaurant Jie', 'Reka:Bar',   // Jalan Setia Bakti — 双方とも街レベル精度の同街区
    ];
    const seen = new Map();
    for (const r of restaurants) {
      if (r.lat === null || allowShared.includes(r.name)) continue;
      const key = `${r.lat},${r.lng}`;
      expect(seen.has(key), `${r.name} shares coordinates with ${seen.get(key)}`).toBe(false);
      seen.set(key, r.name);
    }
  });

  it('price ranges satisfy lo <= hi (0 means not offered / unknown)', () => {
    for (const r of restaurants) {
      for (const [lo, hi] of [r.priceLunch, r.priceDinner]) {
        expect(lo <= hi, `${r.name}: [${lo},${hi}]`).toBe(true);
      }
    }
  });

  it('rating is 0-5 (or null for an unrated new store with 0 reviews)', () => {
    for (const r of restaurants) {
      if (r.rating === null) {
        // 開業直後でGoogle評価が未集計の店だけが null を名乗れる。
        // スコアは shrunkRating が基準線(C)に落とすので中立、表示は空欄になる。
        expect(r.reviewCount, r.name).toBe(0);
        continue;
      }
      expect(r.rating, r.name).toBeGreaterThan(0);
      expect(r.rating, r.name).toBeLessThanOrEqual(5);
      expect(Number.isInteger(r.reviewCount) && r.reviewCount >= 0, r.name).toBe(true);
    }
  });

  it('every record carries the personal-ledger prerequisites (area, address, cat)', () => {
    for (const r of restaurants) {
      expect(r.area, r.name).toBeTruthy();
      expect(r.address, r.name).toBeTruthy();
      expect(r.cat, r.name).toBeTruthy();
    }
  });
});
