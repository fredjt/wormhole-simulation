function surfaceSigma(a, f_a, a_dot) {
  const inside=f_a+a_dot*a_dot;
  if(inside<0)return NaN;
  return -Math.sqrt(inside)/(2.0*Math.PI*a);
}

function tangentialPressure(a, f_prime, f_a, a_dot) {
  const st=Math.sqrt(Math.max(f_a+a_dot*a_dot,0));
  if(st<1e-15)return NaN;
  return(f_prime/(4.0*Math.PI*a*st))+(st/(2.0*Math.PI*a));
}

export { surfaceSigma, tangentialPressure };
