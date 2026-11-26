/* Seestar S50 Simulator – s50-app.js
   Glue: the user interface (tabs, buttons, charts) and the main loop that keeps everything moving.
   Loaded last, so it can use everything from the other files. */
'use strict';

/* =====================================================================
   1. STATE
   ===================================================================== */
const mount=new SeestarMount();        // the telescope's motors & start-up logic (s50-model.js)
const stack=new Stacker();             // the live-stacking camera (s50-imaging.js)
const moonImg=new Image();moonImg.src='assets/moon.jpg';
let speed=10;                          // simulated seconds per real second
let selObj=null;                       // object chosen in the Plan tab
let pendingStack=false;                // "GoTo, then start stacking when we arrive"
let tzHours=-7;                        // local time zone of the chosen location (hours from UTC; daylight saving ignored)
let planFilter='up',curTab='scope';
const LOCS=[
  {n:'Phoenix, AZ – city',lat:33.448,lon:-112.074,tz:-7,b:8},
  {n:'Flagstaff, AZ – dark site',lat:35.198,lon:-111.651,tz:-7,b:3},
  {n:'Backyard, suburb (US East)',lat:40.0,lon:-75.0,tz:-5,b:6},
  {n:'New York, NY – inner city',lat:40.713,lon:-74.006,tz:-5,b:9},
  {n:'London, UK',lat:51.507,lon:-0.128,tz:0,b:8},
  {n:'Atacama desert, Chile – pristine',lat:-24.6,lon:-70.4,tz:-4,b:1},
  {n:'Sydney, Australia',lat:-33.87,lon:151.21,tz:11,b:7}
];

/* ---------- little helpers ---------- */
const pad2=n=>String(n).padStart(2,'0');
function toast(msg,ms=3800){const t=$('#toast');t.textContent=msg;t.classList.add('on');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('on'),ms);}
function fmtDur(s){s=Math.round(s);const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h?`${h} h ${m} min`:m?`${m} min ${s%60} s`:`${s} s`;}
const fmtRA=d=>{const h=norm360(d)/15;return `${Math.floor(h)}h ${pad2(Math.floor(h%1*60))}m`;};
const fmtDec=d=>`${d<0?'−':'+'}${Math.abs(d).toFixed(1)}°`;
function localDate(ms){return new Date(ms+tzHours*3600000);}                   // read it with the getUTC… methods
function localHour(ms){const d=localDate(ms);return d.getUTCHours()+d.getUTCMinutes()/60;}
function clockText(){const d=localDate(simMs),mon=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()];
  return `${mon} ${d.getUTCDate()} · ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;}
/* Set the simulated clock from a local date (yyyy-mm-dd) and hour (0–24) */
function setClock(dateStr,hour){const [y,m,d]=dateStr.split('-').map(Number);simMs=Date.UTC(y,m-1,d)+(hour-tzHours)*3600000;computeSky();onClockJump();}
function onClockJump(){stack.stop();stack.clear();pendingStack=false;}         // the sky moved: any stack in progress no longer matches
function tonightDateStr(){const d=localDate(Date.now());return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth()+1)}-${pad2(d.getUTCDate())}`;}
function setLocation(i){const L=LOCS[i];obs.lat=L.lat;obs.lon=L.lon;tzHours=L.tz;SKY.bortle=L.b;$('#loc').value=i;$('#bortle').value=L.b;syncSkyUi();}
function syncSkyUi(){
  $('#bortleV').textContent=`${SKY.bortle} · ${BORTLE_TXT[SKY.bortle]}`;$('#cloudV').textContent=Math.round(SKY.cloud*100)+'%';$('#humV').textContent=Math.round(SKY.humidity*100)+'%';
  $('#bortle').value=SKY.bortle;$('#cloud').value=Math.round(SKY.cloud*100);$('#hum').value=Math.round(SKY.humidity*100);
}

/* =====================================================================
   2. BUILDING THE STATIC UI
   ===================================================================== */
$('#boot').innerHTML=BOOT_STEPS.map(s=>`<li>${s.t}</li>`).join('');
$('#loc').innerHTML=LOCS.map((l,i)=>`<option value="${i}">${l.n}</option>`).join('');

/* ---- tabs ---- */
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;curTab=b.dataset.t;
  $$('#tabs button').forEach(x=>x.classList.toggle('on',x===b));$$('.pane').forEach(p=>p.classList.toggle('on',p.id==='p-'+curTab));if(curTab==='plan')renderList();});

/* ---- 3D view buttons ---- */
$('#views').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(!b)return;SC.setView(b.dataset.view);setViewBtn(b.dataset.view);});
function setViewBtn(v){$$('#views [data-view]').forEach(x=>x.classList.toggle('on',x.dataset.view===v));}
SC.onViewChange=setViewBtn;
$('#bBeam').onclick=()=>{SC.showBeam=!SC.showBeam;$('#bBeam').classList.toggle('on',SC.showBeam);};

/* ---- top bar ---- */
$('#speed').onchange=e=>{speed=+e.target.value;};
function setRed(on){document.body.classList.toggle('red',on);$('#red').checked=on;try{localStorage.setItem('s50red',on?'1':'0');}catch(_){}}
$('#red').onchange=e=>setRed(e.target.checked);
try{if(localStorage.getItem('s50red')==='1')setRed(true);}catch(_){}

/* ---- Telescope tab ---- */
$('#pwr').onclick=()=>{
  if(mount.power==='off'){mount.powerOn();toast('Starting up… the S50 levels itself and finds north on its own.');}
  else{mount.powerOff();stack.stop();stack.clear();pendingStack=false;}
};
$('#skip').onclick=()=>{mount.skipBoot();toast('Start-up skipped – the telescope is levelled and knows where north is.');};
$('#ext').onchange=e=>{mount.ext=e.target.checked;};
$('#dew').onchange=e=>{mount.dewHeater=e.target.checked;};
$('#armO').onclick=()=>{if(mount.ready)mount.coverTarget=1;else toast('Power on first.');};
$('#armC').onclick=()=>{if(mount.ready){mount.coverTarget=0;toast('Cover closed – the camera cannot see the sky.');}else mount.coverTarget=0;};
$('#park').onclick=()=>{if(!mount.ready)return toast('Power on first.');stack.stop();stack.clear();pendingStack=false;mount.park();};
$('#stop').onclick=()=>{mount.stop();pendingStack=false;stack.stop();};
$$('[data-jog]').forEach(b=>{
  const [x,y]=b.dataset.jog.split(',').map(Number);
  const down=e=>{e.preventDefault();if(!mount.ready)return toast('Power on and wait for start-up first.');stack.stop();stack.clear();pendingStack=false;mount.setJog(x,y);};
  const up=()=>{if(mount.jog.az||mount.jog.alt)mount.setJog(0,0);};
  b.addEventListener('pointerdown',down);b.addEventListener('pointerup',up);b.addEventListener('pointerleave',up);b.addEventListener('pointercancel',up);
});

/* ---- Plan tab ---- */
const PLAN_FILTERS=[['up','Up now'],['gal','Galaxies'],['neb','Nebulae'],['cl','Clusters'],['pl','Planets & Moon'],['all','All']];
$('#chipsF').innerHTML=PLAN_FILTERS.map(([k,t])=>`<button class="b sm${k===planFilter?' on':''}" data-f="${k}">${t}</button>`).join('');
$('#chipsF').addEventListener('click',e=>{const b=e.target.closest('[data-f]');if(!b)return;planFilter=b.dataset.f;$$('#chipsF button').forEach(x=>x.classList.toggle('on',x===b));renderList();});
$('#q').oninput=renderList;
const PLAN_TYPES=o=>o.type==='dso'||o.type==='planet'||o.type==='moon'||(o.type==='star'&&o.cat==='double');
function matches(o){
  const f=planFilter;
  if(f==='up'&&o.alt<20)return false;
  if(f==='gal'&&o.kind!=='gal')return false;
  if(f==='neb'&&o.kind!=='neb'&&o.kind!=='pn')return false;
  if(f==='cl'&&o.kind!=='oc'&&o.kind!=='gc')return false;
  if(f==='pl'&&o.type!=='planet'&&o.type!=='moon')return false;
  const q=$('#q').value.trim().toLowerCase();
  return !q||(o.name+' '+(o.con?CON_NAMES[o.con]||o.con:'')+' '+(o.kind||o.type)).toLowerCase().includes(q);
}
function renderList(){
  const list=OBJ.filter(o=>PLAN_TYPES(o)&&matches(o)).sort((a,b)=>((a.alt<15)-(b.alt<15))||(a.mag-b.mag)).slice(0,60);
  $('#olist').innerHTML=list.length?list.map(o=>`<div class="ob${selObj===o?' on':''}${o.alt<3?' dn':''}" data-id="${o.id}"><span class="nm">${o.name}</span><span class="al${o.alt>=20?' up':''}">${o.alt>=0?'↑':'↓'} ${o.alt.toFixed(0)}°</span></div>`).join(''):'<p class="mu">Nothing matches. Try “All”.</p>';
  renderDetail();
}
$('#olist').addEventListener('click',e=>{const r=e.target.closest('.ob');if(!r)return;selectObj(OBJ.find(o=>o.id===r.dataset.id));});
function selectObj(o){selObj=o;renderList();}
const KIND={gal:'Galaxy',neb:'Nebula',pn:'Planetary nebula',oc:'Open star cluster',gc:'Globular star cluster',planet:'Planet',moon:'Moon',star:'Double star'};
function fitText(o){
  if(o.type!=='dso')return o.type==='moon'?'The Moon is about as wide as 70% of the frame height.':o.type==='planet'?'A tiny disc, only a few pixels wide – the S50 is a wide-field scope, not a planet scope.':'A point of light.';
  const H=S50.fovH*60,s=o.size||1;
  return s<2?`Tiny (${s}′): just a small dot or fuzzy blob in the frame.`:s<=H?`Fits in the frame (${s}′ vs ${H.toFixed(0)}′ frame height).`:`Bigger than the frame (${s}′ vs ${H.toFixed(0)}′ tall) – you will only capture part of it.`;
}
function difficulty(o){return o.type==='planet'||o.type==='moon'?'Bright – easy':o.mag<=7?'Easy':o.mag<=10?'Moderate – needs minutes of stacking':'Hard – needs a dark sky and an hour or more';}
function renderDetail(){
  const o=selObj,box=$('#odet');
  if(!o){box.innerHTML='<span class="mu">Pick a target from the list. Objects marked ↑ green are well placed in the sky right now.</span>';return;}
  const tip=(o.kind==='neb'||o.kind==='pn')?'Emission nebulae glow in Hα/OIII light – the <b>dual-band filter</b> helps a lot, especially in a city.':o.kind==='gal'||o.kind==='gc'||o.kind==='oc'?'Galaxies and clusters shine in broadband light – use the <b>IR-cut</b> filter (the dual-band filter would dim them).':'';
  box.innerHTML=`<b>${o.name}</b> <span class="mu">· ${KIND[o.kind]||KIND[o.type]||o.type}${o.con?' in '+(CON_NAMES[o.con]||o.con):''}</span>
   <table><tr><td>Brightness</td><td>magnitude ${o.mag}${o.type==='dso'?' (smaller number = brighter)':''}</td></tr>
   <tr><td>Where now</td><td>altitude ${o.alt.toFixed(0)}° · azimuth ${o.az.toFixed(0)}°${o.alt<3?' <b style="color:var(--bad)">(below horizon)</b>':''}</td></tr>
   <tr><td>In the frame</td><td>${fitText(o)}</td></tr><tr><td>Difficulty</td><td>${difficulty(o)}</td></tr></table>
   ${tip?`<p class="sm">💡 ${tip}</p>`:''}
   <div class="row"><button class="b" id="goBtn">GoTo</button><button class="b on" id="goStk">GoTo &amp; start stacking</button></div>`;
  $('#goBtn').onclick=()=>doGoto(o,false);$('#goStk').onclick=()=>doGoto(o,true);
}
function doGoto(o,start){
  const r=mount.gotoObj(o);if(!r.ok)return toast(r.reason,5000);
  stack.stop();stack.clear();pendingStack=start;selObj=o;toast(`Going to ${o.name}…`);
}

/* ---- Stack tab ---- */
$('#stk').onclick=()=>{
  if(stack.on){stack.stop();return;}
  if(!mount.ready)return toast('Power on and wait for start-up first.');
  if(mount.mode==='track'){if(!stack.start(mount))toast('Could not start – is the telescope tracking?');return;}
  if(selObj)return doGoto(selObj,true);
  toast('Pick a target in the Plan tab first.');
};
$('#rst').onclick=()=>{const was=stack.on;stack.stop();stack.clear();if(was&&mount.mode==='track')stack.start(mount);};
$('#sav').onclick=()=>{try{const a=document.createElement('a');a.download='seestar-sim.png';a.href=$('#lv').toDataURL('image/png');a.click();}catch(_){toast('The browser would not let me save this picture (the Moon photo blocks it when opened from a file).');}};
$('#exp').onchange=e=>{stack.exposure=+e.target.value;};
$('#gain').oninput=e=>{stack.gain=+e.target.value;$('#gainV').textContent=e.target.value;};
$('#showMode').onchange=e=>{stack.mode=e.target.value;};
$('#br').oninput=e=>{stack.brightness=e.target.value/100;$('#brV').textContent=(e.target.value/100).toFixed(1)+'×';};
$('#flt').onchange=e=>{                               // a new filter means a new stack (the old photos used a different filter)
  const was=stack.on;stack.stop();stack.clear();stack.flt=e.target.value;if(was&&mount.mode==='track')stack.start(mount);
  toast(e.target.value==='lp'?'Dual-band filter: stars and galaxies get much dimmer, nebulae stay bright, city glow is mostly blocked.':'IR-cut filter: all visible light passes.',5200);
};

/* ---- Sky tab ---- */
$('#loc').onchange=e=>{const t=localHour(simMs),d=$('#date').value;setLocation(+e.target.value);setClock(d,t);};
$('#date').value=tonightDateStr();
$('#date').onchange=()=>setClock($('#date').value,+$('#hour').value);
$('#hour').oninput=()=>{$('#hourV').textContent=hourText(+$('#hour').value);setClock($('#date').value,+$('#hour').value);};
const hourText=h=>`${pad2(Math.floor(h)%24)}:${pad2(Math.round(h%1*60))}`;
$('#bortle').oninput=e=>{SKY.bortle=+e.target.value;syncSkyUi();stack.dirty=true;};
$('#cloud').oninput=e=>{SKY.cloud=e.target.value/100;syncSkyUi();};
$('#hum').oninput=e=>{SKY.humidity=e.target.value/100;syncSkyUi();};

/* ---- all-sky chart ---- */
const polarHits=[];
function drawPolar(){
  const cv=$('#polar'),g=cv.getContext('2d'),W=cv.width,cx=W/2,cy=W/2,R=W/2-14;polarHits.length=0;
  g.clearRect(0,0,W,W);g.fillStyle='#050813';g.beginPath();g.arc(cx,cy,R,0,6.2832);g.fill();
  g.strokeStyle='#26304f';g.lineWidth=1;for(const a of[0,30,60]){g.beginPath();g.arc(cx,cy,R*(90-a)/90,0,6.2832);g.stroke();}
  const P=(az,alt)=>{const r=R*(90-alt)/90;return [cx-r*Math.sin(az*D2R),cy-r*Math.cos(az*D2R)];};   // north up, east LEFT (as when you look up at the sky)
  g.fillStyle='#8f9bb8';g.font='13px system-ui';g.textAlign='center';g.textBaseline='middle';
  [['N',0],['E',90],['S',180],['W',270]].forEach(([t,az])=>{const [x,y]=P(az,-6);g.fillText(t,x,y);});
  for(const o of OBJ){
    if(o.alt<0)continue;
    if(o.type==='star'&&o.mag<3.6){const [x,y]=P(o.az,o.alt);g.fillStyle='#cdd8f5';g.beginPath();g.arc(x,y,Math.max(1,2.6-o.mag*.5),0,6.2832);g.fill();}
    else if(o.type==='dso'&&/^M\d+$/.test(o.id)){const [x,y]=P(o.az,o.alt);g.strokeStyle='#ff8a3d';g.lineWidth=1;g.beginPath();g.arc(x,y,3,0,6.2832);g.stroke();polarHits.push({o,x,y});}
    else if(o.type==='planet'){const [x,y]=P(o.az,o.alt);g.fillStyle={mercury:'#d8d0c8',venus:'#fff6d8',mars:'#ff9a70',jupiter:'#ffe6c0',saturn:'#f0dca0'}[o.id];g.beginPath();g.arc(x,y,4,0,6.2832);g.fill();polarHits.push({o,x,y});}
    else if(o.type==='moon'){const [x,y]=P(o.az,o.alt);g.fillStyle=`rgba(244,241,228,${.35+.65*o.illum})`;g.beginPath();g.arc(x,y,6,0,6.2832);g.fill();g.fillStyle='#8f9bb8';g.font='11px system-ui';g.fillText('Moon',x,y+13);polarHits.push({o,x,y});}
  }
  if(SUN.alt>-18){g.fillStyle='#ffd34d';const [x,y]=P(SUN.az,Math.max(SUN.alt,-5));g.beginPath();g.arc(x,y,6,0,6.2832);g.fill();g.fillStyle='#8f9bb8';g.font='11px system-ui';g.fillText('Sun ⚠',x,y+13);}
  if(selObj&&selObj.alt>0){const [x,y]=P(selObj.az,selObj.alt);g.strokeStyle='#4da3ff';g.lineWidth=2;g.beginPath();g.arc(x,y,9,0,6.2832);g.stroke();g.fillStyle='#4da3ff';g.font='12px system-ui';g.fillText(selObj.short||selObj.name,x,y-16);}
  if(mount.power!=='off'){const [x,y]=P(mount.az,mount.alt);g.strokeStyle='#35d8ff';g.lineWidth=1.5;g.strokeRect(x-6,y-6,12,12);g.beginPath();g.moveTo(x-12,y);g.lineTo(x+12,y);g.moveTo(x,y-12);g.lineTo(x,y+12);g.stroke();}
}
$('#polar').addEventListener('click',e=>{
  const r=e.target.getBoundingClientRect(),sx=$('#polar').width/r.width,x=(e.clientX-r.left)*sx,y=(e.clientY-r.top)*sx;
  let best=null,bd=18;for(const h of polarHits){const d=Math.hypot(h.x-x,h.y-y);if(d<bd){bd=d;best=h.o;}}
  if(best){selectObj(best);toast(`${best.name} selected – open the Plan tab to go there.`);}
});

/* ---- noise chart (Stack tab) ---- */
function drawNoise(){
  const cv=$('#nplot'),g=cv.getContext('2d'),W=cv.width,H=cv.height,L=34,B=22,T=8,Rr=8,N=stack.N,nmax=Math.max(60,Math.ceil(N*1.25/10)*10);
  g.clearRect(0,0,W,H);g.strokeStyle='#26304f';g.fillStyle='#8f9bb8';g.font='11px system-ui';g.lineWidth=1;
  g.beginPath();g.moveTo(L,T);g.lineTo(L,H-B);g.lineTo(W-Rr,H-B);g.stroke();
  const X=n=>L+(W-L-Rr)*n/nmax,Y=v=>T+(H-T-B)*(1-v);
  g.beginPath();for(let n=1;n<=nmax;n++){const x=X(n),y=Y(1/Math.sqrt(n));n===1?g.moveTo(x,y):g.lineTo(x,y);}g.strokeStyle='#ff8a3d';g.lineWidth=2;g.stroke();
  g.fillStyle='#8f9bb8';g.textAlign='right';g.fillText('100%',L-4,T+8);g.fillText('50%',L-4,Y(.5)+4);g.fillText('25%',L-4,Y(.25)+4);
  g.textAlign='center';g.fillText('photos stacked →',W/2,H-5);
  if(N>0){const x=X(N),y=Y(1/Math.sqrt(N));g.fillStyle='#4da3ff';g.beginPath();g.arc(x,y,5,0,6.2832);g.fill();g.textAlign=x>W-80?'right':'left';g.fillText(`${N} photos → noise ${(100/Math.sqrt(N)).toFixed(0)}%`,x+(x>W-80?-8:8),y-8);}
}

/* ---- Learn tab ---- */
const SCENARIOS=[
  {id:'orion',t:'🌆 Orion Nebula from a city',d:'Phoenix (Bortle 8), at the hour tonight when Orion is highest. First stack with the IR-cut filter for ~5 minutes, then switch to the dual-band filter and compare.',loc:0,id2:'M42'},
  {id:'andromeda',t:'🌌 Andromeda Galaxy from a dark site',d:'Flagstaff (Bortle 3). A galaxy is broadband light: try stacking it with BOTH filters and see what the dual-band one does.',loc:1,id2:'M31'},
  {id:'cloud',t:'☁ Thin clouds over the Pleiades',d:'55% cloud. See how transparency cuts the signal – and how much longer you must stack.',loc:1,id2:'M45',cloud:.55},
  {id:'dew',t:'💧 A dewy night',d:'90% humidity with the dew heater OFF. Watch the lens fog up (cyan "Dew" chip) and the picture dim. Then switch the heater on.',loc:1,id2:'M42',hum:.9}
];
$('#p-learn').innerHTML=`
 <h3>Try a scenario</h3><p class="mu sm">Each one sets the place, time and sky for you, then starts the telescope.</p>
 ${SCENARIOS.map(s=>`<button class="card b" style="width:100%;text-align:left;white-space:normal" data-scn="${s.id}"><b>${s.t}</b><br><span class="mu sm">${s.d}</span></button>`).join('')}
 <h3>Specifications</h3>
 <table>
  <tr><td>Optics</td><td>50 mm apochromatic triplet refractor, 250 mm focal length, f/5</td></tr>
  <tr><td>Camera</td><td>Sony IMX462 colour sensor, 1920 × 1080 pixels of 2.9 µm</td></tr>
  <tr><td>Pixel scale</td><td>${S50.scale.toFixed(2)} arcseconds per pixel</td></tr>
  <tr><td>Field of view</td><td>${S50.fovW.toFixed(2)}° × ${S50.fovH.toFixed(2)}° (the full Moon is ½°, so the Moon fits easily)</td></tr>
  <tr><td>Mount</td><td>Built-in motorized alt-az GoTo; self-levelling; plate-solving</td></tr>
  <tr><td>Filters</td><td>IR-cut and dual-band (Hα/OIII) light-pollution filter, on a filter wheel</td></tr>
  <tr><td>Extras</td><td>Auto-focus, dew heater, motorized front cover, built-in battery (about 6 h), Wi-Fi to your phone</td></tr>
 </table><p class="mu sm">Optics and sensor values are those of the original Seestar S50 (approximate) and may differ on the S50 Pro – I could not read the S50 Pro product page when building this. The 3D shape follows photos of the S50 Pro. This simulator is a teaching model, not a measurement of a real unit.</p>
 <h3>Ideas to understand</h3>
 <details open><summary>How does it know where to point? (plate solving)</summary><div>The S50 has no compass and doesn't need you to align on stars. It takes a photo, measures the pattern of stars in it, and matches that pattern against a star map. That tells it exactly where it is looking – <b>plate solving</b>. After every GoTo it takes one more photo to centre the target precisely (the "Centring" step you see in the Live view message). Compare with the C11, where <i>you</i> must centre stars by hand.</div></details>
 <details><summary>Why stack many short photos?</summary><div>Each 10 s photo is too noisy to show faint things. Averaging N photos cuts random noise by √N, while the real signal stays the same. That is why the picture slowly "clears" – see the chart in the Stack tab. Stacking also lets a small, light mount do deep-sky work: no photo needs to be long.</div></details>
 <details><summary>What is field rotation?</summary><div>An alt-az mount tips the telescope up/down and turns it left/right. As the sky turns, the picture slowly rotates around the target – fastest near the zenith or the meridian. Equatorial mounts avoid this. The S50 handles it in software: it rotates every photo to line up the stars. The cost is that the stack's corners lose data; watch the black corners grow over a long run.</div></details>
 <details><summary>Light pollution and the dual-band filter</summary><div>City glow is broadband (all colours), so it overwhelms faint broadband targets. The dual-band filter passes only two narrow colours (Hα red and OIII teal) where <i>emission nebulae</i> glow, blocking most city light. Nebulae pop; but galaxies, clusters and stars become very dim. Pick the filter to suit the target.</div></details>
 <details><summary>Why does it lose the target near the zenith?</summary><div>Straight overhead, an alt-az mount would need to spin the azimuth axis infinitely fast to follow the sky. The motors have a speed limit, so the S50 falls behind – a real weakness of alt-az mounts. Try targets that pass high overhead on a fast time setting.</div></details>
 <details><summary>Dew, Moon and clouds</summary><div>Dew fogs the lens on damp nights (the heater prevents it). A bright Moon adds glow to the sky, especially when it is close to your target. Clouds and low altitude (more atmosphere) both dim the light.</div></details>
 <details><summary>⚠ Safety: never point at the Sun</summary><div>Without a proper solar filter, sunlight focused by the lens can destroy the sensor in seconds – and is dangerous to eyes if anyone looks through it. The Sun is deliberately <b>not</b> in the target list. The simulator warns you if you steer near it.</div></details>
 <details><summary>Common beginner mistakes</summary><div><ul><li>Forgetting the front cover is closed (no stars, no plate solve).</li><li>Choosing a target below the horizon or very low (thick atmosphere).</li><li>Expecting nebulae to look like colourful photos after one minute – they need tens of minutes.</li><li>Using the dual-band filter on a galaxy.</li><li>Starting the stack, then bumping the telescope: a move discards the stack.</li></ul></div></details>
 <details><summary>Ideas to extend this simulator</summary><div>Mosaic mode, auto-focus and focus blur, satellite trails, real star catalogs (Gaia), saving FITS files, a solar-filter mode, or controlling a real telescope through a bridge.</div></details>
 <p class="sm"><a href="index.html" style="color:var(--ac)">← Back to the C11 simulator and telescope chooser</a></p>`;
$('#p-learn').addEventListener('click',e=>{const b=e.target.closest('[data-scn]');if(!b)return;runScenario(SCENARIOS.find(s=>s.id===b.dataset.scn));});
function runScenario(s){
  stack.stop();stack.clear();pendingStack=false;
  setLocation(s.loc);SKY.cloud=s.cloud||0;SKY.humidity=s.hum!=null?s.hum:.3;$('#dew').checked=false;mount.dewHeater=false;mount.dew=0;syncSkyUi();
  // Pick the darkest-sky hour tonight when the target is highest, so the scenario works in any season.
  const tgt=OBJ.find(o=>o.id===s.id2);let bestH=21,bestAlt=-99;
  for(let h=19;h<=29;h+=.5){setClock(tonightDateStr(),h);if(SUN.alt<-12&&tgt.alt>bestAlt){bestAlt=tgt.alt;bestH=h;}}
  const hh=bestH%24;$('#date').value=tonightDateStr();$('#hour').value=hh;$('#hourV').textContent=hourText(hh);setClock($('#date').value,bestH);
  $('#flt').value='ircut';stack.flt='ircut';
  mount.skipBoot();selObj=OBJ.find(o=>o.id===s.id2);
  const r=mount.gotoObj(selObj);if(r.ok){pendingStack=true;toast(`${s.t}: the telescope is slewing to ${selObj.name} and will start stacking. Open the Stack tab.`,6000);}
  else toast(`${selObj.name} is not above the horizon on a dark night at this time of year – pick another target in the Plan tab, or change the date in the Sky tab.`,8000);
  $$('#tabs button')[2].click();
}

/* =====================================================================
   3. LIVE VIEW  +  STATUS DISPLAYS
   ===================================================================== */
const off=document.createElement('canvas');off.width=IMG.w;off.height=IMG.h;const offCtx=off.getContext('2d'),offImg=offCtx.createImageData(IMG.w,IMG.h);
const lv=$('#lv'),lvc=lv.getContext('2d');
function drawLive(){
  const W=lv.width,H=lv.height;
  let msg='';
  if(mount.power==='off')msg='Telescope is off';
  else if(mount.power==='booting')msg='Starting up…';
  else if(!mount.coverOpen)msg='Front cover closed – open it to see the sky';
  else if(mount.mode==='slew'||mount.mode==='manual')msg=mount.mode==='manual'?'Moving…':'Slewing…';
  else if(mount.mode==='center')msg='Plate-solving…';
  else if(!mount.target)msg='Idle – pick a target in the Plan tab';
  const haveImg=!msg&&mount.mode!=='lost'&&stack.target===mount.target;
  lvc.imageSmoothingEnabled=true;
  if(haveImg&&stack.lunar){drawMoon(lvc,moonImg,mount);}
  else if(haveImg&&stack.T[0]!==undefined&&(stack.N>0||stack.sig)){
    if(stack.dirty){stack.render(offCtx,offImg);stack.dirty=false;}
    lvc.drawImage(off,0,0,W,H);
  }else{lvc.fillStyle='#02030a';lvc.fillRect(0,0,W,H);}
  // ---- overlay (drawn at full canvas resolution) ----
  lvc.fillStyle='rgba(205,225,255,.85)';lvc.font='600 22px system-ui';lvc.textAlign='center';lvc.textBaseline='middle';
  if(msg||mount.mode==='lost'){lvc.fillText(mount.mode==='lost'&&!msg?'Target lost':msg,W/2,H/2);}
  lvc.textAlign='left';lvc.textBaseline='top';lvc.font='600 18px system-ui';
  if(mount.target&&!msg){
    lvc.fillText(mount.target.name,12,10);lvc.font='16px system-ui';lvc.fillStyle='rgba(205,225,255,.7)';
    lvc.fillText(stack.N>0?`${stack.N} × ${stack.exposure}s = ${fmtDur(stack.tTotal)}`:'live preview (single photo)',12,34);
    if(stack.on){lvc.fillStyle='#ff4b3a';lvc.beginPath();lvc.arc(W-22,22,7,0,6.2832);lvc.fill();lvc.fillStyle='#fff';lvc.textAlign='right';lvc.fillText('STACKING',W-36,13);}
    // scale bar (10 arcminutes) and N/E arrows
    const px=10*60/IMG.scale*(W/IMG.w);lvc.strokeStyle='rgba(205,225,255,.8)';lvc.lineWidth=2;lvc.beginPath();lvc.moveTo(12,H-16);lvc.lineTo(12+px,H-16);lvc.stroke();
    lvc.fillStyle='rgba(205,225,255,.8)';lvc.textAlign='left';lvc.font='14px system-ui';lvc.fillText('10′',12,H-38);
    if(stack.ref){const q=stack.ref.q*D2R,ax=W-46,ay=H-46,L=26;
      const arrow=(vx,vy,t,col)=>{lvc.strokeStyle=col;lvc.fillStyle=col;lvc.beginPath();lvc.moveTo(ax,ay);lvc.lineTo(ax+vx*L,ay-vy*L);lvc.stroke();lvc.textAlign='center';lvc.textBaseline='middle';lvc.fillText(t,ax+vx*(L+10),ay-vy*(L+10));};
      arrow(Math.sin(q),Math.cos(q),'N','#ff8a7a');arrow(-Math.cos(q),Math.sin(q),'E','#9ec4ff');}
  }
  $('#liveMsg').textContent=(stack.reason&&stack.on?`Dropping photos: ${stack.reason}. `:'')+(mount.note||'');
}

/* status chips under the live view + the 3D HUD */
function updStatus(){
  const m=mount,mode={idle:'Idle',slew:'Slewing',center:'Centring',track:'Tracking',lost:'Lost target',manual:'Moving'}[m.mode];
  const chips=[];
  chips.push(m.power==='off'?['Off','']:m.power==='booting'?['Starting up','warn']:[mode,m.mode==='lost'?'bad':'ok']);
  if(m.power!=='off')chips.push([`🔋 ${Math.round(m.battery)}%${m.ext?' ⚡':''}`,m.battery<20?'bad':'']);
  if(m.dew>0.15)chips.push([`💧 Dew ${Math.round(m.dew*100)}%`,m.dew>.4?'bad':'warn']);
  if(SUN.alt>-12)chips.push([SUN.alt>0?'☀ Daylight':'🌅 Twilight',SUN.alt>-6?'bad':'warn']);
  if(SKY.cloud>.3)chips.push([`☁ ${Math.round(SKY.cloud*100)}% cloud`,'warn']);
  if(m.power==='ready'&&MOON.alt>0&&MOON.illum>.3&&angDistHor(m.alt,m.az,MOON.alt,MOON.az)<50)chips.push(['🌕 Moon glare','warn']);
  chips.push([FILTERS[stack.flt].name.split(' ')[0]+' filter','']);
  $('#chips').innerHTML=chips.map(([t,c])=>`<span class="chip ${c}">${t}</span>`).join('');
  const e=horToEq(m.alt,m.az,jdNow());
  $('#hud').innerHTML=`${m.power==='off'?'⏻ OFF':mode}${m.target?' · '+m.target.name:''}<br>Az ${m.az.toFixed(1)}°  Alt ${m.alt.toFixed(1)}°<span class="hx"><br>RA ${fmtRA(e.ra)}  Dec ${fmtDec(e.dec)}</span>`;
  $('#clock').textContent=`${LOCS.find(l=>l.lat===obs.lat)?.n.split(' –')[0]||'Custom'} · ${clockText()}`;
  // sun safety: close to the Sun with the cover open is dangerous for a real telescope
  if(m.power==='ready'&&m.coverOpen&&SUN.alt>-2&&angDistHor(m.alt,m.az,SUN.alt,SUN.az)<5){
    if(!updStatus.warned){updStatus.warned=true;toast('⚠ The telescope is pointing at the Sun! Without a solar filter this can destroy the sensor. Close the cover / park NOW.',9000);}
    m.note='⚠ POINTING AT THE SUN – close the cover!';
  }else updStatus.warned=false;
}
function updTelescopeTab(){
  const m=mount;
  $('#pwr').textContent=m.power==='off'?'⏻ Power on':'⏻ Power off';$('#pwr').classList.toggle('on',m.power!=='off');
  $('#pstate').textContent=m.power==='off'?'Off':m.power==='booting'?`Starting… step ${Math.min(m.step+1,BOOT_STEPS.length)} of ${BOOT_STEPS.length}`:'Ready';
  [...$('#boot').children].forEach((li,i)=>{li.className=m.power==='off'?'':i<m.step?'done':i===m.step?'now':'';});
  $('#battFill').style.width=m.battery+'%';$('#battFill').style.background=m.battery<20?'var(--bad)':'var(--ok)';
  $('#battTxt').textContent=`${Math.round(m.battery)}%${m.ext?' · charging/powered externally':m.power!=='off'?` · about ${(m.battery/(100/6)).toFixed(1)} h left`:''}`;
  $('#skip').style.display=m.power==='ready'?'none':'';
}
function updStackTab(){
  const m=mount,N=stack.N;
  $('#stk').textContent=stack.on?'⏸ Stop stacking':'▶ Start stacking';$('#stk').classList.toggle('on',!stack.on);
  const lim=stack.limitingMag(m),tr=transparency(m.alt,m.dew),sb=skyMagPerArcsec2(m.az,m.alt);
  $('#sstats').innerHTML=`<table>
    <tr><td>Photos stacked</td><td><b>${N}</b>${stack.dropped?` <span class="mu">(+${stack.dropped} dropped)</span>`:''}</td></tr>
    <tr><td>Total exposure</td><td>${fmtDur(stack.tTotal)}</td></tr>
    <tr><td>Cleaner than 1 photo</td><td>${N?'×'+Math.sqrt(N).toFixed(1):'–'}</td></tr>
    <tr><td>Faintest star seen</td><td>${lim==null?'–':'magnitude '+lim.toFixed(1)}</td></tr>
    <tr><td>Sky background</td><td>${sb.toFixed(1)} mag/arcsec² <span class="mu">(bigger = darker)</span></td></tr>
    <tr><td>Light getting through</td><td>${Math.round(tr*100)}% <span class="mu">(atmosphere, cloud, dew)</span></td></tr>
    <tr><td>Storage used</td><td>${(N*4.1/1000).toFixed(2)} GB of 64 GB</td></tr></table>`;
  if(curTab==='stack'){drawNoise();}
  const dq=stack.on||N>0?stack.rot:0;
  let rate=0;if(m.target){const e=horToEq(m.alt,m.az,jdNow()),j=jdNow();rate=wrap180(parallacticFromEq(e.ra,e.dec,j+1/1440)-parallacticFromEq(e.ra,e.dec,j));}
  $('#frot i').style.transform=`rotate(${dq}deg)`;
  $('#frTxt').innerHTML=`Rotated <b>${dq.toFixed(1)}°</b> since stacking began<br>Right now: <b>${rate.toFixed(2)}°/min</b>${Math.abs(rate)>1?' – <span style="color:var(--bad)">fast!</span>':''}`;
}
function updSkyTab(){
  drawPolar();
  const m=mount,a=m.power==='off'?60:m.alt,z=m.power==='off'?0:m.az;
  const phase=MOON.illum||0;
  $('#skyInfo').innerHTML=`<table>
    <tr><td>Sky brightness</td><td>${skyMagPerArcsec2(z,a).toFixed(1)} mag/arcsec² here</td></tr>
    <tr><td>Sun</td><td>${SUN.alt.toFixed(0)}° ${SUN.alt>0?'(daytime!)':SUN.alt>-18?'(twilight – sky still glowing)':'(dark)'}</td></tr>
    <tr><td>Moon</td><td>${Math.round(phase*100)}% lit, ${MOON.alt>0?'up at '+MOON.alt.toFixed(0)+'°':'below the horizon'}${MOON.alt>0?` · glare here ${Math.round(moonGlare(z,a)*100)}%`:''}</td></tr>
    <tr><td>Best for</td><td>${SKY.bortle<=3?'everything, including faint galaxies':SKY.bortle<=6?'bright objects; filter helps nebulae':'bright objects, planets, Moon; dual-band for nebulae'}</td></tr></table>`;
}

/* =====================================================================
   4. MAIN LOOP
   ===================================================================== */
let lastT=performance.now(),frameN=0,uiT=0,prevT=0;
function frame(now){
  requestAnimationFrame(frame);
  const dt=clamp((now-lastT)/1000,0,.05);lastT=now;frameN++;
  const simDt=dt*speed;simMs+=simDt*1000;
  computeSky();                                         // update every object's altitude/azimuth for the new time
  mount.update(dt,simDt);
  // GoTo-and-stack: begin stacking as soon as the mount is tracking
  if(pendingStack){if(mount.mode==='track'){if(stack.start(mount))pendingStack=false;}else if(mount.mode==='idle'||mount.mode==='manual'||mount.power==='off')pendingStack=false;}
  // live preview: one noisy photo, before stacking starts
  if(mount.mode==='track'&&stack.target!==mount.target&&!pendingStack)stack.prepare(mount);
  if(!stack.on&&stack.N===0&&mount.mode==='track'&&now-prevT>900){prevT=now;stack.preview(mount);stack.dirty=true;}
  stack.update(simDt,mount);
  if(mount.mode!=='track'&&mount.mode!=='lost'&&stack.target&&stack.target!==mount.target){stack.stop();stack.clear();}
  SC.update(mount,now/1000);
  if(frameN%30===0)SC.updateSky();
  drawLive();
  if(now-uiT>100){uiT=now;updStatus();updTelescopeTab();if(curTab==='stack')updStackTab();if(curTab==='sky')updSkyTab();if(curTab==='plan'&&frameN%50===0)renderList();}
}

/* =====================================================================
   5. START-UP
   ===================================================================== */
initScene($('#gl'));
new ResizeObserver(()=>SC.resize()).observe($('#stage'));
SC.setView('orbit');
setLocation(0);SKY.bortle=6;syncSkyUi();                // default: Phoenix, but a "bright suburban" sky so the first night looks decent
setClock(tonightDateStr(),21);$('#hour').value=21;$('#hourV').textContent='21:00';
selObj=OBJ.find(o=>o.id==='M42');renderList();
window.__s50={mount,stack,SKY,OBJ,doGoto,runScenario,setClock,get speed(){return speed;},set speed(v){speed=v;}};   // small debug hook for the browser console
requestAnimationFrame(frame);
