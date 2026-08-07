// Contract for 個人記録 (src/data/personal.js).
//
// This is the only thing in the app the user cannot get back from anywhere
// else: the map, the prices and the ledger all live in the repo, but 「いつ行っ
// て、いくら払って、どう思ったか」 exists on one machine and nowhere else. So
// the rules that keep it — the local date, the read-only getter, the storage
// probe, the import conversion and the export round trip — are pinned here.
//
// The store is injectable (`initPersonal({storage})`), so none of this needs a
// browser.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  STORAGE_KEY, PROBE_KEY, EXPORT_APP, EXPORT_VER, REPEAT_LABELS, TYPING_SAVE_MS,
  localDate, emptyEntry, normalizeEntry, isEmptyEntry, amountValue, normalizeStore,
  buildPlaceIdMap, parseImport, importSummaryText, mergeStores, buildExport,
  exportText, exportFilename,
  initPersonal, saveStatus, getEntry, hasEntry, allEntries, flush,
  toggleWant, setVisited, setRepeat, setAmount, setMemo,
  mergeAll, replaceAll, clearAll, currentExportText, storedCounts,
} from '../src/data/personal.js';

/** A localStorage stand-in. `fail` makes every write throw, like a full quota. */
function fakeStorage({ seed = null, fail = false } = {}){
  const map = new Map();
  if(seed != null) map.set(STORAGE_KEY, typeof seed === 'string' ? seed : JSON.stringify(seed));
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { if(fail) throw new Error('QuotaExceededError'); map.set(k, v); },
    removeItem: (k) => { map.delete(k); },
  };
}

const stored = (s) => JSON.parse(s.map.get(STORAGE_KEY) || '{}');

// ============================================================
// LOCAL DATE — v9 欠陥1
// ============================================================
describe('訪問日 is a LOCAL date, not a UTC one', () => {
  it('names the day the local calendar is on', () => {
    expect(localDate(new Date(2026, 7, 8, 0, 30, 0))).toBe('2026-08-08');
    expect(localDate(new Date(2026, 7, 8, 23, 59, 59))).toBe('2026-08-08');
  });

  it('zero-pads the month and the day', () => {
    expect(localDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(localDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('is exactly the case toISOString gets wrong east of UTC', () => {
    // Malaysia is UTC+8: 00:30 on the 8th is 16:30 on the 7th in UTC, and v9
    // stamped that — a dinner logged on the way home was filed the day before.
    const d = new Date(2026, 7, 8, 0, 30, 0);
    if(d.getTimezoneOffset() < 0){
      expect(d.toISOString().slice(0, 10)).not.toBe('2026-08-08');
    }
    expect(localDate(d)).toBe('2026-08-08');
  });
});

// ============================================================
// SHAPE
// ============================================================
describe('the six fields', () => {
  it('starts blank, and every empty entry is a fresh object', () => {
    expect(emptyEntry()).toEqual({ w: 0, v: 0, vd: '', rv: '', m: '', amt: '' });
    const a = emptyEntry(); a.m = 'x';
    expect(emptyEntry().m).toBe('');
  });

  it('coerces whatever came out of storage into the six fields', () => {
    expect(normalizeEntry({ w: '1', v: true, vd: '2026-08-07', rv: 'a', m: 'ok', amt: ' 180 ' }))
      .toEqual({ w: 1, v: 1, vd: '2026-08-07', rv: 'a', m: 'ok', amt: '180' });
  });

  it('throws away a malformed date and an unknown verdict rather than storing them', () => {
    expect(normalizeEntry({ vd: '2026/08/07' }).vd).toBe('');
    expect(normalizeEntry({ vd: 'yesterday' }).vd).toBe('');
    expect(normalizeEntry({ rv: 'z' }).rv).toBe('');
    expect(normalizeEntry({ rv: 'A' }).rv).toBe('');
  });

  it('survives junk without throwing', () => {
    expect(normalizeEntry(null)).toEqual(emptyEntry());
    expect(normalizeEntry([1, 2])).toEqual(emptyEntry());
    expect(normalizeEntry('x')).toEqual(emptyEntry());
  });

  it('reads an amount as a number, and never reads a blank as 0円', () => {
    expect(amountValue({ amt: '180' })).toBe(180);
    expect(amountValue({ amt: 'RM 180.50' })).toBe(180.5);
    expect(amountValue({ amt: '' })).toBe(0);
    expect(amountValue({ amt: '—' })).toBe(0);
    expect(amountValue({})).toBe(0);
  });

  it('calls an entry empty only when all six fields are', () => {
    expect(isEmptyEntry(emptyEntry())).toBe(true);
    expect(isEmptyEntry({ ...emptyEntry(), m: '   ' })).toBe(true);
    expect(isEmptyEntry({ ...emptyEntry(), w: 1 })).toBe(false);
    expect(isEmptyEntry({ ...emptyEntry(), m: 'よかった' })).toBe(false);
  });

  it('drops non-id keys and empty records from a store', () => {
    expect(normalizeStore({ R0001: { v: 1 }, nope: { v: 1 }, R0002: {} }))
      .toEqual({ R0001: { ...emptyEntry(), v: 1 } });
  });
});

// ============================================================
// THE READ-ONLY GETTER — v9 欠陥2
// ============================================================
describe('reading never writes (v9 欠陥2)', () => {
  beforeEach(() => { initPersonal({ storage: fakeStorage() }); });

  it('drawing 50 cards does not create 50 records', () => {
    for(let i = 1; i <= 50; i++) getEntry('R' + String(i).padStart(4, '0'));
    expect(Object.keys(allEntries())).toEqual([]);
    expect(storedCounts().stores).toBe(0);
  });

  it('returns a copy, so a caller cannot mutate the store by accident', () => {
    toggleWant('R0001');
    const e = getEntry('R0001');
    e.w = 0; e.m = 'tampered';
    expect(getEntry('R0001')).toMatchObject({ w: 1, m: '' });
  });

  it('answers for a restaurant that has no record without inventing one', () => {
    expect(getEntry('R0009')).toEqual(emptyEntry());
    expect(hasEntry('R0009')).toBe(false);
  });
});

// ============================================================
// THE STARTUP PROBE — v9 欠陥3 of the storage kind
// ============================================================
describe('the storage is proved writable before anything is typed', () => {
  it('probes with a throwaway key and cleans it up', () => {
    const s = fakeStorage();
    const r = initPersonal({ storage: s });
    expect(r.writable).toBe(true);
    expect(r.error).toBe('');
    expect(s.map.has(PROBE_KEY)).toBe(false);
  });

  it('reports a read-only storage instead of losing the first evening in silence', () => {
    const s = fakeStorage({ fail: true });
    const r = initPersonal({ storage: s });
    expect(r.writable).toBe(false);
    expect(r.error).toContain('書き出して');
    expect(saveStatus().writable).toBe(false);
  });

  it('still hands back what an unwritable storage can be READ for', () => {
    const s = fakeStorage({ seed: { R0001: { v: 1, m: '前回の記録' } }, fail: true });
    initPersonal({ storage: s });
    expect(getEntry('R0001').m).toBe('前回の記録');
    expect(saveStatus().writable).toBe(false);
  });

  it('survives a storage that is not there at all', () => {
    const r = initPersonal({ storage: null });
    expect(r.writable).toBe(false);
    expect(r.error).toContain('保存領域');
  });

  it('survives corrupted JSON in storage rather than refusing to start', () => {
    const s = fakeStorage({ seed: '{not json' });
    const r = initPersonal({ storage: s });
    expect(r.count).toBe(0);
    expect(r.error).not.toBe('');
  });

  it('loads and normalises what was saved last time', () => {
    const s = fakeStorage({ seed: { R0001: { v: 1, vd: '2026-08-01', rv: 'a', amt: '180' }, junk: { v: 1 } } });
    const r = initPersonal({ storage: s });
    expect(r.count).toBe(1);
    expect(getEntry('R0001')).toEqual({ w: 0, v: 1, vd: '2026-08-01', rv: 'a', m: '', amt: '180' });
  });
});

// ============================================================
// THE OPERATIONS
// ============================================================
describe('訪問済み / 行きたい / 再訪意向', () => {
  let s;
  beforeEach(() => { s = fakeStorage(); initPersonal({ storage: s }); });

  it('stamps today when 訪問済み goes on, and clears 行きたい', () => {
    toggleWant('R0001');
    expect(getEntry('R0001').w).toBe(1);
    setVisited('R0001', true, new Date(2026, 7, 7, 21, 0));
    expect(getEntry('R0001')).toMatchObject({ v: 1, w: 0, vd: '2026-08-07' });
  });

  it('does not overwrite a visit date that is already there', () => {
    setVisited('R0001', true, new Date(2026, 7, 1));
    setVisited('R0001', false);
    setVisited('R0001', true, new Date(2026, 7, 9));
    expect(getEntry('R0001').vd).toBe('2026-08-01');
  });

  it('keeps the verdict, the memo, the amount and the date when 訪問済み goes OFF', () => {
    setVisited('R0001', true, new Date(2026, 7, 7));
    setRepeat('R0001', 'a');
    setAmount('R0001', '180');
    setMemo('R0001', 'ラクサがよかった');
    setVisited('R0001', false);
    expect(getEntry('R0001')).toEqual({
      w: 0, v: 0, vd: '2026-08-07', rv: 'a', m: 'ラクサがよかった', amt: '180',
    });
    // …and turning it back on restores the whole thing.
    setVisited('R0001', true, new Date(2026, 7, 9));
    expect(getEntry('R0001')).toMatchObject({ v: 1, vd: '2026-08-07', rv: 'a', amt: '180' });
  });

  it('returns 再訪意向 to 未回答 when the same choice is pressed again', () => {
    setVisited('R0001', true);
    expect(setRepeat('R0001', 'a').rv).toBe('a');
    expect(setRepeat('R0001', 'a').rv).toBe('');
    expect(setRepeat('R0001', 'n').rv).toBe('n');
    expect(setRepeat('R0001', 'm').rv).toBe('m');
  });

  it('names the three choices the way the UI does', () => {
    expect(REPEAT_LABELS).toMatchObject({ a: 'また行く', m: '機会があれば', n: 'もういい', '': '未回答' });
  });

  it('prunes a record back out of storage once it is empty again', () => {
    toggleWant('R0001');
    expect(hasEntry('R0001')).toBe(true);
    toggleWant('R0001');
    expect(hasEntry('R0001')).toBe(false);
    expect(stored(s)).toEqual({});
  });

  it('refuses to write under anything that is not a restaurant id', () => {
    toggleWant('ChIJabc');
    toggleWant('');
    expect(allEntries()).toEqual({});
  });
});

describe('saving', () => {
  let s;
  beforeEach(() => { s = fakeStorage(); initPersonal({ storage: s }); });

  it('writes a button press through immediately', () => {
    setVisited('R0001', true, new Date(2026, 7, 7));
    expect(stored(s).R0001).toMatchObject({ v: 1, vd: '2026-08-07' });
    expect(saveStatus().savedAt).toBeInstanceOf(Date);
  });

  it('debounces typing instead of writing on every keystroke, and flushes on demand', () => {
    vi.useFakeTimers();
    try {
      setMemo('R0001', 'ら');
      setMemo('R0001', 'らく');
      setMemo('R0001', 'らくさ');
      expect(stored(s)).toEqual({});             // nothing written yet
      expect(getEntry('R0001').m).toBe('らくさ');  // but it is not lost either
      vi.advanceTimersByTime(TYPING_SAVE_MS + 1);
      expect(stored(s).R0001.m).toBe('らくさ');
    } finally { vi.useRealTimers(); }
  });

  it('flush() persists a pending edit — the tab can close before the debounce', () => {
    vi.useFakeTimers();
    try {
      setAmount('R0001', '180');
      expect(stored(s)).toEqual({});
      flush();
      expect(stored(s).R0001.amt).toBe('180');
    } finally { vi.useRealTimers(); }
  });

  it('turns a failed write into a visible error rather than a silent loss', () => {
    const bad = fakeStorage();
    initPersonal({ storage: bad });
    bad.setItem = () => { throw new Error('QuotaExceededError'); };
    setVisited('R0001', true);
    const st = saveStatus();
    expect(st.writable).toBe(false);
    expect(st.error).toContain('書き出して');
    // The record is still in memory, so the export can still rescue it.
    expect(getEntry('R0001').v).toBe(1);
  });
});

// ============================================================
// EXPORT / IMPORT
// ============================================================
describe('書き出し', () => {
  beforeEach(() => { initPersonal({ storage: fakeStorage() }); });

  it('uses v9\'s envelope, one version up', () => {
    const out = buildExport({ R0001: { v: 1 } }, new Date(Date.UTC(2026, 7, 7, 12, 0, 0)));
    expect(out.app).toBe(EXPORT_APP);
    expect(out.app).toBe('kl-dining-ledger');
    expect(out.ver).toBe(10);
    expect(EXPORT_VER).toBe(10);
    expect(out.exported).toBe('2026-08-07T12:00:00.000Z');
    expect(out.data.R0001).toMatchObject({ v: 1 });
  });

  it('round-trips: export then import gives back exactly the same records', () => {
    setVisited('R0001', true, new Date(2026, 7, 7));
    setRepeat('R0001', 'a');
    setAmount('R0001', '180');
    setMemo('R0001', '一行目\n二行目');   // the multi-line memo D4 added
    toggleWant('R0002');
    const before = allEntries();

    const text = currentExportText();
    const back = parseImport(text, {});
    expect(back.ok).toBe(true);
    expect(back.data).toEqual(before);
    expect(back.stats.kept).toBe(2);
    expect(back.stats.unknown).toBe(0);
  });

  it('names the file by the day, so backups sort by themselves', () => {
    expect(exportFilename(new Date(2026, 7, 7))).toBe('mkd-dining-2026-08-07.json');
  });

  it('is readable rather than one long line', () => {
    expect(exportText({ R0001: { v: 1 } }, new Date()).split('\n').length).toBeGreaterThan(3);
  });
});

describe('読み込み', () => {
  // The ledger's own placeId → id table.
  const MAP = buildPlaceIdMap([
    { id: 'R0001', placeId: 'ChIJDewakan' },
    { id: 'R0004', placeId: 'ChIJakar' },
    { id: '', placeId: 'ChIJnoId' },
  ]);

  beforeEach(() => { initPersonal({ storage: fakeStorage() }); });

  it('builds the conversion table from the ledger, skipping rows with no id', () => {
    expect(MAP).toEqual({ ChIJDewakan: 'R0001', ChIJakar: 'R0004' });
  });

  it('converts a 台帳v9 backup (placeId keys, ver 9) into R#### records', () => {
    const v9 = JSON.stringify({
      app: 'kl-dining-ledger', ver: 9, exported: '2026-08-01T00:00:00.000Z',
      data: {
        ChIJDewakan: { w: 0, v: 1, vd: '2026-07-30', rv: 'a', m: 'よかった', amt: '790' },
        ChIJakar: { w: 1, v: 0, vd: '', rv: null, m: '', amt: '' },
      },
    });
    const r = parseImport(v9, MAP);
    expect(r.ok).toBe(true);
    expect(r.stats).toMatchObject({ total: 2, kept: 2, converted: 2, unknown: 0 });
    expect(r.data.R0001).toEqual({ w: 0, v: 1, vd: '2026-07-30', rv: 'a', m: 'よかった', amt: '790' });
    expect(r.data.R0004).toMatchObject({ w: 1, v: 0, rv: '' });
  });

  it('accepts a bare object with no envelope at all', () => {
    const r = parseImport('{"ChIJakar":{"v":1}}', MAP);
    expect(r.ok).toBe(true);
    expect(r.data.R0004.v).toBe(1);
  });

  it('accepts an already-converted file without converting anything', () => {
    const r = parseImport({ data: { R0001: { v: 1 } } }, MAP);
    expect(r.stats).toMatchObject({ kept: 1, converted: 0, unknown: 0 });
  });

  it('COUNTS the keys it could not place instead of dropping them in silence (v9 欠陥6)', () => {
    const r = parseImport({ ChIJakar: { v: 1 }, ChIJgone: { v: 1 }, ChIJalsogone: { w: 1 } }, MAP);
    expect(r.stats).toMatchObject({ total: 3, kept: 1, converted: 1, unknown: 2 });
    expect(r.stats.unknownKeys).toEqual(['ChIJgone', 'ChIJalsogone']);
    expect(importSummaryText(r.stats, 'merge')).toContain('このアプリに無い店 2件');
    expect(importSummaryText(r.stats, 'merge')).toContain('3件中 1件');
  });

  it('rejects an empty paste, junk text, an array and a non-object', () => {
    expect(parseImport('', MAP)).toMatchObject({ ok: false });
    expect(parseImport('   ', MAP).error).toContain('空');
    expect(parseImport('not json', MAP).error).toContain('JSON');
    expect(parseImport('[1,2,3]', MAP).ok).toBe(false);
    expect(parseImport('42', MAP).ok).toBe(false);
    expect(parseImport('null', MAP).ok).toBe(false);
  });

  it('merges field by field, the incoming file winning where it has a value', () => {
    const merged = mergeStores(
      { R0001: { v: 1, vd: '2026-07-01', m: 'もとの感想', amt: '100' } },
      { R0001: { m: '書き出しのほうの感想' }, R0002: { w: 1 } });
    expect(merged.R0001).toMatchObject({ v: 1, vd: '2026-07-01', m: '書き出しのほうの感想', amt: '100' });
    expect(merged.R0002.w).toBe(1);
  });

  it('統合 only ADDS — a blank field in the file never erases what is here', () => {
    // A 台帳v9 backup carries only the fields that were ever touched, so its
    // blanks mean "nothing was recorded", not "set this to nothing". Erasing is
    // what 置き換え is for, and that one asks first.
    const merged = mergeStores(
      { R0001: { v: 1, vd: '2026-07-01', rv: 'a', m: '大事な感想', amt: '180' } },
      { R0001: { w: 1 } });
    expect(merged.R0001).toEqual({
      w: 1, v: 1, vd: '2026-07-01', rv: 'a', m: '大事な感想', amt: '180',
    });
  });

  it('統合 keeps what is not in the file; 置き換え does not', () => {
    toggleWant('R0002');
    mergeAll({ R0001: { v: 1 } });
    expect(Object.keys(allEntries()).sort()).toEqual(['R0001', 'R0002']);
    replaceAll({ R0001: { v: 1 } });
    expect(Object.keys(allEntries())).toEqual(['R0001']);
  });
});

describe('全消去', () => {
  it('empties the store and the storage together', () => {
    const s = fakeStorage();
    initPersonal({ storage: s });
    setVisited('R0001', true);
    expect(clearAll()).toBe(0);
    expect(allEntries()).toEqual({});
    expect(stored(s)).toEqual({});
  });
});

describe('記録の内訳（データビュー）', () => {
  it('counts what is in storage, per field', () => {
    initPersonal({ storage: fakeStorage() });
    setVisited('R0001', true);
    setAmount('R0001', '180');
    setMemo('R0001', 'よかった');
    setVisited('R0002', true);
    toggleWant('R0003');
    expect(storedCounts()).toEqual({ stores: 3, visited: 2, want: 1, memo: 1, amount: 1 });
  });

  it('does not count a whitespace-only memo as a memo', () => {
    initPersonal({ storage: fakeStorage() });
    setVisited('R0001', true);
    setMemo('R0001', '   ');
    expect(storedCounts().memo).toBe(0);
  });
});
