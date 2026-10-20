// API responses are JSON trees. Reuse unchanged branches so scene assets and
// control maps do not invalidate their consumers on every polling response.
export function retainSnapshot(previous,next){
 if(Object.is(previous,next))return previous;
 if(!previous||!next||typeof previous!=='object'||typeof next!=='object'||Array.isArray(previous)!==Array.isArray(next))return next;
 const keys=Object.keys(next),result=Array.isArray(next)?[]:{};
 let unchanged=keys.length===Object.keys(previous).length;
 for(const key of keys){
  const exists=Object.hasOwn(previous,key);
  const value=exists?retainSnapshot(previous[key],next[key]):next[key];
  Object.defineProperty(result,key,{value,writable:true,enumerable:true,configurable:true});
  if(!exists||value!==previous[key])unchanged=false;
 }
 return unchanged?previous:result;
}
