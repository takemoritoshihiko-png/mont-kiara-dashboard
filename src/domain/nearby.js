// "What is around this place?" — the engine behind the detail panel's 周辺 tab.
//
// Pure: coordinates in, grouped records out. No DOM, no state, no Leaflet, so
// the whole thing is exercised by test/nearby.test.js.
import { haversineKm } from './geo.js';
import { recordLayer, LAYERS } from './filter.js';

// Walking / short drive / longer drive. Ascending — nearby() assigns an item to
// the FIRST bucket it fits, so an unsorted list would mis-classify.
export const NEARBY_BUCKETS = [800, 2000, 6000];

/** Heading shown above each bucket. Keyed by the bucket's radius in metres. */
export const BUCKET_LABELS = {
  800: '🚶 徒歩圏 (800m)',
  2000: '🚗 車で約5分 (2km)',
  6000: '🚗 車で約15分 (6km)',
};

/** 350m below a kilometre, 1.2km above it. Never "0.35km" and never "1234m". */
export function formatDistance(m) {
  return m < 1000 ? Math.round(m) + 'm' : (m / 1000).toFixed(1) + 'km';
}

/**
 * Group everything around `origin` into distance buckets.
 *
 * Buckets are cumulative-exclusive: a record lands in the first bucket whose
 * radius covers it, so the 2km bucket means "800m–2km", not "everything within
 * 2km". The origin itself is never listed, and records without coordinates are
 * skipped rather than placed at (0,0).
 *
 * @param {object} origin   the selected record ({lat, lng, name})
 * @param {object[]} records  every record on the map (all three layers)
 * @param {{buckets?: number[]}} [opts]  radii in metres, ascending
 * @returns {{maxM:number,total:number,counts:object,byLayer:object}[]}
 *   one entry per bucket, in the same order as `buckets`. `counts` and
 *   `byLayer` are keyed by every layer in LAYERS — built from that constant
 *   rather than written out, so a new layer (dining) is counted the day it is
 *   added instead of falling into an undefined bucket.
 */
export function nearby(origin, records, { buckets = NEARBY_BUCKETS } = {}) {
  const out = buckets.map(maxM => ({
    maxM,
    total: 0,
    counts: Object.fromEntries(LAYERS.map(k => [k, 0])),
    byLayer: Object.fromEntries(LAYERS.map(k => [k, []])),
  }));
  if (!origin || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) return out;

  for (const r of (records || [])) {
    if (!r || r === origin) continue;
    // Records are identified by name everywhere else in the app (selectCondo,
    // markers, the URL), so a name match is the same record even if the object
    // identity differs.
    if (r.name && origin.name && r.name === origin.name) continue;
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) continue;

    // Rounded to a centimetre. Distances are computed in floating point, so a
    // point placed exactly on a boundary can come back as 800.0000000001 and
    // fall out of its bucket; rounding makes the boundary deterministic while
    // staying far finer than anything we display.
    const distanceM = Math.round(haversineKm(origin.lat, origin.lng, r.lat, r.lng) * 100000) / 100;

    const i = buckets.findIndex(max => distanceM <= max);
    if (i === -1) continue;  // beyond the widest bucket

    const b = out[i];
    const layer = recordLayer(r);
    b.byLayer[layer].push({ record: r, distanceM });
    b.counts[layer]++;
    b.total++;
  }

  for (const b of out) LAYERS.forEach(k => b.byLayer[k].sort((x, y) => x.distanceM - y.distanceM));
  return out;
}
