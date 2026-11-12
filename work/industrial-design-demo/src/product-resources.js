// Product presentation is independent from approved equipment recipes.
export const productDefaults = [
 {id:'yibao',name:'怡宝·假日一刻',aliases:['怡宝','假日一刻','桃桃假日','怡宝桃桃假日'],category:'果汁饮料',flavor:'桃桃假日',description:'白色瓶盖、细长透明瓶身与桃粉色标签，展示照片中的怡宝假日一刻桃桃假日饮料。',ingredients:'具体配料以实物标签为准',spec:'PET 瓶装 · 容量以实物标签为准',modelUrl:'/models/beverage/yibao-peach-bottle.glb',backgroundUrl:'/images/beverages/yibao-peach.webp',modelSource:'',modelNote:'按实物照片在 Blender 重建 · 展示比例',backgroundNote:'用户提供的桃花与蜜桃宣传背景'},
 {id:'cola',name:'可乐',aliases:['可口可乐','Coca-Cola'],category:'碳酸饮料',flavor:'经典可乐',description:'焦糖色泽与绵密气泡，呈现经典可乐风味。',modelUrl:'/models/beverage/coca.glb',backgroundUrl:'/images/beverages/cola-lovart.webp',ingredients:'碳酸饮料展示款；配料以现场包装为准',spec:'罐装展示款 · 容量以现场包装为准',modelSource:'https://github.com/rahoolkumardev/Coke-3d-Model/blob/main/coca.glb'},
 {id:'sprite',name:'雪碧',aliases:['xuebi','Sprite'],category:'碳酸饮料',flavor:'柠檬青柠',description:'柠檬与青柠主题的清爽气泡饮料。',modelUrl:'/models/beverage/sprite-can.glb',backgroundUrl:'/images/beverages/sprite.webp',modelSource:'https://github.com/rahoolkumardev/Coke-3d-Model/blob/main/sprite.glb'},
 {id:'jasmine',name:'茉莉花茶',aliases:[],category:'茶饮料',flavor:'茉莉花香',description:'以茉莉与茶叶为视觉主题，展示花茶饮料。',modelUrl:'',backgroundUrl:'/images/beverages/jasmine.webp',modelSource:'https://www.baoxiaohe.com/models/3092/'},
 {id:'orange',name:'果粒橙',aliases:[],category:'果汁饮料',flavor:'橙香果粒',description:'橙香与果粒主题，展示果汁饮料。',modelUrl:'',backgroundUrl:'/images/beverages/orange.webp',modelSource:'https://m.mfcad.com/tuzhi/show_196620.html'},
 {id:'fanta',name:'芬达',aliases:['Fanta'],category:'碳酸饮料',flavor:'橙味',description:'明亮橙色与活泼气泡，呈现橙味汽水。',modelUrl:'/models/beverage/fanta.glb',backgroundUrl:'/images/beverages/fanta.webp',modelSource:'https://github.com/rahoolkumardev/Coke-3d-Model/blob/main/fanta.glb'}
].map(p=>({enabled:true,ingredients:'',spec:'',version:1,modelNote:p.id==='sprite'?'罐装演示贴图 · AI 绘制标签，非官方包装':p.modelUrl?'网络模型 · 来源授权范围待确认':'模型待配置 · 已保留素材线索',backgroundNote:'AI 生成宣传场景，非实拍',recipeId:'',...p}));

// Display copy is illustrative advertising, separate from recipe facts.
export const beverageCampaigns={
 yibao:{theme:'yibao',eyebrow:'HOLIDAY MOMENT',lines:['假日一刻','桃桃假日'],caption:'一刻桃香 · 轻松日常',seal:'怡宝'},
 sprite:{theme:'sprite',eyebrow:'LEMON × LIME',lines:['青柠入场','清爽有声'],caption:'柠檬青柠 · 气泡时刻',seal:'清爽派'},
 cola:{theme:'cola',eyebrow:'THE CLASSIC',lines:['经典滋味','此刻开场'],caption:'可乐风味 / 把日常变成主场',seal:'COLA'},
 jasmine:{theme:'jasmine',eyebrow:'JASMINE TEA',lines:['一缕茉莉','满盏清雅'],caption:'花香入茶 · 留一刻给自己',seal:'茉莉'},
 orange:{theme:'orange',eyebrow:'ORANGE MOMENT',lines:['把橙意','装进这一刻'],caption:'橙香与果粒的相遇',seal:'橙意满满'},
 fanta:{theme:'fanta',eyebrow:'PLAY IN ORANGE',lines:['橙色登场','快乐放大'],caption:'橙味气泡 · 今天玩点不一样',seal:'放开玩'}
};

export const productResourceDocuments=[
 {id:'PRODUCT-YIBAO-GUIDE',title:'怡宝产品与展示说明',kind:'document',status:'published',version:1,owner:'项目组',content:'产品名称：怡宝假日一刻，桃桃假日。\n包装：白色瓶盖、细长 PET 瓶、米白至桃粉色标签；容量与配料以实物标签为准。\n模型结构：瓶身、饮料、白色瓶盖、防盗环与照片展开标签；源文件在 blender-integration/beverage/yibao-peach-bottle.blend。\n平台模型：public/models/beverage/yibao-peach-bottle.glb。\n背景：用户提供的桃花、蜜桃与水面宣传图，public/images/beverages/yibao-peach.webp。\n模型尺寸为展示近似，不是现场测量数据；不能用于计算机械臂抓取点位。实际规格、配料、批次和包装以现场实物标签为准。\n产品展示资料不包含或替代设备控制配方。'},
 {id:'PRODUCT-COLA-GUIDE',title:'可乐产品与展示说明',kind:'document',status:'published',version:1,owner:'项目组',content:'产品名称：可乐展示款。\n模型：沿用平台已配置的罐装模型 public/models/beverage/coca.glb。\n宣传背景：Lovart 生成，public/images/beverages/cola-lovart.webp。\n包装容量、配料与生产信息以现场实物为准；不从模型外观推断实际规格。\n机械臂轨迹、吸附高度与速度由设备配置单独管理，不因选择产品展示项而更改。'}
];

// Upgrade existing catalogs without replacing user-created products, recipes or uploaded models.
export function prepareProductCatalog(products,documents){
 const catalog=products.map(p=>({...p}));
 for(const id of ['yibao','cola']){
  const defaults=productDefaults.find(p=>p.id===id);let product=catalog.find(p=>p.id===id);
  if(!product){product=structuredClone(defaults);catalog.push(product);}
  if(id==='yibao'&&product.modelUrl==='/models/beverage/yibao-bottle.glb')Object.assign(product,structuredClone(defaults),{documentIds:product.documentIds,recipeId:product.recipeId,version:(product.version||1)+1});
  if(id==='yibao'&&product.backgroundUrl==='/images/beverages/yibao-peach.svg'){product.backgroundUrl=defaults.backgroundUrl;product.backgroundNote=defaults.backgroundNote;}
  if(id==='cola'&&product.backgroundUrl==='/images/beverages/cola.webp'){product.backgroundUrl=defaults.backgroundUrl;product.backgroundNote='Lovart 生成背景 · 非实拍';}
  for(const field of ['description','ingredients','spec'])if(!product[field])product[field]=defaults[field];
  const doc=productResourceDocuments.find(d=>d.id==='PRODUCT-'+id.toUpperCase()+'-GUIDE');
  const existing=documents.find(d=>d.id===doc.id);
  if(!existing)documents.push({...doc});
  else if(id==='yibao'&&existing.content.startsWith('产品名称：怡宝饮用纯净水展示款。'))Object.assign(existing,doc,{version:existing.version+1});
  if(id==='yibao'&&existing?.content.includes('背景：桃粉色临时展示底图，Lovart 图片待替换。')){existing.content=existing.content.replace('背景：桃粉色临时展示底图，Lovart 图片待替换。','背景：用户提供的桃花、蜜桃与水面宣传图，public/images/beverages/yibao-peach.webp。');existing.version++;}
  product.documentIds=[...new Set([...(product.documentIds||[]),doc.id])];
 }
 const rank=id=>id==='yibao'?0:id==='cola'?1:2;
 return catalog.sort((a,b)=>rank(a.id)-rank(b.id));
}
