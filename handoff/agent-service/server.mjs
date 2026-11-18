import http from 'node:http';
import {randomUUID} from 'node:crypto';

const port=Number(process.env.AGENT_PORT||8888),host=process.env.AGENT_HOST||'0.0.0.0',chats=new Map();
const upstream=process.env.COZE_UPSTREAM;
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
function answerFor(raw){
 let question='';try{const request=JSON.parse(raw);question=String(request.question||'');}catch{question=String(raw||'');}
 return '已收到问题：'+question.slice(0,240)+'。智能体服务连接正常。本交接包使用固定规则模拟回复，不连接真实模型、平台知识库或设备数据。';
}
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(upstream){
  const allowed=(req.method==='GET'&&['/v3/chat/retrieve','/v3/chat/message/list'].includes(url.pathname))||(req.method==='POST'&&['/v3/chat','/v3/chat/cancel','/v1/workflow/run'].includes(url.pathname));
  if(!allowed)return json(res,404,{code:1,msg:'Only published Coze chat and workflow APIs are forwarded'});
  if(!/^Bearer \S+$/.test(req.headers.authorization||''))return json(res,401,{code:1,msg:'Use the published Coze API token'});
  try{
   let body;if(req.method==='POST'){body='';for await(const chunk of req){body+=chunk;if(body.length>1000000)return json(res,413,{code:1,msg:'request too large'});}}
   const response=await fetch(new URL(url.pathname+url.search,upstream),{method:req.method,headers:{Authorization:req.headers.authorization,'Content-Type':'application/json'},body,redirect:'error',signal:AbortSignal.timeout(175000)});
   return json(res,response.status,await response.json());
  }catch{return json(res,502,{code:1,msg:'Coze API did not return an available JSON response'});}
 }
 if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{status:'ready',contract:'coze-v3-demo',demo:true,capabilities:['normal-question']});
 if(req.method==='POST'&&url.pathname==='/v3/chat'){
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>100000)return json(res,413,{code:1,msg:'request too large'});}
  let body;try{body=JSON.parse(raw||'{}');}catch{return json(res,400,{code:1,msg:'invalid json'});}
  const id=randomUUID(),conversation_id=body.conversation_id||randomUUID(),message=body.additional_messages?.at(-1)?.content||'';
  const chat={id,conversation_id,bot_id:String(body.bot_id||'123456789012'),created_at:Math.floor(Date.now()/1000),status:'completed'};
  chats.set(id,{chat,answer:answerFor(message)});
  if(chats.size>100)chats.delete(chats.keys().next().value);
  return json(res,200,{code:0,msg:'',data:chat});
 }
 if(req.method==='GET'&&url.pathname==='/v3/chat/retrieve'){
  const item=chats.get(url.searchParams.get('chat_id'));return item?json(res,200,{code:0,msg:'',data:item.chat}):json(res,404,{code:1,msg:'chat not found'});
 }
 if(req.method==='GET'&&url.pathname==='/v3/chat/message/list'){
  const item=chats.get(url.searchParams.get('chat_id'));return item?json(res,200,{code:0,msg:'',data:[{type:'answer',role:'assistant',content:JSON.stringify({answer:item.answer,status:'completed'}),content_type:'text'}]}):json(res,404,{code:1,msg:'chat not found'});
 }
 if(req.method==='POST'&&url.pathname==='/v3/chat/cancel')return json(res,200,{code:0,msg:'',data:{}});
 json(res,404,{code:1,msg:'not found'});
});
server.listen(port,host,()=>console.log((upstream?'Published Coze API relay':'Agent mock (fixed responses)')+' ready on '+host+':'+port));
