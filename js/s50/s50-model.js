/* Seestar S50 Simulator – s50-model.js
   The "physics" of the telescope: specifications, sky conditions, and the motorized mount.
   Nothing in this file draws anything – it only holds numbers and rules, so it is easy to test.
   Classic script (not an ES module) so the page also works when opened straight from disk;
   it uses helpers from js/01-core-astro.js (D2R, clamp, wrap180, eqToHor, horToEq…) and the catalogs. */
'use strict';

/* =====================================================================
   1. SPECIFICATIONS  (approximate values from the manufacturer's published specs)
   ===================================================================== */
const S50={
  apertureMm:50, focalMm:250,          // a 50 mm lens with 250 mm focal length → f/5
  pixelUm:2.9, w:1920, h:1080          // Sony IMX462 colour sensor, 2.9 µm pixels
};
S50.scale=S50.pixelUm/S50.focalMm*206.265;          // arcseconds of sky per sensor pixel (≈2.39″)
S50.fovW=S50.w*S50.scale/3600;                      // field of view in degrees (≈1.27° × 0.72°)
S50.fovH=S50.h*S50.scale/3600;

/* The live view is drawn at a lower resolution than the real sensor so the browser can keep up:
   each "display pixel" covers bin × bin sensor pixels. */
const IMG={w:384,h:216,bin:5};
IMG.scale=S50.scale*IMG.bin;                        // arcseconds per display pixel (≈12″)
IMG.deg=IMG.scale/3600;                             // degrees per display pixel

const ZP=1.5e6;          // "zero point": electrons per second collected from a magnitude-0 star (50 mm lens, after losses)
const PSF_SIGMA=0.75;    // blur of a star in display pixels (atmosphere + optics)
const EXTINCTION=0.22;   // magnitudes of dimming per airmass of atmosphere

/* =====================================================================
   2. SKY CONDITIONS (changed from the Sky tab)
   ===================================================================== */
const SKY={bortle:6,cloud:0,humidity:0.15};          // Bortle 1 = pristine dark … 9 = inner city; cloud/humidity 0–1
// Brightness of the empty sky (magnitudes per square arcsecond; BIGGER number = DARKER sky), indexed by Bortle class
const BORTLE_SB=[0,21.99,21.89,21.69,21.25,20.49,19.5,19.0,18.5,18.0];
const BORTLE_TXT=['','Pristine dark site','Truly dark site','Rural sky','Rural/suburban transition','Suburban sky','Bright suburban sky','Suburban/urban transition','City sky','Inner-city sky'];

/* Filters built into the S50's filter wheel.
   bb = how much broadband light (stars, galaxies) gets through, em = emission-nebula light (Hα/OIII), sky = background glow. */
const FILTERS={
  ircut:{name:'IR-cut (broadband)',bb:1,em:1,sky:1},
  lp:{name:'Dual-band light-pollution',bb:0.10,em:0.85,sky:0.08}
};

function angDistHor(a1,z1,a2,z2){                    // angle between two alt/az directions (degrees)
  const c=Math.sin(a1*D2R)*Math.sin(a2*D2R)+Math.cos(a1*D2R)*Math.cos(a2*D2R)*Math.cos((z1-z2)*D2R);
  return Math.acos(clamp(c,-1,1))*R2D;
}
/* Moonlight adds glow to the sky: more when the Moon is full, high up, and close to where you are pointing. */
function moonGlare(az,alt){
  const sep=angDistHor(alt,az,MOON.alt,MOON.az);
  return Math.pow(MOON.illum||0,2.2)*Math.max(0,Math.sin(MOON.alt*D2R))*Math.exp(-sep/40);   // 0 (none) … ~1 (full Moon nearby)
}
/* Background sky glow in electrons per second per display pixel (before any filter). */
function skyRate(az,alt){
  const unit=ZP*IMG.scale*IMG.scale;                // flux of a "magnitude 0 per square arcsecond" sky patch, per display pixel
  // Twilight: while the Sun is less than 18° below the horizon the whole sky glows (SB gets brighter by ~0.75 mag per degree)
  const twilight=SUN.alt>-18?Math.pow(10,-0.4*(21.5-(SUN.alt+18)*0.75)):0;
  return unit*(Math.pow(10,-0.4*BORTLE_SB[SKY.bortle])+Math.pow(10,-0.4*17.5)*moonGlare(az,alt)+twilight);
}
/* The sky brightness an observer would measure (mag/arcsec²) – shown in the Sky tab. */
function skyMagPerArcsec2(az,alt){return -2.5*Math.log10(skyRate(az,alt)/(ZP*IMG.scale*IMG.scale));}
const airmass=alt=>1/Math.sin(Math.max(alt,3)*D2R);  // how much atmosphere the light crosses (1 = straight up)
/* Fraction of light that survives atmosphere + clouds + dew on the lens */
function transparency(alt,dew){
  return Math.pow(10,-0.4*EXTINCTION*airmass(alt))*(1-0.93*Math.pow(SKY.cloud,1.2))*(1-0.7*dew);
}
/* Read noise of the sensor in electrons: higher gain → lower read noise (but less dynamic range). */
const readNoise=gain=>3.0*Math.exp(-gain/45)+0.7;

/* Angle between "up" (towards the zenith) and celestial north at the pointing direction, in degrees.
   This is the "parallactic angle". As it changes, the picture rotates – that is field rotation. */
function parallacticFromEq(ra,dec,jd){
  const H=(lstDeg(jd)-ra)*D2R,d=dec*D2R,p=obs.lat*D2R;
  return Math.atan2(Math.sin(H),Math.tan(p)*Math.cos(d)-Math.sin(d)*Math.cos(H))*R2D;
}
function parallacticAngle(az,alt){const e=horToEq(alt,az,jdNow());return parallacticFromEq(e.ra,e.dec,jdNow());}

/* =====================================================================
   3. THE MOUNT  – a small state machine
   Real Seestar start-up: power on → open arm → level itself with a gravity sensor →
   get time & place from the phone → take pictures and "plate-solve" them to learn where north is.
   After that GoTo just works – no manual alignment like the C11.
   ===================================================================== */
const BOOT_STEPS=[
  {t:'Starting up',sec:2},
  {t:'Opening the arm cover',sec:2.4},
  {t:'Levelling itself (gravity sensor)',sec:3},
  {t:'Getting time & location from your phone',sec:1.6},
  {t:'Plate-solving the sky to find north',sec:4}
];
const MAX_SLEW=15;                                  // slewing speed, degrees per real second, each axis
const TRACK_AZ_LIMIT=0.12;                          // the fastest the azimuth motor can follow the sky while tracking (degrees per simulated second)

class SeestarMount{
  constructor(){
    this.power='off';          // 'off' | 'booting' | 'ready'
    this.step=-1; this.stepT=0;
    this.az=0; this.alt=0;     // where the tube really points (degrees)
    this.tilt={x:(Math.random()-.5)*7,z:(Math.random()-.5)*7};   // how un-level the table/tripod is until it self-levels
    this.cover=0; this.coverTarget=0;               // arm cover: 0 closed … 1 open
    this.target=null;          // catalog object we are following
    this.mode='idle';          // 'idle' | 'slew' | 'center' | 'track' | 'lost' | 'manual'
    this.centerT=0; this.parking=false;
    this.jog={az:0,alt:0};
    this.battery=100; this.ext=false; this.dewHeater=false; this.dew=0;   // dew = fog on the lens, 0…1
    this.note='';              // short message for the live view
    this.lagDeg=0;
  }
  get ready(){return this.power==='ready';}
  get coverOpen(){return this.cover>0.95;}

  powerOn(){if(this.power!=='off')return;this.power='booting';this.step=0;this.stepT=0;this.coverTarget=0;this.note='';}
  powerOff(){this.power='off';this.step=-1;this.mode='idle';this.target=null;this.coverTarget=0;this.jog={az:0,alt:0};this.note='';}
  skipBoot(){                                       // jump straight to "ready" (handy for scenarios)
    if(this.power==='off')this.power='booting';
    this.step=BOOT_STEPS.length;this.tilt={x:0,z:0};this.coverTarget=1;this.cover=1;this.power='ready';this.mode='idle';
  }

  /* Ask for a GoTo. Returns {ok,reason}. The mount slews, then "centres" (takes a photo, plate-solves, fine-corrects), then tracks. */
  gotoObj(o){
    if(!this.ready)return {ok:false,reason:'The telescope is not ready yet – power it on and wait for start-up to finish.'};
    if(o.alt<3)return {ok:false,reason:`${o.name} is below the horizon right now (altitude ${o.alt.toFixed(0)}°).`};
    this.target=o;this.mode='slew';this.coverTarget=1;this.parking=false;this.jog={az:0,alt:0};this.note='Slewing…';
    return {ok:true};
  }
  park(){if(!this.ready)return;this.target=null;this.mode='slew';this.parking=true;this.coverTarget=0;this.note='Parking…';}
  stop(){if(this.mode==='slew'||this.mode==='center'||this.mode==='manual'){this.mode='idle';this.target=null;this.note='';}this.jog={az:0,alt:0};}
  setJog(a,b){if(!this.ready)return;this.jog={az:a,alt:b};if(a||b){this.mode='manual';this.target=null;this.coverTarget=1;this.parking=false;}else if(this.mode==='manual')this.mode='idle';}

  /* Advance the machine by dt real seconds.  simDt = simulated seconds (bigger when "Time ×" is turned up). */
  update(dt,simDt){
    // arm cover motor
    this.cover+=clamp(this.coverTarget-this.cover,-dt/1.8,dt/1.8);
    if(this.power==='off')return;

    // ---- battery & dew run on simulated time ----
    if(!this.ext)this.battery-=simDt/3600*(100/6)*(1+(this.dewHeater?0.25:0)+(this.mode==='slew'?0.4:0));
    if(this.battery<=0){this.battery=0;this.powerOff();this.note='Battery flat – the telescope shut down.';return;}
    const wet=SKY.humidity*(this.cover>0.5?1:0);    // dew only forms while the lens is uncovered
    this.dew=clamp(this.dew+simDt/3600*(this.dewHeater?-6:wet*1.3),0,1);

    // ---- start-up ----
    if(this.power==='booting'){
      const st=BOOT_STEPS[this.step];this.stepT+=dt;
      if(this.step===1)this.coverTarget=1;
      if(this.step===2){const k=1-clamp(this.stepT/st.sec,0,1);this.tilt={x:this.tilt.x*(1-dt*1.5),z:this.tilt.z*(1-dt*1.5)};if(k<=0)this.tilt={x:0,z:0};}
      if(this.step===4&&(SKY.cloud>0.75||this.cover<0.95)){this.note=this.cover<0.95?'Waiting for the arm to open…':'Too cloudy to plate-solve – waiting for a gap…';return;}   // needs stars!
      if(this.stepT>=st.sec){this.step++;this.stepT=0;if(this.step>=BOOT_STEPS.length){this.power='ready';this.mode='idle';this.note='Ready. Choose a target in the Plan tab.';this.tilt={x:0,z:0};}}
      return;
    }

    // ---- moving (ready) ----
    if(this.mode==='manual'){
      const r=2.5;this.az=norm360(this.az+this.jog.az*r*dt);this.alt=clamp(this.alt+this.jog.alt*r*dt,0,90);return;
    }
    let dest=null;
    if(this.parking)dest={az:this.az,alt:0};
    else if(this.target)dest={az:this.target.az,alt:this.target.alt};
    if(!dest){return;}
    const dAz=wrap180(dest.az-this.az),dAlt=dest.alt-this.alt,dist=Math.hypot(dAz*Math.cos(this.alt*D2R),dAlt);
    this.lagDeg=dist;
    if(this.mode==='slew'){
      const rate=clamp(dist*2.2,0.5,MAX_SLEW);      // slow down as we arrive
      this._step(dAz,dAlt,rate*dt);
      if(dist<0.03){
        if(this.parking){this.mode='idle';this.parking=false;this.note='Parked.';}
        else{this.mode='center';this.centerT=0;this._pAz=null;this.note='Centring: taking a photo and plate-solving…';}
      }
    }else if(this.mode==='center'){
      this.centerT+=dt;this._step(dAz,dAlt,MAX_SLEW*dt);
      if(this.centerT>=2.2){this.mode='track';this.note=`Tracking ${this.target.name}.`;}
    }else if(this.mode==='track'||this.mode==='lost'){
      // An alt-az mount follows the sky with BOTH motors. Straight overhead the azimuth motor would have to spin
      // faster and faster – near the zenith it hits its speed limit, falls behind and loses the target.
      // (A famous blind spot of alt-az mounts.)  We measure how fast the target's azimuth is changing per simulated second.
      const tAz=this.target.az,azRate=(this._pAz!=null&&simDt>0)?Math.abs(wrap180(tAz-this._pAz))/simDt:0;this._pAz=tAz;
      this._step(dAz,dAlt,MAX_SLEW*dt);
      if(this.target.alt<1){this.mode='lost';this.note=`${this.target.name} has set below the horizon.`;}
      else if(azRate>TRACK_AZ_LIMIT){this.mode='lost';this.note=`Lost ${this.target.name}: it is crossing near the zenith, where the azimuth motor cannot turn fast enough.`;}
      else if(this.mode==='lost'&&dist<0.05&&azRate<TRACK_AZ_LIMIT*.8){this.mode='track';this.note=`Tracking ${this.target.name}.`;}
    }
  }
  _step(dAz,dAlt,maxMove){                          // move both axes towards the destination, never faster than maxMove degrees
    const m=Math.max(Math.abs(dAz),Math.abs(dAlt),1e-9),f=Math.min(1,maxMove/m);
    this.az=norm360(this.az+dAz*f);this.alt=clamp(this.alt+dAlt*f,0,90);
  }
}
