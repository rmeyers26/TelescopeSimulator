/* Telescope Simulator – 07-camera.js
   Classic script (not an ES module) so the page also works when opened straight from disk.
   All files share one global scope and must load in numeric order (see index.html). */
'use strict';
/* =====================================================================
   7. CAMERA (orbit / walk), PICKING, HIGHLIGHT, CUTAWAY
   ===================================================================== */
const cam={mode:'orbit',tx:0,ty:1.45,tz:0,yaw:2.4,pitch:.22,dist:3.5,px:0,py:1.7,pz:4.5,wyaw:0,wpitch:0,tw:null};
const keys={},joy={x:0,y:0},ray=new THREE.Raycaster(),mouse=new THREE.Vector2();
function applyCamera(){
  if(cam.mode==='orbit'){const cp=Math.cos(cam.pitch);
    camera.position.set(cam.tx+cam.dist*Math.sin(cam.yaw)*cp,cam.ty+cam.dist*Math.sin(cam.pitch),cam.tz+cam.dist*Math.cos(cam.yaw)*cp);camera.lookAt(cam.tx,cam.ty,cam.tz);}
  else{camera.position.set(cam.px,cam.py,cam.pz);camera.rotation.order='YXZ';camera.rotation.set(cam.wpitch,cam.wyaw,0);}
}
function tweenTo(to){cam.tw={t:0,dur:.9,f:{tx:cam.tx,ty:cam.ty,tz:cam.tz,yaw:cam.yaw,pitch:cam.pitch,dist:cam.dist},to};}
function stepTween(dt){const w=cam.tw;if(!w)return;w.t=Math.min(1,w.t+dt/w.dur);const e=w.t<.5?2*w.t*w.t:1-Math.pow(-2*w.t+2,2)/2;
  for(const k of ['tx','ty','tz','dist','pitch'])cam[k]=w.f[k]+(w.to[k]-w.f[k])*e;cam.yaw=w.f.yaw+wrap180((w.to.yaw-w.f.yaw)*R2D)*D2R*e;if(w.t>=1)cam.tw=null;}
function toOrbit(posV,tgt){const d=posV.clone().sub(tgt),dist=d.length();return {tx:tgt.x,ty:tgt.y,tz:tgt.z,dist:clamp(dist,.3,14),yaw:Math.atan2(d.x,d.z),pitch:clamp(Math.asin(d.y/dist),-1.5,1.5)};}
function setMode(m){
  if(m===cam.mode)return;
  if(m==='walk'){const p=camera.position,d=V3(cam.tx-p.x,0,cam.tz-p.z);cam.px=p.x;cam.pz=p.z;if(Math.hypot(cam.px,cam.pz)<1)cam.pz=3;cam.py=1.7;cam.wyaw=Math.atan2(-d.x,-d.z);cam.wpitch=-.05;}
  else{const t=V3(0,mountPivY(),0);Object.assign(cam,toOrbit(camera.position,t));camera.fov=cine.on?32:45;camera.updateProjectionMatrix();}
  cam.mode=m;document.body.classList.toggle('walk',m==='walk');$('#bOrbit').classList.toggle('on',m==='orbit');$('#bWalk').classList.toggle('on',m==='walk');cam.tw=null;
}
function viewFrom(kind){
  setMode('orbit');scene.updateMatrixWorld(true);
  const piv=V3(0,mountPivY()+exp.cur*.55,0),dir=V3(0,0,-1).transformDirection(altG.matrixWorld),ax=V3(1,0,0).transformDirection(altG.matrixWorld),up=V3(0,1,0).transformDirection(altG.matrixWorld);
  let off;
  if(kind==='front')off=dir.clone().multiplyScalar(2.6).add(V3(0,.3,0));
  else if(kind==='rear')off=dir.clone().multiplyScalar(-2.6).add(V3(0,.3,0));
  else if(kind==='right'||kind==='side')off=ax.clone().multiplyScalar(2.6);   // right/left as seen by an observer standing behind the eyepiece
  else if(kind==='left')off=ax.clone().multiplyScalar(-2.6);
  else if(kind==='top')off=up.clone().multiplyScalar(2.8).add(dir.clone().multiplyScalar(-.05));
  else if(kind==='cut')off=ax.clone().multiplyScalar(1.5).add(up.clone().multiplyScalar(.95)).add(dir.clone().multiplyScalar(.2)).add(V3(0,.1,0));   // looking into the open wedge
  else if(kind==='light')off=ax.clone().multiplyScalar(.75).add(V3(0,.95,0));    // above the near fork arm, looking into the cut-away tube
  else off=V3(2.2,.9,-2.3).multiplyScalar(1.1);
  tweenTo(toOrbit(piv.clone().add(off),piv));
}
function pan(dx,dy){                            // drag the scene: target moves opposite to a horizontal drag, with a vertical drag
  const r=V3(1,0,0).transformDirection(camera.matrix),s=cam.dist*.0016;
  cam.tx=clamp(cam.tx-r.x*dx*s,-3,3);cam.tz=clamp(cam.tz-r.z*dx*s,-3,3);cam.ty=clamp(cam.ty+dy*s,.2,3);}
const ptrs=new Map();let down=null;
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY,b:e.button});
  if(ptrs.size===1)down={t:performance.now(),m:0};else if(down)down.m=99;cam.tw=null;});
cv.addEventListener('pointermove',e=>{const p=ptrs.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;
  if(ptrs.size===1){if(down)down.m+=Math.abs(dx)+Math.abs(dy);
    if(cam.mode==='walk'){cam.wyaw-=dx*.004;cam.wpitch=clamp(cam.wpitch-dy*.004,-1.4,1.4);}
    else if(e.shiftKey||p.b===2||e.ctrlKey)pan(dx,dy);
    else{cam.yaw-=dx*.006;cam.pitch=clamp(cam.pitch+dy*.006,-1.5,1.5);}}
  else if(ptrs.size===2&&cam.mode==='orbit'){const o=[...ptrs.entries()].find(([id])=>id!==e.pointerId)[1];
    const d0=Math.hypot(p.x-o.x,p.y-o.y),d1=Math.hypot(e.clientX-o.x,e.clientY-o.y);cam.dist=clamp(cam.dist*d0/Math.max(d1,1),.25,14);pan(dx/2,dy/2);}
  p.x=e.clientX;p.y=e.clientY;});
const endPtr=e=>{if(!ptrs.has(e.pointerId))return;ptrs.delete(e.pointerId);if(ptrs.size===0&&down&&down.m<8&&performance.now()-down.t<600&&e.type==='pointerup')pick(e);if(ptrs.size===0)down=null;};
cv.addEventListener('pointerup',endPtr);cv.addEventListener('pointercancel',endPtr);
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('wheel',e=>{e.preventDefault();if(cam.mode==='orbit'){cam.dist=clamp(cam.dist*Math.exp(e.deltaY*.001),.25,14);cam.tw=null;}},{passive:false});
// virtual joystick for walking on touch screens
(function(){const j=$('#joy'),k=j.querySelector('i');let id=null;
  const set=e=>{const r=j.getBoundingClientRect(),x=(e.clientX-r.left-48)/40,y=(e.clientY-r.top-48)/40,l=Math.hypot(x,y),s=l>1?1/l:1;joy.x=x*s;joy.y=y*s;k.style.transform=`translate(${joy.x*30}px,${joy.y*30}px)`;};
  j.addEventListener('pointerdown',e=>{id=e.pointerId;j.setPointerCapture(id);set(e);});j.addEventListener('pointermove',e=>{if(e.pointerId===id)set(e);});
  const end=e=>{if(e.pointerId===id){id=null;joy.x=joy.y=0;k.style.transform='';}};j.addEventListener('pointerup',end);j.addEventListener('pointercancel',end);})();

const sel={part:null,sub:null,isolate:false,solo:null},hidden=new Set(['starsense']),exp={target:0,cur:0,solo:0};
function pick(e){
  const r=cv.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(mouse,camera);
  const shown=o=>{for(;o;o=o.parent)if(!o.visible)return false;return true;};
  const hits=ray.intersectObjects(ALLM.filter(m=>shown(m)&&m.userData.part&&!hidden.has(m.userData.part)),false);
  for(const h of hits){
    if(cut.on&&h.object.userData.clip){const lp=altG.worldToLocal(h.point.clone());if(inCutWedge(lp))continue;}
    selectPart(h.object.userData.part,h.object.userData.sub,true);return;}
  selectPart(null);
}
function selectPart(id,sub,openTab){
  sel.part=id;sel.sub=sub||null;if(id&&hidden.has(id))toggleHide(id);
  if(!id){sel.isolate=false;sel.solo=null;}
  showInfo();renderParts();if(id&&openTab)tab(id==='handset'?'ctrl':'info');
}
function applyHighlight(t){
  const pulse=.45+.25*Math.sin(t*4);
  for(const m of ALLM){const mt=m.material,u=m.userData,on=sel.part&&u.part===sel.part&&(!sel.sub||u.sub===sel.sub);
    if(u.glow&&!on){mt.emissive.setHex(0xd00000);mt.emissiveIntensity=1;}else if(u.led&&!on){mt.emissive.setHex(POWER.on?0xff2a18:0x000000);mt.emissiveIntensity=POWER.on?1.1:0;mt.color.setHex(POWER.on?0x8a140c:0x2a0806);}else{mt.emissive.setHex(on?0x2a7fff:0x000000);mt.emissiveIntensity=on?pulse:0;}
    const ghost=sel.part&&sel.isolate&&u.part!==sel.part;
    mt.transparent=ghost?true:u.o0.t;mt.opacity=ghost?.08:u.o0.o;mt.depthWrite=ghost?false:u.o0.d;
    m.visible=!hidden.has(u.part);}
}
function toggleHide(id){hidden.has(id)?hidden.delete(id):hidden.add(id);}

// Cutaway: two planes through the tube axis remove a 120° wedge (from 30° below the right side up to the very top),
// like Celestron's cutaway drawings. clipIntersection=true means only the region behind BOTH planes is cut away.
const cut={on:false},optics={on:false},clipPlane=new THREE.Plane(),clipPlane2=new THREE.Plane();
function setCut(v){cut.on=v;$('#bCut').classList.toggle('on',v);CLIPM.forEach(m=>{m.material.clippingPlanes=v?[clipPlane,clipPlane2]:null;m.material.clipIntersection=true;m.material.needsUpdate=true;});if(v)viewFrom('cut');}
const inCutWedge=lp=>lp.x>.001&&(.5*lp.x+.866*lp.y)>.001;      // altG-local point that the cutaway removes
function updateClip(){const p=V3(0,0,0).applyMatrix4(altG.matrixWorld);
  clipPlane.setFromNormalAndCoplanarPoint(V3(-1,0,0).transformDirection(altG.matrixWorld),p);
  clipPlane2.setFromNormalAndCoplanarPoint(V3(-.5,-.866,0).transformDirection(altG.matrixWorld),p);}

