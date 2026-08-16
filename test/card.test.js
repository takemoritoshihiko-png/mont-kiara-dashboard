// Contract for the per-type card templates (spec 2.5 / audit finding C1).
// cardBodyHtml is pure, so it can be checked without a DOM.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { cardBodyHtml } from '../src/ui/list.js';

const condo = (over = {}) => ({
  name: 'Seni Mont Kiara', nameJa: 'セニ・モントキアラ', addr: 'Jalan Kiara, Mont Kiara',
  status: 'completed', luxTier: 'S', luxScore: 63.5,
  year: 2008, units: 605, sizeMin: 1798, sizeMax: 6000,
  rentMin: 3200, rentMax: 5000, salePsfMin: 652, salePsfMax: 1059,
  fiabciAward: null, ...over,
});

const school = (over = {}) => ({
  name: 'Alice Smith School', nameJa: 'アリス・スミス・スクール', addr: '2 Jalan Bellamy 50460 KL',
  status: 'school', curriculum: 'British', ageRange: '3-18',
  year: 1946, units: 1700, sizeMin: 45000, sizeMax: 95000,
  rentMin: 0, rentMax: 0, salePsfMin: 0, salePsfMax: 0, luxTier: 'D', luxScore: 0, ...over,
});

const shop = (over = {}) => ({
  name: 'Publika (Solaris Dutamas)', nameJa: 'プブリカ', addr: '1 Jalan Dutamas 1 50480 KL',
  status: 'commercial', year: 2012, units: 250, sizeMin: 320000, sizeMax: 0,
  anchorTenants: 'BIG Supermarket; Art Galleries; F&B',
  rentMin: 0, rentMax: 0, salePsfMin: 0, salePsfMax: 0, luxTier: 'D', luxScore: 0, ...over,
});

describe('condo card', () => {
  it('leads with rent and PSF, thousands separated', () => {
    const h = cardBodyHtml(condo());
    expect(h).toContain('RM 3,200–5,000/月');
    expect(h).toContain('PSF 652–1,059');
  });

  it('shows the tier chip and a labelled Luxury score', () => {
    const h = cardBodyHtml(condo());
    expect(h).toContain('tier-badge');
    expect(h).toContain('Luxury 63.5');
  });

  it('shows year, units and size on the meta line', () => {
    const h = cardBodyHtml(condo());
    expect(h).toContain('2008年');
    expect(h).toContain('605 units');
    expect(h).toContain('1,798–6,000 sf');
  });

  it('says 未定 instead of a price for an unbuilt project', () => {
    const h = cardBodyHtml(condo({ status: 'upcoming', year: 2027 }));
    expect(h).toContain('価格 未定');
    expect(h).toContain('2027年完成予定');
    expect(h).not.toContain('/月');
  });

  it('shows the trophy only for an award winner', () => {
    expect(cardBodyHtml(condo())).not.toContain('🏆');
    expect(cardBodyHtml(condo({ fiabciAward: { year: 2013, category: 'Residential' } }))).toContain('🏆');
  });

  it('omits the score line when there is no score', () => {
    expect(cardBodyHtml(condo({ luxScore: 0 }))).not.toContain('Luxury');
  });

  it('never prints a zero price range', () => {
    const h = cardBodyHtml(condo({ rentMin: 0, rentMax: 0, salePsfMin: 0, salePsfMax: 0 }));
    expect(h).not.toContain('RM 0');
    expect(h).not.toContain('PSF 0');
  });
});

describe('school card (audit finding C1: it used to be drawn as a condo)', () => {
  it('leads with the annual fee, not a price per square foot', () => {
    const h = cardBodyHtml(school());
    expect(h).toContain('学費 RM 45,000–95,000/年');
  });

  it('never renders units / sf / PSF / rent boxes', () => {
    const h = cardBodyHtml(school());
    expect(h).not.toContain('units');
    expect(h).not.toContain(' sf');
    expect(h).not.toContain('PSF');
    expect(h).not.toContain('/月');
    expect(h).not.toContain('RM 0');
  });

  it('shows the curriculum as a chip and founding year / students / ages as meta', () => {
    const h = cardBodyHtml(school());
    expect(h).toContain('British');
    expect(h).toContain('1946年設立');
    expect(h).toContain('生徒数 1,700名');
    expect(h).toContain('3-18歳');
  });

  it('gives the name the whole line and puts the curriculum chip below it (B3c)', () => {
    const long = school({ name: 'Prince of Wales Island International School (POWIIS) Tanjung Bungah' });
    const h = cardBodyHtml(long);
    // The chip is out of the name row, so nothing competes with the name.
    expect(h).toContain('<div class="card-chips">');
    expect(h.indexOf('card-name')).toBeLessThan(h.indexOf('card-chips'));
    expect(h.slice(h.indexOf('card-head'), h.indexOf('card-chips'))).not.toContain('card-chip"');
  });

  it('omits the chip row entirely when the curriculum is unknown', () => {
    expect(cardBodyHtml(school({ curriculum: '' }))).not.toContain('card-chips');
  });

  it('says 要問合せ rather than RM 0 when the fee is unknown', () => {
    const h = cardBodyHtml(school({ sizeMin: 0, sizeMax: 0 }));
    expect(h).toContain('学費 要問合せ');
    expect(h).not.toContain('RM 0');
  });

  it('handles a fee with only a lower bound', () => {
    expect(cardBodyHtml(school({ sizeMax: 0 }))).toContain('学費 RM 45,000〜/年');
  });
});

describe('commercial card', () => {
  it('leads with NLA and the tenant count', () => {
    const h = cardBodyHtml(shop());
    expect(h).toContain('NLA 320,000 sf');
    expect(h).toContain('250店');
  });

  it('shows the opening year and the first two anchor tenants', () => {
    const h = cardBodyHtml(shop());
    expect(h).toContain('2012年開業');
    expect(h).toContain('BIG Supermarket ・ Art Galleries');
    expect(h).not.toContain('F&amp;B');
  });

  it('omits NLA when it is unknown instead of printing 0', () => {
    const h = cardBodyHtml(shop({ sizeMin: 0 }));
    expect(h).not.toContain('NLA');
    expect(h).toContain('250店');
  });

  it('omits the anchor line when there are no anchor tenants', () => {
    const h = cardBodyHtml(shop({ anchorTenants: '' }));
    expect(h).toContain('<div class="card-meta">2012年開業</div>');
  });
});

describe('all cards', () => {
  it('escape user-facing text so a quote in a name cannot break the markup', () => {
    const h = cardBodyHtml(condo({ name: 'The "Best" & <Only>' }));
    expect(h).toContain('The &quot;Best&quot; &amp; &lt;Only&gt;');
    expect(h).not.toContain('<Only>');
  });

  it('shows the Japanese name under the English one when there is one', () => {
    expect(cardBodyHtml(condo())).toContain('セニ・モントキアラ');
    expect(cardBodyHtml(condo({ nameJa: '' }))).not.toContain('card-ja');
  });
});

// 2026-08-16 竹森氏「なおす」。1行固定だったため、実測336件中36件（物件31・
// 学校4・商業1）が省略記号で切れていた（使える幅287px / 長いものは379px必要）。
// 切れるのは番地や郵便番号の側で、「どこにあるか」がいちばん読めなくなっていた。
describe('カードの住所は切らない', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

  it('2行まで折り返す（1行に押し込まない）', () => {
    const rule = html.slice(html.indexOf('.card-addr{'));
    const decl = rule.slice(0, rule.indexOf('}'));
    expect(decl).not.toContain('white-space:nowrap');
    expect(decl).toContain('-webkit-line-clamp:2');
  });

  // 2行に収まることは実ブラウザで確認済み（物件271・学校33・商業32の全336件で
  // はみ出しゼロ／2行になったのは37件だけ）。ここではその前提を崩す変更——
  // 1行に戻す・省略記号だけに頼る——を検出する。
  it('省略記号で消す作りに戻さない', () => {
    const rule = html.slice(html.indexOf('.card-addr{'));
    const decl = rule.slice(0, rule.indexOf('}'));
    expect(decl).not.toContain('text-overflow:ellipsis');
    expect(decl).toContain('overflow:hidden');   // 3行目以降は出さない
  });
});
