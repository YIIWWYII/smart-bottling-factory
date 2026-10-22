import DataModeSelector from './DataModeSelector';
import { TwinProvider,useTwin,recordEvent } from './TwinState';
import DigitalAssistant from './DigitalAssistant';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Monitor, PanelsTopLeft, SlidersHorizontal, ArrowUpRight, Sun, Moon } from 'lucide-react';
import '@fontsource/oxanium/500.css';
import '@fontsource/oxanium/600.css';
import '@fontsource-variable/noto-sans-sc';
import '@fontsource/ibm-plex-mono/400.css';
import Display from './Display';
import Station from './Station';
import Admin from './ManagementCenter';
import { Toast } from './ui';
import { initialAlerts, initialTasks } from './data';
import './styles.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/zcool-qingke-huangyou/400.css';
import './hierarchy.css';
import './fusion.css';
import './prismatic-ui.css';
import './workspace-fixes.css';

const routes=[{id:'display',label:'数字展板',icon:Monitor},{id:'station',label:'工位终端',icon:SlidersHorizontal},{id:'admin',label:'管理中心',icon:PanelsTopLeft}];
function getRoute(){const hash=location.hash.slice(1);return routes.some(r=>r.id===hash)?hash:'display';}
function App(){
  const {ops,error,refresh}=useTwin();
  const alerts=ops?.alerts||[];
  const [route,setRoute]=useState(getRoute),[toast,setToast]=useState(''),[time,setTime]=useState(new Date().toLocaleTimeString('zh-CN',{hour12:false}));
  const [colorMode,setColorMode]=useState(()=>localStorage.getItem('bottleworks-color-mode')||'light');
  useEffect(()=>{localStorage.setItem('bottleworks-color-mode',colorMode);},[colorMode]);
  useEffect(()=>{recordEvent('page',({display:'数字展板',station:'工位终端',admin:'管理中心'})[route]);},[route]);
  const previousTheme=useRef(colorMode);useEffect(()=>{if(previousTheme.current!==colorMode)recordEvent('theme',colorMode==='dark'?'黑夜模式':'白昼模式');previousTheme.current=colorMode;},[colorMode]);
  const timer=useRef(null);
  useEffect(()=>{const onHash=()=>{setRoute(getRoute());window.scrollTo(0,0);};window.addEventListener('hashchange',onHash);const clock=setInterval(()=>setTime(new Date().toLocaleTimeString('zh-CN',{hour12:false})),1000);return()=>{window.removeEventListener('hashchange',onHash);clearInterval(clock);clearTimeout(timer.current);};},[]);
  const notify=message=>{setToast(message);clearTimeout(timer.current);timer.current=setTimeout(()=>setToast(''),3500);};
  if(!ops)return <main className="source-overview" aria-live="polite"><h1>{error?'暂时无法连接服务器':'正在连接数据服务'}</h1><p>{error?'请确认电脑服务已启动，设备与电脑处于同一网络。':'读取数据模式与产线状态…'}</p>{error&&<><p>当前地址：{location.origin}</p><p>应用内可使用返回键修改服务器地址。</p><button className="primary" onClick={refresh}>重新连接</button></>}</main>;
  return <div className={`demo-shell theme-${route}`} data-color-mode={colorMode}><nav className="demo-nav" aria-label="主要功能"><a className="app-wordmark" href="#display"><span className="wordmark-symbol">B<span>╱</span></span>瓶安智慧工厂<span className="brand-edition">工业智造</span></a><div>{routes.map(({id,label,icon:Icon})=><a key={id} href={`#${id}`} aria-current={route===id?'page':undefined} className={route===id?'active':''}><Icon size={14}/>{label}</a>)}</div><span className="demo-source"><i/><DataModeSelector colorMode={colorMode}/><span className="ex-theme-switch global-theme-switch" role="group" aria-label="显示主题"><button aria-pressed={colorMode==='light'} onClick={()=>setColorMode('light')}><Sun size={16}/><span>白昼</span></button><button aria-pressed={colorMode==='dark'} onClick={()=>setColorMode('dark')}><Moon size={16}/><span>黑夜</span></button></span></span></nav>{route==='display'?<Display time={time}/>:route==='station'?<Station notify={notify}/>:<Admin notify={notify}/>}<DigitalAssistant route={route}/><Toast message={toast}/></div>;
}
createRoot(document.getElementById('root')).render(<TwinProvider><App/></TwinProvider>);
