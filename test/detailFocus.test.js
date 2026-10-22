import { expect, it } from 'vitest';
import { focusRecordAfterClose } from '../src/ui/info.js';

function harness(items, collapsed = false){
  const focused = [];
  const nodes = items.map(([label, visible]) => ({
    getAttribute: () => label,
    getClientRects: () => visible ? [{}] : [],
    focus: () => focused.push(label),
  }));
  const doc = {
    querySelectorAll: () => nodes,
    getElementById: id => id === 'panel'
      ? { classList: { contains: () => collapsed } }
      : { focus: () => focused.push(id === 'toggleBtn' ? 'toggle' : 'search') },
  };
  return { doc, focused };
}

it('restores focus to the visible newly rendered card, not a hidden comparison row', () => {
  const h = harness([['Garden、年間 RM 88,170', false], ['Garden、学費 RM 45,000–95,000/年', true]]);
  focusRecordAfterClose('Garden', h.doc);
  expect(h.focused).toEqual(['Garden、学費 RM 45,000–95,000/年']);
});

it('returns to the visible list toggle when cards are clipped by the collapsed panel', () => {
  const h = harness([['Garden、学費 RM 45,000–95,000/年', true]], true);
  focusRecordAfterClose('Garden', h.doc);
  expect(h.focused).toEqual(['toggle']);
});

it('uses the search field if nearby navigation or filters removed the selected card', () => {
  const h = harness([['Other、学費 RM 10,000/年', true]]);
  focusRecordAfterClose('Garden', h.doc);
  expect(h.focused).toEqual(['search']);
});
