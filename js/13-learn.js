/* Telescope Simulator – 13-learn.js
   Classic script (not an ES module) so the page also works when opened straight from disk.
   All files share one global scope and must load in numeric order (see index.html). */
'use strict';
/* =====================================================================
   11. LEARN MODE
   ===================================================================== */
const LESSONS=[
{t:'⭐ Follow the light (how the telescope works)',kid:true,s:[
 {c:true,v:'light',ph:[0,1],pf:.45,text:'Light from Saturn travels for more than an hour to reach us. Watch the yellow dot: it comes in through the thin glass window at the front of the tube.'},
 {c:true,v:'light',ph:[0,1],s:'primary',text:'The light travels all the way to the BIG curved mirror at the back. The mirror is like a giant bowl that catches the light and squeezes it together.'},
 {c:true,v:'light',ph:[1,2],s:'secondary',text:'The big mirror bounces the light forward to a SMALL mirror stuck on the front glass.'},
 {c:true,v:'light',ph:[2,3],s:'diagonal',text:'The small mirror sends the light back down the tube, through a hole in the middle of the big mirror, into the diagonal. Its mirror turns the light sideways.'},
 {c:true,v:'light',ph:[3,4],s:'eyepiece',ep:4,tab:'ctrl',text:'Finally the light goes into the eyepiece, which works like a magnifying glass for your eye. Folding the light back and forth lets a long telescope fit in a short tube! Look at the eyepiece view in the Control tab.'}]},
{t:'How a Schmidt-Cassegrain works',s:[
 {v:'front',s:'corrector',x:0,c:false,text:'Light from a star enters the front of the C11 through the corrector plate. This thin glass plate seals the tube and fixes the spherical error of the main mirror.'},
 {c:true,o:true,s:'primary',text:'Light travels to the back of the tube and reflects from the large concave primary mirror (about f/2, 559 mm focal length). It would focus in front of the primary, but the secondary intercepts it first.'},
 {s:'secondary',text:'The small convex secondary mirror, mounted on the corrector, reflects the beam back down the tube. It lengthens the focal length by about 5×: f/2 becomes f/10, so 2800 mm.'},
 {s:'baffle',text:'The beam passes through a hole in the primary and the baffle tube, which also stops stray light.'},
 {s:'diagonal',text:'A diagonal turns the beam 90° to the eyepiece. The focus point sits in the diagonal barrel (green dot). The long light path folded into a short tube is the point of the design.'}]},
{t:'How the C11 forms an image',s:[
 {tab:'sky',ep:2,text:'The telescope focal length is 2800 mm. The image scale at the focal plane is about 206265 ÷ 2800 ≈ 73.7 arcseconds per millimetre.'},
 {ep:2,text:'Magnification = 2800 ÷ eyepiece focal length. With the 25 mm eyepiece: 112×. True field = apparent field ÷ magnification: about 0.46° here.'},
 {ep:4,text:'Switch to the 9 mm: 311×, field about 0.26°. Higher power shows more detail only if the sky is steady and the optics are cooled and collimated.'},
 {ep:0,text:'The finder has a 5° field, which is why you find an object with it first, then switch to a higher-power eyepiece.'},
 {text:'Exit pupil = eyepiece focal length ÷ f-ratio: 25 mm / 10 = 2.5 mm. A practical upper magnification is roughly 2× the aperture in mm (about 560×), and usually less.'}]},
{t:'Set up and align',s:[
 {s:'tripod',text:'Set the tripod on firm ground and make it level; shorten the legs for stability. This simulator uses a computerised alt-azimuth fork mount.'},
 {s:'fork',x:.6,text:'The OTA sits on its pivots in the fork (two arms here; try the 1 arm button for the alternative). On a real mount, follow the manual for attaching and balancing the tube and using the clutches.'},
 {x:0,s:'diagonal',text:'Add the visual back, diagonal and eyepiece (try the Explode slider to see the order they go on).'},
 {tab:'ctrl',f:'align',text:'On the hand controller press ALIGN and choose Two-Star Align. The simulator hides a small set-up error, like a real mount that is not perfectly level or north-aligned.'},
 {text:'Pick a bright star. The scope slews near it but misses by a few degrees. Use the arrows (and the Sky tab chart or finder view) to centre the star, then press ENTER. Repeat for a second star at least 40° away.'},
 {text:'When alignment succeeds, GoTo objects land close to centre. Compare orange (truth) and green dashed (what the mount believes) markers in the Sky chart to see what alignment does.'}]},
{t:'Using the hand controller',s:[
 {tab:'ctrl',f:'menu',text:'MENU gives access to tracking mode, home, park, time speed and clearing alignment.'},
 {f:'stars',text:'STARS, PLANETS and DEEP SKY open object lists. Use the scroll keys to move through a list, ENTER to select, then ENTER again to GoTo.'},
 {f:'5',text:'Number keys 1–9 set slew speed, from fine centring (1–3) to fast slews (7–9). The LCD shows the rate in degrees per second.'},
 {f:'undo',text:'UNDO steps back or stops a slew. ENTER confirms. Arrow keys slew the scope in altitude (▲▼) and azimuth (◀▶).'},
 {f:'park',text:'HOME slews to the home position; PARK sends the scope home and disables motion until you press a key.'}]},
{t:'GoTo and tracking',s:[
 {tab:'sky',text:'GoTo converts an object’s RA/Dec to altitude/azimuth for the current time and place, then moves both axes to those angles. A good alignment makes the conversion accurate.'},
 {text:'Tracking keeps the object steady: as the Earth turns, an alt-az mount must move both axes continuously. Sidereal rate follows the stars; lunar and solar rates follow the Moon and Sun, which move slowly relative to the stars.'},
 {text:'Try it: select the Moon, press GoTo, then set tracking to Sidereal and speed to 60×. The Moon drifts east relative to the stars at about 0.55° per hour. Switch to Lunar to hold it still.'},
 {text:'Note for alt-az mounts: the field slowly rotates around the object; long camera exposures need a derotator or an equatorial wedge.'}]},
{t:'Basic maintenance and collimation',s:[
 {s:'corrector',text:'Keep the corrector clean and dry. Use a blower first and avoid wiping. Do not take the scope apart: the primary mirror and cell are factory set.'},
 {s:'secondary',text:'Collimation means aligning the optical axis. On an SCT only the secondary is adjusted, using its three screws. Allow the scope to cool, centre a bright star at about 200–300×, and defocus slightly.'},
 {text:'If the defocused star looks lopsided, adjust a screw about 1/8 turn at a time, re-centre the star, and repeat until the rings are concentric. Always re-check at the end.'},
 {s:'focuser',text:'The focus knob moves the primary mirror. Finish each focus move in the same direction to reduce backlash and image shift.'},
 {s:'dew',text:'Dew is a main nuisance: use a dew shield (use the eye icon in Parts) and a heater strap in humid conditions. Cap the optics when finished.'}]},
{t:'⭐ Find the North Star (Big Dipper trick)',kid:true,s:[
 {look:'north',dip:true,text:'You are now standing behind the telescope, facing north. The blue lines join the stars of the Big Dipper, a group of 7 bright stars shaped like a ladle or saucepan. Drag to look around if you cannot see it.'},
 {look:'north',dip:true,text:'Find the two stars at the end of the Dipper’s bowl, Merak and Dubhe. They are called the pointer stars. The orange dashed line starts at Dubhe.'},
 {look:'north',dip:true,text:'Follow the pointers out of the bowl about 5 times the gap between them. You land on a fairly bright star sitting on its own: Polaris, the North Star. It is the end of the Little Dipper’s handle.'},
 {tab:'sky',dip:true,text:'The Sky tab shows the same trick on a map of the whole sky (north at the top). Watch with the clock sped up: every star circles around Polaris, but Polaris hardly moves, because Earth’s axis points almost straight at it.'},
 {go:'Polaris',ep:1,tab:'ctrl',text:'Now the telescope goes to Polaris. Look at the eyepiece view: through the C11 it is just a bright point, because stars are so far away. Its height above the horizon equals your latitude, which is why sailors used it to find their way.'}]}
];
const L={lesson:null,step:0};
function renderLearn(){                           // lesson list lives in the Learn tab; the running step floats over the 3D view
  $('#p-learn').innerHTML='<h2>Guided learning</h2>'+(edu.on?'<p class="mu">Education mode shows the beginner lessons. Turn it off to see all lessons.</p>':'')+'<div class="row ezrow"><button class="b on" data-ux="night">🌙 My First Night</button><button class="b" data-ux="tour">🧭 Quick tour</button></div><div class="row ezrow"><button class="b on" data-ezalign="planet">🎯 Easy align: 1 planet</button><button class="b on" data-ezalign="stars">⭐ Easy align: 3 stars</button></div>'+'<p class="mu">Short interactive tutorials. Each step moves the camera, selects parts or highlights controls for you, and the step text appears over the 3D view so you can keep other tabs open.</p>'+LESSONS.map((l,i)=>[l,i]).filter(([l])=>!edu.on||l.kid).map(([l,i],j)=>`<div class="pl${L.lesson===i?' on':''}" data-l="${i}"><span style="flex:1"><b>${j+1}. ${l.t}</b><br><span class="sm mu">${l.s.length} steps</span></span><span class="mu">›</span></div>`).join('');
  const c=$('#lcard');if(L.lesson===null){c.style.display='none';photon.on=false;return;}
  const ls=LESSONS[L.lesson],st=ls.s[L.step];
  c.innerHTML=`<div class="row" style="margin-top:0"><b>${ls.t}</b><span class="mu sm" style="flex:1">step ${L.step+1}/${ls.s.length}</span><button class="b sm" data-n="menu">✕</button></div><div>${st.text}</div><div class="row"><button class="b" data-n="prev"${L.step?'':' disabled'}>Back</button><button class="b on" data-n="next">${L.step<ls.s.length-1?'Next':'Finish'}</button></div>`;
  c.style.display='block';
}
function doStep(st){
  if(st.c!==undefined&&st.c!==cut.on)setCut(st.c);
  if(st.o!==undefined){optics.on=st.o;$('#bOpt').classList.toggle('on',optics.on);}
  if(st.x!==undefined){exp.target=st.x;$('#exp').value=st.x;}
  if(st.v)viewFrom(st.v);
  if(st.s){hidden.delete(st.s);selectPart(st.s,null,false);}
  if(st.ep!==undefined)setEp(st.ep);
  if(st.f)flash(st.f);
  if(st.ph){photon.on=true;photon.a=st.ph[0];photon.b=st.ph[1];photon.t=0;}else photon.on=false;
  if(st.dip){guide.on=true;$('#bDip').classList.add('on');}
  if(st.look==='north'){setMode('walk');const pl=starById('Polaris'),mz=starById('Megrez'),az=wrap180(wrap180(pl.az)+wrap180(wrap180(mz.az)-wrap180(pl.az))/2);   // aim between the Big Dipper and Polaris
    cam.px=0;cam.pz=2.6;cam.py=1.6;cam.wyaw=-az*D2R;cam.wpitch=clamp(((pl.alt+Math.max(mz.alt,2))/2)*D2R,.05,1.2);camera.fov=70;camera.updateProjectionMatrix();}
  if(st.go){const o=starById(st.go);if(o)doGoto(o);}
  if(st.tab&&st.tab!==curTab)tab(st.tab);
}
function learnClick(e){
  const l=e.target.closest('[data-l]'),n=e.target.closest('[data-n]');
  if(l){L.lesson=+l.dataset.l;L.step=0;renderLearn();doStep(LESSONS[L.lesson].s[0]);return;}
  if(!n)return;const k=n.dataset.n,ls=L.lesson!==null?LESSONS[L.lesson]:null;
  if(k==='menu'){L.lesson=null;renderLearn();}
  else if(k==='prev'&&L.step>0){L.step--;renderLearn();doStep(ls.s[L.step]);}
  else if(k==='next'){if(L.step<ls.s.length-1){L.step++;renderLearn();doStep(ls.s[L.step]);}else{L.lesson=null;renderLearn();toast('Lesson complete.');}}
}
$('#p-learn').addEventListener('click',learnClick);$('#lcard').addEventListener('click',learnClick);
renderLearn();

