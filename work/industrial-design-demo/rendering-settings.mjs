import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';

export const renderingModes=['software','hybrid','hardware'];
export function readRenderingMode(root){
 try {const mode=JSON.parse(fs.readFileSync(path.join(root,'.local-rendering.json'),'utf8')).mode;return renderingModes.includes(mode)?mode:'software';}catch{return 'software';}
}
export function browserArgs(mode,profile,url){
 if(!renderingModes.includes(mode))throw Error('Unknown rendering mode');
 return [`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check',
  ...(mode==='software'?['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu-compositing']:[]),
  '--new-window',url];
}
export function renderingPlugin(){
 let root;
 return {name:'bottleworks-rendering',configResolved(config){root=config.root;},
  transformIndexHtml(){return [{tag:'script',children:`window.__BOTTLEWORKS_RENDERING__=${JSON.stringify(readRenderingMode(root))};`,injectTo:'head-prepend'}];},
  configureServer(server){server.middlewares.use('/api/rendering',async(req,res)=>{
   const send=(code,data)=>{res.statusCode=code;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
   try{
    const local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    if(req.method==='GET')return send(200,{mode:readRenderingMode(root),local});
    if(!local)return send(403,{error:'请在运行平台服务的电脑上修改渲染设置。'});
    if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return send(403,{error:'不允许跨站请求'});
    if(req.method!=='POST')return send(405,{error:'Method not allowed'});
    let body='';for await(const chunk of req){body+=chunk;if(body.length>2048)return send(413,{error:'请求过大'});}
    const input=JSON.parse(body||'{}');
    if(req.url==='/'||req.url===''){
     if(!renderingModes.includes(input.mode))return send(400,{error:'无效的渲染模式'});
     fs.writeFileSync(path.join(root,'.local-rendering.json'),JSON.stringify({mode:input.mode},null,2)+'\n');
     return send(200,{mode:input.mode});
    }
    if(req.url==='/open'){
     if(process.platform!=='win32')return send(400,{error:'专用窗口目前支持 Windows 桌面启动器。'});
     const browser=[process.env.PROGRAMFILES,process.env['PROGRAMFILES(X86)'],process.env.LOCALAPPDATA].filter(Boolean).flatMap(base=>[path.join(base,'Google/Chrome/Application/chrome.exe'),path.join(base,'Microsoft/Edge/Application/msedge.exe')]).find(p=>fs.existsSync(p));
     if(!browser)return send(400,{error:'未找到 Chrome 或 Edge'});
     const mode=readRenderingMode(root),base=fs.existsSync('F:/BottleAI')?'F:/BottleAI/browser':path.join(process.env.LOCALAPPDATA,'Bottleworks/browser');
     const profile=path.join(base,mode);fs.mkdirSync(profile,{recursive:true});
     const url=`http://127.0.0.1:${server.config.server.port||5174}/?rendering=${mode}#display`;
     await new Promise((resolve,reject)=>{const child=spawn(browser,browserArgs(mode,profile,url),{detached:true,stdio:'ignore',windowsHide:false});child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});});
     return send(200,{mode});
    }
    send(404,{error:'Not found'});
   }catch(error){send(500,{error:error.message});}
  });}
 };
}
