import {useState} from 'react';
import Admin from './Admin';
import OperationsCenter from './OperationsCenter';
import './management.css';
export default function ManagementCenter(props){const [mode,setMode]=useState(()=>['devices','connections','models','standards','rendering'].includes(new URLSearchParams(location.search).get('course'))?'engineering':'operations');return <><nav className="management-mode" aria-label="管理中心工作区"><button aria-pressed={mode==='operations'} onClick={()=>setMode('operations')}>运营决策</button><button aria-pressed={mode==='engineering'} onClick={()=>setMode('engineering')}>工程管理</button></nav>{mode==='operations'?<OperationsCenter/>:<Admin {...props}/>}</>;}
