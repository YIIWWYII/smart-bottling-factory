import argparse
import json
from pathlib import Path
import shutil
import cv2
from ultralytics import YOLO
from pipeline import preprocess

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--epochs', type=int, default=3)
    p.add_argument('--dataset', default='local-blot')
    p.add_argument('--name', default='blot-yolo12')
    args = p.parse_args()
    root = Path('/data')
    source = root/'datasets'/args.dataset
    prepared = root/'datasets'/(args.dataset+'-preprocessed')
    config = json.loads((root/'config.json').read_text())['cameras']['side-0']['preprocess']
    if config.get('roi') != [0, 0, 1, 1] or config.get('reference') or config.get('exclude'):
        p.error('当前标注基于整幅图。裁剪、对齐或排除区变化后，需要重新转换并复核标注。')
    for split in ['train', 'val']:
        (prepared/'images'/split).mkdir(parents=True, exist_ok=True)
        (prepared/'labels'/split).mkdir(parents=True, exist_ok=True)
        for image in (source/'images'/split).glob('*.jpg'):
            _, masked, _ = preprocess(cv2.imread(str(image)), config, root)
            cv2.imwrite(str(prepared/'images'/split/image.name), masked)
            shutil.copy2(source/'labels'/split/(image.stem+'.txt'), prepared/'labels'/split/(image.stem+'.txt'))
    (prepared/'data.yaml').write_text(f'path: {prepared}\ntrain: images/train\nval: images/val\nnames:\n  0: blot\n')
    YOLO('/data/models/yolo12n.pt').train(
        data=str(prepared/'data.yaml'), epochs=args.epochs, imgsz=320,
        batch=2, device='cpu', workers=0, project='/data/runs', name=args.name,
        seed=42, plots=True, cache=False, patience=20)
