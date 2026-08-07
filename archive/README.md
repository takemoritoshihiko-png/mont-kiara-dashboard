# archive/

どこからも参照されなくなったファイルの保管場所（削除はしない・git履歴に頼らない方針）。

| ファイル | 何だったか | なぜここにあるか |
|---|---|---|
| `calc.js` | 62物件ハードコードの luxury index 計算（JS版） | `condos_data.csv` と値がズレた古い写し。ランタイムからの参照なし（grep確認 2026-08-07） |
| `luxury_calc.py` | 同上のPython版 | 同上 |
| `recovered_data.txt` | 2026-04 データ検証エージェントのクラッシュ復旧ログ | 25物件の検証結果を含む。**Le Nouvel KLCC の指摘（low_density=3 / score=14）は 2026-08-07 に本体CSVへ反映済み** |

luxury index の計算は `index.html` 内の `calcLuxury()` が正（B1でモジュール化予定）。
