// 絞り込みの並びと、そこから外した/足したものの契約（2026-08-16 竹森氏裁定）。
//
// 実測(台帳357件)で「どれだけ絞れるか」を数え、効き目の順に常時表示を選び直した:
//   よく効く  カテゴリ(1〜69件) / 予算(〜RM50=128件) / エリア(最大76件) / ミシュラン(75件)
//   効かない  ★4.3以上=321件(90%が残る) / 車で〜45分=357件(1件も減らない)
// 効かない2つは廃止し、予算とエリアを折りたたみから上段へ上げた。ミシュランは
// 竹森氏の指示で上段に残す。枠の数は4のままなので、スマホの高さは変わらない。
//
// これらは index.html をテキストとして読む契約テスト（このrepoにDOM環境は無い）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
/** 常時表示の飲食の行（開始タグから最初の閉じまで、を素朴に切り出す） */
const topRow = html.slice(html.indexOf('<div class="filter-row filter-row-2col" data-layer-only="dining"'));
const topRowBody = topRow.slice(0, topRow.indexOf('<!-- 自分の記録'));
const moreBlock = html.slice(html.indexOf('<div id="moreFilters"'), html.indexOf('<div class="chips" id="filterChips"'));

describe('常時見えている絞り込み（飲食）', () => {
  it('4つの枠は カテゴリ・予算・エリア・ミシュラン', () => {
    for(const id of ['fCatGroup', 'fPriceBand', 'fDiningArea', 'fMichelin']){
      expect(topRowBody, `${id} が上段にない`).toContain(`id="${id}"`);
    }
  });

  it('効き目の薄い絞り込みは画面から消えている（評価・車で）', () => {
    // 廃止であって移動ではないので、折りたたみの中にも残っていてはいけない
    expect(html).not.toContain('id="fMinRating"');
    expect(html).not.toContain('id="fDriveTime"');
    // 選択肢そのものが消えていること（説明のコメントに文字列が残るのは可）
    expect(html).not.toContain('<option value="4.3">');
    expect(html).not.toContain('<option value="45">');
  });

  it('細分類は大分類を選ぶまで枠ごと隠れている', () => {
    expect(topRowBody).toMatch(/id="fCatWrap"[^>]*style="display:none"/);
    expect(topRowBody).toMatch(/<select id="fCat"[^>]*disabled/);
  });

  it('予算の帯から、撤去済みプリセットの名残（〜RM150）が消えている', () => {
    // 〜RM50 / RM50-150 / RM150-400 / RM400〜 のきれいな4分割に戻す
    expect(topRowBody).not.toContain('value="0-150"');
    for(const v of ['0-50', '50-150', '150-400', '400-']){
      expect(topRowBody).toContain(`value="${v}"`);
    }
  });

  it('自分の記録の3トグルは折りたたみの外にある', () => {
    for(const id of ['toggleVisited', 'toggleWant', 'toggleUndone']){
      expect(moreBlock, `${id} がまだ折りたたみの中`).not.toContain(`id="${id}"`);
      expect(html).toContain(`id="${id}"`);
    }
  });

  it('折りたたみに残るのは施設タイプ・昼の予算・子連れ', () => {
    for(const id of ['fVenueType', 'toggleDayBudget', 'toggleKidOk']){
      expect(moreBlock).toContain(`id="${id}"`);
    }
  });
});

describe('ミシュランの並び（2026-08-16 竹森氏指示）', () => {
  it('絞り込みの選択肢は 星付き → 掲載店 → ビブグルマン → 掲載なし', async () => {
    const { MICHELIN_FILTERS } = await import('../src/domain/filter.js');
    expect(MICHELIN_FILTERS.map(o => o.value)).toEqual(['star', 'sel', 'bib', 'none']);
  });

  it('地図の凡例も同じ順に並ぶ', () => {
    const map = readFileSync(new URL('../src/ui/map.js', import.meta.url), 'utf8');
    const legend = map.slice(map.indexOf('export function updateLegend'));
    const star = legend.indexOf('ミシュラン星付き');
    const sel = legend.indexOf('掲載店（淡い金ピン');
    const bib = legend.indexOf('ビブグルマン（琥珀色ピン');
    expect(star).toBeGreaterThan(-1);
    expect(star).toBeLessThan(sel);
    expect(sel).toBeLessThan(bib);
  });
});

describe('共有ボタン', () => {
  it('並び替えの行に置かれ、shareView() を呼ぶ', () => {
    expect(html).toContain('id="shareBtn"');
    expect(html).toMatch(/id="shareBtn"[^>]*onclick="shareView\(\)"/);
  });
});

describe('スマホ（≤768px）で絞り込みと並び替えを畳む', () => {
  const mobile = html.slice(html.indexOf('@media(max-width:768px)'));

  it('開いていない間は層別の絞り込みと並び替えを出さない', () => {
    expect(mobile).toContain('body:not(.more-open) .filter-row[data-layer-only]{display:none!important}');
    expect(mobile).toContain('body:not(.more-open) .filter-row[data-mode-only]{display:none!important}');
    expect(mobile).toContain('body:not(.more-open) #sortRow{display:none!important}');
  });

  it('検索欄は畳まない（一番よく使う入口なので常に出す）', () => {
    // #searchRow は data-layer-only を持たないので上のルールに掛からない
    expect(html).toMatch(/<div class="filter-row" id="searchRow">/);
  });

  it('廃止した2つは40pxリストからも消えている', () => {
    expect(mobile).toContain('#fCatGroup,#fCat,#fMichelin,#fPriceBand,#fDiningArea,#toggleKidOk,#toggleDayBudget{min-height:40px}');
  });
});

describe('サマリータイル', () => {
  it('値は縮まない（「RM 811」が「RM 8…」になるのを止める）', () => {
    const rule = html.slice(html.indexOf('.summary-val{'));
    expect(rule.slice(0, rule.indexOf('}'))).toContain('flex-shrink:0');
  });
});
