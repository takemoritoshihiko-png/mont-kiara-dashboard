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
import { applyFilters, setMode, setView } from '../src/ui/list.js';
import { parseRestaurants } from '../src/data/load.js';
import { calcLedgerScores } from '../src/domain/diningScore.js';
import { selectCondo, selectNearby, closeInfo, refreshInfoIfOpen } from '../src/ui/info.js';

vi.mock('../src/ui/map.js', () => ({
  map: null,
  rebuild: () => {},
  focusOnRecord: () => {},
}));

const LEDGER = parseRestaurants(readFileSync(new URL('../restaurants.json', import.meta.url), 'utf8').replace(/\r\n/g, '\n'));
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
    focus(){ document.activeElement = this; },
    contains(node){ return node === this; },
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

it('別の対象を開くと、以前読んでいた詳細のスクロール位置を引き継がない', () => {
  setAppMode('home');
  selectCondo(DEWAKAN.name);
  document.getElementById('infoOverlay').scrollTop = 800;
  selectCondo(SCHOOL.name);
  expect(document.getElementById('infoOverlay').scrollTop).toBe(0);
});

it('外食の詳細を開いてから住まいへ切り替えると、個人記録の詳細を閉じる', () => {
  setAppMode('eatout');
  setActiveLayer('dining');
  setHomeLayer('condo');
  selectCondo(DEWAKAN.name);
  expect(document.getElementById('infoContent').innerHTML).toContain('わたしの記録');
  setMode('home');
  expect(document.getElementById('infoOverlay').classList.contains('active')).toBe(false);
});

it('詳細からデータ管理へ進むと、詳細を閉じて管理画面を操作できる', () => {
  setAppMode('eatout');
  setActiveLayer('dining');
  setListView('ledger');
  selectCondo(DEWAKAN.name);
  setView('data');
  expect(listView).toBe('data');
  expect(document.getElementById('infoOverlay').classList.contains('active')).toBe(false);
});

it('除名した店を古いリンクから選んでも詳細を開かない', () => {
  setAppMode('home');
  setActiveLayer('condo');
  setCondos([{ ...DEWAKAN, delisted: true }]);
  selectCondo(DEWAKAN.name);
  expect(document.getElementById('infoOverlay').classList.contains('active')).toBe(false);
  expect(document.getElementById('infoContent').innerHTML).not.toContain(DEWAKAN.name);
});

const PUBLIC_EVIDENCE = {
  checkedAt: '2026-10-22',
  dishes: [{ name: '香りのある麺 <script>', basis: '公式メニューに掲載', sourceUrls: ['https://example.com/menu'] }],
  tasteEvidence: { positive: '料理の根拠', caution: '味の不満は未確認', limits: '直近の実食評価は未取得' },
  visitNote: '来店前に営業日を確認',
  sources: [{ title: '公式メニュー', url: 'https://example.com/menu', kind: 'official', publishedAt: null, checkedAt: '2026-10-22' }],
  identityNotes: '対象支店を確認', sourceCoverage: '公式案内のみ',
};

it('料理の根拠を読込から詳細まで保ち、確認日と記事日を区別して表示する', () => {
  const recs = parseRestaurants(JSON.stringify([{ ...DEWAKAN, diningEvidence: PUBLIC_EVIDENCE }]));
  setCondos(recs);
  setAppMode('home');
  selectCondo(DEWAKAN.name);
  const detail = document.getElementById('infoContent').innerHTML;
  expect(detail).toContain('香りのある麺 &lt;script&gt;');
  expect(detail).not.toContain('香りのある麺 <script>');
  expect(detail).toContain('https://example.com/menu');
  expect(detail).toContain('情報確認: 2026-10-22');
  expect(detail).toContain('公表日不明');
  expect(detail).toContain('直近の実食評価は未取得');
  expect(detail).not.toContain('わたしの記録');
});

it('危険な出典リンクをデータ読込境界で拒否する', () => {
  const bad = structuredClone(PUBLIC_EVIDENCE);
  bad.sources[0].url = 'javascript:alert(1)';
  expect(() => parseRestaurants(JSON.stringify([{ ...DEWAKAN, diningEvidence: bad }]))).toThrow(/出典URL/);
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

  it.each([true, false])('詳細の再描画で旧ボタンを失っても、操作位置と閉じた後の復帰を保つ（対応ボタン=%s）', (hasReplacement) => {
    selectCondo(DEWAKAN.name);
    const overlay = document.getElementById('infoOverlay');
    const content = document.getElementById('infoContent');
    const oldButton = makeNode();
    const newButton = makeNode();
    oldButton.setAttribute('onclick', `dineVisit('${DEWAKAN.id}')`);
    newButton.setAttribute('onclick', oldButton.getAttribute('onclick'));
    overlay.contains = node => [overlay, oldButton, newButton].includes(node);
    overlay.querySelectorAll = () => hasReplacement ? [newButton] : [];
    let html = content.innerHTML;
    Object.defineProperty(content, 'innerHTML', {
      get: () => html,
      set: value => { html = value; document.activeElement = null; },
    });
    oldButton.focus();
    refreshInfoIfOpen();
    expect(document.activeElement).toBe(hasReplacement ? newButton : overlay);
    closeInfo();
    expect(document.activeElement).toBe(document.getElementById('fSearch'));
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
