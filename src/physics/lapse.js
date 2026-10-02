// Regularized Letelier-Alencar string-cloud black hole lapse function
// Paper: arXiv:2610.00131, Eq. 2.1-2.2
// F(r) = [1 - (2M/r - A·r₀²/r² · ₂F₁(-½,-¼;¾;-r⁴/r₀⁴))](1 + r₀/r)⁻⁴
// Parameters: M=mass, A=string-cloud strength, r₀=regularization scale

function hypergeom2F1(a, b, c, z) {
  // Compute ₂F₁(a,b;c;z) using series expansion with analytic continuation
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
    return series(a, b, c, z, 500, 1e-14);
  }
  // Analytic continuation for |z| > 0.9
  var factor = Math.pow(1 - z, -b);
  var zNew = z / (z - 1);
  return factor * series(c - a, b, c, zNew, 500, 1e-14);
}

function lapseF(r, M, A, r0) {
  // F(r) = [1 - (2M/r - A·r₀²/r² · ₂F₁(-½,-¼;¾;-r⁴/r₀⁴))](1 + r₀/r)⁻⁴
  if (r <= 0) return 1.0;
  var z = -(r / r0) * (r / r0) * (r / r0) * (r / r0); // -r⁴/r₀⁴
  var fg = hypergeom2F1(-0.5, -0.25, 0.75, z);
  var bracket = 1.0 - (2.0 * M / r - A * r0 * r0 / (r * r) * fg);
  var regulator = Math.pow(1.0 + r0 / r, -4);
  return bracket * regulator;
}

function lapseFPrime(r, M, A, r0, h) {
  if (!h) h = 1e-7;
  return (lapseF(r + h, M, A, r0) - lapseF(r - h, M, A, r0)) / (2 * h);
}

function lapseFDblPrime(r, M, A, r0, h) {
  if (!h) h = 1e-5;
  return (lapseF(r + h, M, A, r0) - 2 * lapseF(r, M, A, r0) + lapseF(r - h, M, A, r0)) / (h * h);
}

export { lapseF, lapseFPrime, lapseFDblPrime };
