// Touch navigation stays scrollable until the user explicitly enters model manipulation.
export function enableTouchOrbit(controls,canvas){
 const media=matchMedia('(any-pointer: coarse)'),host=canvas.parentElement;
 const button=document.createElement('button');button.type='button';button.className='touch-model-toggle';
 let active=false,multi=false;const pointers=new Map();
 const sync=()=>{button.hidden=!media.matches;controls.enabled=!media.matches||active;canvas.style.touchAction=media.matches&&!active?'pan-y pinch-zoom':'none';button.textContent=active?'完成 · 滑动页面':'操作模型 · 单指旋转 / 双指缩放';button.setAttribute('aria-pressed',String(active));};
 const toggle=e=>{e.stopPropagation();active=!active;sync();};button.addEventListener('pointerdown',e=>e.stopPropagation());button.addEventListener('pointerup',e=>e.stopPropagation());button.addEventListener('click',toggle);host.appendChild(button);
 const down=e=>{if(e.pointerType==='touch'){if(!pointers.size)multi=false;controls.enabled=active;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size>1)multi=true;}else controls.enabled=true;};
 const up=e=>{if(e.pointerType!=='touch')return;const start=pointers.get(e.pointerId);pointers.delete(e.pointerId);if(multi||!start||Math.hypot(e.clientX-start.x,e.clientY-start.y)>8)e.stopImmediatePropagation();};
 const cancel=e=>{pointers.delete(e.pointerId);multi=true;};
 canvas.addEventListener('pointerdown',down,true);canvas.addEventListener('pointerup',up,true);canvas.addEventListener('pointercancel',cancel,true);media.addEventListener('change',sync);sync();
 return()=>{button.remove();media.removeEventListener('change',sync);canvas.removeEventListener('pointerdown',down,true);canvas.removeEventListener('pointerup',up,true);canvas.removeEventListener('pointercancel',cancel,true);};
}
