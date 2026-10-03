function renderEnergyConditions(){
  const container=document.getElementById('ecBars');if(!container)return;
  const f_a=lapseF(a_current,M_val,A_val,r0_val),sigma_a=surfaceSigma(a_current,Math.max(f_a,0),v_current);
  const p_a=tangentialPressure(a_current,lapseFPrime(a_current,M_val,A_val,r0_val),Math.max(f_a,0),v_current);
  // For thin-shell wormholes: exotic matter has sigma<0. NEC violation (sigma+p<0) is required.
  // Show whether the configuration has the right exotic matter properties.
  const necViolation = sigma_a + p_a < 0;  // True = NEC violated (required for wormhole)
  const conditions=[{name:'Weak',check:()=>sigma_a<=0&&sigma_a+p_a<=0},{name:'Dominant',check:()=>sigma_a<=0&&Math.abs(p_a)<=Math.abs(sigma_a)},{name:'Null',check:()=>necViolation},{name:'Strong',check:()=>necViolation&&(sigma_a+3*p_a<=0)}];
  let html='';conditions.forEach(ec=>{let strength=0;if(ec.name==='Weak')strength=Math.min(1,Math.max(-1,sigma_a+p_a));else if(ec.name==='Dominant')strength=Math.min(1,Math.max(-1,sigma_a-Math.abs(p_a)));else if(ec.name==='Null')strength=Math.min(1,Math.max(-1,sigma_a+p_a));else strength=Math.min(1,Math.max(-1,sigma_a+3*p_a));const pct=((strength+1)/2)*50;const cls=(ec.check())?'ec-pass':'ec-fail';const icon=(ec.check())?String.fromCharCode(10004):String.fromCharCode(10006);html+='<div class="ec-bar-container '+cls+'"><span class="name">'+ec.name+'</span><div class="ec-bar-track"><div class="ec-bar-fill" style="left:'+Math.min(50,Math.max(0,pct))+'%;width:'+Math.abs(pct-50)+'%"></div></div><span class="ec-icon">'+icon+'</span></div>';});container.innerHTML=html;}

function updateStatus(){
  const vpp = calibrated ? computeVpp(a0_val) : NaN;
  const isStable = isFinite(vpp) && vpp > 0;
  const badge=document.getElementById('stabBadge');if(!calibrated||isNaN(vpp)){badge.textContent='\u2014';badge.className='stability-badge';}else{badge.textContent=isStable?'STABLE':'UNSTABLE';badge.className='stability-badge '+(isStable?'stable':'unstable');}
  document.getElementById('valVpp').textContent=isFinite(vpp)?vpp.toFixed(4):'\u2014';document.getElementById('valFreq').textContent=isStable?(Math.sqrt(vpp)/(2*Math.PI)).toFixed(3):'\u2014';
  document.getElementById('valA').textContent=a_current.toFixed(4);document.getElementById('valADelta').textContent=calibrated?((a_current-a0_val)/a0_val*100).toFixed(2)+'%':'\u2014';document.getElementById('valV').textContent=v_current.toFixed(4);
  const f_now=lapseF(a_current,M_val,A_val,r0_val);const sigma_a=surfaceSigma(a_current,Math.max(f_now,0),v_current);const p_a=tangentialPressure(a_current,lapseFPrime(a_current,M_val,A_val,r0_val),Math.max(f_now,0),v_current);document.getElementById('valSigma').textContent=isFinite(sigma_a)?sigma_a.toFixed(4)+(sigma_a<0?' (exotic)':''):'\u2014';document.getElementById('valP').textContent=isFinite(p_a)?p_a.toFixed(4):'\u2014';
  const modelNames={barotropic:'Linear Barotropic',phantom:'Variable Phantom',chaplygin:'Variable Chaplygin',cosmicChap:'Gen. Cosmic Chaplygin',modCosmicChap:'Mod. Cosmic Chaplygin'};document.getElementById('valModel').textContent=modelNames[eosModel]||eosModel;
  renderEnergyConditions();
}

export { renderEnergyConditions, updateStatus };
