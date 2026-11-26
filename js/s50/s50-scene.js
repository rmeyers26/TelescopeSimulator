/* Seestar S50 Simulator – s50-scene.js
   The 3D world, built with Three.js:  ground, tripod, the telescope itself (base → turning body → tilting tube → arm cover),
   a sky dome with the real bright stars, and a simple orbit camera.
   World axes: +Y is up, +X is east, -Z is north.  The telescope's "front" is its local -Z direction,
   so an azimuth of 0° (north) means "front faces -Z".  Needs Three.js and s50-model.js. */
'use strict';

const SC={};                         // everything the scene exposes to the rest of the app
const SKY_R=40;                      // radius of the sky dome (metres)
const SCOPE_H=1.22;                  // height of the tripod head above the ground
const dirFromAltAz=(alt,az,r=1)=>new THREE.Vector3(Math.cos(alt*D2R)*Math.sin(az*D2R),Math.sin(alt*D2R),-Math.cos(alt*D2R)*Math.cos(az*D2R)).multiplyScalar(r);   // alt/az → 3D direction

function initScene(canvas){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x04060c);
  const camera=new THREE.PerspectiveCamera(40,1,0.02,200);

  /* ---- lights: a soft "night helper" light so the white telescope stays visible (real nights are darker!) ---- */
  scene.add(new THREE.HemisphereLight(0x9fb4ff,0x1a1d26,0.9));
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
  const white=new THREE.MeshStandardMaterial({color:0xeef0f3,roughness:.4,metalness:.05});
  const dark=new THREE.MeshStandardMaterial({color:0x22262d,roughness:.55,metalness:.2});
  const metal=new THREE.MeshStandardMaterial({color:0xb9c0ca,roughness:.3,metalness:.85});
  const glass=new THREE.MeshStandardMaterial({color:0x163247,roughness:.08,metalness:.9,emissive:0x04080e});
  const legMat=new THREE.MeshStandardMaterial({color:0x2c3138,roughness:.6,metalness:.4});

  /* ---- tripod ---- */
  function leg(a,b,r){const d=new THREE.Vector3().subVectors(b,a),m=new THREE.Mesh(new THREE.CylinderGeometry(r*.8,r,d.length(),12),legMat);
    m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;}
  const tripod=new THREE.Group();scene.add(tripod);
  for(let i=0;i<3;i++){const a=i*2.0944+.5;tripod.add(leg(new THREE.Vector3(0,SCOPE_H-.02,0),new THREE.Vector3(Math.cos(a)*.62,0,Math.sin(a)*.62),.014));}
  const head=new THREE.Mesh(new THREE.CylinderGeometry(.075,.085,.04,24),dark);head.position.y=SCOPE_H-.02;tripod.add(head);

  /* ---- the telescope ---- */
  // tiltG = the whole thing, so we can show it un-level until it levels itself
  const tiltG=new THREE.Group();tiltG.position.y=SCOPE_H;scene.add(tiltG);
  const base=new THREE.Mesh(new THREE.CylinderGeometry(.062,.068,.05,32),dark);base.position.y=.025;tiltG.add(base);
  const ring=new THREE.Mesh(new THREE.CylinderGeometry(.066,.066,.006,32),metal);ring.position.y=.052;tiltG.add(ring);
  // azG = the part that turns left/right (azimuth)
  const azG=new THREE.Group();azG.position.y=.055;tiltG.add(azG);
  const ped=new THREE.Mesh(new THREE.CylinderGeometry(.058,.06,.08,32),white);ped.position.y=.04;azG.add(ped);
  for(const sx of[-1,1]){const arm=new THREE.Mesh(new THREE.BoxGeometry(.016,.17,.12),white);arm.position.set(sx*.06,.125,0);azG.add(arm);}
  // altG = the tube, which tips up and down (altitude) about a horizontal axle
  const altG=new THREE.Group();altG.position.y=.155;azG.add(altG);
  const tube=new THREE.Mesh(new THREE.CylinderGeometry(.036,.036,.19,40).rotateX(Math.PI/2),white);tube.position.z=-.01;altG.add(tube);
  const cell=new THREE.Mesh(new THREE.CylinderGeometry(.0405,.0405,.013,40).rotateX(Math.PI/2),dark);cell.position.z=-.1075;altG.add(cell);
  const lens=new THREE.Mesh(new THREE.CircleGeometry(.0335,40).rotateY(Math.PI),glass);lens.position.z=-.1145;altG.add(lens);
  const dewMat=new THREE.MeshBasicMaterial({color:0xdde8f0,transparent:true,opacity:0,depthWrite:false});    // fog on the lens (dew)
  const dewDisc=new THREE.Mesh(new THREE.CircleGeometry(.0335,40).rotateY(Math.PI),dewMat);dewDisc.position.z=-.1152;altG.add(dewDisc);
  const rear=new THREE.Mesh(new THREE.CylinderGeometry(.031,.031,.055,32).rotateX(Math.PI/2),dark);rear.position.z=.105;altG.add(rear);
  for(const sx of[-1,1]){const hub=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.012,24).rotateZ(Math.PI/2),metal);hub.position.set(sx*.0605,0,0);altG.add(hub);}
  // the arm cover: a disc on a hinge above the lens. Closed = covers the lens; open = folds back over the top of the tube.
  const hinge=new THREE.Group();hinge.position.set(0,.041,-.119);altG.add(hinge);
  const lid=new THREE.Mesh(new THREE.CylinderGeometry(.0445,.0445,.005,40).rotateX(Math.PI/2),dark);lid.position.y=-.041;hinge.add(lid);
  const lidRing=new THREE.Mesh(new THREE.TorusGeometry(.0445,.0016,8,40),metal);lidRing.position.y=-.041;lidRing.position.z=-.0025;hinge.add(lidRing);
  // status light on the base
  const ledMat=new THREE.MeshBasicMaterial({color:0x000000});
  const led=new THREE.Mesh(new THREE.SphereGeometry(.0045,12,12),ledMat);led.position.set(0,.03,-.0665);tiltG.add(led);

  /* ---- aim line: shows where the telescope points ---- */
  const beam=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,-.12),new THREE.Vector3(0,0,-30)]),new THREE.LineBasicMaterial({color:0x4da3ff,transparent:true,opacity:.7}));
  beam.visible=false;altG.add(beam);

  /* ---- orbit camera (drag to rotate, wheel / pinch to zoom) ---- */
  const orbit={yaw:2.6,pitch:.22,dist:1.15,ty:SCOPE_H+.2};
  const views={orbit:null,front:{yaw:Math.PI,pitch:.12,dist:1.0},side:{yaw:Math.PI/2,pitch:.1,dist:1.0},top:{yaw:Math.PI,pitch:1.45,dist:1.1}};
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
    hinge.rotation.x=-105*D2R*m.cover;
    dewMat.opacity=m.dew*.85;
    // LED colour tells the story: orange = starting, green = ready, blue = moving, cyan = tracking, red = problem
    let c=0x000000;
    if(m.power==='booting')c=(Math.floor(t*3)%2)?0xff9a2a:0x331a00;
    else if(m.power==='ready'){c=({idle:0x35e58a,slew:0x4da3ff,center:0x4da3ff,manual:0x4da3ff,track:0x35d8ff,lost:0xff4b3a})[m.mode]||0x35e58a;}
    ledMat.color.setHex(c);
    beam.visible=SC.showBeam;
    updateEye();
    renderer.render(scene,camera);
  };
  function updateEye(){
    if(viewMode==='eye'){
      // put the camera at the front of the tube, looking where the tube looks
      altG.updateWorldMatrix(true,false);
      altG.getWorldQuaternion(q);tmp.set(0,0,-.125).applyMatrix4(altG.matrixWorld);
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
