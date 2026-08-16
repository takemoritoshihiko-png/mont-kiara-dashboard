# CLAUDE.md — このリポジトリで作業するAIへの指示

## これは何か

KLとペナンの**コンドミニアム271・学校33・商業施設32(KL有名モールTOP10+「200店以上×MK車1時間圏」16+MK付近50店以上6・旧88件はdocs/archiveに保全)・飲食店357(データ行374・墓標17)**を1枚の地図で見くらべる、日本人向けの住まい探しダッシュボード。
公開サイト: https://takemoritoshihiko-png.github.io/mont-kiara-dashboard/

## 技術構成

- **フロントのみ**。サーバーもビルド成果物も無い。`index.html` がCSSとマークアップ、`src/` がESモジュール
- 開発は **Vite**（`npm run dev`）。本番は **GitHub Pages の静的直配信**（リポジトリのファイルがそのまま配信される＝ビルド無し）
- テストは **Vitest**（`npm test`）。DOM環境は入れていない。テストはすべて**純関数**か、`index.html` をテキストとして読む**契約テスト**
- 地図は Leaflet + markercluster（CDN）

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # 770件
npm run hooks:install  # pre-push フックを .git/hooks へ
```

## 🛑 サブエージェントのモデル選択

**正本はグローバルCLAUDE.md（毎セッション自動読込）＋AIメモリ `feedback_subagent_model_selection`（起動直前に本文MUST READ）。ここには複製しない**（複製の版ズレ事故防止・2026-08-09 SSOT統一）。プロジェクト固有の適用例のみ: 閉店フラグ・座標確認=haiku / 店舗数カウント・分類=sonnet。

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
| 情報設計・地図の可読性の判断根拠 | 同フォルダの `b3-information-architecture.md` / `b2-map-readability.md` |
| 飲食店の追加計画・調査結果 | 同フォルダの `dining-integration-plan.md` / `dining-research-30min.md` |
| **推奨軸(⭐)の設計根拠と裁定経緯／外食UIの裁定ログ（§18 カテゴリ2段・§19 絞り込みの再編）** | `docs/superpowers/specs/2026-08-08-dining-purpose-rethink.md` |
| **飲食店を増やすときの恒久ルール**（品質バー★4.3×300・MK12km圏・チェーン規則・90-100店上限） | `docs/superpowers/specs/2026-08-07-dining-discovery-logic.md` |
| 保留にした課題（append-only） | `docs/superpowers/deferred-backlog.md` |
| どのファイルが何をするか | `docs/CODEBASE-MAP.md` |

**スコープ外として保留した課題は、完了報告の前に必ず deferred-backlog.md に追記する。**

## 2つのモード

ヘッダーの「🏠 住まい / 🍽 外食」で、同じ地図の上に2つのアプリが乗っている。

- **住まいモード**（既定・公開サイトの姿）: 物件・学校・商業・飲食を見くらべる。**個人記録は一切出さない**
- **外食モード**（`?mode=eatout`）: 層を飲食に固定し、台帳スコアと**自分の記録**（訪問済み・行きたい・再訪意向・実額・感想）が出る。台帳が常設(「✓行った店」トグルで絞り込み)+データ管理(保存バーから)。旧・行った店ビューは2026-08-08廃止

記録は `localStorage` の `mkd_dining_personal_v1` にだけ入る。書き込み口は `src/data/personal.js` **1本だけ**で、他のどこからも直接 localStorage を触らない。
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

## UI/UX改善の作法（2026-08-07 竹森氏指示・恒久）

改善・見直しの提案は**実物検証を済ませてから**出す。裏取りのない「雰囲気レビュー」は禁止。

1. 前提数値は実データで測る（CSV/JSONの分布・件数・コントラスト比）
2. 見た目の提案は実アプリに**モックを注入して確認**（モバイルは390px iframeで再現できる）
3. オーナーの実利用タスクを1ステップずつ歩き、摩擦とブロックを記録する
4. 候補案は敵対的反証（実コード裏取り）に掛け、潰れた案は出さない。安い代替が勝ったらそちら
5. 提案には採点表と、各点数の根拠となる実測値を付ける
