function findHorizons(M, A, r0) {
  // Cap search radius to avoid hypergeom2F1 |z|>1e⁶ warnings: keep (r/r₀)⁴ ≤ ~65k → r/r₀ ≤ ~16.
  const RMAX_FACTOR = 4;   // Cover up to ~4× mass scale — sufficient for all expected horizons
  const rMin=Math.max(0.001*r0,0.001),
        rMax=Math.min(Math.max(RMAX_FACTOR*M, 2.0*M), Math.max(r0*16,M));
  const N=500, rs=[], fs=[];
  for(let i=0;i<=N;i++){const r=rMin+(rMax-rMin)*i/N;rs.push(r);fs.push(lapseF(r,M,A,r0));}
  const crossings=[];
  for(let i=0;i<N;i++){if(fs[i]*fs[i+1]<=0)crossings.push([rs[i],rs[i+1]]);}
  if(!crossings.length) return [null,null];
  const roots=[];
  for(let[lo,hi]of crossings){for(let j=0;j<80;j++){const mid=(lo+hi)/2,fmid=lapseF(mid,M,A,r0),flo=lapseF(lo,M,A,r0);if(Math.abs(fmid)<1e-12||(hi-lo)<1e-12)break;if(flo*fmid<=0)hi=mid;else lo=mid;}roots.push((lo+hi)/2);}
  roots.sort((a,b)=>a-b);return[roots[roots.length-1],roots.length>1?roots[0]:null];
}

export { findHorizons };
