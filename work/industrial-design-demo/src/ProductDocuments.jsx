import './product-documents.css';
export default function ProductDocuments({product,documents=[]}){
 const linked=documents.filter(d=>(product?.documentIds||[]).includes(d.id));
 return <section className="product-documents" aria-label="饮品相关文档"><h3>相关文档 <small>{linked.length} 份</small></h3>{linked.length?linked.map(d=><details key={d.id}><summary><span>{d.title}</span><small>{d.status==='published'?'已发布':d.status==='rejected'?'已驳回':'待审核'} · V{d.version}</small></summary>{d.status!=='published'&&<p className="document-review-note">资料预览 · 尚未发布，不参与 AI 回答或设备控制。</p>}<pre>{d.content}</pre></details>):<p>尚未关联资料，可在运营管理 → 资源准备 → 产品中配置。</p>}</section>;
}
