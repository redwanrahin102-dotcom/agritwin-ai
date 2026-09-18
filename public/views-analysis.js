function viewAdvisor(){
  const f=state.farm, all=cropRows(f), rows=sortCropRows(all,state.sortBy);
  const sel=state.advisorCrop||f.crop, c=CROP[sel];
  const p=advisorProbe(sel), m=computeModel(p), e=economics(p,m), su=suitability(p), v=verdict(su.total);
  const vig=vigor(su), wp=waterPlan(p,m), pm=pestModule(p,m), pn=pestNarrative(p,pm), self=all.find(x=>x.key===sel);
  const cur=f.currency;
  const sysRows=wp.systems.map(s=>'<tr><td><b>'+s.name+'</b></td><td>'+Math.round(s.eff*100)+'%</td>'
    +'<td>'+nf(s.grossMm)+' mm</td><td>'+nf(s.grossL)+' L</td><td>'+nf(s.grossWk)+' L</td></tr>').join('');
  const scen=['📉 Pessimistic −20%','Expected','📈 Optimistic +20%'].map((l,i)=>{
    const k=[0.8,1,1.2][i], pr=e.rev*k-e.cost;
    return '<tr'+(i===1?' style="background:#fbfdfa"':'')+'><td>'+(i===1?'<b>'+l+'</b>':l)+'</td><td>'+money(p.price*k,cur)+'</td>'
      +'<td class="'+(pr<0?'t-bad':'t-good')+'"><b>'+money(pr,cur)+'</b></td></tr>';}).join('');
  return '<div class="pagehead"><h2>🧭 Crop Advisor</h2>'
  +'<p>All '+CROPS.length+' crops in the database, simulated on <b>your</b> field (area, soil, pH, temperature, humidity, rainfall) at each crop\'s own recommended water and fertilizer, priced at indicative market rates in '+cur+'. Suitability blends temperature, water balance, soil drainage and humidity into one score.</p></div>'
  +sortBar(state.sortBy)
  +'<div class="card" style="margin-bottom:18px"><h3>📊 Ranking for '+esc(f.name)+' <span class="sub">'+nf(f.area)+' acre(s) · '+esc(f.soil)+' · '+f.temperature+'°C · '+f.humidity+'% RH · pH '+(f.ph==null?'—':f.ph)+'</span></h3>'
  +'<div class="scroll">'+rowsTable(rows,{clickable:true,cur:cur,
    action:(x)=>'<button class="btn outline" style="padding:5px 10px;font-size:11.5px" onclick="event.stopPropagation();switchCrop(\''+x.key+'\')">Grow this instead</button>'})+'</div>'
  +'<p class="small muted" style="margin-top:10px">Top economic fit: <b>'+rows[0].icon+' '+esc(rows[0].label)+'</b> ('+money(rows[0].e.profit,cur)+'/yr). Your current crop ranks <b>#'+(rows.findIndex(x=>x.key===f.crop)+1)+'</b>. Click any row for the full dossier.</p></div>'
  +'<div id="cropDetail" class="card" style="border-color:#BFE0C3"><div class="row" style="justify-content:space-between;align-items:flex-start">'
  +'<div><h3 style="margin-bottom:4px">'+c.icon+' '+esc(c.label)+' dossier <span class="sub">'+esc(c.cat)+' · matures in '+fmtDays(c.cycle)+' · '+c.cyclesPerYear+' cycle(s)/year</span></h3>'
  +'<div style="margin-top:6px"><span class="badge '+v.tone+'">suitability '+Math.round(su.total)+'% · '+v.l+'</span> '
  +'<span class="badge '+(m.pest<25?'good':m.pest<45?'warn':'bad')+'">pest risk '+m.pest+'%</span> '
  +'<span class="badge">water '+nf(m.need)+' L/day recommended</span> '
  +'<span class="badge '+(e.profit>=0?'good':'bad')+'">'+money(e.profit,cur)+' net / yr</span>'
  +(c.key===f.crop?' <span class="badge good">currently growing</span>':'')+'</div></div>'
  +(c.key===f.crop?'':'<button class="btn primary no-print" onclick="switchCrop(\''+c.key+'\')">🌱 Grow '+esc(c.label)+' instead</button>')
  +'</div>'
  +'<div class="metrics" style="margin-top:16px">'
  +'<div class="metric"><span class="tag">Crop dossier</span><div class="mi">'+c.icon+'</div><div class="ml">POTENTIAL YIELD</div><div class="big">'+nf(c.baseYield)+'<small> kg/ac</small></div><div class="ms">'+c.y+' t/ha per cycle</div></div>'
  +'<div class="metric"><span class="tag">Crop dossier</span><div class="mi">📈</div><div class="ml">PREDICTED YIELD</div><div class="big">'+nf(m.yield)+'<small> kg</small></div><div class="ms">'+(m.yield/c.baseYield*100).toFixed(0)+'% of potential on this field</div></div>'
  +'<div class="metric"><span class="tag">Crop dossier</span><div class="mi">💰</div><div class="ml">ANNUAL NET</div><div class="big '+(e.profit>=0?'t-good':'t-bad')+'">'+money(e.profit,cur)+'</div><div class="ms">margin '+e.margin.toFixed(0)+'% · ROI '+e.roi.toFixed(0)+'%</div></div>'
  +'<div class="metric"><span class="tag">Crop dossier</span><div class="mi">💧</div><div class="ml">WATER NEED</div><div class="big">'+nf(m.need)+'<small> L/day</small></div><div class="ms">'+nf(m.needMmCycle)+' mm/cycle · band '+c.rain[0]+'–'+c.rain[1]+' mm/yr</div></div>'
  +'<div class="metric"><span class="tag">Crop dossier</span><div class="mi">🧪</div><div class="ml">FERTILIZER</div><div class="big">'+nf(m.fertOpt,1)+'<small> kg/wk</small></div><div class="ms">soil preference pH '+c.pH[0]+'–'+c.pH[1]+'</div></div>'
  +'<div class="metric"><span class="tag">Crop dossier</span><div class="mi">💰</div><div class="ml">BREAK-EVEN</div><div class="big">'+money(e.bePrice,cur)+'<small>/kg</small></div><div class="ms">'+nf(e.beYieldPerAcre)+' kg/acre yield</div></div>'
  +'</div>'
  +'<div class="grid2">'
  +'<div class="card"><h3>🌡️ Suitability factors</h3>'+factorBars([
    {icon:'🌡️',label:'Temperature ('+f.temperature+'°C vs '+c.temp[0]+'–'+c.temp[1]+'°C)',v:su.temp},
    {icon:'💨',label:'Humidity ('+f.humidity+'% vs '+c.hum[0]+'–'+c.hum[1]+'%)',v:su.hum},
    {icon:'💧',label:'Water balance ('+su.eff.toFixed(2)+'× demand)',v:su.water},
    {icon:'🪨',label:'Soil drainage ('+f.soil+')',v:su.drain}]
    .concat(su.ph==null?[]:[{icon:'🧪',label:'Soil pH ('+f.ph+' vs '+c.pH[0]+'–'+c.pH[1]+')',v:su.ph}]))
  +'<h4 style="margin:16px 0 4px;font-size:13.5px">Stage-by-stage vigor on this field</h4>'
  +factorBars(vig.map(s=>({icon:'🌿',label:s.n,v:s.s/100})))
  +'<p class="small muted" style="margin-top:8px">Suitability weights: temperature 30% · water 25% · soil 25% · humidity 20%, then a limiting-factor penalty (worst factor below 55% drags the score down) so one severe mismatch cannot be averaged away. Site yield response follows <code>potential × (suitability)^1.7</code>.</p></div>'
  +'<div class="card"><h3>💹 Economics on this field <span class="sub">'+e.cpc+' cycle(s)/year</span></h3>'
  +'<div class="estat"><span>Annual yield</span><b>'+nf(e.yieldYear)+' kg</b></div>'
  +'<div class="estat"><span>Revenue</span><b>'+money(e.rev,cur)+'</b></div>'
  +'<div class="estat"><span>Other costs (seed, labour, machinery)</span><b>'+money(e.other,cur)+'</b></div>'
  +'<div class="estat"><span>Water cost</span><b>'+money(e.waterCost,cur)+'</b></div>'
  +'<div class="estat"><span>Fertilizer cost</span><b>'+money(e.fertCost,cur)+'</b></div>'
  +'<div class="estat"><span><b>Net profit / year</b></span><b class="'+(e.profit>=0?'t-good':'t-bad')+'">'+money(e.profit,cur)+'</b></div>'
  +'<div class="estat"><span>Profit per acre</span><b>'+money(e.profit/f.area,cur)+'</b></div>'
  +'<div class="estat"><span>Profit per day of crop cycle</span><b>'+money(e.profit/Math.max(1,c.cycle),cur)+'</b></div>'
  +'<h4 style="margin:14px 0 4px;font-size:13.5px">Price scenarios</h4>'
  +'<table class="tbl"><thead><tr><th>Scenario</th><th>Price / kg</th><th>Profit / yr</th></tr></thead><tbody>'+scen+'</tbody></table>'
  +'<p class="small muted" style="margin-top:8px">Priced at '+money(p.price,cur)+'/kg and '+money(p.costAc,cur)+'/acre other costs — the database defaults for '+esc(c.label)+'.</p></div></div>'
  +'<div class="grid2" style="margin-top:18px">'
  +'<div class="card"><h3>🚰 Irrigation plan <span class="sub">per cycle · '+nf(wp.weeks)+' weeks</span></h3>'
  +'<div class="estat"><span>Net irrigation requirement</span><b>'+nf(wp.netMmCycle)+' mm/cycle</b></div>'
  +'<div class="estat"><span>Crop water use (ETc demand)</span><b>'+nf(wp.etcMmCycle)+' mm/cycle</b></div>'
  +'<div class="estat"><span>Rain expected this cycle</span><b>'+nf(m.rainCreditMmCycle)+' mm usable</b></div>'
  +'<div class="estat"><span>Rainfall preference of the crop</span><b>'+wp.bandMm.lo+'–'+wp.bandMm.hi+' mm/yr (site ≈'+nf(wp.annualRainMm)+')</b></div>'
  +'<div class="estat"><span>Equivalent daily depth</span><b>'+nf(m.need)+' L/day ≈ '+m.needMmDay.toFixed(2)+' mm/day</b></div>'
  +'<div class="estat"><span>Water use efficiency</span><b>'+wp.wue.toFixed(2)+' kg yield per m³</b></div>'
  +'<div style="margin:10px 0"><span class="badge '+wp.status.tone+'">'+wp.status.l+'</span></div>'
  +'<table class="tbl"><thead><tr><th>System</th><th>Efficiency</th><th>Gross mm</th><th>Litres/cycle</th><th>Litres/week</th></tr></thead><tbody>'+sysRows+'</tbody></table>'
  +'<p class="small muted" style="margin-top:10px">Choose the system you can afford — the model shows the pumped water each option needs to deliver the same net amount.</p></div>'
  +'<div class="card"><h3>🐛 Pest &amp; disease dossier <span class="sub">'+pm.level.l+'</span></h3>'+guildBars(pm)
  +'<h4 style="margin:14px 0 8px;font-size:13.5px">Likely species on '+esc(c.label)+'</h4><div class="chips">'
  +pm.species.map(s=>'<span class="kpill">🐛 '+esc(s)+'</span>').join('')+'</div>'
  +'<div class="warnbox">💰 Unmanaged exposure ≈ <b>'+pm.lossPct.toFixed(0)+'%</b> of revenue ≈ <b>'+money(e.rev*pm.lossPct/100,cur)+'</b>/yr. With a working IPM programme roughly 60% of that is recoverable.</div>'
  +'<h4 style="margin:14px 0 6px;font-size:13.5px">Why the model flagged this</h4><ul style="list-style:none;display:flex;flex-direction:column;gap:7px">'
  +pn.risks.map(r=>'<li class="small">• '+r+'</li>').join('')+'</ul>'
  +'<h4 style="margin:14px 0 6px;font-size:13.5px">Management plan</h4><ul style="list-style:none;display:flex;flex-direction:column;gap:7px">'
  +pn.tips.map(t=>'<li class="small">• '+t+'</li>').join('')+'</ul></div></div>'
  +'<div class="card" style="margin-top:18px"><h3>📈 Yield range &amp; harvest window <span class="sub">pest-adjusted · stress-slowed</span></h3>'+yieldRangeHTML(p,m,pm,su)+'</div>'
  +'<div class="card" style="margin-top:18px"><h3>📋 How this crop scored</h3><div class="meth">'
  +'<p><b>'+esc(c.label)+'</b> prefers '+c.temp[0]+'–'+c.temp[1]+'°C, '+c.hum[0]+'–'+c.hum[1]+'% humidity, '+c.rain[0]+'–'+c.rain[1]+' mm of water per season, drainage fitness '+c.dr[0]+'–'+c.dr[1]+' and soil pH '+c.pH[0]+'–'+c.pH[1]+'.</p>'
  +'<p style="margin-top:8px">Your field scores '+Math.round(su.total)+'% (temperature '+Math.round(su.temp*100)+'%, humidity '+Math.round(su.hum*100)+'%, water '+Math.round(su.water*100)+'%, soil '+Math.round(su.soil*100)+'%'+(su.ph==null?'':' including pH')+'). Limiting factor: <b>'+limitingName(su)+'</b>.</p>'
  +'<p style="margin-top:8px">This crop can yield '+nf(m.yield)+' kg on '+nf(f.area)+' acre(s) per cycle at the recommended inputs — about '+(m.yield/c.baseYield*100).toFixed(0)+'% of its potential, with '+(self?self.e.cpc:1)+' cycle(s)/year.</p></div></div>';
}
function limitingName(su){
  const items=[['temperature',su.temp],['humidity',su.hum],['water balance',su.water],['soil drainage',su.drain]];
  if(su.ph!=null)items.push(['soil pH',su.ph]);
  items.sort((a,b)=>a[1]-b[1]);
  return items[0][0]+' ('+Math.round(items[0][1]*100)+'% match)';
}

/* =====================================================================
   15. LAYER VIEW — REPORTS
   ===================================================================== */
function viewReports(){
  const f=state.farm, c=CROP[f.crop], m=computeModel(f), e=economics(f,m), o=state.optimized;
  const series=simulateGrowth(f,30), pm=pestModule(f,m), su=suitability(f), wp=waterPlan(f,m), g=growthInfo(f);
  const pn=pestNarrative(f,pm);
  const cur=f.currency;
  let opt='';
  if(o){
    const bM=o.beforeM, aM=o.afterM;
    const wEff=Math.round((o.before.water-o.after.water)/o.before.water*100);
    const fEff=Math.round((o.before.fertilizer-o.after.fertilizer)/Math.max(0.1,o.before.fertilizer)*100);
    const yChg=aM.yield-bM.yield, rRed=Math.round((bM.pest-aM.pest)/Math.max(1,bM.pest)*100);
    const eB=economics(o.before,bM,cur), eA=economics(o.after,aM,cur);
    const bar=(lbl,v0,v1,max)=>'<div class="frow" style="grid-template-columns:150px 1fr 150px"><span>'+lbl+'</span>'
      +'<div class="fbar" style="height:15px"><i style="width:'+clamp(v0/max*100,0,100)+'%;background:#A9B5AC"></i>'
      +'<i style="width:'+clamp(v1/max*100,0,100)+'%;background:var(--green);margin-top:-15px;opacity:.85"></i></div>'
      +'<b class="small">'+nf(v0)+' → '+nf(v1)+'</b></div>';
    opt='<div class="savings">'
      +'<div class="saving"><div class="sv">'+(wEff>0?'−':'')+Math.abs(wEff)+'%</div><div class="sl">💧 Water use</div></div>'
      +'<div class="saving"><div class="sv">'+(fEff>0?'−':'')+Math.abs(fEff)+'%</div><div class="sl">🌱 Fertilizer use</div></div>'
      +'<div class="saving"><div class="sv" style="color:'+(yChg>=0?'var(--green-d)':'var(--red)')+'">'+(yChg>=0?'+':'')+nf(yChg)+' kg</div><div class="sl">📈 Predicted yield</div></div>'
      +'<div class="saving"><div class="sv">'+(rRed>0?'−':'')+Math.abs(rRed)+'%</div><div class="sl">⚠️ Pest risk</div></div>'
      +'<div class="saving"><div class="sv" style="color:'+(eA.profit>=eB.profit?'var(--green-d)':'var(--red)')+'">'+(eA.profit>=eB.profit?'+':'')+money(eA.profit-eB.profit,cur)+'</div><div class="sl">💰 Net profit / yr</div></div>'
      +'</div>'
      +'<div class="grid2" style="margin-bottom:18px">'
      +'<div class="card"><h3>Graph 2 — Current vs Optimized</h3>'
      +bar('Water (L/day)',o.before.water,o.after.water,Math.max(o.before.water,o.after.water))
      +bar('Fertilizer (kg/wk)',o.before.fertilizer,o.after.fertilizer,Math.max(o.before.fertilizer,o.after.fertilizer))
      +bar('Yield (kg)',bM.yield,aM.yield,Math.max(bM.yield,aM.yield))
      +bar('Pest risk (%)',bM.pest,aM.pest,Math.max(bM.pest,aM.pest))
      +'<p class="small muted" style="margin-top:10px">Grey = current · green = optimized. Model estimates, not guaranteed savings.</p></div>'
      +'<div class="card"><h3>Before vs after</h3>'
      +'<table class="tbl"><thead><tr><th></th><th>Before</th><th>After</th></tr></thead><tbody>'
      +'<tr><td>💧 Water</td><td>'+nf(o.before.water)+' L/day</td><td class="simcol">'+nf(o.after.water)+' L/day</td></tr>'
      +'<tr><td>🧪 Fertilizer</td><td>'+nf(o.before.fertilizer,1)+' kg/wk</td><td class="simcol">'+nf(o.after.fertilizer,1)+' kg/wk</td></tr>'
      +'<tr><td>🌱 Health</td><td>'+bM.health+'/100</td><td class="simcol">'+aM.health+'/100</td></tr>'
      +'<tr><td>📈 Yield</td><td>'+nf(bM.yield)+' kg</td><td class="simcol">'+nf(aM.yield)+' kg</td></tr>'
      +'<tr><td>⚠️ Pest risk</td><td>'+bM.pest+'%</td><td class="simcol">'+aM.pest+'%</td></tr>'
      +'<tr><td>💰 Net / year</td><td>'+money(eB.profit,cur)+'</td><td class="simcol">'+money(eA.profit,cur)+'</td></tr>'
      +'</tbody></table><p class="small muted" style="margin-top:10px">AgriTwin does not simply predict — it helps <b>compare decisions</b>.</p></div></div>';
  } else {
    opt='<div class="card" style="margin-bottom:18px"><h3>Graphs 2–4 — Current vs Optimized</h3>'
      +'<p class="muted small" style="margin:6px 0 14px">Run the Optimizer layer to generate the water, fertilizer, yield and risk comparison graphs plus the projected impact cards.</p>'
      +'<button class="btn primary no-print" onclick="nav(\'optimizer\')">⚙️ Go to Optimizer layer</button></div>';
  }
  const adv=cropRows(f).sort((a,b)=>b.e.profit-a.e.profit).slice(0,5)
    .map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+r.icon+' <b>'+esc(r.label)+'</b></td><td>'+badgeHTML(Math.round(r.su.total)+'%',r.v.tone)+'</td>'
      +'<td>'+nf(r.e.yieldYear)+' kg</td><td class="'+(r.e.profit>=0?'simcol':'t-bad')+'"><b>'+money(r.e.profit,cur)+'</b></td>'
      +'<td>'+nf(r.water)+' L/day</td></tr>').join('');
  const hist=loadHist().slice(0,10);
  return '<div class="pagehead"><h2>Reports</h2><p>Farm projections, optimization impact, water and pest plans, crop options and simulation history — all model estimates for '+esc(f.name)+'.</p></div>'
  +'<div class="card" style="margin-bottom:18px"><h3>Graph 1 — Crop health &amp; soil moisture <span class="sub">30-day projection</span></h3>'
  +'<div class="legendrow"><span><i style="background:#4CAF50"></i>Crop health</span><span><i style="background:#7DB7D9"></i>Soil moisture %</span></div>'
  +'<div class="chartbox">'+lineChart([{name:'Health',color:'#4CAF50',data:series.map(d=>d.health)},
    {name:'Moisture',color:'#7DB7D9',data:series.map(d=>d.moisture)}],{ymin:0,ymax:100,xTick:i=>'Day '+(i+1)})+'</div></div>'
  +opt
  +'<div class="grid2" style="margin-bottom:18px">'
  +'<div class="card"><h3>🚰 Water plan summary</h3><div class="meth">'
  +'<div class="estat"><span>Recommended irrigation</span><b>'+nf(m.range.lo)+'–'+nf(m.range.hi)+' L/day</b></div>'
  +'<div class="estat"><span>You apply</span><b>'+nf(f.water)+' L/day ('+m.mmPerDay.toFixed(2)+' mm/day)</b></div>'
  +'<div class="estat"><span>Season requirement</span><b>'+nf(m.needMmCycle)+' mm/cycle</b></div>'
  +'<div class="estat"><span>Crop water use (ETc)</span><b>'+nf(wp.etcMmCycle)+' mm/cycle</b></div>'
  +'<div class="estat"><span>Status</span><b><span class="badge '+wp.status.tone+'">'+wp.status.l+'</span></b></div>'
  +'<p style="margin-top:10px" class="small">Drip '+(wp.systems[0].eff*100).toFixed(0)+'% · Sprinkler '+(wp.systems[1].eff*100).toFixed(0)+'% · Furrow '+(wp.systems[2].eff*100).toFixed(0)+'% efficiency. Best-value system: <b>'+((f.area>=5)?'sprinkler or drip':'drip or sprinkler')+'</b> for '+nf(f.area)+' acre(s).</p></div></div>'
  +'<div class="card"><h3>🐛 Pest &amp; disease plan summary</h3><div class="meth">'
  +'<div class="estat"><span>Risk index</span><b>'+m.pest+'% · '+pm.level.l+'</b></div>'
  +'<div class="estat"><span>Pathogen pressure</span><b>'+pm.score.toFixed(0)+'%</b></div>'
  +'<div class="estat"><span>Revenue at risk</span><b>'+money(e.rev*pm.lossPct/100,cur)+' / yr</b></div>'
  +'<div class="estat"><span>Watch for</span><b>'+pm.species.map(esc).join(' · ')+'</b></div>'
  +'<p class="small" style="margin-top:10px">'+pn.tips[0]+'</p></div></div></div>'
  +'<div class="card" style="margin-bottom:18px"><h3>Graph 3 — Pest-adjusted yield range <span class="sub">and harvest timing</span></h3>'+yieldRangeHTML(f,m,pm,su)+'</div>'
  +'<div class="grid2">'
  +'<div class="card"><h3>🧭 Crop options for this field <span class="sub">top 5 by net profit</span></h3>'
  +'<table class="tbl"><thead><tr><th>#</th><th>Crop</th><th>Suitability</th><th>Annual yield</th><th>Net / yr</th><th>Water</th></tr></thead><tbody>'+adv+'</tbody></table>'
  +'<p class="small muted" style="margin-top:10px">Your current crop '+c.icon+' '+esc(c.label)+' yields '+nf(m.yield)+' kg/cycle and '+money(e.profit,cur)+' net per year on '+nf(f.area)+' acre(s).</p></div>'
  +'<div class="card"><h3>🕘 Simulation history</h3>'
  +(hist.length?'<div class="scroll"><table class="tbl"><thead><tr><th>Date</th><th>Type</th><th>Water</th><th>Fertilizer</th><th>Yield</th><th>Risk</th></tr></thead><tbody>'
    +hist.map(h=>'<tr><td>'+dateStr(h.ts)+'</td><td>'+esc(h.type)+(h.legacy?' <span class="badge warn">old scale</span>':'')+'</td><td>'+nf(h.water)+' L</td><td>'+nf(h.fert,1)+' kg</td><td class="simcol">'+nf(h.yield)+' kg</td><td>'+h.risk+'%</td></tr>').join('')
    +'</tbody></table></div>':'<p class="muted small">No simulations recorded yet.</p>')+'</div></div>'
  +'<div class="card" style="margin-top:18px"><h3>📄 Printable farm report</h3>'
  +'<p class="small muted" style="line-height:1.7;margin-bottom:12px">Generates a report containing the farm profile, current conditions, season timeline (day '+g.day+' of '+nf(g.season)+'), predicted health ('+m.health+'/100), water recommendation, yield estimate ('+nf(m.yield)+' kg/cycle), pest and weather risk, suitability score ('+Math.round(su.total)+'%), economics with break-even, optimization results, crop alternatives and simulation history — with model limitations stated openly.</p>'
  +'<div class="row no-print"><button class="btn gold" onclick="window.print()">🖨️ GENERATE FARM REPORT</button>'
  +'<button class="btn outline" onclick="exportFarm()">⬇️ Export JSON</button>'
  +'<button class="btn outline" onclick="nav(\'method\')">🧠 Where these numbers come from</button></div>'
  +'<p class="small muted" style="margin-top:12px"><b>Limitations:</b> demo-scale calibration, simplified ET₀, no site-specific soil test, indicative market prices, pest risk is an index rather than a diagnosis. Results are estimates and may vary with real-world farm conditions.</p></div>';
}

/* =====================================================================
   16. LAYER VIEW — HOW IT THINKS
   ===================================================================== */
function viewMethod(){
  return '<div class="pagehead"><h2>How AgriTwin AI Thinks</h2>'
  +'<p>The full reasoning pipeline, equations, data sources and limitations — documented for judges, teachers and farmers.</p></div>'
  +'<div class="card" style="margin-bottom:18px"><h3>🧠 The pipeline</h3><div class="flow">'
  +'<div class="fbox">📋 FARM DATA<br><span class="small muted" style="font-weight:400">crop · soil · stage · weather · water · fertilizer · prices</span></div>'
  +'<div class="farrow">↓</div><div class="fsplit">'
  +'<div class="fbox hl" style="min-width:200px">🌾 Agronomic rules<br><span class="small muted" style="font-weight:400">ET₀ · Kc · soil behaviour · crop bands</span></div>'
  +'<span class="plus">+</span>'
  +'<div class="fbox hl" style="min-width:200px">🧭 Fuzzy suitability<br><span class="small muted" style="font-weight:400">58 crops · 5 factors</span></div>'
  +'</div><div class="farrow">↓</div>'
  +'<div class="fbox">🖥️ Digital Farm Model (one water balance, one health index)</div>'
  +'<div class="farrow">↓</div><div class="fsplit">'
  +'<div class="fbox" style="min-width:170px">🔮 Simulation</div><span class="plus">+</span>'
  +'<div class="fbox" style="min-width:170px">🐛 Pest guild model</div><span class="plus">+</span>'
  +'<div class="fbox" style="min-width:170px">💰 Economics</div></div>'
  +'<div class="farrow">↓</div><div class="fbox">📈 Prediction &amp; ranking</div>'
  +'<div class="farrow">↓</div><div class="fbox">⚙️ Optimization (250 strategies)</div>'
  +'<div class="farrow">↓</div><div class="fbox" style="border-color:var(--green);background:#F3FAF4">🌱 Recommendation + action plan</div>'
  +'</div></div>'
  +'<div class="grid2">'
  +'<div class="card"><h3>📐 The model (merged engine)</h3><div class="meth">'
  +'<h4>Water balance — physical units</h4>Reference evaporation from temperature: <code>ET₀ ≈ 1.8 + 0.11·T</code> mm/day (Hargreaves-style proxy). Crop water use: <code>ETc = ET₀ × Kc(stage)</code> with FAO-56 style crop coefficients. Rainfall is credited at soil-specific efficiency with diminishing returns: <code>rainEff = eff(soil) × (mm/7)^0.75</code>. Net requirement <code>net = max(0.2, ETc − rainEff)</code> mm/day, then <code>need = net × 4047 × acres × drainFlow</code> litres/day — 1 mm over 1 acre is 4,047 litres, so every litre figure on this site converts directly to mm. The result is always a <b>range</b>, never one magic number.'
  +'<h4>Health &amp; stress</h4>Non-linear penalties for under/over irrigation, scaled by stage sensitivity (flowering is highest), crop tolerance (rice tolerates flooding, tomatoes do not) and soil drainage. Temperature, humidity and fertilizer add their own penalties; pest pressure subtracts 0.18 × risk index.'
  +'<h4>Yield</h4><code>yield = potential(baseYield per acre) × (health/100)^1.6</code> — diminishing response. Potential yields come from the 58-crop database (t/ha × 0.4047).'
  +'<h4>Fuzzy suitability (0–100)</h4><code>score = 30%·temperature + 25%·water + 25%·soil + 20%·humidity</code>, where each factor is a trapezoidal membership function: full credit inside the crop\'s ideal band, half credit at the tolerance limit, zero beyond it. Soil combines drainage fitness with pH when pH is supplied. A limiting-factor penalty follows — <code>score = 100 × (weighted − max(0, 0.55 − worst factor) × 0.45)</code> — so one badly mismatched factor (say dates in high humidity) cannot be averaged away by the others.'
  +'<h4>Pest guild model</h4><code>index = 0.40·fungal + 0.35·insects + 0.10·mites + 0.15·root-rot</code>, each driven by temperature/humidity thresholds and by whether site water (irrigation + effective rain) exceeds the crop\'s own water band. Expected untreated loss ≈ <code>0.30 × index</code>.'
  +'<h4>Economics</h4><code>revenue = annual yield × price</code>; <code>cost = other cost/acre + water litres × rate + fertilizer kg × rate</code>. Water is costed at the equivalent of ≈৳0.01 per litre pumped — about ৳16,000 per acre for a 400 mm season, in line with typical diesel/electric irrigation costs — and fertilizer at ≈৳90/kg; switch currency and every figure follows. Break-even price and break-even yield are reported so a farmer can see the margin of safety.'
  +'<h4>Optimizer score</h4><code>score = revenue − water cost − fertilizer cost − risk penalty</code> with <code>risk penalty = max(0, pest − 32) × 10</code> in the chosen currency.'
  +'</div></div>'
  +'<div class="card"><h3>🗃️ Data sources &amp; honest status</h3><div class="meth">'
  +'<ul><li><b>Crop information</b> — 58 crops with temperature, humidity, water and pH bands, drainage fit, days to maturity, potential yield and indicative price/cost</li>'
  +'<li><b>Crop coefficients</b> — FAO-56 style Kc profiles by crop class (cereal, paddy, cane, legume, root, oil, vegetable, leafy, orchard, beverage, forage) with per-crop overrides</li>'
  +'<li><b>Soil characteristics</b> — 10 classes expressed as drainage fitness, irrigation-demand multiplier, waterlogging penalty, rainfall credit and moisture swing</li>'
  +'<li><b>Weather variables</b> — temperature, humidity, 7-day rainfall and 8 adverse scenarios</li>'
  +'<li><b>Agricultural recommendation rules</b> — irrigation ranges, fertilizer windows, IPM thresholds, harvest timing</li>'
  +'<li><b>Market data</b> — indicative global price and crop-cost defaults, converted by an approximate FX table</li></ul>'
  +'<h4>How the two builds were merged</h4>Build A supplied the layer shell, simulator, optimizer, stress test, timeline, forecast and backend logging. Build B supplied the 58-crop database, fuzzy suitability engine, 10 soils, irrigation-system sizing, pest guilds and multi-currency economics. They now share <b>one crop database and one water balance</b>: Build B\'s mm-based crop bands were re-expressed in Build A\'s litres-per-day engine at 4,047 litres per mm per acre, and Build A\'s demo-scale litre constants were replaced with physical ones.'
  +'<h4>Machine-learning status</h4>The current engine is a <b>transparent rule-based agronomic model</b> — every number is computed, none is hardcoded per farm. The documented upgrade path trains a Random Forest / gradient-boosted regressor on real datasets (FAO, government trials, Kaggle) and reports MAE, RMSE and R² on a held-out test set; <code>computeModel()</code> and <code>suitability()</code> are the two swappable functions.'
  +'</div></div></div>'
  +'<div class="card" style="margin-top:18px"><h3>🧾 Which layer proves what</h3><div class="meth">'
  +'<ul><li><b>Dashboard</b> — the twin\'s live state: health, water range, suitability, risk, yield, profit, timeline, action plan, stress test, water plan.</li>'
  +'<li><b>Simulator</b> — causality: move one input, watch the whole chain (water → moisture → stress → health → yield) and compare current vs simulated.</li>'
  +'<li><b>Optimizer</b> — decision quality: ~250 strategies scored by profit at lower risk, with the trade-off made explicit.</li>'
  +'<li><b>Crop Advisor</b> — agronomy: all 58 crops scored on the same field, with per-crop dossiers, irrigation sizing, pest plans and break-even economics.</li>'
  +'<li><b>Reports</b> — evidence: graphs, before/after, water and pest summaries, history and a printable farm report.</li></ul></div></div>'
  +'<div class="card" style="margin-top:18px"><h3>⚠️ Limitations (stated openly)</h3><div class="meth">'
  +'<ul><li>Demo-scale calibration: the engine is internally consistent in mm, litres, kg and currency, but it is not validated against a specific field trial.</li>'
  +'<li>Simplified ET₀ from temperature only (no wind, solar radiation or humidity deficit in the reference term).</li>'
  +'<li>No site-specific soil test, leaf analysis or local weather station feed.</li>'
  +'<li>Pest risk is an <b>index</b> for scouting priorities, not a diagnosis.</li>'
  +'<li>Market prices, FX rates and crop cost defaults are indicative — always replace them with local figures.</li></ul>'
  +'<p style="margin-top:12px"><b>AgriTwin AI provides predictive simulations and decision support. Results are estimates and may vary depending on real-world farm conditions.</b></p></div></div>';
}

