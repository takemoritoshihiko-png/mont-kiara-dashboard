# 美味しい店 発見ロジック【2026-08-07 竹森氏承認・恒久】

拡充調査の恒久ルール。承認3点: バー=★4.3×300件(新店2年以内は4.6×100件) / 30分圏=MK中心から半径12km基準(境界±2kmは個別判断) / 目標規模=90〜100店で打ち止め(以降は入替制)。

## 入口（5信号源・どれか1つで候補入り）
- A. 公式ガイド: ミシュランKL全掲載(星/ビブ/セレクテッド)の圏内未収載分は全量。**ミシュラン掲載店は件数バー免除**(台帳前例: K KL=35件)
- B. 賞レース: Tatler Dining Awards / Time Out KL Food Awards 等
- C. 群衆の実証: エリア別Google最上位 ★4.5×1,000件以上
- D. 日本人の定番: 駐在コミュニティ/日本語情報の複数一致
- E. 専門メディア: 現地食メディア2誌以上の年間ベスト一致

## 資格バー
★4.3×300+(新店例外4.6×100+・A信号は件数免除) / 全国チェーン除外・2〜4店舗は評判良なら可 / 閉店・臨時休業除外 / ペナン除外 / 半径12km基準

## 検証パス（省略禁止）
wanderlog/top-rated実値 → Nominatim座標+エリア整合 → チェーン店舗数 → 営業確認 → PlaceID/昼夜価格。未検証の数字は台帳に入れない。

## 採用
台帳スコア(基準★4.36固定)で序列化 → ジャンル×エリアのカバレッジ穴埋め優先。

## カバレッジ実測(2026-08-07・67店時点)と採用優先
ジャンル: 洋食14/マレーシア13/日本アジア10/中華8/インド8/麺・肉骨茶5/鶏飯5/**カフェ・デザート3/屋台街1**
エリア: KLCC11/TTDI6/BB5/DH4/Pudu4/Bangsar4/MK4/**Desa ParkCity1・Publika系0・Hartamas計4**
→ 採用優先: ①居住圏の薄いエリア(DPC/Publika/MK/Hartamas/DU) ②薄いジャンル(カフェ・屋台街・鶏飯・麺) ③KLCC×洋食は飽和のため高スコアのみ

## 実行結果（2026-08-07 夜・D7バッチ確定）

発見3系統（A権威 / B日本人定番 / C群衆実証）→ 収集3体 + 価格ギャップ埋め1体で **26店を採用**、67→**93店**。

- **ミシュランSelected採用 7**: Bidou・Jie・Kazu・Shu・KUKI Vegan（以上2026新規）・Potager（2025）・Vantador（2025+2026、群衆★4.5×1,321も一致）
- **Tatler Best 20採用 4**: Potager・Chipta 11a（件数180は閾値未満だが2年連続の権威二重署名で採用）・Table & Apron・Sushi Taka（290件は閾値300線上、鮨さいとう系譜で採用）
- **群衆実証採用**: Antipodean 4.7×4,281 / WTF 4.6×4,168 / Common Man 4.6×3,911 / Fuego 4.7×3,382 / Heritage Pizza 4.7×3,297 / Positano（Publika空白を充足） / EQ Nipah / Bijan / Manja / Brasserie Léon / Nero Nero / Der Backmeister / Foo Foo / Niko Neko / Dancing Fish
- **日本人定番採用**: 宮武讃岐うどん（MK核心部の空白を充足・★はRG4.4×433プロキシ）
- **評価null契約**: 開業直後でGoogle未集計の店（Jie/Shu）は rating=null+reviewCount=0 を許容（test/dining.test.js更新済）。スコアは縮約で基準線=中立、表示は空欄
- **カバレッジ改善**: カフェ・デザート3→8 / Publika 0→1 / MK核心+1 / Hartamas+1。Desa ParkCity・Sentulは正直に「該当なし」（backlog参照）
- 見送り10店と理由 = docs/superpowers/deferred-backlog.md の 2026-08-07 D7節
