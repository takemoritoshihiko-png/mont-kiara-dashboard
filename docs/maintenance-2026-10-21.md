# 2026-10-21 地図復旧・エラーチェック・構造整理

状態: ローカル修正・検証済み。2026-10-21、竹森氏の「反映して」で本番反映を承認。配信結果はこの作業の完了報告で確認する。

## 原因と修正

- 本番のCARTO背景画像が道路地図ではなく `API KEY REQUIRED` の画像を返していた。HTTP成功なのでコンソール例外だけでは発見できず、実画面で再現した。
- `src/data/basemap.js` に背景地図設定を集約し、OpenStreetMap標準タイルに変更。帰属リンク・ブラウザ標準キャッシュとリファラーを維持。大量取得・オフライン保存は追加していない。
- `src/ui/map.js` の重なり判定を純関数 `src/domain/markerLayout.js` に分離。既存の定数・4関数の本体を保持。30m以内の同地点選択は既存の `haversineKm` を共有。
- `mergeEntry` が個人記録の非表示フラグ `h` を統合し忘れる問題を修正。ほかのフラグと同じ加算的統合とし、明示的な非表示解除は既存の復元操作を使う。
- 除名済み店 `delisted` が周辺一覧・件数と古いURLによる詳細に現れる問題を修正。元のデータ行・安定ID・個人記録は削除しない。
- 呼出しのない `cloudSyncNow` を除去。自動保存の `pushNow` は維持。

背景提供元の根拠: [CARTOのAPIキー案内](https://www.carto.com/basemaps/apikey/index.html)、[OpenStreetMapタイル利用方針](https://operations.osmfoundation.org/policies/tiles/)（2026-10-21確認）。

## 検証結果

- 修正前: 25ファイル・777テスト合格。地図画像の問題は既存テストで検知できなかった。
- 追加した回帰検査で修正前の失敗を確認後、最終 `npm test`: **26ファイル・785件合格、失敗0**、Duration 1.33s。
- JS構文検査、相対import解決、CODEBASE-MAPの全src/testファイル掲載: エラー・漏れ0。`git diff --check`: エラー0（GitのLF→CRLF通知のみ）。
- 距離計算の共有化: 実データ719件、516,961組で旧式との30m判定差分0。
- 独立レビュー: Critical/Important 0。除名17件すべてのURL復元・周辺からの直接選択を拒否。通常店選択、全レコード不変、個人記録7欄の再読込み一致を確認。ブラウザ検品は主担当。
- 実画面: 物件・学校・商業・飲食、詳細・周辺、学費くらべ、外食の記録UI・データ管理、住まいへの復帰を確認。The Peakの周辺からCottaが消えたことを確認。
- Chrome 1500px/390px幅で地図の道路と地名を目視。390px幅でdocument scrollWidth=390、横はみ出し0、再読込み後の背景タイル6枚読込済み。1500px幅でもscrollWidth=1500。取得したブラウザwarn/errorログ0件。
- 個人記録はテスト用のメモリ内ストレージで検査。本番アカウントの記録には触れていない。CSV・restaurants.json・schools_detail.jsonの差分なし。

## 資料・メモリの整理

- README: データ件数・層の重ね方・端末/クラウド自動保存を現状に同期。
- CODEBASE-MAP: 新しいモジュールと未掲載テスト、外食ビュー・11分類を同期。計算の境界を `計算の地図.md` に整理。
- dining-discovery-logic、dining-candidates-box、dining-integration-plan、dining-purpose-rethink: 当初案と後日の裁定を区別する入口を付与。候補表は現在の営業・採用可否を再調査したものではない。
- 共有メモリ `project_mont_kiara_dashboard.md` をrepo正本への参照入口へ圧縮。旧本文を同じmemory内 `archive/project_mont_kiara_dashboard-before-2026-10-21.md` に1つだけ保全。飲食必須6要件を維持し、元ツールの実装記述を歴史として分離。MEMORY.md索引を同期。
- memory_lint: 変更前後とも **ERROR 1 / warn 1**。既存の共通短縮版 `AGENT_CORE_RULES.md` の未照合と、制作標準の注入容量90%超。今回編集した案件メモリのリンク・索引エラーは0。共通ルールは変更していない。

## 未実施・制約

- 検証完了時点では本番push、配信後確認、リモートCIは未実施。上記承認に基づき、CI合格後にmasterへ反映し、配信完了・公開画面を確認する。
- Firebaseの実ログイン・実通信・複数端末の競合試験は未実施。既存 `pushNow` は書込前にクラウドを再読しないため、同時編集は後勝ちのまま。保存方式変更は今回に混ぜていない。
- 店舗の営業状況・価格・評価・全座標を外部情報で再調査する作業は未実施。既存データの契約検査とアプリの動作検査を行った。
- アカウント設定・認証・公開方式・業務計算式・データ形式の変更なし。全体の作業コピー・node_modules複製・worktree作成なし。

残る事項の現況は `superpowers/deferred-backlog.md` の2026-10-21追記を参照。
