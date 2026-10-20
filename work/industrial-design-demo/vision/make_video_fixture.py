"""Generate explicitly synthetic cylindrical views, not real camera evidence."""
import argparse
import json
from pathlib import Path
import cv2
import numpy as np
from video_workflow import CAMERAS


def generate(output):
    output.mkdir(parents=True,exist_ok=False)
    profile=json.loads(Path(__file__).with_name('video_workflow.json').read_text())
    profile['unwrap']['excludePolygons']=[[[.12,.7],[.22,.7],[.22,.9],[.12,.9]]]
    width,height,fps=320,240,20
    for camera_index,camera in enumerate(CAMERAS):
        delay=camera_index*.3
        profile['cameras'][camera]['travelDelaySeconds']=delay
        writer=cv2.VideoWriter(str(output/f'{camera}.mp4'),cv2.VideoWriter_fourcc(*'mp4v'),fps,(width,height))
        if not writer.isOpened(): raise RuntimeError('Video encoder unavailable')
        for index in range(180):
            image=np.full((height,width,3),35,np.uint8)
            t=index/fps-delay
            for arrival in [1.0,4.0]:
                center=int(-35+(t-arrival)*180)
                if center+30<0 or center-30>=width: continue
                if camera=='top':
                    cv2.circle(image,(center,120),30,(210,210,210),-1)
                    cv2.circle(image,(center,120),18,(70,150,230),2)
                    cv2.line(image,(center-12,120),(center+12,120),(80,80,80),2)
                else:
                    for x in range(max(0,center-30),min(width,center+31)):
                        theta=(np.degrees(np.arcsin(np.clip((x-center)/30,-1,1)))+profile['cameras'][camera]['angleDegrees'])%360
                        color=(100+int(theta)//30*10,180,220)
                        image[50:190,x]=color
                        image[90:95,x]=(60,80,100)
                        if 45<theta<80: image[148:176,x]=(230,230,230)
                        if 200<theta<215: image[105:122,x]=(60,60,60)
            writer.write(image)
        writer.release()
    (output/'profile.json').write_text(json.dumps(profile,indent=2),encoding='utf-8')
    (output/'SOURCE.txt').write_text('SYNTHETIC algorithm fixtures: two generated cylinders, perfect fixed cameras. Not bottle-defect training data or physical-camera acceptance.\n',encoding='utf-8')


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);args=p.parse_args();generate(args.output)
