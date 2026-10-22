// Public restaurant research. The same contract is used at publication and load.
const SOURCE_KINDS = new Set(['official', 'guide', 'firsthand', 'directory']);
const text = (value, field, allowEmpty = false) => {
  if(typeof value !== 'string' || (!allowEmpty && !value.trim())) throw new Error(`飲食調査: ${field}が不正`);
  return value.trim();
};
const date = (value, field) => {
  const s = text(value, field);
  const parsed = new Date(s);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== s) throw new Error(`飲食調査: ${field}が不正`);
  return s;
};
function sourceUrl(value){
  const s = text(value, '出典URL');
  let url;
  try { url = new URL(s); } catch { throw new Error('飲食調査: 出典URLが不正'); }
  if(!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('飲食調査: 出典URLが不正');
  return s;
}

export function normalizeDiningEvidence(input){
  if(input == null) return null;
  if(typeof input !== 'object' || !Array.isArray(input.sources) || !Array.isArray(input.dishes)) throw new Error('飲食調査: 形式が不正');
  const sources = input.sources.map(s => {
    if(!s || !SOURCE_KINDS.has(s.kind)) throw new Error('飲食調査: 出典区分が不正');
    return {
      title: text(s.title, '出典名'), url: sourceUrl(s.url), kind: s.kind,
      publishedAt: s.publishedAt == null ? null : text(s.publishedAt, '公表日'),
      checkedAt: date(s.checkedAt, '出典確認日'),
    };
  });
  const urls = new Set(sources.map(s => s.url));
  if(urls.size !== sources.length) throw new Error('飲食調査: 出典URLが重複');
  const dishes = input.dishes.map(d => {
    if(!d || !Array.isArray(d.sourceUrls) || !d.sourceUrls.length || d.sourceUrls.some(u => !urls.has(u))) throw new Error('飲食調査: 料理と出典の対応が不正');
    return { name: text(d.name, '料理名'), basis: text(d.basis, '料理の根拠'), sourceUrls: [...new Set(d.sourceUrls)] };
  });
  const taste = input.tasteEvidence || {};
  return {
    checkedAt: date(input.checkedAt, '情報確認日'), dishes,
    tasteEvidence: {
      positive: text(taste.positive, '味の支持', true), caution: text(taste.caution, '味の注意', true),
      limits: text(taste.limits, '未確認の範囲'),
    },
    visitNote: text(input.visitNote, '来店条件', true), sources,
    identityNotes: text(input.identityNotes, '支店確認', true),
    sourceCoverage: text(input.sourceCoverage, '根拠の範囲', true),
  };
}

/** Attach the canonical research by stable ID, rejecting a renamed/wrong branch. */
export function attachDiningEvidence(records, entries){
  if(!Array.isArray(records) || !Array.isArray(entries)) throw new Error('飲食調査: 配列が必要');
  const byId = new Map(records.map(r => [r.id, r]));
  if(byId.size !== records.length) throw new Error('飲食調査: 店舗IDが重複');
  const evidenceById = new Map();
  for(const e of entries){
    const record = byId.get(e.id);
    if(!record || record.name !== e.name || record.delisted) throw new Error(`飲食調査: 店舗の照合失敗 ${e.id}`);
    if(evidenceById.has(e.id)) throw new Error(`飲食調査: 調査IDが重複 ${e.id}`);
    evidenceById.set(e.id, normalizeDiningEvidence(e));
  }
  return records.map(r => {
    const { diningEvidence: previous, ...record } = r;
    const evidence = evidenceById.get(r.id);
    return evidence ? { ...record, diningEvidence: evidence } : record;
  });
}
