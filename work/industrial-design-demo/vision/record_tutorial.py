"""Record real browser interactions (replay, not historical footage)."""
from pathlib import Path
import json
import time
from playwright.sync_api import sync_playwright
out=Path('F:/BottleAI/vision/tutorial')
media=out/'media'; raw=out/'recording-source'
media.mkdir(parents=True,exist_ok=True);raw.mkdir(parents=True,exist_ok=True)
records=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--disable-gpu'])
    try:
        for clip in ['01-preflight','02-joint']:
            context=browser.new_context(viewport={'width':1440,'height':1000},record_video_dir=str(raw),record_video_size={'width':1440,'height':1000})
            page=context.new_page();page.goto('http://127.0.0.1:8095/')
            page.locator('#bottle').fill('TUTORIAL-REPLAY-001');page.locator('#batch').fill('TUTORIAL-REPLAY')
            page.wait_for_timeout(2000);started=time.monotonic()
            if clip=='01-preflight':
                page.locator('#bottleInspect').scroll_into_view_if_needed();page.wait_for_timeout(1800)
                with page.expect_response(lambda r:r.url.endswith('/inspect') and r.request.method=='POST') as response:
                    page.locator('#bottleInspect').click()
                result=response.value.json()
                assert result['preflight']['inferenceSkipped'] and result['verdict']=='review'
                page.locator('#result').scroll_into_view_if_needed();page.wait_for_timeout(4500)
            else:
                sample=next(Path('F:/BottleAI/vision/datasets/water-front/calibration').glob('*.jpg'))
                page.locator('#upload').set_input_files(str(sample));page.wait_for_timeout(2500)
                with page.expect_response(lambda r:r.url.endswith('/inspect/debug') and r.request.method=='POST',timeout=60000) as response:
                    page.locator('#inspect').click()
                result=response.value.json();side=next(c for c in result['cameras'] if c['cameraId']=='side-0')
                assert side.get('heatmapUrl') and side['anomalyScore'] is not None
                page.locator('#result').scroll_into_view_if_needed();page.wait_for_timeout(5000)
            page.screenshot(path=str(media/f'{clip}.jpg'))
            page.locator('#details').scroll_into_view_if_needed();page.wait_for_timeout(3000)
            video=page.video
            (raw/f'{clip}-response.json').write_text(json.dumps(result,ensure_ascii=False),encoding='utf-8')
            context.close();video.save_as(str(raw/f'{clip}.webm'))
            records.append({'clip':clip,'durationSeconds':round(time.monotonic()-started,1),'status':result['verdict']});print(records[-1],flush=True)
    finally:browser.close()
(raw/'replays.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
