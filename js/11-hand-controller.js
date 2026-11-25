/* Telescope Simulator – 11-hand-controller.js
   Classic script (not an ES module) so the page also works when opened straight from disk.
   All files share one global scope and must load in numeric order (see index.html). */
'use strict';
/* =====================================================================
   9. HAND CONTROLLER (virtual NexStar-style) AND INPUT
   ===================================================================== */
let rate=7;const HC={mode:'idle',stack:[],pick:null,confirm:null,msg:null,msgT:0,al:{n:0,first:null,cur:null},opt:false,num:null,info:null};
const HCS={allowSun:false,revUD:true};                    // Database Setup / Scope Setup switches (NexStar+ "Allow Sun", Up/Down reversal)
const hcMsg=(a,b,s)=>{HC.msg=[a,b||''];HC.msgT=performance.now()+(s||2.2)*1000;};
const rateTxt=k=>{const r=SLEW_RATES[k];return `${r>=1?r.toFixed(1):r}°/s (${(r/.004178).toFixed(1)}× sidereal)`;};
const trkTxt=t=>({off:'Off',sidereal:'Sidereal',lunar:'Lunar',solar:'Solar'}[t]);
const fmtRA=d=>{const h=d/15,hh=Math.floor(h),mm=Math.floor((h-hh)*60);return `${String(hh).padStart(2,'0')}h${String(mm).padStart(2,'0')}m`;};
const fmtDec=d=>{const s=d<0?'-':'+',a=Math.abs(d),dd=Math.floor(a),mm=Math.floor((a-dd)*60);return `${s}${String(dd).padStart(2,'0')}°${String(mm).padStart(2,'0')}′`;};
const visTxt=o=>o.alt>0?`alt ${o.alt.toFixed(0)}°`:'below horizon';
const common=o=>o.name.replace(/^(M|NGC)\d+\s*/,'')||o.name;       // common name without the catalogue number
function offsetTxt(o){                                            // offset of an object from where the scope points now
  const st=driver.state();let dr=((o.cra-st.ra+540)%360)-180;const dd=o.cdec-st.dec;dr*=Math.cos(o.cdec*D2R);
  return `${Math.abs(dd).toFixed(1)}°${dd>=0?'N':'S'} ${Math.abs(dr).toFixed(1)}°${dr>=0?'E':'W'}`;}
function infoLines(o){                                            // OBJECT INFO pages: name, type, magnitude, constellation, then extended facts
  const L=[o.name,(KIND_NAME[o.kind||o.type]||o.type)];
  L.push(o.mag<50?'Magnitude '+(o.mag>-20?o.mag.toFixed(1):'-12.0'):'');
  if(o.con)L.push('Const: '+(CON_NAMES[o.con]||o.con));
  L.push(`RA ${fmtRA(o.cra)} Dec ${fmtDec(o.cdec)}`);L.push(o.alt>0?`Alt ${o.alt.toFixed(0)}° Az ${o.az.toFixed(0)}°`:'Below the horizon now');
  if(o.size)L.push(`Size ${o.size} arcmin`);
  if(o.type==='planet')L.push(`Disc ${(o.diam*3600).toFixed(1)}"`);
  if(o.type==='moon')L.push(`${Math.round(o.illum*100)}% illuminated`);
  if(o.type==='sun')L.push('USE A SOLAR FILTER!');
  if(o.type==='pluto')L.push('Needs a big scope, dark sky');
  if(o.cat==='double')L.push('Double star');if(o.cat==='var')L.push('Variable star');if(o.sao)L.push('SAO '+o.sao);
  L.push('Offset '+offsetTxt(o));
  return L.filter(Boolean);}
function setPower(v){if(POWER.on===v)return;POWER.on=v;
  if(v){POWER.boot=performance.now();hcMsg('CPC Ready','NexStar+ starting',2.4);toast('Telescope ON – the red light is lit. (A real CPC needs re-aligning after power-off; the sim keeps the alignment.)',4500);driver.setTracking('sidereal');driver._relock();}
  else{driver.stop();HD.az.length=0;HD.alt.length=0;unwind();driver.setTracking('off');toast('Telescope OFF – motors and hand controller have no power.',3500);}
  $$('.pwrb').forEach(b=>{b.classList.toggle('on',v);b.textContent=v?'⏻ Power: ON':'⏻ Power: OFF';});}
function hcDraw(){
  if(!POWER.on){$('#l1').textContent='';$('#l2').textContent='';$('#l3').textContent='';HC.scr=false;$('#scr').style.opacity=0;return;}
  const st=driver.state();let a,b,scr=false;
  const c3=(HC.opt?'OPTION · ':'')+`${trkTxt(st.tracking)} · rate ${rate} · ${st.parked?'PARKED':st.slewing?'SLEWING':st.aligned?st.aligned+'-star aligned':'not aligned'}`;
  if(HC.msg&&performance.now()<HC.msgT){a=HC.msg[0];b=HC.msg[1];}
  else if(HC.mode==='pick'){const it=HC.pick.items[HC.pick.i];a=HC.pick.title+`  (${HC.pick.i+1}/${HC.pick.items.length})`;b='▸ '+it.label+(it.sub?'  '+it.sub:'');scr=HC.pick.items.length>1;}
  else if(HC.mode==='confirm'){const o=HC.confirm;a=o.name;b=`${visTxt(o)} az ${o.az.toFixed(0)}°  ENTER=GoTo`;}
  else if(HC.mode==='info'){const I=HC.info;a=`Info (${I.i+1}/${I.lines.length})`;b=I.lines[I.i];scr=I.lines.length>1;}
  else if(HC.mode==='num'){const n=HC.num,cur=Math.floor(performance.now()/450)%2?'_':' ';a=(n.infoOnly?'Info: ':'')+n.label;b=`${n.cat} ${n.str}${cur}`;}
  else if(HC.mode==='rate'){a='Motor speed';b=`Rate ${rate}: ${rateTxt(rate)}`;}
  else if(HC.mode==='center'){a=st.slewing?`Slewing to ${HC.al.cur.name}`:`Center ${HC.al.cur.name}`;b=st.slewing?'':'Use arrows, then ENTER';}
  else{a=`${fmtRA(st.ra)} ${fmtDec(st.dec)}`;b=`Az ${st.az.toFixed(1)}° Alt ${st.alt.toFixed(1)}°`;}
  const mq=(t)=>{if(t.length<=16)return t;const k=t,now=performance.now();if(HC.mqK!==k){HC.mqK=k;HC.mqT=now;}const cyc=t.length-16+6,p=Math.floor((now-HC.mqT)/280)%cyc-3;return t.substr(clamp(p,0,t.length-16),16);};
  HC.scr=scr;$('#l1').textContent=mq(a);$('#l2').textContent=b.length>16&&a.length<=16?mq(b):b.slice(0,16);$('#l3').textContent=c3;$('#scr').style.opacity=scr?1:0;
}
const snap=()=>({mode:HC.mode,pick:HC.pick,confirm:HC.confirm,num:HC.num,info:HC.info});
function openPick(title,items,i){HC.stack.push(snap());HC.mode='pick';HC.pick={title,items,i:i||0};}
function unwind(){HC.stack.length=0;HC.mode='idle';HC.pick=null;HC.confirm=null;HC.num=null;HC.info=null;}
function back(){const s=HC.stack.pop();if(s){HC.mode=s.mode;HC.pick=s.pick;HC.confirm=s.confirm;HC.num=s.num;HC.info=s.info;}else unwind();}
const toConfirm=o=>()=>{HC.stack.push(snap());HC.mode='confirm';HC.confirm=o;};
const asItems=(arr,sub)=>arr.map(o=>({label:o.name,sub:sub?sub(o):visTxt(o),o,act:toConfirm(o)}));
function objItems(types,f){return asItems(OBJ.filter(o=>types.includes(o.type)&&(!f||f(o))));}
function hcInfo(o){if(!o){hcMsg('Object info','Nothing selected');return;}HC.stack.push(snap());HC.mode='info';HC.info={o,lines:infoLines(o),i:0};}
// numeric entry (Messier / NGC / SAO): digits build the number, ENTER looks it up, BACK erases a digit
function openNum(cat,infoOnly,keep){if(keep)HC.stack.push(snap());else unwind();HC.mode='num';HC.num={cat,str:'',infoOnly:!!infoOnly,label:{M:'Messier catalog',NGC:'NGC catalog',SAO:'SAO catalog'}[cat]+' – enter #'};}
function numLookup(){const n=HC.num,v=+n.str;if(!n.str){hcMsg(n.cat,'Enter a number first');return null;}
  const o=n.cat==='SAO'?OBJ.find(x=>x.sao===v):OBJ.find(x=>x.id===n.cat+v);
  if(!o){hcMsg(`${n.cat} ${v}`,n.cat==='SAO'?'Not in sim database':n.cat==='M'?'Not found (1–110)':'Not in sim database',2.4);return null;}return o;}
function identify(){                                              // IDENTIFY: nearest known objects to where the scope points, with offsets
  const st=driver.state(),all=[...OBJ.filter(o=>o.type!=='sun'||HCS.allowSun),...CAT.filter(o=>o.cat==='planet')];
  const L=all.map(o=>({o,d:angSep({ra:o.cra,dec:o.cdec},{ra:st.ra,dec:st.dec})})).filter(x=>x.d<15).sort((a,b)=>a.d-b.d).slice(0,8);
  if(!L.length){hcMsg('Identify','Nothing within 15°',2.4);return;}
  unwind();openPick('Identify',L.map(x=>({label:x.o.name,sub:offsetTxt(x.o),o:x.o,act:toConfirm(x.o)})));
}
function solarList(){const l=[MOON,...OBJ.filter(o=>o.type==='planet'&&o.alt>0),...CAT.filter(o=>o.cat==='planet'&&o.alt>0),...(HCS.allowSun?[SUN]:[])];return l;}

/* ---- safety moments: friendly pop-ups before the Sun, before the first move, and for the bright Moon ---- */
const SAFE={moveTip:false,moon:false};
function safetyAsk(icon,title,body,ok,cancel){return new Promise(res=>{const el=$('#safety');
  el.innerHTML=`<div><div class="big">${icon}</div><h2>${title}</h2><p>${body}</p><div class="row" style="justify-content:center">${cancel?`<button class="b" id="sfNo">${cancel}</button>`:''}<button class="b on" id="sfOk">${ok}</button></div></div>`;
  el.style.display='flex';$('#sfOk').onclick=()=>{el.style.display='none';res(true);};if(cancel)$('#sfNo').onclick=()=>{el.style.display='none';res(false);};});}
function safetyMoveTip(){if(SAFE.moveTip||!edu.on)return;SAFE.moveTip=true;
  safetyAsk('🙈','Before the telescope moves','Make sure <b>nobody is looking through the eyepiece</b> and keep fingers away from the arms. A moving eyepiece can bump your eye!','Got it!');}
function doGoto(o,after,ok){
  if(!POWER.on){toast('The telescope is off. Turn on the red power switch first.',3000);return false;}
  if(o.type==='sun'&&!ok){safetyAsk('☀️','STOP – this is the Sun!','Never point a telescope at the Sun unless a <b>special solar filter covers the FRONT</b> of the telescope. Sunlight through a telescope can blind you in a split second. Only a grown-up should fit the filter.',
    'A grown-up fitted a solar filter','Cancel').then(y=>{if(y)doGoto(o,after,true);});return false;}
  if(!ok&&edu.on&&!SAFE.moveTip){SAFE.moveTip=true;safetyAsk('🙈','Before the telescope moves','Make sure <b>nobody is looking through the eyepiece</b> and keep fingers away from the arms. The telescope is about to swing around!','OK, all clear!','Wait').then(y=>{if(y)doGoto(o,after,true);});return false;}
  if(o.type==='moon'&&!SAFE.moon&&edu.on){SAFE.moon=true;setTimeout(()=>toast('🌙 The Moon is safe to look at, but it is VERY bright. The Moon filter from the eyepiece kit makes it comfortable.',5000),1500);}
  const r=driver.gotoRaDec(o.cra,o.cdec);
  if(!r.ok){hcMsg('Cannot GoTo','Below horizon');toast(o.name+' is below the horizon');return false;}
  driver.s.onArrive=after||null;if(OBJ.includes(o)){selObj=o;fillSelBox();}HC.last=o;
  if(!HC.warned&&!edu.on){HC.warned=true;toast('Caution: never slew the scope while anyone is looking into the eyepiece.',4500);}
  if(o.type==='sun'){hcMsg('WARNING','Solar filter required!',3.5);toast('Never view the Sun without a certified solar filter.',4000);}else hcMsg('Slewing to',o.name,1.8);
  return true;
}
function startAlign(){
  HC.al={n:0,first:null,cur:null};if(driver.state().tracking==='off')driver.setTracking('sidereal');unwind();pickAlignStar(1);
}
function starSenseAlign(){                    // simulated: slew to 3 sky fields, image each, plate-solve, then set the alignment
  if(hidden.has('starsense')){hcMsg('StarSense','Not fitted');return;}
  const s=driver.s;if(s.parked)driver.unpark();unwind();HC.al={n:0,first:null,cur:null};
  const e0={az:s.enc.az,alt:Math.max(25,s.enc.alt)},pts=[{az:e0.az+25,alt:Math.min(80,e0.alt+15)},{az:e0.az-25,alt:Math.min(80,e0.alt+25)},{az:e0.az,alt:Math.min(80,e0.alt+10)}];
  let i=0;const next=()=>{
    if(i>=pts.length){hcMsg('StarSense','Solving…');setTimeout(()=>{driver.autoAlign();driver.setTracking('sidereal');hcMsg('StarSense','Aligned (3 fields)');},1400);return;}
    hcMsg('StarSense',`Slewing ${i+1}/3`);s.goto={enc:pts[i]};s.lock=null;s.onArrive=()=>{hcMsg('StarSense',`Imaging ${i+1}/3`);i++;setTimeout(next,1400);};};
  next();
}
function pickAlignStar(n){
  const items=OBJ.filter(o=>o.type==='star'&&o.mag<2.3&&o.alt>20).sort((a,b)=>a.mag-b.mag).map(o=>({label:o.name,sub:`alt ${o.alt.toFixed(0)}° az ${o.az.toFixed(0)}°`,o,act:()=>alignSlew(o,n)}));
  if(!items.length){hcMsg('No bright stars','above 20° now');unwind();return;}
  unwind();openPick(`Align star ${n}`,items);
}
function alignSlew(o,n){
  if(n===2&&HC.al.first&&angSep({ra:o.cra,dec:o.cdec},{ra:HC.al.first.cra,dec:HC.al.first.cdec})<40){hcMsg('Too close','Pick star >40° away');return;}
  unwind();HC.al.cur=o;HC.al.n=n;if(doGoto(o)){HC.mode='center';}
}
function enter(){
  if(HC.mode==='pick'){const it=HC.pick.items[HC.pick.i];it.act&&it.act();}
  else if(HC.mode==='confirm'){const o=HC.confirm;unwind();doGoto(o);}
  else if(HC.mode==='info'){const o=HC.info.o;unwind();doGoto(o);}               // info can be read while slewing; ENTER slews to the shown object
  else if(HC.mode==='num'){const o=numLookup();if(o){if(HC.num.infoOnly)hcInfo(o);else toConfirm(o)();}}
  else if(HC.mode==='rate'){unwind();}
  else if(HC.mode==='center'){
    if(driver.state().slewing){hcMsg('Wait','Still slewing');return;}
    const o=HC.al.cur;driver.addAlignPoint(o);
    if(HC.al.n===1){HC.al.first=o;hcMsg('Star 1 accepted','Now pick star 2',1.6);pickAlignStar(2);}
    else{unwind();driver.setTracking('sidereal');hcMsg('Align success','Two-star alignment');toast('Alignment complete. GoTo should now land objects in the field.');}
  }
}
function undo(){                                                  // BACK: erase a digit, else go up one level; at the top it stops the motors
  if(HC.mode==='center'){unwind();driver.stop();hcMsg('Alignment','cancelled');return;}
  if(HC.mode==='num'&&HC.num.str){HC.num.str=HC.num.str.slice(0,-1);return;}
  if(HC.mode!=='idle'){back();return;}
  driver.stop();hcMsg('Stopped','');
}
function setTrack(m){driver.setTracking(m);hcMsg('Tracking',trkTxt(m));updTrkRow();if(m==='solar')toast('Solar tracking: use a certified solar filter at all times.',3500);}
function key(k){
  if(!POWER.on){toast('The telescope is off. Press the red power switch (or ⏻ Power) first.',2500);return;}
  if(driver.s.parked&&k!=='park'&&k!=='home'){driver.unpark();hcMsg('Unparked','');}
  const wasOpt=HC.opt;if(k!=='option')HC.opt=false;                // OPTION is a one-shot modifier
  if(/^[0-9]$/.test(k)){
    if(HC.mode==='num'){const mx={M:3,NGC:4,SAO:6}[HC.num.cat];if(HC.num.str.length<mx)HC.num.str+=k;return;}
    if(k==='0')return;
    rate=+k;if(HC.mode==='rate'){hcMsg('Rate '+k,rateTxt(k),1.6);unwind();}else hcMsg('Rate '+k,rateTxt(k)+(HCS.revUD&&rate<=6?' · UP/DOWN reversed':''),1.6);return;}
  switch(k){
    case 'enter':enter();break;case 'undo':undo();break;
    case 'sup':case 'sdn':{const d=k==='sup'?-1:1;
      if(HC.mode==='pick'){const n=HC.pick.items.length;HC.pick.i=(HC.pick.i+d+n)%n;}
      else if(HC.mode==='info'){const n=HC.info.lines.length;HC.info.i=(HC.info.i+d+n)%n;}break;}
    case 'option':HC.opt=!wasOpt;hcMsg('OPTION',HC.opt?'on – press OBJECT INFO':'off',1.4);break;
    case 'ident':identify();break;
    case 'help':openNum('M');break;                                 // HELP is a shortcut to the Messier catalog
    case 'mspeed':unwind();HC.mode='rate';break;
    case 'info':
      if(wasOpt){unwind();openPick('Info for catalog #',[{label:'Messier',act:()=>openNum('M',true,true)},{label:'NGC',act:()=>openNum('NGC',true,true)},{label:'SAO',act:()=>openNum('SAO',true,true)}]);}
      else if(HC.mode==='pick'){const it=HC.pick.items[HC.pick.i];if(it.o)hcInfo(it.o);else hcMsg('Object info','Pick an object first');}
      else if(HC.mode==='confirm')hcInfo(HC.confirm);
      else if(HC.mode==='num'){const o=numLookup();if(o)hcInfo(o);}
      else if(HC.mode==='idle')hcInfo(HC.last||selObj);
      break;
    case 'menu':unwind();openPick('Menu',[
      {label:'Tracking mode',act:()=>openPick('Tracking',['off','sidereal','lunar','solar'].map(m=>({label:trkTxt(m),act:()=>{setTrack(m);unwind();}})),['off','sidereal','lunar','solar'].indexOf(driver.s.tracking))},
      {label:'Go to home',act:()=>{driver.home(false);unwind();hcMsg('Slewing','to home position');}},
      {label:'Park',act:()=>{driver.park();unwind();hcMsg('Parking','');}},
      {label:'Database setup',sub:'Allow Sun: '+(HCS.allowSun?'On':'Off'),act:()=>openPick('Database setup',[{label:'Allow Sun',sub:HCS.allowSun?'On':'Off',act:()=>{HCS.allowSun=!HCS.allowSun;unwind();hcMsg('Allow Sun',HCS.allowSun?'On – use a solar filter':'Off',2.6);}}])},
      {label:'Scope setup',sub:'UP/DOWN swap ≤6: '+(HCS.revUD?'On':'Off'),act:()=>openPick('Scope setup',[{label:'Reverse UP/DOWN ≤ rate 6',sub:HCS.revUD?'On':'Off',act:()=>{HCS.revUD=!HCS.revUD;unwind();hcMsg('UP/DOWN swap',HCS.revUD?'On (rates 1–6)':'Off',2.2);}}])},
      {label:'User objects',act:()=>{const u=CAT.filter(o=>o.cat==='user');openPick('User objects',[{label:'Save current position',act:()=>{const st=driver.state(),o={id:'U'+(u.length+1),name:'User object '+(u.length+1),type:'region',kind:'user object',ra:st.ra,dec:st.dec,cra:st.ra,cdec:st.dec,alt:st.alt,az:st.az,mag:99,cat:'user'};CAT.push(o);unwind();hcMsg('Saved',o.name,2);}},...asItems(u)]);}},
      {label:'Time speed',act:()=>openPick('Time speed',[1,10,60,600,3600].map(v=>({label:v+'×',act:()=>{setSpeed(v);unwind();}})))},
      {label:'Clear alignment',act:()=>{driver.clearAlign();unwind();hcMsg('Alignment','cleared');}},
      {label:'Hardware link',act:()=>{unwind();hcMsg('Simulation only','See Link tab',3);}}]);break;
    case 'align':unwind();openPick('Alignment',[...(hidden.has('starsense')?[]:[{label:'StarSense AutoAlign',sub:'camera',act:starSenseAlign}]),{label:'Two-Star Align',act:startAlign},{label:'Clear alignment',act:()=>{driver.clearAlign();unwind();hcMsg('Alignment','cleared');}}]);break;
    case 'stars':unwind();openPick('Stars',[
      {label:'Bright stars',act:()=>openPick('Bright stars',objItems(['star']).sort((a,b)=>a.o.mag-b.o.mag).slice(0,60))},
      {label:'Double stars',act:()=>openPick('Double stars',objItems(['star'],o=>o.cat==='double').sort((a,b)=>a.o.mag-b.o.mag))},
      {label:'Variable stars',act:()=>openPick('Variable stars',objItems(['star'],o=>o.cat==='var').sort((a,b)=>a.o.mag-b.o.mag))},
      {label:'Constellations',act:()=>openPick('Constellations',asItems(CAT.filter(o=>o.cat==='const')))},
      {label:'Asterisms',act:()=>openPick('Asterisms',asItems(CAT.filter(o=>o.cat==='aster')))},
      {label:'SAO catalog',sub:'enter #',act:()=>openNum('SAO',false,true)}]);break;
    case 'planets':case 'solar':unwind();openPick('Solar System',asItems(solarList()));break;
    case 'dso':unwind();openPick('Deep Sky',[
      {label:'Best of',act:()=>openPick('Best deep sky',objItems(['dso'],o=>!o.xm).sort((a,b)=>a.o.mag-b.o.mag))},
      {label:'Messier',sub:'enter #',act:()=>openNum('M',false,true)},
      {label:'NGC',sub:'enter #',act:()=>openNum('NGC',false,true)},
      {label:'Alphabetical',act:()=>openPick('Alphabetical',objItems(['dso']).sort((a,b)=>common(a.o).localeCompare(common(b.o))))}]);break;
    case 'tour':{unwind();const it=objItems(['moon','planet','dso'],o=>o.alt>20&&!o.xm).sort((a,b)=>a.o.mag-b.o.mag).slice(0,14);if(it.length)openPick('Tonight’s tour',it);else hcMsg('Nothing above','20° right now');break;}
    case 'track':{const order=['off','sidereal','lunar','solar'];setTrack(order[(order.indexOf(driver.s.tracking)+1)%4]);break;}
    case 'home':driver.home(false);hcMsg('Slewing','to home position');break;
    case 'park':driver.park();hcMsg('Parking','');break;
    case 'stop':driver.stop();hcMsg('Stopped','');break;
  }
}
function flash(k){const b=$(`.hc [data-k="${k}"]`);if(b){b.classList.add('fl');setTimeout(()=>b.classList.remove('fl'),3500);}}
let repT=null,repI=null,repDone=false;                      // holding SCROLL repeats quickly
const stopRepeat=()=>{clearTimeout(repT);clearInterval(repI);repT=repI=null;};
const startRepeat=f=>{stopRepeat();repT=setTimeout(()=>{repDone=true;repI=setInterval(f,70);},420);};
$('#nums').innerHTML=[1,2,3,4,5,6,7,8,9].map(n=>`<button data-k="${n}">${n}</button>`).join('');
$('.hc').addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(!b)return;if(repDone){repDone=false;return;}key(b.dataset.k);});
$$('.hc [data-k="sup"],.hc [data-k="sdn"]').forEach(b=>{b.addEventListener('pointerdown',()=>{repDone=false;startRepeat(()=>key(b.dataset.k));});['pointerup','pointercancel','pointerleave'].forEach(ev=>b.addEventListener(ev,stopRepeat));});
// held direction buttons
const inp={pad:{az:0,alt:0}};
const HD={az:[],alt:[]};                                   // held arrow presses in the order they were made
const dirDown=(ax,sg,src)=>{if(!HD[ax].some(h=>h.sg===sg&&h.src===src))HD[ax].push({sg,src});};
const dirUp=(ax,sg,src)=>{const i=HD[ax].findIndex(h=>h.sg===sg&&h.src===src);if(i>=0)HD[ax].splice(i,1);};
$$('.hc [data-d]').forEach(b=>{const [ax,sg]=[b.dataset.d.slice(0,-1),b.dataset.d.slice(-1)==='+'?1:-1];
  b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);dirDown(ax,sg,'b');b.classList.add('act');cancelHcMsg();});
  const up=()=>{if(!b.classList.contains('act'))return;dirUp(ax,sg,'b');b.classList.remove('act');};b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',up);});
function cancelHcMsg(){HC.msg=null;}
/* ---- simple controller for Education mode: big arrows, 3 speeds, picture Go-to tiles ---- */
const KT=[['🌙','Moon','moon'],['🪐','Saturn','saturn'],['🟠','Jupiter','jupiter'],['🔴','Mars','mars'],['✨','Venus','venus'],['⭐','North Star','Polaris'],
  ['🌌','Andromeda Galaxy','M31'],['💫','Pleiades','M45'],['☁️','Orion Nebula','M42'],['💍','Ring Nebula','M57'],['🎆','Hercules Cluster','M13'],['🔵','Vega','Vega']];
const kid={rate:7};
function renderKidTiles(){const sig=KT.map(([e,n,id])=>{const o=OBJ.find(x=>x.id===id);return o&&o.alt>0?1:0;}).join('');if(sig===renderKidTiles.sig)return;renderKidTiles.sig=sig;   // redraw only when a target rises or sets, so taps are never lost
  $('#ktiles').innerHTML=KT.map(([e,n,id])=>{const o=OBJ.find(x=>x.id===id),up=o&&o.alt>0;return `<button data-kt="${id}" class="${up?'':'down'}"><b>${e}</b>${n}${up?'':'<br><span class="mu sm">not up</span>'}</button>`;}).join('');}
$('#ktiles').addEventListener('click',e=>{const b=e.target.closest('[data-kt]');if(!b)return;const o=OBJ.find(x=>x.id===b.dataset.kt);if(!o)return;
  if(o.alt<=0){toast(`${o.name} is below the horizon right now. Try the Sky tab to speed up time.`,3500);return;}doGoto(o);});
$$('#kidpad [data-kd]').forEach(b=>{const ax=b.dataset.kd.slice(0,-1),sg=b.dataset.kd.slice(-1)==='+'?1:-1;
  b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);rate=kid.rate;dirDown(ax,sg,'kid');b.classList.add('act');cancelHcMsg();safetyMoveTip();});
  const up=()=>{if(!b.classList.contains('act'))return;dirUp(ax,sg,'kid');b.classList.remove('act');};['pointerup','pointercancel','lostpointercapture'].forEach(v=>b.addEventListener(v,up));});
$('#kidpad').addEventListener('click',e=>{const s=e.target.closest('[data-ks]');if(s){kid.rate=+s.dataset.ks;rate=kid.rate;$$('#kidpad [data-ks]').forEach(x=>x.classList.toggle('on',x===s));}
  if(e.target.closest('[data-kk=stop]')){driver.stop();toast('Stopped.');}});
$('#bFullHC').onclick=()=>{const on=document.body.classList.toggle('fullhc');$('#bFullHC').textContent=on?'Hide the real hand controller':'Show the real hand controller';};
function kidStatus(){if(!POWER.on)return '⏻ Power is OFF – tap ⏻ Power to turn it on';const st=driver.state();if(st.slewing)return '🔭 Moving… please wait';
  const T=st.truth,eq=horToEq(T.alt,T.az,jdNow());let best=null,bd=.6;for(const o of OBJ){if(o.alt<0)continue;const d=angSep({ra:o.cra,dec:o.cdec},eq);if(d<bd){bd=d;best=o;}}
  return best?`Pointing at: ${best.name}${bd>.15?' (nearby)':''}`:`Pointing at empty sky · up ${T.alt.toFixed(0)}°`;}

$('#bMin').textContent='▾';
const typing=e=>/INPUT|SELECT|TEXTAREA/.test((e.target||{}).tagName||'');
addEventListener('keydown',e=>{
  if(typing(e))return;const k=e.key;
  if(k==='ArrowLeft'||k==='ArrowRight'||k==='ArrowUp'||k==='ArrowDown'){e.preventDefault();
    if(!e.repeat){if(k==='ArrowLeft')dirDown('az',-1,'k');if(k==='ArrowRight')dirDown('az',1,'k');if(k==='ArrowUp')dirDown('alt',1,'k');if(k==='ArrowDown')dirDown('alt',-1,'k');}return;}
  if(/^[1-9]$/.test(k))key(k);else if(k==='Enter')key('enter');else if(k==='Escape')key('undo');
  else if(k==='m'||k==='M')key('menu');else if(k==='i'||k==='I')key('ident');else if(k==='o'||k==='O')key('option');else if(k==='h'||k==='H')key('help');else if(k==='n'||k==='N')key('info');else if(k==='PageUp')key('sup');else if(k==='PageDown')key('sdn');else if(k==='a'&&cam.mode!=='walk')key('align');else if(k==='t'||k==='T')key('track');
  else keys[k.toLowerCase()]=true;});
addEventListener('keyup',e=>{const k=e.key;if(k==='ArrowLeft')dirUp('az',-1,'k');if(k==='ArrowRight')dirUp('az',1,'k');if(k==='ArrowUp')dirUp('alt',1,'k');if(k==='ArrowDown')dirUp('alt',-1,'k');keys[k.toLowerCase()]=false;});
// gamepad
const gp={prev:[]};
function pollPad(dt){
  let g=null;try{g=[...(navigator.getGamepads?navigator.getGamepads():[])].find(x=>x&&x.connected);}catch(_){}
  $('#padst').textContent=g?'Gamepad: connected.':'';
  if(!g){inp.pad.az=inp.pad.alt=0;return;}
  const dz=v=>Math.abs(v)<.22?0:v;inp.pad.az=dz(g.axes[0]||0);inp.pad.alt=-dz(g.axes[1]||0);
  const rx=dz(g.axes[2]||0),ry=dz(g.axes[3]||0);if((rx||ry)&&cam.mode==='orbit'){cam.yaw-=rx*dt*2;cam.pitch=clamp(cam.pitch+ry*dt*1.5,-1.5,1.5);}
  const pr=i=>g.buttons[i]&&g.buttons[i].pressed,edge=i=>pr(i)&&!gp.prev[i];
  if(edge(0))key('enter');if(edge(1))key('undo');if(edge(3))key('track');if(edge(4))key(String(Math.max(1,rate-1)));if(edge(5))key(String(Math.min(9,rate+1)));
  gp.prev=g.buttons.map(b=>b.pressed);
}
// ---- pressable 3D handset: arrows hold-to-slew, other keys act like the on-screen controller
const HC3={held:null,lcd:''};
const isShown=o=>{for(;o;o=o.parent)if(!o.visible)return false;return true;};
function hc3Key(px,py){                            // px,py are pixel positions on the 256x780 keypad texture
  const near=(cx,cy,r)=>Math.hypot(px-cx,py-cy)<r;
  if(near(60,215,26))return {f:()=>key('align')};if(near(128,205,26))return {f:()=>key('enter')};if(near(196,215,26))return {f:()=>key('undo')};
  const dx=(px-128)/66,dy=(py-305)/44;
  if(dx*dx+dy*dy<1.15){return Math.abs(dx)>Math.abs(dy)?{d:['az',dx<0?-1:1]}:{d:['alt',dy<0?1:-1]};}
  const F=[()=>key('planets'),()=>key('stars'),()=>key('dso'),()=>key('ident'),()=>key('tour'),()=>key('sup'),()=>key('menu'),()=>key('help'),()=>key('sdn'),()=>key('option'),()=>key('info'),()=>key('mspeed')];
  for(let i=0;i<12;i++)if(near(62+(i%3)*68,408+((i/3)|0)*78,30))return {f:F[i],rep:i===5||i===8};
  return null;
}
cv.addEventListener('pointerdown',e=>{
  if(e.button>0)return;const r=cv.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(mouse,camera);
  if(!hidden.has('fork')){const sw=ray.intersectObjects(POWER_HIT,false)[0];if(sw){const front=ray.intersectObjects(ALLM.filter(m=>isShown(m)&&!hidden.has(m.userData.part)),false)[0];
    if(!front||front.distance>sw.distance-.03){e.stopImmediatePropagation();e.preventDefault();setPower(!POWER.on);return;}}}   // tap the red switch (or close to it)
  const pad=ray.intersectObjects(ALLM.filter(m=>m.userData.keypad&&isShown(m)),false)[0];if(!pad||!pad.uv)return;
  const front=ray.intersectObjects(ALLM.filter(m=>isShown(m)&&m.userData.part&&!hidden.has(m.userData.part)),false)[0];if(front&&front.object!==pad.object&&front.distance<pad.distance-.003)return;
  const k=hc3Key(pad.uv.x*256,(1-pad.uv.y)*780);if(!k)return;
  e.stopImmediatePropagation();e.preventDefault();if(curTab!=='ctrl')tab('ctrl');
  if(k.d){dirDown(k.d[0],k.d[1],'h');HC3.held=k.d;cancelHcMsg();}else{k.f();if(k.rep)startRepeat(k.f);}
},true);
const hc3Up=()=>{stopRepeat();if(HC3.held){dirUp(HC3.held[0],HC3.held[1],'h');HC3.held=null;}};addEventListener('pointerup',hc3Up);addEventListener('pointercancel',hc3Up);
function hc3Lcd(){                                  // mirror the controller's LCD text onto the 3D handset
  hcDraw();const a=$('#l1').textContent,b=$('#l2').textContent,k=a+'|'+b+'|'+(HC.scr?1:0)+(HC.opt?1:0)+(POWER.on?1:0);if(k===HC3.lcd)return;HC3.lcd=k;
  const x=hcTex.image.getContext('2d');x.fillStyle=POWER.on?'#2a0a06':'#0a0a0a';x.fillRect(30,58,196,74);x.fillStyle='#ff5a3c';x.font='bold 14px monospace';x.textAlign='left';
  x.fillText(a.slice(0,21),36,86);x.fillText(b.slice(0,21),36,114);if(HC.scr){x.font='bold 18px system-ui';x.textAlign='right';x.fillText('⇕',222,100);}if(HC.opt){x.font='9px system-ui';x.textAlign='left';x.fillText('OPTION',36,128);}hcTex.needsUpdate=true;
}
// camera follows the mount when it slews (not for slow sidereal tracking)
const follow={on:true,prev:null};
function feedMount(){
  if(!POWER.on){driver.setManual(0,0,0);return;}
  // Double-button: hold one arrow and press the opposite one -> maximum slew rate in the first direction.
  let r=SLEW_RATES[rate],dbl=false;const v={};
  for(const ax of ['az','alt']){const h=HD[ax];let d=0;
    if(h.some(x=>x.sg===1)&&h.some(x=>x.sg===-1)){d=h[0].sg;dbl=true;}else if(h.length)d=h[0].sg;
    v[ax]=clamp(d+(d?0:inp.pad[ax]),-1,1);}
  if(dbl)r=SLEW_RATES[9];
  // NexStar+: at rates 6 and below the UP/DOWN motor direction is opposite to rates 7-9 (keeps the image moving the right way in the eyepiece)
  if(HCS.revUD&&rate<=6&&!dbl&&!HD.alt.some(h=>h.src==='kid'))v.alt=-v.alt;   // the simple pad always moves the tube the way the arrow points
  driver.setManual(v.az,v.alt,r);
}


document.addEventListener('click',e=>{if(e.target.closest('[data-pwr]'))setPower(!POWER.on);});
