import { DEVELOPERS } from '../data/inline.js';

// ============================================================
// LUXURY INDEX v4.2
// Base(85%): AvgSize, MaxSize, PSF, RentPSF, TopPrice,
//            Exclusivity, Density, Age, Brand
// Premium Features Bonus(15%): Private Lift, Concierge, etc.
// ============================================================
export function calcNAge(buildingAge) {
  if (buildingAge <= 0) return 100;
  if (buildingAge <= 15) return Math.max(0, 100 - (buildingAge * 3.2));
  const base = 100 - (15 * 3.2);
  return Math.max(0, base - ((buildingAge - 15) * 5.2));
}

export function calcLuxury(condos) {
  const currentYear = new Date().getFullYear();

  condos.forEach(c => {
    c.sizeMid = (c.sizeMin + c.sizeMax) / 2;
    c.sizeComposite = (c.sizeMin * 0.6) + (c.sizeMid * 0.4);
    // Unpublished rent/PSF arrives as null (see load.js) and every derived
    // figure stays null with it — a mid computed from an invented default
    // would leak into filters, sorts and the luxury score.
    c.salePsfMid = c.salePsfMin != null && c.salePsfMax != null ? (c.salePsfMin + c.salePsfMax) / 2 : null;
    c.rentMid = c.rentMin != null && c.rentMax != null ? (c.rentMin + c.rentMax) / 2 : null;
    c.yield = c.rentMid != null && c.salePsfMid > 0 && c.sizeMid > 0
      ? (c.rentMid * 12) / (c.salePsfMid * c.sizeMid) * 100 : 0;
    c.estPriceMax = c.salePsfMax != null ? c.salePsfMax * c.sizeMax : null;
    c.devInfo = DEVELOPERS[c.developer] || DEVELOPERS['Other'];
    c.brandScore = c.brandScoreCSV > 0 ? c.brandScoreCSV : c.devInfo.score;

    c.rentPsfMid = c.rentMid != null && c.sizeMid > 0 ? c.rentMid / c.sizeMid : null;
    c.density = (c.blocks && c.blocks > 0) ? c.units / c.blocks : c.units;
    c.buildingAge = currentYear - c.year;
    c.premiumScore = parseInt(c.premiumScoreCSV) || 0;
  });

  // v4.2 Fixed reference ranges
  const REF = {
    sizeComp: { min: 500,   max: 3500 },
    sizeMax:  { min: 1000,  max: 7500 },
    psfMid:   { min: 400,   max: 1800 },   // v4.2: 1200→1800
    rentPsf:  { min: 2.0,   max: 6.0 },
    priceMax: { min: 1000000, max: 12000000 },
    units:    { min: 80,    max: 1000 },
    density:  { min: 40,    max: 250 }
  };
  const normFixed = (v, min, max, inv) => {
    const t = Math.max(0, Math.min(1, (v - min) / (max - min)));
    return (inv ? 1 - t : t) * 100;
  };

  // v4.2 Weights: Base 85% + Premium 15% = 100%
  condos.forEach((c, i) => {
    const nSzAvg  = normFixed(c.sizeComposite, REF.sizeComp.min, REF.sizeComp.max);
    const nSzMax  = normFixed(c.sizeMax, REF.sizeMax.min, REF.sizeMax.max);
    // Unpublished price components score 0 — the record earns points only for
    // what is actually known about it, not for a market-average stand-in.
    const nPsf    = c.salePsfMid  != null ? normFixed(c.salePsfMid, REF.psfMid.min, REF.psfMid.max) : 0;
    const nRentPsf= c.rentPsfMid  != null ? normFixed(c.rentPsfMid, REF.rentPsf.min, REF.rentPsf.max) : 0;
    const nPrice  = c.estPriceMax != null ? normFixed(c.estPriceMax, REF.priceMax.min, REF.priceMax.max) : 0;
    const nExcl   = normFixed(c.units, REF.units.min, REF.units.max, true);
    const nDensity= normFixed(c.density, REF.density.min, REF.density.max, true);
    const nAge    = calcNAge(c.buildingAge);
    const premiumNorm = (c.premiumScore / 15) * 100;

    let baseScore = nSzAvg*0.12 + nSzMax*0.03 + nPsf*0.15 + nRentPsf*0.13
                  + nPrice*0.03 + nExcl*0.07 + nDensity*0.03 + nAge*0.12 + c.brandScore*0.17;
    let raw = baseScore + premiumNorm * 0.15;
    c.luxScore = Math.round(raw * 10) / 10;
    c.luxTier = luxTierFor(c.luxScore);
  });
}

/** Luxury score -> tier letter. Boundaries: S>=67, A>=57, B>=47, C>=37, else D. */
export function luxTierFor(luxScore) {
  return luxScore >= 67 ? 'S' : luxScore >= 57 ? 'A' : luxScore >= 47 ? 'B' : luxScore >= 37 ? 'C' : 'D';
}
