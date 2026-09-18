/* =====================================================================
   crops.js — THE KNOWLEDGE BASE (data only)
   ---------------------------------------------------------------------
   Owns: the 58-crop table, the 10 soil classes, growth stages, weather
   scenarios, FAO-56 style Kc profiles and the per-crop derivations that
   turn a raw crop record into a simulation-ready one.
   Depends on: engine.js (ACP, clamp) at load time — load engine first.
   Never: touches the DOM, reads app state, or mutates its own records.
   Every exported record is frozen; RAW_CROPS stays the single source.
   ===================================================================== */

/* =====================================================================
   2. SOILS (10 types — drainage, retention, waterlogging behaviour)
      d          = drainage fitness 0..1 (1 = drains best)
      drainFlow  = irrigation demand multiplier (fast drainage needs more)
      excessPen  = penalty multiplier when over-watered
      rainEff    = fraction of rainfall credited as usable water
      moistSwing = how strongly soil moisture reacts to the water balance
   ===================================================================== */
const SOIL_TBL={
 "Sandy":{d:.95,note:'drains very quickly — needs more frequent, lighter irrigation'},
 "Sandy Loam":{d:.80,note:'drains fairly fast with moderate retention'},
 "Loam":{d:.65,note:'balanced water retention and drainage'},
 "Silt Loam":{d:.50,note:'retains moisture well, moderate drainage'},
 "Clay Loam":{d:.35,note:'holds water well, slower drainage'},
 "Clay":{d:.20,note:'holds water tightly, drains poorly — waterlogging risk when over-irrigated'},
 "Alluvial":{d:.55,note:'fertile river-plain soil, good retention and fair drainage'},
 "Laterite":{d:.60,note:'iron-rich, well drained, nutrient-poor when eroded'},
 "Volcanic (Andosol)":{d:.60,note:'light, highly fertile, good moisture holding'},
 "Swamp / Waterlogged":{d:.05,note:'stands in water — suited only to paddy-type crops'}
};
/* each soil class is derived once, in one direction: d → behaviour. */
const SOILS=Object.freeze(Object.fromEntries(Object.entries(SOIL_TBL).map(([k,v])=>[k,Object.freeze({
  label:k,
  d:v.d,
  note:v.note,
  drainFlow:+(0.70+0.62*v.d).toFixed(2),   // fast-draining soil needs more irrigation
  excessPen:+(1.90-1.40*v.d).toFixed(2),   // wet soil punishes over-watering harder
  rainEff:+(0.32+0.22*(1-v.d)).toFixed(3), // tight soil credits rainfall more
  moistSwing:+(0.65+0.75*v.d).toFixed(2)   // how strongly moisture reacts to the balance
})])));

/* =====================================================================
   3. GROWTH STAGES · WEATHER SCENARIOS
   ===================================================================== */
const STAGES={
  initial    :{label:'Initial / Seedling',     waterSens:0.60,fertFactor:0.55,canopy:0.3},
  vegetative :{label:'Vegetative',             waterSens:0.85,fertFactor:1.20,canopy:0.6},
  flowering  :{label:'Flowering',              waterSens:1.35,fertFactor:0.90,canopy:0.8},
  mid        :{label:'Mid-season / Fruiting',   waterSens:1.15,fertFactor:1.00,canopy:1.0},
  late       :{label:'Maturity / Late',         waterSens:0.70,fertFactor:0.50,canopy:0.7}
};
const STAGE_ORDER=['initial','vegetative','flowering','mid','late'];
const WEATHER={
 normal  :{label:'☀️ Normal',        rain:0,  temp:0,  hum:0,  note:'Baseline conditions — no weather change applied.'},
 moderate:{label:'🌦️ Moderate Rain', rain:+30,temp:-1, hum:+5, note:'🌦 Moderate rain lowers the estimated irrigation requirement while slightly raising disease pressure.'},
 heavy   :{label:'🌧️ Heavy Rain',    rain:+70,temp:-2, hum:+8, note:'🌧 Heavy rainfall lowers the farm\'s irrigation requirement while increasing waterlogging and disease risk.'},
 heat    :{label:'🔥 Heat Wave',      rain:-10,temp:+7, hum:-10,note:'🔥 A heat wave raises evaporation and the crop\'s water requirement while adding heat stress.'},
 cold    :{label:'❄️ Cold Snap',      rain:+5, temp:-6, hum:+6, note:'❄️ A cold snap slows growth, delays maturity and can damage flowering and fruit set.'},
 dry     :{label:'🌵 Dry Spell',      rain:-18,temp:+3, hum:-18,note:'🌵 A dry spell raises crop water demand and spider-mite pressure at the same time.'},
 humid   :{label:'💨 Humid Surge',    rain:+12,temp:+1, hum:+18,note:'💨 A humidity surge sharply raises fungal pressure (blights, mildews, rusts).'},
 drought :{label:'🏜️ Drought Year',   rain:-30,temp:+3, hum:-8, note:'🏜️ A severe rainfall deficit — irrigation capacity and water cost become the limiting factors.'}
};

/* =====================================================================
   4. CROP KNOWLEDGE BASE — 58 crops (from Build B), enriched with the
      simulation parameters the digital-twin engine needs.
      Raw fields: t=temp band °C · h=humidity band % · r=seasonal water
      band mm · dr=drainage fitness band · ph=pH band · d=days to
      maturity · y=yield t/ha · p=price USD/kg · ch=other cost
      USD/acre/cycle.
   ===================================================================== */
const RAW_CROPS=[
{n:"Wheat",cat:"Cereal",t:[12,25],h:[40,65],r:[300,500],dr:[.45,.8],ph:[6,7.5],d:105,y:3.5,p:.26,ch:243},
{n:"Rice",cat:"Cereal",t:[20,35],h:[70,90],r:[1200,2000],dr:[.05,.55],ph:[5.5,6.5],d:120,y:4.5,p:.35,ch:304},
{n:"Maize (Corn)",cat:"Cereal",t:[18,27],h:[50,70],r:[500,800],dr:[.5,.85],ph:[5.5,7],d:100,y:6,p:.22,ch:263},
{n:"Barley",cat:"Cereal",t:[12,25],h:[35,60],r:[300,400],dr:[.5,.85],ph:[6,7.5],d:100,y:3,p:.24,ch:210},
{n:"Oats",cat:"Cereal",t:[15,25],h:[45,70],r:[400,600],dr:[.4,.8],ph:[5.5,6.5],d:135,y:3,p:.25,ch:202},
{n:"Sorghum",cat:"Cereal",t:[25,35],h:[30,60],r:[300,500],dr:[.45,.9],ph:[5.5,7.5],d:105,y:3.5,p:.23,ch:182},
{n:"Millet",cat:"Cereal",t:[25,35],h:[25,55],r:[200,400],dr:[.5,.95],ph:[5,7.5],d:75,y:1.5,p:.30,ch:142},
{n:"Rye",cat:"Cereal",t:[10,20],h:[35,60],r:[300,500],dr:[.5,.9],ph:[5,7],d:135,y:2.8,p:.25,ch:202},
{n:"Quinoa",cat:"Cereal",t:[15,20],h:[35,60],r:[300,500],dr:[.5,.9],ph:[6,7.5],d:105,y:2,p:1.20,ch:364},
{n:"Sugarcane",cat:"Cereal",t:[20,35],h:[60,85],r:[1500,2500],dr:[.35,.7],ph:[5.5,7.5],d:365,y:75,p:.038,ch:769},
{n:"Soybeans",cat:"Legume",t:[20,30],h:[50,75],r:[400,700],dr:[.5,.8],ph:[6,7],d:105,y:3,p:.45,ch:243},
{n:"Peas",cat:"Legume",t:[10,25],h:[45,70],r:[300,500],dr:[.5,.8],ph:[6,7.5],d:75,y:2,p:.35,ch:202},
{n:"Chickpeas",cat:"Legume",t:[15,25],h:[30,60],r:[200,400],dr:[.55,.85],ph:[6,7.5],d:105,y:1.8,p:.55,ch:182},
{n:"Lentils",cat:"Legume",t:[15,25],h:[35,65],r:[300,500],dr:[.5,.85],ph:[6,7.5],d:105,y:1.5,p:.70,ch:194},
{n:"Beans (common)",cat:"Legume",t:[18,28],h:[50,75],r:[400,600],dr:[.5,.8],ph:[6,7.5],d:75,y:2,p:.80,ch:223},
{n:"Cowpeas",cat:"Legume",t:[20,30],h:[30,60],r:[300,600],dr:[.5,.9],ph:[5.5,7],d:90,y:1.5,p:.60,ch:162},
{n:"Peanuts",cat:"Legume",t:[20,30],h:[45,70],r:[500,700],dr:[.6,.9],ph:[5.5,7],d:135,y:3,p:.70,ch:324},
{n:"Potatoes",cat:"Root & Tuber",t:[15,20],h:[50,70],r:[400,600],dr:[.55,.85],ph:[5,6.5],d:105,y:25,p:.20,ch:1295},
{n:"Cassava",cat:"Root & Tuber",t:[25,35],h:[60,85],r:[1000,1500],dr:[.5,.85],ph:[5.5,7],d:300,y:12,p:.12,ch:526},
{n:"Sweet Potatoes",cat:"Root & Tuber",t:[20,30],h:[55,80],r:[500,700],dr:[.55,.85],ph:[5.5,6.5],d:120,y:15,p:.25,ch:607},
{n:"Yams",cat:"Root & Tuber",t:[25,30],h:[65,90],r:[1000,1500],dr:[.45,.75],ph:[5.5,6.5],d:270,y:10,p:.40,ch:890},
{n:"Sugar Beet",cat:"Root & Tuber",t:[15,25],h:[40,70],r:[400,600],dr:[.45,.8],ph:[6,7.5],d:165,y:45,p:.06,ch:728},
{n:"Carrots",cat:"Root & Tuber",t:[15,25],h:[45,70],r:[300,500],dr:[.55,.85],ph:[6,6.8],d:80,y:30,p:.30,ch:1012},
{n:"Taro",cat:"Root & Tuber",t:[25,30],h:[70,90],r:[1500,2500],dr:[.05,.5],ph:[5.5,6.5],d:270,y:10,p:.35,ch:728},
{n:"Oil Palm",cat:"Oil & Fiber",t:[25,30],h:[75,95],r:[2000,2500],dr:[.4,.7],ph:[4,6],d:1400,y:20,p:.25,ch:486},
{n:"Sunflower",cat:"Oil & Fiber",t:[20,25],h:[40,65],r:[400,600],dr:[.5,.85],ph:[6,7.5],d:100,y:2,p:.50,ch:223},
{n:"Rapeseed / Canola",cat:"Oil & Fiber",t:[10,25],h:[45,70],r:[400,600],dr:[.45,.8],ph:[5.5,7],d:105,y:2.5,p:.48,ch:243},
{n:"Cotton",cat:"Oil & Fiber",t:[25,35],h:[45,70],r:[600,1200],dr:[.5,.85],ph:[5.5,7.5],d:165,y:2.5,p:.50,ch:445},
{n:"Flax",cat:"Oil & Fiber",t:[10,25],h:[40,65],r:[400,600],dr:[.45,.8],ph:[6,7.5],d:105,y:1.5,p:.70,ch:263},
{n:"Jute",cat:"Oil & Fiber",t:[20,35],h:[70,90],r:[1500,2000],dr:[.35,.7],ph:[6,7.5],d:135,y:2.5,p:.45,ch:243},
{n:"Hemp",cat:"Oil & Fiber",t:[15,27],h:[45,70],r:[400,700],dr:[.5,.85],ph:[6,7.5],d:105,y:8,p:.60,ch:283},
{n:"Bananas",cat:"Fruit",t:[25,30],h:[70,90],r:[1500,2500],dr:[.45,.75],ph:[5.5,7],d:330,y:30,p:.35,ch:1619},
{n:"Apples",cat:"Fruit",t:[8,24],h:[45,70],r:[600,800],dr:[.5,.8],ph:[5.5,7],d:1460,y:35,p:.60,ch:2226},
{n:"Oranges",cat:"Fruit",t:[15,30],h:[50,75],r:[1000,1500],dr:[.5,.8],ph:[5.5,7],d:1095,y:30,p:.40,ch:1416},
{n:"Mangoes",cat:"Fruit",t:[24,30],h:[50,75],r:[750,1200],dr:[.5,.85],ph:[5.5,7],d:1460,y:10,p:.60,ch:1012},
{n:"Grapes",cat:"Fruit",t:[25,32],h:[40,65],r:[500,800],dr:[.55,.9],ph:[5.5,6.5],d:1095,y:15,p:.90,ch:2428},
{n:"Pineapples",cat:"Fruit",t:[18,32],h:[65,85],r:[1000,1500],dr:[.6,.9],ph:[4.5,6.5],d:630,y:40,p:.40,ch:1700},
{n:"Papayas",cat:"Fruit",t:[22,30],h:[60,85],r:[1000,1500],dr:[.55,.85],ph:[6,7],d:330,y:40,p:.50,ch:1619},
{n:"Avocados",cat:"Fruit",t:[20,30],h:[50,75],r:[1000,1500],dr:[.55,.85],ph:[5.5,7],d:1460,y:12,p:1.20,ch:1619},
{n:"Guavas",cat:"Fruit",t:[23,28],h:[50,75],r:[1000,1000],dr:[.5,.85],ph:[5.5,7],d:910,y:15,p:.60,ch:890},
{n:"Pomegranates",cat:"Fruit",t:[20,30],h:[25,55],r:[400,600],dr:[.55,.9],ph:[5.5,7.5],d:1095,y:15,p:.90,ch:1012},
{n:"Dates",cat:"Fruit",t:[25,40],h:[20,45],r:[100,300],dr:[.6,.95],ph:[6,8],d:2190,y:8,p:2.00,ch:1214},
{n:"Tomatoes",cat:"Vegetable",t:[18,26],h:[60,75],r:[400,600],dr:[.55,.85],ph:[6,7],d:105,y:40,p:.35,ch:2428},
{n:"Onions",cat:"Vegetable",t:[13,25],h:[40,60],r:[300,500],dr:[.55,.9],ph:[6,7],d:120,y:25,p:.30,ch:1133},
{n:"Cabbage",cat:"Vegetable",t:[15,21],h:[50,75],r:[400,600],dr:[.5,.8],ph:[6,7],d:90,y:35,p:.25,ch:890},
{n:"Lettuce",cat:"Vegetable",t:[15,21],h:[55,75],r:[300,500],dr:[.5,.85],ph:[6,7],d:60,y:25,p:.50,ch:1214},
{n:"Cucumbers",cat:"Vegetable",t:[24,30],h:[65,85],r:[400,600],dr:[.55,.85],ph:[6,6.8],d:60,y:20,p:.45,ch:1416},
{n:"Peppers",cat:"Vegetable",t:[21,29],h:[60,80],r:[400,600],dr:[.55,.85],ph:[6,6.8],d:120,y:20,p:.70,ch:1821},
{n:"Spinach",cat:"Vegetable",t:[15,25],h:[50,75],r:[300,500],dr:[.5,.85],ph:[6,7.5],d:40,y:15,p:.50,ch:607},
{n:"Eggplant",cat:"Vegetable",t:[20,30],h:[55,75],r:[400,600],dr:[.55,.85],ph:[6,7],d:105,y:30,p:.40,ch:1214},
{n:"Okra",cat:"Vegetable",t:[20,30],h:[50,75],r:[400,600],dr:[.55,.9],ph:[6,7],d:75,y:10,p:.50,ch:728},
{n:"Pumpkins",cat:"Vegetable",t:[20,30],h:[50,75],r:[500,700],dr:[.55,.85],ph:[6,7],d:105,y:25,p:.25,ch:648},
{n:"Coffee (Arabica)",cat:"Beverage & Spice",t:[18,24],h:[60,75],r:[1500,2000],dr:[.45,.75],ph:[5.5,6.5],d:1275,y:1.5,p:3.50,ch:1012},
{n:"Tea",cat:"Beverage & Spice",t:[18,25],h:[70,90],r:[1200,2500],dr:[.4,.7],ph:[4.5,5.5],d:1460,y:8,p:.25,ch:728},
{n:"Cocoa",cat:"Beverage & Spice",t:[20,32],h:[70,90],r:[1200,2500],dr:[.4,.75],ph:[5,6.5],d:2015,y:1,p:3.50,ch:648},
{n:"Black Pepper",cat:"Beverage & Spice",t:[25,30],h:[70,90],r:[2000,2000],dr:[.45,.75],ph:[5.5,6.5],d:1275,y:1,p:4.50,ch:809},
{n:"Ginger",cat:"Beverage & Spice",t:[20,30],h:[70,85],r:[1500,1500],dr:[.5,.8],ph:[5.5,6.5],d:270,y:15,p:.90,ch:1214},
{n:"Alfalfa",cat:"Forage",t:[15,25],h:[40,70],r:[600,800],dr:[.5,.85],ph:[6.5,7.5],d:60,y:3,p:.18,ch:364}
];

/* FAO-56 style crop-coefficient profiles, assigned by crop class */
const KC_PROFILES={
 cereal  :{initial:.40,vegetative:.80,flowering:1.10,mid:1.15,late:.45},
 paddy   :{initial:1.05,vegetative:1.15,flowering:1.20,mid:1.25,late:1.00},
 cane    :{initial:.45,vegetative:.90,flowering:1.20,mid:1.25,late:.85},
 legume  :{initial:.45,vegetative:.80,flowering:1.10,mid:1.05,late:.40},
 root    :{initial:.50,vegetative:.85,flowering:1.10,mid:1.05,late:.70},
 oil     :{initial:.40,vegetative:.80,flowering:1.10,mid:1.05,late:.50},
 veg     :{initial:.60,vegetative:.85,flowering:1.05,mid:1.05,late:.80},
 leafy   :{initial:.55,vegetative:.80,flowering:1.00,mid:1.00,late:.90},
 orchard :{initial:.60,vegetative:.85,flowering:1.05,mid:1.10,late:.85},
 beverage:{initial:.60,vegetative:.85,flowering:1.00,mid:1.05,late:.90},
 forage  :{initial:.45,vegetative:.85,flowering:1.05,mid:1.00,late:.60}
};
const CAT_DEFAULTS={
 'Cereal'          :{profile:'cereal',  waterSens:1.15,fertSens:1.10,fertBase:5.6},
 'Legume'          :{profile:'legume',  waterSens:1.05,fertSens:0.90,fertBase:3.6},
 'Root & Tuber'    :{profile:'root',    waterSens:1.05,fertSens:1.10,fertBase:5.2},
 'Oil & Fiber'     :{profile:'oil',     waterSens:1.10,fertSens:1.20,fertBase:4.8},
 'Fruit'           :{profile:'orchard', waterSens:1.10,fertSens:1.05,fertBase:4.4},
 'Vegetable'       :{profile:'veg',     waterSens:1.10,fertSens:1.15,fertBase:4.6},
 'Beverage & Spice':{profile:'beverage',waterSens:1.15,fertSens:1.10,fertBase:4.2},
 'Forage'          :{profile:'forage',  waterSens:1.20,fertSens:1.20,fertBase:3.4}
};
/* per-crop overrides where the class default is agronomically wrong */
const CROP_OVERRIDES={
 'Rice'          :{profile:'paddy', waterSens:1.40,fertSens:1.20,fertBase:6.5},
 'Sugarcane'     :{profile:'cane',  waterSens:1.20,fertSens:1.25,fertBase:6.0},
 'Taro'          :{profile:'paddy', waterSens:1.30,fertSens:1.10,fertBase:4.5},
 'Lettuce'       :{profile:'leafy', fertBase:3.8},
 'Spinach'       :{profile:'leafy', fertBase:3.8},
 'Cabbage'       :{profile:'leafy', fertBase:4.2},
 'Potatoes'      :{waterSens:1.05,fertBase:5.5},
 'Cassava'       :{waterSens:0.90},
 'Millet'        :{waterSens:0.95},
 'Sorghum'       :{waterSens:0.95},
 'Dates'         :{waterSens:0.95},
 'Pomegranates'  :{waterSens:1.00},
 'Soybeans'      :{fertSens:0.85},
 'Peas'          :{fertSens:0.85},
 'Chickpeas'     :{fertSens:0.85},
 'Lentils'       :{fertSens:0.85},
 'Beans (common)':{fertSens:0.85},
 'Cowpeas'       :{fertSens:0.85},
 'Peanuts'       :{fertSens:0.90},
 'Alfalfa'       :{profile:'forage',waterSens:1.25,fertSens:1.05,fertBase:2.8},
 'Tomatoes'      :{fertBase:4.6},
 'Oil Palm'      :{profile:'orchard',fertBase:5.0}
};
const ICON_BY_NAME={
 'Rice':'🌾','Wheat':'🌾','Maize (Corn)':'🌽','Barley':'🌾','Oats':'🌾','Sorghum':'🌾','Millet':'🌾','Rye':'🌾',
 'Quinoa':'🌱','Sugarcane':'🎍','Soybeans':'🫘','Peanuts':'🥜','Peas':'🫛','Potatoes':'🥔','Cassava':'🍠',
 'Sweet Potatoes':'🍠','Yams':'🍠','Sugar Beet':'🍠','Carrots':'🥕','Taro':'🍠','Oil Palm':'🌴','Sunflower':'🌻',
 'Rapeseed / Canola':'🌼','Cotton':'🧵','Flax':'🧵','Jute':'🧵','Hemp':'🌿','Bananas':'🍌','Apples':'🍎',
 'Oranges':'🍊','Mangoes':'🥭','Grapes':'🍇','Pineapples':'🍍','Papayas':'🍈','Avocados':'🥑','Guavas':'🍐',
 'Pomegranates':'🍎','Dates':'🌴','Tomatoes':'🍅','Onions':'🧅','Cabbage':'🥬','Lettuce':'🥬','Cucumbers':'🥒',
 'Peppers':'🌶️','Spinach':'🥬','Eggplant':'🍆','Okra':'🥬','Pumpkins':'🎃','Coffee (Arabica)':'☕','Tea':'🍵',
 'Cocoa':'🍫','Black Pepper':'🌶️','Ginger':'🫚','Alfalfa':'🌿'
};
const ICON_BY_CAT={'Cereal':'🌾','Legume':'🫘','Root & Tuber':'🥔','Oil & Fiber':'🌿','Fruit':'🍎',
 'Vegetable':'🥬','Beverage & Spice':'☕','Forage':'🌿'};

function slug(s){return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
function cyclesAuto(c){return c.d>=365?1:Math.max(1,Math.min(4,Math.floor(365/c.d)));}

/* enrichment reads the raw record and returns a NEW simulation-ready one:
   the library stays immutable, so a view can never corrupt the knowledge base. */
function enrichCrop(c){
  const ov=CROP_OVERRIDES[c.n]||{}, cat=CAT_DEFAULTS[c.cat]||CAT_DEFAULTS['Cereal'];
  const profile=ov.profile||cat.profile;
  const season=Math.min(c.d,365);               // one simulated growing cycle
  return {
    key:slug(c.n),
    label:c.n,
    cat:c.cat,
    icon:ICON_BY_NAME[c.n]||ICON_BY_CAT[c.cat]||'🌱',
    profile,
    kc:KC_PROFILES[profile],
    waterSens:ov.waterSens!=null?ov.waterSens:cat.waterSens,
    fertSens:ov.fertSens!=null?ov.fertSens:cat.fertSens,
    fertBase:ov.fertBase!=null?ov.fertBase:cat.fertBase,
    excessTol:+clamp(0.25+1.0*c.dr[0],0.25,1.15).toFixed(2),   // low = tolerant of wet feet
    temp:c.t, hum:c.h, rain:c.r, pH:c.ph, dr:c.dr,
    cycle:c.d,                                  // days to maturity
    season,
    yrF:Math.min(1,season/365),
    cyclesPerYear:cyclesAuto(c),
    baseYield:Math.round(c.y*1000*ACP),         // kg per acre per cycle
    priceUSD:c.p,
    costUSD:c.ch,
    perennial:c.d>=365
  };
}
const CROPS=Object.freeze(RAW_CROPS.map(c=>Object.freeze(enrichCrop(c))));
const CROP=Object.freeze(Object.fromEntries(CROPS.map(c=>[c.key,c])));
const CROP_LIST=Object.freeze(CROPS.slice().sort((a,b)=>a.label.localeCompare(b.label)));
