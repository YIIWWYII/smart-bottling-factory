import bpy, math, os, json
from mathutils import Vector
BASE=r'E:\2026挑战杯\工业沙盘2026\数字展板前后端\work\industrial-design-demo'
OUT=os.path.join(BASE,'public','models','safety-facilities');os.makedirs(OUT,exist_ok=True)
col=bpy.data.collections.new('SafetyFacilities_20261009');bpy.context.scene.collection.children.link(col)
def material(n,c,metal=0,rough=.35):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
steel=material('SF brushed stainless',(.48,.57,.62),.8);dark=material('SF anthracite',(.035,.055,.075),.45);blue=material('SF blue enamel',(.035,.24,.4),.35);amber=material('SF safety yellow',(.95,.55,.025),.2);red=material('SF valve red',(.7,.04,.035),.3);water=material('SF visible liquid',(.03,.48,.7),.25);white=material('SF face label',(.78,.85,.87),.1)
roots=[];parts=[]
def own(o,n,mat=None,parent=None):
 o.name=n
 for c in list(o.users_collection):c.objects.unlink(o)
 col.objects.link(o)
 if mat:o.data.materials.append(mat)
 if parent:o.parent=parent
 parts.append(o);return o
def empty(n,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(n,None);col.objects.link(o);o.parent=parent;o.location=loc;parts.append(o);return o
def cube(n,loc,scale,mat,parent,bevel=.02):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=own(bpy.context.object,n,mat,parent);o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:m=o.modifiers.new('Manufactured edge radii','BEVEL');m.width=bevel;m.segments=2
 return o
def cyl(n,loc,r,d,mat,parent,rot=(0,0,0)):
 bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=r,depth=d,location=loc,rotation=rot);o=own(bpy.context.object,n,mat,parent);m=o.modifiers.new('Edge radii','BEVEL');m.width=.008;m.segments=2;return o
def pipe(n,pts,r,mat,parent):
 c=bpy.data.curves.new(n,'CURVE');c.dimensions='3D';c.resolution_u=2;c.bevel_depth=r;c.bevel_resolution=2;s=c.splines.new('POLY');s.points.add(len(pts)-1)
 for p,co in zip(s.points,pts):p.co=(*co,1)
 o=bpy.data.objects.new(n,c);col.objects.link(o);o.parent=parent;c.materials.append(mat);parts.append(o);return o
def label(n,text,loc,parent,size=.08):
 c=bpy.data.curves.new(n,'FONT');c.body=text;c.size=size;c.extrude=.0007;o=bpy.data.objects.new(n,c);col.objects.link(o);o.location=loc;o.rotation_euler=(math.pi/2,0,0);o.parent=parent;c.materials.append(white);parts.append(o);return o
# Cabinet with actual fan opening, rotor, guard and control hardware.
r=empty('Facility_cabinet');roots.append(('cabinet',r))
cube('Cabinet enclosure',(0,0,.75),(.85,.42,1.5),steel,r)
front=cube('Cabinet fan door',(0,-.235,.78),(.79,.045,1.36),blue,r)
cut=cyl('Fan opening cutter',(0,-.235,.87),.285,.2,dark,r,(math.pi/2,0,0));bpy.context.view_layer.objects.active=front;mod=front.modifiers.new('Fan intake opening','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cut;bpy.ops.object.modifier_apply(modifier=mod.name);parts.remove(cut);bpy.data.objects.remove(cut,do_unlink=True)
rotor=empty('FanRotor',r,(0,-.3,.87));rotor.rotation_euler=(math.pi/2,0,0)
cyl('Fan hub',(0,0,0),.07,.075,dark,rotor)
for i in range(6):
 a=i*math.tau/6;verts=[(.055,-.035,0),(.24,-.075,.022),(.27,.015,.038),(.10,.065,.01)];verts=[(x*math.cos(a)-y*math.sin(a),x*math.sin(a)+y*math.cos(a),z) for x,y,z in verts];me=bpy.data.meshes.new('Fan swept blade');me.from_pydata(verts,[],[(0,1,2,3)]);o=bpy.data.objects.new('Fan blade '+str(i),me);col.objects.link(o);o.parent=rotor;me.materials.append(dark);o.modifiers.new('Blade thickness','SOLIDIFY').thickness=.008;parts.append(o)
for rad in [.13,.21,.29]:
 bpy.ops.mesh.primitive_torus_add(major_radius=rad,minor_radius=.008,major_segments=32,minor_segments=6,location=(0,-.36,.87),rotation=(math.pi/2,0,0));own(bpy.context.object,'Fan guard ring',steel,r)
for a in [0,math.pi/2]:pipe('Fan guard brace',[(-.29*math.cos(a),-.365,.87-.29*math.sin(a)),(.29*math.cos(a),-.365,.87+.29*math.sin(a))],.007,steel,r)
cube('Door handle',(.32,-.285,.56),(.025,.05,.22),dark,r,.008);label('Cabinet ID','VENT / 01',(-.29,-.268,1.31),r,.075)
# Cooling skid: radiator, pump and twin supply/return lines.
r=empty('Facility_cooler');roots.append(('cooler',r));cube('Cooling skid',(0,0,.08),(1.25,.8,.16),dark,r)
cube('Heat exchanger frame',(-.25,.15,.78),(.68,.30,1.18),blue,r)
fin=cube('Heat exchanger fin',(-.25,-.035,.29),(.58,.04,.025),steel,r,.003);arr=fin.modifiers.new('Exchanger fin repetition','ARRAY');arr.count=19;arr.use_relative_offset=False;arr.use_constant_offset=True;arr.constant_offset_displace=(0,0,.049)
cyl('Circulation motor',(.35,0,.4),.15,.38,blue,r,(math.pi/2,0,0));cyl('Circulation pump',(.35,-.27,.4),.16,.16,steel,r,(math.pi/2,0,0))
for n,x,mat in [('CoolingSupply',.45,water),('CoolingReturn',-.45,steel)]:pipe(n,[(x,-.27,.4),(x,-.42,.4),(x,-.42,1.35),(x,-.42,1.65)],.035,mat,r)
v=empty('CoolingValve',r,(.45,-.42,1.1));cube('Cooling valve handle',(0,0,0),(.25,.05,.045),red,v,.008);label('Cooling ID','COOLING',(-.5,-.05,1.43),r,.09)
# Buffer vessel with readable level column, inlet valve and feed pump.
r=empty('Facility_tank');roots.append(('tank',r));cyl('Buffer vessel',(0,0,.95),.39,1.25,steel,r);cyl('Tank lid',(0,0,1.6),.40,.065,steel,r)
for x in [-.26,.26]:
 for y in [-.26,.26]:cube('Vessel foot',(x,y,.18),(.07,.07,.36),dark,r,.008)
cube('Level gauge backing',(0,-.405,.98),(.19,.055,1.0),dark,r,.008)
liquid=empty('LiquidLevel',r,(0,-.45,.49));cube('Level liquid',(0,0,.49),(.13,.025,.98),water,liquid,.002)
for i in range(11):cube('Level tick',(.13,-.448,.49+i*.098),(.065,.018,.008),white,r,.001)
pipe('Tank inlet',[(.19,0,1.64),(.19,0,1.83),(.65,0,1.83)],.033,steel,r)
v=empty('InletValve',r,(.4,0,1.83));cube('Inlet valve actuator',(0,0,.06),(.16,.16,.12),blue,v,.01)
pipe('Tank outlet',[(.31,0,.4),(.58,0,.4),(.58,-.22,.4)],.03,steel,r);cyl('Feed pump',(.58,-.3,.4),.11,.22,blue,r,(math.pi/2,0,0));label('Tank ID','LEVEL',(-.14,-.405,1.38),r,.075)
# Upstream stopper and photoelectric sensor.
r=empty('Facility_stopper');roots.append(('stopper',r));cube('Stopper foot',(0,0,.07),(.52,.42,.14),dark,r);cube('Stopper upright',(0,0,.49),(.10,.10,.82),steel,r)
g=empty('StopperGate',r,(0,0,.88));cube('Stopper blocking bar',(.24,0,0),(.60,.09,.09),amber,g,.012)
cube('Photoelectric sensor',(-.10,-.04,.84),(.12,.12,.15),blue,r,.015);cyl('Sensor lens',(-.1,-.105,.84),.038,.02,red,r,(math.pi/2,0,0))
# Removable warehouse safety barrier, not a person model.
r=empty('Facility_obstacle');roots.append(('obstacle',r))
for x in [-.45,.45]:cube('Barrier foot',(x,0,.045),(.25,.5,.09),dark,r);cube('Barrier post',(x,0,.46),(.07,.07,.82),amber,r)
cube('Safety barrier',(0,0,.65),(1.1,.10,.22),amber,r)
for x in [-.4,-.2,0,.2,.4]:cube('Barrier stripe',(x,-.056,.65),(.075,.009,.20),dark,r,.001)
# Export individual assemblies with semantic moving nodes.
for name,root in roots:
 bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
 for o in root.children_recursive:o.select_set(True)
 bpy.context.view_layer.objects.active=root
 bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True)
# A dedicated preview scene leaves the user's existing scene untouched.
preview=bpy.data.scenes.new('SafetyFacilities_Preview');preview.collection.children.link(col)
for i,(name,root) in enumerate(roots):root.location.x=i*1.9-3.8
world=bpy.data.worlds.new('SF Preview world');world.use_nodes=True;next(n for n in world.node_tree.nodes if n.type=='BACKGROUND').inputs[0].default_value=(.18,.22,.28,1);next(n for n in world.node_tree.nodes if n.type=='BACKGROUND').inputs[1].default_value=.5;preview.world=world
camdata=bpy.data.cameras.new('SF camera');cam=bpy.data.objects.new('SF camera',camdata);preview.collection.objects.link(cam);cam.location=(5,-11,7);cam.rotation_euler=(Vector((0,0,.65))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=11;preview.camera=cam
for loc,power,size in [((0,-4,7),1700,7),((-5,1,5),1000,5)]:
 d=bpy.data.lights.new('SF softbox','AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new('SF softbox',d);preview.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,.7))-o.location).to_track_quat('-Z','Y').to_euler()
preview.render.engine='CYCLES';preview.cycles.samples=24;preview.render.resolution_x=1600;preview.render.resolution_y=700;preview.render.resolution_percentage=100;preview.render.image_settings.file_format='PNG';preview.render.filepath=os.path.join(BASE,'blender-integration','safety-facilities','preview.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE,'blender-integration','safety-facilities','safety-facilities.blend'),copy=True)
bpy.ops.render.render(write_still=True,scene=preview.name)
result={'models':[{'name':n,'bytes':os.path.getsize(os.path.join(OUT,n+'.glb')),'parts':len(r.children_recursive)} for n,r in roots],'preview':preview.render.filepath,'protected':all(bpy.data.objects.get(n) for n in ['Cube','Camera','Light'])}
