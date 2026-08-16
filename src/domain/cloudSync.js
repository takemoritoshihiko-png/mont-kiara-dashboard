// クラウド同期の「判断」だけを持つ純関数群（2026-08-16）。
//
// 役割分担は fileSync.js と同じ考え方:
//   判断（どちらを残すか・書いてよいか） → ここ（純・テスト対象）
//   Firebase との通信                    → src/data/cloudStore.js
//   記録そのものの読み書き               → src/data/personal.js（唯一の書き込み口）
//
// なぜこの層を分けるか: 2026-08-16、スマホの記録が丸ごと消える事故が起きた。
// 原因はバックアップが端末の中にしか無かったこと。クラウドに移すこと自体は
// 素直だが、**同期は「消す」方向にも働く**ので、消す判断はテストできる形で
// ここに閉じ込める。UIやネットワークの都合で判断が変わってはいけない。

/** ユーザー名として許すのは、英小文字・数字・ハイフン・アンダースコアの3〜20文字。 */
export const USERNAME_RE = /^[a-z0-9_-]{3,20}$/;
/** 合言葉の最低の長さ。Firebase 側の下限が6なので、それに合わせる。 */
export const PASSPHRASE_MIN = 6;
/** ユーザー名からログイン用のアドレスを作る（Firebaseはメール形式を要求する）。 */
export const USER_DOMAIN = 'mkd.local';

/**
 * 入力の検分。**通信の前に**弾く（弱い合言葉でアカウントが作られてから
 * 気づく、を避ける）。
 * @returns {{ok: true, email: string} | {ok: false, why: string}}
 */
export function checkCredentials(username, passphrase){
  const u = String(username == null ? '' : username).trim().toLowerCase();
  const p = String(passphrase == null ? '' : passphrase);
  if(!u) return { ok: false, why: 'ユーザー名を入れてください' };
  if(!USERNAME_RE.test(u)){
    return { ok: false, why: 'ユーザー名は英小文字・数字・ハイフン・アンダースコアの3〜20文字で入れてください' };
  }
  if(p.length < PASSPHRASE_MIN){
    return { ok: false, why: `合言葉は${PASSPHRASE_MIN}文字以上にしてください` };
  }
  return { ok: true, email: `${u}@${USER_DOMAIN}` };
}

/** ログイン用アドレスからユーザー名に戻す（画面に出すのは名前だけ）。 */
export function usernameFromEmail(email){
  const s = String(email == null ? '' : email);
  const at = s.indexOf('@');
  return at > 0 ? s.slice(0, at) : s;
}

/**
 * ログインした直後に、この端末とクラウドのどちらを正とするか。
 *
 * **片方が空のときは絶対に自動で同期しない**、が最重要の一行。
 * 新しい端末で初めてログインした瞬間に、空っぽがクラウドを消す——これが
 * この種の同期でいちばん多い事故なので、機械には決めさせない。
 *
 * @param {{count:number, text:string}} local  この端末の記録（text=書き出し封筒）
 * @param {{count:number, text:string}|null} cloud クラウドの記録（無ければ null）
 * @returns {{action:'none'|'upload'|'download'|'ask', why:string}}
 */
export function decideInitialSync(local, cloud){
  const lc = (local && local.count) || 0;
  const cc = (cloud && cloud.count) || 0;
  const lt = (local && local.text) || '';
  const ct = (cloud && cloud.text) || '';

  if(!lc && !cc) return { action: 'none', why: 'どちらにも記録がない' };
  if(lc && !cc) return { action: 'upload', why: 'クラウドが空なので、この端末の記録を預ける' };
  if(!lc && cc) return { action: 'download', why: 'この端末が空なので、クラウドの記録を受け取る' };
  if(sameEnvelope(lt, ct)) return { action: 'none', why: '中身が同じ' };
  return { action: 'ask', why: '両方に記録があり、中身が違う' };
}

/**
 * 封筒2つが「同じ記録か」。
 * 書き出した時刻(exported)は毎回変わるので、そこは見ない——時刻の差だけで
 * 「違う」と判定すると、開くたびに衝突の問い合わせが出てしまう。
 */
export function sameEnvelope(a, b){
  const na = normalizeEnvelope(a);
  const nb = normalizeEnvelope(b);
  return na != null && na === nb;
}

/**
 * 比較用に、時刻など毎回変わる項目を落とした形にする。壊れていれば null。
 * 封筒の中身は `data`（src/data/personal.js の buildExport）。
 */
export function normalizeEnvelope(text){
  if(typeof text !== 'string' || !text.trim()) return null;
  try {
    const o = JSON.parse(text);
    if(!o || typeof o !== 'object' || Array.isArray(o)) return null;
    const records = o.data;
    if(!records || typeof records !== 'object' || Array.isArray(records)) return null;
    // キー順に並べ直してから文字列化（順序の違いを「変更」と誤認しない）
    const keys = Object.keys(records).sort();
    return JSON.stringify(keys.map(k => [k, records[k]]));
  } catch { return null; }
}

/**
 * 記録が変わったとき、クラウドへ書いてよいか。
 *
 * 「全部消す」を人が明示的に押した場合は 0 件を書けなければならないので、
 * 件数がゼロというだけでは止めない。止めるのは**ログインしていない**時と、
 * **封筒が壊れている**時だけ。壊れた封筒で上書きすると復旧できなくなる。
 *
 * @returns {{ok:boolean, why:string}}
 */
export function canPush(signedIn, envelopeText){
  if(!signedIn) return { ok: false, why: 'ログインしていない' };
  if(normalizeEnvelope(envelopeText) == null) return { ok: false, why: '書き出しの中身が読めない' };
  return { ok: true, why: '' };
}

/** 衝突の説明文。人が選ぶための材料を、数字で並べる。 */
export function conflictText(local, cloud){
  const lc = (local && local.count) || 0;
  const cc = (cloud && cloud.count) || 0;
  const at = (cloud && cloud.updatedAt) || '';
  return `この端末に ${lc}店、クラウドに ${cc}店の記録があり、中身が違います`
    + (at ? `（クラウドの最終更新: ${at}）` : '')
    + '。どちらを残すか選んでください。選ばなかった方は上書きされます。';
}
