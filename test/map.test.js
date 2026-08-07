// Contract for the map's zoom thresholds (src/ui/map.js).
// Only the pure helper is exercised here: Leaflet and Leaflet.markercluster
// are browser-only CDN scripts, so every call into them lives inside a
// function and never runs at import time.
import { describe, it, expect } from 'vitest';
import { labelModeForZoom, LABEL_ZOOM, CLUSTER_OFF_ZOOM, pinClassName } from '../src/ui/map.js';

describe('labelModeForZoom', () => {
  it('hides the labels below the threshold (hover only)', () => {
    expect(labelModeForZoom(14)).toBe('hover');
  });

  it('turns the labels on at the threshold', () => {
    expect(labelModeForZoom(15)).toBe('permanent');
  });

  it('keeps the labels on above the threshold', () => {
    expect(labelModeForZoom(16)).toBe('permanent');
  });

  it('is hover-only at the initial KL-wide zoom (12) — 392 labels would collide', () => {
    expect(labelModeForZoom(12)).toBe('hover');
  });

  it('handles fractional zooms on both sides of the threshold', () => {
    expect(labelModeForZoom(14.9)).toBe('hover');
    expect(labelModeForZoom(15.1)).toBe('permanent');
  });

  it('returns permanent for every zoom >= LABEL_ZOOM and hover below it', () => {
    for (let z = 0; z <= 19; z++) {
      expect(labelModeForZoom(z)).toBe(z >= LABEL_ZOOM ? 'permanent' : 'hover');
    }
  });
});

describe('selected marker ring (spec 2.7 / audit D3)', () => {
  it('marks the selected pin with an extra class, never a different element', () => {
    expect(pinClassName(false)).toBe('mk-pin');
    expect(pinClassName(true)).toBe('mk-pin mk-pin-sel');
    // The base class must survive, otherwise the shared transition is lost.
    expect(pinClassName(true).split(' ')).toContain('mk-pin');
  });
});

describe('zoom threshold constants', () => {
  it('clustering stops exactly where the permanent labels start', () => {
    expect(CLUSTER_OFF_ZOOM).toBe(LABEL_ZOOM);
  });

  it('the thresholds sit inside Leaflet’s zoom range', () => {
    expect(LABEL_ZOOM).toBeGreaterThan(0);
    expect(LABEL_ZOOM).toBeLessThanOrEqual(19);
  });
});
