import {useState} from 'react';
import ActivityFeed from './ActivityFeed';
import AutomationPanel from './AutomationPanel';
export default function AIHub(){const [tab,setTab]=useState('auto');return <div className="ai-hub"><nav className="hub-tabs">{[['auto','识别与调控'],['records','AI 记录']].map(([k,v])=><button key={k} className={tab===k?'active':''} onClick={()=>setTab(k)}>{v}</button>)}</nav>{tab==='auto'?<AutomationPanel/>:<ActivityFeed/>}</div>;}
