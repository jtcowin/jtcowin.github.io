"""
Events V1.1: an original activation render (Blender Cycles, built from code).

A dark exhibition room after the reference's layout and light: a large
projection on the back wall at left, the booth at center (wood-slat counter,
white back panel, television, a dark fascia carrying the Bolt Liquidity
wordmark), and a restrained conversation area at right (a round bar table and
two upholstered bar chairs on a rounded carpet). Colored wall washers graze the
back wall; a soft key lights the booth; an LED line glows under the counter.

Passes (--pass):
  plate     everything lit; the television dark, no projection
  tv        only the television's light (its spill on the counter and floor)
  wall      only the projection's light (an emitter on the wall, unseen)
  receptor  only the wall, lit evenly from the front (the projection's mask)
Geometry for the page (screen-space corners of the television and of the
projection) is written to --geom as JSON.
"""
import argparse
import json
import math
import os
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument('--pass', dest='which', default='plate')
ap.add_argument('--out', default='plate.png')
ap.add_argument('--w', type=int, default=640)
ap.add_argument('--h', type=int, default=320)
ap.add_argument('--samples', type=int, default=32)
ap.add_argument('--geom', default='')
ap.add_argument('--exr', action='store_true')
ap.add_argument('--threads', type=int, default=2)
ap.add_argument('--blend', default='')
ap.add_argument('--crop', default='')
ap.add_argument('--norender', action='store_true')
A = ap.parse_args(argv)

# The wordmark and its mark, rasterized at full size from the brand's own SVG
# (reference/events-video/bolt-liquidity-yellow.svg, proportions untouched):
# the whole wordmark 4096 px wide, and its first 1000 px (the mark) for the
# hoodie's print. See the usage note at the end of the file.
TEX = os.environ.get('BOOTH_TEX', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex'))
LOGO = os.path.join(TEX, 'bolt-yellow-4096.png')
MARK = os.path.join(TEX, 'bolt-mark-1000.png')

# ---------------------------------------------------------------- layout (meters)
WALL_Y = 3.4
BOOTH_X = 0.0
COUNTER = dict(x0=-0.9, x1=0.9, y0=0.95, y1=1.45, h=0.98)
PANEL = dict(y0=1.45, y1=1.52, z0=0.98, z1=2.3)
TV = dict(cx=0.0, cz=1.70, w=1.214, h=0.683)  # 55 inch, 16:9 picture
FASCIA = dict(w=1.72, h=0.36, d=0.22, z0=2.40, y0=1.30)
PROJ = dict(x0=-4.85, x1=-1.55, z0=0.64, z1=2.84)  # 3.3 x 2.2 m: 3:2
TABLE = dict(x=2.15, y=0.55, r=0.36, h=1.05)
CAM = dict(loc=(-0.1, -6.0, 1.45), aim=(-0.25, 1.9, 1.3), lens=29.0)

# ---------------------------------------------------------------- scene
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
cy = scene.cycles
cy.device = 'CPU'
cy.samples = A.samples
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.012
cy.use_denoising = A.which != 'receptor'
try:
    cy.denoiser = 'OPENIMAGEDENOISE'
except Exception:
    pass
cy.max_bounces = 8
cy.diffuse_bounces = 3
cy.glossy_bounces = 3
cy.transmission_bounces = 2
cy.transparent_max_bounces = 8
cy.volume_bounces = 0
cy.sample_clamp_indirect = 6.0
cy.caustics_reflective = False
cy.caustics_refractive = False
scene.render.threads_mode = 'FIXED'
scene.render.threads = A.threads
scene.render.resolution_x = A.w
scene.render.resolution_y = A.h
scene.render.resolution_percentage = 100
scene.render.film_transparent = A.which == 'receptor'
scene.view_settings.view_transform = 'AgX'
try:
    scene.view_settings.look = 'AgX - Medium High Contrast'
except Exception:
    pass
scene.view_settings.exposure = 0.0
scene.display_settings.display_device = 'sRGB'

world = bpy.data.worlds.new('World')
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (0.0, 0.0, 0.0, 1)
bg.inputs['Strength'].default_value = 0.0


# ---------------------------------------------------------------- helpers
def node(nt, kind, **kw):
    n = nt.nodes.new(kind)
    for k, v in kw.items():
        if k == 'loc':
            n.location = v
        else:
            setattr(n, k, v)
    return n


def principled(name, color, rough=0.5, metallic=0.0, spec=0.5, coat=0.0, sheen=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metallic
    if 'Specular IOR Level' in p.inputs:
        p.inputs['Specular IOR Level'].default_value = spec
    if coat and 'Coat Weight' in p.inputs:
        p.inputs['Coat Weight'].default_value = coat
    if sheen and 'Sheen Weight' in p.inputs:
        p.inputs['Sheen Weight'].default_value = sheen
    return m


def emission(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = node(nt, 'ShaderNodeOutputMaterial')
    em = node(nt, 'ShaderNodeEmission')
    em.inputs['Color'].default_value = (*color, 1)
    em.inputs['Strength'].default_value = strength
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    return m


def noisy(m, scale=6.0, detail=6.0, c0=None, c1=None, rough=None, bump=0.0, bump_scale=None, bump_detail=8.0):
    """Give a principled material a noise-driven color, roughness and bump."""
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    tc = node(nt, 'ShaderNodeTexCoord')
    nz = node(nt, 'ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = scale
    nz.inputs['Detail'].default_value = detail
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    if c0 and c1:
        ramp = node(nt, 'ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color = (*c0, 1)
        ramp.color_ramp.elements[1].color = (*c1, 1)
        ramp.color_ramp.elements[0].position = 0.3
        ramp.color_ramp.elements[1].position = 0.7
        nt.links.new(nz.outputs['Fac'], ramp.inputs['Fac'])
        nt.links.new(ramp.outputs['Color'], p.inputs['Base Color'])
    if rough:
        mr = node(nt, 'ShaderNodeMapRange')
        mr.inputs['To Min'].default_value = rough[0]
        mr.inputs['To Max'].default_value = rough[1]
        n2 = node(nt, 'ShaderNodeTexNoise')
        n2.inputs['Scale'].default_value = scale * 0.6
        n2.inputs['Detail'].default_value = 4
        nt.links.new(tc.outputs['Object'], n2.inputs['Vector'])
        nt.links.new(n2.outputs['Fac'], mr.inputs['Value'])
        nt.links.new(mr.outputs['Result'], p.inputs['Roughness'])
    if bump:
        n3 = node(nt, 'ShaderNodeTexNoise')
        n3.inputs['Scale'].default_value = bump_scale or scale * 8
        n3.inputs['Detail'].default_value = bump_detail
        nt.links.new(tc.outputs['Object'], n3.inputs['Vector'])
        b = node(nt, 'ShaderNodeBump')
        b.inputs['Strength'].default_value = bump
        b.inputs['Distance'].default_value = 0.02
        nt.links.new(n3.outputs['Fac'], b.inputs['Height'])
        nt.links.new(b.outputs['Normal'], p.inputs['Normal'])
    return m


def box(name, x0, x1, y0, y1, z0, z1, mat, bevel=0.004, segs=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = bpy.context.active_object
    o.name = name
    o.scale = (x1 - x0, y1 - y0, z1 - z0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = segs
        mod.limit_method = 'ANGLE'
    o.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    try:
        o.data.set_sharp_from_angle(angle=math.radians(35))
    except Exception:
        pass
    return o


def cyl(name, r, z0, z1, x, y, mat, verts=48, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=z1 - z0, location=(x, y, (z0 + z1) / 2))
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(mat)
    if bevel:
        mod = o.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        mod.limit_method = 'ANGLE'
    bpy.ops.object.shade_smooth()
    try:
        o.data.set_sharp_from_angle(angle=math.radians(35))
    except Exception:
        pass
    return o


def rod(name, p0, p1, r, mat, verts=16):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d.length, location=(p0 + p1) / 2)
    o = bpy.context.active_object
    o.name = name
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = d.to_track_quat('Z', 'Y')
    o.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return o


def plane(name, x0, x1, z0, z1, y, mat, facing=-1):
    """A vertical plane at depth y spanning x and z, its face toward -y (facing=-1)."""
    import bmesh
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    vs = [bm.verts.new(v) for v in ((x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1))]
    f = bm.faces.new(vs if facing < 0 else list(reversed(vs)))
    uv = bm.loops.layers.uv.new('UVMap')
    for loop, (u, v) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1)) if facing < 0 else ((0, 1), (1, 1), (1, 0), (0, 0))):
        loop[uv].uv = (u, v)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    scene.collection.objects.link(o)
    o.data.materials.append(mat)
    return o


def look_at(obj, target):
    d = Vector(target) - obj.location
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = d.to_track_quat('-Z', 'Y')


# ---------------------------------------------------------------- materials
M = {}
M['floor'] = noisy(principled('floor', (0.035, 0.035, 0.035), rough=0.3, spec=0.5), scale=3.5, detail=8,
                   c0=(0.034, 0.034, 0.035), c1=(0.05, 0.049, 0.048), rough=(0.06, 0.2), bump=0.02, bump_scale=60)
M['wall'] = noisy(principled('wall', (0.03, 0.03, 0.03), rough=0.9, spec=0.3), scale=2.2, detail=10,
                  c0=(0.026, 0.026, 0.027), c1=(0.034, 0.033, 0.033), bump=0.14, bump_scale=30, bump_detail=10)
M['ceiling'] = principled('ceiling', (0.008, 0.008, 0.008), rough=0.9)
M['white'] = principled('panel', (0.7, 0.69, 0.67), rough=0.5, spec=0.4)
M['top'] = principled('countertop', (0.83, 0.82, 0.8), rough=0.28, spec=0.5)
M['wood'] = noisy(principled('wood', (0.45, 0.28, 0.15), rough=0.5), scale=1.2, detail=4,
                  c0=(0.36, 0.21, 0.105), c1=(0.52, 0.33, 0.18), rough=(0.42, 0.6), bump=0.05, bump_scale=120)
M['black'] = principled('fascia', (0.012, 0.012, 0.013), rough=0.35, spec=0.5)
M['bezel'] = principled('bezel', (0.01, 0.01, 0.011), rough=0.25, spec=0.6)
M['glass'] = principled('screen', (0.004, 0.004, 0.005), rough=0.04, spec=0.8, coat=0.0)
M['carpet'] = noisy(principled('carpet', (0.36, 0.32, 0.27), rough=1.0, spec=0.2, sheen=0.3), scale=40, detail=3,
                    c0=(0.33, 0.29, 0.245), c1=(0.39, 0.35, 0.29), bump=0.35, bump_scale=420, bump_detail=2)
M['tablew'] = principled('table', (0.82, 0.81, 0.79), rough=0.32, spec=0.5)
M['boucle'] = noisy(principled('boucle', (0.78, 0.76, 0.72), rough=0.95, spec=0.2, sheen=0.6), scale=60, detail=2,
                    c0=(0.74, 0.72, 0.68), c1=(0.82, 0.8, 0.76), bump=0.6, bump_scale=900, bump_detail=1)
M['metal'] = principled('metal', (0.03, 0.03, 0.032), rough=0.32, metallic=1.0)
M['cotton'] = noisy(principled('cotton', (0.02, 0.02, 0.022), rough=0.92, spec=0.25, sheen=0.22), scale=80, detail=2,
                    bump=0.25, bump_scale=600, bump_detail=1)
M['puck'] = principled('puck', (0.015, 0.015, 0.016), rough=0.28, spec=0.5)
M['led'] = emission('led', (1.0, 0.68, 0.36), 28.0) if A.which == 'plate' else principled('led-off', (0.02, 0.02, 0.02), rough=0.5)
M['fixture'] = emission('fixture', (1.0, 0.95, 0.9), 6.0) if A.which == 'plate' else principled('fixture-off', (0.02, 0.02, 0.02), rough=0.5)
M['tvlight'] = emission('tvlight', (1.0, 0.86, 0.22), 7.0)
M['projector'] = emission('projector', (1.0, 0.93, 0.6), 1.0)


def decal(base, image, rect, emissive=0.0, color=(1.0, 0.846, 0.025)):
    """A material whose UV rectangle (u0, v0, u1, v1) carries the image's alpha as a print (or a lit sign)."""
    m = base.copy()
    m.name = base.name + '-logo'
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    out = nt.nodes['Material Output']
    tc = node(nt, 'ShaderNodeTexCoord')
    mp = node(nt, 'ShaderNodeMapping')
    u0, v0, u1, v1 = rect
    mp.inputs['Location'].default_value = (-u0 / (u1 - u0), -v0 / (v1 - v0), 0)
    mp.inputs['Scale'].default_value = (1 / (u1 - u0), 1 / (v1 - v0), 1)
    nt.links.new(tc.outputs['UV'], mp.inputs['Vector'])
    tex = node(nt, 'ShaderNodeTexImage')
    tex.image = bpy.data.images.load(image)
    tex.extension = 'CLIP'
    tex.interpolation = 'Cubic'
    nt.links.new(mp.outputs['Vector'], tex.inputs['Vector'])
    if emissive:
        em = node(nt, 'ShaderNodeEmission')
        em.inputs['Color'].default_value = (*color, 1)
        em.inputs['Strength'].default_value = emissive
        mix = node(nt, 'ShaderNodeMixShader')
        nt.links.new(tex.outputs['Alpha'], mix.inputs['Fac'])
        nt.links.new(p.outputs['BSDF'], mix.inputs[1])
        nt.links.new(em.outputs['Emission'], mix.inputs[2])
        nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])
    else:
        mixc = node(nt, 'ShaderNodeMix')
        mixc.data_type = 'RGBA'
        mixc.inputs['B'].default_value = (*color, 1)
        mixc.inputs['A'].default_value = p.inputs['Base Color'].default_value
        nt.links.new(tex.outputs['Alpha'], mixc.inputs['Factor'])
        nt.links.new(mixc.outputs['Result'], p.inputs['Base Color'])
    return m


# ---------------------------------------------------------------- room
floor = box('floor', -14, 14, -14, WALL_Y, -0.1, 0.0, M['floor'], bevel=0)
wall = box('wall', -14, 14, WALL_Y, WALL_Y + 0.2, 0.0, 6.0, M['wall'], bevel=0)
ceiling = box('ceiling', -14, 14, -14, WALL_Y, 4.6, 4.7, M['ceiling'], bevel=0)

# ---------------------------------------------------------------- booth
c = COUNTER
h = c['h']
box('counter-body', c['x0'] + 0.014, c['x1'] - 0.014, c['y0'] + 0.03, c['y1'], 0.06, h - 0.02, M['black'], bevel=0.003)
box('plinth', c['x0'] + 0.06, c['x1'] - 0.06, c['y0'] + 0.09, c['y1'] - 0.04, 0.0, 0.06, M['black'], bevel=0)
box('counter-top', c['x0'] - 0.015, c['x1'] + 0.015, c['y0'] - 0.01, c['y1'], h - 0.02, h + 0.015, M['top'], bevel=0.006)
pitch = 0.043
sw = 0.034
n = int(((c['x1'] - c['x0'] - 0.028) - sw) / pitch) + 1
span = (n - 1) * pitch + sw
sx0 = BOOTH_X - span / 2
slat = box('slat', sx0, sx0 + sw, c['y0'] + 0.016, c['y0'] + 0.03, 0.066, h - 0.024, M['wood'], bevel=0.0015, segs=2)
arr = slat.modifiers.new('array', 'ARRAY')
arr.count = n
arr.use_relative_offset = False
arr.use_constant_offset = True
arr.constant_offset_displace = (pitch, 0, 0)
slat.modifiers.move(len(slat.modifiers) - 1, 0)
ns = int(((c['y1'] - c['y0'] - 0.03) - sw) / pitch) + 1
for side, (xa, xb) in (('l', (c['x0'], c['x0'] + 0.014)), ('r', (c['x1'] - 0.014, c['x1']))):
    s = box('slat-' + side, xa, xb, c['y0'] + 0.03, c['y0'] + 0.03 + sw, 0.066, h - 0.024, M['wood'], bevel=0.0015, segs=2)
    a2 = s.modifiers.new('array', 'ARRAY')
    a2.count = ns
    a2.use_relative_offset = False
    a2.use_constant_offset = True
    a2.constant_offset_displace = (0, pitch, 0)
    s.modifiers.move(len(s.modifiers) - 1, 0)
# LED line along the plinth, under the counter's front edge
box('led', c['x0'] + 0.07, c['x1'] - 0.07, c['y0'] + 0.08, c['y0'] + 0.09, 0.044, 0.056, M['led'], bevel=0)

# back panel
p = PANEL
box('panel', c['x0'] - 0.02, c['x1'] + 0.02, p['y0'], p['y1'], p['z0'], p['z1'], M['white'], bevel=0.006)

# television
t = TV
bz = 0.012
box('tv-bezel', t['cx'] - t['w'] / 2 - bz, t['cx'] + t['w'] / 2 + bz, p['y0'] - 0.035, p['y0'] - 0.004,
    t['cz'] - t['h'] / 2 - bz, t['cz'] + t['h'] / 2 + bz, M['bezel'], bevel=0.004)
screen_mat = M['tvlight'] if A.which == 'tv' else M['glass']
screen = plane('tv-screen', t['cx'] - t['w'] / 2, t['cx'] + t['w'] / 2, t['cz'] - t['h'] / 2, t['cz'] + t['h'] / 2,
               p['y0'] - 0.0365, screen_mat)

# fascia: posts and the dark box; the wordmark as lit letters on its face
f = FASCIA
post_x = f['w'] / 2 - 0.08
for sx in (-1, 1):
    box('post', BOOTH_X + sx * post_x - 0.012, BOOTH_X + sx * post_x + 0.012, p['y0'] + 0.02, p['y0'] + 0.045,
        p['z1'], f['z0'] + 0.02, M['metal'], bevel=0.002)
box('fascia', BOOTH_X - f['w'] / 2, BOOTH_X + f['w'] / 2, f['y0'], f['y0'] + f['d'], f['z0'], f['z0'] + f['h'], M['black'], bevel=0.006)
logo_w = 1.34
logo_h = logo_w * 1458 / 10820
lz = f['z0'] + f['h'] / 2
sign_mat = decal(M['black'], LOGO, (0, 0, 1, 1), emissive=(5.5 if A.which in ('plate', 'receptor') else 0.0))
if A.which not in ('plate', 'receptor'):
    sign_mat = decal(M['black'], LOGO, (0, 0, 1, 1), emissive=0.0, color=(0.6, 0.5, 0.02))
plane('fascia-logo', BOOTH_X - logo_w / 2, BOOTH_X + logo_w / 2, lz - logo_h / 2, lz + logo_h / 2, f['y0'] - 0.0012, sign_mat)

# merchandise: two neat stacks of folded hoodies, the top one printed with the mark; a charger puck
def hoodie(name, x, y, z, rot, top=False, tilt=0.0):
    pw = 0.13
    mat = decal(M['cotton'], MARK, (0.5 - pw / 0.32 / 2, 0.5 - pw * 552 / 1000 / 0.26 / 2, 0.5 + pw / 0.32 / 2, 0.5 + pw * 552 / 1000 / 0.26 / 2), color=(0.9, 0.78, 0.05)) if top else M['cotton']
    o = box(name, x - 0.16, x + 0.16, y - 0.13, y + 0.13, z, z + 0.048, mat, bevel=0.021, segs=5)
    o.rotation_euler = (math.radians(tilt), 0, rot)
    o.location.z += 0.13 * math.sin(math.radians(tilt))
    # the top face needs UVs for the print: a planar projection from above
    if top:
        import bmesh
        bm = bmesh.new()
        bm.from_mesh(o.data)
        uv = bm.loops.layers.uv.verify()
        for face in bm.faces:
            for loop in face.loops:
                co = loop.vert.co
                loop[uv].uv = ((co.x + 0.16) / 0.32, (co.y + 0.13) / 0.26)
        bm.to_mesh(o.data)
        bm.free()
    return o


ct = h + 0.015
for i, (dx, rot) in enumerate(((0.0, 0.0), (0.004, 0.02), (-0.003, -0.015), (0.002, 0.01))):
    hoodie('hoodie-l%d' % i, -0.66 + dx, 1.17, ct + i * 0.05, rot)
for i, (dx, rot) in enumerate(((0.0, 0.0), (-0.004, -0.02))):
    hoodie('hoodie-r%d' % i, 0.64 + dx, 1.17, ct + i * 0.05, rot + 0.04)
# the top one angled toward the room, its print showing, as a merchandiser would set it
hoodie('hoodie-r2', 0.64, 1.17, ct + 2 * 0.05, 0.03, top=True, tilt=16)
puck = cyl('charger', 0.05, ct, ct + 0.012, 0.36, 1.02, M['puck'], bevel=0.003)

# ---------------------------------------------------------------- the conversation area
import bmesh  # noqa: E402

def rounded_rect(name, x0, x1, y0, y1, z0, z1, r, mat):
    o = box(name, x0, x1, y0, y1, z0, z1, mat, bevel=0)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    edges = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) > 1e-6]
    bmesh.ops.bevel(bm, geom=edges, offset=r, segments=12, affect='EDGES', profile=0.5)
    bm.to_mesh(o.data)
    bm.free()
    mod = o.modifiers.new('edge', 'BEVEL')
    mod.width = 0.004
    mod.segments = 2
    return o


rounded_rect('carpet', -1.45, 3.55, -0.55, 1.95, 0.0, 0.012, 0.55, M['carpet'])

T = TABLE
cyl('table-top', T['r'], T['h'] - 0.03, T['h'], T['x'], T['y'], M['tablew'], bevel=0.008)
cyl('table-col', 0.028, 0.08, T['h'] - 0.03, T['x'], T['y'], M['tablew'])
for k in range(4):
    a = math.radians(45 + 90 * k)
    rod('table-foot', (T['x'], T['y'], 0.16), (T['x'] + 0.3 * math.cos(a), T['y'] + 0.3 * math.sin(a), 0.012), 0.014, M['tablew'])


def chair(name, x, y, face):
    """A bar chair: a round soft seat, a shell back that falls away toward the front, four black legs and a
    foot ring. Local front is -y; `face` turns the chair (degrees)."""
    parts = []
    seat_z = 0.74
    s = cyl(name + '-seat', 0.24, seat_z, seat_z + 0.085, 0, 0, M['boucle'], verts=64, bevel=0.034)
    parts.append(s)
    bm = bmesh.new()
    R0, R1, H0, H1 = 0.205, 0.255, seat_z + 0.06, seat_z + 0.3
    steps = 32
    a0, a1 = math.radians(-32), math.radians(212)
    ring = []
    for i in range(steps + 1):
        a = a0 + (a1 - a0) * i / steps
        side = abs(math.cos(a))  # 0 at the back (90 degrees), 1 at the sides
        top = H1 - 0.09 * side ** 2
        ring.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for (r, z) in ((R0, H0), (R1, H0), (R1, top), (R0, top))])
    for i in range(steps):
        a, b = ring[i], ring[i + 1]
        for j in range(4):
            bm.faces.new((a[j], a[(j + 1) % 4], b[(j + 1) % 4], b[j]))
    bm.faces.new(list(reversed(ring[0])))
    bm.faces.new(ring[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name + '-shell')
    bm.to_mesh(me)
    bm.free()
    sh = bpy.data.objects.new(name + '-shell', me)
    scene.collection.objects.link(sh)
    sh.data.materials.append(M['boucle'])
    sub = sh.modifiers.new('sub', 'SUBSURF')
    sub.levels = 2
    sub.render_levels = 3
    for poly in sh.data.polygons:
        poly.use_smooth = True
    parts.append(sh)
    for k in range(4):
        a = math.radians(45 + 90 * k)
        parts.append(rod(name + '-leg', (0.15 * math.cos(a), 0.15 * math.sin(a), seat_z), (0.245 * math.cos(a), 0.245 * math.sin(a), 0.0), 0.0105, M['metal']))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.206, minor_radius=0.0085, location=(0, 0, 0.3), major_segments=64, minor_segments=12)
    ringo = bpy.context.active_object
    ringo.data.materials.append(M['metal'])
    bpy.ops.object.shade_smooth()
    parts.append(ringo)
    root = bpy.data.objects.new(name, None)
    scene.collection.objects.link(root)
    for o in parts:
        o.parent = root
    root.location = (x, y, 0)
    root.rotation_euler = (0, 0, math.radians(face))
    return root


chair('chair-l', T['x'] - 0.6, T['y'] - 0.1, 62)
chair('chair-r', T['x'] + 0.6, T['y'] - 0.04, -66)

# ---------------------------------------------------------------- light
def spot(name, loc, aim, power, color, size_deg, blend, radius=0.05):
    d = bpy.data.lights.new(name, 'SPOT')
    d.energy = power
    d.color = color
    d.spot_size = math.radians(size_deg)
    d.spot_blend = blend
    d.shadow_soft_size = radius
    o = bpy.data.objects.new(name, d)
    scene.collection.objects.link(o)
    o.location = loc
    look_at(o, aim)
    return o


def area(name, loc, aim, power, color, sx, sy):
    d = bpy.data.lights.new(name, 'AREA')
    d.energy = power
    d.color = color
    d.shape = 'RECTANGLE'
    d.size = sx
    d.size_y = sy
    o = bpy.data.objects.new(name, d)
    scene.collection.objects.link(o)
    o.location = loc
    look_at(o, aim)
    return o


lights = []
if A.which == 'plate':
    washers = (
        (-6.6, (0.32, 0.58, 1.0), 950),
        (-0.15, (1.0, 0.52, 0.2), 900),
        (3.1, (0.6, 0.27, 1.0), 950),
        (5.2, (1.0, 0.84, 0.68), 700),
    )
    for x, col, pw in washers:
        aimz = 2.2 if abs(x) < 1 else 0.4
        lights.append(spot('washer', (x, WALL_Y - 0.7, 4.5), (x, WALL_Y, aimz), pw * 3.2, col, 38 if abs(x) < 1 else 34, 0.55, radius=0.03))
        cyl('fixture', 0.055, 4.5, 4.6, x, WALL_Y - 0.7, M['fixture'])
    lights.append(area('key', (-2.6, -2.9, 3.9), (0.1, 1.1, 1.25), 520, (1.0, 0.92, 0.84), 2.4, 1.4))
    lights.append(area('fill', (4.8, -3.2, 2.6), (1.6, 0.9, 1.0), 120, (0.86, 0.92, 1.0), 2.0, 1.2))
    lights.append(spot('booth-down', (0.0, 0.55, 4.5), (0.0, 1.0, 0.9), 420, (1.0, 0.86, 0.7), 46, 0.7, radius=0.08))
    lights.append(spot('table-down', (T['x'], T['y'] - 0.2, 4.5), (T['x'], T['y'], 0.6), 260, (1.0, 0.86, 0.7), 44, 0.75, radius=0.08))
elif A.which == 'wall':
    # the projection's own light: an emitter over its rectangle, unseen by the camera
    pm = emission('proj', (1.0, 0.9, 0.55), 9.0)
    pnt = pm.node_tree
    geo = node(pnt, 'ShaderNodeNewGeometry')
    em = pnt.nodes['Emission']
    tr = node(pnt, 'ShaderNodeBsdfTransparent')
    mx = node(pnt, 'ShaderNodeMixShader')
    pnt.links.new(geo.outputs['Backfacing'], mx.inputs['Fac'])
    pnt.links.new(em.outputs[0], mx.inputs[1])
    pnt.links.new(tr.outputs[0], mx.inputs[2])
    pnt.links.new(mx.outputs[0], pnt.nodes['Material Output'].inputs['Surface'])
    pr = plane('projection-light', PROJ['x0'], PROJ['x1'], PROJ['z0'], PROJ['z1'], WALL_Y - 0.003, pm)
    pr.visible_camera = False
elif A.which == 'receptor':
    lights.append(area('even', ((PROJ['x0'] + PROJ['x1']) / 2, WALL_Y - 4.0, (PROJ['z0'] + PROJ['z1']) / 2 + 0.4),
                       ((PROJ['x0'] + PROJ['x1']) / 2, WALL_Y, (PROJ['z0'] + PROJ['z1']) / 2), 2600, (1, 1, 1), 6.0, 4.0))
    hold = bpy.data.materials.new('holdout')
    hold.use_nodes = True
    hnt = hold.node_tree
    for nn in list(hnt.nodes):
        hnt.nodes.remove(nn)
    ho = node(hnt, 'ShaderNodeHoldout')
    hout = node(hnt, 'ShaderNodeOutputMaterial')
    hnt.links.new(ho.outputs[0], hout.inputs['Surface'])
    for o in scene.objects:
        if o.type == 'MESH' and o.name not in ('wall',):
            o.data.materials.clear()
            o.data.materials.append(hold)
            o.visible_shadow = False

# ---------------------------------------------------------------- camera
cam_d = bpy.data.cameras.new('cam')
cam_d.lens = CAM['lens']
cam_d.sensor_width = 36
cam_d.sensor_fit = 'HORIZONTAL'
cam = bpy.data.objects.new('cam', cam_d)
scene.collection.objects.link(cam)
cam.location = CAM['loc']
look_at(cam, CAM['aim'])
scene.camera = cam
bpy.context.view_layer.update()


def project(pts):
    out = []
    for q in pts:
        v = world_to_camera_view(scene, cam, Vector(q))
        out.append([round(v.x, 6), round(1 - v.y, 6)])
    return out


y_scr = p['y0'] - 0.0365
geom = {
    'size': [A.w, A.h],
    'tv': project([(t['cx'] - t['w'] / 2, y_scr, t['cz'] + t['h'] / 2), (t['cx'] + t['w'] / 2, y_scr, t['cz'] + t['h'] / 2),
                   (t['cx'] + t['w'] / 2, y_scr, t['cz'] - t['h'] / 2), (t['cx'] - t['w'] / 2, y_scr, t['cz'] - t['h'] / 2)]),
    'wall': project([(PROJ['x0'], WALL_Y, PROJ['z1']), (PROJ['x1'], WALL_Y, PROJ['z1']), (PROJ['x1'], WALL_Y, PROJ['z0']), (PROJ['x0'], WALL_Y, PROJ['z0'])]),
    'note': 'Corners top-left, top-right, bottom-right, bottom-left, as shares of the frame (x right, y down).',
}
if A.geom:
    with open(A.geom, 'w') as fh:
        json.dump(geom, fh, indent=1)

if A.blend:
    bpy.ops.wm.save_as_mainfile(filepath=A.blend)

if A.crop:
    x0, y0, x1, y1 = (float(v) for v in A.crop.split(','))
    scene.render.use_border = True
    scene.render.use_crop_to_border = True
    scene.render.border_min_x, scene.render.border_max_x = x0, x1
    scene.render.border_min_y, scene.render.border_max_y = 1 - y1, 1 - y0
scene.render.filepath = A.out
if A.exr:
    scene.render.image_settings.file_format = 'OPEN_EXR'
    scene.render.image_settings.color_depth = '16'
else:
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA' if A.which == 'receptor' else 'RGB'
    scene.render.image_settings.color_depth = '16'
if A.norender:
    for o in scene.objects:
        if o.name.startswith('hoodie'):
            ws = [o.matrix_world @ Vector(v) for v in o.bound_box]
            print(o.name, 'z', round(min(v.z for v in ws), 3), round(max(v.z for v in ws), 3), 'y', round(min(v.y for v in ws), 3), round(max(v.y for v in ws), 3), 'loc', tuple(round(c, 3) for c in o.location))
    sys.exit(0)
bpy.ops.render.render(write_still=True)
print('rendered', A.which, A.out)

# ---------------------------------------------------------------- usage
# Blender 5.2 as a Python module (pip install bpy), Cycles on the CPU:
#   python activation-booth.py -- --pass plate --w 2560 --h 1280 --samples 96 --out plate.png --geom geom.json
#   python activation-booth.py -- --pass tv --w 1280 --h 640 --samples 64 --out tv.png
#   python activation-booth.py -- --pass wall --w 1280 --h 640 --samples 64 --out wall.png
#   python activation-booth.py -- --pass receptor --w 1280 --h 640 --samples 32 --out receptor.png
# then activation-composite.py writes the page's layers and the static render.
# The textures in tex/ are made from the SVG with any rasterizer that keeps
# its proportions (the build used Chromium): bolt-yellow-4096.png at 4096 by
# 552 px with a transparent ground, and bolt-mark-1000.png, its left 1000 px.
