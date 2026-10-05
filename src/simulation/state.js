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
// Single source of truth for EOS parameter defaults per arXiv:2610.00131.
// All three consumers — readParams safeParse fallbacks, updateEosParamsUI
// initial slider values, and the global eosParams object itself — reference
// this map so a single edit never diverges display from physics logic.
export const EOS_DEFAULTS = {
  barotropic:   { omega: -0.3 },
  phantom:      { Ap: 1, alpha_p: 1, n: 5 },
  chaplygin:    { Ac: 2, alpha_c: 0.5 },
  cosmicChap:   { Agc: 2, n_gc: 3 },
  modCosmicChap:{ Amcc: 2, m_mcc: 3 }
};
export let eosModel = 'phantom';
// NOTE: eosParams persists across initSim() calls; it is updated by readParams()
//       when the user changes model or slider values (not reset on sim start).
// Pre-populate with the union of all model defaults so that any key access during early initialization
// returns a number rather than undefined. This restores the previous defensive posture at zero runtime cost.
// NOTE: All EOS models must have disjoint parameter keys — if two future models share a name (e.g., both
// define 'n'), Object.assign silently overwrites earlier values with no warning. Adding new EOS types is now
// a multi-touch change across state.js, calibration.js (readParams + updateEosParamsUI switches), and main.js.
const _allDefaults = {};
for (const md of Object.values(EOS_DEFAULTS)) {
    Object.assign(_allDefaults, md);
}
export let eosParams = { ..._allDefaults };
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

// ⚠️ DO NOT modify this version without updating the copy in calibration.js —
// both must stay in sync. If a new parameter or state field is added here,
// ensure it's also handled in `ui/calibration.js:initSim()` (which has extra
// setup: readParams() call, warn counter reset, FP grid init for barotropic).
function initSim(){
  const f_a0=lapseF(a0_val,M_val,A_val,r0_val);
  if(f_a0<=0)return;
  // Use optional chaining + defaults for safety in unit tests / non-DOM environments
let deltaAPct=parseFloat(document.getElementById('sliderDeltaA')?.value ?? '0.01');
if(document.getElementById('chkSmallPerturb')?.checked)deltaAPct=0.01;
v_current=parseFloat(document.getElementById('sliderV0')?.value ?? '-0.1');
  tau=0;
  a_current=a0_val*(1+deltaAPct/100);
  timeHistory=[{tau:0,a:a_current,v:v_current}];
  phaseHistory=[{a:a_current,v:v_current}];
  // NOTE: calibrated stays false until calibrateAtA0() is called.
  // The Play button guards against running un-calibrated sims by calling
  // calibrateAtA0() first on the initial click (see main.js line 53).
}

export { initSim };
