import bpy,json,math
from pathlib import Path
from mathutils import Vector
BASE=Path(__file__).resolve().parent
APP=BASE.parent.parent
s=bpy.data.scenes['Factory_Campus'];bpy.context.window.scene=s;s.frame_set(1)
# Reuse exactly the approved export set and identifiers; no topology or drivers changed.
src=(APP/'blender-integration/export_scene.py').read_text(encoding='utf-8')
exec(src[src.index("codes = "):src.index('moving = ')])
report={'materials':{},'exports':{}}
profiles={'steel':((.16,.22,.31,1),.68,.32),'polished':((.66,.72,.82,1),.88,.2),'frame':((.035,.065,.12,1),.82,.28),'shell':((.78,.86,.94,1),.18,.25),'rubber':((.018,.023,.03,1),0,.78),'glass':((.08,.28,.42,1),.18,.1),'hallfloor':((.07,.11,.18,1),.18,.46),'hallwall':((.18,.25,.35,1),.12,.58),'floor':((.08,.12,.2,1),.15,.5),'orange':((.95,.23,.035,1),.2,.3),'yellow':((.96,.67,.06,1),.2,.28),'white':((.9,.94,.98,1),.12,.25),'teal':((.02,.24,.42,1),.5,.24)}
for m in bpy.data.materials:
 if not m.name.startswith('FactoryHD.') or not m.use_nodes:continue
 bs=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
 if not bs:continue
 key=m.name.split('.')[1]
 p=profiles.get(key)
 if key.startswith('beltblue'):p=((.025,.095,.13,1),.05,.64)
 if p:
  for link in list(bs.inputs['Base Color'].links):m.node_tree.links.remove(link)
  bs.inputs['Base Color'].default_value=p[0];bs.inputs['Metallic'].default_value=p[1];bs.inputs['Roughness'].default_value=p[2]
  if key=='glass':bs.inputs['Transmission Weight'].default_value=.75;bs.inputs['IOR'].default_value=1.46
  report['materials'][m.name]={'metallic':p[1],'roughness':p[2]}
# Reference rebuild: change the mechanical silhouettes, not only color.
extra=bpy.data.collections.new('Reference.MechanicalRefit');s.collection.children.link(extra)
chrome=bpy.data.materials['FactoryHD.polished'];frame=bpy.data.materials['FactoryHD.frame']
def own(o,name,root,mat):
 o.name=name
 for col in list(o.users_collection):col.objects.unlink(o)
 extra.objects.link(o);o.parent=root
 o['webId']='refit_'+name;o['webDevice']=root.name[6:];o.data.materials.append(mat);objects.add(o)
 return o
def tube(name,root,points,r=.026):
 curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.bevel_depth=r;curve.bevel_resolution=3
 spline=curve.splines.new('BEZIER');spline.bezier_points.add(len(points)-1)
 for b,p in zip(spline.bezier_points,points):b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,curve);extra.objects.link(o);o.parent=root;o.data.materials.append(chrome);o['webId']='refit_'+name;o['webDevice']=root.name[6:];objects.add(o)
 return o
root=s.objects['Asset_filler']
for i,x in enumerate([-.98,-.59,-.2,.2,.59,.98]):
 tube('Sanitary hose '+str(i),root,[(x,.02,2.25),(x,.1,2.52),(x,.45,2.56),(.5,.65,2.7)],.024)
 bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.09,depth=.07,location=(x,.02,2.16))
 own(bpy.context.object,'Valve clamp '+str(i),root,chrome)
# Extruded heat-dissipation ribs and reinforced panel corners are shared manufacturing details.
for code in ['wash','gas','vision','filler','secondary']:
 root=s.objects['Asset_'+code]
 bpy.ops.mesh.primitive_cube_add(size=1,location=(-.45,-.87,.53));o=own(bpy.context.object,'Vent louvre '+code,root,frame);o.dimensions=(.03,.02,.22)
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 ar=o.modifiers.new('Repeated cabinet ventilation','ARRAY');ar.count=12;ar.relative_offset_displace=(2.2,0,0)
 bevel=o.modifiers.new('Manufactured edge','BEVEL');bevel.width=.004;bevel.segments=2
# Clear safety glazing lets the internal tooling remain legible.
for o in objects:
 if o.type=='MESH' and any(m and m.name=='FactoryHD.glass' for m in o.data.materials):
  m=bpy.data.materials['FactoryHD.glass'];bs=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bs.inputs['Alpha'].default_value=.18;bs.inputs['Transmission Weight'].default_value=.3
bpy.context.view_layer.update()
OUT=APP/'public/models/factory-realistic';OUT.mkdir(exist_ok=True)
def export(name,selected):
 for o in s.objects:o.select_set(False)
 for o in selected:o.hide_set(False);o.select_set(True)
 bpy.context.view_layer.objects.active=next(iter(selected))
 bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_extras=True,export_cameras=False,export_lights=False)
 report['exports'][name]={'objects':len(selected),'bytes':(OUT/(name+'.glb')).stat().st_size}
export('hall',objects)
for code in codes:
 root=s.objects['Asset_'+code];export(code,{root}|(set(root.children_recursive)&objects))
# Render only the same factory contents exported to the web.
for o in s.objects:
 if o.type not in {'LIGHT','CAMERA'}:o.hide_render=o not in objects

for o in s.objects:
 if o.type not in {'LIGHT','CAMERA'} and any(c.name in {'Hall.Structure','Hall.Utilities'} for c in o.users_collection) and not any(t in o.name.lower() for t in ['floor','slab']):o.hide_render=True
cam=s.camera;cam.location=(12,-30,20);cam.rotation_euler=(Vector((0,-1,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=31
s.view_settings.exposure=-.45
s.render.engine='CYCLES';s.cycles.samples=24;s.cycles.use_denoising=True
s.render.resolution_x=1800;s.render.resolution_y=850;s.render.resolution_percentage=100
s.render.film_transparent=True
s.world.color=(.015,.025,.05)
s.render.image_settings.file_format='PNG';s.render.filepath=str(APP/'public/images/factory-realistic.png')
bpy.ops.wm.save_as_mainfile(filepath=str(BASE/'factory_realistic.blend'))
report['webIdsMatch']=all(o.get('webId') for o in objects)
(BASE/'realistic-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
bpy.ops.render.render(write_still=True)
