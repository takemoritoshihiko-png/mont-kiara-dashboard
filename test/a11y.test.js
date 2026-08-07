// Contract for accessibility, the mobile layout and the sharing metadata (B4).
//
// Like visualSystem.test.js, most of this is markup and CSS that no unit test
// can judge for *quality* — but it can hold the things that silently rot:
// a landmark turned back into a <div>, a button whose only content is an arrow
// glyph, a control with no label, a mobile rule that never got the element
// added two batches ago. Everything asserted here was verified in the browser
// once; the test is what keeps it true.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { cardHtml, cardAriaLabel, cardHeroText } from '../src/ui/list.js';
import { attrEsc } from '../src/ui/map.js';
import { initA11y } from '../src/ui/a11y.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
const body = html.slice(html.indexOf('<body>'));
// The mobile block is the last thing in the stylesheet.
const mobile = css.slice(css.indexOf('@media(max-width:768px){'));

const condo = (over = {}) => ({
  name: 'Seni Mont Kiara', nameJa: 'セニ・モントキアラ', addr: 'Jalan Kiara, Mont Kiara',
  status: 'completed', luxTier: 'S', luxScore: 63.5,
  year: 2008, units: 605, sizeMin: 1798, sizeMax: 6000,
  rentMin: 3200, rentMax: 5000, salePsfMin: 652, salePsfMax: 1059,
  fiabciAward: null, ...over,
});
const school = (over = {}) => ({
  name: 'Alice Smith School', addr: '2 Jalan Bellamy 50460 KL', status: 'school',
  curriculum: 'British', ageRange: '3-18', year: 1946, units: 1700,
  sizeMin: 45000, sizeMax: 95000, luxTier: 'D', luxScore: 0, ...over,
});
const shop = (over = {}) => ({
  name: 'Publika (Solaris Dutamas)', addr: '1 Jalan Dutamas 1', status: 'commercial',
  year: 2012, units: 250, sizeMin: 320000, sizeMax: 0,
  anchorTenants: 'BIG Supermarket', luxTier: 'D', luxScore: 0, ...over,
});

describe('language and landmarks', () => {
  it('declares Japanese as the page language — the UI is Japanese-primary', () => {
    expect(html).toContain('<html lang="ja">');
  });

  it('uses real landmarks, not a page made entirely of divs', () => {
    expect(body).toContain('<header class="header">');
    expect(body).toContain('<main class="main"');
    expect(body).toContain('<aside class="panel" id="panel" aria-label="検索と一覧">');
    expect(body).toContain('</header>');
    expect(body).toContain('</main>');
    expect(body).toContain('</aside>');
  });

  it('has not quietly reverted any landmark to a div', () => {
    expect(body).not.toContain('<div class="header">');
    expect(body).not.toContain('<div class="main"');
    expect(body).not.toContain('<div class="panel" id="panel">');
  });

  it('opens and closes each landmark exactly once', () => {
    for(const tag of ['header', 'main', 'aside']){
      expect(body.match(new RegExp(`<${tag}[\\s>]`, 'g'))).toHaveLength(1);
      expect(body.match(new RegExp(`</${tag}>`, 'g'))).toHaveLength(1);
    }
  });
});

describe('every control says what it is', () => {
  // <button>…</button> never nests in this page, so a non-greedy match is exact.
  const buttons = [...body.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];

  it('finds the page\'s buttons at all (guards the regex itself)', () => {
    expect(buttons.length).toBeGreaterThan(15);
  });

  it('gives every button either visible text or an aria-label', () => {
    const anonymous = buttons.filter(([, attrs, inner]) => {
      if(/aria-label=/.test(attrs)) return false;
      // Entities and tags are not a name: 「&#9664;」 reads as nothing.
      const text = inner.replace(/<[^>]*>/g, '').replace(/&#?\w+;/g, '').trim();
      return text === '';
    }).map(m => m[0]);
    expect(anonymous).toEqual([]);
  });

  it('points every <label for> at a control that exists', () => {
    const dangling = [...body.matchAll(/<label[^>]*\bfor="([^"]+)"/g)]
      .map(m => m[1])
      .filter(id => !body.includes(`id="${id}"`));
    expect(dangling).toEqual([]);
  });

  it('has no <label> without a control — the 受賞 caption is a span now', () => {
    const bare = [...body.matchAll(/<label(?![^>]*\bfor=)[^>]*>/g)].map(m => m[0]);
    expect(bare).toEqual([]);
  });

  it('labels every form field', () => {
    const fields = [...body.matchAll(/<(select|input)\b([^>]*)>/g)];
    const unnamed = fields.filter(([, , attrs]) => {
      if(/aria-label=/.test(attrs)) return false;
      const id = (attrs.match(/\bid="([^"]+)"/) || [])[1];
      return !id || !body.includes(`for="${id}"`);
    }).map(m => m[0]);
    expect(unnamed).toEqual([]);
  });

  it('points every aria-controls at an element that exists', () => {
    const dangling = [...body.matchAll(/aria-controls="([^"]+)"/g)]
      .map(m => m[1])
      .filter(id => !body.includes(`id="${id}"`));
    expect(dangling).toEqual([]);
  });
});

describe('state is announced, not only drawn', () => {
  // Every segmented control on the page: what names it and how many tabs it
  // has. Counted per control rather than page-wide, because D4 added two more
  // (the mode switch and 外食モードの3ビュー) and a page-wide total would then
  // pass whichever control lost its markup.
  const SEGMENTS = [
    // 4: 物件 / 学校 / 商業 are layers; the fourth (飲食 ↗) is an ENTRANCE — it
    // hands over to 外食モード rather than becoming a home-mode layer (UX2).
    // It is still a tab in the markup because it sits in, and is styled by,
    // the same segmented control.
    { id: 'layerSeg', label: '表示する種別', tabs: 4, sample: 'data-layer="dining"' },
    { id: 'modeSeg', label: 'モードを選ぶ', tabs: 2, sample: 'data-mode="eatout"' },
    { id: 'viewSeg', label: '外食モードの表示', tabs: 3, sample: 'data-view="log"' },
  ];

  it('marks every segmented control as a tab list with a selected tab', () => {
    for(const seg of SEGMENTS){
      const i = body.indexOf(`id="${seg.id}"`);
      expect(i, `${seg.id} is gone`).toBeGreaterThan(-1);
      // A segment holds only <button>s, so the first </div> after it closes it.
      const block = body.slice(i, body.indexOf('</div>', i));
      const open = body.slice(i, body.indexOf('>', i));
      expect(open, `${seg.id} is not a tablist`).toContain('role="tablist"');
      expect(open, `${seg.id} has no name`).toContain(`aria-label="${seg.label}"`);
      expect(block, `${seg.id} lost a control`).toContain(seg.sample);
    }
  });

  it('gives each segmented control the number of tabs it is supposed to have', () => {
    // 4 layers + 2 modes + 3 外食ビュー.
    expect(body.match(/role="tab" aria-selected="/g))
      .toHaveLength(SEGMENTS.reduce((s, x) => s + x.tabs, 0));
  });

  it('gives the 絞り込み disclosure an aria-expanded', () => {
    expect(body).toContain('id="moreToggle"');
    const btn = body.slice(body.indexOf('id="moreToggle"'));
    expect(btn.slice(0, btn.indexOf('>'))).toContain('aria-expanded="false"');
  });

  it('gives every narrowing toggle an aria-pressed', () => {
    // D4 added 行きたい / 未訪問, which are toggles of exactly the same kind.
    for(const id of ['sfToggle', 'toggleAward', 'toggleKidOk', 'toggleWant', 'toggleUndone']){
      const btn = body.slice(body.indexOf(`id="${id}"`));
      expect(btn.slice(0, btn.indexOf('>')), `${id} has no aria-pressed`)
        .toContain('aria-pressed="false"');
    }
  });

  it('names the panel toggle, whose only content is an arrow glyph', () => {
    const btn = body.slice(body.indexOf('id="toggleBtn"'));
    const tag = btn.slice(0, btn.indexOf('>'));
    expect(tag).toContain('aria-label=');
    expect(tag).toContain('aria-expanded="true"');
  });

  it('makes the map legend a real toggle', () => {
    const el = body.slice(body.indexOf('id="mapLegend"'));
    const tag = el.slice(0, el.indexOf('>'));
    expect(tag).toContain('role="button"');
    expect(tag).toContain('tabindex="0"');
    expect(tag).toContain('aria-expanded="false"');
    expect(tag).toContain('aria-label=');
  });

  it('ties each summary figure to its caption and announces the filtered count', () => {
    for(const id of ['sumTotal', 'sumFiltered', 'sumStat3', 'sumStat4']){
      const el = body.slice(body.indexOf(`id="${id}"`));
      expect(el.slice(0, el.indexOf('>')), `${id} figure is unlabelled`)
        .toContain('aria-labelledby=');
    }
    const shown = body.slice(body.indexOf('id="sumFiltered"'));
    expect(shown.slice(0, shown.indexOf('>'))).toContain('aria-live="polite"');
  });

  it('groups the area-jump buttons under one name', () => {
    expect(body).toContain('id="areaJump" role="group" aria-label="エリアへ移動"');
  });
});

describe('the detail overlay is a dialog you can always leave', () => {
  it('is a non-modal dialog: the map and the list stay operable behind it', () => {
    const el = body.slice(body.indexOf('id="infoOverlay"'));
    const tag = el.slice(0, el.indexOf('>'));
    expect(tag).toContain('role="dialog"');
    expect(tag).toContain('aria-modal="false"');
    expect(tag).toContain('aria-label=');
  });

  it('is renamed after whatever it is showing, and reset when it closes', () => {
    const info = readFileSync(new URL('../src/ui/info.js', import.meta.url), 'utf8');
    expect(info).toContain("setAttribute('aria-label', c.name + ' の詳細')");
    expect(info).toContain("setAttribute('aria-label', DIALOG_LABEL_EMPTY)");
  });

  it('closes on Escape, but only while it is open', () => {
    const { press, closes } = keyboardHarness({ overlayOpen: true });
    press({ key: 'Escape' });
    expect(closes).toHaveLength(1);

    const shut = keyboardHarness({ overlayOpen: false });
    shut.press({ key: 'Escape' });
    expect(shut.closes).toHaveLength(0);
  });
});

// ============================================================
// A hand-rolled stub of the two DOM calls initA11y makes. Small enough to read
// in one go, and it lets the keyboard behaviour be exercised rather than
// grepped for — there is no DOM environment in this project's test setup.
// ============================================================
function keyboardHarness({ overlayOpen = false } = {}){
  let handler = null;
  const closes = [];
  const clicks = [];
  const doc = {
    addEventListener: (type, fn) => { if(type === 'keydown') handler = fn; },
    getElementById: (id) => id === 'infoOverlay'
      ? { classList: { contains: () => overlayOpen } } : null,
  };
  initA11y({ doc, onEscape: () => closes.push(1) });

  /** Fire a keydown at a target. `role` names the nearest role=button, if any. */
  const press = ({ key, role = null, ...rest }) => {
    const el = { click: () => clicks.push(role) };
    let prevented = false;
    handler({
      key,
      ...rest,
      preventDefault: () => { prevented = true; },
      target: { closest: (sel) => (role && sel === '[role="button"][tabindex="0"]') ? el : null },
    });
    return prevented;
  };
  return { press, closes, clicks };
}

describe('card-shaped controls behave like buttons', () => {
  it('gives a card the role, the tab stop and a name', () => {
    const h = cardHtml(condo());
    expect(h).toContain('role="button"');
    expect(h).toContain('tabindex="0"');
    expect(h).toContain('aria-label="Seni Mont Kiara、RM 3,200–5,000/月 ・ PSF 652–1,059"');
  });

  it('names each type by what its card actually leads with', () => {
    expect(cardAriaLabel(school())).toBe('Alice Smith School、学費 RM 45,000–95,000/年');
    expect(cardAriaLabel(shop())).toBe('Publika (Solaris Dutamas)、NLA 320,000 sf ・ 250店');
    expect(cardAriaLabel(condo({ status: 'upcoming' }))).toContain('価格 未定');
  });

  it('falls back to the bare name when there is no hero number', () => {
    expect(cardAriaLabel(shop({ sizeMin: 0, units: 0 }))).toBe('Publika (Solaris Dutamas)');
  });

  it('never describes a card differently from what the card shows', () => {
    // One source for the hero line, so the label cannot drift from the markup.
    for(const rec of [condo(), condo({ status: 'upcoming' }), school(),
      school({ sizeMin: 0, sizeMax: 0 }), shop(), shop({ sizeMin: 0 })]){
      const hero = cardHeroText(rec);
      if(hero) expect(cardHtml(rec)).toContain(`>${hero}</div>`);
    }
  });

  it('escapes the name it puts in the label', () => {
    expect(cardHtml(condo({ name: 'The "Best"' }))).toContain('aria-label="The &quot;Best&quot;');
  });

  it('activates a borrowed button with Enter and with Space', () => {
    const h = keyboardHarness();
    h.press({ key: 'Enter', role: 'card' });
    h.press({ key: ' ', role: 'row' });
    expect(h.clicks).toEqual(['card', 'row']);
  });

  it('swallows Space so the panel does not scroll out from under the card', () => {
    const h = keyboardHarness();
    expect(h.press({ key: ' ', role: 'card' })).toBe(true);
  });

  it('leaves Space alone when it is being typed into the search box', () => {
    const h = keyboardHarness();
    // No role=button ancestor — the keystroke belongs to the field.
    expect(h.press({ key: ' ' })).toBe(false);
    expect(h.clicks).toEqual([]);
  });

  it('ignores other keys and browser shortcuts', () => {
    const h = keyboardHarness();
    h.press({ key: 'a', role: 'card' });
    h.press({ key: 'Enter', role: 'card', metaKey: true });
    h.press({ key: 'Enter', role: 'card', ctrlKey: true });
    expect(h.clicks).toEqual([]);
  });

  it('wires exactly one listener for the whole page', () => {
    // The list is re-rendered on every keystroke in the search box; per-card
    // wiring would be attached and thrown away hundreds of times a session.
    const a11y = readFileSync(new URL('../src/ui/a11y.js', import.meta.url), 'utf8');
    expect(a11y.match(/addEventListener/g)).toHaveLength(1);
  });

  it('gives the same treatment to the 周辺 and 学費くらべ rows', () => {
    const info = readFileSync(new URL('../src/ui/info.js', import.meta.url), 'utf8');
    const sf = readFileSync(new URL('../src/ui/schoolFinder.js', import.meta.url), 'utf8');
    expect(info).toContain('class="nb-row" role="button" tabindex="0"');
    expect(sf).toContain('role="button" tabindex="0"');
  });
});

describe('map markers', () => {
  const map = readFileSync(new URL('../src/ui/map.js', import.meta.url), 'utf8');

  it('names every marker and every cluster bubble', () => {
    expect(map).toContain('aria-label="学校 ${attrEsc(c.name)}"');
    expect(map).toContain('aria-label="商業施設 ${attrEsc(c.name)}"');
    expect(map).toContain('aria-label="飲食店 ${attrEsc(c.name)}');
    expect(map).toContain('aria-label="${a11yLabel}"');
    expect(map).toContain('aria-label="${CLUSTER_LABELS[type]} ${n}件');
  });

  it('escapes a name before putting it in an attribute of generated markup', () => {
    // Leaflet builds icon HTML as a raw string, outside the shared esc().
    expect(attrEsc('Pavilion "Hilltop" & <b>')).toBe('Pavilion &quot;Hilltop&quot; &amp; &lt;b&gt;');
    expect(attrEsc(null)).toBe('');
  });

  it('hides the glyphs inside a marker from the label that already says it', () => {
    expect(map.match(/aria-hidden="true"/g).length).toBeGreaterThanOrEqual(4);
  });

  it('points keyboard users at the list rather than pretending markers are navigable', () => {
    expect(html).toContain('id="map" role="application"');
    const a11y = readFileSync(new URL('../src/ui/a11y.js', import.meta.url), 'utf8');
    expect(a11y).toContain('Deliberately NOT here');
  });
});

describe('keyboard focus is visible', () => {
  it('draws a 2px accent outline on whatever the keyboard reaches', () => {
    expect(css).toContain(':focus-visible{outline:2px solid var(--accent)');
  });

  it('wins over the :focus rules that suppress the outline on form fields', () => {
    expect(css.indexOf('.filter-group select:focus-visible'))
      .toBeGreaterThan(css.indexOf('.filter-group select:focus,'));
  });

  it('rings the cards and rows on the inside, where they are flush', () => {
    expect(css).toContain('.condo-card:focus-visible');
    expect(css).toContain('outline-offset:-2px');
  });
});

describe('mobile (≤768px)', () => {
  it('gives the panel 45% of the split, not the 27vh that halved a card', () => {
    expect(mobile).toContain('flex:0 0 45%');
    expect(mobile).not.toContain('27vh');
    expect(mobile).not.toContain('73vh');
  });

  it('splits the height of .main, so the panel is not clipped by the header', () => {
    expect(mobile).toContain('height:calc(100vh - 44px)');
    expect(mobile).toContain('height:calc(100dvh - 44px)');
    expect(mobile).toContain('#map{flex:1 1 auto');
  });

  it('caps the detail overlay at 60vh and lets it scroll', () => {
    const rule = mobile.slice(mobile.indexOf('.info-overlay{'));
    const decl = rule.slice(0, rule.indexOf('}'));
    expect(decl).toContain('max-height:60vh');
    expect(decl).toContain('overflow-y:auto');
    // The base rule stretches top-to-bottom; max-height only bites once that
    // stretch is released.
    expect(decl).toContain('bottom:auto');
  });

  it('carries every control added since B3a', () => {
    for(const sel of ['.seg-btn', '.chips', '.disclosure', '.sort-select',
      '.sf-header', '.nb-row', '.info-tab', '.skel-card', '.fchip-x', '.info-overlay',
      // D3: the 飲食 layer's own controls.
      '#fCatGroup', '#fMichelin', '#fPriceBand', '#fDiningArea', '#toggleKidOk',
      // D4: 外食モード — the mode switch, the three views, the extra filters and
      // every control inside a record box.
      '.mode-btn', '.view-btn', '#fVenueType', '#toggleWant', '#toggleUndone',
      '.vb-toggle', '.vb-rv-btn', '.vb-amt', '.vb-memo', '.data-btn', '.data-area',
      '.card-main', '.visitbox', '.log-name', '.log-tiles', '.savebar', '.toast']){
      expect(mobile, `${sel} was never given a mobile rule`).toContain(sel);
    }
  });

  it('scrolls the active-filter chips sideways instead of growing a wall', () => {
    const rule = mobile.slice(mobile.indexOf('.chips{'));
    const decl = rule.slice(0, rule.indexOf('}'));
    expect(decl).toContain('flex-wrap:nowrap');
    expect(decl).toContain('overflow-x:auto');
    expect(mobile).toContain('.fchip{flex-shrink:0}');
  });

  it('makes segments, rows, tabs and the close/clear buttons 40px tappable', () => {
    for(const sel of ['.seg-btn{min-height:40px}', '.info-tab{min-height:40px}',
      '.nb-row,.sf-row,.sf-condo-row{min-height:40px}']){
      expect(mobile).toContain(sel);
    }
    expect(mobile).toContain('.search-clear{min-width:40px;min-height:40px');
    // D4: the record controls. 再訪意向 is the smallest thing on the screen —
    // three buttons sharing one row — so it is named explicitly.
    expect(mobile).toContain('.vb-toggle,.vb-rv-btn,.vb-amt,.data-btn{min-height:40px}');
    expect(mobile).toContain('.mode-btn{min-height:40px');
    expect(mobile).toContain('.view-btn{min-height:40px');
    expect(mobile).toContain('#fVenueType,#toggleWant,#toggleUndone{min-height:40px}');
    // The chip ✕ grows its hit area, not its glyph — a 40px ✕ is not a pill.
    const x = mobile.slice(mobile.indexOf('.fchip-x::after{'));
    expect(x.slice(0, x.indexOf('}'))).toContain('width:40px;height:40px');
  });

  it('keeps the detail overlay ✕ at 40px — it is already sized in the base rule', () => {
    const rule = css.slice(css.indexOf('.info-close{'));
    const decl = rule.slice(0, rule.indexOf('}'));
    expect(decl).toContain('width:40px');
    expect(decl).toContain('height:40px');
  });
});

describe('sharing metadata (OGP / SEO)', () => {
  const meta = (sel) => {
    const i = html.indexOf(sel);
    return i < 0 ? null : html.slice(i, html.indexOf('>', i));
  };

  it('describes the page in one Japanese sentence', () => {
    const d = meta('<meta name="description"');
    expect(d).toBeTruthy();
    expect(d).toContain('クアラルンプールとペナン');
    expect(d).toContain('。');
  });

  it('carries the Open Graph card the plan asks for', () => {
    expect(html).toContain('<meta property="og:type" content="website">');
    expect(html).toContain('<meta property="og:locale" content="ja_JP">');
    expect(html).toContain('<meta property="og:url" content="https://takemoritoshihiko-png.github.io/mont-kiara-dashboard/">');
    expect(meta('<meta property="og:title"')).toContain('KL・ペナン 住まいマップ');
    expect(meta('<meta property="og:description"')).toContain('クアラルンプールとペナン');
    expect(html).toContain('<meta name="twitter:card" content="summary">');
  });

  it('declares NO og:image, because no such asset exists in the repo', () => {
    // A fabricated preview would be a picture of something that is not this app.
    // (The head comment explains the omission and mentions the name, so the
    // assertion is on the tag, not on the string.)
    expect(html).not.toContain('property="og:image"');
    expect(html).toContain('content="summary"');
    expect(html).not.toContain('summary_large_image');
  });

  it('sets a theme-color that matches the page background token', () => {
    expect(html).toContain('<meta name="theme-color" content="#f5f5f7">');
    expect(css).toContain('--bg:#f5f5f7');
  });

  it('says the og:title and the <title> are the same page', () => {
    expect(html).toContain('<title>KL・ペナン 住まいマップ | KL &amp; Penang Living Map</title>');
    expect(meta('<meta property="og:title"')).toContain('KL &amp; Penang Living Map');
  });
});
