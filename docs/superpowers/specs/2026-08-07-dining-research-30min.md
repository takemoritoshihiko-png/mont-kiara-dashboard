# 飲食調査: モントキアラ車30分圏ブラッシュアップ（統合報告）

> 鮮度: 実装済み — 候補の採否はD6/D7で確定。候補段階の記録（2026-08-07深夜 リファクタ棚卸しで付与）

作成: 2026-08-07 ／ 調査: haiku×4並列（①MK/Hartamas/Publika ②ParkCity/Kepong/TTDI/DH ③Bangsar/Brickfields/PJ北 ④日本人コミュニティ・子連れ横断）→ 私（メイン）が統合・選別
状態: **候補リスト確定・数値検証は未実施**（追加前に D1/D2 の検証パスが必須）

## 調査設計（採用した切り口）

台帳v9の現50店はミシュラン系・都心部中心で、**居住圏（モントキアラ=1店のみ・Hartamas/ParkCity/Publika=0店）がほぼ空白**だった。そこで「ゾーン別3方面＋横断1方面（日本人駐在員の定番・子連れ）」で調査。基準: Google★4.3以上×レビュー300件以上（新店は4.6/100で例外可）。

## ⚠ データの信頼度について

haiku調査のため**評価値の相当数が「要確認」またはTripAdvisor/Facebook代替**。以下の優先度は「編集的な有望度」であり、**台帳追加前に全店で Google実値（★・件数）+ Place ID + 座標の検証パスを回すこと**（誤った数字を台帳に入れない=v9の品質基準を守る）。

## P1: 有望度・高（検証して追加する第一候補・21店）

| 店名 | ジャンル | エリア | 価格帯RM | 根拠 | 子連れ |
|---|---|---|---|---|---|
| Cotta Cafe | カフェ/デザート | Mont Kiara (Verve屋上) | 50-100 | ★4.9/700+ 駐妻定番 | ◎ |
| Jhol KL | 南インド高級 | Mont Kiara (The MET) | 80-160 | ミシュラン系シェフ・★5.0/100+ | ○ |
| Wagyu Saikou | 和牛焼肉 | Solaris Dutamas | 160+ | ★5.0/100+ Tatler | ○ |
| Kyomo | 和牛焼肉 | Desa Sri Hartamas | 120-200 | FB 1,741件・駐在定番（④とも一致） | ○ |
| Kin Gyu | すき焼き/しゃぶしゃぶ | Desa Sri Hartamas | 70-180 | 東京スタイル・ハラル和牛・家族鍋 | ◎ |
| Fire Izakaya | 居酒屋 | Ampang | 60-200 | ★4.9/808 駐在員の社交定番 | ○ |
| Nanda Chicken | 韓国チキン | Solaris Mont Kiara | 30-60 | ★5.0/100+ 子連れ◎ | ◎◎ |
| MT Hotpot | 四川火鍋 | Solaris Mont Kiara | 60-150 | 2,424件・個室 | ◎ |
| Two Sons Bistro | イタリアン海鮮 | Publika | 50-130 | ムール貝16種ソースの名物 | ◎ |
| Kanbe Ramen | 豚骨ラーメン | 163 Retail Park | 31-45 | 東京シェフ直営・行列店 | ◎ |
| Vin's Restaurant | イタリアン | TTDI | 50-100 | ★4.7/511 | ◎ |
| TTDI Meat Point | ステーキ(ハラル) | TTDI | 80-180 | ★4.9(件数24,000+は要再検証=疑義) | ◎ |
| Taka Izakaya | 焼き鳥/和食 | Plaza Arkadia (DPC) | 50-100 | ★4.5/予約809 家族向け | ◎ |
| Lamei Hotpot | 四川火鍋 | Plaza Arkadia (DPC) | 60-100 | FB98%/825 VIP個室 | ◎ |
| Bait Bistro & Oyster Bar | シーフード | DPC Waterfront | 60-110 | ★4.5 ブランチ有力 | ◎ |
| Playte | モダン欧亜 | Damansara Heights | 100-180 | ミシュラン掲載 | △ |
| Rakuzen | 和食(老舗チェーン) | Pavilion DH / Solaris 他 | 60-140 | 駐在ファミリーの安定枠(②④一致) | ◎ |
| Ombak Kitchen | シーフード | Bangsar | 170-220 | ★4.8 | ◎ |
| Aftermeal Desserts | デザート | Damansara Utama | 18-28 | ★4.7/160+ | ◎ |
| Yarl Restaurant | スリランカ | Brickfields | 20-35 | ★4.4 | ◎ |
| Annalakshmi | インド菜食 | Brickfields | 18-28 | ★4.3 1984年創業 | ◎ |

## P2: 有望・検証必須（新店/評価代替/件数薄・15店）

Bistro Léa(フレンチ・Hartamas新店) / Napa Thai(Hartamas) / Marta's Kitchen(スペイン・Hartamas) / Paradise Dynasty(小籠包・163) / Lacher Patisserie(★4.2だが受賞シェフ) / Aposto(TTDI新店) / Bocado(★4.8/11件のみ・DH) / Galah Gala(TTDI海鮮) / KUKI Vegan(★4.0だがミシュラン掲載) / Baba Low(Bangsar) / Peter's Pork Noodles(★4.2・40年の伝説枠) / SS2 Wai Sek Kai(屋台街=Jalan Alor同格の「街」枠) / Sushi Azabu(Isetan・NY系) / UMI(TripAdv5.0) / Kenji(高級和食)

## P3: 保留（基準未達・チェーン・情報不足）

- 基準未達で除外: Syed Bistro(3.6) / Verona(3.7) / Ignis(3.0) / Kuro Steamboat(4.0) / The Regent(3.5) / Uokatsu(3.9) / La Risata(3.7) / Santouka(3.8) / Hanare(3.9) / Sae Ma Eul(4.1) / Lao Heong(4.1)
- チェーン/予算枠で台帳の趣旨(美味しい店の厳選)と不整合の疑い: Sakae Sushi / Sushi Mentai / IPPUDO / Bankara / Kou Ramen
- 情報不足: Sichuan Kungfu Fish(★5.0/3件) / Dolce Vita(新店) / Roost / Luck Farm / Gyutaro / Ushiraku / Yakiniku GREAT / Kuriya / Iketeru / Itsumo / Sushi Hibiki(大人専用=子連れ×だが質は高い)
- 要確認: 「Kayra」(Bangsar) は既存 Coast by Kayra と同系列の可能性 → 重複確認

## 判明したエリア構造（台帳設計への示唆）

1. **Solaris Mont Kiara / Plaza Mont Kiara** が日常圏の最密集地（和食・韓国・中華・火鍋）
2. **Desa Sri Hartamas** = 東京スタイル和食街（Kyomo/Kin Gyu/Itsumo）— 日本人駐在の核
3. **The MET / 163 / Plaza Arkadia** = 2024-26新店の供給源（定点観測の価値）
4. **TTDI** = インディー系（個人店）の質が高い
5. v9のエリア軸(ar)に **Sri Hartamas / Desa ParkCity / Publika** の追加が必要になる

## 次のアクション（実装順）

1. **検証パス**: P1の21店 → Google実値(★・件数)・Place ID・座標・営業確認を1店ずつ検証（D1と同時に実施可能）。P2は検証後にP1へ昇格判定。
   - **2026-08-07 実施状況**: 検証エージェント2体を起動したが、当日セッションのWebSearch上限(200回)に到達し中断。**飲食実装フェーズ（B4後・新セッション）の最初の工程として実行する**。候補リスト自体は完成済みで実装順序への影響なし。
2. 検証通過分を D2 スキーマ(restaurants.json)へ追加 — カテゴリ大分類は裁定1の結果に従う。
3. 追加後の分布を確認し、空白が残るゾーン（Publika内の個店・Bangsar Southの成熟待ち）を次回調査対象に。

**竹森氏への提案**: P1追加後の台帳は 50→71店・居住圏カバーが実現します。P2/P3の扱い（特にチェーン店を台帳に含めるか＝「美味しい店の厳選」の定義）は裁定をお願いします。
