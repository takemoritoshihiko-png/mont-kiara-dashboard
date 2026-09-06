# AGENTS.md — このリポジトリで作業するAIへの指示

## これは何か

KLとペナンのコンドミニアム・学校・商業施設・飲食店を1枚の地図で見くらべる、日本人向けの住まい探しダッシュボード。件数は対象データを集計した実行結果が正。 商業施設の対象条件は、KL有名モールTOP10、200店以上かつMKから車1時間圏、MK付近の50店以上の施設。
公開サイト: https://takemoritoshihiko-png.github.io/mont-kiara-dashboard/

## 技術構成

- **フロントのみ**。サーバーもビルド成果物も無い。`index.html` がCSSとマークアップ、`src/` がESモジュール
- 開発は **Vite**（`npm run dev`）。本番は **GitHub Pages の静的直配信**（リポジトリのファイルがそのまま配信される＝ビルド無し）
- テストは **Vitest**（`npm test`）。DOM環境は入れていない。テストはすべて**純関数**か、`index.html` をテキストとして読む**契約テスト**
- 地図は Leaflet + markercluster（CDN）

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # 純関数・契約テスト
npm run hooks:install  # pre-push フックを .git/hooks へ
```

## 共通手順と、この案件の検証上の注意

- 共通の改善・バグ修正・設計・検証・委譲の規則は `C:/Users/takem/.codex/AGENTS.md` の入口から、該当する正本を全文読む。案件本文へ複製しない。
- テストは `npm test` または `./node_modules/.bin/vitest run` を使う。必要な検証を省かず、固定の過去実測を現在の速度とみなさない。
- 見た目は実画面で確認し、切れ・重なりなどは利用可能なブラウザ機能で数値も測る。地図の再描画・iframe読み込みの直後には screenshot / zoom を実行せず、描画完了を確認する。
- 独立した操作だけバッチにまとめる。CIの完了は `gh run watch <id> --exit-status` または利用可能な完了通知で確認し、`Start-Sleep` を待機の代わりにしない。
- 委譲の案件例: 閉店フラグ・座標の確認は判断が不要なら最軽量、店舗数の分類・突合は軽い判断を担えるモデル。実際のモデル名は共通の選択規則に従う。

## 🛑 push のルール（最重要）

**push = 本番反映**（masterへのpushでGitHub Pagesが更新される）。

- `tools/githooks/pre-push` が **push を既定で拒否**する。`npm run hooks:install` で導入
- 承認済みのpushだけ `GIC_ALLOW_PUSH=1` を付けて通す
- **サブエージェントは push 禁止。`GIC_ALLOW_PUSH` を自分で設定してはならない**。マージとpushはメインエージェントだけが行う
- master へ上げる前に、必ず**「本番に反映しますか?」と確認して了承を得る**

## 正本（SSOT）はどこか

| 知りたいこと | 見るファイル |
|---|---|
| UI/UXの設計方針・実行バッチ | `docs/superpowers/specs/2026-08-07-uiux-refined-plan.md` |
| 情報設計・地図の可読性の判断根拠 | 同フォルダの `2026-08-07-b3-information-architecture.md` / `2026-08-07-b2-map-readability.md` |
| 飲食店の追加計画・調査結果 | 同フォルダの `2026-08-07-dining-integration-plan.md` / `2026-08-07-dining-research-30min.md` |
| **推奨軸(⭐)の設計根拠と裁定経緯／外食UIの裁定ログ（§18 カテゴリ2段・§19 絞り込みの再編・§24 Google Place IDの一括採取とクチコミ直行リンク）** | `docs/superpowers/specs/2026-08-08-dining-purpose-rethink.md` |
| **Google Place ID を採り直す手順**（店を足したら必ず通す） | `tools/fetch-place-ids.js --fill` → `tools/apply-place-ids.js --write`。判定できなかったぶんは `tools/place-id-manual.json` に理由つきで書く |
| **飲食店を増やすときの恒久ルール**（大衆口コミ系は★4.2以上4.9未満×口コミ1,000件以上。ミシュラン等の権威掲載店は例外。MK12km基準・チェーン規則・件数上限の適用範囲は同正本の裁定節で確認） | `docs/superpowers/specs/2026-08-07-dining-discovery-logic.md` |
| 住所・座標、商業施設、コンドの全欄調査と未確認の扱い | `docs/DATA-VERIFICATION.md`（対象の節を調査前に読む） |
| 保留にした課題（append-only） | `docs/superpowers/deferred-backlog.md` |
| どのファイルが何をするか | `docs/CODEBASE-MAP.md` |

**スコープ外として保留した課題は、完了報告の前に必ず deferred-backlog.md に追記する。**

## 2つのモード

ヘッダーの「🏠 住まい / 🍽 外食」で、同じ地図の上に2つのアプリが乗っている。

- **住まいモード**（既定・公開サイトの姿）: 物件・学校・商業・飲食を見くらべる。**個人記録は一切出さない**
- **外食モード**（`?mode=eatout`）: 層を飲食に固定し、台帳スコアと**自分の記録**（訪問済み・行きたい・再訪意向・実額・感想）が出る。台帳が常設(「✓行った店」トグルで絞り込み)+データ管理(保存バーから)。旧・行った店ビューは2026-08-08廃止

個人記録の端末側保存は `localStorage` の `mkd_dining_personal_v1`、書き込み口は `src/data/personal.js` **1本だけ**。他の場所から直接 localStorage を触らない。ログイン中は Firebase にも自動保存し、Firebase の読み書きは `src/data/cloudStore.js` に限定する。ログイン直後は記録のある側から空の側へだけ自動同期し、両方に異なる記録があれば人が選ぶ。同期の正本は `docs/superpowers/specs/2026-08-08-dining-purpose-rethink.md` §20・§22。
**この分離は公開サイトの前提**: 住まいモードに記録が1つでも漏れたら、それは公開されたのと同じ。`test/eatoutMode.test.js` が両側から検査する。

## データの契約（破ると静かに壊れる）

- **premium_score は加重式**: `private_lift×7 + concierge×2 + low_density + pool + sky_lounge + ev_charging`（最大15）。単純合計ではない。`test/integrity.test.js` が強制する
- **`schools_detail.json` のキーは `schools_data.csv` の `name` と完全一致**。改名すると詳細パネルが無言で空になる。片方を直したら必ず両方
- **学費は絶対に作らない**。公表されていない学年の額を補間・平均・外挿してはならない。近い学年の**実額**を、その学年名を明示して出す（`src/domain/fees.js`）
- 不明値は `0` ではなく「要問合せ」「未定」「—」。**ゼロ円を価格として表示しない**
- データ読み込みの一部失敗は**必ず画面に警告を出す**。無言で件数を減らさない
- CSVを触ったら `npm test`（integrity）を必ず green で確認

## 実装するときの作法

- `index.html` の `:root` に**デザイントークン**がある。色・サイズ・余白の直書き（リテラルのhex/px）は禁止。フォントサイズは `var(--fs-*)` のみ（テストが検査する）
- カード・行・凡例のようなクリックできる要素は `role="button" tabindex="0" aria-label` を付ける。Enter/Space の処理は `src/ui/a11y.js` の**委譲ハンドラ1つ**が担う（要素ごとに listener を足さない）
- 表示テキストを組み立てる関数（例: `cardHeroText`）は**1つの実装を共有**する。同じ数字を2箇所で組み立てない
- 状態の書き込みは `src/state.js` のセッター経由のみ。**個人記録は `src/data/personal.js` のセッター経由のみ**（読み取り用の `getEntry()` は絶対に書かない — 描画しただけで空レコードが生えた台帳v9の事故）
- モバイルは `index.html` 末尾の `@media(max-width:768px)` ブロック。**新しいUI要素を足したら、このブロックにも入れる**（タップ標的40px）

## UI/UX改善の案件条件

改善・見直しは `C:/Users/takem/.codex/AGENTS.md` の共通改善規則の入口から、該当する正本を全文読んで適用する。裏取りのない「雰囲気レビュー」は禁止。
この案件では前提を対象のCSV/JSONと実画面で測り、見た目を変える案は実アプリにモックを注入して確認する。モバイルは390px幅を確認対象に含め、住まい探し・外食記録の実利用を歩いて摩擦を記録する。住まいモードへの個人記録漏れと、上記データ契約・実装条件を検収する。
共通の反証・代替比較・根拠付き評価を重ねて別工程として複製しない。

## ルール整理前の履歴

旧本文の全文・当時の件数と検証時間は `docs/archive/AGENTS-2026-09-06-before-refinement.md` に保管する。履歴の旧指示を現在の承認として再実行しない。
