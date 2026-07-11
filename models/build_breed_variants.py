#!/usr/bin/env python3
"""Derive golden retriever and hot-dog-styled dachshund .glb models from a
base dog .vox file (a MagicaVoxel-edited version of the terrier shape from
voxelize_terrier.py — same axis convention: width=dim0, height=dim1,
length=dim2, nose at low length-index).

Usage:
    python3 build_breed_variants.py base.vox golden.glb dachshund.glb

Golden retriever: recolor only (golden coat, warmer dark accents), same
geometry as the source.

Dachshund: recolors to a hot-dog-bun palette (tan body, mustard stripe
down the spine), stretches the torso length-wise (STRETCH), and shortens
the legs (LEG_SCALE) by compressing the low-height voxels and dropping
the rest of the body down to meet them — tune TORSO_START/TORSO_END/
LEG_HEIGHT if you start from a differently-proportioned base file (these
were picked from this project's terrier shape's own layout).

Both outputs use adjacency-based face culling (skip faces between two
solid voxels — they're never visible) to keep file size reasonable; a
naive per-voxel cube export was ~4.7MB per model, this gets it to
~350KB.
"""
import struct, sys, json

def read_chunk(f):
    cid = f.read(4).decode('ascii')
    content_size, children_size = struct.unpack('<ii', f.read(8))
    content = f.read(content_size)
    children_end = f.tell() + children_size
    children = []
    while f.tell() < children_end:
        children.append(read_chunk(f))
    return {'id': cid, 'content': content, 'children': children}

def load_vox(path):
    with open(path, 'rb') as f:
        f.read(4); f.read(4)
        main = read_chunk(f)
    models = []
    palette = None
    for ch in main['children']:
        if ch['id'] == 'SIZE':
            x, y, z = struct.unpack('<iii', ch['content'])
            models.append({'size': (x, y, z), 'voxels': []})
        elif ch['id'] == 'XYZI':
            n, = struct.unpack_from('<i', ch['content'], 0)
            voxels = []
            off = 4
            for _ in range(n):
                vx, vy, vz, vc = ch['content'][off:off+4]
                voxels.append((vx, vy, vz, vc))
                off += 4
            models[-1]['voxels'] = voxels
        elif ch['id'] == 'RGBA':
            palette = [struct.unpack_from('<4B', ch['content'], i*4) for i in range(256)]
    real = max(models, key=lambda m: len(m['voxels']))
    return real['voxels'], real['size'], palette

FACES = [
    ((1,0,0),  (1,0,0),  [(1,0,0),(1,1,0),(1,1,1),(1,0,1)]),
    ((-1,0,0), (-1,0,0), [(0,0,1),(0,1,1),(0,1,0),(0,0,0)]),
    ((0,1,0),  (0,1,0),  [(0,1,0),(0,1,1),(1,1,1),(1,1,0)]),
    ((0,-1,0), (0,-1,0), [(0,0,1),(0,0,0),(1,0,0),(1,0,1)]),
    ((0,0,1),  (0,0,1),  [(1,0,1),(1,1,1),(0,1,1),(0,0,1)]),
    ((0,0,-1), (0,0,-1), [(0,0,0),(0,1,0),(1,1,0),(1,0,0)]),
]

VOXEL_SCALE = 0.035

def build_glb(entries, colors_by_key, out_path, occupied):
    # entries: list of (raw_xyz, engine_xyz, color_key)
    by_color = {}
    for (raw_xyz, engine_xyz, ck) in entries:
        by_color.setdefault(ck, []).append((raw_xyz, engine_xyz))

    materials, accessors, buffer_views, primitives = [], [], [], []
    buffer_bytes = bytearray()

    def add_bv(data, target=None):
        off = len(buffer_bytes)
        buffer_bytes.extend(data)
        while len(buffer_bytes) % 4 != 0:
            buffer_bytes.append(0)
        bv = {"buffer": 0, "byteOffset": off, "byteLength": len(data)}
        if target is not None: bv["target"] = target
        buffer_views.append(bv)
        return len(buffer_views) - 1

    total_faces = 0
    for ck, pts in by_color.items():
        positions, normals, indices = [], [], []
        vcount = 0
        for (raw_xyz, (ex, ey, ez)) in pts:
            rx, ry, rz = raw_xyz
            for normal, offset, corners in FACES:
                neighbor = (rx+offset[0], ry+offset[1], rz+offset[2])
                if neighbor in occupied:
                    continue  # internal face, never visible — skip
                base = vcount
                for (cx, cy, cz) in corners:
                    positions += [ex + cx*VOXEL_SCALE, ey + cy*VOXEL_SCALE, ez + cz*VOXEL_SCALE]
                    normals += [float(normal[0]), float(normal[1]), float(normal[2])]
                indices += [base, base+1, base+2, base, base+2, base+3]
                vcount += 4
                total_faces += 1
        if not positions:
            continue
        pos_bv = add_bv(struct.pack(f'<{len(positions)}f', *positions), 34962)
        norm_bv = add_bv(struct.pack(f'<{len(normals)}f', *normals), 34962)
        idx_bv = add_bv(struct.pack(f'<{len(indices)}I', *indices), 34963)
        xs, ys, zs = positions[0::3], positions[1::3], positions[2::3]
        accessors.append({"bufferView": pos_bv, "componentType": 5126, "count": len(positions)//3,
                           "type": "VEC3", "min": [min(xs),min(ys),min(zs)], "max": [max(xs),max(ys),max(zs)]})
        pos_acc = len(accessors)-1
        accessors.append({"bufferView": norm_bv, "componentType": 5126, "count": len(normals)//3, "type": "VEC3"})
        norm_acc = len(accessors)-1
        accessors.append({"bufferView": idx_bv, "componentType": 5125, "count": len(indices), "type": "SCALAR"})
        idx_acc = len(accessors)-1
        r,g,b = colors_by_key[ck]
        materials.append({"pbrMetallicRoughness": {"baseColorFactor":[r/255,g/255,b/255,1.0],
                           "metallicFactor":0.0,"roughnessFactor":0.9}})
        primitives.append({"attributes":{"POSITION":pos_acc,"NORMAL":norm_acc},
                            "indices":idx_acc,"material":len(materials)-1})

    gltf = {"asset":{"version":"2.0","generator":"build_variants2.py"},"scene":0,
            "scenes":[{"nodes":[0]}],"nodes":[{"mesh":0,"name":"root"}],
            "meshes":[{"primitives":primitives,"name":"dog"}],"materials":materials,
            "accessors":accessors,"bufferViews":buffer_views,
            "buffers":[{"byteLength":len(buffer_bytes)}]}
    json_bytes = json.dumps(gltf).encode('utf8')
    while len(json_bytes)%4!=0: json_bytes += b' '
    while len(buffer_bytes)%4!=0: buffer_bytes.append(0)
    with open(out_path,'wb') as f:
        total = 12+8+len(json_bytes)+8+len(buffer_bytes)
        f.write(struct.pack('<4sII', b'glTF', 2, total))
        f.write(struct.pack('<I4s', len(json_bytes), b'JSON')); f.write(json_bytes)
        f.write(struct.pack('<I4s', len(buffer_bytes), b'BIN\x00')); f.write(bytes(buffer_bytes))
    print(f"wrote {out_path}: {total_faces} faces, {len(materials)} materials, {len(buffer_bytes)} bytes binary")

base_path = sys.argv[1]
voxels_raw, size, palette = load_vox(base_path)
occupied = {(vx,vy,vz) for (vx,vy,vz,c) in voxels_raw}
xs = [v[0] for v in voxels_raw]; ys = [v[1] for v in voxels_raw]; zs = [v[2] for v in voxels_raw]
center_x = (min(xs)+max(xs)+1)/2
center_z = (min(zs)+max(zs)+1)/2
min_y = min(ys)
print(f"source: {len(voxels_raw)} voxels")

BLACK = (28, 23, 18)
CREAM = (243, 233, 214)
ORANGE = (255, 138, 61)

# ============================================================
# GOLDEN RETRIEVER: recolor only, same shape/adjacency as source
# ============================================================
GOLDEN_COAT = (230, 178, 84)
GOLDEN_DARK = (175, 128, 58)
recolor_golden = {1: BLACK, 2: GOLDEN_DARK, 3: GOLDEN_COAT, 4: CREAM, 5: ORANGE}

golden_entries = []
for (vx, vy, vz, c) in voxels_raw:
    ex = (vx - center_x) * VOXEL_SCALE
    ey = (vy - min_y) * VOXEL_SCALE
    ez = (vz - center_z) * VOXEL_SCALE
    golden_entries.append(((vx,vy,vz), (ex,ey,ez), recolor_golden[c]))
colors_map_golden = {v: v for v in set(recolor_golden.values())}
build_glb(golden_entries, colors_map_golden, sys.argv[2], occupied)

# ============================================================
# DACHSHUND + hot dog styling
# ============================================================
BUN = (222, 176, 108)
BUN_DARK = (168, 128, 74)
MUSTARD = (232, 186, 24)
TORSO_START, TORSO_END = 19, 45
LEG_HEIGHT = 9
STRETCH = 1.55
LEG_SCALE = 0.42
recolor_dog = {1: BLACK, 2: BUN_DARK, 3: BUN, 4: CREAM, 5: ORANGE}

LEG_HEIGHT_GROUND = LEG_HEIGHT - min_y  # convert threshold to ground-relative

def reshape(vx, vy, vz):
    if vz < TORSO_START:
        nvz = vz
    elif vz <= TORSO_END:
        nvz = TORSO_START + (vz - TORSO_START) * STRETCH
    else:
        nvz = vz + (TORSO_END - TORSO_START) * (STRETCH - 1)
    gy = vy - min_y  # ground-relative height (0 = lowest voxel in the source)
    leg_gap = LEG_HEIGHT_GROUND - LEG_HEIGHT_GROUND * LEG_SCALE
    nvy = gy * LEG_SCALE if gy < LEG_HEIGHT_GROUND else gy - leg_gap
    return nvy, nvz

# mustard stripe: topmost torso voxel near center width, per length slot
top_at_len = {}
for (vx, vy, vz, c) in voxels_raw:
    if TORSO_START <= vz <= TORSO_END and abs(vx - center_x) <= 2.5 and c == 3:
        if vz not in top_at_len or vy > top_at_len[vz]:
            top_at_len[vz] = vy
stripe_set = {(vx, vy, vz) for (vx, vy, vz, c) in voxels_raw
              if vz in top_at_len and vy == top_at_len[vz] and c == 3 and abs(vx - center_x) <= 2.5}

dachshund_entries = []
for (vx, vy, vz, c) in voxels_raw:
    nvy, nvz = reshape(vx, vy, vz)
    color = MUSTARD if (vx, vy, vz) in stripe_set else recolor_dog[c]
    ex = (vx - center_x) * VOXEL_SCALE
    ey = nvy * VOXEL_SCALE
    ez = (nvz - center_z) * VOXEL_SCALE
    dachshund_entries.append(((vx,vy,vz), (ex,ey,ez), color))
colors_map_dog = {v: v for v in set(recolor_dog.values()) | {MUSTARD}}
build_glb(dachshund_entries, colors_map_dog, sys.argv[3], occupied)
