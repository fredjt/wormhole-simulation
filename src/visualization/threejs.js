export const G = {scene:null,camera:null,renderer:null,shellMesh:null,horizonMesh:null,threeFailed:false};


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
      G.scene=new THREE.Scene();
      G.scene.background=new THREE.Color(0x0a0a18);
      G.camera=new THREE.PerspectiveCamera(50,1,0.1,100);
      G.camera.position.set(3,2,4);
      G.camera.lookAt(0,0,0);
      G.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
      G.renderer.setPixelRatio(window.devicePixelRatio);
      console.log('WebGL context:', G.renderer.domElement.getContext('webgl'));
      container.appendChild(G.renderer.domElement);
      
      G.scene.add(new THREE.AmbientLight(0x404060,0.5));
      const dir=new THREE.DirectionalLight(0xffffff,0.8);
      dir.position.set(3,5,4);
      G.scene.add(dir);
      
      const hGeo=new THREE.SphereGeometry(0.3,16,16);
      G.horizonMesh=new THREE.Mesh(hGeo,new THREE.MeshPhongMaterial({color:0x050510}));
      G.scene.add(G.horizonMesh);
      
      G.shellMesh=new THREE.Mesh(new THREE.SphereGeometry(1,32,32),
        new THREE.MeshPhongMaterial({color:0x3060c0,emissive:0x2040a0,transparent:true,opacity:0.35,side:THREE.DoubleSide}));
      G.scene.add(G.shellMesh);
      
      resizeThreeJS();
      setTimeout(resizeThreeJS, 50);
      window.addEventListener('resize', resizeThreeJS);
    } else {
      console.log('WebGL unavailable - using Canvas2D fallback');
      G.threeFailed = true;
      const canvas2D = document.createElement('canvas');
      canvas2D.style.width = '100%';
      canvas2D.style.height = '100%';
      container.appendChild(canvas2D);
      window._ctx2D = canvas2D.getContext('2d');
      resizeThreeJS();
    }
  }catch(e){
    G.threeFailed=true;
    console.error('Three.js init failed:',e);
  }
}

function resizeThreeJS(){
  if(G.threeFailed && !window._ctx2D)return;
  const c=document.getElementById('threeContainer');
  if(!c)return;
  const w=c.clientWidth,h=c.clientHeight;
  if(!w||!h)return;
  
  if(window._ctx2D){
    canvas2D.width=w*window.devicePixelRatio;
    canvas2D.height=h*window.devicePixelRatio;
    window._ctx2D.scale(window.devicePixelRatio,window.devicePixelRatio);
  } else if(G.renderer){
    G.camera.aspect=w/h;
    G.camera.updateProjectionMatrix();
    G.renderer.setSize(w,h);
  }
}

function updateShellVisualization(a){
  if(G.threeFailed && window._ctx2D){
    draw2DSphere(a);
  } else if(!G.threeFailed && G.shellMesh){
    const scale=Math.max(a,0.1);
    G.shellMesh.scale.set(scale,scale,scale);
  }
}

function draw2DSphere(a){
  if(!window._ctx2D)return;
  const c=document.getElementById('threeContainer');
  const w=c.clientWidth,h=c.clientHeight;
  window._ctx2D.clearRect(0,0,w,h);
  
  window._ctx2D.fillStyle='#0a0a18';
  window._ctx2D.fillRect(0,0,w,h);
  
  const cx=w/2, cy=h/2;
  const radius=Math.min(w,h)*0.3*Math.max(a,0.1)/2;
  
  window._ctx2D.beginPath();
  window._ctx2D.arc(cx,cy,radius,0,Math.PI*2);
  window._ctx2D.strokeStyle='#3060c0';
  window._ctx2D.lineWidth=2;
  window._ctx2D.stroke();
  
  for(let i=0;i<8;i++){
    const angle=(i/8)*Math.PI*2;
    window._ctx2D.beginPath();
    window._ctx2D.moveTo(cx,cy);
    window._ctx2D.lineTo(cx+Math.cos(angle)*radius,cy+Math.sin(angle)*radius);
    window._ctx2D.strokeStyle='rgba(96,144,224,0.3)';
    window._ctx2D.lineWidth=1;
    window._ctx2D.stroke();
  }
  
  window._ctx2D.beginPath();
  window._ctx2D.arc(cx,cy,radius*0.3,0,Math.PI*2);
  window._ctx2D.fillStyle='#050510';
  window._ctx2D.fill();
  
  window._ctx2D.fillStyle='#c8c8e0';
  window._ctx2D.font='14px sans-serif';
  window._ctx2D.textAlign='center';
  window._ctx2D.fillText('a = '+a.toFixed(2),cx,cy+radius+20);
}

export { initThreeJS, resizeThreeJS, updateShellVisualization };
