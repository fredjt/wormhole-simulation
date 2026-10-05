/** @module calibration — UI parameter reading and EOS model selector helpers. */

// Single source of truth for EOS defaults (see state.js). Needed by both readParams safeParse fallbacks
// and updateEosParamsUI slider initialization so a single constant map drives display + physics logic.
import * as state from '../simulation/state.js';

function readParams(){
  const g=id=>document.getElementById(id);

  // Safe-parse fallbacks match paper defaults: M=1, A=β=0.3,
  // r₀/M = 0.2 → r₀=0.2; throat outside horizon (r₊≈1.27 for A=0.3) → a₀≈2.5.
  M_val   = parseFloat(g('sliderM')?.value || '1');
  A_val   = parseFloat(g('sliderA')?.value || '0.3');
  r0_val  = parseFloat(g('sliderR0')?.value || '0.2');
  a0_val  = parseFloat(g('sliderA0')?.value || '2.5');
  eosModel=g('eosSelect').value;
  speedMultiplier=parseFloat(g('sliderSpeed')?.value||'1.0');
  autoStop=g('chkAutoStop')?.checked||false;

  // Helper: safely parse slider value with fallback default (avoids NaN propagation)
  const safeParse = (id, def) => {
    const el = g(id);
    if (!el || isNaN(parseFloat(el.value))) return def; // use explicit default directly
    return parseFloat(el.value);
  };

  // Default values per EOS model. These are used as safe-parse fallbacks when
  // DOM elements are unavailable (unit tests, rapid switching). All default constants
  // come from the single source of truth in state.js to avoid duplication.
  const defaults = state.EOS_DEFAULTS[eosModel];
  switch(eosModel){
    case 'barotropic': eosParams.omega = safeParse('sliderOmega', defaults?.omega ?? -0.3); break;
    case 'phantom':
      eosParams.Ap     = safeParse('sliderAp', defaults?.Ap ?? 1);
      eosParams.alpha_p = safeParse('sliderAlphaP', defaults?.alpha_p ?? 1);
      eosParams.n       = safeParse('sliderN', defaults?.n ?? 5); break;
    case 'chaplygin':
      eosParams.Ac     = safeParse('sliderAc', defaults?.Ac ?? 2);
      eosParams.alpha_c = safeParse('sliderAlphaC', defaults?.alpha_c ?? 0.5); break;
    case 'cosmicChap':
      eosParams.Agc   = safeParse('sliderAgc', defaults?.Agc ?? 2);
      eosParams.n_gc  = safeParse('sliderNgc', defaults?.n_gc ?? 3); break;
    case 'modCosmicChap':
      eosParams.Amcc   = safeParse('sliderAmcc', defaults?.Amcc ?? 2);
      eosParams.m_mcc  = safeParse('sliderMmcc', defaults?.m_mcc ?? 3); break;
    default:
      console.warn(`Unknown eosModel "${eosModel}" in readParams — using barotropic as fallback.`);
      Object.assign(eosParams, state.EOS_DEFAULTS.barotropic);
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
  // Reset all EOS parameters to paper-consistent defaults before creating sliders.
  // This ensures newly-created slider elements display sensible starting points for
  // the selected model type, regardless of what stale values happen to be in eosParams
  // from a previously-calibrated (different) model. See PR discussion on fluid-model
  // selector: when simRunning && user changes EOS, updateEosParamsUI() → resetSim()
  // reads back slider DOM; sliders must already hold correct defaults.
  const uDefaults = state.EOS_DEFAULTS[eosModel];
  if (uDefaults) {
    eosParams = {};                       // clear stale properties from previous model (Finding 1)
    Object.assign(eosParams, uDefaults);   // write new defaults atomically
  } else {
    console.warn(`Unknown eosModel "${eosModel}" in updateEosParamsUI — using barotropic as fallback.`);
    eosParams = {};                       // clear stale properties even on unknown model
    Object.assign(eosParams, state.EOS_DEFAULTS.barotropic);
  }

  const container=document.getElementById('eosParams');
  let html='';

  // Display values for freshly-created sliders mirror the safeParse defaults above.
  switch(eosModel){
    case 'barotropic': html += makeEosRow('&omega;', 'sliderOmega', '-1.5', '0', '0.01', eosParams.omega.toFixed(2)); break;
    case 'phantom':
      html += makeEosRow('A<sub>p</sub>', 'sliderAp', '0', '5', '0.1', eosParams.Ap.toFixed(2)) +
             makeEosRow('&alpha;<sub>p</sub>', 'sliderAlphaP', '0', '3', '0.1', eosParams.alpha_p.toFixed(2)) +
             makeEosRow('n', 'sliderN', '1', '10', '0.5', eosParams.n.toFixed(1)); break;
    case 'chaplygin':
      html += makeEosRow('A<sub>c</sub>', 'sliderAc', '0.1', '10', '0.1', eosParams.Ac.toFixed(2)) +
              makeEosRow('&alpha;<sub>c</sub>', 'sliderAlphaC', '0.1', '3', '0.1', eosParams.alpha_c.toFixed(2)); break;
    case 'cosmicChap':
      html += makeEosRow('A<sub>gc</sub>', 'sliderAgc', '0.1', '10', '0.1', eosParams.Agc.toFixed(2)) +
              makeEosRow('n<sub>gc</sub>', 'sliderNgc', '1', '5', '0.1', eosParams.n_gc.toFixed(2)); break;
    case 'modCosmicChap':
      html += makeEosRow('A<sub>mcc</sub>', 'sliderAmcc', '0.1', '10', '0.1', eosParams.Amcc.toFixed(2)) +
              makeEosRow('m<sub>mcc</sub>', 'sliderMmcc', '1', '5', '0.1', eosParams.m_mcc.toFixed(2)); break;
    default:
      console.warn(`Unknown eosModel "${eosModel}" in updateEosParamsUI — rendering empty slider container.`);
  }
  container.innerHTML=html;
  const rangeInputs = container.querySelectorAll('input[type="range"]');
  rangeInputs.forEach(sl => {
    sl.addEventListener('input', () => { scheduleReadParams(); if(simRunning) resetSim(); });
  });
  const groupIds = container.querySelectorAll('[id$="-wrapper"]');
  groupIds.forEach(wrapper => {
    const sliderId = wrapper.id.replace('-wrapper', '');
    const numInput = document.getElementById(sliderId + '-input');
    if (!numInput) return;
    const syncToSlider = () => {
      numInput.value = Math.round(parseFloat(numInput.value)*100)/100;
      const slider = document.getElementById(sliderId);
      if (slider) {
        slider.value = numInput.value;
        scheduleReadParams();
        if (simRunning) resetSim();
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
    [wrapper.querySelector('.spin-button-up'), wrapper.querySelector('.spin-button-down')].forEach((btn, idx) => {
      btn.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && numInput !== document.activeElement) {
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
  resetWarnCounters();
  if (eosModel === 'barotropic') {
    initFPGrid(M_val, A_val, r0_val);
  }
  var f_a0 = lapseF(a0_val, M_val, A_val, r0_val);
  if (f_a0 <= 0) return;
  var deltaAPct = parseFloat(document.getElementById('sliderDeltaA')?.value || '0.01');
  if (document.getElementById('chkSmallPerturb').checked) {
    deltaAPct = 0.01;
  }
  v_current = parseFloat(document.getElementById('sliderV0')?.value || '-0.1');
  tau = 0;
  a_current = a0_val * (1 + deltaAPct / 100);
  timeHistory = [{tau: 0, a: a_current, v: v_current}];
  phaseHistory = [{a: a_current, v: v_current}];
  // NOTE: calibrated stays false until calibrateAtA0() is called.
  // The Play button guards against running un-calibrated sims by calling
  // calibrateAtA0() first on the initial click (see main.js line 53).
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
