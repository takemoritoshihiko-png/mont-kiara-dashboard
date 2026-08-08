// ファイルDB（A案 2026-08-08）の判断ロジック契約。
// 原則: どの分岐でも「無言でどちらかの記録を失う」結末が存在しないこと。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  RECORDS_FILENAME, BACKUP_DIR, BACKUP_KEEP, FILE_WRITE_MS,
  backupName, backupStamp, pruneBackups, reconcile, preWriteCheck,
  readEnvelope, stableStringify,
} from '../src/domain/fileSync.js';

describe('constants', () => {
  it('names and knobs are what the spec promised', () => {
    expect(RECORDS_FILENAME).toBe('dining-records.json');
    expect(BACKUP_DIR).toBe('backups');
    expect(BACKUP_KEEP).toBe(7);
    expect(FILE_WRITE_MS).toBeGreaterThanOrEqual(250); // タイピングデバウンスより粗く
  });
});

describe('backup names', () => {
  it('builds and parses its own names round-trip', () => {
    expect(backupName('2026-08-08')).toBe('dining-records-20260808.json');
    expect(backupStamp('dining-records-20260808.json')).toBe('20260808');
  });
  it('refuses names it did not make (never deletes a stranger)', () => {
    for(const n of ['notes.txt', 'dining-records.json', 'dining-records-2026.json',
                    'dining-records-20260808.json.bak'])
      expect(backupStamp(n), n).toBeNull();
  });
  it('prunes only its own files, keeps the newest 7', () => {
    const names = [];
    for(let d = 1; d <= 10; d++) names.push(`dining-records-202608${String(d).padStart(2,'0')}.json`);
    names.push('README.md');            // ユーザーの置き物
    const doomed = pruneBackups(names, 7);
    expect(doomed).toEqual([
      'dining-records-20260803.json', 'dining-records-20260802.json', 'dining-records-20260801.json',
    ]);
    expect(doomed).not.toContain('README.md');
  });
  it('prunes nothing when at or below the keep count', () => {
    expect(pruneBackups(['dining-records-20260801.json'], 7)).toEqual([]);
  });
});

describe('reconcile — 起動時にどちらを正とするか', () => {
  const S = '2026-08-08T00:00:00.000Z';
  it('file missing/empty, cache has data → adopt-cache（初接続）', () => {
    expect(reconcile({ cacheCount: 5, fileCount: null, fileStamp: null, lastWritten: null })).toBe('adopt-cache');
    expect(reconcile({ cacheCount: 5, fileCount: 0, fileStamp: S, lastWritten: null })).toBe('adopt-cache');
  });
  it('both empty → noop', () => {
    expect(reconcile({ cacheCount: 0, fileCount: null, fileStamp: null, lastWritten: null })).toBe('noop');
  });
  it('cache empty, file has data → restore-from-file（新PC・ブラウザ掃除後）', () => {
    expect(reconcile({ cacheCount: 0, fileCount: 12, fileStamp: S, lastWritten: null })).toBe('restore-from-file');
  });
  it('same content → noop（何も動かさない）', () => {
    expect(reconcile({ cacheCount: 3, fileCount: 3, fileStamp: S, lastWritten: null, sameData: true })).toBe('noop');
  });
  it('file is my own last write, cache moved on → adopt-cache（自分の続き）', () => {
    expect(reconcile({ cacheCount: 4, fileCount: 3, fileStamp: S, lastWritten: S })).toBe('adopt-cache');
  });
  it('both changed independently → conflict（人に選ばせる。無言で潰さない）', () => {
    expect(reconcile({ cacheCount: 4, fileCount: 5, fileStamp: '2026-08-08T09:00:00.000Z', lastWritten: S })).toBe('conflict');
    // 控えが無い（ブラウザ掃除でメタだけ消えた）のに両側にデータ → これも conflict
    expect(reconcile({ cacheCount: 4, fileCount: 5, fileStamp: S, lastWritten: null })).toBe('conflict');
  });
});

describe('preWriteCheck — 書く直前の指差し確認', () => {
  const S = '2026-08-08T00:00:00.000Z';
  it('writes over its own stamp or a missing file', () => {
    expect(preWriteCheck({ fileStamp: S, lastWritten: S })).toBe('write');
    expect(preWriteCheck({ fileStamp: null, lastWritten: S })).toBe('write');
    expect(preWriteCheck({ fileStamp: S, lastWritten: null })).toBe('write');
  });
  it('halts on a stranger stamp', () => {
    expect(preWriteCheck({ fileStamp: '2026-08-08T09:00:00.000Z', lastWritten: S })).toBe('conflict');
  });
});

describe('readEnvelope / stableStringify', () => {
  it('reads the export envelope, tolerates garbage', () => {
    const env = readEnvelope(JSON.stringify({ app: 'kl-dining-ledger', ver: 10,
      exported: '2026-08-08T01:02:03.000Z', data: { R0001: { v: 1 } } }));
    expect(env).toEqual({ stamp: '2026-08-08T01:02:03.000Z', count: 1 });
    expect(readEnvelope('not json')).toBeNull();
    expect(readEnvelope('{"no":"data"}')).toBeNull();
  });
  it('stableStringify is key-order independent (the sameData comparator)', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } }))
      .toBe(stableStringify({ a: { c: 3, d: 2 }, b: 1 }));
    expect(stableStringify({ a: 1 })).not.toBe(stableStringify({ a: 2 }));
  });
});

describe('配線の契約（ソース）', () => {
  const dining = readFileSync(new URL('../src/ui/dining.js', import.meta.url), 'utf8');
  const personal = readFileSync(new URL('../src/data/personal.js', import.meta.url), 'utf8');
  const fileStore = readFileSync(new URL('../src/data/fileStore.js', import.meta.url), 'utf8');
  it('personal.js は fileStore を知らない（単一ドアのまま・購読方式）', () => {
    expect(personal).not.toContain('fileStore');
  });
  it('fileStore の復元は personal の既存ドア(replaceAll)越しにだけ書く', () => {
    // fileStore 自身は localStorage の記録キーに触らない（メタキーのみ）
    expect(fileStore).not.toContain('mkd_dining_personal_v1');
    expect(dining).toContain('P.replaceAll(res.data)');
  });
  it('競合UIは「読み込む」と「上書き」の両方を必ず差し出す', () => {
    expect(dining).toContain('dineFileAdoptFile');
    expect(dining).toContain('dineFileAdoptCache');
  });
});
