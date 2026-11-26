/* Seestar S50 Simulator – s50-scene.js
   The 3D world, built with Three.js:  ground, tripod, the telescope itself (base → turning column → tilting optical head, plus the swing-open front cover),
   a sky dome with the real bright stars, and a simple orbit camera.
   World axes: +Y is up, +X is east, -Z is north.  The telescope's "front" is its local -Z direction,
   so an azimuth of 0° (north) means "front faces -Z".  Needs Three.js and s50-model.js. */
'use strict';

const SC={};                         // everything the scene exposes to the rest of the app
const SKY_R=40;                      // radius of the sky dome (metres)
const TABLE_TOP=0.76;                // height of the little table the tripod stands on (metres)
const SCOPE_H=TABLE_TOP+0.27;        // height of the tripod head above the ground
const dirFromAltAz=(alt,az,r=1)=>new THREE.Vector3(Math.cos(alt*D2R)*Math.sin(az*D2R),Math.sin(alt*D2R),-Math.cos(alt*D2R)*Math.cos(az*D2R)).multiplyScalar(r);   // alt/az → 3D direction

function initScene(canvas){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x04060c);
  const camera=new THREE.PerspectiveCamera(40,1,0.02,200);

  /* ---- lights: a soft "night helper" light so the white telescope stays visible (real nights are darker!) ---- */
  scene.add(new THREE.HemisphereLight(0xdde3ff,0x1a1d26,0.8));
  const key=new THREE.DirectionalLight(0xdfe8ff,0.9);key.position.set(2,4,3);scene.add(key);
  const rim=new THREE.DirectionalLight(0x5575c0,0.5);rim.position.set(-3,2,-2);scene.add(rim);

  /* ---- ground + compass letters ---- */
  const ground=new THREE.Mesh(new THREE.CircleGeometry(9,64),new THREE.MeshStandardMaterial({color:0x151a17,roughness:1}));
  ground.rotation.x=-Math.PI/2;scene.add(ground);
  const patio=new THREE.Mesh(new THREE.CircleGeometry(1.1,48),new THREE.MeshStandardMaterial({color:0x2a2e33,roughness:.95}));
  patio.rotation.x=-Math.PI/2;patio.position.y=.002;scene.add(patio);
  function label(txt,col){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');g.fillStyle=col;g.font='bold 96px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillText(txt,64,70);
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));s.scale.set(.7,.7,1);return s;}
  [['N',0,'#ff7a6b'],['E',90,'#c9d4f0'],['S',180,'#c9d4f0'],['W',270,'#c9d4f0']].forEach(([t,az,col])=>{const s=label(t,col);s.position.copy(dirFromAltAz(0,az,6.5));s.position.y=.35;scene.add(s);});

  /* ---- the sky dome: real bright stars, the Moon and planets (positions refreshed twice a second) ---- */
  const starObjs=OBJ.filter(o=>o.type==='star'),starPos=new Float32Array(starObjs.length*3),starCol=new Float32Array(starObjs.length*3);
  const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.BufferAttribute(starPos,3));starGeo.setAttribute('color',new THREE.BufferAttribute(starCol,3));
  const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({size:2.4,sizeAttenuation:false,vertexColors:true,depthWrite:false}));stars.frustumCulled=false;scene.add(stars);
  function glow(col,size){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,col);gr.addColorStop(.35,col);gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));s.scale.set(size,size,1);return s;}
  const moon=glow('#f4f1e4',3.2),bodies={moon};scene.add(moon);
  ['mercury','venus','mars','jupiter','saturn'].forEach(n=>{const s=glow({mercury:'#d8d0c8',venus:'#fff6d8',mars:'#ff9a70',jupiter:'#ffe6c0',saturn:'#f0dca0'}[n],1.1);bodies[n]=s;scene.add(s);});
  function updateSky(){
    starObjs.forEach((o,i)=>{
      const v=dirFromAltAz(o.alt,o.az,SKY_R),b=o.alt<-1?0:clamp(1.15-o.mag*.2,.28,1);
      starPos.set([v.x,v.y,v.z],i*3);starCol.set([b,b,b*1.05],i*3);
    });
    starGeo.attributes.position.needsUpdate=true;starGeo.attributes.color.needsUpdate=true;
    for(const id in bodies){const o=OBJ.find(x=>x.id===id);if(!o)continue;bodies[id].visible=o.alt>-1;bodies[id].position.copy(dirFromAltAz(o.alt,o.az,SKY_R-1));}
    moon.material.opacity=.35+.65*(MOON.illum||0);
  }

  /* ---- materials ---- */
  const white=new THREE.MeshStandardMaterial({color:0xf4f5f7,roughness:.32,metalness:.02});
  const blackGlass=new THREE.MeshStandardMaterial({color:0x040405,roughness:.04,metalness:.7});
  const dark=new THREE.MeshStandardMaterial({color:0x1b1d22,roughness:.55,metalness:.25});
  const lensGlass=new THREE.MeshStandardMaterial({color:0x1d4a26,roughness:.06,metalness:.9,emissive:0x07140a});   // the coated front lens looks green
  const foam=new THREE.MeshStandardMaterial({color:0x111214,roughness:.95});
  const legMetal=new THREE.MeshStandardMaterial({color:0x26292e,roughness:.4,metalness:.7});

  /* ---- helpers: rounded boxes (the real body has no sharp corners) ---- */
  function rrShape(w,h,r){const x=-w/2,y=-h/2,sh=new THREE.Shape();
    sh.moveTo(x+r,y);sh.lineTo(x+w-r,y);sh.absarc(x+w-r,y+r,r,-Math.PI/2,0);sh.lineTo(x+w,y+h-r);sh.absarc(x+w-r,y+h-r,r,0,Math.PI/2);
    sh.lineTo(x+r,y+h);sh.absarc(x+r,y+h-r,r,Math.PI/2,Math.PI);sh.lineTo(x,y+r);sh.absarc(x+r,y+r,r,Math.PI,1.5*Math.PI);return sh;}
  function rrBox(w,h,d,r,bev,mat){                          // w × h × d box with rounded edges, centred on its own origin
    const depth=Math.max(.0005,d-2*bev),g=new THREE.ExtrudeGeometry(rrShape(w-2*bev,h-2*bev,Math.max(.001,r-bev)),{depth,bevelEnabled:true,bevelThickness:bev,bevelSize:bev,bevelSegments:3,curveSegments:14});
    g.translate(0,0,-depth/2);return new THREE.Mesh(g,mat);}

  /* ---- short tabletop tripod (black foam-grip legs) on a small table ---- */
  const table=new THREE.Group();scene.add(table);
  const tmat=new THREE.MeshStandardMaterial({color:0x1c2026,roughness:.8});
  const top=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,.03,48),tmat);top.position.y=TABLE_TOP-.015;table.add(top);
  const col=new THREE.Mesh(new THREE.CylinderGeometry(.04,.05,TABLE_TOP-.04,16),tmat);col.position.y=(TABLE_TOP-.04)/2;table.add(col);
  const tbase=new THREE.Mesh(new THREE.CylinderGeometry(.26,.28,.03,32),tmat);tbase.position.y=.015;table.add(tbase);
  function leg(a,b,r,mat){const d=new THREE.Vector3().subVectors(b,a),m=new THREE.Mesh(new THREE.CylinderGeometry(r*.9,r,d.length(),14),mat);
    m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;}
  const tripod=new THREE.Group();scene.add(tripod);
  for(let i=0;i<3;i++){
    const ang=i*2.0944+Math.PI/2,top3=new THREE.Vector3(0,SCOPE_H-.02,0),foot=new THREE.Vector3(Math.cos(ang)*.21,TABLE_TOP+.012,Math.sin(ang)*.21),mid=top3.clone().lerp(foot,.62);
    tripod.add(leg(top3,mid,.017,foam));tripod.add(leg(mid,foot,.011,legMetal));          // foam-wrapped upper leg, metal lower leg
    const f=new THREE.Mesh(new THREE.SphereGeometry(.016,12,10),foam);f.position.copy(foot);f.scale.y=.8;tripod.add(f);
  }
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(.06,.07,.035,28),legMetal);hub.position.y=SCOPE_H-.0175;tripod.add(hub);

  /* ---- the telescope ---- */
  // tiltG = the whole thing, so we can show it un-level until it levels itself
  const tiltG=new THREE.Group();tiltG.position.y=SCOPE_H;scene.add(tiltG);
  const base=rrBox(.17,.075,.15,.028,.008,white);base.position.y=.0375;tiltG.add(base);
  // "S50 Pro" logo on the front of the base (a red S, like the real one)
  {const c=document.createElement('canvas');c.width=512;c.height=128;const g=c.getContext('2d');g.font='300 62px system-ui,sans-serif';g.textBaseline='middle';
    g.fillStyle='#d23a3a';g.fillText('S',150,66);g.fillStyle='#7d838c';g.fillText('50 Pro',184,66);
    const lg=new THREE.Mesh(new THREE.PlaneGeometry(.1,.025),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));lg.rotation.y=Math.PI;lg.position.set(0,.036,-.0765);lg.userData.logo=1;tiltG.add(lg);}
  // azG = the part that turns left/right (azimuth)
  const azG=new THREE.Group();azG.position.y=.075;tiltG.add(azG);
  const column=rrBox(.075,.2,.13,.03,.006,white);column.position.set(-.0475,.1,0);azG.add(column);
  // altG = the optical head, which tips up and down (altitude) about a horizontal axle
  const altG=new THREE.Group();altG.position.set(.035,.155,0);azG.add(altG);
  const axle=new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,.05,20).rotateZ(Math.PI/2),dark);axle.position.x=-.025;altG.add(axle);
  const headBody=new THREE.Mesh(new THREE.CylinderGeometry(.052,.052,.11,40).rotateX(Math.PI/2),white);headBody.position.z=-.015;altG.add(headBody);
  const headRear=new THREE.Mesh(new THREE.SphereGeometry(.052,32,20),white);headRear.position.z=.04;altG.add(headRear);
  const win=new THREE.Mesh(new THREE.CircleGeometry(.0455,40).rotateY(Math.PI),blackGlass);win.position.z=-.0705;altG.add(win);        // dark front window
  const lens=new THREE.Mesh(new THREE.CircleGeometry(.032,40).rotateY(Math.PI),lensGlass);lens.position.set(-.004,.006,-.0712);altG.add(lens);   // main (green-coated) lens
  const cam2=new THREE.Mesh(new THREE.CircleGeometry(.0105,24).rotateY(Math.PI),new THREE.MeshStandardMaterial({color:0x10131a,roughness:.1,metalness:.9}));cam2.position.set(.022,-.026,-.0714);altG.add(cam2);   // small wide camera
  const dewMat=new THREE.MeshBasicMaterial({color:0xdde8f0,transparent:true,opacity:0,depthWrite:false});    // fog on the lens (dew)
  const dewDisc=new THREE.Mesh(new THREE.CircleGeometry(.0455,40).rotateY(Math.PI),dewMat);dewDisc.position.z=-.0722;altG.add(dewDisc);
  // the cover: a tall white shell with a black glass front, hinged on its left edge. Closed = in front of everything; open = swung out to the side.
  const coverG=new THREE.Group();coverG.position.set(-.075,.15,-.1);azG.add(coverG);
  const shell=rrBox(.15,.27,.045,.06,.01,white);shell.position.x=.075;coverG.add(shell);
  const panel=rrBox(.098,.215,.006,.045,.002,blackGlass);panel.position.set(.075,0,-.0235);coverG.add(panel);
  const ledMat=new THREE.MeshBasicMaterial({color:0xe8e8e8});                                             // the round status button
  const led=new THREE.Mesh(new THREE.CylinderGeometry(.0085,.0085,.004,24).rotateX(Math.PI/2),ledMat);led.position.set(.075,-.075,-.0275);coverG.add(led);
  const dots=[0,1,2,3].map(i=>{const m=new THREE.MeshBasicMaterial({color:0x300000}),d=new THREE.Mesh(new THREE.SphereGeometry(.0017,8,8),m);d.position.set(.075,-.04+i*.0125*-1+.04,-.0275);coverG.add(d);return m;});   // 4 tiny battery lights

  /* ---- aim line: shows where the telescope points ---- */
  const beam=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,-.08),new THREE.Vector3(0,0,-30)]),new THREE.LineBasicMaterial({color:0x4da3ff,transparent:true,opacity:.7}));
  beam.visible=false;altG.add(beam);

  /* ---- orbit camera (drag to rotate, wheel / pinch to zoom) ---- */
  const orbit={yaw:2.7,pitch:.2,dist:1.25,ty:SCOPE_H+.12};
  const views={orbit:null,front:{yaw:Math.PI,pitch:.1,dist:1.1},side:{yaw:Math.PI/2,pitch:.08,dist:1.1},top:{yaw:Math.PI,pitch:1.45,dist:1.2}};
  let viewMode='orbit';
  function setView(v){viewMode=v;if(views[v]&&v!=='orbit')Object.assign(orbit,views[v]);}
  const ptrs=new Map();let pinch=0;
  canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});pinch=0;markCustom();});
  canvas.addEventListener('pointerup',e=>ptrs.delete(e.pointerId));canvas.addEventListener('pointercancel',e=>ptrs.delete(e.pointerId));
  canvas.addEventListener('pointermove',e=>{
    const p=ptrs.get(e.pointerId);if(!p)return;
    if(ptrs.size===1&&viewMode!=='eye'){orbit.yaw-=(e.clientX-p.x)*.006;orbit.pitch=clamp(orbit.pitch+(e.clientY-p.y)*.006,-.2,1.5);}
    if(ptrs.size===1&&viewMode==='eye'){SC.eye.yaw-=(e.clientX-p.x)*.003;SC.eye.pitch=clamp(SC.eye.pitch+(e.clientY-p.y)*.003,-.5,.5);}   // look around a little from the scope's eye
    p.x=e.clientX;p.y=e.clientY;
    if(ptrs.size===2){const [a,b]=[...ptrs.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch)orbit.dist=clamp(orbit.dist*pinch/d,.35,6);pinch=d;}
  });
  canvas.addEventListener('wheel',e=>{e.preventDefault();orbit.dist=clamp(orbit.dist*Math.exp(e.deltaY*.0012),.35,6);},{passive:false});
  // dragging while on a preset view (Front/Side/Top) hands control back to free orbit
  function markCustom(){if(viewMode!=='orbit'&&viewMode!=='eye'){viewMode='orbit';SC.onViewChange&&SC.onViewChange('orbit');}}

  /* ---- per-frame update: pose the telescope from the mount's numbers, then draw ---- */
  const tmp=new THREE.Vector3(),q=new THREE.Quaternion();
  SC.eye={yaw:0,pitch:0};
  SC.update=function(m,t){
    azG.rotation.y=-m.az*D2R;altG.rotation.x=m.alt*D2R;
    tiltG.rotation.x=m.tilt.x*D2R*(1+.03*Math.sin(t*5));tiltG.rotation.z=m.tilt.z*D2R;
    coverG.rotation.y=100*D2R*m.cover;
    dewMat.opacity=m.dew*.85;
    // the round button tells the story: white = off, flashing amber = starting, amber = ready, blue = moving, cyan = tracking, red = problem
    let c=0xe8e8e8;
    if(m.power==='booting')c=(Math.floor(t*3)%2)?0xffa83a:0x5a3a10;
    else if(m.power==='ready'){c=({idle:0xffb347,slew:0x4da3ff,center:0x4da3ff,manual:0x4da3ff,track:0x35d8ff,lost:0xff4b3a})[m.mode]||0xffb347;}
    ledMat.color.setHex(c);
    const lit=m.power==='off'?0:Math.ceil(m.battery/25);dots.forEach((d,i)=>d.color.setHex(i<lit?0xff2a1a:0x300000));
    beam.visible=SC.showBeam;
    updateEye();
    renderer.render(scene,camera);
  };
  function updateEye(){
    if(viewMode==='eye'){
      // put the camera at the front of the tube, looking where the tube looks
      altG.updateWorldMatrix(true,false);
      altG.getWorldQuaternion(q);tmp.set(0,0,-.085).applyMatrix4(altG.matrixWorld);
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
  SC.updateSky=updateSky;SC.showBeam=false;
  addEventListener('resize',SC.resize);SC.resize();updateSky();
}
