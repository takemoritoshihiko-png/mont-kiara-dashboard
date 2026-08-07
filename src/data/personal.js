// 個人記録 — the one place this app writes anything the user typed.
//
// 外食モード carries six pieces of memory per restaurant, inherited from 台帳v9:
//
//   w    行きたい            1 / 0
//   v    訪問済み            1 / 0
//   vd   訪問日              "YYYY-MM-DD" — stamped when v flips on
//   rv   また行きたいか      'a' また行く / 'm' 機会があれば / 'n' もういい / ''
//   m    感想                free text (multi-line since D4; v9 was one line)
//   amt  実際に払った額      ringgit per head, kept as typed
//
// It lives in localStorage under one key, on the reader's own machine. The
// published site is a static page with no server and no account, so there is
// nowhere else it could go — and nothing here is ever sent anywhere.
//
// Three v9 defects are fixed here rather than carried over (inventory §9):
//   1. the visit date was taken from toISOString() (UTC), so a meal logged
//      before 08:00 in Malaysia was filed under the previous day. localDate()
//      reads the local calendar.
//   2. the accessor wrote: `ST[id] || (ST[id] = {})` meant merely DRAWING the
//      list created 50 empty records. getEntry() below cannot write.
//   3. an unreadable / unwritable storage was only discovered when the first
//      save failed. initPersonal() probes it at startup so the UI can say so
//      before anything is typed.
//
// Everything above `initPersonal` is pure and tested directly.

/** localStorage key. Versioned: a future shape change gets a new key. */
export const STORAGE_KEY = 'mkd_dining_personal_v1';
/** Written and removed at startup to prove the storage accepts writes. */
export const PROBE_KEY = 'mkd_probe_v1';

/** Export envelope. `app` is v9's, so a v9 backup is recognisable as a sibling. */
export const EXPORT_APP = 'kl-dining-ledger';
export const EXPORT_VER = 10;

/** Restaurant ids are R + 4 digits (restaurants.json). */
export const ID_RE = /^R\d{4}$/;

/** The 再訪意向 values, in the order the 行った店 view groups them. */
export const REPEAT_VALUES = ['a', 'm', 'n'];
export const REPEAT_LABELS = { a: 'また行く', m: '機会があれば', n: 'もういい', '': '未回答' };

/** Debounce for typed fields. Buttons save immediately; typing does not. */
export const TYPING_SAVE_MS = 250;

// ============================================================
// PURE HELPERS
// ============================================================
/**
 * Today's date on the *local* calendar, as YYYY-MM-DD.
 *
 * `toISOString()` would answer in UTC. Malaysia is UTC+8, so between midnight
 * and 08:00 it names yesterday — and dinner logged on the way home is exactly
 * when that happens.
 */
export function localDate(d = new Date()){
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** A record with nothing in it. A fresh object every call — never shared. */
export function emptyEntry(){
  return { w: 0, v: 0, vd: '', rv: '', m: '', amt: '' };
}

const flag = (v) => (v === 1 || v === '1' || v === true ? 1 : 0);
const text = (v) => (v == null ? '' : String(v));

/** Coerce anything that came out of storage or an import into the six fields. */
export function normalizeEntry(raw){
  if(!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyEntry();
  const rv = text(raw.rv);
  return {
    w: flag(raw.w),
    v: flag(raw.v),
    vd: /^\d{4}-\d{2}-\d{2}$/.test(text(raw.vd)) ? text(raw.vd) : '',
    rv: REPEAT_VALUES.includes(rv) ? rv : '',
    m: text(raw.m),
    amt: text(raw.amt).trim(),
  };
}

/** True when a record holds nothing worth storing. */
export function isEmptyEntry(e){
  return !e || (!e.w && !e.v && !e.vd && !e.rv && !text(e.m).trim() && !text(e.amt).trim());
}

/** The amount as a number. '' / '—' / 'abc' are 0, never a fake price. */
export function amountValue(e){
  const n = parseFloat(String((e && e.amt) || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Drop unknown keys and empty records. Used on load, import and export. */
export function normalizeStore(obj){
  const out = {};
  if(!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
  for(const [k, v] of Object.entries(obj)){
    if(!ID_RE.test(k)) continue;
    const e = normalizeEntry(v);
    if(!isEmptyEntry(e)) out[k] = e;
  }
  return out;
}

/** placeId → R#### , built from the ledger itself. */
export function buildPlaceIdMap(records){
  const map = {};
  for(const r of (records || [])){
    if(r && r.placeId && ID_RE.test(String(r.id || ''))) map[r.placeId] = r.id;
  }
  return map;
}

/**
 * Read a backup. Accepts three shapes, because all three exist in the wild:
 *   - this app's envelope           {app, ver, exported, data:{R0001:{…}}}
 *   - 台帳v9's envelope (ver 9)     {app, ver, exported, data:{placeId:{…}}}
 *   - a bare object                 {placeId or R####: {…}}
 *
 * Keys that are neither an id nor a known placeId are COUNTED and reported
 * rather than dropped in silence — a paste that quietly imported 3 of 40
 * records would look like a success.
 *
 * @returns {{ok:boolean, error?:string, data:object,
 *            stats:{total:number, kept:number, converted:number,
 *                   unknown:number, unknownKeys:string[], empty:number}}}
 */
export function parseImport(input, placeIdMap = {}){
  const fail = (error) => ({ ok: false, error, data: {}, stats: emptyStats() });
  let obj = input;
  if(typeof input === 'string'){
    const t = input.trim();
    if(!t) return fail('貼り付け欄が空です。');
    try { obj = JSON.parse(t); }
    catch(e){ return fail('JSONとして読めませんでした: ' + e.message); }
  }
  if(!obj || typeof obj !== 'object' || Array.isArray(obj)) return fail('記録の形になっていません（オブジェクトではありません）。');
  const body = (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) ? obj.data : obj;
  if(!body || typeof body !== 'object' || Array.isArray(body)) return fail('記録の形になっていません（data がオブジェクトではありません）。');

  const stats = emptyStats();
  const data = {};
  for(const [k, v] of Object.entries(body)){
    stats.total++;
    let id = null;
    if(ID_RE.test(k)) id = k;
    else if(placeIdMap[k]){ id = placeIdMap[k]; stats.converted++; }
    if(!id){
      stats.unknown++;
      if(stats.unknownKeys.length < 5) stats.unknownKeys.push(k);
      continue;
    }
    const e = normalizeEntry(v);
    if(isEmptyEntry(e)){ stats.empty++; continue; }
    data[id] = e;
    stats.kept++;
  }
  return { ok: true, data, stats };
}

function emptyStats(){
  return { total: 0, kept: 0, converted: 0, unknown: 0, unknownKeys: [], empty: 0 };
}

/** 「40件中 38件を取り込みました（placeIdから変換 38件／不明なキー 2件: …）」 */
export function importSummaryText(stats, mode){
  const how = mode === 'replace' ? '置き換えました' : '取り込みました';
  const parts = [`${stats.total}件中 ${stats.kept}件を${how}`];
  if(stats.converted) parts.push(`v9のIDから変換 ${stats.converted}件`);
  if(stats.empty) parts.push(`中身が空 ${stats.empty}件`);
  if(stats.unknown) parts.push(`このアプリに無い店 ${stats.unknown}件（${stats.unknownKeys.join(', ')}${stats.unknown > stats.unknownKeys.length ? ' ほか' : ''}）`);
  return parts.join(' ／ ');
}

/**
 * 統合 — merge a backup into what is already here, field by field.
 *
 * **統合 only ever adds.** A field the file has a value for overwrites; a field
 * the file leaves blank keeps whatever is here. That is deliberate: a v9 backup
 * writes only the fields that were ever touched, so treating its blanks as
 * "set this to empty" would silently erase a memo the file simply never carried.
 * Erasing is what 置き換え is for, and it asks first.
 */
function mergeEntry(base, inc){
  const b = normalizeEntry(base), i = normalizeEntry(inc);
  return normalizeEntry({
    w: i.w || b.w,
    v: i.v || b.v,
    vd: i.vd || b.vd,
    rv: i.rv || b.rv,
    m: i.m.trim() ? i.m : b.m,
    amt: i.amt ? i.amt : b.amt,
  });
}

export function mergeStores(base, incoming){
  const out = normalizeStore(base);
  for(const [k, v] of Object.entries(normalizeStore(incoming))){
    out[k] = out[k] ? mergeEntry(out[k], v) : v;
  }
  return out;
}

/** The backup object. Same envelope as v9, one version up. */
export function buildExport(store, now = new Date()){
  return {
    app: EXPORT_APP,
    ver: EXPORT_VER,
    exported: now.toISOString(),
    data: normalizeStore(store),
  };
}

/** The backup as text — indent 1, the way v9 wrote it (small, still readable). */
export function exportText(store, now){
  return JSON.stringify(buildExport(store, now), null, 1);
}

/** Suggested filename: one per day, sorted by name. */
export function exportFilename(now = new Date()){
  return `mkd-dining-${localDate(now)}.json`;
}

// ============================================================
// THE STORE — the only mutable state in this module
// ============================================================
let store = {};
let backend = null;          // the storage object, or null when unusable
let writable = false;
let storageError = '';
let savedAt = null;          // Date of the last successful write
let timer = null;
const listeners = new Set();

/** Subscribe to "the saved state changed". Used by the save bar. */
export function onPersonalChange(fn){ listeners.add(fn); return () => listeners.delete(fn); }
function emit(){ listeners.forEach(fn => { try { fn(saveStatus()); } catch(e){ /* a broken listener must not lose the data */ } }); }

/**
 * Probe the storage, load what is there, and report whether writes work.
 *
 * @param {{storage?: object, now?: Date}} [deps]  seams for the test.
 * @returns {{writable:boolean, error:string, count:number}}
 */
export function initPersonal({ storage, now = new Date() } = {}){
  backend = storage !== undefined ? storage
    : (typeof localStorage !== 'undefined' ? localStorage : null);
  store = {};
  writable = false;
  storageError = '';
  savedAt = null;
  if(!backend){
    storageError = 'このブラウザは保存領域を使えません。記録は画面を閉じると消えます。';
    emit();
    return { writable: false, error: storageError, count: 0 };
  }
  // Read first — a storage that reads but refuses writes (Safari private mode,
  // a full quota) still has the user's earlier records in it.
  try {
    const raw = backend.getItem(STORAGE_KEY);
    if(raw) store = normalizeStore(JSON.parse(raw));
  } catch(e){
    storageError = '保存済みの記録を読めませんでした: ' + e.message;
  }
  // Then prove it accepts a write, before the user types anything into it.
  try {
    backend.setItem(PROBE_KEY, '1');
    backend.removeItem(PROBE_KEY);
    writable = true;
  } catch(e){
    writable = false;
    storageError = '記録を保存できない設定になっています（' + e.message +
      '）。データビューから書き出して控えてください。';
  }
  if(writable && !storageError) savedAt = Object.keys(store).length ? now : null;
  emit();
  return { writable, error: storageError, count: Object.keys(store).length };
}

/** @returns {{writable:boolean, error:string, savedAt:Date|null, count:number}} */
export function saveStatus(){
  return { writable, error: storageError, savedAt, count: Object.keys(store).length };
}

/**
 * One restaurant's record. READ ONLY — a copy, and a miss does NOT create.
 * This is the fix for v9's 欠陥2: rendering the list must not write 50 rows.
 */
export function getEntry(id){
  const e = store[id];
  return e ? { ...e } : emptyEntry();
}

/** True when this restaurant has been written to at all. */
export function hasEntry(id){ return Object.prototype.hasOwnProperty.call(store, id); }

/** Every record, as a plain object copy. */
export function allEntries(){
  const out = {};
  for(const [k, v] of Object.entries(store)) out[k] = { ...v };
  return out;
}

// ---- writing ----
function writeNow(){
  if(timer){ clearTimeout(timer); timer = null; }
  if(!backend) return false;
  try {
    backend.setItem(STORAGE_KEY, JSON.stringify(store));
    savedAt = new Date();
    writable = true;
    storageError = '';
    emit();
    return true;
  } catch(e){
    writable = false;
    storageError = '保存に失敗しました（' + e.message + '）。データビューから書き出して控えてください。';
    emit();
    return false;
  }
}

let pendingDirty = false;

/** Persist whatever is pending, right now. Called on pagehide/visibilitychange. */
export function flush(){ if(timer || pendingDirty) return writeNow(); return true; }

function schedule({ immediate }){
  pendingDirty = true;
  if(immediate){ pendingDirty = false; writeNow(); return; }
  if(timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; pendingDirty = false; writeNow(); }, TYPING_SAVE_MS);
}

/**
 * The single write path. Every setter below funnels through here, so an empty
 * record is always pruned and the save is always scheduled the same way.
 */
function apply(id, patch, { immediate = true } = {}){
  if(!ID_RE.test(String(id))) return getEntry(id);
  const next = normalizeEntry({ ...(store[id] || emptyEntry()), ...patch });
  if(isEmptyEntry(next)) delete store[id];
  else store[id] = next;
  schedule({ immediate });
  return { ...next };
}

/** 行きたい. Flipping it on does not touch anything else. */
export function toggleWant(id){
  const cur = getEntry(id);
  return apply(id, { w: cur.w ? 0 : 1 });
}

/**
 * 訪問済み.
 *
 * Turning it ON clears 行きたい (you went — it is no longer a plan) and stamps
 * today's date if there is none yet. Turning it OFF clears ONLY the flag: the
 * memo, the amount, the verdict and the date stay, so an accidental tap costs
 * nothing and turning it back on restores everything. That is v9's behaviour
 * and the reason the aggregates count 訪問済み records only — see
 * src/domain/diningLog.js.
 */
export function setVisited(id, on, now = new Date()){
  if(on){
    const cur = getEntry(id);
    return apply(id, { v: 1, w: 0, vd: cur.vd || localDate(now) });
  }
  return apply(id, { v: 0 });
}

/** また行きたいか. Pressing the same choice again returns to 未回答. */
export function setRepeat(id, rv){
  const cur = getEntry(id);
  const next = (cur.rv === rv) ? '' : rv;
  return apply(id, { rv: next });
}

/** 実額 and 感想 are typed, so they debounce instead of writing per keystroke. */
export function setAmount(id, v){ return apply(id, { amt: v }, { immediate: false }); }
export function setMemo(id, v){ return apply(id, { m: v }, { immediate: false }); }

/** 読み込み（統合）: field-by-field merge, the file winning. */
export function mergeAll(incoming){
  store = mergeStores(store, incoming);
  writeNow();
  return Object.keys(store).length;
}

/** 読み込み（置き換え）: the file becomes the whole record. */
export function replaceAll(incoming){
  store = normalizeStore(incoming);
  writeNow();
  return Object.keys(store).length;
}

/** 全消去. */
export function clearAll(){
  store = {};
  writeNow();
  return 0;
}

/** The backup text for whatever is stored right now. */
export function currentExportText(now){ return exportText(store, now); }

/**
 * 記録の中身の内訳 — what is in storage, not what your dining looks like.
 * (The dining figures live in src/domain/diningLog.js and count 訪問済み only.)
 */
export function storedCounts(){
  const e = Object.values(store);
  return {
    stores: e.length,
    visited: e.filter(x => x.v === 1).length,
    want: e.filter(x => x.w === 1).length,
    memo: e.filter(x => String(x.m).trim() !== '').length,
    amount: e.filter(x => amountValue(x) > 0).length,
  };
}
