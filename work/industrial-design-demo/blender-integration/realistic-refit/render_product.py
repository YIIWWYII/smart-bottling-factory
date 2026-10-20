import bpy
from mathutils import Vector
from pathlib import Path
base=Path(__file__).resolve().parents[2]
source=bpy.context.scene
root=source.objects.get('Product_filler_0') or source.objects['Product_wash_0']
deps=bpy.context.evaluated_depsgraph_get()
scene=bpy.data.scenes.new('ProductPortrait')
meshes=[]
for child in root.children_recursive:
 if child.type!='MESH':continue
 evaluated=child.evaluated_get(deps)
 obj=bpy.data.objects.new('Portrait_'+child.name,bpy.data.meshes.new_from_object(evaluated))
 obj.matrix_world=child.matrix_world.copy();scene.collection.objects.link(obj);meshes.append(obj)
points=[o.matrix_world@Vector(v) for o in meshes for v in o.bound_box]
lo=Vector([min(v[i] for v in points) for i in range(3)]);hi=Vector([max(v[i] for v in points) for i in range(3)])
center=(lo+hi)/2;factor=3/(hi.z-lo.z)
for o in meshes:
 o.location=(o.location-center)*factor;o.scale*=factor
 for slot in o.material_slots:
  if slot.material:
   slot.material=slot.material.copy()
   bsdf=slot.material.node_tree.nodes.get('Principled BSDF')
   if bsdf:
    bsdf.inputs['Roughness'].default_value=.2
    if bsdf.inputs['Alpha'].default_value<1:bsdf.inputs['Alpha'].default_value=.9
world=bpy.data.worlds.new('Portrait studio');world.use_nodes=True;bg=world.node_tree.nodes.new('ShaderNodeBackground');out=world.node_tree.nodes.new('ShaderNodeOutputWorld');world.node_tree.links.new(bg.outputs[0],out.inputs['Surface']);bg.inputs[0].default_value=(.16,.2,.24,1);bg.inputs[1].default_value=.35;scene.world=world
cam=bpy.data.objects.new('Portrait camera',bpy.data.cameras.new('Portrait camera'));scene.collection.objects.link(cam);cam.location=(.7,-6,.25);cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=3.6;scene.camera=cam
for name,pos,power,size in [('Key',(-3,-4,4),550,4),('Edge',(2,1,2),700,3),('Fill',(3,-3,0),300,2)]:
 lamp=bpy.data.objects.new(name,bpy.data.lights.new(name,'AREA'));scene.collection.objects.link(lamp);lamp.location=pos;lamp.rotation_euler=(-lamp.location).to_track_quat('-Z','Y').to_euler();lamp.data.energy=power;lamp.data.shape='DISK';lamp.data.size=size
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.render.resolution_x=512;scene.render.resolution_y=768;scene.render.resolution_percentage=100;scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.filepath=str(base/'public/images/product-portrait.png');bpy.ops.render.render(write_still=True,scene=scene.name)
