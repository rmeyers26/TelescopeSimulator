/* Telescope Simulator – 03-driver.js
   Classic script (not an ES module) so the page also works when opened straight from disk.
   All files share one global scope and must load in numeric order (see index.html). */
'use strict';
/* =====================================================================
   3. TELESCOPE DRIVER LAYER
   The UI only talks to `driver`. SimDriver is the simulator. A real driver
   (NexStar serial / CPWI / ASCOM / INDI bridge) would implement the same API.
   ===================================================================== */
const SLEW_RATES=[0,0.0021,0.0084,0.03,0.08,0.17,0.3,0.5,1.5,3.5];   // deg/s for keys 1..9 (simulated)
const TRK_RATE={off:0,sidereal:0,lunar:0.549,solar:0.0411};           // eastward drift vs stars, deg/hour
class TelescopeDriver{                       // ---- interface ----
  get kind(){return 'abstract';}
  state(){throw new Error('not implemented');}          // reported position, tracking, slewing...
  gotoRaDec(ra,dec){throw new Error('not implemented');}// -> {ok,reason}
  setManual(azDir,altDir,rateDegPerSec){}               // variable-rate slew (NexStar 'P' command)
  stop(){}  home(){}  park(){}  unpark(){}
  setTracking(mode){}                                   // 'off'|'sidereal'|'lunar'|'solar'
  addAlignPoint(o){}  clearAlign(){}
  update(dt){}
}
class SimDriver extends TelescopeDriver{
  constructor(){
    super();
    // `err` is the (hidden) real-world orientation error of a freshly set-up mount: not levelled, north not exact.
    this.s={enc:{az:0,alt:0},err:{az:(Math.random()<.5?-1:1)*(1.5+Math.random()*2.5),alt:(Math.random()-.5)*2},corr:{az:0,alt:0},
            man:{az:0,alt:0},manRate:0.1,goto:null,moving:false,tracking:'off',lock:null,parked:false,align:[],slewMax:5,onArrive:null};
  }
  get kind(){return 'simulated';}
  truth(){const s=this.s;return {az:norm360(s.enc.az+s.err.az),alt:s.enc.alt+s.err.alt};}     // where the tube really points
  reported(){const s=this.s;return {az:norm360(s.enc.az+s.corr.az),alt:s.enc.alt+s.corr.alt};}// where the mount believes it points
  state(){
    const s=this.s,r=this.reported(),t=this.truth(),jd=jdNow(),re=horToEq(r.alt,r.az,jd),te=horToEq(t.alt,t.az,jd);
    return {az:r.az,alt:r.alt,ra:re.ra,dec:re.dec,truth:{az:t.az,alt:t.alt,ra:te.ra,dec:te.dec},tracking:s.tracking,slewing:!!s.goto,moving:s.moving||!!s.goto,aligned:s.align.length,parked:s.parked};
  }
  gotoRaDec(ra,dec){
    const s=this.s;if(s.parked)this.unpark();
    const h=eqToHor(ra,dec,jdNow());if(h.alt-s.corr.alt<0)return {ok:false,reason:'below horizon'};
    s.goto={ra,dec};s.lock=null;return {ok:true};
  }
  setManual(az,alt,rate){const s=this.s;s.man.az=az;s.man.alt=alt;s.manRate=rate;if((az||alt)&&s.parked)this.unpark();}
  stop(){const s=this.s;if(s.goto||s.moving){s.goto=null;s.onArrive=null;s.moving=false;this._relock();}}
  home(park){const s=this.s;if(s.parked)s.parked=false;s.goto={enc:{az:0,alt:0},park:!!park};s.lock=null;s.onArrive=null;}
  park(){this.home(true);}
  unpark(){this.s.parked=false;}
  setTracking(m){this.s.tracking=m;if(m!=='off')this._relock();}
  _relock(){const s=this.s,r=this.reported(),e=horToEq(r.alt,r.az,jdNow());s.lock={ra:e.ra,dec:e.dec,t:simMs};}
  addAlignPoint(o){                          // user has centred star `o`; learn the offset between encoders and sky
    const s=this.s,m={az:wrap180(o.az-s.enc.az),alt:o.alt-s.enc.alt};s.align.push(m);
    s.corr={az:s.align.reduce((a,b)=>a+b.az,0)/s.align.length,alt:s.align.reduce((a,b)=>a+b.alt,0)/s.align.length};
    return s.align.length;
  }
  clearAlign(){this.s.align=[];this.s.corr={az:0,alt:0};}
  autoAlign(){                               // plate-solve: the camera recovers the true pointing, with a few arc-minutes of residual
    const s=this.s,t=this.truth(),m={az:wrap180(t.az-s.enc.az)+(Math.random()-.5)*.06,alt:t.alt-s.enc.alt+(Math.random()-.5)*.06};
    s.align=[m,m,m];s.corr={az:m.az,alt:m.alt};return 3;
  }
  update(dt){
    const s=this.s,jd=jdNow(),manual=(Math.abs(s.man.az)>.01||Math.abs(s.man.alt)>.01)&&!s.parked;
    if(manual){s.goto=null;s.moving=true;s.lock=null;
      s.enc.az=norm360(s.enc.az+s.man.az*s.manRate*dt);s.enc.alt=clamp(s.enc.alt+s.man.alt*s.manRate*dt,0,90);}
    else if(s.goto){
      let tAz,tAlt;
      if(s.goto.enc){tAz=s.goto.enc.az;tAlt=s.goto.enc.alt;}
      else{const h=eqToHor(s.goto.ra,s.goto.dec,jd);tAz=norm360(h.az-s.corr.az);tAlt=clamp(h.alt-s.corr.alt,0,90);}
      const dA=wrap180(tAz-s.enc.az),dB=tAlt-s.enc.alt,dist=Math.hypot(dA,dB),step=Math.min(s.slewMax,0.3+dist*1.6)*dt;
      s.moving=true;
      if(dist<=step+1e-4){
        s.enc.az=tAz;s.enc.alt=tAlt;const g=s.goto;s.goto=null;s.moving=false;
        if(g.park){s.parked=true;s.tracking='off';s.lock=null;}else this._relock();
        if(s.onArrive){const f=s.onArrive;s.onArrive=null;f();}
      }else{s.enc.az=norm360(s.enc.az+dA/dist*step);s.enc.alt+=dB/dist*step;}
    }else{
      if(s.moving){s.moving=false;this._relock();}
      if(s.tracking!=='off'&&s.lock&&!s.parked){        // follow the sky: fixed RA/Dec advanced by the tracking-mode drift
        const ra=s.lock.ra+TRK_RATE[s.tracking]*(simMs-s.lock.t)/3.6e6,h=eqToHor(ra,s.lock.dec,jd);
        s.enc.az=norm360(h.az-s.corr.az);s.enc.alt=clamp(h.alt-s.corr.alt,0,90);
      }
    }
  }
}
/* Stub showing how real hardware would plug in (Web Serial / bridge). Disabled in this page. */
class NexStarSerialDriver extends TelescopeDriver{
  get kind(){return 'hardware';}
  async connect(){throw new Error('Hardware access is disabled in this simulator page.');}
}
const NEXSTAR_CMDS=[['V','Get firmware version'],['K x','Echo (connection test)'],['e / E','Get RA/Dec (16-bit / precise)'],['b / B','Get Az/Alt (16-bit / precise)'],['r / R','GoTo RA/Dec'],['a / A','GoTo Az/Alt'],['s / S','Sync to RA/Dec'],['T / t','Set / get tracking mode'],['P','Variable-rate slew (axis, direction, rate)'],['L','Is a GoTo in progress?'],['M','Cancel GoTo'],['J','Is alignment complete?']];
const driver=new SimDriver();

