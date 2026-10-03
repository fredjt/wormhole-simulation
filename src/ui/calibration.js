function readParams(){
  const g=id=>document.getElementById(id);
  M_val=parseFloat(g('sliderM')?.value||'1.0');
  A_val=parseFloat(g('sliderA')?.value||'0.3');
  r0_val=parseFloat(g('sliderR0')?.value||'0.5');
  a0_val=parseFloat(g('sliderA0')?.value||'1.8');
  eosModel=g('eosSelect').value;
  speedMultiplier=parseFloat(g('sliderSpeed')?.value||'1.0');
  autoStop=g('chkAutoStop')?.checked||false;
  switch(eosModel){
    case'barotropic':eosParams.omega=parseFloat(g('sliderOmega')?.value||-0.58);break;
    case'phantom':eosParams.Ap=parseFloat(g('sliderAp')?.value||0.5);eosParams.alpha_p=parseFloat(g('sliderAlphaP')?.value||1);eosParams.n=parseFloat(g('sliderN')?.value||5);break;
    case'chaplygin':eosParams.Ac=parseFloat(g('sliderAc')?.value||2);eosParams.alpha_c=parseFloat(g('sliderAlphaC')?.value||1);break;
    case'cosmicChap':eosParams.Agc=parseFloat(g('sliderAgc')?.value||2);eosParams.n_gc=parseFloat(g('sliderNgc')?.value||3);break;
    case'modCosmicChap':eosParams.Amcc=parseFloat(g('sliderAmcc')?.value||2);eosParams.m_mcc=parseFloat(g('sliderMmcc')?.value||3);break;
  }
  if(g('valM'))g('valM').textContent=M_val.toFixed(2);
  if(g('valA'))g('valA').textContent=A_val.toFixed(2);
  if(g('valR0'))g('valR0').textContent=r0_val.toFixed(2);
  if(g('valA0'))g('valA0').textContent=a0_val.toFixed(2);
  if(g('valSpeed'))g('valSpeed').textContent=speedMultiplier.toFixed(1)+'\u00d7';
}

function updateEosParamsUI(){const container=document.getElementById('eosParams');let html='';switch(eosModel){case'barotropic':html+='<div class="slider-row"><label>&omega; <span class="val" id="valOmega">'+eosParams.omega.toFixed(2)+'</span></label><input type="range" id="sliderOmega" min="-1.5" max="0" step="0.01" value="'+eosParams.omega+'"></div>';break;case'phantom':html+='<div class="slider-row"><label>A<sub>p</sub> <span class="val" id="valAp">'+eosParams.Ap.toFixed(2)+'</span></label><input type="range" id="sliderAp" min="0" max="5" step="0.1" value="'+eosParams.Ap+'"></div><div class="slider-row"><label>&alpha;<sub>p</sub> <span class="val" id="valAlphaP">'+eosParams.alpha_p.toFixed(2)+'</span></label><input type="range" id="sliderAlphaP" min="0" max="3" step="0.1" value="'+eosParams.alpha_p+'"></div><div class="slider-row"><label>n <span class="val" id="valN">'+eosParams.n.toFixed(1)+'</span></label><input type="range" id="sliderN" min="1" max="10" step="0.5" value="'+eosParams.n+'"></div>';break;case'chaplygin':html+='<div class="slider-row"><label>A<sub>c</sub> <span class="val" id="valAc">'+eosParams.Ac.toFixed(2)+'</span></label><input type="range" id="sliderAc" min="0.1" max="10" step="0.1" value="'+eosParams.Ac+'"></div><div class="slider-row"><label>&alpha;<sub>c</sub> <span class="val" id="valAlphaC">'+eosParams.alpha_c.toFixed(2)+'</span></label><input type="range" id="sliderAlphaC" min="0.1" max="3" step="0.1" value="'+eosParams.alpha_c+'"></div>';break;case'cosmicChap':html+='<div class="slider-row"><label>A<sub>gc</sub> <span class="val" id="valAgc">'+eosParams.Agc.toFixed(2)+'</span></label><input type="range" id="sliderAgc" min="0.1" max="10" step="0.1" value="'+eosParams.Agc+'"></div><div class="slider-row"><label>n<sub>gc</sub> <span class="val" id="valNgc">'+eosParams.n_gc.toFixed(2)+'</span></label><input type="range" id="sliderNgc" min="1" max="5" step="0.1" value="'+eosParams.n_gc+'"></div>';break;case'modCosmicChap':html+='<div class="slider-row"><label>A<sub>mcc</sub> <span class="val" id="valAmcc">'+eosParams.Amcc.toFixed(2)+'</span></label><input type="range" id="sliderAmcc" min="0.1" max="10" step="0.1" value="'+eosParams.Amcc+'"></div><div class="slider-row"><label>m<sub>mcc</sub> <span class="val" id="valMmcc">'+eosParams.m_mcc.toFixed(2)+'</span></label><input type="range" id="sliderMmcc" min="1" max="5" step="0.1" value="'+eosParams.m_mcc+'"></div>';break;}container.innerHTML=html;container.querySelectorAll('input[type="range"]').forEach(sl=>{sl.addEventListener('input',()=>{readParams();if(simRunning)resetSim();});});}

function updateHorizonInfo(){
  const g=id=>document.getElementById(id);
  const[rPlus]=findHorizons(M_val,A_val,r0_val);
  const infoEl=g('horizonInfo'),warnEl=g('horizonWarn'),a0Slider=g('sliderA0');
  if(!infoEl||!a0Slider)return;
  if(rPlus!==null){
    infoEl.textContent='Horizon r\u208a: '+rPlus.toFixed(3);
    a0Slider.min=(rPlus+0.05).toFixed(3);
    a0Slider.max=Math.max(rPlus*4,5).toFixed(3);
    if(a0_val<=rPlus+0.01){if(warnEl)warnEl.style.display='block';a0Slider.value=rPlus+0.1;a0_val=parseFloat(a0Slider.value);if(g('valA0'))g('valA0').textContent=a0_val.toFixed(2);}else if(warnEl)warnEl.style.display='none';
  }else{infoEl.textContent='No horizon found (regular geometry)';a0Slider.min='0.3';a0Slider.max='5.0';if(warnEl)warnEl.style.display='none';}
}

function calibrateAtA0(){const f_a0=lapseF(a0_val,M_val,A_val,r0_val);if(f_a0<=0)return;switch(eosModel){case'barotropic':eosParams.omega=calibrateOmega(a0_val,M_val,A_val,r0_val);break;case'phantom':eosParams.Ap=calibratePhantomParams(a0_val,M_val,A_val,r0_val,eosParams);break;case'chaplygin':eosParams.Ac=calibrateChaplyginParams(a0_val,M_val,A_val,r0_val);break;case'cosmicChap':eosParams.Agc=calibrateCosmicChap(a0_val,M_val,A_val,r0_val);break;case'modCosmicChap':eosParams.Amcc=calibrateModCosmicChap(a0_val,M_val,A_val,r0_val);break;}calibrated=true;updateEosParamsUI();resetSim();}

function initSim(){const f_a0=lapseF(a0_val,M_val,A_val,r0_val);if(f_a0<=0)return;let deltaAPct=parseFloat(document.getElementById('sliderDeltaA')?.value || '0.01');if(document.getElementById('chkSmallPerturb').checked)deltaAPct=0.01;v_current=parseFloat(document.getElementById('sliderV0')?.value || '-0.1');tau=0;a_current=a0_val*(1+deltaAPct/100);timeHistory=[{tau:0,a:a_current,v:v_current}];phaseHistory=[{a:a_current,v:v_current}];calibrated=true;}

function resetSim(){simRunning=false;simPaused=false;readParams();initSim();}

let lastTime=0;

export { readParams, updateEosParamsUI, updateHorizonInfo, calibrateAtA0, initSim, resetSim };
