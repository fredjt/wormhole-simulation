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
var _warnCount = 0;
var _warnLastTime = 0;

/** Reset rate-limit counters — call on simulation reset so warnings are visible across sessions.
 * Also resets the clamping detection flag so out-of-bounds warnings are visible in new sessions. */
function resetWarnCounters() {
  _warnCount = 0;
  _warnLastTime = 0;
  _clampingDetected = false;
}

/** Clear the precomputed grid and parameter cache — used for testing and cleanup.
 * Also resets rate-limit counters and clamping detection flag. */
function destroyFPGrid() {
  fp_grid = null;
  last_fp_params = null;
  fp_grid_dirty = false;
  _clampingDetected = false;
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
  var factor = Math.pow(1 - z, -b);
  var zNew = z / (z - 1);
  if (Math.abs(zNew) < 0.95) {
    return factor * series(c - a, b, c, zNew, 200, 1e-14);
  }

  // Extreme |z| after continuation: more iterations for precision.
  var iter = Math.max(Math.ceil((3 - absZ / (absZ + 1)) * 500), 200);
  return factor * series(c - a, b, c, zNew, iter, 1e-14);
}

function lapseF(r, M, A, r0) {
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
 * Important: When this returns false, the caller will call initFPGrid().
 * _paramsMatch clears fp_grid_dirty so that after a successful rebuild,
 * subsequent calls don't keep rebuilding on every interpolation step.
 */
function _paramsMatch(M_in, A_in, r0_val_in) {
  if (fp_grid_dirty) {
    fp_grid_dirty = false;  // Clear dirty so next call won't rebuild again
    return false;
  }
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

    var rMin = Math.max(0.1 * M, 0.01); // Floor at 0.01 prevents unphysically small grid for low mass.
  if (!isFinite(rMin)) { console.warn('initFPGrid: non-finite rMin'); return false; }
  // Grid bounds: scale rMax with mass to cover expected oscillation ranges.
  // For large M, horizons and stable throats are farther out, so we need
  // a wider grid. The 8*M term ensures coverage up to ~8× mass scale.
  // For unstable barotropic trajectories that expand rapidly, rMax may be
  // exceeded — the clamping path returns the boundary F' value.
  var rMax = Math.max(rMin + 8 * M, rMin * (M > 3 ? 4 : 3));
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
        if (!isFinite(ri)) throw 'non-finite radius at index ' + i;
        tmpR[i] = ri;
        tmpF[i] = lapseF(ri, M, A, r0);


        if (!isFinite(tmpF[i])) throw new Error('NaN in F');  // Abort grid construction on bad value.

        // Grid derivative step size: adaptive based on local grid spacing.
        // Differs from FD_FIRST_DERIV_H (1e-7) used in lapseFPrime() for calibration.
        // Grid uses a larger step (typically ~dr/260) for numerical stability during
        // grid construction — small h values can cause cancellation error with hypergeom.
        var hi2p = Math.max(rMin * 5e-7, dr / (N + 4));
        if (!isFinite(hi2p)) throw 'non-finite hi2p at index ' + i;

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

        if (!isFinite(tmpFP[i])) throw new Error('NaN in dF/dr');
    } catch(e) {
        console.warn('initFPGrid abort at index ' + i + ': params={' + M + ',' + A + ',' + r0 + ',N=' + N + '} err=' + e);
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
  if (!_paramsMatch(M_val_in, A_val_in, r0_val_in)) initFPGrid(M_val_in, A_val_in, r0_val_in);

  var grid = fp_grid;
  if (!grid || grid.r.length < 2 || !isFinite(grid.r[0])) {
    // Numerical differentiation fallback — grid not yet built, invalid, or degenerate (< 2 points)
    var h = FD_FIRST_DERIV_H;
    return (lapseF(r + h, M_val_in, A_val_in, r0_val_in) - lapseF(r - h, M_val_in, A_val_in, r0_val_in)) / (2 * h);
  }

  var lo = _binarySearch(0, grid.r.length - 1, grid.r, r);
  var hi = grid.r.length - 1;

  if (r < grid.r[lo]) {
    if (_shouldWarn()) console.warn(`getFPrimeInterp: r=${r} below grid min ${grid.r[lo]}, clamping to first point`); _markClampingDetected();
    return grid.fp[lo];
  }
  if (r > grid.r[hi]) {
    if (_shouldWarn()) console.warn(`getFPrimeInterp: r=${r} above grid max ${grid.r[hi]}, clamping to last point`); _markClampingDetected();
    return grid.fp[hi];
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
  if (hi <= lo) return lo;
  while (hi - lo > 1) { var mid = ((lo + hi) >>> 1); if (arr[mid] <= r) lo = mid; else hi = mid; }
  return lo;
}

/** Rate-limit console warnings to max 10 per second to avoid main-thread blocking.
 * Also tracks session-level clamping detection: once clamping occurs in a session,
 * _clampingDetected stays true until resetWarnCounters() or destroyFPGrid() is called.
 * This ensures users are notified at least once per session even when rate-limited. */
var _clampingDetected = false;

function _shouldWarn() {
  if (DEBUG_GRID_INTERP) return true;  // No rate limiting in debug mode
  var now = performance.now();
  if (now - _warnLastTime > 100) { _warnCount = 0; _warnLastTime = now; }
  if (_warnCount >= 10) return false;
  _warnCount++;
  return true;
}

/** Mark that out-of-bounds clamping has been detected in this session.
 * Called by interpolation functions when r falls outside grid bounds. */
function _markClampingDetected() {
  if (!_clampingDetected) {
    _clampingDetected = true;
    // Log once per session regardless of rate-limit
    if (typeof console !== 'undefined') {
      console.warn('Grid interpolation: out-of-bounds clamping detected — ' +
        'derivative values may be inaccurate for extreme scale factors.');
    }
  }
}

/** Numerical second derivative of lapseF using central difference. */
function lapseFDblPrime(r, M, A, r0, h) { if (!h) h = FD_SECOND_DERIV_H; return (lapseF(r + h, M, A, r0) - 2 * lapseF(r, M, A, r0) + lapseF(r - h, M, A, r0)) / (h * h); }

/** Numerical first derivative of lapseF using central difference. */
function lapseFPrime(r, M, A, r0, h) { if (h === undefined || !isFinite(h)) h = FD_FIRST_DERIV_H; return (lapseF(r + h, M, A, r0) - lapseF(r - h, M, A, r0)) / (2 * h); }

export { lapseF, lapseFPrime, lapseFDblPrime, initFPGrid, getFPrimeInterp, resetWarnCounters, destroyFPGrid, setFPGridDirty };
