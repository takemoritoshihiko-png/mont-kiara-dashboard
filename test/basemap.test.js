import { afterEach, expect, it, vi } from 'vitest';
import { initMap } from '../src/ui/map.js';

afterEach(() => vi.unstubAllGlobals());

it('起動時の背景地図はキー不要の標準タイルを使い、著作権リンクを表示する', () => {
  // Leaflet is a browser CDN dependency: capture the actual initMap boundary.
  const map = {
    setView() { return this; }, addLayer() {}, on() {}, getZoom: () => 15,
    getContainer: () => ({ classList: { toggle() {} } }), invalidateSize: vi.fn(),
  };
  const tileLayer = vi.fn(() => ({ addTo() {} }));
  vi.stubGlobal('L', {
    map: () => map, tileLayer,
    control: { zoom: () => ({ addTo() {} }) },
    markerClusterGroup: () => ({ on() {} }),
  });
  const mapElement = {};
  let resize;
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback){ resize = callback; }
    observe(element){ expect(element).toBe(mapElement); }
  });
  vi.stubGlobal('document', { getElementById: () => mapElement, createElement: () => ({}), head: { appendChild() {} } });
  initMap();
  const [url, options] = tileLayer.mock.calls[0];
  expect(url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  expect(options.attribution).toContain('href="https://www.openstreetmap.org/copyright"');
  expect(options.attribution).toContain('contributors');
  expect(options.maxZoom).toBe(19);
  resize();
  expect(map.invalidateSize).toHaveBeenCalledWith({ animate: false });
});
