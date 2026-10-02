export let scene, camera, renderer, shellMesh, horizonMesh;
export let threeFailed = false;
let canvas2D = null;
let ctx2D = null;


function initThreeJS(){
  try{
    if(typeof THREE==='undefined'){console.error('THREE not loaded');throw new Error('Three.js not loaded');}
    
    const container=document.getElementById('threeContainer');
    if(!container){console.error('threeContainer not found');return;}
    
    // Try WebGL first
    let gl = null;
    const testCanvas = document.createElement('canvas');
    gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
    
    if(gl){
      console.log('Using WebGL renderer');
      scene=new THREE.Scene();
      scene.background=new THREE.Color(0x0a0a18);
      camera=new THREE.PerspectiveCamera(50,1,0.1,100);
      camera.position.set(3,2,4);
      camera.lookAt(0,0,0);
      renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
      renderer.setPixelRatio(window.devicePixelRatio);
      container.appendChild(renderer.domElement);
    console.log('WebGL context:', renderer.domElement.getContext('webgl'));
    console.log('Renderer info:', renderer.info);
      
      scene.add(new THREE.AmbientLight(0x404060,0.5));
      const dir=new THREE.DirectionalLight(0xffffff,0.8);
      dir.position.set(3,5,4);
      scene.add(dir);
      
      const hGeo=new THREE.SphereGeometry(0.3,16,16);
      horizonMesh=new THREE.Mesh(hGeo,new THREE.MeshPhongMaterial({color:0x050510}));
      scene.add(horizonMesh);
      
      shellMesh=new THREE.Mesh(new THREE.SphereGeometry(1,32,32),
        new THREE.MeshPhongMaterial({color:0x3060c0,emissive:0x2040a0,transparent:true,opacity:0.35,side:THREE.DoubleSide}));
      scene.add(shellMesh);
      
      resizeThreeJS();
      setTimeout(resizeThreeJS, 50);
      window.addEventListener('resize', resizeThreeJS);
    } else {
      console.log('WebGL unavailable - using Canvas2D fallback');
      threeFailed = true;
      // Create a 2D canvas fallback
      canvas2D = document.createElement('canvas');
      canvas2D.style.width = '100%';
      canvas2D.style.height = '100%';
      container.appendChild(canvas2D);
      ctx2D = canvas2D.getContext('2d');
      resizeThreeJS();
    }
  }catch(e){
    threeFailed=true;
    console.error('Three.js init failed:',e);
  }
}

function resizeThreeJS(){
  if(threeFailed && !canvas2D)return;
  const c=document.getElementById('threeContainer');
  if(!c)return;
  const w=c.clientWidth,h=c.clientHeight;
  if(!w||!h)return;
  
  if(canvas2D){
    canvas2D.width=w*window.devicePixelRatio;
    canvas2D.height=h*window.devicePixelRatio;
    ctx2D.scale(window.devicePixelRatio,window.devicePixelRatio);
  } else if(renderer){
    camera.aspect=w/h;
    camera.updateProjectionMatrix();
    renderer.setSize(w,h);
  }
}

function updateShellVisualization(a){
  if(threeFailed && canvas2D){
    draw2DSphere(a);
  } else if(!threeFailed && shellMesh){
    const scale=Math.max(a,0.1);
    shellMesh.scale.set(scale,scale,scale);
  }
}

function draw2DSphere(a){
  if(!ctx2D)return;
  const w=canvas2D.width/window.devicePixelRatio;
  const h=canvas2D.height/window.devicePixelRatio;
  ctx2D.clearRect(0,0,w,h);
  
  // Draw background
  ctx2D.fillStyle='#0a0a18';
  ctx2D.fillRect(0,0,w,h);
  
  // Draw sphere as circle with wireframe
  const cx=w/2, cy=h/2;
  const radius=Math.min(w,h)*0.3*Math.max(a,0.1)/2;
  
  // Outer circle (shell)
  ctx2D.beginPath();
  ctx2D.arc(cx,cy,radius,0,Math.PI*2);
  ctx2D.strokeStyle='#3060c0';
  ctx2D.lineWidth=2;
  ctx2D.stroke();
  
  // Wireframe lines
  for(let i=0;i<8;i++){
    const angle=(i/8)*Math.PI*2;
    ctx2D.beginPath();
    ctx2D.moveTo(cx,cy);
    ctx2D.lineTo(cx+Math.cos(angle)*radius,cy+Math.sin(angle)*radius);
    ctx2D.strokeStyle='rgba(96,144,224,0.3)';
    ctx2D.lineWidth=1;
    ctx2D.stroke();
  }
  
  // Inner horizon
  ctx2D.beginPath();
  ctx2D.arc(cx,cy,radius*0.3,0,Math.PI*2);
  ctx2D.fillStyle='#050510';
  ctx2D.fill();
  
  // Label
  ctx2D.fillStyle='#c8c8e0';
  ctx2D.font='14px sans-serif';
  ctx2D.textAlign='center';
  ctx2D.fillText(`a = ${a.toFixed(2)}`,cx,cy+radius+20);
}

export { initThreeJS, resizeThreeJS, updateShellVisualization };
