// Product presentation is independent from approved equipment recipes.
export const productDefaults = [
 {id:'sprite',name:'雪碧',aliases:['xuebi','Sprite'],category:'碳酸饮料',flavor:'柠檬青柠',description:'柠檬与青柠主题的清爽气泡饮料。',modelUrl:'/models/beverage/sprite-can.glb',backgroundUrl:'/images/beverages/sprite.webp',modelSource:'https://github.com/rahoolkumardev/Coke-3d-Model/blob/main/sprite.glb'},
 {id:'cola',name:'可乐',aliases:['可口可乐','Coca-Cola'],category:'碳酸饮料',flavor:'经典可乐',description:'焦糖色泽与绵密气泡，呈现经典可乐风味。',modelUrl:'/models/beverage/coca.glb',backgroundUrl:'/images/beverages/cola.webp',modelSource:'https://github.com/rahoolkumardev/Coke-3d-Model/blob/main/coca.glb'},
 {id:'jasmine',name:'茉莉花茶',aliases:[],category:'茶饮料',flavor:'茉莉花香',description:'以茉莉与茶叶为视觉主题，展示花茶饮料。',modelUrl:'',backgroundUrl:'/images/beverages/jasmine.webp',modelSource:'https://www.baoxiaohe.com/models/3092/'},
 {id:'orange',name:'果粒橙',aliases:[],category:'果汁饮料',flavor:'橙香果粒',description:'橙香与果粒主题，展示果汁饮料。',modelUrl:'',backgroundUrl:'/images/beverages/orange.webp',modelSource:'https://m.mfcad.com/tuzhi/show_196620.html'},
 {id:'fanta',name:'芬达',aliases:['Fanta'],category:'碳酸饮料',flavor:'橙味',description:'明亮橙色与活泼气泡，呈现橙味汽水。',modelUrl:'/models/beverage/fanta.glb',backgroundUrl:'/images/beverages/fanta.webp',modelSource:'https://github.com/rahoolkumardev/Coke-3d-Model/blob/main/fanta.glb'}
].map(p=>({...p,enabled:true,ingredients:'',spec:'',version:1,modelNote:p.id==='sprite'?'罐装演示贴图 · AI 绘制标签，非官方包装':p.modelUrl?'网络模型 · 来源授权范围待确认':'模型待配置 · 已保留素材线索',backgroundNote:'AI 生成宣传场景，非实拍',recipeId:''}));

// Display copy is illustrative advertising, separate from recipe facts.
export const beverageCampaigns={
 sprite:{theme:'sprite',eyebrow:'LEMON × LIME',lines:['青柠入场','清爽有声'],caption:'柠檬青柠 · 气泡时刻',seal:'清爽派'},
 cola:{theme:'cola',eyebrow:'THE CLASSIC',lines:['经典滋味','此刻开场'],caption:'可乐风味 / 把日常变成主场',seal:'COLA'},
 jasmine:{theme:'jasmine',eyebrow:'JASMINE TEA',lines:['一缕茉莉','满盏清雅'],caption:'花香入茶 · 留一刻给自己',seal:'茉莉'},
 orange:{theme:'orange',eyebrow:'ORANGE MOMENT',lines:['把橙意','装进这一刻'],caption:'橙香与果粒的相遇',seal:'橙意满满'},
 fanta:{theme:'fanta',eyebrow:'PLAY IN ORANGE',lines:['橙色登场','快乐放大'],caption:'橙味气泡 · 今天玩点不一样',seal:'放开玩'}
};
