"""One held-out normal image: experimental threshold only, not independent acceptance."""
import argparse
import json
from pathlib import Path
import cv2
import torch
from pipeline import make_patchcore, preprocess, tensor_image

root=Path('/data')
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--bank', type=Path, default=root/'models/water-front-patchcore.pt')
parser.add_argument('--normal', type=Path, default=root/'datasets/water-front/calibration')
parser.add_argument('--report', type=Path, default=root/'verification/local-patchcore-calibration.json')
parser.add_argument('--input-config', type=Path, default=root/'config.json')
parser.add_argument('--output-config', type=Path, default=root/'config.json')
parser.add_argument('--profile', choices=['side-0','single-image'],default='side-0')
args=parser.parse_args()
payload=torch.load(args.bank,map_location='cpu',weights_only=True)
model=make_patchcore(False)
model.load_state_dict(payload['state_dict'])
model.eval()
scores=[]
with torch.inference_mode():
    for f in sorted(args.normal.glob('*.jpg')):
        _,image,mask=preprocess(cv2.imread(str(f)),payload['preprocess'],root)
        result=model(tensor_image(image))
        scores.append(float(result.anomaly_map[0,0].numpy()[mask.astype(bool)].max()))
if not scores:
    parser.error('校准文件夹没有 JPG 图片；未写入报告或配置')
threshold=max(scores)*1.05
report={'normalUniqueTrain':len(payload['sourceImages']),'normalCalibration':len(scores),
        'independentTest':0,'threshold':threshold,'scores':scores,
        'warning':'Only one calibration image; 5% margin is an experimental choice, not a validated operating threshold.'}
report['bank']=str(args.bank.relative_to(root))
args.report.parent.mkdir(parents=True,exist_ok=True)
args.report.write_text(json.dumps(report,indent=2),encoding='utf-8')
cfg=json.loads(args.input_config.read_text(encoding='utf-8'))
profile=cfg['singleImage'] if args.profile=='single-image' else cfg['cameras']['side-0']
profile.update(patchcore=str(args.bank.relative_to(root)),anomalyThreshold=threshold,experimental=True)
if args.profile=='side-0':
    cfg['version']='yolo12-patchcore-local-experimental-v2'
args.output_config.parent.mkdir(parents=True,exist_ok=True)
args.output_config.write_text(json.dumps(cfg,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report))
