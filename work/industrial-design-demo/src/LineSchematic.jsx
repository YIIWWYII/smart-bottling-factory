import { useEffect, useRef } from 'react';
import { animate } from 'animejs';
import { stages } from './data';

export const stateLabels={running:'运行',warning:'预警',stopped:'暂停',fault:'故障'};
export const mapPositions=[[145,115],[430,115],[715,115],[145,320],[430,320],[715,320],[715,520],[430,520],[145,520]];
// Bottle flow and the separate beverage supply branch follow the real process.
const routes=[{a:0,b:1,d:'M245 115H330'},{a:1,b:2,d:'M530 115H615'},{a:2,b:4,d:'M715 190V218H430V245'},{a:3,b:4,d:'M245 320H330',supply:true},{a:4,b:5,d:'M530 320H615'},{a:5,b:6,d:'M715 395V445'},{a:6,b:7,d:'M615 520H530'},{a:7,b:8,d:'M330 520H245'}];
export function Equipment({index}){
 if(index===3)return <g><ellipse cx="-24" cy="-14" rx="20" ry="7"/><path d="M-44-14V21Q-24 35-4 21V-14M-24-22V-34M-34-34H-14M-4 12H12"/><ellipse cx="31" cy="-14" rx="20" ry="7"/><path d="M11-14V21Q31 35 51 21V-14M31-22V-34M21-34H41"/></g>;
 if(index===6)return <g><path d="M-42 28H14M-30 28V17L-15-8 12-28 42-5M-20 15L0-7 19-14 35 1M38-1V15M29 15H49M29 15V24M49 15V24"/><circle cx="-20" cy="13" r="9"/><circle cx="13" cy="-22" r="8"/><path d="M29 28H51V43H29Z"/></g>;
 if(index===7)return <g><path d="M-48 3L-35-12H35L48 3V23H-48ZM-27-12V-36H27V-12M-48 3H48"/><circle cx="-29" cy="25" r="8"/><circle cx="29" cy="25" r="8"/><path d="M-9 12H9M0-36V-12"/></g>;
 if(index===8)return <g><path d="M-49-35V36M49-35V36M-49-9H49M-49 17H49M-49 36H49M-40-32H-8V-12H-40ZM7-32H39V-12H7ZM-40-5H-8V14H-40ZM7-5H39V14H7Z"/></g>;
 if(index===0)return <g><path d="M-52 14V33H52V14M-46 38H46M-40-35H40"/>{[-28,0,28].map(x=><g key={x} transform={`translate(${x} 0)`}><path d="M-8-31H8V-12L4-7V0H-4V-7L-8-12Z"/><path className="scan-beam" d="M0 22V7M-5 14L0 7 5 14"/></g>)}</g>;
 if(index===1)return <g><path d="M-35 30V-22Q-35-37-20-37H20Q35-37 35-22V30ZM-43 31H43M35-7H51V-24H41"/><circle cx="0" cy="-20" r="12"/><path className="scan-beam" d="M0-20L7-27"/><path d="M-10 23V4L-5-2V-5H5V-2L10 4V23Z"/><circle cx="-23" cy="7" r="2"/><circle cx="23" cy="14" r="2"/></g>;
 if(index===2)return <g><path d="M-53 30H53M-41 29V-29H-21M-52-30H-26V-9H-52ZM-26-25L-15-29V-10L-26-14"/><ellipse cx="13" cy="-3" rx="28" ry="32" fill="none"/><path d="M4 22V-9L8-14V-23H18V-14L22-9V22Z"/><path className="scan-beam" d="M-12-19L3-12M-12-3L3 1M30-27L40-32"/></g>;
 if(index===4)return <g><path d="M-36-38H36V-20L22-11H-22L-36-20ZM0-11V-3M-38-3H38M-52 32H52"/>{[-28,0,28].map(x=><g key={x} transform={`translate(${x} 0)`}><path d="M0-3V5M-8 27V15L-4 11V8H4V11L8 15V27Z"/><path className="scan-beam" d="M-5 22H5"/></g>)}</g>;
 return <g><path d="M-31 17H31L39 28H-39ZM-33 29V38H33V29M-10 13V-17L-5-22V-30H5V-22L10-17V13ZM25 14V-35H54V-10H25"/><path className="scan-beam" d="M31-22H46M-7 0H7M-49-17H-17"/><path d="M-49-28V-7M-55-28H-43M-55-7H-43"/></g>;

}
export default function LineSchematic({states,selected,onSelect}){
 const root=useRef();
 useEffect(()=>{
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const anim=animate(root.current.querySelectorAll('.route-active'),{strokeDashoffset:[0,-32],duration:1100,ease:'linear',loop:true});
  return()=>anim.revert();
 },[states.map(s=>s.mode).join(',')]);
 return <div className="schematic-wrap" ref={root}><svg viewBox="0 0 860 640" role="group" aria-label="二维产线实时状态图">
  <defs><pattern id="plant-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#34506c"/></pattern></defs>
  <rect width="860" height="640" fill="url(#plant-grid)" opacity=".45"/>
  {routes.map(({a,b,d,supply})=>{const stopped=[a,b].some(i=>['stopped','fault'].includes(states[i].mode));return <g key={`${a}-${b}`} className={`schematic-route ${stopped?'route-stopped':''} ${supply?'route-supply':''}`}><path d={d} className="route-bed"/><path d={d} className={stopped?'route-halted':'route-active'}/></g>;})}
  <text x="258" y="301" className="supply-label">供液</text>
  {mapPositions.map(([x,y],i)=>{const live=states[i],halted=['stopped','fault'].includes(live.mode);return <g key={i} transform={`translate(${x} ${y})`} className={`schematic-device state-${live.mode} ${selected===i?'selected':''}`} role="button" tabIndex="0" aria-label={`${stages[i].name} ${stateLabels[live.mode]}`} aria-pressed={selected===i} onClick={()=>onSelect(i)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(i);}}}>
   <rect x="-100" y="-75" width="200" height="151" rx="18" className="device-plinth"/>
   <text x="-82" y="-51" className="schematic-number">{String(i+1).padStart(2,'0')}</text><circle cx="76" cy="-52" r="6" className="schematic-led"/>
   <g className={`equipment-glyph ${halted?'halted':''}`} transform="translate(0 -3) scale(.8)"><Equipment index={i}/></g>
   <text y="46" textAnchor="middle" className="schematic-name">{stages[i].short} · {live.source==='real'?'实':'模'}</text><text y="65" textAnchor="middle" className="schematic-reading">{live.quality==='offline'?'离线 / 数据过期':stateLabels[live.mode]} · {live.quality==='offline'?'—':live.rate} 瓶/min</text>
   {live.mode==='fault'&&<text x="73" y="-23" className="fault-symbol">!</text>}
  </g>;})}
 </svg></div>;
}
