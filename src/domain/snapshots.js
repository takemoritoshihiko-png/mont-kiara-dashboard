// 控え（自動バックアップ）の判断だけを持つ純関数（2026-08-16 竹森氏裁定）。
//
// 竹森氏の指示は「保存ボタンを押さなければ保存されない、ではなく、書き込む
// ごとに常にオート保存され、そして自動的にバックアップを取る」。
// 押す操作をゼロにするので、**いつ控えを取るかを機械が決める**必要がある。
// その判断だけをここに置き、実際の読み書きは personal.js が行う（保存領域に
// 触る口は1本だけ、という既存の約束を崩さないため）。
//
// 控えは2種類。役割が違うので、剪定の仕方も違う。
//   undo  … 危険な操作（全消去・まるごと置き換え）の直前。**常に1件だけ**。
//           押し間違いは直後に気づくので、世代は要らない。最新が正義。
//   daily … その日の最初の変更の直前＝前日までの姿。**7世代**。
//           「おとといの状態に戻したい」に答えるのはこちら。
//
// 保存先は localStorage（クラウドではない）。理由は2つ:
//   ・記録374店に全部感想を書いた最悪ケースで封筒は実測56KB。8世代で451KBに
//     なり、Firestoreの1文書上限1024KBに近すぎる
//   ・端末が壊れた/データを消された、はクラウドの**本体**が守る。控えが守る
//     のは「自分の操作ミス」で、それは同じ端末で起きる

/** daily の保持世代数。7 = 1週間ぶん。 */
export const SNAP_KEEP_DAILY = 7;
/** 危険操作の直前に取る控え。常に1件。 */
export const SNAP_UNDO = 'undo';
/** その日の最初の変更の直前に取る控え。 */
export const SNAP_DAILY = 'daily';

/**
 * 控えを1件足して、剪定した新しい一覧を返す。
 * 並びは **undo が先頭・そのあと daily が新しい順**。画面はこの順のまま出す
 * ので、「直前の状態に戻す」が常にいちばん上に来る。
 * 元の配列は変更しない — 呼び出し側が保存に失敗しても、手元の一覧が
 * 先に書き換わっていない状態を保てる。
 *
 * @param {Array<{kind:string,at:string,date:string,count:number,json:string}>} list 既存
 * @param {{kind:string,at:string,date:string,count:number,json:string}} snap 足すもの
 * @param {{keepDaily?:number}} [opt]
 * @returns {Array} 新しい一覧
 */
export function addSnapshot(list, snap, { keepDaily = SNAP_KEEP_DAILY } = {}){
  const src = Array.isArray(list) ? list.filter(isSnapshot) : [];
  const one = { ...snap, id: snapId(snap) };
  if(one.kind === SNAP_UNDO){
    // undo は1件だけ。古いものは残さない（2件目があると「どっちの直前？」になる）
    return [one, ...src.filter(s => s.kind !== SNAP_UNDO)];
  }
  // daily は日付ごとに1件。同じ日の控えが既にあれば、それを置き換えない
  // （その日の**最初**の姿＝前日までの姿を守りたいので、後から上書きしない）
  if(src.some(s => s.kind === SNAP_DAILY && s.date === one.date)) return src;
  const daily = [one, ...src.filter(s => s.kind === SNAP_DAILY)]
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, Math.max(0, keepDaily));
  const undo = src.filter(s => s.kind === SNAP_UNDO);
  return [...undo, ...daily];
}

/** その日の daily をまだ取っていないか。 */
export function needsDaily(list, date){
  if(!date) return false;
  return !(Array.isArray(list) ? list : []).some(s => isSnapshot(s) && s.kind === SNAP_DAILY && s.date === date);
}

/**
 * 控えの見出し。人が「どれに戻すか」を選べる言葉にする。
 * 日付は残すが、時刻まで出すのは今日のぶんだけ（一覧が読みにくくなる）。
 * @param {object} snap @param {string} today `YYYY-MM-DD`
 */
export function snapLabel(snap, today){
  if(!isSnapshot(snap)) return '';
  const when = snap.date === today ? `今日 ${hhmm(snap.at)}` : snap.date;
  const why = snap.kind === SNAP_UNDO ? '消す直前' : '自動';
  return `${when} ・ ${why}（${snap.count}店）`;
}

/** 一覧を保存できる形（文字列）にする。壊れた要素は落とす。 */
export function serializeSnapshots(list){
  return JSON.stringify((Array.isArray(list) ? list : []).filter(isSnapshot));
}

/**
 * 保存されていた文字列から一覧を戻す。壊れていたら空。
 * **例外を投げない** — 控えが読めないことが、記録本体の読み込みを
 * 巻き添えにしてはいけない。
 */
export function parseSnapshots(text){
  try {
    const v = JSON.parse(String(text || ''));
    return Array.isArray(v) ? v.filter(isSnapshot) : [];
  } catch { return []; }
}

/** 控えとして扱える形か。ここを通らないものは無かったことにする。 */
export function isSnapshot(s){
  return !!s && typeof s === 'object'
    && (s.kind === SNAP_UNDO || s.kind === SNAP_DAILY)
    && typeof s.json === 'string' && s.json !== ''
    && typeof s.at === 'string' && typeof s.date === 'string'
    && Number.isFinite(s.count);
}

/** 一覧の中の1件を id で引く。無ければ null。 */
export function findSnapshot(list, id){
  return (Array.isArray(list) ? list : []).find(s => isSnapshot(s) && snapId(s) === id) || null;
}

/** id は種類と時刻から決まる（保存に別フィールドを持たせない）。 */
export function snapId(snap){
  return `${snap.kind}-${snap.at}`;
}

/**
 * 時刻は**現地時間**で出す。`at` はISO（UTC）なので、文字列から切り出すと
 * マレーシアでは8時間ずれる — 台帳v9の欠陥1（訪問日をUTCで採っていた）と
 * 同じ型の間違いで、実画面で「10:00に消したのに 02:00 と出る」を確認した。
 */
function hhmm(at){
  const d = new Date(String(at || ''));
  if(isNaN(d)) return '';
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}
