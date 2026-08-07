# Deferred Backlog

スコープ外・保留にした課題の台帳（append-only）。完了報告の前にここへの記録が必須。

## 2026-08-07 (B0 土台バッチ)

- **8 Conlay (YOO8) は管財人管理下（receivership）**: 2025-2026にKSK Landと施工会社の紛争で管財人管理・売却手続き中。引き渡しゼロ。CSVは year=2026 / status=upcoming としたが「頓挫」を表す状態値がない。状態モデル拡張（stalled等）はB3以降で検討。出典: The Edge Malaysia (768919, 791494)。
- **premium_score 11件はフラグから機械的に再計算しただけ**: 個々のフラグ（pool等）自体の外部再検証はしていない。フラグの再検証は別トラック（データ精度向上）で。手順は memory の condo-verification 参照（pool=0 は73%誤りの実績あり）。
- **condos homepage_url が 68% (185/271) 空**: データ精度トラックで補完。
- **schools_detail.json はペナン9校のみ**: KL 24校の詳細（学費表・国籍構成等）が無い。データ精度トラックで。
- **GitHub Pages は「静的直配信」を維持**: Viteビルドを挟むデプロイ（actions/deploy-pages）への切替は、ビルドが必要になった時点で判断。現状は不要。
- **iproperty_url は検証していない**: 403で直接fetch不可のため。データ精度トラックで search-snippet 方式により確認。

## 2026-08-07 (竹森氏裁定: データ精査トラック中止)

- **コンドミニアム271件のデータ精査（フラグ再検証・homepage_url補完・iproperty_url確認）は今回スコープ外**（竹森氏 2026-08-07 明示: アプリのブラッシュアップがメイン）。将来再開する場合の手順はメモリの condo/commercial/address verification 3本に保存済み。
- KL校23校の詳細（schools_detail.json拡充）のみ、表示格差解消のため実行（進行中）。追加のデータ調査は出さない。

## 2026-08-07 (B1 モジュール分割で発見された既存バグ・意図的に未修正)

- **STATUSフィルタ「Residential Only」が常に0件**: 商業/学校は自分の分岐で落ち、condoは `status !== 'residential'` で全滅する既存バグ。B3で status フィルタから residential/commercial 選択肢自体を撤去予定（層タブが代替）のため、いま直さない。test/filter.test.js に KNOWN BUG として文書化済み。
- **School Finder の近隣物件クリックの挙動が不自然**: `sfActive=false; toggleSchoolFinder()` が反転して panel が開いたままになり、一度ペナン全景に飛んでから物件へ。B3の周辺エンジン刷新で解消予定。
- B1のUIモジュールは使い捨て等価性ハーネス（1,250万バイトのHTML出力一致・15.7万ケースのフィルタ一致）で検証したが、恒久のDOMレベル回帰テストは未整備。B2以降で必要になれば jsdom 導入を検討。
