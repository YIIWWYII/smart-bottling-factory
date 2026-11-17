// Model gestures work directly on the canvas, without an overlay switch.
export function enableTouchOrbit(controls,canvas){
 controls.enabled=true;canvas.style.touchAction='none';
 let multi=false;const pointers=new Map();
 const down=e=>{if(e.pointerType==='touch'){if(!pointers.size)multi=false;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size>1)multi=true;}};
 const up=e=>{if(e.pointerType!=='touch')return;const start=pointers.get(e.pointerId);pointers.delete(e.pointerId);if(multi||!start||Math.hypot(e.clientX-start.x,e.clientY-start.y)>8)e.stopImmediatePropagation();};
 const cancel=e=>{pointers.delete(e.pointerId);multi=true;};
 canvas.addEventListener('pointerdown',down,true);canvas.addEventListener('pointerup',up,true);canvas.addEventListener('pointercancel',cancel,true);
 return()=>{canvas.removeEventListener('pointerdown',down,true);canvas.removeEventListener('pointerup',up,true);canvas.removeEventListener('pointercancel',cancel,true);};
}
