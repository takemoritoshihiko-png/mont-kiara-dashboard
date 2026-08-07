// Quote-aware CSV parser — the single implementation used by both the running
// app (src/data/load.js) and the tests (test/helpers/csv.js re-exports it).
//
// Semantics kept from the original inline parser in index.html:
//   - values are trimmed (so CRLF line endings do not leak into the last cell)
//   - surrounding double quotes are removed, `""` inside a quoted field is a
//     literal quote
//   - blank lines are skipped

/** Split one CSV line into raw cell values (quotes removed, not trimmed). */
export function splitLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ',') {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/**
 * Parse CSV text into row objects keyed by the header row.
 * Each row also carries `__cellCount` (the number of cells actually present),
 * which the data-integrity tests use to detect ragged rows.
 */
export function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];
  const header = splitLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const row = {};
    header.forEach((h, i) => { row[h] = (cells[i] ?? '').trim(); });
    row.__cellCount = cells.length;
    return row;
  });
}
