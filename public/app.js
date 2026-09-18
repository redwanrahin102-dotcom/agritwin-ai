/* =====================================================================
   app.js — THE APPLICATION: state, storage, auth, actions, chrome, boot
   ---------------------------------------------------------------------
   Owns: the single `state` object and every write to it, localStorage
         (including migration from the pre-merge keys), Supabase auth +
         farm DB (with localStorage fallback), routing, the create-form
         actions, and the shell chrome (modal, toast).
   Reads: crops.js (data), engine.js (model), ui.js and views-*.js
          (rendering). Never renders a layer itself.
   ===================================================================== */
/* ---------------- 1. AUTH + SUPABASE -------------------------------- */
let _authUser = null;  // current Supabase user (null = guest)
let _guestMode = false; // guest mode flag (no Supabase sync)
function paintAuthChip(){
  const c=document.getElementById('authChip'); if(!c)return;
  if(_authUser){
    c.className='api-chip on';
    c.textContent='🟢 '+(_authUser.email||'Account').split('@')[0];
  } else {
    c.className='api-chip off';
    c.textContent='👤 Guest — login to sync';
  }
}
function handleAuthChip(){
  if(_authUser){
    modal('Account — '+esc(_authUser.email||''),
      '<p>You are logged in. Your farms are synced to Supabase.</p>',
      [{cls:'primary',label:'Sign out',run:()=>{ sbSignOut().then(()=>{ _authUser=null; paintAuthChip(); document.getElementById('authGate').classList.remove('hidden'); toast('Signed out'); }); }},
       {label:'Cancel'}]);
  } else {
    document.getElementById('authGate').classList.remove('hidden');
  }
}

/* ---------------- AUTH GATE — full-page login/signup overlay ---------- */
let _gateMode='login';
function gateToggleMode(){
  _gateMode=_gateMode==='login'?'signup':'login';
  const g=id=>document.getElementById(id);
  g('gSubmit').textContent=_gateMode==='login'?'Sign in':'Create account';
  g('gToggle').textContent=_gateMode==='login'?'Create one':'Sign in';
  g('gErr').textContent='';
}
async function gateAuthSubmit(){
  const g=id=>document.getElementById(id);
  const email=(g('gEmail').value||'').trim();
  const pass=g('gPass').value;
  const err=g('gErr');
  if(!email||!pass){err.textContent='Please fill in both fields';return;}
  if(pass.length<6){err.textContent='Password must be at least 6 characters';return;}
  err.textContent='';
  const btn=g('gSubmit'); if(btn){btn.disabled=true;btn.innerHTML='<span class="spin"></span>';} 
  try{
    if(_gateMode==='signup') await sbSignUp(email,pass);
    const data = await sbSignIn(email,pass);
    _authUser=data.user||await sbCurrentUser();
    paintAuthChip();
    document.getElementById('authGate').classList.add('hidden');
    toast(_gateMode==='signup'?'✅ Account created — check your email for confirmation':'🟢 Welcome back!');
    await loadFarm();
    if(!state.farm) nav('home'); else nav('dashboard');
  }catch(e){
    err.textContent=e.message||'Authentication failed';
  }finally{
    if(btn){btn.disabled=false;btn.textContent=_gateMode==='login'?'Sign in':'Create account';}
  }
}
function gateGuest(){
  _guestMode=true;
  document.getElementById('authGate').classList.add('hidden');
  toast('👋 Guest mode — data saved in this browser');
  if(!state.farm) nav('home'); else nav('dashboard');
}

/* =====================================================================
   2. STATE · STORAGE · FARM LIFECYCLE
   ===================================================================== */
/* The single owner of everything mutable. Views read this and return HTML;
   only the actions in this file write it. `currency` is the display currency,
   mirrored from the farm so ui.js can format money without reading the DOM. */
const state={farm:null,sim:null,weather:'normal',optRun:null,optimized:null,phase:null,optTimer:null,
  view:'home',dir:'fwd',advisorCrop:null,sortBy:'profit',currency:'BDT',tasks:[],migratedLegacy:false};
let lastIdx=0;
function lsGet(k,d){try{const v=localStorage.getItem(k);return v==null?d:v;}catch(e){return d;}}
function lsSet(k,v){try{localStorage.setItem(k,v);return true;}catch(e){return false;}}
function lsDel(k){try{localStorage.removeItem(k);}catch(e){}}
function saveFarm(){
  if(!state.farm) return;
  lsSet('at3_farm',JSON.stringify(state.farm));  // always keep a local copy
  if(_authUser && sbReady()) sbSaveFarm(state.farm);  // sync to Supabase if logged in
}
/* ---- farm lifecycle: setFarm is the only writer of state.farm --------- */
function setFarm(farm){
  state.farm=validateFarm(farm);
  state.currency=state.farm?state.farm.currency:'BDT';
  loadTaskState();            // the checklist belongs to this farm and today
  saveFarm();
  return state.farm;
}
/* Everything derived from the farm: drop it whenever the farm changes, and
   cancel any optimization still running for the old farm. */
function clearRuns(){
  if(state.optTimer){clearInterval(state.optTimer);state.optTimer=null;state.phase=null;}
  state.sim=null; state.weather='normal'; state.optRun=null; state.optimized=null;
}
async function loadFarm(){
  // If logged in, try Supabase first; fall back to localStorage
  if(_authUser && sbReady()){
    try{
      const dbFarm = await sbLoadFarm();
      if(dbFarm){ setFarm(dbFarm); return; }
    }catch(e){ console.warn('sbLoadFarm failed, using localStorage',e); }
  }
  let farm=null;
  try{farm=JSON.parse(localStorage.getItem('at3_farm'));}catch(e){farm=null;}
  setFarm(farm||migrateLegacyData());
}
/* ---------------------------------------------------------------------
   Legacy storage migration (the pre-merge site used at2_* keys, its own
   8-crop / 5-soil vocabulary and the old 22.5 L-per-mm-per-acre litre
   scale). Farms saved there are migrated in place — never discarded.
   Water keeps the exact water-stress ratio it had before, by re-scaling
   with the ratio of the two engines' requirements:
     new = old × newNeed ÷ oldNeed
   where each need = max(0.2, ET₀×Kc(stage) − rainEff(soil)) × C × acres ×
   drainage, using the legacy Kc / rainfall-efficiency / calibration tables
   below for the old side. Fertilizer keeps its ratio to the crop's optimum
   (old optimum from the legacy per-crop fertBase). History and the task
   list are carried over untouched and flagged "old scale", because their
   yields came from the old yield table and cannot be re-derived.
   --------------------------------------------------------------------- */
function migrateLegacyData(){
  if(lsGet('at3_migratedFrom',null))return null;
  let raw=null;
  try{raw=JSON.parse(lsGet('at2_farm',null));}catch(e){raw=null;}
  let farm=null;
  if(raw&&typeof raw==='object'){
    const cropKey=LEGACY_CROP[raw.crop]||(CROP[raw.crop]?raw.crop:null);
    const soil=LEGACY_SOIL[raw.soil]||'Loam';
    const stage=STAGES[raw.stage]?raw.stage:'flowering';
    const area=+raw.area>0?+raw.area:1;
    if(cropKey&&SOILS[soil]){
      const c=CROP[cropKey];
      const temp=+raw.temperature||25, hum=+raw.humidity||65, rain=+raw.rainfall||0;
      const seed={crop:cropKey,soil,stage,area,water:1,fertilizer:0,temperature:temp,humidity:hum,rainfall:rain};
      const newNeed=computeModel(seed).need;
      const water=Math.round((+raw.water||0)*(newNeed/Math.max(0.0001,legacyWaterNeed(raw,stage))));
      const newOpt=computeModel(seed).fertOpt;
      const oldBase=LEGACY_FERT_BASE[raw.crop];
      const fert=oldBase
        ? Math.round(((+raw.fertilizer||0)/Math.max(0.4,oldBase*STAGES[stage].fertFactor*area))*newOpt*10)/10
        : Math.round(newOpt*10)/10;
      farm={
        name:raw.name||'Migrated Farm',crop:cropKey,soil,stage,
        plantingDate:raw.plantingDate||new Date(Date.now()-30*864e5).toISOString().slice(0,10),
        area,water,fertilizer:fert,
        temperature:+raw.temperature||25,humidity:+raw.humidity||65,rainfall:+raw.rainfall||0,
        ph:null,currency:'BDT',price:+(c.priceUSD*FX.BDT).toFixed(2),
        costAc:Math.round(c.costUSD*FX.BDT),cycles:c.cyclesPerYear};
    }
  }
  try{
    const hist=JSON.parse(lsGet('at2_hist',null));
    if(Array.isArray(hist)&&hist.length&&!lsGet('at3_hist',null))
      lsSet('at3_hist',JSON.stringify(hist.slice(0,15).map(h=>Object.assign({},h,{legacy:true}))));
  }catch(e){}
  try{
    const t=JSON.parse(lsGet('at2_tasks',null));
    if(t&&t.done&&!lsGet('at3_tasks',null))
      lsSet('at3_tasks',JSON.stringify({farm:(farm&&farm.name)||t.farm||'',day:t.day,done:t.done}));
  }catch(e){}
  lsSet('at3_migratedFrom','at2');
  if(farm)state.migratedLegacy=true;
  return farm;
}
function loadHist(){ try{return JSON.parse(localStorage.getItem('at3_hist'))||[]}catch(e){return[]} }
function addHist(e){ const h=loadHist(); h.unshift(Object.assign({},e,{ts:Date.now()})); lsSet('at3_hist',JSON.stringify(h.slice(0,15))); }
function loadTaskState(){
  state.tasks=[];
  if(!state.farm)return;
  try{
    const o=JSON.parse(lsGet('at3_tasks',null));
    if(o&&o.farm===state.farm.name&&o.day===new Date().toDateString())state.tasks=o.done||[];
  }catch(e){}
}
function saveTaskState(){
  lsSet('at3_tasks',JSON.stringify({farm:state.farm?state.farm.name:'',day:new Date().toDateString(),done:state.tasks}));
}

/* =====================================================================
   3. CREATE-FORM ACTIONS — the form is a view, these read it on demand
   ===================================================================== */
function syncStageToDate(){
  const sel=document.getElementById('fStage');
  // on the Create layer the form owns the values, so the stage must follow the
  // crop/date currently typed in it — not the farm that happens to be saved
  const f=sel?currentFormFarm():state.farm;
  if(!f||!f.plantingDate){toast('Add a planting date first');return;}
  if(!CROP[f.crop]){toast('Pick a crop first');return;}
  const g=growthInfo(f), k=stageFromPct(g.pct);
  if(sel){
    sel.value=k;
  } else if(state.farm){
    state.farm.stage=k;
    saveFarm();
    render();
  }
  toast('🔄 Stage set to '+STAGES[k].label+' (day '+g.day+' of '+nf(g.season)+')');
}

function toggleTask(i){
  state.tasks[i]=!state.tasks[i];
  saveTaskState();
  const el=document.getElementById('task'+i);
  if(el){el.classList.toggle('done',!!state.tasks[i]);const cb=el.querySelector('input');if(cb)cb.checked=!!state.tasks[i];}
}

function currentFormFarm(){
  const g=id=>document.getElementById(id);
  if(!g('fCrop'))return null;
  return {
    name:(g('fName')?g('fName').value.trim():'My Farm')||'My Farm',
    crop:g('fCrop').value, soil:g('fSoil').value, stage:g('fStage').value,
    plantingDate:g('fPlant')?g('fPlant').value:'',
    area:+(g('fArea')?g('fArea').value:1),
    water:+(g('fWater')?g('fWater').value:0),
    fertilizer:+(g('fFert')?g('fFert').value:0),
    temperature:+(g('fTemp')?g('fTemp').value:25),
    humidity:+(g('fHum')?g('fHum').value:65),
    rainfall:+(g('fRain')?g('fRain').value:20),
    ph:(g('fPh')&&g('fPh').value!=='')?+g('fPh').value:null,
    currency:g('fCur')?g('fCur').value:'BDT',
    price:+(g('fPrice')?g('fPrice').value:1),
    costAc:+(g('fCost')?g('fCost').value:0),
    cycles:Math.max(1,Math.round(+(g('fCycles')?g('fCycles').value:1)||1))
  };
}
function refreshComparisons(){
  if(state.view!=='create')return;
  const f=currentFormFarm();
  if(!f)return;
  const soil=document.getElementById('fSoil'), c=CROP[f.crop];
  if(soil){
    const hint=soil.closest('.field').querySelector('.fhint');
    if(hint)hint.textContent='Drainage fitness '+SOILS[f.soil].d+' · '+SOILS[f.soil].note;
  }
  refreshCreateTable();
}
function refreshCreateTable(){
  const f=currentFormFarm(); if(!f)return;
  const rows=sortCropRows(cropRows(f),state.sortBy);
  const el=document.getElementById('createTable');
  if(el)el.innerHTML=rowsTable(rows,{limit:12,cur:f.currency,
    action:(v)=>'<button type="button" class="btn outline" style="padding:5px 10px;font-size:11.5px" onclick="pickCrop(\''+v.key+'\')">Grow this</button>'});
}
/* Create and Crop Advisor sort the same table the same five ways, so one
   action owns the sort mode. The Create layer must not re-render (that would
   rebuild the form from the saved farm and drop what is being typed), so it
   refreshes only its table. */
function setSort(mode){
  state.sortBy=mode;
  if(state.view==='create'){
    // the table refreshes but the bar is not re-rendered with the form, so its
    // highlight is updated here
    refreshCreateTable();
    document.querySelectorAll('.sortbar .sbtn[data-sort]')
      .forEach(b=>b.classList.toggle('active',b.dataset.sort===mode));
  } else render();
}
function pickCrop(key){
  const sel=document.getElementById('fCrop');
  if(sel){
    sel.value=key;
    autoFillCrop();
    refreshComparisons();
    sel.closest('.field').scrollIntoView({behavior:'smooth',block:'center'});
    toast('🌱 '+CROP[key].label+' selected — recommended inputs filled in');
    return;
  }
  const f=state.farm||templateFarm();
  f.crop=key; f.price=+(CROP[key].priceUSD*fx(f.currency)).toFixed(2);
  f.costAc=Math.round(CROP[key].costUSD*fx(f.currency)); f.cycles=CROP[key].cyclesPerYear;
  setFarm(f); render();
}
function autoFillCrop(){
  const g=id=>document.getElementById(id); if(!g('fCrop'))return;
  const key=g('fCrop').value, c=CROP[key], cur=g('fCur').value, x=fx(cur);
  if(g('fPrice'))g('fPrice').value=+(c.priceUSD*x).toFixed(2);
  if(g('fCost'))g('fCost').value=Math.round(c.costUSD*x);
  if(g('fCycles'))g('fCycles').value=c.cyclesPerYear;
  const hint=document.querySelector('#fld_crop .fhint');
  if(hint)hint.textContent='Selected: '+c.icon+' '+c.label+' · '+c.cat+' · matures in '+fmtDays(c.cycle)+' · '+nf(c.baseYield)+' kg/acre potential';
  const t=g('fTemp'), h=g('fHum');
  const th=document.querySelector('#fld_temp .fhint'), hh=document.querySelector('#fld_hum .fhint');
  if(th)th.textContent='Comfortable range for '+c.label+': '+c.temp[0]+'–'+c.temp[1]+'°C';
  if(hh)hh.textContent='Crop preference: '+c.hum[0]+'–'+c.hum[1]+'%';
  fillRecommended();
  refreshComparisons();
}
function fillRecommended(){
  const f=currentFormFarm(); if(!f)return;
  const probe=Object.assign({},f,{water:1,fertilizer:0});
  const m=computeModel(probe);
  const w=document.getElementById('fWater'), fe=document.getElementById('fFert');
  if(w)w.value=Math.round(m.need/10)*10;
  if(fe)fe.value=m.fertOpt;
  const wh=document.querySelector('#fld_water .fhint');
  if(wh)wh.textContent='Model optimum: '+nf(m.range.lo)+'–'+nf(m.range.hi)+' L/day ≈ '+m.mmPerDay.toFixed(2)+' mm/day · season need ≈ '+nf(m.needMmCycle)+' mm';
  const fh=document.querySelector('#fld_fert .fhint');
  if(fh)fh.textContent='Model optimum: '+nf(m.fertRange.lo,1)+'–'+nf(m.fertRange.hi,1)+' kg/week';
}

function advisorProbe(key){
  const p=probeFor(state.farm,key);
  const m0=computeModel(Object.assign({},p,{water:1}));
  return Object.assign({},p,{water:Math.round(m0.need),fertilizer:m0.fertOpt});
}
function openCrop(key){
  state.advisorCrop=key;
  if(state.view!=='advisor'){nav('advisor');return;}
  render();
  const el=document.getElementById('cropDetail');
  if(el)el.scrollIntoView({behavior:'smooth',block:'start'});
}
/* =====================================================================
   4. CHROME — modal, toast, count-up animation
   ===================================================================== */
function modal(title,body,actions){
  document.getElementById('modalTitle').textContent=title;
  document.getElementById('modalBody').innerHTML=body+(actions&&actions.length
    ?'<div class="row gap" style="margin-top:16px">'
      +actions.map((a,i)=>'<button class="btn '+(a.cls||'outline')+'"'+(a.style?' style="'+a.style+'"':'')+' id="mBtn'+i+'">'+a.label+'</button>').join('')+'</div>':'');
  document.getElementById('modalWrap').classList.add('open');
  (actions||[]).forEach((a,i)=>{
    const el=document.getElementById('mBtn'+i);
    if(el)el.onclick=()=>{closeModal(); if(a.run)a.run();};
  });
}
function toast(msg){
  const t=document.getElementById('toast');if(!t)return;
  t.textContent=msg;t.classList.add('show');
  clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2600);
}
let toastT;
function animateCountUps(){
  document.querySelectorAll('[data-count]').forEach(el=>{
    const target=parseFloat(el.dataset.count),t0=performance.now(),dur=850;
    if(isNaN(target))return;
    const dec=el.dataset.dec?parseInt(el.dataset.dec,10):0;
    function tick(t){
      const p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,3);
      el.textContent=(target*e).toLocaleString(undefined,{minimumFractionDigits:dec,maximumFractionDigits:dec});
      if(p<1)requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}
function openWhy(){
  const f=state.sim||state.farm, m=computeModel(f), c=CROP[f.crop], s=SOILS[f.soil], st=STAGES[f.stage];
  const su=suitability(f);
  const body=
    '<p>The recommendation considers <b>crop type, soil characteristics, growth stage, recent rainfall and current weather</b>. The model estimates the irrigation range that balances crop requirement with water efficiency.</p>'
    +'<ul class="why-list">'
    +'<li>🌡️ At <b>'+f.temperature+'°C</b>, reference evaporation ET₀ ≈ <b>'+m.eto.toFixed(2)+' mm/day</b>.</li>'
    +'<li>🌱 '+c.label+' in the <b>'+st.label.toLowerCase()+'</b> stage: Kc = <b>'+c.kc[f.stage]+'</b> → crop water use ETc ≈ <b>'+m.etc.toFixed(2)+' mm/day</b> ('+(c.profile)+' profile).</li>'
    +'<li>🌧️ Recent rainfall of <b>'+f.rainfall+' mm</b> effectively supplies ≈ <b>'+m.rainEff.toFixed(2)+' mm/day</b> ('+nf(m.rainCreditMmCycle)+' mm this cycle) on '+s.label.toLowerCase()+' soil.</li>'
    +'<li>🪨 '+s.label+' soil: '+s.note+'. Drainage multiplier <b>'+s.drainFlow+'×</b>, over-water penalty <b>'+s.excessPen+'×</b>.</li>'
    +'<li>📐 Scaled to your <b>'+f.area+'-acre</b> farm at 4,047 L per mm → estimated requirement <b>'+nf(m.range.lo)+'–'+nf(m.range.hi)+' L/day</b> (≈ '+m.needMmDay.toFixed(2)+' mm/day, '+nf(m.needMmCycle)+' mm per cycle).</li>'
    +'<li>🧭 Your current setting gives a net water balance of <b>'+su.eff.toFixed(2)+'×</b> crop demand, so the water factor scores <b>'+Math.round(su.water*100)+'%</b> and overall suitability is <b>'+Math.round(su.total)+'%</b>.</li>'
    +'</ul>'
    +'<p class="small muted">You are applying <b>'+nf(f.water)+' L/day</b> — '
    +(m.waterState==='ok'?'inside the estimated optimal range ✅':m.waterState==='high'?'above the range; extra water mainly runs off, leaches nutrients and raises disease risk ⚠':'below the range; the crop is under water stress ⚠')+'.</p>';
  modal('💧 Why this recommendation?',body);
}
function closeModal(){document.getElementById('modalWrap').classList.remove('open');}

/* =====================================================================
/* auth gate is now a full-page overlay defined in index.html —
   see gateAuthSubmit, gateToggleMode, gateGuest below */

/* =====================================================================
   5. ROUTER — layer registry, hotbar, flow bar, keyboard
   ===================================================================== */
const LAYERS=[
  {id:'home',      label:'Home',           short:'Home',      icon:'🏠'},
  {id:'create',    label:'Create Farm',    short:'Create',    icon:'🌱'},
  {id:'dashboard', label:'Dashboard',      short:'Dashboard', icon:'📊', needs:true},
  {id:'simulator', label:'Simulator',      short:'Simulator', icon:'🔮', needs:true},
  {id:'optimizer', label:'Optimizer',      short:'Optimizer', icon:'⚙️', needs:true},
  {id:'advisor',   label:'Crop Advisor',   short:'Crops',     icon:'🧭', needs:true},
  {id:'reports',   label:'Reports',        short:'Reports',   icon:'📋', needs:true},
  {id:'method',    label:'How It Thinks',  short:'Method',    icon:'🧠'}
];
function nav(v){location.hash='#/'+v;}
function route(){
  let v=(location.hash||'#/home').replace('#/','');
  // auth is now a full-page overlay, not a layer
  if(v==='auth') v='home';
  let idx=LAYERS.findIndex(l=>l.id===v);
  if(idx<0)idx=0;
  const L=LAYERS[idx];
  // farm-gated layers need a farm
  if(L.needs&&!state.farm){
    toast('🔒 '+LAYERS[idx].label+' layer unlocks after you create your farm');
    idx=LAYERS.findIndex(l=>l.id==='create');
  }
  state.dir=idx>=lastIdx?'fwd':'back';
  lastIdx=idx;
  state.view=LAYERS[idx].id;
  if(state.view==='simulator'&&!state.sim)state.sim=Object.assign({},state.farm);
  render();
}
function renderHotbar(){
  const el=document.getElementById('navLinks'); if(!el)return;
  el.innerHTML=LAYERS.map((l,i)=>{
    const locked=l.needs&&!state.farm;
    return '<button class="lchip '+(state.view===l.id?'active':'')+' '+(locked?'locked':'')+'"'
      +(locked?' title="🔒 '+l.label+' — unlocks after you create your farm"':' title="'+l.label+' — press '+(i+1)+'"')
      +' onclick="nav(\''+l.id+'\')"><span class="ln">'+(locked?'🔒':String(i+1).padStart(2,'0'))+'</span><span>'+l.short+'</span></button>';
  }).join('');
}
function flowbarHTML(){
  const i=LAYERS.findIndex(l=>l.id===state.view);
  const prev=i>0?LAYERS[i-1]:null, last=i===LAYERS.length-1;
  const next=last?LAYERS[0]:LAYERS[i+1];
  return '<div class="flowbar no-print">'
    +(prev?'<button class="btn outline" onclick="nav(\''+prev.id+'\')">← '+prev.icon+' '+prev.label+'</button>':'<span></span>')
    +'<span class="flmeta muted">LAYER '+(i+1)+' OF '+LAYERS.length+' — '+LAYERS[i].label.toUpperCase()+' &nbsp;·&nbsp; switch with 1–'+LAYERS.length+' keys or ←/→</span>'
    +'<button class="btn primary" onclick="nav(\''+next.id+'\')">'+(last?'🏠 Back to Start':next.icon+' '+next.label)+' →</button></div>';
}
function render(){
  paintAuthChip();
  renderHotbar();
  // show the auth gate if not authenticated and not in guest mode
  const gate=document.getElementById('authGate');
  if(gate && !_authUser && !_guestMode){ gate.classList.remove('hidden'); }
  else if(gate){ gate.classList.add('hidden'); }
  const views={home:viewHome,create:viewCreate,dashboard:viewDashboard,simulator:viewSimulator,
    optimizer:viewOptimizer,advisor:viewAdvisor,reports:viewReports,method:viewMethod};
  const fn=views[state.view]||viewHome;
  let html=fn();
  document.getElementById('content').innerHTML='<div class="view '+state.dir+'">'+html+flowbarHTML()+'</div>';
  const f=state.farm;
  document.getElementById('printMeta').textContent=f
    ?f.name+' · '+CROP[f.crop].label+' · '+f.area+' acre · '+f.soil+' · '+new Date().toLocaleDateString()
    :'AgriTwin AI · generated '+new Date().toLocaleDateString();
  if(state.view==='simulator')refreshSim();
  if(state.view==='create')refreshCreateTable();
  animateCountUps();
  window.scrollTo(0,0);
}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeModal();return;}
  const t=e.target.tagName;
  if(t==='INPUT'||t==='SELECT'||t==='TEXTAREA')return;
  if(document.getElementById('modalWrap').classList.contains('open'))return;
  const n=parseInt(e.key);
  if(n>=1&&n<=LAYERS.length){nav(LAYERS[n-1].id);return;}
  const i=LAYERS.findIndex(l=>l.id===state.view);
  if(e.key==='ArrowRight'&&i<LAYERS.length-1)nav(LAYERS[i+1].id);
  if(e.key==='ArrowLeft'&&i>0)nav(LAYERS[i-1].id);
});

/* =====================================================================
   6. ACTIONS — the only code that writes state (and logs to the server)
   ===================================================================== */
function submitFarm(e){
  e.preventDefault();
  const g=id=>document.getElementById(id);
  const rules={
    name:{v:g('fName').value.trim(),ok:v=>v.length>0,msg:'Farm name is required'},
    crop:{v:g('fCrop').value,ok:()=>true},
    area:{v:g('fArea').value,ok:v=>v!==''&&+v>=0.1&&+v<=500,msg:'Enter an area between 0.1 and 500 acres'},
    soil:{v:g('fSoil').value,ok:()=>true},
    stage:{v:g('fStage').value,ok:()=>true},
    planting:{v:g('fPlant').value,ok:v=>v!=='',msg:'Planting date is required'},
    ph:{v:g('fPh').value,ok:v=>v===''||(+v>=0&&+v<=14),msg:'pH must be between 0 and 14 (or empty)'},
    water:{v:g('fWater').value,ok:v=>v!==''&&+v>=1&&+v<=2000000,msg:'Enter irrigation between 1 and 2,000,000 L/day'},
    fert:{v:g('fFert').value,ok:v=>v!==''&&+v>=0&&+v<=500,msg:'Enter fertilizer between 0 and 500 kg/week'},
    temp:{v:g('fTemp').value,ok:v=>v!==''&&+v>=-5&&+v<=50,msg:'Enter a temperature between −5 and 50 °C'},
    hum:{v:g('fHum').value,ok:v=>v!==''&&+v>=10&&+v<=100,msg:'Enter humidity between 10 and 100 %'},
    rain:{v:g('fRain').value,ok:v=>v!==''&&+v>=0&&+v<=300,msg:'Enter rainfall between 0 and 300 mm'},
    price:{v:g('fPrice').value,ok:v=>v!==''&&+v>0,msg:'Enter a selling price above zero'},
    cost:{v:g('fCost').value,ok:v=>v!==''&&+v>=0,msg:'Enter other cost per acre (0 is allowed)'},
    cycles:{v:g('fCycles').value,ok:v=>v!==''&&+v>=1&&+v<=6,msg:'Enter 1 to 6 cycles per year'}
  };
  let ok=true;
  Object.keys(rules).forEach(k=>{
    const r=rules[k], fld=document.getElementById('fld_'+k);
    if(fld){
      fld.classList.remove('err');
      if(!r.ok(r.v)){fld.classList.add('err');const msg=document.getElementById('msg_'+k);if(msg)msg.textContent=r.msg;ok=false;}
    }
  });
  if(!ok){toast('⚠️ Please fix the highlighted fields');return;}
  const farm={
    name:rules.name.v,crop:rules.crop.v,area:+rules.area.v,soil:rules.soil.v,stage:rules.stage.v,
    plantingDate:rules.planting.v,water:+rules.water.v,fertilizer:+rules.fert.v,
    temperature:+rules.temp.v,humidity:+rules.hum.v,rainfall:+rules.rain.v,
    ph:rules.ph.v===''?null:+rules.ph.v,currency:g('fCur').value,
    price:+rules.price.v,costAc:+rules.cost.v,cycles:Math.round(+rules.cycles.v)
  };
  const build=()=>{
    const btn=document.getElementById('fSubmit');
    if(btn){btn.disabled=true;btn.innerHTML='<span class="spin"></span>Building digital twin…';}
    setTimeout(()=>{
      const first=!state.farm;
      setFarm(farm);
      clearRuns();
      state.advisorCrop=null;
      toast(first?'🔓 Digital twin created — all layers unlocked!':'🌱 Digital twin updated!');
      nav('dashboard');
    },800);
  };
  if(state.farm){
    modal('Replace existing farm?',
      '<p>You already have <b>'+esc(state.farm.name)+'</b> ('+CROP[state.farm.crop].label+', '+state.farm.area+' acre). Creating this farm will replace it and clear the current simulation and optimization.</p>',
      [{cls:'primary',label:'Yes, replace it',run:build},{label:'Cancel'}]);
  } else build();
}
function loadDemoFarm(){
  const go=()=>{
    const demo=setFarm(DEMO_FARM());
    clearRuns();
    state.advisorCrop=null;
    toast('⚡ Demo farm "Green Valley" loaded — layers unlocked');
    nav('dashboard');
  };
  if(state.farm){
    modal('Load demo farm?',
      '<p>This replaces your current farm <b>'+esc(state.farm.name)+'</b> with the prepared demo twin (tomatoes, 1 acre, loam soil, flowering stage, recommended inputs).</p>',
      [{cls:'gold',label:'Load demo',run:go},{label:'Cancel'}]);
  } else go();
}
function trySim(){
  if(!state.farm){
    const demo=setFarm(DEMO_FARM());
    clearRuns();
  }
  nav('simulator');
}
function switchCrop(key){
  const f=state.farm, c=CROP[key];
  if(!c||key===f.crop){toast('Already growing '+CROP[f.crop].label);return;}
  const p=advisorProbe(key), m=computeModel(p), e=economics(p,m), su=suitability(p), v=verdict(su.total);
  const cur=f.currency;
  const body='<p>This changes your digital twin — the field, weather and prices stay, the crop and its recommended inputs change.</p>'
    +'<ul class="why-list">'
    +'<li>'+CROP[f.crop].icon+' <b>'+CROP[f.crop].label+'</b> → '+c.icon+' <b>'+c.label+'</b> ('+c.cat+', matures in '+fmtDays(c.cycle)+')</li>'
    +'<li>💰 Indicative price '+money(f.price,cur)+' → <b>'+money(p.price,cur)+'/kg</b> · other cost '+money(f.costAc,cur)+' → <b>'+money(p.costAc,cur)+'/acre</b></li>'
    +'<li>💧 Recommended water <b>'+nf(p.water)+' L/day</b> · fertilizer <b>'+nf(p.fertilizer,1)+' kg/week</b></li>'
    +'<li>🧭 Suitability on this field <b>'+Math.round(su.total)+'% ('+v.l+')</b> · predicted '+nf(m.yield)+' kg/cycle</li>'
    +'<li>💹 Predicted net <b>'+money(e.profit,cur)+'</b> per year ('+e.cpc+' cycle(s), ROI '+e.roi.toFixed(0)+'%)</li>'
    +'</ul>'
    +'<p class="small muted">Smart-switch keeps your field conditions and applies the new crop\'s recommended irrigation, fertilizer, price and cost so the twin stays realistic. You can fine-tune afterwards in Create Farm.</p>';
  modal('Switch crop to '+c.icon+' '+c.label+'?',body,[
    {cls:'primary',label:'🌱 Switch to '+esc(c.label),run:()=>{
      const before=Object.assign({},f);
      const after=Object.assign({},f,{crop:key,price:p.price,costAc:p.costAc,cycles:p.cycles,
        water:p.water,fertilizer:p.fertilizer});
      setFarm(after);
      const aM=computeModel(state.farm);

      clearRuns();
      state.optimized={before:before,after:state.farm,beforeM:computeModel(before),afterM:aM};
      state.advisorCrop=key;
      addHist({type:'Crop switch',water:state.farm.water,fert:state.farm.fertilizer,yield:aM.yield,risk:aM.pest});
      toast('🌱 Crop switched to '+c.label);
      nav('dashboard');
    }},
    {label:'Cancel'}]);
}
function onSimChange(){
  if(!state.sim)return;
  const g=id=>document.getElementById(id);
  state.sim.water=+g('sWater').value;state.sim.fertilizer=+g('sFert').value;
  state.sim.rainfall=+g('sRain').value;state.sim.temperature=+g('sTemp').value;state.sim.humidity=+g('sHum').value;
  g('vWater').textContent=nf(state.sim.water)+' L/day';
  g('vFert').textContent=nf(state.sim.fertilizer,1)+' kg/wk';
  g('vRain').textContent=state.sim.rainfall+' mm';
  g('vTemp').textContent=state.sim.temperature+'°C';
  g('vHum').textContent=state.sim.humidity+'%';
  refreshSim();
}
function refreshSim(){
  if(!state.sim||!state.farm)return;
  const f=state.farm, b=computeModel(f), s=computeModel(state.sim);
  const eB=economics(f,b), eS=economics(state.sim,s);
  const fb=suitability(f), sb=suitability(state.sim);
  const changed=differs(state.sim,f);
  const wUse=Math.round(state.sim.water/Math.max(1,f.water)*100);
  const data=[
    ['💧 Water',nf(f.water)+' L/day',nf(state.sim.water)+' L/day'],
    ['🧪 Fertilizer',nf(f.fertilizer,1)+' kg/wk',nf(state.sim.fertilizer,1)+' kg/wk'],
    ['🌱 Health',b.health+'/100',s.health+'/100',b.health,s.health],
    ['🧭 Suitability',Math.round(fb.total)+'%',Math.round(sb.total)+'%',fb.total,sb.total],
    ['📈 Yield',nf(b.yield)+' kg',nf(s.yield)+' kg',b.yield,s.yield],
    ['⚠️ Pest risk',b.pest+'%',s.pest+'%',b.pest,s.pest,true],
    ['💧 Water depth',b.mmPerDay.toFixed(2)+' mm/day',s.mmPerDay.toFixed(2)+' mm/day'],
    ['💰 Net profit / yr',money(eB.profit),money(eS.profit),eB.profit,eS.profit],
    ['🚿 Water usage','100%',wUse+'%',100,wUse,undefined,true]
  ];
  const deltaFor=r=>{
    if(r.length<5||r[3]===r[4])return '';
    const up=r[4]>r[3], good=r[5]?!up:(r[6]?!up:up);
    return '<span class="delta '+(good?'g':'b')+'">'+(up?'▲':'▼')+' '+Math.abs(Math.round((r[4]-r[3])*10)/10).toLocaleString()+'</span>';
  };
  const left=data.map(r=>'<div class="cmp-row"><span>'+r[0]+'</span><b>'+r[1]+'</b></div>').join('');
  const right=data.map(r=>'<div class="cmp-row"><span>'+r[0]+'</span><b>'+r[2]+deltaFor(r)+'</b></div>').join('');
  const wChg=(state.sim.water-f.water)/Math.max(1,f.water)*100, yChg=(s.yield-b.yield)/Math.max(1,b.yield)*100;
  const insight=!changed?'Move any slider or pick a weather scenario to begin the simulation.'
    :wChg<-1?('💡 <b>Water use decreased by '+Math.abs(Math.round(wChg))+'%</b> while predicted yield '+(Math.abs(yChg)<3?'changed only slightly ('+(yChg>=0?'+':'')+yChg.toFixed(1)+'%)':'changed by '+(yChg>=0?'+':'')+yChg.toFixed(1)+'%')+' — net profit moves '+(eS.profit-eB.profit>=0?'up ':'down ')+money(Math.abs(eS.profit-eB.profit))+'/yr.')
    :wChg>1?('💡 <b>Water use increased by '+Math.round(wChg)+'%</b> while predicted yield '+(Math.abs(yChg)<3?'changed only slightly':'changed by '+(yChg>=0?'+':'')+yChg.toFixed(1)+'%')+' — check whether the extra water pays for itself.')
    :('💡 Climate or nutrient inputs changed — compare the outcomes above.');
  const sweep=waterSweep(state.sim);
  const bestRow=sweep.rows.reduce((a,x)=>(x.profit>a.profit?x:a),sweep.rows[0]);
  const sweepRows=sweep.rows.map(x=>'<tr class="'+(x.w===bestRow.w?'best':x.inBand?'band':'')+'">'
    +'<td>'+(x.w===bestRow.w?'🏆 ':'')+nf(x.w)+' L/day</td><td>'+nf(x.yield)+' kg</td><td>'+x.health+'</td>'
    +'<td>'+x.pest+'%</td><td class="'+(x.profit>=0?'simcol':'t-bad')+'">'+money(x.profit)+'</td><td>'+stars(x.eff)+'</td></tr>').join('');
  const wn=WEATHER[state.weather];
  const wnEl=document.getElementById('weatherNote');
  if(wnEl)wnEl.innerHTML=state.weather==='normal'
    ?'<p class="small muted" style="line-height:1.6">'+wn.note+'</p>'
    :'<div class="banner warn" style="margin:0"><b>Simulation:</b> '+wn.note+'<br>'
      +'<span class="small">Estimated irrigation need: <b>'+nf(b.need)+' → '+nf(s.need)+' L/day</b> · pest risk: <b>'+b.pest+'% → '+s.pest+'%</b> · soil moisture: <b>'+b.moisture+'% → '+s.moisture+'%</b> · suitability: <b>'+Math.round(fb.total)+'% → '+Math.round(sb.total)+'%</b></span></div>';
  const el=document.getElementById('simResults');
  if(!el)return;
  el.innerHTML='<div class="banner ok">'+insight+'</div>'
  +'<div class="card"><div class="cmp">'
  +'<div class="cmp-col cur"><h4>CURRENT FARM</h4>'+left+'</div>'
  +'<div class="cmp-col sim"><h4>SIMULATED FARM</h4><span class="small muted" style="display:block;margin:-4px 0 4px">what the model predicts</span>'+right+'</div></div>'
  +'<h4 style="margin:16px 0 10px;font-size:13.5px">🧠 How the change propagates through the model</h4>'
  +'<div class="row" style="gap:6px;font-size:12px">'
  +'<span class="kpill">💧 <b>'+nf(state.sim.water)+' L/day</b></span><span class="t-good" style="font-weight:800">→</span>'
  +'<span class="kpill">🪨 moisture '+s.moisture+'%</span><span class="t-good" style="font-weight:800">→</span>'
  +'<span class="kpill">😮‍💨 stress '+(s.waterPen+s.fertPen<3?'low':s.waterPen+s.fertPen<10?'moderate':'high')+'</span><span class="t-good" style="font-weight:800">→</span>'
  +'<span class="kpill">🌱 health '+s.health+'</span><span class="t-good" style="font-weight:800">→</span>'
  +'<span class="kpill">📈 '+nf(s.yield)+' kg</span><span class="t-good" style="font-weight:800">→</span>'
  +'<span class="kpill">💰 '+money(eS.profit)+'/yr</span></div>'
  +'<h4 style="margin:18px 0 4px;font-size:13.5px">🌱 Recommended irrigation for the simulated conditions</h4>'+gaugeHTML(s,state.sim)
  +'<div class="row gap no-print">'
  +'<button class="btn primary" onclick="applySim()" '+(changed?'':'disabled title="Simulation matches your baseline"')+'>✅ Apply to my farm</button>'
  +'<button class="btn outline" onclick="resetSim()" '+(changed?'':'disabled title="Nothing to reset"')+'>↩ Reset</button>'
  +'<button class="btn outline" onclick="nav(\'optimizer\')">⚙️ Let the optimizer search</button></div></div>'
  +'<div class="card" style="margin-top:16px"><h3>📊 Water strategy sweep <span class="sub">what the model tests behind the scenes</span></h3>'
  +'<table class="tbl"><thead><tr><th>Water</th><th>Yield</th><th>Health</th><th>Risk</th><th>Net profit / yr</th><th>Efficiency</th></tr></thead>'
  +'<tbody>'+sweepRows+'</tbody></table>'
  +'<p class="small muted" style="margin-top:10px">The model identifies a <b>best-balance region</b> (green rows: '+nf(sweep.base.range.lo)+'–'+nf(sweep.base.range.hi)+' L/day), not a single magic number. 🏆 = best balance of profit and water use.</p></div>';
}
function setWeather(k){
  state.weather=k;
  const f=state.farm, d=WEATHER[k];
  if(!f||!state.sim)return;
  state.sim.rainfall=clamp(f.rainfall+d.rain,0,300);
  state.sim.temperature=clamp(f.temperature+d.temp,5,50);
  state.sim.humidity=clamp(f.humidity+d.hum,10,100);
  if(k!=='normal'){
    computeModel(state.sim);
  }
  render();
  toast('🌦️ '+d.label+' applied to simulation');
}
function applySim(){
  if(!state.sim||!differs(state.sim,state.farm)){toast('Nothing to apply');return;}
  const m=computeModel(state.sim), before=Object.assign({},state.farm);

  addHist({type:'What-If',water:state.sim.water,fert:state.sim.fertilizer,yield:m.yield,risk:m.pest});
  setFarm(Object.assign({},state.sim));
  clearRuns();
  toast('✅ Simulation applied to your farm');
  nav('dashboard');
}
function resetSim(){
  state.sim=Object.assign({},state.farm);
  state.weather='normal';
  render();
  toast('↩ Simulation reset');
}
function runOptimizer(){
  if(state.optTimer)clearInterval(state.optTimer);
  state.phase='analyzing';
  render();
  const total=6;
  let i=0;
  state.optTimer=setInterval(()=>{
    const el=document.getElementById('optStep'+i);
    if(el)el.classList.add('done');
    const bar=document.getElementById('optBar');
    if(bar)bar.style.width=((i+1)/total*100)+'%';
    i++;
    if(i>=total){
      clearInterval(state.optTimer);state.optTimer=null;
      setTimeout(()=>{state.phase=null;state.optRun=optimizeFarm(state.farm);render();toast('⚙️ Optimization complete');},500);
    }
  },550);
}
function applyOptimal(){
  const r=state.optRun;
  if(!r){toast('Run the optimizer first');return;}
  const f=state.farm, bm=computeModel(f);
  const body='<p>Your farm inputs will change:</p><ul class="why-list">'
    +'<li>💧 Water: <b>'+nf(f.water)+' → '+nf(r.best.w)+' L/day</b></li>'
    +'<li>🧪 Fertilizer: <b>'+nf(f.fertilizer,1)+' → '+nf(r.best.ft,1)+' kg/week</b></li>'
    +'<li>📈 Predicted yield: <b>'+nf(r.base.yield)+' → '+nf(r.best.yield)+' kg</b></li>'
    +'<li>⚠️ Pest risk: <b>'+bm.pest+'% → '+r.best.pest+'%</b></li>'
    +'</ul>';
  modal('Apply optimized strategy?',body,[
    {cls:'primary',label:'✅ Apply strategy',run:()=>{
      const after=Object.assign({},f,{water:r.best.w,fertilizer:r.best.ft});
      const aM=computeModel(after);

      setFarm(after);
      clearRuns();
      state.optimized={before:Object.assign({},f),after:state.farm,beforeM:computeModel(f),afterM:aM};
      addHist({type:'Optimizer',water:r.best.w,fert:r.best.ft,yield:r.best.yield,risk:r.best.pest});
      toast('🏆 Optimized strategy applied');
      nav('dashboard');
    }},
    {label:'Cancel'}]);
}
function exportFarm(){
  if(!state.farm)return;
  const f=state.farm, m=computeModel(f), e=economics(f,m), su=suitability(f), g=growthInfo(f), wp=waterPlan(f,m), pm=pestModule(f,m);
  const data={app:'AgriTwin AI',exportedAt:new Date().toISOString(),build:'merged',
    farm:f,
    analysis:{suitabilityPct:Math.round(su.total),suitabilityVerdict:verdict(su.total).l,
      factors:{temperature:su.temp,humidity:su.hum,water:su.water,soil:su.soil,pH:su.ph},
      health:m.health,waterRangeLPerDay:[m.range.lo,m.range.hi],
      recommendedWaterLPerDay:m.need,seasonMmPerCycle:m.needMmCycle,
      predictedYieldKg:m.yield,percentOfPotential:Math.round(m.yield/CROP[f.crop].baseYield*100),
      pestRiskPct:m.pest,pathogenPressurePct:Math.round(pm.score),weatherRiskPct:m.weatherRisk,
      seasonDay:g.day,seasonDays:g.season,daysToHarvest:g.toHarvest,
      waterPlanMm:wp.bandMm,waterUseEfficiencyKgPerM3:+wp.wue.toFixed(3),
      economics:{revenue:e.rev,cost:e.cost,netProfit:e.profit,marginPct:e.margin,roiPct:e.roi,
        breakEvenPricePerKg:e.bePrice,breakEvenYieldKgPerAcre:e.beYieldPerAcre,currency:f.currency},
      pestSpecies:pm.species},
    note:'Model estimates only — not real-world guarantees. Replace indicative prices, FX rates and crop cost defaults with local figures.'};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='agritwin-'+String(f.name).toLowerCase().replace(/\s+/g,'-')+'.json';
  a.click();URL.revokeObjectURL(a.href);
  toast('⬇️ Farm data exported as JSON');
}
function clearData(){
  modal('Clear all saved data?',
    '<p>This removes your farm <b>'+esc(state.farm?state.farm.name:'')+'</b>, the simulation history and today\'s task list from this browser. Server records (if connected) are kept.</p>',
    [{cls:'primary',label:'Yes, clear everything',style:'background:var(--red)',    run:async()=>{
      ['at3_farm','at3_hist','at3_tasks','at3_migratedFrom','at2_farm','at2_hist','at2_tasks'].forEach(lsDel);
      if(_authUser&&sbReady()) try{await sbDeleteFarm();}catch(e){}
      state.farm=null;state.currency='BDT';state.advisorCrop=null;state.tasks=[];state.migratedLegacy=false;
      clearRuns();
      toast('🗑️ Saved data cleared');
      nav('home');
    }},
    {label:'Cancel'}]);
}

/* ---------------- 7. BOOT -------------------------------------------- */
// No initialization needed — API routes are ready to use
// Check existing session
(async()=>{
  _authUser=await sbCurrentUser();
  paintAuthChip();
  if(_authUser){
    await loadFarm();
    if(!state.farm){state.view='home';}
  }
  paintAuthChip();
  if(_authUser && location.hash==='#/auth'){location.hash='#/home';}
  window.addEventListener('hashchange',route);
  route();
  if(state.migratedLegacy)setTimeout(()=>toast('🔁 Farm from the previous version loaded and migrated — review water, fertilizer and market prices'),900);
})();
