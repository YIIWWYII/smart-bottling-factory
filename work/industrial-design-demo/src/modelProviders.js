export const providers=[
{id:'deepseek',name:'DeepSeek',url:'https://api.deepseek.com',models:['deepseek-flash','deepseek-v4-pro']},
{id:'openai',name:'OpenAI',url:'https://api.openai.com/v1',models:['gpt-4.1','gpt-4.1-mini']},
{id:'qwen',name:'通义千问 · 百炼',url:'https://dashscope.aliyuncs.com/compatible-mode/v1',models:['qwen-plus','qwen-turbo','qwen3-vl-plus']},
{id:'glm',name:'智谱',url:'https://open.bigmodel.cn/api/paas/v4',models:['glm-4-plus','glm-4-flash']},
{id:'moonshot',name:'Moonshot / Kimi',url:'https://api.moonshot.cn/v1',models:['kimi-k2.5','moonshot-v1-8k']},
{id:'siliconflow',name:'硅基流动',url:'https://api.siliconflow.cn/v1',models:['deepseek-ai/DeepSeek-V3.2','Qwen/Qwen3-8B']},
{id:'ollama',name:'Ollama · 本机',url:'http://127.0.0.1:11434/v1',models:['qwen3:8b']},
{id:'custom',name:'自定义 · OpenAI 兼容接口',url:'',models:[]}
];
