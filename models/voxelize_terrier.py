#!/usr/bin/env python3
"""Rasterize the procedural terrier dog (LOOK_PROFILES["🐕"] / buildDogMesh
default profile, from app.js) into a MagicaVoxel .vox file.

This mirrors the exact box positions/sizes/colors/rotations from
buildDogMesh() + addEars("perked") in app.js at rest pose, so the output
is a faithful voxel version of what's currently rendered procedurally.
"""
import struct
import math
import sys

VOXEL = 0.035  # world units per voxel — tune for more/less detail

def euler_xyz_matrix(x, y, z):
    """Three.js Matrix4.makeRotationFromEuler, order 'XYZ', as a 3x3
    row-major matrix R such that world_v = R @ local_v."""
    a, b = math.cos(x), math.sin(x)
    c, d = math.cos(y), math.sin(y)
    e, f = math.cos(z), math.sin(z)
    ae, af, be, bf = a*e, a*f, b*e, b*f
    # three.js te[] is column-major; build row-major R directly (R[row][col])
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

IDENTITY = [[1,0,0],[0,1,0],[0,0,1]]

# --- Colors (matching app.js materials for the default "🐕" terrier profile) ---
COAT = (0xc9, 0x97, 0x5b)
def shade(rgb, amount):
    return tuple(min(255, int(c * amount)) for c in rgb)
DARK = shade(COAT, 0.55)
PAW = (0xf3, 0xe9, 0xd6)
COLLAR = (0xff, 0x8a, 0x3d)
NOSE = (0x1c, 0x17, 0x12)
EYE = (0x1c, 0x17, 0x12)
EYE_WHITE = (0xf5, 0xf0, 0xe6)

# --- Geometry: terrier profile, all multipliers = 1, legLength = 0.32, bodyY = 0.5 ---
legLength = 0.32
bodyY = legLength + 0.18  # 0.5

boxes = []  # each: (center, half_extents, rotation_matrix, color)

def add_box(center, size, color, rot=IDENTITY):
    he = (size[0]/2, size[1]/2, size[2]/2)
    boxes.append((center, he, rot, color))

# Torso
add_box((0, bodyY + 0.01, -0.22), (0.52, 0.38, 0.5), COAT)
add_box((0, bodyY, 0.24), (0.46, 0.34, 0.46), COAT)
add_box((0, bodyY - 0.19, 0), (0.4, 0.1, 0.7), DARK)

# Head group (position offset, scale=1 for terrier headMul=1)
head_pos = (0, bodyY + 0.32, -(0.22 + 0.36))
add_box(add(head_pos, (0,0,0)), (0.42, 0.38, 0.4), COAT)
add_box(add(head_pos, (0, -0.09, -0.34)), (0.22, 0.17, 0.32), DARK)
add_box(add(head_pos, (0, -0.08, -0.49)), (0.1, 0.09, 0.06), NOSE)
for side in (-0.12, 0.12):
    add_box(add(head_pos, (side, 0.06, -0.185)), (0.09, 0.08, 0.02), EYE_WHITE)
    add_box(add(head_pos, (side, 0.05, -0.2)), (0.05, 0.05, 0.03), EYE)

# Ears ("perked" style)
ear = {"w": 0.11, "h": 0.22, "hingeY": 0.23, "hingeX": 0.18, "tiltZ": 0.25, "tiltX": -0.05}
for side in (-1, 1):
    pivot_pos = add(head_pos, (side * ear["hingeX"], ear["hingeY"], 0.03))
    R = euler_xyz_matrix(ear["tiltX"], 0, side * ear["tiltZ"])
    ear_local = (0, -ear["h"] / 2, 0)
    ear_center = add(pivot_pos, mat_vec(R, ear_local))
    add_box(ear_center, (ear["w"], ear["h"], 0.06), DARK, rot=R)

# Collar
add_box((0, bodyY + 0.19, -0.42), (0.42, 0.09, 0.46), COLLAR)

# Tail
tail_pivot_pos = (0, bodyY + 0.14, 0.45)
tail_local = (0, 0, 0.2)
tail_center = add(tail_pivot_pos, tail_local)  # tailPivot has no rotation
Rtail = euler_xyz_matrix(-0.5, 0, 0)
add_box(tail_center, (0.1, 0.1, 0.4), DARK, rot=Rtail)
tail_tip_center = add(tail_center, mat_vec(Rtail, (0, 0, 0.24)))
add_box(tail_tip_center, (0.13, 0.13, 0.13), PAW)

# Legs + paws
leg_positions = [(-0.17, -0.32), (0.17, -0.32), (-0.17, 0.32), (0.17, 0.32)]
for lx, lz in leg_positions:
    pivot_pos = (lx, legLength + 0.16, lz)
    add_box(add(pivot_pos, (0, -legLength * 0.35, 0)), (0.13, legLength * 0.7, 0.13), DARK)
    add_box(add(pivot_pos, (0, -legLength * 0.75, 0)), (0.15, legLength * 0.3, 0.16), PAW)

print(f"{len(boxes)} boxes defined")

# --- Rasterize into a voxel grid ---
all_x, all_y, all_z = [], [], []
for (c, he, rot, color) in boxes:
    # conservative AABB: use the box's own diagonal as a bound regardless of rotation
    r = math.sqrt(he[0]**2 + he[1]**2 + he[2]**2)
    all_x += [c[0] - r, c[0] + r]
    all_y += [c[1] - r, c[1] + r]
    all_z += [c[2] - r, c[2] + r]
min_x, max_x = min(all_x), max(all_x)
min_y, max_y = max(0, min(all_y)), max(all_y)
min_z, max_z = min(all_z), max(all_z)

nx = int(math.ceil((max_x - min_x) / VOXEL)) + 2
ny = int(math.ceil((max_y - min_y) / VOXEL)) + 2
nz = int(math.ceil((max_z - min_z) / VOXEL)) + 2
print(f"grid: {nx} x {ny} x {nz}")

voxels = {}  # (vx,vy,vz) -> color tuple; later boxes win on overlap (paint order)
for (c, he, rot, color) in boxes:
    Rt = rot  # world_v = R @ local_v  =>  local_v = R^T @ world_v
    # iterate only the box's own local AABB in world grid steps (bounded by its rotated extent)
    r = math.sqrt(he[0]**2 + he[1]**2 + he[2]**2)
    gx0 = int(math.floor((c[0] - r - min_x) / VOXEL))
    gx1 = int(math.ceil((c[0] + r - min_x) / VOXEL))
    gy0 = int(math.floor((c[1] - r - min_y) / VOXEL))
    gy1 = int(math.ceil((c[1] + r - min_y) / VOXEL))
    gz0 = int(math.floor((c[2] - r - min_z) / VOXEL))
    gz1 = int(math.ceil((c[2] + r - min_z) / VOXEL))
    for gx in range(max(0, gx0), min(nx, gx1 + 1)):
        wx = min_x + (gx + 0.5) * VOXEL
        for gy in range(max(0, gy0), min(ny, gy1 + 1)):
            wy = min_y + (gy + 0.5) * VOXEL
            for gz in range(max(0, gz0), min(nz, gz1 + 1)):
                wz = min_z + (gz + 0.5) * VOXEL
                lv = mat_transpose_vec(Rt, (wx - c[0], wy - c[1], wz - c[2]))
                if abs(lv[0]) <= he[0] and abs(lv[1]) <= he[1] and abs(lv[2]) <= he[2]:
                    voxels[(gx, gy, gz)] = color

print(f"{len(voxels)} voxels")

# --- Write .vox (legacy simple format: MAIN > SIZE, XYZI, RGBA) ---
def write_vox(path, voxels, nx, ny, nz):
    colors = sorted(set(voxels.values()))
    color_index = {c: i + 1 for i, c in enumerate(colors)}  # palette index 1..N

    size_chunk = struct.pack('<iii', nx, ny, nz)
    xyzi_entries = b''.join(
        struct.pack('<4B', vx, vy, vz, color_index[c])
        for (vx, vy, vz), c in voxels.items()
    )
    xyzi_chunk = struct.pack('<i', len(voxels)) + xyzi_entries

    # RGBA palette: MagicaVoxel's default palette convention is
    # palette[i] used for index i+1 (index 0 = empty), 256 entries.
    palette = [(0, 0, 0, 0)] * 256
    for c, idx in color_index.items():
        palette[idx - 1] = (c[0], c[1], c[2], 255)
    rgba_chunk = b''.join(struct.pack('<4B', *p) for p in palette)

    def chunk(cid, content, children=b''):
        return cid.encode('ascii') + struct.pack('<ii', len(content), len(children)) + content + children

    main_children = (
        chunk('SIZE', size_chunk) +
        chunk('XYZI', xyzi_chunk) +
        chunk('RGBA', rgba_chunk)
    )
    main = chunk('MAIN', b'', main_children)

    with open(path, 'wb') as f:
        f.write(b'VOX ')
        f.write(struct.pack('<i', 150))
        f.write(main)
    print(f"wrote {path}")

out_path = sys.argv[1] if len(sys.argv) > 1 else 'terrier.vox'
write_vox(out_path, voxels, nx, ny, nz)
