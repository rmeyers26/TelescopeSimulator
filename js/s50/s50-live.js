/* Seestar S50 Pro Simulator – s50-live.js
   The live view (what the camera sees), imaging control (start/stop/shutter/video), scenarios, the main loop and start-up.
   Loaded last: uses everything from the other files. */
'use strict';

/* =====================================================================
   1. OFFSCREEN PICTURES, STACK CONTROL, CAPTURE
   ===================================================================== */
const offs={};
function offFor(cam){                                          // a hidden canvas at the camera's own resolution
  if(!offs[cam.name]){const cv=document.createElement('canvas');cv.width=cam.w;cv.height=cam.h;const ctx=cv.getContext('2d');offs[cam.name]={cv,ctx,img:ctx.createImageData(cam.w,cam.h)};}
  return offs[cam.name];
}
let lastDrawn=null;
const anyOn=()=>sTele.on||sWide.on||sTrail.on;
/* Stop whatever is stacking and save it to the album (like pressing Stop). `clear` also forgets the picture (the target changed). */
function stopAllStacks(clear){
  for(const s of [sTele,sWide,sTrail]){const was=s.on;s.stop();if(was&&s.N>0){saveStack(s);lastDrawn=null;}if(clear)s.clear();}
  if(clear){sLive.clear();A.snap=null;A.goMark=null;}
}
function toggleStack(){
  const s=activeStack();
  if(s.on){s.stop();saveStack(s);lastDrawn=null;A.stopped=true;toast('Stopped. The stacked image was saved to the album.');return;}
  if(!mount.ready)return toast('Power on and connect first.');
  if(mount.parked)return toast('The lens is in the zero position – GoTo a target first.');
  if(s.kind==='trails'){mount.target=null;mount.mode='idle';s.prepare(mount);s.start(mount);A.stopped=false;toast('Star trails: the mount now holds still.');return;}
  if(mount.mode!=='track')return toast('GoTo a target first and wait until it is tracking.');
  A.stopped=false;if(!s.start(mount))toast('Could not start – is the telescope tracking?');
}
function capture(){
  if(!mount.usable)return toast('Power on and connect first.');
  if(mount.parked)return toast('The lens is in the zero position – GoTo a target or use the joystick first.');
  if(A.mode==='mw'&&A.mw==='photo'&&A.cam==='wide'){
    if(A.snap)return;if(mount.mode!=='track')return toast('Use SkyAtlas to GoTo the Milky Way first, and wait until it is tracking.');
    A.snap={rem:sWide.exposure,E:sWide.exposure};toast(`Exposing for ${sWide.exposure} s…`);return;
  }
  const nm=A.mode==='scenery'?'Scenery':mount.target?mount.target.name:A.cam==='wide'?'Wide view':'Photo';
  const t=captureCanvas(lv,.92);if(!t)toast('The browser would not let me save this picture (the Moon photo blocks it when the page is opened from a file).');
  addAlbum({kind:'photo',name:nm,thumb:t,size:5});toast('Photo saved to the album.');
}
function toggleRecord(){
  if(A.rec){try{A.rec.mr.stop();}catch(_){}return;}
  if(!mount.usable||mount.parked)return toast('Power on, connect, and lift the lens first.');
  try{
    const mr=new MediaRecorder(lv.captureStream(24)),chunks=[],t0=performance.now(),thumb=captureCanvas(lv,.8);
    mr.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    mr.onstop=()=>{const dur=Math.round((performance.now()-t0)/1000);addAlbum({kind:'video',name:'Video '+(mount.target?mount.target.name:A.cam),thumb,url:URL.createObjectURL(new Blob(chunks,{type:'video/webm'})),dur,size:Math.max(2,dur*0.5)});A.rec=null;$('#recbtn').classList.remove('rec');toast('Video saved to the album.');};
    mr.start();A.rec={mr,t0};$('#recbtn').classList.add('rec');toast('Recording… tap ⏺ again to stop.');
  }catch(_){toast('Video recording is not supported by this browser.');}
}
$('#shutter').onclick=capture;$('#recbtn').onclick=toggleRecord;

/* Tap-to-GO in the wide view (manual §2.8.2): tap a spot once to place a GO marker, tap it again to slew there. */
$('#lv').addEventListener('click',e=>{
  if(A.cam!=='wide'||!mount.usable||mount.parked)return;
  const r=lv.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*lv.width,y=(e.clientY-r.top)/r.height*lv.height,now=performance.now();
  if(A.goMark&&now-A.goMark.t<6000&&Math.hypot(A.goMark.x-x,A.goMark.y-y)<45){
    const c=CAM.wide,z=A.zoom,px=((x/lv.width)*c.w-c.w/2)/z+c.w/2,py=((y/lv.height)*c.h-c.h/2)/z+c.h/2,p=widePixToAltAz(c,mount.az,mount.alt,px,py);
    A.goMark=null;stopAllStacks(true);mount.target=null;const r2=mount.gotoObj(makePointTarget(clamp(p.alt,0,89),p.az));if(!r2.ok)toast(r2.reason);else toast('Slewing to the spot you tapped…');
  }else{A.goMark={x,y,t:now};toast('GO marker placed – tap it again to slew there.',2500);}
});

/* =====================================================================
   2. THE LIVE VIEW
   ===================================================================== */
const lv=$('#lv'),lvc=lv.getContext('2d');
function sunInTele(){return SUN.alt>-1&&!mount.parked&&angDistHor(mount.alt,mount.az,SUN.alt,SUN.az)<CAM.tele.fovLong*0.6;}
function drawStackCrop(stk,cam){
  const off=offFor(cam);
  if(lastDrawn!==stk||stk.dirty){stk.render(off.ctx,off.img);lastDrawn=stk;stk.dirty=false;}
  const z=A.zoom,sw=cam.w/z,sh=cam.h/z;lvc.imageSmoothingEnabled=true;lvc.drawImage(off.cv,(cam.w-sw)/2,(cam.h-sh)/2,sw,sh,0,0,lv.width,lv.height);
}
function blank(msg){lvc.fillStyle='#02030a';lvc.fillRect(0,0,lv.width,lv.height);return msg;}
function drawLive(now){
  const W=lv.width,H=lv.height,m=mount,cam=A.cam==='wide'?CAM.wide:CAM.tele;let msg='',showOverlay=true;
  if(m.power==='off')msg=blank('Telescope is off');
  else if(m.power==='booting')msg=blank('Powering on…');
  else if(m.link!=='connected')msg=blank('Phone not connected'+(anyOn()?' – imaging continues':''));
  else if(m.damaged){msg=blank('SENSOR DAMAGED');lvc.fillStyle='#3a0a0a';lvc.beginPath();lvc.arc(W*.45,H*.4,90,0,6.3);lvc.fill();lvc.fillStyle='#fff';lvc.fillRect(W*.45-3,0,6,H);}
  else if(m.parked)msg=blank('Lens in the zero position – GoTo a target or use the joystick');
  else{
    const st=m.mode;
    if(A.mode==='scenery'){drawScenery(lvc,m,cam,A.zoom,A.dist,now);}
    else if(A.cam==='wide'&&SUN.alt>-6){drawScenery(lvc,m,cam,A.zoom,100,now,true);                  // daytime: a bright sky, not a starry picture
      if(SUN.alt>-2){const p=altAzToWidePix(CAM.wide,m.az,m.alt,SUN.az,SUN.alt);if(p){const z=A.zoom,x=((p.px-cam.w/2)*z+cam.w/2)/cam.w*W,y=((p.py-cam.h/2)*z+cam.h/2)/cam.h*H;lvc.strokeStyle='#ff9a2a';lvc.lineWidth=3;lvc.beginPath();lvc.arc(x,y,20,0,6.3);lvc.stroke();lvc.fillStyle='#ff9a2a';lvc.font='600 22px system-ui';lvc.textAlign='center';lvc.fillText('☀ Sun',x,y-30);}}
      if(A.goMark&&now-A.goMark.t<6000){const g=A.goMark;lvc.strokeStyle='#1d5fd0';lvc.lineWidth=3;lvc.strokeRect(g.x-22,g.y-22,44,44);lvc.fillStyle='#1d5fd0';lvc.font='700 20px system-ui';lvc.textAlign='center';lvc.fillText('GO',g.x,g.y+7);}}
    else if(A.cam==='wide'){
      let w=null;if(A.mode==='mw'){if(A.mw==='trails'&&sTrail.N>0)w=sTrail;else if(A.mw!=='trails'&&sWide.N>0)w=sWide;}
      if(!w&&sLive.sig)w=sLive;
      if(w)drawStackCrop(w,CAM.wide);else blank('');
      if(SUN.alt>-2){const p=altAzToWidePix(CAM.wide,m.az,m.alt,SUN.az,SUN.alt);if(p){const z=A.zoom,x=((p.px-cam.w/2)*z+cam.w/2)/cam.w*W,y=((p.py-cam.h/2)*z+cam.h/2)/cam.h*H;
        lvc.strokeStyle='#ffd34d';lvc.lineWidth=3;lvc.beginPath();lvc.arc(x,y,18,0,6.3);lvc.stroke();lvc.fillStyle='#ffd34d';lvc.font='600 22px system-ui';lvc.textAlign='center';lvc.fillText('☀ Sun',x,y-26);}}
      if(A.lines&&A.mode==='mw'&&w!==sTrail){
        const ref=w===sLive||!w?{az:m.az,alt:m.alt,jd:jdNow()}:w.ref,z=A.zoom;lvc.strokeStyle='rgba(120,190,255,.7)';lvc.lineWidth=2;lvc.beginPath();
        for(const [p,q] of constellationSegments(CAM.wide,ref.az,ref.alt,ref.jd)){const f=(pt)=>[((pt.px-cam.w/2)*z+cam.w/2)/cam.w*W,((pt.py-cam.h/2)*z+cam.h/2)/cam.h*H];const a=f(p),b=f(q);lvc.moveTo(a[0],a[1]);lvc.lineTo(b[0],b[1]);}lvc.stroke();}
      if(A.goMark&&now-A.goMark.t<6000){const g=A.goMark;lvc.strokeStyle='#4da3ff';lvc.lineWidth=3;lvc.strokeRect(g.x-22,g.y-22,44,44);lvc.fillStyle='#4da3ff';lvc.font='700 20px system-ui';lvc.textAlign='center';lvc.fillText('GO',g.x,g.y+7);}
      if(st==='slew'||st==='init'||st==='center'){showOverlay=true;}
    }else{                                                     // telephoto
      const moonNear=MOON.alt>0&&angDistHor(m.alt,m.az,MOON.alt,MOON.az)<CAM.tele.fovLong*0.9;
      if(m.solarFilter){
        if(sunInTele())drawSunView(lvc,m,cam,A.zoom);else msg=blank('Solar filter on: only the Sun is bright enough to see');
      }else if(sunInTele()){lvc.fillStyle='#fff';lvc.fillRect(0,0,W,H);msg='☀ SENSOR OVERLOAD – no solar filter!';}
      else if(moonNear&&(A.mode==='solar'||m.target&&m.target.type==='moon'||st==='manual'||st==='idle')){drawMoonView(lvc,moonImg,m,cam,A.zoom);}
      else if(SUN.alt>-6&&!(m.target&&(m.target.type==='sun'||m.target.type==='moon'))){drawScenery(lvc,m,cam,A.zoom,100,now,true);msg='Daylight: the sky is too bright for deep-sky imaging';}
      else if(st==='slew')msg=blank(`Slewing… ${m.lagDeg.toFixed(1)}° from the target`);
      else if(st==='init'){const s=INIT_STEPS[Math.min(m.initStep,2)];msg=blank(`Initialization ${Math.min(m.initStep+1,3)}/3: ${s.t}`);}
      else if(st==='center')msg=blank('Centring: plate-solving…');
      else if(st==='manual')msg=blank('Moving…');
      else if(st==='lost')msg=blank('Target lost');
      else if(!m.target)msg=blank('Idle – choose a target (Target tab)');
      else{
        const stk=sTele;
        if(stk.target===m.target&&stk.T[0]!==undefined&&(stk.N>0||stk.sig||stk.lunar)){
          if(stk.lunar)drawMoonView(lvc,moonImg,m,cam,A.zoom);else drawStackCrop(stk,cam);
        }else msg=blank('');
      }
    }
  }
  /* ---- overlay, drawn at the canvas's full resolution ---- */
  lvc.textBaseline='top';
  if(msg){lvc.fillStyle='rgba(205,225,255,.9)';lvc.font='600 28px system-ui';lvc.textAlign='center';wrapText(lvc,msg,W/2,H/2-24,W-60,34);}
  if(m.power==='on'&&m.link==='connected'&&!m.parked){
    lvc.textAlign='left';lvc.font='600 26px system-ui';lvc.fillStyle='rgba(205,225,255,.9)';
    const stk=A.mode==='mw'?(A.mw==='trails'?sTrail:sWide):sTele;
    const title=m.target&&m.target.type!=='point'?m.target.name:A.cam==='wide'?'Wide-angle view':'Telephoto view';
    lvc.fillText(title,60,12);lvc.font='22px system-ui';lvc.fillStyle='rgba(205,225,255,.7)';
    const n=stk.N>0?`${stk.N} × ${stk.exposure}s = ${fmtDur(stk.tTotal)}`:A.mode==='scenery'?'scenery':'live view';lvc.fillText((A.zoom>1?A.zoom+'× · ':'')+(m.mountMode==='eq'?'EQ · ':'')+n,60,42);
    if(anyOn()&&(stk.on)){lvc.fillStyle='#ff4b3a';lvc.beginPath();lvc.arc(W-36,26,9,0,6.3);lvc.fill();}
    if(A.snap){lvc.fillStyle='#fff';lvc.textAlign='center';lvc.font='600 30px system-ui';lvc.fillText(`Exposing… ${Math.max(0,A.snap.rem).toFixed(0)} s`,W/2,H*.12);}
    if(A.rec){lvc.fillStyle='#ff4b3a';lvc.textAlign='left';lvc.font='600 24px system-ui';lvc.fillText('● REC '+Math.round((now-A.rec.t0)/1000)+' s',60,72);}
    // scale bar and N/E arrows
    if(!msg||A.cam==='wide'){
      const arcsec=A.cam==='wide'?36000:600,px=arcsec/cam.scale*(W/cam.w)*A.zoom;lvc.strokeStyle='rgba(205,225,255,.8)';lvc.lineWidth=3;lvc.beginPath();lvc.moveTo(40,H-60);lvc.lineTo(40+px,H-60);lvc.stroke();
      lvc.fillStyle='rgba(205,225,255,.85)';lvc.font='22px system-ui';lvc.textAlign='left';lvc.fillText(A.cam==='wide'?'10°':'10′',40,H-92);
    }
  }
  if(m.mode==='lost'&&!m.damaged){lvc.fillStyle='rgba(255,90,70,.95)';lvc.font='700 30px system-ui';lvc.textAlign='center';lvc.fillText('TARGET LOST',W/2,H*.2);}
  $('#liveMsg').textContent=(sTele.reason&&sTele.on?`Dropping photos: ${sTele.reason}. `:'')+(sWide.reason&&sWide.on?`Dropping photos: ${sWide.reason}. `:'')+(m.note||'');
}
function wrapText(ctx,text,x,y,maxW,lh){const words=text.split(' ');let line='';for(const w of words){const t=line?line+' '+w:w;if(ctx.measureText(t).width>maxW&&line){ctx.fillText(line,x,y);y+=lh;line=w;}else line=t;}ctx.fillText(line,x,y);}

/* =====================================================================
   3. STATUS, CHARTS AND PANE UPDATES (about 10 times a second)
   ===================================================================== */
function updStatus(){
  const m=mount,mode={idle:'Idle',slew:'Slewing',init:'Initializing',center:'Centring',track:'Tracking',lost:'Lost target',manual:'Moving'}[m.mode];
  const chips=[];
  chips.push(m.power==='off'?['Off','']:m.power==='booting'?['Powering on','warn']:m.link!=='connected'?['No phone','warn']:[mode,m.mode==='lost'?'bad':'ok']);
  if(m.power!=='off')chips.push([m.mountMode==='eq'?'EQ mode':'Alt-Az mode','']);
  chips.push([`🔋 ${Math.round(m.battery)}%${m.charger!=='none'?' ⚡':''}`,m.battery<20?'bad':'']);
  if(m.parked&&m.power!=='off')chips.push(['Zero position','']);
  if(m.damaged)chips.push(['⚠ Sensor damaged','bad']);
  if(m.solarFilter)chips.push(['Solar filter on','warn']);
  if(m.dew>0.15)chips.push([`💧 Dew ${Math.round(m.dew*100)}%`,m.dew>.4?'bad':'warn']);
  if(SUN.alt>-12)chips.push([SUN.alt>0?'☀ Daylight':'🌅 Twilight',SUN.alt>-6?'bad':'warn']);
  if(SKY.cloud>.3)chips.push([`☁ ${Math.round(SKY.cloud*100)}% cloud`,'warn']);
  if(SKY.wind>S50.maxWindForce)chips.push([`💨 Wind Force ${SKY.wind} (limit ${S50.maxWindForce})`,'bad']);
  if(SKY.temp<S50.tempRange[0]||SKY.temp>S50.tempRange[1])chips.push([`🌡 ${SKY.temp}°C outside ${S50.tempRange[0]}…${S50.tempRange[1]}°C`,'bad']);
  if(SKY.humidity>0.8)chips.push(['Humidity above 80%','warn']);
  if(m.shake>0)chips.push(['Vibrating','warn']);
  if(m.power==='on'&&!m.parked&&MOON.alt>0&&MOON.illum>.3&&angDistHor(m.alt,m.az,MOON.alt,MOON.az)<50)chips.push(['🌕 Moon glare','warn']);
  $('#chips').innerHTML=chips.map(([t,c])=>`<span class="chip ${c}">${t}</span>`).join('');
  const e=horToEq(m.alt,m.az,jdNow());
  $('#hud').innerHTML=`${m.power==='off'?'⏻ OFF':mode}${m.target?' · '+m.target.name:''}<br>Az ${m.az.toFixed(1)}°  Alt ${m.parked?'zero position':m.alt.toFixed(1)+'°'}<span class="hx"><br>RA ${fmtRA(e.ra)}  Dec ${fmtDec(e.dec)}</span>`;
  const L=LOCS.find(l=>l.lat===obs.lat);$('#clock').textContent=`${L?L.n.split(' –')[0]:'Custom'} · ${clockText()}`;
  document.body.classList.toggle('nolink',!m.ready);
  // the Sun, close to the lens, with the arm… (safety warning before the sensor is hurt)
  if(m.power==='on'&&!m.parked&&!m.solarFilter&&!m.damaged&&SUN.alt>0&&angDistHor(m.alt,m.az,SUN.alt,SUN.az)<CAM.tele.fovLong*1.2){
    if(!updStatus.w){updStatus.w=true;toast('⚠ The lens is close to the Sun without the solar filter! Move away NOW.',8000);}
  }else updStatus.w=false;
}
let dmgSig='',solSig='';
function updDevice(){
  const m=mount,led=m.ledPattern(anyOn());
  $('#pstat').innerHTML=`<b>${m.power==='off'?'Off':m.power==='booting'?'Powering on…':m.link==='connected'?'On · connected':'On · waiting for phone'}</b>`;
  $('#ledTxt').textContent=ledText(m,led);
  $('#battFill').style.width=m.battery+'%';$('#battFill').style.background=m.battery<20?'var(--bad)':'var(--ok)';
  const cap=1-Math.max(0,(10-SKY.temp)*0.012);
  $('#battTxt').textContent=`${Math.round(m.battery)}% of 10000 mAh / 36 Wh${m.charger!=='none'?' · charging':m.power!=='off'?` · about ${(m.battery/100*S50.hours*cap).toFixed(1)} h left`:''}${cap<.95?` (cold: ${Math.round(cap*100)}% capacity)`:''}`;
  $('#chg').value=m.charger;$('#dew').checked=m.dewHeater;
  $('#solarTxt').textContent=m.solarFilter?'Solar filter is ON the lens.':'No solar filter fitted.';
  renderWiz();
  const d=m.damaged?'bad':'';if(d!==dmgSig){dmgSig=d;$('#dmgBox').innerHTML=m.damaged?'<div class="card bad">⚠ <b>Sensor damaged by sunlight.</b> Real damage like this is permanent and not covered by warranty. <button class="b" data-act="repair">Replace sensor (reset simulator)</button></div>':'';}
}
function updImaging(){
  const m=mount,s=activeStack(),N=s.N,b=$('#stk');
  if(b){b.textContent=s.on?'⏸ Stop':(A.mode==='mw'?'▶ Start':'▶ Start stacking');b.classList.toggle('on',!s.on);}
  if(A.snap){$('#snapBar')&&($('#snapBar').style.width=(100*(1-Math.max(0,A.snap.rem)/A.snap.E))+'%');}else if($('#snapBar'))$('#snapBar').style.width='0';
  const box=$('#sstats');
  if(box){
    const lim=sTele.limitingMag(m),tr=transparency(m.alt,m.dew),sb=skyMagPerArcsec2(m.az,m.alt);
    box.innerHTML=`<table><tr><td>Photos stacked</td><td><b>${N}</b>${s.dropped?` <span class="mu">(+${s.dropped} dropped)</span>`:''}</td></tr>
     <tr><td>Total exposure</td><td>${fmtDur(s.tTotal)}</td></tr><tr><td>Cleaner than 1 photo</td><td>${N?'×'+Math.sqrt(N).toFixed(1):'–'}</td></tr>
     ${A.mode==='star'?`<tr><td>Faintest star seen</td><td>${lim==null?'–':'magnitude '+lim.toFixed(1)}</td></tr>`:''}
     <tr><td>Sky background</td><td>${sb.toFixed(1)} mag/arcsec² <span class="mu">(bigger = darker)</span></td></tr>
     <tr><td>Light getting through</td><td>${Math.round(tr*100)}% <span class="mu">(atmosphere, cloud, dew)</span></td></tr></table>`;
  }
  if($('#nplot'))drawNoise(s);
  if($('#frot')){
    const dq=s.on||N>0?s.rot:0;let rate=0;if(m.target&&m.target.type!=='point'){const e=horToEq(m.alt,m.az,jdNow()),j=jdNow();rate=m.mountMode==='eq'?m.eqErrDeg()*0.02:wrap180(parallacticFromEq(e.ra,e.dec,j+1/1440)-parallacticFromEq(e.ra,e.dec,j));}
    $('#frot i').style.transform=`rotate(${dq}deg)`;
    $('#frTxt').innerHTML=`Rotated <b>${dq.toFixed(1)}°</b> since stacking began<br>Right now: <b>${rate.toFixed(2)}°/min</b>${Math.abs(rate)>1?' – <span style="color:var(--bad)">fast!</span>':''}<br><span class="mu">${m.mountMode==='eq'?'EQ mode: almost none.':'Alt-az mounts rotate the sky in the picture.'}</span>`;
  }
  const sc=$('#solarCard');
  if(sc){
    const sep=SUN.alt>0?angDistHor(m.alt,m.az,SUN.alt,SUN.az):999,inView=!m.parked&&sep<CAM.tele.fovLong*0.5;
    const sig=[m.solarFilter,m.sunStage,inView,Math.round(SUN.alt)].join();
    if(sig!==solSig){solSig=sig;sc.className='card'+(m.solarFilter?' ok':' warn');
      sc.innerHTML=`<b>Solar filter: ${m.solarFilter?'ON':'not fitted'}</b> · Sun altitude ${SUN.alt.toFixed(0)}°${SUN.alt<=0?' (below the horizon – wait for daytime, or set the time in the Sky tab)':''}<br>
       ${m.sunStage==='await'?'<p><b>The lens has lifted and stopped.</b> Attach the magnetic solar filter to the front of the lens, then:</p><button class="b big on" data-act="sunOk">Installed &amp; Shooting</button>':''}
       ${inView?'<p style="color:var(--ok)">☀ The Sun is in the telephoto view. Choose 1×/2×/4× and press ●.</p>':''}
       <div class="row"><button class="b" data-act="solarOn">Attach filter</button><button class="b" data-act="solarOff">Remove filter</button></div>`;}
  }
}
function drawNoise(s){
  const cv=$('#nplot'),g=cv.getContext('2d'),W=cv.width,H=cv.height,L=34,B=22,T=8,Rr=8,N=s.N,nmax=Math.max(60,Math.ceil(N*1.25/10)*10);
  g.clearRect(0,0,W,H);g.strokeStyle='#26304f';g.fillStyle='#8f9bb8';g.font='11px system-ui';g.lineWidth=1;
  g.beginPath();g.moveTo(L,T);g.lineTo(L,H-B);g.lineTo(W-Rr,H-B);g.stroke();
  const X=n=>L+(W-L-Rr)*n/nmax,Y=v=>T+(H-T-B)*(1-v);
  g.beginPath();for(let n=1;n<=nmax;n++){const x=X(n),y=Y(1/Math.sqrt(n));n===1?g.moveTo(x,y):g.lineTo(x,y);}g.strokeStyle='#ff8a3d';g.lineWidth=2;g.stroke();
  g.fillStyle='#8f9bb8';g.textAlign='right';g.fillText('100%',L-4,T+8);g.fillText('50%',L-4,Y(.5)+4);g.fillText('25%',L-4,Y(.25)+4);g.textAlign='center';g.fillText('photos stacked →',W/2,H-5);
  if(N>0){const x=X(N),y=Y(1/Math.sqrt(N));g.fillStyle='#4da3ff';g.beginPath();g.arc(x,y,5,0,6.2832);g.fill();g.textAlign=x>W-80?'right':'left';g.fillText(`${N} photos → noise ${(100/Math.sqrt(N)).toFixed(0)}%`,x+(x>W-80?-8:8),y-8);}
}
/* ---- all-sky chart (Sky tab) and SkyAtlas (Milky Way target tab) ---- */
const polarHits=[];
function drawSkyChart(cv,opts){
  const g=cv.getContext('2d'),W=cv.width,cx=W/2,cy=W/2,R=W/2-14;polarHits.length=0;
  g.clearRect(0,0,W,W);g.fillStyle='#050813';g.beginPath();g.arc(cx,cy,R,0,6.2832);g.fill();
  g.strokeStyle='#26304f';g.lineWidth=1;for(const a of[0,30,60]){g.beginPath();g.arc(cx,cy,R*(90-a)/90,0,6.2832);g.stroke();}
  const P=(az,alt)=>{const r=R*(90-alt)/90;return [cx-r*Math.sin(az*D2R),cy-r*Math.cos(az*D2R)];};   // north up, east LEFT (as when you look up at the sky)
  g.fillStyle='#8f9bb8';g.font='13px system-ui';g.textAlign='center';g.textBaseline='middle';
  [['N',0],['E',90],['S',180],['W',270]].forEach(([t,az])=>{const [x,y]=P(az,-6);g.fillText(t,x,y);});
  if(SKY.horizon>0){g.strokeStyle='rgba(255,120,90,.5)';g.setLineDash([4,4]);g.beginPath();g.arc(cx,cy,R*(90-SKY.horizon)/90,0,6.2832);g.stroke();g.setLineDash([]);}
  if(opts.mw){g.fillStyle='rgba(150,180,255,.10)';for(let l=0;l<360;l+=4)for(let b=-12;b<=12;b+=6){const e=gal2eq(l,b),h=eqToHor(e.ra,e.dec,jdNow());if(h.alt<0)continue;const [x,y]=P(h.az,h.alt);g.beginPath();g.arc(x,y,6,0,6.2832);g.fill();}}
  for(const o of OBJ){
    if(o.alt<0)continue;
    if(o.type==='star'&&o.mag<3.6){const [x,y]=P(o.az,o.alt);g.fillStyle='#cdd8f5';g.beginPath();g.arc(x,y,Math.max(1,2.6-o.mag*.5),0,6.2832);g.fill();}
    else if(o.type==='dso'&&/^M\d+$/.test(o.id)){const [x,y]=P(o.az,o.alt);g.strokeStyle='#ff8a3d';g.lineWidth=1;g.beginPath();g.arc(x,y,3,0,6.2832);g.stroke();polarHits.push({o,x,y});}
    else if(o.type==='planet'){const [x,y]=P(o.az,o.alt);g.fillStyle={mercury:'#d8d0c8',venus:'#fff6d8',mars:'#ff9a70',jupiter:'#ffe6c0',saturn:'#f0dca0'}[o.id];g.beginPath();g.arc(x,y,4,0,6.2832);g.fill();polarHits.push({o,x,y});}
    else if(o.type==='moon'){const [x,y]=P(o.az,o.alt);g.fillStyle=`rgba(244,241,228,${.35+.65*o.illum})`;g.beginPath();g.arc(x,y,6,0,6.2832);g.fill();g.fillStyle='#8f9bb8';g.font='11px system-ui';g.fillText('Moon',x,y+13);polarHits.push({o,x,y});}
  }
  if(SUN.alt>-18){g.fillStyle='#ffd34d';const [x,y]=P(SUN.az,Math.max(SUN.alt,-5));g.beginPath();g.arc(x,y,6,0,6.2832);g.fill();g.fillStyle='#8f9bb8';g.font='11px system-ui';g.fillText('Sun ⚠',x,y+13);polarHits.push({o:SUN,x,y});}
  if(opts.sel&&opts.sel.alt>0){const [x,y]=P(opts.sel.az,opts.sel.alt);g.strokeStyle='#4da3ff';g.lineWidth=2;g.beginPath();g.arc(x,y,9,0,6.2832);g.stroke();g.fillStyle='#4da3ff';g.font='12px system-ui';g.fillText(opts.sel.short||opts.sel.name,x,y-16);}
  if(mount.power!=='off'&&!mount.parked){const [x,y]=P(mount.az,mount.alt);g.strokeStyle='#35d8ff';g.lineWidth=1.5;g.strokeRect(x-6,y-6,12,12);g.beginPath();g.moveTo(x-12,y);g.lineTo(x+12,y);g.moveTo(x,y-12);g.lineTo(x,y+12);g.stroke();}
  if(opts.box){                                                                     // the SkyAtlas framing box (drawn around the chosen RA/Dec)
    const h=eqToHor(opts.box.ra,opts.box.dec,jdNow());if(h.alt>-5){const fov=opts.boxFov;const [x,y]=P(h.az,Math.max(h.alt,0)),pxPerDeg=R/90,w=fov.s*pxPerDeg,hh=fov.l*pxPerDeg;
      g.strokeStyle='#ffd34d';g.lineWidth=2;g.save();g.translate(x,y);g.rotate(-h.az*D2R*0);g.strokeRect(-w/2,-hh/2,w,hh);g.restore();g.fillStyle='#ffd34d';g.font='12px system-ui';g.fillText(opts.box.name||'framing box',x,y-hh/2-8);}}
  return P;
}
function gal2eq(l,b){                                                               // galactic → equatorial (inverse of galLB)
  const lr=(122.932-l)*D2R,br=b*D2R,dg=27.128*D2R;
  const sd=Math.sin(br)*Math.sin(dg)+Math.cos(br)*Math.cos(dg)*Math.cos(lr);
  const y=Math.cos(br)*Math.sin(lr),x=Math.sin(br)*Math.cos(dg)-Math.cos(br)*Math.sin(dg)*Math.cos(lr);
  return {ra:norm360(192.859+Math.atan2(y,x)*R2D),dec:Math.asin(clamp(sd,-1,1))*R2D};
}
function skyPick(cv,e){
  const r=cv.getBoundingClientRect(),s=cv.width/r.width,x=(e.clientX-r.left)*s,y=(e.clientY-r.top)*s,W=cv.width,R=W/2-14;
  const dx=(W/2-x)/R,dy=(W/2-y)/R,rho=Math.hypot(dx,dy);if(rho>1.02)return null;
  const alt=90-rho*90,az=norm360(Math.atan2(dx,dy)*R2D);return {alt,az,hits:polarHits.map(h=>({o:h.o,d:Math.hypot(h.x-x,h.y-y)})).sort((a,b)=>a.d-b.d)[0]};
}
document.addEventListener('click',e=>{
  if(e.target.id==='polar'){const p=skyPick(e.target,e);if(p&&p.hits&&p.hits.d<18&&p.hits.o.type!=='sun'){A.sel=p.hits.o;toast(`${p.hits.o.name} selected – open the Target tab to GoTo.`);}}
  if(e.target.id==='atlas'){const p=skyPick(e.target,e);if(p){const eq=horToEq(Math.max(p.alt,5),p.az,jdNow());A.mwTarget={ra:eq.ra,dec:eq.dec,name:'Atlas point'};}}
});
function updSky(){
  const m=mount,a=m.power==='off'||m.parked?60:m.alt,z=m.power==='off'?0:m.az;
  drawSkyChart($('#polar'),{sel:A.sel});
  $('#skyInfo').innerHTML=`<table><tr><td>Sky brightness</td><td>${skyMagPerArcsec2(z,a).toFixed(1)} mag/arcsec² here</td></tr>
   <tr><td>Sun</td><td>${SUN.alt.toFixed(0)}° ${SUN.alt>0?'(daytime!)':SUN.alt>-18?'(twilight – sky still glowing)':'(dark)'}</td></tr>
   <tr><td>Moon</td><td>${Math.round((MOON.illum||0)*100)}% lit, ${MOON.alt>0?'up at '+MOON.alt.toFixed(0)+'°':'below the horizon'}${MOON.alt>0?` · glare here ${Math.round(moonGlare(z,a)*100)}%`:''}</td></tr>
   <tr><td>Wind</td><td>Force ${SKY.wind}${SKY.wind>S50.maxWindForce?' – above the manual’s limit (Force 3): photos will shake':''}</td></tr>
   <tr><td>Operating range</td><td>${S50.tempRange[0]}…${S50.tempRange[1]} °C${SKY.temp<S50.tempRange[0]||SKY.temp>S50.tempRange[1]?' – <b style="color:var(--bad)">outside it!</b>':''}</td></tr>
   <tr><td>Clear sky needed</td><td>The manual recommends a wide view of the sky (at least 45° unobstructed). Raise “Trees / buildings” to test.</td></tr></table>`;
}
function updAtlas(){
  const cv=$('#atlas');if(!cv)return;
  const fov=A.atlasFov==='wide'?{l:CAM.wide.fovLong,s:CAM.wide.fovShort}:{l:CAM.tele.fovLong,s:CAM.tele.fovShort};
  drawSkyChart(cv,{mw:true,box:A.mwTarget,boxFov:fov,sel:null});
  const t=A.mwTarget;$('#atlasInfo').textContent=t?`${t.name}: RA ${fmtRA(t.ra)}, Dec ${fmtDec(t.dec)}. The yellow box shows the ${A.atlasFov==='wide'?'63°':'2.8°'} frame.`:'Tap the chart to choose where to point.';
}
function updAll(force){
  updStatus();updDevice();updImaging();
  if(A.tab==='sky')updSky();
  if(A.tab==='target'&&A.mode==='mw')updAtlas();
}

/* =====================================================================
   4. SCENARIOS (Learn tab)
   ===================================================================== */
function quickStart(){mount.activate();mount.fwOk=true;mount.power='on';mount.link='connected';mount.initDone=true;mount.tilt={x:0,z:0};mount.bootT=BOOT_SEC;A.wiz='idle';mount.note='';}
ACT.quick=()=>{quickStart();openTab('home');toast('Quick start: powered on, connected and initialized. The lens is in the zero position – choose a mode.');};
function scanBest(cands,h0,h1,needDark=true){                              // best (object, hour) tonight: highest altitude while the sky is dark
  let best={alt:-99};
  for(let h=h0;h<=h1;h+=.5){setClockRaw(tonightDateStr(),h);for(const o of cands){if((!needDark||SUN.alt<-12)&&o.alt>best.alt)best={alt:o.alt,o,h};}}
  return best;
}
function setClockRaw(dateStr,hour){const [y,m,d]=dateStr.split('-').map(Number);simMs=Date.UTC(y,m-1,d)+(hour-A.tz)*3600000;computeSky();}
const SCENARIOS=[
  {id:'orion',t:'🌆 Orion Nebula from a city',d:'Phoenix (Bortle 8) when Orion is highest. Stack with UV/IR-cut for ~5 minutes, then switch to the Duo-Band filter in the Imaging tab and compare.',loc:0,mode:'star',obj:'M42'},
  {id:'andromeda',t:'🌌 Andromeda Galaxy from a dark site',d:'Flagstaff (Bortle 3). A galaxy is broadband light: try stacking it with BOTH filters and see what the Duo-Band one does.',loc:1,mode:'star',obj:'M31'},
  {id:'mw',t:'🌠 Milky Way from a pristine sky',d:'Atacama desert (Bortle 1), wide-angle camera. Take a Photo, then try Wide-angle stacking and Star trails.',loc:5,mode:'mw',atlas:[0,1,4,6]},
  {id:'sun',t:'☀️ Photograph the Sun (safely)',d:'Noon in Phoenix. Follow the solar filter procedure: lift, attach the filter, approach, aim with the wide view, then shoot at 1×/2×/4×.',loc:0,mode:'solar',obj:'sun',day:true},
  {id:'zenith',t:'🎯 The zenith blind spot (and EQ mode)',d:'M13 passes almost overhead at Flagstaff. In Alt-Az mode the mount loses it near the zenith (try Time ×60). Then set up EQ mode in the Device tab and compare.',loc:1,mode:'star',obj:'M13',zen:true},
  {id:'dew',t:'💧 A dewy night',d:'90% humidity with the dew heater OFF. Watch the lens fog (cyan “Dew” chip) and the picture dim. Then switch the heater on.',loc:1,mode:'star',obj:'M42',hum:.9},
  {id:'cloud',t:'☁ Thin clouds over the Pleiades',d:'55% cloud. See how transparency cuts the signal – and how much longer you must stack.',loc:1,mode:'star',obj:'M45',cloud:.55}
];
function runScenario(s){
  stopAllStacks(true);setLocation(s.loc);SKY.cloud=s.cloud||0;SKY.humidity=s.hum!=null?s.hum:.15;SKY.wind=1;SKY.temp=15;SKY.horizon=0;syncSkyUi();mount.dewHeater=false;mount.dew=0;sTele.flt='uvir';
  quickStart();mount.solarFilter=false;mount.damaged=false;mount.mountMode='altaz';
  let tgt,hour;
  if(s.day){setClockRaw(tonightDateStr(),12.2);tgt=SUN_OBJ();hour=12.2;}
  else if(s.atlas){const cands=s.atlas.map(i=>{const p=ATLAS_PRESETS[i];return {...makeSkyTarget(p.ra,p.dec,p.n),idx:i};});
    let best={alt:-99};for(let h=19;h<=29;h+=.5){setClockRaw(tonightDateStr(),h);if(SUN.alt>-12)continue;for(const c of s.atlas){const p=ATLAS_PRESETS[c];const e=eqToHor(p.ra,p.dec,jdNow());if(e.alt>best.alt)best={alt:e.alt,h,i:c};}}
    hour=best.h;setClockRaw(tonightDateStr(),hour);const p=ATLAS_PRESETS[best.i];A.mwTarget={ra:p.ra,dec:p.dec,name:p.n};tgt=pseudoSky=makeSkyTarget(p.ra,p.dec,p.n);}
  else{const o=OBJ.find(x=>x.id===s.obj);
    if(s.zen){let bh=0,ba=0;for(let h=0;h<24;h+=.05){setClockRaw(tonightDateStr(),h);if(o.alt>ba){ba=o.alt;bh=h;}}hour=bh-.35;setClockRaw(tonightDateStr(),hour);}
    else{const b=scanBest([o],19,29);hour=b.h;setClockRaw(tonightDateStr(),hour);}
    tgt=o;}
  $('#date').value=tonightDateStr();$('#hour').value=hour%24;$('#hourV').textContent=hourText(hour);
  setMode(s.mode);
  if(s.mode==='mw'){A.mw='stack';renderImaging();}
  if(s.zen){A.speed=60;$('#speed').value='60';}
  const r=mount.gotoObj(tgt);
  if(r.ok){A.sel=tgt.type==='sky'?A.sel:tgt;A.pendingStart=s.mode==='mw';toast(`${s.t}: the telescope is on its way${s.mode==='solar'?' – attach the solar filter when asked':''}.`,6500);openTab(s.mode==='solar'||s.mode==='mw'?'image':'image');}
  else toast(`${tgt.name} is not available at the darkest hour on this date: ${r.reason}`,8000);
}
$('#p-learn').innerHTML=`
 <h3>Try a scenario</h3><p class="mu sm">Each one sets the place, time and sky, powers the telescope on, and starts the procedure.</p>
 ${SCENARIOS.map(s=>`<button class="card b" style="width:100%;text-align:left;white-space:normal" data-act="scn" data-arg="${s.id}"><b>${s.t}</b><br><span class="mu sm">${s.d}</span></button>`).join('')}
 <h3>Specifications (from the S50 Pro manual)</h3><table>
  <tr><td>Telephoto camera</td><td>50 mm aperture, 260 mm focal length, f/5.2; 4-element apochromatic lens with ED glass; 1/1.2″ CMOS, 8.3 MP, 2160 × 3840 (portrait); field of view 2.8°</td></tr>
  <tr><td>Wide-angle camera</td><td>3.4 mm aperture, 6 mm focal length, f/1.75; 1/2″ CMOS, 8.3 MP; field of view 63°</td></tr>
  <tr><td>Built-in filters</td><td>UV/IR-cut, Duo-Band (OIII 30 nm / Hα 20 nm), Dark. Magnetic solar filter supplied separately for the Sun.</td></tr>
  <tr><td>Mount</td><td>Alt-azimuth, EQ mode supported (with the EQ wedge). Slew rate 1× – 1440× sidereal. Mechanical zero position.</td></tr>
  <tr><td>Battery</td><td>10000 mAh, 36 Wh, up to 9 hours; USB-C 5 V 3 A or 12 V 3 A; works while charging</td></tr>
  <tr><td>Storage / formats</td><td>128 GB (~100 GB usable); JPEG and FITS; MP4/AVI video</td></tr>
  <tr><td>Connection</td><td>Wi-Fi hotspot (5 G / 2.4 G, ≤10 m), Bluetooth (≤5 m), USB-C, NFC tap</td></tr>
  <tr><td>Working conditions</td><td>−10 … 40 °C, humidity 20–80 %, wind no more than Force 3</td></tr>
  <tr><td>Size / weight</td><td>260 × 140 × 145 mm, 2.8 kg without tripod. Carbon-fibre tripod included (227 mm tall, 737 mm across at the widest).</td></tr></table>
 <p class="mu sm">Values are those printed in the user manual V1. This simulator is a teaching model, not a measurement of a real unit.</p>
 <h3>Important reminders (from the manual)</h3>
 <ul class="sm"><li><b>Never observe the Sun without the solar filter</b> – it permanently damages the device.</li><li>Minors must use it with adult supervision. It is not a toy.</li><li>Use a reputable charger (USB BC1.2; 5 V 2 A normal, up to 12 V 3 A fast).</li><li>Operate between −10 °C and 40 °C; the battery delivers less in the cold. Keep it dry and away from flames.</li><li>Do not use it in wind above Force 3.</li><li>Clean the lens only with optical lens wipes: no solvents, no cloths, no glass.</li><li>Store in a clean, dry place; power off during thunderstorms.</li></ul>
 <h3>Observing tips (manual §4)</h3>
 <ul class="sm"><li>Beginners: start with bright objects – M31, M42 and NGC104. Faint targets like the Veil Nebula need extremely dark skies.</li><li>Have at least 45° of unobstructed sky; stay away from streetlights and security lights (try the “Trees / buildings” and “Light pollution” sliders).</li><li>Don’t walk around the equipment while it images – vibration ruins stacking (try “Bump the tripod”).</li><li>Clouds and wind hurt: both reduce the number of usable photos.</li><li>Use the SkyAtlas composition (Milky Way mode) to frame the shot, and Station Mode to join your home Wi-Fi.</li></ul>
 <h3>Ideas to understand</h3>
 <details><summary>How does it know where to point? (plate solving)</summary><div>After the first GoTo following power-on, the S50 Pro runs its automatic initialization: it levels itself, takes the time and place from your phone, then photographs the sky and matches the star pattern to a star map. That tells it where north is. Until then GoTo can land several degrees off – you saw this if you aimed at the Sun before initialization. After every GoTo it plate-solves once more to centre the target precisely.</div></details>
 <details><summary>Why stack many short photos?</summary><div>A single 10 s photo is too noisy for faint things. Averaging N photos cuts random noise by √N while the real signal stays. That is why the picture “clears” as the stack grows.</div></details>
 <details><summary>Alt-Az versus EQ mode</summary><div>An alt-az mount turns the sky in the picture as it follows a target (field rotation) and cannot follow targets that pass almost overhead. EQ mode tilts the axis to point at the celestial pole, so one motor follows the sky: no rotation, longer exposures, no blind spot. The price: the optional wedge and a careful polar alignment (errors within 1°).</div></details>
 <details><summary>Light pollution and the Duo-Band filter</summary><div>City glow is broadband and drowns faint broadband targets. The Duo-Band filter passes only Hα and OIII, where emission nebulae glow, and blocks most city light. Nebulae pop; galaxies, clusters and stars dim a lot.</div></details>
 <details><summary>Why a solar filter, and why does GoTo stop early on the Sun?</summary><div>Unfiltered sunlight focused by the lens can burn the sensor in seconds. So GoTo lifts the lens, waits for you to fit the magnetic filter, and then stops a few degrees short so that you must finish the aiming yourself and check the filter is on.</div></details>
 <details><summary>The Milky Way and star trails</summary><div>The wide camera (6 mm, f/1.75) sees 63° of sky. In a pristine sky the Milky Way shows in one 10–20 s photo; in a city it vanishes. For star trails the mount holds still, so each star draws an arc as the Earth turns.</div></details>
 <p class="sm"><a href="index.html" style="color:var(--ac)">← Back to the C11 simulator and telescope chooser</a></p>`;

/* =====================================================================
   5. MAIN LOOP AND START-UP
   ===================================================================== */
let lastT=performance.now(),frameN=0,uiT=0,prevT=0,wideT=0;
function frame(now){
  requestAnimationFrame(frame);
  const dt=clamp((now-lastT)/1000,0,.05);lastT=now;frameN++;
  const simDt=dt*A.speed;simMs+=simDt*1000;
  computeSky();updatePseudo();
  mount.update(dt,simDt);
  if(mount.power==='off'&&anyOn())stopAllStacks();                       // switching off ends (and saves) the session
  const imaging=(A.mode==='star'||A.mode==='solar')&&mount.usable;
  if(imaging&&mount.target&&mount.target.type!=='sun'){
    if(mount.mode==='track'&&sTele.target!==mount.target)sTele.prepare(mount);
    if(A.auto&&!A.stopped&&mount.mode==='track'&&!sTele.on&&sTele.N===0&&sTele.target===mount.target&&sTele.ref)sTele.start(mount);
    if(!sTele.on&&sTele.N===0&&mount.mode==='track'&&now-prevT>900){prevT=now;sTele.preview(mount);}
  }
  if(A.pendingStart&&mount.mode==='track'){const s=activeStack();if(s.kind!=='trails'&&s.start(mount))A.pendingStart=false;}
  sTele.update(simDt,mount);sWide.update(simDt,mount);sTrail.update(simDt,mount);
  if(A.snap){                                                               // a single long wide-angle exposure
    if(mount.mode!=='track'){A.snap=null;toast('Exposure cancelled: the telescope is not tracking.');}
    else{A.snap.rem-=simDt;if(A.snap.rem<=0){const E=A.snap.E;A.snap=null;sWide.prepare(mount);sWide.snap(mount,E);sWide.exposure=E;saveStack(sWide,true);lastDrawn=null;sWide.dirty=true;toast('Photo saved to the album.');}}
  }
  // the wide-angle live view (for aiming) refreshes every couple of seconds
  if(A.cam==='wide'&&mount.usable&&!mount.parked&&now-wideT>2000){wideT=now;sLive.prepare(mount);sLive.snap(mount,3);lastDrawn=null;}
  SC.update(mount,now/1000,mount.ledPattern(anyOn()));
  if(frameN%30===0)SC.updateSky();
  tickPowerButton();
  drawLive(now);
  if(now-uiT>100){uiT=now;updAll();if(A.tab==='target'&&frameN%60===0&&!['q'].includes((document.activeElement||{}).id)&&A.mode!=='mw')renderTarget();}
}

initScene($('#gl'));
new ResizeObserver(()=>SC.resize()).observe($('#stage'));
SC.setView('orbit');
setLocation(0);SKY.bortle=6;syncSkyUi();                                 // default: Phoenix, but a "bright suburban" sky so the first night looks decent
$('#date').value=tonightDateStr();setClockRaw(tonightDateStr(),21);$('#hour').value=21;$('#hourV').textContent='21:00';
renderTarget();renderImaging();renderAlbum();renderMM();renderWiz(true);
window.__s50={mount,A,sTele,sWide,sTrail,sLive,SKY,OBJ,ACT,INP,quickStart,doGoto,setClock,runScenario,setMode,capture,stopAllStacks,album,
  get speed(){return A.speed;},set speed(v){A.speed=v;$('#speed').value=String(v);}};   // small debug hook for the browser console
requestAnimationFrame(frame);
