/* Seestar S50 Pro Simulator – s50-scene.js
   The 3D world, built with Three.js: ground and table, the short carbon-fibre tripod, the S50 Pro itself
   (base → battery column with the power button → turning/tilting optical head), the EQ wedge and magnetic solar filter,
   a sky dome with the real bright stars, and a simple orbit camera.
   World axes: +Y is up, +X is east, -Z is north.  The head's lens looks along its local -Z direction,
   so an azimuth of 0° (north) means "the lens faces -Z".  Needs Three.js and s50-model.js. */
'use strict';

const SC={};                         // everything the scene exposes to the rest of the app
const SKY_R=40;                      // radius of the sky dome (metres)
const TABLE_TOP=0.76;                // height of the little table the tripod stands on (metres)
const SCOPE_H=TABLE_TOP+0.227;       // tripod head height: the manual says the tripod is 227 mm tall (widest leg angle)
const dirFromAltAz=(alt,az,r=1)=>new THREE.Vector3(Math.cos(alt*D2R)*Math.sin(az*D2R),Math.sin(alt*D2R),-Math.cos(alt*D2R)*Math.cos(az*D2R)).multiplyScalar(r);   // alt/az → 3D direction

function initScene(canvas){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;   // photographic colour handling
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;   // shadows are recomputed only when something moves                                                  // soft shadows
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x04060c).convertSRGBToLinear();
  const camera=new THREE.PerspectiveCamera(40,1,0.02,200);
  const sRGB=h=>new THREE.Color(h).convertSRGBToLinear();                                    // hex colours are written in sRGB; the renderer wants linear
  const tex=c=>{const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return t;};

  /* ---- reflections: a little "photo studio" (soft boxes + a dim dome) that shiny surfaces mirror ---- */
  try{
    const es=new THREE.Scene(),g=document.createElement('canvas');g.width=4;g.height=256;const c=g.getContext('2d'),gr=c.createLinearGradient(0,0,0,256);
    gr.addColorStop(0,'#1b2438');gr.addColorStop(.45,'#3a465e');gr.addColorStop(.5,'#2a2e36');gr.addColorStop(1,'#0b0c0f');c.fillStyle=gr;c.fillRect(0,0,4,256);
    es.add(new THREE.Mesh(new THREE.SphereGeometry(30,24,16),new THREE.MeshBasicMaterial({map:tex(g),side:THREE.BackSide})));
    const box=(w,h,x,y,z,r,gg,b)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color().setRGB(r,gg,b),side:THREE.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);es.add(m);};
    box(4,3,4,4,5,9,9,9);          // big warm key soft-box, front-right-above
    box(1,4,-5,1.5,2,1.6,2,3.2);   // cool tall fill strip on the left
    box(5,1,0,5,-4,3,3,3.6);       // rim strip behind and above
    box(3,1.2,-3,0.5,-5,1,1,1.2);
    const pm=new THREE.PMREMGenerator(renderer);SC.envTex=pm.fromScene(es,0.03).texture;scene.environment=SC.envTex;pm.dispose();
  }catch(e){console.warn('Environment map unavailable',e);}

  /* ---- lights (a "night helper" studio light so the telescope stays visible; real nights are darker!) ---- */
  scene.add(new THREE.HemisphereLight(0xdde3ff,0x1a1d26,0.25));
  const key=new THREE.DirectionalLight(0xfff9f2,2.0);key.position.set(1.6,SCOPE_H+1.6,1.9);key.target.position.set(0,SCOPE_H+.1,0);scene.add(key,key.target);
  key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-.9,right:.9,top:.9,bottom:-.9,near:.3,far:6});key.shadow.camera.updateProjectionMatrix();key.shadow.bias=-0.0003;key.shadow.normalBias=.006;
  const rim=new THREE.DirectionalLight(0x7a96ff,0.9);rim.position.set(-3,SCOPE_H+1,-2.5);scene.add(rim);

  /* ---- ground + compass letters ---- */
  const grassTex=(()=>{const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d'),r=mulberry32(11);g.fillStyle='#2b3a22';g.fillRect(0,0,256,256);
    for(let i=0;i<5200;i++){const x=r()*256,y=r()*256,l=3+r()*7;g.strokeStyle=`rgba(${30+r()*40|0},${60+r()*60|0},${20+r()*30|0},${.35+r()*.4})`;g.lineWidth=.8+r();g.beginPath();g.moveTo(x,y);g.lineTo(x+(r()-.5)*3,y-l);g.stroke();}
    const t=tex(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(12,12);return t;})();       // a procedural patch of grass
  const patioTex=(()=>{const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d'),r=mulberry32(5);g.fillStyle='#4a4338';g.fillRect(0,0,512,512);   // flagstone: irregular tan slabs with dark gaps
    for(let y=0;y<512;y+=96)for(let x=-40;x<512;x+=120){const w=96+r()*40,h=80+r()*30,ox=x+r()*30,oy=y+r()*20,v=150+r()*34|0,col=`rgb(${v+12},${v},${v-22})`;
      g.fillStyle=col;g.beginPath();g.moveTo(ox+10,oy);g.lineTo(ox+w-8,oy+r()*6);g.lineTo(ox+w,oy+h-10);g.lineTo(ox+w-12,oy+h);g.lineTo(ox+6,oy+h-r()*6);g.lineTo(ox,oy+12);g.closePath();g.fill();
      for(let i=0;i<40;i++){g.fillStyle=`rgba(${60+r()*60|0},${45+r()*40|0},30,${.05+r()*.09})`;g.fillRect(ox+r()*w,oy+r()*h,2+r()*14,2+r()*8);}}
    const t=tex(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(5,5);return t;})();
  const ground=new THREE.Mesh(new THREE.CircleGeometry(9,64),new THREE.MeshStandardMaterial({color:sRGB(0x1b211d),roughness:1,envMapIntensity:.2}));
  ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  function label(txt,col){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');g.fillStyle=col;g.font='bold 96px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillText(txt,64,70);
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex(c),transparent:true,depthWrite:false}));s.scale.set(.7,.7,1);return s;}
  [['N',0,'#ff7a6b'],['E',90,'#c9d4f0'],['S',180,'#c9d4f0'],['W',270,'#c9d4f0']].forEach(([t,az,col])=>{const s=label(t,col);s.position.copy(dirFromAltAz(0,az,6.5));s.position.y=.35;scene.add(s);});

  /* ---- the sky dome: real bright stars, the Moon, the Sun and planets (positions refreshed twice a second) ---- */
  const starObjs=OBJ.filter(o=>o.type==='star'),starPos=new Float32Array(starObjs.length*3),starCol=new Float32Array(starObjs.length*3);
  const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.BufferAttribute(starPos,3));starGeo.setAttribute('color',new THREE.BufferAttribute(starCol,3));
  const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({size:2.4,sizeAttenuation:false,vertexColors:true,depthWrite:false}));stars.frustumCulled=false;scene.add(stars);
  function glow(col,size){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,col);gr.addColorStop(.35,col);gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex(c),transparent:true,depthWrite:false}));s.scale.set(size,size,1);return s;}
  const moon=glow('#f4f1e4',3.2),sun=glow('#fff2b0',7),bodies={moon,sun};scene.add(moon);scene.add(sun);
  ['mercury','venus','mars','jupiter','saturn'].forEach(n=>{const s=glow({mercury:'#d8d0c8',venus:'#fff6d8',mars:'#ff9a70',jupiter:'#ffe6c0',saturn:'#f0dca0'}[n],1.1);bodies[n]=s;scene.add(s);});
  function updateSky(){
    starObjs.forEach((o,i)=>{
      const v=dirFromAltAz(o.alt,o.az,SKY_R),b=o.alt<-1?0:clamp(1.15-o.mag*.2,.28,1)*clamp(1-(SUN.alt+6)/12,0,1);   // stars fade at dawn/dusk
      starPos.set([v.x,v.y,v.z],i*3);starCol.set([b,b,b*1.05],i*3);
    });
    starGeo.attributes.position.needsUpdate=true;starGeo.attributes.color.needsUpdate=true;
    for(const id in bodies){const o=OBJ.find(x=>x.id===id);if(!o)continue;bodies[id].visible=o.alt>-1;bodies[id].position.copy(dirFromAltAz(o.alt,o.az,SKY_R-1));}
    moon.material.opacity=.35+.65*(MOON.illum||0);
    scene.background.setRGB(.016+.35*clamp((SUN.alt+8)/14,0,1)*.6,.024+.45*clamp((SUN.alt+8)/14,0,1)*.7,.05+.7*clamp((SUN.alt+8)/14,0,1)).convertSRGBToLinear();   // the sky brightens in the daytime
  }

  /* ---- materials ---- */
  const white=new THREE.MeshPhysicalMaterial({color:sRGB(0xf0f1f3),roughness:.42,metalness:0,clearcoat:.45,clearcoatRoughness:.38,envMapIntensity:.9});   // satin white plastic
  const blackGlass=new THREE.MeshPhysicalMaterial({color:sRGB(0x050506),roughness:.05,metalness:0,clearcoat:1,clearcoatRoughness:.03,reflectivity:.85,envMapIntensity:1.9});   // glossy black glass
  const dark=new THREE.MeshStandardMaterial({color:sRGB(0x15171b),roughness:.5,metalness:.4,envMapIntensity:1});                                                      // matte black anodised metal
  const lensGlass=new THREE.MeshPhysicalMaterial({color:sRGB(0x0b2a1a),roughness:.03,metalness:.25,clearcoat:1,clearcoatRoughness:0,envMapIntensity:2.4,emissive:sRGB(0x03100a)});   // coated lens: green
  const lensGlass2=new THREE.MeshPhysicalMaterial({color:sRGB(0x2b1140),roughness:.03,metalness:.3,clearcoat:1,clearcoatRoughness:0,envMapIntensity:2.4});                     // second coating: purple
  const carbon=new THREE.MeshStandardMaterial({color:sRGB(0x1a1b1e),roughness:.5,metalness:.35,envMapIntensity:.8});
  const legMetal=new THREE.MeshStandardMaterial({color:sRGB(0x2c2f35),roughness:.32,metalness:.85,envMapIntensity:1.1});
  const silver=new THREE.MeshStandardMaterial({color:sRGB(0xb9bdc5),roughness:.22,metalness:.95,envMapIntensity:1.4});          // the bright aluminium ring round the lens window

  /* Smooth the shading of a (non-indexed) geometry: vertices at the same spot share an averaged normal, but only with faces that
     bend away by less than `deg` degrees, so real creases stay sharp while curved surfaces look round. */
  function creaseNormals(g,deg){
    const p=g.attributes.position,n=g.attributes.normal,N=p.count,key=i=>Math.round(p.getX(i)*5e4)+','+Math.round(p.getY(i)*5e4)+','+Math.round(p.getZ(i)*5e4);
    const groups=new Map();for(let i=0;i<N;i++){const k=key(i);let a=groups.get(k);if(!a){a=[];groups.set(k,a);}a.push(i);}
    const out=new Float32Array(N*3),cs=Math.cos(deg*Math.PI/180);
    for(const idx of groups.values())for(const i of idx){let x=0,y=0,z=0;const nx=n.getX(i),ny=n.getY(i),nz=n.getZ(i);
      for(const j of idx){const mx=n.getX(j),my=n.getY(j),mz=n.getZ(j);if(nx*mx+ny*my+nz*mz>cs){x+=mx;y+=my;z+=mz;}}
      const l=Math.hypot(x,y,z)||1;out[i*3]=x/l;out[i*3+1]=y/l;out[i*3+2]=z/l;}
    n.array.set(out);n.needsUpdate=true;}

  /* ---- helpers: rounded boxes (the real body has no sharp corners) ---- */
  function rrShape(w,h,r,rb=r){                                      // a rounded rectangle (rb = the bottom corners' radius, if different); long straight edges are cut into short pieces,
    const x=-w/2,y=-h/2,sh=new THREE.Shape();                          // because three.js' bevel pinches the middle of one long straight edge
    const ln=(x2,y2)=>{const c=sh.currentPoint,n=Math.max(2,Math.ceil(Math.hypot(x2-c.x,y2-c.y)/.006));for(let i=1;i<=n;i++)sh.lineTo(c.x+(x2-c.x)*i/n,c.y+(y2-c.y)*i/n);};
    sh.moveTo(x+rb,y);ln(x+w-rb,y);sh.absarc(x+w-rb,y+rb,rb,-Math.PI/2,0);ln(x+w,y+h-r);sh.absarc(x+w-r,y+h-r,r,0,Math.PI/2);
    ln(x+r,y+h);sh.absarc(x+r,y+h-r,r,Math.PI/2,Math.PI);ln(x,y+rb);sh.absarc(x+rb,y+rb,rb,Math.PI,1.5*Math.PI);return sh;}
  function rrBox(w,h,d,r,bev,mat,rb=r){                              // w × h × d box with rounded edges, centred on its own origin
    const depth=Math.max(.0005,d-2*bev),g=new THREE.ExtrudeGeometry(rrShape(w-2*bev,h-2*bev,Math.max(.001,r-bev),Math.max(.001,rb-bev)),{depth,bevelEnabled:true,bevelThickness:bev,bevelSize:bev,bevelSegments:4,curveSegments:18});
    g.translate(0,0,-depth/2);return new THREE.Mesh(g,mat);}

  /* ---- little table + short carbon-fibre tripod (manual: 227 mm tall, 737 mm across at the widest leg angle) ---- */
  function woodTex(){                                                               // a procedural oak-like table top
    const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d'),r=mulberry32(7);
    g.fillStyle='#b68a5b';g.fillRect(0,0,512,512);
    for(let i=0;i<300;i++){const y=r()*512;g.strokeStyle=`rgba(${70+r()*55|0},${40+r()*30|0},${18+r()*10|0},${.05+r()*.13})`;g.lineWidth=.5+r()*2.4;g.beginPath();g.moveTo(0,y);for(let x=0;x<=512;x+=32)g.lineTo(x,y+Math.sin(x*.02+i)*5);g.stroke();}
    const t=tex(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;}
  const tmat=new THREE.MeshStandardMaterial({color:sRGB(0x2a2e35),roughness:.5,metalness:.7,envMapIntensity:.8});
  const woodMat=new THREE.MeshStandardMaterial({map:woodTex(),roughness:.5,metalness:0,envMapIntensity:.45});
  const tableG=new THREE.Group();scene.add(tableG);                                   // the little table (hidden when the telescope stands on the grass)
  const top=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,.03,64),[woodMat,woodMat,tmat]);top.position.y=TABLE_TOP-.015;tableG.add(top);
  const col=new THREE.Mesh(new THREE.CylinderGeometry(.04,.05,TABLE_TOP-.04,24),tmat);col.position.y=(TABLE_TOP-.04)/2;tableG.add(col);
  const tbase=new THREE.Mesh(new THREE.CylinderGeometry(.26,.28,.03,40),tmat);tbase.position.y=.015;tableG.add(tbase);
  function leg(a,b,r,mat){const d=new THREE.Vector3().subVectors(b,a),m=new THREE.Mesh(new THREE.CylinderGeometry(r*.9,r,d.length(),20),mat);
    m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;}
  // soft "contact shadow" blobs: a dark fuzzy dot under each foot, so it looks pressed onto the wood
  const blobTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(0,0,0,.65)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);})();
  function blob(x,z,r){const m=new THREE.Mesh(new THREE.PlaneGeometry(r*2,r*2),new THREE.MeshBasicMaterial({map:blobTex,transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(x,TABLE_TOP+.0015,z);m.userData.noShadow=true;rig.add(m);}
  const rig=new THREE.Group();scene.add(rig);                                          // rig = tripod + telescope: moved down onto the grass, or up onto the table
  const tripod=new THREE.Group();rig.add(tripod);
  for(let i=0;i<3;i++){
    const ang=i*2.0944+Math.PI/2,top3=new THREE.Vector3(0,SCOPE_H-.02,0),foot=new THREE.Vector3(Math.cos(ang)*.33,TABLE_TOP+.017,Math.sin(ang)*.33),mid=top3.clone().lerp(foot,.55);
    tripod.add(leg(top3,mid,.017,carbon));tripod.add(leg(mid,foot,.012,legMetal));         // upper (carbon) and lower (telescopic) leg sections
    {const dir=new THREE.Vector3().subVectors(foot,mid).normalize(),cap=new THREE.Mesh(new THREE.CylinderGeometry(.0145,.0165,.04,24),carbon),tip=new THREE.Mesh(new THREE.SphereGeometry(.0165,20,14),carbon);
     cap.position.copy(foot).addScaledVector(dir,-.016);cap.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir);tip.position.copy(foot).addScaledVector(dir,.004);tripod.add(cap,tip);}   // rounded black rubber foot cap
    const clamp1=new THREE.Mesh(new THREE.CylinderGeometry(.0145,.0145,.02,20),legMetal);clamp1.position.copy(mid);clamp1.quaternion.copy(leg(top3,mid,.017,carbon).quaternion);tripod.add(clamp1);   // leg-lock collar
    const hinge=new THREE.Mesh(new THREE.CylinderGeometry(.011,.011,.034,16).rotateZ(Math.PI/2),legMetal);hinge.position.set(Math.cos(ang)*.05,SCOPE_H-.02,Math.sin(ang)*.05);hinge.rotation.y=-ang+Math.PI/2;tripod.add(hinge);   // leg hinge
    blob(foot.x,foot.z,.07);
  }
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(.058,.068,.03,36),legMetal);hub.position.y=SCOPE_H-.021;tripod.add(hub);
  const plate=new THREE.Mesh(new THREE.CylinderGeometry(.052,.052,.012,36),carbon);plate.position.y=SCOPE_H-.006;tripod.add(plate);                  // the platform the S50 Pro screws onto
  for(let i=0;i<3;i++){const a2=i*2.0944+Math.PI/2+1.047,bolt=new THREE.Mesh(new THREE.CylinderGeometry(.0052,.0052,.006,6),legMetal);bolt.position.set(Math.cos(a2)*.047,SCOPE_H-.0225+.016,Math.sin(a2)*.047);tripod.add(bolt);}   // hex bolts
  blob(0,0,.2);

  /* ---- the telescope: 130 wide × 257 tall × 142.5 deep (mm), from the manufacturer's drawing and photos ----
     The whole L-shaped BODY (flat foot + thin battery column at the rear) turns on the tripod (azimuth). The big optical HEAD is a rounded
     slab that hangs in front of the column on a pivot at its top (altitude); its lens window is on the big flat front face.
     Zero position: the head hangs straight down in front of the column, lens facing forward. */
  const tiltG=new THREE.Group();tiltG.position.y=SCOPE_H;rig.add(tiltG);                  // tiltG: whole unit, wobbles until it has levelled itself
  const eqG=new THREE.Group();tiltG.add(eqG);                                               // eqG: tips the whole unit onto the EQ wedge's angle
  const wedge=new THREE.Group();eqG.add(wedge);wedge.visible=false;                         // the EQ wedge: a plate under the telescope on an adjustable strut
  {const plate=new THREE.Mesh(new THREE.BoxGeometry(.16,.012,.19),legMetal);plate.position.y=-.006;wedge.add(plate);
   const post=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.12,12),legMetal);post.position.set(0,-.06,.08);wedge.add(post);}
  const joint=new THREE.Mesh(new THREE.CylinderGeometry(.031,.031,.008,36),dark);joint.position.y=.001;eqG.add(joint);       // the turning joint at the tripod thread (Ø49 mm)
  const azG=new THREE.Group();eqG.add(azG);                                                 // azG: everything that turns left/right
  const foot=rrBox(.13,.068,.1425,.026,.012,white);foot.position.y=.034;azG.add(foot);       // the flat foot (its front step is ~68 mm tall)       // the flat foot
  // logos in soft grey: "☆ Seestar" on the RIGHT side of the foot (it reads correctly from the right, as in the product photos), "S50 Pro" (red S) on the FRONT of the foot's step (as on the real unit)
  function logo(draw,w,x,z,rotY){const c=document.createElement('canvas');c.width=512;c.height=128;const g=c.getContext('2d');g.textBaseline='middle';draw(g);
    const lg=new THREE.Mesh(new THREE.PlaneGeometry(w,w/4),new THREE.MeshBasicMaterial({map:tex(c),transparent:true,depthWrite:false,opacity:.9}));lg.rotation.y=rotY;lg.position.set(x,.035,z);lg.userData.noShadow=true;azG.add(lg);}
  logo(g=>{g.fillStyle='#7d838c';g.font='300 70px system-ui,sans-serif';g.fillText('☆',92,64);g.fillText('Seestar',150,66);},.075,.0656,-.005,Math.PI/2);
  logo(g=>{g.font='300 66px system-ui,sans-serif';g.fillStyle='#d23a3a';g.fillText('S',150,66);g.fillStyle='#7d838c';g.fillText('50 Pro',184,66);},.07,0,-.0717,Math.PI);
  // the battery column at the rear, 68 mm deep, with a big rounded top
  const column=rrBox(.1304,.253,.0692,.05,.011,white,.004);column.position.set(0,.1305,.03725);azG.add(column);      // runs from the base to the top, so column and foot form one smooth L
  const panel=rrBox(.108,.205,.004,.052,.001,blackGlass);panel.position.set(0,.1225,.0700);azG.add(panel);   // black glass face, set slightly into the white frame (looks backwards, +Z)
  for(const sx of[-1,1]){const seam=new THREE.Mesh(new THREE.BoxGeometry(.0009,.185,.0009),new THREE.MeshStandardMaterial({color:sRGB(0x6b7078),roughness:.8}));seam.position.set(sx*.0652,.1125,.04);azG.add(seam);}   // the thin vertical gap between the rear shell and the body
  const bezel=new THREE.Mesh(new THREE.TorusGeometry(.0138,.0022,10,40),new THREE.MeshStandardMaterial({color:0x4a4d55,roughness:.3,metalness:.8}));bezel.position.set(0,.061,.0745);azG.add(bezel);
  const btnMat=new THREE.MeshBasicMaterial({color:0xf2f2f2});                                               // the power button: a white disc…
  const btn=new THREE.Mesh(new THREE.CylinderGeometry(.0098,.0098,.004,28).rotateX(Math.PI/2),btnMat);btn.position.set(0,.061,.0745);azG.add(btn);
  const ringMat=new THREE.MeshBasicMaterial({color:0x000000});                                              // …inside a ring of light (the power indicator)
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.0122,.0017,8,40),ringMat);ring.position.set(0,.061,.0752);azG.add(ring);
  const ledGlow=glow('#ffffff',.034);ledGlow.material.blending=THREE.AdditiveBlending;ledGlow.material.opacity=0;ledGlow.position.set(0,.061,.0775);azG.add(ledGlow);   // soft halo round the ring
  const ledLight=new THREE.PointLight(0xffffff,0,.16);ledLight.position.set(0,.061,.1);azG.add(ledLight);                                                         // the ring lights the glass a little
  const dots=[0,1,2,3].map(i=>{const m=new THREE.MeshBasicMaterial({color:0x300000}),d=new THREE.Mesh(new THREE.SphereGeometry(.0018,8,8),m);d.position.set(0,.085+i*.0077,.0745);azG.add(d);return m;});   // 4 battery lights, in a column above the button
  const port=new THREE.Mesh(new THREE.BoxGeometry(.002,.011,.0046),new THREE.MeshStandardMaterial({color:0x08090b,roughness:.4}));port.position.set(-.0655,.064,.0525);azG.add(port);   // USB-C port on the left side
  // USB-C charging cable (visible while a charger is plugged in)
  const cable=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-.066,.064,.0525),new THREE.Vector3(-.1,.07,.06),new THREE.Vector3(-.15,-.05,.1),new THREE.Vector3(-.2,-.2,.16),new THREE.Vector3(-.3,-.226,.2)]),24,.0032,8),new THREE.MeshStandardMaterial({color:0xf2f2f2,roughness:.6}));
  azG.add(cable);cable.visible=false;
  // THE HEAD: a slab 128 wide × 167 tall × 78 thick, hanging vertically in FRONT of the column and hinged at its TOP end (the pivot is the centre of
  // the rounded top). Its big flat front face (−Z) carries the lens window near the top; its rounded bottom end hovers ~22 mm above the foot's step
  // (an open pocket you can see through). alt 0° = hanging straight down, lens facing forward (the "zero position"); raising alt swings the bottom
  // end forward, so the window faces higher and higher; at 90° the slab points forward and the lens looks straight up. It never touches the column.
  const altG=new THREE.Group();altG.position.set(0,.218,-.0353);azG.add(altG);
  const HT=.072,HW=.12,HB=-.128;                                     // thickness, width, y of the bottom (relative to the pivot)
  {/* The head is a densely subdivided ROUNDED BOX, then shaped with a little maths: (1) its rear-top is an arc about the pivot (so it never
       touches the column when it tilts), (2) its bottom is half-round when seen from the front – a tall pill. Dense = smooth shading. */
    const rad=.022,top=HT/2,H=top-HB,g=new THREE.BoxGeometry(HW,H,HT,30,60,24),p=g.attributes.position,v=new THREE.Vector3(),c=new THREE.Vector3(),d=new THREE.Vector3();
    const inner=new THREE.Vector3(HW/2-rad,H/2-rad,HT/2-rad),ninner=inner.clone().negate(),R=HW/2-.004,y0=HB+R;
    for(let i=0;i<p.count;i++){
      v.fromBufferAttribute(p,i);c.copy(v).clamp(ninner,inner);d.copy(v).sub(c);if(d.lengthSq()>1e-12){d.normalize().multiplyScalar(rad);v.copy(c).add(d);}   // round every edge
      v.y+=(top+HB)/2;                                                                      // put the pivot at the origin (the top is at +HT/2)
      if(v.y>0&&v.z>0){const l=Math.hypot(v.z,v.y);if(l>top){v.z*=top/l;v.y*=top/l;}}      // rear-top: a circular arc about the pivot
      if(v.y<y0){const k=Math.sqrt(Math.max(0,1-Math.pow((y0-v.y)/R,2)));v.x*=Math.max(k,.1);}   // bottom: half-round seen from the front
      p.setXYZ(i,v.x,v.y,v.z);}
    g.computeVertexNormals();creaseNormals(g,60);altG.add(new THREE.Mesh(g,white));}
  // a hair-line groove round the head near its bottom, like the rim of a separate base ring (seen in the side-view video)
  {const ring=rrBox(.099,HT+.0008,.0012,.032,.0004,new THREE.MeshStandardMaterial({color:sRGB(0x6a6e76),roughness:.7}));ring.rotation.x=Math.PI/2;ring.position.y=HB+.026;altG.add(ring);}
  const nose=rrBox(.09,.112,.006,.045,.0025,white);nose.position.set(0,-.027,-HT/2-.0015);altG.add(nose);          // a raised boss round the window
  const zF=-HT/2-.0045;                                              // z of the boss's front face
  const frame=rrBox(.072,.1,.002,.036,.0008,silver);frame.position.set(0,-.027,zF-.0028);altG.add(frame);         // silver ring
  const win=rrBox(.066,.094,.002,.033,.0008,blackGlass);win.position.set(0,-.027,zF-.0036);altG.add(win);          // dark window (almost flush, as on the real unit)
  const collar=new THREE.Mesh(new THREE.CylinderGeometry(.0245,.0265,.004,48).rotateX(Math.PI/2),dark);collar.position.set(0,-.003,zF-.004);altG.add(collar);
  const bezelL=new THREE.Mesh(new THREE.TorusGeometry(.0245,.0018,14,56),silver);bezelL.position.set(0,-.003,zF-.0046);altG.add(bezelL);
  const lens=new THREE.Mesh(new THREE.SphereGeometry(.0235,48,20,0,Math.PI*2,0,Math.PI/2).rotateX(-Math.PI/2).scale(1,1,.13),lensGlass);lens.position.set(0,-.003,zF-.0042);altG.add(lens);        // a gently domed coated glass (green…)
  const lens2=new THREE.Mesh(new THREE.SphereGeometry(.0145,40,16,0,Math.PI*2,0,Math.PI/2).rotateX(-Math.PI/2).scale(1,1,.1),lensGlass2);lens2.position.set(0,-.003,zF-.0049);altG.add(lens2);        // …and purple
  const bezel2=new THREE.Mesh(new THREE.TorusGeometry(.0105,.0015,10,32),silver);bezel2.position.set(0,-.056,zF-.0042);altG.add(bezel2);                                                    // the small wide-angle camera, below the big lens
  const cam2=new THREE.Mesh(new THREE.SphereGeometry(.0095,28,12,0,Math.PI*2,0,Math.PI/2).rotateX(-Math.PI/2).scale(1,1,.2),lensGlass);cam2.position.set(0,-.056,zF-.004);altG.add(cam2);
  const dewMat=new THREE.MeshBasicMaterial({color:0xdde8f0,transparent:true,opacity:0,depthWrite:false});     // fog on the lens (dew)
  const dewDisc=new THREE.Mesh(new THREE.CircleGeometry(.04,48).rotateY(Math.PI),dewMat);dewDisc.position.set(0,-.027,zF-.0085);altG.add(dewDisc);
  const solar=new THREE.Group();altG.add(solar);solar.visible=false;                                          // magnetic solar filter, stuck on the front of the head
  {const cap=new THREE.Mesh(new THREE.CylinderGeometry(.052,.052,.006,40).rotateX(Math.PI/2),new THREE.MeshStandardMaterial({color:0x2a2218,roughness:.3,metalness:.6}));cap.position.set(0,-.027,zF-.0085);solar.add(cap);
   const rimR=new THREE.Mesh(new THREE.TorusGeometry(.052,.002,8,40),legMetal);rimR.position.set(0,-.027,zF-.0115);solar.add(rimR);}

  function shadowify(root){root.traverse(m=>{if(m.isMesh&&!m.material.isMeshBasicMaterial&&!m.userData.noShadow){m.castShadow=true;m.receiveShadow=true;}});}
  shadowify(tiltG);shadowify(tripod);top.castShadow=true;top.receiveShadow=true;col.castShadow=true;

  /* ---- aim line: shows where the telescope points ---- */
  const beam=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,-.05),new THREE.Vector3(0,0,-30)]),new THREE.LineBasicMaterial({color:0x4da3ff,transparent:true,opacity:.7}));
  beam.visible=false;altG.add(beam);

  /* ---- orbit camera (drag to rotate, wheel / pinch to zoom) ---- */
  const orbit={yaw:0.75,pitch:.2,dist:1.25,ty:SCOPE_H+.12};
  const views={orbit:null,back:{yaw:0,pitch:.1,dist:1.1},front:{yaw:Math.PI,pitch:.1,dist:1.1},side:{yaw:-Math.PI/2,pitch:.06,dist:1.1},top:{yaw:Math.PI,pitch:1.45,dist:1.2}};
  let viewMode='orbit';
  function setView(v){viewMode=v;SC.follow=null;if(views[v]&&v!=='orbit'){Object.assign(orbit,views[v]);SC.follow=v;SC.followBase=views[v].yaw;}}   // Front / Back / Side / Top follow the telescope as it turns
  const ptrs=new Map();let pinch=0;
  canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});pinch=0;markCustom();});
  canvas.addEventListener('pointerup',e=>ptrs.delete(e.pointerId));canvas.addEventListener('pointercancel',e=>ptrs.delete(e.pointerId));
  canvas.addEventListener('pointermove',e=>{
    const p=ptrs.get(e.pointerId);if(!p)return;
    if(ptrs.size===1&&viewMode!=='eye'){orbit.yaw-=(e.clientX-p.x)*.006;orbit.pitch=clamp(orbit.pitch+(e.clientY-p.y)*.006,-.2,1.5);}
    if(ptrs.size===1&&viewMode==='eye'){SC.eye.yaw-=(e.clientX-p.x)*.003;SC.eye.pitch=clamp(SC.eye.pitch+(e.clientY-p.y)*.003,-.5,.5);}
    p.x=e.clientX;p.y=e.clientY;
    if(ptrs.size===2){const [a,b]=[...ptrs.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch)orbit.dist=clamp(orbit.dist*pinch/d,.35,6);pinch=d;}
  });
  canvas.addEventListener('wheel',e=>{e.preventDefault();orbit.dist=clamp(orbit.dist*Math.exp(e.deltaY*.0012),.35,6);},{passive:false});
  function markCustom(){if(viewMode!=='orbit'&&viewMode!=='eye'){SC.follow=null;viewMode='orbit';SC.onViewChange&&SC.onViewChange('orbit');}}   // dragging on a preset view hands control back to free orbit

  /* ---- per-frame update: pose the telescope from the mount's numbers, then draw ---- */
  const tmp=new THREE.Vector3(),q=new THREE.Quaternion();
  SC.eye={yaw:0,pitch:0};
  SC.update=function(m,t,led){
    if(m.mountMode==='eq'&&!m.parked){
      // On the EQ wedge the turret turns about the POLAR axis: its angle is the hour angle, the head tilt is the declination.
      const e=horToEq(m.alt,m.az,jdNow()),H=(lstDeg(jdNow())-e.ra)*D2R;
      eqG.rotation.x=-(90-m.eq.wedgeAlt)*D2R;eqG.position.y=.03;wedge.visible=true;
      azG.rotation.y=Math.PI-H;altG.rotation.x=e.dec*D2R;
    }else{
      eqG.rotation.x=m.mountMode==='eq'?-(90-m.eq.wedgeAlt)*D2R:0;eqG.position.y=m.mountMode==='eq'?.03:0;wedge.visible=m.mountMode==='eq';
      azG.rotation.y=-m.az*D2R;altG.rotation.x=m.alt*D2R;
    }
    tiltG.rotation.x=m.tilt.x*D2R*(1+.03*Math.sin(t*5));tiltG.rotation.z=m.tilt.z*D2R;
    dewMat.opacity=m.dew*.85;solar.visible=m.solarFilter;cable.visible=m.charger!=='none';
    // indicator ring + button + battery lights, following the pattern table in the manual
    if(led){
      const k=(a=>{switch(a){case'solid':return 1;case'breath':return .15+.85*(.5+.5*Math.sin(t*6.283/5));case'breathFast':return .15+.85*(.5+.5*Math.sin(t*6.283/1.6));
        case'blink':return Math.floor(t*1.2)%2;case'blinkFast':return Math.floor(t*5)%2;case'run':return (Math.floor(t*10)%3)===0?1:.25;default:return 0;}})(led.anim);
      ringMat.color.setRGB(led.col[0]*k,led.col[1]*k,led.col[2]*k);
      ledGlow.material.color.setRGB(led.col[0],led.col[1],led.col[2]);ledGlow.material.opacity=.4*k;ledLight.color.setRGB(led.col[0],led.col[1],led.col[2]);ledLight.intensity=.05*k;
      led.batt.forEach((s,i)=>{const on=s==='on'||(s==='blink'&&Math.floor(t*1.2)%2)||(s==='blinkFast'&&Math.floor(t*5)%2);dots[i].color.setHex(on?0xff2a1a:0x300000);});
    }
    const sig=m.az*1.3+m.alt*2.1+m.tilt.x*3+m.tilt.z*5+(m.mountMode==='eq'?7:0)+(m.solarFilter?11:0)+m.eq.wedgeAlt*.1+(m.charger!=='none'?13:0);   // did the telescope move? then the shadows need redrawing
    if(Math.abs(sig-SC._sig)>1e-4){SC._sig=sig;renderer.shadowMap.needsUpdate=true;}
    beam.visible=SC.showBeam;
    if(SC.follow&&viewMode!=='eye')orbit.yaw=SC.followBase+azG.rotation.y;                                   // keep looking at the same side of the body
    updateEye();
    renderer.render(scene,camera);
  };
  function updateEye(){
    if(viewMode==='eye'){
      altG.updateWorldMatrix(true,false);                                                   // camera sits at the lens, looking where the lens looks
      altG.getWorldQuaternion(q);tmp.set(0,0,-.055).applyMatrix4(altG.matrixWorld);
      camera.position.copy(tmp);camera.quaternion.copy(q);
      camera.rotateY(SC.eye.yaw);camera.rotateX(SC.eye.pitch);
      camera.fov=34;
    }else{
      camera.fov=40;
      const c=Math.cos(orbit.pitch);
      camera.position.set(Math.sin(orbit.yaw)*c*orbit.dist,orbit.ty+Math.sin(orbit.pitch)*orbit.dist,Math.cos(orbit.yaw)*c*orbit.dist);
      camera.lookAt(0,orbit.ty,0);
    }
    camera.updateProjectionMatrix();
  }
  SC.resize=function(){const w=canvas.clientWidth,h=canvas.clientHeight;if(w&&h){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}};
  SC.setView=v=>{if(v==='eye'){viewMode='eye';SC.eye.yaw=SC.eye.pitch=0;}else setView(v);};
  SC._sig=0;
  SC.vertexCount=()=>{let n=0;scene.traverse(o=>{if(o.geometry&&o.geometry.attributes.position)n+=o.geometry.attributes.position.count;});return n;};   // how heavy is the scene? (for tuning)
  /* Graphics quality: 'high' = shadows + sharp pixels, 'fast' = no shadows, normal pixels (for slower phones and laptops) */
  SC.setQuality=function(q){
    SC.quality=q;renderer.setPixelRatio(q==='fast'?1:Math.min(devicePixelRatio||1,2));renderer.shadowMap.enabled=q!=='fast';
    scene.environment=q==='fast'?null:(SC.envTex||null);                                           // no mirror-reflections in Fast mode
    scene.traverse(o=>{if(o.material)[].concat(o.material).forEach(m=>{
      if(m.isMeshPhysicalMaterial){if(m.userData.cc===undefined)m.userData.cc=m.clearcoat;m.clearcoat=q==='fast'?0:m.userData.cc;}   // and no clear-coat layer
      m.needsUpdate=true;});});
    renderer.shadowMap.needsUpdate=true;SC.resize();
  };
  /* Where does the telescope stand? On the grass (like the product photos) or on a little table. */
  SC.setSurface=function(k){
    SC.surface=k;const dy=k==='table'?0:-TABLE_TOP;rig.position.y=dy;tableG.visible=k==='table';          // grass / patio: on the ground; table: up on the table
    ground.material.map=k==='grass'?grassTex:k==='patio'?patioTex:null;ground.material.color.copy(k==='grass'?new THREE.Color(.55,.6,.55):k==='patio'?new THREE.Color(.5,.5,.5):sRGB(0x1b211d));ground.material.needsUpdate=true;
    orbit.ty=SCOPE_H+.12+dy;key.target.position.y=SCOPE_H+.1+dy;key.position.y=SCOPE_H+1.6+dy;rim.position.y=SCOPE_H+1+dy;renderer.shadowMap.needsUpdate=true;
  };
  SC.updateSky=updateSky;SC.showBeam=false;
  addEventListener('resize',SC.resize);SC.resize();updateSky();
}
