/* Telescope Simulator – 12-sky-eyepiece.js
   Classic script (not an ES module) so the page also works when opened straight from disk.
   All files share one global scope and must load in numeric order (see index.html). */
'use strict';
/* =====================================================================
   10. SKY CHART + EYEPIECE VIEW
   ===================================================================== */
let selObj=OBJ.find(o=>o.id==='Vega');
const EPS=[{n:'Finder 9×50',fl:0,mag:9,fov:5,finder:true},...[[40,52],[25,52],[13,60],[9,82],[6,82]].map(([fl,af])=>({n:fl+' mm',fl,mag:2800/fl,fov:af/(2800/fl),af})),{n:'Planet cam',fl:1,mag:2800,fov:.03}];   // last entry: high-power planetary camera view
let epI=2;
// Eyepiece picker: every eyepiece is a little window that previews what you would see with it right now,
// so you can compare before switching. Thumbnails are redrawn about once a second (see epThumbs).
function buildEpRows(){const h='<div class="eptiles">'+EPS.map((e,i)=>`<button class="ept${i===epI?' on':''}" data-ep="${i}" title="${e.n}"><canvas width="96" height="96"></canvas><b>${e.finder?'Finder':e.fl===1?'Cam':e.n}</b><span>${Math.round(e.mag)}×</span></button>`).join('')+'</div>'+`<span class="sm mu" id="epinfo"></span>`;
  ['#epRow','#epRowMini','#epRowPop'].forEach(s=>{const e=document.querySelector(s);if(e)e.innerHTML=h;});setTimeout(()=>epThumbs(true),0);}
function epThumbs(all){$$('.eptiles').forEach(t=>{if(!all&&!t.offsetParent)return;t.querySelectorAll('canvas').forEach((c,i)=>drawEyepiece(c,EPS[i],true));});}
setInterval(()=>epThumbs(false),1000);
function setEp(i){epI=i;buildEpRows();epInfo();}
function epInfo(){const e=EPS[epI],f=(MOON.diam||.52)/e.fov,ms=f<1?` · Moon fills ${Math.round(f*100)}% of the view`:` · only ${Math.round(100/f)}% of the Moon fits`,t=(e.finder?`${e.mag}× · field ${e.fov}° (simulated finder)`:`${Math.round(e.mag)}× · field ${e.fov.toFixed(2)}° · exit pupil ${(e.fl/10).toFixed(1)} mm`)+ms;$$('#epinfo').forEach(x=>x.textContent=t);}
['#epRow','#epRowMini'].forEach(s=>$(s).addEventListener('click',e=>{const b=e.target.closest('[data-ep]');if(b)setEp(+b.dataset.ep);}));
buildEpRows();epInfo();
function updTrkRow(){$('#trkRow').innerHTML=['off','sidereal','lunar','solar'].map(m=>`<button class="b sm${driver.s.tracking===m?' on':''}" data-trk="${m}">${trkTxt(m)}</button>`).join('');}
$('#trkRow').addEventListener('click',e=>{const b=e.target.closest('[data-trk]');if(b)setTrack(b.dataset.trk);});updTrkRow();
function setSpeed(v){speed=v;$$('#spdRow button[data-sp]').forEach(b=>b.classList.toggle('on',+b.dataset.sp===v));}
let speed=1;
$('#spdRow').innerHTML=[1,10,60,600,3600].map(v=>`<button class="b sm${v===1?' on':''}" data-sp="${v}">${v}×</button>`).join('')+'<button class="b sm" id="bNow">Real time</button><button class="b sm" id="bDark">Next dark sky</button>';
function toDark(){let n=0;computeSky();while(SUN.alt>-14&&n<400){simMs+=10*60000;computeSky();n++;}if(driver.s.tracking!=='off')driver._relock();return n;}
$('#spdRow').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.sp)setSpeed(+b.dataset.sp);else if(b.id==='bNow'){simMs=Date.now();$('#locTxt').textContent=' '+localTimeTxt();if(driver.s.tracking!=='off')driver._relock();}else if(b.id==='bDark')toDark();});
$('#lat').onchange=e=>{obs.lat=clamp(+e.target.value||0,-89,89);loc.name='Custom location';$('#locSel').value='custom';};$('#lon').onchange=e=>{obs.lon=clamp(+e.target.value||0,-180,180);loc.name='Custom location';$('#locSel').value='custom';};


/* =====================================================================
   LOCATION AND LOCAL TIME – default Phoenix, AZ at 10 pm tonight
   ===================================================================== */
const PLACES=[['Phoenix, AZ',33.448,-112.074,'America/Phoenix'],['Tucson, AZ',32.222,-110.975,'America/Phoenix'],['Flagstaff, AZ',35.198,-111.651,'America/Phoenix'],
 ['Los Angeles, CA',34.052,-118.244,'America/Los_Angeles'],['Denver, CO',39.739,-104.99,'America/Denver'],['Chicago, IL',41.878,-87.63,'America/Chicago'],['New York, NY',40.713,-74.006,'America/New_York'],
 ['Honolulu, HI',21.307,-157.858,'Pacific/Honolulu'],['London, UK',51.507,-.128,'Europe/London'],['Sydney, Australia',-33.869,151.209,'Australia/Sydney']];
const loc={name:'Phoenix, AZ',tz:'America/Phoenix'};
function tzParts(tz,ms){const f=new Intl.DateTimeFormat('en-US',{timeZone:tz,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const o={};f.formatToParts(new Date(ms)).forEach(p=>{if(p.type!=='literal')o[p.type]=+p.value;});return o;}
function tzOffMin(tz,ms){const p=tzParts(tz,ms);return (Date.UTC(p.year,p.month-1,p.day,p.hour%24,p.minute,p.second)-Math.floor(ms/1000)*1000)/60000;}   // minutes ahead of UTC
function tonightMs(hhmm){const [h,m]=(hhmm||'22:00').split(':').map(Number);let p=tzParts(loc.tz,Date.now());if(p.hour<6&&h>=12){p=tzParts(loc.tz,Date.now()-864e5);}   // just after midnight: use the evening that just passed
  let t=Date.UTC(p.year,p.month-1,p.day,h,m);for(let i=0;i<2;i++)t=Date.UTC(p.year,p.month-1,p.day,h,m)-tzOffMin(loc.tz,t)*60000;return t;}
const localTimeTxt=()=>{try{return new Intl.DateTimeFormat('en-US',{timeZone:loc.tz,weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(simMs));}catch(_){return '';}};
function pointAtPolaris(){computeSky();const POL=OBJ.find(o=>o.id==='Polaris'),s=driver.s;if(POL.alt<1)return false;s.goto=null;s.enc.az=norm360(POL.az-s.err.az);s.enc.alt=POL.alt-s.err.alt;driver.autoAlign();driver.setTracking('sidereal');driver._relock();return true;}
function setLocation(i,keepTime){
  if(i>=0){const P=PLACES[i];loc.name=P[0];loc.tz=P[3];obs.lat=P[1];obs.lon=P[2];}
  $('#lat').value=obs.lat.toFixed(3);$('#lon').value=obs.lon.toFixed(3);
  if(!keepTime)simMs=tonightMs($('#locTime').value);
  if(!pointAtPolaris()){computeSky();if(driver.s.tracking!=='off')driver._relock();toast('Polaris never rises here (southern hemisphere) – the scope stays where it is.',4000);}
  $('#locTxt').textContent=' '+localTimeTxt();fillSelBox();
}
$('#locSel').innerHTML=PLACES.map((P,i)=>`<option value="${i}">${P[0]}</option>`).join('')+'<option value="me">📍 Use my location</option><option value="custom">Custom (type lat/lon below)</option>';
$('#locSel').onchange=e=>{const v=e.target.value;$('#locSel').blur();
  if(v==='custom'){loc.name='Custom location';return;}
  if(v==='me'){if(!navigator.geolocation){toast('This browser cannot share its location.');return;}
    navigator.geolocation.getCurrentPosition(p=>{loc.name='My location';loc.tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';obs.lat=p.coords.latitude;obs.lon=p.coords.longitude;setLocation(-1);toast('Using your location at '+$('#locTime').value+' tonight.');},
      ()=>toast('Location permission was not given. Pick a city instead.',3500),{timeout:8000});return;}
  setLocation(+v);toast(`${loc.name}, tonight at ${$('#locTime').value}. The telescope is pointed at Polaris.`,3500);};
$('#bTonight').onclick=()=>{simMs=tonightMs($('#locTime').value);computeSky();if(driver.s.tracking!=='off')driver._relock();$('#locTxt').textContent=' '+localTimeTxt();};

const objSel=$('#objsel');
objSel.innerHTML=OBJ.map((o,i)=>`<option value="${i}">${o.name} (${KIND_NAME[o.kind||o.type]})</option>`).join('');
objSel.value=OBJ.indexOf(selObj);objSel.onchange=()=>{selObj=OBJ[+objSel.value];fillSelBox();objSel.blur();};
function fillSelBox(){
  const o=selObj;if(!o)return;objSel.value=OBJ.indexOf(o);
  const sub=o.type==='moon'?` · ${Math.round(o.illum*100)}% lit`:'';
  $('#selbox').innerHTML=`<b>${o.name}</b> <span class="mu">${KIND_NAME[o.kind||o.type]}${o.mag<50?' · mag '+(o.mag>-20?o.mag.toFixed(1):'−12'):''}${sub}</span><br><span id="selpos"></span><div class="row"><button class="b sm" id="bGoto">GoTo (simulated)</button></div>`;
  $('#bGoto').onclick=()=>doGoto(o);
}
function updSelPos(){const o=selObj,e=$('#selpos');if(e)e.textContent=`alt ${o.alt.toFixed(1)}° az ${o.az.toFixed(1)}° · RA ${fmtRA(o.cra)} Dec ${fmtDec(o.cdec)}${o.alt<0?' · below horizon':''}`;}
fillSelBox();

function drawSkyChart(c){
  const x=c.getContext('2d'),W=c.width,H=c.height,cx=W/2,cy=H/2,R=W/2-26;
  x.fillStyle='#02040a';x.fillRect(0,0,W,H);
  const P=(alt,az)=>{const r=(90-alt)/90*R,a=az*D2R;return [cx-r*Math.sin(a),cy-r*Math.cos(a)];};
  x.strokeStyle='#1e2a46';x.lineWidth=1;x.fillStyle='#8f9bb8';x.font='15px system-ui';x.textAlign='center';
  for(const a of [0,30,60]){x.beginPath();x.arc(cx,cy,(90-a)/90*R,0,7);x.stroke();}
  x.beginPath();x.moveTo(cx-R,cy);x.lineTo(cx+R,cy);x.moveTo(cx,cy-R);x.lineTo(cx,cy+R);x.stroke();
  x.fillText('N',cx,cy-R-8);x.fillText('S',cx,cy+R+18);x.fillText('E',cx-R-12,cy+5);x.fillText('W',cx+R+12,cy+5);
  for(const o of OBJ){if(o.alt<0)continue;const [px,py]=P(o.alt,o.az);
    if(o.type==='star'){const r=Math.max(1,3.4-.7*o.mag);x.fillStyle='#fff';x.beginPath();x.arc(px,py,r,0,7);x.fill();if(o.mag<1.9){x.fillStyle='#8f9bb8';x.font='12px system-ui';x.textAlign='left';x.fillText(o.name,px+6,py-4);}}
    else if(o.type==='dso'){x.strokeStyle='#4da3ff';x.lineWidth=1.2;x.strokeRect(px-4,py-4,8,8);if(o.mag<5.5){x.fillStyle='#4da3ff';x.font='12px system-ui';x.textAlign='left';x.fillText(o.short,px+7,py+4);}}
    else{const col={sun:'#ffd34d',moon:'#e8e8e0'}[o.type]||'#ff9a6a';x.fillStyle=col;x.beginPath();x.arc(px,py,o.type==='planet'?4.5:8,0,7);x.fill();x.fillStyle=col;x.font='13px system-ui';x.textAlign='left';x.fillText(o.name,px+10,py+4);}}
  if(guide.on){                                                   // Big Dipper -> Polaris guide on the chart
    const L=(p,q,col,w,dash)=>{const A=starById(p),B=starById(q);if(A.alt<-5&&B.alt<-5)return;const [x1,y1]=P(A.alt,A.az),[x2,y2]=P(B.alt,B.az);x.strokeStyle=col;x.lineWidth=w;x.setLineDash(dash||[]);x.beginPath();x.moveTo(x1,y1);x.lineTo(x2,y2);x.stroke();x.setLineDash([]);};
    DIP.big.forEach(([p,q])=>L(p,q,'rgba(127,178,255,.8)',1.6));DIP.little.forEach(([p,q])=>L(p,q,'rgba(127,178,255,.55)',1.2));
    L('Dubhe','Polaris','#ff9a4a',2,[7,5]);
    const pl=starById('Polaris');if(pl.alt>0){const [px,py]=P(pl.alt,pl.az);x.strokeStyle='#ffd36a';x.lineWidth=2;x.beginPath();x.arc(px,py,9,0,7);x.stroke();x.fillStyle='#ffd36a';x.font='bold 13px system-ui';x.textAlign='left';x.fillText('Polaris – North Star',px+12,py+4);}
    const mz=starById('Megrez');if(mz.alt>0){const [px,py]=P(mz.alt,mz.az);x.fillStyle='#9cc4ff';x.font='bold 12px system-ui';x.textAlign='center';x.fillText('Big Dipper',px,py+18);}
    const dm=starById('Dubhe'),mr=starById('Merak');if(dm.alt>0){const [ax,ay]=P(mr.alt,mr.az),[bx,by]=P(dm.alt,dm.az);x.fillStyle='#ffb27a';x.font='11px system-ui';x.textAlign='left';x.fillText('pointer stars',(ax+bx)/2+8,(ay+by)/2+4);}
  }
  const st=driver.state(),T=st.truth,ep=EPS[epI];
  if(T.alt>-5){const [px,py]=P(Math.max(T.alt,0),T.az),fr=Math.max(5,ep.fov/90*R);x.strokeStyle='#ff8a3d';x.lineWidth=2;x.beginPath();x.arc(px,py,fr,0,7);x.moveTo(px-fr-6,py);x.lineTo(px+fr+6,py);x.moveTo(px,py-fr-6);x.lineTo(px,py+fr+6);x.stroke();}
  if(Math.hypot(wrap180(st.az-T.az),st.alt-T.alt)>.3&&st.alt>0){const [px,py]=P(st.alt,st.az);x.strokeStyle='#7dffb0';x.setLineDash([4,4]);x.beginPath();x.arc(px,py,8,0,7);x.stroke();x.setLineDash([]);}
  if(selObj&&selObj.alt>0){const [px,py]=P(selObj.alt,selObj.az);x.strokeStyle='#4da3ff';x.lineWidth=2;x.beginPath();x.arc(px,py,13,0,7);x.stroke();}
  x.fillStyle='#8f9bb8';x.font='12px system-ui';x.textAlign='left';x.fillText('Orange = where the tube really points · green dashed = where the mount thinks it points',10,H-8);
}
$('#skyc').addEventListener('click',e=>{const c=e.currentTarget,r=c.getBoundingClientRect(),sx=(e.clientX-r.left)/r.width*c.width,sy=(e.clientY-r.top)/r.height*c.height,cx=c.width/2,R=c.width/2-26;
  let best=null,bd=22;for(const o of OBJ){if(o.alt<0)continue;const rr=(90-o.alt)/90*R,a=o.az*D2R,px=cx-rr*Math.sin(a),py=c.height/2-rr*Math.cos(a),d=Math.hypot(px-sx,py-sy)-(o.type==='dso'?6:0)-(o.mag<0?4:0);if(d<bd){bd=d;best=o;}}
  if(best){selObj=best;fillSelBox();}});

// procedural field stars: deterministic per sky cell so they stay put as the scope moves
function rng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

// ---- Saturn: ring-tilt geometry from the IAU pole direction, then a pre-rendered banded globe + Cassini-division ring system
const SAT_POLE={ra:40.589,dec:83.537},SAT_CACHE={};
function satGeom(o,jd,proj){                       // B = ring opening seen from Earth, ang = screen angle of Saturn's pole
  const a=o.cra*D2R,d=o.cdec*D2R,ap=SAT_POLE.ra*D2R,dp=SAT_POLE.dec*D2R;
  const B=Math.asin(clamp(-(Math.sin(dp)*Math.sin(d)+Math.cos(dp)*Math.cos(d)*Math.cos(ap-a)),-1,1))*R2D;
  const P=Math.atan2(Math.cos(dp)*Math.sin(ap-a),Math.sin(dp)*Math.cos(d)-Math.cos(dp)*Math.sin(d)*Math.cos(ap-a));   // pole position angle from north through east
  const p0=proj(o.az,o.alt),hn=eqToHor(o.cra,o.cdec+.05,jd),he=eqToHor(o.cra+.05/Math.max(.05,Math.cos(d)),o.cdec,jd),pn=proj(hn.az,hn.alt),pe=proj(he.az,he.alt);
  let nx=pn[0]-p0[0],ny=pn[1]-p0[1],ex=pe[0]-p0[0],ey=pe[1]-p0[1];const ln=Math.hypot(nx,ny)||1,le=Math.hypot(ex,ey)||1;nx/=ln;ny/=ln;ex/=le;ey/=le;
  const dx=nx*Math.cos(P)+ex*Math.sin(P),dy=ny*Math.cos(P)+ey*Math.sin(P);
  return {B,ang:Math.atan2(dx,-dy),pole:[dx,dy]};
}
function ringColor(r){                              // r in Saturn radii -> [R,G,B,alpha]; C, B, Cassini division, A (with Encke gap)
  if(r<1.24||r>2.27)return null;
  if(r<1.53)return [105,92,80,.07+.14*(r-1.24)/.29];
  if(r<1.95){const t=(r-1.53)/.42;return [232,212,172,Math.min(.96,.5+.5*Math.pow(t,.6))*(.93+.07*Math.sin(r*120))];}
  if(r<2.03)return [150,135,110,.05+.04*Math.sin(r*300)];
  if(Math.abs(r-2.215)<.004)return [180,165,135,.1];
  return [214,194,154,r>2.26?.35:.64];
}
function saturnSprite(B){
  const key=Math.round(B*4);if(SAT_CACHE[key])return SAT_CACHE[key];
  const S=620,g=100,fy=.902,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d');x.translate(S/2,S/2);
  const sB=Math.sin(B*D2R),cB=Math.cos(B*D2R),k=Math.max(Math.abs(sB),.012);
  const rings=front=>{x.save();x.beginPath();const top=(sB>=0)!==front;x.rect(-S/2,top?-S/2:0,S,S/2);x.clip();x.scale(1,k);
    for(let r=1.24;r<2.27;r+=.004){const q=ringColor(r);if(!q)continue;x.strokeStyle=`rgba(${q[0]},${q[1]},${q[2]},${q[3]})`;x.lineWidth=g*.0045;x.beginPath();x.arc(0,0,r*g,0,7);x.stroke();}x.restore();};
  const pt=(lat,lon)=>[g*Math.cos(lat)*Math.sin(lon),-g*fy*(Math.sin(lat)*cB-Math.cos(lat)*Math.cos(lon)*sB)];
  const band=(l1,l2,fill)=>{x.beginPath();for(let l=-90;l<=90;l+=6){const p=pt(l1,l*D2R);l===-90?x.moveTo(p[0],p[1]):x.lineTo(p[0],p[1]);}
    for(let l=90;l>=-90;l-=6){const p=pt(l2,l*D2R);x.lineTo(p[0],p[1]);}x.closePath();x.fillStyle=fill;x.fill();};
  rings(false);                                                       // far half of the rings, behind the globe
  x.save();x.beginPath();x.ellipse(0,0,g,g*fy,0,0,7);x.clip();        // globe: latitude belts and zones
  x.fillStyle='#d8c08c';x.fillRect(-g,-g,2*g,2*g);
  for(let d=-90;d<90;d+=1.2){const t=(d+.6)*D2R,w=Math.abs(d+.6),pol=Math.min(1,Math.max(0,(w-55)/30));
    let s=.9+.085*Math.cos(t*9)+.045*Math.cos(t*17+1)+.03*Math.cos(t*31+2)-.18*(w>8&&w<14?1:0);s=s*(1-.25*pol);
    const R=(236*s)*(1-pol)+150*pol,G=(211*s)*(1-pol)+152*pol,Bc=(158*s)*(1-pol)+150*pol;
    band(d*D2R,(d+1.4)*D2R,`rgb(${R|0},${G|0},${Bc|0})`);}
  const rr=rng(77);for(let i=0;i<60;i++){const lat=(rr()-.5)*2.4,w=.01+rr()*.03;band(lat,lat+w,`rgba(${rr()<.5?255:90},${rr()<.5?240:70},${rr()<.5?200:40},${.03+rr()*.05})`);}   // fine streaks
  for(const [r1,r2,a] of [[1.53,1.95,.5],[2.03,2.27,.32]]){const tb=Math.tan(B*D2R),f=r=>-Math.asin(clamp((r-1)*tb*.82,-.9,.9));band(f(r1),f(r2),`rgba(25,18,10,${a})`);}   // ring shadow on the globe
  x.save();x.scale(1,fy);const lg=x.createRadialGradient(0,0,g*.35,0,0,g);lg.addColorStop(0,'rgba(0,0,0,0)');lg.addColorStop(.8,'rgba(0,0,0,.18)');lg.addColorStop(1,'rgba(0,0,0,.62)');x.fillStyle=lg;x.fillRect(-g,-g,2*g,2*g);x.restore();
  x.restore();
  rings(true);                                                        // near half of the rings, in front of the globe
  return SAT_CACHE[key]=c;
}
const SAT_MOONS=[{n:'Titan',P:15.945,a:20.3,m:8.4,p0:1.2},{n:'Rhea',P:4.518,a:8.7,m:9.7,p0:3.4},{n:'Dione',P:2.737,a:6.3,m:10.4,p0:5.1},{n:'Tethys',P:1.888,a:4.9,m:10.2,p0:.4}];   // a in Saturn radii; phases are approximate
function drawSaturn(x,o,px,py,r,proj,jd,ppd){
  const q=satGeom(o,jd,proj),spr=saturnSprite(q.B),s=r/100;
  x.save();x.translate(px,py);x.rotate(q.ang);x.scale(s,s);x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(spr,-310,-310);x.restore();
  const sB=Math.sin(q.B*D2R),ma=[-q.pole[1],q.pole[0]];                // ring major-axis direction on screen
  for(const m of SAT_MOONS){const ps=m.p0+2*Math.PI*(jd-2451545)/m.P,rd=m.a*r,ox=rd*Math.cos(ps),oy=rd*Math.sin(ps)*sB;
    const mx=px+ma[0]*ox+q.pole[0]*oy,my=py+ma[1]*ox+q.pole[1]*oy;if(Math.hypot(mx-px,my-py)<r*1.1&&Math.sin(ps)<0)continue;   // hidden behind the globe
    const mr=Math.max(.9,3-.25*m.m);x.save();x.globalCompositeOperation='lighter';const gg=x.createRadialGradient(mx,my,0,mx,my,mr*2.4);gg.addColorStop(0,'rgba(255,245,225,.95)');gg.addColorStop(1,'rgba(255,245,225,0)');x.fillStyle=gg;x.beginPath();x.arc(mx,my,mr*2.4,0,7);x.fill();x.restore();}
}
/* ---- viewing conditions: seeing (air steadiness), light pollution, and true eyepiece orientation ---- */
const SKY={see:2,lp:6,real:false};                 // seeing in arcseconds; light pollution on the Bortle scale (Phoenix suburbs ~6)
try{const v=JSON.parse(localStorage.getItem('c11sky')||'null');if(v)Object.assign(SKY,v);}catch(_){}
const LP_LIM={2:0,4:.8,6:1.8,8:3};                  // magnitudes of faint stuff lost to sky glow
const lpLoss=()=>LP_LIM[SKY.lp]||0;
function renderSkyRows(){
  const B=(attr,v,lab,on)=>`<button class="b${on?' on':''}" data-${attr}="${v}">${lab}</button>`;
  const h=`<div class="row"><span class="lbl">Seeing</span>${B('see',.8,'😌 Steady',SKY.see===.8)}${B('see',2,'🙂 Average',SKY.see===2)}${B('see',4,'🌊 Shimmery',SKY.see===4)}</div>
   <div class="row"><span class="lbl">Sky glow</span>${B('lp',2,'🌲 Dark site',SKY.lp===2)}${B('lp',4,'🏡 Rural',SKY.lp===4)}${B('lp',6,'🏘 Suburbs',SKY.lp===6)}${B('lp',8,'🏙 City',SKY.lp===8)}</div>
   <div class="row"><span class="lbl">Image</span>${B('real',0,'Map view',!SKY.real)}${B('real',1,'🪞 Real eyepiece view',SKY.real)}</div>
   <p class="sm mu" style="margin:2px 0 6px">Seeing = how much the air shimmers (worse at high power). Sky glow = city lights washing out faint stars and galaxies. Real view: the star diagonal flips the image left-to-right and the straight finder shows it upside-down.</p>`;
  $$('.skyrow').forEach(e=>e.innerHTML=h);}
document.addEventListener('click',e=>{const b=e.target.closest('.skyrow [data-see],.skyrow [data-lp],.skyrow [data-real]');if(!b)return;
  if(b.dataset.see)SKY.see=+b.dataset.see;if(b.dataset.lp)SKY.lp=+b.dataset.lp;if(b.dataset.real!==undefined)SKY.real=b.dataset.real==='1';
  try{localStorage.setItem('c11sky',JSON.stringify(SKY));}catch(_){}renderSkyRows();});
const seeTmp=document.createElement('canvas');renderSkyRows();
function drawEyepiece(c,epo,bare){                 // bare = small thumbnail: skip the text captions
  const x=c.getContext('2d'),W=c.width,H=c.height,R=Math.min(W,H)/2-4,cx=W/2,cy=H/2,ep=epo||EPS[epI],fov=ep.fov,ppd=R/(fov/2),st=driver.state(),T=st.truth,jd=jdNow();
  x.fillStyle='#000';x.fillRect(0,0,W,H);x.beginPath();x.arc(cx,cy,R,0,7);x.clip();
  if(CAP.on&&!ep.eye&&!ep.finder){x.strokeStyle='#222';x.lineWidth=4;x.beginPath();x.arc(cx,cy,R,0,7);x.stroke();if(!bare){x.fillStyle='rgba(255,255,255,.55)';x.font=`${Math.max(12,W/24)}px system-ui`;x.textAlign='center';x.fillText('Lens cap is on – nothing to see!',cx,cy-6);x.font=`${Math.max(10,W/34)}px system-ui`;x.fillText('Take it off (Lens cap button or Setup step)',cx,cy+16);}return;}
  x.save();x.beginPath();x.arc(cx,cy,R,0,7);x.clip();
  const lp=lpLoss(),glow=lp/3;                   // 0 dark site .. 1 city
  const day=clamp((SUN.alt+6)/12,0,1),bgN=`rgb(${4+30*glow|0},${6+24*glow|0},${12+20*glow|0})`;x.fillStyle=day>0?`rgba(${40+90*day|0},${60+110*day|0},${90+140*day|0},${.25+.7*day})`:bgN;x.fillRect(0,0,W,H);
  // real orientation: diagonal = mirror left-right; straight-through finder = rotated 180 degrees
  const flip=SKY.real&&!ep.eye?(ep.finder?'rot':'mir'):null;if(flip){x.translate(cx,cy);if(flip==='mir')x.scale(-1,1);else x.rotate(Math.PI);x.translate(-cx,-cy);}
  const proj=(az,alt)=>[cx+wrap180(az-T.az)*Math.cos(T.alt*D2R)*ppd,cy-(alt-T.alt)*ppd];
  const sd=m=>{if(m>(ep.finder?9.5:15)-lp)return 0;return ep.finder?clamp(3.2-.3*m,.7,3):clamp(5.5-.38*m,.7,6);}; // star disc radius from magnitude
  // field stars
  if(Math.abs(T.dec)<80&&day<.6){const pe=horToEq(T.alt,T.az,jd),cell=.15,rad=fov*.75,dc=Math.max(.02,Math.cos(pe.dec*D2R));
    const r0=Math.floor((pe.ra-rad/dc)/cell),r1=Math.floor((pe.ra+rad/dc)/cell),d0=Math.floor((pe.dec-rad)/cell),d1=Math.floor((pe.dec+rad)/cell);
    if((r1-r0)*(d1-d0)<4000)for(let i=r0;i<=r1;i++)for(let j=d0;j<=d1;j++){const g=rng((i*73856093)^(j*19349663)),n=Math.floor(g()*5.5);
      for(let k=0;k<n;k++){const m=8+7*Math.sqrt(g()),ra=(i+g())*cell,dec=(j+g())*cell,r=sd(m);if(!r)continue;const h=eqToHor(ra,dec,jd),[px,py]=proj(h.az,h.alt);
        if(Math.hypot(px-cx,py-cy)>R+4)continue;x.fillStyle=`rgba(255,255,255,${Math.min(1,.35+.1*(15-m))})`;x.beginPath();x.arc(px,py,r*.6,0,7);x.fill();}}}
  x.globalCompositeOperation='lighter';
  for(const o of OBJ){
    if(o.alt<-1)continue;const [px,py]=proj(o.az,o.alt);if(!isFinite(px+py))continue;if(Math.hypot(px-cx,py-cy)>R+120)continue;
    if(o.type==='star'){const r=sd(o.mag)*1.3;if(!r)continue;const g=x.createRadialGradient(px,py,0,px,py,r*2.6);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.35,'rgba(255,255,255,.5)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.beginPath();x.arc(px,py,r*2.6,0,7);x.fill();}
    else if(o.type==='dso'&&!ep.finder){x.globalAlpha=clamp(1-lp*.24,.2,1);drawDSO(x,o,px,py,ppd,R);x.globalAlpha=1;}
  }
  x.globalCompositeOperation='source-over';
  for(const o of OBJ){
    if(o.alt<-1||ep.finder&&o.type==='dso')continue;const [px,py]=proj(o.az,o.alt);if(!isFinite(px+py))continue;if(Math.hypot(px-cx,py-cy)>R+300)continue;
    if(o.type==='planet'){const r=Math.max(1.6,o.diam*ppd/2);
      if(o.id==='saturn'){drawSaturn(x,o,px,py,r,proj,jd,ppd);continue;}
      const g=x.createRadialGradient(px-r*.3,py-r*.3,0,px,py,r);const col={mercury:'180,170,160',venus:'250,240,215',mars:'230,120,80',jupiter:'235,210,170',saturn:'230,210,160'}[o.id];g.addColorStop(0,`rgba(${col},1)`);g.addColorStop(1,`rgba(${col},.55)`);x.fillStyle=g;x.beginPath();x.arc(px,py,r,0,7);x.fill();
      if(o.id==='jupiter'&&r>5){x.strokeStyle='rgba(150,100,60,.5)';x.lineWidth=r*.12;for(const dy of[-.35,.1,.4]){x.beginPath();x.moveTo(px-r*.9,py+dy*r);x.lineTo(px+r*.9,py+dy*r);x.stroke();}}}
    else if(o.type==='moon'){drawMoon(x,o,px,py,Math.max(2,o.diam*ppd/2));}
    else if(o.type==='sun'){const r=Math.max(2,o.diam*ppd/2);const g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,'#fff6d0');g.addColorStop(.85,'#ffb347');g.addColorStop(1,'#e07a1a');x.fillStyle=g;x.beginPath();x.arc(px,py,r,0,7);x.fill();}
  }
  // seeing: blur by the seeing disc and let the image wander a little (running average of 9 shifted copies, works without canvas filters)
  const bl=ep.eye?0:SKY.see/3600*ppd*.5;
  if(bl>.35){const t=performance.now()/1000,sh=Math.min(bl*.8,6),jx=sh*(Math.sin(t*7.3)+.6*Math.sin(t*13.1+1)),jy=sh*(Math.cos(t*6.1)+.6*Math.sin(t*11.7+2)),b=Math.min(bl,12);
    seeTmp.width=W;seeTmp.height=H;seeTmp.getContext('2d').drawImage(c,0,0);x.setTransform(1,0,0,1,0,0);x.fillStyle=day>0?'#000':bgN;x.fillRect(0,0,W,H);
    const offs=[[0,0],[b,0],[-b,0],[0,b],[0,-b],[b*.7,b*.7],[-b*.7,b*.7],[b*.7,-b*.7],[-b*.7,-b*.7]];
    offs.forEach(([ox,oy],i)=>{x.globalAlpha=1/(i+1);x.drawImage(seeTmp,ox+jx,oy+jy);});x.globalAlpha=1;}
  if(typeof applyDefocus==='function')applyDefocus(x,c,defocusPx(ep,ppd));   // out of focus? stars become doughnuts (19-focus.js)
  x.restore();
  // the 9×50 finder has a crosshair: put the object where the lines cross and the main telescope is aimed at it
  if(ep.finder){const g=R*.06;x.strokeStyle=document.body.classList.contains('red')?'rgba(255,110,90,.75)':'rgba(230,230,230,.6)';x.lineWidth=Math.max(1,W/320);x.beginPath();
    x.moveTo(cx-R,cy);x.lineTo(cx-g,cy);x.moveTo(cx+g,cy);x.lineTo(cx+R,cy);x.moveTo(cx,cy-R);x.lineTo(cx,cy-g);x.moveTo(cx,cy+g);x.lineTo(cx,cy+R);x.stroke();}
  x.strokeStyle='#222';x.lineWidth=4;x.beginPath();x.arc(cx,cy,R,0,7);x.stroke();
  if(!bare){
  x.fillStyle='rgba(255,255,255,.6)';x.font=`${Math.max(11,W/28)}px system-ui`;x.textAlign='left';x.fillText(`${ep.n} · ${Math.round(ep.mag)}× · ${ep.fov.toFixed(2)}°`,10,H-10);
  {const f=MOON.diam/ep.fov;x.textAlign='right';x.fillStyle='rgba(255,236,190,.75)';x.fillText(f<1?`🌙 Moon fits ${(1/f).toFixed(1)}× across`:`🌙 Moon is ${f.toFixed(1)}× wider than view`,W-10,H-10);}
  if(day>.3){x.textAlign='right';x.fillText('daylight sky',W-10,H-10);}
  if(SKY.real&&!ep.eye){x.textAlign='left';x.fillStyle='rgba(255,255,255,.55)';x.fillText(ep.finder?'↻ upside-down (finder)':'🪞 mirrored (diagonal)',10,22);}}
}
function drawDSO(x,o,px,py,ppd,Rv){
  const r=Math.max(2,o.size/60*ppd/2),b=clamp(1.15-(o.mag-3)*.09,.12,.9);x.save();x.translate(px,py);x.rotate(-(o.rot||0)*D2R);x.scale(1,o.ar||1);
  if(o.kind==='gal'||o.kind==='neb'){const col=o.kind==='neb'?'120,230,190':'210,215,235',g=x.createRadialGradient(0,0,0,0,0,r);g.addColorStop(0,`rgba(${col},${b})`);g.addColorStop(.5,`rgba(${col},${b*.35})`);g.addColorStop(1,`rgba(${col},0)`);x.fillStyle=g;x.beginPath();x.arc(0,0,r,0,7);x.fill();}
  else if(o.kind==='pn'){x.strokeStyle=`rgba(130,230,230,${b})`;x.lineWidth=Math.max(1.2,r*.35);x.beginPath();x.arc(0,0,Math.max(2,r*.7),0,7);x.stroke();}
  else{const g=rng(o.name.length*977+o.size|0),n=o.kind==='gc'?160:45,rs=Math.min(r,Rv*1.6),n2=r>Rv?Math.round(n*1.6):n;for(let i=0;i<n2;i++){const a=g()*6.283,d=(o.kind==='gc'?Math.pow(g(),1.8):Math.sqrt(g()))*rs;x.fillStyle=`rgba(255,255,255,${.4+.5*g()})`;x.beginPath();x.arc(Math.cos(a)*d,Math.sin(a)*d,.8+g()*(o.kind==='gc'?.7:1.6),0,7);x.fill();}
    if(o.kind==='gc'){const gg=x.createRadialGradient(0,0,0,0,0,r*.8);gg.addColorStop(0,`rgba(255,240,210,${b*.5})`);gg.addColorStop(1,'rgba(255,240,210,0)');x.fillStyle=gg;x.beginPath();x.arc(0,0,r*.8,0,7);x.fill();}}
  x.restore();
}
// Real Moon photo (NASA/JPL Galileo mosaic PIA00405, public domain), cropped to the disc, north up

const MOON_IMG=new Image();MOON_IMG.src='assets/moon.jpg';
function moonNorthAngle(o){                                    // screen angle of celestial north at the Moon (alt-az view), 0 = straight up
  const jd=jdNow(),h=eqToHor(o.cra,o.cdec+.3,jd),dx=wrap180(h.az-o.az)*Math.cos(o.alt*D2R),dy=h.alt-o.alt;return Math.atan2(dx,dy);}
function drawMoon(x,o,px,py,r){
  x.save();x.translate(px,py);x.beginPath();x.arc(0,0,r,0,7);x.clip();
  const pic=MOON_IMG.complete&&MOON_IMG.naturalWidth;
  const paint=(dim)=>{x.save();x.rotate(moonNorthAngle(o));if(pic){x.globalAlpha=dim;x.drawImage(MOON_IMG,-r*1.012,-r*1.012,r*2.024,r*2.024);}else{x.fillStyle=dim<1?'#14161a':'#d8d4c8';x.fillRect(-r,-r,2*r,2*r);}x.restore();};
  x.fillStyle='#08090b';x.fillRect(-r,-r,2*r,2*r);paint(.07);                       // faint earthshine on the dark part
  x.rotate(o.limb);                                          // local +x now points toward the Sun on screen
  const cosE=Math.cos(o.elong*D2R),a=Math.abs(cosE)*r;
  x.beginPath();x.arc(0,0,r,-Math.PI/2,Math.PI/2,false);
  if(cosE>=0)x.ellipse(0,0,a,r,0,Math.PI/2,-Math.PI/2,true);else x.ellipse(0,0,a,r,0,Math.PI/2,Math.PI*1.5,false);
  x.closePath();x.clip();x.rotate(-o.limb);paint(1);          // sunlit part shows the real photo
  x.restore();
}

