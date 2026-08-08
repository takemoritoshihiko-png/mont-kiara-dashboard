// 推奨軸 — 「本当に美味しいお店だよ」の別軸(2026-08-08 竹森氏裁定・純関数)。
//
// 設計の根拠と経緯は docs/superpowers/specs/2026-08-08-dining-purpose-rethink.md。
// 原則:
//   1. 数値を合成しない。推奨は「理由が1行で言えるカテゴリ」だけで決まる。
//   2. 保存するのは素材(裁定 recDivergence / 閉店 closed / 実測値)のみ。
//      ティアはここで毎回導出する — 二重管理を作らない。
//   3. 家族の記録が最上位。「また行く」は外部評価を飛び越えて鉄板、
//      「もういい」はどんな受賞歴でも推奨から外す(家族拒否権)。
//
// 乖離(権威あり×群衆弱)の扱い — 2026-08-08の実勢調査(検証A)の結論:
//   調査した全乖離店で「味の劣化」は確認されず、真因は価格期待値ギャップ・
//   祝祭/団体時の運営ブレ・行列(供給構造)だった。よって乖離の解釈は機械で
//   決めず、recDivergence('tsuu'=通好み / 'recheck'=データ不足で保留)という
//   裁定フィールドで人が与える。裁定が無い乖離だけが 'caution' に落ちる。

/** 群衆シグナルが「強い」— D7発見ロジックのバーと同じ水準。 */
export function crowdStrong(c){
  if(!c || !(c.rating > 0)) return false;
  return (c.rating >= 4.4 && c.reviewCount >= 300) ||
         (c.rating >= 4.6 && c.reviewCount >= 100);
}

/** 群衆シグナルが「弱い」(乖離の検知線)。 */
export function crowdWeak(c){
  // rating は生JSONでは null、parseRestaurants 後は 0 になる — どちらも「弱い」ではなく「無い」。
  return !!c && c.rating > 0 && c.rating < 4.3;
}

/** 独立した権威の署名があるか(ミシュラン、または受賞タグ)。 */
export function hasAuthority(c){
  if(!c) return false;
  return (c.michelin && c.michelin !== 'none') || ((c.extraFlags || []).length > 0);
}

/**
 * 推奨ティア。返り値は enum:
 *   'closed'     閉店・休業(推奨から自動除外)
 *   'teppan'     鉄板 — 家族が「また行く」
 *   'veto'       家族が「もういい」(推奨から除外。バッジは出さない)
 *   'double'     二重確証 — 権威×群衆強が独立に一致
 *   'tsuu'       通好み — 乖離に根拠ある説明が付いた店(条件つき推奨)
 *   'caution'    要注意 — 乖離に説明が無い(推奨から除外)
 *   'authority'  権威単独
 *   'crowd'      群衆単独
 *   'unverified' 未確証 — 評価値なし/データ不足の裁定(recheck)
 *   'weak'       弱シグナル(推奨から除外)
 *
 * @param {object} c      restaurants.json のレコード
 * @param {object} [e]    personal.js の記録 {v,w,rv,...}(無ければ外部評価のみ)
 */
export function recTier(c, e){
  if(!c) return 'weak';
  if(c.closed) return 'closed';
  if(e && e.rv === 'n') return 'veto';
  if(e && e.rv === 'a') return 'teppan';
  if(c.recDivergence === 'recheck') return 'unverified';
  if(!(c.rating > 0)) return 'unverified';   // null(生JSON)も0(パース後)も未確証
  const au = hasAuthority(c);
  if(au && crowdStrong(c)) return 'double';
  if(au && crowdWeak(c)) return c.recDivergence === 'tsuu' ? 'tsuu' : 'caution';
  if(au) return 'authority';
  if(crowdStrong(c)) return 'crowd';
  return 'weak';
}

/** 推奨レンズ(⭐)が通すティア。 */
export const RECOMMENDED_TIERS = ['teppan', 'double', 'tsuu', 'authority', 'crowd'];
export function isRecommended(c, e){ return RECOMMENDED_TIERS.includes(recTier(c, e)); }

/** バッジ表示。veto はバッジを出さない(記録ビューで既に本人が知っている)。 */
export const REC_BADGES = {
  teppan:     { icon: '🥇', label: '鉄板',     hint: '家族が「また行く」と評価した店' },
  double:     { icon: '✅', label: '二重確証', hint: '独立した権威(ミシュラン/Tatler/50 Best)と群衆評価が一致' },
  tsuu:       { icon: '🤔', label: '通好み',   hint: '評価は割れるが実勢調査で理由が判明済み(条件は編集メモ参照)' },
  authority:  { icon: '🎖', label: '権威推薦', hint: 'ミシュラン等の掲載。群衆評価は中立圏' },
  crowd:      { icon: '👍', label: '群衆支持', hint: 'Google高評価×大母数(発見バー通過)' },
  caution:    { icon: '⚠️', label: '要注意',   hint: '権威と群衆の乖離に説明が付いていない' },
  unverified: { icon: '⬜', label: '未確証',   hint: '評価データが未取得/不足' },
  closed:     { icon: '🚫', label: '閉店・休業', hint: '営業していません' },
};

export function recBadge(tier){ return REC_BADGES[tier] || null; }
