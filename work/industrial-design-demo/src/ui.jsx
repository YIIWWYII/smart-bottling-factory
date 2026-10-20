import { useEffect, useRef } from 'react';
import { X, ArrowUpRight, Check, CircleHelp } from 'lucide-react';

export function IconButton({ icon: Icon=CircleHelp, label, onClick, className='', ...props }) {
  return <button type="button" className={`icon-button ${className}`} title={label} aria-label={label} onClick={onClick} {...props}><Icon size={18}/></button>;
}
export function Brand({compact=false}) {return <div className={`brand ${compact?'compact':''}`}><div className="brand-mark"><i/><i/><i/></div><div><strong>瓶安智慧工厂<span className="brand-period">.</span></strong>{!compact&&<small>瓶安智慧工厂</small>}</div></div>;}
export function Badge({children,tone=''}){return <span className={`badge ${tone}`}><span className="dot"/>{children}</span>;}
export function SectionLabel({no,children,aside}) {return <div className="section-label"><span>{no&&<em className="mono">{no}</em>}{children}</span>{aside&&<span className="muted">{aside}</span>}</div>;}
export function Stat({label,value,unit,change,children}) {return <div className="stat"><span className="stat-label">{label}</span><div className="stat-number">{value}<small>{unit}</small></div><div className="stat-foot">{change&&<span><ArrowUpRight size={13}/>{change}</span>}{children}</div></div>;}
export function Modal({title,eyebrow,children,onClose,className=''}){
  const ref=useRef(null), close=useRef(onClose); close.current=onClose;
  useEffect(()=>{const el=ref.current;el.showModal();const cancel=e=>{e.preventDefault();close.current();};el.addEventListener('cancel',cancel);return()=>{el.removeEventListener('cancel',cancel);el.close();};},[]);
  return <dialog ref={ref} className={`modal ${className}`} onClick={e=>{if(e.target===ref.current){const r=ref.current.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}><div className="modal-top"><div>{eyebrow&&<small className="eyebrow">{eyebrow}</small>}<h2>{title}</h2></div><IconButton icon={X} label="关闭" onClick={onClose}/></div>{children}</dialog>;
}
export function Toast({message}) {return message&&<div className="toast" role="status"><Check size={17}/>{message}</div>;}
