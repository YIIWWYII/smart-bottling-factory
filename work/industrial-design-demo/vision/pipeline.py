"""Shared OpenCV preprocessing and real YOLO12 / anomalib PatchCore inference."""
import base64
import json
from pathlib import Path

import cv2
import numpy as np
import torch

CAMERAS = ('top', 'side-0', 'side-120', 'side-240')
torch.set_num_threads(2)


def decode_image(data):
    if not isinstance(data, str) or not data.startswith(('data:image/jpeg;base64,', 'data:image/png;base64,', 'data:image/webp;base64,')):
        raise ValueError('需要 JPEG、PNG 或 WebP 的 data URL')
    raw = base64.b64decode(data.split(',', 1)[1], validate=True)
    if len(raw) > 8 * 1024 * 1024:
        raise ValueError('单张图片不能超过 8 MB')
    image = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError('无法解码图像')
    return image


def image_url(image):
    ok, encoded = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 88])
    if not ok:
        raise ValueError('无法编码图像')
    return 'data:image/jpeg;base64,' + base64.b64encode(encoded).decode()


def preprocess(image, config, root):
    """ROI uses normalized xyxy; excluded rectangles use aligned-image coordinates."""
    h, w = image.shape[:2]
    x1, y1, x2, y2 = config.get('roi', [0, 0, 1, 1])
    if not (0 <= x1 < x2 <= 1 and 0 <= y1 < y2 <= 1):
        raise ValueError('ROI 超出图像或为空')
    cropped = image[int(y1*h):int(y2*h), int(x1*w):int(x2*w)]
    if min(cropped.shape[:2]) < 16:
        raise ValueError('ROI 太小')
    size = int(config.get('size', 256))
    if size < 64 or size > 1024:
        raise ValueError('预处理尺寸应为 64～1024')
    aligned = cv2.resize(cropped, (size, size))
    reference = config.get('reference')
    if reference:
        ref = cv2.imread(str(root / reference))
        if ref is None:
            raise ValueError('参考图像不存在')
        ref = cv2.resize(ref, (size, size))
        try:
            correlation, warp = cv2.findTransformECC(
                cv2.cvtColor(ref, cv2.COLOR_BGR2GRAY), cv2.cvtColor(aligned, cv2.COLOR_BGR2GRAY),
                np.eye(2, 3, dtype=np.float32), cv2.MOTION_EUCLIDEAN,
                (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 80, 1e-5))
        except cv2.error as exc:
            raise ValueError('图像对齐失败，需要复检') from exc
        if correlation < config.get('minCorrelation', 0.7):
            raise ValueError('图像与参考不匹配，需要复检')
        aligned = cv2.warpAffine(aligned, warp, (size, size), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP)
    mask = np.ones((size, size), np.uint8)
    for a, b, c, d in config.get('exclude', []):
        if not (0 <= a < c <= 1 and 0 <= b < d <= 1):
            raise ValueError('排除区域无效')
        mask[int(b*size):int(d*size), int(a*size):int(c*size)] = 0
    if not mask.any():
        raise ValueError('没有有效检测区域')
    masked = aligned.copy()
    masked[mask == 0] = 127
    return aligned, masked, mask


def tensor_image(image):
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    tensor = torch.from_numpy(rgb.copy()).permute(2, 0, 1).float().div(255)
    return ((tensor - torch.tensor([.485, .456, .406])[:, None, None]) /
            torch.tensor([.229, .224, .225])[:, None, None]).unsqueeze(0)


def make_patchcore(pretrained=True):
    from anomalib.models.image.patchcore.torch_model import PatchcoreModel
    # Small backbone makes CPU demonstrations practical. It still uses the official PatchCore algorithm.
    return PatchcoreModel(backbone='resnet18', layers=['layer2', 'layer3'],
                         pre_trained=pretrained, num_neighbors=1).eval()


def aggregate(cameras):
    if any(c['status'] == 'reject' for c in cameras):
        return 'reject'
    return 'pass' if all(any(c['cameraId'] == i and c['status'] == 'pass' for c in cameras) for i in CAMERAS) else 'review'


class Pipeline:
    def __init__(self, root):
        self.root = Path(root)
        self.yolo = {}
        self.patchcore = {}

    def inspect(self, image, cfg):
        from ultralytics import YOLO
        aligned, masked, mask = preprocess(image, cfg.get('preprocess', {}), self.root)
        weights = self.root / cfg.get('weights', 'models/yolo12n.pt')
        if not weights.is_file():
            raise ValueError('YOLO12 权重未下载或未训练')
        key = (str(weights), weights.stat().st_mtime_ns)
        if key not in self.yolo:
            self.yolo.clear()
            self.yolo[key] = YOLO(str(weights))
        result = self.yolo[key].predict(masked, device='cpu', imgsz=320,
                                      conf=cfg.get('confidence', .35), verbose=False)[0]
        defects, detections = [], []
        overlay = aligned.copy()
        for box in result.boxes:
            x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
            x1, x2 = max(0, x1), min(mask.shape[1], x2)
            y1, y2 = max(0, y1), min(mask.shape[0], y2)
            region = mask[y1:y2, x1:x2]
            if not region.size or region.mean() < cfg.get('minValidBoxFraction', .5):
                continue
            name = result.names[int(box.cls[0])]
            detection = {'class': name, 'confidence': round(float(box.conf[0]), 4), 'xyxy': [x1, y1, x2, y2]}
            detections.append(detection)
            is_defect = cfg.get('trainedForDefects', False) and name in cfg.get('defectClasses', [])
            if is_defect:
                defects.append(detection)
            color = (50, 50, 220) if is_defect else (220, 160, 30)
            cv2.rectangle(overlay, (x1, y1), (x2, y2), color, 2)
            cv2.putText(overlay, name, (x1, max(14, y1-4)), cv2.FONT_HERSHEY_SIMPLEX, .45, color, 1)
        score, heatmap, patch_ready = None, None, False
        bank_path = self.root / cfg.get('patchcore', 'models/not-trained.pt')
        if bank_path.is_file():
            bank_key = (str(bank_path), bank_path.stat().st_mtime_ns)
            if bank_key not in self.patchcore:
                payload = torch.load(bank_path, map_location='cpu', weights_only=True)
                model = make_patchcore(False)
                model.load_state_dict(payload['state_dict'])
                self.patchcore.clear()
                self.patchcore[bank_key] = (model.eval(), payload)
            model, payload = self.patchcore[bank_key]
            if payload['preprocess'] != cfg.get('preprocess', {}):
                raise ValueError('预处理配置已变化，需要重建 PatchCore 特征库')
            with torch.inference_mode():
                prediction = model(tensor_image(masked))
            anomaly = prediction.anomaly_map[0, 0].numpy()
            score = float(anomaly[mask.astype(bool)].max())
            scale = float(cfg.get('anomalyThreshold') or max(score, .01))
            heat = cv2.applyColorMap(np.uint8(np.clip(anomaly / scale, 0, 1)*255), cv2.COLORMAP_JET)
            heatmap = cv2.addWeighted(aligned, .55, heat, .45, 0)
            heatmap[mask == 0] = aligned[mask == 0]
            patch_ready = cfg.get('anomalyThreshold') is not None
        if defects:
            status, reason = 'reject', '检出已知缺陷：' + '、'.join(sorted({d['class'] for d in defects}))
        elif not cfg.get('trainedForDefects'):
            status, reason = 'review', '通用预训练模型仅验证识别链路，尚不能判定瓶体缺陷'
        elif not patch_ready:
            status, reason = 'review', 'PatchCore 特征库或校准阈值尚未就绪'
        elif score >= cfg['anomalyThreshold']:
            status, reason = 'review', 'PatchCore 发现外观异常，请人工复检'
        elif cfg.get('experimental', False):
            status, reason = 'review', '两分支未检出问题，但样本不足，实验模型不能自动放行'
        else:
            status, reason = 'pass', '当前有效区域内两条检测分支均未发现问题'
        return {'status': status, 'reason': reason, 'detections': detections,
                'anomalyScore': score, 'imageUrl': image_url(image),
                'overlayUrl': image_url(overlay), 'preprocessedUrl': image_url(masked),
                **({'heatmapUrl': image_url(heatmap)} if heatmap is not None else {})}
