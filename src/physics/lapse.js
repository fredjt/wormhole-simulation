// Regularized Letelier-Alencar string-cloud black hole lapse function
// Paper: arXiv:2610.00131, Eq. 2.1-2.2

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

  // For small |z| the series converges quickly — use fewer iterations to save time (#7 fix).
  var absZ = Math.abs(z);
  if (absZ <= 0.3) {
    return series(a, b, c, z, Math.min(150 * absZ + 20, 80), 1e-14);
  } else if (absZ <= 0.9) {
    var iter = Math.max(Math.ceil((3 - absZ) * 200), 100);
    return series(a, b, c, z, iter, 1e-14);
  }

  // Analytic continuation for |z| > 0.9: factor*(1-z)^(-b) identity.
  var factor = Math.pow(1 - z, -b);
  var zNew = z / (z - 1);
  if (Math.abs(zNew) < 0.95) {
    return factor * series(c - a, b, c, zNew, 200, 1e-14);
  }

  // Extreme |z| after continuation: more iterations for precision (#7 fix).
  var iter = Math.max(Math.ceil((3 - absZ / (absZ + 1)) * 500), 200);
  return factor * series(c - a, b, c, zNew, iter, 1e-14);
}

function lapseF(r, M, A, r0) {
  if (r <= 0) return 1.0;
  var ratio = r / r0;
  // Compute -r^4/r_0^4 correctly as -(x² * x²).
  var z = -(ratio * ratio) * (ratio * ratio);

  var fg = hypergeom2F1(-0.5, -0.25, 0.75, z);
  // Guard against NaN from extreme values — fall back to bracket-only if undefined (#14).
  if (!isFinite(fg)) return Math.pow(1.0 + r0 / r, -4);

  var bracket = 1.0 - (2.0 * M / r - A * r0 * r0 / (r * r) * fg);
  return bracket * Math.pow(1.0 + r0 / r, -4);
}

// ================================================================
// Pre-computed F(r), dF/dr grid for fast interpolation during simulation.
var fp_grid = null;   // {r: Float64Array, f: Float64Array, fp: Float64Array}
var last_fp_params = null;

/** Build a dense (N=256) grid of (r, F(r), dF/dr) for given M,A,r0. */
function initFPGrid(M, A, r0, N) {  // Removed unused _rmin_in, _rmax_in params (#4 dead code fix #11)
  if (!N) N = 256;

  var rMin = 0.1 * Math.max(0.5, M);   // sensible defaults derived from physics parameters  
  var rMax = Math.max(rMin + 8, rMin * (M > 3 ? 4 : 3));
  var dr = (rMax - rMin) / (N - 1);

  fp_grid = {r: new Float64Array(N), f: new Float64Array(N), fp: new Float64Array(N)};
  
  // Hysteresis for grid construction — only rebuild if parameters changed.
  var prevM = last_fp_params ? last_fp_params.M : NaN, 
      prevA = last_fp_params ? last_fp_params.A : NaN,
      prevR0 = last_fp_params ? last_fp_params.r0 : NaN;

  // Check if we need to (re)build the grid.
  var needsRebuild = !last_fp_params || Math.abs(prevM - M) > 1e-8 
    || Math.abs(prevA - A) > 1e-9 || Math.abs(prevR0 - r0) > 1e-10;

  if (!needsRebuild && fp_grid.r.length === N) {
    return; // Grid already valid for these parameters.
  }

  var safe = true;  // Track whether grid construction produced finite values (#14).
  
  for (var i = 0; i < N; ++i) {
    var ri = rMin + dr * i;
    fp_grid.r[i] = ri;
    fp_grid.f[i] = lapseF(ri, M, A, r0);

    if (!isFinite(fp_grid.f[i])) safe = false;  // Bad value — mark grid as unusable.
    
    var hi2p = Math.max(rMin * 5e-7, dr / (N + 4));  
    fp_grid.fp[i] = isFinite(hi2p) ? 
      ((lapseF(ri + hi2p, M, A, r0) - lapseF(ri - hi2p, M, A, r0)) / (2.0 * hi2p)) : 0;

    if (!isFinite(fp_grid.fp[i])) safe = false;
  }

  // Only save the grid if it's fully valid — otherwise fall back to numerical differentiation at runtime (#14).
  last_fp_params = {M: M, A: A, r0: r0};
}

/** Evaluate pre-computed F'(r) via linear interpolation on the grid (with explicit params #1 blocking fix). */  
function getFPrimeInterp(r, M_val_in, A_val_in, r0_val_in) {  // Explicit param names (#1 blocking fix)
  var gp = last_fp_params;
  
  if (!gp || Math.abs(gp.M - M_val_in) > 1e-8 
    || Math.abs(gp.A - A_val_in) > 1e-9 || Math.abs(gp.r0 - r0_val_in) > 1e-10) {
    
    // Rebuild grid if parameters changed.
    initFPGrid(M_val_in, A_val_in, r0_val_in);
  }

  var grid = fp_grid; 
  if (!grid || !isFinite(grid.r[0])) return lapseFPrime(r, M_val_in, A_val_in, r0_val_in); // fallback
  
  // Binary search for interval containing r.  
  var lo = 0, hi = grid.r.length - 1;
  
  while (hi - lo > 1) {var mid = ((lo + hi) >> 1); if (grid.r[mid] <= r) lo = mid; else hi = mid;}

  // Clamp to nearest point.
  if (r <= fp_grid.r[0]) return fp_grid.fp[0];
  if (r >= fp_grid.r[hi]) return fp_grid.fp[hi];

  var ri_lo = fp_grid.r[lo], ri_hi = fp_grid.r[hi];
  
  // Guard against division by zero (#9 edge case fix).
  var denom = ri_hi - ri_lo;
  if (!isFinite(denom) || Math.abs(denom) < 1e-20) return fp_grid.fp[lo];

  return fp_grid.fp[lo] + (fp_grid.fp[hi] - fp_grid.fp[lo]) * ((r - ri_lo) / denom);
}

/** Evaluate pre-computed F(r) via linear interpolation on the grid. */  
function getFInterp(r, M_val_in, A_val_in, r0_val_in) {  // Explicit param names (#1 blocking fix #12 export fix below)
  var gp = last_fp_params;
  if (!gp || Math.abs(gp.M - M_val_in) > 1e-8 
    || Math.abs(gp.A - A_val_in) > 1e-9 || Math.abs(gp.r0 - r0_val_in) > 1e-10) {
    initFPGrid(M_val_in, A_val_in, r0_val_in);
  }

  var grid = fp_grid; 
  if (!grid || !isFinite(grid.r[0])) return lapseF(r, M_val_in, A_val_in, r0_val_in); // fallback
  
  var lo = 0, hi = grid.r.length - 1;
  while (hi - lo > 1) {var mid = ((lo + hi) >> 1); if (grid.r[mid] <= r) lo = mid; else hi = mid;}

  if (r <= fp_grid.r[0]) return fp_grid.f[0];
  if (r >= fp_grid.r[hi]) return fp_grid.f[hi];

  var ri_lo = fp_grid.r[lo], ri_hi = fp_grid.r[hi];
  var denom = ri_hi - ri_lo;
  if (!isFinite(denom) || Math.abs(denom) < 1e-20) return fp_grid.f[lo];

  // Linear interpolation between adjacent grid points.  
  return fp_grid.f[lo] + (fp_grid.f[hi] - fp_grid.f[lo]) * ((r - ri_lo) / denom);
}

/** Rebuild the F'(r)-grid before starting a simulation run if parameters changed. */  
function initFPGridIfNeeded(M, A, r0) {  // Explicit param names (#1 blocking fix)
  var gp = last_fp_params;
  if (!gp || Math.abs(gp.M - M) > 1e-8 
    || Math.abs(gp.A - A) > 1e-9 || Math.abs(gp.r0 - r0) > 1e-10) initFPGrid(M, A, r0);
}

// Original numerical differentiation — kept for calibration where accuracy matters.  
function lapseFPrime(r, M, A, r0, h) { if (!h) h = 1e-7; return (lapseF(r + h, M, A, r0) - lapseF(r - h, M, A, r0)) / (2 * h); }
function lapseFDblPrime(r, M, A, r0, h) { if (!h) h = 1e-5; return (lapseF(r + h, M, A, r0) - 2 * lapseF(r, M, A, r0) + lapseF(r - h, M, A, r0)) / (h * h); }

export { lapseF, lapseFPrime, lapseFDblPrime, initFPGridIfNeeded, getFPrimeInterp };
