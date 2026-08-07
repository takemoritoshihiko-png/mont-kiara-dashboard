// Contract for the 詳細 tab of the overlay (src/ui/info.js) — the 物件 / 学校 /
// 商業 panels. The 飲食 panel is covered by diningLayer.test.js.
//
// detailHtml() is pure (it reads SCHOOLS_DETAIL and nothing else), so the whole
// file runs without a DOM, the same way card.test.js does. What is held here is
// the part that keeps going quietly wrong: a heading that contradicts the list
// under it, a label that only exists in the source site's English, a loaded
// column the panel never prints, and a long block that buries everything after
// it.
import { describe, it, expect, beforeEach } from 'vitest';
import { setSchoolsDetail } from '../src/state.js';
import { detailHtml } from '../src/ui/info.js';

/** A condo record in the shape parseCondoCsv() produces. */
const condo = (over = {}) => ({
  name: 'Vipod Residences', nameJa: 'ヴィポッド', addr: '6 Jalan Kia Peng, KLCC',
  status: 'existing', year: 2014, units: 337,
  salePsfMin: 900, salePsfMax: 1200, rentMin: 5000, rentMax: 9000,
  sizeMin: 700, sizeMax: 1500, luxScore: 82, luxTier: 'A',
  // private_lift×7 + concierge×2 + low_density + pool = 11, from FOUR facilities.
  // The mismatch this fixture reproduces is the whole point of the 主な設備 test.
  premiumScore: 11, pLift: 1, pConcierge: 1, pLowDensity: 3, pPool: 1,
  pSkyLounge: 0, pEV: 0,
  developer: 'Monoloft', homepageUrl: '', ipropertyUrl: 'https://iproperty.example/vipod',
  ...over,
});

const mall = (over = {}) => ({
  name: 'Suria KLCC', nameJa: 'スリアKLCC', addr: 'Jalan Ampang',
  status: 'commercial', year: 1998, units: 350, sizeMin: 1_000_000,
  developer: 'KLCC Property Holdings', homepageUrl: 'https://suriaklcc.example/',
  anchorTenants: 'Isetan; Parkson', ipropertyUrl: '',
  ...over,
});

const school = (over = {}) => ({
  name: 'Test International School', nameJa: '', addr: 'Mont Kiara',
  status: 'school', year: 1994, units: 1200, sizeMin: 30_000, sizeMax: 90_000,
  ageRange: '3-18', curriculum: 'IB', homepageUrl: 'https://tis.example/',
  ...over,
});

// ============================================================
// 物件 — labels and the premium block
// ============================================================
describe('物件: Japanese labels keep the source site\'s term beside them', () => {
  it('leads with 売買単価 and keeps PSF, the word iProperty/EdgeProp print', () => {
    const h = detailHtml(condo());
    expect(h).toContain('売買単価');
    expect(h).toContain('<small class="kv-sub">PSF</small>');
    // Replacing rather than adding is what would break a listing lookup.
    expect(h).not.toContain('>Sale PSF<');
  });

  it('says the Luxury score is this app\'s own figure, not a published one', () => {
    const h = detailHtml(condo());
    expect(h).toContain('Luxuryスコア');
    expect(h).toContain('独自算出');
    expect(h).toContain('82 / 100');
  });

  it('still prints 未定 for an unbuilt project rather than a stale price', () => {
    const h = detailHtml(condo({ status: 'upcoming' }));
    expect(h).toContain('売買単価');
    expect(h).toContain('未定');
    expect(h).not.toContain('RM 900–1,200');
  });
});

describe('物件: 主な設備 and 充実度 are two facts, told as two', () => {
  const h = detailHtml(condo());

  it('names the block for what the list is: the facilities', () => {
    expect(h).toContain('主な設備');
  });

  it('puts the weighted score in its own slot, never inside the heading', () => {
    expect(h).toContain('<span class="info-sec-meta">充実度 11/15</span>');
    // 「Premium Features (11/15)」 above four items read as a broken count.
    expect(h).not.toContain('Premium Features');
    expect(h).not.toContain('主な設備 (11/15)');
  });

  it('is honest that the two numbers do not match: 4 facilities, score 11', () => {
    const list = h.slice(h.indexOf('info-feature-list'));
    const items = list.slice(0, list.indexOf('</div>')).match(/🔑|🛎️|🏠|🏊|🌆|⚡/g) || [];
    expect(items).toHaveLength(4);
    expect(h).toContain('11/15');
  });

  it('wraps each facility as a unit — Japanese breaks between any two characters', () => {
    // Space-separated text split 「1フロア3戸以下」 into 「1」 / 「フロア3戸以下」
    // across two lines in the 300px panel (seen in a real render).
    expect(h).toContain('<span>🏠 1フロア3戸以下</span>');
    expect((h.match(/<span>[^<]*<\/span>/g) || []).length).toBeGreaterThanOrEqual(4);
  });

  it('names the facilities in Japanese', () => {
    expect(h).toContain('専用エレベーター');
    expect(h).toContain('コンシェルジュ');
    expect(h).toContain('1フロア3戸以下');
    expect(h).toContain('50mプール');
    for (const en of ['Private Lift', 'Concierge', 'units/floor', '50m Pool', 'Sky Lounge', 'EV Charging']) {
      expect(h, `${en} should be in Japanese now`).not.toContain(en);
    }
  });

  it('follows the density steps: ≤5 and ≤8 have their own wording', () => {
    expect(detailHtml(condo({ pLowDensity: 2 }))).toContain('1フロア5戸以下');
    expect(detailHtml(condo({ pLowDensity: 1 }))).toContain('1フロア8戸以下');
    expect(detailHtml(condo({ pLowDensity: 0 }))).not.toContain('フロア');
  });

  it('shows no facility block at all when the score is zero', () => {
    expect(detailHtml(condo({ premiumScore: 0 }))).not.toContain('主な設備');
  });
});

// ============================================================
// 商業 — the columns the panel used to load and never print
// ============================================================
describe('商業: the loaded data actually reaches the panel', () => {
  it('prints the operator/developer, which all 88 rows carry', () => {
    const h = detailHtml(mall());
    expect(h).toContain('運営 / デベロッパー');
    expect(h).toContain('KLCC Property Holdings');
  });

  it('omits the cell entirely when there is no operator — not 「—」', () => {
    const h = detailHtml(mall({ developer: '' }));
    expect(h).not.toContain('運営 / デベロッパー');
  });

  it('escapes the operator: it is data, not markup', () => {
    expect(detailHtml(mall({ developer: '<img src=x onerror=alert(1)>' })))
      .not.toContain('<img src=x');
  });

  it('labels the floor area in Japanese and keeps NLA beside it', () => {
    const h = detailHtml(mall());
    expect(h).toContain('賃貸面積');
    expect(h).toContain('<small class="kv-sub">NLA</small>');
    expect(h).toContain('1,000,000 sf');
  });

  it('keeps the homepage link it already had', () => {
    expect(detailHtml(mall())).toContain('https://suriaklcc.example/');
    expect(detailHtml(mall())).toContain('公式サイト');
  });
});

// ============================================================
// 学校 — the two long blocks fold
// ============================================================
describe('学校: the long blocks start folded (nothing is removed)', () => {
  beforeEach(() => {
    setSchoolsDetail({
      'Test International School': {
        brand: 'Test Education Group',
        philosophy: 'ひとりひとりの探究心を育てる。'.repeat(8),
        fees: { 'Year 1': 30000, 'Year 7': 60000, 'Year 13': 90000 },
        other_fees: '入学金 RM 5,000 別途',
        nationalities: 40,
      },
    });
  });

  it('folds 教育方針 into a details block that is closed by default', () => {
    const h = detailHtml(school());
    expect(h).toContain('<details class="data-details"><summary>教育方針</summary>');
    expect(h).not.toContain('<details class="data-details" open>');
  });

  it('folds the fee table under its own summary', () => {
    const h = detailHtml(school());
    expect(h).toContain('<summary>学年別 年間授業料 (RM)</summary>');
  });

  it('keeps every fee inside the fold — folding is not dropping', () => {
    const h = detailHtml(school());
    expect(h).toContain('RM 30,000');
    expect(h).toContain('RM 60,000');
    expect(h).toContain('RM 90,000');
    expect(h).toContain('入学金 RM 5,000 別途');
    expect(h).toContain('ひとりひとりの探究心を育てる。');
  });

  it('leaves the short blocks open: 運営 and the key stats are not folded', () => {
    const h = detailHtml(school());
    expect(h).toContain('<div class="info-sec-title">運営</div>');
    expect(h).toContain('RM 30,000–90,000');
    expect(h).toContain('40ヶ国');
  });

  it('renders a school with no detail record without a stray empty fold', () => {
    setSchoolsDetail({});
    const h = detailHtml(school());
    expect(h).not.toContain('data-details');
    // The CSV's own fee range still shows: the fold only ever held the detail JSON.
    expect(h).toContain('RM 30,000–90,000');
  });
});
