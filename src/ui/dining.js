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
import * as P from '../data/personal.js';
import * as CS from '../data/cloudStore.js';
import { snapLabel } from '../domain/snapshots.js';
import { recTier, recBadge } from '../domain/recommend.js';
import { esc, jsStr, num, ratingText } from './list.js';

// The re-render to run after a record changes. Injected by main.js so this
// module never has to reach back into the list renderer at import time.
let onChanged = () => {};
export function setOnPersonalChange(fn){ onChanged = typeof fn === 'function' ? fn : (() => {}); }

/** True while 外食モード is showing the 飲食 layer's own record UI. */
export function eatoutActive(){ return appMode === 'eatout'; }

/** 非表示IDセット(list.jsのcriteriaが毎描画で読む)。 */
export function hiddenIdsSet(){ return P.hiddenIds(); }

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

/** 「Google ★4.8 / 1,178件（母数 標準）→ 縮約後 4.44」— 詳細パネル用。 */
export function ratingLineHtml(c){
  const t = ratingMetaText(c, (c && c.ledgerBaseline) || BASELINE_STAR);
  return t ? `<div class="sc-rating">${esc(t)}</div>` : '';
}

/**
 * カード用の評価行（2026-08-16）。「（母数 標準）→ 縮約後 4.44」は統計の用語で、
 * 家族が店を選ぶときには使わない。カードでは住まいモードと同じ素の表記に戻し、
 * 縮約の説明は詳細パネル(ratingLineHtml)にだけ残す。
 */
export function ratingLineCardHtml(c){
  const t = ratingText(c);
  return t ? `<div class="sc-rating">Google ${esc(t)}</div>` : '';
}

/**
 * カードが先頭に出す点数（2026-08-16）。
 * 棒3本は台帳スコアの内訳だが、ラベルはCSSで隠されていて意味が読めず、しかも
 * 「継続性」は312/357店(87%)で常にゼロ＝空の棒が並ぶだけだった。棒と内訳は
 * 詳細パネル(scoreBlockHtml)にだけ残し、カードは数字1つにする。
 * 数字自体は残す — 既定の並び順が台帳スコア順なので、消すと順番の理由が読めなくなる。
 */
export function scoreNumberHtml(c){
  const s = scoreOf(c);
  return `<div class="scorebox"><div class="sc-total">` +
    `<span class="sc-num">${s.total}</span><span class="sc-unit">/100</span></div></div>`;
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
    toggleBtn('vb-want', e.w === 1, e.w === 1 ? '♥ 行きたい' : '♡ 行きたい', `dineWant('${jsStr(id)}')`) +
    // 「この店は違う」と思ったら1タップで台帳から消せる(2026-08-08 竹森さん依頼)。
    // 物理削除ではなく非表示 — データ管理の「非表示にした店」からいつでも戻せる。
    `<button type="button" class="vb-toggle vb-hide" aria-label="この店を台帳から非表示にする"` +
    ` title="台帳から消す（データ管理から戻せます）" onclick="dineHide('${jsStr(id)}')">🗑</button>`;
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
  // 訪問日は直せる(2026-08-16 竹森氏承認)。「訪問済み」を押した日が自動で入る
  // ままだと、先週行った店をまとめて登録した瞬間に台帳が恒久的に嘘になる。
  // 記録はファイルにも書き出して家族の台帳になるので、日付の正しさは表示上の
  // 都合ではなくアーカイブの正確さの問題。
  return `<div class="visitbox">${head}` +
    `<div class="vb-date"><label class="vb-flabel" for="vd-${key}">訪問日</label>` +
      `<input type="date" id="vd-${key}" class="vb-vd" value="${esc(e.vd)}"` +
      ` max="${esc(P.localDate())}"` +
      ` onchange="dineVisitDate('${jsStr(id)}',this.value)"></div>` +
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
    return `<div class="vb-line">${ratingLineCardHtml(c)}` +
      `<div class="vb-mini">${c.id ? vbHeadButtons(c.id, e || P.getEntry(c.id)) : ''}</div></div>`;
  }
  return ratingLineCardHtml(c) + visitBoxHtml(c, 'led');
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
  return eatoutActive() && recordLayer(c) === 'dining' ? scoreNumberHtml(c) : '';
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

/** 台帳から非表示にする(オーナー除外)。戻すのはデータ管理から。 */
export function dineHide(id){
  const c = diningRecords().find(x => x.id === id);
  P.setHidden(id, true);
  onChanged();
  toast(`「${c ? c.name : id}」を台帳から非表示にしました（💾データ管理から戻せます）`);
}

export function dineUnhide(id){
  P.setHidden(id, false);
  onChanged();
  toast('台帳に戻しました');
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

// ============================================================
// クラウド保存の操作（2026-08-16）
// ============================================================
export async function dineCloudSignIn(){
  const u = el('cloudUser'), p = el('cloudPass');
  const res = await CS.cloudSignIn(u ? u.value : '', p ? p.value : '');
  if(p) p.value = '';
  if(!res.ok){ toast('⚠ ' + res.why); refresh(); return; }
  // 打ち間違いが「別人の空アカウント」になって「記録が消えた」に見えるのを
  // 防ぐため、新しく作ったときは必ず名乗る。
  toast(res.created
    ? `新しいユーザー「${CS.cloudStatus().username}」を作りました`
    : `${CS.cloudStatus().username} としてログインしました`);
  refresh();
}

export async function dineCloudSignOut(){
  await CS.cloudSignOut();
  toast('ログアウトしました（この端末の記録は残っています）');
  refresh();
}

export async function dineCloudKeepLocal(){
  await CS.cloudKeepLocal();
  toast('この端末の記録をクラウドに反映しました');
  refresh();
}

export async function dineCloudKeepCloud(){
  await CS.cloudKeepCloud();
  toast('クラウドの記録をこの端末に取り込みました');
  refresh();
}

/** 訪問日を直す（2026-08-16）。空にすると「訪問日なし」に戻る。 */
export function dineVisitDate(id, vd){
  const e = P.setVisitDate(id, vd);
  refresh();
  toast(e.vd ? `訪問日を ${e.vd} にしました` : '訪問日を空にしました');
}

/**
 * Typing must not re-render: the list is rebuilt from scratch on every change
 * and that would take the caret out of the field on the first keystroke. The
 * value is saved (debounced) and the only thing repainted is the 行った店
 * tiles, in place, so the average moves while you type.
 */
export function dineAmount(id, v){ P.setAmount(id, v); }
export function dineMemo(id, v){ P.setMemo(id, v); }

// 行った店ビューは 2026-08-08 竹森さん指示で廃止(台帳+「✓行った店」トグルが代替)。
// 集計・グループ化の純関数(src/domain/diningLog.js)はテスト付きで保持している。

// ============================================================
// データ
// ============================================================
export const PRIVACY_TEXT =
  '記録はこのブラウザにだけ保存され、公開サイトでも他人には見えません。ブラウザのデータを消すと失われます。';

/**
 * 保存バー用の短い版（2026-08-16）。
 * 保存バーの文字領域は実測236pxしかなく、全文(823px必要)は7割が省略されて
 * 「ブラウザのデータを消すと失われます」という肝心の警告が読めなかった。
 * 読める長さに切り詰め、全文はホバーの説明と詳細パネル側に残す。
 */
export const PRIVACY_SHORT = 'この端末にだけ保存。消すと失われます';

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

// ---- 時刻の表示（クラウドの節と保存バーが共有） ----

function fileTimeText(d){
  if(!d) return '';
  const p = P.pad2;
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * 第1節「記録の保存先」（2026-08-16 整頓）。
 *
 * 以前はここに3つの節（クラウド／フォルダ自動保存／保存の状態）が並び、
 * 「保存先は◯◯です」を3通りの言い方で同時に名乗っていた。実測で6節1284px、
 * スマホでは4.4画面ぶん。竹森氏の裁定でフォルダ自動保存を廃止し、残りを
 * **この1節に統合**した。画面が答えるのは1つの問いだけ:
 * 「いま、私の記録はどこにあるのか」。
 *
 * 押す保存は無い。書いた瞬間に端末へ、1.2秒後にクラウドへ自動で入る。
 */
function storageSectionHtml(){
  const cs = CS.cloudStatus();
  const st = P.saveStatus();
  const cnt = P.storedCounts();
  const head = `<section class="data-sec"><h3 class="data-h">記録の保存先</h3>`;
  const inventory = cnt.stores
    ? `<div class="data-line">記録 ${num(cnt.stores)}店（訪問 ${num(cnt.visited)} ・ 行きたい ${num(cnt.want)} ・ 感想 ${num(cnt.memo)} ・ 実額 ${num(cnt.amount)}）</div>`
    : `<div class="data-note">${esc(DATA_EMPTY_TEXT)}</div>`;
  const err = st.error ? `<div class="data-warn">⚠ ${esc(st.error)}</div>` : '';

  if(cs.phase === 'conflict'){
    return head + err +
      `<div class="data-warn">⚠ ${esc(cs.conflictText)}</div>` +
      `<div class="data-btns">` +
        `<button type="button" class="data-btn primary" onclick="dineCloudKeepLocal()">この端末の記録を残す</button>` +
        `<button type="button" class="data-btn" onclick="dineCloudKeepCloud()">クラウドの記録を残す</button>` +
      `</div>` +
      `<div class="data-note">選ばなかった方は上書きされます。選んだあとでも、下の「控え」から戻せます。</div>` +
    `</section>`;
  }

  if(cs.phase === 'off' || cs.phase === 'error'){
    const warn = cs.phase === 'error' ? `<div class="data-warn">⚠ ${esc(cs.lastError)}</div>` : '';
    return head + err + warn +
      `<div class="data-warn">⚠ いまは<b>この端末の中だけ</b>に保存されています</div>` +
      inventory +
      `<div class="data-note">ブラウザのデータを消すと失われます。ログインすると、スマホで書いてパソコンで見る、ができるようになります。</div>` +
      `<div class="cloud-form">` +
        `<label class="vb-flabel" for="cloudUser">ユーザー名</label>` +
        `<input type="text" id="cloudUser" class="vb-amt" autocomplete="username" placeholder="例: takemori" value="${esc(cs.username)}">` +
        `<label class="vb-flabel" for="cloudPass">合言葉（6文字以上）</label>` +
        `<input type="password" id="cloudPass" class="vb-amt" autocomplete="current-password" placeholder="他人に推測されないもの">` +
      `</div>` +
      `<div class="data-btns">` +
        `<button type="button" class="data-btn primary" onclick="dineCloudSignIn()">ログイン / はじめる</button>` +
      `</div>` +
      `<div class="data-note">はじめての名前を入れると、その名前で新しく作ります。打ち間違えると別の（空の）記録になるので、作ったときは画面でお知らせします。</div>` +
    `</section>`;
  }

  const busy = cs.phase === 'signing' ? 'つないでいます…' : cs.phase === 'saving' ? '保存中…' : '';
  const synced = cs.lastSyncAt ? '自動保存 ' + esc(fileTimeText(cs.lastSyncAt)) : 'まだ保存していません';
  return head + err +
    `<div class="data-line"><b>☁ ${esc(cs.username)}</b> でログイン中</div>` +
    `<div class="data-line">${synced}${busy ? ' ・ ' + esc(busy) : ''}</div>` +
    inventory +
    `<div class="data-btns">` +
      `<button type="button" class="data-btn" onclick="dineCloudSignOut()">ログアウト</button>` +
    `</div>` +
    `<div class="data-note">保存ボタンはありません。書いた瞬間に自動で保存されます。どの端末でも、このユーザー名でログインすれば同じ記録が出ます。</div>` +
  `</section>`;
}

/**
 * 第2節「控え（自動）」。
 * 人は何も押さない。危険な操作の直前と、その日の最初の変更の前に、
 * 機械が控えを取る（判断は src/domain/snapshots.js）。ここは戻す口だけ。
 */
function snapshotSectionHtml(){
  const list = P.listSnapshots();
  const today = P.localDate();
  const rows = list.map(s =>
    `<div class="data-line">${esc(snapLabel(s, today))}` +
    `<button type="button" class="data-btn" style="padding:1px 8px;margin-left:6px" onclick="dineRestoreSnapshot('${jsStr(s.id)}')">この時点に戻す</button></div>`
  ).join('');
  return `<section class="data-sec"><h3 class="data-h">控え（自動）</h3>` +
    (list.length
      ? `<div class="data-note">押し間違えても戻せるように、消す直前と、日ごとの姿を自動で控えています。</div>` + rows
      : `<div class="data-note">記録を書き始めると、消す直前と日ごとの姿を自動で控えます。まだ控えはありません。</div>`) +
    `<div class="data-btns">` +
      `<button type="button" class="data-btn primary" onclick="dineDownload()">ファイルに保存</button>` +
    `</div>` +
    `<div class="data-note">${esc(EXPORT_LEAD_TEXT)}</div>` +
    `<details class="data-details" id="dataExportBox">` +
      `<summary>JSONで直接あつかう（書き出し・読み込み）</summary>` +
      `<textarea id="dataExport" class="data-area" rows="5" readonly` +
      ` aria-label="${esc(EXPORT_SUMMARY_TEXT)}">${esc(P.currentExportText())}</textarea>` +
      `<div class="data-btns"><button type="button" class="data-btn" onclick="dineSelectExport()">JSONを全選択</button></div>` +
      `<label class="vb-flabel" for="dataImport">貼り付け欄（台帳v9のバックアップも読めます）</label>` +
      `<textarea id="dataImport" class="data-area" rows="4" placeholder='{"app":"kl-dining-ledger", ...}'></textarea>` +
      `<div class="data-btns">` +
        `<button type="button" class="data-btn" onclick="dineImport('merge')">いまの記録に統合</button>` +
        `<button type="button" class="data-btn danger" onclick="dineImport('replace')">まるごと置き換え</button>` +
      `</div>` +
      `<div class="data-result" id="dataResult" role="status" aria-live="polite"></div>` +
    `</details>` +
  `</section>`;
}

function dataViewHtml(){
  // 節は3つだけ（2026-08-16 竹森氏裁定）。それぞれが答える問いは1つ:
  //   ①いま記録はどこにあるか ②間違えたらどう戻すか ③片づけたいときは
  // 以前は6節・実測1284px（スマホ4.4画面）で、同じ事実を3通りの言い方で
  // 同時に名乗っていた。
  const hid = [...P.hiddenIds()];
  const hidden = hid.length
    ? `<div class="data-line">非表示にした店 ${num(hid.length)}件</div>` +
      hid.map(id => {
        const c = diningRecords().find(x => x.id === id);
        return `<div class="data-line">🗑 ${esc(c ? c.name : id)} <button type="button" class="data-btn" style="padding:1px 8px;margin-left:6px" onclick="dineUnhide('${jsStr(id)}')">台帳に戻す</button></div>`;
      }).join('')
    : '';
  return `<div class="dataview">` +
    `<button type="button" class="data-btn" style="margin-bottom:var(--s2)" onclick="setView(&quot;ledger&quot;)">← 台帳にもどる</button>` +
    storageSectionHtml() +
    snapshotSectionHtml() +
    `<section class="data-sec"><h3 class="data-h">片づけ</h3>` +
      hidden +
      `<div class="data-note">記録をすべて消します。消す直前の姿は上の「控え」に残るので、押し間違えても戻せます。</div>` +
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

/**
 * 全消去。確認は**1回だけ**にした（2026-08-16）。
 * 以前は2回聞いて「取り消せません」と脅していたが、いまは消す直前の姿が
 * 自動で控えに残る。戻せるものを2回聞くのは、ただの摩擦。
 */
export function dineClearAll(){
  const n = P.storedCounts().stores;
  if(!n){ toast('消す記録がありません'); return; }
  if(typeof confirm !== 'function') return;
  if(!confirm(`${n}店ぶんの記録を消します。消す直前の姿は「控え」に残るので、あとから戻せます。続けますか？`)) return;
  P.clearAll();
  refresh();
  toast('記録をすべて消しました（控えから戻せます）');
}

/** 控えの1件に戻す。戻す前の姿も控えに入るので、往復できる。 */
export function dineRestoreSnapshot(id){
  const n = P.restoreSnapshot(id);
  if(n === null){ toast('その控えは見つかりませんでした'); return; }
  refresh();
  toast(`控えから ${num(n)}店ぶんを戻しました`);
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

/**
 * 一覧の下の細い帯。言うことは**2つだけ**（2026-08-16 整頓）。
 *
 * 以前は「最終保存/クラウド/ファイル保存/この端末にだけ保存」の4つを連結して
 * いた。文字領域は実測236pxしかなく、必要な高さ53pxに対して35pxしか出せず、
 * **3行目が黙って切れていた**。言うことを絞れば1〜2行に収まる（実測18px/35px）。
 *
 * ログイン中は「誰として保存しているか」を先頭に固定する（竹森氏の明示要望）。
 * 未ログインのときだけ、この端末にしか無いという警告を出す。
 */
export function renderSaveBar(){
  const bar = el('saveBar');
  if(!bar) return;
  if(!eatoutActive()){ bar.style.display = 'none'; return; }
  const st = P.saveStatus();
  const cs = CS.cloudStatus();
  bar.style.display = '';
  const signedIn = cs.phase === 'idle' || cs.phase === 'saving';
  // 赤は「いま壊れている」だけに使う。未ログインは正常な状態のひとつなので、
  // 帯を常時赤くしない（常に赤い警告は、そのうち見えなくなる）。文言の⚠と
  // データ画面の赤枠が役目を負う。
  bar.classList.toggle('bad', !!st.error || cs.phase === 'conflict' || cs.phase === 'error');
  const text = st.error ? '⚠ ' + st.error
    : cs.phase === 'conflict' ? '⚠ クラウドと食い違い（データ管理で選んでください）'
    : cs.phase === 'error' ? '⚠ クラウドに保存できていません（データ管理で確認）'
    : cs.phase === 'signing' ? '☁ 接続中…'
    : signedIn ? `☁ ${cs.username} ・ ${cs.phase === 'saving' ? '保存中…' : savedAtText(st)}`
    : '⚠ ' + PRIVACY_SHORT;
  // データ画面への入口はここ(旧3タブは2026-08-08廃止)。保存の話をする場所に併設。
  bar.innerHTML = `<span class="savebar-text" title="${esc(PRIVACY_TEXT)}">${esc(text)}</span>` +
    `<button type="button" class="savebar-link" onclick="setView('data')">💾 データ管理</button>`;
}

// ============================================================
// クラウド保存の配線（main.jsから起動時に1回）
// ============================================================
export function initCloudSync(){
  // 前回ログインしていれば黙って復帰する。していなければSDKすら読まないので、
  // 公開の顔（住まいモード）は今までどおり。
  CS.initCloud({
    getExportText: () => P.currentExportText(),
    storedCounts: () => P.storedCounts(),
    parseImport: (text) => P.parseImport(text, P.buildPlaceIdMap(diningRecords())),
    replaceAll: (data) => P.replaceAll(data),
    // クラウドから記録が入れ替わったら、**どの画面を見ていても**追随させる。
    // 以前は listView === 'data' のときだけ再描画していたため、台帳や詳細
    // パネルを見ている最中に復元が走ると「保存はされたのに画面が変わらない」
    // X1と同じ症状が残っていた（2026-08-16 影響範囲sweep）。
    onStatus: () => { renderSaveBar(); if(eatoutActive()) onChanged(); },
  });
  // 記録が変わったらクラウドへも書きスルー（デバウンスはcloudStore側）
  P.onPersonalChange(() => CS.cloudNotifyChanged());
}

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
  if(listView === 'data') return dataViewHtml();
  return null;
}

/** Kept for the list header: how many records the 台帳 view is showing. */
