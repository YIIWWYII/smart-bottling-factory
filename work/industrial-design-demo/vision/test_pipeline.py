import numpy as np
import pytest
from pipeline import CAMERAS, aggregate, decode_image, image_url, preprocess

def test_full_bottle_requires_all_views():
    rows = [{'cameraId': c, 'status': 'pass'} for c in CAMERAS]
    assert aggregate(rows) == 'pass'
    assert aggregate(rows[:3]) == 'review'
    rows[1]['status'] = 'error'
    assert aggregate(rows) == 'review'
    rows[3]['status'] = 'reject'
    assert aggregate(rows) == 'reject'

def test_mask_excludes_code_area(tmp_path):
    image = np.full((80, 120, 3), 240, np.uint8)
    _, masked, mask = preprocess(image, {'size': 80, 'exclude': [[0, 0, .5, .5]]}, tmp_path)
    assert mask[:40, :40].sum() == 0
    assert (masked[:40, :40] == 127).all()
    assert (masked[40:, 40:] == 240).all()

@pytest.mark.parametrize('cfg', [{'roi': [1, 0, 0, 1]}, {'exclude': [[0,0,1,1]]}, {'reference': 'missing.png'}])
def test_bad_preprocessing_never_passes(cfg, tmp_path):
    with pytest.raises(ValueError):
        preprocess(np.zeros((100,100,3),np.uint8),cfg,tmp_path)

def test_image_roundtrip():
    image = np.zeros((80, 80, 3),np.uint8)
    assert decode_image(image_url(image)).shape == image.shape
    with pytest.raises(ValueError):
        decode_image('https://example.com/image.jpg')

def test_api_missing_and_invalid(monkeypatch):
    from fastapi.testclient import TestClient
    import server
    client = TestClient(server.app)
    body = {'requestId': 'test', 'bottleId': 'b', 'batchId': 'batch', 'images': []}
    result = client.post('/inspect',json=body)
    assert result.status_code == 200
    assert result.json()['verdict'] == 'review'
    body['images'] = [{'cameraId': 'unknown','data': 'x'}]
    assert client.post('/inspect',json=body).status_code == 400
    body['images'] = [{'cameraId': 'top','data': 'x'}]
    result = client.post('/inspect',json=body).json()
    assert result['verdict'] == 'review'
    assert result['cameras'][0]['status'] == 'error'


def test_preflight_skips_models(monkeypatch):
    from fastapi.testclient import TestClient
    import server
    calls = []
    monkeypatch.setattr(server.pipeline, 'inspect', lambda image, cfg: calls.append(1) or {'status':'pass','reason':'test'})
    client = TestClient(server.app)
    frame = image_url(np.zeros((80,80,3),np.uint8))
    body = {'requestId':'gate','bottleId':'b','batchId':'batch','images':[{'cameraId':'top','data':frame}]}
    assert client.post('/inspect',json=body).json()['preflight']['inferenceSkipped']
    assert not calls
    body['images'] = [{'cameraId':c,'data':frame} for c in CAMERAS]
    assert client.post('/inspect',json=body).json()['preflight']['inferenceSkipped']
    assert not calls
    body['images'] = [{'cameraId':c,'data':image_url(np.full((80,80,3),i*40,np.uint8))} for i,c in enumerate(CAMERAS)]
    result = client.post('/inspect',json=body).json()
    assert result['verdict'] == 'pass' and len(calls) == 4
    calls.clear()
    body['images'][0]['bottleId'] = 'wrong'
    assert client.post('/inspect',json=body).json()['preflight']['inferenceSkipped']
    assert not calls

def test_barcode_not_found_does_not_mask(tmp_path):
    from pipeline import locate_barcode
    result = locate_barcode(np.full((256,256,3),255,np.uint8), {})
    assert result['status']=='not-found' and result['regions']==[]

def test_barcode_detector_coordinates_and_mask(monkeypatch,tmp_path):
    import pipeline
    class Detector:
        def detect(self,image):
            return True,np.array([[[10,10],[70,10],[70,40],[10,40]]],np.float32)
    monkeypatch.setattr(pipeline.cv2,'barcode_BarcodeDetector',Detector)
    image=np.full((256,256,3),240,np.uint8)
    _,masked,mask,meta=preprocess(image,{'size':256,'codeMask':{'searchRoi':[.25,.25,.75,.75],'paddingPixels':2,'validated':True}},tmp_path,True)
    assert meta['regions']==[[72,72,137,107]]
    assert (masked[72:107,72:137]==127).all()
    assert (masked[:70]==240).all()
    assert meta['validated']

def test_no_barcode_view_requires_explicit_configuration():
    from pipeline import locate_barcode
    result=locate_barcode(np.zeros((256,256,3),np.uint8),{'required':False,'validated':True})
    assert result['status']=='not-required' and result['regions']==[]

def test_single_image_is_not_four_view_aggregate(monkeypatch):
    from fastapi.testclient import TestClient
    import server
    monkeypatch.setattr(server,'config',lambda:{'version':'test','singleImage':{'scope':'test'}})
    monkeypatch.setattr(server.pipeline,'inspect',lambda image,cfg:{'status':'pass','reason':'test','detections':[]})
    client=TestClient(server.app)
    result=client.post('/inspect/image',json={'caseId':'VIS-01','filename':'normal.png','data':image_url(np.full((80,80,3),240,np.uint8))})
    assert result.status_code==200
    assert result.json()['verdict']=='pass'
    assert result.json()['mode']=='single-image'
    assert result.json()['caseId']=='VIS-01'
    assert 'cameras' not in result.json()

def test_single_image_invalid_and_busy(monkeypatch):
    from fastapi.testclient import TestClient
    import server
    client=TestClient(server.app)
    assert client.post('/inspect/image',json={'data':'invalid'}).status_code==400
    assert client.post('/inspect/image',json={}).status_code==422
    server.lock.acquire()
    try:
        assert client.post('/inspect/image',json={'data':image_url(np.zeros((80,80,3),np.uint8))}).status_code==429
    finally:
        server.lock.release()

def test_optional_barcode_still_detects_and_reports_absence(tmp_path):
    from pipeline import locate_barcode
    result=locate_barcode(np.full((256,256,3),255,np.uint8),{'allowMissing':True})
    assert result['status']=='no-code' and result['regions']==[] and not result['validated']
    _,masked,mask=preprocess(np.full((256,256,3),255,np.uint8),{'size':256,'codeMask':{'allowMissing':True}},tmp_path)
    assert mask.all() and (masked==255).all()

def test_real_barcode_mask_covers_full_bars_and_rotation(tmp_path):
    import cv2
    from pipeline import locate_barcode
    L=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011']
    G=[s[::-1].translate(str.maketrans('01','10')) for s in L]
    R=[s.translate(str.maketrans('01','10')) for s in L]
    digits='5901234123457'
    bits='101'+''.join((L if p=='L' else G)[int(n)] for p,n in zip('LGGLLG',digits[1:7]))+'01010'+''.join(R[int(n)] for n in digits[7:])+'101'
    image=np.full((320,320,3),255,np.uint8)
    for i,bit in enumerate(bits):
        if bit=='1':image[70:231,65+i*2:67+i*2]=0
    _,masked,mask,meta=preprocess(image,{'size':320,'codeMask':{'allowMissing':True}},tmp_path,True)
    assert meta['status']=='masked'
    assert (mask[np.all(image==0,axis=2)]==0).all(),meta
    assert (masked[:20]==255).all()
    rotated=cv2.warpAffine(image,cv2.getRotationMatrix2D((160,160),20,1),(320,320),borderValue=(255,255,255))
    assert locate_barcode(rotated,{'allowMissing':True})['status']=='masked'
