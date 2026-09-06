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
| `src/state.js` | 共有する可変状態（データ・絞り込み結果・選択中・アクティブ層/タブ・**モード(住まい/外食)**・**外食の3ビュー**・各トグル・**飲食の「近く」中心(diningNear)**・**予算の昼夜基準(dayBudgetBasis)**）。書き込みは全てセッター経由 |
| `src/domain/snapshots.js` | **控え（自動バックアップ）の判断だけ**: いつ取るか(危険操作の直前=undo 1件／その日の最初の変更前=daily 7世代)・剪定・見出しの言葉。保存領域には触れない純ロジック |
| `src/domain/recommend.js` | 推奨軸(2026-08-08): 家族>二重確証>通好み…のカテゴリ導出=**バッジ表示専用**(レンズ絞り込みは同日夜の裁定で撤去)。数値合成なし・保存は素材(recDivergence/closed/verified)のみ。経緯=specs/2026-08-08-dining-purpose-rethink.md |
| `src/format.js` | num/esc/jsStrの唯一の実装(ui/とdomain/の両方から使うためui外に置く)。jsStrはJSエスケープ+HTML属性エスケープの2層 |

### data/ — 読み込みと固定データ

| ファイル | 役割 |
|---|---|
| `src/data/parseCsv.js` | CSVパーサ（引用符・改行対応）。**唯一の実装** |
| `src/data/load.js` | ファイルURL定義・fetch・CSV/JSON列 → アプリのレコード形へのマッピング（飲食は `parseRestaurants`） |
| `src/data/inline.js` | コードに埋めた固定データ: FIABCI受賞・開発会社・Tier色・年色スケール・ペナン9校の学費カーブ・ミシュランの表記 |
| `src/domain/cloudSync.js` | **クラウド同期の「判断」だけ**（純・テスト対象）。ログイン入力の検分／ログイン直後にどちらを正とするか／書いてよいか。**ログイン直後は記録のある側から空の側へだけ自動同期し、両方に異なる記録があれば人が選ぶ**（設計正本 §20） |
| `src/data/cloudConfig.js` | Firebase の接続先と SDK のバージョン。**この値は秘密ではない**（守っているのは Firestore のセキュリティ規則） |
| `src/data/cloudStore.js` | **Firebase に触る唯一の場所**。ログイン（ユーザー名＋合言葉→`<name>@mkd.local`）・`users/{uid}` への読み書き・状態の保持。SDKは**ログインするまで読まない**（CDNから動的import）。personal.js は書き換えず `onPersonalChange` を購読して書きスルー |
| `src/data/personal.js` | **個人記録の唯一の書き込み口**（外食モード）。localStorage `mkd_dining_personal_v1`・6項目(w/v/vd/rv/m/amt)+非表示フラグh(🗑で台帳から消す・データ管理から戻す)・ローカル日付・起動時の書込テスト・書き出し / 読み込み(v9のplaceIdキーを変換) / 全消去。**控え（自動バックアップ）もここが持つ**（別キー `mkd_dining_snapshots_v1`）: 全消去とまるごと置き換えは関数の中で必ず控えを取り、その日の最初の書き込み前に日次の控えを取る。判断は `domain/snapshots.js` |

### domain/ — 純粋なロジック（DOMを触らない）

| ファイル | 役割 |
|---|---|
| `src/domain/luxury.js` | ラグジュアリー指数とTier（S/A/B/C/D）の算出。premium_score を15点満点で正規化して加算 |
| `src/domain/filter.js` | 層の判定（`recordLayer`）・全絞り込み条件の判定・カリキュラム一覧・帯レンジのパース・飲食の**大分類11(`CAT_GROUPS`)/小分類(`cat`・台帳から生成)**/ミシュラン/予算（`diningPriceCeiling`＝昼夜どちらの上限で見るかを引数で受ける）・**飲食の距離フィルタ `matchesDiningNear`（半径 `NEAR_KM`=3km）**。**2026-08-16: 評価下限と「車で(MKから)」の絞り込みは廃止**（実測で★4.3が90%残る／全店が44分以内で効かなかった）。**エリアのセレクトも同日に削除**（地図のジャンプバーで代替）だが、`AREA_BUCKETS`/`areaBucketOf` と `matchesDining` の判定は残してある（調査で作った対応表の知識を捨てないため）。検索は編集メモ・支持される点/割れる点に加え、**`f.personal` が渡されたときだけ**自分の感想も見る（住まいモードには渡さない＝公開の顔に個人記録が出ない契約） |
| `src/domain/sort.js` | 層ごとの並び替え選択肢と比較関数。層を切り替えたとき使えない順序の扱いも。予算順は価格帯フィルタと**同じ基準（昼/夜）**で作られ、選択肢のラベルにも基準が出る |
| `src/domain/geo.js` | 2点間の距離（haversine） |
| `src/domain/nearby.js` | 「周辺」= 距離バケット（800m/2km/6km）へ種別ごとに仕分け＋距離の表記。層は `LAYERS` から自動で増える |
| `src/domain/fees.js` | 年齢 → 学年 → 年間学費。学年ラベルの解析。**補間せず**近い公表学年の実額を返す |
| `src/domain/diningScore.js` | 台帳スコア（100点）。権威au / 継続性ct / 評価ev・ベイズ縮約★(M=800)・レビュー母数の厚み・exタグはENUM。`calcLedgerScores()` が全件に焼き付ける |

### ui/ — 画面の描画と操作

| ファイル | 役割 |
|---|---|
| `src/ui/map.js` | Leaflet地図・マーカー生成（種別別の見た目。**ミシュランは星=濃い金+★／掲載店=淡い金+Ⓜ／ビブ=琥珀+🍽 の3段。並びは絞り込みの選択肢と凡例で揃える**）・**外食モードのピンに ✓訪問済み(右上) と ♡行きたい(左上) のバッジ**・クラスタ・ラベルのズーム連動・エリアジャンプ（住まい層は `fArea`、飲食層は**中心からの半径3km**で絞る）・凡例。**商業と飲食の重なり対策**（商業は `zIndexOffset` で常に上／モールに重なる飲食は `.mk-mall-shift` で見た目だけ右へ32px／判定半径は `overlapRadiusM` が縮尺から出す／ラベルが出る縮尺17以上では打ち消す。座標は動かさない）・**完全に同じ地点の散らし**（`spotOffsets` が3m以内の組を見つけ、商業>学校>物件>飲食の順で1件を真の位置に残し、残りを半径20pxの円周に等間隔で配置。inline style の `transform` なので**どの縮尺でも効く**＝寄っても永遠に離れない組のため。モールのずらしとは排他） |
| `src/ui/list.js` | 層セグメント・層別フィルタ・適用中チップ・並び替え・種別別カード・サマリー4枠・スケルトン・パネル開閉。**飲食の小分類セレクトは `syncCatSubOptions()` が大分類に従って毎回作り直す**（大分類が未選択の間は枠ごと隠す）。**`shareView()`＝いまの画面のリンクをコピー**（同期の選択コピーを先に試し、駄目なら新API）。**スマホでは `body.more-open` で絞り込みと並び替えをまとめて開閉する** |
| `src/ui/info.js` | 詳細オーバーレイ（dialog）: ヘッダー／「詳細」「周辺」タブ／外部リンク／選択の遷移 |
| `src/ui/urlState.js` | URL ⇄ 画面状態（`?mode=&layer=&sel=&tab=&f=`）。`mode=eatout` のときだけ書かれる（住まいは既定＝省略）。履歴の積み方（push/replace）もここ。**`f=` の小分類(fCat)は選択肢が大分類に依存するので、復元は info.js が「書く→選択肢を作る→もう一度書く」の2回で行う**。**並び替え(fSort)も載るが、既定値のときは載せない**（全リンクに `?f=fSort:` が付くのを防ぐ）。トグル（子連れ・昼の予算・自分の記録）は載せない＝共有ボタンが押されたときにトーストで名指しする |
| `src/ui/schoolFinder.js` | 学費くらべ: 年齢別の全校比較リスト・学費推移チャート・選んだ学校の周辺コンド |
| `src/ui/dining.js` | **外食モードの画面**。台帳スコアの表示・記録欄(visitbox)・🗑非表示(dineHide/dineUnhide)・toast・保存バー。書き込みは全部 `data/personal.js` 経由。**データ管理は3節だけ**（記録の保存先／控え（自動）／片づけ・2026-08-16に6節から整頓）。**押す保存は無い**（書いた瞬間に自動）。**保存の状況はヘッダーの 住まい/外食 の右**（2026-08-16に一覧の下から移動。ヘッダーは畳まれないのでスマホでも常に見える）。文は**前半＝誰として保存しているか（絶対に落とさない）／後半＝いつ（スマホでは畳む）**の2つに分かれる |
| `src/ui/a11y.js` | Enter/Space で `role="button"` を起動、Escapeで詳細を閉じる。**document に委譲リスナー1つだけ** |

## test/ — 全テスト（件数・ファイル数は `npm test` の実行結果が正）

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
| `test/dining.test.js` | **飲食データの契約**: id/placeId一意・座標域・価格 lo≤hi・9分類・ミシュランenum（対象件数は restaurants.json が正） |
| `test/diningLayer.test.js` | 飲食層: 絞り込み5軸・価格帯の判定基準・カード/ヒーロー文字列・並び替え・詳細パネル・読み込み |
| `test/diningScore.test.js` | **台帳スコア**: 定数・exタグENUMと実データの照合・C=4.3600・手計算フィクスチャ・内訳が総合点と一致すること |
| `test/personal.test.js` | **個人記録**: ローカル日付・読み取りが書き込まないこと・保存可否の起動テスト・デバウンス保存・v9形式の読み込み変換・書き出し往復 |
| `test/uxDining.test.js` | UX2: 飲食のエリア連動（距離フィルタ・3kmの妥当性・ジャンプ配線）と昼夜基準（`diningPriceCeiling`/価格帯/並び替えが**同じ数字を読む**invariant）・層タブの飲食入口・トグルのmarkup契約 |
| `test/snapshots.test.js` | 控えの契約: undoは常に1件・dailyは日ごと1件7世代・現地時刻で出す・**消える経路(全消去/まるごと置き換え)は必ず控えを通る**を実物のpersonal.jsで検査 |
| `test/recommend.test.js` | 推奨軸の契約: ティア梯子・家族拒否権・実勢裁定の回帰(Dewakan=通好み等)・裁定なきcaution=0店 |
| `test/eatoutMode.test.js` | 外食モード: **住まいモードに記録UIが出ないこと**（訪問済み✓バッジ含む）・記録欄・カード構造・3ビュー・独立トグル・台帳スコア順・markup契約 |
| `test/infoPanel.test.js` | 詳細パネルの表現契約: 物件=出典語併記(PSF)/未定表示・商業=運営者/NLA/エスケープ・学校=長文ブロックの既定折りたたみ(畳んでも情報は落とさない) |

## データファイル

| ファイル | 中身 |
|---|---|
| `condos_data.csv` | 物件271件・28列 |
| `commercial_data.csv` | 商業施設33件・11列（一次出典必須の再調査で確定・旧88件は docs/archive） |
| `schools_data.csv` | 学校33件（地図と一覧の基本情報） |
| `schools_detail.json` | 学校の詳細。**キーは schools_data.csv の name と完全一致** |
| `restaurants.json` | 飲食店データ（件数はファイル実体が正・墓標=delisted含む。**現存する公式KLミシュラン2026全75店を完全網羅**。Mont Kiaraからの車所要時間(driveKm/MinFree/MinJam)を焼き込み済み。v9原本は削除済みで、tools/convert-v9-dining.js がコミット済みデータ+dining-additions.jsonから再生成）。住所の列名だけ他層と違い `address`（読み込み時に `addr` へ） |
| `tools/gen-drive-times.js` | Mont Kiara基点の車所要時間をOSRMで一括計算→drive-times.json。converterが焼き込む。更新手順: convert→gen-drive-times→convert |
| `tools/fetch-place-ids.js` | Google Place ID を鍵なしで採取（`/search?tbm=map` の応答から店名・座標・Place IDを取り出す）。**別の店を掴まないための関門は2つ＝距離（台帳の検証済み座標から building 250m / venue 450m / street 700m 以内）と店名の一致**。どちらか欠けたら採らず `review` に落とす。`--check`＝既にIDがある店で答え合わせ（精度の実測用）／`--fill`＝`pending:` の店を採取 |
| `tools/apply-place-ids.js` | 採取結果を restaurants.json へ入れる。`ok` のものだけ・墓標には触れない・既存IDの書き換えは前→後を必ず印字。既定は下読み、`--write` で書く |

## その他

| パス | 中身 |
|---|---|
| `tools/install-hooks.js` / `tools/githooks/pre-push` | push既定拒否フックとその導入スクリプト |
| `.github/workflows/ci.yml` | 全ブランチで `npm ci && npm test` |
| `docs/superpowers/specs/` | 設計プラン（UI/UX刷新・情報設計・地図可読性・飲食店） |
| `docs/superpowers/deferred-backlog.md` | 保留課題の台帳（append-only） |
| `archive/` | 参照されなくなったファイル（削除せず保管） |
