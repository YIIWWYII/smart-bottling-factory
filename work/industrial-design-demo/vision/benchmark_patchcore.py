"""Small real PatchCore experiment on public glass-bottle images, separate from drink models."""
import json
from pathlib import Path
import time
import cv2
import numpy as np
import torch
from sklearn.metrics import roc_auc_score, confusion_matrix
from pipeline import make_patchcore, preprocess, tensor_image

root = Path('/data')
dataset = root/'datasets/public/mvtec-bottle'
out = root/'experiments/mvtec-bottle'
out.mkdir(parents=True, exist_ok=True)
cfg = {'roi': [0,0,1,1], 'exclude': [], 'size':256}
train = sorted((dataset/'train/good').glob('*.png'))
fit, calibration = train[:24], train[24:44]
assert len(fit)==24 and len(calibration)==20, 'Download dataset first'
model = make_patchcore(True)

def read(path):
    image=cv2.imread(str(path))
    assert image is not None, str(path)
    return preprocess(image,cfg,root)[1]

with torch.inference_mode():
    for file in fit:
        model.train()
        model.feature_extractor.eval()
        model(tensor_image(read(file)))
    model.subsample_embedding(.01)
    model.eval()
    torch.save({'state_dict':model.state_dict(),'preprocess':cfg,'cameraId':'benchmark-only',
                'sourceImages':[str(f) for f in fit]},out/'patchcore.pt')
    def score(file):
        image = read(file)
        result = model(tensor_image(image))
        anomaly = result.anomaly_map[0,0].numpy()
        return float(anomaly.max()), image, anomaly
    threshold = float(np.quantile([score(f)[0] for f in calibration],.99))
    rows=[]
    for file in sorted((dataset/'test').glob('*/*.png')):
        started=time.perf_counter()
        value,image,anomaly=score(file)
        label=int(file.parent.name!='good')
        rows.append({'image':str(file),'label':label,'score':value,'review':value>=threshold,
                     'durationMs':round((time.perf_counter()-started)*1000,2)})
        if label and not (out/'example-heatmap.jpg').exists():
            heat=cv2.applyColorMap(np.uint8(np.clip(anomaly/threshold,0,1)*255),cv2.COLORMAP_JET)
            cv2.imwrite(str(out/'example-heatmap.jpg'),cv2.addWeighted(image,.55,heat,.45,0))
    labels=[r['label'] for r in rows]
    report={'dataset':'MVTec AD bottle / Voxel51 mirror','scope':'public glass-bottle benchmark only; not validated on drinks',
            'normalFit':len(fit),'normalCalibration':len(calibration),'testCount':len(rows),'threshold':threshold,
            'auroc':roc_auc_score(labels,[r['score'] for r in rows]),
            'confusionMatrixNormalAbnormal':confusion_matrix(labels,[int(r['review']) for r in rows]).tolist(),
            'meanInferenceMs':float(np.mean([r['durationMs'] for r in rows])),'rows':rows}
    (out/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='rows'},indent=2))
