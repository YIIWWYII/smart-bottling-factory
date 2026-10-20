export function productionProduct(twin){
 const task=twin?.activeTask,products=twin?.ops?.products||[],documents=twin?.ops?.documents||[];
 if(!task)return null;
 const key=task.productId||task.productCode;
 if(key){const recipe=documents.find(d=>d.productCode===key||d.id===key);return products.find(p=>p.id===key||p.code===key||p.recipeId===recipe?.id&&!!recipe)||null;}
 const matches=products.filter(p=>p.name===task.name||p.aliases?.includes(task.name));
 return matches.length===1?matches[0]:null;
}
