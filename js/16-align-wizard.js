/* Telescope Simulator – 16-align-wizard.js
   Classic script (not an ES module) so the page also works when opened straight from disk.
   All files share one global scope and must load in numeric order (see index.html). */
'use strict';
/* =====================================================================
   EASY ALIGNMENT WIZARD – step-by-step "1-planet" (Solar System Align) and "3-star" alignment, then a tracking demo.
   It uses the same simulated mount as everything else: before alignment GoTo misses by a few degrees,
   the user centres each object with big arrows, and the mount learns the error.
   ===================================================================== */
let ALIGN_DONE_AT=0;                                          // time of the last finished alignment (wizard or hand control) – used by the First Night story
const WZ={on:false,mode:null,phase:null,list:[],i:0,cur:null,view:0,demo:null};
const WZ_VIEWS=[EPS[0],EPS[1],EPS[3]];                     // finder, 40 mm, 13 mm
function wzSep(o){const T=driver.state().truth,eq=horToEq(T.alt,T.az,jdNow());return angSep({ra:o.cra,dec:o.cdec},eq);}
function wzPickStars(){                                     // three bright stars, high enough and spread around the sky
  const c=OBJ.filter(o=>o.type==='star'&&o.mag<2.2&&o.alt>25&&o.alt<80).sort((a,b)=>a.mag-b.mag),out=[];
  for(const o of c){if(out.every(u=>angSep({ra:o.cra,dec:o.cdec},{ra:u.cra,dec:u.cdec})>45))out.push(o);if(out.length===3)break;}
  for(const o of c){if(out.length===3)break;if(!out.includes(o)&&out.every(u=>angSep({ra:o.cra,dec:o.cdec},{ra:u.cra,dec:u.cdec})>25))out.push(o);}
  return out;}
function wzStart(mode){
  if(typeof L!=='undefined'&&L.lesson!==null){L.lesson=null;renderLearn();}
  WZ.on=true;WZ.mode=mode;WZ.phase='prep';WZ.i=0;WZ.cur=null;WZ.view=0;WZ.demo=null;WZ.list=mode==='stars'?wzPickStars():[];
  if(curTab!=='ctrl')tab('ctrl');
  if(matchMedia('(max-width:780px)').matches)setSheet(sheetSizes().peek,true);   // phone: shrink the menu so the telescope and the wizard both fit
  wzRender();}
function wzStop(){WZ.on=false;wzDemoStop();HD.az.length=0;HD.alt.length=0;$('#wiz').style.display='none';}
function wzGo(o){                                           // slew to the object using the current (probably wrong) alignment
  WZ.cur=o;WZ.phase='slew';WZ.view=0;wzRender();
  const r=driver.gotoRaDec(o.cra,o.cdec);if(!r.ok){toast(o.name+' is below the horizon.');WZ.phase=WZ.mode==='stars'?'star':'pick';wzRender();return;}
  driver.s.onArrive=()=>{WZ.phase='center';wzRender();};}
function wzAlignHere(){
  const o=WZ.cur;if(wzSep(o)>.5){toast(o.name+' is not in the middle yet – keep using the arrows (it should say Centred!).');haptic('warn');return;}
  driver.addAlignPoint(o);haptic('success');WZ.i++;
  if(WZ.mode==='stars'&&WZ.i<3){WZ.phase='star';wzRender();return;}
  driver.setTracking('sidereal');WZ.phase='done';ALIGN_DONE_AT=performance.now();wzRender();}
function wzDemo(kind){                                      // watch the sky for an "hour" at 600x with tracking on or off
  wzDemoStop();WZ.demo={kind,t0:performance.now(),spd:speed,trk:driver.s.tracking};
  driver.setTracking(kind==='off'?'off':'sidereal');setSpeed(600);WZ.demo.timer=setTimeout(wzDemoStop,6000);wzRender();}
function wzDemoStop(){const d=WZ.demo;if(!d)return;clearTimeout(d.timer);setSpeed(d.spd||1);driver.setTracking('sidereal');WZ.demo=null;if(WZ.on)wzRender();}
function wzTestGoto(){                                      // a target far from the alignment object(s) shows how good the alignment is
  const used=WZ.mode==='stars'?WZ.list:[WZ.cur];
  const c=OBJ.filter(o=>(o.type==='planet'||o.type==='moon'||(o.type==='dso'&&o.mag<6))&&o.alt>20&&!used.includes(o));
  c.sort((a,b)=>Math.min(...used.map(u=>angSep({ra:b.cra,dec:b.cdec},{ra:u.cra,dec:u.cdec})))-Math.min(...used.map(u=>angSep({ra:a.cra,dec:a.cdec},{ra:u.cra,dec:u.cdec}))));
  const o=c[0];if(!o){toast('Nothing suitable is up right now.');return;}
  WZ.cur=o;WZ.phase='test';WZ.view=1;driver.gotoRaDec(o.cra,o.cdec);driver.s.onArrive=()=>{WZ.phase='tested';wzRender();};wzRender();}
function wzChecks(){return [[POWER.on,'Power is ON (red light lit)','pwr'],[!CAP.on,'Lens cap is OFF','cap'],[LEVEL.ok,'Tripod is level (Setup step 4)','lvl']];}
function wzRender(){
  const el=$('#wiz');if(!WZ.on){el.style.display='none';return;}el.style.display='block';
  const st=WZ.mode==='stars',title=st?'⭐ 3-star alignment':'🪐 1-planet alignment';let h='';
  const pad=`<div class="wzpad"><span></span><button data-wd="alt+">▲</button><span></span><button data-wd="az-">◀</button><button data-wd="stop" class="wzst">■</button><button data-wd="az+">▶</button><span></span><button data-wd="alt-">▼</button><span></span></div>`;
  const view=`<div class="wzview"><canvas id="wzC" width="240" height="240"></canvas><div class="wzinfo"><div class="row">${WZ_VIEWS.map((e,i)=>`<button class="b sm${WZ.view===i?' on':''}" data-wv="${i}">${i===0?'Finder':e.n}</button>`).join('')}</div><div id="wzMeter" class="wzmeter"></div>${pad}</div></div>`;
  if(WZ.phase==='prep'){
    h=`<p>${st?'Three-star alignment teaches the mount using <b>3 bright stars</b> far apart. It takes longer but GoTo becomes accurate <b>all over the sky</b>, and it can even correct a slightly tilted tripod.':'The quickest way to align: centre <b>one bright planet or the Moon</b>. GoTo will be very good near that planet, but less accurate on the far side of the sky (especially if the tripod is not level).'}</p>
      <p class="mu sm">Before you start:</p>${wzChecks().map(([ok,t,k])=>`<div class="wzck">${ok?'✅':'⬜'} ${t}${ok?'':k==='lvl'?' <button class="b sm" data-wk="lvl">Level it</button>':` <button class="b sm" data-wk="${k}">Fix</button>`}</div>`).join('')}
      <p class="sm mu">Starting will forget the old alignment, so the first GoTo will miss – that is normal!</p>
      <div class="row"><button class="b on" data-wz="begin" ${POWER.on&&!CAP.on?'':'disabled'}>Start ▸</button><button class="b" data-wz="close">Cancel</button></div>`;}
  else if(WZ.phase==='pick'){
    const list=solarList().filter(o=>o.type!=='sun'&&o.type!=='pluto'&&o.alt>10);
    h=`<p><b>Step 1.</b> Pick a bright planet or the Moon that you can see in the sky.</p><div class="ktiles">${list.map(o=>`<button data-wo="${o.id}"><b>${{moon:'🌙',saturn:'🪐',jupiter:'🟠',mars:'🔴',venus:'✨',mercury:'⚪'}[o.id]||'⭐'}</b>${o.name}</button>`).join('')||'<p class="mu">No planet is up right now – try 3-star alignment, or speed up time in the Sky tab.</p>'}</div>
      <div class="row"><button class="b" data-wz="close">Cancel</button></div>`;}
  else if(WZ.phase==='star'){
    const o=WZ.list[WZ.i];
    h=`<p><b>Star ${WZ.i+1} of 3: ${o?o.name:'?'}</b>${o&&o.con?` in ${CON_NAMES[o.con]||o.con}`:''}. ${WZ.i===0?'The mount will swing to where it <i>thinks</i> the star is.':'Good! Now the next star, far from the last one.'}</p>
      <div class="row">${o?`<button class="b on" data-wo="${o.id}">Go to ${o.name} ▸</button>`:'<span class="mu">Not enough bright stars are up.</span>'}<button class="b" data-wz="close">Cancel</button></div>`;}
  else if(WZ.phase==='slew'||WZ.phase==='test'){h=`<p>🔭 Moving to <b>${WZ.cur.name}</b>… keep clear of the telescope.</p>${view}`;}
  else if(WZ.phase==='center'){
    h=`<p><b>${st?`Star ${WZ.i+1} of 3`:'Step 2'}: centre ${WZ.cur.name}.</b> It is probably not in the middle because the mount does not know where it is yet. Look in the <b>Finder</b> first, hold the arrows until ${WZ.cur.name} sits in the crosshairs, then switch to the 40 mm eyepiece and centre it again.</p>${view}
      <div class="row"><button class="b on" data-wz="align">✓ It's centred – Align</button><button class="b" data-wz="close">Cancel</button></div>`;}
  else if(WZ.phase==='done'){
    h=`<p>🎉 <b>Aligned!</b> ${st?'The mount used 3 stars, so it knows its own tilt as well as where it is pointing.':'The mount now knows where '+WZ.cur.name+' is.'} <b>Tracking is ON</b>: the motors turn slowly so objects stay in view while Earth spins.</p>${view}
      <p class="sm"><b>See tracking work:</b> each button runs the sky for about 1 hour in 6 seconds.</p>
      <div class="row"><button class="b${WZ.demo&&WZ.demo.kind==='on'?' on':''}" data-wz="demoOn">⏩ Tracking ON</button><button class="b${WZ.demo&&WZ.demo.kind==='off'?' on':''}" data-wz="demoOff">⏩ Tracking OFF (watch it drift)</button></div>
      <div class="row"><button class="b on" data-wz="test">🎯 Test with a GoTo far away</button><button class="b" data-wz="close">Finish</button></div>`;}
  else if(WZ.phase==='tested'){
    const d=wzSep(WZ.cur)*60;
    h=`<p>The GoTo to <b>${WZ.cur.name}</b> landed <b>${d<1?'less than 1':d.toFixed(0)} arc-minute${d>=2?'s':''}</b> from the centre ${d<10?'– right in the eyepiece! 🎯':d<20?'– in the 40 mm eyepiece, a small nudge centres it.':'– outside the eyepiece. Use the finder and arrows.'}</p>
      <p class="sm mu">${st?'Three stars measured the tripod tilt too, so GoTo is good everywhere.':'A 1-planet alignment is great near the planet. Far away, a tilted tripod or small errors grow – that is why 3-star alignment exists.'}</p>${view}
      <div class="row"><button class="b" data-wz="again">${st?'Try 1-planet':'Try 3-star'}</button><button class="b on" data-wz="close">Finish</button></div>`;}
  el.innerHTML=`<div class="row" style="margin-top:0"><b style="flex:1">${title}</b><button class="b sm" data-wz="close">✕</button></div>${h}`;
  wzTick();}
function wzTick(){                                          // live eyepiece and "how far from centre" meter
  if(!WZ.on)return;const c=document.getElementById('wzC');if(c)drawEyepiece(c,WZ_VIEWS[WZ.view]);
  const m=document.getElementById('wzMeter');if(m&&WZ.cur){const d=wzSep(WZ.cur),fov=WZ_VIEWS[WZ.view].fov;
    m.innerHTML=d<.08?`<b style="color:#7dffb0">● Centred!</b> (${(d*60).toFixed(1)}′ off)`:d<fov/2?`<b style="color:#ffd36a">In view</b> – ${(d*60).toFixed(0)}′ from the middle`:`<b style="color:#ff8a6a">Not in this view</b> – ${d.toFixed(1)}° away${WZ.view?' – try the Finder':''}`;}}
$('#wiz').addEventListener('click',e=>{
  const z=e.target.closest('[data-wz]'),o=e.target.closest('[data-wo]'),v=e.target.closest('[data-wv]'),k=e.target.closest('[data-wk]');
  if(v){WZ.view=+v.dataset.wv;wzRender();return;}
  if(k){if(k.dataset.wk==='pwr')setPower(true);if(k.dataset.wk==='cap')setCap(false);if(k.dataset.wk==='lvl'){wzStop();tab('setup');setupGo(3);setupShow();return;}wzRender();return;}
  if(o){const ob=OBJ.find(x=>x.id===o.dataset.wo);if(ob)wzGo(ob);return;}
  if(!z)return;const a=z.dataset.wz;
  if(a==='close')wzStop();
  else if(a==='begin'){driver.clearAlign();WZ.i=0;WZ.phase=WZ.mode==='stars'?'star':'pick';wzRender();}
  else if(a==='align')wzAlignHere();
  else if(a==='demoOn')wzDemo('on');else if(a==='demoOff')wzDemo('off');
  else if(a==='test')wzTestGoto();
  else if(a==='again')wzStart(WZ.mode==='stars'?'planet':'stars');});
// big arrows inside the wizard: fast when far away, slow and gentle when close
$('#wiz').addEventListener('pointerdown',e=>{const b=e.target.closest('[data-wd]');if(!b)return;e.preventDefault();
  if(b.dataset.wd==='stop'){driver.stop();return;}const ax=b.dataset.wd.slice(0,-1),sg=b.dataset.wd.slice(-1)==='+'?1:-1;
  const d=WZ.cur?wzSep(WZ.cur):5;rate=d>1.5?8:d>.3?6:5;b.setPointerCapture(e.pointerId);dirDown(ax,sg,'kid');b.classList.add('act');
  const up=()=>{dirUp(ax,sg,'kid');b.classList.remove('act');b.removeEventListener('pointerup',up);b.removeEventListener('pointercancel',up);};
  b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);});
setInterval(()=>{if(WZ.on)wzTick();},120);
document.addEventListener('click',e=>{const b=e.target.closest('[data-ezalign]');if(b)wzStart(b.dataset.ezalign);});
