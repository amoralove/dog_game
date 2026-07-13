#!/usr/bin/env python3
"""Rasterize any LOOK_PROFILES entry's procedural geometry (buildDogMesh()
+ addEars(), from app.js) into a MagicaVoxel .vox file — generalized
version of voxelize_terrier.py that takes the breed's shape multipliers
instead of hardcoding the terrier's.
"""
import struct
import math
import sys

VOXEL = 0.035

def euler_xyz_matrix(x, y, z):
    a, b = math.cos(x), math.sin(x)
    c, d = math.cos(y), math.sin(y)
    e, f = math.cos(z), math.sin(z)
    ae, af, be, bf = a*e, a*f, b*e, b*f
    return [
        [c*e,          -c*f,         d   ],
        [af+be*d,      ae-bf*d,      -b*c],
        [bf-ae*d,      be+af*d,      a*c ],
    ]

def mat_vec(m, v):
    return (
        m[0][0]*v[0] + m[0][1]*v[1] + m[0][2]*v[2],
        m[1][0]*v[0] + m[1][1]*v[1] + m[1][2]*v[2],
        m[2][0]*v[0] + m[2][1]*v[1] + m[2][2]*v[2],
    )

def mat_transpose_vec(m, v):
    return (
        m[0][0]*v[0] + m[1][0]*v[1] + m[2][0]*v[2],
        m[0][1]*v[0] + m[1][1]*v[1] + m[2][1]*v[2],
        m[0][2]*v[0] + m[1][2]*v[1] + m[2][2]*v[2],
    )

def add(a, b):
    return (a[0]+b[0], a[1]+b[1], a[2]+b[2])

def scale3(v, s):
    return (v[0]*s, v[1]*s, v[2]*s)

IDENTITY = [[1,0,0],[0,1,0],[0,0,1]]

PAW_COLOR = (0xf3, 0xe9, 0xd6)
COLLAR_COLOR = (0xff, 0x8a, 0x3d)
NOSE_COLOR = (0x1c, 0x17, 0x12)
EYE_COLOR = (0x1c, 0x17, 0x12)
EYE_WHITE = (0xf5, 0xf0, 0xe6)

EAR_STYLES = {
    "small-round": {"w": 0.09, "h": 0.11, "hingeY": 0.24, "hingeX": 0.15, "tiltZ": 0.15, "tiltX": 0},
    "floppy-small": {"w": 0.1, "h": 0.24, "hingeY": 0.27, "hingeX": 0.18, "tiltZ": 0.55, "tiltX": 0.25},
    "floppy-large": {"w": 0.13, "h": 0.3, "hingeY": 0.29, "hingeX": 0.2, "tiltZ": 0.65, "tiltX": 0.3},
    "perked-large": {"w": 0.12, "h": 0.28, "hingeY": 0.26, "hingeX": 0.19, "tiltZ": 0.12, "tiltX": -0.05},
    "perked": {"w": 0.11, "h": 0.22, "hingeY": 0.23, "hingeX": 0.18, "tiltZ": 0.25, "tiltX": -0.05},
}

def shade(rgb, amount):
    return tuple(min(255, int(c * amount)) for c in rgb)

def build_boxes(profile):
    """Returns list of (center, size, color, rotation_matrix)."""
    boxes = []
    def add_box(center, size, color, rot=IDENTITY):
        boxes.append((center, size, color, rot))

    coat = profile["coat"]
    dark = shade(coat, 0.55)
    legLength = 0.32 * profile["legMul"]
    bodyY = legLength + 0.18
    bw, bh, bl = profile["bodyWidMul"], profile["bodyHeightMul"], profile["bodyLenMul"]
    headMul = profile["headMul"]

    add_box((0, bodyY + 0.01, -0.22*bl), (0.52*bw, 0.38*bh, 0.5*bl), coat)
    add_box((0, bodyY, 0.24*bl), (0.46*bw, 0.34*bh, 0.46*bl), coat)
    add_box((0, bodyY - 0.19, 0), (0.4*bw, 0.1, 0.7*bl), dark)

    head_pos = (0, bodyY + 0.32, -(0.22*bl + 0.36))
    def head_world(local_offset):
        return add(head_pos, scale3(local_offset, headMul))
    def head_size(size):
        return scale3(size, headMul)

    add_box(head_world((0,0,0)), head_size((0.42, 0.38, 0.4)), coat)
    add_box(head_world((0, -0.09, -0.34)), head_size((0.22, 0.17, 0.32)), dark)
    add_box(head_world((0, -0.08, -0.49)), head_size((0.1, 0.09, 0.06)), NOSE_COLOR)
    for side in (-0.12, 0.12):
        add_box(head_world((side, 0.06, -0.185)), head_size((0.09, 0.08, 0.02)), EYE_WHITE)
        add_box(head_world((side, 0.05, -0.2)), head_size((0.05, 0.05, 0.03)), EYE_COLOR)

    ear = EAR_STYLES.get(profile["earStyle"], EAR_STYLES["perked"])
    for side in (-1, 1):
        pivot_local = (side * ear["hingeX"], ear["hingeY"], 0.03)
        R = euler_xyz_matrix(ear["tiltX"], 0, side * ear["tiltZ"])
        ear_local_in_pivot = (0, -ear["h"] / 2, 0)
        pivot_world = head_world(pivot_local)
        ear_center = add(pivot_world, scale3(mat_vec(R, ear_local_in_pivot), headMul))
        add_box(ear_center, head_size((ear["w"], ear["h"], 0.06)), dark, rot=R)

    if profile["furry"]:
        poof_offsets = [(0, 0.24, -0.02), (-0.1, 0.19, -0.11), (0.1, 0.19, -0.11), (0, 0.19, -0.22)]
        for off in poof_offsets:
            add_box(head_world(off), head_size((0.15, 0.15, 0.15)), coat)

    add_box((0, bodyY + 0.19, -0.42*bl), (0.42*bw, 0.09, 0.46), COLLAR_COLOR)

    tail_pivot_pos = (0, bodyY + 0.14, 0.45*bl)
    tail_local = (0, 0, 0.2)
    tail_center = add(tail_pivot_pos, tail_local)
    Rtail = euler_xyz_matrix(-0.5, 0, 0)
    add_box(tail_center, (0.1, 0.1, 0.4), dark, rot=Rtail)
    tip_size = 0.19 if profile["furry"] else 0.13
    tip_color = coat if profile["furry"] else PAW_COLOR
    tail_tip_center = add(tail_center, mat_vec(Rtail, (0, 0, 0.24)))
    add_box(tail_tip_center, (tip_size, tip_size, tip_size), tip_color)

    leg_positions = [(-0.17*bw, -0.32*bl), (0.17*bw, -0.32*bl), (-0.17*bw, 0.32*bl), (0.17*bw, 0.32*bl)]
    for lx, lz in leg_positions:
        pivot_pos = (lx, legLength + 0.16, lz)
        add_box(add(pivot_pos, (0, -legLength*0.35, 0)), (0.13, legLength*0.7, 0.13), dark)
        add_box(add(pivot_pos, (0, -legLength*0.75, 0)), (0.15, legLength*0.3, 0.16), PAW_COLOR)

    return boxes

def voxelize(boxes, out_path):
    all_x, all_y, all_z = [], [], []
    for (c, size, color, rot) in boxes:
        he = (size[0]/2, size[1]/2, size[2]/2)
        r = math.sqrt(he[0]**2 + he[1]**2 + he[2]**2)
        all_x += [c[0]-r, c[0]+r]; all_y += [c[1]-r, c[1]+r]; all_z += [c[2]-r, c[2]+r]
    min_x, max_x = min(all_x), max(all_x)
    min_y, max_y = max(0, min(all_y)), max(all_y)
    min_z, max_z = min(all_z), max(all_z)

    nx = int(math.ceil((max_x-min_x)/VOXEL)) + 2
    ny = int(math.ceil((max_y-min_y)/VOXEL)) + 2
    nz = int(math.ceil((max_z-min_z)/VOXEL)) + 2

    voxels = {}
    for (c, size, color, rot) in boxes:
        he = (size[0]/2, size[1]/2, size[2]/2)
        r = math.sqrt(he[0]**2 + he[1]**2 + he[2]**2)
        gx0 = int(math.floor((c[0]-r-min_x)/VOXEL)); gx1 = int(math.ceil((c[0]+r-min_x)/VOXEL))
        gy0 = int(math.floor((c[1]-r-min_y)/VOXEL)); gy1 = int(math.ceil((c[1]+r-min_y)/VOXEL))
        gz0 = int(math.floor((c[2]-r-min_z)/VOXEL)); gz1 = int(math.ceil((c[2]+r-min_z)/VOXEL))
        for gx in range(max(0,gx0), min(nx,gx1+1)):
            wx = min_x + (gx+0.5)*VOXEL
            for gy in range(max(0,gy0), min(ny,gy1+1)):
                wy = min_y + (gy+0.5)*VOXEL
                for gz in range(max(0,gz0), min(nz,gz1+1)):
                    wz = min_z + (gz+0.5)*VOXEL
                    lv = mat_transpose_vec(rot, (wx-c[0], wy-c[1], wz-c[2]))
                    if abs(lv[0]) <= he[0] and abs(lv[1]) <= he[1] and abs(lv[2]) <= he[2]:
                        voxels[(gx,gy,gz)] = color

    def write_vox(path, voxels, nx, ny, nz):
        colors = sorted(set(voxels.values()))
        color_index = {c: i+1 for i, c in enumerate(colors)}
        size_chunk = struct.pack('<iii', nx, ny, nz)
        xyzi_entries = b''.join(struct.pack('<4B', vx, vy, vz, color_index[c]) for (vx,vy,vz), c in voxels.items())
        xyzi_chunk = struct.pack('<i', len(voxels)) + xyzi_entries
        palette = [(0,0,0,0)]*256
        for c, idx in color_index.items():
            palette[idx-1] = (c[0], c[1], c[2], 255)
        rgba_chunk = b''.join(struct.pack('<4B', *p) for p in palette)
        def chunk(cid, content, children=b''):
            return cid.encode('ascii') + struct.pack('<ii', len(content), len(children)) + content + children
        main_children = chunk('SIZE', size_chunk) + chunk('XYZI', xyzi_chunk) + chunk('RGBA', rgba_chunk)
        main = chunk('MAIN', b'', main_children)
        with open(path, 'wb') as f:
            f.write(b'VOX '); f.write(struct.pack('<i', 150)); f.write(main)
        print(f"wrote {path}: size=({nx},{ny},{nz}) voxels={len(voxels)}")

    write_vox(out_path, voxels, nx, ny, nz)

PROFILES = {
    "terrier": {
        "coat": (0xc9,0x97,0x5b), "legMul": 1, "bodyLenMul": 1, "bodyWidMul": 1, "bodyHeightMul": 1,
        "headMul": 1, "earStyle": "perked", "furry": False,
    },
    "puppy": {
        "coat": (0xe0,0xb4,0x67), "legMul": 0.72, "bodyLenMul": 0.82, "bodyWidMul": 0.85, "bodyHeightMul": 0.85,
        "headMul": 1.28, "earStyle": "small-round", "furry": False,
    },
    "poodle": {
        "coat": (0xf2,0xed,0xe1), "legMul": 1.15, "bodyLenMul": 0.95, "bodyWidMul": 0.9, "bodyHeightMul": 0.95,
        "headMul": 1, "earStyle": "floppy-small", "furry": True,
    },
    "labrador": {
        "coat": (0x4a,0x35,0x27), "legMul": 1.1, "bodyLenMul": 1.15, "bodyWidMul": 1.15, "bodyHeightMul": 1.1,
        "headMul": 1.05, "earStyle": "floppy-large", "furry": False,
    },
    "shepherd": {
        "coat": (0x2b,0x2b,0x2b), "legMul": 1.2, "bodyLenMul": 1.1, "bodyWidMul": 0.92, "bodyHeightMul": 0.95,
        "headMul": 0.95, "earStyle": "perked-large", "furry": False,
    },
    # Mirrors of LOOK_PROFILES["🌭"] / ["🦴"] in app.js — these breeds
    # already render from a hand-edited base.vox derivative in the app
    # (models/dachshund.glb, models/golden.glb), not from this script's
    # output. This is a *second*, independently-generated design built
    # straight from the same shape multipliers the procedural fallback
    # uses, in case you want a from-scratch alternative to sculpt from
    # instead of the hand-edited one.
    "dachshund": {
        "coat": (0xde,0xb0,0x6c), "legMul": 0.55, "bodyLenMul": 1.5, "bodyWidMul": 0.85, "bodyHeightMul": 0.8,
        "headMul": 0.9, "earStyle": "floppy-small", "furry": False,
    },
    "golden": {
        "coat": (0xe6,0xb2,0x54), "legMul": 1.1, "bodyLenMul": 1.1, "bodyWidMul": 1.1, "bodyHeightMul": 1.05,
        "headMul": 1, "earStyle": "floppy-large", "furry": False,
    },
    # Not a LOOK_PROFILES entry in app.js (no husky look exists yet) —
    # added on request. Athletic medium build, wedge-shaped head, alert
    # upright ears, classic gray-and-white coat. If a husky look gets
    # added to the app, keep this in sync the same manual way as the rest.
    "husky": {
        "coat": (0xa8,0xb0,0xb8), "legMul": 1.05, "bodyLenMul": 1, "bodyWidMul": 1, "bodyHeightMul": 1,
        "headMul": 0.95, "earStyle": "perked", "furry": False,
    },
}

if __name__ == '__main__':
    name = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else f"{name}.vox"
    profile = PROFILES[name]
    boxes = build_boxes(profile)
    print(f"{name}: {len(boxes)} boxes")
    voxelize(boxes, out_path)
