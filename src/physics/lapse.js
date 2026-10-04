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

  // Piecewise iteration count scaled with |z| (#7 fix from v2 review).
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
var last_fp_params = null;  // Last (M,A,r0) used to build the current grid

/** Rebuild params check — deduplicated helper (#21 from v3 review). */
function _paramsMatch(M_in, A_in, r0_val_in) {
  var gp = last_fp_params;  
  if (!gp || Math.abs(gp.M - M_in) > 1e-8 
    || Math.abs(gp.A - A_in) > 1e-9 || Math.abs(gp.r0 - r0_val_in) > 1e-10) {
    return false;
  }  
  return true;
}

/** Build a dense (N=256) grid of (r, F(r), dF/dr) for given M,A,r0. */ 
function initFPGrid(M, A, r0, N) {  // Removed unused _rmin_in/_rmax_in params (#4/#11 fix from v2 review).
  if (!N) N = 256;

  var rMin = Math.max(0.1 * M || 0.05, 0.01);   // Physics-derived defaults: scale with mass but floor at 0.01 (#16 fix — no unphysically small grid).  
  var rMax = Math.max(rMin + 8, rMin * (M > 3 ? 4 : 3));
  var dr = (rMax - rMin) / (N - 1);

  // Use a temporary array to make construction atomic (#17 fix — partial grid never stored if loop fails).  
  var tmpR = new Float64Array(N), 
      tmpF = new Float64Array(N),
      tmpFP = new Float64Array(N);  

  for (var i = 0; i < N; ++i) {
    var ri = rMin + dr * i;  
    tmpR[i] = ri;

    try {
      // Compute F(r) — guard against NaN from hypergeom overflow (#14).  
      tmpF[i] = lapseF(ri, M, A, r0);  

      if (!isFinite(tmpF[i])) throw new Error('NaN in F');  // Abort grid construction on bad value.
      
      var hi2p = Math.max(rMin * 5e-7, dr / (N + 4));  
      tmpFP[i] = isFinite(hi2p) ? 
        ((lapseF(ri + hi2p, M, A, r0) - lapseF(ri - hi2p, M, A, r0)) / (2.0 * hi2p)) : 0;

      if (!isFinite(tmpFP[i])) throw new Error('NaN in dF/dr');
    } catch(e) {  
      // Abort: don't store partial grid — caller will fall back to numerical differentiation at runtime (#14/#17 fix). 
      return false;  
    }
  }

  // Only commit the grid if ALL values were valid (atomic write #17 fix).  
  fp_grid = {r: tmpR, f: tmpF, fp: tmpFP};
  last_fp_params = {M: M, A: A, r0: r0}; 
  return true; // Indicate successful construction.
}

/** Evaluate pre-computed F'(r) via linear interpolation on the grid (with explicit params #1 fix). */  
function getFPrimeInterp(r, M_val_in, A_val_in, r0_val_in) {  // Explicit param names (#1 critical blocking fix — matches physics function convention).
  if (!_paramsMatch(M_val_in, A_val_in, r0_val_in)) initFPGrid(M_val_in, A_val_in, r0_val_in);

  var grid = fp_grid; 
  if (!grid || !isFinite(grid.r[0])) return lapseFPrime(r, M_val_in, A_val_in, r0_val_in); // fallback
  
  // Binary search for interval containing r.  
  var lo = 0, hi = grid.r.length - 1;
  
  while (hi - lo > 1) {var mid = ((lo + hi) >> 1); if (grid.r[mid] <= r) lo = mid; else hi = mid;}

  // Clamp to nearest point. 
  if (r <= fp_grid.r[0]) return fp_grid.fp[0];
  if (r >= fp_grid.r[hi]) return fp_grid.fp[hi];  

  var ri_lo = fp_grid.r[lo], ri_hi = fp_grid.r[hi];

  // Guard against division by zero (#9 fix from v2 review).  
  var denom = ri_hi - ri_lo;
  if (!isFinite(denom) || Math.abs(denom) < 1e-20) return fp_grid.fp[lo];  

  return fp_grid.fp[lo] + (fp_grid.fp[hi] - fp_grid.fp[lo]) * ((r - ri_lo) / denom);  
}

/** Evaluate pre-computed F(r) via linear interpolation on the grid. */
function getFInterp(r, M_val_in, A_val_in, r0_val_in) {  // Explicit param names (#1 fix — consistent with other functions).
  if (!_paramsMatch(M_val_in, A_val_in, r0_val_in)) initFPGrid(M_val_in, A_val_in, r0_val_in);

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
function initFPGridIfNeeded(M, A, r0) {  // Explicit param names (#1 fix — consistent with physics function convention).
  var gp = last_fp_params;
  if (!gp || Math.abs(gp.M - M) > 1e-8 
    || Math.abs(gp.A - A) > 1e-9 || Math.abs(gp.r0 - r0) > 1e-10) initFPGrid(M, A, r0);  
}

// Original numerical differentiation — kept for calibration where accuracy matters.
function lapseFPrime(r, M, A, r0, h) { if (!h) h = 1e-7; return (lapseF(r + h, M, A, r0) - lapseF(r - h, M, A, r0)) / (2 * h); }
function lapseFDblPrime(r, M, A, r0, h) { if (!h) h = 1e-5; return (lapseF(r + h, M, A, r0) - 2 * lapseF(r, M, A, r0) + lapseF(r - h, M, A, r0)) / (h * h); }

export { lapseF, lapseFPrime, lapseFDblPrime, initFPGridIfNeeded, getFPrimeInterp };
