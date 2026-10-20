import bpy,json
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
BASE=Path(__file__).resolve().parent;APP=BASE.parent.parent
s=bpy.context.scene;cam=s.camera
codes=['wash','gas','vision','beverage','filler','secondary','robot','agv','warehouse']
def points():
 out=[]
 for code in codes:
  root=s.objects['Asset_'+code]
  corners=[o.matrix_world@Vector(v) for o in root.children_recursive if o.type=='MESH' and not o.hide_render for v in o.bound_box]
  low=Vector([min(p[i] for p in corners) for i in range(3)]);hi=Vector([max(p[i] for p in corners) for i in range(3)])
  p=world_to_camera_view(s,cam,(low+hi)/2)
  out.append({'code':code,'x':round(p.x*100,2),'y':round((1-p.y)*100,2)})
 return out
out={'overview':points()}
cam.location=(0,-1,42);cam.rotation_euler=(Vector((0,-1,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=31
s.render.resolution_x=1500;s.render.resolution_y=950;s.render.resolution_percentage=100;s.cycles.samples=24
s.render.filepath=str(APP/'public/images/factory-plan.png')
# Keep the overhead plan open: no roof fascias or elevated banners hiding tooling.
for o in s.objects:
 if any(k in o.name for k in ['Crown fascia','Operations','Hanging','Sign panel','Filler top']):o.hide_render=True
bpy.context.view_layer.update()
out['plan']=points()
(APP/'public/models/factory-realistic/projections.json').write_text(json.dumps(out),encoding='utf-8')
bpy.ops.render.render(write_still=True)
