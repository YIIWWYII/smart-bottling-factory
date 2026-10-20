import bpy, sys, math, json
from pathlib import Path
from mathutils import Vector, Matrix

OUT = Path(__file__).resolve().parent
sys.path.insert(0, r'D:/Codex/.codex/skills/blender-npr-eevee/scripts')
import build_eevee_npr as npr
source_scene = bpy.context.scene
dg = bpy.context.evaluated_depsgraph_get()
scene = bpy.data.scenes.new('Process_Neobrutalism')
coll = scene.collection
palette = {'ink':(.012,.018,.026,1),'white':(.88,.9,.84,1),'yellow':(1,.65,.025,1),'blue':(.035,.19,.8,1),'red':(.94,.14,.075,1),'paper':(.89,.85,.74,1),'pale':(.36,.67,.72,1)}
materials={}
for name,color in palette.items():
    mat=npr.build_toon_material(color).copy(); mat.name='Process.'+name
    materials[name]=mat
outline=npr.build_outline_material()
group=npr.build_outline_group(outline,width=.016)

def ink(obj):
    if obj.type=='MESH':
        m=obj.modifiers.new('Ink contour','NODES'); m.node_group=group

def material_for(old,name,key):
    s=old.lower(); n=name.lower()
    if any(x in s for x in ['rubber','screen','frame']): return materials['ink']
    if any(x in s for x in ['red','orange']): return materials['red']
    if any(x in s for x in ['cyan','teal','blue']): return materials['blue']
    if any(x in s for x in ['yellow','shell']): return materials['yellow']
    if any(x in n for x in ['motor','tank body','rack channel']): return materials['blue']
    if 'cardboard' in s or 'carton' in n: return materials['yellow']
    if 'glass' in s: return materials['pale']
    return materials['white']

positions={'wash':(-12,0),'gas':(-7.8,0),'vision':(-4,0),'beverage':(.3,5),'filler':(.3,0),'secondary':(4.8,0),'robot':(8.5,0),'agv':(11.8,-2),'warehouse':(14.4,2.8)}
centers={}; machine_objects={}
for key,(x,y) in positions.items():
    src=bpy.data.collections['FactoryHD.'+key]
    pts=[o.matrix_world@Vector(v) for o in src.all_objects if o.type=='MESH' for v in o.bound_box]
    center=Vector(((min(p.x for p in pts)+max(p.x for p in pts))/2,(min(p.y for p in pts)+max(p.y for p in pts))/2,0))
    centers[key]=center
    dst=bpy.data.collections.new('Process.'+key); coll.children.link(dst); machine_objects[key]=[]
    for o in src.all_objects:
        if o.type not in {'MESH','CURVE'}: continue
        if 'safety door' in o.name.lower() and 'Polycarbonate' in o.name: continue
        ev=o.evaluated_get(dg)
        mesh=bpy.data.meshes.new_from_object(ev,depsgraph=dg)
        obj=bpy.data.objects.new(key+'.'+o.name,mesh); dst.objects.link(obj)
        obj.matrix_world=Matrix.Translation(Vector((x,y,0))-center)@o.matrix_world
        oldm=[m.name if m else '' for m in mesh.materials]
        mesh.materials.clear()
        for mn in oldm or ['']: mesh.materials.append(material_for(mn,o.name,key))
        obj['stage']=key; machine_objects[key].append(obj)
        ink(obj)

bpy.context.window.scene=scene
def cube(name,loc,scale,mat,outline_on=True):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object; o.name=name; o.dimensions=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(materials[mat])
    if outline_on: ink(o)
    return o

def pipe(name,pts,rad,mat):
    cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.bevel_depth=rad;cu.bevel_resolution=2
    spl=cu.splines.new('POLY');spl.points.add(len(pts)-1)
    for p,co in zip(spl.points,pts):p.co=(*co,1)
    ob=bpy.data.objects.new(name,cu);coll.objects.link(ob);cu.materials.append(materials[mat]);return ob

# Continuous bottle bed; repeating belt slats use a native Array modifier.
cube('Continuous conveyor chassis',(-2,0,.92),(25,.74,.18),'ink')
slat=cube('Conveyor repeated slat',(-14.4,0,1.025),(.21,.69,.045),'blue',False)
arr=slat.modifiers.new('Repeated belt links','ARRAY');arr.count=108;arr.relative_offset_displace=(1.1,0,0)
for y in [-.47,.47]:
    pipe('Continuous guard rail',[(-14.5,y,1.15),(10.5,y,1.15)],.035,'white')
for x in [-14,-10,-6,-2,2,6,10]:
    for y in [-.32,.32]:cube('Conveyor leg',(x,y,.45),(.08,.08,.9),'ink')

# Bottle body is a lathed profile, duplicated as linked mesh instances.
profile=[(0,0),(.12,0),(.14,.04),(.14,.35),(.12,.41),(.057,.48),(.057,.57),(0,.57)]
verts=[];faces=[];segments=16
for r,z in profile:
    for i in range(segments):verts.append((r*math.cos(i*2*math.pi/segments),r*math.sin(i*2*math.pi/segments),z))
for j in range(len(profile)-1):
    for i in range(segments):faces.append((j*segments+i,j*segments+(i+1)%segments,(j+1)*segments+(i+1)%segments,(j+1)*segments+i))
mesh=bpy.data.meshes.new('Lathed bottle profile');mesh.from_pydata(verts,[],faces);mesh.materials.append(materials['pale'])
for i in range(49):
    x=-14.2+i*.49
    o=bpy.data.objects.new('Bottle.%02d'%i,mesh);coll.objects.link(o);o.location=(x,0,1.07);ink(o)
    cube('Bottle cap',(x,0,1.64),(.13,.13,.065),'red',False)

# Separate liquid branch, physically terminating in the filler manifold.
pipe('Liquid supply 04 to 05',[(.3,5,1.1),(.3,3.6,1.1),(.3,3.6,3.25),(.3,0,3.25),(.3,0,2.45)],.11,'red')
for y in [1.2,2.2,3.2]:cube('Pipe clamp',(.3,y,3.25),(.29,.085,.29),'ink',False)

# Transport aisle and distinct carton handoff, never a bottle conveyor into storage.
cube('AMR transport lane',(12,-1.8,.015),(6,2.1,.03),'blue',False)
cube('AMR warehouse approach',(14.4,.1,.015),(1.7,4,.031),'blue',False)
for x in [9.7,10.6,12.7,13.6]:cube('Route dash',(x,-2.48,.036),(.44,.065,.012),'yellow',False)
for y in [-1.5,-.6,.3,1.2]:cube('Route dash',(15.04,y,.036),(.065,.44,.012),'yellow',False)
cube('Packing table',(9.5,.45,.8),(1.6,1.35,.15),'blue')
for x in [9,10]:
    for y in [0,.9]:cube('Packing table support',(x,y,.39),(.1,.1,.78),'ink')
cube('Carton at packing',(9.5,.45,1.2),(.72,.7,.65),'yellow')
cube('Carton tape',(9.5,.45,1.531),(.15,.7,.013),'white',False)

# Ground with hard cast shadows, no building shell.
cube('Warm paper ground',(0,0,-.13),(200,200,.2),'paper',False)

camdata=bpy.data.cameras.new('Process perspective');cam=bpy.data.objects.new('Process perspective',camdata);coll.objects.link(cam)
target=Vector((.1,1,1));cam.location=(25,-51,36);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='PERSP';camdata.lens=48;scene.camera=cam

# Stable stage identifiers, deliberately no baked live telemetry.
for i,key in enumerate(['wash','gas','vision','beverage','filler','secondary','robot','agv','warehouse'],1):
    x,y=positions[key];h=4.2 if key!='agv' else 2.4
    pipe('ID support '+key,[(x,y,.1),(x,y,h)],.022,'ink')
    plate=cube('ID badge '+key,(x,y,h),(.78,.66,.085),'ink',False);plate.rotation_euler=cam.rotation_euler
    cu=bpy.data.curves.new('Stage number','FONT');cu.body=f'{i:02}';cu.align_x='CENTER';cu.align_y='CENTER';cu.size=.43;cu.extrude=0
    o=bpy.data.objects.new('ID '+key,cu);coll.objects.link(o);o.rotation_euler=cam.rotation_euler
    o.location=Vector((x,y,h))+cam.rotation_euler.to_matrix()@Vector((0,0,.055));cu.materials.append(materials['white'])

world=bpy.data.worlds.new('Process studio');world.use_nodes=True;world.node_tree.nodes.clear()
bg=world.node_tree.nodes.new('ShaderNodeBackground');bg.inputs['Color'].default_value=(1,1,1,1);bg.inputs['Strength'].default_value=.55
wo=world.node_tree.nodes.new('ShaderNodeOutputWorld');world.node_tree.links.new(bg.outputs[0],wo.inputs[0]);scene.world=world
ld=bpy.data.lights.new('Hard graphic key','SUN');lo=bpy.data.objects.new('Hard graphic key',ld);coll.objects.link(lo);ld.energy=2.3;ld.angle=.035;lo.rotation_euler=(math.radians(23),math.radians(-30),math.radians(-25))
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=2400;scene.render.resolution_y=1350;scene.render.resolution_percentage=75
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'process-preview.png');scene.view_settings.view_transform='Standard'
scene.render.film_transparent=False
# Output contains only the independent new scene; source file remains untouched.
for s in list(bpy.data.scenes):
    if s!=scene:bpy.data.scenes.remove(s)
for o in list(bpy.data.objects):
    if not o.users_scene:bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'process-neobrutalism.blend'))
bpy.ops.render.render(write_still=True)
(OUT/'scene-check.json').write_text(json.dumps({'scene':scene.name,'projection':camdata.type,'stage_count':9,'objects':len(scene.objects),'flow':['01>02>03>05>06>07>08>09','04>05'],'source_preserved':True,'render':scene.render.filepath},indent=2),encoding='utf-8')
