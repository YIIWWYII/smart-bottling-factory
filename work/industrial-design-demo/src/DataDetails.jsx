import {Modal} from './ui';
export default function DataDetails({detail,onClose}){
 return <Modal className="data-details-dialog" title={detail.title} eyebrow="数据详情 / 点击时快照" onClose={onClose}><p className="data-detail-source">{detail.source} · 截取于 {new Date(detail.at).toLocaleTimeString('zh-CN',{hour12:false})}</p><div className="data-detail-table"><table><thead><tr>{(detail.columns||['采样序号','数值']).map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{detail.rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{String(v)}</td>)}</tr>)}</tbody></table>{!detail.rows.length&&<p>暂无采样数据，等待设备上报。</p>}</div><p>此窗口保持打开时的数据，关闭后重新点击可查看最新快照。</p></Modal>;
}
