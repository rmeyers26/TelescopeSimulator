/* Telescope Simulator – 01-core-astro.js
   Classic script (not an ES module) so the page also works when opened straight from disk.
   All files share one global scope and must load in numeric order (see index.html). */
'use strict';
if(!window.THREE){document.body.insertAdjacentHTML('beforeend','<p style="padding:2em;position:fixed;z-index:9">Three.js could not be loaded (network blocked).</p>');throw new Error('Three.js could not be loaded');}
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const D2R=Math.PI/180,R2D=180/Math.PI;
const norm360=a=>((a%360)+360)%360, wrap180=a=>((a+540)%360)-180, clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

/* =====================================================================
   1. ASTRONOMY MATH  (no DOM use in this block so it can be unit-tested)
   ===================================================================== */
//<ASTRO>
const obs={lat:33.448,lon:-112.074};            // observer (degrees; east longitude positive)
let simMs=Date.now();                        // simulated clock (ms since epoch)
const jdNow=()=>simMs/86400000+2440587.5;
const lstDeg=jd=>norm360(280.46061837+360.98564736629*(jd-2451545.0)+obs.lon);
function eqToHor(ra,dec,jd){                 // RA/Dec (deg) -> altitude/azimuth (deg, az from north through east)
  const H=(lstDeg(jd)-ra)*D2R,d=dec*D2R,p=obs.lat*D2R;
  const alt=Math.asin(Math.sin(d)*Math.sin(p)+Math.cos(d)*Math.cos(p)*Math.cos(H));
  const az=Math.atan2(-Math.cos(d)*Math.sin(H),Math.sin(d)*Math.cos(p)-Math.cos(d)*Math.sin(p)*Math.cos(H));
  return {alt:alt*R2D,az:norm360(az*R2D)};
}
function horToEq(alt,az,jd){
  const a=alt*D2R,A=az*D2R,p=obs.lat*D2R;
  const dec=Math.asin(Math.sin(a)*Math.sin(p)+Math.cos(a)*Math.cos(p)*Math.cos(A));
  const H=Math.atan2(-Math.sin(A)*Math.cos(a),Math.sin(a)*Math.cos(p)-Math.cos(a)*Math.sin(p)*Math.cos(A));
  return {ra:norm360(lstDeg(jd)-H*R2D),dec:dec*R2D};
}
function precess(ra,dec,jd){                 // first-order J2000 -> date
  const T=(jd-2451545)/365.25,a=ra*D2R,d=dec*D2R;
  return {ra:norm360(ra+(46.1+20.04*Math.sin(a)*Math.tan(d))*T/3600),dec:dec+20.04*Math.cos(a)*T/3600};
}
function kepler(M,e){M=norm360(M)*D2R;let E=M+e*Math.sin(M)*(1+e*Math.cos(M));for(let i=0;i<8;i++)E-=(E-e*Math.sin(E)-M)/(1-e*Math.cos(E));return E;}
// Orbital elements (Schlyter low-precision): [N0,N1,i0,i1,w0,w1,a,e0,e1,M0,M1]
const EL={
 Mercury:[48.3313,3.24587e-5,7.0047,5.0e-8,29.1241,1.01444e-5,0.387098,0.205635,5.59e-10,168.6562,4.0923344368],
 Venus:[76.6799,2.46590e-5,3.3946,2.75e-8,54.8910,1.38374e-5,0.723330,0.006773,-1.302e-9,48.0052,1.6021302244],
 Mars:[49.5574,2.11081e-5,1.8497,-1.78e-8,286.5016,2.92961e-5,1.523688,0.093405,2.516e-9,18.6021,0.5240207766],
 Jupiter:[100.4542,2.76854e-5,1.3030,-1.557e-7,273.8777,1.64505e-5,5.20256,0.048498,4.469e-9,19.8950,0.0830853001],
 Saturn:[113.6634,2.38980e-5,2.4886,-1.081e-7,339.3939,2.97661e-5,9.55475,0.055546,-9.499e-9,316.9670,0.0334442282]};
function sunGeo(d){
  const w=282.9404+4.70935e-5*d,e=0.016709-1.151e-9*d,M=356.0470+0.9856002585*d,E=kepler(M,e);
  const xv=Math.cos(E)-e,yv=Math.sqrt(1-e*e)*Math.sin(E),r=Math.hypot(xv,yv),lon=(Math.atan2(yv,xv)*R2D+w)*D2R;
  return {x:r*Math.cos(lon),y:r*Math.sin(lon),r};
}
function eclToEq(x,y,z,d){
  const ob=(23.4393-3.563e-7*d)*D2R,ye=y*Math.cos(ob)-z*Math.sin(ob),ze=y*Math.sin(ob)+z*Math.cos(ob);
  return {ra:norm360(Math.atan2(ye,x)*R2D),dec:Math.atan2(ze,Math.hypot(x,ye))*R2D,dist:Math.hypot(x,ye,ze)};
}
function planetEq(n,d){
  const e=EL[n],N=(e[0]+e[1]*d)*D2R,i=(e[2]+e[3]*d)*D2R,w=(e[4]+e[5]*d)*D2R,a=e[6],ec=e[7]+e[8]*d,M=e[9]+e[10]*d;
  const E=kepler(M,ec),xv=a*(Math.cos(E)-ec),yv=a*Math.sqrt(1-ec*ec)*Math.sin(E),v=Math.atan2(yv,xv),r=Math.hypot(xv,yv),vw=v+w;
  const xh=r*(Math.cos(N)*Math.cos(vw)-Math.sin(N)*Math.sin(vw)*Math.cos(i));
  const yh=r*(Math.sin(N)*Math.cos(vw)+Math.cos(N)*Math.sin(vw)*Math.cos(i));
  const zh=r*Math.sin(vw)*Math.sin(i),s=sunGeo(d);
  return eclToEq(xh+s.x,yh+s.y,zh,d);
}
function moonEq(d){                          // geocentric, with the main perturbation terms; dist in Earth radii
  const N=125.1228-0.0529538083*d,i=5.1454*D2R,w=318.0634+0.1643573223*d,a=60.2666,e=0.0549,M=115.3654+13.0649929509*d;
  const E=kepler(M,e),xv=a*(Math.cos(E)-e),yv=a*Math.sqrt(1-e*e)*Math.sin(E),v=Math.atan2(yv,xv)*R2D,r=Math.hypot(xv,yv);
  const Ms=356.0470+0.9856002585*d,Ls=Ms+282.9404+4.70935e-5*d,Lm=M+w+N,D=Lm-Ls,F=Lm-N;
  const s=x=>Math.sin(x*D2R),c=x=>Math.cos(x*D2R),Nr=N*D2R,vw=(v+w)*D2R;
  const xh=r*(Math.cos(Nr)*Math.cos(vw)-Math.sin(Nr)*Math.sin(vw)*Math.cos(i));
  const yh=r*(Math.sin(Nr)*Math.cos(vw)+Math.cos(Nr)*Math.sin(vw)*Math.cos(i)),zh=r*Math.sin(vw)*Math.sin(i);
  let lon=Math.atan2(yh,xh)*R2D,lat=Math.atan2(zh,Math.hypot(xh,yh))*R2D;
  lon+=-1.274*s(M-2*D)+0.658*s(2*D)-0.186*s(Ms)-0.059*s(2*M-2*D)-0.057*s(M-2*D+Ms)+0.053*s(M+2*D)+0.046*s(2*D-Ms)+0.041*s(M-Ms)-0.035*s(D)-0.031*s(M+Ms)-0.015*s(2*F-2*D)+0.011*s(M-4*D);
  lat+=-0.173*s(F-2*D)-0.055*s(M-F-2*D)-0.046*s(M+F-2*D)+0.033*s(F+2*D)+0.017*s(2*M+F);
  const rr=r-0.58*c(M-2*D)-0.46*c(2*D),lo=lon*D2R,la=lat*D2R;
  const q=eclToEq(rr*Math.cos(la)*Math.cos(lo),rr*Math.cos(la)*Math.sin(lo),rr*Math.sin(la),d);q.dist=rr;return q;
}
const angSep=(a,b)=>{const x=Math.sin(a.dec*D2R)*Math.sin(b.dec*D2R)+Math.cos(a.dec*D2R)*Math.cos(b.dec*D2R)*Math.cos((a.ra-b.ra)*D2R);return Math.acos(clamp(x,-1,1))*R2D;};
//</ASTRO>

