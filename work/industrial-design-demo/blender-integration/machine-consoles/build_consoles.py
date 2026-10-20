import bpy, os, json, math
from mathutils import Vector
root=os.getcwd()
profiles=json.load(open(os.path.join(root,'src/machineConsoleProfiles.json'),encoding='utf-8'))
scene=bpy.data.scenes.new('Machine_Operator_Consoles');bpy.context.window.scene=scene
out=os.path.join(root,'public/models/machine-consoles');os.makedirs(out,exist_ok=True)
def mat(name,color,metal=.0,rough=.35):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');n.inputs['Base Color'].default_value=(*color,1);n.inputs['Metallic'].default_value=metal;n.inputs['Roughness'].default_value=rough
 return m
steel=mat('Console stainless steel',(.48,.55,.6),.78,.3);black=mat('Console rubber seals',(.018,.025,.033),.05,.56);screenmat=mat('HMI unlit glass',(.008,.018,.024),.15,.22);deckmat=mat('Console deck enamel',(.12,.17,.21),.3,.36);white=mat('Console silver labels',(.7,.76,.76),.3,.32)
def box(name,loc,size,material,bevel=.08):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
 m=o.modifiers.new('Formed edge','BEVEL');m.width=bevel;m.segments=3;bpy.ops.object.modifier_apply(modifier=m.name)
 o.modifiers.new('Face normals','WEIGHTED_NORMAL');return o

def screw(x,y,z):
 bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.047,depth=.03,location=(x,y,z));bpy.context.object.data.materials.append(steel)
 box('Screw slot',(x,y,z+.019),(.055,.008,.006),black,.002)
def feet(w):
 for x in [-w,w]:
  box('Support column',(x,-3.0,-.25),(.38,1.35,.7),steel)
  box('Rubber machine foot',(x,-3.72,.05),(1.5,.22,1.7),black)
report=[]
for p in profiles:
 before=set(scene.objects);col=mat(p['id']+' powder coating',p['color'],.5 if p['id']=='fill' else .22,.33);k=p['kind']
 if k=='desk':
  box('Sloped desk body',(0,-.65,-.05),(10,3.6,1.4),col,.22)
  box('Rear instrument riser',(0,2.03,-.13),(9.7,3.02,.8),steel,.16)
  for x in [-4.8,4.8]:box('Raised desk end cap',(x,-.5,.52),(.26,3.55,.48),col)
  feet(3.25)
 elif k=='cabinet':
  box('Gasket enclosure',(0,.1,-.1),(8.4,7.1,1.0),black,.25)
  box('Front folded cabinet',(0,.1,.04),(8.16,6.85,.8),col,.17)
  for y in [-2.3,2.5]:box('Cabinet hinge',(-4.04,y,.56),(.18,.55,.15),steel)
  box('Door handle',(-3.5,.3,.67),(.12,.7,.24),steel)
  for i in range(12):box('Cooling louvre',(-2.7+i*.16,2.7,.46),(.055,.36,.04),black,.015)
  feet(2.7)
 elif k=='vision':
  box('Optics monitor support',(0,.8,-.6),(.5,5.4,.65),steel)
  box('Monitor enclosure',(0,2,.03),(10,3.2,.9),col,.17)
  box('Precision bench',(0,-1.13,.0),(10.5,3.35,1.3),steel,.19)
  for x in [-4.95,4.95]:box('Bench side guard',(x,-1,.65),(.24,3.1,.3),col)
  feet(3.8)
 elif k=='pendant':
  box('Pendant rubber bumper',(0,.1,-.1),(8.3,7.1,1),black,.45)
  box('Pendant yellow shell',(0,.1,.14),(7.9,6.7,.7),col,.4)
  for x in [-4.6,4.6]:
   box('Side grip',(x,.0,.0),(.43,3.3,.55),black,.2)
   for y in [-1.4,1.4]:box('Grip connection',(x*.92,y,-.06),(.7,.25,.5),col)
  for i in range(6):box('Cable boot',(0,-3.5-i*.10,-.1),(.55-i*.035,.09,.45-i*.025),black,.025)
 elif k=='tablet':
  box('Vehicle mount',(0,-3.25,-.35),(3.2,.8,1.7),steel,.15)
  box('Vehicle terminal bumper',(0,.1,-.04),(9.1,7.1,1.2),black,.4)
  box('Vehicle terminal housing',(0,.1,.13),(8.65,6.7,.85),col,.22)
  for x in [-4.15,4.15]:
   for y in [-2.95,3.15]:box('Impact corner',(x,y,.37),(.6,.5,.6),black,.12)
 else:
  box('Monitor stand',(1.4,.15,-.5),(.55,3.2,.7),steel)
  box('Monitor surround',(1.4,2.1,.0),(5.5,3.15,.8),col,.15)
  box('Terminal secondary module',(-3,2.1,.0),(2.6,3.1,.8),deckmat,.15)
  box('Dispatch desktop',(0,-1.05,.0),(10.4,3.15,1.1),col,.2)
  feet(3.7)
 if k in ['desk','vision','warehouse']:box('Lower service fascia',(0,-2.85,.15),(9.4,.65,.8),col,.07)
 # The live screen and controls use these exact front mounting rectangles.
 for key,material in [('screen',screenmat),('deck',deckmat)]:
  x,y,w,h=p[key]
  box(key+' mounting bezel',(x,y,.66),(w+.24,h+.24,.19),black,.11)
  box(key+' live content surface',(x,y,.775),(w,h,.045),material,.04)
  for sx in [-1,1]:
   for sy in [-1,1]:screw(x+sx*(w/2+.075),y+sy*(h/2+.075),.78)
 # Left equipment nameplate mounting surface.
 x,y,w,h=p['screen'];lx=(-4 if k in ['desk','vision','warehouse'] else -3.3)
 box('Equipment identity plate',(lx+.7,1.6,.66),(1.8,1.65,.17),white,.06)
 # Ventilation and service seam on the lower cabinet fascia.
 if k not in ['pendant','tablet']:
  for i in range(13):box('Lower service vent',(-1.5+i*.25,-2.95,.52),(.14,.035,.025),black,.006)
 objs=set(scene.objects)-before
 for o in bpy.data.objects:o.select_set(False)
 for o in objs:o.select_set(True)
 bpy.context.view_layer.objects.active=next(iter(objs))
 bpy.ops.export_scene.gltf(filepath=os.path.join(out,p['id']+'.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_animations=False)
 holder=bpy.data.objects.new('Console_'+p['id'],None);scene.collection.objects.link(holder)
 for o in objs:
  if o.parent is None:o.parent=holder
 holder.location.x=len(report)*13
 report.append({'id':p['id'],'objects':len(objs),'bytes':os.path.getsize(os.path.join(out,p['id']+'.glb'))})
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(root,'blender-integration/machine-consoles/machine-consoles.blend'),copy=True)
result={'scene':scene.name,'consoles':report}
