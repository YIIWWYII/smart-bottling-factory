import bpy, math, os, json
from mathutils import Vector
out=os.path.abspath('public/models/operator-panel')
os.makedirs(out,exist_ok=True)
original=bpy.context.scene
scene=bpy.data.scenes.new('OperatorPanel_ControlKit')
bpy.context.window.scene=scene
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.world=bpy.data.worlds.new('PanelStudio');scene.world.use_nodes=True
next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND').inputs[0].default_value=(.18,.22,.3,1)
def mat(name,col,metal,rough):
 m=bpy.data.materials.new(name);m.diffuse_color=(*col,1);m.use_nodes=True;n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');n.inputs['Base Color'].default_value=(*col,1);n.inputs['Metallic'].default_value=metal;n.inputs['Roughness'].default_value=rough;return m
steel=mat('Panel brushed aluminium',(.36,.43,.49),.85,.28);dark=mat('Black moulded polymer',(.024,.032,.042),.05,.3);rubber=mat('Rubber gasket',(.009,.012,.016),0,.65);blue=mat('Enamel blue',(.035,.22,.34),.35,.23);amber=mat('Amber actuator',(.9,.27,.045),.15,.25);white=mat('Engraved indicator',(.83,.87,.83),.1,.4)
def finish(o,name,m,parent=None):
 o.name=name;o.data.materials.append(m)
 if parent:o.parent=parent
 if o.type=='MESH':
  for p in o.data.polygons:p.use_smooth=True
 return o
def box(name,loc,scale,m,parent=None,bevel=.05):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=finish(bpy.context.object,name,m,parent);o.dimensions=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);mod=o.modifiers.new('Manufactured edge radius','BEVEL');mod.width=bevel;mod.segments=3;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name);return o
def cyl(name,loc,r,depth,m,parent=None):
 bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=r,depth=depth,location=loc);o=finish(bpy.context.object,name,m,parent);mod=o.modifiers.new('Machined edge','BEVEL');mod.width=.025;mod.segments=3;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name);return o
def tor(name,loc,major,minor,m,parent=None):
 bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=56,minor_segments=12,location=loc);return finish(bpy.context.object,name,m,parent)
report=[]
for kind in ['handwheel','lever','fader','push']:
 before=set(scene.objects)
 base=box(kind+'_mount',(0,0,-.15),(2.5,2.5,.2),steel,bevel=.12)
 for x in [-1.02,1.02]:
  for y in [-1.02,1.02]:
   cyl('mount screw',(x,y,-.025),.085,.06,dark);box('screw slot',(x,y,.01),(.105,.02,.008),steel,bevel=.004)
 moving=bpy.data.objects.new('Actuator_'+kind,None);scene.collection.objects.link(moving)
 if kind=='handwheel':
  cyl('gasket',(0,0,.015),.58,.10,rubber);cyl('shaft',(0,0,.16),.28,.32,steel);cyl('wheel hub',(0,0,.37),.36,.18,dark,moving);tor('grip rim',(0,0,.38),.78,.13,dark,moving)
  for angle in [0,120,240]:
   a=math.radians(angle);sp=box('wheel spoke',(.45*math.cos(a),.45*math.sin(a),.38),(.65,.14,.12),steel,moving);sp.rotation_euler.z=a
  cyl('centre cap',(0,0,.49),.23,.08,blue,moving);box('wheel index',(0,.77,.51),(.06,.14,.018),white,moving,bevel=.008)
  for i in range(19):
   a=math.radians(-135+i*15);o=box('scale mark',(math.sin(a)*1.03,math.cos(a)*1.03,-.035),(.018,.10,.01),dark,bevel=.002);o.rotation_euler.z=-a
  moving.rotation_euler.z=-2.35;moving.keyframe_insert('rotation_euler',frame=1);moving.rotation_euler.z=2.35;moving.keyframe_insert('rotation_euler',frame=31)
 elif kind=='lever':
  cyl('switch gasket',(0,0,.02),.5,.13,rubber);cyl('retaining nut',(0,0,.13),.39,.12,steel);tor('pivot socket',(0,0,.22),.22,.08,dark)
  stem=cyl('lever stem',(0,0,.59),.085,.72,steel,moving);bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=.24,location=(0,0,1.03));finish(bpy.context.object,'lever grip',dark,moving)
  moving.rotation_euler.x=-.48;moving.keyframe_insert('rotation_euler',frame=1);moving.rotation_euler.x=.48;moving.keyframe_insert('rotation_euler',frame=31)
 elif kind=='fader':
  box('recessed guide',(0,0,-.015),(.42,1.95,.12),rubber);box('guide rail',(0,0,.015),(.045,1.8,.04),steel)
  box('slider carriage',(0,0,.13),(.8,.35,.22),dark,moving);box('slider cap',(0,0,.255),(.73,.30,.04),steel,moving)
  for y in [-.08,0,.08]:box('grip rib',(0,y,.282),(.62,.02,.013),dark,moving,bevel=.003)
  for i in range(9):box('travel graduation',(.52,-.8+i*.2,.0),(.18,.025,.015),dark,bevel=.002)
  moving.location.y=-.8;moving.keyframe_insert('location',frame=1);moving.location.y=.8;moving.keyframe_insert('location',frame=31)
 else:
  cyl('button gasket',(0,0,.015),.72,.1,rubber);cyl('button bezel',(0,0,.13),.65,.18,steel);cyl('button collar',(0,0,.24),.55,.14,dark);cyl('button plunger',(0,0,.4),.49,.24,amber,moving);tor('cap edge',(0,0,.51),.44,.025,amber,moving);box('button marking',(0,0,.526),(.18,.045,.012),white,moving,bevel=.005)
  moving.location.z=0;moving.keyframe_insert('location',frame=1);moving.location.z=-.12;moving.keyframe_insert('location',frame=31)
 scene.frame_start=1;scene.frame_end=31;scene.frame_set(1)
 objs=set(scene.objects)-before
 for existing in bpy.data.objects:existing.select_set(False)
 for o in objs:o.select_set(True)
 bpy.context.view_layer.objects.active=base
 bpy.ops.export_scene.gltf(filepath=os.path.join(out,kind+'.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_animations=True,export_frame_range=True)
 report.append({'kind':kind,'objects':len(objs),'bytes':os.path.getsize(os.path.join(out,kind+'.glb'))})
 # Separate display positions in the editable source after exporting local coordinates.
 holder=bpy.data.objects.new('Kit_'+kind,None);scene.collection.objects.link(holder)
 for o in objs:
  if o.parent is None:o.parent=holder
 holder.location.x=(len(report)-1)*3.3
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath('blender-integration/operator-panel/operator-controls.blend'),copy=True)
result={'exported':report,'scene':scene.name,'source_saved':True}
