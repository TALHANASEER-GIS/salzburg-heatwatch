'use strict';
const $=id=>document.getElementById(id);
const state={indicator:'lst',municipality:'all',coverage:.8,opacity:.85,month:'2025-06',features:[],baseFeatures:[],filtered:[],selected:null,manifest:null,monthCache:new Map(),monthRequest:0};
const scales={lst:{key:'lst_mean_c',coverage:'lst_valid_fraction',title:'Surface temperature',unit:'°C',min:-10,max:50,ticks:[-10,10,30,50],colors:['#313695','#74add1','#ffffbf','#f46d43','#a50026']},ndvi:{key:'ndvi_mean',coverage:'ndvi_valid_fraction',title:'Vegetation NDVI',unit:'',min:-.2,max:.8,ticks:[-.2,0,.4,.8],colors:['#2166ac','#d8b365','#f5f5c4','#a6d96a','#006837']}};
let map,base,grid,boundaries,highlight,scatterPoints=[];
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const fmt=(v,n=1)=>finite(v)?v.toLocaleString('en-GB',{minimumFractionDigits:n,maximumFractionDigits:n}):'No data';
const monthInfo=()=>state.manifest?.months.find(m=>m.id===state.month);
const periodName=()=>state.month==='snapshot'?'25 June 2025 snapshot':monthInfo()?.label||state.month;
function fullSummary(){
  const m=monthInfo();if(m)return m.summary[state.municipality];
  const fs=state.features.filter(f=>state.municipality==='all'||f.properties.municipality===state.municipality),area=fs.reduce((a,f)=>a+f.properties.cell_area_m2,0),s={};
  for(const label of ['lst','ndvi'])s[label+'_valid_pct']=area?100*fs.reduce((a,f)=>a+f.properties.cell_area_m2*f.properties[label+'_valid_fraction'],0)/area:0;
  return s;
}
async function loadMonth(id){
  const request=++state.monthRequest;
  $('month').disabled=true;$('loading').hidden=false;$('loading').textContent='Loading '+(id==='snapshot'?'original snapshot':id)+' observations…';
  try{
    let values;
    if(id!=='snapshot'){
      const m=state.manifest.months.find(m=>m.id===id);if(!m)throw new Error('Unknown observation period.');
      if(!state.monthCache.has(id)){const response=await fetch('data/'+m.file);if(!response.ok)throw new Error('Could not load monthly observations.');const records=await response.json();if(records.length!==state.baseFeatures.length)throw new Error('Monthly cell count does not match the grid.');const table=new Map(records.map(r=>[r.cell_id,r]));if(table.size!==state.baseFeatures.length||state.baseFeatures.some(f=>!table.has(f.properties.cell_id)))throw new Error('Monthly cell IDs do not match the grid.');state.monthCache.set(id,table);}
      values=state.monthCache.get(id);
    }
    if(request!==state.monthRequest)return;
    state.month=id;
    state.features=state.baseFeatures.map(f=>({type:'Feature',geometry:f.geometry,properties:id==='snapshot'?{...f.properties}:{cell_id:f.properties.cell_id,municipality:f.properties.municipality,municipality_code:f.properties.municipality_code,cell_area_m2:f.properties.cell_area_m2,...values.get(f.properties.cell_id),period_start:id+'-01',period_end_exclusive:monthInfo()?.metadata.end_exclusive,composite_method:'Monthly median of valid daily medians',minimum_valid_days:2}}));
    const selectedID=state.selected?.properties.cell_id;
    state.selected=null;if(highlight){map.removeLayer(highlight);highlight=null;}
    $('month').value=id;$('periodTitle').textContent=periodName();
    $('periodSubtitle').textContent=id==='snapshot'?'NDVI: 18 Jun–2 Jul 2025':'Monthly median · ≥2 valid days/pixel';
    $('periodHint').textContent=id==='snapshot'?'Original acquisition + 15-day NDVI':'Median of clear, snow-free daily observations';
    $('temperature').querySelector('small').textContent=id==='snapshot'?'LANDSAT 9 · °C':'LANDSAT 8 + 9 · °C';
    $('error').hidden=true;$('searchStatus').textContent='';update();
    const selected=state.filtered.find(f=>f.properties.cell_id===selectedID);
    if(selected)selectCell(selected,false);else{$('emptySelection').hidden=false;$('cellDetails').hidden=true;}
  }catch(error){$('error').hidden=false;$('error').textContent=error.message+' The last successfully loaded period is retained.';$('month').value=state.month;}
  finally{if(request===state.monthRequest){$('month').disabled=false;$('loading').hidden=true;}}
}
function color(v,scale=scales[state.indicator]){if(!finite(v))return '#a6afa8';const t=Math.max(0,Math.min(1,(v-scale.min)/(scale.max-scale.min)))*(scale.colors.length-1),i=Math.min(scale.colors.length-2,Math.floor(t)),f=t-i;const a=scale.colors[i].slice(1),b=scale.colors[i+1].slice(1);return '#'+[0,2,4].map(k=>Math.round(parseInt(a.slice(k,k+2),16)*(1-f)+parseInt(b.slice(k,k+2),16)*f).toString(16).padStart(2,'0')).join('');}
function weighted(key,coverage){let sum=0,area=0;for(const f of state.filtered){const p=f.properties,w=p.cell_area_m2*p[coverage];if(finite(p[key])&&finite(w)&&w>0){sum+=p[key]*w;area+=w;}}return area?sum/area:null;}
function style(f){return {fillColor:color(f.properties[scales[state.indicator].key]),fillOpacity:state.opacity,color:'#ffffff',weight:.15,opacity:.25};}
function fit(){if(!boundaries)return;const fs=boundaries.toGeoJSON().features.filter(f=>state.municipality==='all'||f.properties.g_name===state.municipality);if(fs.length){const b=L.geoJSON(fs).getBounds();map.fitBounds(b,{padding:[20,20]});}}
function update(){
  const s=scales[state.indicator];
  state.filtered=state.features.filter(f=>{const p=f.properties;return(state.municipality==='all'||p.municipality===state.municipality)&&p[s.coverage]>=state.coverage;});
  if(state.selected&&!state.filtered.some(f=>f.properties.cell_id===state.selected.properties.cell_id))clearSelection();
  if(grid)map.removeLayer(grid);
  grid=L.geoJSON(state.filtered,{renderer:L.canvas({padding:.4}),style,onEachFeature:(f,l)=>{
    const p=f.properties;
    l.bindTooltip(`${p.municipality}<br><b>${fmt(p[s.key],state.indicator==='lst'?1:3)} ${s.unit}</b><br><small>Click for cell details</small>`,{sticky:true});
    l.on('click',()=>selectCell(f,false));
  }}).addTo(map);
  if(boundaries)boundaries.bringToFront();if(highlight)highlight.bringToFront();
  const summary=fullSummary(),lowLST=summary.lst_valid_pct<50,lowNDVI=summary.ndvi_valid_pct<50;
  $('meanLST').innerHTML=lowLST?'<em>Low coverage</em>':finite(weighted('lst_mean_c','lst_valid_fraction'))?`${fmt(weighted('lst_mean_c','lst_valid_fraction'))} <em>°C</em>`:'—';
  $('meanNDVI').innerHTML=lowNDVI?'<em>Low coverage</em>':finite(weighted('ndvi_mean','ndvi_valid_fraction'))?fmt(weighted('ndvi_mean','ndvi_valid_fraction'),3):'—';
  $('meanLST').nextElementSibling.textContent=lowLST?'Withheld: under 50% municipality coverage':'Valid-area weighted · selected cells';
  $('meanNDVI').nextElementSibling.textContent=lowNDVI?'Withheld: under 50% municipality coverage':'Valid-area weighted · selected cells';
  const area=state.filtered.reduce((n,f)=>n+f.properties.cell_area_m2,0);
  $('validCoverage').innerHTML=`${fmt(summary[state.indicator+'_valid_pct'],2)} <em>%</em>`;
  $('coverageCaption').textContent=`${state.indicator==='lst'?'Temperature':'NDVI'} · whole area before cell filter`;
  const notices=[];
  if(lowLST)notices.push(`temperature covers only ${fmt(summary.lst_valid_pct,2)}%`);
  if(lowNDVI)notices.push(`NDVI covers only ${fmt(summary.ndvi_valid_pct,2)}%`);
  $('qualityNotice').hidden=!notices.length;
  $('qualityNotice').textContent=notices.length?`${periodName()}: ${notices.join('; ')} of the selected municipality area. Representative-area means for those indicators are withheld. Local values remain available; blank areas are missing observations, not zero.`:'';
  $('cellCount').textContent=state.filtered.length.toLocaleString('en-GB');
  $('areaCaption').textContent=`${fmt(area/1e6,2)} km² · clipped grid parts`;
  $('mapTitle').textContent=s.title;
  $('mapSubtitle').textContent=state.month==='snapshot'?(state.indicator==='lst'?'Landsat 9 · 25 June 2025 · 100 m grid':'Sentinel-2 · 18 Jun–2 Jul 2025 · median · 100 m grid'):`${state.indicator==='lst'?'Landsat 8 + 9':'Sentinel-2'} · ${periodName()} median · 100 m grid`;
  $('legendTitle').textContent=s.title+(s.unit?' ('+s.unit+')':'');
  $('legendGradient').style.background=`linear-gradient(to right,${s.colors.join(',')})`;
  $('legendTicks').replaceChildren(...s.ticks.map(v=>{const e=document.createElement('span');e.textContent=v;return e;}));
  $('histTitle').textContent=state.indicator==='lst'?'Temperature distribution':'Vegetation distribution';
  for(const [id,ind]of [['temperature','lst'],['vegetation','ndvi']]){$(id).classList.toggle('chosen',state.indicator===ind);$(id).setAttribute('aria-pressed',state.indicator===ind);}
  drawHistogram();drawScatter();drawSeason();
}
function selectCell(f,zoom){
  state.selected=f;const p=f.properties;
  if(highlight)map.removeLayer(highlight);
  highlight=L.geoJSON(f,{style:{color:'#172e27',weight:3,fillColor:'#fff',fillOpacity:.08},interactive:false}).addTo(map);
  if(zoom)map.fitBounds(highlight.getBounds(),{maxZoom:16,padding:[55,55]});
  $('emptySelection').hidden=true;$('cellDetails').hidden=false;
  $('cellMunicipality').textContent=p.municipality;$('cellID').textContent=p.cell_id;
  $('cellLST').textContent=finite(p.lst_mean_c)?fmt(p.lst_mean_c)+' °C':'No data';
  $('cellNDVI').textContent=fmt(p.ndvi_mean,3);
  $('cellLSTCoverage').textContent=fmt(p.lst_valid_fraction*100)+'% valid area · '+(state.month==='snapshot'?'25 Jun 2025':fmt(p.lst_valid_days_mean,1)+' valid days/pixel (mean)');
  $('cellNDVICoverage').textContent=fmt(p.ndvi_valid_fraction*100)+'% valid area · '+(state.month==='snapshot'?'15-day composite':fmt(p.ndvi_valid_days_mean,1)+' valid days/pixel (mean)');
  $('cellArea').textContent=`Clipped cell area: ${fmt(p.cell_area_m2,0)} m²`;
  $('cellWarning').hidden=p.lst_valid_fraction>=.8&&p.ndvi_valid_fraction>=.8;
  drawScatter();
}
function clearSelection(){state.selected=null;if(highlight){map.removeLayer(highlight);highlight=null;}$('emptySelection').hidden=false;$('cellDetails').hidden=true;drawScatter();}
function drawHistogram(){
  const svg=$('histogram'),s=scales[state.indicator],values=state.filtered.map(f=>f.properties[s.key]).filter(finite);
  $('histCount').textContent=values.length.toLocaleString('en-GB')+' cells';
  if(!values.length){svg.innerHTML='<text x="280" y="90" text-anchor="middle" fill="#728079" font-size="12">No valid cells match these filters</text>';return;}
  // Include all valid values even when outside the map colour limits.
  const lo=Math.min(s.min,...values),hi=Math.max(s.max,...values),n=24,bins=Array(n).fill(0),maxX=hi===lo?lo+1:hi;
  values.forEach(v=>bins[Math.min(n-1,Math.floor((v-lo)/(maxX-lo)*n))]++);
  const max=Math.max(...bins,1),left=45,top=15,width=495,height=118;
  let markup='';
  for(let i=0;i<3;i++){const y=top+height-i*height/2;markup+=`<line x1="${left}" y1="${y}" x2="540" y2="${y}" stroke="#e9ede6"/><text x="37" y="${y+3}" text-anchor="end" font-size="9" fill="#819080">${Math.round(max*i/2)}</text>`;}
  bins.forEach((b,i)=>{const h=b/max*height;markup+=`<rect x="${left+i*width/n+1}" y="${top+height-h}" width="${width/n-2}" height="${h}" rx="2" fill="${color(lo+(i+.5)/n*(maxX-lo),s)}"><title>${fmt(lo+i/n*(maxX-lo),2)}–${fmt(lo+(i+1)/n*(maxX-lo),2)}: ${b} cells</title></rect>`;});
  for(let i=0;i<5;i++)markup+=`<text x="${left+i*width/4}" y="154" text-anchor="middle" font-size="9" fill="#819080">${fmt(lo+i*(maxX-lo)/4,state.indicator==='lst'?0:1)}</text>`;
  markup+=`<text x="290" y="175" text-anchor="middle" font-size="9" fill="#819080">${state.indicator==='lst'?'Surface temperature (°C)':'NDVI'}</text>`;
  svg.innerHTML=markup;
}
function drawSeason(){
  if(!state.manifest)return;
  const s=scales[state.indicator],months=state.manifest.months,left=53,right=971,top=15,bottom=115,lo=state.indicator==='lst'?-10:-.2,hi=state.indicator==='lst'?50:1;
  $('seasonTitle').textContent='A year of '+(state.indicator==='lst'?'surface temperature':'vegetation');
  let markup='';for(let i=0;i<4;i++){const y=bottom-i*(bottom-top)/3;markup+=`<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="#e5ebe1"/><text x="42" y="${y+4}" text-anchor="end" font-size="11" fill="#819080">${fmt(lo+i*(hi-lo)/3,state.indicator==='lst'?0:1)}</text>`;}
  let path='',connected=false;
  const points=months.map((m,i)=>{const summary=m.summary[state.municipality],coverage=summary[state.indicator+'_valid_pct'],value=summary[state.indicator+'_mean'];return {m,x:left+i*(right-left)/11,y:bottom-(value-lo)/(hi-lo)*(bottom-top),value,coverage,good:coverage>=50&&finite(value)};});
  for(const p of points){if(p.good){path+=(connected?'L':'M')+p.x+','+p.y+' ';connected=true;}else connected=false;}
  markup+=`<path d="${path}" fill="none" stroke="#34775d" stroke-width="2.5"/>`;
  for(const p of points){const selected=p.m.id===state.month;if(p.good)markup+=`<circle cx="${p.x}" cy="${p.y}" r="${selected?6:4}" fill="${selected?'#da713e':'#34775d'}" stroke="white" stroke-width="2"><title>${p.m.label}: ${fmt(p.value,state.indicator==='lst'?1:3)} ${s.unit}; ${fmt(p.coverage,1)}% coverage</title></circle>`;else markup+=`<circle cx="${p.x}" cy="${bottom}" r="5" fill="white" stroke="#c28b4d" stroke-width="2"><title>${p.m.label}: insufficient coverage (${fmt(p.coverage,2)}%)</title></circle>`;}
  $('seasonChart').innerHTML=markup;
  $('monthButtons').replaceChildren(...points.map(p=>{const b=document.createElement('button');b.textContent=p.m.label.slice(0,3);b.className=(p.m.id===state.month?'selected ':'')+(!p.good?'low':'');b.setAttribute('aria-pressed',p.m.id===state.month);b.title=p.m.label+' · '+fmt(p.coverage,2)+'% valid '+(state.indicator==='lst'?'temperature':'NDVI')+' coverage';b.onclick=()=>loadMonth(p.m.id);return b;}));
}
function drawScatter(){
  const canvas=$('scatter'),width=canvas.clientWidth||500,height=190,dpr=window.devicePixelRatio||1;
  canvas.width=width*dpr;canvas.height=height*dpr;
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);ctx.clearRect(0,0,width,height);
  const left=44,right=width-20,top=10,bottom=151;
  const points=state.filtered.filter(f=>finite(f.properties.ndvi_mean)&&finite(f.properties.lst_mean_c));
  const minX=Math.min(-.2,...points.map(f=>f.properties.ndvi_mean)),maxX=Math.max(1,...points.map(f=>f.properties.ndvi_mean)),minY=-10,maxY=Math.max(55,...points.map(f=>f.properties.lst_mean_c));
  ctx.font='9px "DM Sans",sans-serif';ctx.strokeStyle='#e7ece4';ctx.fillStyle='#829080';ctx.textAlign='right';
  for(let i=0;i<4;i++){const y=bottom-i*(bottom-top)/3;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();ctx.fillText(Math.round(minY+i*(maxY-minY)/3),left-8,y+3);}
  ctx.textAlign='center';for(let i=0;i<5;i++){const x=left+i*(right-left)/4;ctx.fillText((minX+i*(maxX-minX)/4).toFixed(1),x,bottom+15);}
  ctx.fillText('Vegetation NDVI',width/2,184);ctx.save();ctx.translate(11,82);ctx.rotate(-Math.PI/2);ctx.fillText('Surface temperature (°C)',0,0);ctx.restore();
  scatterPoints=points.map(f=>({f,x:left+(f.properties.ndvi_mean-minX)/(maxX-minX)*(right-left),y:bottom-(f.properties.lst_mean_c-minY)/(maxY-minY)*(bottom-top)}));
  ctx.fillStyle='rgba(52,112,82,.19)';for(const p of scatterPoints){ctx.beginPath();ctx.arc(p.x,p.y,1.6,0,Math.PI*2);ctx.fill();}
  if(!points.length){ctx.fillStyle='#728079';ctx.fillText('No paired observations',width/2,85);}
  if(state.selected){const p=scatterPoints.find(p=>p.f.properties.cell_id===state.selected.properties.cell_id);if(p){ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fillStyle='#da713e';ctx.fill();ctx.strokeStyle='#fff';ctx.stroke();}}
}
function downloadCSV(){
  if(!state.filtered.length){$('searchStatus').textContent='No cells match the filters to download.';return;}
  const keys=Object.keys(state.filtered[0].properties),escape=v=>v==null?'':'"'+String(v).replaceAll('"','""')+'"';
  const csv=[keys.join(','),...state.filtered.map(f=>keys.map(k=>escape(f.properties[k])).join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');a.href=url;a.download=`heatwatch_${state.month}_${state.municipality==='all'?'both':state.municipality}_${state.indicator}_coverage${state.coverage}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function init(){
  try{
    if(!window.L)throw new Error('The map library could not load. Please reload the page.');
    map=L.map('map',{zoomControl:true,preferCanvas:true,scrollWheelZoom:true}).setView([47.8,13.02],12);
    base=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
    base.on('tileerror',()=>{$('map').setAttribute('aria-description','Street tiles may be unavailable; the analysis grid remains interactive.');});
    const get=async path=>{const r=await fetch(path);if(!r.ok)throw new Error('Could not load '+path);return r.json();};
    const [cells,bounds,manifest]=await Promise.all([get('data/analysis_grid_100m.geojson'),get('data/municipal_boundaries.geojson'),get('data/monthly_manifest.json')]);
    if(cells.type!=='FeatureCollection'||!cells.features.length)throw new Error('The analysis grid is empty or invalid.');
    state.features=cells.features;state.baseFeatures=cells.features;state.manifest=manifest;
    if(manifest.months.length!==12)throw new Error('Expected twelve monthly observation periods.');
    for(const f of state.features){const p=f.properties;if(!p.cell_id||!finite(p.cell_area_m2)||p.cell_area_m2<=0)throw new Error('Invalid cell attributes in analysis data.');}
    boundaries=L.geoJSON(bounds,{style:{color:'#244f40',weight:1.6,fill:false,opacity:.85},interactive:false}).addTo(map);
    $('month').replaceChildren(...[...manifest.months.map(m=>({value:m.id,text:m.label})),{value:'snapshot',text:'Original 25 June snapshot'}].map(o=>{const e=document.createElement('option');e.value=o.value;e.textContent=o.text;return e;}));
    $('month').onchange=e=>loadMonth(e.target.value);
    await loadMonth('2025-06');fit();
    $('municipality').addEventListener('change',e=>{state.municipality=e.target.value;update();fit();});
    $('coverage').addEventListener('change',e=>{state.coverage=Number(e.target.value);update();});
    $('temperature').onclick=()=>{state.indicator='lst';update();};
    $('vegetation').onclick=()=>{state.indicator='ndvi';update();};
    $('opacity').oninput=e=>{state.opacity=Number(e.target.value)/100;$('opacityValue').textContent=e.target.value+'%';grid.setStyle(style);};
    $('basemap').onchange=e=>e.target.checked?base.addTo(map):map.removeLayer(base);
    $('fitMap').onclick=fit;
    $('reset').onclick=async()=>{state.municipality='all';state.coverage=.8;state.indicator='lst';state.opacity=.85;$('municipality').value='all';$('coverage').value='0.8';$('opacity').value=85;$('opacityValue').textContent='85%';$('basemap').checked=true;if(!map.hasLayer(base))base.addTo(map);$('cellSearch').value='';$('searchStatus').textContent='';clearSelection();await loadMonth('2025-06');fit();};
    $('clearSelection').onclick=clearSelection;
    $('searchForm').onsubmit=e=>{e.preventDefault();const id=$('cellSearch').value.trim(),f=state.filtered.find(f=>f.properties.cell_id===id);if(f){$('searchStatus').textContent='Cell found in current filters.';selectCell(f,true);}else $('searchStatus').textContent='Cell not found in current filters. Paste a full cell ID from the downloaded CSV.';};
    $('scatter').onclick=e=>{const r=e.currentTarget.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;let nearest=null,d=144;for(const p of scatterPoints){const n=(p.x-x)**2+(p.y-y)**2;if(n<d){d=n;nearest=p;}}if(nearest)selectCell(nearest.f,true);};
    $('download').onclick=downloadCSV;
    new ResizeObserver(()=>{map.invalidateSize();drawScatter();}).observe($('map'));
    window.addEventListener('resize',drawScatter);
  }catch(error){$('loading').hidden=true;$('error').hidden=false;$('error').textContent=error.message+' Your original exports have not been changed.';console.error(error);}
}
const openMethods=()=> $('methods').showModal();$('methodsButton').onclick=openMethods;$('learnButton').onclick=openMethods;$('closeMethods').onclick=()=>$('methods').close();$('methods').addEventListener('click',e=>{if(e.target===$('methods')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
init();
