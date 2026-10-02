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

// Phantom calibration: Ap = -(a₀ⁿ(a₀F' + 2F))/(4F)  [Eq. B.11]
function calibratePhantomParams(a0, M, A, r0) {
  const f = lapseF(a0, M, A, r0);
  if (f <= 0) return NaN;
  const fp = lapseFPrime(a0, M, A, r0);
  const n = params.n || 1; // default n=1 for phantom
  return -(Math.pow(a0, n) * (a0 * fp + 2 * f)) / (4 * f);
}

// Phantom V'': V''_P = F'' + F'/a₀ - (F')²/F + n(a₀F' + 2F)/a₀²  [Eq. B.13]
function phantomVpp(a0, M, A, r0, n) {
  const f = lapseF(a0, M, A, r0);
  if (f <= 0) return NaN;
  const fp = lapseFPrime(a0, M, A, r0);
  const fpp = lapseFDblPrime(a0, M, A, r0);
  return fpp + fp / a0 - (fp * fp) / f + n * (a0 * fp + 2 * f) / (a0 * a0);
}

// Variable Chaplygin: numerical calibration for Ac
function calibrateChaplyginParams(a0, M, A, r0) {
  const f = lapseF(a0, M, A, r0);
  if (f <= 0) return NaN;
  const s0 = -Math.sqrt(f) / (2 * Math.PI * a0);
  // Search for Ac that makes V'(a₀) ≈ 0 and V''(a₀) > 0
  let bestAc = 1, bestErr = 1e9, bestVpp = -Infinity;
  for (let Ac = 0.1; Ac <= 20; Ac += 0.05) {
    const Vp = Math.abs(effPotPrime(a0, a0, s0, 'chaplygin', { Ac, alpha_c: 0.5 }));
    const Vpp = effPotD2(a0, a0, s0, 'chaplygin', { Ac, alpha_c: 0.5 });
    if (Vp < bestErr * 10 && Vpp > bestVpp) {
      bestErr = Vp;
      bestAc = Ac;
      bestVpp = Vpp;
    }
  }
  return bestAc;
}

// Generalized Cosmic Chaplygin: numerical calibration for Agc
function calibrateCosmicChap(a0, M, A, r0) {
  const f = lapseF(a0, M, A, r0);
  if (f <= 0) return NaN;
  const s0 = -Math.sqrt(f) / (2 * Math.PI * a0);
  let bestAgc = 1, bestErr = 1e9, bestVpp = -Infinity;
  for (let Agc = 0.1; Agc <= 20; Agc += 0.05) {
    const Vp = Math.abs(effPotPrime(a0, a0, s0, 'cosmicChap', { Agc, n_gc: 2 }));
    const Vpp = effPotD2(a0, a0, s0, 'cosmicChap', { Agc, n_gc: 2 });
    if (Vp < bestErr * 10 && Vpp > bestVpp) {
      bestErr = Vp;
      bestAgc = Agc;
      bestVpp = Vpp;
    }
  }
  return bestAgc;
}

// Modified Cosmic Chaplygin: numerical calibration for Amcc
function calibrateModCosmicChap(a0, M, A, r0) {
  const f = lapseF(a0, M, A, r0);
  if (f <= 0) return NaN;
  const s0 = -Math.sqrt(f) / (2 * Math.PI * a0);
  let bestAmcc = 1, bestErr = 1e9, bestVpp = -Infinity;
  for (let Amcc = 0.1; Amcc <= 20; Amcc += 0.05) {
    const Vp = Math.abs(effPotPrime(a0, a0, s0, 'modCosmicChap', { Amcc, m_mcc: 2 }));
    const Vpp = effPotD2(a0, a0, s0, 'modCosmicChap', { Amcc, m_mcc: 2 });
    if (Vp < bestErr * 10 && Vpp > bestVpp) {
      bestErr = Vp;
      bestAmcc = Amcc;
      bestVpp = Vpp;
    }
  }
  return bestAmcc;
}

export { effPot, effPotPrime, effPotD2, calibrateOmega, barotropicVpp, 
         calibratePhantomParams, phantomVpp, calibrateChaplyginParams,
         calibrateCosmicChap, calibrateModCosmicChap };
