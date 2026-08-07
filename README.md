# Mont Kiara Dashboard — KL/ペナン 暮らしの地図

コンドミニアム271・学校33・商業施設88（今後: 飲食店）を1枚の地図で見るためのダッシュボード。

**本番**: https://takemoritoshihiko-png.github.io/mont-kiara-dashboard/
（GitHub Pages・masterへのpush＝本番反映）

## 使い方（開発）

```bash
npm install
npm run dev        # ローカル開発サーバー (Vite)
npm test           # テスト（データ整合性契約を含む）
npm run hooks:install  # pre-pushフック導入（push既定拒否・GIC_ALLOW_PUSH=1で許可）
```

## 構成

| パス | 役割 |
|---|---|
| `index.html` | CSS＋HTMLマークアップ。JSは `src/main.js` を読み込むだけ |
| `src/main.js` | 起動処理（データ読込・初期描画）とインライン`onclick`用のグローバル公開 |
| `src/state.js` | 画面共通の可変状態（データ・絞り込み結果・トグル） |
| `src/data/` | `parseCsv.js`（CSVパーサ唯一の実装）／`load.js`（取得と項目マッピング）／`inline.js`（受賞・開発会社・学校の固定データ） |
| `src/domain/` | `luxury.js`（ラグジュアリー指数）／`filter.js`（絞り込み判定）／`sort.js`（並び替え）／`geo.js`（距離計算）／`nearby.js`（周辺＝距離バケット）／`fees.js`（年齢→学年→年間学費） |
| `src/ui/` | `map.js`（地図・マーカー・凡例）／`list.js`（一覧・並び替え・サマリー）／`info.js`（詳細パネル）／`urlState.js`（URL＝画面状態）／`schoolFinder.js`（学費くらべ） |
| `condos_data.csv` | 物件データ（28列） |
| `commercial_data.csv` | 商業施設データ（11列） |
| `schools_data.csv` / `schools_detail.json` | 学校データ／全33校の詳細（学年別の年間学費表を含む） |
| `test/integrity.test.js` | **データ整合性の契約**（CSVを変更したら必ず green を確認） |
| `test/parseCsv` / `luxury` / `filter` `.test.js` | パーサ・指数計算・絞り込みの単体テスト |
| `docs/superpowers/` | 設計判断ログ・deferred-backlog |
| `archive/` | 参照されなくなったファイル（削除せず保管） |

## データの決まりごと（契約）

- **premium_score は加重式**: `private_lift×7 + concierge×2 + low_density + pool + sky_lounge + ev_charging`（最大15）。単純合計ではない。テストが強制する。
- min ≤ max（広さ・家賃・PSF）、座標はマレーシア域内、名前は一意、`status` は completed / upcoming。
- データは本ページと同一オリジンから相対パスで取得（外部プロキシ禁止）。
- 一部データの読み込み失敗は**必ず画面に警告表示**する（無言で欠落させない）。

## 出典

iProperty / PropertyGuru / EdgeProp (2025-2026), MICHELIN Guide KL & Penang, 各校・各施設の公式サイト。
