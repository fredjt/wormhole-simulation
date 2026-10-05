// Simulation parameters (exposed as globals for cross-module access)
// Defaults follow arXiv:2610.00131 convention: M=1 geometric units,
// A=β=0.3 default curve strength, r₀/M=0.2 regularization scale.
export let M_val = 1.0;
export let A_val = 0.3;                          // β (string-cloud) from all paper figures
export let r0_val = 0.2;                        // μ regularizer: r₀/M = 0.2, Table I
export let a0_val = 2.5;                         // throat outside horizon for A=0.3 (r₊≈1.27)
export let delta_a_val = 0.01;
export let v0_val = -0.1;
export let speedMultiplier = 1.0;
export let eosModel = 'phantom';
// Phantom defaults: Ap calibrated at equilibrium; n=5 matches literature convention [46].
// Barotropic model default (omega: -0.3) — having it here prevents undefined physics
// calls when barotropic is selected outside the normal UI init flow.
// NOTE: eosParams persists across initSim() calls; it is updated by readParams()
//       when the user changes model or slider values (not reset on sim start).
export let eosParams = {Ap: 1, alpha_p: 1, n: 5, omega: -0.3};
export let calibrated = false;
export let simRunning = false;
export let simPaused = false;
export let autoStop = true;

// Current simulation state (overwritten by initSim on each start)
export let a_current = 2.5, v_current = -0.1;
export let tau = 0;
export let timeHistory = [];
export let phaseHistory = [];
const maxHistory = 2000;

function initSim(){
  const f_a0=lapseF(a0_val,M_val,A_val,r0_val);
  if(f_a0<=0)return;
  let deltaAPct=parseFloat(document.getElementById('sliderDeltaA').value);
  if(document.getElementById('chkSmallPerturb').checked)deltaAPct=0.01;
  v_current=parseFloat(document.getElementById('sliderV0').value);
  tau=0;
  a_current=a0_val*(1+deltaAPct/100);
  timeHistory=[{tau:0,a:a_current,v:v_current}];
  phaseHistory=[{a:a_current,v:v_current}];
  // NOTE: calibrated stays false until calibrateAtA0() is called.
  // The Play button guards against running un-calibrated sims by calling
  // calibrateAtA0() first on the initial click (see main.js line 53).
}

export { initSim };
