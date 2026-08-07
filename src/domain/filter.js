// Pure filtering logic for the list.
//
// B3a: filtering is now *per layer*. The active layer (物件 / 学校 / 商業) picks
// which records are listed at all, and each layer brings its own criteria.
// A record never matches a layer it does not belong to.

export function parseR(v){if(!v)return null;const[a,b]=v.split('-').map(Number);return{min:a,max:b}}
export const TIER_ORDER = {S:5, A:4, B:3, C:2, D:1};

// ============================================================
// LAYERS
// ============================================================
export const LAYERS = ['condo', 'school', 'commercial'];

/** Japanese label used in headings and the empty-result message. */
export const LAYER_LABELS = { condo: '物件', school: '学校', commercial: '商業施設' };

/** Which layer a record belongs to. `status` is the discriminator in the data. */
export function recordLayer(c){
  return c.status === 'school' ? 'school' : c.status === 'commercial' ? 'commercial' : 'condo';
}

// Distinct curriculum substrings across schools_data.csv. Matching is by
// substring because a school's curriculum field combines several
// ("British / IB", "IB (PYP/IGCSE/DP)").
export const CURRICULA = ['American', 'IB', 'British', 'Australian', 'French', 'Canadian', 'Japanese'];

// ============================================================
// AREA
// ============================================================
/**
 * Area quick-filter test. Returns false when the record is outside the area.
 * Area keys are the same ones the map's jump buttons use, plus the historical
 * 'desa-parkcity' spelling of the dropdown.
 */
export function matchesArea(c, areaFilter){
  if(!areaFilter) return true;
  const a=(c.addr||'').toLowerCase();
  const n=(c.name||'').toLowerCase();
  // KL sits near lat 3.1, Penang near 5.4. Geography (not spelling) decides the
  // island, because KL addresses can contain the word "Penang" (Jalan Penang).
  const isPenang=(c.lat||0)>4;
  // -- Penang --
  // The name is consulted too (as it already is for KLGCC/KLCC): a few Penang
  // towers carry the neighbourhood in the name but not in the street address
  // (e.g. "Gurney Palace", Jalan Concordia).
  const isGurney=isPenang&&(a.includes('gurney')||a.includes('pulau tikus')||a.includes('kelawei')||n.includes('gurney'));
  const isTanjung=isPenang&&(a.includes('tanjung tokong')||a.includes('tanjung bungah')||a.includes('tanjung bunga')||a.includes('tanjung pinang'));
  const isFerringhi=isPenang&&(a.includes('ferringhi')||n.includes('ferringhi'));
  const isBayan=isPenang&&(a.includes('bayan lepas')||a.includes('bayan baru')||a.includes('bayan indah')||a.includes('bayan jambul')||a.includes('bukit jambul'));
  // -- KL --
  const isKLGCC=!isPenang&&(a.includes('bukit kiara')||n.includes('klgcc'));
  const isDPC=!isPenang&&a.includes('desa parkcity');
  const isBangsar=!isPenang&&a.includes('bangsar');
  const isKLCC=!isPenang&&(a.includes('klcc')||a.includes('bukit bintang')||a.includes('jalan conlay')||a.includes('jalan imbi')||a.includes('jalan pinang')||a.includes('kl sentral')||n.includes('klcc'));
  const isAmpang=!isPenang&&(a.includes('u-thant')||a.includes('ampang hilir')||a.includes('embassy row')||a.includes('kia peng')||a.includes('persiaran stonor')||a.includes('lorong kuda'));
  const isDH=!isPenang&&(a.includes('damansara heights')||a.includes('jalan batai')||a.includes('changkat semantan'));
  // Mont Kiara is the KL catch-all: anything on the KL side that is not one of
  // the other named areas. Penang records are never Mont Kiara.
  const isMK=!isPenang&&!isDPC&&!isBangsar&&!isKLGCC&&!isKLCC&&!isAmpang&&!isDH;
  if(areaFilter==='mont-kiara'&&!isMK) return false;
  if((areaFilter==='desa-parkcity'||areaFilter==='parkcity')&&!isDPC) return false;
  if(areaFilter==='bangsar'&&!isBangsar) return false;
  if(areaFilter==='klgcc'&&!isKLGCC) return false;
  if(areaFilter==='klcc'&&!isKLCC) return false;
  if(areaFilter==='ampang'&&!isAmpang) return false;
  if(areaFilter==='damansara'&&!isDH) return false;
  if(areaFilter==='gurney'&&!isGurney) return false;
  if(areaFilter==='tanjung'&&!isTanjung) return false;
  if(areaFilter==='ferringhi'&&!isFerringhi) return false;
  if(areaFilter==='bayan'&&!isBayan) return false;
  return true;
}

// ============================================================
// SCHOOL helpers
// ============================================================
/** "3-18" -> {min:3, max:18}. Returns null when the field is missing/unparsable. */
export function parseAgeRange(s){
  if(!s) return null;
  const [a,b]=String(s).split('-').map(Number);
  if(!Number.isFinite(a)||!Number.isFinite(b)) return null;
  return {min:a, max:b};
}

/** The school accepts a child of `age` (its age_range covers that age). */
export function matchesSchoolAge(c, age){
  if(age===''||age==null) return true;
  const r=parseAgeRange(c.ageRange);
  if(!r) return false;
  return age>=r.min && age<=r.max;
}

/** Curriculum is matched as a substring ("IB" matches "British / IB"). */
export function matchesCurriculum(c, cur){
  if(!cur) return true;
  return (c.curriculum||'').toLowerCase().includes(cur.toLowerCase());
}

// ============================================================
// SEARCH
// ============================================================
function matchesQuery(c, q, layer){
  const hay=[c.name, c.addr, c.nameJa||''];
  if(layer==='condo') hay.push(c.luxTier||'');
  if(layer==='school') hay.push(c.curriculum||'');
  if(layer==='commercial') hay.push(c.anchorTenants||'');
  return hay.some(v=>String(v).toLowerCase().includes(q));
}

// ============================================================
// PER-LAYER CRITERIA
// ============================================================
function matchesCondo(c, f){
  if(f.showAwardOnly && !c.fiabciAward) return false;
  // Tier filter: "A+" means A and above (A, S)
  if(f.tierVal){
    if(f.tierVal.endsWith('+')){
      const minTier=f.tierVal[0];
      if(TIER_ORDER[c.luxTier] < TIER_ORDER[minTier]) return false;
    } else if(c.luxTier !== f.tierVal) return false;
  }
  if(f.sp&&(c.salePsfMid<f.sp.min||c.salePsfMid>f.sp.max))return false;
  if(f.rn&&(c.rentMid<f.rn.min||c.rentMid>f.rn.max))return false;
  if(f.yr&&(c.year<f.yr.min||c.year>f.yr.max))return false;
  if(f.sz&&(c.sizeMid<f.sz.min||c.sizeMid>f.sz.max))return false;
  // Age filter (skip for upcoming — an unbuilt project has no age)
  if(f.age&&c.status==='completed'){const a=f.currentYear-c.year; if(a<f.age.min||a>f.age.max) return false;}
  // Lifecycle only: completed / upcoming. The old 'commercial' / 'residential'
  // options moved to the layer control.
  if(f.statusFilter&&c.status!==f.statusFilter) return false;
  return true;
}

function matchesSchool(c, f){
  if(!matchesSchoolAge(c, f.schoolAge)) return false;
  if(!matchesCurriculum(c, f.curriculum)) return false;
  // Annual fee is matched on the *entry* fee (annual_fee_min), the same value
  // the summary bar takes its median from.
  if(f.fee&&(c.sizeMin<f.fee.min||c.sizeMin>f.fee.max)) return false;
  return true;
}

function matchesCommercial(c, f){
  if(f.nla&&(c.sizeMin<f.nla.min||c.sizeMin>f.nla.max)) return false;
  if(f.openYear&&(c.year<f.openYear.min||c.year>f.openYear.max)) return false;
  if(f.anchorQ&&!(c.anchorTenants||'').toLowerCase().includes(f.anchorQ)) return false;
  return true;
}

/**
 * @param {object} c  a condo / commercial / school record
 * @param {object} f  criteria:
 *   common      — layer, q, areaFilter
 *   condo       — tierVal, sp, rn, yr, sz, age, statusFilter, showAwardOnly, currentYear
 *   school      — schoolAge, curriculum, fee
 *   commercial  — nla, openYear, anchorQ
 */
export function matchesFilters(c, f){
  const layer=f.layer||'condo';
  if(recordLayer(c)!==layer) return false;
  if(f.q&&!matchesQuery(c,f.q,layer)) return false;
  if(f.areaFilter&&!matchesArea(c,f.areaFilter)) return false;
  if(layer==='school') return matchesSchool(c,f);
  if(layer==='commercial') return matchesCommercial(c,f);
  return matchesCondo(c,f);
}
