// Discontinuous conveyor resets are station boundaries, never movement segments.
export function prepareProductTrack(track,times,duration){
 const distances=[];for(let i=1;i<times.length;i++){const a=(i-1)*3,b=i*3;distances.push(Math.hypot(...[0,1,2].map(k=>track.positions[b+k]-track.positions[a+k])));}
 const typical=[...distances].sort((a,b)=>a-b)[Math.floor(distances.length/2)]||.001;
 const resets=distances.flatMap((d,i)=>d>Math.max(.2,typical*8)?[i+1]:[]);
 return {...track,times,duration,resets,threshold:Math.max(.2,typical*8)};
}
export function sampleProduct(track,time){
 const {times,positions,duration,resets}=track;const t=((time%duration)+duration)%duration;
 let low=0,high=times.length-1;while(low+1<high){const m=(low+high)>>1;if(times[m]<=t)low=m;else high=m;}
 const jump=resets.includes(high),ratio=jump?0:(t-times[low])/(times[high]-times[low]);
 const position=[0,1,2].map(k=>positions[low*3+k]+(positions[high*3+k]-positions[low*3+k])*ratio);
 const seamJump=Math.hypot(...[0,1,2].map(k=>positions[k]-positions[(times.length-1)*3+k]))>track.threshold;
 const boundaries=[...resets.map(i=>times[i]),...(seamJump?[0,duration]:[])];
 const distance=boundaries.length?Math.min(...boundaries.map(v=>Math.abs(t-v))):1;
 const visibility=Math.min(1,Math.max(0,(distance-.04)/.16));
 const scale=[0,1,2].map(k=>(track.scales[low*3+k]+(track.scales[high*3+k]-track.scales[low*3+k])*ratio)*visibility);
 return {position,scale,visibility,sequence:resets.filter(i=>times[i]<=t).length,seamJump};
}

// Use one continuous pass through the authored path, never its loop/reset jump.
export function sampleMaterialPass(track,progress){
 if(!track.pass){const boundaries=[0,...track.resets,track.times.length];let best=[0,track.times.length-1],length=-1;
  for(let j=0;j<boundaries.length-1;j++){const a=boundaries[j],b=boundaries[j+1]-1,d=track.times[b]-track.times[a];if(d>length){length=d;best=[a,b];}}
  track.pass=best;
 }
 const [a,b]=track.pass,t=track.times[a]+(track.times[b]-track.times[a])*Math.min(.9999,Math.max(0,progress));
 const sample=sampleProduct(track,t);return sample.position;
}
