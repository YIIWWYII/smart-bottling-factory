const excluded='.digital-assistant,.ai-hover,.ai-pick-cancel,[data-ai-ignore],[aria-hidden="true"],input[type="password"]';
const label=e=>(e?.getAttribute('aria-label')||e?.getAttribute('alt')||e?.getAttribute('title')||e?.innerText||e?.textContent||'').trim();
const secret=/密钥|令牌|密码|token|secret|password|api.?key/i;
export function selectAssistantObject(node){
 const el=node instanceof Element?node:node?.parentElement;
 if(!el||el.closest(excluded)||el===document.body||el===document.documentElement)return null;
 if(secret.test(el.getAttribute('name')||'')||secret.test(label(el.closest('label'))))return null;
 // Select a semantic business unit, not an SVG path, decoration or isolated numeric glyph.
 const control=el.closest('button,a,input,select,textarea,[role="button"],summary');
 if(control){if(control.matches('input,select,textarea')&&!control.labels?.length&&!control.getAttribute('aria-label'))return null;return label(control)||control.labels?.length?control:null;}
 const heading=el.closest('h1,h2,h3,h4');if(heading&&label(heading))return heading;
 const chart=el.closest('svg,canvas,video,img');
 if(chart){if(label(chart))return chart;return chart.closest('[data-ai-context],[data-ai-object]');}
 const unit=el.closest('[data-ai-object],[data-ai-context],tr,article,dl,[role="group"],[role="img"]');
 if(unit&&label(unit)&&label(unit).length<5000)return unit;
 return null;
}
export function describeAssistantObject(el,route){
 const own=el.labels?.length?[...el.labels].map(label).join(' '):label(el)||el.closest('[data-ai-context]')?.dataset.aiContext||'业务区域';
 const parent=el.closest('article,section,[role="dialog"],tr'),heading=parent?.querySelector('h1,h2,h3,h4')?.textContent?.trim();
 const context=el.closest('[data-ai-context]')?.dataset.aiContext||'';
 const value=el.matches('input,select,textarea')?(el.type==='checkbox'||el.type==='radio'?(el.checked?'已选中':'未选中'):el.value):'';
 const details=parent&&parent!==el?[...parent.querySelectorAll('h1,h2,h3,h4,small,strong,dt,dd,th,td')].filter(n=>!n.closest(excluded)&&!secret.test(label(n))).slice(0,18).map(label).join(' · ').slice(0,800):'';
 const page=({display:'数字展板',station:'工位终端',admin:'管理中心'})[route]||route;
 const title=[...document.querySelectorAll('h1')].filter(n=>!n.closest(excluded)).map(label).join(' / ');
 return {name:own.slice(0,160),page,section:heading||title,kind:el.matches('input,select,textarea')?'配置项':el.matches('svg,canvas,[role="img"]')?'图表或模型':el.matches('button,a,summary')?'功能操作':'业务信息',text:[own,value,'页面：'+page,title,heading,details,context].filter(Boolean).join(' · ').slice(0,2200)};
}
