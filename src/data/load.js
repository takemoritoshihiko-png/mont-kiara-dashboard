// Data loading: fetch the CSV/JSON files that sit next to index.html and map
// each row onto the record shape the UI expects.
import { parseCsv } from './parseCsv.js';
import { FIABCI_AWARDS } from './inline.js';

// ============================================================
// DATA SOURCE: CSV/JSON files served alongside this page
// (same repo, relative path — no cross-origin, no third-party proxy)
// ============================================================
export const CONDOS_CSV_URL = 'condos_data.csv';
export const COMMERCIAL_CSV_URL = 'commercial_data.csv';
export const SCHOOLS_CSV_URL = 'schools_data.csv';
export const SCHOOLS_DETAIL_URL = 'schools_detail.json';

/**
 * Fetch a data file as text. Throws on HTTP errors and on HTML error pages
 * being returned instead of the expected CSV/JSON.
 */
export async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const text = await res.text();
  // Check if response is HTML (error page) instead of CSV
  if (text.trim().startsWith('<!') || text.trim().startsWith('<html')) throw new Error('Got HTML instead of CSV');
  return text;
}

export function parseCondosCsv(text) {
  return parseCsv(text).map(obj => {
    return {
      name: obj.name || '',
      addr: obj.addr || '',
      year: parseInt(obj.year) || 2000,
      units: parseInt(obj.units) || 100,
      sizeMin: parseInt(obj.sizeMin) || 500,
      sizeMax: parseInt(obj.sizeMax) || 1500,
      rentMin: parseInt(obj.rentMin) || 2000,
      rentMax: parseInt(obj.rentMax) || 5000,
      salePsfMin: parseInt(obj.salePsfMin) || 500,
      salePsfMax: parseInt(obj.salePsfMax) || 700,
      lat: parseFloat(obj.lat) || 3.170,
      lng: parseFloat(obj.lng) || 101.652,
      developer: obj.developer || 'Other',
      ipropertyUrl: obj.iproperty_url || '',
      homepageUrl: obj.homepage_url || '',
      status: obj.status || 'completed',
      nameJa: obj.name_ja || '',
      brandScoreCSV: parseInt(obj.brand_score) || 0,
      blocks: parseInt(obj.blocks) || 1,
      floors: parseInt(obj.floors) || 0,
      tenure: obj.tenure || 'FH',
      premiumScoreCSV: parseInt(obj.premium_score) || 0,
      pLift: parseInt(obj.premium_private_lift) || 0,
      pConcierge: parseInt(obj.premium_concierge) || 0,
      pLowDensity: parseInt(obj.premium_low_density) || 0,
      pPool: parseInt(obj.premium_pool) || 0,
      pSkyLounge: parseInt(obj.premium_sky_lounge) || 0,
      pEV: parseInt(obj.premium_ev_charging) || 0,
      fiabciAward: FIABCI_AWARDS[obj.name] || null
    };
  }).filter(c => c.name && c.lat > 1);
}

export function parseCommercialCsv(text) {
  return parseCsv(text).map(obj => {
    return {
      name: obj.name || '',
      addr: obj.addr || '',
      year: parseInt(obj.year) || 2000,
      units: parseInt(obj.tenants) || 0,
      sizeMin: parseInt(obj.nla_sqft) || 0,
      sizeMax: 0, rentMin: 0, rentMax: 0, salePsfMin: 0, salePsfMax: 0,
      sizeMid: 0, salePsfMid: 0, rentMid: 0, yield: 0, rentPsfMid: 0,
      estPriceMax: 0, luxScore: 0, luxTier: 'D', density: 0, buildingAge: 0,
      blocks: 1, floors: 0, tenure: 'FH', brandScore: 0,
      lat: parseFloat(obj.lat) || 0,
      lng: parseFloat(obj.lng) || 0,
      developer: obj.developer || '',
      ipropertyUrl: '',
      homepageUrl: obj.homepage_url || '',
      status: 'commercial',
      nameJa: obj.name_ja || '',
      brandScoreCSV: 0,
      anchorTenants: obj.anchor_tenants || ''
    };
  }).filter(c => c.name && c.lat > 1);
}

export function parseSchoolsCsv(text) {
  return parseCsv(text).map(obj => {
    return {
      name: obj.name || '',
      addr: obj.addr || '',
      year: parseInt(obj.year) || 2000,
      curriculum: obj.curriculum || '',
      ageRange: obj.age_range || '',
      units: parseInt(obj.students) || 0,
      sizeMin: parseInt(obj.annual_fee_min) || 0,
      sizeMax: parseInt(obj.annual_fee_max) || 0,
      rentMin: 0, rentMax: 0, salePsfMin: 0, salePsfMax: 0,
      sizeMid: 0, salePsfMid: 0, rentMid: 0, yield: 0, rentPsfMid: 0,
      estPriceMax: 0, luxScore: 0, luxTier: 'D', density: 0, buildingAge: 0,
      blocks: 1, floors: 0, tenure: 'FH', brandScore: 0,
      lat: parseFloat(obj.lat) || 0,
      lng: parseFloat(obj.lng) || 0,
      developer: '',
      ipropertyUrl: '',
      homepageUrl: obj.homepage_url || '',
      status: 'school',
      nameJa: obj.name_ja || '',
      brandScoreCSV: 0,
      anchorTenants: obj.curriculum || ''
    };
  }).filter(c => c.name && c.lat > 1);
}
