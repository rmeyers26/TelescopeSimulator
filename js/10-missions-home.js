/* Telescope Simulator – 10-missions-home.js
   Classic script (not an ES module) so the page also works when opened straight from disk.
   All files share one global scope and must load in numeric order (see index.html). */
'use strict';
/* =====================================================================
   MISSIONS (Education mode) – point the real (simulated) telescope at targets to earn badges
   ===================================================================== */
const MISSIONS=[
 {id:'polaris',b:'⭐',t:'Find the North Star',goal:'Point the telescope at Polaris.',obj:'Polaris',tol:.4,
  hint:'Try Learn → “Find the North Star” first. Then press STARS on the controller, pick Bright stars, scroll to Polaris and press ENTER twice.'},
 {id:'saturn',b:'🪐',t:'See Saturn’s rings',goal:'Point at Saturn and use the 9 mm or 6 mm eyepiece.',obj:'saturn',tol:.12,minMag:300,
  hint:'Press SOLAR SYSTEM, scroll to Saturn and press ENTER twice. Then pick 9 mm or 6 mm under the eyepiece view.'},
 {id:'moon',b:'🌙',t:'Craters on the Moon',goal:'Point the telescope at the Moon.',obj:'moon',tol:.3,
  hint:'Press SOLAR SYSTEM – the Moon is first. If it is not up, speed up time in the Sky tab until it rises.'},
 {id:'galaxy',b:'🌌',t:'Find a galaxy',goal:'Point at any galaxy, like the Andromeda Galaxy (M31).',kind:'gal',tol:.35,obj:'M31',
  hint:'Press DEEP SKY → Messier, type 3 then 1, and press ENTER twice. Andromeda is 2.5 million light-years away!'},
 {id:'cluster',b:'✨',t:'Visit a star cluster',goal:'Point at a star cluster such as the Pleiades (M45).',kind:'oc gc',tol:.35,obj:'M45',
  hint:'Press DEEP SKY → Messier, type 4 then 5, press ENTER twice. Try the 40 mm eyepiece so the whole cluster fits.'}];
const MSN={done:{},hold:{}};try{MSN.done=JSON.parse(localStorage.getItem('c11badges')||'{}');}catch(_){}
const NAKED={n:'Your eye',fov:60,mag:1,finder:true,eye:true};
function msTarget(m){return OBJ.find(o=>o.id===m.obj);}
function msHit(m){const st=driver.state(),T=st.truth;if(st.slewing)return null;const eq=horToEq(T.alt,T.az,jdNow());
  const cand=m.kind?OBJ.filter(o=>o.type==='dso'&&m.kind.split(' ').includes(o.kind)):[msTarget(m)];
  const o=cand.find(o=>o.alt>0&&angSep({ra:o.cra,dec:o.cdec},eq)<m.tol);if(!o)return null;if(m.minMag&&EPS[epI].mag<m.minMag)return null;return o;}
function renderMissions(){
  const n=MISSIONS.filter(m=>MSN.done[m.id]).length;
  $('#p-miss').innerHTML=`<h2>Missions</h2><p class="mu">Use the hand controller (Control tab) to point the telescope at each target. Hold it there for 2 seconds to earn the badge. ${n}/${MISSIONS.length} badges.</p>`+
   MISSIONS.map(m=>{const o=msTarget(m),up=o&&o.alt>0;return `<div class="ms${MSN.done[m.id]?' done':''}"><div class="bd">${m.b}</div><div style="flex:1"><h4>${m.t}${MSN.done[m.id]?' ✔':''}</h4><div>${m.goal}</div>
     <div class="hint">${up?'':'⚠ Not above the horizon right now – speed up time in the Sky tab. '}${m.hint}</div><div class="row"><button class="b sm" data-ms="${m.id}">Show me how</button></div></div></div>`;}).join('')+
   `<h3>Your eye vs. finder vs. telescope</h3><p class="mu sm">The same patch of sky three ways, centred where the telescope points. The telescope sees a tiny piece of sky but makes it big and bright.</p>
   <div class="cmp"><div><canvas id="cmp0" width="220" height="220"></canvas>Your eye (60° wide)</div><div><canvas id="cmp1" width="220" height="220"></canvas>Finder 9×50 (5°)</div><div><canvas id="cmp2" width="220" height="220"></canvas><span id="cmpT">Telescope</span></div></div>
   <div class="row"><button class="b sm" data-ms="reset">Reset badges</button></div>`;
}
$('#p-miss').addEventListener('click',e=>{const b=e.target.closest('[data-ms]');if(!b)return;const k=b.dataset.ms;
  if(k==='reset'){MSN.done={};try{localStorage.removeItem('c11badges');}catch(_){}renderMissions();return;}
  const m=MISSIONS.find(x=>x.id===k),o=msTarget(m);if(!o)return;if(o.alt<=0){toast(o.name+' is below the horizon now. Speed up time in the Sky tab.',3500);return;}
  if(doGoto(o)){if(m.minMag&&EPS[epI].mag<m.minMag)setEp(4);if(m.id==='cluster')setEp(1);toast('Watch the telescope move! This is what the hand controller does when you press ENTER.',3500);}});
function missionsTick(dt){
  {const st=driver.state();if(st.slewing||st.moving)MSN.armed=true;}   // badges only count after the child has moved the telescope (it starts on Polaris)
  if(MSN.armed)for(const m of MISSIONS){if(MSN.done[m.id])continue;const o=msHit(m);MSN.hold[m.id]=o?(MSN.hold[m.id]||0)+dt:0;
    if(MSN.hold[m.id]>2){MSN.done[m.id]=Date.now();haptic('success');try{localStorage.setItem('c11badges',JSON.stringify(MSN.done));}catch(_){}
      const r=$('#reward');r.innerHTML=`<div><div class="big">${m.b}</div><h2>Mission complete!</h2><p>${m.t}</p><p class="mu sm">You found ${o.name}. ${MISSIONS.filter(x=>MSN.done[x.id]).length}/${MISSIONS.length} badges.</p><button class="b on" id="rwOk">Awesome!</button></div>`;
      r.style.display='flex';$('#rwOk').onclick=()=>{r.style.display='none';};renderMissions();}}
  if(curTab==='miss'){drawEyepiece($('#cmp0'),NAKED);drawEyepiece($('#cmp1'),EPS[0]);drawEyepiece($('#cmp2'),EPS[epI]);$('#cmpT').textContent=`Telescope ${EPS[epI].n} (${EPS[epI].fov<1?EPS[epI].fov.toFixed(2):EPS[epI].fov.toFixed(1)}°, ${Math.round(EPS[epI].mag)}×)`;}
}
renderMissions();


/* ---- user-friendliness: night mode, More tools, welcome screen ---- */
function setRed(v){document.body.classList.toggle('red',v);$('#bRed').classList.toggle('on',v);try{localStorage.setItem('c11red',v?'1':'0');}catch(_){}const w=$('#wRed');if(w)w.checked=v;}
$('#bRed').onclick=()=>setRed(!document.body.classList.contains('red'));
$('#bMore').onclick=()=>{const on=document.body.classList.toggle('showadv');$('#bMore').textContent=on?'Less ▴':'More ▾';};
function lessonIdx(start){return LESSONS.findIndex(l=>l.t.includes(start));}
function startLesson(i){if(i<0)return;L.lesson=i;L.step=0;renderLearn();doStep(LESSONS[i].s[0]);}
function showWelcome(){const el=$('#welcome');let red=false,show=true;try{red=localStorage.getItem('c11red')==='1';show=localStorage.getItem('c11welcome')!=='0';}catch(_){}
  el.innerHTML=`<div><button class="b wclose" data-w="close" title="Close">✕</button><h1>🔭 Welcome to the telescope simulator!</h1><p class="mu">This is a Celestron C11 telescope on its computer-controlled mount. What would you like to do first?</p>
  <div class="wtiles">
   <button data-w="night" class="wbig"><span class="e">🌙</span><b>My First Night</b>${(()=>{try{const s=+localStorage.getItem('c11fnStep');return s>0&&localStorage.getItem('c11fn')!=='done'?'Pick up where you left off (step '+(s+1)+').':'Start here! Set up, align and find a planet, step by step.';}catch(_){return 'Start here!';}})()}</button>
   <button data-w="tour"><span class="e">🧭</span><b>Quick tour</b>Where everything is, in 1 minute.</button>
   <button data-w="light"><span class="e">🔦</span><b>How does it work?</b>Follow a beam of light through the telescope.</button>
   <button data-w="north"><span class="e">⭐</span><b>Find the North Star</b>Use the Big Dipper trick, like sailors did.</button>
   <button data-w="drive"><span class="e">🎮</span><b>Drive the telescope</b>Big arrows and one-tap trips to Saturn, the Moon and more.</button>
   <button data-w="miss"><span class="e">🏅</span><b>Missions</b>Find 5 targets in the sky and earn badges.</button>
   <button data-w="parts"><span class="e">🔧</span><b>Explore the parts</b>Tap any part to learn what it does.</button>
   <button data-w="setup"><span class="e">🧰</span><b>Set it up</b>Step-by-step setup from the manual.</button></div>
  <div class="wopts"><label><input type="checkbox" id="wRed" ${red?'checked':''}> 🔴 Night mode (red light, for outdoors)</label><label><input type="checkbox" id="wShow" ${show?'checked':''}> Show this at start</label></div>
  <p class="mu sm" style="margin-top:10px">Tips: drag to spin the view · pinch or scroll to zoom · tap a part to learn about it · ❓ Help brings this back.</p>
  <div class="row" style="justify-content:flex-end"><button class="b on" data-w="close">Just explore</button></div></div>`;
  el.style.display='flex';}
$('#welcome').addEventListener('change',e=>{if(e.target.id==='wRed')setRed(e.target.checked);if(e.target.id==='wShow'){try{localStorage.setItem('c11welcome',e.target.checked?'1':'0');}catch(_){}}});
$('#welcome').addEventListener('click',e=>{const b=e.target.closest('[data-w]');if(!b&&e.target.id!=='welcome')return;$('#welcome').style.display='none';const k=b?b.dataset.w:'close';
  if(k==='night'){let s=0;try{s=+localStorage.getItem('c11fnStep')||0;}catch(_){}fnStart(s>0);}else if(k==='tour')startTour();
  else if(k==='light')startLesson(lessonIdx('Follow the light'));else if(k==='north')startLesson(lessonIdx('Find the North Star'));
  else if(k==='drive')tab('ctrl');else if(k==='miss')tab('miss');else if(k==='setup')tab('setup');else if(k==='parts'){tab('parts');if(!labState.on)$('#bLab').click();}});
$('#bHelp').onclick=showWelcome;
// phone menu: the toolbar collapses to icons; ☰ opens every tool, and choosing one closes it again
$('#bMenu').onclick=()=>{document.body.classList.toggle('topopen');};
$('#top').addEventListener('click',e=>{const b=e.target.closest('button');if(b&&b.id!=='bMenu'&&b.id!=='bMore'&&document.body.classList.contains('topopen'))setTimeout(()=>document.body.classList.remove('topopen'),150);});
cv.addEventListener('pointerdown',()=>document.body.classList.remove('topopen'));
/* ---- home screen: choose a telescope. Add future models to SCOPES; each entry's load() builds/activates its scene ---- */
const SCOPES=[
 {id:'c11cpc',name:'Celestron C11',sub:'CPC Deluxe 1100 HD',kind:'Schmidt-Cassegrain on a computerized GoTo fork mount',
  facts:['280 mm (11-inch) mirror – about 1,600× more light than your eye','2800 mm focal length · f/10','NexStar+ hand controller with 40,000-object database','Optional StarSense camera, Telrad and eyepiece kit'],
  load:()=>{}},                                    // the C11 scene is built at start-up, so loading it needs no extra work
 {id:'s50',name:'Seestar S50 Pro',sub:'Smart telescope by ZWO / Celestron',kind:'All-in-one smart telescope: it finds north, tracks and stacks photos by itself',emoji:'🌟',url:'seestar.html',
  facts:['50 mm apochromatic telephoto (f/5.2, 2.8° field) plus a 63° wide-angle camera','Four modes: Stargazing, Milky Way, Solar System, Scenery','Plate-solving: no manual alignment · optional EQ mode with a wedge','Duo-Band filter, magnetic solar filter, dew heater, 9-hour battery']}];   // entries with a `url` open their own simulator page
const COMING=[{e:'🔭',t:'Refractor',s:'A lens telescope, like Galileo’s'},{e:'🪣',t:'Dobsonian',s:'A big mirror on a simple push-around base'}];
const homeState={scope:null,thumb:null};
function showHome(){const el=$('#home');let red=document.body.classList.contains('red');
  el.innerHTML=`<div class="hw"><div style="font-size:40px">🔭</div><h1>Telescope Simulator</h1><div class="tag">Learn how a real telescope works – pick one to explore, drive and use under tonight’s sky.</div>
   <div class="scopes">${SCOPES.map(sc=>`<button class="scard main" data-scope="${sc.id}"><div class="im" style="${!sc.url&&homeState.thumb?`background-image:url(${homeState.thumb})`:''}">${!sc.url&&homeState.thumb?'':(sc.emoji||'🔭')}</div>
     <div class="bd"><span class="pill">${sc.kind}</span><h3>${sc.name}</h3><div class="sub">${sc.sub}</div><ul>${sc.facts.map(f=>`<li>${f}</li>`).join('')}</ul><span class="go">Explore this telescope ▸</span></div></button>`).join('')}
    </div><h3 style="margin:26px 0 10px;color:#aab4cf">More telescopes on the way</h3><div class="scopes">${COMING.map(c=>`<div class="scard soon"><div class="im">${c.e}</div><div class="bd"><span class="pill">Coming soon</span><h3>${c.t}</h3><div class="sub">${c.s}</div></div></div>`).join('')}</div>
   <div class="hopts"><label><input type="checkbox" id="hRed" ${red?'checked':''}> 🔴 Night mode</label><label><input type="checkbox" id="hEdu" ${edu.on?'checked':''}> 🎓 Education mode (simpler, kid-friendly)</label></div></div>`;
  el.style.display='block';}
function chooseScope(id){const sc=SCOPES.find(x=>x.id===id);if(!sc)return;if(sc.url){location.href=sc.url;return;}   // a separate simulator page (e.g. the Seestar)
  homeState.scope=sc;sc.load();$('#home').style.display='none';
  document.title=sc.name+' – Telescope Simulator';if(typeof tourFirstRun==='function'&&tourFirstRun())return;   // first visit: quick tour instead of the welcome screen
  let show=true;try{show=localStorage.getItem('c11welcome')!=='0';}catch(_){}if(show)showWelcome();}
$('#home').addEventListener('click',e=>{const c=e.target.closest('[data-scope]');if(c)chooseScope(c.dataset.scope);});
$('#home').addEventListener('change',e=>{if(e.target.id==='hRed')setRed(e.target.checked);if(e.target.id==='hEdu')setEdu(e.target.checked);});
$('#bHome').onclick=showHome;

{let red=false,show=true;try{red=localStorage.getItem('c11red')==='1';show=localStorage.getItem('c11welcome')!=='0';}catch(_){}setRed(red);showHome();}   // the home screen comes first; the welcome screen follows once a telescope is chosen

/* ---- toolbar ---- */
$('#bOrbit').onclick=()=>setMode('orbit');$('#bWalk').onclick=()=>setMode('walk');
$$('#top [data-v]').forEach(b=>b.onclick=()=>viewFrom(b.dataset.v));
$('#bReset').onclick=()=>{setMode('orbit');tweenTo({tx:0,ty:1.45,tz:0,yaw:2.4,pitch:.22,dist:3.5});};
$('#bCut').onclick=()=>setCut(!cut.on);
$('#bStar').onclick=()=>{toggleHide('starsense');$('#bStar').classList.toggle('on',!hidden.has('starsense'));renderParts();};
// dew shield slides along the tube axis: off = 0.9 m forward, on = seated on the corrector cell
const dewS={t:0,to:0,e:null};
$('#bDew').onclick=()=>{dewS.to=dewS.to?0:1;$('#bDew').classList.toggle('on',!dewS.to);if(dewS.to&&sel.part==='dew')hcMsgNone();};
function hcMsgNone(){}
// cinematic mode: letterbox bars, longer lens, slow automatic camera move. Touching the scene stops the move.
const cine={on:false};
function setCine(v){cine.on=v;document.body.classList.toggle('cine',v);$('#bCine').classList.toggle('on',v);camera.fov=v?32:45;camera.updateProjectionMatrix();if(v){setMode('orbit');cam.tw=null;}}
$('#bCine').onclick=()=>setCine(!cine.on);$('#bFol').onclick=()=>{follow.on=!follow.on;$('#bFol').classList.toggle('on',follow.on);};cv.addEventListener('pointerdown',()=>{cine.paused=true;clearTimeout(cine.pt);cine.pt=setTimeout(()=>cine.paused=false,4000);});
(function(){const g=$('#grain'),x=g.getContext('2d');const id=x.createImageData(256,256);for(let i=0;i<id.data.length;i+=4){const v=Math.random()*255;id.data[i]=id.data[i+1]=id.data[i+2]=v;id.data[i+3]=255;}x.putImageData(id,0,0);})();$('#bA1').onclick=()=>setArms(1);$('#bA2').onclick=()=>setArms(2);

/* ---- numbered labels from the CPC Deluxe HD manual (Figure 3) ---- */
const LABS=[['1','Control panel (A–F)',m=>m.material.map===panelTex,'near'],['2','Mirror lock knobs',m=>m.userData.part==='rearcell'&&m.userData.sub==='lockknob','near'],['3','Star diagonal',m=>m.userData.part==='diagonal'],
 ['4','Hand control',m=>m.userData.part==='handset'&&m.userData.keypad,'near'],['5','Eyepiece',m=>m.userData.part==='eyepiece'],['6','Finderscope',m=>m.userData.part==='finder'&&m.userData.sub!=='bracket'],
 ['7','Finder quick-release bracket',m=>m.userData.part==='finder'&&m.userData.sub==='bracket'],['8','Optical tube',m=>m.userData.part==='tube'&&m.userData.sub==='shell'],['9','Schmidt corrector',m=>m.userData.part==='corrector'],
 ['10','Altitude locking knob',m=>m.userData.part==='fork'&&m.userData.sub==='pivot','near'],['11','Carrying handle',m=>m.userData.part==='fork'&&m.userData.sub==='handle','near'],['12','Azimuth locking knob',m=>m.userData.part==='fork'&&m.userData.sub==='clutch','near'],
 ['13','Tripod',m=>m.userData.part==='tripod'&&m.userData.sub==='head'],['14','Accessory tray',m=>m.userData.part==='tripod'&&m.userData.sub==='tray'],['15','Focus knob',m=>m.userData.part==='focuser'&&m.userData.sub==='knob']];
const labState={on:false,els:null,box:new THREE.Box3(),v:new THREE.Vector3()};
function updLabels(){
  if(!labState.els){const h=document.createElement('div');document.body.appendChild(h);labState.els=LABS.map(l=>{const e=document.createElement('div');e.className='lab';e.innerHTML=`<b>${l[0]}</b>${l[1]}`;h.appendChild(e);return e;});}
  const r=cv.getBoundingClientRect();
  LABS.forEach((l,i)=>{const e=labState.els[i];if(!labState.on){e.style.display='none';return;}
    let ms=ALLM.filter(m=>l[2](m)&&isShown(m)&&!hidden.has(m.userData.part));
    if(l[3]&&ms.length>1){const cp=camera.position;ms=[ms.reduce((a,b)=>labState.box.setFromObject(b).getCenter(labState.v).distanceTo(cp)<labState.box.setFromObject(a).getCenter(labState.v).distanceTo(cp)?b:a)];}   // several copies (left/right arm): label the one nearest the camera
    if(!ms.length){e.style.display='none';return;}
    labState.box.makeEmpty();ms.forEach(m=>labState.box.expandByObject(m));labState.box.getCenter(labState.v).project(camera);
    if(labState.v.z>1){e.style.display='none';return;}
    e.style.display='block';e.style.left=(r.left+(labState.v.x+1)/2*r.width)+'px';e.style.top=(r.top+(1-labState.v.y)/2*r.height)+'px';});
}
function setEdu(v){edu.on=v;{const h=document.getElementById('hEdu');if(h)h.checked=v;}document.body.classList.toggle('edu',v);$('#bEdu').classList.toggle('on',v);try{localStorage.setItem('c11edu',v?'1':'0');}catch(_){}
  if(v&&curTab==='link')tab('miss');showInfo();renderLearn();renderMissions();}
$('#bEdu').onclick=()=>setEdu(!edu.on);
// Education mode is on by default; the choice is remembered on this device
{let v=null;try{v=localStorage.getItem('c11edu');}catch(_){}document.addEventListener('DOMContentLoaded',()=>setEdu(v!=='0'));}   // runs after every script file has loaded
$('#bDip').onclick=()=>{guide.on=!guide.on;$('#bDip').classList.toggle('on',guide.on);};
$('#bLab').onclick=()=>{labState.on=!labState.on;$('#bLab').classList.toggle('on',labState.on);};
$('#bOpt').onclick=()=>{optics.on=!optics.on;$('#bOpt').classList.toggle('on',optics.on);};
$('#exp').oninput=e=>{exp.target=+e.target.value;if(exp.target>.3&&cam.mode==='orbit'&&cam.dist<5.5&&!cam.tw)tweenTo({tx:cam.tx,ty:cam.ty+.2,tz:cam.tz,yaw:cam.yaw,pitch:cam.pitch,dist:6});};

