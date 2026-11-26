/* Telescope Simulator – 19-focus.js
   Classic script (not an ES module) so the page also works when opened straight from disk.
   All files share one global scope and must load in numeric order (see index.html).

   FOCUSING, the way a Schmidt-Cassegrain really does it:
   • The focus knob on the back turns a screw that slides the big PRIMARY MIRROR forward or back along the baffle tube.
   • Because the secondary mirror magnifies that movement about 5× along each axis (≈25× in focus position),
     a tiny mirror move shifts the focus point a lot – roughly 5 mm per knob turn in this model.
   • If the focus point is not exactly at the eyepiece, every star becomes a little disc. In an SCT that disc has a
     dark hole in the middle (the shadow of the secondary mirror), so out-of-focus stars look like DOUGHNUTS.
   • Eyepieces are not all "parfocal", so swapping eyepieces usually needs a small touch of focus.
   Angular blur on the sky = focus error ÷ (f-ratio × focal length) – see defocusArcsec(). */
'use strict';
const FOCUS={pos:0,turnMM:5,hold:null,hint:0};
// best knob position (in turns) for each entry of EPS: finder, 40, 25, 13, 9, 6 mm, planet camera
const FOCUS_BEST=[0,1.2,.6,0,-.35,-.7,6];
FOCUS.pos=FOCUS_BEST[3];                                        // starts sharp for the 13 mm in the diagonal
const focusErr=ep=>{const i=EPS.indexOf(ep);return i<=0||ep.finder?0:FOCUS.pos-(FOCUS_BEST[i]||0);};   // the finder focuses itself
function defocusArcsec(ep){return Math.abs(focusErr(ep))*FOCUS.turnMM/(10*2800)*206265;}   // mm → radians → arcseconds
function defocusPx(ep,ppd){return defocusArcsec(ep)/3600*ppd/2;}  // blur RADIUS in pixels on the eyepiece canvas
// how blurry it LOOKS depends on magnification: blur on the sky × magnification = blur your eye sees (in arc-minutes)
function apparentBlur(ep){ep=ep||EPS[epI];return defocusArcsec(ep)*ep.mag/60;}
const focusSharp=ep=>apparentBlur(ep)<8;
function focusWord(ep){const a=apparentBlur(ep);
  return a<8?['Sharp!','#7dffb0']:a<25?['Almost – a tiny bit more','#c8f07a']:a<70?['A bit blurry','#ffd36a']:a<200?['Blurry – keep turning','#ffab6a']:['Very blurry – doughnuts!','#ff8a6a'];}
// draw the out-of-focus image: copies of the sharp picture spread round a ring (with the secondary's shadow in the middle)
const dfTmp=document.createElement('canvas'),CAN_BLUR='filter' in CanvasRenderingContext2D.prototype;
function applyDefocus(x,c,r){
  if(r<.6)return;const W=c.width,H=c.height;seeTmp.width=W;seeTmp.height=H;seeTmp.getContext('2d').drawImage(c,0,0);
  dfTmp.width=W;dfTmp.height=H;const d=dfTmp.getContext('2d');d.fillStyle='#000';d.fillRect(0,0,W,H);d.globalCompositeOperation='lighten';
  // 'lighten' keeps the brightest copy at each pixel, so a star smeared round the ring stays easy to see and the sky stays the same
  const rings=r<3?[1]:[.62,.8,.92,1];let budget=96;                // inner radius ≈ the secondary mirror's shadow (34% of the aperture)
  for(const k of rings){const n=Math.min(36,Math.max(8,Math.round(Math.PI*2*k*r/5)),budget);budget-=n;for(let i=0;i<n;i++){const a=i/n*Math.PI*2+k*2;d.drawImage(seeTmp,Math.cos(a)*r*k,Math.sin(a)*r*k);}}
  x.save();x.setTransform(1,0,0,1,0,0);x.globalCompositeOperation='source-over';x.globalAlpha=1;
  if(CAN_BLUR)x.filter=`blur(${Math.max(.6,r*.12).toFixed(1)}px)`;x.drawImage(dfTmp,0,0);x.restore();}
function setFocus(p,quiet){FOCUS.pos=clamp(p,-20,20);
  const e=EXPL.find(e=>e.g===gPri);if(e){if(!e.base0)e.base0=e.base.clone();e.base.z=e.base0.z+FOCUS.pos*.0012;}   // slide the primary (exaggerated so you can see it in the cutaway)
  ALLM.forEach(m=>{if(m.userData.part==='focuser'&&m.userData.sub==='knob')m.rotation.z=-FOCUS.pos*Math.PI*2;});      // turn the knob
  if(!quiet)focusUI();}
function focusStep(d){const before=focusSharp(EPS[epI]);setFocus(FOCUS.pos+d);if(!before&&focusSharp(EPS[epI]))haptic('success');else haptic('tap');}
function focusAuto(){                                           // "focus for me": turn the knob smoothly to the best spot
  const tgt=FOCUS_BEST[epI]||0,start=FOCUS.pos,t0=performance.now(),dur=Math.min(2200,400+Math.abs(tgt-start)*500);
  (function step(){const k=Math.min(1,(performance.now()-t0)/dur),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;setFocus(start+(tgt-start)*e);if(k<1)requestAnimationFrame(step);else haptic('success');})();}
function focusRowHTML(id){return `<div class="focrow" id="${id}"><span class="lbl">Focus</span>
  <button class="b sm" data-fs="-0.5" title="Turn the knob a lot (coarse)">⟲⟲</button><button class="b sm" data-fs="-0.05" title="Turn a little (fine)">⟲</button>
  <span class="fm"><i></i><b></b></span>
  <button class="b sm" data-fs="0.05" title="Turn a little (fine)">⟳</button><button class="b sm" data-fs="0.5" title="Turn the knob a lot (coarse)">⟳⟳</button>
  <button class="b sm" data-fauto>🎯 Focus for me</button></div>`;}
function focusUI(){
  const ep=EPS[epI],[w,col]=focusWord(ep),err=focusErr(ep),fill=clamp(1-apparentBlur(ep)/300,0,1);
  $$('.focrow').forEach(r=>{const m=r.querySelector('.fm');m.querySelector('i').style.cssText=`width:${fill*100}%;background:${col}`;
    m.querySelector('b').textContent=ep.finder?'Finder focuses itself':w;
    r.querySelectorAll('button').forEach(b=>b.disabled=!!ep.finder);});
  const t=document.getElementById('focTip');if(t)t.textContent=ep.finder?'':Math.abs(err)<.06?'':`Tip: turn ${err>0?'⟲ anticlockwise':'⟳ clockwise'} – the knob is ${Math.abs(err).toFixed(1)} turns away.`;}
// hold a focus button to keep turning; drag sideways (or use the mouse wheel) on an eyepiece view to focus
document.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-fs]');if(!b||b.disabled)return;const d=+b.dataset.fs;focusStep(d);
  clearInterval(FOCUS.hold);const t=setTimeout(()=>{FOCUS.hold=setInterval(()=>focusStep(d),70);},380);
  const stop=()=>{clearTimeout(t);clearInterval(FOCUS.hold);FOCUS.hold=null;removeEventListener('pointerup',stop);removeEventListener('pointercancel',stop);};
  addEventListener('pointerup',stop);addEventListener('pointercancel',stop);});
document.addEventListener('click',e=>{if(e.target.closest('[data-fauto]'))focusAuto();});
['#eppC','#epMini','#epBig'].forEach(s=>{const c=document.querySelector(s);if(!c)return;let x0=null;
  c.addEventListener('wheel',e=>{if(EPS[epI].finder)return;e.preventDefault();focusStep(e.deltaY>0?-.05:.05);},{passive:false});
  c.addEventListener('pointerdown',e=>{if(EPS[epI].finder)return;x0=e.clientX;c.setPointerCapture(e.pointerId);});
  c.addEventListener('pointermove',e=>{if(x0===null)return;const d=(e.clientX-x0)/120;if(Math.abs(d)>=.02){focusStep(d);x0=e.clientX;}});
  const end=()=>{x0=null;};c.addEventListener('pointerup',end);c.addEventListener('pointercancel',end);c.style.touchAction='pan-y';c.title='Drag sideways (or scroll) to focus';});
// put a focus row under every eyepiece picker (Control tab, Sky tab and the "look through it" pop-up)
[['#epRowMini','focMini'],['#epRow','focSky'],['#epRowPop','focPop']].forEach(([s,id])=>{const e=document.querySelector(s);if(e)e.insertAdjacentHTML(id==='focPop'?'beforebegin':'afterend',focusRowHTML(id)+(id==='focPop'?'<div class="sm mu" id="focTip"></div>':''));});   // in the pop-up, focus sits right under the view
setFocus(FOCUS.pos,true);focusUI();setInterval(focusUI,400);
