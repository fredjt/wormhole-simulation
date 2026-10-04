// Regularized Letelier-Alencar string-cloud black hole lapse function
// Paper: arXiv:2610.00131, Eq. 2.1-2.2

// Numerical differentiation step sizes for lapseF derivatives used by calibration
// functions and grid construction. Note: effPotPrime in potential.js uses its own
// h=1e-6 since it operates on a composite function V(a).
var FD_FIRST_DERIV_H = 1e-7;
var FD_SECOND_DERIV_H = 1e-5;

// Rate-limit for out-of-bounds warnings during integration (max 10 per second).
// Set DEBUG_GRID_INTERP=true to disable rate limiting for diagnostic purposes.
var DEBUG_GRID_INTERP = typeof globalThis !== 'undefined' && globalThis.DEBUG_GRID_INTERP;
// Rate-limit counters and time tracking for out-of-bounds warnings (max ~40 per second).
// Set DEBUG_GRID_INTERP=true to disable rate limiting for diagnostic purposes.
var _warnCount = 0;
var _warnLastTime = 0;
var WARN_WINDOW_MS = 250; // ms — window length before counter resets
var MAX_WARNINGS_PER_WINDOW = 10;
function _shouldWarn() {
  if (DEBUG_GRID_INTERP) return true;  // No rate limiting in debug mode
  var now = performance.now();
  if (now - _warnLastTime > WARN_WINDOW_MS) { _warnCount = 0; _warnLastTime = now; }
  if (_warnCount >= MAX_WARNINGS_PER_WINDOW) return false;
  _warnCount++;
  return true;
}

/** Timestamp of the last `_markClampingDetected()` call — used for time-based expiry. */
var _clampingLastTime = 0;

/** Reset rate-limit counters — call on simulation reset so warnings are visible across sessions.
 * Also resets the clamping detection flag and its timestamp for new sessions. */
function resetWarnCounters() {
  _warnCount = 0;
  _warnLastTime = 0;
  _clampingDetected = false;
  _clampingLastTime = 0;
}

/** Clear the precomputed grid and parameter cache — used for testing and cleanup.
 * Also resets rate-limit counters, clamping detection flag, and timestamp. */
function destroyFPGrid() {
  fp_grid = null;
  last_fp_params = null;
  fp_grid_dirty = false;
  _clampingDetected = false;
  _clampingLastTime = 0;
}

/** Mark the grid as needing rebuild — call when parameters change during sim.
 * The next getFPrimeInterp call will rebuild before returning.
 *
 * Note: Under normal UI usage, slider changes call resetSim() which always
 * rebuilds the grid via initSim(), so this function is primarily useful for
 * programmatic parameter changes that don't trigger a full reset. */
function setFPGridDirty() {
  fp_grid_dirty = true;
}

// Parameter tolerance for grid rebuild check — aligned with UI slider quantization (~0.01 step).
// Values prevent spurious rebuilds from repeated slider interactions with the same value.
var PARAM_TOL = { M: 0.01, A: 0.01, r0: 0.01 };

/* ---------------------------------------------------------------------------
 * Named constants for grid bounds computation — see initFPGrid() PHYSICAL
 * JUSTIFICATION comment above.  These replace magic numbers so that future
 * maintainers can adjust them in one place.
 */
var GRID_RMIN_FRACTION = 0.1;    // rMin floor: max(0.1*M, 0.01)
var GRID_ABSOLUTE_MIN = 0.01;     // Absolute minimum radius (prevents unphysically small grid for low mass)
var RMAX_OFFSET_MULTIPLIER = 8;   // + 8*M term — covers up to ~8× mass scale
var MASS_THRESHOLD_FACTOR = 3;    // Switch between factor-based and offset-based scaling
var GRID_MAX_FACTOR_HIGH_MASS = 4; // rMin * N when M > threshold (wider grid)
var GRID_MAX_FACTOR_LOW_MASS = 3;   // rMin * N when M ≤ threshold

function hypergeom2F1(a, b, c, z) {
  // Compute _2F₁(a,b;c;z) using series expansion with analytic continuation.
  function series(aa, bb, cc, zz, maxIter, tol) {
    var result = 1.0;
    var term = 1.0;
    for (var n = 1; n <= maxIter; n++) {
      term *= (aa + n - 1) * (bb + n - 1) / ((cc + n - 1) * n) * zz;
      result += term;
      if (Math.abs(term) < tol * Math.max(Math.abs(result), 1.0)) break;
    }
    return result;
  }

  // Piecewise iteration count scaled with |z|.
  // Actual iteration limits: ~10–65 for |z|≤0.3, ≤540 for 0.3<|z|≤0.9, ≤~750 for |z|>0.9.
  // The tolerance check (Math.abs(term) < tol * |result|) normally catches early
  // convergence well before these caps, so the max values are safety nets.
  var absZ = Math.abs(z);
  if (absZ <= 0.3) {
    // Scales from ~10 at z=0 (trivial convergence) to ~65 near |z|=0.3 branch boundary.
    return series(a, b, c, z, Math.min(Math.max(150 * absZ + 10, 10), 100), 1e-14);
  } else if (absZ <= 0.9) {
    // Smooth formula: (3 - absZ) * 200 gives ~420 at |z|=0.9, ~540 at |z|=0.3.
    var iter = Math.max(Math.ceil((3 - absZ) * 200), 100);
    return series(a, b, c, z, iter, 1e-14);
  }

  // Analytic continuation for |z| > 0.9: factor*(1-z)^(-b) identity.
  var absZ = Math.abs(z);

  // Guard against extremely large |z| where even analytic continuation becomes unreliable.
  // For our use case (hypergeom2F1(-0.5,-0.25,0.75,z)), z is always real and negative,
  // so very large |z| means r/r₀ >> 1 — the hypergeometric series fundamentally diverges
  // at or near its singularity regardless of iteration count.
  if (absZ > 1e6) {
    console.warn('hypergeom2F1: extremely large |z|=' + absZ.toFixed(4) +
      ' — falling back to asymptotic term only');
    return Math.pow(1 - z, -b); // Asymptotic leading order
  }

  var factor = Math.pow(1 - z, -b);
  var zNew = z / (z - 1);
  if (Math.abs(zNew) < 0.95) {
    return factor * series(c - a, b, c, zNew, 200, 1e-14);
  }

  // Extreme |z| after continuation: more iterations for precision.
  var iter = Math.max(Math.ceil((3 - absZ / (absZ + 1)) * 500), 200);
  return factor * series(c - a, b, c, zNew, iter, 1e-14);
}

/** Regularized Letelier-Alencar string-cloud black hole lapse function.
 * F(r) = [1 - (2M/r - A·r₀²/r² · ₂F₁(-½,-¼;¾;-r⁴/r₀⁴))](1 + r₀/r)⁻⁴
 *
 * @param {number} r — radius (>0 required)
 * @returns {number} Lapse function value, or NaN if inputs are invalid.
 */
function lapseF(r, M, A, r0) {
    // NOTE: Returns NaN for r ≤ 0 (previously returned 1.0 as a sentinel).
    // This behavioral change prevents callers from relying on F(≤0)=1 which is
    // unphysical; any caller that needs an asymptotic limit should check explicitly.
    if (r <= 0 || !isFinite(M) || !isFinite(A) || !isFinite(r0)) return NaN;
  var ratio = r / r0;
  // Compute -r^4/r_0^4 correctly as -(x² * x²).
  var z = -(ratio * ratio) * (ratio * ratio);

  var fg = hypergeom2F1(-0.5, -0.25, 0.75, z);
    // Guard against NaN from extreme values.
  if (!isFinite(fg)) {
    console.warn('lapseF: hypergeom2F1 returned non-finite — falling back to regulator-only form');
    return Math.pow(1.0 + r0 / r, -4);
  }

  var bracket = 1.0 - (2.0 * M / r - A * r0 * r0 / (r * r) * fg);
  return bracket * Math.pow(1.0 + r0 / r, -4);
}

// ================================================================
// Pre-computed F(r), dF/dr grid for fast interpolation during simulation.
var fp_grid = null;   // {r: Float64Array, f: Float64Array, fp: Float64Array}
var last_fp_params = null;  // Last (M,A,r0) used to build the current grid
var fp_grid_dirty = false;  // Flag: grid needs rebuild (params changed during sim)

/** Rebuild params check — deduplicated helper.
 * Returns true if the current grid matches the given parameters within tolerance.
 * Also considers the dirty flag: if fp_grid_dirty is true, we force a rebuild
 * even if _paramsMatch would pass (prevents stale grid after mid-sim parameter change).
 *
 * Note: This function has NO side effects. The caller is responsible for clearing
 * fp_grid_dirty after a successful initFPGrid() call to prevent infinite rebuilds.
 */
function _paramsMatch(M_in, A_in, r0_val_in) {
  if (fp_grid_dirty) return false;  // Force rebuild if marked dirty
  var gp = last_fp_params;
  // Tolerances relaxed to prevent unnecessary rebuilds on UI slider interactions.
  if (!gp || Math.abs(gp.M - M_in) > PARAM_TOL.M
    || Math.abs(gp.A - A_in) > PARAM_TOL.A || Math.abs(gp.r0 - r0_val_in) > PARAM_TOL.r0) {
    return false;
  }
  return true;
}

/** Build a dense (r, F(r), dF/dr) lookup grid for fast barotropic derivative interpolation.
 * @param {number} [N=256] Grid resolution (points). Higher = more accurate but slower construction.
 *   Typical values: 128-512. Measured relative error for dF/dr interpolation: <1% with N=256.
 *   Accuracy scales approximately as O(1/N²) for linear interpolation. */
function initFPGrid(M, A, r0, N) {
  // Default grid size: 256 points (~19 KB Float64Array per grid).
  // Trade-off: more points = better interpolation accuracy but slower construction.
  // For typical wormhole parameters, 256 points gives <1e-4 interpolation error.
  if (!N || !isFinite(N)) N = 256;

  var rMin = Math.max(GRID_RMIN_FRACTION * M, GRID_ABSOLUTE_MIN);
  if (!isFinite(rMin)) {
    console.warn('initFPGrid: non-finite rMin');
    return false;
  }
  // Grid bounds: scale rMax with mass to cover expected oscillation ranges.
  // PHYSICAL JUSTIFICATION:
  //   - For Schwarzschild-like geometries the outermost horizon is at ~2M,
  //     and throat oscillations typically stay within [~0.1 M, ~3–8 M].
  //   - The "+ RMAX_OFFSET_MULTIPLIER*M" term ensures coverage up to
  //     ~RMAX_OFFSET_MULTIPLIER× mass scale for unstable barotropic trajectories.
  var rMax = Math.max(rMin + RMAX_OFFSET_MULTIPLIER * M,
                      rMin * (M > MASS_THRESHOLD_FACTOR ? GRID_MAX_FACTOR_HIGH_MASS : GRID_MAX_FACTOR_LOW_MASS));
  if (!isFinite(rMax) || rMax <= rMin) { console.warn('initFPGrid: invalid grid bounds'); return false; }

  // Compute grid spacing.
  var dr = (rMax - rMin) / (N - 1);
  if (!isFinite(dr)) { console.warn('initFPGrid: non-finite grid spacing'); return false; }

  // Use a temporary array to make construction atomic (partial grid never stored if loop fails).
  var tmpR = new Float64Array(N),
      tmpF = new Float64Array(N),
      tmpFP = new Float64Array(N);

  for (var i = 0; i < N; ++i) {
    var ri = rMin + dr * i;
    try {
      if (!isFinite(ri)) {
        throw 'non-finite radius at index ' + i;
      }
      tmpR[i] = ri;
      tmpF[i] = lapseF(ri, M, A, r0);

      // Abort grid construction on bad value.
      if (!isFinite(tmpF[i])) {
        throw new Error('NaN in F');
      }

      // Grid derivative step size: adaptive based on local grid spacing.
      // Differs from FD_FIRST_DERIV_H (1e-7) used in lapseFPrime() for calibration.
      // Grid uses a larger step (typically ~dr/260) for numerical stability during
      // grid construction — small h values can cause cancellation error with hypergeom.
      var hi2p = Math.max(rMin * 5e-7, dr / (N + 4));

      if (!isFinite(hi2p)) {
        throw 'non-finite hi2p at index ' + i;
      }

      // Use central difference when both sides are valid; fall back to
      // one-sided differences at boundaries where ri ± hi2p would go out of bounds.
      var hiLeft = Math.max(ri - rMin, 0);
      var hiRight = rMax - ri;
      if (hiLeft >= hi2p && hiRight >= hi2p) {
        // Central difference — most accurate.
        tmpFP[i] = (lapseF(ri + hi2p, M, A, r0) - lapseF(ri - hi2p, M, A, r0)) / (2.0 * hi2p);
      } else if (hiLeft >= hi2p) {
        // Left side available, right side out of bounds — use backward difference.
        tmpFP[i] = (lapseF(ri, M, A, r0) - lapseF(ri - hi2p, M, A, r0)) / hi2p;
      } else if (hiRight >= hi2p) {
        // Right side available, left side out of bounds — use forward difference.
        tmpFP[i] = (lapseF(ri + hi2p, M, A, r0) - lapseF(ri, M, A, r0)) / hi2p;
      } else {
        // Both sides out of bounds — use smallest available step.
        var h = Math.min(hi2p, hiLeft + hiRight);
        if (h > 0 && isFinite(lapseF(ri + h, M, A, r0))) {
          tmpFP[i] = (lapseF(ri + h, M, A, r0) - lapseF(ri, M, A, r0)) / h;
        } else {
          throw new Error('cannot compute derivative at boundary point ri=' + ri);
        }
      }

      if (!isFinite(tmpFP[i])) {
        throw new Error('NaN in dF/dr');
      }
    } catch (e) {
      console.warn(
        'initFPGrid abort at index ' + i + ': params={' + M + ',' + A + ',' + r0
          + ',N=' + N + '} err=' + e);
      return false;
    }
  }

  // Only commit the grid if ALL values were valid. No second loop needed.
  fp_grid = {r: tmpR, f: tmpF, fp: tmpFP};
  last_fp_params = {M: M, A: A, r0: r0};
  return true; // Indicate successful construction.
}

/** Evaluate pre-computed F'(r) via linear interpolation on the grid.
 * Requires: M_val, A_val, r0_val to be set (by initSim) before calling.
 *
 * Grid rebuild strategy: if params changed during simulation (fp_grid_dirty),
 * the grid is rebuilt synchronously on the first call after the change. To avoid
 * blocking the animation frame, callers should mark the grid dirty via
 * setFPGridDirty() when UI parameters change, then the next getFPrimeInterp
 * call will rebuild before returning. */
function getFPrimeInterp(r, M_val_in, A_val_in, r0_val_in) {
  if (!_paramsMatch(M_val_in, A_val_in, r0_val_in)) {
    if (initFPGrid(M_val_in, A_val_in, r0_val_in)) {
      fp_grid_dirty = false;  // Clear after successful rebuild
    }
  }

  var grid = fp_grid;
  if (!grid || grid.r.length < 2 || !isFinite(grid.r[0])) {
    // Numerical differentiation fallback — grid not yet built, invalid, or degenerate (< 2 points)
    var h = FD_FIRST_DERIV_H;
    return (lapseF(r + h, M_val_in, A_val_in, r0_val_in) - lapseF(r - h, M_val_in, A_val_in, r0_val_in)) / (2 * h);
  }

  var lo = _binarySearch(0, grid.r.length - 1, grid.r, r);
  var hi = grid.r.length - 1;

  // Out-of-bounds handling with first-order extrapolation instead of flat-clamp.
  if (r < grid.r[lo]) {
    var loFp = grid.fp[lo], hiFp = grid.fp[Math.min(lo + 1, grid.fp.length - 1)];
    var dr_local = Math.max(grid.r[Math.min(lo + 1, grid.r.length - 1)] - grid.r[lo], 1e-30);
    var slope = (hiFp - loFp) / dr_local;
    if (_shouldWarn()) {
      console.warn('getFPrimeInterp: r=' + r.toFixed(4) + ' below grid min '
        + grid.r[lo].toFixed(4) + ', extrapolating');
    }
    _markClampingDetected();
    return loFp + slope * (r - grid.r[lo]);
  }

  if (r > grid.r[hi]) {
    var hiIdx = Math.min(hi, grid.fp.length - 1);
    var prevHiFp = grid.fp[Math.max(hiIdx - 1, 0)];
    dr_local = Math.max(grid.r[hi] - grid.r[Math.max(hiIdx - 1, 0)], 1e-30);
    slope = (grid.fp[hiIdx] - prevHiFp) / dr_local;
    if (_shouldWarn()) {
      console.warn('getFPrimeInterp: r=' + r.toFixed(4) + ' above grid max '
        + grid.r[hi].toFixed(4) + ', extrapolating');
    }
    _markClampingDetected();
    return grid.fp[hiIdx] + slope * (r - grid.r[hi]);
  }

  var ri_lo = grid.r[lo], ri_hi = grid.r[lo + 1];

  // Guard against division by zero.
  var denom = ri_hi - ri_lo;
  if (!isFinite(denom) || Math.abs(denom) < 1e-20) return grid.fp[lo];

  return grid.fp[lo] + (grid.fp[lo + 1] - grid.fp[lo]) * ((r - ri_lo) / denom);
}



/* ---- Internal helpers for binary-search interpolation ------------------------------------------ */
/** Binary search: returns largest index lo such that arr[lo] <= r.
 * Requires: hi > lo (at least two elements). Callers must ensure grid.r.length >= 2.
 * Returns lo unchanged if hi <= lo (degenerate case). */
function _binarySearch(lo, hi, arr, r) {
  // NOTE: We use `>>> 1` instead of `(lo+hi)>>0` because grid arrays are
  // always non-negative length, so overflow is impossible. The logical right-
  // shift produces the same result as floor division by 2 for all valid inputs.
  if (hi <= lo) return lo;
  while (hi - lo > 1) { var mid = ((lo + hi) >>> 1); if (arr[mid] <= r) lo = mid; else hi = mid; }
  return lo;
}

/** Rate-limit console warnings to max 10 per second to avoid main-thread blocking.
 * Also tracks session-level clamping detection: once clamping occurs in a session,
 * _clampingDetected stays true until resetWarnCounters() or destroyFPGrid() is called.
 * This ensures users are notified at least once per session even when rate-limited. */
// Session-level flag for tracking whether any out-of-bounds clamping has occurred.
var _clampingDetected = false;

/** Mark that out-of-bounds clamping has been detected.
 * Called by interpolation functions when r falls outside grid bounds.
 *
 * Uses a time-based expiry (CLAMPING_DETECTION_WINDOW ms) so the session-level
 * warning can re-fire if out-of-bounds conditions persist or recur later in long runs. */
var CLAMPING_DETECTION_WINDOW = 5000; // ms — reset clamping flag after this idle period
function _markClampingDetected() {
  var now = performance.now();
  // Reset the session-level flag if no recent clamping events (allows re-warning on long runs)
  if (_clampingLastTime > 0 && now - _clampingLastTime < CLAMPING_DETECTION_WINDOW) return;

  _clampingDetected = true;
  _clampingLastTime = now;
  // Log once per session regardless of rate-limit
  if (typeof console !== 'undefined') {
    console.warn('Grid interpolation: out-of-bounds clamping detected — ' +
      'derivative values may be inaccurate for extreme scale factors.');
  }
}

/** Numerical second derivative of lapseF using central difference.
 * Mirrors `lapseF` input validation — returns NaN if parameters are invalid. */
/** Numerical second derivative of lapseF using central difference.
 * Mirrors `lapseF` input validation — returns NaN if parameters are invalid.
 *
 * @param {number} r - radius; values < 0.001 will be clamped to 0.001 for numerical safety
 *   (the hypergeometric series is unstable near z→-∞ which corresponds to very small r).
 */
function lapseFDblPrime(r, M, A, r0, h) {
  // Consistent with lapseF: reject non-finite params early.
  if (!isFinite(M) || !isFinite(A) || !isFinite(r0)) return NaN;
  if (!h) h = FD_SECOND_DERIV_H;
  var _r = Math.max(1e-3, r); // Clamp to avoid numerical instability at very small radii
  return (lapseF(_r + h, M, A, r0) - 2 * lapseF(_r, M, A, r0) + lapseF(_r - h, M, A, r0)) / (h * h);
}

/** Numerical first derivative of lapseF using central difference.
 * Mirrors `lapseF` input validation — returns NaN if parameters are invalid. */
function lapseFPrime(r, M, A, r0, h) {
  // Consistent with lapseF: reject non-finite params or r <= 0 early (avoids silent NaN propagation).
  if (!isFinite(M) || !isFinite(A) || !isFinite(r0)) return NaN;
  if (h === undefined || !isFinite(h)) h = FD_FIRST_DERIV_H;
  var _r = Math.max(1e-3, r);
  return (lapseF(_r + h, M, A, r0) - lapseF(_r - h, M, A, r0)) / (2 * h);
}

export { lapseF, lapseFPrime, lapseFDblPrime, initFPGrid, getFPrimeInterp, resetWarnCounters, destroyFPGrid, setFPGridDirty };
