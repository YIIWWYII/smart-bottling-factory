"""Real local inference and collection-gate regression. Never substitutes images for four real views."""
import base64
import json
from pathlib import Path
import urllib.request

root=Path('/data')
def frame(path, camera='side-0'):
    return {'cameraId':camera,'data':'data:image/jpeg;base64,'+base64.b64encode(path.read_bytes()).decode()}
def request(route, images, name):
    body={'requestId':name,'bottleId':'VERIFY-001','batchId':'JOINT-REGRESSION','images':images}
    with urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8095'+route,json.dumps(body).encode(),{'Content-Type':'application/json'}),timeout=60) as response:
        return body,json.load(response)
normal=next((root/'datasets/water-front/calibration').glob('*.jpg'))
body, result=request('/inspect',[frame(normal)],'missing-view-gate')
assert result['preflight']['inferenceSkipped'] and result['verdict']=='review'
assert not any('detections' in c for c in result['cameras'])
body, result=request('/inspect/debug',[frame(normal)],'local-normal-joint')
side=next(c for c in result['cameras'] if c['cameraId']=='side-0')
assert side.get('heatmapUrl') and side['anomalyScore'] is not None, side
assert side['status']!='pass', 'Experimental model must not release bottles'
out=root/'verification'
(out/'local-joint-response.json').write_text(json.dumps({'input':body,'result':result},ensure_ascii=False))
for key in ['overlayUrl','heatmapUrl']:
    (out/(key+'.jpg')).write_bytes(base64.b64decode(side[key].split(',',1)[1]))
print(json.dumps({'gate':'passed','joint':'YOLO12 and PatchCore returned real outputs','normalResult':side['status'],
                  'score':side['anomalyScore'],'durationMs':result['durationMs'],'scope':'single normal calibration image; not independent acceptance'},ensure_ascii=False))
