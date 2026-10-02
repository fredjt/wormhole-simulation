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

// Global simulation state (currently shared across modules)
let M_val = 1.0, beta_val = 0.0, mu_val = 1.0;
let a0_val = 2.5, delta_a_val = 0.01, v0_val = -0.1;
let speedMultiplier = 1.0;
let eosModel = 'barotropic';
let params = {};
let calibrated = false;
let simRunning = false;
let simPaused = false;

// Current simulation state
let a_current = 2.5, v_current = -0.1;
let timeHistory = [];
let aHistory = [];
let vHistory = [];
const maxHistory = 2000;

function init() {
  threejs.initThreeJS();
  
  // Wire up all slider inputs
  ['sliderM','sliderBeta','sliderMu','sliderA0','sliderDeltaA','sliderV0','sliderSpeed'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      ui.readParams();
      ui.updateHorizonInfo();
      if (simRunning) ui.resetSim();
    });
  });
  
  // EOS model selector
  document.getElementById('eosSelect').addEventListener('change', () => {
    eosModel = document.getElementById('eosSelect').value;
    calibrated = false;
    ui.updateEosParamsUI();
    if (simRunning) ui.resetSim();
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
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
