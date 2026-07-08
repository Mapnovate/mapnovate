/* ================= CONFIG ================= */
const ZONES={2:'Educational',3:'Recreational',4:'Public Purpose',5:'Commercial',6:'Public Utilities',7:'Transportation',8:'Conservation',9:'Agriculture',10:'Water Body',11:'Low Density Residential',12:'Medium Density Residential',13:'High Density Residential',14:'Light Industrial',15:'Heavy Industrial'};
const ZCOL={2:'#4c7bd9',3:'#5cb46e',4:'#8e6fc1',5:'#d95448',6:'#3aa6a0',7:'#8a8f94',8:'#1f7a52',9:'#a9c47f',10:'#3d7dc4',11:'#f2e394',12:'#e8b45a',13:'#c97b3d',14:'#b06fc9',15:'#7d4bab'};
const CS={C:{c:'#2ecc80',t:'Compliant',long:'Declared use conforms to zoned class'},
          P:{c:'#e0a93b',t:'Conditional',long:'Permissible with planning conditions'},
          N:{c:'#d95448',t:'Non-Compliant',long:'Declared use conflicts with zoning'},
          U:{c:'#5b6770',t:'Undeclared',long:'No land use declared on register'},
          Z:{c:'#44515a',t:'Unzoned',long:'Outside gazetted zoning coverage'}};
const RD={P:{c:'#00a896',w:3.2,n:'Primary'},S:{c:'#f2a54a',w:2.2,n:'Secondary'},T:{c:'#98a6ad',w:1.4,n:'Tertiary'},M:{c:'#5b6770',w:.9,n:'Minor'},U:{c:'#4a5a63',w:.7,n:'Access/unclassified'}};
let role=null,user=null;

/* ================= THEME ================= */
let theme = (window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
const THEME = {
  dark:  {stroke:'#061530', hl:'#2ecc80', nofl:'#33506a', donutHole:'#0a2040', donutTxt:'#2ecc80', donutDim:'#9fb0c0'},
  light: {stroke:'#081d3a', hl:'#00a896', nofl:'#aebfc9', donutHole:'#ffffff', donutTxt:'#008576', donutDim:'#5b6770'}
};
function setTheme(t){
  theme = t;
  document.documentElement.dataset.theme = t;
  document.querySelectorAll('#themeBtnL,#themeBtnT').forEach(b=>{if(b)b.textContent = t==='light'?'☾':'☀'});
  if(window._applyThemeToMap) window._applyThemeToMap();
}
document.addEventListener('DOMContentLoaded',()=>{
  ['themeBtnL','themeBtnT'].forEach(id=>{const b=document.getElementById(id);
    if(b)b.onclick=()=>setTheme(theme==='dark'?'light':'dark');});
  setTheme(theme);
});


/* ================= LOGIN ================= */
let selRole='officer';
document.querySelectorAll('.role-btn').forEach(b=>b.onclick=()=>{document.querySelectorAll('.role-btn').forEach(x=>x.classList.remove('on'));b.classList.add('on');selRole=b.dataset.role;
  document.getElementById('u').value=selRole==='developer'?'guest':'';document.getElementById('pw').value=selRole==='developer'?'guest':'';});
function tryLogin(){
  const u=document.getElementById('u').value.trim(),p=document.getElementById('pw').value;
  const ok=(selRole==='officer'&&u==='admin'&&p==='kisumu2026')||(selRole==='developer'&&u==='guest'&&p==='guest');
  if(!ok){document.getElementById('loginErr').textContent='✗ Invalid credentials for selected role';return}
  role=selRole;user=u;
  document.getElementById('login').style.display='none';
  document.getElementById('topbar').style.display='flex';
  document.getElementById('rail').style.display='flex';
  document.getElementById('dashTab').style.display='flex';
  document.getElementById('uIni').textContent=u[0].toUpperCase();
  document.getElementById('uName').textContent=u==='admin'?'Admin':'Guest';
  document.getElementById('uRole').textContent=role==='officer'?'Land Officer':'Developer (read-only)';
  initApp();
}
document.getElementById('loginBtn').onclick=tryLogin;
document.getElementById('pw').addEventListener('keydown',e=>{if(e.key==='Enter')tryLogin()});
document.getElementById('logout').onclick=()=>location.reload();

/* ================= APP ================= */
let map,parcelLayer,started=false;
const layers={},layerOn={};
let measuring=false;
let styleMode='comp';
const filt={cs:new Set(),risk:new Set(),tn:new Set()};
let inspectList=JSON.parse('[]');

function toast(m){const t=document.getElementById('toast');t.textContent=m;t.style.display='block';clearTimeout(t._h);t._h=setTimeout(()=>t.style.display='none',2600)}

function initApp(){
  if(started){return} started=true;
  map=L.map('map',{preferCanvas:true,zoomControl:false,minZoom:10,maxZoom:20});
  L.control.zoom({position:'bottomleft'}).addTo(map);
  map.attributionControl.setPrefix('<b>Mapnovate</b> · Leaflet');
  L.control.scale({position:'bottomleft',imperial:false}).addTo(map);

  /* ---- basemaps ---- */
  const bms={
    dark:{name:'Survey Dark',layer:null,th:'linear-gradient(135deg,#0d2649,#061530)'},
    osm:{name:'OpenStreetMap',layer:L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}),th:'linear-gradient(135deg,#cfe3c2,#e8e4d8)'},
    sat:{name:'Esri Imagery',layer:L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'© Esri'}),th:'linear-gradient(135deg,#26402a,#3d3a28)'},
    carto:{name:'Carto Light',layer:L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{maxZoom:20,attribution:'© CARTO © OSM'}),th:'linear-gradient(135deg,#f4f4f2,#dfe3e6)'},
    cartoD:{name:'Carto Dark',layer:L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:20,attribution:'© CARTO © OSM'}),th:'linear-gradient(135deg,#1b1e21,#2c3136)'},
    topo:{name:'OpenTopo',layer:L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{maxZoom:17,attribution:'© OpenTopoMap'}),th:'linear-gradient(135deg,#d8e6c8,#c8d6e6)'}
  };
  let curBM = theme==='light' ? 'carto' : 'cartoD';
  let bmUserPicked=false;
  bms[curBM].layer.addTo(map);
  const grid=document.getElementById('bmGrid');
  Object.entries(bms).forEach(([k,b])=>{
    const btn=document.createElement('button');btn.className='bm-card'+(k===curBM?' on':'');
    btn.innerHTML=`<span class="th" style="background:${b.th}"></span><span class="nm">${b.name}</span>`;
    btn.onclick=()=>{bmUserPicked=true;if(bms[curBM].layer)map.removeLayer(bms[curBM].layer);curBM=k;if(b.layer)b.layer.addTo(map);
      document.querySelectorAll('.bm-card').forEach(x=>x.classList.remove('on'));btn.classList.add('on');};
    grid.appendChild(btn);
  });

  /* ---- helper styles ---- */
  const riskCol=f=>{const fl=f.properties.fl;if(fl.includes('R'))return '#3d7dc4';if(fl.includes('C'))return '#1f7a52';if(fl.includes('W'))return '#d95448';return THEME[theme].nofl};
  function pStyle(f){
    const p=f.properties;let fill=THEME[theme].nofl;
    if(styleMode==='comp')fill=CS[p.cs].c;
    else if(styleMode==='zone')fill=ZCOL[p.zc]||THEME[theme].nofl;
    else if(styleMode==='tenure')fill=p.tn==='FREEHOLD'?'#2ecc80':p.tn==='LEASEHOLD'?'#00a896':'#5b6770';
    else if(styleMode==='risk')fill=riskCol(f);
    const vis=passFilter(p);
    return {color:THEME[theme].stroke,weight:.6,fillColor:fill,fillOpacity:vis?(styleMode==='zone'?.55:.62):.05,opacity:vis?.9:.1};
  }
  function passFilter(p){
    if(filt.cs.size&&!filt.cs.has(p.cs))return false;
    if(filt.tn.size&&!filt.tn.has(p.tn||'—'))return false;
    if(filt.risk.size){
      let hit=false;
      if(filt.risk.has('W')&&p.fl.includes('W'))hit=true;
      if(filt.risk.has('R')&&p.fl.includes('R'))hit=true;
      if(filt.risk.has('C')&&p.fl.includes('C'))hit=true;
      if(filt.risk.has('D')&&Math.abs(p.dv)>15&&p.sz>0)hit=true;
      if(!hit)return false;
    }
    return true;
  }

  /* ---- vector layers ---- */
  const AOIb=L.geoJSON(D_aoi,{style:{color:'#00a896',weight:2,dashArray:'6 5',fill:false,opacity:.85}});
  const subloc=L.geoJSON(D_sublocations,{style:f=>{const d=f.properties.den||0;
      const c=d>8000?'#7a2f22':d>3000?'#b0592f':d>1000?'#c98a3d':d>300?'#c9b95e':'#5f7a58';
      return{color:THEME[theme].stroke,weight:.7,fillColor:c,fillOpacity:.35}},
    onEachFeature:(f,l)=>l.bindPopup(`<b>${f.properties.sub}</b><br>Location: ${f.properties.loc}<br>Pop. (2019 est): ${(+f.properties.pop).toLocaleString()}<br>Density: ${Math.round(f.properties.den||0).toLocaleString()}/km²<br>Growth: ${f.properties.gr??'—'}%/yr`)});
  const zoning=L.geoJSON(D_zoning,{style:f=>({color:THEME[theme].stroke,weight:.5,fillColor:ZCOL[f.properties.code]||'#666',fillOpacity:.5}),
    onEachFeature:(f,l)=>{const p=f.properties;l.bindPopup(`<b>${ZONES[p.code]}</b> <span style="opacity:.7">(class ${p.code})</span><br>${p.desc||''}<br><hr style="opacity:.3">GC ${p.gc||0}% · PR ${p.pr||0} · Max floors ${p.floors||'—'}<br>Min plot ${p.minplot||'—'} ha<br><i>${p.lpdp||''}</i>`)}});
  const contMaj=L.geoJSON(D_contours_major,{style:{color:'#8a6f3d',weight:1.1,opacity:.75},
    onEachFeature:(f,l)=>l.bindTooltip(f.properties.e+' m',{sticky:true})});
  const contMin=L.geoJSON(D_contours_minor,{style:{color:'#6b5a38',weight:.5,opacity:.5}});
  const river=L.geoJSON(D_river,{style:{color:'#4d9fd6',weight:2,opacity:.9},
    onEachFeature:(f,l)=>{if(f.properties.nm)l.bindTooltip(f.properties.nm,{sticky:true})}});
  const roadsMaj=L.geoJSON(D_roads_major,{style:f=>({color:RD[f.properties.rc].c,weight:RD[f.properties.rc].w,opacity:.95}),
    onEachFeature:(f,l)=>{if(f.properties.nm)l.bindTooltip(`${f.properties.nm} (${RD[f.properties.rc].n})`,{sticky:true})}});
  const roadsMin=L.geoJSON(D_roads_minor,{style:f=>({color:RD[f.properties.rc]?RD[f.properties.rc].c:'#54707a',weight:.8,opacity:.55})});
  const mkIcon=n=>L.divIcon({className:'mkicon',html:`<div style="font-size:16px;filter:drop-shadow(0 1px 2px #000)">${n}</div>`,iconSize:[18,18],iconAnchor:[9,9]});
  const markets=L.geoJSON(D_markets,{pointToLayer:(f,ll)=>L.marker(ll,{icon:mkIcon('🧺')}),
    onEachFeature:(f,l)=>l.bindPopup(`<b>${f.properties.nm}</b><br>${f.properties.ty||'Market centre'}`)});
  const beaches=L.geoJSON(D_beaches,{pointToLayer:(f,ll)=>L.marker(ll,{icon:mkIcon('⛵')}),
    onEachFeature:(f,l)=>l.bindPopup(`<b>${f.properties.nm}</b><br>Public beach · L. Victoria`)});
  const labels=L.geoJSON(D_labels,{pointToLayer:(f,ll)=>{const p=f.properties;
    return L.marker(ll,{interactive:false,icon:L.divIcon({className:'txtlbl',
      html:`<div style="font-size:${Math.max(9,Math.min(14,p.s+3))}px;transform:translate(-50%,-50%) rotate(${-p.a}deg)">${p.t}</div>`,iconSize:[0,0]})})}});

  parcelLayer=L.geoJSON(D_parcels,{style:pStyle,
    onEachFeature:(f,l)=>{l.on('click',()=>openAudit(f,l));
      l.on('mouseover',()=>{if(passFilter(f.properties))l.setStyle({weight:2,color:THEME[theme].hl})});
      l.on('mouseout',()=>{if(l!==selLayer)parcelLayer.resetStyle(l)});}});

  Object.assign(layers,{subloc,zoning,contMaj,contMin,parcels:parcelLayer,river,roadsMin,roadsMaj,markets,beaches,labels,aoi:AOIb});
  const LDEF=[
    ['parcels','Land parcels',true,'#2ecc80','5,292 registered plots'],
    ['zoning','Zoning (LPDP classes)',false,'#c97b3d','496 planning zones'],
    ['roadsMaj','Roads — classified',true,'#00a896','Primary · Secondary · Tertiary'],
    ['roadsMin','Roads — access network',false,'#54707a','15,726 segments · auto at zoom ≥ 15'],
    ['contMaj','Contours — index (25 m)',false,'#8a6f3d',''],
    ['contMin','Contours — 5 m',false,'#6b5a38','auto-declutter below zoom 15'],
    ['river','Rivers + 30 m riparian ref.',true,'#4d9fd6',''],
    ['markets','Markets',true,'#e0a93b','41 market centres'],
    ['beaches','Public beaches',false,'#4d9fd6',''],
    ['labels','Survey annotations',false,'#f2e9c8','street & place names · zoom ≥ 14'],
    ['subloc','Sub-locations (pop. density)',false,'#b0592f','2019 census estimates'],
    ['aoi','Planning area boundary',true,'#00a896','']
  ];
  const ll=document.getElementById('lyrList');
  LDEF.forEach(([k,name,on,sw,note])=>{
    layerOn[k]=on; if(on&&!gated(k))layers[k].addTo(map);
    const row=document.createElement('div');row.className='lyr-row custom-control custom-switch';
    row.innerHTML=`<input type="checkbox" class="custom-control-input" id="ck_${k}" ${on?'checked':''}><label class="custom-control-label" for="ck_${k}"><span class="sw" style="background:${sw}"></span>${name}</label>`;
    ll.appendChild(row);
    if(note){const n=document.createElement('div');n.className='lyr-note';n.textContent=note;ll.appendChild(n)}
    row.querySelector('input').onchange=e=>{layerOn[k]=e.target.checked;syncGated();};
  });
  function gated(k){const z=map.getZoom()||13;
    if(k==='roadsMin'||k==='contMin')return z<15;
    if(k==='labels')return z<14; return false;}
  function syncGated(){Object.keys(layers).forEach(k=>{
    const want=layerOn[k]&&!gated(k);
    if(want&&!map.hasLayer(layers[k]))layers[k].addTo(map);
    if(!want&&map.hasLayer(layers[k]))map.removeLayer(layers[k]);});
    // keep draw order sensible
    ['zoning','subloc'].forEach(k=>{if(map.hasLayer(layers[k]))layers[k].bringToBack()});
    ['parcels','roadsMaj','river','labels'].forEach(k=>{if(map.hasLayer(layers[k])&&layers[k].bringToFront)layers[k].bringToFront()});
  }
  map.on('zoomend',()=>{syncGated();document.getElementById('statZoom').textContent=map.getZoom()});
  map.on('mousemove',e=>{document.getElementById('statCoord').textContent=e.latlng.lat.toFixed(5)+'°, '+e.latlng.lng.toFixed(5)+'°'});
  map.fitBounds(parcelLayer.getBounds().pad(0.05));
  document.getElementById('statZoom').textContent=map.getZoom();
  syncGated();

  /* ---- panels ---- */
  const panels={btnLayers:'ppLayers',btnBase:'ppBase',btnFilter:'ppFilter'};
  Object.entries(panels).forEach(([b,p])=>{
    document.getElementById(b).onclick=()=>{const el=document.getElementById(p),was=el.classList.contains('open');
      document.querySelectorAll('.pop-panel').forEach(x=>x.classList.remove('open'));
      document.querySelectorAll('#rail .rail-btn').forEach(x=>x.classList.remove('on'));
      if(!was){el.classList.add('open');document.getElementById(b).classList.add('on')}};});
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{document.getElementById(b.dataset.close).classList.remove('open');document.querySelectorAll('#rail .rail-btn').forEach(x=>x.classList.remove('on'))});

  /* ---- symbology switch ---- */
  document.querySelectorAll('#styleSeg button').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('#styleSeg button').forEach(x=>x.classList.remove('on'));b.classList.add('on');
    styleMode=b.dataset.s;parcelLayer.setStyle(pStyle);renderLegend();});

  /* ---- filters ---- */
  const feats=D_parcels.features;
  const cnt=k=>feats.filter(f=>f.properties.cs===k).length;
  const fComp=document.getElementById('fComp');
  Object.entries(CS).forEach(([k,v])=>{if(!cnt(k))return;
    const c=document.createElement('button');c.className='btn btn-sm f-chip';c.type='button';
    c.innerHTML=`<span class="sw" style="width:9px;height:9px;border-radius:2px;background:${v.c}"></span>${v.t} <span class="f-count">${cnt(k).toLocaleString()}</span>`;
    c.onclick=()=>{c.classList.toggle('on');c.classList.contains('on')?filt.cs.add(k):filt.cs.delete(k);applyFilter()};fComp.appendChild(c);});
  const RISK=[['W','Road-reserve encroach.',feats.filter(f=>f.properties.fl.includes('W')).length],
    ['R','Riparian (30 m) conflict',feats.filter(f=>f.properties.fl.includes('R')).length],
    ['C','Conservation overlap',feats.filter(f=>f.properties.fl.includes('C')).length],
    ['D','Area deviation > 15 %',feats.filter(f=>Math.abs(f.properties.dv)>15&&f.properties.sz>0).length]];
  const fRisk=document.getElementById('fRisk');
  RISK.forEach(([k,t,n])=>{const c=document.createElement('button');c.className='btn btn-sm f-chip';c.type='button';
    c.innerHTML=`${t} <span class="f-count">${n.toLocaleString()}</span>`;
    c.onclick=()=>{c.classList.toggle('on');c.classList.contains('on')?filt.risk.add(k):filt.risk.delete(k);applyFilter()};fRisk.appendChild(c);});
  const fTen=document.getElementById('fTen');
  ['LEASEHOLD','FREEHOLD','—'].forEach(t=>{const n=feats.filter(f=>(f.properties.tn||'—')===t).length;if(!n)return;
    const c=document.createElement('button');c.className='btn btn-sm f-chip';c.type='button';c.innerHTML=`${t} <span class="f-count">${n.toLocaleString()}</span>`;
    c.onclick=()=>{c.classList.toggle('on');c.classList.contains('on')?filt.tn.add(t):filt.tn.delete(t);applyFilter()};fTen.appendChild(c);});
  document.getElementById('fClear').onclick=()=>{filt.cs.clear();filt.risk.clear();filt.tn.clear();
    document.querySelectorAll('#ppFilter .f-chip.on').forEach(x=>x.classList.remove('on'));applyFilter()};
  function applyFilter(){parcelLayer.setStyle(pStyle);
    const shown=feats.filter(f=>passFilter(f.properties)).length;
    document.getElementById('fShown').textContent=shown.toLocaleString()+' / '+feats.length.toLocaleString()+' parcels shown';
    document.getElementById('statSel').textContent=(filt.cs.size||filt.risk.size||filt.tn.size)?('filter: '+shown.toLocaleString()+' parcels'):'';}
  applyFilter();

  /* ---- search ---- */
  const sug=document.getElementById('suggest'),sIn=document.getElementById('search');
  sIn.addEventListener('input',()=>{
    const q=sIn.value.trim().toUpperCase();sug.innerHTML='';if(q.length<2){sug.style.display='none';return}
    const hits=[];
    for(const f of feats){const p=f.properties;
      if(p.lr.toUpperCase().includes(q))hits.push([f,p.lr,role==='officer'?p.pr:'']);
      else if(role==='officer'&&p.pr&&p.pr.toUpperCase().includes(q))hits.push([f,p.lr,p.pr]);
      if(hits.length>=12)break;}
    if(!hits.length){sug.innerHTML='<div class="list-group-item"><span class="sug-pr">No matching parcel in register</span></div>';sug.style.display='block';return}
    hits.forEach(([f,lr,pr])=>{const d=document.createElement('div');
      d.className='list-group-item list-group-item-action d-flex justify-content-between';
      d.innerHTML=`<span class="sug-lr">${lr}</span><span class="sug-pr">${pr||''}</span>`;
      d.onclick=()=>{sug.style.display='none';sIn.value=lr;zoomToFeature(f)};sug.appendChild(d);});
    sug.style.display='block';});
  document.addEventListener('click',e=>{if(!e.target.closest('#searchWrap'))sug.style.display='none'});

  function zoomToFeature(f){const l=findLayer(f);if(!l)return;
    map.fitBounds(l.getBounds().pad(0.6),{maxZoom:18});openAudit(f,l);}
  function findLayer(f){let out=null;parcelLayer.eachLayer(l=>{if(l.feature===f)out=l});return out}
  window._zoomLR=lr=>{const f=feats.find(x=>x.properties.lr===lr);if(f)zoomToFeature(f)};

  /* ---- audit panel ---- */
  let selLayer=null;
  const zoneByCode={};D_zoning.features.forEach(f=>{const c=f.properties.code;if(!zoneByCode[c])zoneByCode[c]=f.properties});
  function gauge(label,val,thresh,col){
    const pct=Math.min(100,val);
    return `<div class="gauge"><div class="g-top d-flex justify-content-between"><span>${label}</span><b style="color:${val>thresh?col:'var(--dim)'}">${val.toFixed(1)} %</b></div>
      <div class="progress"><div class="progress-bar" role="progressbar" aria-valuenow="${val.toFixed(1)}" aria-valuemin="0" aria-valuemax="100" style="width:${pct}%;background:${val>thresh?col:'#3f6a70'}"></div></div></div>`;
  }
  function openAudit(f,l){
    if(measuring)return;
    if(selLayer)parcelLayer.resetStyle(selLayer);
    selLayer=l;l.setStyle({weight:2.6,color:THEME[theme].hl});l.bringToFront();
    const p=f.properties,cs=CS[p.cs],zp=zoneByCode[p.zc];
    document.getElementById('auLR').textContent=p.lr||'(no LR number)';
    const masked=role!=='officer';
    const dev=p.dv,devBad=Math.abs(dev)>15&&p.sz>0;
    const zoneName=p.zc?ZONES[p.zc]:'— outside zoned area —';
    const flagged=inspectList.includes(p.lr);
    document.getElementById('auBody').innerHTML=`
      <div class="stampwrap"><div class="stamp" style="color:${cs.c};border-color:${cs.c}">
        <div class="big">${cs.t}</div><div class="sm">ZONING AUDIT · ${new Date().toISOString().slice(0,10)}</div></div></div>
      <table class="table table-sm table-bordered kv"><tbody>
        <tr><th scope="row">LR Number</th><td>${p.lr||'—'}</td></tr>
        <tr><th scope="row">Sheet No.</th><td>${p.sht||'—'}</td></tr>
        <tr><th scope="row">Plot size (reg.)</th><td>${p.sz?p.sz+' ha':'—'}</td></tr>
        <tr><th scope="row">Computed area</th><td>${p.ca} ha ${p.sz?`<span class="sizewarn" style="color:${devBad?'var(--bad)':'var(--faint)'}">(${dev>0?'+':''}${dev}% vs register)</span>`:''}</td></tr>
        <tr><th scope="row">Tenure</th><td>${p.tn||'—'}</td></tr>
        <tr><th scope="row">Proprietor</th><td>${masked?'<span class="masked">restricted — officer access only</span>':(p.pr||'—')}</td></tr>
        <tr><th scope="row">Declared use</th><td>${p.lu||'<span class="masked">none declared</span>'}</td></tr>
      </tbody></table>
      <div class="au-sec">Zoning Compliance</div>
      <div class="zone-card" style="border-left-color:${ZCOL[p.zc]||'#5b6770'}">
        <div class="zn">${zoneName} ${p.zc?`<span class="badge" style="border-color:${ZCOL[p.zc]};color:${ZCOL[p.zc]}">class ${p.zc}</span>`:''}</div>
        <div class="zd">${cs.long}. ${zp&&zp.desc?('Zone note: '+zp.desc+'.'):''}</div>
        ${zp?`<div class="zgrid">
          <div class="zg"><div class="n">${zp.gc||0}%</div><div class="l">Grd cover</div></div>
          <div class="zg"><div class="n">${zp.pr||0}</div><div class="l">Plot ratio</div></div>
          <div class="zg"><div class="n">${zp.floors||'—'}</div><div class="l">Max floors</div></div>
          <div class="zg"><div class="n">${zp.minplot||'—'}</div><div class="l">Min plot ha</div></div>
        </div>`:''}
      </div>
      <div class="au-sec">Encroachment Screen</div>
      ${gauge('Road-reserve overlap (statutory buffer)',p.rf,35,'var(--bad)')}
      ${gauge('Riparian overlap (30 m river buffer)',p.pf,5,'#4d9fd6')}
      <div style="font-size:11px;color:var(--faint);font-family:var(--mono);line-height:1.6;margin-top:2px">
        ${p.fl?('⚑ Flags: '+[...p.fl].map(x=>({W:'road-reserve encroachment',R:'riparian conflict',C:'conservation-zone overlap'})[x]).join(' · ')):'✓ No spatial conflict flags on this parcel'}
        ${devBad?'<br>⚠ Registered size deviates >15% from surveyed geometry — verify RIM sheet.':''}
      </div>
      <div class="au-actions">
        <button type="button" class="btn btn-sm btn-ghost flex-fill" onclick="copyReport()">⧉ Copy report</button>
        <button type="button" class="btn btn-sm btn-ghost flex-fill" onclick="window.print()">⎙ Print extract</button>
        ${role==='officer'?`<button type="button" class="btn btn-sm btn-brand flex-fill" id="flagBtn">${flagged?'✓ Flagged':'⚑ Flag for inspection'}</button>`:''}
      </div>`;
    if(role==='officer'){const fb=document.getElementById('flagBtn');
      fb.onclick=()=>{if(inspectList.includes(p.lr)){inspectList=inspectList.filter(x=>x!==p.lr);fb.textContent='⚑ Flag for inspection';toast('Removed from inspection list')}
        else{inspectList.push(p.lr);fb.textContent='✓ Flagged';toast('Added to inspection list ('+inspectList.length+')')}};}
    window._curReport=p;
    document.getElementById('audit').classList.add('open');
  }
  window.copyReport=()=>{const p=window._curReport;if(!p)return;
    const zp=zoneByCode[p.zc];
    const txt=`KISUMU CADASTRAL AUDIT EXTRACT\nLR NO: ${p.lr}\nSHEET: ${p.sht}\nSIZE (REG): ${p.sz} ha | COMPUTED: ${p.ca} ha (${p.dv}%)\nTENURE: ${p.tn}\nPROPRIETOR: ${role==='officer'?p.pr:'[RESTRICTED]'}\nDECLARED USE: ${p.lu||'NONE'}\nZONED: ${p.zc?ZONES[p.zc]+' (class '+p.zc+')':'UNZONED'}\nVERDICT: ${CS[p.cs].t.toUpperCase()}\nROAD RESERVE OVERLAP: ${p.rf}% | RIPARIAN: ${p.pf}%\nFLAGS: ${p.fl||'none'}\nGenerated ${new Date().toISOString()}`;
    navigator.clipboard.writeText(txt).then(()=>toast('Audit extract copied to clipboard'));};
  document.getElementById('auClose').onclick=()=>{document.getElementById('audit').classList.remove('open');
    if(selLayer){parcelLayer.resetStyle(selLayer);selLayer=null}};

  /* ---- dashboard ---- */
  const dEl=document.getElementById('dash');
  document.getElementById('dashTab').onclick=()=>dEl.classList.add('open');
  document.getElementById('dashClose').onclick=()=>dEl.classList.remove('open');
  const counts={};feats.forEach(f=>counts[f.properties.cs]=(counts[f.properties.cs]||0)+1);
  const totHa=feats.reduce((a,f)=>a+(f.properties.ca||0),0);
  // donut
  const cv=document.getElementById('donut'),ctx=cv.getContext('2d');
  const tot=feats.length;
  function drawDonut(){
    const T=THEME[theme];
    ctx.clearRect(0,0,150,150);
    let start=-Math.PI/2;
    Object.entries(CS).forEach(([k,v])=>{const n=counts[k]||0;if(!n)return;
      const ang=n/tot*2*Math.PI;ctx.beginPath();ctx.moveTo(75,75);ctx.arc(75,75,70,start,start+ang);ctx.closePath();
      ctx.fillStyle=v.c;ctx.fill();start+=ang;});
    ctx.beginPath();ctx.arc(75,75,44,0,7);ctx.fillStyle=T.donutHole;ctx.fill();
    ctx.fillStyle=T.donutTxt;ctx.font='600 22px Poppins,sans-serif';ctx.textAlign='center';
    ctx.fillText(Math.round((counts.C||0)/tot*100)+'%',75,72);
    ctx.fillStyle=T.donutDim;ctx.font='600 8px Poppins,sans-serif';ctx.fillText('COMPLIANT',75,88);
  }
  drawDonut();
  const sl=document.getElementById('statList');
  Object.entries(CS).forEach(([k,v])=>{const n=counts[k]||0;if(!n)return;
    sl.innerHTML+=`<div class="stat-row"><span class="sw" style="background:${v.c}"></span><span class="lb">${v.t}</span><span class="ct">${n.toLocaleString()}</span></div>`;});
  sl.innerHTML+=`<div class="stat-row" style="border-top:1px solid var(--line);padding-top:7px;margin-top:2px"><span class="lb">Registered area</span><span class="ct">${Math.round(totHa).toLocaleString()} ha</span></div>`;
  const nW=feats.filter(f=>f.properties.fl.includes('W')).length,
        nR=feats.filter(f=>f.properties.fl.includes('R')).length,
        nD=feats.filter(f=>Math.abs(f.properties.dv)>15&&f.properties.sz>0).length,
        nU=counts.U||0;
  const mc=document.getElementById('miniCards');
  [[nW,'Road-reserve encroachments','W'],[counts.N||0,'Zoning conflicts to review','csN'],
   [nD,'Register / survey area mismatch','D'],[nU,'Parcels with no declared use','csU']].forEach(([n,l,key])=>{
    const d=document.createElement('div');d.className='mini';d.innerHTML=`<div class="n">${n.toLocaleString()}</div><div class="l">${l}</div>`;
    d.onclick=()=>{document.getElementById('fClear').click();
      if(key==='W'||key==='D'){[...document.querySelectorAll('#fRisk .f-chip')].find(c=>c.textContent.includes(key==='W'?'Road':'deviation'))?.click()}
      else{const t=key==='csN'?'Non-Compliant':'Undeclared';[...document.querySelectorAll('#fComp .f-chip')].find(c=>c.textContent.includes(t))?.click()}
      toast('Filter applied — matching parcels highlighted');};
    mc.appendChild(d);});


  window._applyThemeToMap = ()=>{
    parcelLayer.setStyle(pStyle);
    layers.subloc.setStyle(layers.subloc.options.style);
    layers.zoning.setStyle(layers.zoning.options.style);
    drawDonut();
    if(!bmUserPicked){
      const want = theme==='light' ? 'carto' : 'cartoD';
      if(want!==curBM){
        if(bms[curBM].layer)map.removeLayer(bms[curBM].layer);
        curBM=want; bms[curBM].layer.addTo(map);
        const cards=document.querySelectorAll('.bm-card');
        cards.forEach(c=>c.classList.toggle('on', c.querySelector('.nm').textContent===bms[curBM].name));
      }
    }
  };

  /* ---- legend ---- */
  function renderLegend(){
    const el=document.getElementById('legend');let h='';
    if(styleMode==='comp'){h='<h3>Compliance</h3>'+Object.values(CS).map(v=>`<div class="lg-row"><span class="sw" style="background:${v.c}"></span>${v.t}</div>`).join('')}
    else if(styleMode==='zone'){h='<h3>Zoning class</h3>'+Object.entries(ZONES).map(([k,n])=>`<div class="lg-row"><span class="sw" style="background:${ZCOL[k]}"></span>${n}</div>`).join('')}
    else if(styleMode==='tenure'){h='<h3>Tenure</h3><div class="lg-row"><span class="sw" style="background:#00a896"></span>Leasehold</div><div class="lg-row"><span class="sw" style="background:#2ecc80"></span>Freehold</div><div class="lg-row"><span class="sw" style="background:#5b6770"></span>Unrecorded</div>'}
    else{h='<h3>Risk flags</h3><div class="lg-row"><span class="sw" style="background:#d95448"></span>Road-reserve encroach.</div><div class="lg-row"><span class="sw" style="background:#3d7dc4"></span>Riparian conflict</div><div class="lg-row"><span class="sw" style="background:#1f7a52"></span>Conservation overlap</div><div class="lg-row"><span class="sw" style="background:#5b6770"></span>No flags</div>'}
    h+='<h3 style="margin-top:8px">Roads</h3>'+['P','S','T'].map(k=>`<div class="lg-row"><span class="ln" style="background:${RD[k].c}"></span>${RD[k].n}</div>`).join('');
    el.innerHTML=h;
  }
  renderLegend();
  document.getElementById('btnLegend').onclick=function(){document.getElementById('legend').classList.toggle('open');this.classList.toggle('on')};
  document.getElementById('btnHome').onclick=()=>map.fitBounds(parcelLayer.getBounds().pad(0.05));

  /* ---- measure tool ---- */
  let mPts=[],mLine=null,mMarks=[];
  document.getElementById('btnMeasure').onclick=function(){
    measuring=!measuring;this.classList.toggle('on',measuring);
    map.getContainer().style.cursor=measuring?'crosshair':'';
    if(!measuring){mPts=[];if(mLine){map.removeLayer(mLine);mLine=null}mMarks.forEach(m=>map.removeLayer(m));mMarks=[];}
    else toast('Measure: click points on map · click tool again to clear');};
  map.on('click',e=>{if(!measuring)return;
    mPts.push(e.latlng);
    const mk=L.circleMarker(e.latlng,{radius:4,color:'#2ecc80',fillColor:'#2ecc80',fillOpacity:1}).addTo(map);mMarks.push(mk);
    if(mLine)map.removeLayer(mLine);
    if(mPts.length>1){mLine=L.polyline(mPts,{color:'#2ecc80',weight:2,dashArray:'5 4'}).addTo(map);
      let d=0;for(let i=1;i<mPts.length;i++)d+=mPts[i-1].distanceTo(mPts[i]);
      mLine.bindTooltip((d>=1000?(d/1000).toFixed(2)+' km':Math.round(d)+' m'),{permanent:true,className:'txtlbl'}).openTooltip();}});

  /* ---- export CSV ---- */
  document.getElementById('btnExport').onclick=()=>{
    const rows=[['LR_NO','SHEET','SIZE_HA_REG','SIZE_HA_CALC','DEV_PCT','TENURE','PROPRIETOR','DECLARED_USE','ZONE_CODE','ZONE','COMPLIANCE','ROAD_RES_PCT','RIPARIAN_PCT','FLAGS']];
    feats.filter(f=>passFilter(f.properties)).forEach(f=>{const p=f.properties;
      rows.push([p.lr,p.sht,p.sz,p.ca,p.dv,p.tn,role==='officer'?p.pr:'[RESTRICTED]',p.lu,p.zc,p.zc?ZONES[p.zc]:'',CS[p.cs].t,p.rf,p.pf,p.fl]);});
    const csv=rows.map(r=>r.map(c=>'"'+String(c==null?'':c).replace(/"/g,'""')+'"').join(',')).join('\n');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download='kisumu_parcel_register_'+new Date().toISOString().slice(0,10)+'.csv';a.click();
    toast('Exported '+(rows.length-1).toLocaleString()+' parcel records');};
}
