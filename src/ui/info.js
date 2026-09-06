// Detail overlay shown when a marker or list card is selected.
//
// B3a-2: the overlay carries two tabs — 詳細 (the record's own data) and 周辺
// (what else is within walking / short driving distance). Which tab is open is
// part of the screen state and travels in the URL.
//
// B3b (spec 2.6 / audit C4, C5): the overlay follows the shared visual system.
// The record's name, Japanese name and address live in one header above the
// tabs — they identify the record, so they must not disappear when you switch
// to 周辺. Type colour appears exactly once, as the 3px band at the very top.
// Everything below is one accent (links), grays (structure) and tabular
// numerals. No content was removed in the restyle: fees, philosophy,
// demographics, premium features and awards all still render.
import {
  CONDOS, SCHOOLS_DETAIL, activeLayer, activeTab, appMode,
  setSelectedCondo, setActiveTab,
} from '../state.js';
import { TIER_COLORS, MICHELIN_LABELS } from '../data/inline.js';
import { recordLayer } from '../domain/filter.js';
import { nearby, formatDistance, BUCKET_LABELS, NEARBY_BUCKETS } from '../domain/nearby.js';
import { focusOnRecord, rebuild } from './map.js';
import { renderList, setLayer, setMode, applyFilters, syncCatSubOptions, esc, jsStr, num, priceRangeText, ratingText } from './list.js';
import { eatoutDetailHtml, eatoutRecBadgeHtml, toast } from './dining.js';
import { syncUrl, withUrlWritesSuspended, applyFilterParam } from './urlState.js';

// The record the overlay is currently showing. Kept so a tab switch can
// re-render without going through the whole selection flow again.
let currentRecord = null;

/** The overlay's accessible name when nothing is selected. */
const DIALOG_LABEL_EMPTY = '詳細';

export function closeInfo(){
  const ov = document.getElementById('infoOverlay');
  ov.classList.remove('active');
  ov.setAttribute('aria-label', DIALOG_LABEL_EMPTY);
  currentRecord = null;
  // Nothing is selected any more, so the list highlight, the un-clustered
  // marker and the URL all have to agree with that.
  setSelectedCondo(null);
  setActiveTab('detail');
  rebuild();
  renderList();
  syncUrl();
}

// ============================================================
// SHARED BUILDING BLOCKS
// ============================================================
/**
 * One label/value pair of the key-stats grid. `muted` for 未定 / unknown.
 *
 * The label is Japanese first. `opts.sub` keeps the source's own English term
 * beside it in small type — PSF and NLA are the words iProperty and EdgeProp
 * print, so dropping them would leave nothing to match a listing against.
 * Replacement, not addition, is what breaks that; both together cost one line.
 * `opts.hint` is the tooltip for a figure whose meaning is not self-evident.
 *
 * @param {string} label
 * @param {string} value     already-escaped HTML (callers esc() their data)
 * @param {boolean} [muted]
 * @param {{sub?: string, hint?: string}} [opts]
 */
function kv(label, value, muted, opts = {}){
  const sub = opts.sub ? ` <small class="kv-sub">${esc(opts.sub)}</small>` : '';
  const hint = opts.hint ? ` title="${esc(opts.hint)}"` : '';
  return `<div><div class="kv-label"${hint}>${esc(label)}${sub}</div>` +
    `<div class="kv-val${muted ? ' muted' : ''}">${value}</div></div>`;
}
const kvGrid = (cells) => `<div class="kv-grid">${cells.join('')}</div>`;

/**
 * A block of further information: hairline, caps title, content.
 * `meta` is a second, separate fact about the block (a score, a count) shown at
 * the right of the title. It exists so a title never has to smuggle a number of
 * its own in brackets — 「Premium Features (12/15)」 above a list of 4 items read
 * as a broken count, because the 12 is a weighted score and the list is not.
 */
function section(title, bodyHtml, meta){
  const head = meta
    ? `<div class="info-sec-title"><span>${esc(title)}</span><span class="info-sec-meta">${esc(meta)}</span></div>`
    : `<div class="info-sec-title">${esc(title)}</div>`;
  return `<div class="info-sec">${head}${bodyHtml}</div>`;
}

/**
 * A section whose body starts folded. For blocks that are long prose or a long
 * table (a school's 教育方針 runs to a paragraph, its fee table to 14 rows):
 * open they push everything after them off the panel, so the reader cannot see
 * what a school entry even contains without scrolling past one essay.
 */
function foldedSection(title, bodyHtml){
  return `<div class="info-sec"><details class="data-details">` +
    `<summary>${esc(title)}</summary>${bodyHtml}</details></div>`;
}

/** External links are text buttons in the one accent colour (audit C4). */
function linkBtn(url, label){
  return `<a class="info-link" href="${esc(url)}" target="_blank" rel="noopener">${esc(label)} ↗</a>`;
}

const TYPE_COLOR_VAR = {
  school: 'var(--type-school)',
  commercial: 'var(--type-commercial)',
  condo: 'var(--type-condo)',
  dining: 'var(--type-dining)',
};

/**
 * Google Maps deep link for a restaurant, built from its stable Place ID.
 *
 * Three id shapes exist in restaurants.json (D6 expansion):
 *   ChIJ…               a real Place ID  → place_id deep link
 *   cid:0x…:0x…         a Maps feature id scraped from a share URL — the part
 *                       after the colon is the CID in hex; ?cid= wants decimal
 *   pending:…           no id found yet → no link (the caller falls back to
 *                       nothing rather than a link that opens the wrong shop)
 */
export function googleMapsUrl(placeId){
  if(!placeId) return '';
  if(placeId.startsWith('pending:')) return '';
  if(placeId.startsWith('cid:')){
    const hex = placeId.split(':').pop();
    try { return 'https://maps.google.com/?cid=' + BigInt(hex).toString(10); }
    catch { return ''; }
  }
  return 'https://www.google.com/maps/place/?q=place_id:' + encodeURIComponent(placeId);
}

/**
 * 同じ店の「クチコミ一覧」への入口（2026-08-18 竹森氏「ワンクリックで飛べる
 * ように」）。Google マップの店ページは概要から始まるので、評価の数字を押した
 * 人はもう一手クチコミを開かされていた。
 *
 * この入口が受け取れるのは本物の Place ID だけ。CID しか持たない店は、無リンク
 * にするより地図が開いたほうがましなので地図へ落とす。
 */
export function googleReviewsUrl(placeId){
  if(!placeId || !placeId.startsWith('ChIJ')) return googleMapsUrl(placeId);
  return 'https://search.google.com/local/reviews?placeid=' + encodeURIComponent(placeId);
}

// ============================================================
// 詳細 TAB — the record's own data
// ============================================================
function schoolDetail(c){
  const sd = SCHOOLS_DETAIL[c.name] || {};
  const feeRange = c.sizeMin > 0
    ? (c.sizeMax > 0 ? `RM ${num(c.sizeMin)}–${num(c.sizeMax)}` : `RM ${num(c.sizeMin)}〜`)
    : '要問合せ';
  let h = kvGrid([
    kv('年間学費', esc(feeRange), c.sizeMin <= 0),
    kv('対象年齢', esc(c.ageRange || '—'), !c.ageRange),
    kv('生徒数', esc(sd.student_count_note || (c.units > 0 ? `約 ${num(c.units)}名` : '—')), !(sd.student_count_note || c.units > 0)),
    kv('国籍数', sd.nationalities ? esc(sd.nationalities) + 'ヶ国' : '—', !sd.nationalities),
    // The curriculum is already in the header tagline — printing it again here
    // is exactly the duplication the audit flagged (design principle 1).
    kv('設立', c.year ? esc(c.year) + '年' : '—', !c.year),
  ]);
  if(sd.brand) h += section('運営', `<div class="info-sec-body">${esc(sd.brand)}</div>`);
  // The two long blocks fold. Nothing is removed — 教育方針 and the full fee
  // table are one tap away — but a reader comparing three schools sees all
  // three panels' shape instead of scrolling through one school's prose.
  if(sd.philosophy) h += foldedSection('教育方針', `<div class="info-sec-body">${esc(sd.philosophy)}</div>`);
  if(sd.fees){
    let t = '<table class="info-fees">';
    for(const [k, v] of Object.entries(sd.fees)){
      t += `<tr><td>${esc(k)}</td><td>RM ${num(v)}</td></tr>`;
    }
    t += '</table>';
    if(sd.other_fees) t += `<div class="info-note">${esc(sd.other_fees)}</div>`;
    h += foldedSection('学年別 年間授業料 (RM)', t);
  }
  if(sd.top_nationalities && sd.top_nationalities !== 'Not publicly disclosed'){
    let b = `<div class="info-sec-body">${esc(sd.top_nationalities)}</div>`;
    if(sd.japanese_community && sd.japanese_community !== 'Not specifically highlighted'){
      b += `<div class="info-sec-body" style="margin-top:var(--s1)">🇯🇵 ${esc(sd.japanese_community)}</div>`;
    }
    h += section('生徒の属性', b);
  }
  return h;
}

function commercialDetail(c){
  const cells = [
    kv('テナント数', c.units > 0 ? `約 ${num(c.units)}店` : '—', !(c.units > 0)),
    // NLA (Net Lettable Area) is the term every Malaysian mall factsheet and
    // REIT report uses, so it stays next to the Japanese.
    kv('賃貸面積', c.sizeMin > 0 ? `${num(c.sizeMin)} sf` : '—', !(c.sizeMin > 0), { sub: 'NLA' }),
    kv('開業', c.year ? esc(c.year) + '年' : '—', !c.year),
  ];
  // The CSV has carried a developer/owner for all 88 malls since it was built;
  // the panel simply never showed it. Omitted when blank rather than shown as
  // 「—」: an unknown owner is not a fact worth a cell.
  if(c.developer) cells.push(kv('運営 / デベロッパー', esc(c.developer)));
  let h = kvGrid(cells);
  if(c.anchorTenants) h += section('主なテナント', `<div class="info-sec-body">${esc(c.anchorTenants)}</div>`);
  return h;
}

function diningDetail(c){
  // Lunch and dinner are two separate offers, so they stay two cells: a place
  // that only serves dinner says so instead of showing a zero for lunch.
  const lunch = priceRangeText(c.priceLunch);
  const dinner = priceRangeText(c.priceDinner);
  // 評価はその店のクチコミ一覧への入口を兼ねる（2026-08-08 依頼／2026-08-18に
  // 行き先を概要からクチコミへ変更）。pending: の店はリンク先が無いので素のまま。
  const gr = googleReviewsUrl(c.placeId);
  const ratingCell = gr && c.rating > 0
    ? `<a class="kv-link" href="${esc(gr)}" target="_blank" rel="noopener"` +
      ` title="Googleのクチコミを見る">${esc(ratingText(c))} ↗</a>`
    : esc(ratingText(c) || '—');
  // 推奨バッジ(⭐軸)。外食モード限定ヘルパーが自分でガードするので此処は素通し。
  // 裁定注記(recNote)は「なぜこの区分か」を1行で読者に言う。
  const recB = eatoutRecBadgeHtml(c);
  const recLine = recB
    ? `<div class="info-sec-body rec-line">${recB}${c.recNote ? ' — ' + esc(c.recNote) : ''}</div>` : '';
  let h = recLine + kvGrid([
    kv('ミシュラン', esc(MICHELIN_LABELS[c.michelin] || '—'), c.michelin === 'none' || !c.michelin),
    kv('Google評価', ratingCell, !(c.rating > 0)),
    kv('昼 / 1人', esc(lunch || '—'), !lunch),
    // Mont Kiaraから車の渋滞込み目安(OSRM free-flow×1.8)。無い店は正直に—。
    kv('車で(MKから)', c.driveMinJam != null ? esc('約'+c.driveMinJam+'分 ('+c.driveKm+'km)') : '—', c.driveMinJam == null, { hint: 'Mont Kiara中心からの目安。渋滞を含めた概算(空いていれば'+(c.driveMinFree!=null?c.driveMinFree+'分':'—')+')' }),
    kv('夜 / 1人', esc(dinner || '—'), !dinner),
    // 大分類＞小分類の順で両方出す(2026-08-15 竹森さん裁定)。一覧カード・地図の
    // 吹き出し・絞り込みは大分類、ここだけ小分類…という食い違いが「ステーキが
    // 別の画面では洋食になっている」に見えていた。片方しか無い店は在る方だけ。
    // 中東・バー・屋台街のように大小が同じ名前の分類は1つだけ出す(「中東 ＞ 中東」を出さない)。
    kv('カテゴリ', esc([...new Set([c.catGroup, c.cat].filter(Boolean))].join(' ＞ ') || '—'), !(c.cat || c.catGroup)),
    // kidOk: 1 = family-friendly, 0 = a judged "suits adults" (v9's wording),
    // null = the expansion research found no evidence either way — say nothing
    // rather than guess.
    kv('子連れ', c.kidOk === 1 ? '◎ 向いている' : c.kidOk === 0 ? '大人向き' : '—', c.kidOk !== 1),
  ]);
  if(c.priceNote) h += section('価格の注記' + (c.priceConfidence ? `（${c.priceConfidence}）` : ''),
    `<div class="info-sec-body">${esc(c.priceNote)}</div>`);
  if(c.area || c.venue){
    const place = [c.area, c.venue].filter(Boolean).join(' ・ ');
    h += section('場所', `<div class="info-sec-body">${esc(place)}</div>`);
  }
  // The two halves of the reputation. Shown together and always both, because
  // a page that prints only the praise is an advert, not a ledger.
  const vox = c.vox || {};
  h += section('支持される点', `<div class="info-sec-body">${esc(vox.pros || '—')}</div>`);
  h += section('割れる点・不満', `<div class="info-sec-body">${esc(vox.cons || '—')}</div>`);
  if(c.editorNote) h += section('編集メモ', `<div class="info-sec-body">${esc(c.editorNote)}</div>`);
  // 外食モードだけ: 台帳スコアと自分の記録。住まいモードでは空文字＝一切出ない。
  h += eatoutDetailHtml(c);
  return h;
}

function condoDetail(c){
  const upcoming = c.status === 'upcoming';
  const cells = [
    kv('竣工', c.year ? esc(c.year) + '年' : '—', !c.year),
    kv('総戸数', c.units > 0 ? num(c.units) : '—', !(c.units > 0)),
  ];
  // PSF (per square foot) is the unit iProperty and EdgeProp quote, so it is
  // kept beside 売買単価 — you need it to match a listing you found there.
  const PSF = { sub: 'PSF' };
  if(upcoming){
    cells.push(kv('売買単価', '未定', true, PSF));
    cells.push(kv('賃料 / 月', '未定', true));
  } else {
    cells.push(kv('売買単価', c.salePsfMin > 0 ? `RM ${num(c.salePsfMin)}–${num(c.salePsfMax)}` : '—', !(c.salePsfMin > 0), PSF));
    cells.push(kv('賃料 / 月', c.rentMin > 0 ? `RM ${num(c.rentMin)}–${num(c.rentMax)}` : '—', !(c.rentMin > 0)));
  }
  cells.push(kv('広さ', c.sizeMin > 0 ? `${num(c.sizeMin)}–${num(c.sizeMax)} sf` : '—', !(c.sizeMin > 0)));
  // Not a published figure: it is this app's own 100-point index, and the label
  // has to say so or it reads as something the developer claims.
  cells.push(kv('Luxuryスコア', c.luxScore > 0 ? `${c.luxScore} / 100` : '—', !(c.luxScore > 0),
    { sub: '独自算出', hint: 'このアプリが独自に算出した100点満点の指標です（公表値ではありません）' }));
  let h = kvGrid(cells);
  if(c.fiabciAward){
    h += section('🏆 FIABCI Malaysia Property Award',
      `<div class="info-sec-body">${esc(c.fiabciAward.year)} ${esc(c.fiabciAward.category || '')}</div>`);
  }
  if(c.premiumScore > 0){
    const pf = [];
    if(c.pLift) pf.push('🔑 専用エレベーター');
    if(c.pConcierge) pf.push('🛎️ コンシェルジュ');
    if(c.pLowDensity >= 3) pf.push('🏠 1フロア3戸以下');
    else if(c.pLowDensity >= 2) pf.push('🏠 1フロア5戸以下');
    else if(c.pLowDensity >= 1) pf.push('🏠 1フロア8戸以下');
    if(c.pPool) pf.push('🏊 50mプール');
    if(c.pSkyLounge) pf.push('🌆 スカイラウンジ');
    if(c.pEV) pf.push('⚡ EV充電');
    // Two facts, told as two: the list is WHICH facilities, the meta is HOW
    // WELL EQUIPPED. They are not the same count — premium_score is weighted
    // (private lift ×7, concierge ×2), so 「(12/15)」 printed on a heading above
    // four items read as an error. Named separately, neither lies.
    // One <span> per facility, not one run of text separated by spaces: Japanese
    // breaks between any two characters, so 「1フロア3戸以下」 wrapped as 「1」 /
    // 「フロア3戸以下」 at the panel's width. Each item now wraps as a unit.
    h += section('主な設備',
      `<div class="info-feature-list">${pf.map(f => `<span>${f}</span>`).join('')}</div>`,
      `充実度 ${c.premiumScore}/15`);
  }
  return h;
}

/** The external links of a record, in a fixed order so the row never jumps. */
function linksHtml(c){
  const links = [];
  if(c.status === 'school'){
    const sd = SCHOOLS_DETAIL[c.name] || {};
    if(c.homepageUrl) links.push(linkBtn(c.homepageUrl, '公式サイト'));
    if(sd.fees_url) links.push(linkBtn(sd.fees_url, '学費'));
    if(sd.admissions_url) links.push(linkBtn(sd.admissions_url, '入学'));
  } else if(c.status === 'dining'){
    // The ledger has no homepage column; the Place ID is the stable handle, and
    // Google Maps is where the hours, the phone number and the route live.
    const g = googleMapsUrl(c.placeId);
    if(g) links.push(linkBtn(g, 'Google マップ'));
    // KLの運転ナビはWazeが実用(2026-08-08採用)。座標があれば直接ナビ起動リンク。
    if(c.lat != null) links.push(linkBtn('https://waze.com/ul?ll=' + c.lat + ',' + c.lng + '&navigate=yes', 'Wazeでナビ'));
  } else {
    if(c.homepageUrl) links.push(linkBtn(c.homepageUrl, '公式サイト'));
    if(c.ipropertyUrl) links.push(linkBtn(c.ipropertyUrl, 'iProperty'));
  }
  return links.length ? `<div class="info-links">${links.join('')}</div>` : '';
}

/**
 * The 詳細 tab's body for any record. Pure (it reads SCHOOLS_DETAIL for schools
 * and nothing else), so it is exported for the tests the same way cardBodyHtml
 * is — a panel that quietly stops rendering a field is otherwise invisible.
 */
export function detailHtml(c){
  const body = c.status === 'school' ? schoolDetail(c)
    : c.status === 'commercial' ? commercialDetail(c)
    : c.status === 'dining' ? diningDetail(c)
    : condoDetail(c);
  return body + linksHtml(c);
}

// ============================================================
// 周辺 TAB — what else is within walking / driving distance
// ============================================================
const LAYER_ICONS = { condo: '🏠', school: '🎓', commercial: '🛒', dining: '🍽' };
const COUNT_LABELS = { school: '学校', commercial: '商業', dining: '飲食', condo: '物件' };
// The count line reads 「学校 2 ・ 商業 1 ・ 飲食 4 ・ 物件 5」 — the environment
// first, because that is what you are asking about when you open this tab. The
// nearby engine itself is layer-agnostic; this is only the reading order.
const COUNT_ORDER = ['school', 'commercial', 'dining', 'condo'];
// Up to five per layer per bucket: enough to see the picture, short enough to
// stay scannable in a 300px panel.
const MAX_PER_LAYER = 5;

function nearbyRow(item){
  const c = item.record;
  const label = `${c.name}、${formatDistance(item.distanceM)}`;
  return `<div class="nb-row" role="button" tabindex="0" aria-label="${esc(label)}"` +
    ` onclick="selectNearby('${jsStr(c.name)}')" title="${esc(c.name)}">` +
    `<span class="nb-icon">${LAYER_ICONS[recordLayer(c)]}</span>` +
    `<span class="nb-name">${esc(c.name)}</span>` +
    `<span class="nb-dist">${formatDistance(item.distanceM)}</span></div>`;
}

function bucketHtml(b){
  if(!b.total) return '';
  const counts = COUNT_ORDER
    .filter(k => b.counts[k] > 0)
    .map(k => `${COUNT_LABELS[k]} ${b.counts[k]}`)
    .join(' ・ ');
  const rows = COUNT_ORDER
    .map(k => b.byLayer[k].slice(0, MAX_PER_LAYER).map(nearbyRow).join(''))
    .join('');
  return `<div class="nb-bucket">` +
    `<div class="nb-head">${BUCKET_LABELS[b.maxM] || b.maxM + 'm'}</div>` +
    `<div class="nb-counts">${counts}</div>${rows}</div>`;
}

function nearbyTabHtml(c){
  const buckets = nearby(c, CONDOS, { buckets: NEARBY_BUCKETS });
  const h = buckets.map(bucketHtml).join('');
  // Isolated records (some Penang entries) genuinely have nothing around them.
  return h || `<div class="nb-empty">6km圏内に登録データがありません</div>`;
}

/** Jump to a record listed in the 周辺 tab, crossing layers when needed. */
export function selectNearby(name){
  const r = CONDOS.find(x => x.name === name);
  if(!r) return;
  const layer = recordLayer(r);
  // X2 fix: 外食モードは層を飲食に固定する契約（CLAUDE.md / test/eatoutMode.
  // test.js）。setLayer() 自身はそれを知らないので、飲食以外を無条件で渡すと
  // 見出しは「外食台帳」のまま一覧だけ差し替わり、層セグが隠れているので
  // 画面から戻す手段も無くなる。押した意味を消さないよう、住まいモードへ
  // 移ってからその層を開く（(a)案・2026-08-16 裁定）。
  const crossingFromEatout = appMode === 'eatout' && layer !== 'dining';
  withUrlWritesSuspended(() => {
    if(crossingFromEatout) setMode('home');
    // The layer switch is part of one navigation, not a step of its own:
    // writing its URL here would leave a half-updated entry in the history.
    if(layer !== activeLayer) setLayer(layer);
  });
  if(crossingFromEatout) toast('住まいモードに切り替えました（右上の「外食」で戻れます）');
  selectCondo(name);
}

// ============================================================
// RENDER / TABS
// ============================================================
function tabBtn(tab, label){
  const on = activeTab === tab;
  return `<button type="button" class="info-tab${on ? ' active' : ''}" role="tab"` +
    ` aria-selected="${on ? 'true' : 'false'}" onclick="setInfoTab('${tab}')">${label}</button>`;
}

/** Name / Japanese name / address / type line — shared by both tabs. */
function headerHtml(c){
  const layer = recordLayer(c);
  const tag = [];
  if(layer === 'condo'){
    const tierColor = TIER_COLORS[c.luxTier] || '#999';
    tag.push(`<span class="tier-badge" style="background:${tierColor}">${esc(c.luxTier)}</span>`);
    if(c.developer) tag.push(esc(c.developer));
  } else if(layer === 'school'){
    tag.push('🎓 ' + esc(c.curriculum || c.anchorTenants || '学校'));
  } else if(layer === 'dining'){
    tag.push('🍽 ' + esc(c.catGroup || '飲食店'));
  } else {
    tag.push('🛒 商業施設');
  }
  // The header sticks to the top of the scrolling overlay, so the ✕ is always
  // reachable — it used to scroll out of sight on a long school entry. The ✕
  // lives here rather than in index.html so it travels with the sticky block.
  return `<div class="info-sticky">` +
    `<div class="info-band" style="background:${TYPE_COLOR_VAR[layer]}"></div>` +
    `<button type="button" class="info-close" aria-label="閉じる" onclick="closeInfo()">✕</button>` +
    `<div class="info-head">` +
    `<div class="info-name">${esc(c.name)}</div>` +
    (c.nameJa ? `<div class="info-ja">${esc(c.nameJa)}</div>` : '') +
    `<div class="info-addr">${esc(c.addr)}</div>` +
    `<div class="info-tagline">${tag.join(' ')}</div>` +
    `</div></div>`;
}

function renderInfo(){
  const c = currentRecord;
  if(!c) return;
  const body = activeTab === 'nearby' ? nearbyTabHtml(c) : detailHtml(c);
  document.getElementById('infoContent').innerHTML =
    headerHtml(c) +
    `<div class="info-tabs" role="tablist" aria-label="表示する内容">${tabBtn('detail', '詳細')}${tabBtn('nearby', '周辺')}</div>` +
    `<div class="info-tab-body">${body}</div>`;
}

/**
 * X1 fix: re-render the open overlay after a personal record changes
 * elsewhere (dineVisit / dineWant / dineRepeat / dineHide). Those only ran
 * applyFilters() before, so ✓訪問済み・訪問日・再訪意向・感想欄 never appeared
 * until the overlay was closed and reopened — the record WAS saved, the panel
 * just never redrew.
 *
 * Does nothing when no overlay is open (nothing to redraw) and does nothing
 * while the user is mid-keystroke in the overlay's own 実額/感想 fields —
 * visitBoxHtml(c,'info') is the only place those two ids carry the 'info'
 * namespace, so checking the focused id is enough to know a redraw would cut
 * off typing.
 */
export function refreshInfoIfOpen(){
  if(!currentRecord) return;
  const active = typeof document !== 'undefined' ? document.activeElement : null;
  const tag = active && active.tagName;
  const id = active && active.id;
  if((tag === 'TEXTAREA' || tag === 'INPUT') && id &&
     (id.startsWith('amt-info-') || id.startsWith('memo-info-'))) return;
  renderInfo();
}

export function setInfoTab(tab){
  if(tab !== 'detail' && tab !== 'nearby') return;
  if(tab === activeTab) return;
  setActiveTab(tab);
  renderInfo();
  // Switching tabs refines the current view — it must not stack history.
  syncUrl({ replace: true });
}

/**
 * @param {string} name  the record's name (the app's identifier everywhere)
 * @param {{tab?: string}} [opts]  which tab to open. Defaults to 詳細: picking a
 *   new record always starts from its own data.
 */
export function selectCondo(name, opts = {}){
  // Clicking a dimmed background marker adopts its layer (home mode): before
  // this, the detail opened while the list, filters and summary stayed on the
  // old layer — two "current things" on one screen (audit C). 外食モード pins
  // its layer, so there the detail simply opens.
  const rec = CONDOS.find(x => x.name === name);
  // Dining pins can be checked onto the home map now: peeking at one opens
  // its detail but must NOT yank the app into 外食モード (setLayer('dining')
  // would). The 外食 door stays the chip name / the mode switch.
  if(rec && appMode === 'home' && recordLayer(rec) !== activeLayer && recordLayer(rec) !== 'dining'){
    withUrlWritesSuspended(() => setLayer(recordLayer(rec)));
  }
  setActiveTab(opts.tab === 'nearby' ? 'nearby' : 'detail');
  setSelectedCondo(name);
  const c=CONDOS.find(x=>x.name===name);
  if(c){
    // Do not move what the user just pressed: from a city-wide view the
    // selection zooms in (you cannot see what you picked otherwise), but once
    // you are comparing inside a neighbourhood the zoom is yours and the map
    // only pans, and only far enough to get the pin out from under this panel.
    focusOnRecord(c.lat, c.lng);
    // Redraw the markers so the newly selected one gets its accent ring and
    // leaves the cluster (spec 2.7 / audit D3). closeInfo() does the same on
    // the way out, which is what removes the ring again.
    rebuild();
    currentRecord = c;
    renderInfo();
    const ov = document.getElementById('infoOverlay');
    // The dialog is named after what it is showing, not "詳細" for every record.
    ov.setAttribute('aria-label', c.name + ' の詳細');
    ov.classList.add('active');
    // A selection is navigation: it earns its own history entry.
    syncUrl();
  }
  renderList();
  document.querySelectorAll('.condo-card').forEach(card=>{if(card.querySelector('.card-name')?.textContent===name)card.scrollIntoView({behavior:'smooth',block:'nearest'});});
}

/**
 * Put the screen into the state a URL describes. Used on first load and on
 * every popstate; URL writes are suspended by the caller so restoring never
 * creates history of its own.
 */
export function applyUrlState(s){
  // Mode first: 外食モード pins the layer, so restoring the layer before the
  // mode would set it twice and leave the sort on the wrong default.
  if(s.mode) setMode(s.mode, { silent: true });
  // selectNearby と同じ穴がここにもあった（2026-08-16 影響範囲sweepで検出）:
  // `?mode=eatout&layer=school` のようなURLを開くと、外食モードのまま一覧だけ
  // 学校に化け、層セグが隠れているので画面から戻せなくなる。URLは手で編集も
  // 共有もされるので、リンク経由でもモードと層は必ず噛み合わせる。
  if(s.layer && s.layer !== activeLayer){
    if(appMode === 'eatout' && s.layer !== 'dining') setMode('home', { silent: true });
    setLayer(s.layer);
  }
  // Filters travel in the URL too (?f=fRent:0-20000|...): write them into
  // the controls, then re-run the filters so the shared link shows what the
  // sender saw.
  // 小分類(fCat)の選択肢は大分類が決まって初めて生まれるので、一度書いてから
  // 選択肢を作り直し、もう一度書く。二度目は同じ値を入れ直すだけ(冪等)で、
  // 一度目に落ちた小分類だけが今度は刺さる。
  if(s.f && applyFilterParam(s.f) > 0){
    syncCatSubOptions();
    applyFilterParam(s.f);
    applyFilters();
  }
  // An unknown name (renamed or removed record) is ignored rather than shown as
  // an error — a stale bookmark should still open a usable map.
  if(s.sel && CONDOS.some(x => x.name === s.sel)) selectCondo(s.sel, { tab: s.tab || 'detail' });
  else if(currentRecord) closeInfo();
}
