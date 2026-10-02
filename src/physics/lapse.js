function lapseF(r, M, beta, mu) {
  if (r <= 0) return 1.0;
  const r2=r*r, r3=r2*r, mu2=mu*mu, mu3=mu2*mu;
  return 1.0 - (2.0*M*r3)/(r3+mu3)/r - (beta*mu2)/(r2+mu2);
}

function lapseFPrime(r, M, beta, mu) {
  if (r <= 0) return 0;
  const r2=r*r, r3=r2*r, mu2=mu*mu, mu3=mu2*mu;
  const num1=2.0*M*r2, den1=r3+mu3;
  const term1=(4.0*M*r*den1 - num1*3.0*r2)/(den1*den1);
  const term2=(-beta*mu2*2.0*r)/((r2+mu2)*(r2+mu2));
  return term1 + term2;
}

export { lapseF, lapseFPrime };
