from pathlib import Path
import html,re,csv,json
from playwright.sync_api import sync_playwright
root=Path('F:/BottleAI/vision');out=root/'tutorial';media=out/'media'
sections=[]
def listing(folder):
 return '<table><tr><th>文件或目录</th><th>大小</th></tr>'+''.join('<tr><td>'+html.escape(p.name)+'</td><td>'+('目录' if p.is_dir() else f'{p.stat().st_size:,} 字节')+'</td></tr>' for p in sorted(folder.iterdir()) if not p.name.startswith('.'))+'</table>'
def section(key,title,content):sections.append(f'<section id="{key}"><h1>{title}</h1>{content}</section>')
section('dataset','数据集文件清单',f'<p>{root}/datasets/local-blot-normal · 本机实际文件</p>'+listing(root/'datasets/local-blot-normal')+'<p>images/train：104 张；images/val：42 张。图片与标签按文件名对应。</p>'+listing(root/'tutorial/practice/labels'))
log=(out/'recording-source/yolo-one-epoch.log').read_text(encoding='utf-8',errors='replace');log=re.sub(r'\x1b\[[0-9;]*[a-zA-Z]','',log)
lines=[x for x in log.splitlines() if ('epoch' in x.lower() or 'Results saved' in x or 'CPU' in x or 'all ' in x or 'Optimizer stripped' in x)]
section('training-output','YOLO12 一轮练习：实际运行结果','<p>本次独立练习，不替换在线模型。以下内容摘自原始运行日志。</p><pre>'+html.escape('\n'.join(lines[-10:]))+'</pre>'+listing(root/'runs/tutorial-smoke/weights'))
log=(out/'recording-source/patchcore-build.log').read_text(encoding='utf-8',errors='replace')
lines=[x for x in log.splitlines() if x.startswith(('Features:','Saved ','Normal'))]
section('patchcore-output','PatchCore 建库：实际运行结果','<p>输出在 tutorial/practice；在线特征库保持不变。</p><pre>'+html.escape('\n'.join(lines))+'</pre>'+listing(out/'practice'))
for key,name,title in [('handoff','交接清单.csv','交接清单：填写模板'),('test-cases','视觉测试用例.csv','视觉测试：先写预期，再填实际结果')]:
 rows=list(csv.reader((out/name).open(encoding='utf-8-sig')))
 section(key,title,'<p>空白栏由实际操作人员填写；未执行项目保持未执行。</p><table>'+''.join('<tr>'+''.join('<td>'+html.escape(c)+'</td>' for c in row)+'</tr>' for row in rows)+'</table>')
doc='<!doctype html><meta charset="utf-8"><style>body{font:18px/1.7 "Microsoft YaHei";color:#183948;background:#edf3f6;padding:25px}section{background:white;padding:32px;margin:30px 0;max-width:1250px}h1{font-size:27px}table{border-collapse:collapse;width:100%;font-size:16px}td,th{border:1px solid #bacbd4;padding:12px;text-align:left}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#152d3e;color:#e0eef3;padding:24px;font:15px/1.7 Consolas}</style>'+''.join(sections)
(out/'recording-source/evidence.html').write_text(doc,encoding='utf-8')
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--disable-gpu']);page=b.new_page(viewport={'width':1440,'height':1000});page.goto((out/'recording-source/evidence.html').as_uri())
 for key in ['dataset','training-output','patchcore-output','handoff','test-cases']:page.locator('#'+key).screenshot(path=str(media/f'{key}.png'))
 b.close()
