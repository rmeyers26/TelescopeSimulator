/* Seestar S50 Pro Simulator – s50-app.js
   The "phone app" and the device's controls: state, tabs, buttons, wizards, the album.
   The live view and the main loop are in s50-live.js (loaded after this file). */
'use strict';

/* =====================================================================
   1. STATE
   ===================================================================== */
const mount=new SeestarMount();                              // the telescope's motors, power and indicator lights (s50-model.js)
const sTele=new Stacker(CAM.tele,'tele');                    // telephoto live stack
const sWide=new Stacker(CAM.wide,'wide');                    // wide-angle stack / single Milky Way photo
const sTrail=new Stacker(CAM.wide,'trails');                 // star trails
const sLive=new Stacker(CAM.wide,'wide');sLive.exposure=3;   // wide-angle live view (for aiming)
const moonImg=new Image();moonImg.src='assets/moon.jpg';
const A={                                                    // what the app is currently showing / doing
  speed:10,mode:null,cam:'tele',zoom:1,cap:'photo',mw:'photo',lines:true,auto:true,stopped:false,tab:'device',
  filter:'best',jog:'medium',dist:30,albumTab:'seestar',saveSubs:false,sel:null,tz:-7,
  nfc:true,inet:true,signed:true,region:'intl',platform:'ios',wiz:'idle',goMark:null,snap:null,rec:null,viewItem:null,
  mwTarget:null,atlasFov:'wide',pb:null,mmCheck:[false,false,false,false]
};
const album=[],saved=new Set();                              // photos/videos on the device; ids that were downloaded to the "phone"
let pseudoSky=null;                                          // a SkyAtlas target (RA/Dec) whose alt/az we keep updating
const LOCS=[
  {n:'Phoenix, AZ – city',lat:33.448,lon:-112.074,tz:-7,b:8},
  {n:'Flagstaff, AZ – dark site',lat:35.198,lon:-111.651,tz:-7,b:3},
  {n:'Backyard, suburb (US East)',lat:40.0,lon:-75.0,tz:-5,b:6},
  {n:'New York, NY – inner city',lat:40.713,lon:-74.006,tz:-5,b:9},
  {n:'London, UK',lat:51.507,lon:-0.128,tz:0,b:8},
  {n:'Atacama desert, Chile – pristine',lat:-24.6,lon:-70.4,tz:-4,b:1},
  {n:'Sydney, Australia',lat:-33.87,lon:151.21,tz:11,b:7},
  {n:'Beijing, China – city',lat:39.9,lon:116.4,tz:8,b:9}
];
const MODES=[
  {k:'star',e:'🌌',t:'Stargazing',d:'Nebulae, galaxies, star clusters, comets – live stacking with the telephoto camera'},
  {k:'mw',e:'🌠',t:'Milky Way',d:'Wide-angle camera: Milky Way, star trails, constellation lines'},
  {k:'solar',e:'☀️',t:'Solar System',d:'The Sun (with solar filter!), Moon and planets'},
  {k:'scenery',e:'🐦',t:'Scenery',d:'Birds, wildlife and landscapes by day'}
];

/* ---------- little helpers ---------- */
const pad2=n=>String(n).padStart(2,'0');
function toast(msg,ms=4200){const t=$('#toast');t.textContent=msg;t.classList.add('on');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('on'),ms);}
function fmtDur(s){s=Math.round(s);const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h?`${h} h ${m} min`:m?`${m} min ${s%60} s`:`${s} s`;}
const fmtRA=d=>{const h=norm360(d)/15;return `${Math.floor(h)}h ${pad2(Math.floor(h%1*60))}m`;};
const fmtDec=d=>`${d<0?'−':'+'}${Math.abs(d).toFixed(1)}°`;
function localDate(ms){return new Date(ms+A.tz*3600000);}
function localHour(ms){const d=localDate(ms);return d.getUTCHours()+d.getUTCMinutes()/60;}
function clockText(){const d=localDate(simMs),mon=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()];return `${mon} ${d.getUTCDate()} · ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;}
function setClock(dateStr,hour){const [y,m,d]=dateStr.split('-').map(Number);simMs=Date.UTC(y,m-1,d)+(hour-A.tz)*3600000;computeSky();stopAllStacks(true);}
function tonightDateStr(){const d=localDate(Date.now());return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth()+1)}-${pad2(d.getUTCDate())}`;}
function setLocation(i){const L=LOCS[i];obs.lat=L.lat;obs.lon=L.lon;A.tz=L.tz;SKY.bortle=L.b;if($('#loc'))$('#loc').value=i;syncSkyUi();}
const hourText=h=>`${pad2(Math.floor(h)%24)}:${pad2(Math.round(h%1*60)%60)}`;
const SUN_OBJ=()=>OBJ.find(o=>o.id==='sun');
/* The telescope's own indicator lights, in words (manual §1.6) */
function ledText(m,led){
  const colr=led.col[0]>.9&&led.col[1]<.3?'Red':led.col[1]>.9&&led.col[0]<.4?'Green':'Yellow';
  if(m.bootFail>0)return 'Red light blinking + all four battery lights blinking fast: boot failed (battery too low).';
  if(m.power==='off')return m.charger!=='none'?'Charging: red lights flow; the blinking battery light is the one being charged.':m.battShow>0?'Battery lights show the charge: 1 light = 0–25 %, 2 = 26–50 %, 3 = 51–75 %, 4 = 76–100 %.':'All lights off. (A short press shows the battery level.)';
  if(m.power==='booting')return 'Red running light circling – powering on.';
  if(m.fwBusy>0)return `${colr} light blinking rapidly – firmware update in progress.`;
  if(m.link!=='connected')return m.activated?'Red light breathing slowly – powered on, waiting for a phone.':'Red light breathing rapidly – powered on but NOT activated yet.';
  if(m.mode==='lost')return `${colr} light blinking – something abnormal (target lost).`;
  return `${colr} light ${led.anim==='breath'?'breathing slowly (live stacking)':'steady (connected)'} – ${m.mountMode==='eq'?'EQ':'Alt-Az'} mode.`;
}

/* =====================================================================
   2. BUILDING THE PANES
   ===================================================================== */
const TABS=[['device','Device'],['home','Home'],['target','Target'],['image','Imaging'],['album','Album'],['sky','Sky'],['learn','Learn']];
$('#tabs').innerHTML=TABS.map(([k,t])=>`<button data-t="${k}"${k==='device'?' class="on"':''}>${t}</button>`).join('');
$('#panes').innerHTML=TABS.map(([k])=>`<div class="pane${k==='device'?' on':''}" id="p-${k}"></div>`).join('');
const GATE=`<div class="gate">📵 The phone app is not connected. Use the Device tab: power on (hold the button 2 s), then connect. (A running imaging session carries on without the phone.)</div>`;

/* ---- DEVICE ---- */
$('#p-device').innerHTML=`
 <h3>Power button &amp; lights</h3>
 <div class="row"><div id="pbtn" title="Press and hold"><div id="pring"></div>⏻</div>
  <div style="flex:1;min-width:150px"><div id="pstat"><b></b></div><div class="legend" id="ledTxt"></div></div></div>
 <p class="legend">Press and HOLD the button (mouse or finger). <b>Short press</b> while off: show battery. <b>Hold 2 s</b>: power on / off (the very first time: a short press, then hold 2 s). <b>Hold 6 s</b>: forced shutdown.</p>
 <div class="row"><button class="b sm" data-act="quick" title="Skip power-on, pairing, connection and initialization">⏩ Quick start (skip the set-up)</button></div>
 <div class="row"><div id="batt"><i id="battFill"></i></div><span id="battTxt" class="mu sm"></span></div>
 <div class="grid2" style="margin-top:6px">
  <label>USB-C charger<select id="chg" class="b" data-in="chg"><option value="none">None (battery only)</option><option value="normal">Normal 5 V 2 A</option><option value="fast">Fast 12 V 3 A</option></select></label>
  <label style="align-self:end" class="mu sm">Works while charging: use a power bank outdoors.</label>
 </div>
 <h3>Phone connection</h3><div id="wizBox"></div>
 <h3>Mount mode</h3><div id="mmBox"></div>
 <h3>Accessories &amp; care</h3>
 <label class="sw"><input type="checkbox" id="dew" data-in="dew"> Dew heater on <span class="mu sm">(uses a little more battery)</span></label>
 <div class="grid2" style="margin:6px 0"><label>Placed on<select id="surf" class="b" data-in="surf"><option value="grass">Grass (outdoors)</option><option value="patio">Stone patio</option><option value="table">A little table</option></select></label></div>
 <div class="row"><button class="b" data-act="solarOn">Attach magnetic solar filter</button><button class="b" data-act="solarOff">Remove solar filter</button><span id="solarTxt" class="mu sm"></span></div>
 <div class="row"><button class="b" data-act="bump" title="Walking around the tripod shakes the picture">Bump the tripod</button><button class="b" data-act="shutApp">Shut down from the app</button></div>
 <div id="dmgBox"></div>
 <details><summary>Reset</summary><div><button class="b bad" data-act="factory">Forget activation (replay first-time setup)</button></div></details>`;

/* ---- HOME ---- */
$('#p-home').innerHTML=GATE+`<div class="needs">
 <h3>Choose a mode</h3><div class="modes" id="modeCards">${MODES.map(m=>`<button class="mode" data-act="mode" data-arg="${m.k}"><span class="e">${m.e}</span><b>${m.t}</b><span class="mu">${m.d}</span></button>`).join('')}</div>
 <p class="mu sm" id="modeHelp">Pick a mode, then open the Target tab.</p>
 <h3>Phone</h3><div class="row"><button class="b" data-act="disc">Disconnect phone</button><span class="mu sm">An imaging session keeps going without the phone.</span></div>
 <h3>Swipe to shut down</h3><input type="range" id="swipe" min="0" max="100" value="0" data-in="swipe"><p class="mu sm">Slide all the way right. The lens returns to the zero position, then the S50 Pro switches off.</p></div>`;

/* ---- TARGET / IMAGING / ALBUM are rebuilt when the mode changes ---- */
/* ---- SKY ---- */
$('#p-sky').innerHTML=`
 <canvas id="polar" width="360" height="360" class="cv"></canvas>
 <p class="mu sm">All-sky chart: zenith (straight up) is the centre, the horizon is the outer ring. Tap an object to select it.</p>
 <h3>Where &amp; when</h3>
 <div class="grid2">
  <label>Location<select id="loc" class="b" data-in="loc">${LOCS.map((l,i)=>`<option value="${i}">${l.n}</option>`).join('')}</select></label>
  <label>Date<input type="date" id="date" class="b" data-in="date"></label>
  <label>Local time <b id="hourV"></b><input type="range" id="hour" min="0" max="24" step="0.25" data-in="hour"></label>
 </div>
 <h3>Sky &amp; weather</h3>
 <div class="grid2">
  <label>Light pollution <b id="bortleV"></b><input type="range" id="bortle" min="1" max="9" value="6" data-in="bortle"></label>
  <label>Clouds <b id="cloudV"></b><input type="range" id="cloud" min="0" max="100" value="0" data-in="cloud"></label>
  <label>Humidity (dew) <b id="humV"></b><input type="range" id="hum" min="0" max="100" value="15" data-in="hum"></label>
  <label>Temperature <b id="tempV"></b><input type="range" id="temp" min="-20" max="45" value="15" data-in="temp"></label>
  <label>Wind <b id="windV"></b><input type="range" id="wind" min="0" max="8" value="1" data-in="wind"></label>
  <label>Trees / buildings block below <b id="horV"></b><input type="range" id="hor" min="0" max="60" value="0" data-in="hor"></label>
 </div>
 <div id="skyInfo" class="card"></div>`;
function syncSkyUi(){
  $('#bortleV').textContent=`${SKY.bortle} · ${BORTLE_TXT[SKY.bortle]}`;$('#cloudV').textContent=Math.round(SKY.cloud*100)+'%';$('#humV').textContent=Math.round(SKY.humidity*100)+'%';
  $('#tempV').textContent=SKY.temp+' °C';$('#windV').textContent=`Force ${SKY.wind} · ${BEAUFORT[SKY.wind]}`;$('#horV').textContent=SKY.horizon+'°';
  $('#bortle').value=SKY.bortle;$('#cloud').value=Math.round(SKY.cloud*100);$('#hum').value=Math.round(SKY.humidity*100);$('#temp').value=SKY.temp;$('#wind').value=SKY.wind;$('#hor').value=SKY.horizon;
}

/* ---- TABS ---- */
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(b)openTab(b.dataset.t);});
function openTab(k){A.tab=k;A.vpref=null;applyViewer();$$('#tabs button').forEach(x=>x.classList.toggle('on',x.dataset.t===k));$$('.pane').forEach(p=>p.classList.toggle('on',p.id==='p-'+k));if(k==='target')renderTarget();if(k==='album')renderAlbum();}
/* ---- phone layout: the 3D model and the live view share one slot (see css/seestar.css) ---- */
const mq=matchMedia('(max-width:860px), (max-height:500px) and (orientation:landscape)');
function applyViewer(){                                       // which viewer is showing on a phone? Device tab → 3D (watch the lights); other tabs → live view; the buttons override
  const v=A.vpref||(A.tab==='device'?'3d':'live');document.body.classList.toggle('v3d',v==='3d');
  setTimeout(()=>{if(SC.resize)SC.resize();},30);
}
function layoutMode(){
  const m=mq.matches,app=$('#app'),stage=$('#stage'),main=$('#main');
  document.body.classList.toggle('mobile',m);
  if(m&&stage.parentElement!==app)app.prepend(stage);
  if(!m&&stage.parentElement!==main)main.prepend(stage);
  applyViewer();
}
if(mq.addEventListener)mq.addEventListener('change',layoutMode);else mq.addListener(layoutMode);
$('#vsw3d').onclick=()=>{A.vpref='live';applyViewer();};
$('#vswLive').onclick=()=>{A.vpref='3d';applyViewer();};
document.addEventListener('contextmenu',e=>{if(e.target.closest('#pbtn,.pad,#lvact,#lv,.vsw'))e.preventDefault();});   // a long press must not open the phone's context menu

/* ---- 3D view buttons, top bar ---- */
$('#views').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(!b)return;SC.setView(b.dataset.view);setViewBtn(b.dataset.view);});
function setViewBtn(v){$$('#views [data-view]').forEach(x=>x.classList.toggle('on',x.dataset.view===v));}
SC.onViewChange=setViewBtn;
$('#bBeam').onclick=()=>{SC.showBeam=!SC.showBeam;$('#bBeam').classList.toggle('on',SC.showBeam);};
$('#speed').onchange=e=>{A.speed=+e.target.value;};
function setRed(on){document.body.classList.toggle('red',on);$('#red').checked=on;try{localStorage.setItem('s50red',on?'1':'0');}catch(_){}}
$('#red').onchange=e=>setRed(e.target.checked);
try{if(localStorage.getItem('s50red')==='1')setRed(true);}catch(_){}
/* ---- live-view toolbar ---- */
$('#camSeg').addEventListener('click',e=>{const b=e.target.closest('[data-cam]');if(b)setCam(b.dataset.cam);});
function setCam(c){A.cam=c;$$('#camSeg button').forEach(x=>x.classList.toggle('on',x.dataset.cam===c));A.goMark=null;}
$('#zoomSeg').addEventListener('click',e=>{const b=e.target.closest('[data-zoom]');if(!b)return;A.zoom=+b.dataset.zoom;$$('#zoomSeg button').forEach(x=>x.classList.toggle('on',x===b));});

/* =====================================================================
   3. ACTIONS (buttons) and INPUTS (sliders, selects) – one dispatcher each
   ===================================================================== */
const ACT={
  mode:k=>setMode(k),
  disc(){mount.disconnect();A.wiz='idle';toast('Phone disconnected. The S50 Pro keeps doing whatever it was doing.');},
  shutApp(){if(mount.power==='off')return;mount.shutdown();stopAllStacks();toast('Shutting down: the lens returns to the zero position first.');},
  solarOn(){mount.solarFilter=true;toast('Magnetic solar filter attached to the front of the lens.');},
  solarOff(){const r=mount.removeSolarFilter();toast(r.ok?'Solar filter removed.':r.msg,6000);},
  bump(){mount.shake=25;toast('You bumped the tripod! Photos for the next ~25 s will be spoiled by vibration.');},
  factory(){mount.forgetActivation();mount.link='none';A.wiz='idle';toast('Activation forgotten. Next time you power on, repeat the first-time set-up.');},
  repair(){mount.damaged=false;mount.sunT=0;mount.note='Sensor replaced (reset).';toast('A new sensor was fitted. (Real life: a warranty-voiding repair!)');},
  // ---- phone connection wizard (manual §2.3 – 2.7) ----
  wConnect(){A.wiz='scan';},
  wCancel(){A.wiz='idle';},
  wPick(){A.wiz=!mount.paired?'pair':!mount.activated?'activate':'hotspot';},
  wReset(){A.wiz='activate';mount.paired=true;toast('Pairing confirmed with the reset button.');},
  wActivate(){
    const L=LOCS.find(l=>l.lat===obs.lat),inChina=L&&/China/.test(L.n);
    if(!A.inet||!A.signed)return toast('Activation needs an Internet connection on the phone and a signed-in ZWO account.',6000);
    if(A.region==='china'&&!inChina)return toast('The Mainland China version can only be activated in Mainland China, Hong Kong or Macao.',7000);
    if(A.region==='intl'&&inChina)toast('Note: you chose the International version while in China – fine, activation works.',5000);
    mount.activate();A.wiz='hotspot';toast('Activated! The phone now uses the S50 Pro’s own Wi-Fi hotspot, so no mobile signal is needed later.',6000);
  },
  wHotspot(){
    if(!mount.fwOk){A.wiz='fw';return;}
    mount.link='connected';A.wiz='idle';toast(`Connected to S50 Pro_${mount.serial}. Choose a mode.`);openTab('home');
  },
  wFw(){mount.fwBusy=6;mount.fwOk=true;A.wiz='fwbusy';toast('Updating firmware – do not use the telescope until it reboots.');setTimeout(()=>{if(mount.power!=='off'){mount.power='booting';mount.bootT=0;mount.link='none';A.wiz='idle';toast('Firmware updated. The S50 Pro rebooted – connect again.');}},6200);},
  wFwSkip(){mount.fwOk=true;ACT.wHotspot();},
  wNfc(){if(!A.nfc)return toast('This phone has no NFC. Use the normal Connect button.');mount.link='connected';A.wiz='idle';toast('NFC tap detected – connected and the Seestar app opened.');openTab('home');},
  // ---- EQ mode (manual §2.8.3) ----
  eqCalc(){const r=mount.calcPolarError();renderMM();toast(`Polar alignment error: azimuth ${r.az.toFixed(1)}°, altitude ${r.alt.toFixed(1)}°. Fine-tune until both are within 1°.`,6000);},
  eqSwitch(){const r=mount.switchMountMode('eq');if(!r.ok)return toast(r.msg,5000);stopAllStacks();renderMM();toast(mount.eqErrDeg()>1?'EQ mode on – but the polar alignment is poor (error above 1°), so tracking will wander and there will still be some field rotation.':'EQ mode on: tracking follows the Earth’s rotation with one motor. Field rotation is nearly gone!',7000);},
  altSwitch(){mount.switchMountMode('altaz');stopAllStacks();renderMM();},
  // ---- targets & imaging ----
  go(id){const o=id==='_sky'?pseudoSky:OBJ.find(x=>x.id===id);if(o)doGoto(o);},
  pick(id){A.sel=OBJ.find(x=>x.id===id);renderTarget();},
  filt(k){A.filter=k;renderTarget();},
  stk(){toggleStack();},
  rstStack(){const s=activeStack();const was=s.on;s.stop();s.clear();if(was&&mount.mode==='track')s.start(mount);},
  stop(){mount.stop();stopAllStacks();},
  park(){stopAllStacks();mount.park();},
  sunOk(){mount.confirmSolarFilter();toast('Solar filter confirmed. Continuing…');},
  atlasGo(){if(!A.mwTarget)return toast('Tap the sky atlas first to place the framing box.');pseudoSky=makeSkyTarget(A.mwTarget.ra,A.mwTarget.dec,A.mwTarget.name||'Atlas point');doGoto(pseudoSky);},
  atlasPre(i){const p=ATLAS_PRESETS[i];A.mwTarget={ra:p.ra,dec:p.dec,name:p.n};renderTarget();},
  scenery(az){doGoto(makePointTarget(6,az));A.cam='tele';setCam('tele');},
  shutter(){capture();},
  rec(){toggleRecord();},
  alb(t){A.albumTab=t;renderAlbum();},
  view(id){A.viewItem=album.find(x=>x.id===+id);renderAlbum();},
  closeView(){A.viewItem=null;renderAlbum();},
  dl(kind){downloadItem(A.viewItem,kind);},
  delItem(){const i=album.indexOf(A.viewItem);if(i>=0)album.splice(i,1);A.viewItem=null;renderAlbum();},
  scn(id){runScenario(SCENARIOS.find(s=>s.id===id));}
};
const INP={
  chg(v){mount.charger=v;},
  surf(v){SC.setSurface(v);try{localStorage.setItem('s50surf',v);}catch(_){}},
  dew(v,el){mount.dewHeater=el.checked;},
  swipe(v,el){if(+v>=98){ACT.shutApp();setTimeout(()=>{el.value=0;},300);}},
  loc(v){const t=localHour(simMs),d=$('#date').value;setLocation(+v);setClock(d,t);},
  date(){setClock($('#date').value,+$('#hour').value);},
  hour(v){$('#hourV').textContent=hourText(+v);setClock($('#date').value,+v);},
  bortle(v){SKY.bortle=+v;syncSkyUi();},cloud(v){SKY.cloud=v/100;syncSkyUi();},hum(v){SKY.humidity=v/100;syncSkyUi();},
  temp(v){SKY.temp=+v;syncSkyUi();},wind(v){SKY.wind=+v;syncSkyUi();},hor(v){SKY.horizon=+v;syncSkyUi();},
  exp(v){activeStack().exposure=+v;sTele.exposure=sWide.exposure=sTrail.exposure=+v;},
  flt(v){const was=sTele.on;sTele.stop();sTele.clear();sTele.flt=v;if(was&&mount.mode==='track')sTele.start(mount);
    toast(v==='duo'?'Duo-Band filter: stars and galaxies get much dimmer, emission nebulae stay bright, city glow is mostly blocked.':v==='dark'?'Dark filter: the light path is closed – this records pure sensor noise (a "dark frame").':'UV/IR-cut filter: all visible light passes.',5600);},
  show(v){sTele.mode=sWide.mode=sTrail.mode=v;sTele.dirty=sWide.dirty=sTrail.dirty=true;},
  bright(v){const b=v/100;sTele.brightness=sWide.brightness=sTrail.brightness=b;sTele.dirty=sWide.dirty=sTrail.dirty=true;if($('#brV'))$('#brV').textContent=b.toFixed(1)+'×';},
  auto(v,el){A.auto=el.checked;},
  subs(v,el){A.saveSubs=el.checked;},
  mwsub(v){stopAllStacks();A.mw=v;sWide.clear();sTrail.clear();renderImaging();},
  lines(v,el){A.lines=el.checked;},
  jog(v){A.jog=v;},
  dist(v){A.dist=+v;if($('#distV'))$('#distV').textContent=v+' m';},
  cap(v){A.cap=v;},
  plat(v){A.platform=v;renderWiz(true);},inet(v,el){A.inet=el.checked;},signed(v,el){A.signed=el.checked;},region(v){A.region=v;},nfc(v,el){A.nfc=el.checked;},
  eqchk(v,el){A.mmCheck[+el.dataset.i]=el.checked;mount.eq.legsOk=A.mmCheck.every(Boolean);},
  eqalt(v){mount.eq.wedgeAlt=+v;mount.eq.measured=null;if($('#eqAltV'))$('#eqAltV').textContent=(+v).toFixed(1)+'°';},
  eqaz(v){mount.eq.wedgeAz=+v;mount.eq.measured=null;if($('#eqAzV'))$('#eqAzV').textContent=(+v).toFixed(1)+'°';},
  q(){renderTarget();}
};
$('#panes').addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(b&&!b.disabled){ACT[b.dataset.act]&&ACT[b.dataset.act](b.dataset.arg,b);updAll(true);}});
$('#panes').addEventListener('input',e=>{const el=e.target.closest('[data-in]');if(el&&el.type==='range'&&INP[el.dataset.in])INP[el.dataset.in](el.value,el);});
$('#panes').addEventListener('change',e=>{const el=e.target.closest('[data-in]');if(el&&el.type!=='range'&&INP[el.dataset.in])INP[el.dataset.in](el.value,el);});
$('#panes').addEventListener('search',e=>{if(e.target.id==='q')renderTarget();});

/* ---- the physical power button: hold timings from the manual ---- */
(function(){
  const b=$('#pbtn');
  b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);A.pb={t:performance.now(),did2:false,did6:false};b.classList.add('hold');});
  const up=()=>{
    if(!A.pb)return;const held=performance.now()-A.pb.t;
    if(held<2000){mount.shortPress(performance.now());toast(mount.power==='off'?'Short press: the battery lights show the charge for a few seconds.':'Short press (nothing to do while on – hold 2 s to power off).',3500);}
    A.pb=null;b.classList.remove('hold');$('#pring').style.setProperty('--p','0deg');
  };
  b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);
})();
function tickPowerButton(){
  const p=A.pb;if(!p)return;const held=performance.now()-p.t;$('#pring').style.setProperty('--p',Math.min(360,held/6000*360)+'deg');
  if(held>=2000&&!p.did2){p.did2=true;const r=mount.longPress(performance.now());if(r.msg)toast(r.msg,5000);if(mount.power==='off'&&!r.ok&&mount.bootFail<=0){p.did2=false;p.t=performance.now()-1000;}}
  if(held>=6000&&!p.did6){p.did6=true;mount.forceOff();stopAllStacks();toast('Forced shutdown (6 s hold). The lens did NOT return to the zero position.',5000);}
}

/* =====================================================================
   4. TARGETS, GOTO, MODES
   ===================================================================== */
function makeSkyTarget(ra,dec,name){const h=eqToHor(ra,dec,jdNow());return {id:'sky',name,type:'sky',kind:'sky',cra:ra,cdec:dec,ra,dec,mag:99,alt:h.alt,az:h.az};}
function makePointTarget(alt,az){return {id:'pt',name:'Pointed direction',type:'point',kind:'point',alt,az,mag:99};}
function updatePseudo(){if(pseudoSky){const h=eqToHor(pseudoSky.cra,pseudoSky.cdec,jdNow());pseudoSky.az=h.az;pseudoSky.alt=h.alt;}}
function doGoto(o){
  if(A.mode==='star'&&o.type==='sun'){toast('The Sun is in Solar System mode, with the solar filter procedure.');return;}
  const r=mount.gotoObj(o);if(!r.ok){toast(r.reason,6000);return false;}
  stopAllStacks(true);A.stopped=false;A.sel=o.type==='sky'||o.type==='point'?A.sel:o;
  toast(o.type==='sun'?'Lens lifting… stay with the telescope: you will be asked to attach the solar filter.':`Going to ${o.name}…`);return true;
}
function setMode(k){
  if(!mount.ready)return toast('Connect the phone app first (Device tab).');
  A.mode=k;A.stopped=false;stopAllStacks();
  setCam(k==='mw'?'wide':'tele');
  $$('#modeCards .mode').forEach(c=>c.classList.toggle('on',c.dataset.arg===k));
  $('#modeHelp').textContent=MODES.find(m=>m.k===k).d;
  renderTarget();renderImaging();openTab('target');
}
/* "Tonight's Best": well placed, reasonably bright, not too big for the frame */
function tonightsBest(){
  const sc=o=>-o.mag+o.alt/30+((o.size||0)>=5?0.5:0)+(['M31','M42','NGC104'].includes(o.id)?1:0);
  return OBJ.filter(o=>o.type==='dso'&&o.alt>=Math.max(35,SKY.horizon+8)&&o.mag<=9.5&&(o.size||0)>=2.5&&(o.size||0)<=160).sort((a,b)=>sc(b)-sc(a)).slice(0,8);
}
const KIND={gal:'Galaxy',neb:'Nebula',pn:'Planetary nebula',oc:'Open star cluster',gc:'Globular star cluster',planet:'Planet',moon:'Moon',sun:'Sun',star:'Double star'};
function fitText(o){
  const W=CAM.tele.fovShort*60,H=CAM.tele.fovLong*60;
  if(o.type==='sun'||o.type==='moon')return `About ${(o.diam*60).toFixed(0)}′ wide – the telephoto frame is ${W.toFixed(0)}′ × ${H.toFixed(0)}′.`;
  if(o.type==='planet')return 'Only a few pixels wide: the S50 Pro’s short focal length cannot show fine planetary detail such as Saturn’s rings.';
  if(o.type!=='dso')return 'A point of light.';
  const s=o.size||1;return s<2?`Tiny (${s}′): a small dot or fuzzy blob.`:s<=W?`Fits easily (${s}′; frame is ${W.toFixed(0)}′ × ${H.toFixed(0)}′).`:s<=H?`Fits along the tall side (${s}′ vs ${H.toFixed(0)}′).`:`Bigger than the frame (${s}′ vs ${H.toFixed(0)}′) – you will capture only part of it.`;
}
const difficulty=o=>o.type==='planet'||o.type==='moon'||o.type==='sun'?'Bright – easy':o.mag<=7?'Easy':o.mag<=10?'Moderate – needs minutes of stacking':'Hard – needs a dark sky and an hour or more';
const ATLAS_PRESETS=[{n:'Milky Way core (Sagittarius)',ra:266.4,dec:-28.9},{n:'Milky Way in Cygnus',ra:307,dec:41},{n:'Orion',ra:83.8,dec:0},{n:'Big Dipper',ra:178,dec:56},{n:'Cassiopeia & Perseus',ra:20,dec:56},{n:'Pole star region',ra:37.95,dec:70},{n:'Winter Milky Way (Monoceros)',ra:105,dec:-8}];

/* ---- TARGET pane ---- */
function renderTarget(){
  const p=$('#p-target'),m=A.mode;let h=GATE+'<div class="needs">';
  const goBtn=o=>`<span class="go" data-act="go" data-arg="${o.id}">GOTO</span>`;
  const row=o=>`<div class="ob${A.sel===o?' on':''}${o.alt<3?' dn':''}" data-act="pick" data-arg="${o.id}"><span class="nm">${o.name}${['M31','M42','NGC104'].includes(o.id)?' ⭐':''}</span><span class="al${o.alt>=20?' up':''}">Alt ${o.alt.toFixed(0)}°</span>${goBtn(o)}</div>`;
  if(!m)h+='<p class="mu">Choose a mode on the Home tab first.</p>';
  else if(m==='star'){
    const chips=[['best',"Tonight's Best"],['gal','Galaxies'],['neb','Nebulae'],['cl','Clusters'],['pl','Planets & Moon'],['all','All']];
    const q=($('#q')&&$('#q').value)||'';
    h+=`<input id="q" type="search" placeholder="Search: M42, Orion, galaxy…" class="b wide" value="${q}" data-in="q"><div class="row">${chips.map(([k,t])=>`<button class="b sm${A.filter===k?' on':''}" data-act="filt" data-arg="${k}">${t}</button>`).join('')}</div>`;
    let list;const f=A.filter,ql=q.trim().toLowerCase();
    if(f==='best')list=tonightsBest();
    else list=OBJ.filter(o=>(o.type==='dso'||o.type==='planet'||o.type==='moon')&&(f==='all'||(f==='gal'&&o.kind==='gal')||(f==='neb'&&(o.kind==='neb'||o.kind==='pn'))||(f==='cl'&&(o.kind==='oc'||o.kind==='gc'))||(f==='pl'&&(o.type==='planet'||o.type==='moon')))).sort((a,b)=>((a.alt<15)-(b.alt<15))||(a.mag-b.mag));
    if(ql)list=OBJ.filter(o=>(o.type==='dso'||o.type==='planet'||o.type==='moon')&&(o.name+' '+(o.con?CON_NAMES[o.con]||o.con:'')).toLowerCase().includes(ql));
    h+=`<div id="olist">${list.slice(0,60).map(row).join('')||'<p class="mu">Nothing matches.</p>'}</div>`;
    if(f==='best')h+='<p class="mu sm">⭐ = good first targets (the manual suggests M31, M42 and NGC104). Veil-type nebulae need extremely dark skies.</p>';
    h+=detailCard(A.sel);
  }else if(m==='solar'){
    const list=OBJ.filter(o=>['sun','moon','planet'].includes(o.type)).sort((a,b)=>(a.type==='sun'?-1:b.type==='sun'?1:0)||(a.type==='moon'?-1:b.type==='moon'?1:0));
    h+=`<div class="card warn">☀ <b>Never point at the Sun without the solar filter.</b> The sensor can be destroyed in seconds.</div><div id="olist">${list.map(row).join('')}</div>`+detailCard(A.sel&&['sun','moon','planet'].includes(A.sel.type)?A.sel:null);
  }else if(m==='mw'){
    h+=`<canvas id="atlas" width="360" height="360" class="cv"></canvas>
     <p class="mu sm">SkyAtlas: tap the chart to place the framing box (Milky Way mode uses the 63° wide-angle camera).</p>
     <div class="row"><span class="seg" id="fovSeg"><button class="${A.atlasFov==='wide'?'on':''}" onclick="A.atlasFov='wide';renderTarget()">Wide 63°</button><button class="${A.atlasFov==='tele'?'on':''}" onclick="A.atlasFov='tele';renderTarget()">Tele 2.8°</button></span>
     <button class="b big on" data-act="atlasGo">GoTo framing box</button></div>
     <div class="row">${ATLAS_PRESETS.map((p,i)=>`<button class="b sm" data-act="atlasPre" data-arg="${i}">${p.n}</button>`).join('')}</div>
     <p class="mu sm" id="atlasInfo"></p>`;
  }else{
    h+=`<p>Scenery mode points the lens at everyday subjects: birds, wildlife and landscapes. Both cameras work – the wide one frames the scene, the telephoto zooms in.</p>
     <h3>Point the lens</h3><div class="row"><button class="b" data-act="scenery" data-arg="0">North</button><button class="b" data-act="scenery" data-arg="90">East</button><button class="b" data-act="scenery" data-arg="180">South</button><button class="b" data-act="scenery" data-arg="270">West</button></div>
     <p class="mu sm">Or use the joystick in the Imaging tab. The telephoto camera focuses from 15 m to infinity; the wide camera from 0.1 m.</p>`;
  }
  p.innerHTML=h+'</div>';
}
function detailCard(o){
  if(!o)return '<div class="card mu">Tap a name for details, or press GOTO.</div>';
  const tip=(o.kind==='neb'||o.kind==='pn')?'Emission nebulae glow in Hα/OIII light – the <b>Duo-Band filter</b> helps a lot, especially in a city.':(o.kind==='gal'||o.kind==='gc'||o.kind==='oc')?'Galaxies and clusters shine in broadband light – use the <b>UV/IR-cut</b> filter (Duo-Band would dim them).':'';
  const sunWarn=o.type==='sun'?'<p><b style="color:var(--bad)">⚠ Needs the magnetic solar filter. GoTo lifts the lens, then waits for you to attach it.</b></p>':'';
  return `<div class="card"><b>${o.name}</b> <span class="mu">· ${KIND[o.kind]||KIND[o.type]||o.type}${o.con?' in '+(CON_NAMES[o.con]||o.con):''}</span>
   <table><tr><td>Current altitude</td><td>${o.alt.toFixed(0)}° · azimuth ${o.az.toFixed(0)}°${o.alt<3?' <b style="color:var(--bad)">(below horizon)</b>':o.alt<SKY.horizon?' <b style="color:var(--bad)">(behind trees/buildings)</b>':''}</td></tr>
   ${o.type==='dso'||o.type==='planet'?`<tr><td>Brightness</td><td>magnitude ${o.mag}</td></tr>`:''}
   <tr><td>In the frame</td><td>${fitText(o)}</td></tr><tr><td>Difficulty</td><td>${difficulty(o)}</td></tr></table>${tip?`<p class="sm">💡 ${tip}</p>`:''}${sunWarn}
   <div class="row"><button class="b big on" data-act="go" data-arg="${o.id}">GOTO</button></div></div>`;
}

/* ---- IMAGING pane ---- */
const EXPOS=()=>mount.mountMode==='eq'?[5,10,20,30,60]:[5,10,20];
function activeStack(){return A.mode==='mw'?(A.mw==='trails'?sTrail:sWide):sTele;}
function renderImaging(){
  const m=A.mode,ex=EXPOS(),cur=activeStack().exposure;
  let h=GATE+'<div class="needs">';
  if(!m){$('#p-image').innerHTML=h+'<p class="mu">Choose a mode on the Home tab first.</p></div>';return;}
  const expSel=`<label>Exposure per photo<select id="exp" class="b" data-in="exp">${ex.map(v=>`<option value="${v}"${v===cur?' selected':''}>${v} s</option>`).join('')}</select></label>`;
  const fltSel=`<label>Filter (telephoto)<select id="flt" class="b" data-in="flt">${Object.entries(FILTERS).map(([k,f])=>`<option value="${k}"${sTele.flt===k?' selected':''}>${f.name}</option>`).join('')}</select></label>`;
  const show=`<label>Show<select class="b" data-in="show"><option value="stack">Live stack</option><option value="single">Single photo</option></select></label>`;
  const bright=`<label>Brightness <b id="brV">${sTele.brightness.toFixed(1)}×</b><input type="range" min="30" max="300" value="${Math.round(sTele.brightness*100)}" data-in="bright"></label>`;
  if(m==='star'){
    h+=`<div class="row"><button class="b big on" id="stk" data-act="stk">▶ Start stacking</button><button class="b" data-act="rstStack">Reset stack</button></div>
     <label class="sw"><input type="checkbox" data-in="auto" ${A.auto?'checked':''}> Start imaging automatically after GoTo <span class="mu sm">(as the real app does)</span></label>
     <div class="grid2">${expSel}${fltSel}${show}${bright}</div><label class="sw"><input type="checkbox" data-in="subs" ${A.saveSubs?'checked':''}> Also save every sub-frame (FITS, ~17 MB each)</label>
     <div id="sstats" class="card"></div>
     <h3>Why stacking works</h3><canvas id="nplot" width="360" height="130" class="cv"></canvas>
     <p class="mu sm">Every photo has random noise. Averaging N photos shrinks it by √N: 4× more photos = 2× cleaner.</p>
     <h3>Field rotation</h3><div class="row"><div id="frot"><i></i></div><div id="frTxt" class="sm"></div></div>`;
  }else if(m==='mw'){
    h+=`<div class="grid2"><label>Style<select class="b" data-in="mwsub"><option value="photo"${A.mw==='photo'?' selected':''}>Photo (one long exposure)</option><option value="stack"${A.mw==='stack'?' selected':''}>Wide-angle stacking</option><option value="trails"${A.mw==='trails'?' selected':''}>Star trails</option></select></label>${expSel}</div>
     <div class="row">${A.mw==='photo'?'<button class="b big on" data-act="shutter">● Shutter</button>':'<button class="b big on" id="stk" data-act="stk">▶ Start</button><button class="b" data-act="rstStack">Reset</button>'}</div>
     <div class="prog"><i id="snapBar"></i></div>
     <label class="sw"><input type="checkbox" data-in="lines" ${A.lines?'checked':''}> Show constellation lines</label>
     <div class="grid2">${show}${bright}</div><div id="sstats" class="card"></div>
     <p class="mu sm">Star trails: the mount holds still, so the stars draw arcs. The Milky Way needs a dark sky – light pollution and the Moon wash it out.</p>`;
  }else if(m==='solar'){
    h+=`<div class="card" id="solarCard"></div><div class="grid2">${expSel.replace('Exposure per photo','Exposure (stacked targets)')}${fltSel}</div>
     <h3>Finding the Sun (manual §2.8.2)</h3><ol class="sm"><li>GoTo Sun: the lens lifts and stops. Attach the magnetic solar filter, then tap “Installed &amp; Shooting”.</li><li>GoTo continues but stops a few degrees short – for safety.</li><li>Switch to <b>Wide</b> view, tap the bright Sun once (a GO marker appears) and tap it again to slew there. Repeat until the Sun shows in the Tele view.</li><li>Use the joystick on <b>Slow</b> to centre it. Choose 1×/2×/4× and press the shutter.</li><li>Move the Sun out of the Tele view <i>before</i> removing the filter.</li></ol>
     <p class="mu sm">The Moon and planets need no filter. Planets are only a few pixels wide on this short focal length.</p>`;
  }else{
    h+=`<div class="grid2"><label>Subject distance <b id="distV">${A.dist} m</b><input type="range" min="1" max="100" value="${A.dist}" data-in="dist"></label><label>Capture<select class="b" data-in="cap"><option value="photo">Photo</option><option value="video"${A.cap==='video'?' selected':''}>Video</option></select></label></div>
     <p class="mu sm">Use ● for a photo or ⏺ for a video clip at the right of the live view. Telephoto focus works from 15 m to infinity: closer subjects blur (try distance below 15 m).</p>`;
  }
  h+=`<h3>Joystick</h3><div class="pad"><span></span><button data-jog="0,1">▲</button><span></span><button data-jog="-1,0">◀</button><button class="stopb" data-act="stop">STOP</button><button data-jog="1,0">▶</button><span></span><button data-jog="0,-1">▼</button><span></span></div>
   <div class="row" style="justify-content:center"><select class="b sm" data-in="jog"><option value="slow">Slow (8× sidereal)</option><option value="medium" selected>Medium (64×)</option><option value="fast">Fast (360×)</option><option value="max">Max (1440× ≈ 6°/s)</option></select><button class="b sm" data-act="park">Zero position</button></div>
   <p class="mu sm">Hold an arrow to turn the telescope. Moving it by hand stops tracking and any stack.</p></div>`;
  $('#p-image').innerHTML=h;
  $$('#p-image [data-jog]').forEach(b=>{
    const [x,y]=b.dataset.jog.split(',').map(Number);
    const down=e=>{e.preventDefault();if(!mount.usable)return toast('Power on and connect first.');stopAllStacks();A.stopped=true;mount.setJog(x,y,A.jog);};
    const up=()=>{if(mount.jog.az||mount.jog.alt)mount.setJog(0,0);};
    b.addEventListener('pointerdown',down);b.addEventListener('pointerup',up);b.addEventListener('pointerleave',up);b.addEventListener('pointercancel',up);
  });
  const sel=$('#p-image select[data-in=jog]');if(sel)sel.value=A.jog;
}

/* ---- connection wizard + mount-mode box ---- */
let wizSig='';
function renderWiz(force){
  const sig=[mount.power,mount.link,A.wiz,mount.activated,mount.fwOk,A.platform].join();if(sig===wizSig&&!force)return;wizSig=sig;
  const b=$('#wizBox');let h='';const name=`S50 Pro_${mount.serial}`;
  if(mount.power==='off')h='<div class="card mu">Hold the power button for 2 s to switch on.</div>';
  else if(mount.power==='booting')h='<div class="card">Starting up… red running light.</div>';
  else if(mount.link==='connected')h=`<div class="card ok">✅ Connected to <b>${name}</b> over its Wi-Fi hotspot${mount.mountMode==='eq'?' (EQ mode)':''}.<div class="row"><button class="b" data-act="disc">Disconnect phone</button></div></div>`;
  else if(A.wiz==='fwbusy')h='<div class="card warn">⬆ Firmware update in progress… the S50 Pro will reboot by itself.</div>';
  else if(A.wiz==='idle'){
    h=`<div class="card"><p>“Powering on, ready for connection.” Bring the phone close, open the Seestar app and tap <b>Connect</b>. ${mount.activated?'':'<span class="mu">(First time: pairing, online activation and a firmware check follow.)</span>'}</p>
     <div class="row"><button class="b big on" data-act="wConnect">Connect</button>${mount.activated?`<button class="b" data-act="wNfc">📱 NFC tap</button><label class="sw sm"><input type="checkbox" data-in="nfc" ${A.nfc?'checked':''}> phone has NFC</label>`:''}</div></div>`;
  }else if(A.wiz==='scan')h=`<div class="card"><p>Scanning for nearby Seestar telescopes (needs Bluetooth, device-connection and network permissions)…</p><div class="ob" data-act="wPick"><span class="nm"><b>${name}</b></span><span class="go">Connect</span></div><div class="row"><button class="b sm" data-act="wCancel">Cancel</button></div><p class="mu sm">Your telescope’s name is on the label at the bottom of the unit.</p></div>`;
  else if(A.wiz==='pair')h=`<div class="card"><p><b>First connection:</b> find the small <b>reset button</b> at the bottom of the S50 Pro and press it to confirm the pairing.</p><button class="b big on" data-act="wReset">I pressed the reset button</button></div>`;
  else if(A.wiz==='activate')h=`<div class="card"><p><b>Network activation</b> (needed once). Requires the phone to be online and signed in to a ZWO account. Do not close the app meanwhile.</p>
     <label class="sw"><input type="checkbox" data-in="inet" ${A.inet?'checked':''}> Phone has Internet access</label><label class="sw"><input type="checkbox" data-in="signed" ${A.signed?'checked':''}> Signed in to a ZWO account</label>
     <label class="sw">Version <select class="b sm" data-in="region"><option value="intl"${A.region==='intl'?' selected':''}>International</option><option value="china"${A.region==='china'?' selected':''}>Mainland China</option></select></label>
     <button class="b big on" data-act="wActivate">Activate</button></div>`;
  else if(A.wiz==='hotspot')h=`<div class="card"><p>Joining the S50 Pro’s own Wi-Fi hotspot (no mobile signal needed afterwards).</p>
     <label class="sw">Phone <select class="b sm" data-in="plat"><option value="ios"${A.platform==='ios'?' selected':''}>iPhone / iPad (automatic)</option><option value="android"${A.platform==='android'?' selected':''}>Android (manual)</option></select></label>
     ${A.platform==='android'?`<p class="sm">Android cannot join automatically. In Wi-Fi settings choose <b>${name}</b>, password <b>12345678</b>.</p>`:''}
     <button class="b big on" data-act="wHotspot">${A.platform==='android'?'I joined the hotspot':'Join hotspot'}</button></div>`;
  else if(A.wiz==='fw')h=`<div class="card"><p><b>Firmware update available.</b> Wait for it to finish; the S50 Pro reboots afterwards.</p><div class="row"><button class="b big on" data-act="wFw">Update</button><button class="b" data-act="wFwSkip">Not now</button></div></div>`;
  b.innerHTML=h;
}
function renderMM(){
  const m=mount,eq=m.eq,e=m.polarError(),meas=eq.measured;
  const ok=meas&&Math.abs(meas.az)<=1&&Math.abs(meas.alt)<=1;
  $('#mmBox').innerHTML=`<div class="card ${m.mountMode==='eq'?'ok':''}"><b>${m.mountMode==='eq'?'EQ mode (green light)':'Alt-Az mode (yellow light)'}</b>
   <p class="mu sm">EQ mode follows the Earth’s turn with one axis: longer exposures, less field rotation, no zenith blind spot. It needs the optional EQ wedge and a careful polar alignment, outdoors with a clear view of the sky.</p>
   <details ${m.mountMode==='eq'||eq.legsOk?'open':''}><summary>Set up EQ mode</summary><div>
    <label class="sw"><input type="checkbox" data-in="eqchk" data-i="0" ${A.mmCheck[0]?'checked':''}> Tripod legs fully extended, widest angle, levelled</label>
    <label class="sw"><input type="checkbox" data-in="eqchk" data-i="1" ${A.mmCheck[1]?'checked':''}> One tripod leg points to true north</label>
    <label class="sw"><input type="checkbox" data-in="eqchk" data-i="2" ${A.mmCheck[2]?'checked':''}> Wedge mounted with its centre above one leg (no tipping)</label>
    <label class="sw"><input type="checkbox" data-in="eqchk" data-i="3" ${A.mmCheck[3]?'checked':''}> S50 Pro on the wedge, tube above the north leg</label>
    <div class="grid2" style="margin-top:6px"><label>Wedge altitude knob <b id="eqAltV">${eq.wedgeAlt.toFixed(1)}°</b><input type="range" min="0" max="90" step="0.5" value="${eq.wedgeAlt}" data-in="eqalt"></label>
     <label>Turn tripod (north error) <b id="eqAzV">${eq.wedgeAz.toFixed(1)}°</b><input type="range" min="-20" max="20" step="0.1" value="${eq.wedgeAz}" data-in="eqaz"></label></div>
    <p class="sm mu">Goal: set the altitude to your latitude (${obs.lat.toFixed(1)}°) and the north leg exactly north.</p>
    <div class="row"><button class="b" data-act="eqCalc">Calculate polar alignment error</button></div>
    ${meas?`<table><tr><td>Azimuth error</td><td>${meas.az.toFixed(1)}°</td></tr><tr><td>Altitude error</td><td>${meas.alt.toFixed(1)}°</td></tr></table><p class="sm" style="color:${ok?'var(--ok)':'var(--or)'}">${ok?'✓ Both within 1° – ready.':'Fine-tune the wedge until both errors are within 1°, then calculate again.'}</p>`:''}
    <div class="row"><button class="b big on" data-act="eqSwitch">Switch to EQ mode</button><button class="b" data-act="altSwitch">Back to Alt-Az</button></div>
   </div></details></div>`;
}

/* =====================================================================
   5. ALBUM: photos, stacked images and videos stored on the device (128 GB, ~100 GB usable)
   ===================================================================== */
let albumId=1;
function usedMB(){return album.reduce((a,i)=>a+i.size,0);}
function addAlbum(it){it.id=albumId++;it.date=clockText();album.unshift(it);renderAlbum();return it;}
function captureCanvas(cv,q=.9){try{return cv.toDataURL('image/jpeg',q);}catch(_){return null;}}
/* Save a finished stack (what happens when you press Stop in the real app) */
function saveStack(stk,asPhoto){
  if(!stk||stk.N<1)return;
  const off=offFor(stk.cam);stk.render(off.ctx,off.img);
  const nat=stk.cam===CAM.tele?'Telephoto':'Wide';
  const fits=makeFits(stk);
  addAlbum({kind:asPhoto?'photo':'stack',name:(stk.kind==='trails'?'Star trails':asPhoto?(stk.target?stk.target.name:'Wide photo')+' (photo)':stk.target?stk.target.name:'Stack'),thumb:captureCanvas(off.cv,.92),frames:stk.N,expo:stk.exposure,total:stk.tTotal,filter:stk.kind==='tele'?FILTERS[stk.flt].name:'built-in',
    cam:nat,fits,fw:stk.cam.w,fh:stk.cam.h,size:8+(A.saveSubs?stk.N*16.6:0),obj:stk.target&&stk.target.name});
}
function makeFits(stk){                                // grey-scale 16-bit image from the stack (electrons per second × 100 + 1000)
  const W=stk.cam.w,H=stk.cam.h,d=new Uint16Array(W*H);
  for(let p=0;p<W*H;p++){const t=stk.T[p]||1,v=(stk.S[p*3]+stk.S[p*3+1]+stk.S[p*3+2])/3/t;d[p]=clamp(Math.round(v*100+1000),0,65535);}
  return d;
}
function fitsBlob(it){
  const cards=[['SIMPLE','T'],['BITPIX',16],['NAXIS',2],['NAXIS1',it.fw],['NAXIS2',it.fh],['BZERO',32768],['BSCALE',1],['EXPTIME',it.total],['TELESCOP',"'Seestar S50 Pro (simulated)'"],['OBJECT',`'${(it.obj||it.name).replace(/'/g,'')}'`],['FILTER',`'${it.filter}'`],['DATE-OBS',`'${new Date(simMs).toISOString().slice(0,19)}'`]];
  let hdr=cards.map(([k,v])=>(k.padEnd(8)+'= '+String(v).padStart(20)).padEnd(80)).join('')+'END'.padEnd(80);
  hdr=hdr.padEnd(Math.ceil(hdr.length/2880)*2880);
  const n=it.fw*it.fh,bytes=new Uint8Array(Math.ceil(n*2/2880)*2880),dv=new DataView(bytes.buffer);
  for(let i=0;i<n;i++)dv.setInt16(i*2,it.fits[i]-32768);
  return new Blob([hdr,bytes],{type:'application/fits'});
}
function downloadItem(it,kind){
  if(!it)return;const a=document.createElement('a');let url;
  if(kind==='fits'){if(!it.fits)return;url=URL.createObjectURL(fitsBlob(it));a.download=it.name.replace(/\W+/g,'_')+'.fits';}
  else if(it.kind==='video'){url=it.url;a.download=it.name.replace(/\W+/g,'_')+'.webm';}
  else{url=it.thumb;a.download=it.name.replace(/\W+/g,'_')+'.jpg';}
  if(!url)return toast('The browser would not let me export this picture (the Moon photo blocks it when the page is opened from a file).');
  a.href=url;a.click();saved.add(it.id);toast('Downloaded to your phone’s gallery (the “Saved” tab).');renderAlbum();
}
function renderAlbum(){
  const p=$('#p-album');let h=GATE+'<div class="needs">';
  if(A.viewItem){const it=A.viewItem;
    h+=`<div class="row"><button class="b sm" data-act="closeView">← Back</button></div><div class="card"><b>${it.name}</b><div class="mu sm">${it.date} · ${it.kind==='stack'?`${it.frames} × ${it.expo}s = ${fmtDur(it.total)} · ${it.cam} · ${it.filter}`:it.kind==='video'?`video · ${it.dur||0} s`:'photo'}</div>
     ${it.kind==='video'&&it.url?`<video src="${it.url}" controls style="width:60%;display:block;margin:8px auto"></video>`:`<img src="${it.thumb}" style="width:60%;display:block;margin:8px auto;border-radius:6px">`}
     <div class="row"><button class="b on" data-act="dl" data-arg="jpg">⬇ Share → Download ${it.kind==='video'?'(WebM)':'JPEG'}</button>${it.fits?'<button class="b" data-act="dl" data-arg="fits">⬇ FITS</button>':''}<button class="b bad" data-act="delItem">Delete</button></div>
     ${it.kind==='video'?'<p class="mu sm">The real device records MP4/AVI; your browser saves WebM.</p>':''}</div>`;
  }else{
    const list=A.albumTab==='seestar'?album:album.filter(i=>saved.has(i.id));
    h+=`<div class="row"><span class="seg"><button class="${A.albumTab==='seestar'?'on':''}" data-act="alb" data-arg="seestar">Seestar (device)</button><button class="${A.albumTab==='saved'?'on':''}" data-act="alb" data-arg="saved">Saved (phone)</button></span></div>
     <p class="mu sm">Storage on the S50 Pro: ${(usedMB()/1000).toFixed(2)} GB of about ${S50.usableGB} GB usable (${S50.storageGB} GB chip).</p>
     <div class="agrid">${list.map(i=>`<div class="athumb" data-act="view" data-arg="${i.id}">${i.thumb?`<img src="${i.thumb}">`:''}<span>${i.kind==='video'?'🎞 ':''}${i.name}</span></div>`).join('')||'<p class="mu">Nothing here yet. Stop a stack, take a photo (●) or record a video (⏺).</p>'}</div>`;
  }
  p.innerHTML=h+'</div>';
}
