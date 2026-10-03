function computeSigmaFromEOS(a, a0, sigma0, model, params) {
  const ratio=a/a0;
  if(model==='barotropic')return sigma0*Math.pow(ratio,-2*(1+(params.omega||0)));
  if(model==='phantom'){const Ap=params.Ap||1,n=params.n||5,alpha_p=params.alpha_p||1,w=-(Ap+Ap*Math.pow(ratio,alpha_p))/(1+Ap)-n*(ratio-1)/a0;return sigma0*Math.pow(ratio,-2*(1+w));}
  if(model==='chaplygin'){const Ac=params.Ac||1,ac=params.alpha_c||0.5;const val=sigma0*sigma0+Ac*(1-Math.pow(ratio,-2*ac));return Math.sign(sigma0)*Math.sqrt(Math.max(val,0));}
  if(model==='cosmicChap'){const Agc=params.Agc||1,ngc=params.n_gc||2;return sigma0*Math.pow(ratio,-ngc)+Agc*(1-Math.pow(ratio,-ngc));}
  if(model==='modCosmicChap'){const Amcc=params.Amcc||1,mmcc=params.m_mcc||2;return sigma0*Math.pow(ratio,-mmcc)+Amcc*(1-Math.pow(ratio,-mmcc));}
  return sigma0;
}

let M_val=1.0,beta_val=0.3,mu_val=0.5,a0_val=1.5,eosModel='barotropic',eosParams={omega:0};
let calibrated=false, simRunning=false, simPaused=false, tau=0, a_current=1, v_current=0;
let timeHistory=[], phaseHistory=[], speedMultiplier=5, autoStop=true;

export { computeSigmaFromEOS };
