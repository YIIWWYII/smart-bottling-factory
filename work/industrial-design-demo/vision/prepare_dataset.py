"""Prepare a copy of the supplied YOLO dataset, without treating missing labels as normal."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

def main():
    p = argparse.ArgumentParser()
    p.add_argument('source', type=Path)
    p.add_argument('--output', type=Path, default=Path('F:/BottleAI/vision/datasets/local-blot'))
    p.add_argument('--confirmed-normal', type=Path, help='Explicit user-confirmed normal image manifest')
    args = p.parse_args()
    normals = set(json.loads(args.confirmed_normal.read_text(encoding='utf-8'))['files']) if args.confirmed_normal else set()
    report = {'included': {}, 'unlabeled': [], 'duplicates': [], 'invalid': [], 'scope': 'blot only; no confirmed normal samples; no independent test split'}
    seen = set()
    for split in ['train', 'val']:
        count = 0
        for image in sorted((args.source/'images'/split).glob('*.jpg')):
            label = args.source/'labels'/split/(image.stem+'.txt')
            normal = str(image) in normals
            if not label.exists() and not normal:
                report['unlabeled'].append(str(image)); continue
            lines = [] if normal else label.read_text(encoding='utf-8-sig').strip().splitlines()
            try:
                assert lines or normal
                for line in lines:
                    values = line.split()
                    assert len(values) == 5 and values[0] == '0'
                    x,y,w,h = map(float, values[1:])
                    assert 0 < w <= 1 and 0 < h <= 1 and 0 <= x <= 1 and 0 <= y <= 1
            except (AssertionError, ValueError):
                report['invalid'].append(str(label)); continue
            digest = hashlib.sha256(image.read_bytes()).hexdigest()
            if digest in seen:
                report['duplicates'].append(str(image)); continue
            seen.add(digest)
            for kind, src in [('images', image), ('labels', label)]:
                dest = args.output/kind/split/src.name
                dest.parent.mkdir(parents=True, exist_ok=True)
                if kind == 'labels' and normal:
                    dest.write_text('', encoding='utf-8')
                else:
                    shutil.copy2(src, dest)
            count += 1
        report['included'][split] = count
    report['confirmedNormal'] = len(normals)
    report['scope'] = 'blot with explicitly confirmed normal negatives; original train/val split; bottle-level grouping still unverified'
    (args.output/'data.yaml').write_text(f'path: /data/datasets/{args.output.name}\ntrain: images/train\nval: images/val\nnames:\n  0: blot\n', encoding='utf-8')
    (args.output/'audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k: (len(v) if isinstance(v,list) else v) for k,v in report.items()},ensure_ascii=False))

if __name__ == '__main__':
    main()
