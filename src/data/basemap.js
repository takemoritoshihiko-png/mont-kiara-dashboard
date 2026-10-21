// Background-map provider configuration. Keep URLs and attribution together.
// Normal browser caching/referrers; no offline downloads or tile prefetching.
// Policy: https://operations.osmfoundation.org/policies/tiles/ (2026-10-21)
export const BASEMAP = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  options: {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
};
