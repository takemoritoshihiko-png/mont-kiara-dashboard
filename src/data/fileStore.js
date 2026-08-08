// ファイルDBの殻 — File System Access API に触る唯一の場所（A案 2026-08-08）。
//
// 役割分担:
//   判断（いつ書く・いつ止まる）      → src/domain/fileSync.js（純・テスト対象）
//   記録そのものの読み書き            → src/data/personal.js（従来どおり唯一の書き込み口）
//   ここ                              → フォルダ握手・ファイルIO・ハンドルのIndexedDB保存
//
// personal.js は一切書き換えない。onPersonalChange を購読し、保存が起きるたび
// 封筒テキストをデバウンス付きでファイルへ写す（書きスルー）。復元だけは逆向きで、
// parseImport / replaceAll という既存のドア越しに行う。
//
// 対応外ブラウザ（Firefox/Safari）では supported=false のまま何もしない。
// 従来の localStorage + 手動書き出しがそのまま生きる（何も失わない）。
//
// FSA の createWritable() は一時領域へ書き close() で差し替えるため、
// 書き込み途中でPCが落ちてもファイルは壊れない（仕様挙動）。

import {
  RECORDS_FILENAME, BACKUP_DIR, BACKUP_KEEP, FILE_WRITE_MS,
  backupName, pruneBackups, reconcile, preWriteCheck, readEnvelope,
} from '../domain/fileSync.js';

// ---- 依存はinitで注入（importの循環を作らない・テストでも差し替え可能） ----
let deps = null;   // { getExportText, cacheCount, sameData, restore, localDate, onStatus }

// ---- 状態（UIが読む） ----
// phase: unsupported | off | reauth | idle | saving | conflict | error
let phase = 'unsupported';
let dirName = '';
let lastWriteAt = null;
let lastError = '';
let dirHandle = null;
let lastWritten = null;      // 自分が最後に書いた封筒の exported（メモリ+localStorageメタ）
let timer = null;
let writing = false;
let rearmed = false;         // 書き込み中に次の変更が来たら true → 終わり次第もう一周

export const META_KEY = 'mkd_dining_file_meta_v1';

export function fileStatus(){
  return { phase, dirName, lastWriteAt, error: lastError,
           supported: typeof showDirectoryPicker === 'function' };
}

const listeners = new Set();
export function onFileChange(fn){ listeners.add(fn); return () => listeners.delete(fn); }
function emit(){ listeners.forEach(fn => { try { fn(fileStatus()); } catch {} }); }
function setPhase(p, err){ phase = p; lastError = err || ''; emit(); }

// ---- メタ（スタンプの控え）。ブラウザ掃除で消えても reconcile が安全側に倒す ----
function loadMeta(){
  try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch { return {}; }
}
function saveMeta(patch){
  try {
    localStorage.setItem(META_KEY, JSON.stringify({ ...loadMeta(), ...patch }));
  } catch {}
}

// ---- ハンドルの永続化（構造化クローン可能なのは IndexedDB だけ） ----
const IDB_NAME = 'mkd-file-db', IDB_STORE = 'handles', IDB_KEY = 'dir';
function idb(){
  return new Promise((res, rej) => {
    const r = indexedDB.open(IDB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbSet(v){
  const db = await idb();
  await new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(v, IDB_KEY);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
  db.close();
}
async function idbGet(){
  const db = await idb();
  const v = await new Promise((res, rej) => {
    const rq = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(IDB_KEY);
    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
  });
  db.close();
  return v || null;
}
async function idbDel(){
  const db = await idb();
  await new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(IDB_KEY);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
  db.close();
}

// ---- ファイルIO ----
async function readMain(){
  try {
    const fh = await dirHandle.getFileHandle(RECORDS_FILENAME);
    const text = await (await fh.getFile()).text();
    return { exists: true, text, env: readEnvelope(text) };
  } catch(e){
    if(e && e.name === 'NotFoundError') return { exists: false, text: '', env: null };
    throw e;
  }
}

async function writeMain(text){
  const fh = await dirHandle.getFileHandle(RECORDS_FILENAME, { create: true });
  const w = await fh.createWritable();      // 一時領域→close()でアトミック差し替え
  await w.write(text);
  await w.close();
}

/** 日次バックアップ: その日の最初の書き込み後に1回。7世代より古い自作分だけ剪定。 */
async function dailyBackup(text){
  const today = deps.localDate();
  if(loadMeta().backupDate === today) return;
  const dir = await dirHandle.getDirectoryHandle(BACKUP_DIR, { create: true });
  const fh = await dir.getFileHandle(backupName(today), { create: true });
  const w = await fh.createWritable();
  await w.write(text);
  await w.close();
  const names = [];
  for await (const name of dir.keys()) names.push(name);
  for(const n of pruneBackups(names, BACKUP_KEEP)){
    try { await dir.removeEntry(n); } catch {}
  }
  saveMeta({ backupDate: today });
}

// ---- 書きスルー本体 ----
async function writeThrough(){
  if(!dirHandle || writing) { rearmed = writing; return; }
  writing = true;
  setPhase('saving');
  try {
    const cur = await readMain();
    const stamp = cur.env ? cur.env.stamp : null;
    if(preWriteCheck({ fileStamp: stamp, lastWritten }) === 'conflict'){
      setPhase('conflict',
        '保存ファイルが別の場所で更新されています。データビューでどちらを残すか選んでください。');
      return;
    }
    const text = deps.getExportText();
    await writeMain(text);
    const env = readEnvelope(text);
    lastWritten = env ? env.stamp : null;
    saveMeta({ stamp: lastWritten });
    lastWriteAt = new Date();
    setPhase('idle');
    await dailyBackup(text);
  } catch(e){
    setPhase('error', 'ファイルへの保存に失敗しました（' + (e && e.message || e) + '）');
  } finally {
    writing = false;
    if(rearmed){ rearmed = false; scheduleWrite(); }
  }
}

function scheduleWrite(){
  if(!dirHandle || phase === 'conflict' || phase === 'off') return;
  if(timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; writeThrough(); }, FILE_WRITE_MS);
}

// ---- 接続・再開・突合 ----
async function afterConnect(){
  dirName = dirHandle.name;
  lastWritten = loadMeta().stamp ?? null;
  const cur = await readMain();
  const plan = reconcile({
    cacheCount: deps.cacheCount(),
    fileCount: cur.env ? cur.env.count : null,
    fileStamp: cur.env ? cur.env.stamp : null,
    lastWritten,
    sameData: cur.env ? deps.sameData(cur.text) : false,
  });
  if(plan === 'restore-from-file'){
    const r = deps.restore(cur.text);
    if(!r.ok){ setPhase('error', 'ファイルの内容を読めませんでした: ' + r.error); return; }
    lastWritten = cur.env.stamp;
    saveMeta({ stamp: lastWritten });
    lastWriteAt = new Date();
    setPhase('idle');
    deps.onRestored && deps.onRestored(cur.env.count);
    return;
  }
  if(plan === 'conflict'){
    setPhase('conflict',
      'このブラウザの記録と保存ファイルの内容が食い違っています。どちらを残すか選んでください。');
    return;
  }
  if(plan === 'adopt-cache'){ setPhase('idle'); await writeThrough(); return; }
  setPhase('idle');   // noop
}

/** 起動時: 保存済みハンドルがあれば無音で再開を試みる。 */
export async function resumeFileStore(){
  if(typeof showDirectoryPicker !== 'function'){ setPhase('unsupported'); return; }
  try { dirHandle = await idbGet(); } catch { dirHandle = null; }
  if(!dirHandle){ setPhase('off'); return; }
  dirName = dirHandle.name;
  const perm = await dirHandle.queryPermission({ mode: 'readwrite' });
  if(perm === 'granted'){ await afterConnect(); }
  else setPhase('reauth');   // ユーザーの1クリック(=ジェスチャ)を待つ
}

/** データビューの「接続」ボタン（ユーザージェスチャ必須）。 */
export async function connectFileStore(){
  try {
    dirHandle = await showDirectoryPicker({ id: 'mkd-dining', mode: 'readwrite', startIn: 'documents' });
  } catch { return; }   // ピッカーを閉じただけ
  // ハンドル永続化に失敗しても（プライベートモード等）接続はこのセッション限りで生かす
  try { await idbSet(dirHandle); } catch {}
  await afterConnect();
}

/** 「再接続(許可)」ボタン。Chrome 122+ で「毎回許可」を選べば以後は無音。 */
export async function reauthFileStore(){
  if(!dirHandle) return;
  const perm = await dirHandle.requestPermission({ mode: 'readwrite' });
  if(perm === 'granted') await afterConnect();
}

/** 接続の解除。ファイルは消さない（手元に残るのがこの方式の意味）。 */
export async function disconnectFileStore(){
  dirHandle = null; dirName = '';
  try { await idbDel(); } catch {}
  try { localStorage.removeItem(META_KEY); } catch {}
  setPhase('off');
}

/** 競合の解決①: ファイルを正として、このブラウザの記録を置き換える。 */
export async function adoptFile(){
  const cur = await readMain();
  if(!cur.env){ setPhase('error', '保存ファイルを読めませんでした'); return; }
  const r = deps.restore(cur.text);
  if(!r.ok){ setPhase('error', 'ファイルの内容を読めませんでした: ' + r.error); return; }
  lastWritten = cur.env.stamp;
  saveMeta({ stamp: lastWritten });
  setPhase('idle');
}

/** 競合の解決②: このブラウザの記録を正として、ファイルを上書きする。 */
export async function adoptCache(){
  const cur = await readMain();
  lastWritten = cur.env ? cur.env.stamp : null;   // 現物を「見た」上での上書きにする
  setPhase('idle');
  await writeThrough();
}

/**
 * 初期化。personal.js の変更通知を購読して書きスルーを駆動する。
 * personal.js 側は一切変更しない（単一ドア契約の温存）。
 */
export function initFileStore(d){
  deps = d;
  deps.subscribe(() => scheduleWrite());
}
