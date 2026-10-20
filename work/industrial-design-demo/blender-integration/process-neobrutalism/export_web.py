import bpy,json
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
root=Path(__file__).resolve().parents[2]/'public'
s=bpy.context.scene
codes=['wash','gas','vision','beverage','filler','secondary','robot','agv','warehouse']
markers=[]
for code in codes:
 ob=bpy.data.objects.get('ID badge '+code)
 p=world_to_camera_view(s,s.camera,ob.location)
 markers.append({'x':p.x*100,'y':(1-p.y)*100})
(root/'images/process/markers.json').write_text(json.dumps(markers))
for m in bpy.data.materials:
 if not m.use_nodes:continue
 ramp=next((n for n in m.node_tree.nodes if n.type=='VALTORGB'),None)
 color=tuple(ramp.color_ramp.elements[-1].color) if ramp else tuple(m.diffuse_color)
 if 'OUTLINE' in m.name:color=(.008,.012,.019,1)
 m.node_tree.nodes.clear();em=m.node_tree.nodes.new('ShaderNodeEmission');em.inputs[0].default_value=color
 out=m.node_tree.nodes.new('ShaderNodeOutputMaterial');m.node_tree.links.new(em.outputs[0],out.inputs[0])
for o in s.objects:
 o.select_set(o.type in {'MESH','CURVE'} and o.name!='Warm paper ground' and not o.name.startswith('ID '))
 if o.get('stage') in codes:o['stageIndex']=codes.index(o['stage'])
bpy.ops.export_scene.gltf(filepath=str(root/'models/process.glb'),use_selection=True,export_format='GLB',export_apply=True,export_extras=True,export_animations=False)
