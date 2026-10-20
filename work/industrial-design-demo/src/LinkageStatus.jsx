import {useTwin} from './TwinState';
import {linkageInfo,safetyScenarios,facilityLabels} from './safetyScenarios';
export default function LinkageStatus({stageIndex}){
 const {safetyCases=[]}=useTwin();const links=safetyCases.map(linkageInfo).filter(s=>s&&s.action&&s.phase!=='resolved'&&(stageIndex==null||s.stageIndex===stageIndex||s.holds?.includes(stageIndex)));
 if(!links.length)return null;
 return <aside className="linkage-status" aria-live="polite">{links.map(s=><article key={s.id}><header><b>{s.sourceName}</b><span aria-label="触发联动"> → </span><strong>{s.target}</strong></header><p>触发原因：{s.reason}</p><p>联动结果：{s.outcome}（模拟）</p></article>)}</aside>;
}

export function DeviceAssociations({stageIndex}){
 const {safetyCases=[],dataMode}=useTwin();
 const rules=safetyScenarios.filter(s=>s.action&&(s.stageIndex===stageIndex||s.holds?.includes(stageIndex)));
 const groups=[...new Set(rules.map(s=>s.facility))];
 const active=rules.filter(s=>safetyCases.some(c=>c.id===s.id&&c.phase!=='resolved'));
 if(!rules.length)return <div className="station-associations empty"><strong>关联设备</strong><span>当前环节未配置设备联动</span></div>;
 return <details className="station-associations" key={stageIndex}><summary><strong>关联设备 · {groups.length} 组</strong><span>{groups.map(g=>facilityLabels[g]).join('、')}</span><b>{dataMode!=='simulation'?'联动状态未接入':active.length?`${active.length} 项联动中`:'待命'}</b><small>查看位置与触发条件</small></summary><div className="association-list">{rules.map(s=>{const current=safetyCases.find(c=>c.id===s.id&&c.phase!=='resolved'),info=current?linkageInfo(current):null;return <article key={s.id}><header><strong>{facilityLabels[s.facility]}</strong><b>{current?.phase==='awaiting-reset'?'等待复位':current?'联动中':'待命'}</b></header><p>{s.stageIndex!==stageIndex?(s.stageIndex===8?'位于仓储工位；运输为受联动设备。':'位于饮料准备工位；本工位为受联动设备。'):({cabinet:'位于外观检测设备旁的散热柜。',cooler:'位于料液罐右侧的冷却装置。',tank:'位于料液罐左侧的储液罐、阀门与供液泵。',stopper:'位于输送设备旁的挡瓶器与送料机构。',obstacle:'查看 AGV 本体及前方障碍区域。',warehouseVent:'位于货架前方的排热风机与温度探头。',warehouseDryer:'位于货架前方的除湿机与湿度探头。',warehouseFire:'位于货架前方的烟雾探头、气体探头和声光报警器。'})[s.facility]}</p><p>{s.title}：{s.metric} {s.direction==='low'?'≤':'≥'} {s.limit} {s.unit} → {s.action}</p>{info&&<p>当前：{info.outcome}</p>}</article>;})}</div><p className="association-hint">3D 蓝色指向线标明响应设备；切换 2D 可查看同一联动关系。当前为模拟配置。</p></details>;
}
