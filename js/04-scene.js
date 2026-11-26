/* Telescope Simulator – 04-scene.js
   Classic script (not an ES module) so the page also works when opened straight from disk.
   All files share one global scope and must load in numeric order (see index.html). */
'use strict';
/* =====================================================================
   4. THREE.JS SCENE
   ===================================================================== */
const cv=$('#gl');
const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.localClippingEnabled=true;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x050810);scene.fog=new THREE.Fog(0x050810,40,140);
const camera=new THREE.PerspectiveCamera(45,1,0.05,600);

// --- procedural environment map so metal and glass have something to reflect
(function(){
  const es=new THREE.Scene(),g=new THREE.SphereGeometry(20,32,16),col=[],p=g.attributes.position;
  for(let i=0;i<p.count;i++){const y=p.getY(i)/20,c=new THREE.Color();
    if(y>0)c.setRGB(.06+.1*(1-y),.09+.12*(1-y),.18+.2*(1-y));else c.setRGB(.05,.045,.04);col.push(c.r,c.g,c.b);}
  g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(col),3));
  es.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide})));
  [[8,10,6,5],[-9,6,-4,2.5],[0,12,-9,3]].forEach(([x,y,z,k])=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(7,4),new THREE.MeshBasicMaterial({color:new THREE.Color(k,k,k*1.05),side:THREE.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);es.add(m);});
  const pm=new THREE.PMREMGenerator(renderer);scene.environment=pm.fromScene(es,0.04).texture;pm.dispose();
})();
// low-key cinematic lighting: warm key (casts the shadow), cool rim lights from behind, a soft overhead spot pool
const hemi=new THREE.HemisphereLight(0x8fa8ff,0x120e0a,0.18);scene.add(hemi);
const keyL=new THREE.DirectionalLight(0xffe3c2,.9);keyL.position.set(4,6,5);keyL.castShadow=true;keyL.shadow.mapSize.set(2048,2048);
Object.assign(keyL.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:1,far:20});keyL.shadow.bias=-0.0006;keyL.shadow.radius=3;scene.add(keyL);
const fill=new THREE.DirectionalLight(0x5f7fff,0.18);fill.position.set(-5,3,-4);scene.add(fill);
const rimA=new THREE.DirectionalLight(0x6fa0ff,.45);rimA.position.set(-3,3.2,-6);scene.add(rimA);        // cool rim, behind left
const rimB=new THREE.DirectionalLight(0xffa860,.35);rimB.position.set(6,2.5,-4);scene.add(rimB);         // warm rim, behind right
const pool=new THREE.SpotLight(0xfff1dd,.9,14,.42,.85,1.5);pool.position.set(1.5,6,2);pool.target.position.set(0,1,0);scene.add(pool,pool.target);
// floating dust lit by the key light, for atmosphere
const dustN=220,dustG=new THREE.BufferGeometry(),dustP=new Float32Array(dustN*3);
for(let i=0;i<dustN;i++){dustP[i*3]=(Math.random()-.5)*7;dustP[i*3+1]=Math.random()*4;dustP[i*3+2]=(Math.random()-.5)*7;}
dustG.setAttribute('position',new THREE.BufferAttribute(dustP,3));
const dustTex=(()=>{const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d'),g=x.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,32,32);return new THREE.CanvasTexture(c);})();
const dust=new THREE.Points(dustG,new THREE.PointsMaterial({size:.03,map:dustTex,transparent:true,opacity:.35,depthWrite:false,blending:THREE.AdditiveBlending,color:0xffe9cc}));dust.frustumCulled=false;scene.add(dust);

// --- textures
function canvasTex(w,h,draw,srgb){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);if(srgb)t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return t;}
const brushTex=canvasTex(128,128,(x,w,h)=>{x.fillStyle='#808080';x.fillRect(0,0,w,h);for(let i=0;i<500;i++){x.fillStyle=`rgba(${Math.random()<.5?255:0},${Math.random()<.5?255:0},128,.07)`;x.fillRect(0,Math.random()*h,w,1);}});
brushTex.wrapS=brushTex.wrapT=THREE.RepeatWrapping;brushTex.repeat.set(1,1);brushTex.minFilter=THREE.LinearMipmapLinearFilter;
const groundTex=canvasTex(512,512,(x,w,h)=>{x.fillStyle='#2a251d';x.fillRect(0,0,w,h);for(let i=0;i<5000;i++){const v=20+Math.random()*40|0;x.fillStyle=`rgba(${v+14},${v+8},${v-4},.5)`;x.fillRect(Math.random()*w,Math.random()*h,2,2);}},true);
groundTex.wrapS=groundTex.wrapT=THREE.RepeatWrapping;groundTex.repeat.set(40,40);
const labelTex=canvasTex(128,512,(x,w,h)=>{x.clearRect(0,0,w,h);x.translate(w/2,h/2);x.rotate(-Math.PI/2);x.fillStyle='#10131a';x.font='bold 34px system-ui';x.textAlign='center';x.fillText('C11',-130,-6);x.font='15px system-ui';x.fillText('SCHMIDT-CASSEGRAIN  279 mm  f/10',40,-12);x.fillRect(-190,6,400,2);x.fillText('SIMULATED MODEL – NOT AN OFFICIAL RENDERING',20,26);},true);

const panelTex=canvasTex(512,220,(x,w,h)=>{                      // arched silver port plate on the front of the drive base (CPC Deluxe HD layout); outside the arch is transparent
  x.clearRect(0,0,w,h);
  const arch=()=>{x.beginPath();x.moveTo(8,h-8);x.lineTo(8,120);x.bezierCurveTo(8,40,150,14,256,14);x.bezierCurveTo(362,14,504,40,504,120);x.lineTo(504,h-8);x.closePath();};
  arch();const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#d9dbe0');g.addColorStop(1,'#b3b6bd');x.fillStyle=g;x.fill();x.strokeStyle='#6f727a';x.lineWidth=3;x.stroke();
  [[40,112],[472,112],[136,46],[376,46],[40,196],[472,196],[196,200],[316,200]].forEach(([sx,sy])=>{x.fillStyle='#8c9097';x.beginPath();x.arc(sx,sy,6,0,7);x.fill();x.fillStyle='#e6e8ec';x.beginPath();x.arc(sx-1.5,sy-1.5,2.5,0,7);x.fill();});
  x.fillStyle='#2b2d33';x.textAlign='center';x.font='600 36px system-ui';x.fillText('CPC DELUXE',230,82);
  x.fillStyle='#fff';x.fillRect(338,52,58,38);x.strokeStyle='#c4161c';x.lineWidth=4;x.strokeRect(340,54,54,34);x.fillStyle='#c4161c';x.font='bold 30px system-ui';x.fillText('HD',367,82);
  x.fillStyle='#2b2d33';x.font='600 17px system-ui';x.fillText('SERIES',350,108);x.fillRect(160,94,150,2);
  const port=(px,py,t)=>{x.fillStyle='#2b2d33';x.font='bold 11px system-ui';t.split('\n').forEach((l,i,A)=>x.fillText(l,px,py-10-(A.length-1-i)*12));
    x.fillStyle='#08090b';x.fillRect(px-20,py,40,32);x.fillStyle='#2e3137';x.fillRect(px-13,py+5,26,8);};
  port(86,108,'HAND\nCONTROL');port(156,150,'AUX 1');port(222,150,'AUX 2');port(356,150,'P C');port(426,108,'AUTO\nGUIDER');
},true);
const badgeTex=canvasTex(256,256,(x,w,h)=>{x.fillStyle='#1b1c20';x.fillRect(0,0,w,h);x.fillStyle='#3b3d44';x.beginPath();x.arc(128,128,118,0,7);x.fill();x.fillStyle='#16171b';x.beginPath();x.arc(128,128,104,0,7);x.fill();
  x.strokeStyle='#ff8a3d';x.lineWidth=22;x.lineCap='round';x.beginPath();x.arc(98,128,52,-2.2,2.2);x.stroke();x.strokeStyle='#d8dae0';x.lineWidth=14;x.beginPath();x.arc(150,128,36,-2.4,2.4);x.stroke();},true);
const hcTex=canvasTex(256,780,(x,w,h)=>{          // front face of the NexStar+ handset: LCD, soft keys, arrow pad, number keys
  x.fillStyle='#2b2d31';x.fillRect(0,0,w,h);
  for(let i=0;i<4000;i++){x.fillStyle=`rgba(255,255,255,${Math.random()*.05})`;x.fillRect(Math.random()*w,Math.random()*h,1.5,1.5);}   // textured plastic
  x.fillStyle='#0d0f10';x.fillRect(22,50,212,118);x.fillStyle='#2a0a06';x.fillRect(30,58,196,74);
  x.fillStyle='#ff5a3c';x.font='bold 18px monospace';x.fillText('CPC Deluxe Ready',36,100);
  x.fillStyle='#c9ccd2';x.font='italic 17px system-ui';x.fillText('NexStar +',34,158);
  const btn=(cx,cy,r,t,fs)=>{x.fillStyle='#d9dadd';x.beginPath();x.arc(cx,cy,r,0,7);x.fill();x.fillStyle='#4a4d55';x.font=(fs||11)+'px system-ui';x.textAlign='center';t.split('\n').forEach((l,i,a)=>x.fillText(l,cx,cy+4+(i-(a.length-1)/2)*11));};
  btn(60,215,24,'ALIGN',12);btn(128,205,24,'ENTER',12);btn(196,215,24,'BACK',12);
  x.fillStyle='#d9dadd';x.beginPath();x.ellipse(128,305,66,44,0,0,7);x.fill();x.fillStyle='#8a8d95';
  [[128,278,0],[128,332,Math.PI],[93,305,-Math.PI/2],[163,305,Math.PI/2]].forEach(([px,py,a])=>{x.save();x.translate(px,py);x.rotate(a);x.beginPath();x.moveTo(0,-11);x.lineTo(10,7);x.lineTo(-10,7);x.fill();x.restore();});
  const keys=[['SOLAR\nSYSTEM',1],['STARS',2],['DEEP\nSKY',3],['IDENTIFY',4],['SKY\nTOUR',5],['SCROLL ▲',6],['MENU',7],['HELP',8],['SCROLL ▼',9],['',0],['OBJECT\nINFO',0],['MOTOR\nSPEED',0]];
  keys.forEach((k,i)=>{const c=i%3,r=(i/3)|0,cx=62+c*68,cy=408+r*78;btn(cx,cy-3,26,k[0],9);if(i<10){x.fillStyle='#22252b';x.font='bold 11px system-ui';x.textAlign='center';x.fillText(String(k[1]===undefined?'':i===9?0:k[1]),cx,cy+20);}});   // the digit each key types
  x.strokeStyle='#e2631b';x.lineWidth=3;x.beginPath();x.arc(62,642,13,.5,6.0);x.stroke();x.fillStyle='#4a5780';x.font='8px system-ui';x.textAlign='center';x.fillText('OPTION',62,670);
  x.fillStyle='#d9dadd';x.font='bold 22px system-ui';x.textAlign='center';x.fillText('CELESTRON',128,756);
},true);

// --- materials (each mesh gets its own clone so it can be highlighted independently)
const BASE={
  orange:new THREE.MeshStandardMaterial({color:0xe2631b,metalness:.4,roughness:.38,roughnessMap:brushTex,side:THREE.DoubleSide}),
  black:new THREE.MeshStandardMaterial({color:0x14161b,metalness:.6,roughness:.42,side:THREE.DoubleSide}),
  blackg:new THREE.MeshStandardMaterial({color:0x17181c,metalness:.1,roughness:.5,envMapIntensity:.6,side:THREE.DoubleSide}),
  white:new THREE.MeshStandardMaterial({color:0xe8eadf,metalness:.08,roughness:.3,side:THREE.DoubleSide}),
  rubber:new THREE.MeshStandardMaterial({color:0x0b0b0d,metalness:0,roughness:.85,side:THREE.DoubleSide}),
  silver:new THREE.MeshStandardMaterial({color:0xc4c8d0,metalness:1,roughness:.28,side:THREE.DoubleSide}),
  steel:new THREE.MeshStandardMaterial({color:0x6b7078,metalness:.9,roughness:.4}),
  glass:new THREE.MeshPhysicalMaterial({color:0xbfd8ff,metalness:0,roughness:.04,transparent:true,opacity:.22,clearcoat:1,side:THREE.DoubleSide,depthWrite:false}),
  mirror:new THREE.MeshStandardMaterial({color:0xe8eeff,metalness:1,roughness:.04,side:THREE.DoubleSide}),
  label:new THREE.MeshStandardMaterial({map:labelTex,transparent:true,roughness:.6,metalness:0,side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),
  hcb:new THREE.MeshStandardMaterial({map:hcTex,roughness:.6,metalness:.1}),
  grip:new THREE.MeshStandardMaterial({color:0x060607,roughness:.6,metalness:0,envMapIntensity:.2,side:THREE.DoubleSide}),
  gloss:new THREE.MeshStandardMaterial({color:0x08090b,metalness:.35,roughness:.1,envMapIntensity:1.4,side:THREE.DoubleSide}),
  panel:new THREE.MeshStandardMaterial({map:panelTex,roughness:.35,metalness:.5,alphaTest:.5,side:THREE.DoubleSide}),
  badge:new THREE.MeshStandardMaterial({map:badgeTex,roughness:.45,metalness:.2}),
  bubble:new THREE.MeshStandardMaterial({color:0xc4e04a,roughness:.15,metalness:0,emissive:0x2a3a05})
};
const ALLM=[],CLIPM=[],EXPL=[];
const V3=(x,y,z)=>new THREE.Vector3(x,y,z);
function G(partId,parent,exp){const g=new THREE.Group();parent.add(g);EXPL.push({g,part:partId,base:g.position.clone(),exp:exp||V3(0,0,0)});return g;}
function M(partId,g,geo,mat,o){o=o||{};const m=new THREE.Mesh(geo,BASE[mat].clone());m.castShadow=!o.noShadow;m.receiveShadow=true;
  m.userData={part:partId,sub:o.sub||null,clip:!!o.clip,o0:{t:m.material.transparent,o:m.material.opacity,d:m.material.depthWrite}};
  if(o.p)m.position.set(...o.p);if(o.r)m.rotation.set(...o.r);g.add(m);ALLM.push(m);if(o.clip)CLIPM.push(m);return m;}
const cylZ=(rt,rb,len,seg,open)=>{const g=new THREE.CylinderGeometry(rt,rb,len,seg||48,1,!!open);g.rotateX(Math.PI/2);return g;}; // axis along +Z, rt at the rear end
const lathe=(pts,seg)=>new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),seg||48);          // spin a (radius,height) outline about the Y axis
const ribbed=(r,len,n,d)=>{const g=new THREE.CylinderGeometry(r,r,len,n*4,1);const p=g.attributes.position;   // cylinder with n grip ribs of depth d
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),a=Math.atan2(z,x),f=1-d*(.5+.5*Math.cos(a*n));p.setX(i,x*f);p.setZ(i,z*f);}g.computeVertexNormals();return g;};

// --- scene graph: root -> (tripod, base) ; azG (rotates about vertical) -> fork ; altG (pitches) -> OTA parts
const root=new THREE.Group();scene.add(root);
const PIV_Y=1.56;
const mountG=new THREE.Group();root.add(mountG);      // everything above the tripod head; lifted when the tripod legs are extended
const azG=new THREE.Group();azG.position.y=1.06;mountG.add(azG);
const altG=new THREE.Group();altG.position.y=0.5;azG.add(altG);   // tube pivot is 0.5 m above the fork base
const OPT={fp:0.559,zs:-0.235,zp:0.19,zd:0.395,Mg:5};              // optics layout (metres, tube axis = z, front = -z)

// OTA parts (all children of altG; exploded along the tube axis)
const gTube=G('tube',altG,V3(0,0,0));
M('tube',gTube,cylZ(.15,.15,.415,72,true),'white',{p:[0,0,0.0075],sub:'shell',clip:true});
(function(){
  // Celestron badge as on the EdgeHD tube: black pill, orange swirl, CELESTRON, then an "EDGE HD OPTICS" end panel.
  // Canvas is 256 (around the tube) x 1024 (along the tube); drawn rotated so text runs front-to-rear.
  const c=document.createElement('canvas');c.width=256;c.height=1024;const x=c.getContext('2d');
  x.translate(128,512);x.rotate(Math.PI/2);
  const pill=(w,h,r)=>{x.beginPath();x.moveTo(-w/2+r,-h/2);x.lineTo(w/2-r,-h/2);x.arc(w/2-r,0,r,-Math.PI/2,Math.PI/2);x.lineTo(-w/2+r,h/2);x.arc(-w/2+r,0,r,Math.PI/2,Math.PI*1.5);x.closePath();};
  pill(1010,236,118);x.fillStyle='#8d9096';x.fill();pill(990,216,108);x.fillStyle='#111216';x.fill();
  const sw=x.createRadialGradient(-410,-10,4,-410,0,80);sw.addColorStop(0,'#ffb27a');sw.addColorStop(1,'#d2441a');x.fillStyle=sw;x.beginPath();x.arc(-410,0,74,0,7);x.fill();
  x.fillStyle='#111216';x.beginPath();x.arc(-388,-6,50,0,7);x.fill();
  x.fillStyle='#e9eaee';x.font='italic 900 112px system-ui';x.textAlign='left';x.textBaseline='middle';x.fillText('CELESTRON',-318,4,500);
  x.fillStyle='#2a2c31';x.beginPath();x.moveTo(250,-108);x.lineTo(500,-108);x.arc(395,0,108,-Math.PI/2,Math.PI/2);x.lineTo(210,108);x.closePath();x.fill();
  x.font='bold 58px system-ui';x.fillStyle='#9a9ca2';x.fillText('EDGE',262,-38);x.fillStyle='#e0322a';x.fillText('HD',412,-38);x.fillStyle='#d8d9dd';x.font='bold 56px system-ui';x.fillText('OPTICS',258,40);
  [0,Math.PI].forEach(rot=>{const t=new THREE.CanvasTexture(c);t.flipY=true;t.encoding=THREE.sRGBEncoding;t.anisotropy=8;t.center.set(.5,.5);t.rotation=rot;
    const g=new THREE.CylinderGeometry(.1508,.1508,.15,32,1,true,(rot?-Math.PI/2:Math.PI/2)-.125,.25);g.rotateX(Math.PI/2);
    const m=M('tube',gTube,g,'label',{p:[0,0,-.125],sub:'decal',noShadow:true,clip:true});m.material.map=t;m.material.needsUpdate=true;});
})();
const gCor=G('corrector',altG,V3(0,0,-0.32));
M('corrector',gCor,cylZ(.1397,.1397,.004,64),'glass',{p:[0,0,-.28],sub:'plate',clip:true,noShadow:true});
M('corrector',gCor,cylZ(.158,.158,.1,72,true),'blackg',{p:[0,0,-.25],sub:'cell',clip:true});
M('corrector',gCor,new THREE.RingGeometry(.1397,.158,72),'blackg',{p:[0,0,-.3],sub:'cell',clip:true});

/* ---- front lens cap for the corrector: black disc with a raised rim and an embossed swirl logo ---- */
const CAP={on:false};
const capTex=canvasTex(256,256,(x,w,h)=>{x.fillStyle='#0e0f12';x.fillRect(0,0,w,h);
  x.strokeStyle='rgba(255,255,255,.10)';x.lineWidth=3;x.beginPath();x.arc(128,128,52,0,7);x.stroke();               // embossed centre ring
  x.strokeStyle='rgba(255,255,255,.16)';x.lineWidth=5;x.beginPath();x.arc(120,128,30,-2.3,2.3);x.stroke();            // swirl logo (moulded, black on black)
  x.strokeStyle='rgba(255,255,255,.12)';x.lineWidth=3;x.beginPath();x.arc(140,128,20,-2.5,2.5);x.stroke();
  x.strokeStyle='rgba(255,255,255,.07)';x.lineWidth=2;x.beginPath();x.arc(128,128,122,0,7);x.stroke();},true);
BASE.cap=new THREE.MeshStandardMaterial({map:capTex,color:0xffffff,roughness:.35,metalness:.1});
function buildCap(g,flat){                       // flat=true: lying face-up on the table
  const disc=new THREE.CylinderGeometry(.163,.163,.008,72),face=new THREE.CircleGeometry(.158,72),rim=new THREE.CylinderGeometry(.165,.165,.022,72,1,true);
  if(!flat){disc.rotateX(Math.PI/2);face.rotateY(Math.PI);rim.rotateX(Math.PI/2);}else face.rotateX(-Math.PI/2);
  M('cap',g,disc,'gloss',{p:flat?[0,.004,0]:[0,0,-.309],sub:'cap'});
  M('cap',g,face,'cap',{p:flat?[0,.0085,0]:[0,0,-.3135],sub:'cap',noShadow:true});
  M('cap',g,rim,'gloss',{p:flat?[0,.011,0]:[0,0,-.302],sub:'cap'});}
const gCap=G('cap',altG,V3(0,0,-0.7));buildCap(gCap,false);
const gSec=G('secondary',altG,V3(0,0,-0.17));
M('secondary',gSec,cylZ(.052,.052,.012,48),'rubber',{p:[0,0,-.296],sub:'holder',clip:true});
M('secondary',gSec,cylZ(.046,.046,.045,48),'black',{p:[0,0,-.2575],sub:'holder',clip:true});
for(let k=0;k<3;k++){const a=k*Math.PI*2/3+Math.PI/2;M('secondary',gSec,cylZ(.005,.005,.008,12),'silver',{p:[Math.cos(a)*.034,Math.sin(a)*.034,-.303],sub:'screws'});}
(function(){const R=.2,th=Math.asin(.04/R),g=new THREE.SphereGeometry(R,32,12,0,Math.PI*2,0,th);g.translate(0,-R,0);g.rotateX(Math.PI/2);M('secondary',gSec,g,'mirror',{p:[0,0,OPT.zs],sub:'mirror',clip:true});})();
const gPri=G('primary',altG,V3(0,0,0.30));
(function(){const R=1.118,sag=r=>R-Math.sqrt(R*R-r*r),top=sag(.1397),pts=[];
  for(let i=0;i<=16;i++){const r=.034+(.1397-.034)*i/16;pts.push(new THREE.Vector2(r,top-sag(r)));}
  pts.push(new THREE.Vector2(.1397,.03),new THREE.Vector2(.034,.03),new THREE.Vector2(.034,top-sag(.034)));
  const g=new THREE.LatheGeometry(pts,64);g.rotateX(Math.PI/2);M('primary',gPri,g,'mirror',{p:[0,0,OPT.zp-top],sub:'mirror',clip:true});
  M('primary',gPri,cylZ(.146,.146,.012,64,true),'black',{p:[0,0,OPT.zp+.03],sub:'cell',clip:true});})();
const gBaf=G('baffle',altG,V3(0,0.12,0));
M('baffle',gBaf,cylZ(.032,.032,.28,32,true),'black',{p:[0,0,.16],sub:'tube',clip:true});
M('baffle',gBaf,cylZ(.04,.032,.015,32,true),'black',{p:[0,0,.02],sub:'flare',clip:true});
const gRear=G('rearcell',altG,V3(0,0,0.58));
// ---- inside the tube, normally hidden: shown in colour (like Celestron's cutaway art) when Cutaway is on ----
BASE.liner=new THREE.MeshStandardMaterial({color:0xd3dcc6,roughness:.85,metalness:0,side:THREE.DoubleSide});   // pale inner wall
BASE.cast=new THREE.MeshStandardMaterial({color:0x8a3a33,roughness:.55,metalness:.2,side:THREE.DoubleSide});   // maroon rear casting / mirror cell
M('tube',gTube,cylZ(.1475,.1475,.41,72,true),'liner',{p:[0,0,0.0075],sub:'inside',clip:true,noShadow:true});
M('rearcell',gRear,cylZ(.146,.146,.045,64,true),'cast',{p:[0,0,.247],sub:'casting',clip:true});            // inner wall of the rear cell
M('rearcell',gRear,new THREE.RingGeometry(.036,.146,64),'cast',{p:[0,0,.268],sub:'casting',clip:true});    // back plate (inside face)
M('rearcell',gRear,cylZ(.05,.05,.075,48,true),'cast',{p:[0,0,.235],sub:'casting',clip:true});              // central hub the primary mirror slides on
M('rearcell',gRear,cylZ(.05,.036,.004,48),'cast',{p:[0,0,.198],sub:'casting',clip:true});
[0,1,2].forEach(k=>{const a=k*2.094+.3,rib=M('rearcell',gRear,new THREE.BoxGeometry(.006,.09,.03),'cast',{p:[Math.cos(a)*.097,Math.sin(a)*.097,.252],sub:'casting',clip:true});rib.rotation.z=a-Math.PI/2;});   // stiffening ribs
M('rearcell',gRear,cylZ(.004,.004,.085,12),'silver',{p:[.1,-.025,.235],sub:'casting',clip:true});         // focus screw that pushes the mirror
M('rearcell',gRear,new THREE.BoxGeometry(.03,.012,.012),'silver',{p:[.088,-.025,.2],sub:'casting',clip:true});   // and its bracket on the mirror carrier
M('rearcell',gRear,cylZ(.075,.15,.012,64,true),'blackg',{p:[0,0,.283],sub:'cone',clip:true});   // nearly flat rear face
M('rearcell',gRear,cylZ(.153,.153,.05,64,true),'blackg',{p:[0,0,.24],sub:'cone',clip:true});
M('rearcell',gRear,cylZ(.153,.153,.024,64,true),'blackg',{p:[0,0,.265],sub:'cone',clip:true});
M('rearcell',gRear,cylZ(.07,.07,.025,48),'black',{p:[0,0,.3025],sub:'flange',clip:true});
M('rearcell',gRear,cylZ(.0275,.0275,.012,40),'silver',{p:[0,0,.321],sub:'thread'});
// rear-cell details from the photos: vents on the band, two cone-shaped locking knobs, curved ridges, rim screws
(function(){
  const zs=r=>.277+(.15-Math.min(.15,Math.max(.075,r)))/.075*.012;                       // z of the shallow rear face at radius r
  // louvred vents on the top and bottom of the rear-cell band (CPC Deluxe HD / EdgeHD), long axis running around the tube
  [1,-1].forEach(sg=>{const yv=sg*.1545,zv=.252,fy=g=>{g.rotateX(-sg*Math.PI/2);return g;};
    const vg=new THREE.CircleGeometry(.042,40);vg.scale(1,.36,1);M('rearcell',gRear,fy(vg),'rubber',{p:[0,yv,zv],sub:'vent',noShadow:true});
    const bz=new THREE.TorusGeometry(.042,.003,8,40);bz.scale(1,.36,1);M('rearcell',gRear,fy(bz),'gloss',{p:[0,yv+sg*.0006,zv],sub:'vent'});
    for(let i=0;i<9;i++){const x=-.034+i*.0085,h=.0145*Math.sqrt(Math.max(.05,1-Math.pow(x/.04,2)));
      const sl=M('rearcell',gRear,new THREE.BoxGeometry(.003,.002,h*2.1),'blackg',{p:[x,yv+sg*.0012,zv],sub:'vent',noShadow:true});sl.rotation.y=.55;}});
  M('rearcell',gRear,new THREE.TorusGeometry(.148,.006,10,64),'blackg',{p:[0,0,.275],sub:'cone',clip:true});   // rounded rear edge of the band
  [[-.085,.055],[-.06,-.085]].forEach(([x,y])=>{const z=zs(Math.hypot(x,y));
    const pk=new THREE.TorusGeometry(.021,.003,8,32);M('rearcell',gRear,pk,'blackg',{p:[x,y,z+.003],sub:'lockknob'});                    // recessed pocket rim
    M('rearcell',gRear,cylZ(.019,.019,.008,32),'blackg',{p:[x,y,z+.004],sub:'lockknob'});
    M('rearcell',gRear,cylZ(.004,.015,.03,32),'grip',{p:[x,y,z+.023],sub:'lockknob'});});                                                       // cone-shaped locking knob
  M('rearcell',gRear,new THREE.TorusGeometry(.108,.004,8,48,Math.PI*.7),'blackg',{p:[0,0,zs(.108)+.002],r:[0,0,Math.PI*.55],sub:'ridge'});        // curved ridges
  M('rearcell',gRear,new THREE.TorusGeometry(.108,.004,8,48,Math.PI*.4),'blackg',{p:[0,0,zs(.108)+.002],r:[0,0,-Math.PI*.22],sub:'ridge'});
  for(let i=0;i<7;i++){const a=(25+i*21.7)*Math.PI/180;M('rearcell',gRear,cylZ(.004,.004,.004,10),'silver',{p:[Math.cos(a)*.143,Math.sin(a)*.143,zs(.143)+.002],sub:'screws'});}   // rim screws
})();
const gFoc=G('focuser',altG,V3(0.22,-0.05,0.78));
const FKX=.1,FKY=-.025,FKZ=.2825;
M('focuser',gFoc,cylZ(.027,.027,.012,48),'orange',{p:[FKX,FKY,FKZ+.006],sub:'plate'});                       // orange plate around the knob
[0,1,2].forEach(k=>{const an=k*2.094+.5;M('focuser',gFoc,cylZ(.0022,.0022,.002,8),'silver',{p:[FKX+Math.cos(an)*.021,FKY+Math.sin(an)*.021,FKZ+.0125],sub:'plate'});});
M('focuser',gFoc,cylZ(.007,.007,.02,16),'silver',{p:[FKX,FKY,FKZ+.012],sub:'shaft'});
M('focuser',gFoc,ribbed(.0145,.036,14,.1).rotateX(Math.PI/2),'grip',{p:[FKX,FKY,FKZ+.03],sub:'knob'});         // ribbed focus knob
M('focuser',gFoc,cylZ(.0115,.0115,.003,32),'blackg',{p:[FKX,FKY,FKZ+.0495],sub:'knob'});
const gDew=G('dew',altG,V3(0,0,-0.55));
M('dew',gDew,cylZ(.164,.164,.34,64,true),'gloss',{p:[0,0,-.47],sub:'shell',clip:true});                 // glossy black shield, starts at the corrector cell
M('dew',gDew,cylZ(.1625,.1625,.338,64,true),'grip',{p:[0,0,-.47],sub:'liner',clip:true});               // dark felt liner
M('dew',gDew,new THREE.TorusGeometry(.164,.004,10,64),'gloss',{p:[0,0,-.64],sub:'rim',clip:true});
// accessories (shapes follow the product photos: orange SCT thread nut, wedge diagonal, banded wide-field eyepiece, bracketed 9x50 finder)
const gVB=G('visualback',altG,V3(0,0,0.8));
M('visualback',gVB,cylZ(.0415,.0415,.011,48),'orange',{p:[0,0,.3325],sub:'ring'});            // thread nut, screws onto the rear cell
M('visualback',gVB,cylZ(.0385,.0385,.026,48),'black',{p:[0,0,.351],sub:'body'});
M('visualback',gVB,cylZ(.0405,.0405,.004,48),'silver',{p:[0,0,.362],sub:'ring'});
[-1,1].forEach(sd=>{M('visualback',gVB,new THREE.CylinderGeometry(.0035,.0035,.014,12),'silver',{p:[sd*.043,0,.352],r:[0,0,Math.PI/2],sub:'body'});
  M('visualback',gVB,ribbed(.0075,.012,10,.14).rotateZ(Math.PI/2),'silver',{p:[sd*.0505,0,.352],sub:'body'});});   // two thumbscrews
const gDiag=G('diagonal',altG,V3(0,0,1.0)),DZ=.395;
(function(){const sh=new THREE.Shape();sh.moveTo(-.031,-.031);sh.lineTo(.045,-.031);sh.lineTo(.045,.045);sh.closePath();   // wedge whose sloped face carries the mirror
  const g=new THREE.ExtrudeGeometry(sh,{depth:.07,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:2});g.translate(0,0,-.035);g.rotateY(-Math.PI/2);
  M('diagonal',gDiag,g,'blackg',{p:[0,0,DZ],sub:'housing',clip:true});})();
M('diagonal',gDiag,cylZ(.0405,.0405,.031,48),'black',{p:[0,0,DZ-.0155],sub:'housing',clip:true});          // SCT-side collar
M('diagonal',gDiag,new THREE.CylinderGeometry(.0385,.0385,.09,48,1,true),'black',{p:[0,.045,DZ],sub:'barrel',clip:true});   // eyepiece port (the eyepiece barrel slides in)
M('diagonal',gDiag,new THREE.TorusGeometry(.0385,.003,8,48),'silver',{p:[0,.09,DZ],r:[Math.PI/2,0,0],sub:'barrel'});
M('diagonal',gDiag,new THREE.CylinderGeometry(.003,.003,.012,10),'silver',{p:[.042,.065,DZ],r:[0,0,Math.PI/2],sub:'thumbscrew'});
M('diagonal',gDiag,ribbed(.0075,.014,10,.14).rotateZ(Math.PI/2),'silver',{p:[.0495,.065,DZ],sub:'thumbscrew'});
(function(){const g=new THREE.CircleGeometry(.03,32);g.scale(1,1.414,1);M('diagonal',gDiag,g,'mirror',{p:[0,0,.395],r:[0,Math.PI/2,Math.PI/4],sub:'mirror',clip:true,noShadow:true});})();
const gEye=G('eyepiece',altG,V3(0,0.34,1.0)),EY=.395;
M('eyepiece',gEye,new THREE.CylinderGeometry(.0254,.0254,.063,40),'silver',{p:[0,.1065,EY],sub:'barrel'});                  // 2" barrel
M('eyepiece',gEye,new THREE.TorusGeometry(.0256,.0012,8,40),'black',{p:[0,.09,EY],r:[Math.PI/2,0,0],sub:'barrel'});          // safety undercut
M('eyepiece',gEye,lathe([[.0254,.138],[.029,.141],[.0335,.15],[.0348,.162],[.0348,.168]]),'silver',{p:[0,0,EY],sub:'body'});  // lower chrome shoulder
M('eyepiece',gEye,ribbed(.0352,.024,18,.04),'grip',{p:[0,.179,EY],sub:'body'});                                             // ribbed grip band
[.1695,.1885].forEach(y=>M('eyepiece',gEye,new THREE.TorusGeometry(.0353,.0014,8,48),'orange',{p:[0,y,EY],r:[Math.PI/2,0,0],sub:'body'}));
M('eyepiece',gEye,lathe([[.0348,.19],[.0348,.195],[.0335,.2],[.0305,.207],[.0275,.211]]),'silver',{p:[0,0,EY],sub:'body'});    // upper chrome shoulder
M('eyepiece',gEye,new THREE.CylinderGeometry(.022,.022,.003,32),'glass',{p:[0,.209,EY],sub:'eyelens',noShadow:true});
M('eyepiece',gEye,lathe([[.0275,.211],[.0262,.213],[.0262,.219],[.0285,.2235],[.0305,.2245],[.0305,.2265],[.0275,.2265],[.0245,.222],[.0245,.213]]),'grip',{p:[0,0,EY],sub:'eyecup'});   // fold-down eyecup
const gFind=G('finder',altG,V3(-0.1,0.4,0));      // 9x50 finder on a two-ring bracket near the rear cell, off-axis (~10-11 o'clock)
const FX=-.095,FY=.204,fm=(geo,mat,p,sub,r)=>M('finder',gFind,geo,mat,{p,sub,r});
fm(cylZ(.03,.03,.2,40),'black',[FX,FY,.12],'tube');
fm(cylZ(.038,.038,.045,40),'black',[FX,FY,.0],'objective');                                // wide objective cell
fm(new THREE.TorusGeometry(.0385,.003,8,40),'silver',[FX,FY,-.0225],'objective');
fm(new THREE.CircleGeometry(.033,32),'glass',[FX,FY,-.0235],'objective',[0,Math.PI,0]);
fm(cylZ(.022,.022,.05,32),'black',[FX,FY,.245],'eyepiece');                                // focusing eyepiece housing
fm(cylZ(.0235,.0235,.006,32),'silver',[FX,FY,.27],'eyepiece');
fm(cylZ(.017,.017,.022,32),'rubber',[FX,FY,.284],'eyepiece');
[.05,.17].forEach((z,i)=>{                                                                 // bracket: ring (annulus faces + band), foot block, three alignment screws
  fm(cylZ(.0405,.0405,.016,40,true),'black',[FX,FY,z],'bracket');
  [-.008,.008].forEach(dz=>fm(new THREE.RingGeometry(.03,.0405,40),'black',[FX,FY,z+dz],'bracket',[0,dz>0?0:Math.PI,0]));
  fm(new THREE.BoxGeometry(.05,.08,.04),'black',[FX,.135,z],'bracket');
  [90,210,330].forEach(deg=>{const a=deg*Math.PI/180,big=i===1&&deg===90;
    fm(new THREE.CylinderGeometry(.0035,.0035,.016,10),'silver',[FX+Math.cos(a)*.047,FY+Math.sin(a)*.047,z],'bracket',[0,0,a-Math.PI/2]);
    fm(ribbed(big?.0075:.0055,.01,10,.14),'silver',[FX+Math.cos(a)*(big?.058:.054),FY+Math.sin(a)*(big?.058:.054),z],'bracket',[0,0,a-Math.PI/2]);});
});
const gStar=G('starsense',altG,V3(0.12,0.4,0));   // optional plate-solving camera on a finder-style quick-release shoe, top right of the rear cell (mirrors the 9x50 finder on the left)
(function(){
  const SX=.095,SY=.205,sm=(geo,mat,p,sub,r)=>M('starsense',gStar,geo,mat,{p,sub,r});
  // quick-release shoe screwed to the rear cell, with the camera's dovetail foot and a locking screw
  sm(new THREE.BoxGeometry(.05,.05,.1),'black',[SX,.135,.1],'clamp');
  sm(new THREE.BoxGeometry(.04,.01,.1),'blackg',[SX,.164,.1],'clamp');
  sm(cylZ(.004,.004,.014,12).rotateY(Math.PI/2),'silver',[SX+.031,.14,.1],'clamp');
  sm(ribbed(.007,.008,10,.14).rotateZ(Math.PI/2),'silver',[SX+.041,.14,.1],'clamp');
  sm(new THREE.BoxGeometry(.044,.03,.06),'blackg',[SX,.183,.1],'clamp');                                     // riser to the camera
  // camera: lens barrel pointing forward along the tube, orange accent ring, oval electronics housing at the back
  sm(cylZ(.03,.03,.105,48),'black',[SX,SY,.075],'camera');
  sm(cylZ(.0345,.0345,.025,48),'blackg',[SX,SY,.1],'camera');
  sm(cylZ(.0315,.0315,.004,48),'orange',[SX,SY,.114],'camera');
  sm(new THREE.TorusGeometry(.0302,.0016,8,48),'silver',[SX,SY,.0225],'camera');
  sm(new THREE.RingGeometry(.022,.0285,40),'black',[SX,SY,.0221],'camera',[0,Math.PI,0]);
  sm(new THREE.CircleGeometry(.022,40),'glass',[SX,SY,.0219],'lens',[0,Math.PI,0]);
  const sh=new THREE.Shape();sh.absellipse(0,0,.0375,.0525,0,Math.PI*2,false);
  sm(new THREE.ExtrudeGeometry(sh,{depth:.012,bevelEnabled:true,bevelSize:.002,bevelThickness:.002,bevelSegments:2,curveSegments:32}),'blackg',[SX,SY+.015,.118],'housing');
  sm(cylZ(.004,.004,.003,10),'black',[SX+.017,SY-.012,.133],'housing');                                       // cable socket
})();
const gTel=G('telrad',altG,V3(0,0.32,0));      // Telrad reflex sight: long battery body, tall rear tower with a pitched roof and tilted glass, knobs on the back
(function(){
  const tm=(geo,mat,p,sub,r)=>M('telrad',gTel,geo,mat,{p,sub,r});
  const y0=.1685,yb=y0+.004,W=.056;                                                 // base-plate top, body bottom, body width
  const side=(pts,w)=>{const sh=new THREE.Shape();pts.forEach((q,i)=>i?sh.lineTo(q[0],q[1]):sh.moveTo(q[0],q[1]));sh.closePath();   // (z,y) outline extruded across x, centred
    const g=new THREE.ExtrudeGeometry(sh,{depth:w,bevelEnabled:true,bevelSize:.0012,bevelThickness:.0012,bevelSegments:1});g.rotateY(-Math.PI/2);g.translate(w/2,0,0);return g;};
  // base plate with its spring clip, screwed to the tube
  tm(new THREE.BoxGeometry(.05,.004,.2),'black',[0,y0,-.01],'base');
  tm(new THREE.BoxGeometry(.03,.008,.012),'steel',[0,y0+.002,-.11],'base');
  // long body (battery compartment and reticle optics) with a groove and a raised name panel on each side
  tm(new THREE.BoxGeometry(W,.044,.2),'grip',[0,yb+.022,-.02],'body');
  [-1,1].forEach(sd=>{tm(new THREE.BoxGeometry(.002,.003,.2),'black',[sd*W/2,yb+.006,-.02],'body');
    tm(new THREE.BoxGeometry(.002,.026,.075),'grip',[sd*(W/2+.0008),yb+.023,-.055],'body');
    tm(new THREE.BoxGeometry(.0025,.021,.069),'black',[sd*(W/2+.0012),yb+.023,-.055],'body');});
  for(let i=0;i<4;i++)tm(new THREE.BoxGeometry(.03,.0015,.008),'black',[0,yb+.0445,-.06+i*.014],'body');   // embossed lettering on top
  // rear tower: vertical back, steep rear slope carrying the glass, long front slope down to the body
  const yT=yb+.044,P=[[.04,yT-.01],[.04,yb],[.1,yb],[.1,yT+.042],[.078,yT+.075],[.072,yT+.075],[.04,yT+.012]];
  tm(side(P,W),'grip',[0,0,0],'hood');
  // tilted glass on the rear slope, in a thin frame, propped slightly open as on the real unit
  const ang=Math.atan2(.033,.022),cz=.089,cy=yT+.0585;
  tm(new THREE.BoxGeometry(W-.004,.04,.003),'grip',[0,cy+.002,cz+.005],'window',[-(Math.PI/2-ang)+.12,0,0]);
  tm(new THREE.PlaneGeometry(W-.012,.034),'glass',[0,cy+.003,cz+.0072],'window',[-(Math.PI/2-ang)+.12,0,0]);
  // the Telrad's bullseye: three red rings (0.5°, 2° and 4°) with four gaps, projected onto the glass so you see them from behind.
  // Drawn on a canvas and kept glowing (userData.glow) so the rings stay bright red in the 3D view.
  const rt=canvasTex(256,256,(x,w,h)=>{x.clearRect(0,0,w,h);x.strokeStyle='#ff0000';x.lineCap='butt';x.shadowColor='#ff0000';x.shadowBlur=6;
    [[100,9],[52,8],[13,7]].forEach(([r,lw],i)=>{x.lineWidth=lw;const g=i===2?0:.16;for(let q=0;q<4;q++){x.beginPath();x.arc(128,128,r,q*Math.PI/2+g+Math.PI/4,(q+1)*Math.PI/2-g+Math.PI/4);x.stroke();}});},true);
  const wb=tm(new THREE.PlaneGeometry(W-.014,.032),'white',[0,cy+.0032,cz+.0078],'window',[-(Math.PI/2-ang)+.12,0,0]);   // bright white reflector behind the rings, as on the real glass
  wb.material=new THREE.MeshStandardMaterial({color:0xeef2f6,roughness:.25,metalness:.15,transparent:true,opacity:.85,side:THREE.DoubleSide});wb.userData.o0={t:true,o:.85,d:true};
  const rm=tm(new THREE.PlaneGeometry(.034,.034),'glass',[0,cy+.0035,cz+.0085],'window',[-(Math.PI/2-ang)+.12,0,0]);
  rm.material=new THREE.MeshStandardMaterial({map:rt,emissiveMap:rt,emissive:0xd00000,emissiveIntensity:1,color:0xff2020,transparent:true,depthWrite:false,side:THREE.DoubleSide,roughness:1,metalness:0});
  rm.userData.o0={t:true,o:1,d:false};rm.userData.glow=true;rm.renderOrder=3;
  [-1,1].forEach(sd=>tm(side([[.076,yT+.074],[.1,yT+.04],[.104,yT+.05],[.082,yT+.08]],.003),'grip',[sd*(W/2-.0015),0,0],'window'));   // raised side cheeks of the window
  // back face: three knurled adjustment knobs and four silver screws
  [[-.014,yb+.05],[.014,yb+.05],[-.016,yb+.016]].forEach(([x,y])=>{
    tm(new THREE.CylinderGeometry(.0075,.0075,.004,16),'rubber',[x,y,.1025],'body',[Math.PI/2,0,0]);
    tm(ribbed(.0065,.012,10,.12),'black',[x,y,.11],'body',[Math.PI/2,0,0]);
    tm(new THREE.CylinderGeometry(.0018,.0018,.002,10),'silver',[x,y,.1165],'body',[Math.PI/2,0,0]);});
  [[-.022,yb+.008],[.022,yb+.008],[-.022,yb+.072],[.022,yb+.072]].forEach(([x,y])=>tm(new THREE.CylinderGeometry(.003,.003,.002,12),'silver',[x,y,.1012],'body',[Math.PI/2,0,0]));
  // on/off / brightness knob with its lever on the right of the tower
  tm(new THREE.CylinderGeometry(.008,.008,.012,20),'black',[W/2+.006,yb+.05,.06],'body',[0,0,Math.PI/2]);
  tm(new THREE.CylinderGeometry(.006,.006,.004,16),'silver',[W/2+.001,yb+.05,.06],'body',[0,0,Math.PI/2]);
  tm(new THREE.BoxGeometry(.006,.006,.022),'black',[W/2+.004,yb+.044,.05],'body',[.5,0,0]);
  tm(new THREE.CylinderGeometry(.0028,.0028,.003,10),'orange',[0,yT+.003,.03],'body');               // red reticle lens window under the glass
})();
const gDove=G('dovetail',altG,V3(0,0.22,0));
M('dovetail',gDove,new THREE.BoxGeometry(.055,.015,.36),'silver',{p:[0,.158,-.03],sub:'bar'});
[-.12,.1].forEach(z=>M('dovetail',gDove,new THREE.CylinderGeometry(.006,.006,.01,12),'black',{p:[0,.168,z],sub:'bolts'}));

// fork (rotates with azimuth). Two arms (CPC style) or one arm + drive housing; switch with the toolbar buttons
const rotZ=g=>{g.rotateZ(Math.PI/2);return g;};
// The fork arms, the rotating azimuth drive housing and the port panel are one moulded housing on the CPC, so they share one explode offset and move as a single piece.
const FORK_EXP=V3(0,.1,0);
const gFB=G('fork',azG,FORK_EXP);
M('fork',gFB,lathe([[.0,.03],[.055,.03],[.07,.05],[.078,.066],[.092,.07],[.14,.067],[.166,.058],[.178,.04],[.181,.014],[.176,0]],72),'blackg',{p:[0,0,0],sub:'base'});   // domed drum with a deep centre well
M('fork',gFB,new THREE.TorusGeometry(.082,.006,10,64),'gloss',{p:[0,.069,0],r:[Math.PI/2,0,0],sub:'base'});             // glossy ring round the well
M('fork',gFB,ribbed(.045,.03,3,.25),'blackg',{p:[0,.045,0],sub:'base'});                         // three-lobed azimuth cap in the well
M('fork',gFB,new THREE.BoxGeometry(.075,.014,.018),'gloss',{p:[0,.066,0],sub:'base'});                // T-handle across the cap
M('fork',gFB,new THREE.CylinderGeometry(.012,.012,.012,16),'gloss',{p:[0,.07,0],sub:'base'});
(function(){                                             // silver Celestron pill at the back of the drum
  const c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d');
  const pill=(w,h,col)=>{x.fillStyle=col;x.beginPath();x.moveTo(256-w/2+h/2,64-h/2);x.lineTo(256+w/2-h/2,64-h/2);x.arc(256+w/2-h/2,64,h/2,-Math.PI/2,Math.PI/2);x.lineTo(256-w/2+h/2,64+h/2);x.arc(256-w/2+h/2,64,h/2,Math.PI/2,Math.PI*1.5);x.fill();};
  pill(500,116,'#6c6f75');pill(484,100,'#d3d5da');x.fillStyle='#d2441a';x.beginPath();x.arc(80,64,30,0,7);x.fill();x.fillStyle='#d3d5da';x.beginPath();x.arc(90,60,20,0,7);x.fill();
  x.fillStyle='#2a2c31';x.font='italic 900 62px system-ui';x.textAlign='left';x.textBaseline='middle';x.fillText('CELESTRON',122,67,350);
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;
  const g=new THREE.PlaneGeometry(.09,.0225);g.rotateX(-Math.PI/2);g.rotateY(Math.PI);
  const m=M('fork',gFB,g,'badge',{p:[0,.0705,-.122],sub:'base',noShadow:true});m.material.map=t;m.material.transparent=true;m.material.alphaTest=.3;m.material.needsUpdate=true;
  [-1,1].forEach(sd=>[-.35,.35].forEach(da=>{const a=Math.PI/2*sd+da,r=.125;   // moulding seams running out toward the arms
    const sm=M('fork',gFB,new THREE.BoxGeometry(.06,.002,.0025),'grip',{p:[Math.sin(a)*r,.0695,Math.cos(a)*r],sub:'base',noShadow:true});sm.rotation.y=a-Math.PI/2;}));
})();
for(let k=0;k<8;k++){const a=(k+.5)*Math.PI/4;M('fork',gFB,cylZ(.004,.004,.003,10).rotateX(Math.PI/2),'silver',{p:[Math.sin(a)*.152,.0665,Math.cos(a)*.152],sub:'base'});}   // top screws
const ARM_GEO=(function(){const sh=new THREE.Shape();                          // arm outline in (z,y); extruded across x
  sh.moveTo(-.17,.06);sh.lineTo(.17,.06);sh.lineTo(.17,.14);sh.quadraticCurveTo(.12,.16,.115,.26);sh.lineTo(.115,.5);sh.absarc(0,.5,.115,0,Math.PI,false);
  sh.lineTo(-.115,.26);sh.quadraticCurveTo(-.12,.16,-.17,.14);sh.lineTo(-.17,.06);
  const g=new THREE.ExtrudeGeometry(sh,{depth:.056,bevelEnabled:true,bevelSize:.014,bevelThickness:.014,bevelSegments:5,curveSegments:28});g.translate(0,0,-.028);g.rotateY(-Math.PI/2);return g;})();
const FOOT_GEO=(function(){const sh=new THREE.Shape();             // fillet in (x,y) where an arm grows out of the drum; extruded along z
  sh.moveTo(.15,.066);sh.quadraticCurveTo(.2,.075,.205,.2);sh.lineTo(.215,.2);sh.lineTo(.215,.03);sh.quadraticCurveTo(.2,.004,.17,.004);sh.lineTo(.15,.004);sh.closePath();
  const g=new THREE.ExtrudeGeometry(sh,{depth:.2,bevelEnabled:true,bevelSize:.022,bevelThickness:.03,bevelSegments:6,curveSegments:20});g.translate(0,0,-.1);return g;})();
BASE.armgrey=new THREE.MeshStandardMaterial({color:0x3b3d42,metalness:.25,roughness:.62,roughnessMap:brushTex,side:THREE.DoubleSide});   // lighter textured upper panel
function buildArm(sx){
  const g=G('fork',azG,FORK_EXP),sub=sx>0?'arm':'arm2',xo=sx*.2745;                // xo = outer face of the arm
  const face=(m,dx)=>{m.rotation.y=sx*Math.PI/2;m.position.x=xo+sx*(dx||0);return m;};  // turn a shape drawn in (z,y) to lie on the outer face
  M('fork',g,ARM_GEO,'blackg',{p:[sx*.2325,0,0],sub});                          // curved arm with rounded edges
  {const f=M('fork',g,FOOT_GEO,'blackg',{p:[0,0,0],sub});if(sx<0)f.scale.x=-1;}     // flared foot blending the arm into the drum
  // lighter textured panel over the upper arm; its lower edge runs diagonally like the real moulding
  {const sh=new THREE.Shape(),k=-sx;sh.moveTo(k*-.098,.24);sh.lineTo(k*.098,.33);sh.lineTo(k*.098,.5);sh.absarc(0,.5,.098,0,Math.PI,false);sh.lineTo(k*-.098,.24);
    const m=M('fork',g,new THREE.ShapeGeometry(sh,32),'armgrey',{sub,noShadow:true});face(m,.0012);m.material.side=THREE.DoubleSide;}
  // raised bead round the top of the arm
  {const t=new THREE.TorusGeometry(.108,.007,10,48,Math.PI);t.rotateY(Math.PI/2);M('fork',g,t,'gloss',{p:[xo,.5,0],sub});}
  // clutch knob: dished recess with a glossy rim and a two-lobed grip
  M('fork',g,rotZ(new THREE.CylinderGeometry(.068,.068,.004,48)),'rubber',{p:[xo+sx*.0015,.5,0],sub:'clutch'});
  {const t=new THREE.TorusGeometry(.068,.005,10,48);t.rotateY(Math.PI/2);M('fork',g,t,'gloss',{p:[xo+sx*.002,.5,0],sub:'clutch'});}
  M('fork',g,rotZ(new THREE.CylinderGeometry(.056,.06,.008,48)),'blackg',{p:[xo+sx*.004,.5,0],sub:'clutch'});
  {const sh=new THREE.Shape();sh.absarc(-.032,0,.02,Math.PI/2,Math.PI*1.5,false);sh.quadraticCurveTo(0,-.006,.032,-.02);sh.absarc(.032,0,.02,-Math.PI/2,Math.PI/2,false);sh.quadraticCurveTo(0,.006,-.032,.02);
    const gg=new THREE.ExtrudeGeometry(sh,{depth:.014,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:3,curveSegments:16});
    const m=M('fork',g,gg,'gloss',{sub:'clutch'});m.rotation.set(0,sx*Math.PI/2,0);m.rotateZ(.7);m.position.set(xo+sx*.006,.5,0);}
  M('fork',g,rotZ(new THREE.CylinderGeometry(.075,.075,.045,36)),'steel',{p:[sx*.1725,.5,0],sub:'pivot'});
  // recessed carry handle low on the outer face of the right arm (the left arm carries the hand-control cradle)
  if(sx>0){                                                                       // light-grey D handle with the Celestron name, standing off the outer face
    const zc=.03,y0=.15,y1=.31,off=.03;
    M('fork',g,new THREE.BoxGeometry(.016,y1-y0,.022),'white',{p:[xo+sx*off,(y0+y1)/2,zc],sub:'handle'});
    [y0,y1].forEach(y=>{M('fork',g,new THREE.BoxGeometry(off+.006,.022,.024),'white',{p:[xo+sx*off/2,y,zc],sub:'handle'});
      const t=new THREE.TorusGeometry(.011,.011,8,12,Math.PI/2);});
    const c=document.createElement('canvas');c.width=64;c.height=512;const x=c.getContext('2d');x.fillStyle='#d9dad6';x.fillRect(0,0,64,512);
    x.translate(32,256);x.rotate(Math.PI/2);x.fillStyle='#8f9196';x.font='bold 40px serif';x.textAlign='center';x.textBaseline='middle';x.fillText('CELESTRON',0,0);
    const tx=new THREE.CanvasTexture(c);tx.encoding=THREE.sRGBEncoding;
    const m=M('fork',g,new THREE.PlaneGeometry(.018,.13),'white',{p:[xo+sx*(off+.0085),(y0+y1)/2,zc],r:[0,sx*Math.PI/2,0],sub:'handle',noShadow:true});m.material.map=tx;m.material.needsUpdate=true;}
  return g;
}
const gArmR=buildArm(1),gArmL=buildArm(-1);
const gDrv=G('fork',altG,V3(-0.3,0,0));              // one-arm mode only: drive housing on the free side of the tube
M('fork',gDrv,rotZ(new THREE.CylinderGeometry(.095,.1,.07,48)),'blackg',{p:[-.185,0,0],sub:'altdrive'});
M('fork',gDrv,rotZ(new THREE.CylinderGeometry(.03,.03,.05,20)),'rubber',{p:[-.245,.03,.03],sub:'clutch'});
M('fork',gDrv,rotZ(new THREE.CylinderGeometry(.02,.02,.04,20)),'rubber',{p:[-.24,-.04,.04],sub:'clutch'});
M('fork',gDrv,rotZ(new THREE.CylinderGeometry(.034,.034,.004,24)),'orange',{p:[-.221,.03,.03],sub:'clutch'});
let armCount=2;
function setArms(n){armCount=n;gArmL.visible=n===2;gDrv.visible=n===1;gHCL.visible=n===2;gHCR.visible=n===1;$('#bA1').classList.toggle('on',n===1);$('#bA2').classList.toggle('on',n===2);if(sel.part==='fork')showInfo();}
// base + tripod (static)
// The flared drive base is moulded with the azimuth housing and both arms: one piece that turns on the tripod head.
const gBase=G('fork',azG,FORK_EXP);gBase.position.y=-1.06;EXPL[EXPL.length-1].base.y=-1.06;
M('fork',gBase,lathe([[.12,0],[.16,.004],[.178,.014],[.186,.03],[.187,.05],[.185,.068],[.18,.078],[.176,.08],[.12,.08]],72),'blackg',{p:[0,.98,0],sub:'base'});
[1.005,1.04].forEach(y=>M('fork',gBase,new THREE.TorusGeometry(y<1.01?.18:.1865,.0018,6,72),'grip',{p:[0,y,0],r:[Math.PI/2,0,0],sub:'base'}));   // moulded grooves round the band   // flared drive base (dia about 345 mm in the drawing)
for(let k=0;k<3;k++){const a=k*2.094+1.05;M('fork',gBase,new THREE.CylinderGeometry(.009,.009,.007,6),'silver',{p:[Math.sin(a)*.13,.974,Math.cos(a)*.13],sub:'base'});}   // mounting bolts seen under the base
const gTri=G('tripod',root,V3(0,-0.5,0));
const LEVEL={legs:[.6,-.4,0],dx:.7,dz:-.4,ok:false};driver.s.tilt={a:LEVEL.dz*.9,b:LEVEL.dx*.9};   // tripod levelling state (Setup step 4); the bubble starts off-centre
// rounded triangle outline (Minkowski sum of a triangle and a circle); corners point at the legs. Shape y maps to world -z after rotateX(-90deg)
const roundTri=(Rv,rc)=>{const sh=new THREE.Shape(),pts=[];
  for(let k=0;k<3;k++){const a=k*Math.PI*2/3;for(let i=0;i<=12;i++){const d=a+(-1+i/6)*Math.PI/3;pts.push([Math.sin(a)*Rv+Math.sin(d)*rc,-Math.cos(a)*Rv-Math.cos(d)*rc]);}}
  pts.forEach((p,i)=>i?sh.lineTo(p[0],p[1]):sh.moveTo(p[0],p[1]));sh.closePath();return sh;};
// Tripod dimensions from Celestron's CPC Tripod drawing: head height 784 mm (legs retracted) to 1180 mm (extended), footprint dia 958 to 1310 mm.
function buildTripod(H,B){
  [...gTri.children].forEach(c=>{gTri.remove(c);const i=ALLM.indexOf(c);if(i>=0)ALLM.splice(i,1);c.geometry.dispose();c.material.dispose();});
  const yT=H*.43;
  const flat=(shape,depth,bev)=>{const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:bev,bevelThickness:bev,bevelSegments:3,curveSegments:10});g.rotateX(-Math.PI/2);return g;};
  const up=V3(0,1,0),orient=(m,p,q)=>{const d=q.clone().sub(p);m.position.copy(p.clone().add(q).multiplyScalar(.5));m.quaternion.setFromUnitVectors(up,d.normalize());};
  const cyl=(r,p,q,mat,sub,seg)=>{const m=M('tripod',gTri,new THREE.CylinderGeometry(r,r,p.distanceTo(q),seg||20),mat,{sub});orient(m,p,q);return m;};
  // ---- head: a rounded-triangle plate (corners toward the legs) on a deeper, slightly smaller skirt ----
  M('tripod',gTri,flat(roundTri(.13,.1),.016,.006),'blackg',{p:[0,H-.022,0],sub:'head'});                 // top plate the mount sits on
  M('tripod',gTri,flat(roundTri(.11,.095),.03,.01),'blackg',{p:[0,H-.06,0],sub:'head'});                  // rounded skirt under the plate
  M('tripod',gTri,new THREE.CylinderGeometry(.016,.016,.004,24),'blackg',{p:[0,H-.001,-.06],sub:'head'});   // bubble level well
  M('tripod',gTri,new THREE.CylinderGeometry(.0075,.0075,.006,20),'bubble',{p:[LEVEL.dx*.009,H+.0005,-.06+LEVEL.dz*.009],sub:'head'}).userData.bubble=true;   // the bubble itself (moves while levelling)
  M('tripod',gTri,new THREE.TorusGeometry(.0185,.0025,8,24),'silver',{p:[0,H+.0005,-.06],r:[Math.PI/2,0,0],sub:'head'});
  M('tripod',gTri,new THREE.CylinderGeometry(.006,.006,.022,12),'silver',{p:[0,H+.005,0],sub:'head'});        // locating pin
  for(let k=0;k<3;k++){const a=k*Math.PI*2/3,s=Math.sin(a),c=Math.cos(a);
    M('tripod',gTri,new THREE.CylinderGeometry(.011,.011,.008,6),'silver',{p:[s*.16,H+.0005,c*.16],sub:'head'});          // mounting bolt near each corner
    M('tripod',gTri,new THREE.CylinderGeometry(.005,.005,.002,10),'rubber',{p:[s*.12+c*.03,H+.0003,c*.12-s*.03],sub:'head'});   // small screw holes beside it
    const a2=a+Math.PI/3;M('tripod',gTri,new THREE.CylinderGeometry(.005,.005,.002,10),'rubber',{p:[Math.sin(a2)*.1,H+.0003,Math.cos(a2)*.1],sub:'head'});}
  for(let k=0;k<3;k++){
    const a=k*Math.PI*2/3,u=V3(Math.sin(a),0,Math.cos(a)),tg=V3(Math.cos(a),0,-Math.sin(a));
    const top=V3(u.x*.2,H-.05,u.z*.2),bot=V3(u.x*B,0,u.z*B),d=bot.clone().sub(top).normalize();
    // ---- leg casting: a tall rounded block hanging under each corner of the head, gripping the chrome leg ----
    const cs=new THREE.Shape(),w=.05,hh=.11,r=.035;
    cs.moveTo(-w+r,-hh);cs.lineTo(w-r,-hh);cs.quadraticCurveTo(w,-hh,w,-hh+r);cs.lineTo(w,hh-r);cs.quadraticCurveTo(w,hh,w-r,hh);cs.lineTo(-w+r,hh);cs.quadraticCurveTo(-w,hh,-w,hh-r);cs.lineTo(-w,-hh+r);cs.quadraticCurveTo(-w,-hh,-w+r,-hh);
    const cg=new THREE.ExtrudeGeometry(cs,{depth:.075,bevelEnabled:true,bevelSize:.014,bevelThickness:.014,bevelSegments:4,curveSegments:8});cg.translate(0,0,-.0375);
    const cast=M('tripod',gTri,cg,'blackg',{sub:'legs'});const cc=top.clone().addScaledVector(d,.08);cast.position.copy(cc);
    cast.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tg,d.clone().negate(),tg.clone().cross(d.clone().negate())));
    // arm from the head skirt out to the casting
    cyl(.026,V3(u.x*.09,H-.05,u.z*.09),top.clone().addScaledVector(d,.02),'blackg','head',16);
    // big hex pivot bolt through the casting, with a washer, on both sides
    [-1,1].forEach(sd=>{const p=cc.clone().addScaledVector(d,-.04).addScaledVector(tg,sd*.068);
      const bolt=M('tripod',gTri,new THREE.CylinderGeometry(.016,.016,.012,6),'silver',{sub:'legs'});bolt.position.copy(p);bolt.quaternion.setFromUnitVectors(up,tg);
      const wa=M('tripod',gTri,new THREE.CylinderGeometry(.021,.021,.003,20),'silver',{sub:'legs'});wa.position.copy(p.clone().addScaledVector(tg,-sd*.007));wa.quaternion.setFromUnitVectors(up,tg);});
    const hEnd=top.clone().addScaledVector(d,.17),mid=top.clone().lerp(bot,.62);
    cyl(.031,hEnd,mid,'silver','legs',24);cyl(.025,mid,bot,'silver','legs',24);         // chrome upper leg and extension
    cyl(.04,mid.clone().addScaledVector(d,-.025),mid.clone().addScaledVector(d,.025),'rubber','locks');   // extension lock collar
    cyl(.032,bot.clone().addScaledVector(d,-.06),bot,'blackg','feet');
    M('tripod',gTri,new THREE.SphereGeometry(.034,14,10),'rubber',{p:[bot.x,.03,bot.z],sub:'feet'});
    // curved support arm under the head, from the centre column out to the casting
    const crv=new THREE.QuadraticBezierCurve3(V3(0,H-.2,0),V3(u.x*.06,H-.08,u.z*.06),top.clone().addScaledVector(d,.12).addScaledVector(u,-.04));
    M('tripod',gTri,new THREE.TubeGeometry(crv,16,.012,8,false),'blackg',{sub:'head'});
    // flat spreader bar from the central hub to the leg
    const p0=V3(u.x*.05,yT-.045,u.z*.05),p1=top.clone().lerp(bot,.8),bar=M('tripod',gTri,new THREE.BoxGeometry(.03,p0.distanceTo(p1),.008),'blackg',{sub:'tray'});
    orient(bar,p0,p1);bar.rotateY(Math.PI/2);
  }
  // ---- accessory tray: deep rounded triangle with a raised rim and two eyepiece holes on each side ----
  const outer=roundTri(.27,.13),inner=roundTri(.25,.115);
  const holes=[];for(let k=0;k<3;k++){const a=k*2*Math.PI/3+Math.PI/3,cx=Math.sin(a)*.21,cz=-Math.cos(a)*.21,tx=Math.cos(a),tz=Math.sin(a);
    [-1,1].forEach(sd=>{const h=new THREE.Path();h.absarc(cx+tx*sd*.085,cz+tz*sd*.085,.03,0,Math.PI*2,true);holes.push(h);});}
  const floor=roundTri(.27,.13);floor.holes.push(...holes);
  M('tripod',gTri,flat(floor,.012,.004),'blackg',{p:[0,yT,0],sub:'tray'});                                   // tray floor with six holes
  const rim=roundTri(.27,.13);const ip=new THREE.Path(inner.getPoints(8).reverse());rim.holes.push(ip);
  M('tripod',gTri,flat(rim,.045,.006),'blackg',{p:[0,yT,0],sub:'tray'});                                     // raised rim around it
  // central spreader hub with the brushed CELESTRON medallion
  M('tripod',gTri,flat(roundTri(.03,.035),.03,.006),'blackg',{p:[0,yT-.06,0],sub:'tray'});
  M('tripod',gTri,new THREE.CylinderGeometry(.045,.045,.004,40),'silver',{p:[0,yT+.018,0],sub:'tray'});
  // central column from the head down through the tray, with the tension knob underneath
  M('tripod',gTri,new THREE.CylinderGeometry(.012,.012,H-yT+.05,14),'silver',{p:[0,(H+yT-.05)/2-.02,0],sub:'tray'});
  M('tripod',gTri,new THREE.CylinderGeometry(.03,.03,.03,16),'rubber',{p:[0,yT-.08,0],sub:'tray'});
}
const TRI={t:.55,H:0,B:0};
// CPC Deluxe 1100 HD drawing (OTA level): altitude axis is 530 mm above the tripod head, top of tube 689 mm above it.
// The model's axis was 575 mm above the head, so the mount is scaled by MS to match the drawing.
const MS=.93;      // CPC 11 mount + OTA drawing: axis is 532 mm above the base bottom (model was ~580 mm); a uniform scale keeps the tube round when it pitches, so widths come out ~6% narrow
function setTripod(t){TRI.t=t;TRI.H=.784+(1.18-.784)*t;TRI.B=.45+(.64-.45)*t;buildTripod(TRI.H,TRI.B);mountG.scale.setScalar(MS);mountG.position.y=TRI.H+.53-MS*PIV_Y;}      // base bottom rests on the head; axis = head + 530 mm
const mountPivY=()=>mountG.position.y+MS*PIV_Y;
const triTxt=()=>`Head ${Math.round(TRI.H*1000)} mm · footprint Ø${Math.round(958+352*TRI.t)} mm · altitude axis ${Math.round((TRI.H+.53)*1000)} mm · top of tube ${Math.round((TRI.H+.689)*1000)} mm (tube level)`;
setTripod(.55);

// port panel on the front of the fork base, where the handset cord plugs in (like the real CPC base)
const POWER_HIT=[];                 // meshes that act as the power switch when tapped
const gPort=G('fork',azG,FORK_EXP);
(function(){const sh=new THREE.Shape();                 // (z,y) profile: low hump on the drum that drops to a 45-degree front facet carrying the plate
  sh.moveTo(.05,.066);sh.quadraticCurveTo(.1,.078,.14,.078);sh.lineTo(.148,.0765);sh.lineTo(.2,.03);sh.quadraticCurveTo(.206,.022,.203,.012);sh.lineTo(.196,0);sh.lineTo(.05,0);sh.closePath();
  const g=new THREE.ExtrudeGeometry(sh,{depth:.16,bevelEnabled:true,bevelSize:.01,bevelThickness:.012,bevelSegments:5,curveSegments:14});g.translate(0,0,-.08);g.rotateY(-Math.PI/2);
  M('fork',gPort,g,'blackg',{p:[0,0,0],sub:'base'});
  const ang=Math.atan2(.0465,.052),rx=-(Math.PI/2-ang),nz=Math.sin(ang),ny=Math.cos(ang),cz=.174,cy=.0533,o=.0115;   // facet centre and outward normal
  M('fork',gPort,new THREE.PlaneGeometry(.162,.07),'panel',{p:[0,cy+ny*o,cz+nz*o],r:[rx,0,0],sub:'base',noShadow:true});
  // red-lit power switch on the right shoulder, silver 12 V post on the left shoulder
  // On/Off switch (red LED) on the right shoulder and 12 V jack on the left shoulder, beside the port housing (as on the CPC Deluxe HD)
  const shoulder=(sx)=>{const x=sx*.128,z=.118,rad=V3(x,0,z).normalize(),ax=rad.multiplyScalar(Math.sin(.85)).add(V3(0,Math.cos(.85),0)).normalize();
    return {p:V3(x,.05,z),q:new THREE.Quaternion().setFromUnitVectors(V3(0,1,0),ax),ax};};
  const put=(m,S,lift)=>{m.position.copy(S.p).addScaledVector(S.ax,lift);m.quaternion.copy(S.q);return m;};
  const R=shoulder(1),Lf=shoulder(-1);
  put(M('fork',gPort,new THREE.CylinderGeometry(.015,.016,.006,28),'black',{sub:'base'}),R,.002);                                   // switch bezel
  const sw=put(M('fork',gPort,new THREE.CylinderGeometry(.0105,.0105,.006,24),'black',{sub:'base'}),R,.005);sw.material.color.set(0x5a0a08);sw.userData.led=true;sw.userData.powerSwitch=true;   // red-lit switch: tap it to turn the telescope on/off
  {const ht=new THREE.Mesh(new THREE.SphereGeometry(.03,10,8),new THREE.MeshBasicMaterial({visible:false}));put(ht,R,.01);ht.userData.powerHit=true;gPort.add(ht);POWER_HIT.push(ht,sw);}   // larger invisible tap target
  put(M('fork',gPort,new THREE.BoxGeometry(.03,.008,.03),'black',{sub:'base'}),Lf,.002);                                            // 12 V jack: square boss…
  put(M('fork',gPort,new THREE.CylinderGeometry(.009,.009,.004,20),'gloss',{sub:'base'}),Lf,.007);                                  // …socket…
  put(M('fork',gPort,new THREE.CylinderGeometry(.0028,.0028,.006,12),'silver',{sub:'base'}),Lf,.009).userData.jack=true;            // …and centre pin
})();


/* ---- portable power station on the ground (modelled on a ~300 Wh unit such as the Jackery Explorer 300: 23 x 14 x 17 cm) ---- */
BASE.psBody=new THREE.MeshStandardMaterial({color:0x18191c,roughness:.6,metalness:.1});
BASE.psOrange=new THREE.MeshStandardMaterial({color:0xd8500f,roughness:.65,metalness:0});
const psTex=canvasTex(512,300,()=>{},true);
const POWER={on:true,boot:0};       // telescope power switch state
const PS={wh:293,used:0,lastMs:null,out:0,pct:100};
function drawPsPanel(){const c=psTex.image,x=c.getContext('2d'),W=c.width,H=c.height;
  x.fillStyle='#16171a';x.fillRect(0,0,W,H);x.strokeStyle='#2b2d33';x.lineWidth=6;x.strokeRect(3,3,W-6,H-6);
  const box=(a,b,w,h,t)=>{x.strokeStyle='#e8601c';x.lineWidth=2.5;x.beginPath();x.roundRect?x.roundRect(a,b,w,h,10):x.rect(a,b,w,h);x.stroke();if(t){x.fillStyle='#bfc3cb';x.font='bold 13px system-ui';x.textAlign='center';x.fillText(t,a+w/2,b+h+16);}};
  x.fillStyle='#e8601c';x.font='bold 24px system-ui';x.textAlign='left';x.fillText('POWER',26,52);x.fillStyle='#bfc3cb';x.font='bold 15px system-ui';x.fillText('STATION 300',28,74);
  x.fillStyle='#000';x.fillRect(170,22,170,70);x.fillStyle='#e9eef7';x.font='bold 13px system-ui';x.textAlign='center';x.fillText('INPUT',205,44);x.fillText('OUTPUT',305,44);
  x.font='bold 20px monospace';x.fillText('0W',205,74);x.fillText(Math.round(PS.out)+'W',305,74);
  x.strokeStyle='#e8601c';x.lineWidth=4;x.beginPath();x.arc(255,57,25,-Math.PI/2,-Math.PI/2+Math.PI*2*PS.pct/100);x.stroke();x.fillStyle='#fff';x.font='bold 15px system-ui';x.fillText(Math.round(PS.pct)+'%',255,62);
  x.fillStyle='#0b0b0d';x.beginPath();x.arc(440,62,38,0,7);x.fill();x.fillStyle='#8a8d95';x.font='11px system-ui';x.fillText('12V,10A',440,58);x.fillText('DC',440,74);
  box(22,128,92,120,'INPUT');x.fillStyle='#0b0b0d';x.beginPath();x.arc(68,190,15,0,7);x.fill();x.strokeStyle='#bbb';x.lineWidth=3;x.beginPath();x.arc(68,190,10,0,7);x.stroke();
  box(134,118,92,130,'USB');x.fillStyle='#0b0b0d';[[180,145,28,10],[180,180,30,16],[180,215,30,16]].forEach(([a,b,w,h])=>x.fillRect(a-w/2,b-h/2,w,h));
  box(246,118,244,130,'AC 300W');[[310,170],[425,170]].forEach(([a,b])=>{x.fillStyle='#0b0b0d';x.fillRect(a-36,b-34,72,68);x.fillStyle='#2b2d33';x.fillRect(a-16,b-18,6,22);x.fillRect(a+10,b-18,6,22);x.beginPath();x.arc(a,b+16,7,0,7);x.fill();});
  psTex.needsUpdate=true;}
const gPS=G('power',root,V3(.25,.15,.25));EXPL[EXPL.length-1].base.set(.9,0,-.3);   // on the ground, outside the tripod legs, on the side you see first
(function(){
  const sh=new THREE.Shape(),w=.23,h=.15,r=.025;sh.moveTo(-w/2+r,0);sh.lineTo(w/2-r,0);sh.quadraticCurveTo(w/2,0,w/2,r);sh.lineTo(w/2,h-r);sh.quadraticCurveTo(w/2,h,w/2-r,h);sh.lineTo(-w/2+r,h);sh.quadraticCurveTo(-w/2,h,-w/2,h-r);sh.lineTo(-w/2,r);sh.quadraticCurveTo(-w/2,0,-w/2+r,0);
  const body=new THREE.ExtrudeGeometry(sh,{depth:.12,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:3,curveSegments:8});body.translate(0,0,-.06);
  M('power',gPS,body,'psBody',{p:[0,.038,0],sub:'body'});
  [-1,1].forEach(sd=>{M('power',gPS,new THREE.BoxGeometry(.012,.12,.124),'psOrange',{p:[sd*.117,.11,0],sub:'body'});            // orange vented end panels
    for(let i=0;i<9;i++)M('power',gPS,new THREE.BoxGeometry(.004,.006,.1),'black',{p:[sd*.1235,.064+i*.011,0],sub:'body'});});
  const hs=new THREE.Shape();hs.moveTo(-.09,0);hs.lineTo(-.09,.035);hs.quadraticCurveTo(-.09,.07,-.05,.07);hs.lineTo(.05,.07);hs.quadraticCurveTo(.09,.07,.09,.035);hs.lineTo(.09,0);hs.lineTo(.07,0);hs.lineTo(.07,.03);hs.quadraticCurveTo(.07,.05,.05,.05);hs.lineTo(-.05,.05);hs.quadraticCurveTo(-.07,.05,-.07,.03);hs.lineTo(-.07,0);hs.closePath();
  const hg=new THREE.ExtrudeGeometry(hs,{depth:.05,bevelEnabled:true,bevelSize:.006,bevelThickness:.006,bevelSegments:3,curveSegments:10});hg.translate(0,0,-.025);
  M('power',gPS,hg,'psBody',{p:[0,.196,0],sub:'handle'});                                                                          // carry handle
  {const pm=M('power',gPS,new THREE.PlaneGeometry(.2,.117),'black',{p:[0,.11,.0695],sub:'panel',noShadow:true});pm.material.map=psTex;pm.material.color.set(0xffffff);pm.material.metalness=0;pm.material.roughness=.5;pm.material.emissiveMap=psTex;}   // front panel (lit screen)          // front panel
  M('power',gPS,cylZ(.012,.012,.03,20),'black',{p:[.072,.142,.075],sub:'plug'}).userData.plug=true;                                // 12 V car plug in the DC socket
  M('power',gPS,cylZ(.0085,.0085,.022,16),'psOrange',{p:[.072,.142,.093],sub:'plug'});
  drawPsPanel();
})();
gPS.rotation.y=Math.atan2(.9,-.3)+.35;   // front panel faces outward, toward the observer
const psCable=M('power',gPS.parent,new THREE.BufferGeometry(),'rubber',{sub:'cable',noShadow:true});psCable.userData.part='power';
const psTmp={a:new THREE.Vector3(),b:new THREE.Vector3(),key:''};
function updPowerCable(){                                        // cable from the power station's 12 V socket to the jack on the drive base (rebuilt only when something moved)
  const plug=ALLM.find(m=>m.userData.plug),jack=ALLM.find(m=>m.userData.jack);if(!plug||!jack)return;
  plug.updateWorldMatrix(true,false);jack.updateWorldMatrix(true,false);
  const a=psTmp.a.set(0,0,.03).applyMatrix4(plug.matrixWorld),b=jack.getWorldPosition(psTmp.b);
  const key=[a.x,a.z,b.x,b.y,b.z].map(v=>v.toFixed(3)).join();if(key===psTmp.key)return;psTmp.key=key;
  const fw=V3(Math.sin(gPS.rotation.y),0,Math.cos(gPS.rotation.y));                // out of the front panel, then down to the ground
  const out=a.clone().addScaledVector(fw,.07).setY(.05),gnd=a.clone().addScaledVector(fw,.12).lerp(V3(b.x,0,b.z),.35).setY(.033);
  const dir=V3(b.x,0,b.z).normalize(),mid=V3(b.x,0,b.z).addScaledVector(dir,.28).setY(.25),hang=V3(b.x,0,b.z).addScaledVector(dir,.12).setY(b.y-.25);   // sags outside the tripod legs, then rises to the jack
  const near=b.clone().addScaledVector(dir,.035).add(V3(0,-.02,0));
  psCable.geometry.dispose();psCable.geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a,out,gnd,mid,hang,near,b]),120,.005,8);}
function updPowerStation(dt,slewing,tracking){              // battery drains with the simulated clock; output shows a rough load
  PS.out=!POWER.on?0:(slewing?28:tracking?14:7);
  if(PS.lastMs!==null){const h=(simMs-PS.lastMs)/3.6e6;if(h>0&&h<12)PS.used+=PS.out*1.15*h;}PS.lastMs=simMs;   // 15% conversion loss
  PS.pct=clamp(100-PS.used/PS.wh*100,0,100);if(!updPowerStation.t||performance.now()-updPowerStation.t>1000){updPowerStation.t=performance.now();drawPsPanel();}}

// hand controller: sits in a cradle bolted to the outer face of an arm, with a coiled cord down to the port panel.
// buildHC(sx) makes the left-arm version (sx=-1, two-arm mode) or the right-arm version (sx=+1, one-arm mode)
function buildHC(sx,zc){
  const g=G('handset',azG,V3(sx*.3,0,.4)),yc=.3;
  M('handset',g,new THREE.BoxGeometry(.012,.2,.088),'blackg',{p:[sx*.276,yc,zc],sub:'body'});            // cradle back plate
  M('handset',g,new THREE.BoxGeometry(.05,.03,.092),'blackg',{p:[sx*.295,yc-.105,zc],sub:'body'});       // cradle cup
  [-1,1].forEach(k=>M('handset',g,new THREE.BoxGeometry(.045,.12,.008),'blackg',{p:[sx*.293,yc-.06,zc+k*.046],sub:'body'}));
  M('handset',g,new THREE.BoxGeometry(.03,.2,.07),'rubber',{p:[sx*.297,yc,zc],sub:'body'});               // handset body
  M('handset',g,new THREE.PlaneGeometry(.064,.195).rotateY(sx*Math.PI/2),'hcb',{p:[sx*.3125,yc,zc],sub:'body'}).userData.keypad=true;   // keypad face
  // coiled cord: path from handset bottom, around the arm's front edge, to the panel; a helix is wound around that path
  // The cord ends in a plug seated in the HAND CONTROL port on the front plate (port position computed from the plate layout)
  const fa=Math.atan2(.0465,.052),fn=V3(0,Math.cos(fa),Math.sin(fa)),fup=V3(0,Math.sin(fa),-Math.cos(fa));       // plate normal and up-slope direction
  const port=V3(0,.0533,.174).addScaledVector(fn,.0115).add(V3((86/512-.5)*.162,0,0)).addScaledVector(fup,(.5-(124/220))*.07);
  const Q=sx<0?V3(-.112,.078,.222):V3(-.02,.09,.245);                                                                  // where the coils end, at the drum's front edge
  const P=sx<0?[V3(-.3,yc-.12,zc),V3(-.31,.12,zc+.02),V3(-.3,.085,.12),V3(-.28,.077,.205),V3(-.19,.08,.235),Q]
              :[V3(.3,yc-.12,zc),V3(.31,.12,zc+.02),V3(.3,.085,.12),V3(.29,.075,.21),V3(.2,.082,.24),V3(.08,.088,.25),Q];
  const path=new THREE.CatmullRomCurve3(P),N=1500,pts=[];let nrm=V3(1,0,0);
  for(let i=0;i<=N;i++){const t=i/N,c=path.getPoint(t),T=path.getTangent(t);
    nrm=nrm.clone().sub(T.clone().multiplyScalar(nrm.dot(T))).normalize();const bn=T.clone().cross(nrm),a=t*Math.PI*2*44,rr=.009*Math.min(1,(1-t)*8);   // coils taper to a straight lead
    pts.push(c.clone().addScaledVector(nrm,Math.cos(a)*rr).addScaledVector(bn,Math.sin(a)*rr));}
  M('handset',g,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),N,.0032,6),'rubber',{sub:'cable',noShadow:true});
  // straight lead from the coils into the port, with a ferrite bead, a strain relief and the plug body
  const lead=new THREE.CatmullRomCurve3([Q,Q.clone().lerp(port,.5).add(V3(0,-.004,.025)),port.clone().addScaledVector(fn,.035),port.clone().addScaledVector(fn,.02)]);
  M('handset',g,new THREE.TubeGeometry(lead,40,.0032,6),'rubber',{sub:'cable',noShadow:true});
  {const fb=M('handset',g,new THREE.CylinderGeometry(.0075,.0075,.026,12),'rubber',{sub:'cable'});fb.position.copy(lead.getPoint(.3));fb.quaternion.setFromUnitVectors(V3(0,1,0),lead.getTangent(.3));}   // ferrite bead
  const qn=new THREE.Quaternion().setFromUnitVectors(V3(0,1,0),fn);
  {const sr=M('handset',g,new THREE.CylinderGeometry(.0035,.005,.014,10),'rubber',{sub:'cable'});sr.position.copy(port).addScaledVector(fn,.024);sr.quaternion.copy(qn);}
  {const pl=M('handset',g,new THREE.BoxGeometry(.014,.016,.009),'grip',{sub:'cable'});pl.position.copy(port).addScaledVector(fn,.009);pl.quaternion.copy(qn);}   // RJ-style plug seated in the port
  return g;
}
const gHCL=buildHC(-1,0),gHCR=buildHC(1,.02);gHCR.visible=false;
// ground, pad, table, rocks
const ground=new THREE.Mesh(new THREE.CircleGeometry(120,64),new THREE.MeshStandardMaterial({map:groundTex,roughness:1,metalness:0,envMapIntensity:.15}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const pad=new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.2,.03,64),new THREE.MeshStandardMaterial({color:0x1c1e22,roughness:.95,envMapIntensity:.1}));pad.position.y=.015;pad.receiveShadow=true;scene.add(pad);
(function(){const t=new THREE.Group();const top=new THREE.Mesh(new THREE.BoxGeometry(.9,.04,.5),new THREE.MeshStandardMaterial({color:0x4a3a2a,roughness:.8,envMapIntensity:.2}));top.position.y=.75;top.castShadow=top.receiveShadow=true;t.add(top);
  [[-.4,-.22],[.4,-.22],[-.4,.22],[.4,.22]].forEach(([x,z])=>{const l=new THREE.Mesh(new THREE.BoxGeometry(.04,.75,.04),new THREE.MeshStandardMaterial({color:0x888d96,metalness:.8,roughness:.4}));l.position.set(x,.375,z);l.castShadow=true;t.add(l);});
  t.position.set(1.7,0,.6);t.rotation.y=-.5;scene.add(t);})();

// Celestron Eyepiece and Filter Kit (1.25"): 32/17/13/8/6 mm Plossls, 2x Barlow, filters #80A blue, #58 green, #56 light green, #25 red, #21 orange, #12 yellow and a Moon filter, in a foam-lined metal case.
BASE.foam=new THREE.MeshStandardMaterial({color:0x121316,roughness:1,metalness:0});
BASE.case=new THREE.MeshStandardMaterial({color:0xaeb3bb,metalness:.85,roughness:.35});
[['f80A',0x2f6fe0],['f58',0x2f9a3a],['f56',0x8fd05a],['f25',0xc8281e],['f21',0xe87a1c],['f12',0xe8d41c],['fMoon',0x8d939c]].forEach(([k,c])=>{BASE[k]=new THREE.MeshStandardMaterial({color:c,roughness:.15,metalness:0,transparent:true,opacity:.82});});
const kitRoot=new THREE.Group();kitRoot.position.set(1.876,.77,.696);kitRoot.rotation.y=2.4;scene.add(kitRoot);
const gCapT=new THREE.Group();gCapT.position.set(1.477,.77,.445);scene.add(gCapT);buildCap(gCapT,true);   // where the cap rests on the table when it is off the scope
function setCap(v){CAP.on=v;gCap.visible=v;gCapT.visible=!v;$$('.capb').forEach(b=>{b.classList.toggle('on',v);b.textContent=v?'Lens cap: ON':'Lens cap: OFF';});}
setCap(false);
const gKit=G('kit',kitRoot,V3(0,0,0));
(function(){
  M('kit',gKit,new THREE.BoxGeometry(.38,.05,.26),'case',{p:[0,.025,0],sub:'case'});
  M('kit',gKit,new THREE.BoxGeometry(.35,.012,.23),'foam',{p:[0,.052,0],sub:'case'});                     // die-cut foam
  const lid=new THREE.Group();lid.position.set(0,.05,-.13);lid.rotation.x=-1.75;gKit.add(lid);                // lid hinged along the back edge, standing open
  M('kit',lid,new THREE.BoxGeometry(.38,.012,.26),'case',{p:[0,0,.13],sub:'case'});
  M('kit',lid,new THREE.BoxGeometry(.35,.01,.23),'foam',{p:[0,-.009,.13],sub:'case'});
  [-.12,.12].forEach(x=>M('kit',gKit,new THREE.BoxGeometry(.04,.02,.008),'silver',{p:[x,.04,.134],sub:'case'}));   // latches
  const rotZ=g=>g.rotateZ(Math.PI/2),rotX=g=>g.rotateX(Math.PI/2);
  // eyepieces lie along x in the left part of the case (focal length, body radius, body length)
  [[32,.022,.062],[17,.019,.05],[13,.018,.046],[8,.017,.044],[6,.016,.042]].forEach(([fl,r,L],i)=>{
    const z=(i-2)*.044,y=.058+r;
    M('kit',gKit,rotZ(new THREE.CylinderGeometry(.0159,.0159,.032,24)),'silver',{p:[-.168+.016,y,z],sub:'eyepieces'});   // 1.25-inch barrel
    M('kit',gKit,rotZ(new THREE.CylinderGeometry(r,r,L,28)),'black',{p:[-.152+L/2,y,z],sub:'eyepieces'});
    M('kit',gKit,rotZ(new THREE.CylinderGeometry(r*.9,r*1.02,.016,28)),'rubber',{p:[-.152+L+.008,y,z],sub:'eyepieces'});  // eyecup
    M('kit',gKit,rotZ(new THREE.CylinderGeometry(r+.0006,r+.0006,.006,28)),'silver',{p:[-.152+L*.45,y,z],sub:'eyepieces'}); // focal-length band
  });
  // 2x Barlow along z at the right edge
  M('kit',gKit,rotX(new THREE.CylinderGeometry(.0159,.0159,.04,24)),'silver',{p:[.165,.058+.0159,-.075],sub:'barlow'});
  M('kit',gKit,rotX(new THREE.CylinderGeometry(.021,.021,.085,28)),'black',{p:[.165,.058+.021,-.0],sub:'barlow'});
  M('kit',gKit,rotX(new THREE.CylinderGeometry(.018,.02,.02,28)),'rubber',{p:[.165,.058+.021,.052],sub:'barlow'});
  // seven filters in black cells
  ['f80A','f58','f56','f25','f21','f12','fMoon'].forEach((k,i)=>{const c=i%2,r=(i/2)|0,x=.04+c*.052,z=-.0675+r*.045;
    M('kit',gKit,new THREE.CylinderGeometry(.0185,.0185,.012,24),'black',{p:[x,.064,z],sub:'filters'});
    M('kit',gKit,new THREE.CylinderGeometry(.0145,.0145,.014,24),k,{p:[x,.065,z],sub:'filters'});});
})();

for(let i=0;i<24;i++){const a=Math.random()*Math.PI*2,r=6+Math.random()*30,s=.2+Math.random()*.7,m=new THREE.Mesh(new THREE.DodecahedronGeometry(s,0),new THREE.MeshStandardMaterial({color:0x3a3530,roughness:1,envMapIntensity:.15}));
  m.position.set(Math.sin(a)*r,s*.4,Math.cos(a)*r);m.rotation.set(Math.random()*3,Math.random()*3,0);m.castShadow=true;scene.add(m);}

// optical rays (shown in cutaway or with the Optics button)
const raysG=new THREE.Group();altG.add(raysG);raysG.visible=false;
function rayPath(h){                          // polyline [z,y] for a ray entering at height h (see learn notes)
  const sep=OPT.zp-OPT.zs,hs=h*(1-sep/OPT.fp),fz=OPT.zs+OPT.Mg*(OPT.fp-sep),slope=-hs/(fz-OPT.zs);
  const zi=(OPT.zd+hs-slope*OPT.zs)/(1-slope),yi=zi-OPT.zd;       // where the ray meets the 45° diagonal mirror
  return [[-0.75,h],[OPT.zp,h],[OPT.zs,hs],[zi,yi],[OPT.zd,fz-OPT.zd]];
}
const RAY_H=[.07,-.07,.11,-.11,.135,-.135],RAY_COL=[0xffd54a,0x6ad0ff,0xff7ab8,0xff7ab8];
const rayPts=RAY_H.map(h=>rayPath(h).map(p=>V3(0,p[1],p[0])));
const particles=[];
// "Follow the light": one big glowing photon that travels the light path a stage at a time
const photon={on:false,a:0,b:1,t:0,pts:rayPath(.11).map(p=>V3(0,p[1],p[0]))};
photon.s=new THREE.Sprite(new THREE.SpriteMaterial({color:0xffe27a,transparent:true,depthTest:false,depthWrite:false}));photon.s.scale.set(.1,.1,1);photon.s.renderOrder=20;photon.s.visible=false;altG.add(photon.s);
photon.trail=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:0xffd54a,transparent:true,opacity:.85,depthTest:false}));photon.trail.renderOrder=19;altG.add(photon.trail);photon.trail.visible=false;
function stepPhoton(dt){
  photon.s.visible=photon.trail.visible=photon.on;if(!photon.on)return;
  if(!photon.s.material.map)photon.s.material.map=glowTex;
  photon.t+=dt*.45;if(photon.t>1.35)photon.t=0;const u=Math.min(1,photon.t);
  const P=photon.pts,seg=[];for(let i=photon.a;i<photon.b;i++)seg.push([P[i],P[i+1]]);
  const L=seg.map(q=>q[0].distanceTo(q[1])),tot=L.reduce((a,b)=>a+b,0);let d=u*tot,k=0;while(k<seg.length-1&&d>L[k]){d-=L[k];k++;}
  const pos=seg[k][0].clone().lerp(seg[k][1],Math.min(1,d/L[k]));photon.s.position.copy(pos);
  const tr=[P[photon.a]];for(let i=0;i<k;i++)tr.push(seg[i][1]);tr.push(pos);
  if(tr[0].distanceTo(pos)>.002){photon.trail.geometry.dispose();photon.trail.geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tr,false,'catmullrom',0),Math.max(8,tr.length*12),.004,6);}   // thick glowing trail
  const pul=1+.25*Math.sin(performance.now()/120);photon.s.scale.set(.1*pul,.1*pul,1);
}
(function(){const up=V3(0,1,0);
  rayPts.forEach((pts,ri)=>{let L=0;const lens=[];for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],d=b.clone().sub(a),l=d.length();lens.push(l);L+=l;
    const m=new THREE.Mesh(new THREE.CylinderGeometry(.0013,.0013,l,6),new THREE.MeshBasicMaterial({color:RAY_COL[Math.min(i,3)]}));
    m.position.copy(a.clone().add(b).multiplyScalar(.5));m.quaternion.setFromUnitVectors(up,d.normalize());raysG.add(m);}
    for(let k=0;k<3;k++){const s=new THREE.Mesh(new THREE.SphereGeometry(.0055,8,6),new THREE.MeshBasicMaterial({color:0xffffff}));raysG.add(s);particles.push({s,pts,lens,L,t:k/3});}});
  const f=new THREE.Mesh(new THREE.SphereGeometry(.007,12,8),new THREE.MeshBasicMaterial({color:0x7dffb0}));const fp=rayPts[0][4];f.position.copy(fp);raysG.add(f);})();

// real-sky dome: stars as shader points, solar-system bodies as sprites
const stars=OBJ.filter(o=>o.type==='star'),starGeo=new THREE.BufferGeometry();
starGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(stars.length*3),3));
starGeo.setAttribute('size',new THREE.BufferAttribute(new Float32Array(stars.length),1));
starGeo.setAttribute('col',new THREE.BufferAttribute(new Float32Array(stars.length*3),3));
stars.forEach((o,i)=>{const sz=Math.max(3,2+(2.6-o.mag)*1.9)*renderer.getPixelRatio();starGeo.attributes.size.array[i]=sz;
  const c=new THREE.Color(o.name==='Betelgeuse'||o.name==='Antares'||o.name==='Aldebaran'||o.name==='Arcturus'?0xffc08a:(o.name==='Rigel'||o.name==='Vega'||o.name==='Sirius'||o.name==='Spica')?0xb8cfff:0xffffff);
  starGeo.attributes.col.array.set([c.r,c.g,c.b],i*3);});
const starMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{op:{value:1}},
  vertexShader:'attribute float size;attribute vec3 col;varying vec3 vc;void main(){vc=col;gl_PointSize=size;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:'uniform float op;varying vec3 vc;void main(){float d=length(gl_PointCoord-vec2(.5));gl_FragColor=vec4(vc,smoothstep(.5,.0,d)*op);}'});
const starPts=new THREE.Points(starGeo,starMat);starPts.frustumCulled=false;scene.add(starPts);
const glowTex=canvasTex(64,64,(x,w,h)=>{const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.25,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);});
const BODY_COL={sun:0xfff2c0,moon:0xe8e8e0,mercury:0xbbbbbb,venus:0xfff5e0,mars:0xff9a6a,jupiter:0xffe9c0,saturn:0xf0d9a0};
const bodySprites=OBJ.filter(o=>BODY_COL[o.id]).map(o=>{const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:BODY_COL[o.id],depthWrite:false,transparent:true,fog:false}));
  s.scale.setScalar(o.id==='sun'?14:o.id==='moon'?6:o.id==='venus'||o.id==='jupiter'?3.2:2.2);scene.add(s);return {o,s};});
const DOME=90,bgNight=new THREE.Color(0x050810),bgDay=new THREE.Color(0x6a9ad8),bgCol=new THREE.Color();
function altAzVec(alt,az,r){const a=alt*D2R,A=az*D2R;return V3(Math.sin(A)*Math.cos(a)*r,Math.sin(a)*r,-Math.cos(A)*Math.cos(a)*r);}
/* ---- Big Dipper -> North Star guide: stick figures for both dippers, a dashed pointer line and labels ---- */
const DIP={big:[['Alkaid','Mizar'],['Mizar','Alioth'],['Alioth','Megrez'],['Megrez','Dubhe'],['Dubhe','Merak'],['Merak','Phecda'],['Phecda','Megrez']],
  little:[['Polaris','Yildun'],['Yildun','Epsilon UMi'],['Epsilon UMi','Zeta UMi'],['Zeta UMi','Kochab'],['Kochab','Pherkad'],['Pherkad','Eta UMi'],['Eta UMi','Zeta UMi']]};
const starById=id=>OBJ.find(o=>o.id===id);
const guide={on:true,g:new THREE.Group()};scene.add(guide.g);
guide.fig=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x5fa0ff,transparent:true,opacity:.95,depthWrite:false,fog:false}));
guide.fig.geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array((DIP.big.length+DIP.little.length)*6),3));guide.g.add(guide.fig);
guide.ptr=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:0xff9a4a,dashSize:1.6,gapSize:1.1,transparent:true,opacity:.95,depthWrite:false,fog:false}));
guide.ptr.geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));guide.g.add(guide.ptr);
function guideLabel(text,col){const c=document.createElement('canvas');c.width=512;c.height=96;const x=c.getContext('2d');x.font='bold 40px system-ui';const w=Math.min(500,x.measureText(text).width+36);
  x.fillStyle='rgba(10,14,24,.75)';x.beginPath();x.moveTo(18,8);x.lineTo(w-18,8);x.arc(w-18,48,40,-Math.PI/2,Math.PI/2);x.lineTo(18,88);x.arc(18,48,40,Math.PI/2,Math.PI*1.5);x.fill();
  x.fillStyle=col;x.textBaseline='middle';x.fillText(text,18,50);const t=new THREE.CanvasTexture(c);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthWrite:false,fog:false,transparent:true}));sp.scale.set(20,20*96/512,1);sp.center.set(18/512,.5);guide.g.add(sp);return sp;}
guide.dots=[...new Set([...DIP.big,...DIP.little].flat())].map(id=>{const o=starById(id),sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xffffff,depthWrite:false,fog:false,transparent:true}));
  const k=Math.max(.5,1.6-.25*o.mag)*(id==='Polaris'?1.5:1);sp.scale.set(k,k,1);guide.g.add(sp);return {o,sp};});   // brighter dots so the pattern is easy to spot
guide.lab={pol:guideLabel('★ Polaris – the North Star','#ffd36a'),big:guideLabel('Big Dipper','#9cc4ff'),ptr:guideLabel('Pointer stars → follow ×5','#ffb27a'),little:guideLabel('Little Dipper','#9cc4ff')};
function updGuide(){
  guide.g.visible=guide.on;if(!guide.on)return;
  const V=id=>{const o=starById(id);return altAzVec(o.alt,o.az,DOME-1);};let i=0;const a=guide.fig.geometry.attributes.position.array;
  [...DIP.big,...DIP.little].forEach(([p,q])=>{a.set([...V(p).toArray(),...V(q).toArray()],i);i+=6;});guide.fig.geometry.attributes.position.needsUpdate=true;guide.fig.geometry.computeBoundingSphere();
  const m=starById('Merak'),d=starById('Dubhe'),pl=starById('Polaris'),pa=guide.ptr.geometry.attributes.position.array;
  pa.set([...V('Dubhe').toArray(),...V('Polaris').toArray()]);guide.ptr.geometry.attributes.position.needsUpdate=true;guide.ptr.computeLineDistances();guide.ptr.geometry.computeBoundingSphere();
  guide.dots.forEach(d=>d.sp.position.copy(altAzVec(d.o.alt,d.o.az,DOME-1.2)));
  guide.lab.pol.position.copy(V('Polaris')).add(V3(1.2,0,0));guide.lab.big.position.copy(V('Megrez'));guide.lab.little.position.copy(V('Zeta UMi'));
  guide.lab.ptr.position.copy(V('Dubhe').lerp(V('Polaris'),.45));
}
function updateDome(){
  updGuide();
  stars.forEach((o,i)=>{const v=altAzVec(o.alt,o.az,DOME);starGeo.attributes.position.array.set([v.x,v.y,v.z],i*3);});
  starGeo.attributes.position.needsUpdate=true;
  bodySprites.forEach(b=>{const v=altAzVec(b.o.alt,b.o.az,DOME-4);b.s.position.copy(v);});
  const day=clamp((SUN.alt+6)/12,0,1);bgCol.copy(bgNight).lerp(bgDay,day);scene.background.copy(bgCol);scene.fog.color.copy(bgCol);
  {const g=lpLoss()/3;starMat.uniforms.op.value=(1-day)*(1-.45*g);bgCol.lerp(new THREE.Color(0x1d1c24),g*.6*(1-day));scene.background.copy(bgCol);scene.fog.color.copy(bgCol);}
  starMat.uniforms.op.value=Math.min(starMat.uniforms.op.value,1-day);hemi.intensity=.5+.5*day;
}


document.addEventListener('click',e=>{if(e.target.closest('[data-cap]')){setCap(!CAP.on);if(typeof SU!=='undefined')SU.capPrev=null;}});
