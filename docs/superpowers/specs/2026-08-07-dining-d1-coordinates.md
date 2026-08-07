# 飲食D1: 座標取得の生データ（全50件・前セッション調査ログから回収）

> 鮮度: 実装済み — D2でrestaurants.jsonへ全件反映済み（2026-08-07深夜 リファクタ棚卸しで付与）

実施: 2026-08-07（Nominatim）／ 初回検品は `2026-08-07-dining-d1-geocoding.md`（合格36 / 要再確認11 / 失敗3）。
**要再確認・失敗の14件は同日の再検証パス（住所ベース）で全件取得済み**（`2026-08-07-dining-verification.md` 参照）。
この表は D2 (restaurants.json) の座標ソース＝**全50件確定**。「✅再取得」= 再検証パスの値。

| Name | エリア(ar) | lat | lng | precision | 判定 |
|------|-----------|-----|-----|-----------|------|
| Dewakan | KLCC | 3.1547191 | 101.7185049 | building | ✅ |
| DC Restaurant | TTDI | 3.1416632 | 101.6272880 | building | ✅ |
| Beta KL | KLCC | 3.1521686 | 101.7117511 | street | ✅再取得(street) |
| akar | TTDI | 3.1527392 | 101.620807 | building | ✅再取得 |
| Terra Dining | TTDI | 3.1525139 | 101.6201675 | building | ✅再取得 |
| Chim by Chef Noom | Imbi | 3.1443284 | 101.7198602 | venue | ✅ |
| Molina | Bukit Bintang | 3.1585117 | 101.7038086 | building | ✅再取得(実態はKampung Baru寄り) |
| De.Wan 1958 | Jalan Tun Razak | 3.1593086 | 101.7209973 | venue | ✅ |
| Yun House | KLCC | 3.1580799 | 101.7138657 | venue | ✅ |
| Aliyaa | Damansara Heights | 3.1493435 | 101.6538746 | building | ✅ |
| Bar.Kar | Jalan Tun Razak | 3.1612783 | 101.7197528 | street | ✅(street許容) |
| Hide | KLCC | 3.1567108 | 101.7060822 | venue | ✅ |
| Atelier Binchotan | Taman Desa | 3.0978161 | 101.6773282 | street | ✅再取得(street) |
| K KL | KLCC | 3.1588687 | 101.7188400 | venue | ✅ |
| Congkak | Bukit Bintang | 3.1479910 | 101.7102820 | building | ✅ |
| Wong Mei Kee | Pudu | 3.1386895 | 101.7116447 | building | ✅ |
| Coast by Kayra | Bukit Bintang | 3.1474155 | 101.7138213 | venue | ✅ |
| Leen's | TTDI | 3.1531117 | 101.6229826 | building | ✅ |
| MTR 1924 | Brickfields | 3.1315765 | 101.6873811 | building | ✅ |
| ROTI by d'Tandoor | Keramat | 3.1632492 | 101.7248448 | building | ✅ |
| Sri Nirwana Maju | Bangsar | 3.1310615 | 101.6709820 | building | ✅ |
| Sao Nam | Bukit Bintang | 3.1458101 | 101.7075309 | building | ✅ |
| Hai Kah Lang | Cheras | 3.1006724 | 101.7413094 | building | ✅ |
| Nam Heong Chicken Rice | Chinatown | 3.1434705 | 101.6977375 | street | ✅(街区許容) |
| Ah Hei Bak Kut Teh | Imbi | 3.1436928 | 101.7138739 | street | ✅再取得(street) |
| Hing Kee Bakuteh | Kepong | 3.2125814 | 101.643599 | street | ✅再取得(street) |
| Heun Kee Claypot | Pudu | 3.1327391 | 101.7162985 | building | ✅ |
| Hor Poh Cuisine | Segambut | 3.1891491 | 101.653202 | street | ✅再取得(street) |
| Chee Meng | Old Klang Road | 3.095376 | 101.675213 | venue | ✅再取得 |
| Sek Yuen | Pudu | 3.1322208 | 101.7126147 | building | ✅ |
| Anak Baba | Brickfields | 3.1328085 | 101.6901846 | building | ✅ |
| Lai Foong Lala Noodles | Chinatown | 3.1434705 | 101.6977375 | street | ✅(街区許容) |
| Foong Lian | Pudu | 3.1330056 | 101.7164580 | building | ✅ |
| Jalan Ipoh Claypot | Segambut | 3.2024905 | 101.6746238 | street | ✅(street許容) |
| Sin Kiew Yee Beef Noodles | Chinatown | 3.1434705 | 101.6977375 | street | ✅(街区許容) |
| GulaiNya | Damansara Heights | 3.1490533 | 101.6533357 | venue | ✅再取得 |
| Lama Nyonya | Mont Kiara | 3.1726216 | 101.6486139 | venue | ✅ |
| Limapulo | Chow Kit | 3.1582712 | 101.6995656 | venue | ✅再取得 |
| Nadodi | KLCC | 3.1580799 | 101.7138657 | venue | ✅ |
| Entier | Bangsar | 3.1277831 | 101.6802883 | venue | ✅ |
| Skillet KL | KLCC | 3.1526347 | 101.7074638 | venue | ✅ |
| Cilantro | Jalan Tun Razak | 3.1568984 | 101.7230082 | building | ✅ |
| Elegant Inn | KLCC | 3.1530191 | 101.7073428 | building | ✅ |
| Ling Long | Damansara Heights | 3.1514085 | 101.6657944 | building | ✅再取得 |
| Marini's on 57 | KLCC | 3.1564081 | 101.7114459 | venue | ✅ |
| Kappo Hiyori KL | KLCC | 3.1544528 | 101.7186828 | venue | ✅ |
| Studio Restaurant | Bangsar | 3.1293387 | 101.6794228 | street | ✅再取得(street) |
| Merdeka Grill | Merdeka 118 | 3.1417171 | 101.7007387 | building | ✅ |
| Jalan Alor | Bukit Bintang | 3.1455473 | 101.7084901 | street | ✅(街枠) |
| Village Park | Damansara Utama | 3.1378386 | 101.6233015 | venue | ✅再取得 |
