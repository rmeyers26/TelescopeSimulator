/* Telescope Simulator – 08-ui.js
   Classic script (not an ES module) so the page also works when opened straight from disk.
   All files share one global scope and must load in numeric order (see index.html). */
'use strict';
/* =====================================================================
   8. UI: tabs, parts list, info panel
   ===================================================================== */
const TABS=[['parts','Parts'],['miss','Missions'],['setup','Setup'],['info','Info'],['ctrl','Control'],['sky','Sky'],['learn','Learn'],['link','Link']];
let curTab='parts';
$('#tabs').innerHTML=TABS.map(([k,n])=>`<button data-t="${k}" class="${k==='parts'?'on':''}">${n}</button>`).join('')+'<button class="min" id="bMin">▾</button>';
function tab(k){if(k==='setup'&&!SU.on)setupGo(0);curTab=k;$$('#tabs button[data-t]').forEach(b=>b.classList.toggle('on',b.dataset.t===k));$$('.pane').forEach(p=>p.classList.toggle('on',p.id==='p-'+k));$('#dock').classList.remove('min');$('#bMin').textContent='▾';}
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.id==='bMin'){const m=$('#dock').classList.toggle('min');b.textContent=m?'▴':'▾';return;}if(b.dataset.t)tab(b.dataset.t);});
function toast(t,ms){const e=$('#toast');e.textContent=t;e.style.opacity=1;clearTimeout(toast.h);toast.h=setTimeout(()=>e.style.opacity=0,ms||2400);}

function renderParts(){
  let h='<h3>Optical path (click a part)</h3>'+schem(sel.part,true)+'<p class="sm mu">Click any part in the diagram or 3D view. Eye icons hide parts. Use <b>Cutaway</b> and <b>Optics</b> above to see light travel.</p>';
  for(const [g,ids] of GROUPS){h+=`<h3>${g}</h3>`;for(const id of ids)h+=`<div class="pl${sel.part===id?' on':''}" data-p="${id}"><span class="eye${hidden.has(id)?' off':''}" data-eye="${id}">👁</span><span style="flex:1">${INFO[id].n}</span><span class="mu">›</span></div>`;}
  $('#p-parts').innerHTML=h;
}
$('#p-parts').addEventListener('click',e=>{const eye=e.target.closest('[data-eye]');if(eye){toggleHide(eye.dataset.eye);renderParts();return;}const p=e.target.closest('[data-p]');if(p)selectPart(p.dataset.p,null,true);});

const KID={
 tube:'The big white tube holds all the glass and mirrors in exactly the right places. It is sealed so dust and bugs stay out.',
 corrector:'The thin glass window at the front. Starlight comes in here first. It gently bends the light so the picture comes out sharp.',
 secondary:'A small mirror stuck to the middle of the front glass. It catches the light from the big mirror and bounces it back down the tube.',
 primary:'The big curved mirror at the back. It collects lots of light – about 1,600 times more than your eye – and bounces it forward.',
 baffle:'A black tube in the middle that stops stray light from sneaking into your eyepiece, so the sky looks dark and stars look sharp.',
 rearcell:'The black back end of the tube. It holds the big mirror, the focus knob and the vents that let warm air out.',
 focuser:'The focus knob. Turn it slowly until stars become tiny sharp dots – just like focusing binoculars.',
 dew:'A tube on the front that stops dew (water drops) from forming on the glass on cold nights.',
 visualback:'The ring on the back that eyepieces and cameras attach to.',
 diagonal:'A little box with a mirror that turns the light sideways, so you can look down into the eyepiece instead of lying on the ground.',
 eyepiece:'The part you look into. It works like a magnifying glass. Small numbers (like 6 mm) mean bigger, closer views.',
 kit:'A case of extra eyepieces and colourful filters. Swap eyepieces to zoom in or out; filters can bring out details on planets.',
 finder:'A mini telescope on top. It sees a wide part of the sky, so you can aim the big telescope more easily.',
 starsense:'A small camera that takes pictures of the stars and works out where the telescope is pointing all by itself.',
 telrad:'A pointer with no zoom. You look through the window and see red circles floating on the sky – put them on your target.',
 dovetail:'A metal rail on top of the tube where finders and pointers clip on.',
 fork:'The two black arms and round base. Motors inside turn the telescope left-right and up-down to find and follow stars.',
 tripod:'The three-legged stand. It holds everything steady. Lower legs = less wobble.',
 power:'A big rechargeable battery. A cable carries 12 volts from it to the telescope so the motors and hand controller work far from a wall plug. Watch the % on its screen go down as you use the telescope!',
 handset:'The hand controller. Press buttons to move the telescope, or pick an object and press ENTER – the telescope goes there by itself!'};
const edu={on:false};
function showInfo(){
  const el=$('#p-info'),id=sel.part;
  if(edu.on&&id&&KID[id]){const I=INFO[id];el.innerHTML=`<h2>${I.n}</h2>`+schem(id,false)+`<div class="kid">${KID[id]}</div><div class="row"><button class="b sm" data-a="focus">Show me</button><button class="b sm${sel.solo===id?' on':''}" data-a="solo">Pull it out</button><button class="b sm" data-a="clear">Done</button></div><p class="mu sm">Turn off Education mode in the toolbar for the full technical details.</p>`;return;}
  if(!id){el.innerHTML='<h2>Component info</h2><p class="mu">Click a component in the 3D view, the diagram or the Parts list to drill into its construction, how it works, specifications, maintenance and troubleshooting.</p>';return;}
  const I=INFO[id];let h=`<h2>${I.n}</h2>`+schem(id,false);
  h+=`<div class="row"><button class="b sm" data-a="focus">Focus camera</button><button class="b sm${sel.isolate?' on':''}" data-a="iso">Isolate</button><button class="b sm${sel.solo===id?' on':''}" data-a="solo">Pull out of assembly</button><button class="b sm" data-a="clear">Clear</button></div>`;
  h+=`<h3>What it is</h3><p>${I.d}</p><h3>Purpose</h3><p>${I.p}</p><h3>How it works</h3><p>${I.h}</p><h3>Interacts with</h3><p>${I.i}</p>`;
  if(I.subs.length){h+='<h3>Subcomponents</h3><div>'+I.subs.map(s=>`<button class="b sm sub${sel.sub===s[0]?' on':''}" data-sub="${s[0]}">${s[1]}</button>`).join('')+'</div>';
    const cur=I.subs.find(s=>s[0]===sel.sub);if(cur)h+=`<div class="tb"><b>${cur[1]}</b><br>${cur[2]}</div>`;}
  h+='<h3>Specifications</h3><table>'+I.spec.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')+'</table><p class="sm mu">Values are approximate and model-dependent; check your scope’s manual.</p>';
  h+='<h3>Maintenance</h3><ul>'+I.m.map(x=>`<li>${x}</li>`).join('')+'</ul><h3>Troubleshooting</h3>'+I.t.map(r=>`<div class="tb"><b>${r[0]}</b><br>${r[1]}</div>`).join('');
  el.innerHTML=h;
}
$('#p-info').addEventListener('click',e=>{
  const a=e.target.closest('[data-a]'),s=e.target.closest('[data-sub]'),p=e.target.closest('[data-p]');
  if(p){selectPart(p.dataset.p,null,false);return;}
  if(s){sel.sub=sel.sub===s.dataset.sub?null:s.dataset.sub;showInfo();return;}
  if(!a)return;const k=a.dataset.a;
  if(k==='focus')focusPart(sel.part);else if(k==='iso'){sel.isolate=!sel.isolate;showInfo();}
  else if(k==='solo'){sel.solo=sel.solo===sel.part?null:sel.part;showInfo();}else if(k==='clear')selectPart(null);
});
function focusPart(id){
  scene.updateMatrixWorld(true);const b=new THREE.Box3();ALLM.filter(m=>m.userData.part===id).forEach(m=>b.expandByObject(m));
  const c=b.getCenter(V3(0,0,0)),s=b.getSize(V3(0,0,0));setMode('orbit');
  const d=clamp(s.length()*1.5,.5,6),off=camera.position.clone().sub(V3(cam.tx,cam.ty,cam.tz)).normalize().multiplyScalar(d);tweenTo(toOrbit(c.clone().add(off),c));
}
renderParts();showInfo();



/* ---- phone bottom sheet: three sizes (peek = tabs only, half, tall) plus free dragging ---- */
const sheet={h:0};
function sheetSizes(){const H=innerHeight;return {peek:64,mid:Math.round(H*.4),full:Math.round(H*.86)};}
function setSheet(px,snap){const S=sheetSizes(),H=innerHeight;px=clamp(px,S.peek,S.full);
  if(snap){const c=[S.peek,S.mid,S.full];px=c.reduce((a,b)=>Math.abs(b-px)<Math.abs(a-px)?b:a);}
  sheet.h=px;document.documentElement.style.setProperty('--sheet',px+'px');$('#dock').classList.toggle('min',px<=S.peek+4);if(typeof resize==='function')resize();}
(function(){const g=$('#grab');let y0=null,h0=0,moved=0;
  g.addEventListener('pointerdown',e=>{g.setPointerCapture(e.pointerId);y0=e.clientY;h0=$('#dock').getBoundingClientRect().height;moved=0;$('#dock').classList.add('dragging');});
  g.addEventListener('pointermove',e=>{if(y0===null)return;const d=y0-e.clientY;moved=Math.max(moved,Math.abs(d));setSheet(h0+d,false);});
  const end=()=>{if(y0===null)return;$('#dock').classList.remove('dragging');const S=sheetSizes();
    if(moved<6)setSheet(h0>S.peek+4?S.peek:S.mid,true);else setSheet(sheet.h,true);y0=null;};   // a tap toggles hidden / half
  g.addEventListener('pointerup',end);g.addEventListener('pointercancel',end);})();
// on a phone, tapping a tab while the sheet is hidden opens it again
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('[data-t]');if(b&&matchMedia('(max-width:780px)').matches&&$('#dock').classList.contains('min'))setSheet(sheetSizes().mid,true);});

/* ---- haptic (vibration) feedback on phones ----
   Android/Chrome: Vibration API. iPhone Safari has no vibration API, but toggling a hidden <input type="checkbox" switch>
   gives a light system "tick" on iOS 18+, so we use that as a fallback (it simply does nothing on older iPhones). */
const HAP={on:true,last:0};try{HAP.on=localStorage.getItem('c11hap')!=='0';}catch(_){}
const HAP_PAT={tap:8,key:12,hold:18,power:[25,60,25],arrive:[20,40,20],success:[30,50,30,50,70],warn:[90,50,90]};
function haptic(kind){
  if(!HAP.on)return;const now=performance.now();if(kind==='tap'&&now-HAP.last<60)return;HAP.last=now;
  const p=HAP_PAT[kind]||HAP_PAT.tap;
  if(navigator.vibrate){try{navigator.vibrate(p);}catch(_){}return;}
  const sw=document.querySelector('#hapSw');if(!sw)return;const n=Array.isArray(p)?Math.ceil(p.length/2):1;   // iOS: one tick per pulse
  for(let i=0;i<n;i++)setTimeout(()=>sw.click(),i*90);}
function setHap(v){HAP.on=v;try{localStorage.setItem('c11hap',v?'1':'0');}catch(_){}$('#bHap').classList.toggle('on',v);if(v)haptic('key');}
$('#bHap').classList.toggle('on',HAP.on);$('#bHap').onclick=()=>setHap(!HAP.on);
// a light tick for every button press (touch screens only); specific actions add stronger patterns
document.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;const b=e.target.closest('button,.pl,[data-kt],[data-w],[data-scope],[data-ms],[data-ep]');if(!b)return;
  haptic(b.closest('.hc,.kgrid')?'key':'tap');},{passive:true});
