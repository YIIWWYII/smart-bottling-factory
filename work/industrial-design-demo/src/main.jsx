import DataModeSelector from './DataModeSelector';
import { TwinProvider,useTwin,recordEvent,api } from './TwinState';
import DigitalAssistant from './DigitalAssistant';
import AlarmNotifications from './AlarmNotifications';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Monitor, PanelsTopLeft, SlidersHorizontal, ArrowUpRight, Network, Sun, Moon } from 'lucide-react';
import '@fontsource/oxanium/500.css';
import '@fontsource/oxanium/600.css';
import '@fontsource-variable/noto-sans-sc';
import '@fontsource/ibm-plex-mono/400.css';
import Display from './Display';
import Station from './Station';
import Admin from './ManagementCenter';
import { Modal, Toast } from './ui';
import { initialAlerts, initialTasks } from './data';
import './styles.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/zcool-qingke-huangyou/400.css';
import './hierarchy.css';
import './fusion.css';
import './prismatic-ui.css';
import './workspace-fixes.css';

const routes=[{id:'display',label:'数字展板',icon:Monitor},{id:'station',label:'工位终端',icon:SlidersHorizontal},{id:'admin',label:'管理中心',icon:PanelsTopLeft}];
const platformName='鸿眸瓶安——AI驱动的智慧工厂协同系统';
function readView(){
 const hash=location.hash.slice(1);
 if(hash==='station'){
  const requestedStage=Number(sessionStorage.getItem('preview-stage')??0);
  const stage=Number.isInteger(requestedStage)&&requestedStage>=0&&requestedStage<9?requestedStage:0;
  return {route:hash,stage,tab:'equipment',showLogistics:stage>=7&&sessionStorage.getItem('station-logistics')==='open'};
 }
 if(hash==='admin')return {route:hash};
 const showProcess=new URLSearchParams(location.search).get('course')==='process'||sessionStorage.getItem('display-view')==='logistics';
 return {route:'display',displayView:showProcess?'process':'drink',dimension:'3d'};
}
const routeNames={display:'数字展板',station:'工位终端',admin:'管理中心'};
const virtualAdapter=/virtual|^vethernet|hyper-v|vmware|virtualbox|docker|wsl|loopback|vpn|tailscale|wireguard|^tap|^tun/i;
const addressHelp='请输入电脑 IP 或完整的网址，包含平台端口。';
function PlatformAddressButton({colorMode}){
  const [open,setOpen]=useState(false);
  const [addresses,setAddresses]=useState(null);
  const [address,setAddress]=useState(location.origin);
  const [message,setMessage]=useState('');
  const input=useRef(null);
  useEffect(()=>{
    if(!open)return;
    const controller=new AbortController();
    fetch('/api/platform/addresses',{signal:controller.signal}).then(response=>{
      if(!response.ok)throw Error();
      return response.json();
    }).then(items=>{
      if(controller.signal.aborted)return;
      setAddresses(items);
      setAddress(value=>value===location.origin?(items.find(item=>!virtualAdapter.test(item.name))?.origin||value):value);
    }).catch(()=>{if(!controller.signal.aborted)setAddresses([]);});
    return()=>controller.abort();
  },[open]);
  const getAddress=()=>{
    const value=address.trim();
    const host=/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)?`${value}${location.port?`:${location.port}`:''}`:value;
    const target=new URL(host.includes('://')?host:`${location.protocol}//${host}`);
    if(!['http:','https:'].includes(target.protocol)||target.username||target.password||target.pathname!=='/'||target.search||target.hash)throw Error();
    return target.origin;
  };
  const copyAddress=async()=>{
    let target;
    try{target=getAddress();}catch{setMessage(addressHelp);return;}
    try{await navigator.clipboard.writeText(target);setMessage('地址已复制。');}
    catch{
      const field=input.current;
      if(!field)return;
      setAddress(target);
      field.value=target;
      field.focus();field.select();
      setMessage(document.execCommand('copy')?'地址已复制。':'地址已选中，请手动复制。');
    }
  };
  const lan=addresses?.filter(item=>!virtualAdapter.test(item.name))??[];
  const other=addresses?.filter(item=>virtualAdapter.test(item.name))??[];
  const select=origin=>{setAddress(origin);setMessage('');};
  return <><button type="button" className="platform-address-button" aria-label="平台地址" title="平台地址" onClick={()=>{setAddresses(null);setAddress(location.origin);setMessage('');setOpen(true);}}><Network size={17}/><span>平台地址</span></button>
    {open&&<Modal title="平台地址" className={`platform-address-modal address-${colorMode}`} onClose={()=>setOpen(false)}>
      <section className="platform-lan-panel" aria-label="现场连接">
        <strong>现场连接</strong>
        <p>其他电脑和平板请连同一个路由器，再打开下方地址。</p>
        {addresses===null?<p>正在读取地址…</p>:lan.length?<ul aria-label="局域网地址">{lan.map(({name,origin})=><li key={origin}><button type="button" aria-pressed={address===origin} onClick={()=>select(origin)}><code>{origin}</code><span>{/wlan|wi-?fi|无线/i.test(name)?'无线网络':name}</span></button></li>)}</ul>:<p>没有读到局域网地址。请检查平台电脑的网络和启动方式。</p>}
      </section>
      <p className="platform-current">当前网页 <code>{location.origin}</code>{/^(localhost|127\.|\[::1\])/.test(location.hostname)&&<span>仅本机</span>}</p>
      {other.length>0&&<details className="platform-other-addresses"><summary>虚拟网卡地址</summary><p>用于这台电脑里的虚拟网络，现场其他设备通常不用。</p><ul>{other.map(({name,origin})=><li key={origin}><button type="button" aria-pressed={address===origin} onClick={()=>select(origin)}><code>{origin}</code><span>{name}</span></button></li>)}</ul></details>}
      <form onSubmit={event=>{event.preventDefault();try{location.assign(new URL(`${location.pathname}${location.search}${location.hash}`,getAddress()).href);}catch{setMessage(addressHelp);}}}>
        <label>要打开或复制的地址<input ref={input} value={address} onChange={event=>{setAddress(event.target.value);setMessage('');}} inputMode="url" autoComplete="off" spellCheck={false} required/></label>
        <div className="platform-address-actions"><button type="button" onClick={copyAddress}>复制地址</button><button type="submit">打开地址</button></div>
        <p role="status" className="platform-address-status">{message}</p>
      </form>
    </Modal>}</>;
}
function App(){
  const {ops,error,refresh}=useTwin();
  const alerts=ops?.alerts||[];
  const [alarmPulse,setAlarmPulse]=useState(null);
  const [view,setView]=useState(readView),[toast,setToast]=useState(''),[time,setTime]=useState(new Date().toLocaleTimeString('zh-CN',{hour12:false}));
  const [colorMode,setColorMode]=useState(()=>localStorage.getItem('bottleworks-color-mode')||'light');
  useEffect(()=>{localStorage.setItem('bottleworks-color-mode',colorMode);},[colorMode]);
  const {route}=view;
  const viewRevision=useRef(0),pendingViews=useRef(0),viewQueue=useRef(Promise.resolve());
  useEffect(()=>{recordEvent('page',routeNames[readView().route]);},[]);
  useEffect(()=>{
    const shared=ops?.sharedView;
    if(!shared||shared.revision<=viewRevision.current||pendingViews.current)return;
    viewRevision.current=shared.revision;
    if(location.hash!==`#${shared.route}`){
      history.replaceState(history.state,'',`#${shared.route}`);
      window.scrollTo(0,0);
    }
    setView(shared);
  },[ops]);
  const previousTheme=useRef(colorMode);useEffect(()=>{if(previousTheme.current!==colorMode)recordEvent('theme',colorMode==='dark'?'黑夜模式':'白昼模式');previousTheme.current=colorMode;},[colorMode]);
  const timer=useRef(null);
  const notify=React.useCallback(message=>{setToast(message);clearTimeout(timer.current);timer.current=setTimeout(()=>setToast(''),3500);},[]);
  const publishView=React.useCallback(next=>{
    setView(next);
    pendingViews.current++;
    viewQueue.current=viewQueue.current.then(async()=>{
      try{
        const saved=await api('/api/ops/shared-view',next,AbortSignal.timeout(8000));
        viewRevision.current=saved.revision;
      }catch(e){notify(`页面同步失败：${e.message}`);}
      finally{pendingViews.current--;}
    });
  },[notify]);
  useEffect(()=>{
    const onHash=()=>{
      const next=readView();
      publishView(next);
      recordEvent('page',routeNames[next.route]);
      window.scrollTo(0,0);
    };
    window.addEventListener('hashchange',onHash);
    const clock=setInterval(()=>setTime(new Date().toLocaleTimeString('zh-CN',{hour12:false})),1000);
    return()=>{window.removeEventListener('hashchange',onHash);clearInterval(clock);clearTimeout(timer.current);};
  },[publishView]);
  useEffect(()=>{
    if(route==='station'){
      sessionStorage.removeItem('preview-stage');
      sessionStorage.removeItem('station-logistics');
    }
    if(route==='display')sessionStorage.removeItem('display-view');
  },[route]);
  if(!ops)return <main className="source-overview" aria-live="polite"><h1>{error?'暂时无法连接服务器':'正在连接数据服务'}</h1><p>{error?'请确认电脑服务已启动，设备与电脑处于同一网络。':'读取数据模式与产线状态…'}</p>{error&&<><p>当前地址：{location.origin}</p><button className="primary" onClick={refresh}>重新连接</button> <PlatformAddressButton colorMode={colorMode}/></>}</main>;
  return <div className={`demo-shell theme-${route}`} data-color-mode={colorMode}><nav className="demo-nav" aria-label="主要功能"><a className="app-wordmark" href="#display"><span className="wordmark-symbol">B<span>╱</span></span><span className="app-wordmark-copy"><strong>鸿眸瓶安</strong><small>AI驱动的智慧工厂协同系统</small></span></a><div className="demo-nav-pages">{routes.map(({id,label,icon:Icon})=><a key={id} href={`#${id}`} aria-current={route===id?'page':undefined} className={route===id?'active':''}><Icon size={14}/>{label}</a>)}</div><span className="demo-source"><AlarmNotifications onAlarm={setAlarmPulse}/><PlatformAddressButton colorMode={colorMode}/><i/><DataModeSelector colorMode={colorMode}/><span className="ex-theme-switch global-theme-switch" role="group" aria-label="显示主题"><button aria-pressed={colorMode==='light'} onClick={()=>setColorMode('light')}><Sun size={16}/><span>白昼</span></button><button aria-pressed={colorMode==='dark'} onClick={()=>setColorMode('dark')}><Moon size={16}/><span>黑夜</span></button></span></span></nav>{route==='display'?<Display time={time} pageView={view} onViewChange={publishView}/>:route==='station'?<Station notify={notify} pageView={view} onViewChange={publishView}/>:<Admin notify={notify}/>}<DigitalAssistant route={route} alarmPulse={alarmPulse}/><Toast message={toast}/></div>;
}
createRoot(document.getElementById('root')).render(<TwinProvider><App/></TwinProvider>);
