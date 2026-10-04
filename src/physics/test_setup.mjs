// Test setup: load all modules and expose globally for Node.js testing
import * as lapse from './lapse.js';
import * as potential from './potential.js';
import * as horizons from './horizons.js';
import * as sigma from './sigma.js';
import * as eos from './eos.js';

// Set global state variables (normally in state.js)
globalThis.M_val = 1.0;
globalThis.A_val = 0.3;
globalThis.r0_val = 0.5;
globalThis.a0_val = 2.0;
globalThis.eosModel = 'barotropic';
globalThis.eosParams = {omega: -0.5};

// Expose globally so the modules can use them (matching browser behavior)
globalThis.lapseF = lapse.lapseF;
globalThis.lapseFPrime = lapse.lapseFPrime;
globalThis.lapseFDblPrime = lapse.lapseFDblPrime;
globalThis.destroyFPGrid = lapse.destroyFPGrid;
globalThis.resetWarnCounters = lapse.resetWarnCounters;
globalThis.effPot = potential.effPot;
globalThis.effPotPrime = potential.effPotPrime;
globalThis.effPotD2 = potential.effPotD2;
globalThis.effPotPrimeBarotropicFast = potential.effPotPrimeBarotropicFast;
globalThis.effPotPrimeBarotropic = potential.effPotPrimeBarotropicNumerical;

globalThis.calibrateOmega = potential.calibrateOmega;
globalThis.barotropicVpp = potential.barotropicVpp;
globalThis.calibratePhantomParams = potential.calibratePhantomParams;
globalThis.phantomVpp = potential.phantomVpp;
globalThis.calibrateChaplyginParams = potential.calibrateChaplyginParams;
globalThis.calibrateCosmicChap = potential.calibrateCosmicChap;
globalThis.calibrateModCosmicChap = potential.calibrateModCosmicChap;
globalThis.findHorizons = horizons.findHorizons;
globalThis.surfaceSigma = sigma.surfaceSigma;
globalThis.tangentialPressure = eos.tangentialPressure;
globalThis.computeSigmaFromEOS = eos.computeSigmaFromEOS;

// Also export for direct import in test file
export { lapse, potential, horizons, sigma, eos };
