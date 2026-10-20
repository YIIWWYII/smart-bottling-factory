import {useLayoutEffect,useRef} from 'react';
// A single station housing: live scene above, settings in the middle, physical deck below.
export default function MachineConsole({profile,screen,controls,settings,device,navigation,pendingCount,aiActivity}){
 const deckRef=useRef(null);
 useLayoutEffect(()=>{
  const deck=deckRef.current;
  const updateAngle=()=>{
   const angle=-Math.atan(deck.clientWidth*.03/deck.clientHeight)*180/Math.PI;
   deck.style.setProperty('--deck-screen-angle',`${angle}deg`);
   const frame=deck.querySelector('.console-ai-screen-frame');
   const manual=deck.querySelector('.console-manual-zone');
   deck.style.setProperty('--screen-divider-top',`${frame.getBoundingClientRect().top-manual.getBoundingClientRect().top}px`);
   deck.style.setProperty('--screen-divider-height',`${frame.offsetHeight}px`);
  };
  const observer=new ResizeObserver(updateAngle);
  observer.observe(deck);
  updateAngle();
  return ()=>observer.disconnect();
 },[]);
 const toolbar=(<div className="console-middle-toolbar"><div><strong>{profile.title}</strong><span>{device}</span></div><span className={pendingCount?'has-draft':''}>{pendingCount?'待下发 '+pendingCount+' 项':'无待下发操作'}</span>{navigation}</div>);
 const deck=(<div className="console-deck-perspective"><div className="machine-live-deck" ref={deckRef}><span className="deck-fasteners" aria-hidden="true"><i/><i/><i/><i/></span><div className="console-deck-zones"><section className="console-ai-zone" aria-label="AI 记录展示"><div className="deck-rail"><span>AI 记录</span><small>操作、依据与结果</small></div><div className="console-ai-screen-frame"><div className="console-ai-log-screen">{aiActivity}</div></div></section><section className="console-manual-zone" aria-label="人工操作台"><div className="deck-rail"><span>人工操作</span><small>调节 · 核对 · 保存</small></div>{controls}</section></div></div></div>);
 const information=<section className="console-information"><div className="console-zone-label">设定信息 <small>已确认值与待设定值</small></div><div className="machine-live-screen">{screen}<div className="screen-softkeys"><span>模拟设备</span><span>系统回执 / 待设定</span></div></div></section>;
 return <div className={`machine-console machine-${profile.kind}`} style={{'--machine-accent':`rgb(${profile.color.map(v=>Math.round(v*255)).join(' ')})`}}>
 {toolbar}<div className="console-upright">{information}{settings}</div>{deck}
 </div>;
}
