"""Photo-referenced defective label, exported and rendered through Blender MCP.
All deliverable paths resolve relative to the project.
"""
import bpy,math,json,bmesh
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
base=Path(__file__).resolve().parents[2]
out=base/'.runtime/vision-rehearsal';dest=base/'public/models/beverage'
out.mkdir(parents=True,exist_ok=True);(out/'defect-build').mkdir(exist_ok=True)
scene=bpy.data.scenes['Vision_Defect_Bottle_Studio'];bpy.context.window.scene=scene
assembly=scene.objects.get('Yibao_Holiday_Peach') or scene.objects['Yibao_Holiday_Peach_Defect'];label=scene.objects['Wrap_Label']
# Rebuild the label as one cylindrical sheet with a local tear; PET and cap remain intact.
n,h=256,128;verts=[];faces=[]
profile=[(.021,.03460),(.073,.03460),(.078,.03395),(.081,.03395),(.086,.03460),(.180,.03460),(.190,.0343)]
def radius(z):
 for (z0,r0),(z1,r1) in zip(profile,profile[1:]):
  if z0<=z<=z1:return r0+(r1-r0)*(z-z0)/(z1-z0)
 return profile[-1][1]
for i in range(h+1):
 z=.021+.169*i/h
 for j in range(n):
  u=j/n;a=2*math.pi*u;front=math.exp(-((u-.79)/.13)**4)
  crease=.00045*math.exp(-((z-.087)/.0035)**2)*math.sin((z-.087)*1050+1.2)*front
  lip=.00045*math.exp(-((z-.188)/.0025)**2)*math.sin(7*a+1)
  r=radius(z)+crease+lip
  verts.append((r*math.cos(a),r*math.sin(a),z))
for i in range(h):
 for j in range(n):
  u=(j+.5)/n;v=(i+.5)/h
  # Intentional missing label surface, not a hole through the PET bottle.
  tear=((u-.79)/.022)**2+((v-.39)/.009)**2
  if tear<1+.2*math.sin(900*u):continue
  faces.append((i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j))
mesh=bpy.data.meshes.new('Defect_Wrap_Label_Surface');mesh.from_pydata(verts,[],faces);mesh.update();uv=mesh.uv_layers.new(name='LabelUV')
for poly in mesh.polygons:
 poly.use_smooth=True
 for li in poly.loop_indices:
  vi=mesh.loops[li].vertex_index;row,col=divmod(vi,n);u=col/n
  if col==0 and any(mesh.loops[x].vertex_index%n==n-1 for x in poly.loop_indices):u=1
  uv.data[li].uv=(u,row/h)
clean=bmesh.new();clean.from_mesh(mesh);bmesh.ops.delete(clean,geom=[v for v in clean.verts if not v.link_edges],context='VERTS');clean.to_mesh(mesh);clean.free();mesh.update()
label.data=mesh
mat=bpy.data.materials.new('Photo_Referenced_Defective_Label');mat.use_nodes=True;nodes=mat.node_tree.nodes;nodes.clear();tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(dest/'yibao-peach-defect-label.png'),check_existing=False);tex.image.pack();p=nodes.new('ShaderNodeEmission');p.inputs['Strength'].default_value=1;output=nodes.new('ShaderNodeOutputMaterial');mat.node_tree.links.new(tex.outputs['Color'],p.inputs['Color']);mat.node_tree.links.new(p.outputs[0],output.inputs['Surface']);mesh.materials.append(mat)
assembly.name='Yibao_Holiday_Peach_Defect';assembly['defects']='Upper scuff, rear label scuff, front label tear, local label wrinkle'
# Keep editable construction and export only the bottle assembly.
for o in scene.objects:o.select_set(False)
parts=[assembly]+list(assembly.children)
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=label
bpy.ops.export_scene.gltf(filepath=str(dest/'yibao-peach-defect-bottle.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_apply=True,export_yup=True,export_animations=False)
# Mesh checks: the wrap is intentionally open at its rim and tear.
bm=bmesh.new();bm.from_mesh(mesh);audit={'vertices':len(mesh.vertices),'polygons':len(mesh.polygons),'zero_area_faces':sum(f.calc_area()<1e-14 for f in bm.faces),'loose_vertices':sum(not v.link_edges for v in bm.verts),'boundary_edges':sum(e.is_boundary for e in bm.edges),'label_open_boundaries':'Intentional upper/lower rim and label tear','max_label_radius_m':max(Vector((v.co.x,v.co.y)).length for v in mesh.vertices),'shell_and_cap':'Retained from normal bottle, no invented shell or cap break'};bm.free();assert audit['zero_area_faces']==0
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
try:
 prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
 for d in prefs.devices:d.use=d.type=='OPTIX'
 scene.cycles.device='GPU'
except Exception:scene.cycles.device='CPU'
for o in scene.objects:
 if o.name.startswith('Preview_Ground'):o.hide_render=True
scene.render.film_transparent=True;scene.render.resolution_x=480;scene.render.resolution_y=640;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
features=[{'id':'upper_scuff','title':'标签上部污渍','class':'label_scuff','u':.64,'v':.94,'du':.027,'dv':.065},{'id':'rear_scuff','title':'侧后标签污渍','class':'label_scuff','u':.28,'v':.67,'du':.019,'dv':.085},{'id':'label_tear','title':'标签破口','class':'label_tear','u':.79,'v':.39,'du':.031,'dv':.023},{'id':'label_wrinkle','title':'标签褶皱','class':'label_wrinkle','u':.79,'v':(.087-.021)/.169,'du':.11,'dv':.025}]
barcode={'id':'barcode','title':'条码区域','u':.967,'v':.38,'du':.025,'dv':.11}
cam=scene.camera;cam.data.type='ORTHO';manifest={'model':'/models/beverage/yibao-peach-defect-bottle.glb','features':features,'cameras':{},'audit':audit,'reference_note':'Photo-derived label damage; dimensions preserve the existing display model.'}
def project(feature,top):
 if top:return None
 theta=feature['u']*2*math.pi;z=.021+.169*feature['v'];normal=(assembly.matrix_world.to_3x3()@Vector((math.cos(theta),math.sin(theta),0))).normalized();point=assembly.matrix_world@Vector((radius(z)*math.cos(theta),radius(z)*math.sin(theta),z))
 if normal.dot((cam.location-point).normalized())<.22:return None
 points=[]
 for du in [-feature['du'],feature['du']]:
  for dv in [-feature['dv'],feature['dv']]:
   a=2*math.pi*(feature['u']+du);z=.021+.169*(feature['v']+dv);co=world_to_camera_view(scene,cam,assembly.matrix_world@Vector((.035*math.cos(a),.035*math.sin(a),z)));points.append((co.x*480,(1-co.y)*640))
 return [max(0,int(min(x for x,y in points))-3),max(0,int(min(y for x,y in points))-3),min(479,int(max(x for x,y in points))+3),min(639,int(max(y for x,y in points))+3)]
for name,angle in [('top',None),('side-0',0),('side-120',120),('side-240',240)]:
 if angle is None:cam.location=(0,-.001,.6);target=Vector((0,0,.12));cam.data.ortho_scale=.12
 else:
  a=math.radians(angle);cam.location=(math.sin(a)*.5,-math.cos(a)*.5,.15);target=Vector((0,0,.12));cam.data.ortho_scale=.29
 cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();bpy.context.view_layer.update()
 visible=[{**f,'xyxy':box} for f in features if (box:=project(f,angle is None))]
 manifest['cameras'][name]={'defects':visible,'barcode':project(barcode,angle is None)}
 scene.render.filepath=str(out/('defect-raw-'+name+'.png'));bpy.ops.render.render(write_still=True)
cam.location=(.03,-.45,.17);cam.rotation_euler=(Vector((0,0,.12))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=.29
for area in bpy.context.screen.areas:
 if area.type=='VIEW_3D':
  area.spaces.active.region_3d.view_distance=.4;area.spaces.active.region_3d.view_location=(0,0,.12);area.spaces.active.shading.type='MATERIAL'
scene.render.filepath=str(out/'defect-front-preview.png')
bpy.ops.wm.save_as_mainfile(filepath=str(base/'blender-integration/beverage/yibao-peach-defect-bottle.blend'))
(out/'defect-build/model-report.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('DEFECT_BOTTLE_COMPLETE',json.dumps({'model':manifest['model'],'cameras':{k:[f['title'] for f in v['defects']] for k,v in manifest['cameras'].items()},'audit':audit},ensure_ascii=False))
