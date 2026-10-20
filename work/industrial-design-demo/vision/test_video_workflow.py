from pathlib import Path
import json
import numpy as np
import pytest
from video_workflow import associate,select_frame,unwrap_cylinder,align_and_mask,run,CAMERAS
from make_video_fixture import generate


def config():
    return json.loads(Path(__file__).with_name('video_workflow.json').read_text())


def track(mid):
    return {'start':mid-1,'end':mid+1,'errors':[],'trackId':str(mid)}


def test_missing_side_does_not_shift_later_bottles():
    tracks={c:[track(2),track(5),track(8)] for c in CAMERAS}
    tracks['side-120']=[track(2),track(8)]
    rows=associate(tracks,config()['cameras'],.3)
    assert not rows[0]['errors'] and rows[1]['errors'] and not rows[2]['errors']
    assert rows[2]['tracks']['side-120']['start']==7


def test_ambiguous_match_never_forced():
    tracks={c:[track(2)] for c in CAMERAS}
    tracks['side-0']=[track(1.9),track(2.1)]
    assert associate(tracks,config()['cameras'],.3)[0]['errors']


def test_one_side_cannot_be_reused_for_two_tops():
    tracks={c:[track(2)] for c in CAMERAS};tracks['top']=[track(1.9),track(2.1)]
    assert all(row['errors'] for row in associate(tracks,config()['cameras'],.3))


def test_midpoint_and_clipped_fallback():
    samples=[{'time':i,'frame':i,'center':[.1+i*.2,.5],'sharpness':50,'clipped':False} for i in range(5)]
    assert select_frame(samples,config()['tracking'],[.5,.5])['frame']==2
    samples[2]['clipped']=True
    selected=select_frame(samples,config()['tracking'],[.5,.5])
    assert selected['frame']!=2 and selected['selectionReason']=='center-clear-fallback'


def test_no_sharp_frame():
    with pytest.raises(ValueError):
        select_frame([{'time':0,'frame':0,'sharpness':0,'clipped':True}],config()['tracking'],[.5,.5])


def test_mask_preserves_original_and_excludes_polygon(tmp_path):
    settings=config()['unwrap'];settings['excludePolygons']=[[[0,0],[.5,0],[.5,.5],[0,.5]]]
    image=np.full((100,300,3),200,np.uint8)
    original,masked,mask=align_and_mask(image,settings,tmp_path)
    assert (image==200).all() and (original==image).all()
    assert mask[10,10]==0 and (masked[10,10]==127).all() and mask[80,250]==255


def test_projection_gap_rejected():
    cfg=config()
    for c in CAMERAS[1:]:cfg['cameras'][c]['angleDegrees']=0
    with pytest.raises(ValueError,match='gaps'):
        unwrap_cylinder({c:(np.full((100,100,3),200,np.uint8),[0,0,100,100]) for c in CAMERAS[1:]},cfg['cameras'],cfg['unwrap'])


def test_real_opencv_video_fixture(tmp_path):
    videos=tmp_path/'videos';generate(videos)
    result=run(videos/'profile.json',{c:videos/f'{c}.mp4' for c in CAMERAS},tmp_path/'result',fixture=True)
    assert result['syntheticFixture']
    assert len(result['bottles'])==2
    for row in result['bottles']:
        assert set(row['tracks'])==set(CAMERAS)
        assert row['errors']==['unwrapped-models-not-trained; top-model-not-validated']
        assert row['verdict']=='review'
        assert (tmp_path/'result'/row['bottleId']/'masked.png').exists()
