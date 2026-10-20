import bpy, math
from pathlib import Path
from mathutils import Vector
out=Path(__file__).resolve().parent
s=bpy.context.scene
print('MATERIALS',[(m.name,m.use_nodes,[(n.type) for n in m.node_tree.nodes] if m.node_tree else []) for m in bpy.data.materials if m.name.startswith('Process.')])
colors={'ink':(.008,.012,.019,1),'white':(.85,.88,.82,1),'yellow':(1,.56,.008,1),'blue':(.018,.095,.72,1),'red':(.92,.055,.022,1),'paper':(.84,.78,.66,1),'pale':(.26,.57,.65,1)}
for key,color in colors.items():
 m=bpy.data.materials['Process.'+key];m.use_nodes=True;m.node_tree.nodes.clear();nt=m.node_tree
 d=nt.nodes.new('ShaderNodeBsdfDiffuse');d.inputs[0].default_value=(1,1,1,1)
 rgb=nt.nodes.new('ShaderNodeShaderToRGB');r=nt.nodes.new('ShaderNodeValToRGB');r.color_ramp.interpolation='CONSTANT'
 r.color_ramp.elements[0].position=.25;r.color_ramp.elements[0].color=tuple(c*.35 for c in color[:3])+(1,)
 r.color_ramp.elements[1].position=.72;r.color_ramp.elements[1].color=color
 el=r.color_ramp.elements.new(.48);el.color=tuple(c*.72 for c in color[:3])+(1,)
 em=nt.nodes.new('ShaderNodeEmission');o=nt.nodes.new('ShaderNodeOutputMaterial')
 nt.links.new(d.outputs[0],rgb.inputs[0]);nt.links.new(rgb.outputs[0],r.inputs[0]);nt.links.new(r.outputs[0],em.inputs[0]);nt.links.new(em.outputs[0],o.inputs[0])
for ob in s.objects:
 if ob.type!='MESH':continue
 n=ob.name.lower()
 if any(t in n for t in ['access door','crown fascia','guard header','filler top','sanitary skid']):
  ob.data.materials.clear();ob.data.materials.append(bpy.data.materials['Process.yellow'])
 elif 'tank' in n and any(t in n for t in ['body','shell','vessel']):
  ob.data.materials.clear();ob.data.materials.append(bpy.data.materials['Process.blue'])
for item in bpy.data.node_groups['BPS_NPR_EEVEE_INVERTED_HULL'].interface.items_tree:
 if item.name=='Width' and item.in_out=='INPUT':item.default_value=.026
cam=s.camera;target=Vector((.4,1.5,1.4));cam.location=(12,-49,31);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=57
for ob in s.objects:
 if ob.name.startswith('ID badge '):ob.rotation_euler=cam.rotation_euler
 if ob.type=='FONT':ob.rotation_euler=cam.rotation_euler
s.render.resolution_percentage=100;s.render.filepath=str(out/'process-render.png')
bpy.ops.wm.save_as_mainfile(filepath=str(out/'process-neobrutalism.blend'))
bpy.ops.render.render(write_still=True)
