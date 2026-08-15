// Contract for two overlay bugs found in a real screen walk (2026-08-16):
//
// X1  訪問済み等を押しても、開いている詳細オーバーレイの表示が変わらない。
//     dineVisit/dineWant/dineRepeat/dineHide は applyFilters() しか起こさず、
//     renderInfo() を呼ぶのは setInfoTab と selectCondo だけだった。
// X2  外食モードのまま周辺タブから学校/商業/物件を選ぶと、setLayer が appMode
//     を見ずに層だけ切り替え、見出しは「外食台帳」のまま一覧が別種別になる。
//
// info.js renders straight into `document` and drives src/ui/map.js (Leaflet,
// browser-only), so this file wires the same minimal fake DOM the toast test
// in test/eatoutMode.test.js uses, and stubs map.js entirely — neither bug
// touches the map itself.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  setCondos, setAppMode, setActiveLayer, setHomeLayer, setListView,
  appMode, activeLayer, listView,
} from '../src/state.js';
import { initPersonal, getEntry } from '../src/data/personal.js';
import { setOnPersonalChange, dineVisit, eatoutActive } from '../src/ui/dining.js';
import { applyFilters } from '../src/ui/list.js';
import { parseRestaurants } from '../src/data/load.js';
import { calcLedgerScores } from '../src/domain/diningScore.js';
import { selectCondo, selectNearby, closeInfo, refreshInfoIfOpen } from '../src/ui/info.js';

vi.mock('../src/ui/map.js', () => ({
  map: null,
  rebuild: () => {},
  focusOnRecord: () => {},
}));

const LEDGER = parseRestaurants(readFileSync(new URL('../restaurants.json', import.meta.url), 'utf8'));
calcLedgerScores(LEDGER);
const DEWAKAN = LEDGER.find(r => r.name === 'Dewakan');

const SCHOOL = {
  name: 'Sample International School', nameJa: '', addr: 'Mont Kiara',
  status: 'school', year: 2000, units: 500, sizeMin: 30000, sizeMax: 60000,
  ageRange: '3-18', curriculum: 'IB', lat: 3.18, lng: 101.66,
};

function memoryStorage(){
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, v), removeItem: (k) => map.delete(k) };
}

/** Minimal fake DOM: enough for selectCondo/selectNearby/applyFilters to run
 *  without a browser. Unknown ids auto-vivify into a generic mutable node
 *  (list.js's updateSummary() writes to several tile ids unconditionally,
 *  with no `if(el)` guard) — 'condoList' stays null on purpose so renderList()
 *  takes its early-return branch and never has to render a real card list. */
function makeNode(){
  const classes = new Set();
  return {
    innerHTML: '', textContent: '', value: '', style: {}, dataset: {}, attrs: {},
    classList: {
      add: (...cs) => cs.forEach(c => classes.add(c)),
      remove: (...cs) => cs.forEach(c => classes.delete(c)),
      toggle(c, on){ const next = on === undefined ? !classes.has(c) : !!on; next ? classes.add(c) : classes.delete(c); return next; },
      contains: (c) => classes.has(c),
    },
    setAttribute(k, v){ this.attrs[k] = String(v); },
    getAttribute(k){ return this.attrs[k]; },
    querySelector: () => null,
    querySelectorAll: () => [],
    appendChild(){}, scrollIntoView(){},
  };
}

function makeFakeDocument(){
  const registry = new Map();
  return {
    activeElement: null,
    getElementById(id){
      if(id === 'condoList') return null;
      if(!registry.has(id)) registry.set(id, makeNode());
      return registry.get(id);
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => makeNode(),
    head: { appendChild(){} },
  };
}

beforeEach(() => {
  globalThis.document = makeFakeDocument();
  initPersonal({ storage: memoryStorage() });
  setCondos([DEWAKAN, SCHOOL]);
  setOnPersonalChange(() => {});
});

afterEach(() => {
  closeInfo();
  delete globalThis.document;
});

// ============================================================
// X1 — 個人記録の変更が、開いているオーバーレイに反映される
// ============================================================
describe('X1: 訪問済みを押すと開いているオーバーレイが描き直る', () => {
  beforeEach(() => {
    setAppMode('eatout');
    setActiveLayer('dining');
  });

  it('オーバーレイを開いた直後は未訪問の表示', () => {
    selectCondo(DEWAKAN.name);
    const html = document.getElementById('infoContent').innerHTML;
    expect(html).toContain('>訪問済み<');
    expect(html).not.toContain('>✓ 訪問済み<');
  });

  it('本番と同じ配線（setOnPersonalChange→applyFilters+refreshInfoIfOpen）で、dineVisit後に✓と記録欄が出る', () => {
    // main.js が実際に張る配線をそのまま再現する。
    setOnPersonalChange(() => { applyFilters(); refreshInfoIfOpen(); });
    selectCondo(DEWAKAN.name);
    dineVisit(DEWAKAN.id);
    expect(getEntry(DEWAKAN.id).v).toBe(1); // 保存はされている
    const html = document.getElementById('infoContent').innerHTML;
    expect(html).toContain('>✓ 訪問済み<');
    expect(html).toContain('また行きたい？');
  });

  it('もう一度押しても消えない（旧バグ: 2回目でv:0に戻り、表示は変わらないまま）', () => {
    setOnPersonalChange(() => { applyFilters(); refreshInfoIfOpen(); });
    selectCondo(DEWAKAN.name);
    dineVisit(DEWAKAN.id);
    dineVisit(DEWAKAN.id);
    expect(getEntry(DEWAKAN.id).v).toBe(0);
    const html = document.getElementById('infoContent').innerHTML;
    expect(html).not.toContain('>✓ 訪問済み<');
    expect(html).toContain('>訪問済み<');
  });

  it('オーバーレイが閉じているときは何もしない（無選択でrenderInfoを呼ばない）', () => {
    setOnPersonalChange(() => { applyFilters(); refreshInfoIfOpen(); });
    closeInfo();
    expect(() => dineVisit(DEWAKAN.id)).not.toThrow();
  });

  it('感想欄/実額欄にフォーカス中は再描画を見送る（入力が中断されない）', () => {
    selectCondo(DEWAKAN.name);
    document.activeElement = { tagName: 'TEXTAREA', id: `memo-info-${DEWAKAN.id}` };
    const before = document.getElementById('infoContent').innerHTML;
    dineVisit(DEWAKAN.id); // setOnPersonalChange は空({}) のまま = refreshInfoIfOpen を直接呼ぶ
    refreshInfoIfOpen();
    expect(document.getElementById('infoContent').innerHTML).toBe(before);
  });

  it('フォーカスが外れれば通常どおり再描画する', () => {
    selectCondo(DEWAKAN.name);
    document.activeElement = null;
    dineVisit(DEWAKAN.id);
    refreshInfoIfOpen();
    expect(document.getElementById('infoContent').innerHTML).toContain('>✓ 訪問済み<');
  });
});

// ============================================================
// X2 — 外食モードのまま周辺タブから飲食以外を選んでも迷子にならない
// ============================================================
describe('X2: 外食モードで周辺の学校/商業/物件を選ぶと住まいモードへ移る', () => {
  beforeEach(() => {
    setAppMode('eatout');
    setActiveLayer('dining');
    setHomeLayer('condo');
    setListView('ledger');
  });

  it('旧バグ再現: 層だけ変わってモードが外食のまま迷子になっていた（回帰防止）', () => {
    selectNearby(SCHOOL.name);
    // 修正後は appMode も揃って home になっている——旧バグは activeLayer だけ
    // 'school' になり appMode は 'eatout' のままだった。
    expect(appMode).toBe('home');
  });

  it('層は選んだ店のものに変わる', () => {
    selectNearby(SCHOOL.name);
    expect(activeLayer).toBe('school');
  });

  it('選んだ店自体が開く', () => {
    selectNearby(SCHOOL.name);
    const html = document.getElementById('infoContent').innerHTML;
    expect(html).toContain(SCHOOL.name);
  });

  it('住まいモードへ移ったので個人記録UIは出ない（モード分離契約を保つ）', () => {
    selectNearby(SCHOOL.name);
    expect(eatoutActive()).toBe(false);
  });

  it('飲食どうしの周辺移動はモードを変えない（既存動作の保持）', () => {
    setCondos([DEWAKAN, SCHOOL, { ...DEWAKAN, id: 'R9999', name: 'Another Bistro', status: 'dining' }]);
    selectNearby('Another Bistro');
    expect(appMode).toBe('eatout');
    expect(activeLayer).toBe('dining');
  });
});
