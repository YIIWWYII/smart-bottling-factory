"""Build an offline HTML tutorial from verified notes and real browser captures."""
from pathlib import Path
import html
import json
import re
import shutil
import subprocess
import imageio_ffmpeg

ROOT = Path('F:/BottleAI/vision')
OUT = ROOT/'tutorial'
MEDIA = OUT/'media'
MEDIA.mkdir(parents=True, exist_ok=True)
source = Path(__file__).with_name('视觉实训教程.md')

def inline(s):
    s = html.escape(s)
    s = re.sub(r'`([^`]+)`', r'<code>\1</code>', s)
    return re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', s)

def render(md):
    lines = md.splitlines(); blocks=[]; nav=[]; i=0
    while i<len(lines):
        line=lines[i]; i+=1
        if not line.strip(): continue
        match=re.fullmatch(r'!\[(.*?)\]\((.*?)\)',line)
        if match:
            alt,url=match.groups();blocks.append(f'<figure><a href="{html.escape(url)}" target="_blank"><img src="{html.escape(url)}" alt="{html.escape(alt)}" loading="lazy"></a><figcaption>{inline(alt)}</figcaption></figure>');continue
        if line.startswith('VIDEO: '):
            url=line[7:].strip();blocks.append(f'<video controls preload="metadata"><source src="{html.escape(url)}" type="video/mp4"></video>');continue
        if line.startswith('```'):
            code=[]
            while i<len(lines) and not lines[i].startswith('```'):
                code.append(lines[i]); i+=1
            i+=1
            blocks.append('<div class="code"><button class="copy">复制命令</button><pre>'+html.escape('\n'.join(code))+'</pre></div>'); continue
        if line.startswith('#'):
            level=len(line)-len(line.lstrip('#')); title=line[level:].strip(); anchor='part-'+str(len(nav))
            if level==2: nav.append((anchor,title))
            blocks.append(f'<h{level} id="{anchor if level==2 else "sub-"+str(i)}">{inline(title)}</h{level}>'); continue
        if line.startswith('|'):
            rows=[line]
            while i<len(lines) and lines[i].startswith('|'): rows.append(lines[i]); i+=1
            table='<div class="table"><table>'
            for n,row in enumerate(rows):
                if re.fullmatch(r'[| :\-]+',row): continue
                tag='th' if n==0 else 'td'
                table+='<tr>'+''.join(f'<{tag}>{inline(c.strip())}</{tag}>' for c in row.strip('|').split('|'))+'</tr>'
            blocks.append(table+'</table></div>'); continue
        if re.match(r'^(- |\d+\. )',line):
            ordered=bool(re.match(r'^\d',line)); tag='ol' if ordered else 'ul'; items=[line]
            pattern=r'^\d+\. ' if ordered else r'^- '
            while i<len(lines) and re.match(pattern,lines[i]): items.append(lines[i]); i+=1
            start=' start="'+re.match(r'\d+',line)[0]+'"' if ordered else ''
            blocks.append(f'<{tag}{start}>'+''.join('<li>'+inline(re.sub(pattern,'',x))+'</li>' for x in items)+f'</{tag}>'); continue
        blocks.append('<p>'+inline(line)+'</p>')
    return '\n'.join(blocks),nav

replays=json.loads((OUT/'recording-source/replays.json').read_text())
durations={}
for replay in replays:
    clip=replay['clip']
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-y','-loglevel','error','-i',str(OUT/'recording-source'/f'{clip}.webm'),'-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',str(MEDIA/f'{clip}.mp4')],check=True)
    durations[clip]=replay['durationSeconds']
assert set(durations)=={'01-preflight','02-joint'}, 'Both successful recordings are required'
for src,name in [(ROOT/'runs/blot-with-normal/results.png','training.png'),(ROOT/'verification/normal-contact.jpg','normal-contact.jpg'),(ROOT/'verification/heatmapUrl.jpg','heatmap.jpg'),(ROOT/'verification/overlayUrl.jpg','overlay.jpg')]:
    if src.exists(): shutil.copy2(src,MEDIA/name)
shutil.copy2(source,OUT/source.name)
for name in ['local-patchcore-calibration.json','本轮验收说明.md']:
    if (ROOT/'verification'/name).exists(): shutil.copy2(ROOT/'verification'/name,OUT/name)
body,nav=render(source.read_text(encoding='utf-8-sig'))
navhtml=''.join(f'<a href="#{anchor}">{html.escape(title)}</a>' for anchor,title in nav)
page='''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>瓶安视觉实训 · 操作教程</title><style>
:root{color-scheme:light;--ink:#172e40;--blue:#176784}*{box-sizing:border-box}body{margin:0;background:#f1f4f5;color:var(--ink);font:17px/1.8 "Microsoft YaHei",system-ui,sans-serif}aside{position:fixed;width:250px;inset:0 auto 0 0;padding:28px 22px;background:#102d3c;color:#dbe9ed;overflow:auto}aside b{display:block;font-size:22px;color:white;margin-bottom:20px}aside a{display:block;padding:8px 0;color:inherit;text-decoration:none;font-size:14px;line-height:1.5}aside a:hover{color:#85d6df}main{margin-left:250px;max-width:1280px;padding:48px 56px 100px}header{border-bottom:2px solid #aac4cd;padding-bottom:24px}header span{color:var(--blue);font-weight:bold;letter-spacing:2px}h1{font-size:38px;line-height:1.35}h2{font-size:27px;margin:50px 0 18px;border-bottom:1px solid #cbd9de;padding-bottom:12px;scroll-margin-top:20px}h3{font-size:21px}p,li{max-width:90ch;overflow-wrap:anywhere}main{min-width:0}h1,h2,h3{overflow-wrap:anywhere}li{margin:9px 0}code{background:#e1e9ec;padding:2px 5px;border-radius:4px;font:14px Consolas,monospace;overflow-wrap:anywhere}.code{position:relative;background:#102b3b;border-radius:9px;margin:20px 0}.code pre{color:#e1edf1;overflow:auto;padding:50px 20px 20px;font:14px/1.7 Consolas,monospace}.copy{position:absolute;right:12px;top:10px;border:1px solid #55717f;color:white;background:#294959;padding:5px 12px;cursor:pointer;border-radius:4px}.notice{background:#fff5dc;border-left:4px solid #b9882f;padding:16px 22px;margin:22px 0}.steps{display:flex;flex-wrap:wrap;gap:9px}.steps span{background:#dcebef;padding:8px 14px;border-radius:4px;font-size:15px}video{width:100%;background:#0c2130;border-radius:9px}figure{margin:25px 0}figcaption{font-size:15px;color:#526978;margin:10px 0}img{max-width:100%;max-height:640px;object-fit:contain;height:auto;border:1px solid #cad7dd;background:white}figure a{display:block}.pair{display:grid;grid-template-columns:1fr 1fr;gap:18px}.table{overflow:auto}table{border-collapse:collapse;width:100%;font-size:15px}td,th{padding:12px;text-align:left;vertical-align:top;border:1px solid #cedbdf}th{background:#dfebef}a{color:#176784}details{margin:20px 0}summary{cursor:pointer;font-weight:bold}footer{margin-top:50px;color:#526978;font-size:14px}@media(max-width:900px){aside{position:static;width:auto;max-height:230px}main{margin:0;padding:25px 20px}.pair{grid-template-columns:1fr}h1{font-size:29px}}@media print{aside,.copy,video{display:none}main{margin:0;padding:0}}
</style></head><body><aside><b>瓶安 / 视觉实训</b><a href="#start">操作流程</a>NAV</aside><main>
<header id="start"><span>VISION LAB · 2026.10.20</span><h1>视觉实训操作教程</h1><p>按稿件顺序学习采集、预处理、数据准备、标注、训练、检测、交接和测试。每节给出软件入口、操作步骤、检查结果与配图。视频可全屏播放，图片可点击放大。</p></header>
<p><a href="workflow/">查看四机位视频选帧、展开与码区遮罩的算法运行结果 →</a></p><p><a href="交接清单.csv" download>下载交接清单</a>　<a href="视觉测试用例.csv" download>下载测试用例表</a>　<a href="视觉实训教程.md" download>下载文字版</a></p>
BODY
<footer>录屏包括检测页操作和 LabelImg 标注复演。目录清单和日志配图由本机文件及实际运行输出生成；机位布置图为示意图。媒体保存在 media，原始记录保存在 recording-source。复制整个 tutorial 文件夹即可保留离线教程；仅复制 index.html 会丢失视频与图片。</footer>
</main><script>document.querySelectorAll('.copy').forEach(b=>b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(b.parentElement.querySelector('pre').textContent);b.textContent='已复制';setTimeout(()=>b.textContent='复制命令',1500)}catch(e){b.textContent='请选中下方命令复制'}}));</script></body></html>'''
page=page.replace('外部 Chrome 实际页面连续截图，按采集时间编码为 MP4。录制帧与时间保存在 recording-source','独立 Chromium 浏览器实际页面录屏，转换为 MP4；未启用 GPU。原始 WebM 与实际接口响应保存在 recording-source')
(OUT/'index.html').write_text(page.replace('NAV',navhtml).replace('BODY',body),encoding='utf-8')
(OUT/'recording-source/recording-manifest.json').write_text(json.dumps({'date':'2026-10-20','kind':'real browser operation replay','audio':False,'durationsSeconds':durations,'trainingRerun':False},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'html':str(OUT/'index.html'),'recordings':durations},ensure_ascii=False))
