// クラウド保存の殻 — Firebase に触る唯一の場所（2026-08-16）。
//
// 役割分担（fileStore.js と同じ形）:
//   判断（どちらを残すか・書いてよいか） → src/domain/cloudSync.js（純・テスト対象）
//   記録そのものの読み書き               → src/data/personal.js（唯一の書き込み口）
//   ここ                                 → ログイン・読み書き・状態の保持
//
// personal.js は書き換えない。onPersonalChange を購読して、保存が起きるたびに
// 封筒テキストをデバウンス付きでクラウドへ写す（fileStore と同じ書きスルー）。
// 復元だけは逆向きで、parseImport / replaceAll という既存のドア越しに行う。
//
// なぜ必要か: 2026-08-16、スマホの記録が丸ごと消えた。iOS Safari は7日間
// 開かないと保存内容を自動削除し、アプリ内ブラウザは別の保存領域を持つ。
// 端末の中だけに置く設計では、いつか必ず消える。

import { FIREBASE_CONFIG, SDK_BASE } from './cloudConfig.js';
import {
  checkCredentials, usernameFromEmail, decideInitialSync, canPush, conflictText,
} from '../domain/cloudSync.js';

// ---- 依存はinitで注入（importの循環を作らない・テストでも差し替え可能） ----
let deps = null;   // { getExportText, storedCounts, replaceAll, onStatus }

// ---- 状態（UIが読む） ----
// phase: off | signing | idle | saving | conflict | error
let phase = 'off';
let username = '';
let lastSyncAt = null;
let lastError = '';
let conflict = null;      // { localText, localCount, cloudText, cloudCount, updatedAt, text }
let timer = null;
let writing = false;
let rearmed = false;

let sdk = null;           // { auth, db, fns… } — 読み込み後に埋まる
let user = null;

/** 書き込みの合流（連打で毎回通信しない）。 */
export const CLOUD_WRITE_MS = 1200;
/** ログイン状態を覚えておくキー（Firebaseの永続化と別に、UIの初期表示用）。 */
export const CLOUD_META_KEY = 'mkd_cloud_meta_v1';

export function cloudStatus(){
  return { phase, username, lastSyncAt, lastError, conflict, conflictText: conflict ? conflict.text : '' };
}

function setPhase(p, err){
  phase = p;
  lastError = err || '';
  if(deps && deps.onStatus) deps.onStatus(cloudStatus());
}

// ============================================================
// SDK の読み込み（必要になった時だけ）
// ============================================================
async function loadSdk(){
  if(sdk) return sdk;
  // 変数経由の動的importにしているのはVite対策 — 文字列リテラルだと
  // ビルド時に解決しようとして、CDNのURLを掴めずに失敗する。
  const appUrl = `${SDK_BASE}/firebase-app.js`;
  const authUrl = `${SDK_BASE}/firebase-auth.js`;
  const fsUrl = `${SDK_BASE}/firebase-firestore.js`;
  const [appMod, authMod, fsMod] = await Promise.all([
    import(/* @vite-ignore */ appUrl),
    import(/* @vite-ignore */ authUrl),
    import(/* @vite-ignore */ fsUrl),
  ]);
  const app = appMod.initializeApp(FIREBASE_CONFIG);
  const auth = authMod.getAuth(app);
  // 「2回目からは自動でログイン済み」にする。端末を変えたときだけ入力。
  await authMod.setPersistence(auth, authMod.browserLocalPersistence).catch(() => {});
  sdk = {
    auth,
    db: fsMod.getFirestore(app),
    signIn: authMod.signInWithEmailAndPassword,
    createUser: authMod.createUserWithEmailAndPassword,
    signOutFn: authMod.signOut,
    onAuth: authMod.onAuthStateChanged,
    doc: fsMod.doc,
    getDoc: fsMod.getDoc,
    setDoc: fsMod.setDoc,
  };
  return sdk;
}

// ============================================================
// 起動時の配線
// ============================================================
/**
 * @param {object} d { getExportText, storedCounts, replaceAll, onStatus }
 * 前回ログインしていれば黙って復帰する。していなければ何もしない
 * （SDKすら読まない）。
 */
export function initCloud(d){
  deps = d;
  let meta = null;
  try { meta = JSON.parse(localStorage.getItem(CLOUD_META_KEY) || 'null'); } catch { meta = null; }
  if(!meta || !meta.username) { setPhase('off'); return; }
  // 覚えている名前を先に出しておく（読み込みの間、画面が空にならないように）
  username = meta.username;
  setPhase('signing');
  resume().catch(e => setPhase('error', errText(e)));
}

async function resume(){
  const s = await loadSdk();
  await new Promise(resolve => {
    const off = s.onAuth(s.auth, (u) => { off(); user = u; resolve(); });
  });
  if(!user){ username = ''; setPhase('off'); return; }
  username = usernameFromEmail(user.email);
  saveMeta();
  await afterSignIn();
}

function saveMeta(){
  try { localStorage.setItem(CLOUD_META_KEY, JSON.stringify({ username })); } catch { /* 保存できなくても動く */ }
}
function clearMeta(){
  try { localStorage.removeItem(CLOUD_META_KEY); } catch { /* noop */ }
}

// ============================================================
// ログイン / ログアウト
// ============================================================
/**
 * ログイン。無ければ作る。
 * @returns {Promise<{ok:boolean, created?:boolean, why?:string}>}
 */
export async function cloudSignIn(usernameInput, passphrase){
  const check = checkCredentials(usernameInput, passphrase);
  if(!check.ok) return { ok: false, why: check.why };
  setPhase('signing');
  try {
    const s = await loadSdk();
    let created = false;
    try {
      const cred = await s.signIn(s.auth, check.email, passphrase);
      user = cred.user;
    } catch(e){
      // 初回は「作る」。ここを黙って作ると、打ち間違いが別人の空アカウントに
      // なって「記録が消えた」に見えるので、呼び出し側が必ず名乗る。
      if(isNotFound(e)){
        const cred = await s.createUser(s.auth, check.email, passphrase);
        user = cred.user;
        created = true;
      } else {
        throw e;
      }
    }
    username = usernameFromEmail(user.email);
    saveMeta();
    await afterSignIn();
    return { ok: true, created };
  } catch(e){
    setPhase('error', errText(e));
    return { ok: false, why: errText(e) };
  }
}

/** ログアウト。**この端末の記録は消さない**（クラウドから離れるだけ）。 */
export async function cloudSignOut(){
  try {
    if(sdk) await sdk.signOutFn(sdk.auth);
  } catch { /* 失敗しても画面はログアウト扱いにする */ }
  user = null;
  username = '';
  conflict = null;
  clearMeta();
  setPhase('off');
}

function isNotFound(e){
  const c = (e && e.code) || '';
  return c === 'auth/user-not-found' || c === 'auth/invalid-credential' || c === 'auth/invalid-login-credentials';
}

function errText(e){
  const c = (e && e.code) || '';
  if(c === 'auth/wrong-password' || c === 'auth/invalid-credential') return 'ユーザー名か合言葉が違います';
  if(c === 'auth/email-already-in-use') return 'そのユーザー名は既に使われています';
  if(c === 'auth/weak-password') return '合言葉が短すぎます';
  if(c === 'auth/network-request-failed') return 'ネットワークにつながりません';
  if(c === 'auth/too-many-requests') return '試行が多すぎます。少し待ってからやり直してください';
  if(c === 'permission-denied') return 'クラウド側に拒否されました（規則の設定を確認してください）';
  return (e && e.message) ? String(e.message) : '不明なエラー';
}

// ============================================================
// 同期
// ============================================================
function userDoc(){ return sdk.doc(sdk.db, 'users', user.uid); }

async function readCloud(){
  const snap = await sdk.getDoc(userDoc());
  if(!snap.exists()) return null;
  const d = snap.data() || {};
  return {
    text: typeof d.envelope === 'string' ? d.envelope : '',
    count: typeof d.count === 'number' ? d.count : 0,
    updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : '',
  };
}

async function writeCloud(text, count){
  await sdk.setDoc(userDoc(), {
    envelope: text,
    count,
    ver: 10,
    updatedAt: new Date().toISOString(),
  });
  lastSyncAt = new Date();
}

/** ログイン直後。**片方が空のときしか自動で動かない**（判断は cloudSync.js）。 */
async function afterSignIn(){
  const localText = deps.getExportText();
  const localCount = deps.storedCounts().stores;
  const cloud = await readCloud();
  const d = decideInitialSync({ count: localCount, text: localText }, cloud);
  if(d.action === 'upload'){
    await writeCloud(localText, localCount);
  } else if(d.action === 'download'){
    applyCloud(cloud.text);
    lastSyncAt = new Date();
  } else if(d.action === 'ask'){
    conflict = {
      localText, localCount,
      cloudText: cloud.text, cloudCount: cloud.count,
      updatedAt: cloud.updatedAt,
      text: conflictText({ count: localCount }, { count: cloud.count, updatedAt: shortTime(cloud.updatedAt) }),
    };
    setPhase('conflict');
    return;
  }
  conflict = null;
  setPhase('idle');
}

function applyCloud(text){
  const parsed = deps.parseImport(text);
  if(!parsed.ok) throw new Error('クラウドの記録が読めませんでした: ' + parsed.error);
  deps.replaceAll(parsed.data);
}

/** 衝突の決着: この端末を残す。 */
export async function cloudKeepLocal(){
  if(!conflict) return;
  const c = conflict;
  conflict = null;
  setPhase('saving');
  try {
    await writeCloud(c.localText, c.localCount);
    setPhase('idle');
  } catch(e){ setPhase('error', errText(e)); }
}

/** 衝突の決着: クラウドを残す。 */
export async function cloudKeepCloud(){
  if(!conflict) return;
  const c = conflict;
  conflict = null;
  setPhase('saving');
  try {
    applyCloud(c.cloudText);
    lastSyncAt = new Date();
    setPhase('idle');
  } catch(e){ setPhase('error', errText(e)); }
}

/**
 * 記録が変わったときに呼ばれる（personal.js の購読口から）。
 * デバウンスして書く。衝突の決着がつくまでは書かない — 人が選ぶ前に
 * どちらかで上書きしてしまうのが、いちばん取り返しがつかない。
 */
export function cloudNotifyChanged(){
  if(phase !== 'idle' && phase !== 'saving') return;
  if(writing){ rearmed = true; return; }
  clearTimeout(timer);
  timer = setTimeout(() => { pushNow().catch(() => {}); }, CLOUD_WRITE_MS);
}

async function pushNow(){
  const text = deps.getExportText();
  const gate = canPush(!!user, text);
  if(!gate.ok) return;
  writing = true;
  setPhase('saving');
  try {
    await writeCloud(text, deps.storedCounts().stores);
    setPhase('idle');
  } catch(e){
    setPhase('error', errText(e));
  } finally {
    writing = false;
    if(rearmed){ rearmed = false; cloudNotifyChanged(); }
  }
}

/** 手で今すぐ同期する（画面のボタン用）。 */
export async function cloudSyncNow(){
  if(!user) return;
  clearTimeout(timer);
  await pushNow();
}

function shortTime(iso){
  if(!iso) return '';
  const d = new Date(iso);
  if(isNaN(d)) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
