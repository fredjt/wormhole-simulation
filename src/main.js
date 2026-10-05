// Import all modules (exposes functions as globals for cross-module calls)
import * as lapse from './physics/lapse.js';
import * as horizons from './physics/horizons.js';
import * as sigma from './physics/sigma.js';
import * as eos from './physics/eos.js';
import * as potential from './physics/potential.js';
import * as integrator from './simulation/integrator.js';
import * as state from './simulation/state.js';
import * as threejs from './visualization/threejs.js';
import * as canvas from './visualization/canvas.js';
import * as rendering from './visualization/rendering.js';
import * as ui from './ui/calibration.js';

// Expose all functions as globals (maintains existing cross-module behavior)
Object.assign(window, lapse);
Object.assign(window, horizons);
Object.assign(window, sigma);
Object.assign(window, eos);
Object.assign(window, potential);
Object.assign(window, integrator);
Object.assign(window, state);
Object.assign(window, threejs);
Object.assign(window, canvas);
Object.assign(window, rendering);
Object.assign(window, ui);

// Global simulation state is exported from state.js and exposed via Object.assign(window, state)
// See src/simulation/state.js for all declarations

function init() {
  threejs.initThreeJS();
  
  // Wire up all slider inputs
  ['sliderM','sliderA','sliderR0','sliderA0','sliderDeltaA','sliderV0','sliderSpeed'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      ui.readParams();
      ui.updateHorizonInfo();
      if (simRunning) ui.resetSim();
    });
  });


  document.getElementById('eosSelect').addEventListener('change', () => {
    const newModel = document.getElementById('eosSelect').value;

    // Determine the actual model — if unknown, fall back to barotropic.
    const actualModel = state.EOS_DEFAULTS[newModel] ? newModel : 'barotropic';

    if (newModel !== actualModel) {
      console.warn(`Unknown EOS model "${newModel}" — using barotropic as fallback.`);
    }

    // Set global eosModel FIRST, before any downstream function reads it.
    // updateEosParamsUI() and resetSim() both read state.eosModel to select defaults;
    // setting this after would cause them to use stale values from the OLD model.
    eosModel = actualModel;

    Object.keys(eosParams).forEach(k => delete eosParams[k]);  // clear stale keys from previous model
    Object.assign(eosParams, state.EOS_DEFAULTS[actualModel]);   // assign new defaults for correct model

    calibrated = false;
    ui.updateEosParamsUI();         // reads EOS_DEFAULTS[eosModel] → now correct ✅
    if (simRunning) ui.resetSim();  // readParams/initSim with clean params for actualModel ✅
  });

  
  // Buttons
  document.getElementById('btnCalibrate').addEventListener('click', ui.calibrateAtA0);
  document.getElementById('btnPlay').addEventListener('click', () => {
    if (!calibrated) ui.calibrateAtA0();
    simRunning = true;
    simPaused = false;
  });
  document.getElementById('btnPause').addEventListener('click', () => {
    simPaused = !simPaused;
  });
  document.getElementById('btnReset').addEventListener('click', ui.resetSim);
  
  // Initialize
  ui.readParams();
  ui.updateHorizonInfo();
  ui.updateEosParamsUI();
  state.initSim();
  requestAnimationFrame(integrator.mainLoop);
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  // Setup help button
var helpBtn = document.getElementById("helpBtn");
var helpModal = document.getElementById("helpModal");
if (helpBtn && helpModal) {
  helpModal.style.display = "none";
  helpBtn.addEventListener("click", function() {
    helpModal.classList.add("active");
  });
}

document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
