import {stages} from './data';

function Trace({values,unit}){
 const samples=(values||[]).filter(Number.isFinite);
 if(samples.length<2)return <p className="peek-note">采样不足，暂不显示趋势</p>;
 const low=Math.min(...samples),high=Math.max(...samples),span=high-low||1;
 const points=samples.map((v,i)=>`${8+i*264/(samples.length-1)},${high===low?30:50-(v-low)/span*40}`).join(' ');
 return <div className="peek-trace"><svg viewBox="0 0 280 60" role="img" aria-label={`最近 ${samples.length} 次采样，最低 ${low.toFixed(2)}，最高 ${high.toFixed(2)} ${unit}`}><path d="M8 52H272M8 30H272M8 8H272" className="peek-grid"/><polyline points={points}/></svg><small>最近 {samples.length} 次采样</small><small>{low.toFixed(2)}–{high.toFixed(2)} {unit}</small></div>;
}

export default function DevicePeekReadout({index,live}){
 const s=stages[index],value=Number(live.value),offline=live.quality==='offline'||!Number.isFinite(value);
 const target=live.source==='simulation'&&Number.isFinite(live.target)?live.target:null;
 const number=<strong className="peek-number">{offline?'—':value.toFixed(s.precision)}<small>{s.unit}</small></strong>;
 if(offline)return <div className="peek-readout"><span>{s.metric}</span>{number}<p className="peek-note">当前数据不可用，等待设备遥测</p></div>;
 let content;
 if(index===0||index===3){
  const min=Math.min(s.min,value,target??value),max=Math.max(s.max,value,target??value),position=v=>(v-min)/(max-min)*100;
  content=<><div className="peek-temperature"><div className="peek-thermometer" role="img" aria-label={`${s.metric} ${value} ${s.unit}`}><i style={{height:position(value)+'%'}}/></div><div><span>{s.metric}</span>{number}<small>{target===null?'设定值未接入':`设定 ${target} ${s.unit}`}</small></div></div><Trace values={live.history} unit={s.unit}/></>;
 }else if(index===1){
  content=<><span>{s.metric}</span>{number}<Trace values={live.history} unit={s.unit}/><p className="peek-note">浓度变化趋势；报警阈值未在此展示</p></>;
 }else if(index===2){
  const pct=Math.max(0,Math.min(100,value));
  content=<><div className="peek-ring"><svg viewBox="0 0 110 110" aria-hidden="true"><circle cx="55" cy="55" r="44"/><circle cx="55" cy="55" r="44" pathLength="100" strokeDasharray={`${pct} 100`} transform="rotate(-90 55 55)"/></svg><div>{number}<span>{s.metric}</span></div></div><p className="peek-note">识别置信度，不代表产品合格率</p></>;
 }else if(index===4){
  const max=Math.max(value,target??0,1)*1.1;
  content=<><span>{s.metric}</span>{number}<div className="peek-comparison"><label><span>实测</span><i style={{width:value/max*60+'%'}}/><b>{value.toFixed(s.precision)}</b></label>{target!==null&&<label><span>设定</span><i style={{width:target/max*60+'%'}}/><b>{target}</b></label>}</div><p className="peek-note">{target===null?'设定值未接入':`与设定相差 ${(value-target).toFixed(s.precision)} ${s.unit} · 非合格判定`}</p></>;
 }else if(index===5){
  const range=Math.max(Math.abs(value),...(live.history||[]).filter(Number.isFinite).map(Math.abs),1)*1.2;
  content=<><span>{s.metric}</span>{number}<div className="peek-deviation" role="img" aria-label={`重量偏差 ${value} g，零点在中央`}><div><i style={{left:(50+value/range*50)+'%'}}/></div><footer><span>−{range.toFixed(1)} g</span><b>0</b><span>+{range.toFixed(1)} g</span></footer></div><p className="peek-note">零点对照；刻度随采样变化，不代表允许公差</p></>;
 }else if(index===6){
  const count=Math.max(0,Math.round(value));
  content=<><div className="peek-packing"><div className="peek-bottle-grid" aria-hidden="true">{Array.from({length:Math.min(count,48)},(_,i)=><i key={i}/>)}</div><div><span>{s.metric}</span>{number}</div></div><p className="peek-note">{count>48?'图示最多显示 48 瓶。':''}展示装箱规格，不表示已装数量</p></>;
 }else if(index===7){
  const max=Math.max(s.max,value),angle=-90+Math.max(0,value/max)*180;
  content=<><div className="peek-speed"><svg viewBox="0 0 200 108" aria-hidden="true"><path d="M20 95A80 80 0 0 1 180 95"/><path d="M100 95V30" transform={`rotate(${angle} 100 95)`}/><circle cx="100" cy="95" r="5"/></svg>{number}</div><div className="peek-scale"><span>0</span><span>速度刻度 {max.toFixed(1)} m/s</span></div><Trace values={live.history} unit={s.unit}/></>;
 }else{
  const pct=Math.max(0,Math.min(100,value));
  content=<><span>{s.metric}</span>{number}<div className="peek-occupancy" role="img" aria-label={`库位占用比例 ${value}%`}>{Array.from({length:20},(_,i)=><span key={i}><i style={{width:Math.max(0,Math.min(100,(pct-i*5)*20))+'%'}}/></span>)}</div><p className="peek-note">占用比例示意，非实际库位分布</p></>;
 }
 return <div className={`peek-readout peek-kind-${index}`}>{content}</div>;
}
