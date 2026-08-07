// Side panel: filters, sorting, the condo list and the summary bar.
import {
  CONDOS, filtered, setFiltered, selectedCondo, currentSort, setCurrentSort,
  showCommercial, setShowCommercial, showSchools, setShowSchools,
  showAwardOnly, setShowAwardOnly,
} from '../state.js';
import { TIER_COLORS } from '../data/inline.js';
import { parseR, matchesFilters } from '../domain/filter.js';
import { map, rebuild } from './map.js';

export function applyFilters(){
  const q=document.getElementById('fSearch').value.toLowerCase();
  const tierVal=document.getElementById('fTier').value;
  const sp=parseR(document.getElementById('fSalePsf').value),rn=parseR(document.getElementById('fRent').value),yr=parseR(document.getElementById('fYear').value),sz=parseR(document.getElementById('fSize').value);
  const age=parseR(document.getElementById('fAge').value);
  const statusFilter=document.getElementById('fStatus').value;
  const areaFilter=document.getElementById('fArea').value;
  const currentYear = new Date().getFullYear();
  setFiltered(CONDOS.filter(c=>matchesFilters(c,{
    q, tierVal, sp, rn, yr, sz, age, statusFilter, areaFilter, currentYear,
    showAwardOnly, showCommercial, showSchools,
  })));
  doSort();rebuild();renderList();updateSummary();
}

export function doSort(){
  filtered.sort((a,b)=>{
    // Commercial & schools always at the bottom
    const aBot=a.status==='commercial'||a.status==='school'?1:0;
    const bBot=b.status==='commercial'||b.status==='school'?1:0;
    if(aBot!==bBot) return aBot-bBot;
    return currentSort==='name'?a.name.localeCompare(b.name):currentSort==='salePsfHigh'?b.salePsfMid-a.salePsfMid:currentSort==='rentHigh'?b.rentMid-a.rentMid:currentSort==='yieldHigh'?b.yield-a.yield:currentSort==='yearNew'?b.year-a.year:currentSort==='yearOld'?a.year-b.year:currentSort==='luxHigh'?b.luxScore-a.luxScore:0;
  });
}
export function setSort(btn){document.querySelectorAll('.sort-btn[data-sort]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');setCurrentSort(btn.dataset.sort);doSort();renderList();}
export function toggleCommercial(btn){setShowCommercial(!showCommercial);btn.classList.toggle('active');btn.style.background=showCommercial?'#ff6d00':'#f8f9fb';btn.style.color=showCommercial?'#fff':'#999';btn.style.borderColor=showCommercial?'#e65100':'#e0e0e0';applyFilters();}
export function toggleSchools(btn){setShowSchools(!showSchools);btn.classList.toggle('active');btn.style.background=showSchools?'#1565c0':'#f8f9fb';btn.style.color=showSchools?'#fff':'#999';btn.style.borderColor=showSchools?'#0d47a1':'#e0e0e0';applyFilters();}
export function toggleAward(btn){setShowAwardOnly(!showAwardOnly);btn.classList.toggle('active');btn.style.background=showAwardOnly?'#f9a825':'#f8f9fb';btn.style.color=showAwardOnly?'#fff':'#999';btn.style.borderColor=showAwardOnly?'#f57f17':'#e0e0e0';applyFilters();}

export function renderList(){
  document.getElementById('condoList').innerHTML=filtered.map(c=>`
    <div class="condo-card ${selectedCondo===c.name?'selected':''}" onclick="selectCondo('${c.name.replace(/'/g,"\\'")}')">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
        ${c.status==='commercial'?'<span class="tier-badge" style="background:#ff6d00">🛒</span>':c.status==='school'?'<span class="tier-badge" style="background:#1565c0">🎓</span>':'<span class="tier-badge" style="background:'+TIER_COLORS[c.luxTier]+'">'+c.luxTier+'</span>'}
        ${c.fiabciAward?'<span title="FIABCI MPA '+c.fiabciAward.year+' '+c.fiabciAward.category+'" style="font-size:12px">🏆</span>':''}
        <span class="condo-name" style="margin:0">${c.name}</span>
        ${c.status==='commercial'?'<span style="margin-left:auto;font-size:10px;color:#ff6d00;font-weight:600">商業施設</span>':c.status==='school'?'<span style="margin-left:auto;font-size:10px;color:#1565c0;font-weight:600">'+(c.curriculum||'')+'</span>':'<span style="margin-left:auto;font-size:11px;font-weight:700;color:'+TIER_COLORS[c.luxTier]+'">'+c.luxScore+'</span>'}
      </div>
      ${c.nameJa ? '<div style="font-size:10px;color:#5f6368;margin-bottom:1px">'+c.nameJa+'</div>' : ''}
      <div class="condo-addr">${c.addr} | ${c.developer}</div>
      <div class="condo-meta">
        ${c.status==='upcoming'?'<span class="condo-tag" style="background:#fff3e0;color:#e65100">🔜 '+c.year+'予定</span>':c.status==='commercial'?'<span class="condo-tag" style="background:#fff3e0;color:#e65100">🛒 '+c.year+'年開業</span>':'<span class="condo-tag tag-year">'+c.year+'</span>'}
        ${c.status==='commercial'?'<span class="condo-tag" style="background:#fbe9e7;color:#bf360c">~'+c.units+'店舗</span>':'<span class="condo-tag tag-units">'+c.units+' units</span>'}
        ${c.status==='commercial'&&c.sizeMin>0?'<span class="condo-tag tag-size">'+(c.sizeMin/1000).toFixed(0)+'K sqft</span>':''}
        ${c.status!=='commercial'?'<span class="condo-tag tag-size">'+c.sizeMin.toLocaleString()+'-'+c.sizeMax.toLocaleString()+' sf</span>':''}
      </div>
      ${c.status==='commercial'?(c.anchorTenants?'<div style="margin-top:4px;font-size:10px;color:#bf360c">'+c.anchorTenants+'</div>':''):c.status==='upcoming'?`<div class="condo-prices">
        <div class="price-col"><div class="price-label">Sale PSF</div><div class="price-value sale-price" style="color:#999">未定</div></div>
        <div class="price-col"><div class="price-label">Rent/mo</div><div class="price-value rent-price" style="color:#999">未定</div></div>
      </div>`:`<div class="condo-prices">
        <div class="price-col"><div class="price-label">Sale PSF</div><div class="price-value sale-price">RM ${c.salePsfMin}-${c.salePsfMax}</div></div>
        <div class="price-col"><div class="price-label">Rent/mo</div><div class="price-value rent-price">RM ${c.rentMin.toLocaleString()}-${c.rentMax.toLocaleString()}</div></div>
      </div>`}
    </div>`).join('');
}

export function updateSummary(){
  document.getElementById('sumTotal').textContent=CONDOS.length;
  document.getElementById('sumFiltered').textContent=filtered.length;
  document.getElementById('totalCount').textContent=CONDOS.length;
  if(filtered.length){
    const res=filtered.filter(c=>c.status!=='commercial'&&c.status!=='upcoming'&&c.status!=='school');
    if(res.length){
      const sp=res.map(c=>c.salePsfMid||0).sort((a,b)=>a-b);
      const rp=res.map(c=>c.rentPsfMid||0).sort((a,b)=>a-b);
      const ms=sp[Math.floor(sp.length/2)]||0;
      const mr=rp[Math.floor(rp.length/2)]||0;
      document.getElementById('sumMedianSale').textContent='RM '+Math.round(ms);
      document.getElementById('sumMedianRent').textContent='RM '+mr.toFixed(2);
      document.getElementById('medianPsf').textContent='RM '+Math.round(ms);
    }
  }
}

export function togglePanel(){
  const p=document.getElementById('panel'),b=document.getElementById('toggleBtn');
  const isMobile=window.innerWidth<=768;
  p.classList.toggle('collapsed');b.classList.toggle('collapsed');
  b.innerHTML=p.classList.contains('collapsed')?(isMobile?'&#9650;':'&#9654;'):(isMobile?'&#9660;':'&#9664;');
  setTimeout(()=>map.invalidateSize(),300);
}
