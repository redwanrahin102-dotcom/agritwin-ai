/* Presentation only: every function here turns model values into strings.
   Nothing reads the DOM, and the only state touched is the display currency,
   which app.js owns and sets (state.currency) whenever the farm changes. */
const CUR={USD:'$',BDT:'৳',EUR:'€',GBP:'£',INR:'₹',NGN:'₦',KES:'KSh ',ZAR:'R ',PHP:'₱',BRL:'R$',CNY:'¥'};
function money(v,cur){
  cur=cur||(typeof state!=='undefined'&&state.currency)||'BDT';
  const s=CUR[cur]||''; const neg=v<0; const a=Math.abs(v);
  return (neg?'−':'')+s+(a>=20?Math.round(a).toLocaleString():a.toFixed(2));
}
function nf(n,d){d=d==null?0:d;return (+n).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});}
function litres(N){return nf(N)+' L';}
function badgeHTML(l,tone){return '<span class="badge '+(tone||'')+'">'+l+'</span>';}
/* =====================================================================
   7. UI HELPERS
   ===================================================================== */
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function stars(e){return '⭐'.repeat(e>=95?5:e>=85?4:e>=68?3:2);}
function dateStr(ts){return new Date(ts).toLocaleDateString(undefined,{month:'short',day:'numeric'});}
function hash(s){let h=2166136261;for(const ch of s){h^=ch.codePointAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function seeded(seed){let t=seed>>>0;return function(){t=(t+0x6D2B79F5)>>>0;let r=Math.imul(t^(t>>>15),1|t);
  r^=r+Math.imul(r^(r>>>7),61|r);return((r^(r>>>14))>>>0)/4294967296;};}
function cellsHTML(f,m,cols,rows){
  const rnd=seeded(hash(f.crop+f.soil+f.stage+f.area+'|'+Math.round(f.water/10)));
  const amp=8+m.pest/6; let html='';
  for(let i=0;i<cols*rows;i++){
    const h=clamp(m.health+(rnd()*2-1)*amp,5,99);
    const cls=h>=78?'g':h>=55?'y':'r';
    html+='<div class="mcell mc-'+cls+'" title="Health '+Math.round(h)+'/100">'+CROP[f.crop].icon+'</div>';
  }
  return html;
}
function farmGridHTML(f,m){
  return '<div class="plotgrid">'+cellsHTML(f,m,10,5)+'</div>'
  +'<div class="legend"><span><i style="background:rgba(76,175,80,.82)"></i>Healthy (≥78)</span>'
  +'<span><i style="background:rgba(217,164,65,.82)"></i>Attention (55–77)</span>'
  +'<span><i style="background:rgba(217,83,79,.82)"></i>High risk (&lt;55)</span></div>'
  +'<p class="small muted" style="margin-top:9px">Each cell is a section of the farm — colours update with every simulation.</p>';
}
function lineChart(series,opts){
  opts=opts||{};
  const n=series[0].data.length,w=760,h=280,L=64,R=14,T=18,B=30;
  let ymin=Math.min.apply(null,series.flatMap(s=>s.data)),ymax=Math.max.apply(null,series.flatMap(s=>s.data));
  if(opts.ymin!=null)ymin=opts.ymin; if(opts.ymax!=null)ymax=opts.ymax;
  if(ymax-ymin<2){ymax+=1;ymin-=1;}
  const X=i=>L+(w-L-R)*(n<=1?0:i/(n-1)), Y=v=>T+(h-T-B)*(1-(v-ymin)/(ymax-ymin));
  let g='';
  for(let k=0;k<=4;k++){
    const v=ymin+(ymax-ymin)*k/4,y=Y(v);
    const lab=Math.abs(v)>=10000?Math.round(v/1000)+'k':Math.round(v);
    g+='<line x1="'+L+'" x2="'+(w-R)+'" y1="'+y+'" y2="'+y+'" class="cg"/><text x="'+(L-6)+'" y="'+(y+4)+'" text-anchor="end" class="ct">'+lab+'</text>';
  }
  const xt=opts.xTick||(i=>i+1);
  for(let k=0;k<=4;k++){
    const i=Math.min(n-1,Math.round((n-1)*k/4));
    g+='<text x="'+X(i)+'" y="'+(h-6)+'" text-anchor="middle" class="ct">'+xt(i)+'</text>';
  }
  (opts.markers||[]).forEach(mk=>{
    const x=X(mk.i);
    g+='<line x1="'+x+'" x2="'+x+'" y1="'+T+'" y2="'+(h-B)+'" class="cm"/><text x="'+x+'" y="'+(T-2)+'" text-anchor="middle" class="ct" fill="#2E7D32">'+mk.label+'</text>';
  });
  let paths='';
  series.forEach(s=>{
    let d='';
    s.data.forEach((v,i)=>{d+=(i===0?'M':'L')+X(i).toFixed(1)+','+Y(v).toFixed(1)+' ';});
    paths+='<path d="'+d+'" fill="none" stroke="'+s.color+'" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
  });
  return '<svg viewBox="0 0 '+w+' '+h+'" style="width:100%;height:auto">'
    +'<style>.cg{stroke:#E2E9DF;stroke-width:1}.ct{fill:#8AA192;font-size:11px}.cm{stroke:#4CAF50;stroke-dasharray:4 4;stroke-width:1.2}</style>'+g+paths+'</svg>';
}
function waterStatus(m){
  const d=(Math.round(Math.abs(m.wr-1)*1000)/10).toFixed(1)+'%';
  if(m.waterState==='ok')return ['good','✓ in range'];
  if(m.waterState==='high')return ['warn',d+' above'];
  if(m.waterState==='low')return ['warn',d+' below'];
  return ['bad',d+' below'];
}
function gaugeStatus(m){
  if(m.waterState==='ok')return ['good','✓ Within estimated optimal range'];
  if(m.waterState==='high')return ['warn','⚠ Above estimated optimal range'];
  if(m.waterState==='low')return ['warn','⚠ Slightly below estimated crop water need'];
  return ['bad','⚠ Well below estimated crop water need'];
}
function gaugeHTML(m,f){
  const scale=Math.max(Math.round(m.range.hi*1.75),f.water+10);
  const loP=m.range.lo/scale*100,hiP=m.range.hi/scale*100,cur=clamp(f.water/scale*100,2,98);
  const st=gaugeStatus(m);
  return '<div class="gauge">'
    +'<div class="gauge-marker" style="left:'+cur+'%"><b>'+nf(f.water)+' L/day</b></div>'
    +'<div class="gauge-zones"><div class="z-red" style="width:'+loP+'%"></div>'
    +'<div class="z-green" style="width:'+(hiP-loP)+'%"></div><div class="z-amber" style="width:'+(100-hiP)+'%"></div></div></div>'
    +'<div class="gscale"><span style="left:0%">0</span><span style="left:'+loP+'%">'+nf(m.range.lo)+' L</span>'
    +'<span style="left:'+hiP+'%">'+nf(m.range.hi)+' L</span><span style="left:100%;transform:translateX(-100%)">'+nf(scale)+'+ L</span></div>'
    +'<div style="margin-top:10px"><span class="badge '+st[0]+'">'+st[1]+'</span>'
    +'<span class="badge">≈ '+m.mmPerDay.toFixed(2)+' mm/day applied</span>'
    +'<button class="btn outline" style="padding:5px 12px;font-size:12px;margin-left:8px" onclick="openWhy()">❓ Why?</button></div>';
}
function factorBars(rows){
  return rows.map(r=>{
    const col=r.v>=.85?'var(--green)':r.v>=.55?'var(--gold)':'var(--red)';
    return '<div class="vbar"><span>'+r.icon+' '+r.label+'</span>'
      +'<div class="fbar" style="height:11px"><i style="width:'+clamp(r.v*100,0,100)+'%;background:'+col+'"></i></div>'
      +'<b>'+Math.round(r.v*100)+'%</b></div>';
  }).join('');
}
/* restored from the agronomy build: pest-adjusted yield range + stress-slowed
   harvest window. One renderer so the advisor and the report can never drift. */
function yieldRangeHTML(f,m,pm,su){
  const c=CROP[f.crop], yr=pestYieldRange(f,m,pm), hw=harvestWindow(f,su);
  const row=(label,v,pct,color)=>'<div class="ybar"><span>'+label+'</span>'
    +'<div class="fbar"><i style="width:'+clamp(pct,0,100)+'%;background:'+color+'"></i></div>'
    +'<b>'+nf(v)+' kg/ac <span class="small muted">('+Math.round(pct)+'% of ceiling)</span></b></div>';
  return '<h4 style="margin:6px 0 2px;font-size:13.5px">Pest-adjusted yield range ('+esc(c.label)+')</h4>'
    +row('No control 😟',yr.worst,yr.worstPct,'#D9534F')
    +row('With IPM 😊',yr.withIpm,yr.ipmPct,'#4CAF50')
    +row('Ideal ceiling 🏆',yr.ceiling,100,'#123C2A')
    +'<p class="small muted" style="margin-top:6px">The model\'s current prediction is <b>'+nf(yr.cur)+' kg/acre</b> ('+Math.round(yr.curPct)+'% of the '+nf(yr.ceiling)+' kg/acre ceiling). Untreated pest exposure is <b>'+nf(yr.loss*yr.cur/100*f.area)+' kg</b> of harvest ≈ <b>'+money(yr.loss/100*economics(f,m).rev)+'</b> per year; a working IPM programme recovers roughly 60% of that gap.</p>'
    +'<div class="estat"><span>Farm total per cycle (no control → IPM)</span><b>'+nf(yr.worst*f.area)+' → '+nf(yr.withIpm*f.area)+' kg</b></div>'
    +'<h4 style="margin:14px 0 4px;font-size:13.5px">Harvest window under stress</h4>'
    +'<div class="estat"><span>Base cycle length</span><b>'+fmtDays(hw.base)+'</b></div>'
    +'<div class="estat"><span>Stress-slowed estimate</span><b>'+fmtDays(hw.stressDays)+' <span class="small muted">(+'+hw.delay+' days vs base)</span></b></div>'
    +'<div class="estat"><span>Projected harvest date</span><b>'+(hw.date?esc(hw.date):'set a planting date')+'</b></div>'
    +'<p class="small muted">Delay = cycle × (1 + 0.30 × (1 − suitability)), currently '+Math.round(su.total)+'% suitable — stressed crops mature late and shift labour and market timing.</p>';
}
function guildBars(pm){
  return pm.guilds.map(g=>{
    const col=g[1]<.25?'var(--green)':g[1]<.45?'var(--gold)':'var(--red)';
    return '<div class="vbar"><span>'+g[0]+'</span>'
      +'<div class="fbar" style="height:11px"><i style="width:'+clamp(g[1]*100,0,100)+'%;background:'+col+'"></i></div>'
      +'<b>'+Math.round(g[1]*100)+'%</b><span class="small muted" style="grid-column:1/4;margin-top:-6px">'+g[2]+'</span></div>';
  }).join('');
}
/* The engine returns guild*numbers* only, so the farmer-facing wording is
   composed here from them — once, for the dashboard, the advisor, the
   reports and the action plan, so the four can never drift apart. */
function pestNarrative(f,pm){
  const c=CROP[f.crop], s=SOILS[f.soil], T=f.temperature, H=f.humidity;
  const fungal=pm.guilds[0][1], insect=pm.guilds[1][1], mites=pm.guilds[2][1], rot=pm.guilds[3][1];
  const risks=[];
  if(fungal>=.35)risks.push('🍄 '+H+'% humidity at '+T+'°C is favourable for fungal and bacterial disease on '+c.label+'.');
  if(insect>=.35)risks.push('🐛 Warm humid air ('+T+'°C, '+H+'% RH) drives sucking and chewing insects — aphids, whitefly and borers.');
  if(mites>=.35)risks.push('🕷️ Hot dry conditions ('+T+'°C, '+H+'% RH) favour spider mites, which build up after dry spells.');
  if(rot>=.35)risks.push('🌊 '+s.label+' soil receiving '+nf(pm.annualMm)+' mm of water a year holds enough moisture for root rot and damping off.');
  if(c.dr[0]>s.d)risks.push('🪨 '+s.label+' drains less freely than '+c.label+' prefers (fitness '+s.d+' against '+c.dr[0]+' needed), so wet spells linger.');
  if(!risks.length)risks.push('✅ No single driver stands out — guild pressure is balanced for these conditions.');
  const tips=[];
  if(insect>=.35)tips.push('Scout twice a week — leaf undersides and growing tips first, where aphids, whitefly and borer eggs start.');
  if(fungal>=.35)tips.push('Open the canopy and irrigate early in the day so leaves dry before night; strip infected leaves straight away.');
  if(mites>=.35)tips.push('Keep plants watered through hot spells and dust off hot-spot rows — drought-stressed plants invite mites.');
  if(rot>=.35)tips.push('Check drainage and stop over-irrigating — '+s.label.toLowerCase()+' soil holds water longer than '+c.label+' likes.');
  tips.push('Rotate '+c.label+' with a non-host crop next cycle and keep field edges clear — outbreaks usually start there.');
  tips.push('If you spray, rotate active ingredients and log what you used — resistance builds quickly in '+c.cat.toLowerCase()+' systems.');
  return {risks,tips};
}

/* =====================================================================
   8. SHARED FORM + TABLE RENDERERS
   ===================================================================== */
function opt(list,sel,labeler){
  return list.map(o=>{
    const v=typeof o==='string'?o:o.v;
    const l=typeof o==='string'?o:o.l;
    return '<option value="'+esc(v)+'"'+(String(v)===String(sel)?' selected':'')+'>'+esc(labeler?labeler(o):l)+'</option>';
  }).join('');
}
function cropSelect(sel){return opt(CROPS.map(c=>({v:c.key,l:c.icon+' '+c.label+'  ·  '+c.cat})),sel);}
function soilSelect(sel){return opt(Object.keys(SOILS),sel);}
function stageSelect(sel){return opt(Object.keys(STAGES).map(k=>({v:k,l:STAGES[k].label})),sel);}
function curSelect(sel){return opt(Object.keys(CUR).map(k=>({v:k,l:k+' ('+CUR[k].trim()+')'})),sel);}
function F(id,label,inner,hint){
  return '<div class="field" id="fld_'+id+'"><label>'+label+'</label>'+inner
    +(hint?'<div class="fhint">'+hint+'</div>':'')+'<div class="fmsg" id="msg_'+id+'"></div></div>';
}
function rowsTable(rows,opts){
  opts=opts||{};
  const limit=opts.limit||rows.length;
  const body=rows.slice(0,limit).map(r=>{
    const cur=opts.cur;   // money() falls back to the display currency
    return '<tr class="'+(opts.clickable?'clickable':'')+'"'+(opts.clickable?' onclick="openCrop(\''+r.key+'\')"':'')+'>'
      +'<td>'+r.icon+' <b>'+esc(r.label)+'</b><br><span class="small muted">'+esc(r.cat)+'</span></td>'
      +'<td>'+badgeHTML(Math.round(r.su.total)+'%',r.v.tone)+'</td>'
      +'<td>'+nf(r.e.yieldYear)+' kg<br><span class="small muted">'+nf(r.crop.baseYield)+' kg/ac/cycle</span></td>'
      +'<td>'+money(r.e.rev,cur)+'</td>'
      +'<td>'+money(r.e.cost,cur)+'<br><span class="small muted">'+money(r.crop.costUSD*fx(cur),cur)+'/acre other</span></td>'
      +'<td class="'+(r.e.profit>=0?'simcol':'t-bad')+'"><b>'+money(r.e.profit,cur)+'</b><br><span class="delta '+(r.e.profit>=0?'g':'b')+'">'+r.e.roi.toFixed(0)+'% ROI</span></td>'
      +'<td>'+nf(r.water)+' L/day<br><span class="small muted">'+nf(r.m.needMmCycle)+' mm/cycle</span></td>'
      +'<td>'+fmtDays(r.cycle)+'<br><span class="small muted">'+(r.perennial?r.crop.cyclesPerYear+' harvest/yr':'1 cycle')+'</span></td>'
      +'<td>'+badgeHTML(r.m.pest+'%',r.m.pest<25?'good':r.m.pest<45?'warn':'bad')+'</td>'
      +(opts.action?'<td>'+opts.action(r,r)+'</td>':'')+'</tr>';
  }).join('');
  return '<div style="overflow:auto"><table class="tbl"><thead><tr>'
    +'<th>Crop</th><th>Suitability</th><th>Annual yield</th><th>Revenue / yr</th><th>Cost / yr</th>'
    +'<th>Net / yr</th><th>Recommended water</th><th>Season</th><th>Risk</th>'
    +(opts.action?'<th></th>':'')+'</tr></thead><tbody>'+body+'</tbody></table></div>';
}
function fmtDays(d){return d>=730?(d/365).toFixed(1)+' yrs':d>=300?Math.round(d/30)+' months':Math.round(d)+' days';}
/* The crop tables are sorted from two layers (Create and Crop Advisor) over the
   same five modes, so the bar and its wiring exist once. setSort is app.js. */
const SORT_MODES=[['profit','💰 Net / year'],['suit','🌱 Suitability'],['water','💧 Water need'],
  ['cycle','⏱️ Shortest season'],['risk','🐛 Lowest risk']];
function sortBar(active,extra){
  const btn=s=>'<button type="button" class="sbtn'+(active===s[0]?' active':'')+'" data-sort="'+s[0]
    +'" onclick="setSort(\''+s[0]+'\')">'+s[1]+'</button>';
  return '<div class="sortbar no-print"><span class="small muted">Sort by</span>'
    +SORT_MODES.map(btn).join('')+(extra||'')+'</div>';
}

function actionPlan(f,m,g){
  const c=CROP[f.crop], T=[];
  const season=m.season, x=fx(f.currency||'BDT');
  if(m.waterState==='high')
    T.push(['💧','Reduce irrigation from <b>'+litres(f.water)+'/day</b> toward <b>'+litres(m.range.lo)+'–'+litres(m.range.hi)+'/day</b> — the model estimates ~<b>'+litres((f.water-m.range.hi)*season)+'</b> could be saved over the season (≈ '+money((f.water-m.range.hi)*season*COST.water*x)+').']);
  else if(m.waterState==='bad')
    T.push(['💧','Increase irrigation toward <b>'+litres(m.range.lo)+'–'+litres(m.range.hi)+'/day</b> — the crop is under water stress and predicted yield is being reduced.']);
  else if(m.waterState==='low')
    T.push(['💧','Nudge irrigation up toward <b>'+litres(m.range.lo)+'–'+litres(m.range.hi)+'/day</b> to remove the remaining water stress.']);
  if(f.fertilizer<m.fertRange.lo)T.push(['🧪','Raise fertilizer toward <b>'+nf(m.fertRange.lo,1)+'–'+nf(m.fertRange.hi,1)+' kg/week</b> — nutrient supply is below the estimated optimum.']);
  if(f.fertilizer>m.fertRange.hi)T.push(['🧪','Cut fertilizer toward <b>'+nf(m.fertRange.lo,1)+'–'+nf(m.fertRange.hi,1)+' kg/week</b> — excess risks burn, runoff and wasted money.']);
  const pm=pestModule(f,m);
  if(m.pest>32||pm.score>45)T.push(['🐛','Scout for pests &amp; disease this week — risk index <b>'+m.pest+'%</b>, pathogen pressure <b>'+pm.score.toFixed(0)+'%</b>. Check leaf undersides in humid spots first.']);
  if(m.moisture>85)T.push(['🌊','Check field drainage — modelled soil moisture is <b>'+m.moisture+'%</b> (waterlogging risk on '+SOILS[f.soil].label.toLowerCase()+' soil).']);
  if(m.tpen>6)T.push(['🌡️',f.temperature>c.temp[1]
    ?'Plan heat mitigation — <b>'+f.temperature+'°C</b> is above the comfortable range for '+c.label+' ('+c.temp[0]+'–'+c.temp[1]+'°C).'
    :'Watch for cold stress — <b>'+f.temperature+'°C</b> is below the comfortable range for '+c.label+' ('+c.temp[0]+'–'+c.temp[1]+'°C).']);
  if(g.toHarvest>0&&g.toHarvest<=10)T.push(['🌾','Harvest window in ~<b>'+g.toHarvest+' days</b> — arrange labour, storage and buyers now.']);
  if(c.perennial)T.push(['🌳',c.label+' is a perennial: keep establishment-year costs and intercrop young rows for early cash flow.']);
  if(!T.length)T.push(['✅','Conditions look balanced — maintain the current plan and keep monitoring every few days.']);
  return T;
}
