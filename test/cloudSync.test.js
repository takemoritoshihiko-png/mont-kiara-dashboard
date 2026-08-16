// クラウド同期の判断（src/domain/cloudSync.js）。
//
// 2026-08-16、スマホの記録が丸ごと消える事故が起きた（端末の中にしか無かった）。
// クラウドに移す対策そのものが、今度は「消す」方向の事故を持ち込む。
// **片方が空のときは絶対に自動で同期しない** が、このファイルで守る一線。
import { describe, it, expect } from 'vitest';
import {
  checkCredentials, usernameFromEmail, decideInitialSync, sameEnvelope,
  normalizeEnvelope, canPush, conflictText, USERNAME_RE, PASSPHRASE_MIN, USER_DOMAIN,
} from '../src/domain/cloudSync.js';

/** 封筒（src/data/personal.js の buildExport と同じ形）を作る。 */
const env = (records, exported = '2026-08-16T00:00:00.000Z') =>
  JSON.stringify({ app: 'kl-dining-ledger', ver: 10, exported, data: records });

const R1 = { R0001: { w: 0, v: 1, vd: '2026-08-09', rv: 'a', m: '美味しかった', amt: '120', h: 0 } };
const R2 = { R0002: { w: 1, v: 0, vd: '', rv: '', m: '', amt: '', h: 0 } };

describe('入力の検分（通信の前に弾く）', () => {
  it('よくある入力を通す', () => {
    const r = checkCredentials('takemori', 'himitsu123');
    expect(r.ok).toBe(true);
    expect(r.email).toBe(`takemori@${USER_DOMAIN}`);
  });

  it('大文字や前後の空白は整えてから使う（打ち間違いで別人になるのを防ぐ）', () => {
    expect(checkCredentials('  TakeMori ', 'himitsu123').email).toBe(`takemori@${USER_DOMAIN}`);
  });

  it('空・短すぎ・使えない文字は理由つきで断る', () => {
    for(const [u, p] of [['', 'himitsu123'], ['ab', 'himitsu123'], ['竹森', 'himitsu123'], ['a b', 'himitsu123']]){
      const r = checkCredentials(u, p);
      expect(r.ok, `${u} が通ってしまった`).toBe(false);
      expect(r.why.length).toBeGreaterThan(0);
    }
  });

  it('合言葉が短ければ断る（Firebase側の下限に合わせる）', () => {
    expect(checkCredentials('takemori', '12345').ok).toBe(false);
    expect(checkCredentials('takemori', '123456').ok).toBe(true);
    expect(PASSPHRASE_MIN).toBe(6);
  });

  it('ユーザー名の規則は英小文字・数字・ハイフン・アンダースコアの3〜20文字', () => {
    expect(USERNAME_RE.test('a-b_c9')).toBe(true);
    expect(USERNAME_RE.test('A'.repeat(3))).toBe(false);
    expect(USERNAME_RE.test('a'.repeat(21))).toBe(false);
  });

  it('画面に出すのは名前だけ（アドレスに戻せる）', () => {
    expect(usernameFromEmail(`takemori@${USER_DOMAIN}`)).toBe('takemori');
    expect(usernameFromEmail('')).toBe('');
  });
});

describe('ログイン直後にどちらを正とするか', () => {
  it('どちらも空なら何もしない', () => {
    expect(decideInitialSync({ count: 0, text: env({}) }, null).action).toBe('none');
  });

  it('クラウドが空なら、この端末の記録を預ける', () => {
    const d = decideInitialSync({ count: 1, text: env(R1) }, null);
    expect(d.action).toBe('upload');
  });

  it('この端末が空なら、クラウドの記録を受け取る', () => {
    const d = decideInitialSync({ count: 0, text: env({}) }, { count: 1, text: env(R1) });
    expect(d.action).toBe('download');
  });

  it('中身が同じなら何もしない（書き出し時刻の違いは無視する）', () => {
    const a = { count: 1, text: env(R1, '2026-08-16T01:00:00.000Z') };
    const b = { count: 1, text: env(R1, '2026-08-16T09:99:00.000Z') };
    expect(decideInitialSync(a, b).action).toBe('none');
  });

  it('キーの並び順が違うだけでは「違う」と言わない', () => {
    const a = env({ ...R1, ...R2 });
    const b = env({ ...R2, ...R1 });
    expect(sameEnvelope(a, b)).toBe(true);
  });

  // ここが本丸。機械に決めさせない。
  it('両方に記録があって中身が違うときは、必ず人に聞く', () => {
    const d = decideInitialSync({ count: 1, text: env(R1) }, { count: 1, text: env(R2) });
    expect(d.action).toBe('ask');
  });

  it('件数が同じでも中身が違えば聞く（件数だけで同一視しない）', () => {
    const changed = { R0001: { ...R1.R0001, m: '書き換えた' } };
    const d = decideInitialSync({ count: 1, text: env(R1) }, { count: 1, text: env(changed) });
    expect(d.action).toBe('ask');
  });

  it('自動で download / upload になるのは、片方が空のときだけ', () => {
    // 総当たり: 両方に中身があるとき、自動同期は絶対に起きない
    const cases = [
      [{ count: 3, text: env(R1) }, { count: 1, text: env(R2) }],
      [{ count: 1, text: env(R2) }, { count: 9, text: env(R1) }],
    ];
    for(const [l, c] of cases){
      expect(['ask', 'none']).toContain(decideInitialSync(l, c).action);
    }
  });
});

describe('壊れた封筒で上書きしない', () => {
  it('読めない中身は同一とみなさない', () => {
    expect(sameEnvelope('', '')).toBe(false);
    expect(sameEnvelope('not json', 'not json')).toBe(false);
    expect(normalizeEnvelope(JSON.stringify({ app: 'x' }))).toBe(null);
    expect(normalizeEnvelope(JSON.stringify({ data: [] }))).toBe(null);
  });

  it('ログインしていなければ書かない', () => {
    expect(canPush(false, env(R1)).ok).toBe(false);
  });

  it('封筒が壊れていれば書かない（復旧できなくなるため）', () => {
    expect(canPush(true, 'not json').ok).toBe(false);
    expect(canPush(true, '').ok).toBe(false);
  });

  it('0件は書ける（「全部消す」を人が押した結果は正当）', () => {
    expect(canPush(true, env({})).ok).toBe(true);
  });
});

describe('衝突の説明', () => {
  it('件数と最終更新を数字で出し、上書きされる側があることを言う', () => {
    const t = conflictText({ count: 12 }, { count: 3, updatedAt: '2026-08-15 21:00' });
    expect(t).toContain('12店');
    expect(t).toContain('3店');
    expect(t).toContain('2026-08-15 21:00');
    expect(t).toContain('上書き');
  });
});
