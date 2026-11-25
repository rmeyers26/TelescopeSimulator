/* Telescope Simulator – 15-main.js
   Classic script (not an ES module) so the page also works when opened straight from disk.
   All files share one global scope and must load in numeric order (see index.html). */
'use strict';
/* =====================================================================
   13. MAIN LOOP
   ===================================================================== */
function resize(){                                // keep the telescope centred in the part of the screen the dock does not cover
  const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;
  const mobile=matchMedia('(max-width:780px)').matches,minimized=$('#dock').classList.contains('min');
  const dh=mobile?$('#dock').getBoundingClientRect().height||h*.4:0;   // phone: shift the view up by half the sheet so the scope sits in the visible part
  if(mobile)camera.setViewOffset(w,h,0,Math.round(dh/2),w,h);else camera.setViewOffset(w,h,200,0,w,h);
  camera.updateProjectionMatrix();
}
addEventListener('resize',()=>{if(matchMedia('(max-width:780px)').matches&&sheet.h)setSheet(sheet.h,true);resize();});
$('#dock').addEventListener('transitionend',resize);$('#tabs').addEventListener('click',()=>setTimeout(resize,0));resize();
let last=performance.now(),hudT=0,frame=0;
function grainShift(t){const g=$('#grain');g.style.transform=`translate(${(Math.sin(t*37)*20)|0}px,${(Math.cos(t*29)*20)|0}px)`;}
function loop(now){
  requestAnimationFrame(loop);
  const dt=clamp((now-last)/1000,0,.05);last=now;frame++;const t=now/1000;   // dt never negative (the first frame's timestamp can precede start-up)
  simMs+=dt*1000*speed;
  pollPad(dt);feedMount();if(POWER.on)driver.update(dt);computeSky();   // no power: motors stop and tracking pauses
  // mount pose
  const tr=driver.truth();azG.rotation.y=-tr.az*D2R;altG.rotation.x=tr.alt*D2R;
  // explode (global slider, plus a single part pulled out on request)
  exp.cur+=(exp.target-exp.cur)*Math.min(1,dt*6);exp.solo+=((sel.solo?1:0)-exp.solo)*Math.min(1,dt*6);
  for(const e of EXPL){const k=Math.max(exp.cur,e.part===sel.solo?exp.solo:0);e.g.position.set(e.base.x+e.exp.x*k,e.base.y+e.exp.y*k,e.base.z+e.exp.z*k);}
  altG.position.y=.5+.55*exp.cur;
  scene.updateMatrixWorld(true);updateClip();applyHighlight(t);
  raysG.visible=(optics.on||cut.on)&&exp.cur<.03&&!photon.on;   // the single photon replaces the ray bundle during Follow the light
  if(raysG.visible)for(const p of particles){p.t=(p.t+dt*.16)%1;let d=p.t*p.L,i=0;while(i<p.lens.length-1&&d>p.lens[i]){d-=p.lens[i];i++;}p.s.position.copy(p.pts[i]).lerp(p.pts[i+1],clamp(d/p.lens[i],0,1));}
  updateDome();
  // camera
  if(cam.mode==='walk'){
    const f=(keys.w?1:0)-(keys.s?1:0)-joy.y,r=(keys.d?1:0)-(keys.a?1:0)+joy.x,sp=(keys.shift?3.2:1.6)*dt;
    cam.px+=(-Math.sin(cam.wyaw)*f+Math.cos(cam.wyaw)*r)*sp;cam.pz+=(-Math.cos(cam.wyaw)*f-Math.sin(cam.wyaw)*r)*sp;
    const rr=Math.hypot(cam.px,cam.pz);if(rr<.75){cam.px*=.75/rr;cam.pz*=.75/rr;}if(rr>60){cam.px*=60/rr;cam.pz*=60/rr;}
  }else stepTween(dt);
  if(cine.on&&!cine.paused&&cam.mode==='orbit'&&!cam.tw){cam.yaw+=dt*.1;cam.dist=4.3+.9*Math.sin(t*.17);cam.pitch=.14+.1*Math.sin(t*.11);}
  for(let i=0;i<dustN;i++){dustP[i*3+1]+=dt*.03;dustP[i*3]+=Math.sin(t*.3+i)*dt*.01;if(dustP[i*3+1]>4)dustP[i*3+1]=0;}dustG.attributes.position.needsUpdate=true;
  {const az=driver.state().truth.az;if(follow.on&&follow.prev!=null&&cam.mode==='orbit'&&!cam.tw){const d=wrap180(az-follow.prev);if(Math.abs(d)>.02&&Math.abs(d)<30)cam.yaw+=d*D2R;}follow.prev=az;}
  if(frame%12===0){hc3Lcd();$('#bStar').classList.toggle('on',!hidden.has('starsense'));}
  if(!dewS.e)dewS.e=EXPL.find(e=>e.part==='dew');dewS.t+=(dewS.to-dewS.t)*Math.min(1,dt*3.2);if(Math.abs(dewS.to-dewS.t)<.0005)dewS.t=dewS.to;dewS.e.base.z=-.9*dewS.t;
  stepPhoton(dt);if(frame%3===0)updPowerCable();{const st=driver.state();updPowerStation(dt,st.slewing||st.moving,st.tracking!=='off');}grainShift(t);
  applyCamera();if(labState.on||frame%30===0)updLabels();
  renderer.render(scene,camera);
  if(frame===12&&!homeState.thumb){try{homeState.thumb=renderer.domElement.toDataURL('image/jpeg',.82);const im=document.querySelector('#home .scard .im');if(im){im.style.backgroundImage=`url(${homeState.thumb})`;im.textContent='';}}catch(_){}}
  // slow UI updates
  if(now-hudT>100){hudT=now;uiTick();}
}
function uiTick(){
  const st=driver.state();
  $('#hud').innerHTML=`<span class="chip">SIMULATED · no hardware</span><br>📍 ${loc.name} · ${localTimeTxt()}<br><span class="hx">Az ${st.az.toFixed(2)}°  Alt ${st.alt.toFixed(2)}°<br>RA ${fmtRA(st.ra)}  Dec ${fmtDec(st.dec)}<br></span>${POWER.on?'':'<b style="color:#ff6b5b">⏻ POWER OFF</b> · '}${trkTxt(st.tracking)} · ${st.parked?'parked':st.slewing?'slewing':st.moving?'moving':'idle'} · ${st.aligned?st.aligned+'-star aligned':'not aligned'}${speed!==1?' · time ×'+speed:''}`;
  if(curTab==='ctrl'){hcDraw();drawEyepiece($('#epMini'));if(edu.on){$('#kstat').textContent=kidStatus();const nw=performance.now();if(!(uiTick.kt>nw-2000)){uiTick.kt=nw;renderKidTiles();}}}
  else if(curTab==='sky'){updSelPos();drawSkyChart($('#skyc'));drawEyepiece($('#epBig'));
    const T=st.truth;$('#truth').innerHTML=`<b>Truth</b> (where the tube points): Az ${T.az.toFixed(2)}° Alt ${T.alt.toFixed(2)}°<br><b>Mount reports</b>: Az ${st.az.toFixed(2)}° Alt ${st.alt.toFixed(2)}°<br><b>Error</b>: ${Math.hypot(wrap180(T.az-st.az)*Math.cos(T.alt*D2R),T.alt-st.alt).toFixed(2)}° ${st.aligned?'(after alignment)':'(not aligned yet)'}`;
    const d=new Date(simMs);$('#timeTxt').textContent=`Sim UTC ${d.toISOString().slice(0,19).replace('T',' ')} · LST ${fmtRA(lstDeg(jdNow()))}`;}
  else hcDraw();
  missionsTick(.1);
  if(st.tracking!==uiTick.trk){uiTick.trk=st.tracking;updTrkRow();}   // rebuild only on change so clicks are not lost
}
// Start pointing at Polaris with Saturn selected: move the sim clock to the next dark sky with Saturn at least 25 deg up, aim the tube at Polaris, track, and use the 13 mm eyepiece.
// Start in Phoenix, AZ at 10 pm tonight (local time), tube on Polaris, Saturn selected, 13 mm eyepiece
(function(){setLocation(0);const SAT=OBJ.find(o=>o.id==='saturn');selObj=SAT;HC.last=SAT;fillSelBox();setEp(3);
  setTimeout(()=>toast(`${loc.name} · ${localTimeTxt()}. The scope is on Polaris; Saturn is selected${SAT.alt>0?'':' (below the horizon right now)'}.`,5500),700);})();
window.__c11={driver,OBJ,key,doGoto,setSpeed,cam,setArms,ALLM,camera,bump:()=>{simMs+=30*60000;computeSky();}};   // small debug hook
fillSelBox();hcDraw();
// CPC 11 drawing: the altitude axis is 366 mm behind the front of the OTA and 285 mm in front of the rear end, so slide the whole OTA forward on its pivot.
{const otaG=new THREE.Group();[...altG.children].filter(c=>c!==gDrv).forEach(c=>otaG.add(c));altG.add(otaG);otaG.position.z=-.0835;}
tweenTo({tx:0,ty:1.45,tz:0,yaw:2.4,pitch:.22,dist:3.5});cam.tw=null;
requestAnimationFrame(loop);
