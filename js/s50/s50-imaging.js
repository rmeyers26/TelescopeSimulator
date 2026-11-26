/* Seestar S50 Simulator – s50-imaging.js
   Makes the live-view picture. Two steps:
     1. buildSignal():  paint a noise-free picture of the sky patch the telescope is looking at
                        (stars, galaxies, nebulae…) in "electrons per second" per pixel.
     2. Stacker:        every simulated photo adds that signal (dimmed by atmosphere, clouds, filters)
                        PLUS random noise.  The displayed picture is the running average – so noise
                        shrinks as photos pile up, exactly like the real Seestar app.
   Needs js/s50/s50-model.js, js/01-core-astro.js and js/02-catalogs.js. */
'use strict';

const NPX=IMG.w*IMG.h;

/* ---------- small random-number helpers ---------- */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}   // seeded generator: same seed → same "random" numbers
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function hashInts(a,b){let h=Math.imul(a|0,374761393)+Math.imul(b|0,668265263)|0;h=Math.imul(h^h>>>13,1274126177);return(h^h>>>16)>>>0;}
function gauss(r){let u=0,v=0;while(u===0)u=r();v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(6.283185307*v);}   // Box–Muller: uniform → bell-curve numbers
/* smooth blotchy noise (for the texture inside nebulae) */
function vnoise(x,y,seed){
  const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
  const h=(i,j)=>hashInts(i+seed*131,j+seed*71)/4294967296;
  return h(xi,yi)*(1-u)*(1-v)+h(xi+1,yi)*u*(1-v)+h(xi,yi+1)*(1-u)*v+h(xi+1,yi+1)*u*v;
}
const fbm=(x,y,s)=>vnoise(x,y,s)*.55+vnoise(x*2.1,y*2.1,s+7)*.3+vnoise(x*4.3,y*4.3,s+13)*.15;

/* Star colours: 0 = hot blue-white … 1 = cool orange. Each triple sums to ≈3 so brightness is preserved. */
function starColor(t){
  const stops=[[0.85,0.95,1.2],[1,1,1],[1.1,1.0,0.8],[1.25,0.92,0.6]],x=clamp(t,0,.999)*3,i=Math.floor(x),f=x-i,a=stops[i],b=stops[i+1];
  return [a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f];
}

/* =====================================================================
   1. PAINTING THE NOISE-FREE SKY PATCH
   ===================================================================== */
/* Project a sky position onto the picture. Uses the "gnomonic" (flat-photo) projection around the centre,
   then rotates it so that UP in the picture means "towards the zenith" – that is how an alt-az camera sees the sky. */
function makeProjector(ra0,dec0,q){
  const sd0=Math.sin(dec0*D2R),cd0=Math.cos(dec0*D2R),cq=Math.cos(q*D2R),sq=Math.sin(q*D2R);
  return function(ra,dec){
    const dr=(ra-ra0)*D2R,sd=Math.sin(dec*D2R),cd=Math.cos(dec*D2R),cosc=sd0*sd+cd0*cd*Math.cos(dr);
    if(cosc<=0.01)return null;
    const x=cd*Math.sin(dr)/cosc*R2D,y=(cd0*sd-sd0*cd*Math.cos(dr))/cosc*R2D;   // x = east, y = north (degrees on the flat photo)
    const u=-x,v=y;                                                             // standard sky picture: north up, east LEFT
    return {px:IMG.w/2+(u*cq+v*sq)/IMG.deg,py:IMG.h/2-(-u*sq+v*cq)/IMG.deg};    // then rotate so the zenith is up
  };
}

/* Add one star as a small blurred dot (a tiny Gaussian bump); bright stars also get a faint wide halo. */
function addStar(plane,px,py,flux,col){
  const R=2,ix=Math.round(px),iy=Math.round(py);
  if(ix<-6||iy<-6||ix>IMG.w+6||iy>IMG.h+6)return;
  const k=1/(2*PSF_SIGMA*PSF_SIGMA);
  for(let y=iy-R;y<=iy+R;y++){if(y<0||y>=IMG.h)continue;for(let x=ix-R;x<=ix+R;x++){if(x<0||x>=IMG.w)continue;
    const d2=(x-px)*(x-px)+(y-py)*(y-py),v=flux*Math.exp(-d2*k)*k/Math.PI,i=(y*IMG.w+x)*3;
    plane[i]+=v*col[0];plane[i+1]+=v*col[1];plane[i+2]+=v*col[2];}}
  if(flux>ZP*Math.pow(10,-0.4*11)){                   // brighter than magnitude 11 → halo
    const Rh=7,kh=1/(2*2.4*2.4),fh=flux*0.07;
    for(let y=iy-Rh;y<=iy+Rh;y++){if(y<0||y>=IMG.h)continue;for(let x=ix-Rh;x<=ix+Rh;x++){if(x<0||x>=IMG.w)continue;
      const d2=(x-px)*(x-px)+(y-py)*(y-py),v=fh*Math.exp(-d2*kh)*kh/Math.PI,i=(y*IMG.w+x)*3;
      plane[i]+=v*col[0];plane[i+1]+=v*col[1];plane[i+2]+=v*col[2];}}
  }
}
const magFlux=m=>ZP*Math.pow(10,-0.4*m);              // electrons/second for a magnitude-m source

/* Paint a smooth elliptical blob: `prof(r)` is the brightness profile (r = distance in "scale lengths").
   `total` is the object's total flux; `norm` is the area (in square pixels) that the profile covers when integrated,
   so that amp = total/norm makes the whole blob add up to exactly `total`. */
function addBlob(plane,cx,cy,a,b,rotDeg,total,prof,norm,col,tex,reach){
  const c=Math.cos(rotDeg*D2R),s=Math.sin(rotDeg*D2R),ext=Math.ceil(Math.max(a,b)*reach),amp=total/norm;
  const x0=Math.max(0,Math.floor(cx-ext)),x1=Math.min(IMG.w-1,Math.ceil(cx+ext)),y0=Math.max(0,Math.floor(cy-ext)),y1=Math.min(IMG.h-1,Math.ceil(cy+ext));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const dx=x-cx,dy=y-cy,xr=(dx*c+dy*s)/a,yr=(-dx*s+dy*c)/b,r=Math.sqrt(xr*xr+yr*yr);
    if(r>reach)continue;
    const v=amp*prof(r)*(tex?tex(x,y):1),i=(y*IMG.w+x)*3;
    plane[i]+=v*col[0];plane[i+1]+=v*col[1];plane[i+2]+=v*col[2];
  }
}

/* Faint "field stars" that fill the picture. We invent them from a grid of sky cells: each cell always produces the
   same stars (seeded by its position), so the star field is the same every time you point at the same place. */
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
      // more stars towards the Milky Way: use galactic latitude (angle above/below the galactic plane)
      const raC=(i+.5)*cellW,sb=Math.sin(decC*D2R)*0.8899+cd*0.4560*Math.cos((raC-192.86)*D2R),gb=Math.asin(clamp(sb,-1,1))*R2D;
      const dens=60*Math.pow(10,SLOPE*(MMAX-12))*(0.45+4.5*Math.exp(-(gb/14)*(gb/14)));   // stars per square degree
      const lam=CELL*cellW*cd*dens,n=Math.max(0,Math.round(lam+Math.sqrt(lam)*gauss(rnd)));
      for(let k=0;k<n;k++){
        const m=MMAX+Math.log10(Math.max(1e-6,rnd()))/SLOPE,ra=(i+rnd())*cellW,dec=(b+rnd())*CELL,ct=rnd();
        if(m>=8)cb(ra,dec,m,ct);                     // brighter stars come from the real catalog instead
      }
    }
  }
}

/* Paint everything in the telescope's field of view.
   Returns two pictures: bb = broadband light (stars, galaxies, clusters) and em = emission-nebula light.
   (The dual-band filter treats those two very differently!) */
function buildSignal(ra0,dec0,q0){
  const bb=new Float32Array(NPX*3),em=new Float32Array(NPX*3),proj=makeProjector(ra0,dec0,q0);
  const diag=Math.hypot(IMG.w,IMG.h)/2*IMG.deg;       // half the picture's diagonal, in degrees
  // 1) invented faint field stars
  fieldStars(ra0,dec0,diag+0.05,(ra,dec,m,ct)=>{const p=proj(ra,dec);if(p)addStar(bb,p.px,p.py,magFlux(m),starColor(ct));});
  // 2) real catalog objects
  for(const o of OBJ){
    if(o.cra==null||o.type==='sun'||o.type==='moon')continue;
    const sizeDeg=(o.size||0)/60,sepApprox=angSep({ra:o.cra,dec:o.cdec},{ra:ra0,dec:dec0});
    if(sepApprox>diag+sizeDeg/2+0.1)continue;
    const p=proj(o.cra,o.cdec);if(!p)continue;
    const rnd=mulberry32(hashStr(o.id)),arcminPx=60/IMG.scale;       // display pixels per arcminute (≈5)
    if(o.type==='star'){addStar(bb,p.px,p.py,magFlux(o.mag),starColor(rnd()));}
    else if(o.type==='planet'){
      const rpx=Math.max(0.9,(o.diam*3600/IMG.scale)/2),col={mercury:[1,.95,.9],venus:[1.1,1.05,.9],mars:[1.4,.8,.55],jupiter:[1.15,1.0,.82],saturn:[1.15,1.05,.8]}[o.id]||[1,1,1];
      addBlob(bb,p.px,p.py,rpx*.8,rpx*.8,0,magFlux(o.mag),r=>Math.exp(-r*r),Math.PI*(rpx*.8)*(rpx*.8),col,null,3);
    }
    else if(o.type==='dso'){
      const sz=Math.max(0.5,o.size||1)*arcminPx,ar=clamp(o.ar||1,.25,1),rot=(o.rot||0),F=magFlux(o.mag);
      if(o.kind==='gal'){                              // galaxy: exponential disc + bright core, warm centre / blue arms
        const a=sz/2/2.6,b=a*ar;
        addBlob(bb,p.px,p.py,a,b,rot,F*.75,r=>Math.exp(-r),2*Math.PI*a*b,[0.85,0.97,1.15],null,6);
        addBlob(bb,p.px,p.py,a*.22,b*.3,rot,F*.25,r=>Math.exp(-r*r/2),2*Math.PI*(a*.22)*(b*.3),[1.2,1.0,.78],null,3.5);
      }else if(o.kind==='neb'){                        // emission nebula: soft glow with blotchy texture, pink-red
        const a=sz/2/1.7,b=a*clamp(ar,.4,1),seed=hashStr(o.id)%97,tex=(x,y)=>0.35+1.5*Math.pow(fbm(x/(a*.45+2),y/(a*.45+2),seed),1.6);
        addBlob(em,p.px,p.py,a,b,rot,F*.55,r=>Math.exp(-r*r/2),2*Math.PI*a*b,[1.55,0.55,0.5],tex,3.2);                 // wide red glow
        addBlob(em,p.px,p.py,a*.3,b*.3,rot,F*.3,r=>Math.exp(-r*r/2),2*Math.PI*(a*.3)*(b*.3),[1.1,0.9,0.9],tex,3);      // brighter middle
        addBlob(em,p.px,p.py,a*.09,b*.09,rot,F*.15,r=>Math.exp(-r*r/2),2*Math.PI*(a*.09)*(b*.09),[0.85,1.25,1.1],tex,3); // small teal (OIII) core
      }else if(o.kind==='pn'){                         // planetary nebula: a glowing ring
        const R=sz/2,w=Math.max(1.1,R*.35);
        addBlob(em,p.px,p.py,R*1.5,R*1.5*clamp(ar,.5,1),rot,F,r=>Math.exp(-Math.pow((r*1.5*R-R*.75)/w,2)),2*Math.PI*(R*.75)*w*Math.sqrt(Math.PI)*clamp(ar,.5,1),[0.5,1.3,1.25],null,1.05);
        addStar(bb,p.px,p.py,magFlux(14.5),[1,1,1]);   // central star (very faint in reality)
      }else if(o.kind==='oc'){                         // open cluster: a loose scatter of stars
        const R=sz/2/1.5,n=Math.round(clamp(25+(o.size||5)*1.5,25,140));
        for(let k=0;k<n;k++){const rr=R*Math.sqrt(-2*Math.log(Math.max(1e-6,rnd())))*.6,th=rnd()*6.2832,m=o.mag+1.2+4.2*Math.pow(rnd(),.6);addStar(bb,p.px+rr*Math.cos(th),p.py+rr*Math.sin(th),magFlux(m),starColor(rnd()*.7));}
      }else if(o.kind==='gc'){                         // globular cluster: dense glowing core plus many stars
        const R=sz/2/3.2;
        addBlob(bb,p.px,p.py,R*.6,R*.6,0,F*.85,r=>1/Math.pow(1+r*r,1.5),2*Math.PI*(R*.6)*(R*.6),[1.1,1.0,.85],null,5);
        for(let k=0;k<160;k++){const rr=R*1.6*Math.sqrt(-2*Math.log(Math.max(1e-6,rnd()))),th=rnd()*6.2832,m=o.mag+2.8+4.5*Math.pow(rnd(),.7);addStar(bb,p.px+rr*Math.cos(th),p.py+rr*Math.sin(th),magFlux(m),starColor(.45+rnd()*.5));}
      }
    }
  }
  return {bb,em};
}

/* =====================================================================
   2. THE STACKER
   ===================================================================== */
class Stacker{
  constructor(){this.on=false;this.clear();this.exposure=10;this.gain=80;this.brightness=1;this.mode='stack';this.flt='ircut';}
  clear(){
    this.S=new Float32Array(NPX*3);                  // running sum of electrons (per colour channel)
    this.T=new Float32Array(NPX);                    // total exposure time seen by each pixel (seconds)
    this.last=new Float32Array(NPX*3);               // the most recent single photo (for "Single photo" view)
    this.N=0;this.dropped=0;this.acc=0;this.tTotal=0;this.rot=0;this.rotRate=0;
    this.sig=null;this.ref=null;this.target=null;this.noiseRef=1;this.sigmaFrame=1;this.dirty=true;
  }
  /* Get ready for whatever the mount is pointing at: paint the noise-free sky patch once (this takes a moment). */
  prepare(mount){
    if(mount.mode!=='track'||!mount.target)return false;
    this.clear();
    const eq=horToEq(mount.alt,mount.az,jdNow());
    this.target=mount.target;this.lunar=mount.target.type==='moon';
    this.ref={ra:eq.ra,dec:eq.dec,q:parallacticAngle(mount.az,mount.alt),t:simMs};
    this.sig=this.lunar?null:buildSignal(eq.ra,eq.dec,this.ref.q);
    return true;
  }
  /* Begin stacking whatever the mount is pointing at. */
  start(mount){
    if(mount.mode!=='track'||!mount.target)return false;
    const ready=this.target===mount.target&&(this.sig||this.lunar);     // already prepared for this target?
    if(!ready&&!this.prepare(mount))return false;
    if(this.N===0){this.S.fill(0);this.T.fill(0);}                      // drop the single preview photo
    this.on=true;this.dirty=true;return true;
  }
  /* The live view before you press Start: one noisy photo, refreshed every second or so (not counted in the stack). */
  preview(mount){
    if(this.N>0||!this.sig||mount.mode!=='track'||!mount.coverOpen)return;
    const tr=transparency(mount.alt,mount.dew);if(tr<0.12)return;
    this.S.fill(0);this.T.fill(0);this._addFrames(1,mount,tr);this.N=0;this.tTotal=0;
  }
  stop(){this.on=false;}
  /* Called every frame with simulated seconds elapsed. Adds as many photos as are "due". */
  update(simDt,mount){
    if(!this.on)return;
    this.acc+=simDt;
    const due=Math.floor(this.acc/this.exposure);if(due<1)return;
    const k=due;this.acc-=k*this.exposure;
    // Is this a usable photo? Needs a tracked target, an open arm, and some light getting through.
    const tr=transparency(mount.alt,mount.dew);
    if(mount.mode!=='track'||!mount.coverOpen||tr<0.12||mount.target!==this.target){this.dropped+=k;this.reason=mount.mode!=='track'?'not tracking':!mount.coverOpen?'arm closed':'too cloudy';return;}
    this.reason='';
    const lost=Math.round(k*0.03*Math.random());     // wind gusts / satellites spoil an occasional photo
    this.dropped+=lost;const keep=k-lost;if(keep<=0)return;
    if(this.lunar){this.N+=keep;this.tTotal+=keep*this.exposure;this.dirty=true;return;}
    this._addFrames(keep,mount,tr);
  }
  _addFrames(k,mount,tr){
    const t=this.exposure,f=FILTERS[this.flt||'ircut'],sky=skyRate(mount.az,mount.alt)*f.sky*tr*t;   // sky-glow electrons per photo per display pixel
    const rn=readNoise(this.gain)*IMG.bin,varBase=rn*rn+sky;                                         // noise variance: read noise (summed over bin×bin pixels) + sky shot noise
    // Field rotation: the sky turns in the picture; stacking re-aligns the stars, so the corners of the original frame drop out.
    const q=parallacticAngle(mount.az,mount.alt),dq=wrap180(q-this.ref.q);this.rotRate=this.N>0?(dq-this.rot)/Math.max(1e-6,(simMs-this.lastMs)/60000):0;this.rot=dq;this.lastMs=simMs;
    const cd=Math.cos(dq*D2R),sd=Math.sin(dq*D2R),hw=IMG.w/2,hh=IMG.h/2;
    const {bb,em}=this.sig,sc=tr*t*k,bbp=f.bb,emp=f.em,S=this.S,T=this.T,L=this.last;
    const rnd=Math.random;let spare=null;
    const g=()=>{if(spare!==null){const s=spare;spare=null;return s;}let u=1-rnd(),v=rnd();const m=Math.sqrt(-2*Math.log(u));spare=m*Math.sin(6.283185307*v);return m*Math.cos(6.283185307*v);};
    for(let y=0,p=0;y<IMG.h;y++){
      const dy=y-hh;
      for(let x=0;x<IMG.w;x++,p++){
        const dx=x-hw,fx=dx*cd-dy*sd,fy=dx*sd+dy*cd;
        if(Math.abs(fx)>hw||Math.abs(fy)>hh)continue;                 // this pixel was outside the rotated frame
        const i3=p*3;
        for(let c=0;c<3;c++){
          const mean=(bb[i3+c]*bbp+em[i3+c]*emp)*sc;                  // electrons collected from the object itself (k photos)
          // Noise = bell-curve random number × sqrt(read noise + sky glow + the object's own shot noise), all added as variances
          const n=Math.sqrt(k*varBase+Math.max(0,mean))*g();
          S[i3+c]+=mean+n;L[i3+c]=(mean+n)/k;
        }
        T[p]+=t*k;
      }
    }
    this.N+=k;this.tTotal+=k*t;this.sigmaFrame=Math.sqrt(varBase);this.dirty=true;
    // "Stretch reference": noise in a typical single 10 s photo, in electrons per second. The picture is stretched by this,
    // so a single photo looks grainy and a long stack looks smooth – as in the real app.
    const sk10=skyRate(mount.az,mount.alt)*f.sky*tr*10;this.noiseRef=Math.sqrt(rn*rn+sk10)/10;
  }

  /* Estimate the faintest star that stands out (signal-to-noise ≥ 5) in the current stack. */
  limitingMag(mount){
    if(!this.N)return null;
    const f=FILTERS[this.flt||'ircut'],tr=transparency(mount.alt,mount.dew),t=this.exposure;
    const rn=readNoise(this.gain)*IMG.bin,vf=rn*rn+skyRate(mount.az,mount.alt)*f.sky*tr*t,neff=4*Math.PI*PSF_SIGMA*PSF_SIGMA;
    const need=5*Math.sqrt(neff*this.N*vf);          // electrons needed in total for SNR 5
    return -2.5*Math.log10(need/(ZP*f.bb*tr*t*this.N));
  }

  /* Draw the picture into a 2D canvas context (an offscreen canvas of IMG.w × IMG.h). */
  render(ctx,img){
    const d=img.data,single=this.mode==='single',S=single?this.last:this.S,br=this.brightness,ref=this.noiseRef||1;
    const s0=1.5,lo=Math.asinh(-2/s0),span=Math.asinh(250/s0)-lo;
    for(let p=0;p<NPX;p++){
      const T=this.T[p],o=p*4;
      if(T<=0){d[o]=d[o+1]=d[o+2]=0;d[o+3]=255;continue;}
      const rate=single?1/this.exposure:1/T;         // convert electrons → electrons per second
      for(let c=0;c<3;c++){
        const v=S[p*3+c]*rate/ref*br,x=(Math.asinh(v/s0)-lo)/span;
        d[o+c]=x<=0?0:x>=1?255:x*255;
      }
      d[o+3]=255;
    }
    ctx.putImageData(img,0,0);
  }
}

/* =====================================================================
   3. THE MOON (too bright and too big to stack – drawn straight from a photo, with the right phase)
   ===================================================================== */
function drawMoon(ctx,moonImg,mount){
  const W=ctx.canvas.width,H=ctx.canvas.height;ctx.fillStyle='#02030a';ctx.fillRect(0,0,W,H);
  const R=(MOON.diam*3600/IMG.scale/2)*(W/IMG.w);   // Moon's radius in canvas pixels (the Moon is about half a degree wide)
  const cx=W/2,cy=H/2;
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,R,0,6.2832);ctx.clip();
  if(moonImg&&moonImg.complete&&moonImg.naturalWidth)ctx.drawImage(moonImg,cx-R,cy-R,2*R,2*R);else{ctx.fillStyle='#bbb';ctx.fill();}
  // which way is the Sun, as seen from the Moon, on this zenith-up picture?
  const dA=(SUN.az-MOON.az)*D2R,aS=SUN.alt*D2R,aM=MOON.alt*D2R;
  const th=Math.atan2(Math.sin(dA)*Math.cos(aS),Math.cos(aM)*Math.sin(aS)-Math.sin(aM)*Math.cos(aS)*Math.cos(dA));
  const k=MOON.illum,b=R*(1-2*k),pts=[];
  for(let a=0;a<=Math.PI;a+=Math.PI/48)pts.push([R*Math.cos(a),R*Math.sin(a)]);          // sunny edge
  for(let a=Math.PI;a>=0;a-=Math.PI/48)pts.push([R*Math.cos(a),b*Math.sin(a)]);          // terminator (day/night line)
  const rot=([x,y])=>[cx+x*Math.cos(th)+y*Math.sin(th),cy-(-x*Math.sin(th)+y*Math.cos(th))];
  ctx.beginPath();ctx.rect(cx-R-2,cy-R-2,2*R+4,2*R+4);                                   // dark overlay everywhere EXCEPT the lit shape
  ctx.moveTo(...rot(pts[0]));for(const p of pts)ctx.lineTo(...rot(p));ctx.closePath();
  ctx.fillStyle='rgba(2,3,8,.93)';ctx.fill('evenodd');
  ctx.restore();
}
