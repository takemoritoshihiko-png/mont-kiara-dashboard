// ファイルDB同期 — 純ロジック（A案 2026-08-08 採用）。
//
// 個人記録の恒久保存先は「ユーザーが選んだフォルダ（OneDrive推奨）の
// dining-records.json」。localStorage は高速起動用のキャッシュに格下げされ、
// このモジュールは『いつ書く・いつ読む・いつ止まって人に聞くか』の判断だけを
// 持つ。File System Access API そのものには触れない（それは data/fileStore.js
// の殻の仕事）ので、ここは全て vitest で直接テストできる。
//
// 衝突検知の原理: このアプリがファイルへ書くとき、封筒の exported スタンプを
// 必ず新しくし、その値を「自分が最後に書いた印」として控える。次に書く前に
// ファイルの現スタンプを読み、控えと違えば“他の書き手”（別PC・手編集）が
// 触った証拠なので、上書きせず止まって選ばせる。スタンプは封筒の中にあるので
// OneDrive の同期遅延や lastModified の癖に依存しない。

/** 恒久保存のメインファイル名。エクスポート形式(封筒 ver10)と同一内容。 */
export const RECORDS_FILENAME = 'dining-records.json';
/** 世代バックアップを置くサブフォルダ名。 */
export const BACKUP_DIR = 'backups';
/** 残す世代数（日次・それより古いものは剪定される）。 */
export const BACKUP_KEEP = 7;
/** タイピング由来の連続保存をまとめるファイル書き込みデバウンス。 */
export const FILE_WRITE_MS = 800;

/** その日のバックアップファイル名。日付はローカル暦（personal.localDate と同じ理由）。 */
export function backupName(ymd){
  return `dining-records-${String(ymd).replace(/-/g, '')}.json`;
}

/** バックアップ名から日付部分（比較キー）。名前が形式外なら null。 */
export function backupStamp(name){
  const m = /^dining-records-(\d{8})\.json$/.exec(String(name));
  return m ? m[1] : null;
}

/**
 * 剪定: 残すべき keep 世代を除き、消してよいファイル名を返す。
 * 形式外の名前（ユーザーが置いた無関係のファイル）は決して消さない。
 */
export function pruneBackups(names, keep = BACKUP_KEEP){
  const ours = (names || []).filter(n => backupStamp(n) !== null)
    .sort((a, b) => backupStamp(b).localeCompare(backupStamp(a)));
  return ours.slice(keep);
}

/**
 * 起動時（接続・再接続時）の突合判断。
 *
 * @param {object} p
 * @param {number}      p.cacheCount   localStorage側の記録店数
 * @param {number|null} p.fileCount    ファイル側の記録店数（ファイル無し/読めない=null）
 * @param {string|null} p.fileStamp    ファイル封筒の exported
 * @param {string|null} p.lastWritten  自分が最後に書いた exported の控え（無ければ null）
 * @param {boolean}     [p.sameData]   両者の記録が実質同一か（呼び手が比較して渡す）
 * @returns {'adopt-cache'|'restore-from-file'|'conflict'|'noop'}
 *   adopt-cache       … キャッシュを正としてファイルへ書く（初接続・自分の続き）
 *   restore-from-file … ファイルを正としてキャッシュへ復元（新PC・ブラウザ掃除後）
 *   conflict          … どちらも正を名乗れる。人に選ばせる（無言でどちらも消さない）
 *   noop              … 同一内容。何もしない
 */
export function reconcile({ cacheCount, fileCount, fileStamp, lastWritten, sameData = false }){
  if(fileCount === null || fileCount === 0) return cacheCount > 0 ? 'adopt-cache' : 'noop';
  if(cacheCount === 0) return 'restore-from-file';
  if(sameData) return 'noop';
  // 両側にデータがあり、内容が違う。ファイルが「自分の最後の書き込み」なら
  // キャッシュ側だけが進んでいる＝自分の続きなので書いてよい。
  if(lastWritten !== null && fileStamp === lastWritten) return 'adopt-cache';
  return 'conflict';
}

/**
 * 毎回の書き込み直前の判断。exported スタンプの控えとファイルの現物を比べる。
 * @returns {'write'|'conflict'}
 */
export function preWriteCheck({ fileStamp, lastWritten }){
  // ファイルがまだ無い(null)・自分の書いた通り → 書いてよい。
  if(fileStamp === null || lastWritten === null || fileStamp === lastWritten) return 'write';
  return 'conflict';
}

/**
 * 記録オブジェクトの安定直列化 — キー順に依らず同一データなら同一文字列。
 * 封筒の exported は書くたび変わるので、内容一致の判定はこちらで行う。
 */
export function stableStringify(v){
  if(v === null || typeof v !== 'object') return JSON.stringify(v);
  if(Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}

/** 封筒テキストから exported スタンプと記録数を安全に読む。壊れていれば null。 */
export function readEnvelope(text){
  try {
    const j = JSON.parse(text);
    if(!j || typeof j !== 'object' || !j.data || typeof j.data !== 'object') return null;
    return { stamp: typeof j.exported === 'string' ? j.exported : null,
             count: Object.keys(j.data).length };
  } catch { return null; }
}
