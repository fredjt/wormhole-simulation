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
/** @type {{ [key: string]: number }} — Union of all EOS model defaults at module load.
 * Cleared and repopulated with only the active model's keys by updateEosParamsUI() before first use,
 * so this pre-population is purely for defensive safety (prevents undefined on early key access). */
// NOTE: All EOS models must have disjoint parameter keys — if two future models share a name (e.g., both
// define 'n'), duplicate detection fires console.error at module load. Adding new EOS types is now
// Validate that all EOS models have disjoint parameter keys — catch silent overwrites early.
let duplicateKeyFound = false;
const _allDefaults = {};
for (const [modelName, params] of Object.entries(EOS_DEFAULTS)) {
    for (const key of Object.keys(params)) {
        if (key in _allDefaults) {
            console.error(`Duplicate EOS parameter "${key}" — defined in multiple models. ` +
                `Check state.EOS_DEFAULTS: ${modelName} conflicts with existing model.`);
            duplicateKeyFound = true;
        }
    }
    Object.assign(_allDefaults, params);
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

// Initialize the simulation state from current parameters.
// @param {Object} [opts] — optional configuration
//   skipReadParams: if true, assume globals are already populated (e.g., by readParams).
//                    Use false for UI-triggered resets where fresh DOM values must be read first.
export function initSim({skipReadParams = false} = {}) {
  // Skip redundant reads during startup when main.js has just called readParams().
  if (!skipReadParams) { window.readParams(); }
  const f_a0=lapseF(a0_val,M_val,A_val,r0_val);
  if(f_a0<=0)return;
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
