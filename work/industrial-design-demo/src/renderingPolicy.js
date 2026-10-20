import {WebGLRenderer} from 'three';

// A browser backend is selected by the desktop launcher, never by a WebGL option.
export const renderingMode=window.__BOTTLEWORKS_RENDERING__||'software';
export const renderingProfile=renderingMode==='hardware'?{dpr:1.5,fps:60}:renderingMode==='hybrid'?{dpr:1.25,fps:30}:{dpr:1,fps:24};
export function createRenderer(options={}){
 const renderer=new WebGLRenderer({...options,powerPreference:renderingMode==='hardware'?'high-performance':'low-power'});
 const setPixelRatio=renderer.setPixelRatio.bind(renderer);
 renderer.setPixelRatio=ratio=>setPixelRatio(Math.min(ratio,renderingProfile.dpr));
 renderer.domElement.dataset.renderingMode=renderingMode;
 return renderer;
}
