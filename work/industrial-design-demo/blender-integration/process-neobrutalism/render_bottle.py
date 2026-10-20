import bpy,math
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[2]/'public'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'models/beverage/water-bottle.glb'))
s=bpy.context.scene
pts=[o.matrix_world@Vector(v) for o in s.objects if o.type=='MESH' for v in o.bound_box]
lo=Vector(tuple(min(p[i] for p in pts) for i in range(3)));hi=Vector(tuple(max(p[i] for p in pts) for i in range(3)));center=(lo+hi)/2;h=hi.z-lo.z
bpy.ops.object.camera_add(location=center+Vector((h*.8,-h*2,h*.3)));cam=bpy.context.object;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=52;s.camera=cam
for name,delta,power,size in [('Key',(-1,-1,1.5),120,1),('Rim',(1,1,1),160,.7),('Fill',(1,-1,.5),50,1)]:
 bpy.ops.object.light_add(type='AREA',location=center+Vector(delta)*h);o=bpy.context.object;o.name=name;o.data.energy=power*h*h;o.data.shape='DISK';o.data.size=size*h;o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
w=bpy.data.worlds.new('Studio');w.use_nodes=True;nt=w.node_tree;nt.nodes.clear();bg=nt.nodes.new('ShaderNodeBackground');bg.inputs[0].default_value=(.6,.65,.7,1);bg.inputs[1].default_value=.6;out=nt.nodes.new('ShaderNodeOutputWorld');nt.links.new(bg.outputs[0],out.inputs[0]);s.world=w
s.render.engine='CYCLES';s.cycles.samples=32;s.render.film_transparent=True;s.render.resolution_x=900;s.render.resolution_y=1100;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.filepath=str(root/'models/beverage/bottle-portrait.png');bpy.ops.render.render(write_still=True)
