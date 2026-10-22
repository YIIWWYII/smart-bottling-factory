import RenderingSettings from './RenderingSettings';
import ServiceIntegrationPanel from './ServiceIntegrationPanel';
import KnowledgePanel from './KnowledgePanel';
import StandardDataPanel from './StandardDataPanel';
import OperationsCenter from './OperationsCenter';
import ProductWorkspace from './ProductWorkspace';
import DeviceAssets from './DeviceAssets';
import ProductStandards from './ProductStandards';
import DatabasePanel from './DatabasePanel';
import MaterialInventory from './MaterialInventory';
import AISettings from './AISettings';
import ActivityFeed from './ActivityFeed';
import LogisticsPanel from './LogisticsPanel';
import DeviceConnections from './DeviceConnections';
import TaskPanel from './TaskPanel';
import LogPanel from './LogPanel';
import AIHub from './AIHub';
import EmployeePanel from './EmployeePanel';
import { useTwin,recordEvent } from './TwinState';
import { Equipment } from './LineSchematic';
import BlenderScene, { deviceCodes } from './BlenderScene';
import { useMemo, useState, useEffect, useRef } from 'react';
import { Workflow, ArrowDownToLine, ArrowRight, ArrowUpRight, Bell, Box, BookOpen, CalendarDays, Check, ChevronDown, ChevronRight, CircleCheck, Cable, BrainCircuit, ClipboardList, Clock3, Cpu, FileText, LayoutDashboard, Plus, Search, Settings2, ShieldCheck, SlidersHorizontal, TriangleAlert, X } from 'lucide-react';
import { Brand, Badge, IconButton, Modal, SectionLabel } from './ui';
import Chart from './Chart';
import { stages, hourly, formatNumber, processGroups, equipmentAssets } from './data';

const menuGroups=[
 {id:'overview',label:'工作台',items:[{id:'overview',label:'管理总览',en:'OVERVIEW',icon:LayoutDashboard}]},
 {id:'resources',label:'01 资源准备',items:[{id:'materials',label:'物料准备',en:'MATERIALS',icon:Box},{id:'products',label:'产品资源',en:'PRODUCTS',icon:Box},{id:'knowledge',label:'原始资料与审核',en:'KNOWLEDGE',icon:BookOpen},{id:'standards',label:'AI 资料整理',en:'STANDARD DATA',icon:FileText},{id:'devices',label:'设备资产',en:'EQUIPMENT',icon:Cpu},{id:'employees',label:'人员与权限',en:'PEOPLE & ACCESS',icon:ShieldCheck}]},
 {id:'planning',label:'02 任务管理',items:[{id:'schemes',label:'方案承接',en:'SCHEMES',icon:ClipboardList},{id:'tasks',label:'排程室',en:'SCHEDULING',icon:CalendarDays},{id:'production',label:'下发运行',en:'PRODUCTION',icon:Workflow},{id:'records',label:'档案室',en:'ARCHIVE',icon:BookOpen},{id:'deleted',label:'任务垃圾箱',en:'TRASH',icon:Box}]},
 {id:'execution',label:'03 执行跟踪',items:[{id:'ai',label:'识别与调控',en:'ADAPTIVE CONTROL',icon:BrainCircuit},{id:'logistics',label:'物流运输',en:'LOGISTICS',icon:ArrowRight},{id:'warehouse',label:'仓储管理',en:'WAREHOUSE',icon:Box}]},
 {id:'improvement',label:'04 运行审计',items:[{id:'alerts',label:'预警与处理',en:'EXCEPTIONS',icon:TriangleAlert},{id:'logs',label:'日志中心',en:'EVENT HISTORY',icon:FileText}]},
 {id:'configuration',label:'系统配置',items:[{id:'rendering',label:'渲染与性能',en:'RENDERING',icon:Settings2},{id:'connections',label:'设备配置',en:'DEVICE CONFIGURATION',icon:Cable},{id:'database',label:'数据配置',en:'DATA SOURCES',icon:BookOpen},{id:'models',label:'AI 配置',en:'AI CONFIGURATION',icon:BrainCircuit}]},
];
const menu=menuGroups.flatMap(group=>group.items.map(item=>({...item,groupId:group.id,groupLabel:group.label}))).concat({id:'vision',label:'AI 配置',en:'AI CONFIGURATION',groupId:'configuration',groupLabel:'系统配置',icon:BrainCircuit});


export default function Admin({notify}) {
  const workspaceRef=useRef(null);
  useEffect(()=>{
   const update=()=>{const el=workspaceRef.current;if(!el)return;const top=Math.max(0,Math.min(el.getBoundingClientRect().top,window.innerHeight-200));el.style.setProperty('--engineering-nav-top',`${top}px`);};
   update();window.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update);
   return()=>{window.removeEventListener('scroll',update);window.removeEventListener('resize',update);};
  },[]);
  const twin=useTwin();
  const tasks=(twin.ops?.tasks||[]).filter(t=>!t.deletedAt&&!t.archivedAt),alerts=twin.ops?.alerts||[];
  const [navOpen,setNavOpen]=useState(false);
  const [taskArea,setTaskArea]=useState('schedule'),[view,setView]=useState(()=>{const target=new URLSearchParams(location.search).get('course');return menu.some(item=>item.id===target)?target:'overview';}),[query,setQuery]=useState(''),[filter,setFilter]=useState('全部状态'),[modal,setModal]=useState(null);
  const current=menu.find(m=>m.id===view),activeAlerts=alerts.filter(a=>!a.done),pending=tasks.filter(t=>t.status==='待生产'||t.status==='已排程');
  const changeView=id=>{recordEvent('view','工程管理 / '+menu.find(m=>m.id===id).label);setView(id);setNavOpen(false);setQuery('');setFilter('全部状态');window.scrollTo({top:0,behavior:'instant'});};
  return <main ref={workspaceRef} className={`admin-app engineering-refined ${navOpen?'nav-open':''}`} data-section={current.groupId} data-page={view}><button className="admin-nav-toggle" aria-expanded={navOpen} onClick={()=>setNavOpen(!navOpen)}><LayoutDashboard size={18}/>工程导航 · {current.label}<ChevronDown size={17}/></button><aside className="admin-sidebar"><div className="admin-brand"><span>瓶安</span><strong>工程管理</strong></div><div className="workspace-switch"><div className="workspace-logo">B</div><div><strong>瓶安智慧工厂</strong><small>任务、设备与人员管理</small></div><ChevronDown size={14}/></div><nav className="admin-grouped-nav" aria-label="工程管理功能分组">{menuGroups.map(group=><section key={group.id} data-section={group.id} className={`admin-nav-group ${current.groupId===group.id?'is-current':''}`}><h2 className="admin-group-label">{group.label}</h2><div className="admin-group-items">{group.items.map(({id,label,icon:Icon})=><button title={label} aria-label={label} aria-current={(view===id||id==='models'&&view==='vision')?'page':undefined} className={(view===id||id==='models'&&view==='vision')?'active':''} onClick={()=>changeView(id)} key={id}><Icon size={18}/><span>{label}</span>{id==='alerts'&&activeAlerts.length>0&&<b>{activeAlerts.length}</b>}</button>)}</div></section>)}</nav><div className="sidebar-bottom"><div className="system-health"><i className="dot"/><span>本机数据服务<small>连接状态见设备配置</small></span></div><div className="admin-user"><span className="avatar">{twin.ops?.user.name?.slice(0,1)||'—'}</span><span>{twin.ops?.user.name||'读取身份中'}<small>{twin.ops?.roles[twin.ops.user.role]||'演示身份'}</small></span></div></div></aside>
    <div className="admin-workspace"><header className="admin-topbar"><div className="admin-breadcrumb"><span>工程管理</span><ChevronRight size={14}/><span>{current.groupLabel}</span><ChevronRight size={14}/><strong>{current.label}</strong></div><div><span className="mono">{new Date().toLocaleDateString('zh-CN')}</span><span className="top-divider"/><IconButton icon={Bell} label="查看待处理异常" onClick={()=>changeView('alerts')}/><span className="avatar">{twin.ops?.user.name?.slice(0,1)||'—'}</span></div></header>
    <div className="admin-content"><div className="admin-page-heading"><div><h1>{view==='overview'?'管理总览':current.label}</h1>{!['connections','database','models','vision','rendering'].includes(view)&&<p>{view==='overview'?'管理生产任务、资源与规则。设备操作在工位终端完成。':view==='products'?'管理产品资料、配方工艺与展示素材。':view==='materials'?'在安排任务前核对原料、包材与耗材准备情况。':view==='production'?'跟踪下发、生产、暂停与完成；具体设备控制在工位终端。':view==='records'?'查看已归档任务、归档类型与生产记录。':view==='deleted'?'恢复误删任务，或彻底删除不再需要的任务记录。':view==='schemes'?'查看已采用的运营方案，关联具体任务并跟踪落实。':view==='database'?'查看数据来源、存储位置与标准资料。':view==='logs'?'按时间、类型和操作人查询运行与操作记录。':['models','vision'].includes(view)?'接收视觉检测服务与已发布智能体，配置连接并验证结果。':view==='tasks'?'安排生产批次、负责人和计划时段，排程完成后进入生产执行。':view==='devices'?'维护设备档案、工序归属、图片与模型。':view==='logistics'?'管理运输任务与避障策略，查看执行记录。':view==='warehouse'?'管理库位、出入库策略与库存流水。':view==='connections'?'配置设备通信、工序关联与数据接收。':view==='alerts'?'跟踪现场异常，记录处理结果。':view==='ai'?'识别产品并应用已发布配方，追溯判断与执行。':view==='employees'?'管理员工职责、工位权限与操作记录。':'查看当前工作区信息。'}</p>}</div></div>
    {view==='overview'&&<><section className="management-workbench"><header><div><small>当前工作</small><h2>任务与异常</h2></div><span>当前有效任务与资源</span></header><div className="management-priorities">{[{label:'待排程',count:tasks.filter(t=>['待排程','排程中'].includes(t.status)).length,note:'安排顺序与生产时间',view:'tasks',area:'schedule'},{label:'待下发',count:tasks.filter(t=>['已排程','待生产'].includes(t.status)).length,note:'核对备料、负责人和计划',view:'tasks',area:'run'},{label:'待处理异常',count:activeAlerts.length,note:'跟进责任人与处理结果',view:'alerts'},{label:'生产中',count:tasks.filter(t=>t.status==='生产中').length,note:'查看当前批次与执行进度',view:'production'}].map(v=><button key={v.label} onClick={()=>{if(v.area)setTaskArea(v.area);changeView(v.area==='run'?'production':v.view);}}><span>{v.label}</span><strong>{v.count}<small>项</small></strong><p>{v.note}</p><ArrowUpRight size={20}/></button>)}</div></section><section className="management-resources"><header><h2>资源与规则</h2><p>维护配置与权限，在工位端查看和执行现场任务。</p></header><div>{[{view:'logistics',title:'运输与仓储',text:`${twin.logistics?.queue.length||0} 项调度候选 · ${twin.logistics?.inventory.length||0} 个占用库位`},{view:'connections',title:'设备配置',text:`${twin.states.filter(v=>v.source==='real'&&v.quality==='live').length} 个工位真实在线 · 接入映射与诊断`},{view:'employees',title:'员工与权限',text:`${twin.ops?.employees.filter(e=>e.enabled).length||0} 名启用员工 · 工种与工位授权`},{view:'database',title:'数据配置',text:'选择模拟或真实数据，查看存储与标准资料'}].map(v=><button key={v.view} onClick={()=>changeView(v.view)}><strong>{v.title}</strong><span>{v.text}</span><ArrowUpRight size={18}/></button>)}</div></section><ActivityFeed today/></>}
    {['tasks','production','records','deleted'].includes(view)&&<TaskPanel key={view} initialView={view==='production'?'run':view==='records'?'archived':view==='deleted'?'deleted':'schedule'} allowedViews={view==='production'?['run']:view==='records'?['archived']:view==='deleted'?['deleted']:['schedule']}/>}
    {view==='schemes'&&<OperationsCenter engineering/>}{view==='products'&&<ProductWorkspace/>}{view==='materials'&&<MaterialInventory/>}
    {['vision','models'].includes(view)&&<AISettings key={view} initialKind="vision"/>}{view==='knowledge'&&<KnowledgePanel/>}{view==='standards'&&<StandardDataPanel/>}
    {view==='logs'&&<LogPanel/>}
    {['logistics','warehouse'].includes(view)&&<LogisticsPanel management warehouse={view==='warehouse'}/>}
    {view==='connections'&&<DeviceConnections/>}
    {view==='devices'&&<DeviceAssets onInspect={asset=>{const i=asset.stageIndex,v=twin.states[i];setModal({type:'device',item:{...stages[i],name:asset.name,stageName:stages[i].name,stageIndex:i,equipmentType:asset.type,code:asset.code,value:v.value,status:v.mode}});}}/>}
    {view==='alerts'&&<section className="exception-list"><div className="directory-summary"><Badge tone="warning">{activeAlerts.length} 项待处理</Badge><span>{alerts.filter(a=>a.done).length} 项已处理</span></div>{alerts.map(a=><article className={`exception ${a.done?'resolved':''}`} key={a.id}><span className="exception-icon">{a.done?<CircleCheck size={24}/>:<TriangleAlert size={24}/>}</span><div><div><span className="mono muted">{a.id} · {a.time}</span><Badge tone={a.done?'':'warning'}>{a.done?'已处理':a.severity}</Badge></div><h3>{a.title}</h3><p>{a.detail}</p><small>所属工序：{a.stage}</small></div><button className="secondary" disabled={a.done} onClick={()=>setModal({type:'alert',item:a})}>{a.done?'已完成':'处理异常'}<ChevronRight size={15}/></button></article>)}</section>}
    {view==='ai'&&<AIHub/>}{view==='database'&&<DatabasePanel/>}
    {view==='rendering'&&<RenderingSettings/>}{view==='employees'&&<EmployeePanel/>}
    <footer className="admin-footer"><span>瓶安智慧工厂 · 工程管理</span><span><i className="dot"/>{({simulation:'模拟数据',real:'真实数据',mixed:'真实优先 · 缺失模拟'})[twin.dataMode]} · MySQL 持久化</span></footer></div></div>
    {modal&&<Modal title={modal.type==='create'?'新建生产任务':modal.type==='task'?modal.item.name:modal.type==='alert'?'确认异常处理':modal.type==='device'?modal.item.name:modal.item.title} onClose={()=>setModal(null)} eyebrow={modal.item?.id||modal.item?.code||'PRODUCTION / NEW TASK'}>
      {modal.type==='device'&&<><div className="admin-device-model"><BlenderScene compact device={deviceCodes[modal.item.stageIndex]}/></div><Badge tone={modal.item.status==='需关注'?'warning':''}>{modal.item.status}</Badge><dl className="detail-list"><div><dt>所属工序</dt><dd>{modal.item.stageName}</dd></div><div><dt>设备类型</dt><dd>{modal.item.equipmentType}</dd></div><div><dt>设备编号</dt><dd className="mono">{modal.item.code}</dd></div><div><dt>当前读数</dt><dd>{modal.item.value} {modal.item.unit}</dd></div><div><dt>工序合格率</dt><dd>{modal.item.quality}%</dd></div><div><dt>运行来源</dt><dd>{twin.states[modal.item.stageIndex].sourceReason||'读取中'}</dd></div><div><dt>维护周期</dt><dd>200 小时 / 次</dd></div></dl><div className="modal-actions"><button className="primary" onClick={()=>setModal(null)}>关闭详情</button></div></>}
      {modal.type==='alert'&&<><h3>{modal.item.title}</h3><p className="modal-copy">{modal.item.detail}</p><p className="muted">确认后将该演示事件标记为已处理，并将处理结果与操作日志存入数据库。</p><div className="modal-actions"><button className="secondary" onClick={()=>setModal(null)}>取消</button><button className="primary" onClick={async()=>{try{await twin.mutate('/api/ops/alerts/resolve',{id:modal.item.id});setModal(null);notify('异常处理与日志已存入数据库');}catch(e){notify(e.message);}}}><Check size={16}/>确认已处理</button></div></>}
    </Modal>}
  </main>;
}
