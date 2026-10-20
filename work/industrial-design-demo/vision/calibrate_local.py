"""One held-out normal image: experimental threshold only, not independent acceptance."""
import json
from pathlib import Path
import cv2
import torch
from pipeline import make_patchcore, preprocess, tensor_image

root=Path('/data')
payload=torch.load(root/'models/water-front-patchcore.pt',map_location='cpu',weights_only=True)
model=make_patchcore(False)
model.load_state_dict(payload['state_dict'])
model.eval()
scores=[]
with torch.inference_mode():
    for f in sorted((root/'datasets/water-front/calibration').glob('*.jpg')):
        _,image,mask=preprocess(cv2.imread(str(f)),payload['preprocess'],root)
        result=model(tensor_image(image))
        scores.append(float(result.anomaly_map[0,0].numpy()[mask.astype(bool)].max()))
threshold=max(scores)*1.05
report={'normalUniqueTrain':len(payload['sourceImages']),'normalCalibration':len(scores),
        'independentTest':0,'threshold':threshold,'scores':scores,
        'warning':'Only one calibration image; 5% margin is an experimental choice, not a validated operating threshold.'}
(root/'verification/local-patchcore-calibration.json').write_text(json.dumps(report,indent=2))
cfg=json.loads((root/'config.json').read_text())
cfg['cameras']['side-0'].update(patchcore='models/water-front-patchcore.pt',anomalyThreshold=threshold,experimental=True)
cfg['version']='yolo12-patchcore-local-experimental-v2'
(root/'config.json').write_text(json.dumps(cfg,ensure_ascii=False,indent=2))
print(json.dumps(report))
