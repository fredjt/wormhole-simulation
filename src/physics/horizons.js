function findHorizons(M, beta, mu) {
  const rMin=Math.max(0.001*mu,0.001), rMax=Math.max(20.0*M,10.0);
  const N=500, rs=[], fs=[];
  for(let i=0;i<=N;i++){const r=rMin+(rMax-rMin)*i/N;rs.push(r);fs.push(lapseF(r,M,beta,mu));}
  const crossings=[];
  for(let i=0;i<N;i++){if(fs[i]*fs[i+1]<=0)crossings.push([rs[i],rs[i+1]]);}
  if(!crossings.length) return [null,null];
  const roots=[];
  for(let[lo,hi]of crossings){for(let j=0;j<80;j++){const mid=(lo+hi)/2,fmid=lapseF(mid,M,beta,mu),flo=lapseF(lo,M,beta,mu);if(Math.abs(fmid)<1e-12||(hi-lo)<1e-12)break;if(flo*fmid<=0)hi=mid;else lo=mid;}roots.push((lo+hi)/2);}
  roots.sort((a,b)=>a-b);return[roots[roots.length-1],roots.length>1?roots[0]:null];
}

export { findHorizons };
