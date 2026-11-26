/* Seestar S50 Pro Simulator – s50-imaging.js
   Makes the live-view pictures.
     • buildSignal() / buildWideSignal(): paint a noise-free picture of the sky patch a camera is looking at
       (stars, galaxies, nebulae, the Milky Way…) in "electrons per second" per pixel.
     • Stacker: every simulated photo adds that signal (dimmed by atmosphere, clouds, filters) PLUS random noise.
       The picture shown is the running average, so noise shrinks as photos pile up – like the real Seestar app.
     • drawMoonView / drawSunView / drawScenery: bright or nearby subjects drawn directly.
   Needs js/s50/s50-model.js, js/01-core-astro.js and js/02-catalogs.js. */
'use strict';

/* ---------- small random-number helpers ---------- */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}   // seeded generator: same seed → same "random" numbers
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function hashInts(a,b){let h=Math.imul(a|0,374761393)+Math.imul(b|0,668265263)|0;h=Math.imul(h^h>>>13,1274126177);return(h^h>>>16)>>>0;}
function gauss(r){let u=0,v=0;while(u===0)u=r();v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(6.283185307*v);}   // Box–Muller: uniform → bell-curve numbers
function vnoise(x,y,seed){                              // smooth blotchy noise (for texture inside nebulae, the Milky Way, the Sun…)
  const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
  const h=(i,j)=>hashInts(i+seed*131,j+seed*71)/4294967296;
  return h(xi,yi)*(1-u)*(1-v)+h(xi+1,yi)*u*(1-v)+h(xi,yi+1)*(1-u)*v+h(xi+1,yi+1)*u*v;
}
const fbm=(x,y,s)=>vnoise(x,y,s)*.55+vnoise(x*2.1,y*2.1,s+7)*.3+vnoise(x*4.3,y*4.3,s+13)*.15;
function starColor(t){                                  // 0 = hot blue-white … 1 = cool orange (each triple sums to ≈3 so brightness is preserved)
  const stops=[[0.85,0.95,1.2],[1,1,1],[1.1,1.0,0.8],[1.25,0.92,0.6]],x=clamp(t,0,.999)*3,i=Math.floor(x),f=x-i,a=stops[i],b=stops[i+1];
  return [a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f];
}
const magFlux=(m,cam)=>cam.zp*Math.pow(10,-0.4*m);      // electrons/second for a magnitude-m source

/* =====================================================================
   1. PAINTING THE NOISE-FREE SKY (telephoto camera)
   ===================================================================== */
/* Project a sky position onto the picture ("gnomonic" = flat-photo projection), then rotate so UP means "towards the zenith". */
function makeProjector(cam,ra0,dec0,q){
  const sd0=Math.sin(dec0*D2R),cd0=Math.cos(dec0*D2R),cq=Math.cos(q*D2R),sq=Math.sin(q*D2R);
  return function(ra,dec){
    const dr=(ra-ra0)*D2R,sd=Math.sin(dec*D2R),cd=Math.cos(dec*D2R),cosc=sd0*sd+cd0*cd*Math.cos(dr);
    if(cosc<=0.01)return null;
    const x=cd*Math.sin(dr)/cosc*R2D,y=(cd0*sd-sd0*cd*Math.cos(dr))/cosc*R2D;      // x = east, y = north (degrees)
    const u=-x,v=y;                                                                  // sky picture convention: north up, east LEFT
    return {px:cam.w/2+(u*cq+v*sq)/cam.deg,py:cam.h/2-(-u*sq+v*cq)/cam.deg};         // rotate so the zenith is up
  };
}
/* One star = a small blurred dot (a tiny Gaussian bump); bright stars also get a faint wide halo. */
function addStar(plane,cam,px,py,flux,col){
  const R=2,ix=Math.round(px),iy=Math.round(py),W=cam.w,H=cam.h,sg=cam.name==='tele'?PSF_SIGMA:0.7;
  if(ix<-8||iy<-8||ix>W+8||iy>H+8)return;
  const k=1/(2*sg*sg);
  for(let y=iy-R;y<=iy+R;y++){if(y<0||y>=H)continue;for(let x=ix-R;x<=ix+R;x++){if(x<0||x>=W)continue;
    const d2=(x-px)*(x-px)+(y-py)*(y-py),v=flux*Math.exp(-d2*k)*k/Math.PI,i=(y*W+x)*3;
    plane[i]+=v*col[0];plane[i+1]+=v*col[1];plane[i+2]+=v*col[2];}}
  if(flux>cam.zp*Math.pow(10,-0.4*(cam.name==='tele'?11:7.5))){
    const Rh=7,kh=1/(2*2.2*2.2),fh=flux*0.07;
    for(let y=iy-Rh;y<=iy+Rh;y++){if(y<0||y>=H)continue;for(let x=ix-Rh;x<=ix+Rh;x++){if(x<0||x>=W)continue;
      const d2=(x-px)*(x-px)+(y-py)*(y-py),v=fh*Math.exp(-d2*kh)*kh/Math.PI,i=(y*W+x)*3;
      plane[i]+=v*col[0];plane[i+1]+=v*col[1];plane[i+2]+=v*col[2];}}
  }
}
/* A smooth elliptical blob: `prof(r)` = brightness profile, `total` = total flux, `norm` = the area (px²) the profile covers,
   so amp = total/norm makes the blob add up to exactly `total`. */
function addBlob(plane,cam,cx,cy,a,b,rotDeg,total,prof,norm,col,tex,reach){
  const c=Math.cos(rotDeg*D2R),s=Math.sin(rotDeg*D2R),ext=Math.ceil(Math.max(a,b)*reach),amp=total/norm,W=cam.w,H=cam.h;
  const x0=Math.max(0,Math.floor(cx-ext)),x1=Math.min(W-1,Math.ceil(cx+ext)),y0=Math.max(0,Math.floor(cy-ext)),y1=Math.min(H-1,Math.ceil(cy+ext));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const dx=x-cx,dy=y-cy,xr=(dx*c+dy*s)/a,yr=(-dx*s+dy*c)/b,r=Math.sqrt(xr*xr+yr*yr);
    if(r>reach)continue;
    const v=amp*prof(r)*(tex?tex(x,y):1),i=(y*W+x)*3;
    plane[i]+=v*col[0];plane[i+1]+=v*col[1];plane[i+2]+=v*col[2];
  }
}
/* Faint "field stars": invented from a grid of sky cells, each cell always producing the same stars (seeded by position). */
function fieldStars(ra0,dec0,radiusDeg,cb){
  const CELL=0.2,MMAX=16.5,SLOPE=0.32;
  const b0=Math.floor((dec0-radiusDeg)/CELL),b1=Math.floor((dec0+radiusDeg)/CELL);
  for(let b=b0;b<=b1;b++){
    const decC=(b+.5)*CELL;if(Math.abs(decC)>=89.8)continue;
    const nRA=Math.max(1,Math.round(360*Math.cos(decC*D2R)/CELL)),cellW=360/nRA;
    const cosEdge=Math.max(0.02,Math.cos((Math.abs(decC)+CELL/2)*D2R)),span=Math.min(180,radiusDeg/cosEdge+cellW);
    const all=2*span>=360-cellW,iC=Math.floor(ra0/cellW),half=Math.ceil(span/cellW);
    const from=all?0:iC-half,to=all?nRA-1:iC+half;
    for(let ii=from;ii<=to;ii++){
      const i=((ii%nRA)+nRA)%nRA,rnd=mulberry32(hashInts(b,i)),cd=Math.cos(decC*D2R);
      const raC=(i+.5)*cellW,gb=galLB(raC,decC).b;
      const dens=60*Math.pow(10,SLOPE*(MMAX-12))*(0.45+4.5*Math.exp(-(gb/14)*(gb/14)));   // stars per square degree
      const lam=CELL*cellW*cd*dens,n=Math.max(0,Math.round(lam+Math.sqrt(lam)*gauss(rnd)));
      for(let k=0;k<n;k++){
        const m=MMAX+Math.log10(Math.max(1e-6,rnd()))/SLOPE,ra=(i+rnd())*cellW,dec=(b+rnd())*CELL,ct=rnd();
        if(m>=8)cb(ra,dec,m,ct);                       // brighter stars come from the real catalog instead
      }
    }
  }
}
/* Galactic latitude/longitude from RA/Dec (the Milky Way lies along galactic latitude 0) */
function galLB(ra,dec){
  const a=(ra-192.859)*D2R,d=dec*D2R,dg=27.128*D2R;
  const sb=Math.sin(d)*Math.sin(dg)+Math.cos(d)*Math.cos(dg)*Math.cos(a);
  const l=122.932-Math.atan2(Math.cos(d)*Math.sin(a),Math.sin(d)*Math.cos(dg)-Math.cos(d)*Math.sin(dg)*Math.cos(a))*R2D;
  return {l:norm360(l),b:Math.asin(clamp(sb,-1,1))*R2D};
}

/* Everything in the telephoto field of view. Returns bb = broadband light (stars, galaxies, clusters) and
   em = emission-nebula light (the Duo-Band filter treats those very differently!). */
function buildSignal(cam,ra0,dec0,q0){
  const N=cam.w*cam.h,bb=new Float32Array(N*3),em=new Float32Array(N*3),proj=makeProjector(cam,ra0,dec0,q0);
  const diag=Math.hypot(cam.w,cam.h)/2*cam.deg;
  fieldStars(ra0,dec0,diag+0.05,(ra,dec,m,ct)=>{const p=proj(ra,dec);if(p)addStar(bb,cam,p.px,p.py,magFlux(m,cam),starColor(ct));});
  for(const o of OBJ){
    if(o.cra==null||o.type==='sun'||o.type==='moon')continue;
    const sizeDeg=(o.size||0)/60,sepApprox=angSep({ra:o.cra,dec:o.cdec},{ra:ra0,dec:dec0});
    if(sepApprox>diag+sizeDeg/2+0.1)continue;
    const p=proj(o.cra,o.cdec);if(!p)continue;
    const rnd=mulberry32(hashStr(o.id)),arcminPx=60/cam.scale;
    if(o.type==='star'){addStar(bb,cam,p.px,p.py,magFlux(o.mag,cam),starColor(rnd()));}
    else if(o.type==='planet'){
      const rpx=Math.max(0.9,(o.diam*3600/cam.scale)/2),col={mercury:[1,.95,.9],venus:[1.1,1.05,.9],mars:[1.4,.8,.55],jupiter:[1.15,1.0,.82],saturn:[1.15,1.05,.8]}[o.id]||[1,1,1];
      addBlob(bb,cam,p.px,p.py,rpx*.8,rpx*.8,0,magFlux(o.mag,cam),r=>Math.exp(-r*r),Math.PI*(rpx*.8)*(rpx*.8),col,null,3);   // a small dot – the S50 is not a planetary scope
    }
    else if(o.type==='dso'){
      const sz=Math.max(0.5,o.size||1)*arcminPx,ar=clamp(o.ar||1,.25,1),rot=(o.rot||0),F=magFlux(o.mag,cam);
      if(o.kind==='gal'){
        const a=sz/2/2.6,b=a*ar;
        addBlob(bb,cam,p.px,p.py,a,b,rot,F*.75,r=>Math.exp(-r),2*Math.PI*a*b,[0.85,0.97,1.15],null,6);
        addBlob(bb,cam,p.px,p.py,a*.22,b*.3,rot,F*.25,r=>Math.exp(-r*r/2),2*Math.PI*(a*.22)*(b*.3),[1.2,1.0,.78],null,3.5);
      }else if(o.kind==='neb'){
        const a=sz/2/1.7,b=a*clamp(ar,.4,1),seed=hashStr(o.id)%97,tex=(x,y)=>0.35+1.5*Math.pow(fbm(x/(a*.45+2),y/(a*.45+2),seed),1.6);
        addBlob(em,cam,p.px,p.py,a,b,rot,F*.55,r=>Math.exp(-r*r/2),2*Math.PI*a*b,[1.55,0.55,0.5],tex,3.2);
        addBlob(em,cam,p.px,p.py,a*.3,b*.3,rot,F*.3,r=>Math.exp(-r*r/2),2*Math.PI*(a*.3)*(b*.3),[1.1,0.9,0.9],tex,3);
        addBlob(em,cam,p.px,p.py,a*.09,b*.09,rot,F*.15,r=>Math.exp(-r*r/2),2*Math.PI*(a*.09)*(b*.09),[0.85,1.25,1.1],tex,3);
      }else if(o.kind==='pn'){
        const R=sz/2,w=Math.max(1.1,R*.35);
        addBlob(em,cam,p.px,p.py,R*1.5,R*1.5*clamp(ar,.5,1),rot,F,r=>Math.exp(-Math.pow((r*1.5*R-R*.75)/w,2)),2*Math.PI*(R*.75)*w*Math.sqrt(Math.PI)*clamp(ar,.5,1),[0.5,1.3,1.25],null,1.05);
        addStar(bb,cam,p.px,p.py,magFlux(14.5,cam),[1,1,1]);
      }else if(o.kind==='oc'){
        const R=sz/2/1.5,n=Math.round(clamp(25+(o.size||5)*1.5,25,140));
        for(let k=0;k<n;k++){const rr=R*Math.sqrt(-2*Math.log(Math.max(1e-6,rnd())))*.6,th=rnd()*6.2832,m=o.mag+1.2+4.2*Math.pow(rnd(),.6);addStar(bb,cam,p.px+rr*Math.cos(th),p.py+rr*Math.sin(th),magFlux(m,cam),starColor(rnd()*.7));}
      }else if(o.kind==='gc'){
        const R=sz/2/3.2;
        addBlob(bb,cam,p.px,p.py,R*.6,R*.6,0,F*.85,r=>1/Math.pow(1+r*r,1.5),2*Math.PI*(R*.6)*(R*.6),[1.1,1.0,.85],null,5);
        for(let k=0;k<160;k++){const rr=R*1.6*Math.sqrt(-2*Math.log(Math.max(1e-6,rnd()))),th=rnd()*6.2832,m=o.mag+2.8+4.5*Math.pow(rnd(),.7);addStar(bb,cam,p.px+rr*Math.cos(th),p.py+rr*Math.sin(th),magFlux(m,cam),starColor(.45+rnd()*.5));}
      }
    }
  }
  return {bb,em};
}

/* =====================================================================
   2. THE WIDE-ANGLE CAMERA (63°, used by Milky Way mode and for aiming)
   The wide picture is drawn in horizontal coordinates: up = zenith, right = increasing azimuth.
   ===================================================================== */
function altAzToWidePix(cam,az0,alt0,az,alt){            // sky direction → pixel (null if behind the camera)
  const a0=alt0*D2R,a=alt*D2R,dl=(az-az0)*D2R,cosc=Math.sin(a0)*Math.sin(a)+Math.cos(a0)*Math.cos(a)*Math.cos(dl);
  if(cosc<=0.05)return null;
  const x=Math.cos(a)*Math.sin(dl)/cosc,y=(Math.cos(a0)*Math.sin(a)-Math.sin(a0)*Math.cos(a)*Math.cos(dl))/cosc;
  return {px:cam.w/2+x*R2D/cam.deg,py:cam.h/2-y*R2D/cam.deg};
}
function widePixToAltAz(cam,az0,alt0,px,py){             // pixel → sky direction (used when you tap "GO")
  const x=(px-cam.w/2)*cam.deg*D2R,y=(cam.h/2-py)*cam.deg*D2R,rho=Math.hypot(x,y),c=Math.atan(rho),a0=alt0*D2R;
  if(rho<1e-9)return {alt:alt0,az:az0};
  const alt=Math.asin(clamp(Math.cos(c)*Math.sin(a0)+y*Math.sin(c)*Math.cos(a0)/rho,-1,1));
  const az=az0*D2R+Math.atan2(x*Math.sin(c),rho*Math.cos(a0)*Math.cos(c)-y*Math.sin(a0)*Math.sin(c));
  return {alt:alt*R2D,az:norm360(az*R2D)};
}
/* A fixed, invented set of fainter stars (mag 5.5–9.6), concentrated towards the Milky Way, for the wide view. */
const WIDE_STARS=(function(){
  const r=mulberry32(4242),a=[];
  while(a.length<7000){
    const ra=r()*360,dec=Math.asin(2*r()-1)*R2D,m=9.6+Math.log10(Math.max(1e-6,r()))/0.38;
    if(m<5.5)continue;
    const b=galLB(ra,dec).b;if(r()>0.25+0.75*Math.exp(-(b/18)*(b/18)))continue;
    a.push([ra,dec,m,r()]);
  }
  return a;
})();
const CON_LINES=[['Alkaid','Mizar'],['Mizar','Alioth'],['Alioth','Megrez'],['Megrez','Phecda'],['Phecda','Merak'],['Merak','Dubhe'],['Dubhe','Megrez'],   // Big Dipper
  ['Betelgeuse','Bellatrix'],['Betelgeuse','Alnitak'],['Bellatrix','Mintaka'],['Mintaka','Alnilam'],['Alnilam','Alnitak'],['Alnitak','Saiph'],['Mintaka','Rigel'],   // Orion
  ['Vega','Deneb'],['Deneb','Altair'],['Altair','Vega'],['Regulus','Denebola'],['Castor','Pollux'],['Schedar','Caph']];                                                  // Summer Triangle, Leo, Gemini, Cassiopeia
function constellationSegments(cam,az0,alt0,jd){          // line segments (in pixels) for the "constellation lines" overlay
  const pos=n=>{const o=OBJ.find(x=>x.id===n);if(!o||o.cra==null)return null;const h=eqToHor(o.cra,o.cdec,jd);return h.alt>-5?altAzToWidePix(cam,az0,alt0,h.az,h.alt):null;};
  const segs=[];for(const [a,b] of CON_LINES){const p=pos(a),q=pos(b);if(p&&q)segs.push([p,q]);}return segs;
}
/* Paint the wide view signal. `starsOnly` skips the Milky Way glow (used for star trails, which re-draw stars many times). */
function buildWideSignal(cam,az0,alt0,jd,opts={}){
  const N=cam.w*cam.h,bb=new Float32Array(N*3),mask=new Float32Array(N).fill(1);
  if(!opts.starsOnly){
    const unit=cam.zp*Math.pow(10,-0.4*21.0)*cam.scale*cam.scale;                   // the Milky Way's brightest parts are about 21 mag/arcsec²
    const cs=6,gw=Math.ceil(cam.w/cs)+2,gh=Math.ceil(cam.h/cs)+2,mw=new Float32Array(gw*gh),al=new Float32Array(gw*gh);
    for(let gy=0;gy<gh;gy++)for(let gx=0;gx<gw;gx++){                                // a coarse grid is enough: the glow is smooth
      const p=widePixToAltAz(cam,az0,alt0,gx*cs,gy*cs),e=horToEq(p.alt,p.az,jd),g=galLB(e.ra,e.dec),i=gy*gw+gx;
      al[i]=p.alt;mw[i]=Math.exp(-(g.b/9)*(g.b/9))*(0.3+0.7*Math.exp(-Math.pow(wrap180(g.l)/60,2)))*(0.55+0.9*fbm(g.l/5,(g.b+90)/5,3));
    }
    for(let y=0;y<cam.h;y++){const gy=y/cs,y0=Math.floor(gy),fy=gy-y0;
      for(let x=0;x<cam.w;x++){
        const gx=x/cs,x0=Math.floor(gx),fx=gx-x0,i0=y0*gw+x0,p=y*cam.w+x;
        const v=(mw[i0]*(1-fx)+mw[i0+1]*fx)*(1-fy)+(mw[i0+gw]*(1-fx)+mw[i0+gw+1]*fx)*fy;
        const alt=(al[i0]*(1-fx)+al[i0+1]*fx)*(1-fy)+(al[i0+gw]*(1-fx)+al[i0+gw+1]*fx)*fy;
        if(alt<Math.max(0,SKY.horizon)){mask[p]=0;continue;}                          // below the horizon (or behind trees/buildings): dark ground
        const o=p*3,f=unit*v;bb[o]=f*0.9;bb[o+1]=f*0.95;bb[o+2]=f*1.1;
      }}
  }
  const addAt=(ra,dec,m,col)=>{const h=eqToHor(ra,dec,jd);if(h.alt<0)return;const p=altAzToWidePix(cam,az0,alt0,h.az,h.alt);if(p)addStar(bb,cam,p.px,p.py,magFlux(m,cam),col);};
  for(const s of WIDE_STARS)addAt(s[0],s[1],s[2],starColor(s[3]));
  for(const o of OBJ)if(o.cra!=null&&(o.type==='star'&&o.mag<7||o.type==='planet'))addAt(o.cra,o.cdec,o.mag,o.type==='planet'?[1.1,1,.9]:starColor((hashStr(o.id)%100)/100));
  if(!opts.starsOnly&&MOON.alt>0){const p=altAzToWidePix(cam,az0,alt0,MOON.az,MOON.alt);if(p){const rpx=Math.max(1.2,MOON.diam*3600/cam.scale/2);addBlob(bb,cam,p.px,p.py,rpx,rpx,0,magFlux(-12.7,cam),r=>Math.exp(-r*r),Math.PI*rpx*rpx,[1,.97,.9],null,3);}}
  return {bb,em:new Float32Array(N*3),mask};
}

/* =====================================================================
   3. THE STACKER  (used for the telephoto stack, the wide-angle stack, single photos and star trails)
   ===================================================================== */
class Stacker{
  constructor(cam,kind){this.cam=cam;this.kind=kind;this.on=false;this.exposure=10;this.brightness=1;this.mode='stack';this.flt='uvir';this.clear();}
  clear(){
    const N=this.cam.w*this.cam.h;
    this.S=new Float32Array(N*3);                    // running sum of electrons (per colour channel)
    this.T=new Float32Array(N);                      // total exposure time seen by each pixel (seconds)
    this.last=new Float32Array(N*3);                 // the most recent single photo (for the "Single photo" view)
    this.N=0;this.dropped=0;this.acc=0;this.tTotal=0;this.rot=0;this.lastMs=0;
    this.sig=null;this.ref=null;this.target=null;this.noiseRef=1;this.reason='';this.dirty=true;this.noise=null;
  }
  /* Get ready for the current pointing: paint the noise-free sky once (takes a moment). */
  prepare(mount){
    this.clear();
    const cam=this.cam,eq=horToEq(mount.alt,mount.az,jdNow()),jd=jdNow();
    this.target=mount.target;this.lunar=false;
    this.ref={ra:eq.ra,dec:eq.dec,q:parallacticAngle(mount.az,mount.alt),az:mount.az,alt:mount.alt,jd,t:simMs};
    if(this.kind==='tele'){if(mount.target&&mount.target.type==='moon'){this.lunar=true;this.sig=null;}else this.sig=buildSignal(cam,eq.ra,eq.dec,this.ref.q);}
    else this.sig=buildWideSignal(cam,mount.az,mount.alt,jd,{starsOnly:false});
    return true;
  }
  start(mount){
    const ok=(this.target===mount.target||this.kind==='trails'||this.kind==='wide')&&this.ref&&(this.sig||this.lunar);
    if(!ok&&!this.prepare(mount))return false;
    if(this.N===0){this.S.fill(0);this.T.fill(0);}
    this.on=true;this.dirty=true;return true;
  }
  stop(){this.on=false;}
  /* A single photo of `E` seconds (Milky Way "Photo", or the live-view preview). */
  snap(mount,E){
    if(!this.sig&&!this.prepare(mount))return false;
    const tr=transparency(mount.alt,mount.dew);this.S.fill(0);this.T.fill(0);this.N=0;this.tTotal=0;
    this._addFrames(1,mount,tr,E);this.N=1;this.tTotal=E;return true;
  }
  preview(mount){
    if(this.N>0||!this.sig||mount.mode!=='track'||!mount.lensClear)return;
    const tr=transparency(mount.alt,mount.dew);if(tr<0.12)return;
    this.S.fill(0);this.T.fill(0);this._addFrames(1,mount,tr,this.exposure);this.N=0;this.tTotal=0;
  }
  /* Why would a photo be spoiled right now? ('' = fine) */
  problem(mount,tr){
    if(mount.damaged)return 'sensor damaged';
    if(!mount.lensClear)return 'lens in zero position';
    if(this.kind==='trails'){if(mount.mode!=='idle')return 'mount must hold still for star trails';}
    else if(mount.mode!=='track')return 'not tracking';
    if(this.kind!=='trails'&&mount.target!==this.target)return 'target changed';
    if(tr<0.12)return 'too cloudy';
    if(mount.alt<SKY.horizon)return 'blocked by trees/buildings';
    if(mount.shake>0)return 'vibration (tripod bumped)';
    return '';
  }
  update(simDt,mount){
    if(!this.on)return;
    this.acc+=simDt;
    const due=Math.floor(this.acc/this.exposure);if(due<1)return;
    const k=due;this.acc-=k*this.exposure;
    const tr=transparency(mount.alt,mount.dew),why=this.problem(mount,tr);
    if(why){this.dropped+=k;this.reason=why;return;}
    this.reason='';
    // wind above Force 3 (manual) and the odd satellite/gust spoil some photos
    const p=Math.min(0.95,0.03+Math.max(0,SKY.wind-S50.maxWindForce)*0.25);let lost=0;for(let i=0;i<Math.min(k,300);i++)if(Math.random()<p)lost++;
    if(SKY.wind>S50.maxWindForce&&lost>0)this.reason='wind (above Force 3)';
    this.dropped+=lost;const keep=k-lost;if(keep<=0)return;
    if(this.lunar){this.N+=keep;this.tTotal+=keep*this.exposure;this.dirty=true;return;}
    if(this.kind==='trails')this._addTrails(keep,mount,tr);else this._addFrames(keep,mount,tr,this.exposure);
  }
  _addFrames(k,mount,tr,t){
    const cam=this.cam,W=cam.w,H=cam.h,f=this.kind==='tele'?FILTERS[this.flt]:FILTERS.uvir;
    const solar=mount.solarFilter&&this.kind==='tele'?1e-5:1;                  // with the solar filter on, almost nothing but the Sun gets through
    const sky=skyRate(mount.az,mount.alt,cam)*f.sky*tr*t*solar;
    const rn=READ_NOISE*cam.bin,varBase=rn*rn+sky;                             // noise variance: read noise (summed over bin×bin pixels) + sky shot noise
    // Field rotation: the sky turns in the picture; stacking re-aligns the stars, so the corners of the first frame drop out.
    // On the EQ wedge this rotation is almost zero (only a small leftover from polar-alignment error).
    let dq;
    if(mount.mountMode==='eq')dq=this.rot+mount.eqErrDeg()*0.02*((simMs-(this.lastMs||simMs))/60000);
    else dq=wrap180(parallacticAngle(mount.az,mount.alt)-this.ref.q);
    this.rot=dq;this.lastMs=simMs;
    const cd=Math.cos(dq*D2R),sd=Math.sin(dq*D2R),hw=W/2,hh=H/2;
    const {bb,em}=this.sig,mask=this.sig.mask,sc=tr*t*k*solar,bbp=f.bb,emp=f.em,S=this.S,T=this.T,L=this.last;
    const rnd=Math.random;let spare=null;
    const g=()=>{if(spare!==null){const s=spare;spare=null;return s;}let u=1-rnd(),v=rnd();const m=Math.sqrt(-2*Math.log(u));spare=m*Math.sin(6.283185307*v);return m*Math.cos(6.283185307*v);};
    for(let y=0,p=0;y<H;y++){
      const dy=y-hh;
      for(let x=0;x<W;x++,p++){
        const dx=x-hw,fx=dx*cd-dy*sd,fy=dx*sd+dy*cd;
        if(Math.abs(fx)>hw||Math.abs(fy)>hh)continue;                          // outside the rotated frame
        const i3=p*3,mk=mask?mask[p]:1;
        for(let c=0;c<3;c++){
          const mean=(bb[i3+c]*bbp+em[i3+c]*emp)*sc*mk;
          const n=Math.sqrt(k*varBase+Math.max(0,mean))*g();                  // read noise + sky glow + the object's own shot noise, added as variances
          S[i3+c]+=mean+n;L[i3+c]=(mean+n)/k;
        }
        T[p]+=t*k;
      }
    }
    this.N+=k;this.tTotal+=k*t;this.dirty=true;
    const sk10=skyRate(mount.az,mount.alt,cam)*f.sky*tr*10*solar;this.noiseRef=Math.max(1e-6,Math.sqrt(rn*rn+sk10)/10);   // "stretch reference": a typical single 10 s photo's noise
  }
  /* Star trails: the mount holds still, so every photo draws the stars a little further along – we keep the brightest value per pixel. */
  _addTrails(k,mount,tr){
    const cam=this.cam,W=cam.w,H=cam.h,t=this.exposure,S=this.S,T=this.T,ref=this.ref,sub=Math.min(k,8);
    const rn=READ_NOISE*cam.bin,sky=skyRate(mount.az,mount.alt,cam)*tr*t,varBase=rn*rn+sky;
    if(!this.noise){this.noise=new Float32Array(W*H*3);const r=mulberry32(99);for(let i=0;i<this.noise.length;i++)this.noise[i]=gauss(r)*Math.sqrt(varBase);}
    for(let s=0;s<sub;s++){
      const jd=jdNow()-(sub-1-s)/sub*k*t/86400,sig=buildWideSignal(cam,ref.az,ref.alt,jd,{starsOnly:true});
      for(let p=0;p<W*H;p++){const m=this.sig.mask?this.sig.mask[p]:1;for(let c=0;c<3;c++){const v=sig.bb[p*3+c]*tr*t*m;if(v>S[p*3+c])S[p*3+c]=v;}}
    }
    for(let p=0;p<W*H;p++)T[p]=t;
    this.N+=k;this.tTotal+=k*t;this.dirty=true;this.noiseRef=Math.sqrt(varBase)/t;
  }
  limitingMag(mount){                                // faintest star that stands out (signal-to-noise ≥ 5) in the stack so far
    if(!this.N||this.kind!=='tele')return null;
    const cam=this.cam,f=FILTERS[this.flt],tr=transparency(mount.alt,mount.dew),t=this.exposure;
    if(f.bb===0)return null;
    const rn=READ_NOISE*cam.bin,vf=rn*rn+skyRate(mount.az,mount.alt,cam)*f.sky*tr*t,neff=4*Math.PI*PSF_SIGMA*PSF_SIGMA;
    return -2.5*Math.log10(5*Math.sqrt(neff*this.N*vf)/(cam.zp*f.bb*tr*t*this.N));
  }
  render(ctx,img){                                   // draw the picture into a 2D canvas context (offscreen canvas of cam.w × cam.h)
    const d=img.data,single=this.mode==='single',S=single?this.last:this.S,br=this.brightness,ref=this.noiseRef||1,NP=this.cam.w*this.cam.h;
    const trails=this.kind==='trails'&&this.noise,s0=1.5,lo=Math.asinh(-2/s0),span=Math.asinh(250/s0)-lo;
    for(let p=0;p<NP;p++){
      const T=this.T[p],o=p*4;
      if(T<=0){d[o]=d[o+1]=d[o+2]=0;d[o+3]=255;continue;}
      const rate=single?1/this.exposure:1/T;
      for(let c=0;c<3;c++){
        const v=(S[p*3+c]+(trails?this.noise[p*3+c]:0))*rate/ref*br,x=(Math.asinh(v/s0)-lo)/span;
        d[o+c]=x<=0?0:x>=1?255:x*255;
      }
      d[o+3]=255;
    }
    ctx.putImageData(img,0,0);
  }
}

/* =====================================================================
   4. SUBJECTS DRAWN DIRECTLY: the Moon, the Sun (through the solar filter) and everyday scenery
   ===================================================================== */
function offsetPx(cam,m,az,alt,zoom,W){               // where a sky object appears on the picture (in canvas pixels), tele pointing at (m.az, m.alt)
  const k=W/cam.w*zoom/cam.deg;
  return {x:W/2+wrap180(az-m.az)*Math.cos(m.alt*D2R)*k,y:(W/cam.w*cam.h)/2-(alt-m.alt)*k};
}
function drawMoonView(ctx,moonImg,m,cam,zoom){
  const W=ctx.canvas.width,H=ctx.canvas.height;ctx.fillStyle='#02030a';ctx.fillRect(0,0,W,H);
  const R=(MOON.diam*3600/cam.scale/2)*(W/cam.w)*zoom,c=offsetPx(cam,m,MOON.az,MOON.alt,zoom,W);
  ctx.save();ctx.beginPath();ctx.arc(c.x,c.y,R,0,6.2832);ctx.clip();
  if(moonImg&&moonImg.complete&&moonImg.naturalWidth)ctx.drawImage(moonImg,c.x-R,c.y-R,2*R,2*R);else{ctx.fillStyle='#bbb';ctx.fill();}
  const dA=(SUN.az-MOON.az)*D2R,aS=SUN.alt*D2R,aM=MOON.alt*D2R;                         // which way is the Sun, seen from the Moon, on this zenith-up picture?
  const th=Math.atan2(Math.sin(dA)*Math.cos(aS),Math.cos(aM)*Math.sin(aS)-Math.sin(aM)*Math.cos(aS)*Math.cos(dA));
  const k=MOON.illum,b=R*(1-2*k),pts=[];
  for(let a=0;a<=Math.PI;a+=Math.PI/48)pts.push([R*Math.cos(a),R*Math.sin(a)]);        // sunny edge
  for(let a=Math.PI;a>=0;a-=Math.PI/48)pts.push([R*Math.cos(a),b*Math.sin(a)]);        // terminator (day/night line)
  const rot=([x,y])=>[c.x+x*Math.cos(th)+y*Math.sin(th),c.y-(-x*Math.sin(th)+y*Math.cos(th))];
  ctx.beginPath();ctx.rect(c.x-R-2,c.y-R-2,2*R+4,2*R+4);ctx.moveTo(...rot(pts[0]));for(const p of pts)ctx.lineTo(...rot(p));ctx.closePath();
  ctx.fillStyle='rgba(2,3,8,.93)';ctx.fill('evenodd');ctx.restore();
}
const sunTex={key:'',cv:null};
function sunTexture(R){                                  // the Sun's disc: limb darkening, granulation and a few sunspots (seeded by the date)
  const day=Math.floor(simMs/86400000),key=R+'/'+day;if(sunTex.key===key)return sunTex.cv;
  const D=Math.ceil(R*2)+4,cv=document.createElement('canvas');cv.width=cv.height=D;const g=cv.getContext('2d'),img=g.createImageData(D,D),d=img.data,c=D/2,rnd=mulberry32(day*7+1);
  const spots=Array.from({length:2+Math.floor(rnd()*4)},()=>({x:(rnd()-.5)*1.1*R,y:(rnd()-.5)*0.9*R,r:R*(.02+rnd()*.035)}));
  for(let y=0;y<D;y++)for(let x=0;x<D;x++){
    const dx=x-c,dy=y-c,r=Math.hypot(dx,dy)/R,o=(y*D+x)*4;if(r>1){continue;}
    const mu=Math.sqrt(1-r*r),limb=1-0.62*(1-mu),gran=0.94+0.12*fbm(x/(R*.02+1),y/(R*.02+1),5);
    let v=limb*gran;
    for(const s of spots){const q=Math.hypot(dx-s.x,dy-s.y)/s.r;if(q<2.4)v*=q<1?0.22:0.55+0.2*(q-1);}
    d[o]=255*v;d[o+1]=190*v;d[o+2]=95*v;d[o+3]=r>.992?Math.max(0,(1-r)/.008*255):255;
  }
  g.putImageData(img,0,0);sunTex.key=key;sunTex.cv=cv;return cv;
}
function drawSunView(ctx,m,cam,zoom){
  const W=ctx.canvas.width,H=ctx.canvas.height;ctx.fillStyle='#04040a';ctx.fillRect(0,0,W,H);
  const R=(SUN.diam*3600/cam.scale/2)*(W/cam.w)*zoom,c=offsetPx(cam,m,SUN.az,SUN.alt,zoom,W);
  if(c.x<-R||c.x>W+R||c.y<-R||c.y>H+R)return;
  const tex=sunTexture(Math.round(R));ctx.drawImage(tex,c.x-tex.width/2,c.y-tex.height/2);
}
/* Everyday scenery (birds, wildlife, landscape) for Scenery mode: a hazy ridge-line, sky, ground and a few birds. */
function drawScenery(ctx,m,cam,zoom,subjectDist,tms,noBirds){
  const W=ctx.canvas.width,H=ctx.canvas.height,k=W/cam.w*zoom/cam.deg,horizonY=H/2+(m.alt)*k;     // pixel row of the horizon (alt 0)
  const day=clamp((SUN.alt+6)/12,0,1),mix=(a,b)=>Math.round(a+(b-a)*day);
  const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,`rgb(${mix(5,70)},${mix(8,130)},${mix(20,215)})`);sky.addColorStop(1,`rgb(${mix(18,190)},${mix(22,215)},${mix(40,240)})`);
  ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
  if(SUN.alt>-3){const s=offsetPx(cam,m,SUN.az,SUN.alt,zoom,W),gr=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,W*.6);gr.addColorStop(0,'rgba(255,240,200,.95)');gr.addColorStop(.1,'rgba(255,220,150,.5)');gr.addColorStop(1,'rgba(255,200,120,0)');ctx.fillStyle=gr;ctx.fillRect(0,0,W,H);}
  ctx.beginPath();ctx.moveTo(0,H);                                                              // distant hills: height depends on the compass direction
  for(let x=0;x<=W;x+=4){const az=m.az+(x-W/2)/k,h=(3+7*fbm(az/9,1.7,21))*k*0.5;ctx.lineTo(x,horizonY-h);}
  ctx.lineTo(W,H);ctx.closePath();const g=ctx.createLinearGradient(0,horizonY-60,0,horizonY+H*.3);g.addColorStop(0,`rgb(${mix(10,92)},${mix(14,104)},${mix(18,92)})`);g.addColorStop(1,`rgb(${mix(6,60)},${mix(8,66)},${mix(8,50)})`);ctx.fillStyle=g;ctx.fill();
  const blur=cam.name==='tele'&&subjectDist<15?Math.min(8,(15-subjectDist)*.6):0;                 // working distance of the tele camera is 15 m – ∞ (manual)
  for(let i=0;i<(noBirds?0:4);i++){                                                               // birds, flying on lazy loops
    const ph=tms/1000*(0.25+i*0.07)+i*2,bx=W/2+Math.sin(ph)*W*.28*(1+i*.15),by=H*.38+Math.cos(ph*1.3+i)*H*.12-i*20,sz=(8+3*i)*(zoom>1?1.4:1),fl=Math.sin(tms/90+i)*.6;
    if(blur)ctx.filter=`blur(${blur}px)`;
    ctx.strokeStyle=`rgba(${mix(230,25)},${mix(230,25)},${mix(240,30)},.9)`;ctx.lineWidth=2.2;ctx.beginPath();ctx.moveTo(bx-sz,by-fl*sz);ctx.quadraticCurveTo(bx-sz/2,by-sz*.35,bx,by);ctx.quadraticCurveTo(bx+sz/2,by-sz*.35,bx+sz,by-fl*sz);ctx.stroke();ctx.filter='none';
  }
  if(blur){ctx.fillStyle='rgba(255,255,255,.06)';ctx.fillRect(0,0,W,H);}
}
