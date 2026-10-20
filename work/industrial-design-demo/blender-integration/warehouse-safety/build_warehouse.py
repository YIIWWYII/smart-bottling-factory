import bpy, math, os, json
from mathutils import Vector
BASE=r'E:\2026挑战杯\工业沙盘2026\数字展板前后端\work\industrial-design-demo'
# Reuse the project's manufacturing helpers without creating the previous facilities.
source=open(os.path.join(BASE,'blender-integration','safety-facilities','build_facilities.py'),encoding='utf8').read().split('# Cabinet with actual fan opening')[0]
exec(source.replace('SafetyFacilities_20261009','WarehouseSafety_20261012'))

def sensor(parent,name,x,z):
 cube(name+' enclosure',(x,-.26,z),(.18,.12,.25),white,parent,.015)
 slot=cube(name+' ventilation slot',(x-.055,-.327,z-.07),(.012,.009,.13),dark,parent,.002)
 a=slot.modifiers.new('Sensor ventilation Array','ARRAY');a.count=5;a.use_relative_offset=False;a.use_constant_offset=True;a.constant_offset_displace=(.027,0,0)
 cyl(name+' status LED',(x+.052,-.33,z+.085),.014,.01,water,parent,(math.pi/2,0,0))

r=empty('Facility_warehouseVent');roots.append(('warehouseVent',r))
cube('Fan enclosure',(0,0,.85),(.85,.38,1.7),steel,r)
door=cube('Fan intake panel',(0,-.21,.85),(.79,.045,1.58),blue,r)
cut=cyl('Intake cutter',(0,-.21,1.0),.28,.16,dark,r,(math.pi/2,0,0))
bpy.context.view_layer.objects.active=door;a=door.modifiers.new('Intake opening','BOOLEAN');a.object=cut;a.operation='DIFFERENCE';bpy.ops.object.modifier_apply(modifier=a.name);parts.remove(cut);bpy.data.objects.remove(cut,do_unlink=True)
rotor=empty('FanRotor',r,(0,-.28,1.0));rotor.rotation_euler=(math.pi/2,0,0)
cyl('Rotor hub',(0,0,0),.06,.055,dark,rotor)
for i in range(6):
 a=i*math.tau/6;v=[(.05,-.02,0),(.24,-.06,.025),(.26,.025,.04),(.09,.055,.01)];v=[(x*math.cos(a)-y*math.sin(a),x*math.sin(a)+y*math.cos(a),z) for x,y,z in v];m=bpy.data.meshes.new('Swept blade');m.from_pydata(v,[],[(0,1,2,3)]);o=bpy.data.objects.new('Fan blade',m);col.objects.link(o);o.parent=rotor;m.materials.append(dark);o.modifiers.new('Blade sheet thickness','SOLIDIFY').thickness=.008;parts.append(o)
for radius in [.14,.22,.29]:
 bpy.ops.mesh.primitive_torus_add(major_radius=radius,minor_radius=.007,major_segments=32,minor_segments=6,location=(0,-.35,1),rotation=(math.pi/2,0,0));own(bpy.context.object,'Fan safety guard',steel,r)
sensor(r,'Temperature probe',-.18,.36);label('Vent identifier','VENT',(-.2,-.24,1.5),r,.10)

r=empty('Facility_warehouseDryer');roots.append(('warehouseDryer',r))
cube('Dehumidifier chassis',(0,0,.58),(.64,.48,1.16),white,r)
cube('Intake grille frame',(0,-.26,.73),(.57,.035,.5),dark,r,.015)
fin=cube('Intake louvre',(0,-.29,.53),(.53,.027,.014),steel,r,.003)
a=fin.modifiers.new('Louvre Array','ARRAY');a.count=10;a.use_relative_offset=False;a.use_constant_offset=True;a.constant_offset_displace=(0,0,.043)
cube('Condensate tank',(0,-.255,.22),(.48,.04,.25),blue,r)
pipe('Drain hose',[(.22,.17,.2),(.39,.17,.2),(.39,.17,.035),(.53,.17,.035)],.018,dark,r)
sensor(r,'Humidity probe',.15,.99);label('Dryer identifier','DRY',(-.21,-.275,1.02),r,.07)
rotor=empty('FanRotor',r,(0,.24,.72));rotor.rotation_euler=(math.pi/2,0,0)
for i in range(4):
 a=i*math.pi/2;o=cube('Dryer outlet blade',(.10*math.cos(a),.10*math.sin(a),0),(.18,.045,.012),blue,rotor,.006);o.rotation_euler.z=a
for x in [-.24,.24]:
 for y in [-.17,.17]:cyl('Caster',(x,y,.05),.045,.035,dark,r,(math.pi/2,0,0))

r=empty('Facility_warehouseFire');roots.append(('warehouseFire',r))
cube('Safety mast base',(0,0,.05),(.48,.4,.10),steel,r)
cube('Safety mast',(0,0,.90),(.065,.065,1.8),steel,r)
cube('Safety monitoring cabinet',(0,-.08,.8),(.37,.18,.48),blue,r)
cyl('Gas sensor housing',(-.17,-.2,1.2),.095,.19,steel,r)
cyl('Gas sensing inlet',(-.17,-.2,1.08),.066,.05,dark,r)
pipe('Gas probe cable',[(-.17,-.17,1.2),(-.17,-.1,1.4),(0,-.04,1.4),(0,-.04,1.02)],.008,dark,r)
cyl('Smoke detector housing',(.15,-.08,1.67),.13,.085,white,r)
slot=cube('Smoke detector air slot',(.035,-.212,1.65),(.022,.01,.025),dark,r,.002)
a=slot.modifiers.new('Smoke inlet Array','ARRAY');a.count=7;a.use_relative_offset=False;a.use_constant_offset=True;a.constant_offset_displace=(.035,0,0)
cyl('Beacon mount',(0,0,1.83),.08,.055,dark,r)
cyl('AlarmBeacon',(0,0,1.91),.072,.13,red,r)
cube('Sounder',(0,-.19,.85),(.19,.065,.19),dark,r)
label('Safety identifier','GAS / FIRE',(-.17,-.177,.6),r,.045)
reports=[]
for name,root in roots:
 bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
 for o in root.children_recursive:o.select_set(True)
 bpy.context.view_layer.objects.active=root
 bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True)
 reports.append({'name':name,'bytes':os.path.getsize(os.path.join(OUT,name+'.glb')),'parts':len(root.children_recursive),'semantic_nodes':[o.name for o in root.children_recursive if o.name.startswith(('FanRotor','AlarmBeacon'))]})
preview=bpy.data.scenes.new('WarehouseSafety_Preview');preview.collection.children.link(col)
for i,(_,root) in enumerate(roots):root.location.x=(i-1)*1.2
world=bpy.data.worlds.new('Warehouse preview world');world.use_nodes=True;next(n for n in world.node_tree.nodes if n.type=='BACKGROUND').inputs[0].default_value=(.35,.42,.50,1);preview.world=world
camdata=bpy.data.cameras.new('Warehouse preview camera');cam=bpy.data.objects.new('Warehouse preview camera',camdata);preview.collection.objects.link(cam);cam.location=(3,-7,3.5);cam.rotation_euler=(Vector((0,0,.85))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=4.7;preview.camera=cam
for loc,power in [((0,-3,5),900),((-3,1,4),700)]:
 d=bpy.data.lights.new('Warehouse softbox','AREA');d.energy=power;d.size=4;o=bpy.data.objects.new('Warehouse softbox',d);preview.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,.8))-o.location).to_track_quat('-Z','Y').to_euler()
preview.render.engine='CYCLES';preview.cycles.samples=16;preview.render.resolution_x=1200;preview.render.resolution_y=700;preview.render.resolution_percentage=100;preview.render.image_settings.file_format='PNG';preview.render.filepath=os.path.join(BASE,'blender-integration','warehouse-safety','preview.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE,'blender-integration','warehouse-safety','warehouse-safety.blend'),copy=True)
bpy.ops.render.render(write_still=True,scene=preview.name)
result={'models':reports,'preview':preview.render.filepath,'protected':all(bpy.data.objects.get(n) for n in ['Cube','Camera','Light'])}
with open(os.path.join(BASE,'blender-integration','warehouse-safety','model-validation.json'),'w',encoding='utf8') as f:json.dump(result,f,ensure_ascii=False,indent=2)
