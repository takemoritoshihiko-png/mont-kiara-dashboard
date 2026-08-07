# B2: 地図の可読性 — 実装仕様

状態: 確定（実画面検証に基づく）。実装は B1 マージ後。

## 根拠（実測）
- 初期表示（KL全体）: 392マーカー全てに常時ラベル → 中心部が判読不能
- エリアジャンプ後（Mont Kiara）でも密集コアはラベル衝突

## 実装内容

### 1. 種別ごとのクラスタリング
- Leaflet.markercluster 1.5.3 を CDN で追加（css + Default.css + js、unpkg）
- **クラスタグループを種別ごとに3つ**（condo / commercial / school）。混ぜると種別の分布が見えなくなるため
- オプション: `maxClusterRadius: 45, disableClusteringAtZoom: CLUSTER_OFF_ZOOM, spiderfyOnMaxZoom: true, showCoverageOnHover: false`
- クラスタアイコン: 件数入り。**種別の視覚言語を維持**
  - condo = 円・グレーブルー `#78909c`
  - commercial = 角丸四角・オレンジ `#e8710a`
  - school = 円・ネイビー `#1a3d7c`
- rebuild() はマーカーを直接mapでなく該当クラスタグループへ追加

### 2. ラベル（tooltip）のズーム連動
- `const CLUSTER_OFF_ZOOM = 15; const LABEL_ZOOM = 15;`（後で調整しやすいよう定数化・ファイル先頭）
- zoom < LABEL_ZOOM: hoverでのみtooltip表示（permanent: false）
- zoom >= LABEL_ZOOM: 常時ラベル（現行の見た目を維持）
- `zoomend` で閾値をまたいだ時のみ全マーカーのtooltipを付け替え（毎zoomで再構築しない）
- **選択中マーカーは例外**: どのズームでも常時ラベル＋強調（現行のハイライトを維持）

### 3. 既存機能の無退行（継承リスト）
- エリアジャンプ / 🏆受賞フィルタ / 🛒🎓トグル / School Finder / 比較 / 検索 / 全フィルタ / 日英併記
- トグルOFF時はクラスタグループごと map から remove

## テスト
- ズーム閾値判定の純関数 `labelModeForZoom(zoom)` を切り出して単体テスト
- 視覚検証はメインエージェントが実画面で（デスクトップ＋400px幅モバイル）

## 完了条件
- npm test green / 初期表示でラベル衝突なし / ズームインで現行同等の情報量 / 全既存機能動作
