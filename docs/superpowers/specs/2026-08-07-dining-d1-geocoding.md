# 飲食D1: 既存50店の座標取得 結果（検品済み）

> 鮮度: 実装済み — 要再確認分は同日のdining-verification.mdで解消済み（2026-08-07深夜 リファクタ棚卸しで付与）

実施: 2026-08-07（Nominatim/WebFetch・検索枠不使用）／ 検品: メインが既知のKL地理と突合

## 結果サマリ

| 判定 | 件数 | 扱い |
|---|---|---|
| ✅ 合格（建物/施設レベル・エリア整合） | 36 | D2でそのまま採用 |
| ⚠ 要再確認（エリアと座標の不一致 or 汎用座標） | 11 | **次セッションの検証パスで再取得**（評価値検証と同時に） |
| ❌ 取得失敗 | 3 | 同上（Beta KL / Atelier Binchotan / Ling Long） |

## ⚠ 要再確認 11件（Nominatimの同名別店ヒット・エリア中心点の罠）

| 店 | 台帳のエリア | 取得座標の実際の位置 | 問題 |
|---|---|---|---|
| akar | TTDI | 市中心部(3.134,101.699) | 同名別ヒット疑い |
| Chee Meng | Old Klang Road | Bukit Bintang(3.145,101.709) | 同名別店(BB店?)ヒット |
| Village Park | Damansara Utama(PJ) | Segambut/Dutamas(3.174,101.680) | 明確に別地点 |
| Limapulo | Chow Kit | BB付近(3.145,101.707) | Chow Kitは3.16帯 |
| Studio Restaurant | Bangsar | Sri Hartamas(3.171,101.666) | エリア不一致 |
| Ah Hei Bak Kut Teh | Imbi | Chow Kit寄り(3.152,101.694) | エリア不一致 |
| Molina | Bukit Bintang | Concorde付近(3.158,101.705) | Else Hotel(Chinatown)のはず |
| GulaiNya | Damansara Heights | Aliyaaと完全同一座標 | エリア汎用点をbuilding扱い |
| Hor Poh | Segambut | エリア汎用点 | street精度のみ |
| Hing Kee Bakuteh | Kepong | エリア汎用点 | street精度のみ |
| Terra Dining | TTDI | 通り中点 | street精度（許容圏だが要確認） |

教訓は物件検証時と同じ（[[address-verification]]の「通り中点・同名ヒットの罠」）。**要再確認分は地図に載せず、検証完了まで保留リスト扱い**とする（D1ゲートの方針どおり）。

## ✅ 合格36件（抜粋・全リストは調査ログ参照）

Dewakan / DC Restaurant / Chim(TSLAW Tower) / De.Wan 1958(The Linc) / Yun House(Four Seasons) / Aliyaa / Hide(Ritz-Carlton) / K KL(ILHAM) / Congkak / Wong Mei Kee / Coast by Kayra(Starhill) / Leen's / MTR 1924 / ROTI / Sri Nirwana Maju / Sao Nam / Hai Kah Lang / Heun Kee / Sek Yuen / Anak Baba / Foong Lian / Lama Nyonya(Steppes) / Nadodi / Entier(Alila) / Skillet(Menara Hap Seng) / Cilantro / Elegant Inn / Marini's on 57 / Kappo Hiyori(Naza) / Merdeka Grill / Jalan Alor(街) / Nam Heong・Lai Foong・Sin Kiew Yee(Chinatown街区・street精度で許容) ほか

## 次アクション（次セッション冒頭・検索枠リセット後）
1. 要再確認11件＋失敗3件の座標を再取得（住所ベース・エリア整合チェック付き）
2. P1候補21店の評価値検証（同一の検証パスに統合）
3. 完了後 D2（restaurants.json化・8分類付与）へ
