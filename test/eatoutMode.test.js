// Contract for 外食モード (D4) — the mode itself, its filters, its sort and the
// one rule that matters most: **住まいモード never shows a personal record.**
//
// The site is public. Anyone who opens the link is in 住まいモード, and if a
// single visit tick or memo leaked into that half of the app it would be
// published. That separation is enforced in exactly one place (`eatoutActive()`
// guarding every builder in src/ui/dining.js) and asserted from both sides here.
//
// The renderers are exercised through their real DOM-free path: they read
// src/state.js and src/data/personal.js, both of which are injectable or
// settable, so no browser is needed.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  matchesDining, matchesFilters, VENUE_TYPES,
} from '../src/domain/filter.js';
import { sortOptionsFor, defaultSortFor, sortAvailable, sortRecords } from '../src/domain/sort.js';
import { setAppMode, setListView, setRestaurants, setCondos } from '../src/state.js';
import { initPersonal, setVisited, toggleWant, setRepeat, setAmount, setMemo, getEntry, setHidden } from '../src/data/personal.js';
import {
  eatoutActive, eatoutCardExtraHtml, eatoutCardScoreHtml, eatoutDetailHtml,
  eatoutListHtml, visitBoxHtml, scoreBlockHtml, isVisited, PRIVACY_TEXT, totalOf,
  dineVisit,
} from '../src/ui/dining.js';
import { cardHtml, cardBodyHtml } from '../src/ui/list.js';
import { detailHtml } from '../src/ui/info.js';
import { parseRestaurants } from '../src/data/load.js';
import { calcLedgerScores } from '../src/domain/diningScore.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const body = html.slice(html.indexOf('<body>'));
const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));

const LEDGER = parseRestaurants(readFileSync(new URL('../restaurants.json', import.meta.url), 'utf8'));
// main.js stamps the score the moment the JSON lands; the sort comparator reads
// what was stamped, so the test has to boot the same way.
calcLedgerScores(LEDGER);
const DEWAKAN = LEDGER.find(r => r.name === 'Dewakan');

function memoryStorage(){
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, v), removeItem: (k) => map.delete(k) };
}

/** Put the module-level state into a known shape for one test. */
function setup({ mode = 'home', view = 'ledger' } = {}){
  initPersonal({ storage: memoryStorage() });
  setRestaurants(LEDGER);
  setCondos(LEDGER);
  setAppMode(mode);
  setListView(view);
}

beforeEach(() => setup());

// ============================================================
// THE SEPARATION
// ============================================================
describe('住まいモード shows no personal record, anywhere', () => {
  it('builds nothing from any of the record builders', () => {
    setup({ mode: 'home' });
    setVisited(DEWAKAN.id, true);
    setMemo(DEWAKAN.id, '内緒の感想');
    expect(eatoutActive()).toBe(false);
    expect(eatoutCardExtraHtml(DEWAKAN)).toBe('');
    expect(eatoutCardScoreHtml(DEWAKAN)).toBe('');
    expect(eatoutDetailHtml(DEWAKAN)).toBe('');
    expect(eatoutListHtml()).toBeNull();
  });

  it('leaves the memo out of the card and the detail panel', () => {
    setup({ mode: 'home' });
    setVisited(DEWAKAN.id, true);
    setMemo(DEWAKAN.id, '内緒の感想');
    expect(cardHtml(DEWAKAN)).not.toContain('内緒の感想');
    expect(cardHtml(DEWAKAN)).not.toContain('visitbox');
    expect(detailHtml(DEWAKAN)).not.toContain('内緒の感想');
    expect(detailHtml(DEWAKAN)).not.toContain('わたしの記録');
  });

  it('never puts the record UI on a condo, a school or a shop — even in 外食モード', () => {
    setup({ mode: 'eatout' });
    const condo = { name: 'Seni Mont Kiara', status: 'completed', luxTier: 'S' };
    const school = { name: 'Alice Smith', status: 'school' };
    for(const r of [condo, school]){
      expect(eatoutCardExtraHtml(r)).toBe('');
      expect(eatoutDetailHtml(r)).toBe('');
    }
  });
});

// ============================================================
// THE RECORD BOX
// ============================================================
describe('記録欄', () => {
  beforeEach(() => setup({ mode: 'eatout' }));

  it('offers only the two toggles until a place has been visited', () => {
    const h = visitBoxHtml(DEWAKAN);
    expect(h).toContain('dineVisit');
    expect(h).toContain('dineWant');
    expect(h).not.toContain('dineRepeat');
    expect(h).not.toContain('<textarea');
  });

  it('opens the visit fields once 訪問済み is on', () => {
    setVisited(DEWAKAN.id, true, new Date(2026, 7, 7));
    const h = visitBoxHtml(DEWAKAN);
    // 2026-08-16: 訪問日は読み取り専用の行から日付入力になった（後から直せる）。
    expect(h).toContain('type="date"');
    expect(h).toContain('value="2026-08-07"');
    expect(h).toContain('また行きたい？');
    for(const label of ['また行く', '機会があれば', 'もういい']) expect(h).toContain(label);
    expect(h).toContain('inputmode="decimal"');
    expect(h).toContain('<textarea');
  });

  it('makes 感想 a multi-line textarea, not v9\'s one-line input', () => {
    setVisited(DEWAKAN.id, true);
    const h = visitBoxHtml(DEWAKAN);
    expect(h).toMatch(/<textarea[^>]*class="vb-memo"/);
    expect(h).toMatch(/<textarea[^>]*rows="3"/);
  });

  it('keeps the fields filled in from what was saved', () => {
    setVisited(DEWAKAN.id, true, new Date(2026, 7, 7));
    setRepeat(DEWAKAN.id, 'a');
    setAmount(DEWAKAN.id, '790');
    setMemo(DEWAKAN.id, '一行目\n二行目');
    const h = visitBoxHtml(DEWAKAN);
    expect(h).toContain('value="790"');
    expect(h).toContain('一行目\n二行目');
    expect(h).toContain('class="vb-rv-btn rv-a on" aria-pressed="true"');
  });

  it('says pressed / not pressed on every toggle', () => {
    const off = visitBoxHtml(DEWAKAN);
    expect(off.match(/aria-pressed="false"/g)).toHaveLength(2);
    toggleWant(DEWAKAN.id);
    expect(visitBoxHtml(DEWAKAN)).toContain('class="vb-toggle vb-want on" aria-pressed="true"');
  });

  it('keeps each toggle\'s NAME fixed — .on and aria-pressed carry the state', () => {
    // 「訪問済みにする」⇄「✓ 訪問済み」 renamed the control on press, so the
    // word could be read either as what is true now or as what pressing would
    // do. The name is now constant and only the mark and the colour move.
    const off = visitBoxHtml(DEWAKAN);
    expect(off).toContain('>訪問済み<');
    expect(off).not.toContain('訪問済みにする');
    setVisited(DEWAKAN.id, true);
    expect(visitBoxHtml(DEWAKAN)).toContain('>✓ 訪問済み<');
  });

  it('gives 行きたい a heart, because ★ belongs to the Google rating', () => {
    const off = visitBoxHtml(DEWAKAN);
    expect(off).toContain('>♡ 行きたい<');
    expect(off).not.toContain('☆');
    toggleWant(DEWAKAN.id);
    expect(visitBoxHtml(DEWAKAN)).toContain('>♥ 行きたい<');
    // …and the star still means one thing only, on the rating line.
    expect(visitBoxHtml(DEWAKAN)).not.toContain('★');
  });

  it('escapes what the user typed instead of letting it become markup', () => {
    setVisited(DEWAKAN.id, true);
    setMemo(DEWAKAN.id, '<img src=x onerror="alert(1)">');
    setAmount(DEWAKAN.id, '"><b>');
    const h = visitBoxHtml(DEWAKAN);
    expect(h).not.toContain('<img src=x');
    expect(h).toContain('&lt;img src=x');
    expect(h).toContain('value="&quot;&gt;&lt;b&gt;"');
  });

  it('gives every field a label that points at it, in each of the three places', () => {
    setVisited(DEWAKAN.id, true);
    for(const ctx of ['led', 'log', 'info']){
      const h = visitBoxHtml(DEWAKAN, ctx);
      for(const m of h.matchAll(/<label[^>]*\bfor="([^"]+)"/g)){
        expect(h, `${ctx}: label for="${m[1]}" points at nothing`).toContain(`id="${m[1]}"`);
      }
      // The three contexts get their own id namespace so the same restaurant
      // can be on screen twice without duplicate ids.
      expect(h).toContain(`amt-${ctx}-${DEWAKAN.id}`);
    }
  });

  it('is not built for a record with no id — there would be nothing to key on', () => {
    expect(visitBoxHtml({ ...DEWAKAN, id: '' })).toBe('');
  });
});

// ============================================================
// THE CARD
// ============================================================
describe('the 台帳 card in 外食モード', () => {
  beforeEach(() => setup({ mode: 'eatout' }));

  it('keeps the record controls OUTSIDE the role="button" element', () => {
    // A button containing buttons is not operable by keyboard or screen reader.
    // 記録欄の器は 訪問済み=visitbox / 未訪問=vb-line(1行ミニ・2026-08-08 密度改善)
    // のどちらか — いずれにせよ card-main の外に居なければならない。
    const h = cardHtml(DEWAKAN);
    const opener = h.slice(h.indexOf('<div class="card-main"'));
    const box = ['class="visitbox"', 'class="vb-line"']
      .map(s => opener.indexOf(s)).filter(i => i >= 0);
    expect(box.length, 'record box missing entirely').toBeGreaterThan(0);
    const mainEnd = Math.min(...box);
    expect(h).toContain('class="card-main"');
    expect(opener.slice(0, mainEnd)).not.toContain('<button');
    expect(h).toContain('role="button"');
    expect(h).toContain('tabindex="0"');
  });

  it('marks a visited card so the listing can sink in the list', () => {
    expect(isVisited(DEWAKAN)).toBe(false);
    expect(cardHtml(DEWAKAN)).not.toContain('visited');
    setVisited(DEWAKAN.id, true);
    expect(isVisited(DEWAKAN)).toBe(true);
    expect(cardHtml(DEWAKAN)).toContain('class="condo-card record-card visited"');
  });

  it('leads with the score and its breakdown', () => {
    const h = cardBodyHtml(DEWAKAN);
    expect(h).toContain('class="scorebox"');
    expect(h).toContain('>80<');            // Dewakan's total (see diningScore.test.js)
    expect(h).toContain('35 + 25 + 20');
    expect(h.indexOf('scorebox')).toBeLessThan(h.indexOf('card-name'));
  });

  it('prints the star with its sample size and its shrunk value, once', () => {
    const h = cardHtml(DEWAKAN);
    expect(h).toContain('母数 やや薄い');
    expect(h).toContain('縮約後 4.29');
    // The plain 「★4.2 (548件)」 of 住まいモード would be the same fact twice.
    expect(h).not.toContain('★4.2 (548件)');
  });

  it('still prints the plain rating in 住まいモード', () => {
    setup({ mode: 'home' });
    expect(cardBodyHtml(DEWAKAN)).toContain('★4.2 (548件)');
    expect(cardBodyHtml(DEWAKAN)).not.toContain('scorebox');
  });

  it('draws each score bar against its own ceiling', () => {
    const h = scoreBlockHtml(DEWAKAN);
    expect(h).toContain('sc-au');
    expect(h).toContain('sc-ct');
    expect(h).toContain('sc-ev');
    // au 35/35 and ct 25/25 are both full for Dewakan.
    expect(h.match(/width:100%/g)).toHaveLength(2);
  });
});

// ============================================================
// THE DETAIL PANEL
// ============================================================
describe('the detail panel in 外食モード', () => {
  beforeEach(() => setup({ mode: 'eatout' }));

  it('adds the score, the record box and the privacy sentence', () => {
    const h = detailHtml(DEWAKAN);
    expect(h).toContain('わたしの記録');
    expect(h).toContain('scorebox');
    expect(h).toContain('visitbox');
    expect(h).toContain(PRIVACY_TEXT);
  });

  it('states plainly where the records live and how they are lost', () => {
    expect(PRIVACY_TEXT).toContain('このブラウザにだけ保存');
    expect(PRIVACY_TEXT).toContain('他人には見えません');
    expect(PRIVACY_TEXT).toContain('ブラウザのデータを消すと失われます');
  });

  it('keeps every 住まいモード section — the record is added, nothing is replaced', () => {
    const h = detailHtml(DEWAKAN);
    for(const sec of ['ミシュラン', '支持される点', '割れる点・不満', '編集メモ']) expect(h).toContain(sec);
  });
});

// ============================================================
// THE THREE VIEWS
// ============================================================
describe('台帳 / 行った店 / データ', () => {
  it('draws the ordinary card list for 台帳 (null = "use the cards")', () => {
    setup({ mode: 'eatout', view: 'ledger' });
    expect(eatoutListHtml()).toBeNull();
  });

  // 行った店ビューは 2026-08-08 竹森さん指示で廃止。台帳+「✓行った店」トグルが代替。
  it('the log view is gone: view=log resolves to the ledger (old links land safely)', () => {
    setup({ mode: 'eatout', view: 'log' });
    // eatoutListHtml が null = 通常の台帳カード一覧が描かれる、が新契約。
    expect(eatoutListHtml()).toBeNull();
  });

  it('✓行った店 narrows the ledger to visited records only', () => {
    setVisited(DEWAKAN.id, true);
    const f = { layer: 'dining', visitedOnly: true, personal: { [DEWAKAN.id]: { v: 1 } } };
    expect(matchesDining(DEWAKAN, f)).toBe(true);
    expect(matchesDining(LEDGER[1], f)).toBe(false);   // 記録なし → 落ちる
    // トグルOFFなら絞らない
    expect(matchesDining(LEDGER[1], { layer: 'dining', visitedOnly: false })).toBe(true);
  });

  it('offers save status, export, import and erase on データ', () => {
    setup({ mode: 'eatout', view: 'data' });
    const h = eatoutListHtml();
    for(const t of ['保存の状態', '書き出し（バックアップ）', '読み込み', '全消去']) expect(h).toContain(t);
    expect(h).toContain('dineDownload()');
    expect(h).toContain("dineImport('merge')");
    expect(h).toContain("dineImport('replace')");
    expect(h).toContain('dineClearAll()');
    expect(h).toContain('台帳v9のバックアップもそのまま読めます');
  });

  it('says the privacy sentence ONCE per screen — the save bar owns it here', () => {
    // It used to be printed in the データ view as well, directly above the save
    // bar that was already saying it: the same sentence twice in one glance.
    // The bar (renderSaveBar) and the detail panel keep it; this view does not.
    setup({ mode: 'eatout', view: 'data' });
    expect(eatoutListHtml()).not.toContain(PRIVACY_TEXT);
    expect(eatoutDetailHtml(DEWAKAN)).toContain(PRIVACY_TEXT);
  });

  it('folds the raw JSON away behind a summary, with a plain line above it', () => {
    setup({ mode: 'eatout', view: 'data' });
    const h = eatoutListHtml();
    expect(h).toContain('<details class="data-details" id="dataExportBox">');
    expect(h).toContain('<summary>書き出した内容（JSON）</summary>');
    expect(h).toContain('記録をファイルに保存するか、下のJSONをコピーして控えられます');
    // The textarea keeps a name of its own: <summary> is not a <label>.
    expect(h).toMatch(/<textarea id="dataExport"[^>]*aria-label="書き出した内容（JSON）"/);
    expect(h.indexOf('下のJSONをコピー')).toBeLessThan(h.indexOf('<details'));
  });

  it('dresses まるごと置き換え as the destructive act it is', () => {
    setup({ mode: 'eatout', view: 'data' });
    const h = eatoutListHtml();
    expect(h).toContain(`<button type="button" class="data-btn danger" onclick="dineImport('replace')">まるごと置き換え（今の記録は消えます）</button>`);
  });

  it('shows the storage inventory on データ', () => {
    setup({ mode: 'eatout', view: 'data' });
    setVisited(DEWAKAN.id, true);
    setMemo(DEWAKAN.id, 'x');
    expect(eatoutListHtml()).toContain('記録中: 1店（訪問 1 ・ 行きたい 0 ・ 感想 1 ・ 実額 0）');
  });

  it('replaces the row of zeros with what to do about it', () => {
    setup({ mode: 'eatout', view: 'data' });
    const h = eatoutListHtml();
    expect(h).not.toContain('記録中: 0店');
    expect(h).toContain('まだ記録がありません。台帳で店を開き「訪問済み」を押すと記録が始まります。');
  });

  it('draws no view of its own in 住まいモード, whatever the view flag says', () => {
    setup({ mode: 'home', view: 'log' });
    expect(eatoutListHtml()).toBeNull();
  });
});

// ============================================================
// WHAT THE TOAST SAYS
// ============================================================
describe('the toast reports what actually happened', () => {
  // toast() writes into #toast; the app has no DOM under vitest, so one node
  // is enough to read the sentence back.
  function withToast(fn){
    const node = { textContent: '', classList: { add(){}, remove(){}, toggle(){} } };
    globalThis.document = { getElementById: (id) => (id === 'toast' ? node : null) };
    try { fn(); return node.textContent; }
    finally { delete globalThis.document; }
  }

  beforeEach(() => setup({ mode: 'eatout' }));

  it('warns that 行きたい comes off when the visit goes on', () => {
    toggleWant(DEWAKAN.id);
    const msg = withToast(() => dineVisit(DEWAKAN.id));
    expect(msg).toContain('訪問済みにしました');
    expect(msg).toContain('「行きたい」からは外れます');
    expect(getEntry(DEWAKAN.id).w).toBe(0);           // the toast was telling the truth
  });

  it('does not mention 行きたい when it was never on', () => {
    const msg = withToast(() => dineVisit(DEWAKAN.id));
    expect(msg).toBe('訪問済みにしました。また行きたいか答えてください');
  });

  it('says what SURVIVES when the visit is undone (it is not an erase)', () => {
    setVisited(DEWAKAN.id, true);
    setAmount(DEWAKAN.id, '790');
    setMemo(DEWAKAN.id, 'よかった');
    const msg = withToast(() => dineVisit(DEWAKAN.id));
    expect(msg).toBe('訪問記録を解除しました（再訪・実額・感想は保持されます）');
  });
});

// ============================================================
// FILTERS
// ============================================================
describe('外食モードの絞り込み', () => {
  const fd = (over = {}) => ({ layer: 'dining', ...over });
  const eat = (over = {}) => ({ status: 'dining', id: 'R0001', name: 'x', venueType: 'street', ...over });

  it('adds 施設タイプ, with the five values the ledger actually uses', () => {
    expect(VENUE_TYPES.map(v => v.value)).toEqual(['mall', 'hotel', 'tower', 'street', 'stall']);
    const inData = new Set(LEDGER.map(r => r.venueType));
    for(const v of inData) expect(VENUE_TYPES.some(o => o.value === v), v).toBe(true);
  });

  it('filters on 施設タイプ exactly', () => {
    expect(matchesDining(eat({ venueType: 'mall' }), fd({ venueType: 'mall' }))).toBe(true);
    expect(matchesDining(eat({ venueType: 'street' }), fd({ venueType: 'mall' }))).toBe(false);
    expect(matchesDining(eat({ venueType: 'street' }), fd({ venueType: '' }))).toBe(true);
  });

  it('makes 行きたい and 未訪問 INDEPENDENT toggles that combine (v9 欠陥4)', () => {
    const personal = {
      R0001: { w: 1, v: 0 },   // 行きたい, まだ行っていない  ← the one you want
      R0002: { w: 1, v: 1 },   // 行きたかった, もう行った
      R0003: { w: 0, v: 0 },   // なにも記録していない
    };
    const ask = (id, f) => matchesDining(eat({ id }), fd({ personal, ...f }));

    expect(ask('R0001', { wantOnly: true })).toBe(true);
    expect(ask('R0002', { wantOnly: true })).toBe(true);
    expect(ask('R0003', { wantOnly: true })).toBe(false);

    expect(ask('R0001', { undoneOnly: true })).toBe(true);
    expect(ask('R0002', { undoneOnly: true })).toBe(false);
    expect(ask('R0003', { undoneOnly: true })).toBe(true);

    // Both at once — the question v9 could not ask at all.
    expect(ask('R0001', { wantOnly: true, undoneOnly: true })).toBe(true);
    expect(ask('R0002', { wantOnly: true, undoneOnly: true })).toBe(false);
    expect(ask('R0003', { wantOnly: true, undoneOnly: true })).toBe(false);
  });

  it('treats a restaurant with no record at all as 未訪問, not as missing', () => {
    expect(matchesDining(eat({ id: 'R0099' }), fd({ personal: {}, undoneOnly: true }))).toBe(true);
    expect(matchesDining(eat({ id: 'R0099' }), fd({ undoneOnly: true }))).toBe(true);
  });

  it('combines with the ordinary filters rather than replacing them', () => {
    const personal = { R0001: { w: 1, v: 0 } };
    const r = eat({ id: 'R0001', catGroup: '中華', michelin: 'bib', priceDinner: [40, 60], priceLunch: [0, 0] });
    expect(matchesFilters(r, fd({ personal, wantOnly: true, catGroup: '中華' }))).toBe(true);
    expect(matchesFilters(r, fd({ personal, wantOnly: true, catGroup: '洋食・グリル' }))).toBe(false);
  });

  it('is simply off in 住まいモード, where no personal map is ever passed', () => {
    expect(matchesDining(eat(), fd())).toBe(true);
  });
});

// ============================================================
// SORT
// ============================================================
describe('台帳スコア順', () => {
  it('leads the sort list in 外食モード and is its default', () => {
    expect(sortOptionsFor('dining', 'eatout')[0].value).toBe('ledgerHigh');
    expect(defaultSortFor('dining', 'eatout')).toBe('ledgerHigh');
    expect(sortAvailable('dining', 'ledgerHigh', 'eatout')).toBe(true);
  });

  it('is NOT offered in 住まいモード, where the score is not on screen', () => {
    expect(sortAvailable('dining', 'ledgerHigh', 'home')).toBe(false);
    expect(sortAvailable('dining', 'ledgerHigh')).toBe(false);
    expect(defaultSortFor('dining')).toBe('ratingHigh');
    expect(defaultSortFor('dining', 'home')).toBe('ratingHigh');
  });

  it('is offered for no other layer', () => {
    for(const l of ['condo', 'school', 'commercial']){
      expect(sortAvailable(l, 'ledgerHigh', 'eatout'), l).toBe(false);
    }
  });

  it('orders by the stamped total, high first, and breaks a tie on the rating', () => {
    const recs = [
      { name: 'B', ledgerTotal: 70, rating: 4.1 },
      { name: 'A', ledgerTotal: 93, rating: 4.5 },
      { name: 'C', ledgerTotal: 70, rating: 4.9 },
    ];
    expect(sortRecords(recs, 'ledgerHigh').map(r => r.name)).toEqual(['A', 'C', 'B']);
  });

  it('sinks a record with no score rather than producing a NaN order', () => {
    const recs = [{ name: 'none' }, { name: 'has', ledgerTotal: 50 }];
    expect(sortRecords(recs, 'ledgerHigh').map(r => r.name)).toEqual(['has', 'none']);
  });

  it('really does put the ledger\'s best first', () => {
    setup({ mode: 'eatout' });
    const top = sortRecords(LEDGER, 'ledgerHigh')[0];
    expect(totalOf(top)).toBe(93);
  });
});

// ============================================================
// MARKUP CONTRACT
// ============================================================
describe('index.html carries the mode', () => {
  it('puts the switch in the header, named, with both modes', () => {
    expect(body).toContain('id="modeSeg"');
    expect(body).toContain("onclick=\"setMode('home')\"");
    expect(body).toContain("onclick=\"setMode('eatout')\"");
  });

  it('the three-view segment is gone; ✓行った店 toggle and the data door replace it (2026-08-08)', () => {
    expect(body).not.toContain('id="viewSeg"');
    expect(body).not.toContain('data-view="log"');
    expect(body).toContain('id="toggleVisited"');
  });

  it('marks the personal filter row as 外食モード-only, hidden by default', () => {
    const i = body.indexOf('data-mode-only="eatout"');
    expect(i).toBeGreaterThan(-1);
    expect(body.slice(i, body.indexOf('>', i))).toContain('display:none');
    expect(body).toContain('id="toggleWant"');
    expect(body).toContain('id="toggleUndone"');
  });

  it('carries the save bar and the toast, both announced politely', () => {
    for(const id of ['saveBar', 'toast']){
      const tag = body.slice(body.indexOf(`id="${id}"`));
      expect(tag.slice(0, tag.indexOf('>')), id).toContain('aria-live="polite"');
    }
    const bar = body.slice(body.indexOf('id="saveBar"'));
    expect(bar.slice(0, bar.indexOf('>'))).toContain('display:none');
  });

  it('keeps every colour in :root — the record UI adds no literal hex', () => {
    for(const t of ['--rv-again', '--rv-maybe', '--rv-never', '--rv-none',
      '--bar-au', '--bar-ct', '--bar-ev', '--visited-dim']){
      expect(css, `missing ${t}`).toMatch(new RegExp(`${t}\\s*:`));
    }
    // Nothing generated by src/ui/dining.js may carry a colour of its own.
    const dining = readFileSync(new URL('../src/ui/dining.js', import.meta.url), 'utf8');
    expect(dining).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });

  it('dims the listing of a visited card, not the controls under it', () => {
    expect(css).toContain('.record-card.visited .card-main{opacity:var(--visited-dim)}');
  });

  it('sets every font-size in the new block from the type scale', () => {
    const block = css.slice(css.indexOf('外食モード (D4)'), css.indexOf('KEYBOARD FOCUS'));
    const offScale = [...block.matchAll(/font-size:\s*([^;}!]+)/g)]
      .map(m => m[1].trim()).filter(d => !d.startsWith('var(--fs-'));
    expect(offScale).toEqual([]);
  });
});

// ── 住まいモードへの個人記録リーク防止（マーカーバッジ） ────────────────
// 訪問済み✓バッジは外食モード限定。住まいモードで飲食レイヤーを重ねても
// 個人記録（訪問済み）がピンに描かれてはならない（CLAUDE.md のモード分離契約）。
// mkMarker は Leaflet 依存で DOM 環境が無いため、ソース契約として固定する。
describe('visited badge stays out of home mode', () => {
  it("map.js computes `visited` only when appMode === 'eatout'", () => {
    const map = readFileSync(new URL('../src/ui/map.js', import.meta.url), 'utf8');
    const line = map.split('\n').find(l => l.includes('const visited ='));
    expect(line, 'visited badge line not found').toBeTruthy();
    expect(line).toContain("appMode === 'eatout'");
  });
});

// ============================================================
// 非表示(🗑) — オーナーが「ここは違う」と消した店(2026-08-08)
// ============================================================
describe('非表示にした店', () => {
  it('hiddenIds に入ったIDは matchesDining が落とす(台帳・地図から消える)', () => {
    const f = { layer: 'dining', hiddenIds: new Set([DEWAKAN.id]) };
    expect(matchesDining(DEWAKAN, f)).toBe(false);
    expect(matchesDining(LEDGER[1], f)).toBe(true);
    // セットが無ければ何も落とさない(住まいモードはここ)
    expect(matchesDining(DEWAKAN, { layer: 'dining' })).toBe(true);
  });

  it('台帳カードに 🗑(dineHide) が付く', () => {
    setup({ mode: 'eatout' });
    const h = cardHtml(DEWAKAN);
    expect(h).toContain(`dineHide('${DEWAKAN.id}')`);
  });

  it('データ管理に「非表示にした店」の一覧と戻すボタンが出る', () => {
    setup({ mode: 'eatout', view: 'data' });
    setHidden(DEWAKAN.id, true);
    const h = eatoutListHtml();
    expect(h).toContain('非表示にした店');
    expect(h).toContain(DEWAKAN.name);
    expect(h).toContain(`dineUnhide('${DEWAKAN.id}')`);
  });

  it('1件も非表示がなければ、その節は出ない(空の節でデータ管理を汚さない)', () => {
    setup({ mode: 'eatout', view: 'data' });
    expect(eatoutListHtml()).not.toContain('非表示にした店');
  });
});
