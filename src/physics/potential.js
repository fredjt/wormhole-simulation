// Import getFPrimeInterp from lapse module
import { getFPrimeInterp, lapseFPrime } from './lapse.js';
import { computeSigmaFromEOS } from './eos.js';
// Unified Vpp computation — single source of truth for stability determination.
// Uses numerical second derivative of the effective potential via central differences,
// which correctly accounts for how sigma changes when 'a' is perturbed (including
// EOS-model-specific behavior in computeSigmaFromEOS).
function computeVpp(a0_val_param) {
  const f = lapseF(a0_val_param, M_val, A_val, r0_val);
  // Guard against invalid inputs: non-positive throat radius or non-finite lapse.
  if (!isFinite(f) || a0_val_param <= 0)
    return NaN;
  // σ must be negative for exotic matter (thin-shell wormhole convention).
  const s0 = -Math.sqrt(Math.abs(f)) / (2 * Math.PI * a0_val_param);
  return effPotD2(a0_val_param, a0_val_param, s0, eosModel, eosParams);
}

// Optimized Vpp: use analytical formula for barotropic EOS when available,
// otherwise fall back to unified numerical approach. This avoids the performance
// regression of evaluating hypergeometric functions 3x per frame for a closed-form result.
function computeVppOptimized() {
  if (eosModel === 'barotropic') return barotropicVpp(a0_val, M_val, A_val, r0_val);
  return computeVpp(a0_val);
}

// Effective potential and stability analysis for thin-shell wormholes
// Based on arXiv:2610.00131 (Zhong et al.)

function effPot(a, a0, s0, model, params) {
  const f = lapseF(a, M_val, A_val, r0_val);
  const s = computeSigmaFromEOS(a, a0, s0, model, params);
  return f - 4 * Math.PI * Math.PI * a * a * s * s;
}

function effPotPrime(a, a0, s0, model, params) {
  const h = 1e-6;
  return (effPot(a + h, a0, s0, model, params) - effPot(a - h, a0, s0, model, params)) / (2 * h);
}

function effPotD2(a, a0, s0, model, params) {
  const h = 1e-5;
  return (effPot(a + h, a0, s0, model, params) - 2 * effPot(a, a0, s0, model, params) + effPot(a - h, a0, s0, model, params)) / (h * h);
}

// Barotropic calibration: ω = -(a₀F' + 2F)/(4F)  [Eq. B.4]
function calibrateOmega(a0, M, A, r0) {
  const f = lapseF(a0, M, A, r0);
  if (f <= 0) return NaN;
  const fp = lapseFPrime(a0, M, A, r0);
  // Paper Eq. B.4: w_B = -(a_0 F'_0 + 2 F_0) / (4 F_0)
  return -(a0 * fp + 2 * f) / (4 * f);
}

// Barotropic V'': V''_B = F'' + F'/a₀ - (F')²/F  [Eq. B.6]
function barotropicVpp(a0, M, A, r0) {
  const f = lapseF(a0, M, A, r0);
  if (f <= 0) return NaN;
  const fp = lapseFPrime(a0, M, A, r0);
  const fpp = lapseFDblPrime(a0, M, A, r0);
  return fpp + fp / a0 - (fp * fp) / f;
}

// Phantom calibration: Solve V'(a₀)=0 for Ap
function calibratePhantomParams(a0, M, A, r0, params) {
  const f = lapseF(a0, M, A, r0);
  if (f <= 0) return NaN;
  const fp = lapseFPrime(a0, M, A, r0);
  const sigma0 = -Math.sqrt(f) / (2 * Math.PI * a0);
  // From V'(a₀) = F' + 8π²a₀σ₀²(2w_eq + 1) = 0:
  // w_eq = [-F'/(8π²a₀σ₀²) - 1]/2, Ap = w_eq/(-2-w_eq)
  const w_eq = (-fp / (8 * Math.PI * Math.PI * a0 * sigma0 * sigma0) - 1) / 2;
  return w_eq / (-2 - w_eq);
}

// Phantom V'': Numerical second derivative of effective potential
function phantomVpp(a0, M, A, r0, params) {
  const s0 = -Math.sqrt(Math.max(lapseF(a0, M, A, r0), 0)) / (2 * Math.PI * a0);
  // Use numerical second derivative for accuracy with variable EOS
  const h = 1e-5;
  const Vpp = (effPot(a0 + h, a0, s0, 'phantom', params)
             - 2 * effPot(a0, a0, s0, 'phantom', params)
             + effPot(a0 - h, a0, s0, 'phantom', params)) / (h * h);
  return Vpp;
}

// Variable Chaplygin: numerical calibration for Ac
function calibrateChaplyginParams(a0, M, A, r0) {
  const f = lapseF(a0, M, A, r0);
  if (f <= 0) return NaN;
  const s0 = -Math.sqrt(f) / (2 * Math.PI * a0);
  // Search for Ac that makes V'(a₀) ≈ 0
  let bestAc = 1, bestErr = 1e9;
  for (let Ac = 0.01; Ac <= 50; Ac += 0.01) {
    const Vp = Math.abs(effPotPrime(a0, a0, s0, 'chaplygin', { Ac, alpha_c: 0.5 }));
    if (Vp < bestErr) {
      bestErr = Vp;
      bestAc = Ac;
    }
  }
  return bestAc;
}

// Generalized Cosmic Chaplygin: numerical calibration for Agc
function calibrateCosmicChap(a0, M, A, r0) {
  const f = lapseF(a0, M, A, r0);
  if (f <= 0) return NaN;
  const s0 = -Math.sqrt(f) / (2 * Math.PI * a0);
  let bestAgc = 1, bestErr = 1e9;
  for (let Agc = 0.01; Agc <= 50; Agc += 0.01) {
    const Vp = Math.abs(effPotPrime(a0, a0, s0, 'cosmicChap', { Agc, n_gc: 2 }));
    if (Vp < bestErr) {
      bestErr = Vp;
      bestAgc = Agc;
    }
  }
  return bestAgc;
}

// Modified Cosmic Chaplygin: numerical calibration for Amcc
function calibrateModCosmicChap(a0, M, A, r0) {
  const f = lapseF(a0, M, A, r0);
  if (f <= 0) return NaN;
  const s0 = -Math.sqrt(f) / (2 * Math.PI * a0);
  let bestAmcc = 1, bestErr = 1e9;
  for (let Amcc = 0.01; Amcc <= 50; Amcc += 0.01) {
    const Vp = Math.abs(effPotPrime(a0, a0, s0, 'modCosmicChap', { Amcc, m_mcc: 2 }));
    if (Vp < bestErr) {
      bestErr = Vp;
      bestAmcc = Amcc;
    }
  }
  return bestAmcc;
}

/** Resolve (M, A, r₀): explicit parameters override module-level globals. */
function resolveParams(mIn, aIn, r0In) {
  return { M: mIn ?? M_val, A: aIn ?? A_val, r0: r0In ?? r0_val };
}

/** Compute σ²(a) = σ₀² · (a/a₀)^(-n_σ) for barotropic EOS where n_σ = 2(1+ω).
 * Shared helper to avoid duplication between the Fast and Accurate variants. */
function _barotropicSigmaSq(a, a0, s0, omega) {
  const n_sigma = 2.0 * (1.0 + omega);
  return (s0 * s0) * Math.pow(a / a0, -n_sigma);
}

/** Accurate first derivative for barotropic EOS — uses central-difference FD via lapseFPrime.
 * Used for calibration and stability analysis. Slower than the Fast variant but more accurate.
 *
 * V'(a) = F'(a) + 4π²·n_σ · a · σ₀²(a/a₀)^{-n_σ}   where n_σ = 2(1+ω)
 * Derived from: d/da [F - 4π² a² σ²] with σ ∝ a^{-n_σ}
 *
 * Eq. references:
 *   • ArXiv:2610.00131 §B — barotropic EOS derivation
 *   • n_σ = 2(1+ω) follows from energy conservation for p = ωρ
 *
 * ⚠️ Barotropic-only: This function implements the analytical shortcut derived specifically
 * for the barotropic EOS model. It should NOT be called with phantom, chaplygin, or other
 * EOS models — those require the general effPot()/effPotPrime() path which correctly
 * dispatches through computeSigmaFromEOS.
 *
 * Accepts explicit (M, A, r₀) parameters with fallback to module-level globals.
 * @param {number} a - Current scale factor
 * @param {number} a0 - Equilibrium scale factor
 * @param {number} s0 - Surface tension at equilibrium
 * @param {number} omega - EOS parameter
 * @param {number} [M] - Black hole mass (falls back to M_val if omitted)
 * @param {number} [A] - String tension parameter (falls back to A_val if omitted)
 * @param {number} [r0] - Scale factor parameter (falls back to r0_val if omitted)
 * @returns {number} First derivative of effective potential */
function effPotPrimeBarotropicAccurate(a, a0, s0, omega, M_in, A_in, r0_in) {
  var p = resolveParams(M_in, A_in, r0_in);
  return lapseFPrime(a, p.M, p.A, p.r0) +
         2.0 * Math.PI * Math.PI * 2.0 * (1.0 + omega) * a * _barotropicSigmaSq(a, a0, s0, omega);
}

/** Fast first derivative for barotropic EOS — uses precomputed F' grid interpolation.
 * Used during RK4 integration for performance (arXiv:2610.00131 §B).
 *
 * V'(a) = F'_interp(a) + 4π²·n_σ · a · σ₀²(a/a₀)^{-n_σ}   where n_σ = 2(1+ω)
 * The grid-interpolated F' replaces the expensive hypergeom call per RK4 substep.
 *
 * Eq. references:
 *   • Same derivation as effPotPrimeBarotropicAccurate — see its docstring.
 *
 * Accepts explicit (M, A, r₀) parameters with fallback to module-level globals.
 * @param {number} a - Current scale factor
 * @param {number} a0 - Equilibrium scale factor
 * @param {number} s0 - Surface tension at equilibrium
 * @param {number} omega - EOS parameter
 * @param {number} [M] - Black hole mass (falls back to M_val if omitted)
 * @param {number} [A] - String tension parameter (falls back to A_val if omitted)
 * @param {number} [r0] - Scale factor parameter (falls back to r0_val if omitted)
 * @returns {number} First derivative of effective potential */
function effPotPrimeBarotropicFast(a, a0, s0, omega, M_in, A_in, r0_in) {
  var p = resolveParams(M_in, A_in, r0_in);
  return getFPrimeInterp(a, p.M, p.A, p.r0) +
         2.0 * Math.PI * Math.PI * 2.0 * (1.0 + omega) * a * _barotropicSigmaSq(a, a0, s0, omega);
}

// Export list:
// barotropicVpp and phantomVpp remain exported for analytical reference and test coverage.
export { computeVpp, computeVppOptimized,
         effPot, effPotPrime, effPotD2,
         calibrateOmega, barotropicVpp,
         calibratePhantomParams, phantomVpp,
         calibrateChaplyginParams,
         calibrateCosmicChap, calibrateModCosmicChap,
         effPotPrimeBarotropicFast, effPotPrimeBarotropicAccurate };
