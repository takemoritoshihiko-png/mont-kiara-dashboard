# 飲食: 検証パス結果（P1候補21店の実データ検証＋既存14店の座標再取得）

実施: 2026-08-07（sonnet×3並列・WebSearch/Nominatim）／ この文書が検証結果の正本。
判定の原則: **裏取りできない値は台帳に入れない**（v9の品質基準）。

## 0. 既存50店のうち要再確認だった14店の座標再取得【完了】

住所ベースのNominatim構造化検索＋WebSearch裏取りで**14件全て取得**。全店で閉店・移転なし（営業継続を確認）。
値は `2026-08-07-dining-d1-coordinates.md` の「✅再取得」行に反映済み → restaurants.json は**50件全件座標あり**。

特記:
- **Molina のエリアラベル不整合**: 台帳は「Bukit Bintang」だが実所在地は THE FACE Style（1020 Jalan Sultan Ismail）= Kampung Baru 寄り（BB中心から北約1.3km）。座標は正確。エリア区分の見直しは任意（v9継承のため現状維持）。
- GulaiNya は 2024-09 開業の新店（Little Yum Yum の拡張）。Plaza Damansara（Damansara Heights 西端）で整合。
- street 精度 6件（Studio Restaurant / Ah Hei / Hor Poh / Hing Kee / Beta KL / Atelier Binchotan）= 番地までは特定できず通り名精度。捏造ではなく実在住所の近似。

## A. P1候補・後半10店の検証結果

| 店名 | 営業 | 評価(裏取り後) | 所在地 | lat | lng | 価格帯RM | チェーン | 判定 |
|---|---|---|---|---|---|---|---|---|
| TTDI Meat Point | 営業中 | **候補表の★4.9/24,000+は誤り確定**。TripAdvisor実測561件・KL#1。Google実数は要再取得 | 62, Jalan Burhanuddin Helmi, TTDI | 3.1522 | 101.6204 | 60-90(和牛選択時180) | 単独店 | **要確認**(件数疑義の解消後) |
| Taka Izakaya | 営業中 | Google値未確証(Eatigo4.5/809・TripAdvisor3.5)。★4.3〜4.6台と幅表記が正直 | Plaza Arkadia B-G-16, Desa ParkCity | 3.1863 | 101.6352 | 実測RM190/人例あり(候補50-100は下振れ疑い) | Subang Jayaに同名店(同資本か未確認) | **要確認** |
| Lamei Hotpot | 営業中 | FB98%/825は一致確認。Google★未確認 | Plaza Arkadia H-G-16, Desa ParkCity | 3.1863 | 101.6352 | 60-100妥当 | Gentingにも同名店 | **要確認** |
| Bait Bistro & Oyster Bar | 営業中 | TripAdvisor実測**4.0/57件**(候補★4.5は裏取れず) | The Waterfront GF-06, Desa ParkCity | 3.1872 | 101.6277 | 60-110妥当 | Bangsar店と2店舗 | **要確認** |
| Playte | **閉店**(≈2022-23閉店・2025年版ミシュランから除外) | — | — | — | — | — | — | **除外(閉店)** |
| Rakuzen | 営業中 | — | Pavilion DH | 3.1460 | 101.6633 | — | **チェーン確定・全国21店舗** | **除外(チェーン裁定3)** |
| Ombak Kitchen | 営業中(2026-02記事) | TripAdvisor4.8・KL#98/4,074店 | 12, Lorong Ara Kiri 2, Bangsar | 3.1274 | 101.6698 | 170-220(直接裏取りなし) | **4店舗チェーン確定** | **要裁定**(評価良好だがチェーン抵触) |
| Aftermeal Desserts | 営業中 | ★4.7/160+一致確認(eatdrinkkl) | 52, Jalan SS 21/58, Damansara Uptown, PJ | 3.1375 | 101.6214 | 18-28整合 | PJ内2拠点のみ(低リスク) | **追加可** |
| Yarl Restaurant | 営業中 | TripAdvisor4.4/41件一致 | 50, Jalan Padang Belia, Brickfields | 3.1340 | 101.6907 | 20-35整合 | Brickfields本店+TTDI店の2拠点 | **要確認**(2拠点フラグのみ) |
| Annalakshmi | 営業中(1984年創業確認) | ★4.3の出典未確保 | Temple of Fine Arts, 116, Jalan Berhala, Brickfields | 3.1277 | 101.6875 | **寄付制(pay as you wish)の情報あり**→固定額表記は不適切 | 単独店 | **要確認**(価格モデル矛盾) |

### 後半10店の要点
- 追加可=1件のみ（Aftermeal Desserts）。除外=2件（Playte閉店・Rakuzenチェーン）。残り7件は要確認/要裁定。
- 座標は全件KL域内・エリア整合をNominatimで確認済み。同名別店の取り違えなし（YarlのTTDI店とだけ混同注意）。
