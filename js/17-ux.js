/* Telescope Simulator – 17-ux.js
   Classic script (not an ES module) so the page also works when opened straight from disk.
   All files share one global scope and must load in numeric order (see index.html).

   Beginner-friendly helpers:
     1. Quick tour      – coach marks that point at the real buttons (runs once on first visit; ❓ Help brings it back)
     2. My First Night  – one guided story: level → power → cap off → align → GoTo a planet → zoom → watch it track
     5. Sky compass     – which way the telescope points (N/E/S/W), how high (in degrees and "fists"), and where you are looking
     9. Touch helpers   – swipe the menu to change tabs, press-and-hold a part for a quick label
   (Item 7, eyepiece preview windows, lives in 12-sky-eyepiece.js next to the eyepiece code.) */
'use strict';
const isPhone=()=>matchMedia('(max-width:780px)').matches;
const shownEl=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden';};   // (offsetParent is always null for position:fixed, so measure instead)
const visEl=sel=>[...document.querySelectorAll(sel)].find(shownEl);
function store(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(_){return null;}}

/* =====================================================================
   5. SKY COMPASS
   ===================================================================== */
const DIR8=['North','North-East','East','South-East','South','South-West','West','North-West'];
const dirName=az=>DIR8[Math.round(norm360(az)/45)%8];
function camAz(){const f=new THREE.Vector3();camera.getWorldDirection(f);return norm360(Math.atan2(f.x,-f.z)*R2D);}   // scene: north = -z, east = +x
function drawCompass(){
  const box=$('#compass');if(!box||!shownEl(box))return;
  const c=box.querySelector('canvas'),x=c.getContext('2d'),W=c.width,cx=W/2,cy=W/2,R=W/2-6,T=driver.state().truth;
  const red=document.body.classList.contains('red'),ink=red?'#ff6a5a':'#e4e9f5',dim=red?'#7a2a22':'#4a5878';
  x.clearRect(0,0,W,W);
  x.fillStyle='rgba(8,12,22,.85)';x.beginPath();x.arc(cx,cy,R,0,7);x.fill();x.strokeStyle=dim;x.lineWidth=2;x.stroke();
  // the way YOU are looking (camera): a soft yellow wedge
  const ca=camAz()*D2R-Math.PI/2;x.fillStyle=red?'rgba(255,90,70,.18)':'rgba(255,214,100,.22)';x.beginPath();x.moveTo(cx,cy);x.arc(cx,cy,R-2,ca-.45,ca+.45);x.closePath();x.fill();
  for(let i=0;i<16;i++){const a=i*Math.PI/8-Math.PI/2,l=i%4?5:9;x.strokeStyle=dim;x.lineWidth=i%4?1:2;x.beginPath();x.moveTo(cx+Math.cos(a)*(R-l),cy+Math.sin(a)*(R-l));x.lineTo(cx+Math.cos(a)*R,cy+Math.sin(a)*R);x.stroke();}
  x.font=`bold ${W*.14}px system-ui`;x.textAlign='center';x.textBaseline='middle';
  [['N',0],['E',90],['S',180],['W',270]].forEach(([t,a])=>{const r=(a-90)*D2R;x.fillStyle=t==='N'?(red?'#ff8a7a':'#ff6a5a'):ink;x.fillText(t,cx+Math.cos(r)*(R-W*.17),cy+Math.sin(r)*(R-W*.17));});
  // the TELESCOPE: an orange arrow toward its azimuth; the arrow gets shorter as it points higher (straight up = a dot)
  const ta=(T.az-90)*D2R,len=(R-W*.3)*Math.max(.15,Math.cos(Math.max(0,T.alt)*D2R));
  x.strokeStyle=red?'#ff4a3a':'#ff8a3d';x.fillStyle=x.strokeStyle;x.lineWidth=4;x.lineCap='round';
  x.beginPath();x.moveTo(cx,cy);x.lineTo(cx+Math.cos(ta)*len,cy+Math.sin(ta)*len);x.stroke();
  x.beginPath();x.arc(cx+Math.cos(ta)*len,cy+Math.sin(ta)*len,5,0,7);x.fill();x.beginPath();x.arc(cx,cy,3,0,7);x.fill();
  const fists=Math.max(0,T.alt)/10,ft=fists<.5?'less than ½ fist':(Math.round(fists*2)/2).toString().replace('.5','½')+(fists>=.75&&fists<1.25?' fist':' fists');
  box.querySelector('.cpt').innerHTML=T.alt<0?`<b>Below the horizon</b>`:`<b>${dirName(T.az)}</b> · ${Math.round(T.alt)}° up<br><span class="mu">${T.alt>85?'straight up!':'≈ '+ft+' high'}</span>`;}
function initCompass(){
  const d=document.createElement('div');d.id='compass';d.title='Sky compass – tap for help';
  d.innerHTML='<canvas width="180" height="180"></canvas><div class="cpt"></div>';document.body.appendChild(d);
  d.addEventListener('click',()=>{haptic('tap');toast('🧭 The orange arrow shows where the telescope points. N = north. The yellow wedge is the way you are looking. Hold your fist out at arm’s length: one fist ≈ 10° of sky.',6000);});
  setInterval(drawCompass,150);}

/* =====================================================================
   1. QUICK TOUR (coach marks)
   ===================================================================== */
const TOUR={on:false,i:0,timer:null};
const TOUR_STEPS=[
 {title:'👋 Quick tour',text:'This 1-minute tour shows where everything is. Tap <b>Next</b>, or <b>Skip</b> any time. You can bring it back with ❓ Help.'},
 {sel:'view',title:'The 3D telescope',text:'<b>Drag</b> to spin around it and <b>pinch</b> (or scroll) to zoom. <b>Tap</b> any part to learn what it does, or <b>press and hold</b> a part for a quick label.'},
 {sel:'#compass',title:'Sky compass',text:'The <b style="color:#ff8a3d">orange arrow</b> shows which way the telescope points – North, East, South or West – and how high it is. One fist at arm’s length is about 10°.'},
 {sel:'#tabs',title:'Menus',text:'These tabs open the menus.'+(isPhone()?' <b>Swipe left or right</b> on the menu to change tabs, and drag the little bar to make it bigger or smaller.':'')},
 {sel:()=>edu.on?'#kidpad .kgrid':'.hc .dpad',tab:'ctrl',title:'Drive the telescope',text:'Hold an arrow to move the telescope. Let go to stop.'},
 {sel:()=>edu.on?'#ktiles':'.hc .krow',tab:'ctrl',title:'One-tap GoTo',text:'Pick a planet and the telescope drives there by itself – that is called <b>GoTo</b>.'},
 {sel:'#kidpad .ezrow',tab:'ctrl',edu:true,title:'Easy align',text:'Before GoTo is accurate, the telescope must learn where the sky is. These buttons walk you through it.'},
 {sel:'#epRowMini .eptiles',tab:'ctrl',title:'Eyepieces',text:'Each little window shows what you would see with that eyepiece <b>right now</b>. Smaller mm = more zoom. Tap one to use it.'},
 {sel:'#bEdu',title:'Education mode',text:'Simpler words and big buttons for younger astronomers. Turn it off for the full hand controller.'},
 {sel:'#bRed',title:'Night mode',text:'Outside at night, red light keeps your eyes used to the dark.'},
 {sel:'#bHelp',title:'Help',text:'Brings back this tour, My First Night and the welcome menu.'},
 {title:'🎉 You’re ready!',text:'Want to try a whole night with the telescope, step by step?',end:true}];
function tourFirstRun(){if(store('c11tour')==='1')return false;startTour();return true;}
function startTour(){
  if(typeof wzStop==='function'&&WZ.on)wzStop();if(L.lesson!==null){L.lesson=null;renderLearn();}fnHide();
  TOUR.on=true;TOUR.i=0;$('#tourHole').style.display='block';$('#tourTip').style.display='block';tourShow();
  clearInterval(TOUR.timer);TOUR.timer=setInterval(tourPlace,400);}
function endTour(next){TOUR.on=false;clearInterval(TOUR.timer);store('c11tour','1');$('#tourHole').style.display='none';$('#tourTip').style.display='none';
  if(next==='night')fnStart();else if(next==='welcome')showWelcome();}
function tourSteps(){return TOUR_STEPS.filter(s=>!s.edu||edu.on);}
function tourTarget(st){
  if(!st.sel)return null;
  if(st.sel==='view'){const w=innerWidth-(isPhone()?0:$('#dock').offsetWidth),h=isPhone()?innerHeight-$('#dock').offsetHeight:innerHeight;
    return {left:w*.22,top:h*.25,width:w*.56,height:h*.5,right:w*.78,bottom:h*.75,round:true};}
  const e=visEl(typeof st.sel==='function'?st.sel():st.sel);return e?e.getBoundingClientRect():null;}
function tourShow(){
  const S=tourSteps(),st=S[TOUR.i];if(st.tab&&curTab!==st.tab)tab(st.tab);
  if(isPhone()){const inDock=st.tab||st.sel==='#tabs';if(st.tab&&$('#dock').classList.contains('min'))setSheet(sheetSizes().mid,true);if(!inDock&&st.sel&&st.sel!=='#compass'&&st.sel!=='view'&&false)setSheet(sheetSizes().peek,true);}
  const sel=typeof st.sel==='function'?st.sel():st.sel,e=sel&&sel!=='view'?visEl(sel):null;
  if(e&&e.closest('#dock'))e.scrollIntoView({block:'center',behavior:'smooth'});
  $('#tourTip').innerHTML=`<div class="tdots">${S.map((_,k)=>`<i class="${k===TOUR.i?'on':k<TOUR.i?'done':''}"></i>`).join('')}</div><h3>${st.title}</h3><p>${st.text}</p>`+
    (st.end?`<div class="row"><button class="b on" data-tour="night">🌙 Start My First Night</button><button class="b" data-tour="explore">Explore on my own</button></div>`
           :`<div class="row"><button class="b" data-tour="skip">Skip</button><span style="flex:1"></span>${TOUR.i?'<button class="b" data-tour="back">Back</button>':''}<button class="b on" data-tour="next">Next ▸</button></div>`);
  tourPlace();setTimeout(tourPlace,420);}
function tourPlace(){
  if(!TOUR.on)return;const st=tourSteps()[TOUR.i],r=tourTarget(st),hole=$('#tourHole'),tip=$('#tourTip'),pad=6,vw=innerWidth,vh=innerHeight;
  const tw=Math.min(340,vw-20);tip.style.width=tw+'px';const th=tip.offsetHeight;
  if(!r){hole.style.cssText='display:block;left:50%;top:50%;width:0;height:0';tip.style.left=(vw-tw)/2+'px';tip.style.top=Math.max(10,(vh-th)/2)+'px';return;}
  hole.style.cssText=`display:block;left:${r.left-pad}px;top:${r.top-pad}px;width:${r.width+pad*2}px;height:${r.height+pad*2}px;border-radius:${r.round?'50%':'12px'}`;
  let top=r.bottom+pad+12;if(top+th>vh-8)top=r.top-pad-12-th;if(top<8)top=Math.min(vh-th-8,Math.max(8,r.top+r.height/2-th/2));
  let left=r.left+r.width/2-tw/2;left=clamp(left,10,vw-tw-10);tip.style.left=left+'px';tip.style.top=top+'px';}

/* =====================================================================
   2. MY FIRST NIGHT – one story that chains the features together
   ===================================================================== */
const FN={on:false,okStep:-1,i:0,t0:0,ff:false,ffing:false,doneAt:0,adv:null,target:null};
const FN_TARGETS=['saturn','jupiter','moon','mars','venus'];
function fnTarget(){if(FN.target&&FN.target.alt>8)return FN.target;FN.target=FN_TARGETS.map(id=>OBJ.find(o=>o.id===id)).find(o=>o&&o.alt>12)||OBJ.find(o=>o.id==='Vega');return FN.target;}
const fnInView=()=>{const o=fnTarget();return o&&wzSep(o)<EPS[epI].fov/2*.9&&!driver.state().slewing;};
const FN_STEPS=[
 {t:'🌙 Your first night',k:()=>`Tonight you will set up the telescope, line it up with the sky and look at <b>${fnTarget().name}</b>. Each step turns ✅ by itself when you have done it.`,check:()=>true,intro:true},
 {t:'Night mode (optional)',k:()=>'Astronomers use red light so their eyes stay used to the dark. Turn on Night mode, or just tap Next.',act:[['🔴 Night mode on',()=>setRed(true)]],check:()=>document.body.classList.contains('red'),optional:true},
 {t:'Level the tripod',k:()=>'A tilted tripod makes the telescope point in the wrong place. Open the Setup step and move the legs until the bubble sits in the circle.',act:[['🧰 Level it',()=>{const i=SETUP.findIndex(s=>s.level);tab('setup');setupGo(i<0?0:i);setupShow();}]],check:()=>LEVEL.ok},
 {t:'Turn the power on',k:()=>'Flip the switch on the base. The red light means it is on and the hand controller wakes up.',act:[['⏻ Power on',()=>setPower(true)]],check:()=>POWER.on},
 {t:'Take off the lens cap',k:()=>'With the cap on, the eyepiece is completely dark!',act:[['Remove the cap',()=>setCap(false)]],check:()=>!CAP.on},
 {t:'Line up with the sky',k:()=>'The telescope has to learn where the sky is. The quick way: centre one bright planet and press Align.',act:[['🎯 1-planet align',()=>{fnHide();wzStart('planet');}],['⭐ 3 stars',()=>{fnHide();wzStart('stars');}]],check:()=>ALIGN_DONE_AT>FN.t0},
 {t:()=>'Go to '+fnTarget().name,k:()=>`Now the fun part. Tap the button and watch the telescope drive itself to ${fnTarget().name}.`,act:[[()=>'🪐 Go to '+fnTarget().name,()=>{if(WZ.on)wzStop();doGoto(fnTarget());}]],check:fnInView,view:true},
 {t:'Zoom in',k:()=>'Tap a smaller eyepiece number to zoom in. The 13 mm makes it about 215× bigger – look for details!',act:[['13 mm',()=>setEp(3)],['9 mm',()=>setEp(4)]],check:()=>EPS[epI].mag>=200&&EPS[epI].fl>1&&fnInView(),view:true},
 {t:'Watch it track',k:()=>'The Earth spins, so the sky slowly moves. With <b>tracking</b> on, the motors follow the planet. Fast-forward one hour and see if it stays in view.',act:[['⏩ Fast-forward 1 hour',fnFF]],check:()=>FN.ff&&fnInView(),view:true},
 {t:'🏅 First night complete!',k:()=>'You set up a real computerised telescope and found a planet. That is exactly what astronomers do outside.',final:true}];
function fnStart(resume){
  if(TOUR.on)endTour();if(L.lesson!==null){L.lesson=null;renderLearn();}
  FN.on=true;FN.i=resume?Math.min(+store('c11fnStep')||0,FN_STEPS.length-1):0;FN.t0=performance.now();FN.ff=false;FN.target=null;FN.doneAt=0;
  if(FN.i>5&&ALIGN_DONE_AT===0)FN.i=5;                        // alignment is not kept between visits
  fnRender();}
function fnStop(){FN.on=false;clearTimeout(FN.adv);$('#fn').style.display='none';}
function fnHide(){if(FN.on)$('#fn').style.display='none';}
function fnFF(){if(FN.ffing)return;FN.ffing=true;driver.setTracking('sidereal');const sp=speed;setSpeed(600);fnRender();
  setTimeout(()=>{setSpeed(sp===600?1:sp);FN.ffing=false;FN.ff=true;fnRender();},6000);}
const fnv=v=>typeof v==='function'?v():v;
function fnRender(){
  const el=$('#fn');if(!FN.on){el.style.display='none';return;}
  if(WZ.on){el.style.display='none';return;}                   // the alignment wizard uses the same corner
  const st=FN_STEPS[FN.i],ok=st.check?st.check():false;store('c11fnStep',FN.i);
  el.innerHTML=`<div class="row" style="margin-top:0"><b style="flex:1">🌙 My First Night</b><span class="mu sm">${FN.i+1}/${FN_STEPS.length}</span><button class="b sm" data-fn="close" title="Close">✕</button></div>
   <div class="tdots">${FN_STEPS.map((_,k)=>`<i class="${k===FN.i?'on':k<FN.i?'done':''}"></i>`).join('')}</div>
   <h3>${!st.intro&&!st.final&&!st.optional?(ok?'✅ ':'⬜ '):''}${fnv(st.t)}</h3><p>${st.k()}</p>
   ${st.view?`<div class="fnview"><canvas id="fnC" width="200" height="200"></canvas><div class="sm mu" id="fnTxt"></div></div>`:''}
   ${st.act?`<div class="row">${st.act.map(([l],k)=>`<button class="b${ok?'':' on'}" data-fa="${k}"${FN.ffing&&st.act[k][1]===fnFF?' disabled':''}>${FN.ffing&&st.act[k][1]===fnFF?'⏩ Fast-forwarding…':fnv(l)}</button>`).join('')}</div>`:''}
   <div class="row">${FN.i?'<button class="b" data-fn="back">Back</button>':''}<span style="flex:1"></span>${st.final?'<button class="b on" data-fn="finish">Finish 🎉</button>':`<button class="b${ok||st.optional||st.intro?' on':''}" data-fn="next">${st.intro?'Let’s go ▸':ok||st.optional?'Next ▸':'Skip'}</button>`}</div>`;
  el.style.display='block';
  if(st.final){haptic('success');store('c11fn','done');
    const r=$('#reward');r.innerHTML=`<div><div class="big">🔭</div><h2>First night complete!</h2><p>You levelled, powered up, aligned and found ${fnTarget().name} – just like a real astronomer.</p><button class="b on" id="rwOk">Awesome!</button></div>`;r.style.display='flex';$('#rwOk').onclick=()=>{r.style.display='none';};}}
function fnTick(){                                               // live check every half second: tick the box and move on by itself
  if(!FN.on)return;if(WZ.on){$('#fn').style.display='none';return;}
  if($('#fn').style.display==='none'){fnRender();return;}
  const st=FN_STEPS[FN.i];
  if(st.view){const c=$('#fnC');if(c)drawEyepiece(c,EPS[epI],true);const t=$('#fnTxt');if(t){const o=fnTarget(),d=wzSep(o);
    t.innerHTML=driver.state().slewing?'🔭 Moving…':d<EPS[epI].fov/2?`<b style="color:#7dffb0">${o.name} is in view</b><br>${EPS[epI].finder?'Finder':EPS[epI].n} · ${Math.round(EPS[epI].mag)}×`:`${o.name} is not in view yet<br>(${d.toFixed(1)}° away)`;}}
  if(st.intro||st.final||st.optional)return;
  const ok=st.check();                                           // FN.okStep remembers which step we already celebrated
  if(ok&&FN.okStep!==FN.i){FN.okStep=FN.i;haptic('success');toast('✅ '+fnv(st.t)+' – done!');clearTimeout(FN.adv);
    FN.adv=setTimeout(()=>{if(FN.on&&FN_STEPS[FN.i]===st&&st.check()){FN.i++;fnRender();}},1600);fnRender();}
  else if(!ok&&FN.okStep===FN.i){FN.okStep=-1;fnRender();}}
setInterval(fnTick,500);

/* =====================================================================
   9. TOUCH HELPERS: swipe the menu to change tabs, press-and-hold a part
   ===================================================================== */
(function(){                                                     // swipe left/right on the menu panes (phones and tablets)
  let s=null;const dock=$('#dock');
  dock.addEventListener('touchstart',e=>{const t=e.target;if(e.touches.length!==1||t.closest('canvas,input,select,textarea,.hc,.kgrid,.wzpad,.eptiles,#tabs,#grab'))return s=null;
    s={x:e.touches[0].clientX,y:e.touches[0].clientY,t:performance.now()};},{passive:true});
  dock.addEventListener('touchend',e=>{if(!s)return;const t=e.changedTouches[0],dx=t.clientX-s.x,dy=t.clientY-s.y,dt=performance.now()-s.t;s=null;
    if(Math.abs(dx)<70||Math.abs(dy)>Math.abs(dx)*.6||dt>700)return;
    const vis=TABS.map(t=>t[0]).filter(k=>{const b=document.querySelector(`#tabs [data-t="${k}"]`);return b&&b.offsetParent!==null;}),i=vis.indexOf(curTab);
    const n=vis[clamp(i+(dx<0?1:-1),0,vis.length-1)];if(n&&n!==curTab){tab(n);haptic('tap');document.querySelector(`#tabs [data-t="${n}"]`).scrollIntoView({inline:'center',block:'nearest',behavior:'smooth'});}},{passive:true});
})();
function partAt(cx,cy){                                          // which part is under the finger? (same rules as a tap)
  const r=cv.getBoundingClientRect();mouse.set((cx-r.left)/r.width*2-1,-((cy-r.top)/r.height)*2+1);ray.setFromCamera(mouse,camera);
  const shown=o=>{for(;o;o=o.parent)if(!o.visible)return false;return true;};
  for(const h of ray.intersectObjects(ALLM.filter(m=>shown(m)&&m.userData.part&&!hidden.has(m.userData.part)),false)){
    if(cut.on&&h.object.userData.clip&&inCutWedge(altG.worldToLocal(h.point.clone())))continue;return h.object.userData.part;}
  return null;}
(function(){                                                     // press and hold a part: a bubble with its name and a one-line kid explanation
  let lp=null;const tip=document.createElement('div');tip.id='peek';document.body.appendChild(tip);
  let prev=null;                                                 // the selection before the bubble, restored if you just let it go
  const hide=()=>{if(tip.style.display==='block'&&prev!==undefined){sel.part=prev;prev=undefined;}tip.style.display='none';};
  cv.addEventListener('pointerdown',e=>{hide();if(ptrs.size>1){clearTimeout(lp&&lp.t);lp=null;return;}
    const x0=e.clientX,y0=e.clientY;lp={x0,y0,t:setTimeout(()=>{if(!lp||(down&&down.m>=8))return;const id=partAt(x0,y0);if(!id)return;
      if(down)down.m=99;                                         // stop the normal tap from also firing on release
      haptic('hold');prev=sel.part;sel.part=id;sel.sub=null;
      const I=INFO[id],k=(KID[id]||I.p||'').split(/(?<=\.)\s/)[0];
      tip.innerHTML=`<b>${I.n}</b><div>${k}</div><button class="b sm" data-peek="${id}">Learn more ▸</button>`;tip.style.display='block';
      const w=Math.min(280,innerWidth-20);tip.style.width=w+'px';tip.style.left=clamp(x0-w/2,10,innerWidth-w-10)+'px';
      const h=tip.offsetHeight;tip.style.top=(y0-h-24>8?y0-h-24:y0+24)+'px';},550)};});
  cv.addEventListener('pointermove',e=>{if(lp&&Math.hypot(e.clientX-lp.x0,e.clientY-lp.y0)>8){clearTimeout(lp.t);lp=null;}});
  const cancel=()=>{if(lp){clearTimeout(lp.t);lp=null;}};cv.addEventListener('pointerup',cancel);cv.addEventListener('pointercancel',cancel);
  tip.addEventListener('click',e=>{const b=e.target.closest('[data-peek]');if(b){prev=undefined;selectPart(b.dataset.peek,null,true);}hide();});
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('#peek')&&e.target!==cv)hide();});
})();

/* ---- build the overlays and hook everything up ---- */
(function(){
  const h=document.createElement('div');h.id='tourHole';const t=document.createElement('div');t.id='tourTip';const f=document.createElement('div');f.id='fn';
  document.body.append(h,t,f);
  t.addEventListener('click',e=>{const b=e.target.closest('[data-tour]');if(!b)return;const a=b.dataset.tour,S=tourSteps();
    if(a==='next'){if(TOUR.i<S.length-1){TOUR.i++;tourShow();}else endTour();}else if(a==='back'&&TOUR.i>0){TOUR.i--;tourShow();}
    else if(a==='skip'||a==='explore')endTour();else if(a==='night')endTour('night');});
  f.addEventListener('click',e=>{const a=e.target.closest('[data-fa]'),n=e.target.closest('[data-fn]');const st=FN_STEPS[FN.i];
    if(a){st.act[+a.dataset.fa][1]();setTimeout(fnRender,50);return;}
    if(!n)return;const k=n.dataset.fn;
    if(k==='close')fnStop();else if(k==='back'&&FN.i>0){FN.i--;fnRender();}else if(k==='next'&&FN.i<FN_STEPS.length-1){FN.i++;fnRender();}else if(k==='finish'){fnStop();store('c11fnStep',0);}});
  addEventListener('resize',()=>{if(TOUR.on)tourPlace();});
  addEventListener('keydown',e=>{if(e.key==='Escape'&&TOUR.on)endTour();});
  document.addEventListener('click',e=>{const b=e.target.closest('[data-ux]');if(!b)return;if(b.dataset.ux==='tour')startTour();else if(b.dataset.ux==='night')fnStart(b.dataset.resume==='1');});
  initCompass();
})();
