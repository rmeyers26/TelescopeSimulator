/* Seestar S50 Pro Simulator – s50-model.js
   The "physics" and rules of the telescope: specifications (from the S50 Pro user manual), sky conditions,
   the power / indicator-light language, and the motorized mount's state machine. Nothing here draws anything.
   Classic script (not an ES module) so the page also works when opened straight from disk;
   it uses helpers from js/01-core-astro.js (D2R, clamp, wrap180, eqToHor, horToEq…) and the catalogs. */
'use strict';

/* =====================================================================
   1. SPECIFICATIONS  (S50 Pro user manual V1, section 1.4)
   ===================================================================== */
const S50={
  tele:{aperture:50,focal:260,fRatio:5.2,w:2160,h:3840,fovLong:2.8,sensor:'1/1.2" CMOS'},     // telephoto camera: portrait 2160 × 3840
  wide:{aperture:3.4,focal:6,fRatio:1.75,w:2160,h:3840,fovLong:63,sensor:'1/2" CMOS'},        // wide-angle camera
  storageGB:128,usableGB:100,batteryMAh:10000,batteryWh:36,hours:9,weightKg:2.8,
  slewMaxDegPerSec:1440*0.004178,                   // "Slew rate 1X – 1440X" of the sidereal rate (≈ 6°/s)
  tempRange:[-10,40],maxWindForce:3,minBattery:5
};
const ZP_TELE=1.5e6;      // "zero point": electrons per second collected from a magnitude-0 star by the 50 mm lens (model value)
/* A "camera" description used by the imaging code. The live view is drawn at a lower resolution than the real sensor:
   each display pixel covers bin × bin sensor pixels. */
function makeCam(name,spec,bin,zp){
  const nat=spec.fovLong*3600/spec.h;               // arcseconds per sensor pixel along the long side
  return {name,w:spec.w/bin,h:spec.h/bin,bin,nat,scale:nat*bin,deg:nat*bin/3600,zp,fovLong:spec.fovLong,fovShort:spec.w*nat/3600,aperture:spec.aperture};
}
const CAM={tele:makeCam('tele',S50.tele,6,ZP_TELE),wide:makeCam('wide',S50.wide,8,ZP_TELE*Math.pow(S50.wide.aperture/S50.tele.aperture,2))};
const PSF_SIGMA=0.6;      // blur of a star in tele display pixels (atmosphere + optics)
const EXTINCTION=0.22;    // magnitudes of dimming per airmass of atmosphere

/* =====================================================================
   2. SKY & WEATHER CONDITIONS (changed from the Sky tab)
   ===================================================================== */
const SKY={bortle:6,cloud:0,humidity:0.15,temp:15,wind:1,horizon:0};   // horizon = lowest sky altitude not hidden by trees/buildings
const BORTLE_SB=[0,21.99,21.89,21.69,21.25,20.49,19.5,19.0,18.5,18.0];  // mag per square arcsecond (bigger = darker)
const BORTLE_TXT=['','Pristine dark site','Truly dark site','Rural sky','Rural/suburban transition','Suburban sky','Bright suburban sky','Suburban/urban transition','City sky','Inner-city sky'];
const BEAUFORT=['Calm','Light air','Light breeze','Gentle breeze','Moderate breeze','Fresh breeze','Strong breeze','Near gale','Gale'];

/* Filters in the telephoto filter wheel (manual §1.4): UV/IR-cut, Duo-Band (OIII 30 nm / Hα 20 nm) and a Dark filter.
   bb = broadband light (stars, galaxies) passed, em = emission-nebula light passed, sky = background glow passed. */
const FILTERS={
  uvir:{name:'UV/IR-cut',bb:1,em:1,sky:1},
  duo:{name:'Duo-Band (OIII/Hα)',bb:0.10,em:0.85,sky:0.12},
  dark:{name:'Dark (closed)',bb:0,em:0,sky:0}      // blocks all light: used to record "dark frames" – pure sensor noise
};

function angDistHor(a1,z1,a2,z2){
  const c=Math.sin(a1*D2R)*Math.sin(a2*D2R)+Math.cos(a1*D2R)*Math.cos(a2*D2R)*Math.cos((z1-z2)*D2R);
  return Math.acos(clamp(c,-1,1))*R2D;
}
function moonGlare(az,alt){                           // 0 (none) … ~1 (full Moon nearby)
  const sep=angDistHor(alt,az,MOON.alt,MOON.az);
  return Math.pow(MOON.illum||0,2.2)*Math.max(0,Math.sin(MOON.alt*D2R))*Math.exp(-sep/40);
}
/* Background sky glow in electrons per second per display pixel of camera `cam` (before any filter). */
function skyRate(az,alt,cam){
  const unit=cam.zp*cam.scale*cam.scale;
  const twilight=SUN.alt>-18?Math.pow(10,-0.4*(21.5-(SUN.alt+18)*0.75)):0;           // the sky glows while the Sun is < 18° below the horizon
  return unit*(Math.pow(10,-0.4*BORTLE_SB[SKY.bortle])+Math.pow(10,-0.4*17.5)*moonGlare(az,alt)+twilight);
}
const skyMagPerArcsec2=(az,alt)=>-2.5*Math.log10(skyRate(az,alt,CAM.tele)/(CAM.tele.zp*CAM.tele.scale*CAM.tele.scale));
const airmass=alt=>1/Math.sin(Math.max(alt,3)*D2R);
function transparency(alt,dew){                       // fraction of light surviving atmosphere + clouds + dew on the lens
  return Math.pow(10,-0.4*EXTINCTION*airmass(alt))*(1-0.93*Math.pow(SKY.cloud,1.2))*(1-0.7*dew);
}
const READ_NOISE=1.2;                                  // electrons per sensor pixel (model value)

function parallacticFromEq(ra,dec,jd){                 // angle between "up" (zenith) and celestial north – drives field rotation
  const H=(lstDeg(jd)-ra)*D2R,d=dec*D2R,p=obs.lat*D2R;
  return Math.atan2(Math.sin(H),Math.tan(p)*Math.cos(d)-Math.sin(d)*Math.cos(H))*R2D;
}
function parallacticAngle(az,alt){const e=horToEq(alt,az,jdNow());return parallacticFromEq(e.ra,e.dec,jdNow());}

/* =====================================================================
   3. THE MOUNT
   ===================================================================== */
const INIT_STEPS=[
  {t:'Levelling itself (gravity sensor)',sec:3},
  {t:'Getting time & location from your phone',sec:1.6},
  {t:'Plate-solving the sky to find north',sec:4}
];
const BOOT_SEC=4;                                       // power-on light sequence
const TRACK_AZ_LIMIT=0.12;                              // fastest the azimuth motor can follow the sky (degrees per simulated second)
const ZERO_ALT=-85;                                     // "zero position": the lens is folded down out of the way
const JOG_SPEEDS={slow:8,medium:64,fast:360,max:1440};  // joystick speeds as multiples of the sidereal rate (manual: 1X – 1440X)

class SeestarMount{
  constructor(){
    this.serial=Array.from({length:6},()=>'0123456789ABCDEF'[Math.floor(Math.random()*16)]).join('');
    this.power='off';this.bootT=0;this.bootFail=0;this.battShow=0;this.lastShort=-1e9;
    // connection to the phone app
    this.link='none';this.paired=false;this.activated=false;this.fwOk=false;this.fwBusy=0;
    try{this.activated=localStorage.getItem('s50act')==='1';this.paired=this.activated;this.fwOk=this.activated;}catch(_){}
    this.firstUse=!this.activated;
    // pose
    this.az=0;this.alt=ZERO_ALT;this.parked=true;
    this.tilt={x:(Math.random()-.5)*7,z:(Math.random()-.5)*7};       // un-level until initialization
    this.initDone=false;this.initStep=0;this.initT=0;this.northErr=(Math.random()<.5?-1:1)*(6+Math.random()*10);   // hidden pointing error until north is found
    // motion
    this.target=null;this.mode='idle';this.centerT=0;this.parking=false;this.shutdownAfterPark=false;
    this.jog={az:0,alt:0,rate:0};this.sunStage=null;this.lagDeg=0;this._pAz=null;
    // mount type: 'altaz' (default) or 'eq' (on the EQ wedge)
    this.mountMode='altaz';this.eq={wedgeAlt:20,wedgeAz:9,legsOk:false,measured:null};
    // solar
    this.solarFilter=false;this.damaged=false;this.sunT=0;
    // power & environment
    this.battery=100;this.charger='none';this.dewHeater=false;this.dew=0;this.shake=0;this.note='';
  }
  get ready(){return this.power==='on'&&this.link==='connected';}
  get lensClear(){return !this.parked;}                  // true when the lens is out of the zero position
  get usable(){return this.ready&&!this.damaged;}

  /* ---------- power button (manual §1.6) ---------- */
  shortPress(nowMs){
    this.lastShort=nowMs;
    if(this.power==='off')this.battShow=3;               // short press while off shows the battery level
  }
  longPress(nowMs){                                      // hold 2 s
    if(this.power==='off'){
      if(this.firstUse&&nowMs-this.lastShort>8000)return {ok:false,msg:'First use: press the button briefly (1 s), then press and hold for 2 s.'};
      return this.powerOn();
    }
    this.shutdown();return {ok:true,msg:'Shutting down: the lens returns to the zero position first.'};
  }
  forceOff(){this.powerOffNow();this.note='Forced shutdown: the lens did NOT return to the zero position.';}
  powerOn(){
    if(this.power!=='off')return {ok:true};
    if(this.battery<=S50.minBattery){this.bootFail=3;return {ok:false,msg:'Boot failed: battery too low. Charge the S50 Pro first.'};}
    this.power='booting';this.bootT=0;this.link='none';this.note='';return {ok:true,msg:'Powering on…'};
  }
  powerOffNow(){this.power='off';this.link='none';this.mode='idle';this.target=null;this.jog={az:0,alt:0,rate:0};this.parking=false;this.shutdownAfterPark=false;this.sunStage=null;this.note='';}
  shutdown(){                                            // normal shutdown: go to the zero position, then switch off
    if(this.power==='off')return;
    if(this.parked){this.powerOffNow();return;}
    this.target=null;this.mode='slew';this.parking=true;this.shutdownAfterPark=true;this.note='Returning to the zero position…';
  }

  /* ---------- phone connection (manual §2.3–2.7) ---------- */
  disconnect(){if(this.link==='connected')this.link='none';}
  activate(){this.activated=true;this.paired=true;this.firstUse=false;try{localStorage.setItem('s50act','1');}catch(_){}}
  forgetActivation(){this.activated=this.paired=this.fwOk=false;this.firstUse=true;try{localStorage.removeItem('s50act');}catch(_){}}

  /* ---------- pointing commands ---------- */
  _wake(){this.parking=false;this.shutdownAfterPark=false;this.jog={az:0,alt:0,rate:0};}
  gotoObj(o){
    if(!this.ready)return {ok:false,reason:this.power!=='on'?'The telescope is off – hold the power button for 2 s.':'Connect the phone app first (Device tab).'};
    if(this.damaged)return {ok:false,reason:'The sensor is damaged.'};
    if(o.alt<3)return {ok:false,reason:`${o.name} is below the horizon right now (altitude ${o.alt.toFixed(0)}°).`};
    if(o.alt<SKY.horizon)return {ok:false,reason:`${o.name} is hidden behind trees/buildings (your horizon blocks everything below ${SKY.horizon}°).`};
    this._wake();this.target=o;this.mode='slew';this.note='Slewing…';this.sunStage=null;
    if(o.type==='sun'&&!this.solarFilter)this.sunStage='lift';   // safety: lift the lens, then wait for the solar filter
    if(o.type==='sun'&&this.solarFilter)this.sunStage='approach';
    return {ok:true};
  }
  confirmSolarFilter(){                                   // "Installed & Shooting"
    this.solarFilter=true;
    if(this.sunStage==='await'){this.sunStage='approach';this.mode='slew';this.note='Solar filter confirmed. Continuing to the Sun…';}
  }
  removeSolarFilter(){
    if(!this.solarFilter)return {ok:true};
    if(SUN.alt>0&&!this.parked&&angDistHor(this.alt,this.az,SUN.alt,SUN.az)<CAM.tele.fovLong*0.8)return {ok:false,msg:'The Sun is still in the telescope’s view. Move it out of view first, then remove the filter.'};
    this.solarFilter=false;this.sunStage=null;return {ok:true};
  }
  park(){if(!this.ready)return;this._wake();this.target=null;this.mode='slew';this.parking=true;this.note='Going to the zero position…';}
  stop(){if(['slew','init','center','manual'].includes(this.mode)){this.mode='idle';this.target=null;this.parking=false;this.shutdownAfterPark=false;this.sunStage=null;this.note='';}this.jog={az:0,alt:0,rate:0};}
  setJog(a,b,speedKey){
    if(!this.usable)return;
    if(a||b){
      if(this.parked){this.parked=false;this.alt=0;}
      this._wake();this.jog={az:a,alt:b,rate:JOG_SPEEDS[speedKey||'medium']*0.004178};this.mode='manual';
      if(!(this.target&&this.target.type==='sun')){this.target=null;this.sunStage=null;}
    }else{
      this.jog={az:0,alt:0,rate:0};
      if(this.mode==='manual'){
        this.mode='idle';
        // after aligning by hand on the Sun, follow it
        if(this.target&&this.target.type==='sun'&&this.solarFilter&&angDistHor(this.alt,this.az,SUN.alt,SUN.az)<CAM.tele.fovLong){this.mode='track';this.note='Tracking the Sun.';}
      }
    }
  }

  /* ---------- EQ mode (manual §2.8.3) ---------- */
  polarError(){return {az:this.eq.wedgeAz,alt:this.eq.wedgeAlt-obs.lat};}             // true errors in degrees (az = how far the tripod's north leg is off true north)
  calcPolarError(){const e=this.polarError();this.eq.measured={az:e.az+(Math.random()-.5)*.2,alt:e.alt+(Math.random()-.5)*.2};return this.eq.measured;}
  switchMountMode(m){
    if(m==='eq'&&!this.eq.legsOk)return {ok:false,msg:'Complete the set-up checklist first (legs extended, one leg to north, wedge fitted).'};
    this.mountMode=m;return {ok:true};
  }
  eqErrDeg(){const e=this.polarError();return Math.hypot(e.az,e.alt);}

  /* ---------- the indicator lights (manual §1.6 tables) ---------- */
  ledPattern(stacking){
    const batt=Math.round(this.battery);
    const lights=n=>[0,1,2,3].map(i=>i<n?'on':'off');
    let bl;                                                            // battery lights: 0–15 % = 1 blinking, 16–25 = 1, 26–50 = 2, 51–75 = 3, 76–100 = 4
    if(batt<=15){bl=['blink','off','off','off'];}else if(batt<=25)bl=lights(1);else if(batt<=50)bl=lights(2);else if(batt<=75)bl=lights(3);else bl=lights(4);
    const eq=this.mountMode==='eq',col=eq?[.2,1,.35]:[1,.78,.15],red=[1,.15,.1];
    if(this.bootFail>0)return {col:red,anim:'blink',batt:['blinkFast','blinkFast','blinkFast','blinkFast']};
    if(this.power==='off'){
      if(this.charger!=='none'){const f=Math.floor(performance.now()/500)%2,n=Math.ceil(batt/25),b=[0,1,2,3].map(i=>i<n-1?'on':i===n-1?(f?'on':'off'):'off');return {col:red,anim:'off',batt:batt>=99?lights(4):b};}
      return {col:[.9,.9,.9],anim:'off',batt:this.battShow>0?bl:['off','off','off','off']};
    }
    if(this.power==='booting')return {col:red,anim:'run',batt:bl};
    if(this.fwBusy>0)return {col:col,anim:'blinkFast',batt:bl};
    if(this.link!=='connected')return {col:red,anim:this.activated?'breath':'breathFast',batt:bl};        // not connected: slow breathing (not activated: rapid)
    if(this.mode==='lost')return {col:col,anim:'blink',batt:bl};                                          // abnormal: yellow blinks
    return {col:col,anim:stacking?'breath':'solid',batt:bl};                                              // connected: steady; live stacking: slow breathing
  }

  /* ---------- the clock tick ----------
     dt = real seconds, simDt = simulated seconds (bigger when "Time ×" is turned up). */
  update(dt,simDt){
    if(this.bootFail>0)this.bootFail-=dt;
    if(this.battShow>0)this.battShow-=dt;
    // ---- battery: 10000 mAh / 36 Wh, about 9 hours (manual) ----
    const cap=1-Math.max(0,(10-SKY.temp)*0.012);                         // cold lithium batteries deliver less
    const watts=this.power==='off'?0:(4+(this.dewHeater?1.2:0)+(this.mode==='slew'?1.5:0));
    const charge=this.charger==='fast'?36:this.charger==='normal'?10:0;
    this.battery=clamp(this.battery+simDt/3600*(charge-watts)/(S50.batteryWh*cap)*100,0,100);
    if(this.power!=='off'&&this.battery<S50.minBattery&&!this.shutdownAfterPark&&this.charger==='none'){this.shutdown();this.note='Battery below 5%: returning to the zero position and shutting down.';}
    if(this.power==='off')return;
    this.shake=Math.max(0,this.shake-simDt);
    if(this.fwBusy>0)this.fwBusy=Math.max(0,this.fwBusy-dt);
    // dew builds while the lens points at the sky on damp nights; the heater clears it
    const wet=SKY.humidity*(this.parked?0:1);
    this.dew=clamp(this.dew+simDt/3600*(this.dewHeater?-6:wet*1.3),0,1);

    if(this.power==='booting'){this.bootT+=dt;if(this.bootT>=BOOT_SEC){this.power='on';this.note='Powering on, ready for connection.';}return;}

    // ---- damage: pointing the telephoto lens at the Sun without the solar filter ----
    if(!this.damaged&&!this.parked&&!this.solarFilter&&SUN.alt>0&&angDistHor(this.alt,this.az,SUN.alt,SUN.az)<CAM.tele.fovLong*0.55){
      this.sunT+=simDt;if(this.sunT>3){this.damaged=true;this.mode='idle';this.note='⚠ The sensor was burned by sunlight. This damage is permanent!';}
    }else this.sunT=Math.max(0,this.sunT-simDt);

    if(this.mode==='manual'){
      const r=this.jog.rate*dt;
      this.az=norm360(this.az+this.jog.az*r);this.alt=clamp(this.alt+this.jog.alt*r,0,90);return;
    }
    // ---- slewing speed also follows the "Time ×" control so long moves stay quick at high time speeds ----
    const slewDt=dt*Math.max(1,simDt/Math.max(dt,1e-6)/10);
    let dest=null;
    if(this.parking)dest={az:this.az,alt:ZERO_ALT};
    else if(this.target){
      dest={az:this.target.az,alt:this.target.alt};
      if(!this.initDone&&this.target.type!=='point')dest.az=norm360(dest.az+this.northErr);   // until it finds north, GoTo lands a few degrees off
      if(this.target.type==='sun'&&this.sunStage==='lift')dest={az:this.az,alt:Math.min(this.target.alt,30)};
    }
    if(!dest)return;
    const dAz=wrap180(dest.az-this.az),dAlt=dest.alt-this.alt,dist=Math.hypot(dAz*Math.cos(Math.max(this.alt,0)*D2R),dAlt);
    this.lagDeg=dist;
    if(this.mode==='slew'){
      const rate=clamp(dist*2.2,0.5,S50.slewMaxDegPerSec);
      this._step(dAz,dAlt,rate*slewDt);
      if(this.alt>ZERO_ALT+1)this.parked=false;
      const sunNear='GoTo stops near the Sun for safety. Now fine-tune by hand: tap GO in the wide view or use the joystick on SLOW.';
      if(this.sunStage==='approach'&&this.target&&angDistHor(this.alt,this.az,this.target.alt,this.target.az)<4){this.mode='idle';this.sunStage=null;this.note=sunNear;return;}
      if(dist<0.03){
        if(this.parking){this.parked=true;this.mode='idle';this.parking=false;this.note='In the zero position.';if(this.shutdownAfterPark)this.powerOffNow();}
        else if(this.target&&this.target.type==='point'){this.mode='idle';this.note='Arrived. Tap GO again to refine, or use the joystick.';}
        else if(this.sunStage==='lift'&&this.solarFilter){this.sunStage='approach';this.note='Solar filter already fitted. Continuing to the Sun…';}
        else if(this.sunStage==='lift'){this.mode='idle';this.sunStage='await';this.note='⚠ Install the magnetic solar filter on the lens, then confirm “Installed & Shooting”.';}
        else if(this.target&&this.target.type==='sun'){this.mode='idle';this.sunStage=null;this.note=sunNear;}
        else if(!this.initDone&&this.target){this.mode='init';this.initStep=0;this.initT=0;this.note='Initializing (first GoTo after power-on)…';}
        else{this.mode='center';this.centerT=0;this._pAz=null;this.note='Centring: taking a photo and plate-solving…';}
      }
    }else if(this.mode==='init'){
      this._step(dAz,dAlt,S50.slewMaxDegPerSec*slewDt);
      const st=INIT_STEPS[this.initStep];this.initT+=dt;
      if(this.initStep===0){const k=Math.exp(-dt*1.5);this.tilt={x:this.tilt.x*k,z:this.tilt.z*k};}
      if(this.initStep===2&&this.initT>st.sec){                       // plate solving needs stars
        if(SKY.cloud>0.75){this.note='Too cloudy to plate-solve – waiting for a gap…';return;}
        if(SUN.alt>-3){this.note='Daylight: no stars to plate-solve. Pointing stays approximate.';this.tilt={x:0,z:0};this.mode='center';this.centerT=0;return;}
      }
      if(this.initT>=st.sec){this.initStep++;this.initT=0;
        if(this.initStep>=INIT_STEPS.length){this.initDone=true;this.tilt={x:0,z:0};this.mode='center';this.centerT=0;this._pAz=null;this.note='Initialization complete. Centring…';}}
    }else if(this.mode==='center'){
      this.centerT+=dt;this._step(dAz,dAlt,S50.slewMaxDegPerSec*slewDt);
      if(this.centerT>=2.2){this.mode='track';this.note=`Tracking ${this.target.name}.`;}
    }else if(this.mode==='track'||this.mode==='lost'){
      const tAz=this.target.az,azRate=(this._pAz!=null&&simDt>0)?Math.abs(wrap180(tAz-this._pAz))/simDt:0;this._pAz=tAz;
      this._step(dAz,dAlt,S50.slewMaxDegPerSec*dt);
      if(this.target.alt<1){this.mode='lost';this.note=`${this.target.name} has set below the horizon.`;}
      else if(this.mountMode==='altaz'&&azRate>TRACK_AZ_LIMIT){this.mode='lost';this.note=`Lost ${this.target.name}: it is crossing near the zenith, where an alt-az mount cannot turn fast enough. (EQ mode has no such blind spot.)`;}
      else if(this.mode==='lost'&&dist<0.05&&(this.mountMode==='eq'||azRate<TRACK_AZ_LIMIT*.8)){this.mode='track';this.note=`Tracking ${this.target.name}.`;}
    }
  }
  _step(dAz,dAlt,maxMove){
    const m=Math.max(Math.abs(dAz),Math.abs(dAlt),1e-9),f=Math.min(1,maxMove/m);
    this.az=norm360(this.az+dAz*f);this.alt=clamp(this.alt+dAlt*f,ZERO_ALT,90);
  }
}
