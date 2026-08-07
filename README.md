# Mont Kiara Dashboard — KL・ペナン 暮らしの地図

クアラルンプールとペナンの**コンドミニアム271・学校33・商業施設88・飲食店67**を、1枚の地図で見くらべるためのダッシュボード。「住まいモード」と、飲食店の訪問記録をつけられる「外食モード」の2モード。

**本番**: https://takemoritoshihiko-png.github.io/mont-kiara-dashboard/
（GitHub Pages・masterへのpush＝本番反映）

## できること

- **種別を切り替える** — 🏠物件 / 🎓学校 / 🛒商業 / 🍽飲食。選んだ種別が主役になり、残りは地図に薄く残る
- **その種別に効く条件だけで絞る** — 主要2つは常時表示、残りは「絞り込み」で開閉。適用中の条件はチップで見えていて、×で1つずつ外せる
- **学費をくらべる** — 年齢を選ぶと、KL・ペナン全校の年間学費が安い順に並ぶ。公表されていない学年は**補間せず**、いちばん近い公表学年の実額とその学年名を出す
- **周辺を見る** — 詳細パネルの「周辺」タブで、徒歩圏800m / 車5分2km / 車15分6km に何があるかを数と近い順トップ5で
- **外食モードで記録する** — 訪問した・また行きたいか・実額・感想をブラウザ内にだけ保存（他人には見えない）。行った店の一覧・JSON書き出し/読み込みつき
- **URLが画面の状態** — `?layer=&sel=&tab=&mode=` 。開いている物件のURLをそのまま送れる。戻る/進むも効く

## 使い方（開発）

```bash
npm install
npm run dev            # ローカル開発サーバー (Vite)
npm test               # テスト 595件（データ整合性の契約を含む）
npm run hooks:install  # pre-pushフック導入（push既定拒否・GIC_ALLOW_PUSH=1で許可）
```

## 構成

| パス | 役割 |
|---|---|
| `index.html` | CSS（デザイントークン）＋HTML。JSは `src/main.js` を読み込むだけ |
| `src/main.js` | 起動（地図・データ読込）とインライン`onclick`用のグローバル公開 |
| `src/state.js` | 画面共通の可変状態（データ・絞り込み結果・選択・トグル） |
| `src/data/` | `parseCsv.js` CSVパーサ唯一の実装 ／ `load.js` 取得と項目マッピング ／ `inline.js` 受賞・開発会社・学費カーブの固定データ |
| `src/domain/` | `luxury.js` ラグジュアリー指数 ／ `filter.js` 絞り込み判定 ／ `sort.js` 並び替え ／ `geo.js` 距離 ／ `nearby.js` 周辺＝距離バケット ／ `fees.js` 年齢→学年→年間学費 |
| `src/ui/` | `map.js` 地図・マーカー・凡例 ／ `list.js` 一覧・絞り込みUI・サマリー ／ `info.js` 詳細パネル ／ `urlState.js` URL＝画面状態 ／ `schoolFinder.js` 学費くらべ ／ `a11y.js` キーボード操作 |
| `condos_data.csv` | 物件271件（28列） |
| `commercial_data.csv` | 商業施設88件（11列） |
| `schools_data.csv` / `schools_detail.json` | 学校33件 ／ その詳細（学年別の年間学費表を含む） |
| `restaurants.json` | 飲食店67件（ミシュラン系50＋検証済み拡充17・9分類）。`tools/convert-v9-dining.js` が生成 |
| `test/` | 19ファイル・595件。`integrity.test.js` が**データ整合性の契約** |
| `docs/CODEBASE-MAP.md` | どのファイルが何をするかの一覧 |
| `docs/superpowers/` | 設計プラン・deferred-backlog |
| `archive/` | 参照されなくなったファイル（削除せず保管） |

## データの決まりごと（契約）

- **premium_score は加重式**: `private_lift×7 + concierge×2 + low_density + pool + sky_lounge + ev_charging`（最大15）。単純合計ではない。テストが強制する。
- **schools_detail.json のキーは schools_data.csv の name と完全一致**。ずれた瞬間に詳細が空になる。
- **学費は作らない**。公表されていない学年の額は補間・平均・外挿のいずれもせず、近い学年の実額とその学年名を出す。
- min ≤ max（広さ・家賃・PSF）、座標はマレーシア域内、名前は一意、`status` は completed / upcoming。
- データは本ページと同一オリジンから相対パスで取得（外部プロキシ禁止）。
- 一部データの読み込み失敗は**必ず画面に警告表示**する（無言で欠落させない）。

## 出典

iProperty / PropertyGuru / EdgeProp (2025-2026), MICHELIN Guide KL & Penang, 各校・各施設の公式サイト。
