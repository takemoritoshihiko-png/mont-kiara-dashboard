// Contract for the shared CSV parser (src/data/parseCsv.js).
import { describe, it, expect } from 'vitest';
import { parseCsv, splitLine } from '../src/data/parseCsv.js';

describe('splitLine', () => {
  it('splits plain cells', () => {
    expect(splitLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('keeps commas that live inside quotes', () => {
    expect(splitLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
  });

  it('treats "" inside a quoted field as one literal quote', () => {
    expect(splitLine('a,"say ""hi""",b')).toEqual(['a', 'say "hi"', 'b']);
  });

  it('produces empty strings for empty cells, including leading/trailing', () => {
    expect(splitLine(',a,,b,')).toEqual(['', 'a', '', 'b', '']);
  });

  it('handles a single cell with no comma', () => {
    expect(splitLine('solo')).toEqual(['solo']);
  });
});

describe('parseCsv', () => {
  it('keys rows by the header row', () => {
    const rows = parseCsv('name,year\nSeni,2011\nPavilion,2018');
    expect(rows.map((r) => r.name)).toEqual(['Seni', 'Pavilion']);
    expect(rows.map((r) => r.year)).toEqual(['2011', '2018']);
  });

  it('handles CRLF line endings without leaking \\r into the last cell', () => {
    const rows = parseCsv('name,year\r\nSeni,2011\r\nPavilion,2018\r\n');
    expect(rows).toHaveLength(2);
    expect(rows[1].year).toBe('2018');
  });

  it('trims surrounding whitespace in headers and cells', () => {
    const rows = parseCsv('name , year\n  Seni  , 2011 ');
    expect(rows[0].name).toBe('Seni');
    expect(rows[0].year).toBe('2011');
  });

  it('keeps quoted commas inside one cell', () => {
    const rows = parseCsv('name,addr\nSeni,"Jalan 1, Mont Kiara"');
    expect(rows[0].addr).toBe('Jalan 1, Mont Kiara');
  });

  it('reports empty cells as empty strings, and missing trailing cells too', () => {
    const rows = parseCsv('name,addr,year\nSeni,,2011\nPavilion,KL');
    expect(rows[0].addr).toBe('');
    expect(rows[1].year).toBe('');
  });

  it('records the actual cell count so ragged rows are detectable', () => {
    const rows = parseCsv('name,addr,year\nSeni,,2011\nPavilion,KL');
    expect(rows.map((r) => r.__cellCount)).toEqual([3, 2]);
  });

  it('skips blank lines', () => {
    const rows = parseCsv('name\nSeni\n\nPavilion\n');
    expect(rows.map((r) => r.name)).toEqual(['Seni', 'Pavilion']);
  });

  it('returns an empty array for empty input', () => {
    expect(parseCsv('')).toEqual([]);
  });
});
