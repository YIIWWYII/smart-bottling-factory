"""Local dual-track retrieval: indexed tables + Chinese embedding search. No device writes."""
import json, sqlite3, threading, re, os
from pathlib import Path
import numpy as np
from fastembed import TextEmbedding
from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

PACKAGE=Path(__file__).resolve().parents[3]
ROOT=Path(os.environ.get('BOTTLE_KNOWLEDGE_ROOT', str(PACKAGE/'数据与模型/知识库/表格与索引')))
SOURCE=ROOT/'platform-knowledge.json'
CACHE=Path(os.environ.get('BOTTLE_EMBEDDING_CACHE', str(PACKAGE/'数据与模型/知识库/向量模型缓存')))
model=TextEmbedding('BAAI/bge-small-zh-v1.5',cache_dir=str(CACHE),local_files_only=True)
lock=threading.Lock()
app=FastAPI(title='瓶安双轨知识检索')
database=ROOT/'platform-knowledge.sqlite'

def rebuild():
    data=json.loads(SOURCE.read_text(encoding='utf-8'))
    with sqlite3.connect(database) as c:
        c.executescript('CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY,model TEXT,body TEXT); CREATE INDEX IF NOT EXISTS device_model ON devices(model); CREATE TABLE IF NOT EXISTS alarms(code TEXT PRIMARY KEY,model TEXT,body TEXT); CREATE INDEX IF NOT EXISTS alarm_model ON alarms(model); CREATE TABLE IF NOT EXISTS thresholds(code TEXT PRIMARY KEY,model TEXT,body TEXT); CREATE INDEX IF NOT EXISTS threshold_model ON thresholds(model);')
        for table,key in [('devices','id'),('alarms','id'),('thresholds','id')]:
            c.execute('DELETE FROM '+table)
            for row in data[table]:
                c.execute('INSERT INTO '+table+' VALUES(?,?,?)',(row[key],row.get('model',row.get('device')),json.dumps(row,ensure_ascii=False)))
    chunks=data['chunks']
    vectors=np.array(list(model.embed([x['text'] for x in chunks])))
    np.save(ROOT/'vectors.npy',vectors)
    return chunks,vectors

chunks,vectors=rebuild()

class Query(BaseModel):
    query:str
    device_model:str=''
    alarm_code:str=''

@app.post('/knowledge')
def knowledge(body:Query):
    exact=[]
    with sqlite3.connect(database) as c:
        # An explicitly written, known device ID also selects the table records.
        # Ambiguous queries keep the original unfiltered retrieval behavior.
        if not body.device_model:
            known=[row[0] for row in c.execute('SELECT DISTINCT model FROM devices') if row[0]]
            matches=[value for value in known if re.search(r'(?<![A-Za-z0-9_-])'+re.escape(value)+r'(?![A-Za-z0-9_-])',body.query,re.I)]
            if len(matches)==1:body=body.model_copy(update={'device_model':matches[0]})
        for table in ['devices','alarms','thresholds']:
            conditions=[];values=[]
            if body.device_model:conditions.append('model=?');values.append(body.device_model)
            if body.alarm_code and table!='devices':conditions.append('code=?');values.append(body.alarm_code)
            if conditions:
                rows=c.execute('SELECT body FROM '+table+' WHERE '+' AND '.join(conditions),values).fetchall()
                exact.extend({'table':table,'record':json.loads(row[0]),'source':'平台配置','version':'2026-10-18'} for row in rows[:8])
    with lock:q=np.array(list(model.embed([body.query]))[0])
    scores=vectors@q/(np.linalg.norm(vectors,axis=1)*np.linalg.norm(q))
    hits=[]
    # Exact platform labels supplement semantic retrieval; never relax device/alarm filters.
    exact_terms=[i for i,x in enumerate(chunks) if any(k and k in body.query for k in x.get('keywords',[])) and (not body.device_model or x.get('model')==body.device_model) and (not body.alarm_code or x.get('alarm_code')==body.alarm_code)]
    exact_terms.sort(key=lambda i:max((len(k) for k in chunks[i].get('keywords',[]) if k in body.query),default=0),reverse=True)
    for i in dict.fromkeys(exact_terms+list(np.argsort(-scores))):
        chunk=chunks[i]
        if body.device_model and chunk.get('model','')!=body.device_model:continue
        if body.alarm_code and chunk.get('alarm_code','')!=body.alarm_code:continue
        if scores[i]<0.55 and i not in exact_terms:continue
        hits.append({**chunk,'similarity':round(float(scores[i]),4),'scope':'平台功能说明，不是实时状态' if chunk.get('kind')=='platform' else '平台配置资料，非厂商规程', 'match':'label' if i in exact_terms else 'semantic'})
        if len(hits)==3:break
    return {'structured':exact,'documents':hits,'embedding':'BAAI/bge-small-zh-v1.5','minScore':0.55,'note':'相似度不是正确率；没有型号/适用条件匹配则不作为该设备操作依据。','message':'已找到匹配资料' if exact or hits else '未找到该对象的对应资料；请明确页面、对象名称或补充资料，不要猜测其含义。'}

class Embedding(BaseModel):
    texts:list[str]
    need_sparse:bool=False

@app.post('/embedding')
def embedding(body:Embedding):
    with lock:dense=[v.tolist() for v in model.embed(body.texts)]
    return {'dense':dense,'sparse':[]}

@app.get('/support_status')
def support():return 1

@app.get('/health')
def health():return {'ok':True,'chunks':len(chunks),'tables':['devices','alarms','thresholds'],'embedding':'BAAI/bge-small-zh-v1.5'}

if __name__=='__main__':uvicorn.run(app,host=os.environ.get('BOTTLE_KNOWLEDGE_HOST','0.0.0.0'),port=int(os.environ.get('BOTTLE_KNOWLEDGE_PORT','8891')))
