/* =====================================================================
   engine.js — THE MODEL (pure calculations, no DOM, no app state)
   ---------------------------------------------------------------------
   Owns: units and cost constants, the water balance, health/yield,
   fuzzy suitability, the pest-guild index, the water plan, economics,
   the season timeline, crop ranking, the optimizer grid search, and the
   previous build's constants (used only to migrate old saved farms).
   Depends on: crops.js for data, read at call time — load engine first.
   Returns numbers and plain labels. Never returns markup, never reads
   the DOM, never writes state: every function here is testable alone.

     units/costs  →  computeModel  →  suitability / waterPlan / pestModule
                                   →  economics  →  ranking / optimizer
   ===================================================================== */

/* ---- units, currency rates and input costs (single source) ---- */
const ACP=0.404686;      // hectares per acre
const CALIB=4047;        // litres of water per 1 mm over 1 acre
const FX={USD:1,BDT:120,EUR:.92,GBP:.79,INR:83,NGN:1500,KES:130,ZAR:18.5,PHP:58,BRL:5,CNY:7.2}; // per 1 USD
const COST={water:0.01/120,fert:90/120};   // USD per litre pumped (≈৳0.01/L) · USD per kg of fertilizer (≈৳90/kg)
function fx(cur){return FX[cur]||1;}
function mm2L(mm,area){return mm*CALIB*area;}
function l2mm(L,area){return L/(CALIB*area);}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function niceStep(x){
  const p=Math.pow(10,Math.floor(Math.log10(Math.max(1e-9,x))));const n=x/p;
  return Math.max(1,Math.round((n<=1?1:n<=2?2:n<=5?5:10)*p));
}

/* =====================================================================
   6. THE UNIFIED PREDICTION ENGINE
   ===================================================================== */
function band(v,tolLo,optLo,optHi,tolHi){
  const e=1e-6;
  if(v>=optLo&&v<=optHi)return 1;
  if(v<optLo){
    if(v<tolLo)return Math.max(0,.5-.5*(tolLo-v)/Math.max(e,optLo-tolLo));
    return .5+.5*(v-tolLo)/Math.max(e,optLo-tolLo);
  }
  if(v>tolHi)return Math.max(0,.5-.5*(v-tolHi)/Math.max(e,tolHi-optHi));
  return .5+.5*(tolHi-v)/Math.max(e,tolHi-optHi);
}
function verdict(s){
  return s>=85?{l:'Excellent',c:'#15803d',tone:'good'}:s>=70?{l:'Good',c:'#65a30d',tone:'good'}:
    s>=55?{l:'Fair',c:'#ca8a04',tone:'warn'}:s>=40?{l:'Poor',c:'#ea580c',tone:'bad'}:
    {l:'Not viable',c:'#dc2626',tone:'bad'};
}

/* --- 6.1 the digital-twin core: water balance → stress → health → yield */
function computeModel(f){
  const c=CROP[f.crop], s=SOILS[f.soil], st=STAGES[f.stage];
  const eto=1.8+0.11*f.temperature;                     // mm/day reference evaporation
  const etc=eto*c.kc[f.stage];                          // mm/day crop water use
  const rainEff=s.rainEff*Math.pow(Math.max(f.rainfall,0)/7,0.75);   // mm/day usable rain
  const net=Math.max(0.2,etc-rainEff);                  // mm/day net irrigation requirement
  const need=Math.max(1,net*CALIB*f.area*s.drainFlow);  // litres/day for the whole farm
  const wr=f.water/need;
  const dev=wr-1;
  const inBand=Math.abs(dev)<=0.01;              // 1% dead-band: no penalty, label stays "in range"
  const penDev=inBand?0:dev;                     // pow() of a negative base would return NaN
  let waterPen,waterState;
  if(penDev<0){ waterPen=Math.pow(-penDev,1.7)*55*c.waterSens*st.waterSens; waterState=wr<0.82?'bad':'low'; }
  else    { waterPen=Math.pow(penDev,1.6)*60*s.excessPen*c.excessTol*c.waterSens*st.waterSens; waterState=inBand?'ok':(wr>1.15?'high':'ok'); }
  const fertOpt=Math.max(0.4,c.fertBase*st.fertFactor*f.area);
  const fr=f.fertilizer/fertOpt;
  const fertDev=Math.abs(fr-1)<=0.01?0:fr-1;      // same dead-band, same NaN guard
  const fertPen=fertDev<0?Math.pow(-fertDev,1.8)*45*c.fertSens:Math.pow(fertDev,1.7)*30*c.fertSens;
  const tl=c.temp[0], th=c.temp[1];
  let tpen=0;
  if(f.temperature>th)tpen=(f.temperature-th)*2.6; else if(f.temperature<tl)tpen=(tl-f.temperature)*2.0;
  let hpen=0;
  if(f.humidity>85)hpen=(f.humidity-85)*0.5; else if(f.humidity<40)hpen=(40-f.humidity)*0.45;
  const pestBase=5+Math.max(0,f.humidity-65)*0.5+Math.max(0,f.temperature-28)*0.6+st.canopy*2.5+(f.rainfall>80?5:0);
  const pest=clamp(pestBase+Math.max(0,wr-1.12)*35,3,95);
  const health=clamp(100-waterPen-fertPen-tpen-hpen-pest*0.18,5,99);
  const yld=c.baseYield*f.area*Math.pow(health/100,1.6);
  const pestRef=clamp(pestBase,3,95);
  const refHealth=clamp(100-fertPen-tpen-hpen-pestRef*0.18,5,99);
  const refYield=c.baseYield*f.area*Math.pow(refHealth/100,1.6);
  const eff=clamp(Math.round((yld/Math.max(1,f.water))/(refYield/need)*100),1,100);
  const weatherRisk=clamp(6+Math.max(0,f.temperature-(th-3))*2.2+Math.max(0,f.humidity-68)*0.5+Math.max(0,f.rainfall-25)*0.18+(f.stage==='flowering'?4:0),2,95);
  const bal=f.water/(CALIB*f.area)+rainEff-etc;          // mm/day surplus (+) or deficit (−)
  const moisture=clamp(55+bal*15*s.moistSwing,3,100);
  const season=c.season, cycles=f.cycles||c.cyclesPerYear;
  return {
    health:Math.round(health), yield:Math.round(yld), need:Math.round(need),
    range:{lo:Math.round(need*0.95),hi:Math.round(need*1.07)},
    waterPen,fertPen,tpen,hpen,wr,waterState,moisture:Math.round(moisture),
    pest:Math.round(pest),weatherRisk:Math.round(weatherRisk),eff,eto,etc,rainEff,net,
    fertOpt:Math.round(fertOpt*10)/10,
    fertRange:{lo:Math.round(fertOpt*0.9*10)/10,hi:Math.round(fertOpt*1.1*10)/10},
    season,cycles,
    mmPerDay:l2mm(f.water,f.area),                        // applied depth mm/day
    needMmDay:net*s.drainFlow,
    needMmCycle:net*season*s.drainFlow,
    irrigationMmCycle:l2mm(f.water*season,f.area),
    rainCreditMmCycle:rainEff*season
  };
}

/* --- 6.2 fuzzy suitability: is this crop right for this site? --------- */
function suitability(f){
  const c=CROP[f.crop], m=computeModel(f), s=SOILS[f.soil];
  const eff=(l2mm(f.water,f.area)+m.rainEff)/Math.max(0.2,m.etc);   // net supply ÷ crop demand
  const fac={};
  fac.temp=band(f.temperature,c.temp[0]-7,c.temp[0],c.temp[1],c.temp[1]+7);
  fac.hum=band(f.humidity,clamp(c.hum[0]-15,0,100),c.hum[0],c.hum[1],clamp(c.hum[1]+15,0,100));
  fac.water=band(eff,.60,.90,1.12,1.40);
  const drain=band(s.d,clamp(c.dr[0]-.15,0,1),c.dr[0],c.dr[1],clamp(c.dr[1]+.15,0,1));
  let suPH=null;
  if(f.ph!=null&&f.ph!==''){ fac.ph=band(+f.ph,c.pH[0]-.7,c.pH[0],c.pH[1],c.pH[1]+.7); fac.soil=.65*drain+.35*fac.ph; suPH=fac.ph; }
  else{ fac.ph=null; fac.soil=drain; }
  const weighted=.30*fac.temp+.25*fac.water+.25*fac.soil+.20*fac.hum;
  const worst=Math.min(fac.temp,fac.hum,fac.water,fac.soil,suPH!=null?suPH:1);
  // a single badly mismatched factor must drag the score down, not be averaged away
  fac.total=Math.max(0,100*(weighted-Math.max(0,.55-worst)*.45));
  fac.drain=drain; fac.eff=eff; fac.worst=worst;
  fac.siteYield=c.baseYield*f.area*Math.pow(fac.total/100,1.7);
  return fac;
}
function vigor(fac){
  const est=.5*fac.soil+.3*fac.water+.2*fac.temp;
  const veg=(fac.temp+fac.water+fac.soil+fac.hum)/4;
  const flo=.40*fac.temp+.30*fac.water+.20*fac.hum+.10*fac.soil;
  return [{n:'Establishment (rooting)',s:est*100},{n:'Vegetative (leaf & stem)',s:veg*100},
          {n:'Flowering / yield filling',s:flo*100}];
}

/* --- 6.3 water plan in mm and litres + irrigation system sizing ------- */
function waterPlan(f,m){
  const c=CROP[f.crop], area=f.area, cycles=f.cycles||c.cyclesPerYear;
  const netMmCycle=m.needMmCycle;                        // net irrigation requirement
  const appliedMmCycle=m.irrigationMmCycle;
  const etcMmCycle=m.etc*m.season;                       // total crop water use
  const weeks=Math.max(1,m.season/7);
  const systems=[['Drip',.92],['Sprinkler',.75],['Furrow / Flood',.55]].map(sz=>{
    const gross=netMmCycle/sz[1];                     // pumped water to deliver the net requirement
    return {name:sz[0],eff:sz[1],grossMm:gross,grossL:mm2L(gross,area),grossWk:mm2L(gross,area)/weeks};
  });
  const status=m.waterState==='ok'?{l:'WITHIN EFFICIENT RANGE',tone:'good'}
    :m.waterState==='high'?{l:'SURPLUS — cut back or drain',tone:'warn'}
    :m.waterState==='low'?{l:'SLIGHT DEFICIT — top up irrigation',tone:'warn'}
    :{l:'DEFICIT — irrigation required',tone:'bad'};
  // the crop database's rain band is an annual rainfall preference, so compare it at that scale
  const annualRainMm=f.rainfall*52;
  const annualSupplyMm=appliedMmCycle*cycles+annualRainMm;
  const rainMatch=band(annualRainMm,c.rain[0]*.65,c.rain[0],c.rain[1],c.rain[1]*1.5);
  return {netMmCycle,appliedMmCycle,etcMmCycle,cycles,weeks,systems,status,
    bandMm:{lo:c.rain[0],hi:c.rain[1]},annualRainMm,annualSupplyMm,rainMatch,
    wue:m.season>0&&f.water>0?(m.yield/(f.water*m.season/1000)):0};
}

/* --- 6.4 pathogen-guild pest & disease model ------------------------- */
const PEST_SPECIES={
 "Rice":["Rice blast","Stem borer","Brown planthopper","Sheath blight"],
 "Wheat":["Wheat rust","Aphids","Fusarium head blight"],
 "Maize (Corn)":["Fall armyworm","Corn borer","Grey leaf spot"],
 "Cotton":["Bollworm","Whitefly","Fusarium wilt","Jassids"],
 "Tomatoes":["Late blight","Whitefly","Leaf miner"],
 "Potatoes":["Late blight","Tuber moth","Aphids"],
 "Cassava":["Mosaic virus","Mealybug","Green mite"],
 "Coffee (Arabica)":["Coffee berry borer","Leaf rust","Antestia bug"],
 "Cocoa":["Black pod disease","Mirids (capsids)","Pod borer"],
 "Bananas":["Black Sigatoka","Weevils","Panama disease"],
 "Grapes":["Powdery mildew","Downy mildew","Grapevine moth"],
 "Cucumbers":["Downy mildew","Whitefly","Mosaic virus"],
 "Sugarcane":["Stem borer","Smut","Scale insects"]
};
const PEST_BY_CAT={
 "Cereal":["Stem borers","Aphids","Rust diseases","Armyworms"],
 "Legume":["Aphids","Pod borers","Powdery mildew","Bean fly"],
 "Root & Tuber":["Aphids","Leaf blight","Nematodes","Tuber moths"],
 "Oil & Fiber":["Bollworms","Aphids","Whiteflies","Leaf miners"],
 "Fruit":["Fruit flies","Mealybugs","Powdery mildew","Anthracnose"],
 "Vegetable":["Whiteflies","Aphids","Downy mildew","Leaf miners"],
 "Beverage & Spice":["Berry borers","Rust diseases","Thrips","Capsids"],
 "Forage":["Aphids","Leaf spots","Armyworms"]
};
function pestModule(f,m){
  const c=CROP[f.crop], s=SOILS[f.soil], T=f.temperature, H=f.humidity;
  m=m||computeModel(f);
  const seasonMm=m.irrigationMmCycle;
  const annualMm=seasonMm*(f.cycles||c.cyclesPerYear)+f.rainfall*52*s.rainEff;
  const fungal=clamp((H-70)/20,0,1)*clamp((T-12)/18,0,1);
  const insect=clamp((T-21)/11,0,1)*clamp((H-45)/35,0,1);
  const mites=clamp((T-26)/8,0,1)*clamp((45-H)/20,0,1);
  let rot=clamp((annualMm-c.rain[1]*1.15)/Math.max(50,c.rain[1]*.5),0,1);
  if(s.d<c.dr[0])rot=clamp(rot+clamp((c.dr[0]-s.d)/.3,0,1)*.6,0,1);
  const score=clamp(.40*fungal+.35*insect+.10*mites+.15*rot,0,1)*100;
  const level=score<25?{l:'LOW RISK 🟢',tone:'good'}:score<45?{l:'MODERATE RISK 🟡',tone:'warn'}:
    score<65?{l:'HIGH RISK 🟠',tone:'bad'}:{l:'SEVERE RISK 🔴',tone:'bad'};
  const guilds=[
    ['🍄 Fungal / bacterial pressure',fungal,'humidity + mild temperature (blights, mildews, rusts)'],
    ['🐛 Sucking & chewing insects',insect,'warm humid air (aphids, whitefly, borers)'],
    ['🕷️ Spider mites',mites,'hot dry air'],
    ['🌊 Root rot / damping off',rot,'excess water and poor drainage']
  ];
  /* the guilds are numbers plus their driver; the farmer-facing wording is
     composed in ui.js (pestNarrative) so the model stays prose-free. */
  return {score,level,guilds,annualMm,
    species:PEST_SPECIES[c.label]||PEST_BY_CAT[c.cat]||['Aphids','Whiteflies','Powdery mildew'],
    lossPct:score*.30};
}

/* --- 6.4b yield range under pests, harvest timing under stress ------- */
function pestYieldRange(f,m,pm){
  const c=CROP[f.crop];
  const cur=m.yield/Math.max(0.001,f.area);          // kg/acre predicted now
  const ceiling=Math.max(c.baseYield,cur);           // best attainable on this field
  const loss=pm.lossPct;                             // % of revenue exposed to pests
  const worst=Math.max(0,cur*(1-loss/100));          // no control
  const withIpm=Math.max(0,cur*(1-loss*0.4/100));    // IPM recovers ~60% of the loss
  const pct=v=>ceiling>0?clamp(v/ceiling*100,0,100):0;
  return {pot:c.baseYield,cur,ceiling,loss,worst,withIpm,
    worstPct:pct(worst),ipmPct:pct(withIpm),curPct:pct(cur)};
}
function harvestWindow(f,su){
  const c=CROP[f.crop];
  const stressDays=Math.max(c.cycle,Math.round(c.cycle*(1+0.3*(1-su.total/100))));
  let date=null;
  if(f.plantingDate){
    const p=new Date(f.plantingDate+'T00:00:00');
    if(!isNaN(p))date=new Date(p.getTime()+stressDays*864e5)
      .toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
  }
  return {base:c.cycle,stressDays,delay:stressDays-c.cycle,date};
}
/* one headline figure for how the farm behaves if the weather turns, the way
   the agronomy build reported it: mean yield drop across the adverse scenarios */
function weatherLossSummary(f){
  const rows=stressTest(f);
  const normal=rows.filter(r=>r.k==='normal')[0];
  const base=normal?normal.yield:0;
  const adv=rows.filter(r=>r.k!=='normal')
    .map(r=>({k:r.k,label:r.label,drop:base>0?(base-r.yield)/base*100:0}))
    .sort((a,b)=>b.drop-a.drop);
  const down=adv.filter(r=>r.drop>0);
  const avg=down.length?down.reduce((s,r)=>s+r.drop,0)/down.length:0;
  const level=avg<8?{l:'LOW RISK',tone:'good'}:avg<18?{l:'MODERATE RISK',tone:'warn'}
    :avg<32?{l:'HIGH RISK',tone:'bad'}:{l:'SEVERE RISK',tone:'bad'};
  return {avg,level,worst:adv[0],count:adv.length,rows:adv};
}

/* --- 6.5 economics: revenue, input costs, ROI, break-even ------------ */
function economics(f,m,cur){
  const c=CROP[f.crop];
  cur=cur||f.currency||'BDT';   // engine never reaches for a view or the DOM
  const x=fx(cur), cpc=Math.max(1,+f.cycles||c.cyclesPerYear);
  const yieldYear=m.yield*cpc;
  const rev=yieldYear*f.price;
  const waterCost=f.water*m.season*cpc*COST.water*x;
  const fertCost=f.fertilizer*(m.season/7)*cpc*COST.fert*x;
  const other=(f.costAc||0)*f.area*cpc;
  const cost=waterCost+fertCost+other;
  const profit=rev-cost;
  return {rev,cost,profit,waterCost,fertCost,other,cpc,yieldYear,
    margin:rev>0?profit/rev*100:-100,
    roi:cost>0?profit/cost*100:0,
    bePrice:yieldYear>0?cost/yieldYear:Infinity,
    beYieldPerAcre:f.price>0?cost/(f.price*cpc)/f.area:Infinity,
    fv:(profit<=0||rev<=0)?{l:'LOSS',tone:'bad'}
      :(profit/rev>=.40?{l:'Highly profitable',tone:'good'}
      :(profit/rev>=.20?{l:'Profitable',tone:'good'}
      :(profit/rev>=.08?{l:'Marginal',tone:'warn'}:{l:'Thin margin',tone:'bad'}))) };
}

/* --- 6.6 season timeline & stage detection --------------------------- */
function growthInfo(f){
  const c=CROP[f.crop], season=c.season;
  let day=null,est=false;
  if(f.plantingDate){
    const p=new Date(f.plantingDate+'T00:00:00');
    if(!isNaN(p)){ day=Math.floor((Date.now()-p.getTime())/864e5)+1; if(day<1)day=null; }
  }
  if(day==null){day=Math.round(season*0.45);est=true;}
  day=Math.min(day,season);
  const pct=Math.round(clamp(day/season*100,2,100));
  return {day,season,cycle:c.cycle,pct,toHarvest:Math.max(0,season-day),est};
}
function stageFromPct(pct){
  if(pct<18)return 'initial';
  if(pct<42)return 'vegetative';
  if(pct<60)return 'flowering';
  if(pct<85)return 'mid';
  return 'late';
}
/* --- 6.8 weather stress test + crop ranking -------------------------- */
function stressTest(f){
  const base=computeModel(f), baseE=economics(f,base);
  return Object.keys(WEATHER).map(k=>{
    const w=WEATHER[k];
    const sf=Object.assign({},f,{rainfall:clamp(f.rainfall+w.rain,0,300),
      temperature:clamp(f.temperature+w.temp,5,50),humidity:clamp(f.humidity+w.hum,10,100)});
    const m=computeModel(sf), e=economics(sf,m);
    return {k,label:w.label,m,yield:m.yield,dY:m.yield-base.yield,pest:m.pest,
      profit:e.profit,dP:e.profit-baseE.profit};
  });
}
function probeFor(f,cropKey){
  const c=CROP[cropKey], cur=f.currency||'BDT';
  const p=Object.assign({},f,{crop:cropKey,
    price:+(c.priceUSD*fx(cur)).toFixed(2),
    costAc:Math.round(c.costUSD*fx(cur)),
    cycles:c.cyclesPerYear});
  return p;
}
function cropRows(f){
  const rows=[];
  for(const c of CROPS){
    const p0=probeFor(f,c.key);
    const m0=computeModel(Object.assign({},p0,{water:1}));
    const p=Object.assign({},p0,{water:m0.need,fertilizer:m0.fertOpt});
    const m=computeModel(p), e=economics(p,m), su=suitability(p), v=verdict(su.total);
    rows.push({crop:c,key:c.key,label:c.label,icon:c.icon,cat:c.cat,m,e,su,v,
      water:m.need,cycle:c.cycle,perennial:c.perennial,risk:m.pest});
  }
  return rows;
}
function sortCropRows(rows,mode){
  const r=rows.slice();
  if(mode==='suit')r.sort((a,b)=>b.su.total-a.su.total);
  else if(mode==='water')r.sort((a,b)=>a.water-b.water);
  else if(mode==='cycle')r.sort((a,b)=>a.cycle-b.cycle);
  else if(mode==='risk')r.sort((a,b)=>a.m.pest-b.m.pest);
  else r.sort((a,b)=>b.e.profit-a.e.profit);
  return r;
}

/* --- 6.9 optimizer grid search + water sweep ------------------------- */
function optimizeFarm(f){
  const c=CROP[f.crop], base=computeModel(f), cur=f.currency||'BDT', x=fx(cur);
  const wMin=Math.max(1,Math.round(base.need*0.45)), wMax=Math.max(wMin+20,Math.round(base.need*1.9));
  const wStep=niceStep((wMax-wMin)/22);
  const fMin=Math.max(0.2,+(base.fertOpt*0.35).toFixed(1)), fMax=+(base.fertOpt*1.9).toFixed(1);
  const fStep=Math.max(0.2,+((fMax-fMin)/10).toFixed(2));
  const rows=[];
  for(let w=wMin;w<=wMax;w+=wStep){
    for(let ft=fMin;ft<=fMax+1e-9;ft=+(ft+fStep).toFixed(2)){
      const probe=Object.assign({},f,{water:w,fertilizer:ft});
      const m=computeModel(probe), e=economics(probe,m);
      const riskPen=m.pest>32?(m.pest-32)*10*x:0;
      rows.push({w,ft:+(+ft).toFixed(1),yield:m.yield,health:m.health,pest:m.pest,eff:m.eff,
        profit:e.profit,score:Math.round(e.rev-e.waterCost-e.fertCost-riskPen)});
    }
  }
  rows.sort((a,b)=>b.score-a.score);
  const best=rows[0];
  const ws=[...new Set(rows.map(r=>r.w))].sort((a,b)=>a-b);
  const curve=ws.map(w=>({w,y:computeModel(Object.assign({},f,{water:w,fertilizer:best.ft})).yield}));
  return {rows:rows.slice(0,8),best,curve,base,combos:rows.length};
}
function waterSweep(f){
  const base=computeModel(f), rows=[];
  const lo=Math.max(1,Math.round(base.need*0.55)), hi=Math.max(lo+10,Math.round(base.need*1.6));
  const step=niceStep((hi-lo)/6);
  for(let w=lo;w<=hi;w+=step){
    const probe=Object.assign({},f,{water:w});
    const m=computeModel(probe), e=economics(probe,m);
    rows.push({w,yield:m.yield,health:m.health,pest:m.pest,eff:m.eff,profit:e.profit,
      inBand:w>=base.range.lo&&w<=base.range.hi});
  }
  return {rows,base,step};
}
function simulateGrowth(f,days){
  const c=CROP[f.crop], s=SOILS[f.soil], st=STAGES[f.stage];
  const base=computeModel(f);
  let moisture=base.moisture, health=Math.min(base.health,72);
  const out=[];
  for(let d=1;d<=days;d++){
    const irr=l2mm(f.water,f.area);
    const target=clamp(55+((irr+base.rainEff)-base.etc)*15*s.moistSwing,3,100);
    moisture=clamp(moisture+(target-moisture)*0.45,3,100);
    let stress=0;
    if(moisture<42)stress+=(42-moisture)/42*st.waterSens;
    if(moisture>88)stress+=(moisture-88)/25*s.excessPen;
    const tH=clamp(100-stress*42-base.tpen-base.hpen-base.pest*0.18-base.fertPen,8,99);
    health=clamp(health+(tH-health)*0.15,5,99);
    out.push({day:d,health:+health.toFixed(1),moisture:+moisture.toFixed(1)});
  }
  return out;
}

/* --- 6.10 farm templates & validation -------------------------------- */
function templateFarm(){
  const f={name:'Green Valley',crop:'tomatoes',soil:'Loam',stage:'flowering',
    plantingDate:new Date(Date.now()-45*864e5).toISOString().slice(0,10),
    area:1,currency:'BDT',ph:6.5,temperature:29,humidity:72,rainfall:20,
    water:0,fertilizer:0,price:0,costAc:0,cycles:1};
  const c=CROP[f.crop], x=fx(f.currency);
  f.price=+(c.priceUSD*x).toFixed(2);
  f.costAc=Math.round(c.costUSD*x);
  f.cycles=c.cyclesPerYear;
  const m=computeModel(Object.assign({},f,{water:1}));
  f.water=Math.round(m.need/10)*10;
  f.fertilizer=m.fertOpt;
  return f;
}
function DEMO_FARM(){ const d=templateFarm(); d.name='Green Valley'; return d; }
function validateFarm(f){
  if(!f||typeof f!=='object')return null;
  if(!CROP[f.crop]||!SOILS[f.soil]||!STAGES[f.stage])return null;
  ['area','temperature','humidity','rainfall','water','fertilizer'].forEach(k=>{f[k]=+f[k];});
  if(!isFinite(f.area)||f.area<=0||f.area>500)return null;
  if(!isFinite(f.temperature)||!isFinite(f.humidity)||!isFinite(f.rainfall)||!isFinite(f.water))return null;
  f.currency=CUR[f.currency]?f.currency:'BDT';
  const c=CROP[f.crop], x=fx(f.currency);
  if(!isFinite(+f.price)||+f.price<=0)f.price=+(c.priceUSD*x).toFixed(2); else f.price=+f.price;
  if(!isFinite(+f.costAc)||+f.costAc<0)f.costAc=Math.round(c.costUSD*x); else f.costAc=+f.costAc;
  f.cycles=Math.max(1,Math.min(6,Math.round(+f.cycles||c.cyclesPerYear)));
  if(f.ph===''||f.ph==null||!isFinite(+f.ph)||+f.ph<0||+f.ph>14)f.ph=null; else f.ph=+f.ph;
  if(!isFinite(f.fertilizer)||f.fertilizer<0)f.fertilizer=0;
  if(!f.plantingDate)f.plantingDate=new Date(Date.now()-30*864e5).toISOString().slice(0,10);
  return f;
}

const LEGACY_CROP={tomato:'tomatoes',rice:'rice',wheat:'wheat',maize:'maize-corn',potato:'potatoes',
  onion:'onions',brinjal:'eggplant',chili:'peppers'};
const LEGACY_SOIL={sandy:'Sandy',sandyLoam:'Sandy Loam',loamy:'Loam',silty:'Silt Loam',clay:'Clay'};
const LEGACY_DRAIN={sandy:1.28,sandyLoam:1.12,loamy:1.00,silty:0.95,clay:0.88};
const LEGACY_FERT_BASE={tomato:4.6,rice:6.5,wheat:5.0,maize:6.0,potato:5.5,onion:4.2,brinjal:5.0,chili:4.2};
const LEGACY_KC={
  tomato :{initial:.60,vegetative:.85,flowering:1.05,mid:1.15,late:.80},
  rice   :{initial:1.05,vegetative:1.15,flowering:1.20,mid:1.25,late:1.00},
  wheat  :{initial:.40,vegetative:.75,flowering:1.05,mid:1.10,late:.35},
  maize  :{initial:.40,vegetative:.90,flowering:1.10,mid:1.15,late:.60},
  potato :{initial:.50,vegetative:.80,flowering:1.05,mid:1.10,late:.75},
  onion  :{initial:.50,vegetative:.75,flowering:.95,mid:1.00,late:.85},
  brinjal:{initial:.60,vegetative:.85,flowering:1.00,mid:1.05,late:.80},
  chili  :{initial:.60,vegetative:.85,flowering:1.00,mid:1.05,late:.80}};
const LEGACY_RAINEFF={sandy:0.38,sandyLoam:0.42,loamy:0.45,silty:0.50,clay:0.52};
const LEGACY_CALIB=22.5;   // litres per mm per acre, previous build
function differs(a,b){return ['water','fertilizer','temperature','rainfall','humidity'].some(k=>+a[k]!==+b[k]);}
/* What the previous build would have called this farm's water requirement, in
   its own 22.5 L-per-mm-per-acre litres. Storage migration scales an old
   reading by newNeed ÷ this, so a migrated farm keeps the exact water-stress
   ratio it had before. It lives here because it is legacy *engine* policy. */
function legacyWaterNeed(raw,stage){
  const kc=(LEGACY_KC[raw.crop]&&LEGACY_KC[raw.crop][stage])||1.0;   // crops the old build never had default to Kc 1
  const rainEff=(LEGACY_RAINEFF[raw.soil]||.45)*Math.pow(Math.max(+raw.rainfall||0,0)/7,0.75);
  const area=+raw.area>0?+raw.area:1;
  return Math.max(0.2,(1.8+0.11*(+raw.temperature||25))*kc-rainEff)
    *LEGACY_CALIB*area*(LEGACY_DRAIN[raw.soil]||1);
}
