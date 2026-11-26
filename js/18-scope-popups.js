/* Telescope Simulator – 18-scope-popups.js
   Classic script (not an ES module) so the page also works when opened straight from disk.
   All files share one global scope and must load in numeric order (see index.html).

   Tap a part of the telescope to USE it, not just read about it:
     • Eyepiece  → a "look through it" window with the live view and the eyepiece case to swap eyepieces
     • Finder    → the same window showing the 9×50 finder view (with its crosshair)
     • Hand controller → the real NexStar+ keypad pops out next to the telescope, big enough to use,
                         with a hint line that explains each key as you press it. */
'use strict';
/* ---------- eyepiece / finder window ---------- */
const EPP={on:false,mode:'ep'};
function epPopOpen(mode){
  if(HCP.on)hcPopClose();EPP.on=true;EPP.mode=mode||'ep';
  if(EPP.mode==='ep'&&epI===0)setEp(1);                       // tapping the eyepiece means "look through the telescope", not the finder
  buildEpRows();epPopRender();$('#epPop').style.display='block';haptic('tap');}
function epPopClose(){EPP.on=false;$('#epPop').style.display='none';}
function epPopRender(){
  const f=EPP.mode==='finder',e=f?EPS[0]:EPS[epI];
  $('#eppTitle').innerHTML=f?'🎯 Looking through the finder':`👁 Looking through the <b>${e.n}</b> eyepiece`;
  $$('#epPop [data-pv]').forEach(b=>b.classList.toggle('on',b.dataset.pv===EPP.mode));
  $('#epRowPop').style.display=f?'none':'';
  $$('#epPop [data-real]').forEach(b=>b.classList.toggle('on',(b.dataset.real==='1')===SKY.real));
  epPopTick();}
function epPopTick(){
  if(!EPP.on)return;const f=EPP.mode==='finder',e=f?EPS[0]:EPS[epI];drawEyepiece($('#eppC'),e);
  const st=driver.state(),T=st.truth,eq=horToEq(T.alt,T.az,jdNow());let best=null,bd=e.fov/2;
  for(const o of OBJ){if(o.alt<0)continue;const d=angSep({ra:o.cra,dec:o.cdec},eq);if(d<bd){bd=d;best=o;}}
  const what=CAP.on&&!f?'<b style="color:#ff8a6a">The lens cap is on!</b> <button class="b sm" data-epp="cap">Take it off</button>':
    st.slewing?'🔭 The telescope is moving…':best?`In view: <b>${best.name}</b>${bd>e.fov*.2?' (near the edge)':''}`:'Nothing bright in view – try GoTo in the Control tab.';
  $('#eppTxt').innerHTML=(f?'9× · 5° wide · crosshair shows where the big telescope points':`${Math.round(e.mag)}× · ${e.fov<1?e.fov.toFixed(2):e.fov.toFixed(1)}° wide${e.fl>1?' · '+e.fl+' mm':''}`)+'<br>'+what;}
setInterval(epPopTick,150);

/* ---------- hand controller pop-out ---------- */
// The very same controller element is moved between the Control tab and the floating panel, so it can never get out of step.
const HCP={on:false};
const HC_HINT={align:'ALIGN – teach the telescope where the sky is (Solar System, Two-Star or Three-Star Align).',
 enter:'ENTER – choose the item on the screen. On an object: GoTo it!',undo:'BACK – go back one screen. When nothing is open it stops the motors.',
 solar:'SOLAR SYSTEM – the Moon and the planets that are up right now.',stars:'STARS – bright stars, double stars and constellations.',dso:'DEEP SKY – galaxies, nebulae and star clusters (Messier, NGC…).',
 ident:'IDENTIFY – what is near where the telescope points?',tour:'SKY TOUR – the best objects up tonight, one after another.',
 sup:'SCROLL ▲ – move up a list.',sdn:'SCROLL ▼ – move down a list.',menu:'MENU – tracking, home, park and other settings.',
 help:'HELP – here it jumps to the Messier catalog (type a number).',option:'OPTION (Celestron logo) – a shift key: press it, then OBJECT INFO.',
 info:'OBJECT INFO – facts about the object on the screen.',mspeed:'MOTOR SPEED – then press a number 1 (slowest, 0.5× sidereal) to 9 (fastest, 3°/s).',
 track:'Shortcut: change tracking (normally in MENU).',home:'Shortcut: slew to the home position.',park:'Shortcut: park the telescope.',stop:'Shortcut: stop the motors (BACK does this too).',
 'alt+':'▲ – tube moves up (at rates 6 and slower the real handset swaps UP/DOWN – see MENU › Scope setup).','alt-':'▼ – tube moves down.','az-':'◀ – turn left.','az+':'▶ – turn right.'};
function hcPopOpen(){if(HCP.on)return;if(EPP.on)epPopClose();HCP.on=true;$('#hcPopBody').appendChild($('#hcEl'));$('#hcPop').style.display='block';$('#bHcPop').textContent='⤡ Put back';
  if(isPhone()&&!$('#dock').classList.contains('min'))setSheet(sheetSizes().peek,true);haptic('tap');}
function hcPopClose(){if(!HCP.on)return;HCP.on=false;$('#hcHome').appendChild($('#hcEl'));$('#hcPop').style.display='none';$('#bHcPop').textContent='⤢ Pop out';}
$('#hcEl').addEventListener('pointerdown',e=>{const b=e.target.closest('[data-k],[data-d]');if(!b)return;
  const k=b.dataset.k||b.dataset.d,dg=b.dataset.n;let t=HC_HINT[k]||'';
  if(dg!==undefined&&wantsDigit())t=`Typing the number ${dg}.`;$('#hcHint').textContent=t;});

/* ---------- what a tap on the 3D telescope does ---------- */
function scopeTap(part,sub){
  if(part==='focuser'){sel.part=part;sel.sub=null;showInfo();renderParts();epPopOpen('ep');toast('Turn the focus knob with ⟲ / ⟳ (or drag sideways on the view) until the stars are sharp dots.',4000);return true;}
  if(part==='eyepiece'||part==='finder'){sel.part=part;sel.sub=null;showInfo();renderParts();epPopOpen(part==='finder'?'finder':'ep');return true;}
  if(part==='handset'){sel.part=part;sel.sub=null;showInfo();renderParts();hcPopOpen();return true;}
  return false;}

/* ---------- build the two panels ---------- */
(function(){
  const ep=document.createElement('div');ep.id='epPop';
  ep.innerHTML=`<div class="row" style="margin-top:0"><span id="eppTitle" style="flex:1"></span><button class="b sm" data-epp="close" title="Close">✕</button></div>
   <div class="row" style="margin:4px 0"><button class="b sm" data-pv="ep">🔭 Telescope eyepiece</button><button class="b sm" data-pv="finder">🎯 Finder</button></div>
   <canvas id="eppC" width="480" height="480"></canvas><div class="sm" id="eppTxt"></div>
   <div class="eprow" id="epRowPop"></div>
   <div class="row"><button class="b sm" data-real="0">Map view</button><button class="b sm" data-real="1">🪞 Real view (flipped)</button><span style="flex:1"></span><button class="b sm" data-epp="info">ℹ️ About this part</button></div>`;
  const hp=document.createElement('div');hp.id='hcPop';
  hp.innerHTML=`<div class="row" style="margin-top:0"><b style="flex:1">🎮 Hand controller</b><button class="b sm" data-hcp="close" title="Put it back in the Control tab">✕</button></div><div id="hcPopBody"></div>`;
  document.body.append(ep,hp);
  ep.addEventListener('click',e=>{
    const t=e.target.closest('[data-ep]');if(t){const i=+t.dataset.ep;if(i===0){EPP.mode='finder';}else{EPP.mode='ep';setEp(i);toast(`Swapped to the ${EPS[i].n} eyepiece – ${Math.round(EPS[i].mag)}× magnification`);haptic('key');}epPopRender();return;}
    const v=e.target.closest('[data-pv]');if(v){EPP.mode=v.dataset.pv;if(EPP.mode==='ep'&&epI===0)setEp(1);epPopRender();return;}
    const r=e.target.closest('[data-real]');if(r){SKY.real=r.dataset.real==='1';try{localStorage.setItem('c11sky',JSON.stringify(SKY));}catch(_){}renderSkyRows();epPopRender();return;}
    const a=e.target.closest('[data-epp]');if(!a)return;
    if(a.dataset.epp==='close')epPopClose();else if(a.dataset.epp==='cap'){setCap(false);epPopRender();}
    else if(a.dataset.epp==='info'){const p=EPP.mode==='finder'?'finder':'eyepiece';epPopClose();selectPart(p,null,true);}});
  hp.addEventListener('click',e=>{if(e.target.closest('[data-hcp=close]'))hcPopClose();});
  $('#bHcPop').onclick=()=>HCP.on?hcPopClose():hcPopOpen();
  addEventListener('keydown',e=>{if(e.key==='Escape'){if(EPP.on)epPopClose();}});
})();
