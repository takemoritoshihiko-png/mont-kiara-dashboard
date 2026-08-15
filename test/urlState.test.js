// Contract for URL = screen state (src/ui/urlState.js).
// The module only touches history/location behind `typeof` guards, so it loads
// in plain node and the history calls can be checked against a stub.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  buildQuery, readUrlState, writeUrlState, withUrlWritesSuspended, parseFilterParam,
} from '../src/ui/urlState.js';

const roundTrip = (state) => readUrlState('?' + buildQuery(state));
// D4 added `mode` to the screen state. 住まいモード is the default and is left
// OUT of the query string, so it comes back as null — a link written before D4
// still reproduces exactly the screen it did.
const HOME = { mode: null, f: null };

describe('filters in the URL', () => {
  // 2026-08-15: 小分類も共有リンクに載る(「洋食・グリル＞ステーキ」で絞った画面を
  // そのまま家族に送れる)。許可リストに無いidは落とされる契約なので、ここで守る。
  it('carries the 大分類 and the 小分類, and still drops unknown ids', () => {
    expect(parseFilterParam('fCatGroup:%E4%B8%AD%E8%8F%AF|fCat:%E7%81%AB%E9%8D%8B'))
      .toEqual([['fCatGroup', '中華'], ['fCat', '火鍋']]);
    expect(parseFilterParam('fNope:x')).toEqual([]);
  });
});

describe('round trip', () => {
  it('preserves a plain condo selection', () => {
    const s = { layer: 'condo', sel: 'Seni Mont Kiara', tab: 'detail' };
    expect(roundTrip(s)).toEqual({ ...HOME, ...s });
  });

  it('preserves spaces in a name', () => {
    expect(roundTrip({ layer: 'condo', sel: 'Seni Mont Kiara', tab: 'detail' }).sel)
      .toBe('Seni Mont Kiara');
  });

  it('preserves parentheses', () => {
    const name = 'Publika (Solaris Dutamas)';
    expect(roundTrip({ layer: 'commercial', sel: name, tab: 'nearby' }).sel).toBe(name);
  });

  it('preserves Japanese names', () => {
    const name = 'セニ・モントキアラ';
    expect(roundTrip({ layer: 'condo', sel: name, tab: 'detail' }).sel).toBe(name);
  });

  it('preserves ampersands and other separator characters', () => {
    const name = 'Marks & Spencer / Lot 10';
    expect(roundTrip({ layer: 'commercial', sel: name, tab: 'detail' }).sel).toBe(name);
  });

  it('percent-encodes rather than leaving raw separators in the query', () => {
    const q = buildQuery({ layer: 'commercial', sel: 'A&B=C' });
    expect(q.includes('sel=A%26B%3DC')).toBe(true);
  });
});

describe('buildQuery', () => {
  it('omits every empty part', () => {
    expect(buildQuery({})).toBe('');
    expect(buildQuery({ layer: 'school' })).toBe('layer=school');
  });

  it('keeps the parts in a stable order', () => {
    expect(buildQuery({ layer: 'school', sel: 'A', tab: 'nearby' }))
      .toBe('layer=school&sel=A&tab=nearby');
  });
});

describe('readUrlState', () => {
  it('reads an empty query as an empty state', () => {
    expect(readUrlState('')).toEqual({ mode: null, layer: null, sel: null, tab: null, f: null });
  });

  it('rejects a layer the app has no controls for', () => {
    // 'dining' used to be the example here; it is a real layer since D3, so the
    // assertion moved to a value that still has no controls behind it.
    expect(readUrlState('?layer=hotels').layer).toBe(null);
  });

  it('accepts the 飲食 layer, so ?layer=dining is a shareable link', () => {
    expect(readUrlState('?layer=dining').layer).toBe('dining');
    expect(readUrlState('?layer=dining&sel=Dewakan&tab=nearby'))
      .toEqual({ mode: null, layer: 'dining', sel: 'Dewakan', tab: 'nearby', f: null });
  });

  it('rejects an unknown tab', () => {
    expect(readUrlState('?tab=floorplan').tab).toBe(null);
  });

  it('keeps a valid selection even when the layer is junk', () => {
    const s = readUrlState('?layer=nope&sel=Vipod%20Residences');
    expect(s).toEqual({ mode: null, layer: null, sel: 'Vipod Residences', tab: null, f: null });
  });

  it('accepts a query string with or without the leading ?', () => {
    expect(readUrlState('layer=school').layer).toBe('school');
  });
});

// ============================================================
// D4: ?mode=eatout
// 外食モード shows a private ledger, so the URL may only turn it on with the
// literal string — and 住まい, being the default, never appears in the query.
// ============================================================
describe('mode (D4)', () => {
  it('leaves 住まいモード out of the query entirely', () => {
    expect(buildQuery({ mode: 'home', layer: 'condo' })).toBe('layer=condo');
    expect(buildQuery({ layer: 'condo' })).toBe('layer=condo');
  });

  it('writes 外食モード first, so the coarsest thing is read first', () => {
    expect(buildQuery({ mode: 'eatout', layer: 'dining', sel: 'akar', tab: 'detail' }))
      .toBe('mode=eatout&layer=dining&sel=akar&tab=detail');
  });

  it('reads it back', () => {
    expect(readUrlState('?mode=eatout').mode).toBe('eatout');
    expect(roundTrip({ mode: 'eatout', layer: 'dining', sel: 'akar', tab: 'detail' }))
      .toEqual({ mode: 'eatout', layer: 'dining', sel: 'akar', tab: 'detail', f: null });
  });

  it('drops anything that is not one of the two modes', () => {
    for(const bad of ['dining', 'EATOUT', 'private', '1', '']){
      expect(readUrlState('?mode=' + bad).mode, bad).toBe(null);
    }
  });

  it('defaults to 住まい when the parameter is absent', () => {
    expect(readUrlState('?layer=dining').mode).toBe(null);
  });
});

describe('writeUrlState', () => {
  let calls;

  beforeEach(() => {
    calls = [];
    globalThis.location = { pathname: '/index.html', search: '' };
    globalThis.history = {
      pushState: (...a) => calls.push(['push', a[2]]),
      replaceState: (...a) => calls.push(['replace', a[2]]),
    };
  });

  afterEach(() => {
    delete globalThis.location;
    delete globalThis.history;
  });

  it('pushes a new entry for a selection', () => {
    writeUrlState({ layer: 'condo', sel: 'Vipod Residences', tab: 'detail' });
    expect(calls).toEqual([['push', '/index.html?layer=condo&sel=Vipod+Residences&tab=detail']]);
  });

  it('replaces the entry when asked to', () => {
    writeUrlState({ layer: 'school' }, { replace: true });
    expect(calls).toEqual([['replace', '/index.html?layer=school']]);
  });

  it('drops the query when the state empties out (closing the detail panel)', () => {
    globalThis.location.search = '?layer=condo&sel=Vipod+Residences&tab=detail';
    expect(writeUrlState({})).toBe('/index.html');
    expect(calls).toEqual([['push', '/index.html']]);
  });

  it('does not stack a history entry for the URL already shown', () => {
    globalThis.location.search = '?layer=condo';
    writeUrlState({ layer: 'condo' });
    expect(calls).toEqual([]);
  });

  it('writes nothing while writes are suspended, but still reports the URL', () => {
    const url = withUrlWritesSuspended(() =>
      writeUrlState({ layer: 'school', sel: 'Garden International School' }));
    expect(url).toBe('/index.html?layer=school&sel=Garden+International+School');
    expect(calls).toEqual([]);
  });

  it('resumes writing once the suspension ends', () => {
    withUrlWritesSuspended(() => writeUrlState({ layer: 'school' }));
    writeUrlState({ layer: 'school' });
    expect(calls).toEqual([['push', '/index.html?layer=school']]);
  });

  it('restores the previous suspension state even if the body throws', () => {
    expect(() => withUrlWritesSuspended(() => { throw new Error('boom'); })).toThrow('boom');
    writeUrlState({ layer: 'commercial' });
    expect(calls).toEqual([['push', '/index.html?layer=commercial']]);
  });
});
