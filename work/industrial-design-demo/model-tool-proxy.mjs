import http from 'node:http';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
export function normalizeToolReply(reply){
 return {...reply,choices:reply.choices?.map(choice=>({...choice,message:choice.message?.tool_calls?.length?{...choice.message,content:null,reasoning_content:undefined}:choice.message}))};
}
export function createModelProxy({upstream='http://127.0.0.1:8003',fetcher=fetch}={}){
 return http.createServer(async(req,res)=>{
  const controller=new AbortController();res.on('close',()=>controller.abort());
  try{
   if(!['/health','/v1/models','/v1/chat/completions'].includes(req.url)){res.writeHead(404);res.end();return;}
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>20000000)throw Error('Request too large');}
   const body=raw?JSON.parse(raw):null,stream=body?.stream===true;
   const response=await fetcher(upstream+req.url,{method:req.method,headers:{'Content-Type':'application/json',...(req.headers.authorization?{Authorization:req.headers.authorization}:{})},...(body?{body:JSON.stringify({...body,stream:false})}:{}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(180000)])});
   const result=await response.json();
   if(!response.ok||!stream){res.writeHead(response.status,{'Content-Type':'application/json'});res.end(JSON.stringify(normalizeToolReply(result)));return;}
   const reply=normalizeToolReply(result);
   res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
   const base={id:reply.id,object:'chat.completion.chunk',created:reply.created,model:reply.model};
   const choices=(reply.choices||[]).map((c,index)=>({index:c.index??index,delta:{role:'assistant',...(c.message?.tool_calls?.length?{tool_calls:c.message.tool_calls.map((t,i)=>({...t,index:i}))}:{content:c.message?.content||''})},finish_reason:null}));
   res.write('data: '+JSON.stringify({...base,choices})+'\n\n');
   res.write('data: '+JSON.stringify({...base,choices:(reply.choices||[]).map((c,index)=>({index:c.index??index,delta:{},finish_reason:c.message?.tool_calls?.length?'tool_calls':c.finish_reason||'stop'})),usage:reply.usage})+'\n\n');
   res.end('data: [DONE]\n\n');
  }catch(e){if(!res.headersSent)res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:e.name==='AbortError'?'Model request cancelled':'Local model response failed',type:'upstream_error'}}));}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)createModelProxy().listen(8002,'0.0.0.0',()=>console.log('Model compatibility endpoint :8002 -> :8003'));
