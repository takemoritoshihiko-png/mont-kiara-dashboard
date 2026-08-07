// Detail overlay shown when a marker or list card is selected.
import { CONDOS, SCHOOLS_DETAIL, setSelectedCondo } from '../state.js';
import { TIER_COLORS } from '../data/inline.js';
import { map } from './map.js';
import { renderList } from './list.js';

export function closeInfo(){ document.getElementById('infoOverlay').classList.remove('active'); }

export function selectCondo(name){
  setSelectedCondo(name);
  const c=CONDOS.find(x=>x.name===name);
  if(c){
    map.setView([c.lat, c.lng], 16);
    // Build info panel content
    let h='';
    if(c.status==='school'){
      const sd = SCHOOLS_DETAIL[c.name] || {};
      h+=`<div class="popup-title" style="color:#1565c0">🎓 ${c.name}</div>`;
      h+=c.nameJa?'<div style="font-size:11px;color:#5f6368;margin-bottom:2px">'+c.nameJa+'</div>':'';
      h+=`<div class="popup-addr">${c.addr}</div>`;
      h+=`<div style="font-size:12px;margin-bottom:6px"><strong>${c.curriculum||c.anchorTenants}</strong> | 設立: ${c.year}年</div>`;
      // Brand
      if(sd.brand) h+=`<div style="margin-bottom:6px;padding:4px 8px;background:#e3f2fd;border-radius:6px;font-size:10px;color:#0d47a1"><strong>運営:</strong> ${sd.brand}</div>`;
      h+=`<div class="popup-grid">`;
      h+=`<div class="popup-cell"><div class="popup-cell-label">Students</div><div class="popup-cell-val" style="color:#1565c0">${sd.student_count_note||((c.units>0?'~'+c.units.toLocaleString()+'名':'-'))}</div></div>`;
      h+=`<div class="popup-cell"><div class="popup-cell-label">Ages</div><div class="popup-cell-val">${c.ageRange||'-'}</div></div>`;
      h+=`<div class="popup-cell"><div class="popup-cell-label">Nationalities</div><div class="popup-cell-val">${sd.nationalities?sd.nationalities+'ヶ国':'-'}</div></div>`;
      h+=`<div class="popup-cell"><div class="popup-cell-label">Fee Range</div><div class="popup-cell-val" style="color:#ea4335">RM${c.sizeMin>0?c.sizeMin.toLocaleString():'-'}-${c.sizeMax>0?c.sizeMax.toLocaleString():'-'}</div></div></div>`;
      // Philosophy
      if(sd.philosophy) h+=`<div style="margin-top:6px;padding:6px 8px;background:#f3e5f5;border-radius:6px;border:1px solid #ce93d8"><div style="font-size:9px;color:#7b1fa2;font-weight:700;margin-bottom:2px">教育方針</div><div style="font-size:10px;color:#1a1a2e;line-height:1.5">${sd.philosophy}</div></div>`;
      // Fee breakdown
      if(sd.fees){
        h+=`<div style="margin-top:6px;padding:6px 8px;background:#fff8e1;border-radius:6px;border:1px solid #ffcc02">`;
        h+=`<div style="font-size:9px;color:#f57f17;font-weight:700;margin-bottom:3px">学年別年間授業料 (RM)</div>`;
        h+=`<table style="width:100%;font-size:10px;border-collapse:collapse">`;
        for(const[k,v] of Object.entries(sd.fees)){
          h+=`<tr><td style="padding:2px 4px;color:#5f6368">${k}</td><td style="padding:2px 4px;text-align:right;font-weight:700;color:#e65100">RM ${v.toLocaleString()}</td></tr>`;
        }
        h+=`</table>`;
        if(sd.other_fees) h+=`<div style="margin-top:3px;font-size:9px;color:#80868b">${sd.other_fees}</div>`;
        h+=`</div>`;
      }
      // Demographics
      if(sd.top_nationalities && sd.top_nationalities !== 'Not publicly disclosed'){
        h+=`<div style="margin-top:6px;padding:6px 8px;background:#e8f5e9;border-radius:6px;border:1px solid #81c784">`;
        h+=`<div style="font-size:9px;color:#2e7d32;font-weight:700;margin-bottom:2px">生徒の属性</div>`;
        h+=`<div style="font-size:10px;color:#1a1a2e">${sd.top_nationalities}</div>`;
        if(sd.japanese_community && sd.japanese_community !== 'Not specifically highlighted') h+=`<div style="font-size:10px;color:#1565c0;margin-top:2px">🇯🇵 ${sd.japanese_community}</div>`;
        h+=`</div>`;
      }
    } else if(c.status==='commercial'){
      h+=`<div class="popup-title" style="color:#e65100">${c.name}</div>`;
      h+=c.nameJa?'<div style="font-size:11px;color:#5f6368;margin-bottom:2px">'+c.nameJa+'</div>':'';
      h+=`<div class="popup-addr">${c.addr}</div>`;
      h+=`<div style="font-size:12px;margin-bottom:6px"><strong>商業施設</strong> | 開業: ${c.year}年</div>`;
      h+=`<div class="popup-grid">`;
      h+=`<div class="popup-cell"><div class="popup-cell-label">Tenants</div><div class="popup-cell-val" style="color:#e65100">${c.units>0?'~'+c.units+'店':'-'}</div></div>`;
      h+=`<div class="popup-cell"><div class="popup-cell-label">NLA</div><div class="popup-cell-val">${c.sizeMin>0?(c.sizeMin/1000).toFixed(0)+'K sf':'-'}</div></div></div>`;
      h+=c.anchorTenants?'<div style="margin-top:6px;font-size:11px;color:#5f6368"><strong>Key Tenants:</strong> '+c.anchorTenants+'</div>':'';
    } else {
      const tierColor=TIER_COLORS[c.luxTier]||'#999';
      h+=`<div class="popup-title">${c.name}</div>`;
      h+=c.nameJa?'<div style="font-size:11px;color:#5f6368;margin-bottom:2px">'+c.nameJa+'</div>':'';
      h+=`<div class="popup-addr">${c.addr}</div>`;
      h+=`<div style="margin-bottom:8px"><span class="tier-badge" style="background:${tierColor};width:20px;height:20px;line-height:20px;font-size:10px">${c.luxTier}</span>`;
      h+=` <span style="font-size:12px;font-weight:700;margin-left:4px">Score: ${c.luxScore}</span>`;
      h+=`<div style="font-size:10px;color:#5f6368;margin-top:2px">${c.developer}</div></div>`;
      h+=`<div class="popup-grid">`;
      h+=`<div class="popup-cell"><div class="popup-cell-label">Year</div><div class="popup-cell-val">${c.year}</div></div>`;
      h+=`<div class="popup-cell"><div class="popup-cell-label">Units</div><div class="popup-cell-val">${c.units}</div></div>`;
      if(c.status==='upcoming'){
        h+=`<div class="popup-cell"><div class="popup-cell-label">Sale PSF</div><div class="popup-cell-val" style="color:#999">未定</div></div>`;
        h+=`<div class="popup-cell"><div class="popup-cell-label">Rent/mo</div><div class="popup-cell-val" style="color:#999">未定</div></div>`;
      } else {
        h+=`<div class="popup-cell"><div class="popup-cell-label">Sale PSF</div><div class="popup-cell-val" style="color:#ea4335">RM ${c.salePsfMin}-${c.salePsfMax}</div></div>`;
        h+=`<div class="popup-cell"><div class="popup-cell-label">Rent/mo</div><div class="popup-cell-val" style="color:#1a73e8">RM ${c.rentMin.toLocaleString()}-${c.rentMax.toLocaleString()}</div></div>`;
      }
      h+=`<div class="popup-cell"><div class="popup-cell-label">Size</div><div class="popup-cell-val">${c.sizeMin.toLocaleString()}-${c.sizeMax.toLocaleString()} sf</div></div></div>`;
      // FIABCI Award
      if(c.fiabciAward){
        h+=`<div style="margin-top:6px;padding:6px 8px;background:#fffde7;border-radius:6px;border:1px solid #f9a825">`;
        h+=`<div style="font-size:9px;color:#f57f17;font-weight:700;margin-bottom:2px">🏆 FIABCI MALAYSIA PROPERTY AWARD</div>`;
        h+=`<div style="font-size:11px;color:#1a1a2e">${c.fiabciAward.year} ${c.fiabciAward.category}</div></div>`;
      }
      // Premium Features
      if(c.premiumScore>0){
        const pf=[];
        if(c.pLift) pf.push('🔑 Private Lift');
        if(c.pConcierge) pf.push('🛎️ Concierge');
        if(c.pLowDensity>=3) pf.push('🏠 ≤3 units/floor');
        else if(c.pLowDensity>=2) pf.push('🏠 ≤5 units/floor');
        else if(c.pLowDensity>=1) pf.push('🏠 ≤8 units/floor');
        if(c.pPool) pf.push('🏊 50m Pool');
        if(c.pSkyLounge) pf.push('🌆 Sky Lounge');
        if(c.pEV) pf.push('⚡ EV Charging');
        h+=`<div style="margin-top:6px;padding:6px 8px;background:#f0f7ff;border-radius:6px;border:1px solid #d2e3fc">`;
        h+=`<div style="font-size:9px;color:#1a73e8;font-weight:700;margin-bottom:3px">PREMIUM FEATURES (${c.premiumScore}/15)</div>`;
        h+=`<div style="font-size:11px;color:#1a1a2e;line-height:1.6">${pf.join(' &nbsp;')}</div></div>`;
      }
    }
    // Links
    const links=[];
    if(c.status==='school'){
      const sd = SCHOOLS_DETAIL[c.name] || {};
      if(c.homepageUrl) links.push('<a href="'+c.homepageUrl+'" target="_blank" style="flex:1;text-align:center;padding:6px;background:#1565c0;color:#fff;border-radius:6px;text-decoration:none;font-size:10px;font-weight:600">公式サイト</a>');
      if(sd.fees_url) links.push('<a href="'+sd.fees_url+'" target="_blank" style="flex:1;text-align:center;padding:6px;background:#e65100;color:#fff;border-radius:6px;text-decoration:none;font-size:10px;font-weight:600">学費</a>');
      if(sd.admissions_url) links.push('<a href="'+sd.admissions_url+'" target="_blank" style="flex:1;text-align:center;padding:6px;background:#2e7d32;color:#fff;border-radius:6px;text-decoration:none;font-size:10px;font-weight:600">入学</a>');
    } else {
      if(c.ipropertyUrl) links.push('<a href="'+c.ipropertyUrl+'" target="_blank" style="flex:1;text-align:center;padding:6px;background:#1a73e8;color:#fff;border-radius:6px;text-decoration:none;font-size:11px;font-weight:600">iProperty</a>');
      if(c.homepageUrl) links.push('<a href="'+c.homepageUrl+'" target="_blank" style="flex:1;text-align:center;padding:6px;background:'+(c.status==='commercial'?'#ff6d00':'#34a853')+';color:#fff;border-radius:6px;text-decoration:none;font-size:11px;font-weight:600">Official</a>');
    }
    if(links.length) h+='<div style="display:flex;gap:6px;margin-top:8px">'+links.join('')+'</div>';

    document.getElementById('infoContent').innerHTML=h;
    document.getElementById('infoOverlay').classList.add('active');
  }
  renderList();
  document.querySelectorAll('.condo-card').forEach(card=>{if(card.querySelector('.condo-name')?.textContent===name)card.scrollIntoView({behavior:'smooth',block:'nearest'});});
}
