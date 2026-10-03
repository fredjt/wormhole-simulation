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

function makeEosRow(labelHtml, inputId, minVal, maxVal, stepVal, displayValue){
  const numInputId=inputId+'-num';
  return '<div class="slider-row"><label>'+labelHtml+'</label><div id="'+inputId+'-wrapper" class="number-input-group">' +
    '<input type="number" id="'+numInputId+'" class="wormhole-number-input" min="'+minVal+'" max="'+maxVal+'" step="'+stepVal+'" value="'+displayValue+'">' +
    '<button type="button" class="spin-button spin-button-up"></button>' +
    '<button type="button" class="spin-button spin-button-down"></button></div><input type="range" id="'+inputId+'" min="'+minVal+'" max="'+maxVal+'" step="'+stepVal+'" value="'+displayValue+'"></div>';
}

function updateEosParamsUI(){
  const container=document.getElementById('eosParams');
  let html='';
  switch(eosModel){
    case'barotropic':html+=makeEosRow('&omega;','sliderOmega','-1.5','0','0.01',eosParams.omega.toFixed(2));break;
    case'phantom':
      html+=makeEosRow('A<sub>p</sub>','sliderAp','0','5','0.1',eosParams.Ap.toFixed(2))+
            makeEosRow('&alpha;<sub>p</sub>','sliderAlphaP','0','3','0.1',eosParams.alpha_p.toFixed(2))+
            makeEosRow('n','sliderN','1','10','0.5',eosParams.n.toFixed(1));break;
    case'chaplygin':html+=makeEosRow('A<sub>c</sub>','sliderAc','0.1','10','0.1',eosParams.Ac.toFixed(2))+
                       makeEosRow('&alpha;<sub>c</sub>','sliderAlphaC','0.1','3','0.1',eosParams.alpha_c.toFixed(2));break;
    case'cosmicChap':html+=makeEosRow('A<sub>gc</sub>','sliderAgc','0.1','10','0.1',eosParams.Agc.toFixed(2))+
                           makeEosRow('n<sub>gc</sub>','sliderNgc','1','5','0.1',eosParams.n_gc.toFixed(2));break;
    case'modCosmicChap':html+=makeEosRow('A<sub>mcc</sub>','sliderAmcc','0.1','10','0.1',eosParams.Amcc.toFixed(2))+
                              makeEosRow('m<sub>mcc</sub>','sliderMmcc','1','5','0.1',eosParams.m_mcc.toFixed(2));break;
  }
  container.innerHTML=html;

  // Wire up event listeners for dynamic EOS controls
  const rangeInputs = container.querySelectorAll('input[type="range"]');
  rangeInputs.forEach(sl => {
    sl.addEventListener('input', () => { readParams(); if(simRunning) resetSim(); });
  });

  // Wire up number inputs and spin buttons for dynamic EOS controls
  const groupIds = container.querySelectorAll('[id$="-wrapper"]');
  groupIds.forEach(wrapper => {
    const sliderId = wrapper.id.replace('-wrapper', '');
    const numInput = document.getElementById(sliderId + '-num');
    if (!numInput) return;
    const step = parseFloat(numInput.step || '0.01');

    // Sync number input -> range slider
    numInput.addEventListener('input', () => {
      let val = parseFloat(numInput.value);
      if (!isNaN(val)) {
        val = Math.max(parseFloat(numInput.min), Math.min(parseFloat(numInput.max), val));
        numInput.value = Math.round(val * 100) / 100;
        const slider = document.getElementById(sliderId);
        if (slider) { slider.value = numInput.value; readParams(); }
      }
    });

    // Spin buttons
    wrapper.querySelector('.spin-button-up').addEventListener('click', () => {
      let val = parseFloat(numInput.value) + step;
      val = Math.min(parseFloat(numInput.max), val);
      numInput.value = Math.round(val * 100) / 100;
      const slider = document.getElementById(sliderId);
      if (slider) { slider.value = numInput.value; readParams(); }
    });

    wrapper.querySelector('.spin-button-down').addEventListener('click', () => {
      let val = parseFloat(numInput.value) - step;
      val = Math.max(parseFloat(numInput.min), val);
      numInput.value = Math.round(val * 100) / 100;
      const slider = document.getElementById(sliderId);
      if (slider) { slider.value = numInput.value; readParams(); }
    });

    // Arrow key support in number input
    numInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') { e.preventDefault(); wrapper.querySelector('.spin-button-up').click(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); wrapper.querySelector('.spin-button-down').click(); }
    });
  });
}

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
