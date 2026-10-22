import { esc } from '../format.js';

const SOURCE_LABELS = { official: '公式案内', guide: 'ガイド', firsthand: '実食記事・利用者の声', directory: '店舗・メニュー情報' };

/** Only public evidence reaches this renderer; it never reads personal records. */
export function restaurantEvidenceHtml(e){
  if(!e) return '';
  const dishes = e.dishes.map(d => `<li><strong>${esc(d.name)}</strong> — ${esc(d.basis)}` +
    ` <span class="evidence-refs">${d.sourceUrls.map(url => {
      const i = e.sources.findIndex(s => s.url === url);
      return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(d.name)}の出典${i + 1}">[${i + 1}]</a>`;
    }).join(' ')}</span></li>`).join('');
  const sources = e.sources.map((s, i) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">` +
    `[${i + 1}] ${esc(s.title)} ↗</a><div>${esc(SOURCE_LABELS[s.kind])} · ${s.publishedAt ? '公表: ' + esc(s.publishedAt) : '公表日不明'}` +
    ` · 確認: ${esc(s.checkedAt)}</div></li>`).join('');
  return `<div class="info-sec-body dining-evidence">` +
    `<p class="evidence-meta">情報確認: ${esc(e.checkedAt)}（料理・出典）。上のGoogle評価と予算目安は以前の調査値です。記事の公表日は出典欄に記載しています。</p>` +
    `<strong>注文を考える料理</strong>${dishes ? `<ul>${dishes}</ul>` : '<p>料理別の根拠は未確認です。</p>'}` +
    `<p><strong>味の支持</strong><br>${esc(e.tasteEvidence.positive || '未確認')}</p>` +
    `<p><strong>注意・好みが分かれる点</strong><br>${esc(e.tasteEvidence.caution || '未確認')}</p>` +
    `<p><strong>確認できていないこと</strong><br>${esc(e.tasteEvidence.limits)}</p>` +
    (e.visitNote ? `<p><strong>来店前に</strong><br>${esc(e.visitNote)}</p>` : '') +
    `<details><summary>出典と確認範囲（${e.sources.length}件）</summary><ul>${sources}</ul>` +
    `<p>${esc([e.identityNotes, e.sourceCoverage].filter(Boolean).join(' '))}</p></details></div>`;
}
