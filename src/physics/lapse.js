// Regularized Letelier-Alencar string-cloud black hole lapse function
// Paper: arXiv:2610.00131, Eq. 2.1-2.2
// F(r) = [1 - (2M/r - A*r_0^2/r^2 * _2F_1(-1/2,-1/4;3/4;-r^4/r_0^4))](1 + r_0/r)^{-4}

function hypergeom2F1(a, b, c, z) {
  // Compute _2F\u{c6}\u{b5}(a,b;c;z) using series expansion with analytic continuation.
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

  if (Math.abs(z) <= 0.9) {
    var iter = Math.min(500 * (2 + Math.floor(Math.abs(z))), 1000);
    return series(a, b, c, z, iter, 1e-14);
  }
  // Analytic continuation for |z| > 0.9: factor*(1-z)^(-b) identity.
  var factor = Math.pow(1 - z, -b);
  var zNew = z / (z - 1);
  if (Math.abs(zNew) < 0.95) {
    return factor * series(c - a, b, c, zNew, 500, 1e-14);
  }
  // Extreme |z| after continuation: many iterations for precision.
  var iter2 = Math.min(500 * (2 + Math.floor(Math.abs(z))), 3000);
  return factor * series(c - a, b, c, zNew, iter2, 1e-14);
}

function lapseF(r, M, A, r0) {
  // F(r) = [1 - (2M/r - A*r_0^2/r^2 * _2F_1(-\u{b5},-\u{c6};3/4;-r^4/r_0^4))](1 + r_0/r)^{-4}
  if (r <= 0) return 1.0;
  var ratio = r / r0;
  var z = -(ratio * ratio * ratio * ratio); // -r^4/r_0^4

  var fg = hypergeom2F1(-0.5, -0.25, 0.75, z);
  var bracket = 1.0 - (2.0 * M / r - A * r0 * r0 / (r * r) * fg);
  return bracket * Math.pow(1.0 + r0 / r, -4);
}

// ================================================================
// Pre-computed F(r), dF/dr grid for fast interpolation during simulation.
// Built once per parameter set before integration starts via initFPGrid().
// During RK4 steps we look up precomputed values instead of calling
// numerical-differentiation functions that each trigger hypergeom2F1 calls.

var fp_grid = null;  // {r: Float64Array, f: Float64Array, fp: Float64Array}
var last_fp_params = null;

/** Build a grid of (r, F(r), dF/dr) for given M,A,r0 over [rMin,rMax]. */
function initFPGrid(M, A, r0, _rmin_in, _rmax_in, N) {
  if (!N) N = 256;

  // Default bounds: cover the typical simulation range.
  var rMin = (typeof _rmin_in === 'number' && isFinite(_rmin_in)) ? Math.max(1e-4, _rmin_in - 0.3 * _rmin_in) : 0.1;
  var rMax = typeof _rmax_in === 'number' && isFinite(_rmax_in)
    ? (_rmax_in > rMin ? _rmax_in : Math.max(rMin + Math.max(10, rMin * 4), rMin))
    : (Math.max(5.0, rMin + Math.max(8, rMin * 3)));

  var dr = (rMax - rMin) / (N - 1); // spacing between grid points
  
  // High-accuracy step size for numerical derivatives on the grid.
  var hfp = Math.min(1e-8, Math.max(rMin * 5e-7, dr / (N + 2)));

  fp_grid = {
    r: new Float64Array(N),
    f: new Float64Array(N),
    fp: new Float64Array(N)
  };

  for (var i = 0; i < N; ++i) {
    var ri = rMin + dr * i;
    fp_grid.r[i] = ri;
    fp_grid.f[i] = lapseF(ri, M, A, r0);
    // Central difference with very small step for high accuracy.
    if (hfp > 1e-9 && hfp < ri * 0.4) {
      var hi2p = Math.min(hfp, ri * 5e-7);
      fp_grid.fp[i] = (lapseF(ri + hi2p, M, A, r0) - lapseF(ri - hi2p, M, A, r0)) / (2.0 * hi2p);
    } else {
      var ha = Math.min(hfp, ri * 5e-7); if (ha < 1e-9) ha = 1e-8;
      fp_grid.fp[i] = (lapseF(ri + ha, M, A, r0) - lapseF(ri - ha, M, A, r0)) / (2.0 * ha);
    }
  }

  last_fp_params = {M: M, A: A, r0: r0};
}

/** Evaluate pre-computed F'(r) via linear interpolation on the grid. */
function getFPrimeInterp(r, M, A, r0) {
  var gp = last_fp_params;
  // Check if parameters match; rebuild if needed.
  if (!gp || Math.abs(gp.M - M) > 1e-6 || Math.abs(gp.A - A) > 1e-6 ||
      Math.abs(gp.r0 - r0) > 1e-8) {
    initFPGrid(M, A, r0);
  }

  var grid = fp_grid; if (!grid) return lapseFPrime(r, M, A, r0); // fallback to numerical.

  // Binary search for index of the interval containing r.
  var lo = 0, hi = grid.r.length - 1;
  while (hi - lo > 1) {
    var mid = ((lo + hi) >> 1);
    if (grid.r[mid] <= r) lo = mid; else hi = mid;
  }

  // Clamp to nearest point.
  if (r <= grid.r[0]) return fp_grid.fp[0];
  if (r >= grid.r[hi]) return fp_grid.fp[hi];

  var ri_lo = fp_grid.r[lo], ri_hi = fp_grid.r[hi];
  // Linear interpolation between adjacent grid points.
  return fp_grid.fp[lo] + (fp_grid.fp[hi] - fp_grid.fp[lo]) * ((r - ri_lo) / (ri_hi - ri_lo));
}

/** Evaluate pre-computed F(r) via linear interpolation on the grid. */
function getFInterp(r, M, A, r0) {
  var gp = last_fp_params;
  if (!gp || Math.abs(gp.M - M) > 1e-6 || Math.abs(gp.A - A) > 1e-6 ||
      Math.abs(gp.r0 - r0) > 1e-8) initFPGrid(M, A, r0);

  var grid = fp_grid; if (!grid) return lapseF(r, M, A, r0); // fallback to direct evaluation.

  var lo = 0, hi = grid.r.length - 1;
  while (hi - lo > 1) {
    var mid = ((lo + hi) >> 1);
    if (grid.r[mid] <= r) lo = mid; else hi = mid;
  }

  // Clamp to nearest point.
  if (r <= grid.r[0]) return fp_grid.f[0];
  if (r >= grid.r[hi]) return fp_grid.f[hi];

  var ri_lo = fp_grid.r[lo], ri_hi = fp_grid.r[hi];
  // Linear interpolation between adjacent grid points.
  return fp_grid.f[lo] + (fp_grid.f[hi] - fp_grid.f[lo]) * ((r - ri_lo) / (ri_hi - ri_lo));
}

/** Rebuild the F'(r)-grid before starting a simulation run if parameters changed. */
function initFPGridIfNeeded(M, A, r0) {
  var gp = last_fp_params;
  if (!gp || Math.abs(gp.M - M) > 1e-6 || Math.abs(gp.A - A) > 1e-6 ||
      Math.abs(gp.r0 - r0) > 1e-8) initFPGrid(M, A, r0);
}

// Original numerical differentiation — kept for calibration/stability analysis where accuracy matters.
function lapseFPrime(r, M, A, r0, h) {
  if (!h) h = 1e-7; // original step size from the codebase  
  return (lapseF(r + h, M, A, r0) - lapseF(r - h, M, A, r0)) / (2 * h);
}

function lapseFDblPrime(r, M, A, r0, h) {
  if (!h) h = 1e-5; // original step size from the codebase  
  return (lapseF(r + h, M, A, r0) - 2 * lapseF(r, M, A, r0) + lapseF(r - h, M, A, r0)) / (h * h);
}

export { lapseF, lapseFPrime, lapseFDblPrime, initFPGridIfNeeded, getFPrimeInterp };
