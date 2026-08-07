# コードベース地図

どのファイルが何を持っているかの一覧。1行1ファイル。詳細は各ファイル冒頭のコメントに書いてある。

## 画面（1ファイル）

| ファイル | 中身 |
|---|---|
| `index.html` | デザイントークン（`:root`）＋全CSS＋マークアップ。`@media(max-width:768px)` が末尾のモバイルブロック。JSは `src/main.js` を読むだけ |

## src/ — アプリ本体（17モジュール）

### 起動と状態

| ファイル | 役割 |
|---|---|
| `src/main.js` | 起動: 地図生成 → UI初期化 → CSV/JSON読込 → 初回描画 → URL状態の復元。インライン`onclick`用に関数を`window`へ公開 |
| `src/state.js` | 共有する可変状態（データ・絞り込み結果・選択中・アクティブ層/タブ・**モード(住まい/外食)**・**外食の3ビュー**・各トグル）。書き込みは全てセッター経由 |

### data/ — 読み込みと固定データ

| ファイル | 役割 |
|---|---|
| `src/data/parseCsv.js` | CSVパーサ（引用符・改行対応）。**唯一の実装** |
| `src/data/load.js` | ファイルURL定義・fetch・CSV/JSON列 → アプリのレコード形へのマッピング（飲食は `parseRestaurants`） |
| `src/data/inline.js` | コードに埋めた固定データ: FIABCI受賞・開発会社・Tier色・年色スケール・ペナン9校の学費カーブ・ミシュランの表記 |
| `src/data/personal.js` | **個人記録の唯一の書き込み口**（外食モード）。localStorage `mkd_dining_personal_v1`・6項目(w/v/vd/rv/m/amt)・ローカル日付・起動時の書込テスト・書き出し / 読み込み(v9のplaceIdキーを変換) / 全消去 |

### domain/ — 純粋なロジック（DOMを触らない）

| ファイル | 役割 |
|---|---|
| `src/domain/luxury.js` | ラグジュアリー指数とTier（S/A/B/C/D）の算出。premium_score を15点満点で正規化して加算 |
| `src/domain/filter.js` | 層の判定（`recordLayer`）・全絞り込み条件の判定・カリキュラム一覧・帯レンジのパース・飲食の8分類/ミシュラン/価格帯（`diningPriceCeiling`） |
| `src/domain/sort.js` | 層ごとの並び替え選択肢と比較関数。層を切り替えたとき使えない順序の扱いも |
| `src/domain/geo.js` | 2点間の距離（haversine） |
| `src/domain/nearby.js` | 「周辺」= 距離バケット（800m/2km/6km）へ種別ごとに仕分け＋距離の表記。層は `LAYERS` から自動で増える |
| `src/domain/fees.js` | 年齢 → 学年 → 年間学費。学年ラベルの解析。**補間せず**近い公表学年の実額を返す |
| `src/domain/diningScore.js` | 台帳スコア（100点）。権威au / 継続性ct / 評価ev・ベイズ縮約★(M=800)・レビュー母数の厚み・exタグはENUM。`calcLedgerScores()` が全件に焼き付ける |
| `src/domain/diningLog.js` | 行った店の集計とグループ分け。**母集団は訪問済みのみ**（台帳v9の食い違いの解消）。4タイル・再訪意向グループ・行のメタ文 |

### ui/ — 画面の描画と操作

| ファイル | 役割 |
|---|---|
| `src/ui/map.js` | Leaflet地図・マーカー生成（種別別の見た目）・クラスタ・ラベルのズーム連動・エリアジャンプ・凡例 |
| `src/ui/list.js` | 層セグメント・層別フィルタ・適用中チップ・並び替え・種別別カード・サマリー4枠・スケルトン・パネル開閉 |
| `src/ui/info.js` | 詳細オーバーレイ（dialog）: ヘッダー／「詳細」「周辺」タブ／外部リンク／選択の遷移 |
| `src/ui/urlState.js` | URL ⇄ 画面状態（`?mode=&layer=&sel=&tab=`）。`mode=eatout` のときだけ書かれる（住まいは既定＝省略）。履歴の積み方（push/replace）もここ |
| `src/ui/schoolFinder.js` | 学費くらべ: 年齢別の全校比較リスト・学費推移チャート・選んだ学校の周辺コンド |
| `src/ui/dining.js` | **外食モードの画面**。台帳スコアの表示・記録欄(visitbox)・行った店ビュー・データビュー・toast・保存バー。書き込みは全部 `data/personal.js` 経由 |
| `src/ui/a11y.js` | Enter/Space で `role="button"` を起動、Escapeで詳細を閉じる。**document に委譲リスナー1つだけ** |

## test/ — 18ファイル・531件

| ファイル | 何を守るか |
|---|---|
| `test/integrity.test.js` | **データの契約**: 件数・premium_score加重式・min≤max・座標域・名前の一意性・schools_detail のキー一致 |
| `test/parseCsv.test.js` | CSVパーサ（引用符・カンマ・改行） |
| `test/luxury.test.js` | 指数とTier境界 |
| `test/filter.test.js` | 全絞り込み条件（既知バグも文書化） |
| `test/sort.test.js` | 層別の並び替えと切替時の挙動 |
| `test/nearby.test.js` | 距離バケットの仕分けと表記 |
| `test/fees.test.js` | 年齢→学年の対応、**近い学年へのフォールバック（補間しないこと）** |
| `test/card.test.js` | 種別ごとのカードの型（学校を物件の型で描かないこと） |
| `test/map.test.js` | ズーム閾値・選択マーカーのクラス |
| `test/urlState.test.js` | URLの読み書きと履歴 |
| `test/visualSystem.test.js` | ページの識別・デザイントークン・情報の二重表示禁止・数値書式 |
| `test/a11y.test.js` | ランドマーク・全コントロールの名前・状態のaria・フォーカス可視・モバイルブロック・OGP |
| `test/dining.test.js` | **飲食データの契約**: 50件・id/placeId一意・座標域・価格 lo≤hi・8分類・ミシュランenum |
| `test/diningLayer.test.js` | 飲食層: 絞り込み5軸・価格帯の判定基準・カード/ヒーロー文字列・並び替え・詳細パネル・読み込み |
| `test/diningScore.test.js` | **台帳スコア**: 定数・exタグENUMと実データの照合・C=4.3600・手計算フィクスチャ・内訳が総合点と一致すること |
| `test/personal.test.js` | **個人記録**: ローカル日付・読み取りが書き込まないこと・保存可否の起動テスト・デバウンス保存・v9形式の読み込み変換・書き出し往復 |
| `test/diningLog.test.js` | 行った店: 母集団＝訪問済みのみ・平均実額の分母・グループの固定順と並び |
| `test/eatoutMode.test.js` | 外食モード: **住まいモードに記録UIが出ないこと**・記録欄・カード構造・3ビュー・独立トグル・台帳スコア順・markup契約 |

## データファイル

| ファイル | 中身 |
|---|---|
| `condos_data.csv` | 物件271件・28列 |
| `commercial_data.csv` | 商業施設88件・11列 |
| `schools_data.csv` | 学校33件（地図と一覧の基本情報） |
| `schools_detail.json` | 学校の詳細。**キーは schools_data.csv の name と完全一致** |
| `restaurants.json` | 飲食店50件（台帳v9から移植）。住所の列名だけ他層と違い `address`（読み込み時に `addr` へ） |

## その他

| パス | 中身 |
|---|---|
| `tools/install-hooks.js` / `tools/githooks/pre-push` | push既定拒否フックとその導入スクリプト |
| `.github/workflows/ci.yml` | 全ブランチで `npm ci && npm test` |
| `docs/superpowers/specs/` | 設計プラン（UI/UX刷新・情報設計・地図可読性・飲食店） |
| `docs/superpowers/deferred-backlog.md` | 保留課題の台帳（append-only） |
| `archive/` | 参照されなくなったファイル（削除せず保管） |
