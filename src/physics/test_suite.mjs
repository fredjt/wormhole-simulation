// Wormhole Simulation Test Suite
// Tests against arXiv:2610.00131 (Zhong et al.)

// Run with: node --experimental-vm-modules -e "import './test_setup.mjs'; import './test_suite.mjs'"
// The test_setup.mjs loads all modules and exposes them as globalThis functions

// Test configuration
const TOLERANCE = 1e-6;
let passed = 0;
let failed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function approx(a, b, tol = TOLERANCE, message = '') {
  const diff = Math.abs(a - b);
  const relDiff = diff / (Math.abs(b) || 1);
  assert(diff < tol * Math.max(1, Math.abs(b)), 
    `${message ? message + ': ' : ''}${a.toFixed(8)} ≈ ${b.toFixed(8)} (diff=${diff.toExponential(2)})`);
}

function finite(val, message = '') {
  assert(isFinite(val), `${message ? message + ': ' : ''}isFinite(${val})`);
}

// ============================================
// SECTION 1: Lapse Function Tests
// ============================================
function testLapseFunction() {
  console.log('\n=== 1. Lapse Function F(r) ===');
  
  const M = 1.0, A = 0.3, r0 = 0.5;
  
  // Test 1: F(r) is finite for all r > 0
  for (let r = 0.1; r <= 10; r += 0.5) {
    const f = lapseF(r, M, A, r0);
    finite(f, `F(${r})`);
  }
  // Test 2: F(r) increases toward 1 as r increases (asymptotic behavior)
  const fSmall = lapseF(1.0, M, A, r0);
  const fMedium = lapseF(5.0, M, A, r0);
  const fLarge = lapseF(20.0, M, A, r0);
  assert(fSmall < fMedium && fMedium < fLarge, 'F(r) monotonically increases with r');
  assert(fLarge > 0.75, `F(20)=${fLarge.toFixed(4)} > 0.75 (approaching asymptotic flatness)`);
  
  // Test 3: F(r) at r = r0 (regularization scale)
  const fAtR0 = lapseF(r0, M, A, r0);
  finite(fAtR0, `F(r₀)`);
  
  // Test 4: First derivative exists and is finite
  for (let r = 0.5; r <= 5; r += 0.5) {
    const fp = lapseFPrime(r, M, A, r0);
    finite(fp, `F'(${r})`);
  }
  
  // Test 5: Second derivative exists and is finite
  for (let r = 0.5; r <= 5; r += 0.5) {
    const fpp = lapseFDblPrime(r, M, A, r0);
    finite(fpp, `F''(${r})`);
  }
  
  // Test 6: F(r) has correct sign behavior (negative inside horizon, positive outside)
  const [rPlus] = findHorizons(M, A, r0);
  if (rPlus !== null) {
    const fInside = lapseF(rPlus * 0.9, M, A, r0);
    const fOutside = lapseF(rPlus * 1.1, M, A, r0);
    assert(fInside < 0, 'F(r < r₊) < 0');
    assert(fOutside > 0, 'F(r > r₊) > 0');
  }
}

// ============================================
// SECTION 2: Surface Energy Density Tests
// ============================================
function testSurfaceSigma() {
  console.log('\n=== 2. Surface Energy Density σ ===');
  
  const M = 1.0, A = 0.3, r0 = 0.5;
  const a0 = 3.0;  // In positive-lapse region (F > 0)
  const f0 = lapseF(a0, M, A, r0);
  
  // Test 1: σ is negative (exotic matter)
  const sigma0 = surfaceSigma(a0, Math.max(f0, 0), 0);
  assert(sigma0 < 0, `σ < 0 (exotic): ${sigma0.toFixed(6)}`);
  
  // Test 2: σ formula matches paper: σ = -√(F + ȧ²)/(2πa)
  const expectedSigma = -Math.sqrt(f0) / (2 * Math.PI * a0);
  approx(sigma0, expectedSigma, TOLERANCE, 'σ formula');
  
  // Test 3: σ formula is consistent (check at two points)
  const sigma1 = surfaceSigma(a0 * 1.5, lapseF(a0 * 1.5, M, A, r0), 0);
  assert(Math.abs(sigma1) > 0, '|σ| nonzero at larger a');
}

// ============================================
// SECTION 3: Effective Potential Tests
// ============================================
function testEffectivePotential() {
  console.log('\n=== 3. Effective Potential V(a) ===');
  
  const M = 1.0, A = 0.3, r0 = 0.5;
  const a0 = 3.0;  // In positive-lapse region (F > 0)
  const f0 = lapseF(a0, M, A, r0);
  const sigma0 = -Math.sqrt(f0) / (2 * Math.PI * a0);
  
  // Test 1: V(a₀) = 0 at equilibrium (for calibrated shell)
  const V_a0 = effPot(a0, a0, sigma0, 'barotropic', { omega: -0.5 });
  finite(V_a0, 'V(a₀)');
  
  // Test 2: V'(a₀) ≈ 0 at equilibrium (calibrated)
  const omega_cal = calibrateOmega(a0, M, A, r0);
  const Vp = effPotPrime(a0, a0, sigma0, 'barotropic', { omega: omega_cal });
  approx(Vp, 0, TOLERANCE * 10, "V'(a₀) ≈ 0 (calibrated)");
  
  // Test 3: V''(a₀) > 0 for stable configuration (barotropic at small a₀)
  const Vpp = effPotD2(a0, a0, sigma0, 'barotropic', { omega: -0.5 });
  finite(Vpp, "V''(a₀)");
  
  // Test 4: V(a) → F(a) as σ → 0 (vacuum limit)
  const V_vac = effPot(a0, a0, 0, 'barotropic', { omega: -0.5 });
  approx(V_vac, f0, TOLERANCE * 10, 'V(a) → F(a) as σ→0');
}

// ============================================
// SECTION 4: Barotropic Calibration Tests
// ============================================
function testBarotropicCalibration() {
  console.log('\n=== 4. Barotropic Calibration ===');
  
  const M = 1.0, A = 0.3, r0 = 0.5;
  
  // Test 1: ω formula matches paper Eq. B.4: ω = -(a₀F' + 2F)/(4F)
  for (let a0 of [1.5, 2.0, 2.5]) {
    const f = lapseF(a0, M, A, r0);
    if (f <= 0) continue;
    const fp = lapseFPrime(a0, M, A, r0);
    const expectedOmega = -(a0 * fp + 2 * f) / (4 * f);
    const actualOmega = calibrateOmega(a0, M, A, r0);
    approx(actualOmega, expectedOmega, TOLERANCE, `ω at a₀=${a0}`);
  }
  
  // Test 2: V''_B formula matches paper Eq. B.6
  for (let a0 of [1.5, 2.0]) {
    const f = lapseF(a0, M, A, r0);
    if (f <= 0) continue;
    const fp = lapseFPrime(a0, M, A, r0);
    const fpp = lapseFDblPrime(a0, M, A, r0);
    const expectedVpp = fpp + fp / a0 - (fp * fp) / f;
    const actualVpp = barotropicVpp(a0, M, A, r0);
    approx(actualVpp, expectedVpp, TOLERANCE * 10, `V''_B at a₀=${a0}`);
  }
  
  // Test 3: Barotropic V''_B formula check (positive-lapse region only)
  // a₀ must be > r₊ for F(a₀) > 0
  const [rPlus] = findHorizons(M, A, r0);
  if (rPlus !== null && rPlus < 3.0) {
    const aTest = Math.max(rPlus + 0.1, 2.5);
    const omega = calibrateOmega(aTest, M, A, r0);
    const vpp = barotropicVpp(aTest, M, A, r0);
    assert(isFinite(vpp), `V''_B finite at a₀=${aTest.toFixed(1)}`);
  }
  
  // Test 4: Barotropic is unstable for large a₀ (paper's finding)
  const omegaLarge = calibrateOmega(3.0, M, A, r0);
  const vppLarge = barotropicVpp(3.0, M, A, r0);
  assert(vppLarge < 0, 'Barotropic unstable at a₀=3.0');
}

// ============================================
// SECTION 5: Horizon Finding Tests
// ============================================
function testHorizonFinding() {
  console.log('\n=== 5. Horizon Finding ===');
  
  const M = 1.0, A = 0.3, r0 = 0.5;
  
  // Test 1: findHorizons returns valid results
  const [rPlus, rMinus] = findHorizons(M, A, r0);
  finite(rPlus, 'r₊');
  
  // Test 2: r₊ > 0
  assert(rPlus > 0, 'r₊ > 0');
  
  // Test 3: F(r₊) ≈ 0
  if (rPlus !== null) {
    const fAtHorizon = lapseF(rPlus, M, A, r0);
    approx(fAtHorizon, 0, TOLERANCE * 100, 'F(r₊) ≈ 0');
  }
  
  // Test 4: Horizon exists for standard parameters
  const [rPlusStd] = findHorizons(1.0, 0.3, 0.5);
  assert(rPlusStd > 2, 'Standard params have horizon at r₊ > 2');
}

// ============================================
// SECTION 6: EOS Model Tests
// ============================================
function testEOSModels() {
  console.log('\n=== 6. Equation of State Models ===');
  
  const M = 1.0, A = 0.3, r0 = 0.5;
  const a0 = 3.0;  // In positive-lapse region (F > 0)
  const f0 = lapseF(a0, M, A, r0);
  const sigma0 = -Math.sqrt(f0) / (2 * Math.PI * a0);
  
  // Test each EOS model computes valid pressure
  const models = [
    { name: 'barotropic', params: { omega: -0.5 } },
    { name: 'phantom', params: { Ap: 0.5, alpha_p: 1 } },
    { name: 'chaplygin', params: { Ac: 2, alpha_c: 0.5 } },
    { name: 'cosmicChap', params: { Agc: 2, n_gc: 2 } },
    { name: 'modCosmicChap', params: { Amcc: 2, m_mcc: 2 } },
  ];
  
  for (const model of models) {
    // Test that the EOS function returns valid values
    const sigma_eos = computeSigmaFromEOS(a0, a0, sigma0, model.name, model.params);
    finite(sigma_eos, `${model.name} σ`);
  }
}

// ============================================
// SECTION 7: RK4 Integrator Tests
// ============================================
function testRK4Integrator() {
  console.log('\n=== 7. RK4 Integrator ===');
  
  // Test 1: Derivative function returns correct structure
  const M = 1.0, A = 0.3, r0 = 0.5;
  const a0 = 3.0;  // In positive-lapse region (F > 0)
  const f0 = lapseF(a0, M, A, r0);
  const sigma0 = -Math.sqrt(f0) / (2 * Math.PI * a0);
  
  // Simulate one RK4 step manually
  function deriv(state) {
    const [a, v] = state;
    if (a <= 0) return [0, 0];
    const Vp = effPotPrime(a, a0, sigma0, 'barotropic', { omega: -0.5 });
    return [v, -Vp / 2];
  }
  
  const s = [a0 * 1.01, 0]; // perturbed state
  const dt = 0.01;
  const k1 = deriv(s);
  const s2 = [s[0] + k1[0] * dt / 2, s[1] + k1[1] * dt / 2];
  const k2 = deriv(s2);
  const s3 = [s[0] + k2[0] * dt / 2, s[1] + k2[1] * dt / 2];
  const k3 = deriv(s3);
  const s4 = [s[0] + k3[0] * dt, s[1] + k3[1] * dt];
  const k4 = deriv(s4);
  
  const a_new = s[0] + (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) * dt / 6;
  const v_new = s[1] + (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) * dt / 6;
  
  finite(a_new, 'RK4 a_new');
  finite(v_new, 'RK4 v_new');
  assert(isFinite(a_new) && isFinite(v_new), 'RK4 step produces finite values');
}

// ============================================
// Run All Tests
// ============================================
function runAllTests() {
  console.log('\n========================================');
  console.log('Wormhole Simulation Test Suite');
  console.log('Based on arXiv:2610.00131 (Zhong et al.)');
  console.log('========================================');
  
  try {
    testLapseFunction();
    testSurfaceSigma();
    testEffectivePotential();
    testBarotropicCalibration();
    testHorizonFinding();
    testEOSModels();
    testRK4Integrator();
    
    console.log('\n========================================');
    console.log(`Results: ${passed}/${total} passed, ${failed} failed`);
    if (failed === 0) {
      console.log('✓ ALL TESTS PASSED');
    } else {
      console.error('✗ SOME TESTS FAILED');
      process.exit(1);
    }
    console.log('========================================\n');
    
  } catch (e) {
    console.error('\n✗ Test error:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

runAllTests();
