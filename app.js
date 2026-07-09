import * as THREE from "three";

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
];

// Coat color per "look" — drives the voxel dog's material color.
const EMOJI_COLOR = {
  "🐕": 0xc9975b,
  "🐶": 0xe0b467,
  "🐩": 0xf2ede1,
  "🦮": 0x4a3527,
  "🐕‍🦺": 0x2b2b2b,
};

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
const PIXEL_SCALE = 3.3;

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

function buildDogMesh(coatHex) {
  const root = new THREE.Group();
  const coat = new THREE.MeshLambertMaterial({ color: coatHex, flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: shade(coatHex, 0.55), flatShading: true });
  const pawMat = new THREE.MeshLambertMaterial({ color: PAW_COLOR, flatShading: true });
  const collarMat = new THREE.MeshLambertMaterial({ color: COLLAR_COLOR, flatShading: true });
  const noseMat = new THREE.MeshBasicMaterial({ color: NOSE_COLOR });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1c1712 });

  const legLength = 0.32;
  const bodyY = legLength + 0.18;

  // Torso: a slightly larger chest box + a tapered rear box reads more
  // dog-like than a single rectangular block.
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.38, 0.5), coat);
  chest.position.set(0, bodyY + 0.01, -0.22);
  chest.castShadow = true;
  root.add(chest);

  const rear = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 0.46), coat);
  rear.position.set(0, bodyY, 0.24);
  rear.castShadow = true;
  root.add(rear);

  const belly = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.7), dark);
  belly.position.set(0, bodyY - 0.19, 0);
  root.add(belly);

  const head = new THREE.Group();
  head.position.set(0, bodyY + 0.3, -0.56);
  const headBox = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 0.34), coat);
  headBox.castShadow = true;
  head.add(headBox);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.24), dark);
  snout.position.set(0, -0.08, -0.28);
  head.add(snout);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.05), noseMat);
  nose.position.set(0, -0.07, -0.4);
  head.add(nose);

  const eyeGeo = new THREE.BoxGeometry(0.05, 0.05, 0.03);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.1, 0.05, -0.17);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.1;
  head.add(eyeL, eyeR);

  const earGeo = new THREE.BoxGeometry(0.1, 0.2, 0.06);
  const earL = new THREE.Mesh(earGeo, dark);
  earL.position.set(-0.16, 0.22, 0.02);
  earL.rotation.z = 0.25;
  const earR = earL.clone();
  earR.position.x = 0.16;
  earR.rotation.z = -0.25;
  head.add(earL, earR);
  root.add(head);

  // Collar: a bright ring at the base of the neck, always the same
  // color across every dog — the one shared "brand" detail.
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.09, 0.46), collarMat);
  collar.position.set(0, bodyY + 0.19, -0.42);
  root.add(collar);

  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, bodyY + 0.14, 0.45);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.4), dark);
  tail.position.z = 0.2;
  tail.rotation.x = -0.5;
  tailPivot.add(tail);
  root.add(tailPivot);

  const legGeo = new THREE.BoxGeometry(0.13, legLength * 0.7, 0.13);
  const pawGeo = new THREE.BoxGeometry(0.15, legLength * 0.3, 0.16);
  const legPositions = [
    [-0.17, -0.32], [0.17, -0.32], // front L/R
    [-0.17, 0.32], [0.17, 0.32],   // back L/R
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

// ============================================================
// Dog entities: model + movement + animation state
// ============================================================

const dogsGroup = new THREE.Group();
scene.add(dogsGroup);
const entities = new Map(); // id -> entity

function randomTarget() {
  return new THREE.Vector3(
    (Math.random() * 2 - 1) * (BOUNDS.x - 0.6),
    0,
    (Math.random() * 2 - 1) * (BOUNDS.z - 0.6)
  );
}

function spawnEntity(dog, { atGate } = {}) {
  const coatHex = EMOJI_COLOR[dog.emoji] ?? 0xc9975b;
  const model = buildDogMesh(coatHex);
  model.root.userData.dogId = dog.id;
  dogsGroup.add(model.root);

  const startPos = atGate ? SPAWN_POINT.clone() : randomTarget();
  model.root.position.copy(startPos);

  const baseScale = sizeScaleFor(dog.id);
  model.root.scale.setScalar(atGate ? 0.05 : baseScale);

  const entity = {
    dog,
    model,
    baseScale,
    target: atGate ? randomTarget() : randomTarget(),
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

function animate(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  for (const entity of entities.values()) {
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
      pos.addScaledVector(toTarget, entity.speed * dt);
      // Dog's local forward is -Z; face rotation.y so that axis points at the target.
      const targetAngle = Math.atan2(-toTarget.x, -toTarget.z);
      let da = targetAngle - model.root.rotation.y;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      model.root.rotation.y += da * Math.min(1, dt * 6);
    }

    const walkT = now / 1000 * WALK_FREQ + entity.legPhase;
    const swing = moving ? MAX_LEG_SWING : 0;
    model.legPivots[0].rotation.x = Math.sin(walkT) * swing;
    model.legPivots[3].rotation.x = Math.sin(walkT) * swing;
    model.legPivots[1].rotation.x = Math.sin(walkT + Math.PI) * swing;
    model.legPivots[2].rotation.x = Math.sin(walkT + Math.PI) * swing;

    model.root.position.y = moving ? Math.abs(Math.sin(walkT)) * 0.05 : 0;
    model.tailPivot.rotation.y = Math.sin(now / 1000 * 3 + entity.legPhase) * 0.4;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// --- Init ---
saveDogs();
renderAllDogs();
requestAnimationFrame(animate);
