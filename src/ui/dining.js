// 外食モード — the private half of the app.
//
// 住まいモード asks "where should we live"; 外食モード asks "where have we
// eaten, and where do we want to go next". Same 50 restaurants, same map, but
// the layer is pinned to 飲食 and every card grows the six-field record from
// src/data/personal.js. Nothing in this file is reachable in 住まいモード —
// that separation is the whole point, because the site is public and the
// records are not.
//
// Three views (台帳v9's three tabs):
//   台帳     the ledger, filterable, each card recordable
//   行った店 the visited places, grouped by また行きたいか, still editable
//   データ   save status, export, import, erase
//
// What this file owns: the markup and the click handlers. The arithmetic lives
// in src/domain/diningScore.js and src/domain/diningLog.js, the storage in
// src/data/personal.js, and all three are pure or injectable so they are tested
// without a DOM.
import { CONDOS, filtered, appMode, listView } from '../state.js';
import { recordLayer } from '../domain/filter.js';
import {
  ledgerScore, scoreBreakdownText, scoreBars, ratingMetaText, BASELINE_STAR,
} from '../domain/diningScore.js';
import { visitSummary, groupByRepeat, logMetaText } from '../domain/diningLog.js';
import * as P from '../data/personal.js';
import * as FS from '../data/fileStore.js';
import { stableStringify } from '../domain/fileSync.js';
import { recTier, recBadge } from '../domain/recommend.js';
import { esc, jsStr, num } from './list.js';

// The re-render to run after a record changes. Injected by main.js so this
// module never has to reach back into the list renderer at import time.
let onChanged = () => {};
export function setOnPersonalChange(fn){ onChanged = typeof fn === 'function' ? fn : (() => {}); }

/** True while 外食モード is showing the 飲食 layer's own record UI. */
export function eatoutActive(){ return appMode === 'eatout'; }

/** The record map the dining filters read (行きたい / 未訪問). */
export function personalMap(){ return P.allEntries(); }

// ============================================================
// SCORE
// ============================================================
/** All dining records currently loaded, in ledger order. */
function diningRecords(){ return CONDOS.filter(c => recordLayer(c) === 'dining'); }

/**
 * The score of one record. calcLedgerScores() stamps it when the JSON lands;
 * this recomputes only if something rendered before that (tests, a partial
 * load), so a card is never blank because of an ordering accident.
 */
export function scoreOf(c){
  if(c && c.ledgerScore) return c.ledgerScore;
  return ledgerScore(c, (c && c.ledgerBaseline) || BASELINE_STAR);
}

export function totalOf(c){ return scoreOf(c).total; }

/** The big number, the breakdown and the three meters. */
export function scoreBlockHtml(c){
  const s = scoreOf(c);
  const bars = scoreBars(s).map(b =>
    `<div class="sc-bar" title="${esc(b.label)} ${Math.round(b.value)} / ${b.max}">` +
    `<span class="sc-bar-label">${esc(b.label)}</span>` +
    `<span class="sc-bar-track"><span class="sc-bar-fill sc-${b.key}" style="width:${Math.round(100 * b.value / b.max)}%"></span></span>` +
    `</div>`).join('');
  return `<div class="scorebox">` +
    `<div class="sc-total"><span class="sc-num">${s.total}</span><span class="sc-unit">/100</span></div>` +
    `<div class="sc-break">${esc(scoreBreakdownText(s))}</div>` +
    `<div class="sc-bars">${bars}</div></div>`;
}

/** 「Google ★4.8 / 1,178件（母数 標準）→ 縮約後 4.44」 */
export function ratingLineHtml(c){
  const t = ratingMetaText(c, (c && c.ledgerBaseline) || BASELINE_STAR);
  return t ? `<div class="sc-rating">${esc(t)}</div>` : '';
}

// ============================================================
// THE RECORD BOX (visitbox)
// Rendered on the 台帳 card, on a 行った店 row and in the detail panel. One
// builder for all three, so the three can never drift apart — `ctx` only keeps
// the element ids unique between them.
// ============================================================
const RV_CHOICES = [
  { v: 'a', label: 'また行く' },
  { v: 'm', label: '機会があれば' },
  { v: 'n', label: 'もういい' },
];

function toggleBtn(cls, on, label, call){
  return `<button type="button" class="vb-toggle ${cls}${on ? ' on' : ''}"` +
    ` aria-pressed="${on ? 'true' : 'false'}" onclick="${call}">${esc(label)}</button>`;
}

/**
 * @param {object} c    the dining record
 * @param {string} ctx  'led' | 'log' | 'info' — element-id namespace
 */
// 訪問済み/行きたい の2ボタン。visitBoxHtml(展開記録欄)と、一覧カードの
// 1行ミニ表示(eatoutCardExtraHtml)が同じ実装を共有する — 文言・状態表現を
// 2箇所に書かない(2026-08-08 密度改善で分離)。
//
// Both labels are FIXED — the state is carried by the colour (.on) and by
// aria-pressed, not by rewording the button. The heart is deliberate: ★
// belongs to the Google rating and to nothing else in this app.
function vbHeadButtons(id, e){
  return toggleBtn('vb-visit', e.v === 1, e.v === 1 ? '✓ 訪問済み' : '訪問済み', `dineVisit('${jsStr(id)}')`) +
    toggleBtn('vb-want', e.w === 1, e.w === 1 ? '♥ 行きたい' : '♡ 行きたい', `dineWant('${jsStr(id)}')`);
}

export function visitBoxHtml(c, ctx = 'led'){
  const id = c.id;
  if(!id) return '';
  const e = P.getEntry(id);
  const key = `${ctx}-${jsStr(id)}`;
  const head = `<div class="vb-head">${vbHeadButtons(id, e)}</div>`;
  if(e.v !== 1) return `<div class="visitbox">${head}</div>`;

  const rv = `<div class="vb-rv" role="group" aria-label="また行きたいか">` +
    RV_CHOICES.map(o =>
      `<button type="button" class="vb-rv-btn rv-${o.v}${e.rv === o.v ? ' on' : ''}"` +
      ` aria-pressed="${e.rv === o.v ? 'true' : 'false'}"` +
      ` onclick="dineRepeat('${jsStr(id)}','${o.v}')">${esc(o.label)}</button>`).join('') +
    `</div>`;
  return `<div class="visitbox">${head}` +
    `<div class="vb-date">${esc(e.vd ? e.vd + ' に訪問' : '訪問日なし')}</div>` +
    `<div class="vb-q">また行きたい？<span class="vb-hint">（もう一度押すと未回答に戻ります）</span></div>` + rv +
    `<div class="vb-field">` +
      `<label class="vb-flabel" for="amt-${key}">1人あたり実際に払った額 (RM)</label>` +
      `<input type="text" inputmode="decimal" id="amt-${key}" class="vb-amt" value="${esc(e.amt)}"` +
      ` placeholder="例: 180" oninput="dineAmount('${jsStr(id)}',this.value)">` +
    `</div>` +
    `<div class="vb-field">` +
      `<label class="vb-flabel" for="memo-${key}">感想</label>` +
      `<textarea id="memo-${key}" class="vb-memo" rows="3" placeholder="何を食べて、どうだったか"` +
      ` oninput="dineMemo('${jsStr(id)}',this.value)">${esc(e.m)}</textarea>` +
    `</div></div>`;
}

/** The block a 台帳 card grows in 外食モード. '' everywhere else. */
export function eatoutCardExtraHtml(c){
  if(!eatoutActive() || recordLayer(c) !== 'dining') return '';
  const e = c.id ? P.getEntry(c.id) : null;
  // 未訪問カードは「評価 + 2ボタン」を1行に畳む(2026-08-08 密度改善:
  // カード307px→大幅圧縮の主部品)。訪問済みは記録欄が要るので従来の展開。
  if(!e || e.v !== 1){
    return `<div class="vb-line">${ratingLineHtml(c)}` +
      `<div class="vb-mini">${c.id ? vbHeadButtons(c.id, e || P.getEntry(c.id)) : ''}</div></div>`;
  }
  return ratingLineHtml(c) + visitBoxHtml(c, 'led');
}

/**
 * 推奨バッジ(⭐軸・2026-08-08)。外食モード限定 — 鉄板/拒否権が家族の記録を
 * 読むため、住まいモードでは絶対に呼ばれない(モード分離契約)。
 */
export function eatoutRecBadgeHtml(c){
  if(!eatoutActive() || recordLayer(c) !== 'dining') return '';
  const b = recBadge(recTier(c, c.id ? P.getEntry(c.id) : undefined));
  if(!b) return '';
  return ` <span class="rec-badge" title="${esc(b.hint)}">${b.icon} ${esc(b.label)}</span>`;
}

/** Whether a card should sink in the list because you have already been. */
export const isVisited = P.isVisited;

/** The score block a 台帳 card leads with in 外食モード. '' elsewhere. */
export function eatoutCardScoreHtml(c){
  return eatoutActive() && recordLayer(c) === 'dining' ? scoreBlockHtml(c) : '';
}

/** The record block the detail panel shows in 外食モード. '' elsewhere. */
export function eatoutDetailHtml(c){
  if(!eatoutActive() || recordLayer(c) !== 'dining') return '';
  return `<div class="info-sec"><div class="info-sec-title">わたしの記録</div>` +
    scoreBlockHtml(c) + ratingLineHtml(c) + visitBoxHtml(c, 'info') +
    `<div class="vb-privacy">${esc(PRIVACY_TEXT)}</div></div>`;
}

// ============================================================
// ACTIONS — every one of them goes through src/data/personal.js
// ============================================================
function refresh(){ onChanged(); }

/**
 * The toast has to say what actually happened, not what the button is called.
 * Turning 訪問済み ON silently clears 行きたい (setVisited's `w: 0`), and
 * turning it OFF keeps the verdict, the amount and the memo — two facts the
 * user cannot see on the screen at the moment they act, so the message carries
 * them. Neither of them changes the stored shape; this is wording only.
 */
export function dineVisit(id){
  const cur = P.getEntry(id);
  const before = cur.v === 1;
  const wasWanted = cur.w === 1;
  P.setVisited(id, !before);
  refresh();
  if(before){
    toast('訪問記録を解除しました（再訪・実額・感想は保持されます）');
  } else {
    toast(wasWanted
      ? '訪問済みにしました（「行きたい」からは外れます）。また行きたいか答えてください'
      : '訪問済みにしました。また行きたいか答えてください');
  }
}

export function dineWant(id){
  const e = P.toggleWant(id);
  refresh();
  toast(e.w === 1 ? '「行きたい」に入れました' : '「行きたい」から外しました');
}

export function dineRepeat(id, rv){
  const e = P.setRepeat(id, rv);
  refresh();
  toast(e.rv ? `「${P.REPEAT_LABELS[e.rv]}」にしました` : '未回答に戻しました');
}

/**
 * Typing must not re-render: the list is rebuilt from scratch on every change
 * and that would take the caret out of the field on the first keystroke. The
 * value is saved (debounced) and the only thing repainted is the 行った店
 * tiles, in place, so the average moves while you type.
 */
export function dineAmount(id, v){ P.setAmount(id, v); patchLogTiles(); }
export function dineMemo(id, v){ P.setMemo(id, v); }

// ============================================================
// 行った店
// ============================================================
const TILE_EMPTY = '–';

function tilesData(){
  const s = visitSummary(diningRecords(), personalMap());
  return [
    { id: 'logVisits', label: '訪問した店', value: s.visits ? num(s.visits) : TILE_EMPTY },
    { id: 'logAgain', label: 'また行く', value: s.again ? num(s.again) : TILE_EMPTY },
    { id: 'logAvg', label: '平均実額', value: s.avgAmount ? 'RM ' + num(s.avgAmount) : TILE_EMPTY },
    { id: 'logTotal', label: '記録した支出', value: s.totalAmount ? 'RM ' + num(s.totalAmount) : TILE_EMPTY },
  ];
}

function tilesHtml(){
  return `<div class="log-tiles">` + tilesData().map(t =>
    `<div class="log-tile"><div class="log-tile-val" id="${t.id}" aria-labelledby="${t.id}L">${esc(t.value)}</div>` +
    `<div class="log-tile-label" id="${t.id}L">${esc(t.label)}</div></div>`).join('') + `</div>`;
}

/** Repaint the four figures without touching the markup around them. */
function patchLogTiles(){
  if(typeof document === 'undefined') return;
  tilesData().forEach(t => {
    const el = document.getElementById(t.id);
    if(el) el.textContent = t.value;
  });
}

function logRowHtml(row){
  const c = row.record;
  const score = totalOf(c);
  const memo = String(row.entry.m || '').trim();
  // The whole head band opens the detail panel, not just the glyphs of the
  // name: an inline-block span is a thin target on a phone, and the row's own
  // padding around it looked clickable while doing nothing. The role stays on
  // ONE element — the name inside it is a plain span now, because a button
  // inside a button is operable by neither keyboard nor screen reader.
  // The visitbox below is left outside the target on purpose: its fields are
  // edited in place, and a stray tap must not throw the panel open.
  return `<div class="log-row">` +
    `<div class="log-row-head" role="button" tabindex="0" aria-label="${esc(c.name)} の詳細を開く"` +
    ` onclick="selectCondo('${jsStr(c.name)}')">` +
      `<span class="log-name">${esc(c.name)}</span>` +
    `</div>` +
    `<div class="log-sub">${esc([c.catGroup, c.area, c.venue].filter(Boolean).join(' ・ '))}</div>` +
    `<div class="log-meta">${esc(logMetaText(row, score))}</div>` +
    (memo ? `<div class="log-memo">${esc(memo)}</div>` : '') +
    visitBoxHtml(c, 'log') +
    `</div>`;
}

function logViewHtml(){
  const groups = groupByRepeat(diningRecords(), personalMap(), totalOf);
  if(!groups.length){
    return tilesHtml() + `<div class="empty-state">` +
      `<div class="empty-title">まだ訪問記録がありません</div>` +
      `<div class="empty-sub">台帳で店を開き、「訪問済み」を押すとここに並びます。</div></div>`;
  }
  return tilesHtml() + groups.map(g =>
    `<div class="log-group">` +
      `<div class="log-group-head" style="border-left-color:var(${g.colorVar})">` +
        `${esc(g.label)} <span class="log-group-n">${num(g.items.length)}</span></div>` +
      g.items.map(logRowHtml).join('') +
    `</div>`).join('');
}

// ============================================================
// データ
// ============================================================
export const PRIVACY_TEXT =
  '記録はこのブラウザにだけ保存され、公開サイトでも他人には見えません。ブラウザのデータを消すと失われます。';

function savedAtText(st){
  if(!st.savedAt) return 'まだ保存していません';
  const d = st.savedAt;
  const p = P.pad2;
  return `最終保存 ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

const DATA_EMPTY_TEXT =
  'まだ記録がありません。台帳で店を開き「訪問済み」を押すと記録が始まります。';
const EXPORT_LEAD_TEXT =
  '記録をファイルに保存するか、下のJSONをコピーして控えられます';
const EXPORT_SUMMARY_TEXT = '書き出した内容（JSON）';

// ---- ファイルDB（A案 2026-08-08）: データビュー先頭の節と保存バーの一言 ----

function fileTimeText(d){
  if(!d) return '';
  const p = P.pad2;
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 保存バー用の短い一言。'' なら何も足さない。 */
export function fileBarText(fs){
  if(!fs.supported || fs.phase === 'off' || fs.phase === 'unsupported') return '';
  if(fs.phase === 'conflict') return '⚠ ファイル保存が競合（データビューで解決）';
  if(fs.phase === 'error') return '⚠ ファイル保存に失敗';
  if(fs.phase === 'reauth') return 'ファイル保存: 再接続待ち';
  if(fs.phase === 'saving') return 'ファイルへ保存中…';
  return 'ファイル保存: ' + (fs.lastWriteAt ? fileTimeText(fs.lastWriteAt) + ' ✓' : '接続済み');
}

/** データビュー先頭「自動保存（ファイル）」の節。状態ごとに言うことが違う。 */
function fileSectionHtml(){
  const fs = FS.fileStatus();
  const head = `<section class="data-sec"><h3 class="data-h">自動保存（ファイル）</h3>`;
  if(!fs.supported){
    return head + `<div class="data-note">このブラウザはフォルダへの自動保存に対応していません（Chrome/Edgeで利用できます）。下の「書き出し」でのバックアップをおすすめします。</div></section>`;
  }
  if(fs.phase === 'off'){
    return head +
      `<div class="data-note">フォルダを一度選ぶと、以後は記録のたび自動でファイルにも保存されます。OneDrive内のフォルダを選べば、ブラウザのデータ消去やPCの故障からも記録が守られます。</div>` +
      `<div class="data-btns"><button type="button" class="data-btn primary" onclick="dineFileConnect()">フォルダを選んで自動保存を始める</button></div></section>`;
  }
  if(fs.phase === 'reauth'){
    return head +
      `<div class="data-line">前回の保存先: フォルダ「${esc(fs.dirName)}」</div>` +
      `<div class="data-note">ブラウザ再起動後のため、再接続の許可が必要です。ダイアログで「毎回許可」を選ぶと次回から表示されません。</div>` +
      `<div class="data-btns"><button type="button" class="data-btn primary" onclick="dineFileReauth()">再接続する（許可）</button>` +
      `<button type="button" class="data-btn" onclick="dineFileDisconnect()">自動保存をやめる</button></div></section>`;
  }
  if(fs.phase === 'conflict'){
    return head +
      `<div class="data-warn">⚠ ${esc(fs.error)}</div>` +
      `<div class="data-note">別のPCやファイルの手編集で、保存ファイルがこのブラウザの記録と食い違っています。残す方を選んでください（選ぶまで自動保存は止まっています）。</div>` +
      `<div class="data-btns">` +
        `<button type="button" class="data-btn primary" onclick="dineFileAdoptFile()">ファイルの内容をこのブラウザに読み込む</button>` +
        `<button type="button" class="data-btn danger" onclick="dineFileAdoptCache()">このブラウザの記録でファイルを上書き</button>` +
      `</div></section>`;
  }
  const warn = fs.phase === 'error' ? `<div class="data-warn">⚠ ${esc(fs.error)}</div>` : '';
  return head + warn +
    `<div class="data-line">保存先: フォルダ「${esc(fs.dirName)}」の ${esc('dining-records.json')}</div>` +
    `<div class="data-line">${fs.lastWriteAt ? 'ファイルへの最終保存: ' + fileTimeText(fs.lastWriteAt) : '接続済み（まだ書き込みなし）'} ・ 日次バックアップ7世代（backups/）</div>` +
    `<div class="data-btns">` +
      (fs.phase === 'error' ? `<button type="button" class="data-btn primary" onclick="dineFileReauth()">再試行</button>` : '') +
      `<button type="button" class="data-btn" onclick="dineFileDisconnect()">自動保存をやめる</button>` +
    `</div>` +
    `<div class="data-note">ファイルは手元に残るので、新しいPCではこの画面から同じフォルダを選び直すだけで復元されます。</div>` +
  `</section>`;
}

function dataViewHtml(){
  const st = P.saveStatus();
  const cnt = P.storedCounts();
  const warn = st.error
    ? `<div class="data-warn">⚠ ${esc(st.error)}</div>` : '';
  // 0 records is not "記録中: 0店（訪問 0 ・ …）" — a row of zeros reads as a
  // failure. It is a state with an instruction, so it gets one.
  const inventory = cnt.stores
    ? `<div class="data-line">記録中: ${num(cnt.stores)}店（訪問 ${num(cnt.visited)} ・ 行きたい ${num(cnt.want)} ・ 感想 ${num(cnt.memo)} ・ 実額 ${num(cnt.amount)}）</div>`
    : `<div class="data-note">${esc(DATA_EMPTY_TEXT)}</div>`;
  // PRIVACY_TEXT is NOT repeated here: the save bar under the list carries it
  // on every screen of 外食モード, and the detail panel carries it beside the
  // record itself. A third copy on the one view the user came to on purpose
  // was the same sentence twice in one glance.
  const fs = FS.fileStatus();
  const cacheRole = fs.phase === 'idle' || fs.phase === 'saving'
    ? '保存先: このブラウザ（高速キャッシュ）＋ 自動保存ファイル'
    : '保存先: このブラウザ（localStorage）';
  return `<div class="dataview">` +
    fileSectionHtml() +
    `<section class="data-sec"><h3 class="data-h">保存の状態</h3>` +
      warn +
      `<div class="data-line">${esc(cacheRole)}</div>` +
      `<div class="data-line">${esc(savedAtText(st))}</div>` +
      inventory +
    `</section>` +

    `<section class="data-sec"><h3 class="data-h">書き出し（バックアップ）</h3>` +
      `<div class="data-note">機種変更やブラウザのデータ消去に備えて、ときどき保存してください。</div>` +
      `<div class="data-btns">` +
        `<button type="button" class="data-btn primary" onclick="dineDownload()">ファイルに保存</button>` +
        `<button type="button" class="data-btn" onclick="dineSelectExport()">JSONを全選択</button>` +
      `</div>` +
      `<div class="data-note">${esc(EXPORT_LEAD_TEXT)}</div>` +
      // The raw JSON is folded away. It is the fallback, not the offer: the
      // first thing on this view should be the button that does the job.
      `<details class="data-details" id="dataExportBox">` +
        `<summary>${esc(EXPORT_SUMMARY_TEXT)}</summary>` +
        `<textarea id="dataExport" class="data-area" rows="6" readonly` +
        ` aria-label="${esc(EXPORT_SUMMARY_TEXT)}">${esc(P.currentExportText())}</textarea>` +
      `</details>` +
    `</section>` +

    `<section class="data-sec"><h3 class="data-h">読み込み</h3>` +
      `<div class="data-note">書き出したJSONを貼り付けてください。台帳v9のバックアップもそのまま読めます。</div>` +
      `<label class="vb-flabel" for="dataImport">貼り付け欄</label>` +
      `<textarea id="dataImport" class="data-area" rows="5" placeholder='{"app":"kl-dining-ledger", ...}'></textarea>` +
      `<div class="data-btns">` +
        `<button type="button" class="data-btn" onclick="dineImport('merge')">いまの記録に統合</button>` +
        // 置き換え destroys; it is dressed like 全消去 and says so on its face.
        `<button type="button" class="data-btn danger" onclick="dineImport('replace')">まるごと置き換え（今の記録は消えます）</button>` +
      `</div>` +
      `<div class="data-result" id="dataResult" role="status" aria-live="polite"></div>` +
    `</section>` +

    `<section class="data-sec"><h3 class="data-h">全消去</h3>` +
      `<div class="data-note">この端末の記録をすべて消します。戻せません。先に書き出しておいてください。</div>` +
      `<div class="data-btns"><button type="button" class="data-btn danger" onclick="dineClearAll()">記録をすべて消す</button></div>` +
    `</section></div>`;
}

// ============================================================
// DATA ACTIONS
// ============================================================
function el(id){ return typeof document !== 'undefined' ? document.getElementById(id) : null; }

export function dineSelectExport(){
  const t = el('dataExport');
  if(!t) return;
  // The JSON lives inside a <details> now, and a collapsed one cannot be
  // focused or selected — open it first, or the button would report success
  // over an empty selection.
  const box = el('dataExportBox');
  if(box) box.open = true;
  t.focus(); t.select();
  toast('全選択しました。コピーしてください');
}

export function dineDownload(){
  if(typeof document === 'undefined') return;
  const blob = new Blob([P.currentExportText()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = P.exportFilename();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('ファイルに書き出しました');
}

export function dineImport(mode){
  const box = el('dataImport');
  // The element is looked up when the message is written, not before: a
  // successful import re-renders the whole データ view, and the node captured
  // up here would be a detached one nobody can see.
  const say = (msg, bad) => {
    const out = el('dataResult');
    if(out){ out.textContent = msg; out.classList.toggle('bad', !!bad); }
    toast(msg);
  };
  const res = P.parseImport(box ? box.value : '', P.buildPlaceIdMap(diningRecords()));
  if(!res.ok) return say(res.error, true);
  if(!res.stats.kept && res.stats.unknown) return say(P.importSummaryText(res.stats, mode), true);
  if(mode === 'replace'){
    const n = P.storedCounts().stores;
    if(n > 0 && typeof confirm === 'function' &&
       !confirm(`いまの記録 ${n}店ぶんを捨てて、貼り付けた内容で置き換えます。よろしいですか？`)) return;
    P.replaceAll(res.data);
  } else {
    P.mergeAll(res.data);
  }
  if(box) box.value = '';
  refresh();
  say(P.importSummaryText(res.stats, mode), false);
}

/** Two confirmations, and the first one names the way out. v9 asked twice too. */
export function dineClearAll(){
  const n = P.storedCounts().stores;
  if(!n){ toast('消す記録がありません'); return; }
  if(typeof confirm !== 'function') return;
  if(!confirm(`${n}店ぶんの記録を全部消します。先に「ファイルに保存」で書き出しておいてください。続けますか？`)) return;
  if(!confirm('本当に消しますか？ この操作は取り消せません。')) return;
  P.clearAll();
  refresh();
  toast('記録をすべて消しました');
}

// ============================================================
// TOAST + SAVE BAR
// ============================================================
let toastTimer = null;
export function toast(msg){
  const t = el('toast');
  if(!t) return;
  t.textContent = msg;
  t.classList.add('show');
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/** The slim save indicator under the list. Red and permanent when writes fail. */
export function renderSaveBar(){
  const bar = el('saveBar');
  if(!bar) return;
  if(!eatoutActive()){ bar.style.display = 'none'; return; }
  const st = P.saveStatus();
  const fb = fileBarText(FS.fileStatus());
  bar.style.display = '';
  bar.classList.toggle('bad', !!st.error || fb.startsWith('⚠'));
  bar.textContent = st.error ? '⚠ ' + st.error
    : savedAtText(st) + (fb ? ' ・ ' + fb : '') + ' ・ ' + PRIVACY_TEXT;
}

// ============================================================
// ファイルDBの配線（main.jsから起動時に1回）とボタンハンドラ
// ============================================================
export function initFileDb(){
  FS.initFileStore({
    subscribe: P.onPersonalChange,
    getExportText: () => P.currentExportText(),
    cacheCount: () => P.storedCounts().stores,
    sameData: (text) => {
      try { return stableStringify(JSON.parse(text).data) === stableStringify(P.allEntries()); }
      catch { return false; }
    },
    restore: (text) => {
      const res = P.parseImport(text, P.buildPlaceIdMap(diningRecords()));
      if(!res.ok) return res;
      P.replaceAll(res.data);
      return { ok: true };
    },
    localDate: P.localDate,
    onRestored: (n) => toast(`保存ファイルから記録 ${num(n)}店ぶんを復元しました`),
  });
  FS.onFileChange(() => {
    renderSaveBar();
    // データビューを開いているときは状態表示を追随させる
    if(eatoutActive() && listView === 'data') onChanged();
  });
  FS.resumeFileStore();
}

export function dineFileConnect(){ FS.connectFileStore(); }
export function dineFileReauth(){ FS.reauthFileStore(); }
export function dineFileDisconnect(){
  FS.disconnectFileStore();
  toast('自動保存をやめました。ファイルは手元に残っています');
}
export function dineFileAdoptFile(){ FS.adoptFile(); }
export function dineFileAdoptCache(){ FS.adoptCache(); }

// ============================================================
// THE VIEW SWITCH
// ============================================================
/**
 * The body of the list area when 外食モード is on a view other than 台帳.
 * Returns null when the ordinary card list should be drawn instead — that is
 * the contract src/ui/list.js's renderList() checks.
 */
export function eatoutListHtml(){
  if(!eatoutActive()) return null;
  if(listView === 'log') return logViewHtml();
  if(listView === 'data') return dataViewHtml();
  return null;
}

/** Kept for the list header: how many records the 台帳 view is showing. */
