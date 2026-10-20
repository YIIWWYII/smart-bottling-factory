"""Download only MVTec AD bottle from the public Voxel51 mirror; preserve provenance."""
import concurrent.futures
import json
from pathlib import Path
import urllib.request

BASE = 'https://huggingface.co/datasets/Voxel51/mvtec-ad/resolve/main/'
ROOT = Path('F:/BottleAI/vision/datasets/public/mvtec-bottle')

def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(BASE+'samples.json', timeout=30) as r:
        rows = [s for s in json.load(r)['samples'] if s['category']['label'] == 'bottle']
    (ROOT/'source.json').write_text(json.dumps({'original': 'https://www.mvtec.com/research-teaching/datasets/mvtec-ad',
        'mirror': BASE, 'license': 'CC BY-NC-SA 4.0', 'samples': rows},indent=2),encoding='utf-8')
    def get(row):
        name = Path(row['filepath']).stem + '-' + row['_id']['$oid'][-8:] + '.png'
        target = ROOT/row['split']/row['defect']['label']/name
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            with urllib.request.urlopen(BASE+row['filepath'], timeout=60) as r:
                data = r.read()
            target.write_bytes(data)
        mask = row.get('defect_mask', {}).get('mask_path')
        if mask:
            out = ROOT/'ground_truth'/row['defect']['label']/name
            out.parent.mkdir(parents=True, exist_ok=True)
            if not out.exists():
                with urllib.request.urlopen(BASE+mask,timeout=60) as r:
                    out.write_bytes(r.read())
        return name
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for i, name in enumerate(pool.map(get, rows), 1):
            if i % 20 == 0 or i == len(rows):
                print(f'{i}/{len(rows)} downloaded',flush=True)

if __name__ == '__main__':
    main()
