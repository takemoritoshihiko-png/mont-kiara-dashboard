// The CSV parser now lives with the app code (src/data/parseCsv.js) so there
// is exactly one implementation. This file stays as a thin re-export so the
// existing test imports keep working.
export { parseCsv, splitLine } from '../../src/data/parseCsv.js';
