// Pure marker placement. Coordinates stay unchanged; offsets are display pixels.
import { haversineKm } from './geo.js';

export const LABEL_ZOOM = 17;

// ============================================================
// 商業施設と飲食店の重なり(2026-08-16 竹森氏指摘)
//
// モールの中や真上にある店は座標がほぼ同じなので、飲食のピンが商業の四角を
// 覆って「モールが消える」ことが起きていた(実測: 80m以内に飲食がある商業施設が
// 8件・Pavilion KLは6店)。裁定は「商業を優先に見せ、飲食はその横にずらす」。
//
// 手当ては3つ。
//   1. 商業マーカーに zIndexOffset を与え、常に飲食の上に描く
//   2. モールの近くにある飲食ピンは、アイコンだけ右へずらす(座標は動かさない
//      ので、選択したときは正しい位置に寄る)
//   3. まとまった数字玉も、中心がモールの近くなら同じだけ右へずらす
// ずらすのは表示だけで、データ側の緯度経度には一切触れない。
// ============================================================
/**
 * 重なりは「画面上の現象」なので、判定の半径は縮尺から出す。
 * 引いた地図では1pxが何十mにもなるため、固定の半径だと取りこぼす
 * (ズーム13では1px≒19m＝30px離れた玉は実距離570m先でも重なって見える)。
 *
 * @param {number} zoom @param {number} lat @param {number} iconPx 相手側の大きさ
 * @returns {number} この距離より近ければ画面上で重なる(m)
 */
export function overlapRadiusM(zoom, lat, iconPx){
  const mPerPx = 156543.03392 * Math.cos((lat || 0) * Math.PI / 180) / Math.pow(2, zoom);
  // モールの四角(最大30px)の半分 + 相手のアイコンの半分
  return (15 + iconPx / 2) * mPerPx;
}

/** 個別ピン用の既定半径(m)。ピンが1つずつ出るのはズーム16以上＝1px≒2.4m。 */
export const MALL_OVERLAP_M = 60;
/**
 * ずらす量(px)。四角(最大30px)の右端の外へ、数字玉(32px)の左端が出る幅。
 * 15(四角の半分) + 16(玉の半分) + 1(隙間) = 32。
 */
export const MALL_SHIFT_PX = 32;
/** 商業を常に上に描くための持ち上げ量。 */
export const COMMERCIAL_Z = 1000;
/**
 * これより寄ったら、ずらしをやめて本当の位置に戻す縮尺。
 * ズーム17では1pxがおよそ1.2mなので、60m離れた店は50px離れて描かれる＝もう
 * 重ならない。重なっていないのにずらすと、今度はそれが嘘になる。
 * LABEL_ZOOM と同じ値にしてあるのは偶然ではない: 名前ラベルは本当の座標に付く
 * ので、ラベルが常時出る縮尺でずらしていると、名前とピンが離れて見える。
 */
export const MALL_SHIFT_MAX_ZOOM = LABEL_ZOOM;
/** ずらす対象につけるclass。実際に動かすかはCSS(地図側のclass)が決める。 */
export const MALL_SHIFT_CLASS = 'mk-mall-shift';
/** この縮尺以上のときに地図コンテナへ付くclass。ずらしを打ち消す。 */
export const MALL_APART_CLASS = 'mk-mall-apart';

/** その縮尺では、もうずらす必要がないか。 */
export function mallShiftOff(zoom){ return zoom >= MALL_SHIFT_MAX_ZOOM; }

// ============================================================
// 同じ地点に複数ある場合（2026-08-16 竹森氏指示）
//
// 「どれだけ寄せても完全に重なる」組が実データにある。文字列としての座標一致
// ではなく**実質同じ地点**で捉える必要がある（層をまたぐ0m級の組が3つ:
// Agile Mont Kiara×宮武讃岐うどん / Pines Mont Kiara×Casa Rosa /
// 163 Retail Park×Fei Fan火鍋）。同じ建物の1階が店、上が住居、という並びなので
// データが間違っているわけではない。**表示だけ**を扇状に散らす。
//
// モールのずらし(MALL_SHIFT)と違い、これは**どの縮尺でも効かせる**。
// 同じ地点は、寄っても永遠に離れないから。
// ============================================================
/** 実質同じ地点とみなす距離(m)。これより近いと、最大まで寄せても重なる。 */
export const SAME_SPOT_M = 3;
/** 散らす半径(px)。マーカー(最大30px)の隣に置ける幅。 */
export const SAME_SPOT_RADIUS_PX = 20;
/** 真ん中に残す優先順。商業を優先する既存方針に合わせる。 */
export const SPOT_PRIORITY = ['commercial', 'school', 'condo', 'dining'];

/**
 * 同じ地点に集まったレコードに、表示上のずらし量(px)を割り当てる。
 *
 * 優先度がいちばん高い1件は**本当の位置に残す**（動かすと、その施設を探して
 * いる人が見つけられなくなる）。残りを円周に等間隔で置く。
 * 並びは name で安定させる — 描き直すたびに位置が入れ替わると、目で追えない。
 *
 * @param {{key:string, lat:number, lng:number, layer:string}[]} records
 * @returns {Map<string,{dx:number,dy:number}>} ずらす必要があるものだけ
 */
export function spotOffsets(records, { withinM = SAME_SPOT_M, radiusPx = SAME_SPOT_RADIUS_PX } = {}){
  const out = new Map();
  const pts = (records || []).filter(r => r && r.lat != null && r.lng != null);
  const km = withinM / 1000;
  const seen = new Set();
  for(let i = 0; i < pts.length; i++){
    if(seen.has(i)) continue;
    const group = [i];
    for(let j = i + 1; j < pts.length; j++){
      if(seen.has(j)) continue;
      if(haversineKm(pts[i].lat, pts[i].lng, pts[j].lat, pts[j].lng) <= km) group.push(j);
    }
    if(group.length < 2) continue;
    group.forEach(k => seen.add(k));
    const members = group.map(k => pts[k]).sort((a, b) => {
      const pa = SPOT_PRIORITY.indexOf(a.layer), pb = SPOT_PRIORITY.indexOf(b.layer);
      if(pa !== pb) return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
      return String(a.key).localeCompare(String(b.key));
    });
    const rest = members.slice(1);
    rest.forEach((m, idx) => {
      const angle = (2 * Math.PI * idx) / rest.length;
      out.set(m.key, {
        dx: Math.round(radiusPx * Math.cos(angle)),
        dy: Math.round(radiusPx * Math.sin(angle)),
      });
    });
  }
  return out;
}

/**
 * その地点が、いま地図に出ている商業施設の近くにあるか。
 * @param {number} lat @param {number} lng
 * @param {{lat:number,lng:number}[]} malls 判定対象の商業施設
 * @param {number} [withinM]
 */
export function nearAnyMall(lat, lng, malls, withinM = MALL_OVERLAP_M){
  if(lat == null || lng == null || !malls || !malls.length) return false;
  const km = withinM / 1000;
  return malls.some(m => haversineKm(lat, lng, m.lat, m.lng) <= km);
}

