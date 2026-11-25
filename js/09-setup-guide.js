/* Telescope Simulator – 09-setup-guide.js
   Classic script (not an ES module) so the page also works when opened straight from disk.
   All files share one global scope and must load in numeric order (see index.html). */
'use strict';
/* =====================================================================
   SETUP GUIDE – steps follow the CPC Deluxe HD manual (Assembly, pp.4-7) and the EdgeHD manual (accessories, pp.3-6); text is paraphrased.
   ===================================================================== */
const SETUP=[
 {t:'Unpack and carry',b:'Put the round base on a sturdy, flat surface. Lift the scope by the lower part of the fork arm on the hand-control side and by the handle on the opposite side. Keep the boxes for transport. Loosen both clutches slightly when transporting.',w:'Mount the scope on the tripod and bring the tube level before attaching any visual accessories.',part:'fork',view:'left'},
 {t:'Set up the tripod',b:'Hold the tripod head up and spread the legs fully; each leg top presses against the head at full spread. Unscrew the tension knob from the central rod, slide the leg-support bracket (accessory tray) on so each cup sits under a leg, then turn the knob until the bracket is snug.',w:'Do not over-tighten. Re-check the knob after the scope is on the tripod.',part:'tripod'},
 {t:'Set the tripod height',b:'Loosen the extension clamp on a leg, slide it to the length you want and re-tighten. Repeat for all three and make the tripod level. Lower is steadier (best for imaging); a good visual height lets you sit at the eyepiece.',w:'The higher the legs are extended, the less stable the tripod is.',part:'tripod',sub:'locks'},
 {t:'Level the tripod',b:'Before the telescope goes on, make the tripod level. Look at the bubble level on the tripod head: the bubble floats to the HIGH side. Shorten the leg under the bubble, or lengthen the leg on the opposite side, a little at a time, until the bubble sits inside the centre ring. Use the leg buttons below to try it.',w:'A tilted tripod makes the GoTo alignment less accurate and the scope can drift out of view while tracking.',part:'tripod',sub:'head',level:true,cam:()=>({tx:0,ty:TRI.H,tz:0,yaw:.5,pitch:.95,dist:1.05})},
 {t:'Mount the telescope on the tripod',b:'Drop the centre hole of the base over the positioning pin on the tripod head. Turn the base until its three feet drop into the recesses. Then thread the three mounting bolts up from beneath the tripod head into the base and tighten all three.',part:'fork',view:'rear'},
 {t:'Level the tube and set the clutches',b:'Hold the tube by the rear-cell handle, loosen the altitude locking knob, swing the tube up until it is level with the ground and tighten the knob. The CPC has a dual-axis clutch (altitude knob on the right fork arm, azimuth knob on the base). Both must be tight for GoTo.',w:'Moving the scope by hand with the clutches tight can damage the gears, and any manual move voids the alignment.',part:'fork',view:'right'},
 {t:'Install the star diagonal',b:'This C11 uses the 2-inch procedure (EdgeHD/CPC 9.25 and 11): remove the visual back, thread the 2-inch diagonal’s ring onto the rear cell, and remove the 1.25-inch adapter from the barrel if you want 2-inch eyepieces. On the 8-inch, the 1.25-inch diagonal slides into the visual back and its set screw is tightened. To change the diagonal’s angle, loosen the retaining ring (or set screw), rotate and re-tighten.',part:'diagonal',reveal:['diagonal'],view:'rear'},
 {t:'Insert the eyepiece',b:'Back the thumbscrew on the diagonal out so it does not block the bore, slide the chrome barrel of the eyepiece in, and tighten the thumbscrew. Longer focal length = lower power; this model starts with a 23 mm 2-inch eyepiece in the manual (122× on an 11-inch).',part:'eyepiece',reveal:['eyepiece']},
 {t:'Mount the finderscope',b:'First slide the quick-release mounting bracket off the finder bracket. Fit it over the two holes at the top left of the rear cell (looking from behind the tube) and fasten the two screws. Put the O-ring on the finder, push the eyepiece end through the front ring (no adjustment screws) and then the rear ring, pressing the spring-loaded pivot screw down if needed. Seat the O-ring in the front ring and hand-tighten the two adjustment screws.',w:'If you remove the bracket, never thread the screws all the way back into the rear cell: they can reach and damage the primary mirror.',part:'finder',reveal:['finder'],view:'rear'},
 {t:'Align the finderscope (daytime)',b:'Pick a distant object more than a mile away so there is no parallax. Centre it in the main telescope, lock both clutches, then turn the top and right adjustment screws until the finder cross-hairs sit on the object. The finder image is upside-down and reversed, so each screw can move the view in an unexpected direction at first.',part:'finder',sub:'bracket'},
 {t:'Attach the hand control',b:'The hand control ships in a separate box. Plug its coiled cable (phone-style connector) into the hand control port (A) on the drive base until it clicks. Slide the hand control holder into its slot on the fork arm so the controller can rest there.',part:'handset',reveal:['handset'],view:'left'},
 {t:'Power the telescope',reveal:['power'],b:'Set the portable power station on the ground beside the tripod, out of the walking path. Plug the 12 V car-socket cable into its DC socket and press its DC button, then plug the other end into the 12 V input jack (F) on the LEFT side of the drive base. Turn the telescope on with the On/Off switch (E) on the RIGHT side – its red light comes on. (Tap the red switch in the 3D view, or use ⏻ Power in the Control tab.) (A car-battery adapter or mains supply works too.) The panel on the front of the base carries A hand control, B auxiliary (×2), C PC and D auto-guider ports; the round switch and the jack are on the right shoulder.',part:'fork',view:'left'},
 {t:'Take off the lens cap',b:'Make sure the telescope is NOT pointed anywhere near the Sun, then pull the black lens cap straight off the front of the tube and put it somewhere safe, like the table. With the cap on, the eyepiece shows nothing at all. Put it back on at the end of the night once the glass is dry.',part:'cap',view:'front',uncap:true},
 {t:'Align from the hand control',b:'With the scope powered and level, use ALIGN on the controller (or StarSense AutoAlign if fitted) and follow the prompts. Tracking starts after alignment. Never slew while someone is looking through the eyepiece.',part:'handset',tab:'ctrl'}
];
const SU={on:false,i:0,mine:new Set()};
const MOUNT_STEP=()=>SETUP.findIndex(x=>x.t.startsWith('Mount the telescope'));
// levelling game: leg lengths tilt the tripod head; the bubble moves toward the high side
function levelUpdate(){const L=LEVEL.legs,dx=(L[1]-L[2])*.87,dz=L[0]-(L[1]+L[2])/2;LEVEL.dx=clamp(dx,-1,1);LEVEL.dz=clamp(-dz,-1,1);LEVEL.ok=Math.hypot(dx,dz)<.18;
  driver.s.tilt={a:LEVEL.dz*.9,b:LEVEL.dx*.9};          // the bubble's offset becomes a real pointing error
  for(const m of ALLM)if(m.userData.bubble){m.position.x=LEVEL.dx*.009;m.position.z=-.06+LEVEL.dz*.009;}
  const c=document.getElementById('lvlC');if(!c)return;const x=c.getContext('2d'),W=c.width,H=c.height,R=W/2-6;x.clearRect(0,0,W,H);
  x.fillStyle='#1d2a12';x.beginPath();x.arc(W/2,H/2,R,0,7);x.fill();x.strokeStyle='#6b7d3a';x.lineWidth=2;x.beginPath();x.arc(W/2,H/2,R*.28,0,7);x.stroke();
  const bx=W/2+LEVEL.dx*R*.7,by=H/2+LEVEL.dz*R*.7,g=x.createRadialGradient(bx-4,by-4,1,bx,by,R*.22);g.addColorStop(0,'#f6ffd8');g.addColorStop(1,'#a8c84a');x.fillStyle=g;x.beginPath();x.arc(bx,by,R*.22,0,7);x.fill();
  const t=document.getElementById('lvlT');if(t)t.innerHTML=LEVEL.ok?'<b style="color:#7dffb0">✔ Level! The bubble is centred.</b>':'Bubble is off-centre – adjust a leg.';}
function setupMountVisible(show){                                   // tripod steps show only the tripod, so it is easy to see
  if(!show){for(const id of Object.keys(INFO))if(id!=='tripod'&&id!=='kit'&&!hidden.has(id)){hidden.add(id);SU.mine.add(id);}}
  else{SU.mine.forEach(id=>hidden.delete(id));SU.mine.clear();}}
const SU_PARTS=['diagonal','eyepiece','finder','handset','power'];
function setupGo(i){
  SU.on=true;SU.i=Math.max(0,Math.min(SETUP.length-1,i));const st=SETUP[SU.i];
  setupMountVisible(SU.i===0||SU.i>=MOUNT_STEP());
  {const ui=SETUP.findIndex(x=>x.uncap);setCap(SU.i<=ui);}            // the cap stays on until the 'Take off the lens cap' step
  SU_PARTS.forEach(id=>hidden.add(id));                                // parts for later steps are not fitted yet
  SETUP.slice(0,SU.i+1).forEach(x=>(x.reveal||[]).forEach(id=>hidden.delete(id)));
  renderSetup();renderParts();if(st.level)levelUpdate();
}
function setupShow(){const st=SETUP[SU.i];if(st.uncap)setCap(false);selectPart(st.part,st.sub||null,false);if(st.cam){setMode('orbit');tweenTo(st.cam());}else if(st.view)viewFrom(st.view);else focusPart(st.part);if(st.tab)tab(st.tab);}
function renderSetup(){
  const st=SETUP[SU.i];
  $('#p-setup').innerHTML=`<h2>Setup guide</h2><p class="mu sm">Follows the Celestron CPC Deluxe HD and EdgeHD manuals. Parts appear as you reach the step that installs them.</p>
  <div class="st"><div class="mu sm">Step ${SU.i+1} of ${SETUP.length}</div><h3 style="margin:4px 0">${st.t}</h3><div>${st.b}</div>${st.w?`<div class="wn">⚠ ${st.w}</div>`:''}
  ${st.level?`<div class="lvl"><canvas id="lvlC" width="150" height="150"></canvas><div><div class="row">${['A (front)','B (left)','C (right)'].map((n,i)=>`<span class="mu sm" style="min-width:70px">Leg ${n}</span><button class="b sm" data-lg="${i}" data-d="-1">− shorter</button><button class="b sm" data-lg="${i}" data-d="1">+ longer</button><br>`).join('')}</div><div class="sm" id="lvlT"></div></div></div>`:''}
  ${SETUP[SU.i].t==='Set the tripod height'?`<div style="margin-top:8px"><input type="range" id="triS" min="0" max="100" value="${Math.round(TRI.t*100)}" style="width:100%"><div class="mu sm" id="triT">${triTxt()}</div></div>`:''}
  <div class="row" style="margin-top:8px"><button class="b" data-su="prev">◀ Back</button><button class="b on" data-su="show">Show me</button><button class="b" data-su="next">Next ▶</button></div></div>
  <ol>${SETUP.map((x,i)=>`<li data-su="go${i}" class="${i===SU.i?'on':i<SU.i?'dn':''}">${x.t}</li>`).join('')}</ol>
  <div class="row"><button class="b" data-su="all">Finish – show all parts</button><button class="b" data-su="lab">Toggle labels</button></div>
  <h3>Labels key (manual Figure 3)</h3><div class="kk">1 Control panel · 2 Mirror lock knobs · 3 Star diagonal · 4 Hand control · 5 Eyepiece · 6 Finderscope · 7 Finder quick-release bracket · 8 Optical tube · 9 Schmidt corrector lens · 10 Altitude locking knob · 11 Carrying handle · 12 Azimuth locking knob · 13 Tripod · 14 Accessory tray / centre support bracket · 15 Focus knob</div>
  <div class="kk" style="columns:1;margin-top:6px">Panel ports: A hand control · B auxiliary (×2) · C PC interface · D auto-guider. Left side: F 12 V input jack · Right side: E on/off switch (red light)</div>`;
}
$('#p-setup').addEventListener('input',e=>{if(e.target.id==='triS'){setTripod(e.target.value/100);$('#triT').textContent=triTxt();}});
$('#p-setup').addEventListener('click',e=>{const lg=e.target.closest('[data-lg]');if(lg){LEVEL.legs[+lg.dataset.lg]+=+lg.dataset.d*.2;levelUpdate();return;}
  const b=e.target.closest('[data-su]');if(!b)return;const k=b.dataset.su;
  if(k==='prev')setupGo(SU.i-1);else if(k==='next'){setupGo(SU.i+1);setupShow();}else if(k==='show')setupShow();
  else if(k==='all'){setupMountVisible(true);SU_PARTS.forEach(id=>hidden.delete(id));renderParts();viewFrom('iso');}
  else if(k==='lab')$('#bLab').click();else if(k.startsWith('go')){setupGo(+k.slice(2));setupShow();}});

