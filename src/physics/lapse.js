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

  //   // Piecewise iteration count scaled with |z|.
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
    if (r <= 0 || !isFinite(M) || !isFinite(A) || !isFinite(r0)) return NaN;
  var ratio = r / r0;
  // Compute -r^4/r_0^4 correctly as -(x² * x²).  
  var z = -(ratio * ratio) * (ratio * ratio);

  var fg = hypergeom2F1(-0.5, -0.25, 0.75, z);
    // Guard against NaN from extreme values.
  if (!isFinite(fg)) return Math.pow(1.0 + r0 / r, -4);

  var bracket = 1.0 - (2.0 * M / r - A * r0 * r0 / (r * r) * fg);
  return bracket * Math.pow(1.0 + r0 / r, -4);  
}

// ================================================================
// Pre-computed F(r), dF/dr grid for fast interpolation during simulation. 
var fp_grid = null;   // {r: Float64Array, f: Float64Array, fp: Float64Array}  
var last_fp_params = null;  // Last (M,A,r0) used to build the current grid

/** Rebuild params check — deduplicated helper (updated from iterative review). */
function _paramsMatch(M_in, A_in, r0_val_in) {  
  var gp = last_fp_params;
  // Tolerances relaxed to prevent unnecessary rebuilds on UI slider interactions. 
  // Original: M=1e-8, A=1e-9, r0=1e-10 — too tight vs IEEE 754 float noise from string→float conversion (#3 fix).  
  if (!gp || Math.abs(gp.M - M_in) > 1e-7 
    || Math.abs(gp.A - A_in) > 1e-6 || Math.abs(gp.r0 - r0_val_in) > 1e-7) {  
    return false;
  }
  return true;
}

/** Build a dense (N=256) grid of (r, F(r), dF/dr) for given M,A,r0. */ 
function initFPGrid(M, A, r0, N) {
  if (!N || !isFinite(N)) N = 256;

    var rMin = Math.max(0.1 * M || 0.05, 0.01);
  if (!isFinite(rMin)) { console.warn('initFPGrid: non-finite rMin'); return false; }
  var rMax = Math.max(rMin + 8, rMin * (M > 3 ? 4 : 3));
  if (!isFinite(rMax) || rMax <= rMin) { console.warn('initFPGrid: invalid grid bounds'); return false; }

    // Compute grid spacing.
  var dr = (rMax - rMin) / (N - 1);
  if (!isFinite(dr)) { console.warn('initFPGrid: non-finite grid spacing'); return false; }

  // Use a temporary array to make construction atomic (#17 fix — partial grid never stored if loop fails).  
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

      var hi2p = Math.max(rMin * 5e-7, dr / (N + 4));  
      tmpFP[i] = isFinite(hi2p) ? 
        ((lapseF(ri + hi2p, M, A, r0) - lapseF(ri - hi2p, M, A, r0)) / (2.0 * hi2p)) : 0;

      if (!isFinite(tmpFP[i])) throw new Error('NaN in dF/dr');
        } catch(e) {
      console.warn('initFPGrid abort at index ' + i + ': ' + e);
      return false;

    }
  }

  // Only commit the grid if ALL values were valid (atomic write #17 fix). No second loop needed.
  fp_grid = {r: tmpR, f: tmpF, fp: tmpFP};
  last_fp_params = {M: M, A: A, r0: r0}; 
  return true; // Indicate successful construction.
}

/** Evaluate pre-computed F'(r) via linear interpolation on the grid.
/** Evaluate pre-computed F'(r) via linear interpolation on the grid.
 * Uses explicit params: getFPrimeInterp(r, M_val_in, A_val_in, r0_val_in). */
function getFPrimeInterp(r, M_val_in, A_val_in, r0_val_in) {
  if (!_paramsMatch(M_val_in, A_val_in, r0_val_in)) initFPGrid(M_val_in, A_val_in, r0_val_in);

  var grid = fp_grid;
  if (!grid || !isFinite(grid.r[0])) return lapseFPrime(r, M_val_in, A_val_in, r0_val_in); // fallback

  var lo = _binarySearch(0, grid.r.length - 1, grid.r, r);

  if (r <= fp_grid.r[lo]) return fp_grid.fp[lo];
  if (r >= fp_grid.r[grid.r.length - 1]) return fp_grid.fp[grid.r.length - 1];

  var ri_lo = grid.r[lo], ri_hi = grid.r[lo + 1];

  // Guard against division by zero.
  var denom = ri_hi - ri_lo;
  if (!isFinite(denom) || Math.abs(denom) < 1e-20) return fp_grid.fp[lo];

  /** Evaluate pre-computed F(r) via linear interpolation on the grid. */
function getFInterp(r, M_val_in, A_val_in, r0_val_in) {
  if (!_paramsMatch(M_val_in, A_val_in, r0_val_in)) initFPGrid(M_val_in, A_val_in, r0_val_in);

  var grid = fp_grid;
  if (!grid || !isFinite(grid.r[0])) return lapseF(r, M_val_in, A_val_in, r0_val_in); // fallback

  var lo = _binarySearch(0, grid.r.length - 1, grid.r, r);

  if (r <= fp_grid.r[lo]) return fp_grid.f[lo];
  if (r >= fp_grid.r[grid.r.length - 1]) return fp_grid.f[grid.r.length - 1];

  var ri_lo = grid.r[lo], ri_hi = grid.r[lo + 1];
  var denom = ri_hi - ri_lo;
  if (!isFinite(denom) || Math.abs(denom) < 1e-20) return fp_grid.f[lo];

  // Linear interpolation between adjacent grid points.
  return fp_grid.f[lo] + (fp_grid.f[grid.r.length - 1] - fp_grid.f[lo]) * ((r - ri_lo) / denom);
}
/* ---- Internal helpers for binary-search interpolation ------------------------------------------ */
/** Binary search: returns largest index lo such that arr[lo] <= r. */
function _binarySearch(lo, hi, arr, r) {
  while (hi - lo > 1) { var mid = ((lo + hi) >> 1); if (arr[mid] <= r) lo = mid; else hi = mid; }
  return lo;
}

return grid.fp[lo] + (grid.fp[lo + 1] - grid.fp[lo]) * ((r - ri_lo) / denom);
}
function lapseFDblPrime(r, M, A, r0, h) { if (!h) h = 1e-5; return (lapseF(r + h, M, A, r0) - 2 * lapseF(r, M, A, r0) + lapseF(r - h, M, A, r0)) / (h * h); }

export { lapseF, lapseFPrime, lapseFDblPrime, initFPGridIfNeeded, getFPrimeInterp };
