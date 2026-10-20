export const standardTools=[
 {name:'list_standard_data',description:'查询已发布标准产品、设备和配方版本。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true}},
 {name:'apply_recipe',description:'按数据库编号与版本应用已发布模拟配方。只接受编号，不接受临时参数。需自动调参开启，应用后保持暂停。',inputSchema:{type:'object',properties:{recordId:{type:'string'},version:{type:'integer'},requestId:{type:'string'},confidence:{type:'number',minimum:0,maximum:1}},required:['recordId','version','requestId','confidence'],additionalProperties:false}},
 {name:'get_execution',description:'查询标准配方的执行记录及虚拟设备回读。',inputSchema:{type:'object',properties:{requestId:{type:'string'}},required:['requestId'],additionalProperties:false},annotations:{readOnlyHint:true}}
];
export async function mcpMessage(message,call){
 const id=message?.id??null;
 const error=(code,message)=>({jsonrpc:'2.0',id,error:{code,message}});
 if(!message||message.jsonrpc!=='2.0'||typeof message.method!=='string')return error(-32600,'Invalid Request');
 if(message.method==='notifications/initialized'&&message.id===undefined)return null;
 if(message.id===undefined)return error(-32600,'Request id required');
 let result;
 if(message.method==='initialize')result={protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'bottleworks-mcp-server',version:'1.0.0'}};
 else if(message.method==='ping')result={};
 else if(message.method==='tools/list')result={tools:standardTools};
 else if(message.method==='tools/call'){
  try{const value=await call(message.params?.name,message.params?.arguments||{});result={content:[{type:'text',text:JSON.stringify(value)}]};}
  catch(e){result={isError:true,content:[{type:'text',text:e.status?e.message:'执行失败，未确认生效。'}]};}
 }else return error(-32601,'Method not found');
 return {jsonrpc:'2.0',id,result};
}
