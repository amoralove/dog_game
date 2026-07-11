import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// --- Mock "shelter listings" seeded on first load ---
const SEED_DOGS = [
  { name: "Biscuit", breed: "Terrier mix", age: "2 years", emoji: "🐕",
    shelter: "Second Chance Rescue", bio: "Loves belly rubs and long naps in sunbeams.",
    url: "https://example.com/dogs/biscuit" },
  { name: "Luna", breed: "Lab mix", age: "4 years", emoji: "🦮",
    shelter: "Harbor Paws Shelter", bio: "A steady, gentle soul who adores kids.",
    url: "https://example.com/dogs/luna" },
  { name: "Peanut", breed: "Chihuahua mix", age: "6 months", emoji: "🐶",
    shelter: "Little Paws Rescue", bio: "Tiny body, enormous personality.",
    url: "https://example.com/dogs/peanut" },
  { name: "Coco", breed: "Poodle mix", age: "3 years", emoji: "🐩",
    shelter: "Fluff & Ruff Rescue", bio: "Fancy on the outside, goofball on the inside.",
    url: "https://example.com/dogs/coco" },
  { name: "Duke", breed: "Shepherd mix", age: "5 years", emoji: "🐕‍🦺",
    shelter: "Second Chance Rescue", bio: "A working dog looking for a job to do — and a couch to nap on after.",
    url: "https://example.com/dogs/duke" },
  { name: "Noodle", breed: "Dachshund", age: "3 years", emoji: "🌭",
    shelter: "Long & Low Rescue", bio: "All legs are optional when you've got this much enthusiasm.",
    url: "https://example.com/dogs/noodle" },
  { name: "Sunny", breed: "Golden Retriever", age: "2 years", emoji: "🦴",
    shelter: "Second Chance Rescue", bio: "Will greet you like you've been gone for ten years.",
    url: "https://example.com/dogs/sunny" },
];

// Shape + color profile per "look" — each breed archetype gets its own
// proportions (leg length, body size, head size, ear style) on top of
// the shared template, so different breeds are visually distinct while
// still built from the same parts and sharing the same accent colors.
const LOOK_PROFILES = {
  "🐕": { // Medium dog / terrier — the baseline proportions
    coat: 0xc9975b, legMul: 1, bodyLenMul: 1, bodyWidMul: 1, bodyHeightMul: 1,
    headMul: 1, earStyle: "perked", furry: false, sizeMul: 1, modelFile: "terrier.glb",
  },
  "🐶": { // Puppy face / toy breed — big head, short legs, small round ears
    coat: 0xe0b467, legMul: 0.72, bodyLenMul: 0.82, bodyWidMul: 0.85, bodyHeightMul: 0.85,
    headMul: 1.28, earStyle: "small-round", furry: false, sizeMul: 0.85, modelFile: "puppy.glb",
  },
  "🐩": { // Curly-coated / poodle — fluffy poofs, longer legs
    coat: 0xf2ede1, legMul: 1.15, bodyLenMul: 0.95, bodyWidMul: 0.9, bodyHeightMul: 0.95,
    headMul: 1, earStyle: "floppy-small", furry: true, sizeMul: 1, modelFile: "poodle.glb",
  },
  "🦮": { // Big & steady / labrador-like — floppy ears, sturdy build
    coat: 0x4a3527, legMul: 1.1, bodyLenMul: 1.15, bodyWidMul: 1.15, bodyHeightMul: 1.1,
    headMul: 1.05, earStyle: "floppy-large", furry: false, sizeMul: 1.1, modelFile: "labrador.glb",
  },
  "🐕‍🦺": { // Working breed / shepherd-like — upright ears, lean and long
    coat: 0x2b2b2b, legMul: 1.2, bodyLenMul: 1.1, bodyWidMul: 0.92, bodyHeightMul: 0.95,
    headMul: 0.95, earStyle: "perked-large", furry: false, sizeMul: 1.05, modelFile: "shepherd.glb",
  },
  "🌭": { // Dachshund, hot-dog styled — long low body, short legs (procedural
          // fallback only; the real look comes from models/dachshund.glb,
          // a stretched/recolored/mustard-striped derivation of base.vox)
    coat: 0xdeb06c, legMul: 0.55, bodyLenMul: 1.5, bodyWidMul: 0.85, bodyHeightMul: 0.8,
    headMul: 0.9, earStyle: "floppy-small", furry: false, sizeMul: 1, modelFile: "dachshund.glb",
  },
  "🦴": { // Golden Retriever — procedural fallback only; the real look
         // comes from models/golden.glb, a recolor of base.vox
    coat: 0xe6b254, legMul: 1.1, bodyLenMul: 1.1, bodyWidMul: 1.1, bodyHeightMul: 1.05,
    headMul: 1, earStyle: "floppy-large", furry: false, sizeMul: 1.1, modelFile: "golden.glb",
  },
};

// ============================================================
// Custom voxel models: drop a .glb per breed in models/<file> (see
// models/README.md) and it replaces the procedural boxes for that
// breed automatically. Missing files silently fall back to the
// procedural build, so this works fine with zero .glb files present.
//
// Optional node names inside the .glb enable the same walk animation
// as the procedural dogs — "head", "tail", "legFL", "legFR", "legBL",
// "legBR". A model with none of these still gets root-level bobbing
// and turning, just no per-limb swing.
// ============================================================

const MODEL_BASE_URL = "models/";
const gltfLoader = new GLTFLoader();
const modelTemplates = {}; // emoji -> THREE.Group template, or null if unavailable

function loadModelTemplate(emoji, file) {
  return new Promise((resolve) => {
    gltfLoader.load(
      MODEL_BASE_URL + file,
      (gltf) => {
        modelTemplates[emoji] = gltf.scene;
        resolve();
      },
      undefined,
      () => {
        modelTemplates[emoji] = null; // no file yet (or failed to load) — use procedural fallback
        resolve();
      }
    );
  });
}

function preloadModels() {
  return Promise.all(
    Object.entries(LOOK_PROFILES).map(([emoji, profile]) => loadModelTemplate(emoji, profile.modelFile))
  );
}

const STORAGE_KEY = "wescue-dog-park-dogs";
const PET_KEY = "wescue-dog-park-pets";

const parkEl = document.getElementById("park");
const canvas = document.getElementById("parkCanvas");
const dogCountEl = document.getElementById("dogCount");
const petCountEl = document.getElementById("petCount");
const toast = document.getElementById("toast");

let dogs = loadDogs();
let petCount = Number(localStorage.getItem(PET_KEY) || 0);

function loadDogs() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch (e) { /* fall through to seed */ }
  }
  return SEED_DOGS.map((seed) => ({ id: crypto.randomUUID(), ...seed }));
}

function saveDogs() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dogs));
}

function updateCounts() {
  dogCountEl.textContent = dogs.length;
  petCountEl.textContent = petCount;
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 2600);
}

// ============================================================
// 3D scene: low-poly voxel dogs, rendered at a low internal
// resolution and upscaled with nearest-neighbor filtering for
// a chunky "3D pixel art" look.
// ============================================================

const BOUNDS = { x: 8.5, z: 5 }; // half-extents of the walkable area
const PIXEL_SCALE = 2.6;

// Static scene props dogs should steer around and never end up inside —
// trees, fence posts, the pond, the gate. Populated as each is built below.
const OBSTACLES = []; // { x, z, radius }
function addObstacle(x, z, radius) {
  OBSTACLES.push({ x, z, radius });
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcdeffd);
scene.fog = new THREE.Fog(0xcdeffd, 18, 34);

const VIEW_SIZE = 6.2;
const camera = new THREE.OrthographicCamera(-VIEW_SIZE, VIEW_SIZE, VIEW_SIZE, -VIEW_SIZE, 0.1, 50);
camera.position.set(0, 11.5, 13);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;

// Lighting
scene.add(new THREE.HemisphereLight(0xcdeffd, 0x6cb843, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(8, 14, 6);
sun.castShadow = true;
sun.shadow.camera.left = -14;
sun.shadow.camera.right = 14;
sun.shadow.camera.top = 14;
sun.shadow.camera.bottom = -14;
sun.shadow.mapSize.set(512, 512);
scene.add(sun);

// --- Ground ---
function makeCheckerTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#7ec850";
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = "#74c247";
  ctx.fillRect(0, 0, 8, 8);
  ctx.fillRect(8, 8, 8, 8);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(GROUND_SIZE, GROUND_SIZE);
  return tex;
}

const GROUND_SIZE = 40;
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
  new THREE.MeshLambertMaterial({ map: makeCheckerTexture() })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// --- Pond ---
const pond = new THREE.Mesh(
  new THREE.CircleGeometry(1.6, 20),
  new THREE.MeshLambertMaterial({ color: 0x7fd0e8 })
);
pond.rotation.x = -Math.PI / 2;
pond.position.set(BOUNDS.x - 2.2, 0.01, BOUNDS.z - 1.6);
scene.add(pond);
addObstacle(pond.position.x, pond.position.z, 1.6 + 0.15);

// --- Trees ---
function makeTree(x, z, scale = 1) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.9, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x8a5a34 })
  );
  trunk.position.y = 0.45;
  trunk.castShadow = true;
  const foliage = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 1.1, 1.3),
    new THREE.MeshLambertMaterial({ color: 0x4a9c3f, flatShading: true })
  );
  foliage.position.y = 1.35;
  foliage.castShadow = true;
  group.add(trunk, foliage);
  group.position.set(x, 0, z);
  group.scale.setScalar(scale);
  scene.add(group);
  addObstacle(x, z, 0.4 * scale);
}

makeTree(-BOUNDS.x + 1.2, -BOUNDS.z + 1, 1.1);
makeTree(BOUNDS.x - 1.5, -BOUNDS.z + 0.8, 1.3);
makeTree(-1, -BOUNDS.z + 0.6, 0.85);
makeTree(-BOUNDS.x + 1.6, BOUNDS.z - 1.2, 0.8);

// --- Fence posts around the perimeter ---
function makePost(x, z) {
  const post = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.7, 0.22),
    new THREE.MeshLambertMaterial({ color: 0x8a5a34 })
  );
  post.position.set(x, 0.35, z);
  post.castShadow = true;
  scene.add(post);
  addObstacle(x, z, 0.16);
}

const POST_GAP = 1.4;
for (let x = -BOUNDS.x; x <= BOUNDS.x + 0.01; x += POST_GAP) {
  makePost(x, -BOUNDS.z);
  makePost(x, BOUNDS.z);
}
for (let z = -BOUNDS.z + POST_GAP; z <= BOUNDS.z - POST_GAP + 0.01; z += POST_GAP) {
  makePost(-BOUNDS.x, z);
  makePost(BOUNDS.x, z);
}

// --- Gate (spawn point for new dogs) ---
const SPAWN_POINT = new THREE.Vector3(0, 0, -BOUNDS.z);
{
  const gateGroup = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.22, 0.22),
    new THREE.MeshLambertMaterial({ color: 0x8a5a34 })
  );
  beam.position.y = 1.1;
  const postL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.1, 0.22), beam.material);
  postL.position.set(-0.75, 0.55, 0);
  const postR = postL.clone();
  postR.position.x = 0.75;
  gateGroup.add(beam, postL, postR);
  gateGroup.position.set(0, 0, -BOUNDS.z);
  scene.add(gateGroup);
  addObstacle(-0.75, -BOUNDS.z, 0.16);
  addObstacle(0.75, -BOUNDS.z, 0.16);
}

// ============================================================
// Voxel dog model
//
// One shared template for every dog, regardless of breed — only the
// coat color (from the "look" picker) and a small per-dog size
// variation change. Paws and the collar always use the same two
// accent colors so dogs read as one consistent species/design no
// matter what breed text a shelter listing has.
// ============================================================

const PAW_COLOR = 0xf3e9d6;
const COLLAR_COLOR = 0xff8a3d; // matches the site's accent orange
const NOSE_COLOR = 0x1c1712;

function shade(hex, amount) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(amount);
  return c;
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

// Deterministic per-dog scale (0.92–1.18) so the same dog looks the
// same across reloads, without needing breed-specific geometry.
function sizeScaleFor(dogId) {
  return 0.92 + (hashString(dogId) % 1000) / 1000 * 0.26;
}

// Ear shape/hinge presets. Each ear is a small pivot hinged at the top
// (near the skull) with the ear box hanging below it, so rotating the
// pivot reads as "perked up" vs. "flopped down" rather than just a
// resized box.
const EAR_STYLES = {
  "small-round": { w: 0.09, h: 0.11, hingeY: 0.24, hingeX: 0.15, tiltZ: 0.15, tiltX: 0 },
  "floppy-small": { w: 0.1, h: 0.24, hingeY: 0.27, hingeX: 0.18, tiltZ: 0.55, tiltX: 0.25 },
  "floppy-large": { w: 0.13, h: 0.3, hingeY: 0.29, hingeX: 0.2, tiltZ: 0.65, tiltX: 0.3 },
  "perked-large": { w: 0.12, h: 0.28, hingeY: 0.26, hingeX: 0.19, tiltZ: 0.12, tiltX: -0.05 },
  "perked": { w: 0.11, h: 0.22, hingeY: 0.23, hingeX: 0.18, tiltZ: 0.25, tiltX: -0.05 },
};

function addEars(head, dark, style) {
  const c = EAR_STYLES[style] || EAR_STYLES.perked;
  const earGeo = new THREE.BoxGeometry(c.w, c.h, 0.06);
  [-1, 1].forEach((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * c.hingeX, c.hingeY, 0.03);
    pivot.rotation.z = side * c.tiltZ;
    pivot.rotation.x = c.tiltX;
    const ear = new THREE.Mesh(earGeo, dark);
    ear.position.y = -c.h / 2;
    ear.castShadow = true;
    pivot.add(ear);
    head.add(pivot);
  });
}

function buildDogMesh(profile) {
  const root = new THREE.Group();
  const coatHex = profile.coat;
  const coat = new THREE.MeshLambertMaterial({ color: coatHex, flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: shade(coatHex, 0.55), flatShading: true });
  const pawMat = new THREE.MeshLambertMaterial({ color: PAW_COLOR, flatShading: true });
  const collarMat = new THREE.MeshLambertMaterial({ color: COLLAR_COLOR, flatShading: true });
  const noseMat = new THREE.MeshBasicMaterial({ color: NOSE_COLOR });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1c1712 });
  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xf5f0e6 });

  const legLength = 0.32 * profile.legMul;
  const bodyY = legLength + 0.18;
  const bw = profile.bodyWidMul, bh = profile.bodyHeightMul, bl = profile.bodyLenMul;

  // Torso: a slightly larger chest box + a tapered rear box reads more
  // dog-like than a single rectangular block.
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.52 * bw, 0.38 * bh, 0.5 * bl), coat);
  chest.position.set(0, bodyY + 0.01, -0.22 * bl);
  chest.castShadow = true;
  root.add(chest);

  const rear = new THREE.Mesh(new THREE.BoxGeometry(0.46 * bw, 0.34 * bh, 0.46 * bl), coat);
  rear.position.set(0, bodyY, 0.24 * bl);
  rear.castShadow = true;
  root.add(rear);

  const belly = new THREE.Mesh(new THREE.BoxGeometry(0.4 * bw, 0.1, 0.7 * bl), dark);
  belly.position.set(0, bodyY - 0.19, 0);
  root.add(belly);

  // Head is oversized relative to the body (cute-critter proportions)
  // and the snout juts out well past the chest — an unambiguous "front"
  // even at a glance, which also makes travel direction easy to read.
  // The whole group is scaled uniformly per breed via headMul.
  const head = new THREE.Group();
  head.position.set(0, bodyY + 0.32, -(0.22 * bl + 0.36));
  head.scale.setScalar(profile.headMul);
  const headBox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.4), coat);
  headBox.castShadow = true;
  head.add(headBox);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.17, 0.32), dark);
  snout.position.set(0, -0.09, -0.34);
  head.add(snout);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.06), noseMat);
  nose.position.set(0, -0.08, -0.49);
  head.add(nose);

  // Each eye is a light backing plate with a darker pupil in front, so
  // eyes stay readable even on the darkest coat colors.
  const eyeWhiteGeo = new THREE.BoxGeometry(0.09, 0.08, 0.02);
  const eyeGeo = new THREE.BoxGeometry(0.05, 0.05, 0.03);
  [-0.12, 0.12].forEach((x) => {
    const white = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    white.position.set(x, 0.06, -0.185);
    const pupil = new THREE.Mesh(eyeGeo, eyeMat);
    pupil.position.set(x, 0.05, -0.2);
    head.add(white, pupil);
  });

  addEars(head, dark, profile.earStyle);

  if (profile.furry) {
    // Poodle-style poofs: a small cluster of coat-colored cubes on top
    // of the head for a fluffy silhouette.
    const poofGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    [[0, 0.24, -0.02], [-0.1, 0.19, -0.11], [0.1, 0.19, -0.11], [0, 0.19, -0.22]].forEach(([x, y, z]) => {
      const poof = new THREE.Mesh(poofGeo, coat);
      poof.position.set(x, y, z);
      poof.castShadow = true;
      head.add(poof);
    });
  }
  root.add(head);

  // Collar: a bright ring at the base of the neck, always the same
  // color across every dog — the one shared "brand" detail.
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.42 * bw, 0.09, 0.46), collarMat);
  collar.position.set(0, bodyY + 0.19, -0.42 * bl);
  root.add(collar);

  // Tail gets a light-colored tip — paired with the oversized head/snout,
  // this makes front vs. back unambiguous even at a glance. Poodle tails
  // get a bigger pom-pom tip to match the fluffy head.
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, bodyY + 0.14, 0.45 * bl);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.4), dark);
  tail.position.z = 0.2;
  tail.rotation.x = -0.5;
  const tipSize = profile.furry ? 0.19 : 0.13;
  const tailTip = new THREE.Mesh(new THREE.BoxGeometry(tipSize, tipSize, tipSize), profile.furry ? coat : pawMat);
  tailTip.position.z = 0.24;
  tail.add(tailTip);
  tailPivot.add(tail);
  root.add(tailPivot);

  const legGeo = new THREE.BoxGeometry(0.13, legLength * 0.7, 0.13);
  const pawGeo = new THREE.BoxGeometry(0.15, legLength * 0.3, 0.16);
  const legPositions = [
    [-0.17 * bw, -0.32 * bl], [0.17 * bw, -0.32 * bl], // front L/R
    [-0.17 * bw, 0.32 * bl], [0.17 * bw, 0.32 * bl],   // back L/R
  ];
  const legPivots = legPositions.map(([lx, lz]) => {
    const pivot = new THREE.Group();
    pivot.position.set(lx, legLength + 0.16, lz);
    const leg = new THREE.Mesh(legGeo, dark);
    leg.position.y = -legLength * 0.35;
    leg.castShadow = true;
    const paw = new THREE.Mesh(pawGeo, pawMat);
    paw.position.y = -legLength * 0.75;
    paw.castShadow = true;
    pivot.add(leg, paw);
    root.add(pivot);
    return pivot;
  });

  return { root, head, tailPivot, legPivots };
}

// Builds a dog from a preloaded .glb template instead of procedural boxes.
// Looks for optional named nodes to drive the same walk animation as the
// procedural dogs; anything not found is simply skipped when animating.
function buildDogMeshFromTemplate(template) {
  const root = template.clone(true);
  root.traverse((obj) => {
    if (obj.isMesh) obj.castShadow = true;
  });
  const head = root.getObjectByName("head") || null;
  const tailPivot = root.getObjectByName("tail") || null;
  const legPivots = ["legFL", "legFR", "legBL", "legBR"]
    .map((name) => root.getObjectByName(name))
    .filter(Boolean);
  return { root, head, tailPivot, legPivots: legPivots.length === 4 ? legPivots : [] };
}

// ============================================================
// Dog entities: model + movement + animation state
// ============================================================

const dogsGroup = new THREE.Group();
scene.add(dogsGroup);
const entities = new Map(); // id -> entity

function randomTarget() {
  // Resample a few times to avoid handing out a target that's inside (or
  // right next to) an obstacle — otherwise a dog can get stuck endlessly
  // pushing against a tree/pond it's trying to walk into.
  for (let attempt = 0; attempt < 8; attempt++) {
    const x = (Math.random() * 2 - 1) * (BOUNDS.x - 0.6);
    const z = (Math.random() * 2 - 1) * (BOUNDS.z - 0.6);
    const blocked = OBSTACLES.some((ob) => {
      const dx = x - ob.x, dz = z - ob.z;
      const clear = ob.radius + 0.5;
      return dx * dx + dz * dz < clear * clear;
    });
    if (!blocked) return new THREE.Vector3(x, 0, z);
  }
  return new THREE.Vector3(0, 0, 0); // fallback: park center is always clear
}

function spawnEntity(dog, { atGate } = {}) {
  const profile = LOOK_PROFILES[dog.emoji] ?? LOOK_PROFILES["🐕"];
  const template = modelTemplates[dog.emoji];
  const model = template ? buildDogMeshFromTemplate(template) : buildDogMesh(profile);
  model.root.userData.dogId = dog.id;
  dogsGroup.add(model.root);

  const startPos = atGate ? SPAWN_POINT.clone() : randomTarget();
  model.root.position.copy(startPos);

  const baseScale = sizeScaleFor(dog.id) * profile.sizeMul;
  model.root.scale.setScalar(atGate ? 0.05 : baseScale);

  const firstTarget = randomTarget();
  // Face the first target immediately instead of defaulting to 0° —
  // otherwise a freshly spawned dog visibly turns from facing the
  // wrong way before its first step.
  const toFirst = firstTarget.clone().sub(startPos);
  if (toFirst.lengthSq() > 1e-6) {
    toFirst.normalize();
    model.root.rotation.y = Math.atan2(-toFirst.x, -toFirst.z);
  }

  const entity = {
    dog,
    model,
    baseScale,
    target: firstTarget,
    speed: 1.1 + Math.random() * 0.5,
    pauseUntil: 0,
    legPhase: Math.random() * Math.PI * 2,
  };
  entities.set(dog.id, entity);

  if (atGate) {
    // pop-in, then head into the park
    const growTime = performance.now() + 500;
    entity._growUntil = growTime;
  }
  return entity;
}

function renderAllDogs() {
  dogsGroup.clear();
  entities.clear();
  dogs.forEach((dog) => spawnEntity(dog));
  updateCounts();
}

// --- Raycasting for clicks ---
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();

canvas.addEventListener("click", (event) => {
  const rect = canvas.getBoundingClientRect();
  pointerNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObjects(dogsGroup.children, true);
  if (!hits.length) return;
  let obj = hits[0].object;
  while (obj && !obj.userData.dogId) obj = obj.parent;
  if (obj) onDogClick(obj.userData.dogId, obj);
});

// --- Dog info modal ---
const dogModalOverlay = document.getElementById("dogModalOverlay");
const cardAvatar = document.getElementById("cardAvatar");
const cardName = document.getElementById("cardName");
const cardMeta = document.getElementById("cardMeta");
const cardBio = document.getElementById("cardBio");
const cardShelter = document.getElementById("cardShelter");
const cardAdoptLink = document.getElementById("cardAdoptLink");
const petBtn = document.getElementById("petBtn");

function onDogClick(id, worldObj) {
  const dog = dogs.find((d) => d.id === id);
  if (!dog) return;
  cardAvatar.textContent = dog.emoji;
  cardName.textContent = dog.name;
  cardMeta.textContent = `${dog.breed} · ${dog.age}`;
  cardBio.textContent = dog.bio || "This good boy/girl is still writing their bio.";
  cardShelter.textContent = dog.shelter;
  cardAdoptLink.href = dog.url && dog.url.trim() ? dog.url : "https://wescue.com";
  dogModalOverlay.classList.add("open");
  spawnHeart(worldObj);
}

function spawnHeart(worldObj) {
  const worldPos = new THREE.Vector3();
  worldObj.getWorldPosition(worldPos);
  worldPos.y += 0.9;
  worldPos.project(camera);

  const rect = parkEl.getBoundingClientRect();
  const x = (worldPos.x * 0.5 + 0.5) * rect.width;
  const y = (-worldPos.y * 0.5 + 0.5) * rect.height;

  const heart = document.createElement("div");
  heart.className = "heart-pop";
  heart.textContent = "💛";
  heart.style.left = (x - 8) + "px";
  heart.style.top = (y - 10) + "px";
  parkEl.appendChild(heart);
  setTimeout(() => heart.remove(), 900);
}

petBtn.addEventListener("click", () => {
  petCount += 1;
  localStorage.setItem(PET_KEY, petCount);
  updateCounts();
  showToast("🖐️ Aww, good pet!");
});

// --- Add dog form ---
const addDogBtn = document.getElementById("addDogBtn");
const formModalOverlay = document.getElementById("formModalOverlay");
const addDogForm = document.getElementById("addDogForm");

addDogBtn.addEventListener("click", () => formModalOverlay.classList.add("open"));

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.target.closest(".modal-overlay").classList.remove("open");
  });
});

[dogModalOverlay, formModalOverlay].forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.remove("open");
  });
});

addDogForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const dog = {
    id: crypto.randomUUID(),
    name: document.getElementById("fName").value.trim(),
    breed: document.getElementById("fBreed").value.trim(),
    age: document.getElementById("fAge").value.trim(),
    emoji: document.getElementById("fEmoji").value,
    shelter: document.getElementById("fShelter").value.trim(),
    bio: document.getElementById("fBio").value.trim(),
    url: document.getElementById("fUrl").value.trim(),
  };
  dogs.push(dog);
  saveDogs();
  spawnEntity(dog, { atGate: true });
  updateCounts();
  showToast(`🐾 ${dog.name} from ${dog.shelter} just joined the park!`);
  addDogForm.reset();
  formModalOverlay.classList.remove("open");
});

// ============================================================
// Render / animation loop
// ============================================================

function resize() {
  const rect = parkEl.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width / PIXEL_SCALE));
  const h = Math.max(1, Math.round(rect.height / PIXEL_SCALE));
  renderer.setSize(w, h, false);
  camera.left = -VIEW_SIZE * (rect.width / rect.height);
  camera.right = VIEW_SIZE * (rect.width / rect.height);
  camera.top = VIEW_SIZE;
  camera.bottom = -VIEW_SIZE;
  camera.updateProjectionMatrix();
}

new ResizeObserver(resize).observe(parkEl);
resize();

const MAX_LEG_SWING = 0.55;
const WALK_FREQ = 7;

let lastTime = performance.now();

// Nearby-dog avoidance: a soft steering push away from close neighbors
// (blended into the movement/facing direction) plus a hard pairwise
// position correction after everyone's moved, so dogs slide around each
// other instead of clipping through.
const AVOID_RADIUS = 1.3;
const AVOID_WEIGHT = 1.5;
const MIN_SEPARATION = 0.85;

function steeringPush(entity, allEntities) {
  const pos = entity.model.root.position;
  const push = new THREE.Vector3();
  for (const other of allEntities) {
    if (other === entity) continue;
    const otherPos = other.model.root.position;
    const dx = pos.x - otherPos.x;
    const dz = pos.z - otherPos.z;
    const distSq = dx * dx + dz * dz;
    if (distSq < AVOID_RADIUS * AVOID_RADIUS && distSq > 1e-6) {
      const dist = Math.sqrt(distSq);
      const strength = (AVOID_RADIUS - dist) / AVOID_RADIUS;
      push.x += (dx / dist) * strength;
      push.z += (dz / dist) * strength;
    }
  }
  return push;
}

function resolveOverlaps(allEntities) {
  for (let i = 0; i < allEntities.length; i++) {
    for (let j = i + 1; j < allEntities.length; j++) {
      const a = allEntities[i], b = allEntities[j];
      const ap = a.model.root.position, bp = b.model.root.position;
      const dx = bp.x - ap.x, dz = bp.z - ap.z;
      const distSq = dx * dx + dz * dz;
      const minDist = MIN_SEPARATION * ((a.baseScale + b.baseScale) / 2);
      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq) || 0.001;
        const overlap = (minDist - dist) / 2;
        const nx = dx / dist, nz = dz / dist;
        ap.x -= nx * overlap; ap.z -= nz * overlap;
        bp.x += nx * overlap; bp.z += nz * overlap;
      }
    }
  }
  for (const e of allEntities) {
    const p = e.model.root.position;
    p.x = THREE.MathUtils.clamp(p.x, -BOUNDS.x + 0.4, BOUNDS.x - 0.4);
    p.z = THREE.MathUtils.clamp(p.z, -BOUNDS.z + 0.4, BOUNDS.z - 0.4);
  }
}

// Same two-stage idea (soft steering + hard correction) but against the
// static scene props — trees, fence posts, the pond, the gate — so dogs
// don't walk through them either. Obstacles never move, so correction
// only pushes the dog.
const OBSTACLE_AVOID_MARGIN = 0.55;
const OBSTACLE_AVOID_WEIGHT = 1.8;
const OBSTACLE_DOG_RADIUS = 0.22;

function obstaclePush(entity) {
  const pos = entity.model.root.position;
  const push = new THREE.Vector3();
  for (const ob of OBSTACLES) {
    const dx = pos.x - ob.x;
    const dz = pos.z - ob.z;
    const distSq = dx * dx + dz * dz;
    const detectRadius = ob.radius + OBSTACLE_AVOID_MARGIN;
    if (distSq < detectRadius * detectRadius && distSq > 1e-6) {
      const dist = Math.sqrt(distSq);
      const strength = (detectRadius - dist) / detectRadius;
      push.x += (dx / dist) * strength;
      push.z += (dz / dist) * strength;
    }
  }
  return push;
}

function resolveObstacleOverlaps(allEntities) {
  for (const e of allEntities) {
    const p = e.model.root.position;
    for (const ob of OBSTACLES) {
      const dx = p.x - ob.x, dz = p.z - ob.z;
      const distSq = dx * dx + dz * dz;
      const minDist = ob.radius + OBSTACLE_DOG_RADIUS * e.baseScale;
      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq) || 0.001;
        const push = minDist - dist;
        p.x += (dx / dist) * push;
        p.z += (dz / dist) * push;
      }
    }
  }
}

function animate(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  const entityList = [...entities.values()];

  for (const entity of entityList) {
    const { model } = entity;
    const pos = model.root.position;

    if (entity._growUntil) {
      const t = Math.min(1, 1 - (entity._growUntil - now) / 500);
      model.root.scale.setScalar(Math.max(0.05, t * entity.baseScale));
      if (t >= 1) delete entity._growUntil;
    }

    const toTarget = entity.target.clone().sub(pos);
    const dist = toTarget.length();
    let moving = false;

    if (now < entity.pauseUntil) {
      moving = false;
    } else if (dist < 0.12) {
      entity.pauseUntil = now + 600 + Math.random() * 2200;
      entity.target = randomTarget();
    } else {
      moving = true;
      toTarget.normalize();
      const desired = toTarget.clone()
        .addScaledVector(steeringPush(entity, entityList), AVOID_WEIGHT)
        .addScaledVector(obstaclePush(entity), OBSTACLE_AVOID_WEIGHT);
      if (desired.lengthSq() > 1e-6) desired.normalize();
      pos.addScaledVector(desired, entity.speed * dt);
      // Dog's local forward is -Z; face rotation.y so that axis points at the (avoidance-adjusted) direction.
      const targetAngle = Math.atan2(-desired.x, -desired.z);
      let da = targetAngle - model.root.rotation.y;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      model.root.rotation.y += da * Math.min(1, dt * 10);
    }

    const walkT = now / 1000 * WALK_FREQ + entity.legPhase;
    const swing = moving ? MAX_LEG_SWING : 0;
    // Custom .glb models without the legFL/FR/BL/BR nodes just skip leg
    // swing — they still get root-level bob/turn below.
    if (model.legPivots.length === 4) {
      model.legPivots[0].rotation.x = Math.sin(walkT) * swing;
      model.legPivots[3].rotation.x = Math.sin(walkT) * swing;
      model.legPivots[1].rotation.x = Math.sin(walkT + Math.PI) * swing;
      model.legPivots[2].rotation.x = Math.sin(walkT + Math.PI) * swing;
    }

    model.root.position.y = moving ? Math.abs(Math.sin(walkT)) * 0.05 : 0;
    if (model.tailPivot) {
      model.tailPivot.rotation.y = Math.sin(now / 1000 * 3 + entity.legPhase) * 0.4;
    }
  }

  resolveOverlaps(entityList);
  resolveObstacleOverlaps(entityList);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// --- Init ---
await preloadModels();
saveDogs();
renderAllDogs();
requestAnimationFrame(animate);
