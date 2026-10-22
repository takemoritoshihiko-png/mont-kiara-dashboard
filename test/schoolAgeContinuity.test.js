import { afterEach, describe, expect, it, vi } from 'vitest';
import { toggleSchoolFinder } from '../src/ui/schoolFinder.js';
import { setSfActive } from '../src/state.js';

afterEach(() => { vi.unstubAllGlobals(); setSfActive(false); });

describe('school comparison keeps the chosen age', () => {
  it.each([
    ['8', '5', '8'], ['3', '8', '3'], ['17', '8', '17'],
    ['', '8', '8'], ['18', '8', '8'],
  ])('filter %s and comparison %s open at %s', (filter, current, expected) => {
    const age = { value: current, options: Array.from({ length: 15 }, (_, i) => ({ value: String(i + 3) })) };
    vi.stubGlobal('document', {
      getElementById: id => id === 'sfAge' ? age : id === 'fSchoolAge' ? { value: filter } : null,
      querySelector: () => null,
    });
    setSfActive(false);
    toggleSchoolFinder();
    expect(age.value).toBe(expected);
  });
});
