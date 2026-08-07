// Pure filtering logic for the condo/commercial/school list.
// Extracted from applyFilters() in index.html — conditions are unchanged; the
// two identical copies of the area test were merged into matchesArea().

export function parseR(v){if(!v)return null;const[a,b]=v.split('-').map(Number);return{min:a,max:b}}
export const TIER_ORDER = {S:5, A:4, B:3, C:2, D:1};

/** Area quick-filter test. Returns false when the record is outside the area. */
export function matchesArea(c, areaFilter){
  const a=c.addr.toLowerCase();
  const n=c.name.toLowerCase();
  const isKLGCC=a.includes('bukit kiara')||n.includes('klgcc');
  const isDPC=a.includes('desa parkcity');
  const isBangsar=a.includes('bangsar');
  const isKLCC=a.includes('klcc')||a.includes('bukit bintang')||a.includes('jalan conlay')||a.includes('jalan imbi')||a.includes('jalan pinang')||a.includes('kl sentral')||n.includes('klcc');
  const isAmpang=a.includes('u-thant')||a.includes('ampang hilir')||a.includes('embassy row')||a.includes('kia peng')||a.includes('persiaran stonor')||a.includes('lorong kuda');
  const isDH=a.includes('damansara heights')||a.includes('jalan batai')||a.includes('changkat semantan');
  const isMK=!isDPC&&!isBangsar&&!isKLGCC&&!isKLCC&&!isAmpang&&!isDH;
  if(areaFilter==='mont-kiara'&&!isMK) return false;
  if(areaFilter==='desa-parkcity'&&!isDPC) return false;
  if(areaFilter==='bangsar'&&!isBangsar) return false;
  if(areaFilter==='klgcc'&&!isKLGCC) return false;
  if(areaFilter==='klcc'&&!isKLCC) return false;
  if(areaFilter==='ampang'&&!isAmpang) return false;
  if(areaFilter==='damansara'&&!isDH) return false;
  return true;
}

/**
 * @param {object} c  a condo / commercial / school record
 * @param {object} f  criteria: q, tierVal, sp, rn, yr, sz, age, statusFilter,
 *                    areaFilter, showAwardOnly, showCommercial, showSchools,
 *                    currentYear
 */
export function matchesFilters(c, f){
  // Award filter: hide non-award condos when active (commercial/school unaffected)
  if(f.showAwardOnly&&c.status!=='commercial'&&c.status!=='school'){
    if(!c.fiabciAward) return false;
  }
  // Commercial & School: only apply their own toggles, search, status and area filters
  if(c.status==='commercial'||c.status==='school'){
    if(!f.showCommercial&&c.status==='commercial') return false;
    if(!f.showSchools&&c.status==='school') return false;
    if(f.statusFilter==='residential') return false;
    if(f.q&&!c.name.toLowerCase().includes(f.q)&&!c.addr.toLowerCase().includes(f.q)&&!(c.nameJa||'').includes(f.q))return false;
    if(f.areaFilter&&!matchesArea(c,f.areaFilter)) return false;
    return true;
  }
  // Condo filters
  if(f.q&&!c.name.toLowerCase().includes(f.q)&&!c.addr.toLowerCase().includes(f.q)&&!c.luxTier.toLowerCase().includes(f.q)&&!(c.nameJa||'').includes(f.q))return false;
  // Tier filter: "A+" means A and above (A, S)
  if(f.tierVal){
    if(f.tierVal.endsWith('+')){
      const minTier = f.tierVal[0];
      if(TIER_ORDER[c.luxTier] < TIER_ORDER[minTier]) return false;
    } else {
      if(c.luxTier !== f.tierVal) return false;
    }
  }
  if(f.sp&&(c.salePsfMid<f.sp.min||c.salePsfMid>f.sp.max))return false;
  if(f.rn&&(c.rentMid<f.rn.min||c.rentMid>f.rn.max))return false;
  if(f.yr&&(c.year<f.yr.min||c.year>f.yr.max))return false;
  if(f.sz&&(c.sizeMid<f.sz.min||c.sizeMid>f.sz.max))return false;
  // Age filter (skip for upcoming)
  if(f.age&&c.status==='completed'){const a=f.currentYear-c.year; if(a<f.age.min||a>f.age.max) return false;}
  // Status filter
  if(f.statusFilter&&c.status!==f.statusFilter) return false;
  // Area filter
  if(f.areaFilter&&!matchesArea(c,f.areaFilter)) return false;
  return true;
}
