// 推奨軸(2026-08-08)の契約。原則: どのティアも「なぜか」を1行で言える。
// 実勢調査(検証A)で確定した実店の裁定が、規則の上で正しく再現されることを
// 実データで固定する — 机上の規則が名店を誤殺しないための回帰テスト。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  recTier, isRecommended, crowdStrong, crowdWeak, hasAuthority,
  RECOMMENDED_TIERS, REC_BADGES, recBadge,
} from '../src/domain/recommend.js';

const LEDGER = JSON.parse(readFileSync(new URL('../restaurants.json', import.meta.url), 'utf8').replace(/\r\n/g, '\n'));
const find = (n) => LEDGER.find((x) => x.name === n);

const rec = (over = {}) => ({
  michelin: 'none', extraFlags: [], rating: 4.5, reviewCount: 500, ...over,
});

describe('signals', () => {
  it('crowdStrong follows the discovery bar (4.4×300 or 4.6×100)', () => {
    expect(crowdStrong(rec({ rating: 4.4, reviewCount: 300 }))).toBe(true);
    expect(crowdStrong(rec({ rating: 4.6, reviewCount: 100 }))).toBe(true);
    expect(crowdStrong(rec({ rating: 4.5, reviewCount: 99 }))).toBe(false);
    expect(crowdStrong(rec({ rating: null, reviewCount: 0 }))).toBe(false);
  });
  it('crowdWeak is the divergence trigger (<4.3), null is not weak', () => {
    expect(crowdWeak(rec({ rating: 4.2 }))).toBe(true);
    expect(crowdWeak(rec({ rating: 4.3 }))).toBe(false);
    expect(crowdWeak(rec({ rating: null }))).toBe(false);
  });
  it('authority = michelin or an award tag', () => {
    expect(hasAuthority(rec({ michelin: 'sel' }))).toBe(true);
    expect(hasAuthority(rec({ extraFlags: ['Tatler Best 20'] }))).toBe(true);
    expect(hasAuthority(rec())).toBe(false);
  });
});

describe('recTier — the ladder', () => {
  it('closed beats everything', () => {
    expect(recTier(rec({ closed: true, michelin: '2star' }))).toBe('closed');
  });
  it('family verdict beats external opinion in BOTH directions', () => {
    expect(recTier(rec({ michelin: 'none', rating: 4.0, reviewCount: 10 }), { rv: 'a' })).toBe('teppan');
    expect(recTier(rec({ michelin: '2star', rating: 4.9, reviewCount: 9999 }), { rv: 'n' })).toBe('veto');
  });
  it('authority × strong crowd = double confirmation', () => {
    expect(recTier(rec({ michelin: '1star', rating: 4.8, reviewCount: 1178 }))).toBe('double');
  });
  it('divergence without a ruling falls to caution; with tsuu it is 通好み', () => {
    expect(recTier(rec({ michelin: 'sel', rating: 4.1, reviewCount: 500 }))).toBe('caution');
    expect(recTier(rec({ michelin: 'sel', rating: 4.1, reviewCount: 500, recDivergence: 'tsuu' }))).toBe('tsuu');
  });
  it('recheck ruling and null rating are both 未確証', () => {
    expect(recTier(rec({ michelin: 'sel', rating: 4.1, recDivergence: 'recheck' }))).toBe('unverified');
    expect(recTier(rec({ michelin: 'sel', rating: null, reviewCount: 0 }))).toBe('unverified');
  });
  it('the lens passes exactly the recommendable tiers', () => {
    expect(RECOMMENDED_TIERS).toEqual(['teppan', 'double', 'tsuu', 'authority', 'crowd']);
    expect(isRecommended(rec({ michelin: 'sel', rating: 4.1, reviewCount: 500 }))).toBe(false);
    expect(isRecommended(rec({ michelin: 'sel', rating: 4.1, reviewCount: 500, recDivergence: 'tsuu' }))).toBe(true);
  });
});

describe('the real rulings from 検証A stay in force (regression)', () => {
  it('Dewakan (2★ at ★4.2) is 通好み, never caution — the rule must not kill the top table', () => {
    expect(recTier(find('Dewakan'))).toBe('tsuu');
  });
  it('Wong Mei Kee (★3.8×2900) is 通好み — queues, not taste', () => {
    expect(recTier(find('Wong Mei Kee'))).toBe('tsuu');
  });
  it('Café Café stays 未確証 until the sweep clears it', () => {
    expect(recTier(find('Café Café'))).toBe('unverified');
  });
  it('Yan Kee (旧Heun Kee跡地の再開) is 未確証 until its new Google listing accrues', () => {
    const h = LEDGER.find((x) => x.name.includes('Yan Kee'));
    expect(recTier(h)).toBe('unverified');
    expect(isRecommended(h)).toBe(false);
  });
  it('no store in the ledger is an unruled caution (every divergence got its ruling)', () => {
    const cautions = LEDGER.filter((x) => recTier(x) === 'caution').map((x) => x.name);
    expect(cautions).toEqual([]);
  });
});

describe('badges', () => {
  it('every visible tier has a badge with icon+label+hint; veto has none by design', () => {
    for(const t of ['teppan', 'double', 'tsuu', 'authority', 'crowd', 'caution', 'unverified', 'closed']){
      expect(REC_BADGES[t].icon).toBeTruthy();
      expect(REC_BADGES[t].label).toBeTruthy();
      expect(REC_BADGES[t].hint).toBeTruthy();
    }
    expect(recBadge('veto')).toBeNull();
  });
});
