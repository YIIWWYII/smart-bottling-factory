"""Download official pretrained weights; never label them industrial defect models."""
import json
import os
from pathlib import Path

ROOT = Path(os.environ.get('VISION_DATA', '/data'))
ROOT.mkdir(parents=True, exist_ok=True)
(ROOT/'models').mkdir(exist_ok=True)
os.chdir(ROOT/'models')
from ultralytics import YOLO
model = YOLO('yolo12n.pt')
from pipeline import make_patchcore, CAMERAS
make_patchcore(True)
config_path = ROOT/'config.json'
if not config_path.exists():
    config_path.write_text(json.dumps({'version': 'yolo12-bootstrap-v1', 'cameras': {
        i: {'weights': 'models/yolo12n.pt', 'trainedForDefects': False,
            'defectClasses': ['blot'], 'confidence': .35, 'patchcore': '', 'anomalyThreshold': None,
            'preprocess': {'roi': [0, 0, 1, 1], 'exclude': [], 'size': 320}}
        for i in CAMERAS}}, ensure_ascii=False, indent=2), encoding='utf-8')
print('YOLO12n and PatchCore resnet18 backbone downloaded; industrial training still required.')
