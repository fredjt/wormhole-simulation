// Simulation parameters (exposed as globals for cross-module access)
export let M_val = 1.0, beta_val = 0.0, mu_val = 0.5;
export let a0_val = 2.5, delta_a_val = 0.01, v0_val = -0.1;
export let speedMultiplier = 1.0;
export let eosModel = 'chaplygin';
export let eosParams = {Ac: 2, alpha_c: 1};
export let calibrated = true;
export let simRunning = false;
export let simPaused = false;
export let autoStop = true;

// Current simulation state
export let a_current = 2.5, v_current = -0.1;
export let tau = 0;
export let timeHistory = [];
export let phaseHistory = [];
const maxHistory = 2000;

function initSim(){
  const f_a0=lapseF(a0_val,M_val,beta_val,mu_val);
  if(f_a0<=0)return;
  let deltaAPct=parseFloat(document.getElementById('sliderDeltaA').value);
  if(document.getElementById('chkSmallPerturb').checked)deltaAPct=0.01;
  v_current=parseFloat(document.getElementById('sliderV0').value);
  tau=0;
  a_current=a0_val*(1+deltaAPct/100);
  timeHistory=[{tau:0,a:a_current,v:v_current}];
  phaseHistory=[{a:a_current,v:v_current}];
  calibrated=true;
}

export { initSim };
