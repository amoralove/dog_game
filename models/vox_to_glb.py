#!/usr/bin/env python3
"""Convert a MagicaVoxel .vox file into a static .glb for the dog park.

Usage:
    python3 vox_to_glb.py <input.vox> <output.glb> <voxel_scale>

Picks the model with the most voxels in the file (skips empty placeholder
models some MagicaVoxel exports include), groups voxels by palette color
into a handful of merged cube meshes (one material per color), and writes
a self-contained .glb.

Axis mapping assumes the standard MagicaVoxel authoring convention (Z-up)
mapped to this project's engine convention (Y-up, dog's nose points -Z):
  vox X -> engine X (centered)
  vox Z (up)     -> engine Y, from the model's lowest voxel
  vox Y (length) -> engine Z, inverted and centered, so the HIGH-Y end
                    of the model becomes the front/nose (-Z). Model the
                    head at the high-Y end in MagicaVoxel, or flip the
                    sign in `oz` below if your model is authored the
                    other way around.

voxel_scale is world units per voxel. ~0.1 makes an 8-voxel-tall model
about 0.8 units tall, comparable to this project's procedural dogs
(see models/README.md for the target scale/orientation).
"""
import struct
import sys
import json


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
        f.read(4)  # magic
        f.read(4)  # version
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
                vx, vy, vz, vc = ch['content'][off:off + 4]
                voxels.append((vx, vy, vz, vc))
                off += 4
            models[-1]['voxels'] = voxels
        elif ch['id'] == 'RGBA':
            palette = [struct.unpack_from('<4B', ch['content'], i * 4) for i in range(256)]
    return models, palette


# 24-vert hard-edged cube: (normal, 4 corner offsets in [0,1]^3 voxel-local space)
FACES = [
    ((1, 0, 0),  [(1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1)]),
    ((-1, 0, 0), [(0, 0, 1), (0, 1, 1), (0, 1, 0), (0, 0, 0)]),
    ((0, 1, 0),  [(0, 1, 0), (0, 1, 1), (1, 1, 1), (1, 1, 0)]),
    ((0, -1, 0), [(0, 0, 1), (0, 0, 0), (1, 0, 0), (1, 0, 1)]),
    ((0, 0, 1),  [(1, 0, 1), (1, 1, 1), (0, 1, 1), (0, 0, 1)]),
    ((0, 0, -1), [(0, 0, 0), (0, 1, 0), (1, 1, 0), (1, 0, 0)]),
]


def build_glb(voxels, palette, out_path, voxel_scale, center_x, center_z_len, min_up):
    by_color = {}
    for (x, y, z, c) in voxels:
        by_color.setdefault(c, []).append((x, y, z))

    materials, accessors, buffer_views = [], [], []
    primitives = []
    buffer_bytes = bytearray()

    def add_buffer_view(data_bytes, target=None):
        offset = len(buffer_bytes)
        buffer_bytes.extend(data_bytes)
        while len(buffer_bytes) % 4 != 0:
            buffer_bytes.append(0)
        bv = {"buffer": 0, "byteOffset": offset, "byteLength": len(data_bytes)}
        if target is not None:
            bv["target"] = target
        buffer_views.append(bv)
        return len(buffer_views) - 1

    for color_idx, vox_list in by_color.items():
        positions, normals, indices = [], [], []
        vcount = 0
        for (vx, vy, vz) in vox_list:
            ox = (vx - center_x) * voxel_scale
            oy = (vz - min_up) * voxel_scale
            oz = -(vy - center_z_len) * voxel_scale
            for normal, corners in FACES:
                base = vcount
                for (cx, cy, cz) in corners:
                    positions += [ox + cx * voxel_scale, oy + cy * voxel_scale, oz + cz * voxel_scale]
                    normals += [float(normal[0]), float(normal[1]), float(normal[2])]
                indices += [base, base + 1, base + 2, base, base + 2, base + 3]
                vcount += 4

        pos_bv = add_buffer_view(struct.pack(f'<{len(positions)}f', *positions), 34962)
        norm_bv = add_buffer_view(struct.pack(f'<{len(normals)}f', *normals), 34962)
        idx_bv = add_buffer_view(struct.pack(f'<{len(indices)}H', *indices), 34963)

        xs, ys, zs = positions[0::3], positions[1::3], positions[2::3]
        accessors.append({"bufferView": pos_bv, "componentType": 5126, "count": len(positions) // 3,
                           "type": "VEC3", "min": [min(xs), min(ys), min(zs)], "max": [max(xs), max(ys), max(zs)]})
        pos_acc = len(accessors) - 1
        accessors.append({"bufferView": norm_bv, "componentType": 5126, "count": len(normals) // 3, "type": "VEC3"})
        norm_acc = len(accessors) - 1
        accessors.append({"bufferView": idx_bv, "componentType": 5123, "count": len(indices), "type": "SCALAR"})
        idx_acc = len(accessors) - 1

        r, g, b, a = palette[color_idx - 1]
        materials.append({"pbrMetallicRoughness": {
            "baseColorFactor": [r / 255, g / 255, b / 255, 1.0],
            "metallicFactor": 0.0, "roughnessFactor": 0.9}})
        primitives.append({"attributes": {"POSITION": pos_acc, "NORMAL": norm_acc},
                            "indices": idx_acc, "material": len(materials) - 1})

    gltf = {
        "asset": {"version": "2.0", "generator": "vox_to_glb.py"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "root"}],
        "meshes": [{"primitives": primitives, "name": "dog"}],
        "materials": materials,
        "accessors": accessors,
        "bufferViews": buffer_views,
        "buffers": [{"byteLength": len(buffer_bytes)}],
    }

    json_bytes = json.dumps(gltf).encode('utf8')
    while len(json_bytes) % 4 != 0:
        json_bytes += b' '
    while len(buffer_bytes) % 4 != 0:
        buffer_bytes.append(0)

    with open(out_path, 'wb') as f:
        total_len = 12 + 8 + len(json_bytes) + 8 + len(buffer_bytes)
        f.write(struct.pack('<4sII', b'glTF', 2, total_len))
        f.write(struct.pack('<I4s', len(json_bytes), b'JSON'))
        f.write(json_bytes)
        f.write(struct.pack('<I4s', len(buffer_bytes), b'BIN\x00'))
        f.write(bytes(buffer_bytes))

    print(f"wrote {out_path}: {len(voxels)} voxels, {len(materials)} materials, {len(buffer_bytes)} bytes binary")


if __name__ == '__main__':
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(1)
    vox_path, out_path, voxel_scale = sys.argv[1], sys.argv[2], float(sys.argv[3])
    models, palette = load_vox(vox_path)
    real = max(models, key=lambda m: len(m['voxels']))
    voxels = real['voxels']
    xs = [v[0] for v in voxels]
    ys = [v[1] for v in voxels]
    zs = [v[2] for v in voxels]
    center_x = (min(xs) + max(xs) + 1) / 2
    center_z_len = (min(ys) + max(ys) + 1) / 2
    min_up = min(zs)
    build_glb(voxels, palette, out_path, voxel_scale, center_x, center_z_len, min_up)
