"""Create the photograph-referenced Yibao Holiday Moment peach beverage bottle in Blender.
Run in Blender; all assets resolve relative to this source file.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
DEST=ROOT/'public/models/beverage'
(ROOT/'.runtime/peach-build').mkdir(parents=True,exist_ok=True)
TEXTURE=DEST/'yibao-peach-label.png'
SCENE='Peach_Holiday_Studio'
if SCENE in bpy.data.scenes:
    raise RuntimeError('Peach_Holiday_Studio already exists. Keep or rename it before rebuilding.')
scene=bpy.data.scenes.new(SCENE)
bpy.context.window.scene=scene
scene.unit_settings.system='METRIC'
scene.unit_settings.scale_length=1.0
assembly=bpy.data.objects.new('Yibao_Holiday_Peach',None);scene.collection.objects.link(assembly)
assembly['asset_kind']='product';assembly['dimensions_note']='Display proportions only; not a measured production bottle.'
parts=[]
def material(name,color,rough=.3,trans=0,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;p.inputs['Transmission Weight'].default_value=trans;p.inputs['IOR'].default_value=1.46
 return m
pet=material('PET_Clear_Shell',(.91,.99,.97),.16,.91)
water=material('Peach_Drink',(.88,.83,.73),.26,.02);next(n for n in water.node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['IOR'].default_value=1.333
green=material('Cap_White_HDPE',(.86,.86,.82),.28)
label=material('Printed_Peach_Label',(1,1,1),.38)
nodes=label.node_tree.nodes;nodes.clear();tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(TEXTURE),check_existing=True);tex.image.pack();emission=nodes.new('ShaderNodeEmission');output=nodes.new('ShaderNodeOutputMaterial');label.node_tree.links.new(tex.outputs['Color'],emission.inputs['Color']);label.node_tree.links.new(emission.outputs[0],output.inputs['Surface'])
def lathe(name,profile,mat,closed=True,uv=False,n=128):
 verts=[(r*math.cos(2*math.pi*j/n),r*math.sin(2*math.pi*j/n),z) for r,z in profile for j in range(n)]
 faces=[]
 for i in range(len(profile)-1):
  for j in range(n):
   k=(j+1)%n;faces.append((i*n+j,i*n+k,(i+1)*n+k,(i+1)*n+j))
 if closed:faces.extend([tuple(range(n-1,-1,-1)),tuple((len(profile)-1)*n+j for j in range(n))])
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
 obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj);obj.parent=assembly;obj.data.materials.append(mat);parts.append(obj)
 for poly in mesh.polygons:poly.use_smooth=len(poly.vertices)==4
 if uv:
  layer=mesh.uv_layers.new(name='LabelUV')
  z0=profile[0][1];z1=profile[-1][1]
  for p in mesh.polygons:
   if len(p.vertices)!=4:continue
   j=p.index%n;i=p.index//n
   for li,co in zip(p.loop_indices,[(j/n,(profile[i][1]-z0)/(z1-z0)),((j+1)/n,(profile[i][1]-z0)/(z1-z0)),((j+1)/n,(profile[i+1][1]-z0)/(z1-z0)),(j/n,(profile[i+1][1]-z0)/(z1-z0))]):layer.data[li].uv=co
 return obj
# Bottle silhouette: recessed base, shallow grip ribs, gently tapered shoulder, narrow neck.
profile=[(.004,.002),(.020,.0015),(.029,.002),(.0328,.004),(.0340,.008),(.0344,.013),(.0345,.022),(.0345,.055),(.0343,.073),(.0337,.077),(.0337,.081),(.0343,.085),(.0345,.092),(.0345,.180),(.0342,.189),(.0329,.196),(.0301,.202),(.0261,.208),(.0220,.211),(.0217,.217)]
shell=lathe('Bottle_PET_Shell',profile,pet)
# Solidify becomes actual thin shell before export, keeping the glTF geometry independent of Blender modifiers.
solid=shell.modifiers.new('PET wall 0.45mm','SOLIDIFY');solid.thickness=.00045;solid.offset=-1
bpy.context.view_layer.objects.active=shell;shell.select_set(True);bpy.ops.object.modifier_apply(modifier=solid.name);shell.select_set(False)
lathe('Water_Fill',[(max(r-.0012,.001),max(z,.003)) for r,z in profile if z<=.207],water)
lathe('Wrap_Label',[(.03460,.021),(.03460,.073),(.03395,.078),(.03395,.081),(.03460,.086),(.03460,.180),(.0343,.190)],label,closed=False,uv=True)
lathe('Tamper_Ring',[(.0222,.212),(.0228,.213),(.0228,.216),(.0221,.217)],green)
lathe('White_Screw_Cap',[(.0220,.216),(.0231,.217),(.0235,.220),(.0235,.236),(.0231,.238),(.0220,.239),(.001,.239)],green)
# Fine cap grip ribs are one mesh object, not seventy separate scene objects.
v=[];f=[]
for j in range(72):
 a=2*math.pi*j/72;start=len(v)
 for z in (.220,.2355):
  for da,r in ((-.014,.0233),(.014,.0233),(.014,.0239),(-.014,.0239)):v.append((r*math.cos(a+da),r*math.sin(a+da),z))
 f.extend([tuple(start+k for k in face) for face in ((0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0))])
mesh=bpy.data.meshes.new('Cap_Grip_Ribs');mesh.from_pydata(v,[],f);mesh.update();ribs=bpy.data.objects.new('Cap_Grip_Ribs',mesh);scene.collection.objects.link(ribs);ribs.parent=assembly;ribs.data.materials.append(green);parts.append(ribs)
# Preview studio is separate from the exported bottle.
floorMat=material('Studio_Peach',(.86,.79,.76),.38)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.001));floor=bpy.context.object;floor.name='Preview_Ground';floor.data.materials.append(floorMat)
world=bpy.data.worlds.new('Yibao_Soft_Studio');world.use_nodes=True;next(n for n in world.node_tree.nodes if n.type=='BACKGROUND').inputs[0].default_value=(.88,.83,.79,1);next(n for n in world.node_tree.nodes if n.type=='BACKGROUND').inputs[1].default_value=.35;scene.world=world
for name,pos,power,size in [('Key',(.21,-.30,.36),12,.25),('Edge',(-.22,.12,.28),18,.20),('Fill',(.13,.19,.20),8,.20)]:
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,.10))-o.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Product_Camera');cam=bpy.data.objects.new('Product_Camera',data);scene.collection.objects.link(cam);cam.location=(.025,-.45,.18);cam.rotation_euler=(Vector((0,0,.12))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=.30;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='OPTIX'
scene.cycles.device='GPU';scene.render.resolution_x=900;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ROOT/'.runtime/peach-build/peach-preview.png')
assembly.rotation_euler.z=math.radians(28)
scene.view_settings.look='AgX - Medium High Contrast'
scene.view_settings.exposure=-.6
for o in scene.objects:o.select_set(False)
for o in [assembly,*parts]:o.select_set(True)
bpy.context.view_layer.objects.active=shell
bpy.ops.export_scene.gltf(filepath=str(DEST/'yibao-peach-bottle.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_apply=True,export_yup=True,export_animations=False)
# Fixed viewport for inspecting the complete editable model.
for area in bpy.context.screen.areas:
 if area.type=='VIEW_3D':
  area.spaces.active.region_3d.view_distance=.36;area.spaces.active.region_3d.view_location=(0,0,.10);area.spaces.active.shading.type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(Path(__file__).with_name('yibao-peach-bottle.blend')))
meshStats=[{'name':o.name,'vertices':len(o.data.vertices),'faces':len(o.data.polygons),'scale':list(o.scale)} for o in parts]
(ROOT/'.runtime/peach-build/model-report.json').write_text(json.dumps({'scene':SCENE,'parts':meshStats,'height_m':.239,'diameter_m':.0692,'geometry_note':'Approximate teaching display shape; not a measured official bottle.','source':str(Path(__file__).name)},indent=2),encoding='utf-8')
print(json.dumps({'export':str(DEST/'yibao-peach-bottle.glb'),'parts':len(parts),'vertices':sum(len(o.data.vertices) for o in parts),'engine':scene.render.engine,'device':scene.cycles.device}))
