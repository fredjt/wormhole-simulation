function setupCanvas(id){const canvas=document.getElementById(id);const dpr=window.devicePixelRatio||1;function resize(){const rect=canvas.parentElement.getBoundingClientRect();canvas.width=rect.width*dpr;canvas.height=rect.height*dpr;canvas.style.width=rect.width+'px';canvas.style.height=rect.height+'px';}resize();window.addEventListener('resize',resize);return{canvas,ctx:canvas.getContext('2d'),dpr};}
const potObj=setupCanvas('potCanvas');const timeObj=setupCanvas('timeCanvas');const phaseObj=setupCanvas('phaseCanvasEl');

function drawGraph(ctx,w,h,drawFn){
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);drawFn(ctx,w,h);ctx.restore();}

function drawPotentialGraph(){
  const{canvas,ctx}=potObj;const w=canvas.width/(window.devicePixelRatio||1),h=canvas.height/(window.devicePixelRatio||1);
  drawGraph(ctx,w,h,(c,cw,ch)=>{
    const pad={l:50,r:20,t:20,b:35},gw=cw-pad.l-pad.r,gh=ch-pad.t-pad.b;
    const aMin=0.2,aMax=Math.max(a0_val*3,4),N=300,pts=[];let vMin=1e9,vMax=-1e9;
    for(let i=0;i<=N;i++){const a=aMin+(aMax-aMin)*i/N;if(lapseF(a,M_val,beta_val,mu_val)>0){const s0=calibrated?Math.sqrt(Math.abs(lapseF(a0_val,M_val,beta_val,mu_val)))/(2*Math.PI*a0_val):0.1;const V=effPot(a,a0_val,s0,eosModel,eosParams);if(isFinite(V)){pts.push({a,V});vMin=Math.min(vMin,V);vMax=Math.max(vMax,V);}}}
    if(pts.length<2)return;
    const vRange=vMax-vMin||1;vMin-=vRange*0.1;vMax+=vRange*0.1;
    function toX(a){return pad.l+(a-aMin)/(aMax-aMin)*gw;}function toY(V){return pad.t+gh-(V-vMin)/(vMax-vMin)*gh;}
    c.strokeStyle='#1a1a30';c.lineWidth=1;for(let a=Math.ceil(aMin);a<=aMax;a++){c.beginPath();c.moveTo(toX(a),pad.t);c.lineTo(toX(a),ch-pad.b);c.stroke();}
    if(vMin<0&&vMax>0){c.strokeStyle='#3a3a5a';c.lineWidth=1;c.setLineDash([4,4]);c.beginPath();c.moveTo(pad.l,toY(0));c.lineTo(cw-pad.r,toY(0));c.stroke();c.setLineDash([]);}
    const Vpp=calibrated?effPotD2(a0_val,a0_val,Math.sqrt(Math.abs(lapseF(a0_val,M_val,beta_val,mu_val)))/(2*Math.PI*a0_val),eosModel,eosParams):NaN;
    const isStable=isFinite(Vpp)&&Vpp>0;
    c.strokeStyle=isStable?'#40c060':'#e05050';c.lineWidth=2.5;c.beginPath();for(let i=0;i<pts.length;i++){const x=toX(pts[i].a),y=toY(pts[i].V);i===0?c.moveTo(x,y):c.lineTo(x,y);}c.stroke();
    if(calibrated){const a0x=toX(a0_val);c.strokeStyle='#fff';c.lineWidth=1;c.setLineDash([3,3]);c.beginPath();c.moveTo(a0x,pad.t);c.lineTo(a0x,ch-pad.b);c.stroke();c.setLineDash([]);c.fillStyle='#fff';c.beginPath();c.arc(a0x,toY(0),5,0,Math.PI*2);c.fill();const pertA=a0_val*(1+parseFloat(document.getElementById('sliderDeltaA').value)/100);const pertX=toX(pertA);c.strokeStyle='#ffaa40';c.lineWidth=2;c.beginPath();c.moveTo(a0x,toY(0));c.lineTo(pertX,toY(0));c.stroke();const dir=pertX>a0x?1:-1;c.beginPath();c.moveTo(pertX,toY(0));c.lineTo(pertX-dir*6,toY(0)-4);c.lineTo(pertX-dir*6,toY(0)+4);c.closePath();c.fillStyle='#ffaa40';c.fill();}
    c.fillStyle='#7070a0';c.font='11px sans-serif';c.textAlign='center';c.fillText('a (throat radius)',cw/2,ch-5);c.save();c.translate(12,ch/2);c.rotate(-Math.PI/2);c.fillText('V(a)',0,0);c.restore();
    if(calibrated&&!isNaN(Vpp)){c.fillStyle=Vpp>0?'#40c060':'#e05050';c.font='bold 12px sans-serif';c.textAlign='right';c.fillText(Vpp>0?'STABLE':'UNSTABLE',cw-pad.r,pad.t+14);}
  });
}

function drawTimeSeries(){
  const{canvas,ctx}=timeObj;const w=canvas.width/(window.devicePixelRatio||1),h=canvas.height/(window.devicePixelRatio||1);
  drawGraph(ctx,w,h,(c,cw,ch)=>{
    const pad={l:50,r:20,t:15,b:25},gw=cw-pad.l-pad.r,gh=ch-pad.t-pad.b;
    if(timeHistory.length<1)return;let aMin=1e9,aMax=-1e9;timeHistory.forEach(p=>{aMin=Math.min(aMin,p.a);aMax=Math.max(aMax,p.a);});aMin=Math.min(aMin,a0_val)*0.9;aMax=Math.max(aMax,a0_val)*1.1;const tauMin=timeHistory[0].tau,tauMax=timeHistory[timeHistory.length-1].tau,tauRange=tauMax-tauMin||1;
    function toX(t){return pad.l+(t-tauMin)/tauRange*gw;}function toY(a){return pad.t+gh-(a-aMin)/(aMax-aMin)*gh;}
    c.strokeStyle='#1a1a30';c.lineWidth=1;for(let a=Math.ceil(aMin);a<=Math.floor(aMax);a++){c.beginPath();c.moveTo(pad.l,toY(a));c.lineTo(cw-pad.r,toY(a));c.stroke();}
    c.strokeStyle='#ffffff40';c.lineWidth=1;c.setLineDash([3,3]);c.beginPath();c.moveTo(pad.l,toY(a0_val));c.lineTo(cw-pad.r,toY(a0_val));c.stroke();c.setLineDash([]);
    c.strokeStyle='#6090e0';c.lineWidth=2;c.beginPath();for(let i=0;i<timeHistory.length;i++){const x=toX(timeHistory[i].tau),y=toY(timeHistory[i].a);i===0?c.moveTo(x,y):c.lineTo(x,y);}if(timeHistory.length>1)c.stroke();else{c.closePath();c.fillStyle='#6090e0';c.fill();}
    c.fillStyle='#7070a0';c.font='11px sans-serif';c.textAlign='center';c.fillText('Proper time τ',cw/2,ch-5);c.save();c.translate(12,ch/2);c.rotate(-Math.PI/2);c.fillText('a(τ)',0,0);c.restore();
  });
}

function drawPhaseSpace(){
  const{canvas,ctx}=phaseObj;const w=canvas.width/(window.devicePixelRatio||1),h=canvas.height/(window.devicePixelRatio||1);
  drawGraph(ctx,w,h,(c,cw,ch)=>{
    const pad={l:50,r:15,t:15,b:30},gw=cw-pad.l-pad.r,gh=ch-pad.t-pad.b;
    if(phaseHistory.length<1)return;let aMin=1e9,aMax=-1e9,vMin=1e9,vMax=-1e9;phaseHistory.forEach(p=>{aMin=Math.min(aMin,p.a);aMax=Math.max(aMax,p.a);vMin=Math.min(vMin,p.v);vMax=Math.max(vMax,p.v);});const aPad=(aMax-aMin)*0.15||0.3,vPad=(vMax-vMin)*0.15||0.3;aMin-=aPad;aMax+=aPad;vMin-=vPad;vMax+=vPad;
    function toX(a){return pad.l+(a-aMin)/(aMax-aMin)*gw;}function toY(v){return pad.t+gh-(v-vMin)/(vMax-vMin)*gh;}
    c.strokeStyle='#1a1a30';c.lineWidth=1;for(let a=Math.ceil(aMin);a<=Math.floor(aMax);a++){c.beginPath();c.moveTo(toX(a),pad.t);c.lineTo(toX(a),ch-pad.b);c.stroke();}for(let v=Math.ceil(vMin);v<=Math.floor(vMax);v+=0.5){c.beginPath();c.moveTo(pad.l,toY(v));c.lineTo(cw-pad.r,toY(v));c.stroke();}
    c.strokeStyle='#3a3a5a';c.lineWidth=1;c.beginPath();c.moveTo(pad.l,toY(0));c.lineTo(cw-pad.r,toY(0));c.stroke();c.beginPath();c.moveTo(toX(0),pad.t);c.lineTo(toX(0),ch-pad.b);c.stroke();
    c.strokeStyle='#6090e0';c.lineWidth=2;c.beginPath();for(let i=0;i<phaseHistory.length;i++){const x=toX(phaseHistory[i].a),y=toY(phaseHistory[i].v);i===0?c.moveTo(x,y):c.lineTo(x,y);}if(phaseHistory.length>1)c.stroke();else{c.closePath();c.fillStyle='#6090e0';c.fill();}
    if(calibrated){c.fillStyle='#fff';c.beginPath();c.arc(toX(a0_val),toY(0),4,0,Math.PI*2);c.fill();}
    c.fillStyle='#ffaa40';c.beginPath();c.arc(toX(a_current),toY(v_current),5,0,Math.PI*2);c.fill();
    c.fillStyle='#7070a0';c.font='11px sans-serif';c.textAlign='center';c.fillText('a',cw/2,ch-5);c.save();c.translate(12,ch/2);c.rotate(-Math.PI/2);c.fillText('δa/δτ',0,0);c.restore();
  });
}

export { setupCanvas, drawGraph, drawPotentialGraph, drawTimeSeries, drawPhaseSpace };
