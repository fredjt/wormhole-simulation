function readParams(){
  const g=id=>document.getElementById(id);
  M_val=parseFloat(g('sliderM')?.value||'1.0');
  A_val=parseFloat(g('sliderA')?.value||'0.3');
  r0_val=parseFloat(g('sliderR0')?.value||'0.5');
  a0_val=parseFloat(g('sliderA0')?.value||'1.8');
  eosModel=g('eosSelect').value;
  speedMultiplier=parseFloat(g('sliderSpeed')?.value||'1.0');
  autoStop=g('chkAutoStop')?.checked||false;

  // Helper: safely parse slider value with fallback default (avoids NaN propagation)
  const safeParse = (id, def) => {
    const el = g(id);
    if (!el || isNaN(parseFloat(el.value))) return def; // use explicit default directly
    return parseFloat(el.value);
  };

  switch(eosModel){
    case'barotropic':eosParams.omega=safeParse('sliderOmega',-0.58); break;
    case'phantom': eosParams.Ap=safeParse('sliderAp',1); eosParams.alpha_p=safeParse('sliderAlphaP',1); eosParams.n=safeParse('sliderN',5); break;
    case'chaplygin':eosParams.Ac=safeParse('sliderAc',2); eosParams.alpha_c=safeParse('sliderAlphaC',1); break;
    case'cosmicChap':eosParams.Agc=safeParse('sliderAgc',2); eosParams.n_gc=safeParse('sliderNgc',3); break;
    case'modCosmicChap':eosParams.Amcc=safeParse('sliderAmcc',2); eosParams.m_mcc=safeParse('sliderMmcc',3); break;
  }
  if(g('valM'))g('valM').textContent=M_val.toFixed(2);
  if(g('valA'))g('valA').textContent=A_val.toFixed(2);
  if(g('valR0'))g('valR0').textContent=r0_val.toFixed(2);
  if(g('valA0'))g('valA0').textContent=a0_val.toFixed(2);
  if(g('valSpeed'))g('valSpeed').textContent=speedMultiplier.toFixed(1)+'\u00d7';
}

function makeEosRow(labelHtml, inputId, minVal, maxVal, stepVal, displayValue){
  const numInputId=inputId+'-input';
  // Strip HTML tags from label for aria text (e.g. 'A<sub>p</sub>' -> 'Ap')
  const plainLabel=labelHtml.replace(/<[^>]*>/g,'');
  return '<div class="slider-row"><label>'+labelHtml+'</label><div id="'+inputId+'-wrapper" class="number-input-group">' +
    '<input type="number" id="'+numInputId+'" class="wormhole-number-input" min="'+minVal+'" max="'+maxVal+'" step="'+stepVal+'" value="'+displayValue+'" aria-label="'+plainLabel+' parameter input">' +
    '<button type="button" class="spin-button spin-button-up" tabindex="0" aria-label="Increase '+plainLabel+' by one step"></button>' +
    '<button type="button" class="spin-button spin-button-down" tabindex="0" aria-label="Decrease '+plainLabel+' by one step"></button></div><input type="range" id="'+inputId+'" min="'+minVal+'" max="'+maxVal+'" step="'+stepVal+'" value="'+displayValue+'"></div>';
}

function updateEosParamsUI(){
  const container=document.getElementById('eosParams');
  let html='';

  // Ensure all EOS parameter defaults exist before rendering (prevents undefined errors on model switch)
  if(eosModel==='barotropic') eosParams.omega=eosParams.omega??-0.58;
  else if(eosModel==='phantom'){eosParams.Ap=eosParams.Ap??1;eosParams.alpha_p=eosParams.alpha_p??1;eosParams.n=eosParams.n??5;}
  else if(eosModel==='chaplygin'){eosParams.Ac=eosParams.Ac??2; eosParams.alpha_c=eosParams.alpha_c??1;}
  else if(eosModel==='cosmicChap'){eosParams.Agc=eosParams.Agc??2;eosParams.n_gc=eosParams.n_gc??3;}
  else if(eosModel==='modCosmicChap'){eosParams.Amcc=eosParams.Amcc??2;eosParams.m_mcc=eosParams.m_mcc??3;}

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

  // Wire up event listeners for dynamic EOS controls (mirrors static slider behavior)
  const rangeInputs = container.querySelectorAll('input[type="range"]');
  rangeInputs.forEach(sl => {
    sl.addEventListener('input', () => { scheduleReadParams(); if(simRunning) resetSim(); });
  });

  // Wire up number inputs and spin buttons for dynamic EOS controls
  const groupIds = container.querySelectorAll('[id$="-wrapper"]');
  groupIds.forEach(wrapper => {
    const sliderId = wrapper.id.replace('-wrapper', '');
    const numInput = document.getElementById(sliderId + '-input');
    if (!numInput) return;

    // Sync number input -> range slider (debounced, matching static slider behavior)
    const syncToSlider = () => {
      numInput.value = Math.round(parseFloat(numInput.value)*100)/100;
      const slider = document.getElementById(sliderId);
      if (slider) {
        // Update slider FIRST so readParams captures current values from DOM
        slider.value = numInput.value;
        scheduleReadParams();
        // Mark grid dirty if simulation is running — next getFPrimeInterp call will rebuild
        if (simRunning) setFPGridDirty();
      }
    };

    numInput.addEventListener('input', () => {
      let val = parseFloat(numInput.value);
      if (!isNaN(val)) {
        val = Math.max(parseFloat(numInput.min), Math.min(parseFloat(numInput.max), val));
        numInput.value = Math.round(val * 100) / 100;
        syncToSlider();
      }
    });

    // Spin buttons - mirror static slider behavior with debouncing
    const step = parseFloat(numInput.step || '0.01');

    [wrapper.querySelector('.spin-button-up'), wrapper.querySelector('.spin-button-down')].forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        let val = parseFloat(numInput.value);
        if (!isNaN(val)) {
          val += (idx === 0 ? 1 : -1) * step;
          val = Math.max(parseFloat(numInput.min), Math.min(parseFloat(numInput.max), val));
          numInput.value = Math.round(val * 100) / 100;
          syncToSlider();
        }
      });
    });

    // Keyboard support for spin buttons (Enter/Space) and arrow keys in number input
    [wrapper.querySelector('.spin-button-up'), wrapper.querySelector('.spin-button-down')].forEach((btn, idx) => {
      btn.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && numInput !== document.activeElement) {
          // Only handle on spin buttons when they have focus, not number input
          e.preventDefault();
          let val = parseFloat(numInput.value);
          if (!isNaN(val)) {
            val += (idx === 0 ? 1 : -1) * step;
            val = Math.max(parseFloat(numInput.min), Math.min(parseFloat(numInput.max), val));
            numInput.value = Math.round(val * 100) / 100;
            syncToSlider();
          }
        }
      });
    });

    numInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') { e.preventDefault(); wrapper.querySelector('.spin-button-up').click(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); wrapper.querySelector('.spin-button-down').click(); }
    });

    // Blur validation - restore slider value or clamp on invalid input
    numInput.addEventListener('blur', () => {
      let val = parseFloat(numInput.value);
      if (isNaN(val)) {
        const slider = document.getElementById(sliderId);
        if (slider) numInput.value = Math.round(parseFloat(slider.value)*100)/100;
      } else {
        val = Math.max(parseFloat(numInput.min), Math.min(parseFloat(numInput.max), val));
        numInput.value = Math.round(val * 100) / 100;
        syncToSlider();
      }
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

/** Initialize the simulation state with current parameters.
 * Called on every parameter change (via resetSim) and at startup. */
function initSim() {
  readParams();

  // Reset rate-limit counters so out-of-bounds warnings are visible in new sessions.
  resetWarnCounters();

  // Pre-compute F'(r) grid only for barotropic EOS (used in RK4 integration).
  if (eosModel === 'barotropic') {
    initFPGrid(M_val, A_val, r0_val);
  }

  var f_a0 = lapseF(a0_val, M_val, A_val, r0_val);
  if (f_a0 <= 0) return;

  // Read perturbation and initial velocity from UI.
  var deltaAPct = parseFloat(document.getElementById('sliderDeltaA')?.value || '0.01');
  if (document.getElementById('chkSmallPerturb').checked) {
    deltaAPct = 0.01;
  }

  v_current = parseFloat(document.getElementById('sliderV0')?.value || '-0.1');
  tau = 0;
  a_current = a0_val * (1 + deltaAPct / 100);
  timeHistory = [{tau: 0, a: a_current, v: v_current}];
  phaseHistory = [{a: a_current, v: v_current}];
  calibrated = true;
}

/** Reset the simulation — stops any running sim and re-initialises from current UI params. */
function resetSim() {
  simRunning = false;
  simPaused = false;
  readParams();
  initSim();
}

let lastTime=0;

export { readParams, updateEosParamsUI, updateHorizonInfo, calibrateAtA0, initSim, resetSim };
