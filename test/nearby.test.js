// Contract for the 周辺 engine (src/domain/nearby.js).
import { describe, it, expect } from 'vitest';
import { nearby, formatDistance, NEARBY_BUCKETS } from '../src/domain/nearby.js';

// A north-south offset of `m` metres, in degrees of latitude. Along a meridian
// the haversine reduces to R * dLat, so a fixture built this way sits at
// exactly the distance it claims.
const dLat = (m) => (m / 1000 / 6371) * 180 / Math.PI;

const ORIGIN = { name: 'Origin Tower', status: 'completed', lat: 3.15, lng: 101.65 };

/** A record `m` metres due north of ORIGIN. */
const at = (m, over = {}) => ({
  name: 'P' + m, status: 'completed', lat: 3.15 + dLat(m), lng: 101.65, ...over,
});

const names = (bucket, layer) => bucket.byLayer[layer].map(x => x.record.name);

describe('bucket boundaries', () => {
  it('puts a point one metre inside the walking radius in the 800m bucket', () => {
    const [walk, drive5, drive15] = nearby(ORIGIN, [at(799)]);
    expect(names(walk, 'condo')).toEqual(['P799']);
    expect(drive5.total).toBe(0);
    expect(drive15.total).toBe(0);
  });

  it('treats the radius itself as inside (<= 800m)', () => {
    const [walk, drive5] = nearby(ORIGIN, [at(800)]);
    expect(names(walk, 'condo')).toEqual(['P800']);
    expect(drive5.total).toBe(0);
  });

  it('pushes a point one metre outside into the next bucket', () => {
    const [walk, drive5] = nearby(ORIGIN, [at(801)]);
    expect(walk.total).toBe(0);
    expect(names(drive5, 'condo')).toEqual(['P801']);
  });

  it('applies the same rule at the 2km edge', () => {
    const [, drive5, drive15] = nearby(ORIGIN, [at(2000), at(2001)]);
    expect(names(drive5, 'condo')).toEqual(['P2000']);
    expect(names(drive15, 'condo')).toEqual(['P2001']);
  });

  it('applies the same rule at the 6km edge, and drops anything beyond it', () => {
    const b = nearby(ORIGIN, [at(6000), at(6001), at(20000)]);
    expect(names(b[2], 'condo')).toEqual(['P6000']);
    expect(b.reduce((s, x) => s + x.total, 0)).toBe(1);
  });

  it('is cumulative-exclusive: a near item is not repeated in the wider buckets', () => {
    const [walk, drive5, drive15] = nearby(ORIGIN, [at(100)]);
    expect(walk.total).toBe(1);
    expect(drive5.total).toBe(0);
    expect(drive15.total).toBe(0);
  });

  it('returns one entry per bucket, in the order given, even with no data', () => {
    const b = nearby(ORIGIN, []);
    expect(b.map(x => x.maxM)).toEqual(NEARBY_BUCKETS);
    expect(b.every(x => x.total === 0)).toBe(true);
  });
});

describe('origin exclusion', () => {
  it('never lists the origin object itself', () => {
    const b = nearby(ORIGIN, [ORIGIN, at(100)]);
    expect(b[0].total).toBe(1);
    expect(names(b[0], 'condo')).toEqual(['P100']);
  });

  it('excludes a same-named record even when it is a different object', () => {
    const twin = { ...ORIGIN };
    expect(nearby(ORIGIN, [twin])[0].total).toBe(0);
  });

  it('does not exclude a different record that happens to share coordinates', () => {
    const roommate = { name: 'Podium Mall', status: 'commercial', lat: ORIGIN.lat, lng: ORIGIN.lng };
    expect(names(nearby(ORIGIN, [roommate])[0], 'commercial')).toEqual(['Podium Mall']);
  });
});

describe('grouping and ordering', () => {
  const records = [
    at(300, { name: 'Near School', status: 'school' }),
    at(120, { name: 'Far School', status: 'school' }),   // deliberately misnamed: tests sorting
    at(500, { name: 'Corner Mall', status: 'commercial' }),
    at(650, { name: 'Tower B', status: 'upcoming' }),
    at(1500, { name: 'Drive School', status: 'school' }),
  ];

  it('splits each bucket by layer', () => {
    const [walk] = nearby(ORIGIN, records);
    // Every layer gets a key, including the ones with nothing in them: the
    // counts object is built from LAYERS so a new layer cannot go uncounted.
    expect(walk.counts).toEqual({ school: 2, commercial: 1, dining: 0, condo: 1 });
    expect(walk.total).toBe(4);
  });

  it('sorts each layer nearest-first', () => {
    const [walk] = nearby(ORIGIN, records);
    expect(names(walk, 'school')).toEqual(['Far School', 'Near School']);
    expect(walk.byLayer.school[0].distanceM).toBeCloseTo(120, 1);
  });

  it('counts upcoming projects as the condo layer', () => {
    expect(names(nearby(ORIGIN, records)[0], 'condo')).toEqual(['Tower B']);
  });

  it('keeps the layers separate across buckets', () => {
    const [, drive5] = nearby(ORIGIN, records);
    expect(drive5.counts).toEqual({ school: 1, commercial: 0, dining: 0, condo: 0 });
    expect(names(drive5, 'school')).toEqual(['Drive School']);
  });

  // D3: the engine is layer-agnostic — a restaurant lands in the same buckets
  // as anything else, and a restaurant as the origin sees the other layers.
  it('places restaurants in the 飲食 bucket alongside the other layers', () => {
    const [walk] = nearby(ORIGIN, [...records, at(200, { name: 'Dewakan', status: 'dining' })]);
    expect(names(walk, 'dining')).toEqual(['Dewakan']);
    expect(walk.counts.dining).toBe(1);
    expect(walk.total).toBe(5);
  });

  it('shows the other layers around a restaurant', () => {
    const eatery = { name: 'Dewakan', status: 'dining', lat: 3.15, lng: 101.65 };
    const [walk] = nearby(eatery, records);
    expect(walk.counts).toEqual({ school: 2, commercial: 1, dining: 0, condo: 1 });
  });
});

describe('missing coordinates', () => {
  it('skips records without usable lat/lng instead of placing them at (0,0)', () => {
    const b = nearby(ORIGIN, [
      { name: 'No Coords', status: 'completed' },
      { name: 'Null Coords', status: 'completed', lat: null, lng: null },
      at(200),
    ]);
    expect(b.reduce((s, x) => s + x.total, 0)).toBe(1);
  });

  it('returns empty buckets when the origin itself has no coordinates', () => {
    const b = nearby({ name: 'Ghost' }, [at(100)]);
    expect(b.every(x => x.total === 0)).toBe(true);
  });

  it('survives a missing record list', () => {
    expect(nearby(ORIGIN, undefined).every(x => x.total === 0)).toBe(true);
  });
});

describe('formatDistance', () => {
  it('shows whole metres below a kilometre', () => {
    expect(formatDistance(350)).toBe('350m');
    expect(formatDistance(350.4)).toBe('350m');
    expect(formatDistance(999)).toBe('999m');
  });

  it('switches to one decimal of a kilometre at 1000m', () => {
    expect(formatDistance(1000)).toBe('1.0km');
    expect(formatDistance(1234)).toBe('1.2km');
    expect(formatDistance(5960)).toBe('6.0km');
  });
});
