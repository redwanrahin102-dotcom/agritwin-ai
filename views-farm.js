/* =====================================================================
   9. LAYER VIEW — HOME
   ===================================================================== */
function viewHome(){
  const steps=[['01','CREATE','Enter your farm information — 58 crops, 10 soils, multi-currency economics.']
    ,['02','SIMULATE','Test irrigation, fertilizer and weather decisions before you spend money.']
    ,['03','COMPARE','See exactly how each decision changes health, yield, cost and risk.']
    ,['04','OPTIMIZE','Follow the strategy with the best balance of yield, inputs and risk — or switch to a better-paying crop.']];
  const feats=[['🌱','Crop Health','Predicted condition index, weighted toward the sensitive flowering stage.','dashboard']
    ,['💧','Water Optimization','Optimal irrigation range in L/day and mm, plus drip / sprinkler / furrow sizing.','dashboard']
    ,['🌦️','Weather Risk','8 weather scenarios: rain, heat wave, cold snap, drought, humid surge.','simulator']
    ,['🐛','Pest & Disease','Pathogen-guild model with likely species and a practical IPM plan.','advisor']
    ,['📈','Yield Prediction','Pest-adjusted harvest range from the digital twin.','reports']
    ,['💰','Farm Economics','Revenue, input costs, margin, ROI, break-even and price scenarios.','reports']
    ,['🧭','58-Crop Advisor','Rank 58 crops by suitability and profit on your exact field.','advisor']
    ,['📅','Season Timeline','Growth-stage progress and days to harvest from your planting date.','dashboard']
    ,['✅','Action Plan','A daily checklist generated from your farm\'s live model state.','dashboard']
    ,['🛡️','Stress Test','See how the farm would react if the weather turns bad.','dashboard']
    ,['🔮','What-If Simulator','Live sliders with current vs simulated comparison.','simulator']
    ,['⚙️','250-Strategy Optimizer','Grid search over water × fertilizer, ranked by profit at lower risk.','optimizer']];
  const demo=templateFarm();
  return '<section class="hero"><div class="hero-center">'
    +'<img class="hero-logo" src="logo.png" onerror="logoFail(this)" alt="AgriTwin AI logo">'
    +'<h1>Simulate Your Farm.<br><em>Optimize Your Future.</em></h1>'
    +'<p>AgriTwin AI builds a digital twin of your farm so you can test farming decisions — irrigation, fertilizer, weather, even the crop itself — before applying them in the real world.</p>'
    +'<div class="row" style="justify-content:center">'
    +'<button class="btn primary big" onclick="nav(\'create\')">CREATE YOUR FARM</button>'
    +'<button class="btn outline-dark big" onclick="trySim()">TRY SIMULATOR</button>'
    +'<button class="btn gold big" onclick="loadDemoFarm()">⚡ DEMO FARM</button>'
    +'</div>'
    +'<p class="small" style="margin-top:20px;color:rgba(245,247,242,.6)">Demo twin: '+demo.icon+' Tomatoes · 1 acre · Loam · flowering · ≈'+nf(demo.water)+' L/day recommended</p>'
    +'</div></section>'
    +'<div class="wrap">'
    +'<section class="block"><h2 class="sec-title">How it works</h2><p class="sec-sub">Four steps from real farm data to an optimized strategy.</p>'
    +'<div class="steps">'+steps.map(s=>'<div class="step"><span class="num">'+s[0]+'</span><b>'+s[1]+'</b><p>'+s[2]+'</p></div>').join('')+'</div></section>'
    +'<section class="block"><h2 class="sec-title">Decision tools</h2><p class="sec-sub">Everything the merged engine estimates for your digital twin — click a card to open that layer.</p>'
    +'<div class="features">'+feats.map(x=>'<div class="feature feat" onclick="nav(\''+x[3]+'\')"><div class="fi">'+x[0]+'</div><b>'+x[1]+'</b><p>'+x[2]+'</p></div>').join('')+'</div></section>'
    +'<section class="block"><h2 class="sec-title">Two builds, one engine</h2>'
    +'<p class="sec-sub">This site merges the layer-based farm simulator with the 58-crop agronomic advisor into a single model — one knowledge base, one water balance, one currency system.</p>'
    +'<div class="grid2">'
    +'<div class="card"><h3>🖥️ From the simulator build</h3><div class="meth"><ul>'
    +'<li>Sticky hot bar with 8 keyboard-navigable layers</li><li>What-if simulator with live current-vs-simulated comparison</li>'
    +'<li>250-strategy water × fertilizer optimizer</li><li>Season timeline, action plan, stress test, 30-day forecast</li>'
    +'<li>JSON export, printable report, backend activity log</li></ul></div></div>'
    +'<div class="card"><h3>🧠 From the agronomy build</h3><div class="meth"><ul>'
    +'<li>58-crop knowledge base with growth stages and water bands</li><li>Fuzzy suitability scoring (temperature, humidity, water, soil, pH)</li>'
    +'<li>10 soil types, multi-currency market pricing</li><li>Irrigation-system sizing in litres per cycle</li>'
    +'<li>Pathogen-guild pest model, ROI, break-even and price scenarios</li></ul></div></div>'
    +'</div></section>'
    +'<section class="block" style="padding-bottom:30px"><h2 class="sec-title">Switch between layers</h2>'
    +'<p class="sec-sub">One hot bar at the top holds all '+LAYERS.length+' numbered layers — or use the flow bar under every page, or your keyboard (1–'+LAYERS.length+', ←/→).</p>'
    +'<div class="row" style="gap:8px">'
    +LAYERS.map((l,i)=>{const locked=l.needs&&!state.farm;
      return '<button class="lchip2" onclick="nav(\''+l.id+'\')"'+(locked?' title="🔒 unlocks after creating a farm"':'')+'>'
        +l.icon+'<span>'+l.label+'</span><span class="ln">'+(locked?'🔒':String(i+1).padStart(2,'0'))+'</span></button>';}).join('')
    +'</div></section></div>';
}

/* =====================================================================
   10. LAYER VIEW — CREATE FARM
   ===================================================================== */
function viewCreate(){
  const f=state.farm||templateFarm();
  const c=CROP[f.crop];
  const m=computeModel(Object.assign({},f,{water:1}));
  const rec=computeModel(Object.assign({},f,{water:m.need,fertilizer:m.fertOpt}));
  const cur=f.currency||'BDT';
  return '<div class="pagehead"><h2>Create Your Digital Farm</h2>'
  +'<p>Enter your real field conditions. The twin is built from these values and logged to the server. Completing this form unlocks the Dashboard, Simulator, Optimizer, Crop Advisor and Reports layers.</p></div>'
  +'<form onsubmit="submitFarm(event);return false" novalidate>'
  +'<div class="fgroup"><h3>① Farm &amp; crop</h3><div class="form-grid">'
  +F('name','FARM NAME','<input id="fName" placeholder="e.g. My Tomato Farm" value="'+esc(f.name||'')+'">')
  +F('crop','CROP — 58 IN DATABASE','<select id="fCrop" onchange="autoFillCrop()">'+cropSelect(f.crop)+'</select>','Selected: '+c.icon+' '+c.label+' · '+c.cat+' · matures in '+fmtDays(c.cycle)+' · '+nf(c.baseYield)+' kg/acre potential')
  +F('area','FARM AREA (acres)','<input id="fArea" type="number" min="0.1" max="500" step="0.25" value="'+f.area+'">')
  +'</div></div>'
  +'<div class="fgroup"><h3>② Field conditions</h3><div class="form-grid">'
  +F('soil','SOIL TYPE — 10 CLASSES','<select id="fSoil" onchange="refreshComparisons()">'+soilSelect(f.soil)+'</select>','Drainage fitness '+SOILS[f.soil].d+' · '+SOILS[f.soil].note)
  +F('stage','GROWTH STAGE','<select id="fStage" onchange="refreshComparisons()">'+stageSelect(f.stage)+'</select>','<button type="button" class="btn outline" style="padding:4px 10px;font-size:11px" onclick="syncStageToDate()">🔄 Sync stage to planting date</button>')
  +F('planting','PLANTING DATE','<input id="fPlant" type="date" value="'+esc(f.plantingDate||'')+'">','Drives the season timeline and days to harvest.')
  +F('ph','SOIL pH (optional)','<input id="fPh" type="number" min="0" max="14" step="0.1" placeholder="e.g. 6.5" value="'+(f.ph==null?'':f.ph)+'">','Used by the suitability scorer. Leave empty if unknown.')
  +'</div></div>'
  +'<div class="fgroup"><h3>③ Resources (recommended values are pre-filled)</h3><div class="form-grid">'
  +F('water','DAILY IRRIGATION (L/day)','<input id="fWater" type="number" min="1" max="2000000" step="10" value="'+f.water+'">','Model optimum: <b>'+nf(rec.range.lo)+'–'+nf(rec.range.hi)+' L/day</b> ≈ '+rec.mmPerDay.toFixed(2)+' mm/day · season need ≈ '+nf(rec.needMmCycle)+' mm')
  +F('fert','WEEKLY FERTILIZER (kg/week)','<input id="fFert" type="number" min="0" max="500" step="0.1" value="'+f.fertilizer+'">','Model optimum: <b>'+nf(rec.fertRange.lo,1)+'–'+nf(rec.fertRange.hi,1)+' kg/week</b>')
  +'<div class="field"><label>&nbsp;</label><button type="button" class="btn outline" onclick="fillRecommended()">↺ Use recommended water &amp; fertilizer</button></div>'
  +'</div></div>'
  +'<div class="fgroup"><h3>④ Environment</h3><div class="form-grid">'
  +F('temp','TEMPERATURE (°C)','<input id="fTemp" type="number" min="-5" max="50" step="0.5" value="'+f.temperature+'">','Comfortable range for '+c.label+': '+c.temp[0]+'–'+c.temp[1]+'°C')
  +F('hum','HUMIDITY (%)','<input id="fHum" type="number" min="10" max="100" value="'+f.humidity+'">','Crop preference: '+c.hum[0]+'–'+c.hum[1]+'%')
  +F('rain','RECENT RAINFALL (mm, last 7 days)','<input id="fRain" type="number" min="0" max="300" value="'+f.rainfall+'">','Credited at '+(SOILS[f.soil].rainEff*100).toFixed(0)+'% efficiency on '+SOILS[f.soil].label.toLowerCase()+'.')
  +'</div></div>'
  +'<div class="fgroup"><h3>⑤ Market &amp; costs</h3><div class="form-grid">'
  +F('cur','CURRENCY','<select id="fCur" onchange="autoFillCrop()">'+curSelect(cur)+'</select>','Approximate FX table is indicative — enter your local prices.')
  +F('price','SELLING PRICE (per kg)','<input id="fPrice" type="number" min="0.01" step="0.01" value="'+(+f.price).toFixed(2)+'">','Indicative market reference: '+money(c.priceUSD*fx(cur),cur)+'/kg')
  +F('cost','OTHER COST / ACRE / CYCLE','<input id="fCost" type="number" min="0" step="10" value="'+Math.round(f.costAc)+'">','Seed, labour, machinery, pest control (irrigation &amp; fertilizer are computed separately). Indicative: '+money(c.costUSD*fx(cur),cur))
  +F('cycles','CYCLES PER YEAR','<input id="fCycles" type="number" min="1" max="6" step="1" value="'+(f.cycles||c.cyclesPerYear)+'">',''+c.label+' matures in '+fmtDays(c.cycle)+' → about '+c.cyclesPerYear+' cycle(s)/year.')
  +'</div></div>'
  +'<div class="row">'
  +'<button class="btn primary big" type="submit" id="fSubmit">CREATE DIGITAL TWIN</button>'
  +'<button class="btn gold" type="button" onclick="loadDemoFarm()">⚡ Load Demo Farm (Green Valley)</button>'
  +'</div></form>'
  +'<div class="card" style="margin-top:22px"><h3>🧭 Crop comparison <span class="sub">what the model recommends for these field conditions</span></h3>'
  +'<p class="small muted" style="margin-bottom:12px">All 58 crops simulated at <b>their</b> recommended water and fertilizer on this farm, priced at indicative market rates in '+CUR[cur]+'. Ranked by annual net profit. Click a row or <b>Grow this</b> to select it.</p>'
  +sortBar(state.sortBy,'<button type="button" class="sbtn" onclick="refreshCreateTable()">🔄 Refresh with my entries</button>')
  +'<div id="createTable"></div>'
  +'<p class="small muted" style="margin-top:10px">Revenue = predicted annual yield × your price. Cost = other costs + water + fertilizer. Model estimates — replace indicative prices with your local market rates for decisions.</p></div>';
}
/* =====================================================================
   11. LAYER VIEW — DASHBOARD
   ===================================================================== */
function viewDashboard(){
  const f=state.farm, c=CROP[f.crop], m=computeModel(f), e=economics(f,m);
  const su=suitability(f), v=verdict(su.total), g=growthInfo(f), wp=waterPlan(f,m), pm=pestModule(f,m);
  const pn=pestNarrative(f,pm);
  const hc=m.health>=80?'good':m.health>=60?'warn':'bad';
  const wSt=waterStatus(m);
  const metric=(icon,label,big,small,tag)=>'<div class="metric"><span class="tag">'+(tag||'Simulation estimate')+'</span>'
    +'<div class="mi">'+icon+'</div><div class="ml">'+label+'</div>'+big
    +'<div class="ms">'+small+'</div></div>';
  const mets='<div class="metrics">'
    +metric('🌱','CROP HEALTH','<div class="big t-'+hc+'"><span data-count="'+m.health+'">0</span><small>/100</small></div>',m.health>=80?'Healthy':m.health>=60?'Moderate stress':'High stress')
    +metric('💧','WATER RANGE','<div class="big"><span data-count="'+m.range.lo+'">0</span>–<span data-count="'+m.range.hi+'">0</span><small> L/day</small></div>','<span class="badge '+wSt[0]+'">current: '+wSt[1]+'</span>')
    +metric('🧭','CROP SUITABILITY','<div class="big t-'+(v.tone==='good'?'good':v.tone==='warn'?'warn':'bad')+'"><span data-count="'+Math.round(su.total)+'">0</span><small>%</small></div>','<span class="badge '+v.tone+'">'+v.l+'</span> for '+c.label)
    +metric('🐛','PEST RISK','<div class="big t-'+(m.pest<25?'good':m.pest<45?'warn':'bad')+'"><span data-count="'+m.pest+'">0</span><small>%</small></div>',pm.level.l+' · pressure '+pm.score.toFixed(0)+'%')
    +metric('🌦️','WEATHER RISK','<div class="big t-'+(m.weatherRisk<25?'good':m.weatherRisk<45?'warn':'bad')+'"><span data-count="'+m.weatherRisk+'">0</span><small>%</small></div>',m.weatherRisk<25?'Low':m.weatherRisk<45?'Moderate':'High')
    +metric('📈','EXPECTED YIELD','<div class="big"><span data-count="'+m.yield+'">0</span><small> kg</small></div>',nf(c.baseYield)+' kg/ac potential · '+nf(e.yieldYear)+' kg/yr')
    +metric('💰','NET PROFIT / YEAR','<div class="big '+(e.profit>=0?'t-good':'t-bad')+'"><span data-count="'+Math.round(Math.abs(e.profit))+'">0</span><small> '+(e.profit<0?'‑':'')+CUR[f.currency].trim()+'</small></div>','margin '+e.margin.toFixed(0)+'% · ROI '+e.roi.toFixed(0)+'% · <span class="badge '+e.fv.tone+'">'+e.fv.l+'</span>')
    +'</div>';

  const curIdx=STAGE_ORDER.indexOf(f.stage);
  const stepper=STAGE_ORDER.map((k,i)=>'<div class="stg '+(i<curIdx?'done':i===curIdx?'cur':'')+'">'
    +STAGES[k].label.split(' ')[0].replace('/','')+'</div>').join('');

  const tasks=actionPlan(f,m,g);
  const taskHTML=tasks.map((t,i)=>'<label class="task '+(state.tasks[i]?'done':'')+'" id="task'+i+'">'
    +'<input type="checkbox" '+(state.tasks[i]?'checked':'')+' onchange="toggleTask('+i+')">'
    +'<span class="tt">'+t[0]+' '+t[1]+'</span></label>').join('');

  const stress=stressTest(f), wl=weatherLossSummary(f), hw=harvestWindow(f,su);
  const stressRows=stress.map(s=>'<tr class="'+(s.k==='normal'?'band':'')+'">'
    +'<td>'+s.label+'</td><td>'+nf(s.yield)+' kg</td>'
    +'<td>'+(s.dY===0?'<span class="delta g">baseline</span>':'<span class="delta '+(s.dY>0?'g':'b')+'">'+(s.dY>0?'+':'−')+nf(Math.abs(s.dY))+' kg</span>')+'</td>'
    +'<td class="'+(s.dP<0?'t-bad':'t-good')+'">'+(s.dP===0?'—':(s.dP<0?'−':'+')+money(Math.abs(s.dP)))+'</td>'
    +'<td class="'+(s.pest>32?'t-bad':s.pest>20?'t-warn':'t-good')+'">'+s.pest+'%</td></tr>').join('');

  const series=simulateGrowth(f,30);
  const a1=series.slice(0,5).reduce((s,d)=>s+d.health,0)/5;
  const a2=series.slice(-5).reduce((s,d)=>s+d.health,0)/5;
  const trend=a2-a1>1.5?['📈 Trend: improving ↗','t-good']:a2-a1<-1.5?['📉 Trend: declining ↘','t-bad']:['➡️ Trend: stable','t-good'];

  const maxV=Math.max(e.rev,e.waterCost,e.fertCost,e.other);
  const eb=(lbl,val,color)=>'<div class="ebar"><span>'+lbl+'</span><div class="track"><i style="width:'+clamp(val/maxV*100,0,100)+'%;background:'+color+'"></i></div><b>'+money(val)+'</b></div>';
  const costKg=e.yieldYear>0?e.cost/e.yieldYear:0;
  const scen=[['📉 Pessimistic −20%',0.8],['<b>Expected</b>',1],['📈 Optimistic +20%',1.2]]
    .map(s=>{const p=e.rev*s[1]-e.cost;return '<tr><td>'+s[0]+'</td><td>'+money(f.price*s[1])+'</td><td class="'+(p<0?'neg t-bad':'pos t-good')+'"><b>'+money(p)+'</b></td></tr>';}).join('');
  let saveBanner='';
  if(m.waterState==='high'){
    const l=(f.water-m.range.hi)*m.season, t=l*COST.water*fx(f.currency);
    saveBanner='<div class="banner ok">💧 <b>Savings opportunity:</b> moving irrigation into the recommended range could save ~<b>'+litres(l)+'</b> (≈ '+money(t)+') over the '+nf(m.season)+'-day cycle — model estimate.</div>';
  }

  const sysRows=wp.systems.map(s=>'<tr><td><b>'+s.name+'</b></td><td>'+Math.round(s.eff*100)+'%</td>'
    +'<td>'+nf(s.grossMm)+' mm</td><td>'+nf(s.grossL)+' L</td><td>'+nf(s.grossWk)+' L</td></tr>').join('');

  const facts=[['Temperature',f.temperature+'°C',c.temp[0]+'–'+c.temp[1]+'°C',su.temp],
    ['Humidity',f.humidity+'%',c.hum[0]+'–'+c.hum[1]+'%',su.hum],
    ['Water balance',m.mmPerDay.toFixed(2)+' mm/d',''+(su.eff).toFixed(2)+'× crop demand',su.water],
    ['Soil ('+f.soil+')','drain '+SOILS[f.soil].d,'crop fits '+c.dr[0]+'–'+c.dr[1],su.drain]];
  if(su.ph!=null)facts.push(['Soil pH',f.ph,c.pH[0]+'–'+c.pH[1],su.ph]);
  const factTable='<table class="tbl"><thead><tr><th>Factor</th><th>Your input</th><th>Ideal</th><th>Match</th></tr></thead><tbody>'
    +facts.map(r=>'<tr><td>'+r[0]+'</td><td>'+r[1]+'</td><td>'+r[2]+'</td>'
      +'<td style="min-width:130px"><div class="fbar" style="height:10px"><i style="width:'+clamp(r[3]*100,0,100)+'%;background:'+(r[3]>=.85?'var(--green)':r[3]>=.55?'var(--gold)':'var(--red)')+'"></i></div>'
      +'<span class="small">'+Math.round(r[3]*100)+'%</span></td></tr>').join('')+'</tbody></table>';

  const hist=loadHist().slice(0,4);
  return '<div class="pagehead"><h2 style="display:flex;align-items:center;flex-wrap:wrap">'+esc(f.name)
  +'<span class="status-pill"><span class="dot"></span>DIGITAL TWIN STATUS: ACTIVE</span></h2>'
  +'<div style="margin-top:9px">'
  +'<span class="kpill">'+c.icon+' '+c.label+'</span><span class="kpill">📐 '+f.area+' acre'+(f.area>1?'s':'')+'</span>'
  +'<span class="kpill">🪨 '+esc(f.soil)+'</span><span class="kpill">🌿 '+STAGES[f.stage].label+'</span>'
  +'<span class="kpill">🌡️ '+f.temperature+'°C · 💧'+f.humidity+'% · 🌧️'+f.rainfall+'mm</span>'
  +'<span class="kpill">💵 '+f.currency+'</span>'
  +'<span class="kpill">🧭 suitability '+badgeHTML(Math.round(su.total)+'% · '+v.l,v.tone)+'</span>'
  +'<button class="btn outline" style="padding:5px 12px;font-size:12px" onclick="nav(\'create\')">✏️ Edit</button>'
  +'<button class="btn outline" style="padding:5px 12px;font-size:12px" onclick="nav(\'advisor\')">🧭 Compare 58 crops</button>'
  +'</div></div>'
  +saveBanner+mets
  +'<div class="card" style="margin-bottom:18px"><h3>📅 Season timeline <span class="sub">'+(g.est?'no valid planting date — showing mid-season estimate':'computed from planting date '+esc(f.plantingDate))+'</span></h3>'
  +'<div class="tl-stats">'
  +'<div class="tl-stat"><b>Day <span data-count="'+g.day+'">0</span></b><span>OF '+nf(g.season)+'-DAY CYCLE</span></div>'
  +'<div class="tl-stat"><b><span data-count="'+g.toHarvest+'">0</span></b><span>DAYS TO HARVEST</span>'
  +'<div class="small muted" style="margin-top:4px">window ≈ '+fmtDays(hw.stressDays)+' (+'+hw.delay+' d stress delay)</div></div>'
  +'<div class="tl-stat"><b><span data-count="'+g.pct+'">0</span>%</b><span>OF SEASON COMPLETE</span></div>'
  +'<div class="tl-stat"><b>'+(f.cycles||c.cyclesPerYear)+'</b><span>CYCLES / YEAR</span></div>'
  +'<div class="tl-stat"><b>'+fmtDays(c.cycle)+'</b><span>TO MATURITY</span></div></div>'
  +'<div class="stagebar">'+stepper+'</div>'
  +'<div class="prog"><i style="width:'+g.pct+'%"></i></div>'
  +'<div class="prog-label"><span> planting </span><span> harvest </span></div>'
  +'<p class="small muted" style="margin-top:10px">Detected stage from this timeline: <b>'+STAGES[stageFromPct(g.pct)].label+'</b>'
  +(stageFromPct(g.pct)!==f.stage?' <span class="badge warn">selected stage is '+STAGES[f.stage].label+'</span> <button class="btn outline" style="padding:3px 9px;font-size:11px" onclick="syncStageToDate()">Use detected stage</button>':' <span class="badge good">matches your selection</span>')+'</p></div>'
  +'<div class="grid2">'
  +'<div class="card"><h3>🛰️ Digital farm <span class="sub">live model view</span></h3>'+farmGridHTML(f,m)+'</div>'
  +'<div><div class="card"><h3>💧 Irrigation recommendation <span class="sub">estimated optimal range</span></h3>'+gaugeHTML(m,f)+'</div>'
  +'<div class="card" style="margin-top:16px"><h3>🏆 Farm status</h3>'+factorBars([{icon:'💧',label:'Water',v:clamp(1-m.waterPen/55,0,1)},
    {icon:'🧪',label:'Fertilizer',v:clamp(1-m.fertPen/45,0,1)},{icon:'🌦️',label:'Weather safety',v:clamp(1-m.weatherRisk/100,0,1)},
    {icon:'🐛',label:'Pest safety',v:clamp(1-m.pest/100,0,1)},{icon:'🌱',label:'Crop health',v:m.health/100}])+'</div>'
  +'</div></div>'
  +'<div class="grid2" style="margin-top:18px">'
  +'<div class="card"><h3>✅ Today\'s action plan <span class="sub">'+tasks.length+' task'+(tasks.length>1?'s':'')+' · resets daily</span></h3>'
  +taskHTML+'<p class="small muted" style="margin-top:6px">Generated from your farm\'s live model state. Check items off as you complete them — they are saved for today.</p></div>'
  +'<div class="card"><h3>🛡️ Weather stress test <span class="sub">8 scenarios · if the weather turns</span></h3>'
  +'<div class="banner '+(wl.avg<8?'ok':'warn')+'" style="margin-bottom:10px">🌦️ <b>Average yield loss across '+wl.count+' adverse scenarios: '+wl.avg.toFixed(1)+'%</b> '
  +'<span class="badge '+wl.level.tone+'">'+wl.level.l+'</span><br><span class="small">Worst case: '+wl.worst.label+' — '+wl.worst.drop.toFixed(0)+'% of this season\'s yield at risk.</span></div>'
  +'<div style="overflow:auto"><table class="tbl"><thead><tr><th>Scenario</th><th>Yield</th><th>Change</th><th>Profit Δ / yr</th><th>Pest risk</th></tr></thead>'
  +'<tbody>'+stressRows+'</tbody></table></div>'
  +'<p class="small muted" style="margin-top:10px">Each scenario re-runs the full model with adjusted conditions. Test them interactively in the Simulator layer.</p></div></div>'
  +'<div class="grid2" style="margin-top:18px">'
  +'<div class="card"><h3>🐛 Pest &amp; disease module <span class="sub">pathogen guilds · '+pm.level.l+'</span></h3>'
  +guildBars(pm)
  +'<h4 style="margin:14px 0 8px;font-size:13.5px">Likely threats to watch</h4><div class="chips">'
  +pm.species.map(s=>'<span class="kpill">🐛 '+esc(s)+'</span>').join('')+'</div>'
  +'<div class="warnbox">💰 Untreated loss exposure ≈ <b>'+(pm.lossPct).toFixed(0)+'%</b> of revenue ≈ <b>'+money(e.rev*pm.lossPct/100)+'</b> per year. Good IPM typically recovers most of it.</div>'
  +'<h4 style="margin:14px 0 6px;font-size:13.5px">Why the model flagged this</h4>'
  +'<ul class="tips" style="list-style:none;display:flex;flex-direction:column;gap:7px">'+pn.risks.map(r=>'<li class="small">• '+r+'</li>').join('')+'</ul>'
  +'<h4 style="margin:14px 0 6px;font-size:13.5px">Management plan</h4>'
  +'<ul class="tips" style="list-style:none;display:flex;flex-direction:column;gap:7px">'+pn.tips.map(t=>'<li class="small">• '+t+'</li>').join('')+'</ul></div>'
  +'<div class="card"><h3>📈 30-day forecast <span class="sub">health &amp; soil moisture</span></h3>'
  +'<div class="legendrow"><span><i style="background:#4CAF50"></i>Crop health</span><span><i style="background:#7DB7D9"></i>Soil moisture %</span></div>'
  +'<div class="chartbox">'+lineChart([{name:'Health',color:'#4CAF50',data:series.map(d=>d.health)},
    {name:'Moisture',color:'#7DB7D9',data:series.map(d=>d.moisture)}],{ymin:0,ymax:100,xTick:i=>'Day '+(i+1)})+'</div>'
  +'<p class="small" style="margin-top:10px"><b class="'+trend[1]+'">'+trend[0]+'</b> <span class="muted">— projected health over the next 30 days under current conditions (model estimate).</span></p>'
  +'<h4 style="margin:16px 0 6px;font-size:13.5px">🌱 Suitability factors for '+c.label+'</h4>'+factTable+'</div></div>'
  +'<div class="grid2" style="margin-top:18px">'
  +'<div class="card"><h3>💹 Season economics <span class="sub">'+nf(m.season)+'-day cycle · '+e.cpc+' cycle(s)/year</span></h3>'
  +eb('📈 Revenue / yr',e.rev,'#4CAF50')+eb('💧 Water cost',e.waterCost,'#7DB7D9')+eb('🧪 Fertilizer cost',e.fertCost,'#D9A441')+eb('🧾 Other costs',e.other,'#8E6BB8')
  +'<div class="estat"><span><b>Net profit / year</b></span><b class="'+(e.profit>=0?'t-good':'t-bad')+'">'+money(e.profit)+'</b></div>'
  +'<div class="estat"><span>Margin · ROI</span><b>'+e.margin.toFixed(0)+'% · '+e.roi.toFixed(0)+'%</b></div>'
  +'<div class="estat"><span>Production cost</span><b>'+money(costKg)+' / kg</b></div>'
  +'<div class="estat"><span>Break-even price</span><b>'+money(e.bePrice)+' / kg <span class="small muted">(you '+money(f.price)+')</span></b></div>'
  +'<div class="estat"><span>Break-even yield</span><b>'+nf(e.beYieldPerAcre)+' kg/acre <span class="small muted">(you '+nf(m.yield/f.area)+')</span></b></div>'
  +'<h4 style="margin:16px 0 4px;font-size:13.5px">Price scenarios</h4>'
  +'<table class="tbl"><thead><tr><th>Scenario</th><th>Price / kg</th><th>Profit / yr</th></tr></thead><tbody>'+scen+'</tbody></table></div>'
  +'<div class="card"><h3>🚰 Water plan <span class="sub">mm, litres and system sizing</span></h3>'
  +'<div class="estat"><span>Net irrigation requirement</span><b>'+nf(m.needMmCycle)+' mm/cycle</b></div>'
  +'<div class="estat"><span>You apply</span><b>'+nf(m.irrigationMmCycle)+' mm/cycle (≈'+m.mmPerDay.toFixed(2)+' mm/day)</b></div>'
  +'<div class="estat"><span>Rain credited this cycle</span><b>'+nf(m.rainCreditMmCycle)+' mm</b></div>'
  +'<div class="estat"><span>Crop water use (ETc)</span><b>'+nf(wp.etcMmCycle)+' mm/cycle</b></div>'
  +'<div class="estat"><span>Water use efficiency</span><b>'+wp.wue.toFixed(2)+' kg yield per m³</b></div>'
  +'<div class="estat"><span>Crop rainfall preference ('+c.label+')</span><b>'+wp.bandMm.lo+'–'+wp.bandMm.hi+' mm/yr · site ≈'+nf(wp.annualRainMm)+' mm/yr</b></div>'
  +'<div style="margin:12px 0 6px"><span class="badge '+wp.status.tone+'">'+wp.status.l+'</span> <span class="badge">'+CUR[f.currency].trim()+' '+(COST.water*fx(f.currency)).toFixed(3)+' per litre pumped</span></div>'
  +'<table class="tbl"><thead><tr><th>System</th><th>Efficiency</th><th>Gross mm</th><th>Litres/cycle</th><th>Litres/week</th></tr></thead>'
  +'<tbody>'+sysRows+'</tbody></table>'
  +'<p class="small muted" style="margin-top:10px">1 mm over 1 acre = 4,047 litres. Drip needs the least pumped water but the most capital; furrow is cheap and wasteful.</p></div></div>'
  +'<div class="grid2" style="margin-top:18px">'
  +'<div class="card"><h3>🕘 Recent simulations <span class="sub">stored history</span></h3>'
  +(hist.length?'<table class="tbl"><thead><tr><th>Date</th><th>Type</th><th>Water</th><th>Yield</th><th>Risk</th></tr></thead><tbody>'
    +hist.map(h=>'<tr><td>'+dateStr(h.ts)+'</td><td>'+esc(h.type)+(h.legacy?' <span class="badge warn">old scale</span>':'')+'</td><td>'+nf(h.water)+' L</td><td class="simcol">'+nf(h.yield)+' kg</td><td>'+h.risk+'%</td></tr>').join('')
    +'</tbody></table>':'<p class="muted small">No simulations yet — try the Simulator or Optimizer layers.</p>')+'</div>'
  +'<div class="card"><h3>🧰 Data &amp; actions</h3>'
  +'<p class="small muted" style="margin-bottom:12px">Export, print or reset — your data lives in this browser (and on your server when connected).</p>'
  +'<div class="row no-print">'
  +'<button class="btn outline" onclick="exportFarm()">⬇️ Export farm data (JSON)</button>'
  +'<button class="btn outline" onclick="window.print()">🖨️ Print report</button>'
  +'<button class="btn outline" onclick="nav(\'method\')">🧠 Methodology</button>'
  +'<button class="btn outline danger" onclick="clearData()">🗑️ Clear saved data</button></div></div></div>'
  +'<div class="row gap no-print">'
  +'<button class="btn primary" onclick="nav(\'simulator\')">🔮 Next layer: Simulator →</button>'
  +'<button class="btn gold" onclick="nav(\'optimizer\')">⚙️ Jump to Optimizer</button>'
  +'<button class="btn outline" onclick="nav(\'advisor\')">🧭 Crop Advisor</button></div>';
}

/* =====================================================================
   12. LAYER VIEW — WHAT-IF SIMULATOR
   ===================================================================== */
function viewSimulator(){
  const f=state.farm, base=computeModel(f), s=state.sim;
  const wMin=Math.max(1,Math.round(base.need*0.3)), wMax=Math.max(Math.round(base.need*2.3),s.water+20);
  const wStep=niceStep((wMax-wMin)/60);
  const fMax=Math.max(10,Math.ceil(base.fertOpt*2));
  return '<div class="pagehead"><h2>🔮 What-If Simulator</h2>'
  +'<p>Test a farming decision before applying it to your real crop. Every slider re-runs the digital twin live, and applied simulations are logged to the server. Weather scenario buttons override rainfall, temperature and humidity together — exactly like a real forecast change.</p></div>'
  +'<div class="grid2 simgrid">'
  +'<div class="card"><h3>🎛️ Simulation controls</h3>'
  +'<div class="srow"><div class="shead"><span class="sname">🚿 Irrigation</span><span class="sval" id="vWater">'+nf(s.water)+' L/day</span></div>'
  +'<input type="range" id="sWater" min="'+wMin+'" max="'+wMax+'" step="'+wStep+'" value="'+s.water+'" oninput="onSimChange()">'
  +'<div class="shint">Estimated optimal: <b>'+nf(base.range.lo)+'–'+nf(base.range.hi)+' L/day</b> · now ≈ '+(l2mm(s.water,f.area)).toFixed(2)+' mm/day</div></div>'
  +'<div class="srow"><div class="shead"><span class="sname">🧪 Fertilizer</span><span class="sval" id="vFert">'+nf(s.fertilizer,1)+' kg/wk</span></div>'
  +'<input type="range" id="sFert" min="0.5" max="'+fMax+'" step="0.1" value="'+s.fertilizer+'" oninput="onSimChange()">'
  +'<div class="shint">Estimated optimal: <b>'+nf(base.fertRange.lo,1)+'–'+nf(base.fertRange.hi,1)+' kg/wk</b></div></div>'
  +'<div class="srow"><div class="shead"><span class="sname">🌧️ Rainfall (7-day)</span><span class="sval" id="vRain">'+s.rainfall+' mm</span></div>'
  +'<input type="range" id="sRain" min="0" max="150" step="1" value="'+s.rainfall+'" oninput="onSimChange()"></div>'
  +'<div class="srow"><div class="shead"><span class="sname">🌡️ Temperature</span><span class="sval" id="vTemp">'+s.temperature+'°C</span></div>'
  +'<input type="range" id="sTemp" min="6" max="45" step="0.5" value="'+s.temperature+'" oninput="onSimChange()"></div>'
  +'<div class="srow"><div class="shead"><span class="sname">💧 Humidity</span><span class="sval" id="vHum">'+s.humidity+'%</span></div>'
  +'<input type="range" id="sHum" min="20" max="100" step="1" value="'+s.humidity+'" oninput="onSimChange()"></div>'
  +'<h3 style="margin-top:16px">🌦️ Weather scenario</h3>'
  +'<div class="weather-btns">'+Object.keys(WEATHER).map(k=>'<button class="wbtn '+(state.weather===k?'active':'')+'" onclick="setWeather(\''+k+'\')">'+WEATHER[k].label+'</button>').join('')+'</div>'
  +'<div id="weatherNote" style="margin-top:11px"></div></div>'
  +'<div><div id="simResults"></div></div></div>';
}

/* =====================================================================
   13. LAYER VIEW — OPTIMIZER
   ===================================================================== */
function viewOptimizer(){
  const f=state.farm;
  if(state.phase==='analyzing'){
    const steps=['Testing irrigation strategies','Testing fertilizer strategies','Analyzing weather scenarios',
      'Estimating crop response','Comparing resource efficiency','Calculating risk'];
    return '<div class="pagehead"><h2>Farm Optimizer</h2><p>AgriTwin is testing combinations of resources through the digital twin.</p></div>'
    +'<div class="card opt-anim" style="padding:40px 24px"><h3><span class="spin"></span>ANALYZING FARM…</h3>'
    +'<ul class="opt-steps">'+steps.map((s,i)=>'<li class="opt-step" id="optStep'+i+'"><span class="tick">✓</span>'+s+'</li>').join('')+'</ul>'
    +'<div class="opt-bar-wrap"><div class="opt-bar" id="optBar"></div></div></div>';
  }
  const r=state.optRun;
  if(!r)return '<div class="pagehead"><h2>Farm Optimizer</h2>'
  +'<p>AgriTwin searches a water × fertilizer grid through the farm model and ranks every strategy with a documented score: predicted revenue − water cost − fertilizer cost − risk penalty.</p></div>'
  +'<div class="card" style="text-align:center;padding:48px 22px"><div style="font-size:42px;margin-bottom:12px">⚙️</div>'
  +'<h3 style="justify-content:center">Ready to search ~250 strategies?</h3>'
  +'<p class="muted small" style="margin:10px 0 20px">For '+CROP[f.crop].icon+' '+CROP[f.crop].label+' on '+f.area+' acre(s) the model will sweep roughly 22 irrigation levels × 11 fertilizer rates — each one evaluated for yield, health, pest risk and cost.</p>'
  +'<button class="btn primary big" onclick="runOptimizer()">⚙️ OPTIMIZE MY FARM</button>'
  +'<p class="small muted" style="margin-top:14px">Tip: if the optimizer keeps pushing one input to its limit, the crop itself may be a poor fit — check the <a href="#/advisor">Crop Advisor</a> layer.</p></div>';
  const wEff=Math.round((f.water-r.best.w)/f.water*100);
  const fEff=Math.round((f.fertilizer-r.best.ft)/Math.max(0.1,f.fertilizer)*100);
  const yChg=r.best.yield-r.base.yield;
  const riskRed=Math.round((r.base.pest-r.best.pest)/Math.max(1,r.base.pest)*100);
  const bestIdx=r.curve.findIndex(p=>p.w===r.best.w);
  const rows=r.rows.map((x,i)=>'<tr class="'+(i===0?'best':'')+'">'
    +'<td>'+(i===0?'🏆 ':'')+nf(x.w)+' L/day</td><td>'+nf(x.ft,1)+' kg/wk</td><td>'+nf(x.yield)+' kg</td>'
    +'<td>'+x.health+'</td><td>'+x.pest+'%</td><td>'+stars(x.eff)+'</td><td>'+money(x.score)+'</td></tr>').join('');
  return '<div class="pagehead"><h2>🏆 Optimal Strategy</h2>'
  +'<p>Grid search complete — '+(r.combos||r.rows.length)+' strategies evaluated, top results ranked by predicted season score. All values are model estimates.</p></div>'
  +'<div class="card" style="border-color:#BFE0C3;margin-bottom:18px"><div class="metrics">'
  +'<div class="metric"><div class="mi">💧</div><div class="ml">WATER</div><div class="big">'+nf(r.best.w)+' L/day</div><div class="ms">'+(wEff>0?'~'+wEff+'% less than current':'current is already lean')+'</div></div>'
  +'<div class="metric"><div class="mi">🧪</div><div class="ml">FERTILIZER</div><div class="big">'+nf(r.best.ft,1)+' kg/wk</div><div class="ms">'+(fEff>0?'~'+fEff+'% less than current':'matches current')+'</div></div>'
  +'<div class="metric"><div class="mi">📈</div><div class="ml">PREDICTED YIELD</div><div class="big">'+nf(r.best.yield)+' kg</div><div class="ms">'+(yChg>=0?'+':'')+nf(yChg)+' kg vs current</div></div>'
  +'<div class="metric"><div class="mi">⚠️</div><div class="ml">ESTIMATED RISK</div><div class="big t-'+(r.best.pest<25?'good':r.best.pest<45?'warn':'bad')+'">'+r.best.pest+'%</div><div class="ms">'+(riskRed>0?'~'+riskRed+'% lower than current':'similar to current')+'</div></div>'
  +'<div class="metric"><div class="mi">⚡</div><div class="ml">WATER SAVING</div><div class="big t-good">'+(wEff>0?'+':'')+wEff+'%</div><div class="ms">vs current usage</div></div>'
  +'<div class="metric"><div class="mi">🌱</div><div class="ml">FERTILIZER SAVING</div><div class="big t-good">'+(fEff>0?'+':'')+fEff+'%</div><div class="ms">vs current usage</div></div>'
  +'</div><div class="banner ok">🧠 <b>Why this strategy?</b> Beyond about '+nf(r.best.w)+' L/day the yield curve flattens (diminishing returns), so extra water mainly adds cost and risk. Score = <code>revenue − water cost − fertilizer cost − risk penalty</code>, all in '+f.currency+'.</div>'
  +'<div class="row no-print"><button class="btn primary" onclick="applyOptimal()">✅ Apply this strategy to my farm</button>'
  +'<button class="btn outline" onclick="runOptimizer()">🔁 Re-run</button>'
  +'<button class="btn outline" onclick="nav(\'advisor\')">🧭 Compare other crops</button></div></div>'
  +'<div class="grid2">'
  +'<div class="card"><h3>📈 Yield vs water <span class="sub">at '+nf(r.best.ft,1)+' kg/wk</span></h3>'
  +'<div class="chartbox">'+lineChart([{name:'Yield',color:'#4CAF50',data:r.curve.map(p=>p.y)}],
    {xTick:i=>(Math.abs(r.curve[i].w)>=1000?Math.round(r.curve[i].w/1000)+'k':r.curve[i].w)+'L',markers:bestIdx>=0?[{i:bestIdx,label:'★ '+nf(r.best.w)+' L'}]:[]})+'</div></div>'
  +'<div class="card"><h3>📋 Top strategies</h3>'
  +'<table class="tbl"><thead><tr><th>Water</th><th>Fert</th><th>Yield</th><th>Health</th><th>Risk</th><th>Eff</th><th>Score</th></tr></thead>'
  +'<tbody>'+rows+'</tbody></table>'
  +'<p class="small muted" style="margin-top:10px">The optimum deliberately trades a little maximum yield for large input savings and lower risk — balance, not maximum output.</p></div></div>';
}

