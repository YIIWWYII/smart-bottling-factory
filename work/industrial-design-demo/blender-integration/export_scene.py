"""Export the existing approved scene, preserving original Blender sources."""
import bpy, json, traceback
from pathlib import Path
from mathutils import Matrix

BASE = Path(__file__).resolve().parent
OUT = BASE.parent / 'public' / 'models' / 'factory'
OUT.mkdir(parents=True, exist_ok=True)
s = bpy.data.scenes['Factory_Campus']
bpy.context.window.scene = s
report = {'source': bpy.data.filepath, 'removedVegetation': [], 'exports': {}}
previous=BASE/'export-report.json'
if previous.exists():
    old=json.loads(previous.read_text(encoding='utf-8'))
    report['removedVegetation']=old.get('removedVegetation',[])
# Remove unwanted scene dressing; original source files remain checkpoints.
report['removedPeople']=[]
for name in ('Campus.Staff','Campus.CharacterSource_Toggle'):
    collection=bpy.data.collections.get(name)
    if collection:
        for o in list(collection.all_objects):
            report['removedPeople'].append(o.name)
            bpy.data.objects.remove(o,do_unlink=True)
        bpy.data.collections.remove(collection)
vegetation = bpy.data.collections.get('Campus.ImportedVegetation')
if vegetation:
    for o in list(vegetation.all_objects):
        report['removedVegetation'].append(o.name)
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.collections.remove(vegetation)
for c in list(bpy.data.collections):
    if c.name.startswith('jacaranda_tree'):
        for o in list(c.objects):
            report['removedVegetation'].append(o.name)
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.collections.remove(c)
for o in list(bpy.data.objects):
    if o.name.startswith(('jacaranda_tree','shrub_03')):
        report['removedVegetation'].append(o.name);bpy.data.objects.remove(o,do_unlink=True)
s.frame_set(1)
# The old animation grouping used stale parent matrices. Recover authored rest
# transforms from the static source; keep the independent motion controllers.
parts=[o for o in s.objects if o.parent and o.parent.name.startswith('Motion_') and not o.get('restoredRestPose')]
source=BASE.parent.parent/'ui-role-redesign/assets/factory_high_detail/factory_high_detail.blend'
with bpy.data.libraries.load(str(source),link=False) as (src,dst):
    names=[o.name for o in parts if o.name in src.objects];dst.objects=list(names)
for name,original in zip(names,dst.objects):
    obj=s.objects[name];obj.matrix_basis=original.matrix_basis.copy();obj.matrix_parent_inverse=original.matrix_parent_inverse.copy();obj['restoredRestPose']=True
report['repairedRestPoses']=names
for original in dst.objects:
    if original:bpy.data.objects.remove(original,do_unlink=True)
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(BASE / 'factory_terminals.blend'))

codes = ['wash','gas','vision','beverage','filler','secondary','robot','agv','warehouse']
allowed = {'FactoryHD.Context','Motion.Bottling_Factory_HighDetail','Hall.ContinuousBelts','Hall.Structure','Hall.Utilities','Hall.ZonesAndLogistics'} | {'FactoryHD.'+c for c in codes}
objects = set()
for c in s.collection.children:
    if c.name in allowed:
        for o in c.all_objects:
            if not o.hide_render and o.type not in {'CAMERA','LIGHT','ARMATURE'}:
                objects.add(o)
for o in list(objects):
    p=o.parent
    while p:
        objects.add(p); p=p.parent
for o in list(objects):
    chain=[o];p=o.parent
    while p:chain.append(p);p=p.parent
    if any(p.name.startswith('Asset_') and p.name[6:] not in codes for p in chain):objects.discard(o)
# Unique stable export identifiers avoid loader name sanitization issues.
for i,o in enumerate(sorted(objects,key=lambda o:o.name)):
    o['webId']='node_'+str(i)
    p=o
    while p:
        if p.name.startswith('Asset_'):
            o['webDevice']=p.name[6:];break
        p=p.parent

moving = [o for o in objects if o.animation_data and any(f.data_path in {'location','rotation_euler','rotation_quaternion','scale'} for f in o.animation_data.drivers)]
tracks=[]
for o in moving:
    ctrl=next((v.targets[0].id for f in o.animation_data.drivers for v in f.driver.variables if v.name=='t'),None)
    tracks.append({'id':o['webId'],'name':o.name,'controller':ctrl.get('deviceCode','unknown') if ctrl else 'unknown','positions':[],'quaternions':[],'scales':[]})
C=Matrix(((1,0,0,0),(0,0,1,0),(0,-1,0,0),(0,0,0,1)))
for frame in range(1,482,2):
    s.frame_set(frame);bpy.context.view_layer.update()
    deps=bpy.context.evaluated_depsgraph_get()
    for o,t in zip(moving,tracks):
        e=o.evaluated_get(deps)
        m=e.matrix_world.copy()
        if o.parent:m=o.parent.evaluated_get(deps).matrix_world.inverted_safe() @ m
        p,q,scale=(C @ m @ C.inverted()).decompose()
        t['positions'].extend(round(v,6) for v in p)
        t['quaternions'].extend(round(v,6) for v in (q.x,q.y,q.z,q.w))
        t['scales'].extend(round(v,6) for v in scale)
report['motionTracks']=len(tracks)
report['changedTracks']=sum(len(set(tuple(t['positions'][i:i+3]+t['quaternions'][i//3*4:i//3*4+4]) for i in range(0,len(t['positions']),3)))>1 for t in tracks)
(OUT/'motion.json').write_text(json.dumps({'duration':20,'fps':12,'times':[i/12 for i in range(241)],'tracks':tracks},separators=(',',':')),encoding='utf-8')
s.frame_set(1);bpy.context.view_layer.update()
# glTF cannot carry Blender procedural nodes: keep the intended belt substrate.
material_restore=[]
for o in objects:
 for slot in o.material_slots:
    m=slot.material
    if m and m.name.startswith('FactoryHD.beltblue') and m.use_nodes:
        copy=m.copy();slot.material=copy;material_restore.append((slot,m))
        bs=next(n for n in copy.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
        for link in list(bs.inputs['Base Color'].links):copy.node_tree.links.remove(link)
        bs.inputs['Base Color'].default_value=(.045,.15,.19,1)

def export(name,selected):
    for o in s.objects:o.select_set(False)
    for o in selected:
        o.hide_set(False);o.select_set(True)
    bpy.context.view_layer.objects.active=next(iter(selected))
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_extras=True,export_cameras=False,export_lights=False)
    report['exports'][name]={'objects':len(selected),'bytes':(OUT/(name+'.glb')).stat().st_size}
    (BASE/'export-report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')

export('hall',objects)
for code in codes:
    root=s.objects['Asset_'+code]
    selected={root}|(set(root.children_recursive)&objects)
    export(code,selected)
for slot,material in material_restore:slot.material=material
s.frame_set(1)
report['status']='complete'
(BASE/'export-report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
