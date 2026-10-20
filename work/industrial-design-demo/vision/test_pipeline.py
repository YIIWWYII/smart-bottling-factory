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
