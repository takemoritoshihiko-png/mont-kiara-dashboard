// 控え（自動バックアップ）の契約（2026-08-16 竹森氏裁定）。
//
// 竹森氏の指示は「保存ボタンを押さなければ保存されない、ではなく、書き込む
// ごとに常にオート保存され、そして自動的にバックアップを取る」。
// 押す操作がゼロになる＝**取り忘れは全部こちらの責任**なので、いつ取るか・
// 何を残すかを純関数に切り出し、ここで固定する。
//
// あわせて、消える経路（全消去・まるごと置き換え）が必ず控えを通ることを
// personal.js の実物で検査する。ここが抜けると「押し間違えたら終わり」に戻る。
import { describe, it, expect, beforeEach } from 'vitest';
import {
  addSnapshot, needsDaily, snapLabel, serializeSnapshots, parseSnapshots,
  isSnapshot, findSnapshot, snapId, SNAP_KEEP_DAILY, SNAP_UNDO, SNAP_DAILY,
} from '../src/domain/snapshots.js';
import {
  initPersonal, setVisited, setMemo, clearAll, replaceAll, listSnapshots,
  restoreSnapshot, storedCounts, STORAGE_KEY, SNAPSHOT_KEY,
} from '../src/data/personal.js';

const snap = (kind, at, count = 1, json = '{"R0001":{"v":1}}') => ({
  kind, at, date: at.slice(0, 10), count, json,
});

describe('addSnapshot — いつ何を残すか', () => {
  it('undo は常に1件だけ（2件あると「どっちの直前？」になる）', () => {
    let list = [];
    list = addSnapshot(list, snap(SNAP_UNDO, '2026-08-16T01:00:00.000Z'));
    list = addSnapshot(list, snap(SNAP_UNDO, '2026-08-16T02:00:00.000Z'));
    const undos = list.filter(s => s.kind === SNAP_UNDO);
    expect(undos).toHaveLength(1);
    expect(undos[0].at).toBe('2026-08-16T02:00:00.000Z');   // 新しい方が残る
  });

  it('undo は一覧の先頭に来る（「直前に戻す」がいちばん上）', () => {
    let list = addSnapshot([], snap(SNAP_DAILY, '2026-08-15T01:00:00.000Z'));
    list = addSnapshot(list, snap(SNAP_UNDO, '2026-08-16T01:00:00.000Z'));
    expect(list[0].kind).toBe(SNAP_UNDO);
  });

  it('daily は同じ日に2つ作らない（その日の最初の姿＝前日までの姿を守る）', () => {
    let list = addSnapshot([], snap(SNAP_DAILY, '2026-08-16T01:00:00.000Z', 5));
    list = addSnapshot(list, snap(SNAP_DAILY, '2026-08-16T09:00:00.000Z', 99));
    expect(list.filter(s => s.kind === SNAP_DAILY)).toHaveLength(1);
    expect(list[0].count).toBe(5);   // 上書きされていない
  });

  it('daily は7世代まで。古いものから落ちる', () => {
    let list = [];
    for(let d = 1; d <= 10; d++){
      const at = `2026-08-${String(d).padStart(2, '0')}T01:00:00.000Z`;
      list = addSnapshot(list, snap(SNAP_DAILY, at, d));
    }
    const daily = list.filter(s => s.kind === SNAP_DAILY);
    expect(daily).toHaveLength(SNAP_KEEP_DAILY);
    expect(daily[0].date).toBe('2026-08-10');                 // 新しい順
    expect(daily.map(s => s.date)).not.toContain('2026-08-01'); // 古いものは落ちた
  });

  it('undo は daily の剪定に巻き込まれない', () => {
    let list = addSnapshot([], snap(SNAP_UNDO, '2026-08-01T01:00:00.000Z'));
    for(let d = 1; d <= 10; d++){
      list = addSnapshot(list, snap(SNAP_DAILY, `2026-08-${String(d).padStart(2, '0')}T02:00:00.000Z`));
    }
    expect(list.filter(s => s.kind === SNAP_UNDO)).toHaveLength(1);
  });

  it('元の配列を書き換えない（保存に失敗しても手元が壊れない）', () => {
    const before = [snap(SNAP_DAILY, '2026-08-15T01:00:00.000Z')];
    const copy = JSON.parse(JSON.stringify(before));
    addSnapshot(before, snap(SNAP_UNDO, '2026-08-16T01:00:00.000Z'));
    expect(before).toEqual(copy);
  });

  it('壊れた要素は静かに落とす（一覧が読めなくなるより良い）', () => {
    const list = addSnapshot([null, { kind: 'x' }, snap(SNAP_DAILY, '2026-08-15T01:00:00.000Z')],
      snap(SNAP_UNDO, '2026-08-16T01:00:00.000Z'));
    expect(list.every(isSnapshot)).toBe(true);
  });
});

describe('needsDaily — その日の控えをまだ取っていないか', () => {
  it('その日の daily が無ければ true', () => {
    expect(needsDaily([snap(SNAP_DAILY, '2026-08-15T01:00:00.000Z')], '2026-08-16')).toBe(true);
  });
  it('あれば false', () => {
    expect(needsDaily([snap(SNAP_DAILY, '2026-08-16T01:00:00.000Z')], '2026-08-16')).toBe(false);
  });
  it('undo は daily の代わりにならない', () => {
    expect(needsDaily([snap(SNAP_UNDO, '2026-08-16T01:00:00.000Z')], '2026-08-16')).toBe(true);
  });
});

describe('見出しと保存形式', () => {
  it('今日のぶんは時刻まで、それ以外は日付だけ（一覧を読みやすく）', () => {
    expect(snapLabel(snap(SNAP_DAILY, '2026-08-14T01:00:00.000Z', 8), '2026-08-16'))
      .toBe('2026-08-14 ・ 自動（8店）');
  });

  // 実画面で「10:00に消したのに 02:00 と出る」を確認した（ISOはUTC）。
  // 台帳v9の欠陥1（訪問日をUTCで採る）と同じ型なので、時刻は現地で出す。
  it('時刻は現地時間で出す（UTCの文字列を切り出さない）', () => {
    const at = '2026-08-16T09:41:00.000Z';
    const d = new Date(at);
    const p = n => String(n).padStart(2, '0');
    const local = `${p(d.getHours())}:${p(d.getMinutes())}`;
    expect(snapLabel(snap(SNAP_UNDO, at, 12), '2026-08-16'))
      .toBe(`今日 ${local} ・ 消す直前（12店）`);
    // UTCと現地がずれる地域では、素朴な文字列切り出しと一致しない
    if(d.getTimezoneOffset() !== 0) expect(local).not.toBe('09:41');
  });

  it('壊れた保存文字列でも例外を投げない（記録本体を巻き添えにしない）', () => {
    for(const bad of ['', 'null', '{', '{"a":1}', '[1,2,3]', undefined]){
      expect(() => parseSnapshots(bad)).not.toThrow();
      expect(parseSnapshots(bad)).toEqual([]);
    }
  });

  it('書いて読んで、同じものが戻る', () => {
    const list = addSnapshot([], snap(SNAP_UNDO, '2026-08-16T01:00:00.000Z', 3));
    expect(parseSnapshots(serializeSnapshots(list))).toEqual(list);
  });

  it('id は種類と時刻から決まる（保存に別フィールドを持たない）', () => {
    const s = snap(SNAP_UNDO, '2026-08-16T01:00:00.000Z');
    expect(snapId(s)).toBe('undo-2026-08-16T01:00:00.000Z');
    expect(findSnapshot([s], snapId(s))).toBe(s);
    expect(findSnapshot([s], 'ない')).toBe(null);
  });
});

// ---- 実物の personal.js で、消える経路が必ず控えを通ることを確かめる ----

function fakeStorage(){
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    _map: m,
  };
}

describe('消える経路は必ず控えを通る', () => {
  let storage;
  beforeEach(() => {
    storage = fakeStorage();
    initPersonal({ storage });
  });

  it('全消去の直前に、消える前の姿が控えに入る', () => {
    setVisited('R0001', true);
    setMemo('R0002', 'おいしかった');
    expect(storedCounts().stores).toBe(2);
    clearAll();
    expect(storedCounts().stores).toBe(0);
    const undo = listSnapshots().find(s => s.kind === SNAP_UNDO);
    expect(undo, '控えが取られていない').toBeTruthy();
    expect(undo.count).toBe(2);
  });

  it('控えから戻すと、消した記録がそのまま返る', () => {
    setVisited('R0001', true);
    setMemo('R0002', 'x');
    clearAll();
    const undo = listSnapshots().find(s => s.kind === SNAP_UNDO);
    expect(restoreSnapshot(undo.id)).toBe(2);
    expect(storedCounts().stores).toBe(2);
  });

  it('戻したあとも往復できる（戻す前の姿も控えに入る）', () => {
    setVisited('R0001', true);
    clearAll();
    restoreSnapshot(listSnapshots().find(s => s.kind === SNAP_UNDO).id);
    expect(storedCounts().stores).toBe(1);
    const back = listSnapshots().find(s => s.kind === SNAP_UNDO);
    expect(back.count).toBe(0);              // 空だった時点が控えられている
    expect(restoreSnapshot(back.id)).toBe(0);
  });

  it('まるごと置き換えの直前にも控えが入る（クラウド復元も同じ口を通る）', () => {
    setVisited('R0001', true);
    replaceAll({ R0009: { v: 1 } });
    const undo = listSnapshots().find(s => s.kind === SNAP_UNDO);
    expect(undo.count).toBe(1);
    expect(storedCounts().stores).toBe(1);
    restoreSnapshot(undo.id);
    expect(JSON.parse(storage.getItem(STORAGE_KEY))).toHaveProperty('R0001');
  });

  it('記録が空のときは控えを積まない（空の控えは一覧を嘘にする）', () => {
    clearAll();
    expect(listSnapshots()).toHaveLength(0);
  });

  it('控えは記録本体とは別のキーに入る（全消去に巻き込まれない）', () => {
    setVisited('R0001', true);
    clearAll();
    expect(storage.getItem(SNAPSHOT_KEY)).toBeTruthy();
    expect(JSON.parse(storage.getItem(STORAGE_KEY))).toEqual({});
  });

  it('無い控えを指定しても落ちず、記録も変わらない', () => {
    setVisited('R0001', true);
    expect(restoreSnapshot('undo-ない')).toBe(null);
    expect(storedCounts().stores).toBe(1);
  });

  it('控えが保存できなくても、記録本体の保存は続く', () => {
    const s = fakeStorage();
    const realSet = s.setItem;
    s.setItem = (k, v) => { if(k === SNAPSHOT_KEY) throw new Error('QuotaExceeded'); realSet(k, v); };
    initPersonal({ storage: s });
    setVisited('R0001', true);
    expect(() => clearAll()).not.toThrow();
    expect(JSON.parse(s.getItem(STORAGE_KEY))).toEqual({});
  });
});
