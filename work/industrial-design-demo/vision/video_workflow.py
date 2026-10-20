"""Offline four-camera prototype. CLI is suitable for a VS Code terminal.

Fixed empty-background detector is a replaceable experimental detector, NOT a
trained bottle/cap recognizer. Same-object association requires measured camera
clock offsets and travel delays. Ambiguous matches are never forced by ordinal.
"""
import argparse
import json
from pathlib import Path
import cv2
import numpy as np

CAMERAS = ('top', 'side-0', 'side-120', 'side-240')


def save_image(path, image):
    ok, encoded = cv2.imencode(path.suffix, image)
    if not ok: raise OSError(f'Image encoding failed: {path}')
    encoded.tofile(str(path))


def rectangle(roi, width, height):
    a, b, c, d = roi
    if not (0 <= a < c <= 1 and 0 <= b < d <= 1):
        raise ValueError('ROI must be normalized xyxy')
    return int(a*width), int(b*height), int(c*width), int(d*height)


def detect_foreground(frame, background, camera, settings):
    """Empty background must be captured under the same fixed-camera conditions."""
    h, w = frame.shape[:2]
    x1, y1, x2, y2 = rectangle(camera['roi'], w, h)
    delta = cv2.absdiff(frame, background).max(axis=2)
    mask = np.uint8(delta > settings['backgroundThreshold']) * 255
    mask[:y1] = 0; mask[y2:] = 0; mask[:, :x1] = 0; mask[:, x2:] = 0
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    components, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    detections = []
    for contour in components:
        if cv2.contourArea(contour) < settings['minAreaFraction'] * (x2-x1)*(y2-y1):
            continue
        x, y, bw, bh = cv2.boundingRect(contour)
        crop = frame[y:y+bh, x:x+bw]
        detections.append({'bbox': [x, y, x+bw, y+bh],
                           'center': [(x+bw/2)/w, (y+bh/2)/h],
                           'sharpness': float(cv2.Laplacian(cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var()),
                           'clipped': x <= x1+1 or y <= y1+1 or x+bw >= x2-1 or y+bh >= y2-1})
    return detections


def select_frame(samples, settings, target_center):
    midpoint = (samples[0]['time'] + samples[-1]['time']) / 2
    valid = [s for s in samples if not s['clipped'] and s['sharpness'] >= settings['sharpnessMinimum']]
    if not valid:
        raise ValueError('No complete, sharp frame in this passage')
    nearest = min(samples, key=lambda s: abs(s['time']-midpoint))
    axis = settings['travelAxis']
    speeds = [abs((b['center'][axis]-a['center'][axis])/(b['time']-a['time']))
              for a, b in zip(samples, samples[1:]) if b['time'] > a['time']]
    variable = bool(speeds and np.std(speeds)/(np.mean(speeds)+1e-6) > settings['speedVariationLimit'])
    if settings['centerFallback'] and (variable or nearest not in valid):
        chosen = min(valid, key=lambda s: (abs(s['center'][axis]-target_center[axis]), -s['sharpness']))
        reason = 'center-clear-fallback'
    else:
        chosen = min(valid, key=lambda s: abs(s['time']-midpoint))
        reason = 'interval-midpoint'
    return {**chosen, 'midpoint': midpoint, 'selectionReason': reason}


def scan_video(path, camera_id, camera, settings):
    cap = cv2.VideoCapture(str(path))
    try:
        fps = cap.get(cv2.CAP_PROP_FPS)
        count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if not cap.isOpened() or not np.isfinite(fps) or fps <= 0 or count <= 0:
            raise ValueError(f'Unreadable video or FPS: {path}')
        cap.set(cv2.CAP_PROP_POS_FRAMES, camera['backgroundFrame'])
        ok, background = cap.read()
        if not ok:
            raise ValueError('Background frame is unavailable')
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        active, complete, sequence = [], [], 0
        index = 0
        def finish(track, eof=False):
            samples = track.pop('samples')
            errors = list(track.pop('errors'))
            if eof: errors.append('video-ended-before-exit')
            if samples[0]['frame'] == 0: errors.append('video-started-with-object-present')
            if len(samples) < settings['minSamples'] or samples[-1]['time']-samples[0]['time'] < settings['minDurationSeconds']:
                errors.append('passage-too-short')
            track.update(start=samples[0]['time'], end=samples[-1]['time'], sampleCount=len(samples))
            try:
                roi = camera['roi']; center = [(roi[0]+roi[2])/2, (roi[1]+roi[3])/2]
                track['selected'] = select_frame(samples, settings, center)
            except ValueError as exc:
                errors.append(str(exc))
            track['errors'] = errors
            complete.append(track)
        while True:
            ok, frame = cap.read()
            if not ok: break
            # Offline CFR video time, NOT arrival time. Offset translates to a shared clock.
            timestamp = index/fps + camera['timeOffsetSeconds']
            detections = detect_foreground(frame, background, camera, settings)
            remaining = []
            for track in active:
                if timestamp-track['samples'][-1]['time'] > settings['maxGapSeconds']:
                    finish(track)
                else: remaining.append(track)
            active = remaining
            candidates = [[j for j, t in enumerate(active)
                           if np.linalg.norm(np.array(d['center'])-t['samples'][-1]['center']) <= settings['maxDistanceFraction']]
                          for d in detections]
            used = set()
            for d, matches in zip(detections, candidates):
                ambiguous = len(matches) > 1 or any(sum(j in row for row in candidates) > 1 for j in matches)
                if ambiguous:
                    for j in matches: active[j]['errors'].add('tracking-ambiguous')
                    continue
                if len(matches) == 1 and matches[0] not in used:
                    track = active[matches[0]]; used.add(matches[0])
                else:
                    sequence += 1
                    track = {'cameraId': camera_id, 'trackId': f'{camera_id}-{sequence:04d}', 'samples': [], 'errors': set()}
                    remaining.append(track)
                track['samples'].append({**d, 'frame': index, 'time': timestamp})
            index += 1
        for track in active: finish(track, eof=True)
        return sorted(complete, key=lambda t: t['start'])
    finally:
        cap.release()


def associate(tracks, cameras, tolerance):
    """Unique time-window match. Missing events do not shift subsequent bottle IDs."""
    tops = tracks['top']
    rows = [{'bottleId': f'BOTTLE-{i+1:04d}', 'tracks': {'top': top}, 'errors': list(top['errors'])}
            for i, top in enumerate(tops)]
    for camera_id in CAMERAS[1:]:
        pairs = []
        for top in tops:
            midpoint = (top['start']+top['end'])/2 + cameras[camera_id]['travelDelaySeconds']
            pairs.append([j for j, side in enumerate(tracks[camera_id])
                          if abs((side['start']+side['end'])/2-midpoint) <= tolerance])
        for row, candidates in zip(rows, pairs):
            if len(candidates) != 1 or sum(candidates[0] in other for other in pairs) != 1:
                row['errors'].append(f'{camera_id}: missing-or-ambiguous-association')
                continue
            track = tracks[camera_id][candidates[0]]
            row['tracks'][camera_id] = track
            row['errors'].extend(f'{camera_id}: {error}' for error in track['errors'])
    return rows


def read_selected(path, selected):
    cap = cv2.VideoCapture(str(path))
    try:
        cap.set(cv2.CAP_PROP_POS_FRAMES, selected['frame'])
        ok, frame = cap.read()
        if not ok: raise ValueError('Selected frame could not be decoded')
        return frame
    finally:
        cap.release()


def unwrap_cylinder(views, cameras, settings):
    """Orthographic cylindrical projection: x = cx + radius * sin(theta).

    Requires upright, calibrated side views, equal axial crop extent and a
    cylindrical body. Not valid for shoulders, arbitrary bottle shapes or
    uncorrected perspective/lens distortion. Angles are configuration, not
    estimated camera calibration.
    """
    width, height = settings['width'], settings['height']
    if not (64 <= width <= 4096 and 64 <= height <= 2048): raise ValueError('Invalid panorama dimensions')
    half = settings['halfViewDegrees']
    if not 60 < half < 85: raise ValueError('Half view must provide overlap and avoid grazing angles')
    theta = np.arange(width, dtype=np.float32) * 360/width
    total = np.zeros((height, width, 3), np.float32)
    weight_sum = np.zeros((height, width), np.float32)
    projected = []
    for camera_id in CAMERAS[1:]:
        frame, bbox = views[camera_id]
        x1, y1, x2, y2 = bbox
        if x2-x1 < 8 or y2-y1 < 8: raise ValueError('Cylinder region too small')
        delta = (theta-cameras[camera_id]['angleDegrees']+180) % 360-180
        visible = abs(delta) < half
        # Pixel centers, avoid sampling outside the calibrated crop.
        x = (x1+x2-1)/2 + (x2-x1-1)/2*np.sin(np.deg2rad(delta))
        y = np.linspace(y1, y2-1, height, dtype=np.float32)
        mx = np.broadcast_to(x, (height,width)).astype(np.float32)
        my = np.broadcast_to(y[:,None], (height,width)).copy()
        projected_image = cv2.remap(frame, mx, my, cv2.INTER_LINEAR)
        weights = np.broadcast_to(np.maximum(0, 1-abs(delta)/half)*visible, (height,width))
        projected.append((projected_image, visible))
        total += projected_image*weights[:,:,None]; weight_sum += weights
    if (weight_sum < 1e-5).any(): raise ValueError('Camera angles leave gaps in surface coverage')
    differences = []
    for i in range(3):
        for j in range(i+1,3):
            overlap = projected[i][1] & projected[j][1]
            if overlap.any():
                differences.append(float(np.abs(projected[i][0][:,overlap].astype(float)-projected[j][0][:,overlap]).mean()))
    return np.uint8(np.clip(total/weight_sum[:,:,None],0,255)), max(differences, default=0)


def align_and_mask(image, settings, profile_dir):
    aligned = image.copy()
    reference = settings.get('reference')
    if reference:
        ref_path = profile_dir/reference
        ref = cv2.imdecode(np.fromfile(str(ref_path), dtype=np.uint8),cv2.IMREAD_COLOR) if ref_path.is_file() else None
        if ref is None or ref.shape != image.shape: raise ValueError('Panorama reference missing or shape differs')
        try:
            correlation, warp = cv2.findTransformECC(cv2.cvtColor(ref,cv2.COLOR_BGR2GRAY),cv2.cvtColor(image,cv2.COLOR_BGR2GRAY),np.eye(2,3,dtype=np.float32),cv2.MOTION_TRANSLATION)
        except cv2.error as exc: raise ValueError('Panorama alignment failed') from exc
        if correlation < settings['minimumCorrelation']: raise ValueError('Panorama reference mismatch')
        # Circular horizontal wrap is appropriate for a cylinder. Vertical displacement is rejected.
        if abs(warp[1,2]) > 1: raise ValueError('Vertical misalignment requires camera/crop correction')
        aligned = cv2.warpAffine(image,warp,(image.shape[1],image.shape[0]),flags=cv2.INTER_LINEAR|cv2.WARP_INVERSE_MAP,borderMode=cv2.BORDER_WRAP)
    mask = np.full(image.shape[:2],255,np.uint8)
    for polygon in settings['excludePolygons']:
        pts = np.asarray(polygon,dtype=float)
        if pts.ndim != 2 or pts.shape[1] != 2 or len(pts)<3 or not np.isfinite(pts).all() or (pts<0).any() or (pts>1).any():
            raise ValueError('Mask polygon needs >=3 normalized xy points')
        pixel = np.round(pts*np.array([image.shape[1]-1,image.shape[0]-1])).astype(np.int32)
        cv2.fillPoly(mask,[pixel],0)
    if not mask.any(): raise ValueError('Mask excludes the entire panorama')
    masked = aligned.copy(); masked[mask==0] = 127
    return aligned, masked, mask


def run(profile, videos, output, fixture=False):
    cfg = json.loads(profile.read_text(encoding='utf-8-sig'))
    output.mkdir(parents=True, exist_ok=False)
    tracks = {camera: scan_video(videos[camera],camera,cfg['cameras'][camera],cfg['tracking']) for camera in CAMERAS}
    bottles = associate(tracks,cfg['cameras'],cfg['association']['toleranceSeconds'])
    for row in bottles:
        folder = output/row['bottleId']; folder.mkdir()
        row['verdict'] = 'review'
        if row['errors']: continue
        try:
            views = {}
            for camera, track in row['tracks'].items():
                frame = read_selected(videos[camera],track['selected'])
                save_image(folder/f'{camera}.jpg',frame)
                bbox = track['selected']['bbox']
                # Optional calibrated cylinder-only crop inside detected foreground bounds.
                if camera != 'top' and 'bodyRoi' in cfg['cameras'][camera]:
                    x1,y1,x2,y2=bbox; a,b,c,d=rectangle(cfg['cameras'][camera]['bodyRoi'],x2-x1,y2-y1)
                    bbox=[x1+a,y1+b,x1+c,y1+d]
                views[camera]=(frame,bbox)
            panorama, difference = unwrap_cylinder(views,cfg['cameras'],cfg['unwrap'])
            row['overlapMeanDifference'] = round(difference,3)
            save_image(folder/'panorama.jpg',panorama)
            if difference > cfg['unwrap']['maximumOverlapMeanDifference']:
                raise ValueError('Overlap mismatch: inspect synchronization, crop, lighting and calibration')
            aligned, masked, mask = align_and_mask(panorama,cfg['unwrap'],profile.parent)
            for name,image in [('aligned',aligned),('masked',masked),('valid-region',mask)]: save_image(folder/f'{name}.png',image)
            row['errors'].append('unwrapped-models-not-trained; top-model-not-validated')
            # Do not reuse side-view weights or bank on a panorama.
            if cfg['inspection'].get('enabled'):
                raise ValueError('Panorama model integration requires matching training preprocessing; not enabled in this prototype')
        except (ValueError,cv2.error) as exc:
            row['errors'].append(str(exc))
    report = {'version':cfg['version'],'syntheticFixture':fixture,'scope':'offline CFR videos; experimental background tracker and calibrated-cylinder assumption',
              'clock':'frameIndex / FPS + timeOffsetSeconds; live streams need capture timestamps',
              'tracks':tracks,'bottles':bottles,'unassociatedTracks':{c:[t['trackId'] for t in tracks[c] if not any(t is r['tracks'].get(c) for r in bottles)] for c in CAMERAS[1:]}}
    (output/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    return report


if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--profile',type=Path,default=Path(__file__).with_name('video_workflow.json'))
    p.add_argument('--videos',type=Path,required=True,help='Directory containing top.mp4, side-0.mp4, side-120.mp4, side-240.mp4')
    p.add_argument('--output',type=Path,required=True,help='New output directory; existing results are never overwritten')
    p.add_argument('--synthetic-fixture',action='store_true')
    args=p.parse_args()
    result=run(args.profile,{c:args.videos/f'{c}.mp4' for c in CAMERAS},args.output,args.synthetic_fixture)
    print(json.dumps({'bottles':len(result['bottles']),'report':str(args.output/'report.json')},ensure_ascii=False))
