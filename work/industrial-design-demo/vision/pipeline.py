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


def locate_barcode(image, settings):
    """Locate one-dimensional barcodes per frame; no decoding or template bank."""
    if settings.get('required') is False:
        return {'status':'not-required','regions':[], 'validated':settings.get('validated') is True,
                'reason':'此机位已配置为不含条形码'}
    roi = settings.get('searchRoi', [0,0,1,1])
    if not isinstance(roi,list) or len(roi)!=4 or not all(isinstance(v,(int,float)) for v in roi) or not (0<=roi[0]<roi[2]<=1 and 0<=roi[1]<roi[3]<=1):
        raise ValueError('条形码搜索区域应为有效的归一化坐标')
    h,w=image.shape[:2]
    x0,y0,x9,y9=[int(v*n) for v,n in zip(roi,[w,h,w,h])]
    if min(x9-x0,y9-y0)<8:
        raise ValueError('条形码搜索区域太小')
    crop=image[y0:y9,x0:x9]
    detector=cv2.barcode_BarcodeDetector()
    found, points=detector.detect(crop)
    if not found:
        # Reorient candidate images; return all corners to the original image coordinates.
        rh,rw=crop.shape[:2]
        for angle in (-15,15,-30,30,-45,45,90):
            matrix=cv2.getRotationMatrix2D((rw/2,rh/2),angle,1)
            rotated=cv2.warpAffine(crop,matrix,(rw,rh),borderValue=(255,255,255))
            found,points=detector.detect(rotated)
            if found and points is not None:
                inverse=cv2.invertAffineTransform(matrix)
                points=cv2.transform(points.reshape(-1,1,2),inverse).reshape(-1,4,2)
                break
    if not found or points is None:
        return {'status':'no-code' if settings.get('allowMissing') else 'not-found','regions':[],
                'validated': settings.get('validated') is True if settings.get('allowMissing') else False,
                'reason':'本图未检测到条形码，保留图像继续检测' if settings.get('allowMissing') else '本帧未定位到条形码，请检查清晰度、遮挡和搜索区域'}
    regions=[]
    pad=int(settings.get('paddingPixels',2))
    if not 0<=pad<=32:
        raise ValueError('条码遮罩扩边应为 0～32 像素')
    for polygon in points.reshape(-1,4,2):
        x,y,cw,ch=cv2.boundingRect(polygon.astype(np.float32))
        # Detector corners can stop inside long bars. Extend to connected dark bars
        # near the detected region, rather than blindly enlarging the whole mask.
        margin=max(4,int(max(cw,ch)*.18))
        left,top=max(0,x-margin),max(0,y-margin)
        right,bottom=min(crop.shape[1],x+cw+margin),min(crop.shape[0],y+ch+margin)
        gray=cv2.cvtColor(crop[top:bottom,left:right],cv2.COLOR_BGR2GRAY)
        if gray.size:
            _,ink=cv2.threshold(gray,0,255,cv2.THRESH_BINARY_INV|cv2.THRESH_OTSU)
            _,_,stats,_=cv2.connectedComponentsWithStats(ink)
            bounds=[x,y,x+cw,y+ch]
            for bx,by,bw,bh,area in stats[1:]:
                bx,by=bx+left,by+top
                overlaps=bx < x+cw and bx+bw > x and by < y+ch and by+bh > y
                if overlaps and area>=5 and max(bw,bh)>=min(cw,ch)*.35 and max(bw,bh)>=min(bw,bh)*2:
                    bounds=[min(bounds[0],bx),min(bounds[1],by),max(bounds[2],bx+bw),max(bounds[3],by+bh)]
            x,y,xend,yend=bounds;cw,ch=xend-x,yend-y
        regions.append([max(0,x+x0-pad),max(0,y+y0-pad),min(w,x+x0+cw+pad),min(h,y+y0+ch+pad)])
    return {'status':'masked','regions':regions,'validated':settings.get('validated') is True,
            'reason':'条形码已实时定位并遮罩' if settings.get('validated') is True else '条形码已遮罩，待实拍检查遮罩范围'}


def preprocess(image, config, root, with_metadata=False):
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
    code_mask = locate_barcode(aligned, config.get('codeMask', {})) if 'codeMask' in config else {'status':'unconfigured','regions':[],'validated':False,'reason':'尚未配置自动条形码定位'}
    for a, b, c, d in code_mask['regions']:
        mask[b:d, a:c] = 0
    if 'codeMask' in config and not with_metadata and code_mask['status'] not in ('masked','not-required','no-code'):
        raise ValueError(code_mask['reason'])
    if not mask.any():
        raise ValueError('没有有效检测区域')
    masked = aligned.copy()
    masked[mask == 0] = 127
    return (aligned, masked, mask, code_mask) if with_metadata else (aligned, masked, mask)


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
        aligned, masked, mask, code_mask = preprocess(image, cfg.get('preprocess', {}), self.root, with_metadata=True)
        if code_mask['status'] not in ('masked', 'not-required', 'no-code'):
            return {'status':'review','reason':code_mask['reason'],'codeMask':code_mask,
                    'inferenceSkipped':True,'detections':[],'anomalyScore':None,
                    'preprocessedUrl':image_url(masked),'alignedUrl':image_url(aligned)}

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
        overlay = masked.copy()
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
        overlay[mask == 0] = 127
        score, heatmap, patch_ready, patch_error = None, None, False, None
        bank_path = self.root / cfg.get('patchcore', 'models/not-trained.pt')
        try:
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
                heatmap[mask == 0] = 127
                patch_ready = cfg.get('anomalyThreshold') is not None
            else:
                patch_error = '此机位缺少 PatchCore 正常特征库'
        except (ValueError, OSError, RuntimeError, KeyError) as exc:
            patch_error = str(exc)
        if defects:
            status, reason = 'reject', '检出已知缺陷：' + '、'.join(sorted({d['class'] for d in defects}))
        elif not cfg.get('trainedForDefects'):
            status, reason = 'review', '通用预训练模型仅验证识别链路，尚不能判定瓶体缺陷'
        elif not patch_ready:
            status, reason = 'review', 'PatchCore 特征库或校准阈值尚未就绪'
        elif score >= cfg['anomalyThreshold']:
            status, reason = 'review', 'PatchCore 发现外观异常，请人工复检'
        elif not code_mask.get('validated'):
            status, reason = 'review', '本图未检出已知缺陷，条形码遮罩效果尚待人工核对'
        elif cfg.get('experimental', False):
            status, reason = 'review', '两分支未检出问题，但样本不足，实验模型不能自动放行'
        else:
            status, reason = 'pass', '当前有效区域内两条检测分支均未发现问题'
        return {'status': status, 'reason': reason, 'detections': detections,
                'anomalyScore': score, 'anomalyThreshold': cfg.get('anomalyThreshold'),
                'yoloStatus': 'reject' if defects else 'clear',
                'patchcoreStatus': ('anomaly' if score >= cfg['anomalyThreshold'] else 'clear') if patch_ready else 'unavailable',
                'experimental': cfg.get('experimental',False), 'alignedUrl': image_url(aligned), 'codeMask': code_mask, 'patchcoreError': patch_error, 'imageUrl': image_url(masked),
                'overlayUrl': image_url(overlay), 'preprocessedUrl': image_url(masked),
                **({'heatmapUrl': image_url(heatmap)} if heatmap is not None else {})}
