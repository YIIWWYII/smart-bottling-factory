import json
import hashlib
import os
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from pipeline import CAMERAS, Pipeline, aggregate, decode_image

ROOT = Path(os.environ.get('VISION_DATA', '/data'))
ROOT.mkdir(parents=True, exist_ok=True)
pipeline = Pipeline(ROOT)
lock = threading.Lock()
app = FastAPI(title='瓶安视觉实训服务', version='1.0.0')
app.mount('/tutorial', StaticFiles(directory=ROOT / 'tutorial', html=True, check_dir=False), name='tutorial')
app.add_middleware(CORSMiddleware, allow_origins=['http://127.0.0.1:5174', 'http://localhost:5174', 'http://127.0.0.1:8095'], allow_methods=['GET', 'POST'], allow_headers=['Content-Type', 'Authorization'])


def config():
    return json.loads((ROOT / 'config.json').read_text(encoding='utf-8'))


class Frame(BaseModel):
    cameraId: str
    data: str = Field(max_length=12_000_000)
    bottleId: str | None = None
    batchId: str | None = None


class Inspection(BaseModel):
    requestId: str = Field(min_length=1, max_length=150)
    bottleId: str = Field(min_length=1, max_length=150)
    batchId: str = Field(min_length=1, max_length=150)
    modelName: str = ''
    images: list[Frame] = Field(max_length=4)


@app.get('/')
def home():
    return FileResponse(Path(__file__).with_name('camera.html'))


@app.get('/health')
def health():
    cfg = config()
    weights_ready = all((ROOT / c['weights']).is_file() for c in cfg['cameras'].values())
    return {'status': 'ready' if weights_ready else 'loading', 'contract': 'bottleworks-vision-v1',
            'engine': 'YOLO12 + OpenCV + PatchCore（CPU）', 'version': cfg['version'], 'demo': False,
            'defectModelsReady': all(c.get('trainedForDefects', False) for c in cfg['cameras'].values()),
            'patchcoreReady': {i: bool(c.get('patchcore') and (ROOT/c['patchcore']).is_file() and c.get('anomalyThreshold') is not None) for i,c in cfg['cameras'].items()}}


@app.post('/inspect')
def inspect(body: Inspection):
    return run_inspection(body, strict=True)


@app.post('/inspect/debug')
def inspect_debug(body: Inspection):
    return run_inspection(body, strict=False)


def run_inspection(body: Inspection, strict=True):
    ids = [f.cameraId for f in body.images]
    if len(ids) != len(set(ids)) or any(i not in CAMERAS for i in ids):
        raise HTTPException(400, '机位重复或不存在')
    if not lock.acquire(blocking=False):
        raise HTTPException(429, '上一批图像仍在处理，请稍后重试')
    try:
        started = time.perf_counter()
        cfg = config()
        cameras = []
        frames = {f.cameraId: f.data for f in body.images}
        decoded, errors = {}, {}
        fingerprints = set()
        for f in body.images:
            try:
                if (f.bottleId is not None and f.bottleId != body.bottleId) or (f.batchId is not None and f.batchId != body.batchId):
                    raise ValueError('机位图像的瓶子或批次编号不一致')
                decoded[f.cameraId] = decode_image(f.data)
                digest = hashlib.sha256(decoded[f.cameraId].tobytes()).hexdigest()
                if strict and digest in fingerprints:
                    raise ValueError('不同机位重复使用同一张图像，请重新采集')
                fingerprints.add(digest)
            except (ValueError, OSError) as exc:
                errors[f.cameraId] = str(exc)
        blocked = strict and (len(frames) != 4 or bool(errors))
        for camera in CAMERAS:
            row = {'cameraId': camera}
            if camera not in frames:
                row.update(status='missing', reason='未收到此机位图像')
            elif camera in errors:
                row.update(status='error', reason=errors[camera])
            elif blocked:
                row.update(status='review', reason='整瓶采集检查未通过，本机位未运行模型')
            else:
                try:
                    row.update(pipeline.inspect(decoded[camera], cfg['cameras'][camera]))
                except (ValueError, OSError, RuntimeError) as exc:
                    row.update(status='error', reason=str(exc))
            cameras.append(row)
        result = {'requestId': body.requestId, 'bottleId': body.bottleId, 'batchId': body.batchId,
                  'version': cfg['version'], 'engine': 'YOLO12/OpenCV/PatchCore', 'demo': False,
                  'timestamp': datetime.now(timezone.utc).isoformat(), 'cameras': cameras,
                  'mode': 'bottle' if strict else 'single-view-debug',
                  'preflight': {'passed': not blocked and not errors, 'inferenceSkipped': blocked,
                                'association': '按提交的瓶号关联；不能仅凭编号证明物理上是同一瓶'},
                  'verdict': aggregate(cameras), 'durationMs': round((time.perf_counter()-started)*1000, 1)}
        result['reason'] = '；'.join(f"{c['cameraId']}: {c['reason']}" for c in cameras)
        folder = ROOT / 'records'
        folder.mkdir(exist_ok=True)
        (folder / f'{uuid4().hex}.json').write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
        return result
    finally:
        lock.release()


class Capture(BaseModel):
    cameraId: str
    data: str = Field(max_length=12_000_000)
    label: str = 'unreviewed'


@app.post('/capture')
def capture(body: Capture):
    import cv2
    if body.cameraId not in CAMERAS or body.label not in ['normal', 'defect', 'unreviewed']:
        raise HTTPException(400, '机位或样本类别不正确')
    try:
        image = decode_image(body.data)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    folder = ROOT / 'captures' / body.cameraId / body.label
    folder.mkdir(parents=True, exist_ok=True)
    name = datetime.now().strftime('%Y%m%d-%H%M%S') + '-' + uuid4().hex[:8] + '.jpg'
    if not cv2.imwrite(str(folder/name), image):
        raise HTTPException(500, '保存图像失败')
    return {'saved': str((folder/name).relative_to(ROOT))}
