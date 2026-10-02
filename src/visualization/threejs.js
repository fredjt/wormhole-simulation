export let scene, camera, renderer, shellMesh, horizonMesh;
export let threeFailed = false;


function initThreeJS(){
  try{
    if(typeof THREE==='undefined'){throw new Error('Three.js not loaded');}
    const container=document.getElementById('threeContainer');
    scene=new THREE.Scene();scene.background=new THREE.Color(0x0a0a18);
    camera=new THREE.PerspectiveCamera(50,1,0.1,100);camera.position.set(3,2,4);camera.lookAt(0,0,0);
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
    container.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0x404060,0.5));
    const dir=new THREE.DirectionalLight(0xffffff,0.8);dir.position.set(3,5,4);scene.add(dir);
    const pt=new THREE.PointLight(0x4060ff,0.5,10);pt.position.set(-2,-1,-2);scene.add(pt);
    const hGeo=new THREE.SphereGeometry(0.3,32,32);
    const hMat=new THREE.MeshPhongMaterial({color:0x050510,emissive:0x0a0a20,transparent:true,opacity:0.9});
    horizonMesh=new THREE.Mesh(hGeo,hMat);scene.add(horizonMesh);
    const sGeo=new THREE.SphereGeometry(1,48,48);
    const sMat=new THREE.MeshPhongMaterial({color:0x3060c0,emissive:0x2040a0,transparent:true,opacity:0.35,side:THREE.DoubleSide});
    shellMesh=new THREE.Mesh(sGeo,sMat);scene.add(shellMesh);
    const wGeo=new THREE.SphereGeometry(1,24,24);
    const wMat=new THREE.MeshBasicMaterial({color:0x6090e0,wireframe:true,transparent:true,opacity:0.15});
    shellMesh.add(new THREE.Mesh(wGeo,wMat));
    for(let i=0;i<8;i++){const ang=(i/8)*Math.PI*2;const pts=[];for(let r=0.3;r<=6;r+=0.1)pts.push(new THREE.Vector3(r*Math.cos(ang),r*Math.sin(ang),0));scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x2a2a4a,transparent:true,opacity:0.3})));}
    for(let i=0;i<8;i++){const ang=(i/8)*Math.PI*2+Math.PI/8;const pts=[];for(let r=0.3;r<=6;r+=0.1)pts.push(new THREE.Vector3(r*Math.cos(ang),r*Math.sin(ang),0));scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x2a2a4a,transparent:true,opacity:0.3})));}
    for(let r=1;r<=5;r++){const rg=new THREE.RingGeometry(r-0.01,r+0.01,64);const rm=new THREE.MeshBasicMaterial({color:0x3a3a5a,side:THREE.DoubleSide,transparent:true,opacity:0.2});const ring=new THREE.Mesh(rg,rm);ring.rotation.x=-Math.PI/2;ring.position.y=-0.5;scene.add(ring);}
    resizeThreeJS();
    setTimeout(resizeThreeJS, 100);
    window.addEventListener('resize', resizeThreeJS);
  }catch(e){
    threeFailed=true;
    console.error('Three.js init failed:',e);
  }
}

function resizeThreeJS(){
  if(threeFailed||!renderer)return;
  const c=document.getElementById('threeContainer');if(!c)return;const w=c.clientWidth,h=c.clientHeight;if(!w||!h)return;
  camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);
}

function updateShellVisualization(a){
  if(threeFailed||!shellMesh)return;
  const scale=Math.max(a,0.1);shellMesh.scale.set(scale,scale,scale);
  const f_a=lapseF(a,M_val,beta_val,mu_val);
  const sigma_a=surfaceSigma(a,Math.max(f_a,0),v_current);
  const t=Math.min(Math.max(sigma_a/(-0.5),0),1);
  shellMesh.material.color.setRGB((40+180*(1-t))/255,(60+120*t)/255,(192-80*t)/255);
  shellMesh.material.opacity=Math.min(0.6,Math.max(0.1,a/3));
}

export { initThreeJS, resizeThreeJS, updateShellVisualization };
