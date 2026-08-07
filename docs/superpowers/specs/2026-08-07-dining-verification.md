# 飲食: 検証パス結果（P1候補21店の実データ検証＋既存14店の座標再取得）

実施: 2026-08-07（sonnet×3並列・WebSearch/Nominatim）／ この文書が検証結果の正本。
判定の原則: **裏取りできない値は台帳に入れない**（v9の品質基準）。

## 0. 既存50店のうち要再確認だった14店の座標再取得【完了】

住所ベースのNominatim構造化検索＋WebSearch裏取りで**14件全て取得**。全店で閉店・移転なし（営業継続を確認）。
値は `2026-08-07-dining-d1-coordinates.md` の「✅再取得」行に反映済み → restaurants.json は**50件全件座標あり**。

特記:
- **Molina のエリアラベル不整合**: 台帳は「Bukit Bintang」だが実所在地は THE FACE Style（1020 Jalan Sultan Ismail）= Kampung Baru 寄り（BB中心から北約1.3km）。座標は正確。エリア区分の見直しは任意（v9継承のため現状維持）。
- GulaiNya は 2024-09 開業の新店（Little Yum Yum の拡張）。Plaza Damansara（Damansara Heights 西端）で整合。
- restaurants.json 全体の精度実数: building 22 / venue 16 / street 12（再取得分のstreet=番地まで特定できず通り名精度。捏造ではなく実在住所の近似）。

## B. P1候補・前半11店の検証結果

出典注記: Google Maps は直接取得不可のため、wanderlog / top-rated.online（Google値のスクレイプサイト）を代理ソースとし、可能な限り2ソースでクロスチェック。

| 店名 | 営業 | 評価(裏取り後) | 所在地 | lat | lng | 価格帯RM | チェーン | 判定 |
|---|---|---|---|---|---|---|---|---|
| Cotta Cafe | 営業中 | ★4.9/700+（複数ブログ引用・中〜高信頼） | Verve Shops L6屋上, Mont Kiara | 3.1676 | 101.6468 | 50-100 | 単店舗 | **追加可**(※カテゴリ=カフェ/デザートは8分類外→要裁定) |
| Jhol KL | 営業中(2025/5開業) | **★4.3/約55件（候補表★5.0/100+は過大）** | THE MET, KL Metropolis | 3.1808 | 101.6647 | **RM310-350++/人（候補表80-160は大幅過小）** | 単店舗 | **要確認**(数値大幅乖離) |
| Wagyu Saikou | 営業中と推定 | 実数不明(TripAdvisor★5.0だがレビュー僅少疑い) | Solaris Dutamas A4-1 | 3.1712 | 101.6659 | 160+ 未確認 | 単店舗 | **要確認** |
| Kyomo | 営業中(旧Shin Nihon改称) | ★4.5/約1,400-1,500件(2ソース一致)・FB1,741/92% | 26, Jalan 24/70A, Desa Sri Hartamas | 3.1631 | 101.6507 | 120-200 | 単店舗 | **追加可**(件数は概数) |
| Kin Gyu | 営業中(Kyomo姉妹店) | 実数不明 | 8 Jalan 24/70A, Desa Sri Hartamas | 3.1631 | 101.6507 | 実際は約RM100-250(候補表より上) | 単店舗 | **要確認** |
| Fire Izakaya | 営業中 | ★4.9/808件(候補表と一致) | 160 Jalan Ampang（**実際はKLCC徒歩圏・Ampang地区ではない→エリア修正必須**） | 3.1595 | 101.7141 | 60-200 | 単店舗 | **追加可**(エリア=KLCCに修正の上で) |
| Nanda Chicken | 営業中 | ★4.5/64件(候補表★5.0/100+は過大) | Solaris Mont Kiara | 3.1755 | 101.6598 | 30-60 | **韓国発チェーン確定** | **除外(チェーン裁定3)** |
| MT Hotpot | 営業中 | ★4.9/2,687件 | L-01-01, Solaris Mont Kiara | 3.1755 | 101.6598 | 60-150 | 単店舗と推定 | **追加可** |
| Two Sons Bistro | 営業中 | ★4.1/1,189件(Publika店) | Publika A4-G2-8 | 3.1712 | 101.6658 | 50-130 | **3店舗展開(Publika/KLCC/TRX)** | **要裁定(チェーン抵触)** |
| Kanbe Ramen | 営業中 | ★4.3/1,849件(163店) | GF-08, 163 Retail Park, Mont Kiara | 3.1666 | 101.6520 | 31-45 | **3店舗以上(163/TRX/JB)** | **要裁定(チェーン抵触)** |
| Vin's Restaurant | 営業中 | ★4.6/2,756件=Google値（候補表★4.7/511はTripAdvisor値の混同） | 6 Lorong Datuk Sulaiman 1, TTDI | 3.1481 | 101.6296 | 50-100 | 単店舗 | **追加可** |

## C. 検証パス全体のまとめ（21店の内訳）

- **追加可（値の裏取り済み）7店**: Cotta Cafe※ / Kyomo / MT Hotpot / Vin's / Fire Izakaya(エリア修正) / Aftermeal Desserts※ / （※2店はカテゴリ「カフェ・デザート」が裁定済み8分類に無い→9分類目の追加が要裁定）
- **除外 4店**: Playte(閉店) / Rakuzen(21店舗チェーン) / Nanda Chicken(チェーン) / — 
- **要裁定（小規模チェーン2-4店舗）3店**: Two Sons Bistro / Kanbe Ramen / Ombak Kitchen — 「チェーン店は加味しない」裁定3の適用範囲（全国チェーンのみか、複数店舗すべてか）
- **要確認（値が裏取りできず保留）7店**: Jhol KL / Wagyu Saikou / Kin Gyu / TTDI Meat Point / Taka Izakaya / Lamei Hotpot / Bait Bistro / Yarl / Annalakshmi のうち該当
- haiku候補表の教訓: ★・件数の過大表示が複数（Jhol★5.0→実4.3、Nanda★5.0→実4.5、TTDI Meat Point 24,000件→実561件）。**検証パスなしの台帳追加は不可**を再確認。

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

## D. 保留9店の追い検証（2026-08-07夜・wanderlog/top-rated + Google Maps直接確認）

| 店名 | Google★/件数 | 価格RM | 判定 |
|---|---|---|---|
| Jhol KL | ★4.3/55件(wanderlog) | テイスティングRM310-350++・à la carteも有(公式確認) | **追加可(値確定)** |
| Wagyu Saikou | ★4.4/29件(Maps直接・登録名「Saikou」) | 実測3名RM500+ | **保留(Google Mapsで臨時休業表示)** |
| Kin Gyu | ★4.4/397件(Maps直接・登録名「KINGYU 金牛」) | オマカセRM180++・価格帯RM200+ | **追加可(値確定)** |
| TTDI Meat Point | **★4.9/25,144件(Maps直接実測)** | Maps価格帯RM80-200 | **追加可(24,000件超は誤集計でなく実数と確定)** |
| Taka Izakaya | 未取得(Maps個別リスティングにヒットせず) | 実測2名RM380.60 | **保留(閉店/改名の疑い残)** |
| Lamei Hotpot | ★4.4/883件(wanderlog) | — | **追加可(値確定)** |
| Bait Bistro & Oyster Bar | 未取得(Maps個別ヒットなし・正TripAdvisorは「BAIT」d4241986で4.0-4.1/57件) | — | **保留** |
| Yarl Restaurant | ★4.1/約1,800-1,867件(2ソース近似) | — | **追加可(値確定)** |
| Annalakshmi | ★4.5/1,868件(wanderlog) | **地下=寄付制・1階=定額ビュッフェRM18-35のハイブリッドと確定** | **追加可(値確定)** |

### 検証パス最終集計（21候補）
- **追加可(値確定) 11店**: Cotta Cafe※ / Kyomo / MT Hotpot / Vin's / Fire Izakaya(エリア=KLCC修正) / Aftermeal Desserts※ / Jhol KL / Kin Gyu / TTDI Meat Point / Lamei Hotpot / Yarl / Annalakshmi のうち11（※カフェ・デザート2店は9分類目の裁定待ち）
- **除外 4店**: Playte(閉店) / Rakuzen / Nanda Chicken(チェーン) / Wagyu Saikou(臨時休業→保留寄り)
- **要裁定 3店**: Two Sons / Kanbe / Ombak(小規模チェーンの扱い)
- **なお保留 2店**: Taka Izakaya / Bait Bistro(Google実値未確定)

## E. 竹森氏の追加裁定（2026-08-07夜・確定）

1. **カテゴリ9分類目「カフェ・デザート」を新設する**（Cotta Cafe / Aftermeal Desserts が所属）。
2. **小規模チェーン(2〜4店舗)は評判が良ければ採用**。→ Ombak Kitchen / Kanbe Ramen は採用対象。Two Sons Bistro は Google★4.1 で品質基準(★4.3×300件)未達のため不採用。Yarl Restaurant も Google実値★4.1のため不採用（TripAdvisor4.4との乖離は Google 側を正とする）。
3. **飲食の拡充調査はペナンを含めない。モントキアラから車30分圏内を中心に調査する**（今後の調査スコープの恒久ルール）。

### 裁定反映後の追加確定リスト（13店・D4マージ後にD6データ拡充バッチで台帳化）
Kyomo / Kin Gyu / MT Hotpot / Vin's / Fire Izakaya(エリア=KLCC) / Cotta Cafe / Aftermeal Desserts / Jhol KL / TTDI Meat Point / Lamei Hotpot / Annalakshmi / Kanbe Ramen / Ombak Kitchen(Google実値の取得を条件とする)

## F. P2候補15店の検証（2026-08-07夜・新スコープ=MK車30分圏/ペナン除外を適用）

- **追加可(基準クリア) 4店**: Napa Thai(★4.5/723) / Marta's Kitchen(★4.3/2,013) / Bocado(★4.5/642・前回「★4.8/11件」は誤りと判明) / Lachér Patisserie(★4.4/554・2-3店舗の小規模チェーン=裁定E-2で採用可)
- **要裁定 1店**: KUKI Vegan(★4.7/183・新店例外4.6/100は数値上クリアだが2023年11月開業=「新店」該当性に留保)
- **基準未達で除外 5店**: Bistro Léa(242件<300) / Kenji(70件) / Baba Low(★4.0/3.8) / Peter's Pork Noodles(★4.1) / SS2 Wai Sek Kai(★3.8)
- **チェーン除外 2店**: Paradise Dynasty(111店舗の国際チェーン) / Sushi Azabu(NY発Plan Do See系8店舗=小規模例外に非該当)
- **閉店/圏外 1店**: Galah Gala(TTDI店閉店→KL East Mallへ移転=Cheras方面で30分圏外の可能性大)
- **値未取得で保留 2店**: Aposto / UMI(Imperial Lexis)
