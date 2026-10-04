// Optimized integrator: uses precomputed F'(r) grid for barotropic EOS via 
// effPotPrimeBarotropicFast() during RK4 steps — zero hypergeom calls.
let lastTime = 0;

function rk4Step(dt) {
  if(!calibrated)return;
  const f_a0=lapseF(a0_val,M_val,A_val,r0_val);
  if(f_a0<=0)return;
  // Pre-compute sigma₀ once — exact analytical value from EOS at equilibrium.
  const _sigma0=-Math.sqrt(f_a0)/(2*Math.PI*a0_val);

  function deriv(state){const[a,v]=state;if(a<=0)return[0,0];
    let Vp;
    if(eosModel==='barotropic')Vp=effPotPrimeBarotropicFast(a,a0_val,_sigma0,eosParams.omega||0,M_val,A_val,r0_val);  // #1 fix — pass explicit params
    else Vp=effPotPrime(a,a0_val,_sigma0,eosModel,eosParams);
    return[v,-Vp/2];}

  const s=[a_current,v_current];
  const k1=deriv(s),s2=[s[0]+k1[0]*dt/2,s[1]+k1[1]*dt/2],k2=deriv(s2);
  const s3=[s[0]+k2[0]*dt/2,s[1]+k2[1]*dt/2],k3=deriv(s3);
  const s4=[s[0]+k3[0]*dt,s[1]+k3[1]*dt],k4=deriv(s4);
  a_current+=(k1[0]+2*k2[0]+2*k3[0]+k4[0])*dt/6;
  v_current+=(k1[1]+2*k2[1]+2*k3[1]+k4[1])*dt/6;
  tau+=dt;
  timeHistory.push({tau:tau,a:a_current,v:v_current});
  phaseHistory.push({a:a_current,v:v_current});
  if(timeHistory.length>2000)timeHistory.shift();
  if(phaseHistory.length>2000)phaseHistory.shift();
  if(autoStop&&(a_current<0.1*r0_val||a_current>50||tau>500))simRunning=false;
}


function mainLoop(timestamp) {
  const dtReal = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;
  if (simRunning && !simPaused) {
    const dtSim = dtReal * speedMultiplier;
    const subSteps = Math.max(1, Math.ceil(dtSim / 0.01));
    const dtSub = dtSim / subSteps;
    for (let i = 0; i < subSteps; i++) rk4Step(dtSub);
  }
  if (!G.threeFailed && G.renderer) {
    resizeThreeJS();
    updateShellVisualization(a_current);
    G.renderer.render(G.scene, G.camera);
  }
  drawPotentialGraph();
  drawTimeSeries();
  drawPhaseSpace();
  updateStatus();
  requestAnimationFrame(mainLoop);
}

export { rk4Step, mainLoop };



