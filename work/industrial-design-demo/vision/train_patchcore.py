"""Build a per-product/per-view normal feature bank, excluding masked patch locations."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import cv2
import torch
from pipeline import make_patchcore, preprocess, tensor_image, CAMERAS

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--normal', required=True, help='Human-confirmed normal training images; no validation/test images')
    p.add_argument('--camera', choices=CAMERAS, required=True)
    p.add_argument('--output', required=True)
    p.add_argument('--ratio', type=float, default=.05)
    p.add_argument('--experimental-small-set', action='store_true')
    args = p.parse_args()
    if not 0 < args.ratio <= 1:
        p.error('--ratio must be in (0, 1]')
    root = Path(os.environ.get('VISION_DATA', '/data'))
    cfg = json.loads((root/'config.json').read_text())['cameras'][args.camera]['preprocess']
    files = sorted(x for x in Path(args.normal).iterdir() if x.suffix.lower() in ['.jpg', '.png', '.jpeg'])
    files = list({hashlib.sha256(f.read_bytes()).hexdigest(): f for f in files}.values())
    if len(files) < 5 and not (args.experimental_small_set and len(files) >= 2):
        p.error('至少需要 5 张人工确认的正常训练图；实际效果需更多多样样本和独立验证')
    model = make_patchcore(True)
    with torch.inference_mode():
        for file in files:
            image = cv2.imread(str(file))
            if image is None:
                raise ValueError(f'Cannot read {file}')
            _, masked, mask = preprocess(image, cfg, root)
            features = model.feature_extractor(tensor_image(masked))
            features = {k: model.feature_pooler(v) for k, v in features.items()}
            embedding = model.generate_embedding(features)
            h, w = embedding.shape[-2:]
            valid = cv2.resize(mask, (w, h), interpolation=cv2.INTER_NEAREST).ravel().astype(bool)
            model.embedding_store.append(model.reshape_embedding(embedding)[valid])
            print(f'Features: {file.name}', flush=True)
        model.subsample_embedding(args.ratio)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    torch.save({'state_dict': model.state_dict(), 'preprocess': cfg,
                'cameraId': args.camera, 'sourceImages': [str(f) for f in files],
                'experimental': args.experimental_small_set,
                'backbone': 'resnet18', 'numNeighbors': 1}, output)
    print(f'Saved {output}; threshold not calibrated. Do not mark production ready.')

if __name__ == '__main__':
    main()
