function initSim(){const f_a0=lapseF(a0_val,M_val,beta_val,mu_val);if(f_a0<=0)return;let deltaAPct=parseFloat(document.getElementById('sliderDeltaA').value);if(document.getElementById('chkSmallPerturb').checked)deltaAPct=0.01;v_current=parseFloat(document.getElementById('sliderV0').value);tau=0;a_current=a0_val*(1+deltaAPct/100);timeHistory=[{tau:0,a:a_current,v:v_current}];phaseHistory=[{a:a_current,v:v_current}];calibrated=true;}

export { initSim };
