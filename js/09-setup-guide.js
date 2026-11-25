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
 {t:'Mount the telescope on the tripod',b:'Drop the centre hole of the base over the positioning pin on the tripod head. Turn the base until its three feet drop into the recesses. Then thread the three mounting bolts up from beneath the tripod head into the base and tighten all three.',part:'fork',view:'rear'},
 {t:'Level the tube and set the clutches',b:'Hold the tube by the rear-cell handle, loosen the altitude locking knob, swing the tube up until it is level with the ground and tighten the knob. The CPC has a dual-axis clutch (altitude knob on the right fork arm, azimuth knob on the base). Both must be tight for GoTo.',w:'Moving the scope by hand with the clutches tight can damage the gears, and any manual move voids the alignment.',part:'fork',view:'right'},
 {t:'Install the star diagonal',b:'This C11 uses the 2-inch procedure (EdgeHD/CPC 9.25 and 11): remove the visual back, thread the 2-inch diagonal’s ring onto the rear cell, and remove the 1.25-inch adapter from the barrel if you want 2-inch eyepieces. On the 8-inch, the 1.25-inch diagonal slides into the visual back and its set screw is tightened. To change the diagonal’s angle, loosen the retaining ring (or set screw), rotate and re-tighten.',part:'diagonal',reveal:['diagonal'],view:'rear'},
 {t:'Insert the eyepiece',b:'Back the thumbscrew on the diagonal out so it does not block the bore, slide the chrome barrel of the eyepiece in, and tighten the thumbscrew. Longer focal length = lower power; this model starts with a 23 mm 2-inch eyepiece in the manual (122× on an 11-inch).',part:'eyepiece',reveal:['eyepiece']},
 {t:'Mount the finderscope',b:'First slide the quick-release mounting bracket off the finder bracket. Fit it over the two holes at the top left of the rear cell (looking from behind the tube) and fasten the two screws. Put the O-ring on the finder, push the eyepiece end through the front ring (no adjustment screws) and then the rear ring, pressing the spring-loaded pivot screw down if needed. Seat the O-ring in the front ring and hand-tighten the two adjustment screws.',w:'If you remove the bracket, never thread the screws all the way back into the rear cell: they can reach and damage the primary mirror.',part:'finder',reveal:['finder'],view:'rear'},
 {t:'Align the finderscope (daytime)',b:'Pick a distant object more than a mile away so there is no parallax. Centre it in the main telescope, lock both clutches, then turn the top and right adjustment screws until the finder cross-hairs sit on the object. The finder image is upside-down and reversed, so each screw can move the view in an unexpected direction at first.',part:'finder',sub:'bracket'},
 {t:'Attach the hand control',b:'The hand control ships in a separate box. Plug its coiled cable (phone-style connector) into the hand control port (A) on the drive base until it clicks. Slide the hand control holder into its slot on the fork arm so the controller can rest there.',part:'handset',reveal:['handset'],view:'left'},
 {t:'Power the telescope',b:'Plug the 12 V car-battery adapter (or optional power supply) into the 12 V input jack (F) on the drive base, then switch the On/Off switch (E) on. The panel on the front of the base carries A hand control, B auxiliary (×2), C PC and D auto-guider ports; the round switch and the jack are on the right shoulder.',part:'fork',view:'left'},
 {t:'Align from the hand control',b:'With the scope powered and level, use ALIGN on the controller (or StarSense AutoAlign if fitted) and follow the prompts. Tracking starts after alignment. Never slew while someone is looking through the eyepiece.',part:'handset',tab:'ctrl'}
];
const SU={on:false,i:0};
const SU_PARTS=['diagonal','eyepiece','finder','handset'];
function setupGo(i){
  SU.on=true;SU.i=Math.max(0,Math.min(SETUP.length-1,i));const st=SETUP[SU.i];
  SU_PARTS.forEach(id=>hidden.add(id));                                // parts for later steps are not fitted yet
  SETUP.slice(0,SU.i+1).forEach(x=>(x.reveal||[]).forEach(id=>hidden.delete(id)));
  renderSetup();renderParts();
}
function setupShow(){const st=SETUP[SU.i];selectPart(st.part,st.sub||null,false);if(st.view)viewFrom(st.view);else focusPart(st.part);if(st.tab)tab(st.tab);}
function renderSetup(){
  const st=SETUP[SU.i];
  $('#p-setup').innerHTML=`<h2>Setup guide</h2><p class="mu sm">Follows the Celestron CPC Deluxe HD and EdgeHD manuals. Parts appear as you reach the step that installs them.</p>
  <div class="st"><div class="mu sm">Step ${SU.i+1} of ${SETUP.length}</div><h3 style="margin:4px 0">${st.t}</h3><div>${st.b}</div>${st.w?`<div class="wn">⚠ ${st.w}</div>`:''}
  ${SU.i===2?`<div style="margin-top:8px"><input type="range" id="triS" min="0" max="100" value="${Math.round(TRI.t*100)}" style="width:100%"><div class="mu sm" id="triT">${triTxt()}</div></div>`:''}
  <div class="row" style="margin-top:8px"><button class="b" data-su="prev">◀ Back</button><button class="b on" data-su="show">Show me</button><button class="b" data-su="next">Next ▶</button></div></div>
  <ol>${SETUP.map((x,i)=>`<li data-su="go${i}" class="${i===SU.i?'on':i<SU.i?'dn':''}">${x.t}</li>`).join('')}</ol>
  <div class="row"><button class="b" data-su="all">Finish – show all parts</button><button class="b" data-su="lab">Toggle labels</button></div>
  <h3>Labels key (manual Figure 3)</h3><div class="kk">1 Control panel · 2 Mirror lock knobs · 3 Star diagonal · 4 Hand control · 5 Eyepiece · 6 Finderscope · 7 Finder quick-release bracket · 8 Optical tube · 9 Schmidt corrector lens · 10 Altitude locking knob · 11 Carrying handle · 12 Azimuth locking knob · 13 Tripod · 14 Accessory tray / centre support bracket · 15 Focus knob</div>
  <div class="kk" style="columns:1;margin-top:6px">Panel ports: A hand control · B auxiliary (×2) · C PC interface · D auto-guider. On the right shoulder: E on/off switch · F 12 V input jack</div>`;
}
$('#p-setup').addEventListener('input',e=>{if(e.target.id==='triS'){setTripod(e.target.value/100);$('#triT').textContent=triTxt();}});
$('#p-setup').addEventListener('click',e=>{const b=e.target.closest('[data-su]');if(!b)return;const k=b.dataset.su;
  if(k==='prev')setupGo(SU.i-1);else if(k==='next'){setupGo(SU.i+1);setupShow();}else if(k==='show')setupShow();
  else if(k==='all'){SU_PARTS.forEach(id=>hidden.delete(id));renderParts();viewFrom('iso');}
  else if(k==='lab')$('#bLab').click();else if(k.startsWith('go')){setupGo(+k.slice(2));setupShow();}});

