export let scene, camera, renderer, shellMesh, horizonMesh;
export let threeFailed = false;


function initThreeJS(){
  try{
    if(typeof THREE==='undefined'){console.error('THREE not loaded');throw new Error('Three.js not loaded');}
    console.log('Three.js version:', THREE.REVISION);
    
    const container=document.getElementById('threeContainer');
    if(!container){console.error('threeContainer not found');return;}
    console.log('Container:', container, 'size:', container.clientWidth, 'x', container.clientHeight);
    
    scene=new THREE.Scene();
    scene.background=new THREE.Color(0x0a0a18);
    
    camera=new THREE.PerspectiveCamera(50,1,0.1,100);
    camera.position.set(3,2,4);
    camera.lookAt(0,0,0);
    
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
    renderer.setPixelRatio(window.devicePixelRatio);
    console.log('WebGL supported:', !!renderer.domElement.getContext('webgl'));
    container.appendChild(renderer.domElement);
    console.log('Canvas appended:', renderer.domElement.width, 'x', renderer.domElement.height);
    
    scene.add(new THREE.AmbientLight(0x404060,0.5));
    const dir=new THREE.DirectionalLight(0xffffff,0.8);
    dir.position.set(3,5,4);
    scene.add(dir);
    
    // Simple test sphere to verify rendering works
    const hGeo=new THREE.SphereGeometry(0.3,32,32);
    const hMat=new THREE.MeshPhongMaterial({color:0x050510,emissive:0x0a0a20});
    horizonMesh=new THREE.Mesh(hGeo,hMat);
    scene.add(horizonMesh);
    
    const sGeo=new THREE.SphereGeometry(1,48,48);
    const sMat=new THREE.MeshPhongMaterial({color:0x3060c0,emissive:0x2040a0,transparent:true,opacity:0.35,side:THREE.DoubleSide});
    shellMesh=new THREE.Mesh(sGeo,sMat);
    scene.add(shellMesh);
    
    resizeThreeJS();
    setTimeout(resizeThreeJS, 50);
    setTimeout(resizeThreeJS, 200);
    window.addEventListener('resize', resizeThreeJS);
    console.log('initThreeJS complete');
  }catch(e){
    threeFailed=true;
    console.error('Three.js init failed:',e);
  }
}

function resizeThreeJS(){
  if(threeFailed||!renderer)return;
  const c=document.getElementById('threeContainer');
  if(!c)return;
  const w=c.clientWidth,h=c.clientHeight;
  if(!w||!h){console.log('resize: container too small',w,'x',h);return;}
  camera.aspect=w/h;
  camera.updateProjectionMatrix();
  renderer.setSize(w,h);
  console.log('Resized to:',w,'x',h);
}

function updateShellVisualization(a){
  if(threeFailed||!shellMesh)return;
  const scale=Math.max(a,0.1);
  shellMesh.scale.set(scale,scale,scale);
}

export { initThreeJS, resizeThreeJS, updateShellVisualization };
