import json
import hashlib
import os
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
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
app.add_middleware(CORSMiddleware, allow_origins=['http://127.0.0.1:5174', 'http://localhost:5174', 'http://127.0.0.1:8095'], allow_origin_regex=r'https?://(?:localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})(?::\d+)?', allow_methods=['GET', 'POST'], allow_headers=['Content-Type', 'Authorization'])


def config():
    path = Path(os.environ.get('VISION_CONFIG', str(ROOT / 'config.json')))
    return json.loads(path.read_text(encoding='utf-8'))


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
    return FileResponse(Path(__file__).with_name('single-image.html'))


@app.get('/capture-lab')
def capture_lab():
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


class SingleImage(BaseModel):
    data: str = Field(max_length=12_000_000)
    caseId: str = Field(default='', max_length=120)
    filename: str = Field(default='', max_length=200)


@app.get('/single/status')
def single_status():
    cfg=config()
    profile=cfg.get('singleImage')
    if not profile:
        raise HTTPException(503, '尚未配置单图检测模型')
    return {'version':profile.get('version',cfg['version']), 'name':profile.get('name','单图检测'),
            'experimental':profile.get('experimental',True),
            'yoloReady':(ROOT/profile.get('weights','')).is_file(),
            'patchcoreReady':(ROOT/profile.get('patchcore','')).is_file(),
            'threshold':profile.get('anomalyThreshold'),
            'scope':profile.get('scope',''), 'modelFiles':profile.get('modelFiles',{}), 'defectClasses':profile.get('defectClasses',[])}


@app.post('/inspect/image')
def inspect_image(body: SingleImage):
    try:
        image=decode_image(body.data)
    except (ValueError,OSError) as exc:
        raise HTTPException(400, str(exc)) from exc
    if not lock.acquire(blocking=False):
        raise HTTPException(429, '上一张图片仍在检测，请稍后重试')
    try:
        started=time.perf_counter()
        cfg=config()
        if 'singleImage' not in cfg:
            raise HTTPException(503,'尚未配置单图检测模型')
        try:
            result=pipeline.inspect(image,cfg['singleImage'])
        except (ValueError,OSError,RuntimeError) as exc:
            raise HTTPException(503,str(exc)) from exc
        result.update(requestId=uuid4().hex,caseId=body.caseId,filename=body.filename,
                      version=cfg['singleImage'].get('version',cfg['version']),mode='single-image',
                      timestamp=datetime.now(timezone.utc).isoformat(),
                      durationMs=round((time.perf_counter()-started)*1000,1))
        result['verdict']=result['status']
        result['scope']=cfg['singleImage'].get('scope','')
        folder=ROOT/'records';folder.mkdir(exist_ok=True)
        (folder/(result['requestId']+'.json')).write_text(json.dumps(result,ensure_ascii=False),encoding='utf-8')
        return result
    finally:
        lock.release()


@app.post('/single/models')
def upload_models(yolo: UploadFile = File(...), patchcore: UploadFile = File(...),
                  threshold: float = Form(...), defect_classes: str = Form(...)):
    import math
    import torch
    import numpy as np
    from ultralytics import YOLO
    from pipeline import make_patchcore, tensor_image, preprocess
    if not math.isfinite(threshold) or threshold <= 0:
        raise HTTPException(400, '请填写训练后校准得到的正数阈值')
    classes = [x.strip() for x in defect_classes.split(',') if x.strip()]
    if not classes:
        raise HTTPException(400, '请填写缺陷类别，多个类别用英文逗号分隔')
    if not lock.acquire(blocking=False):
        raise HTTPException(429, '检测或模型加载尚未结束，请稍后重试')
    paths = []
    committed = False
    try:
        folder = ROOT / 'models'; folder.mkdir(exist_ok=True)
        for upload, kind in [(yolo, 'yolo'), (patchcore, 'patchcore')]:
            if Path(upload.filename or '').suffix.lower() != '.pt':
                raise ValueError('请上传 .pt 模型文件')
            target = folder / (kind + '-' + uuid4().hex + '.pt')
            paths.append(target)
            total = 0
            with target.open('wb') as out:
                while chunk := upload.file.read(1024 * 1024):
                    total += len(chunk)
                    if total > 512 * 1024 * 1024:
                        raise ValueError('每个模型文件不能超过 512 MB')
                    out.write(chunk)
            if total == 0:
                raise ValueError('模型文件为空')
        detector = YOLO(str(paths[0]))
        if detector.task != 'detect':
            raise ValueError('YOLO 文件须为目标检测模型')
        available = set(detector.names.values())
        if not set(classes).issubset(available):
            raise ValueError('缺陷类别与模型不一致；模型类别：' + ', '.join(sorted(available)))
        payload = torch.load(paths[1], map_location='cpu', weights_only=True)
        if not isinstance(payload, dict) or not {'state_dict', 'preprocess'}.issubset(payload):
            raise ValueError('PatchCore 请使用本资料包训练程序导出的 .pt（含特征库和预处理设置）')
        model = make_patchcore(False)
        model.load_state_dict(payload['state_dict'])
        model.eval()
        _, probe, _, _ = preprocess(np.full((320,320,3), 180, dtype=np.uint8), payload['preprocess'], ROOT, with_metadata=True)
        detector.predict(probe, device='cpu', imgsz=320, verbose=False)
        with torch.inference_mode():
            model(tensor_image(probe))
        cfg = config()
        profile = dict(cfg.get('singleImage', {}))
        profile.update(weights=str(paths[0].relative_to(ROOT)), patchcore=str(paths[1].relative_to(ROOT)),
                       preprocess=payload['preprocess'], anomalyThreshold=threshold,
                       defectClasses=classes, trainedForDefects=True,
                       experimental=bool(payload.get('experimental', True)),
                       name='已上传的联合检测模型', version='uploaded-' + uuid4().hex[:8],
                       scope='缺陷类别：' + ', '.join(classes),
                       modelFiles={'yolo':Path(yolo.filename).name,'patchcore':Path(patchcore.filename).name})
        cfg['singleImage'] = profile
        config_path = Path(os.environ.get('VISION_CONFIG', str(ROOT / 'config.json')))
        temporary = config_path.with_suffix('.tmp')
        temporary.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding='utf-8')
        temporary.replace(config_path)
        committed = True
        pipeline.yolo.clear(); pipeline.patchcore.clear()
        return {'message':'两个模型已加载并通过试运行，可以选择图片检测。', 'version':profile['version']}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, '模型加载失败，原配置保留：' + str(exc)) from exc
    finally:
        if not committed:
            for path in paths:
                path.unlink(missing_ok=True)
        lock.release()
