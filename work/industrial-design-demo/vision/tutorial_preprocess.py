from pathlib import Path
import json,cv2,numpy as np
from pipeline import preprocess
root=Path('/data');out=root/'tutorial/media';sample=root/'tutorial/practice/images/blot-example.jpg'
im=cv2.imread(str(sample));cfg={'roi':[.33,.24,.54,.72],'size':320,'exclude':[]}
a,_,_=preprocess(im,cfg,root);cv2.imwrite(str(out/'opencv-original.jpg'),im);cv2.imwrite(str(out/'opencv-crop.jpg'),a)
cv2.imwrite(str(out/'opencv-reference.jpg'),a)
shifted=cv2.warpAffine(a,np.float32([[1,0,7],[0,1,4]]),(320,320),borderMode=cv2.BORDER_REFLECT)
cv2.imwrite(str(out/'opencv-offset.jpg'),shifted)
aligned,_,_=preprocess(shifted,{'roi':[0,0,1,1],'size':320,'exclude':[],'reference':'tutorial/media/opencv-reference.jpg'},root)
cv2.imwrite(str(out/'opencv-aligned.jpg'),aligned)
_,masked,_=preprocess(aligned,{'roi':[0,0,1,1],'size':320,'exclude':[[.65,.85,.9,.95]]},root)
cv2.imwrite(str(out/'opencv-excluded.jpg'),masked)
(root/'tutorial/recording-source/opencv-example.json').write_text(json.dumps({'roi':cfg['roi'],'size':320,'reference':'tutorial/media/opencv-reference.jpg','exclude':[[.65,.85,.9,.95]],'scope':'tutorial only; offset generated for alignment demonstration; exclusion is not a verified production code region'}))
print('OpenCV crops, generated-offset alignment and illustrative mask saved; live config unchanged.')
