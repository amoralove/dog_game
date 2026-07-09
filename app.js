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

const STORAGE_KEY = "wescue-dog-park-dogs";
const PET_KEY = "wescue-dog-park-pets";

const park = document.getElementById("park");
const dogCountEl = document.getElementById("dogCount");
const petCountEl = document.getElementById("petCount");
const toast = document.getElementById("toast");

let dogs = loadDogs();
let petCount = Number(localStorage.getItem(PET_KEY) || 0);
let selectedDogId = null;

function loadDogs() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch (e) { /* fall through to seed */ }
  }
  return SEED_DOGS.map(seedToDog);
}

function seedToDog(seed) {
  return { id: crypto.randomUUID(), ...seed };
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

// --- Rendering & movement ---
const PARK_PADDING = 40;

function randomPoint() {
  const w = park.clientWidth - PARK_PADDING * 2;
  const h = park.clientHeight - PARK_PADDING * 2;
  return {
    x: PARK_PADDING + Math.random() * w,
    y: PARK_PADDING + Math.random() * h + 30, // keep below the gate area
  };
}

function renderDog(dog, { spawn } = {}) {
  const el = document.createElement("div");
  el.className = "dog";
  el.textContent = dog.emoji;
  el.dataset.id = dog.id;
  el.title = dog.name;

  const start = spawn
    ? { x: park.clientWidth / 2, y: 30 }
    : randomPoint();
  el.style.left = start.x + "px";
  el.style.top = start.y + "px";

  if (spawn) {
    el.classList.add("spawning");
  }

  el.addEventListener("click", (e) => onDogClick(dog.id, el, e));
  park.appendChild(el);

  // kick off wandering after a tick so the initial position transition doesn't fire
  requestAnimationFrame(() => scheduleWalk(el));

  if (spawn) {
    setTimeout(() => {
      const target = randomPoint();
      moveDogTo(el, target);
    }, 400);
  }

  return el;
}

function moveDogTo(el, point) {
  const prevLeft = parseFloat(el.style.left);
  const facingLeft = point.x < prevLeft;
  el.classList.toggle("facing-left", facingLeft);
  el.style.left = point.x + "px";
  el.style.top = point.y + "px";
}

function scheduleWalk(el) {
  const wander = () => {
    if (!el.isConnected) return;
    const target = randomPoint();
    moveDogTo(el, target);
    const delay = 1800 + Math.random() * 2400;
    setTimeout(wander, delay);
  };
  const initialDelay = 500 + Math.random() * 2000;
  setTimeout(wander, initialDelay);
}

function renderAllDogs() {
  park.querySelectorAll(".dog").forEach((el) => el.remove());
  dogs.forEach((dog) => renderDog(dog));
  updateCounts();
}

// --- Dog info modal ---
const dogModalOverlay = document.getElementById("dogModalOverlay");
const cardAvatar = document.getElementById("cardAvatar");
const cardName = document.getElementById("cardName");
const cardMeta = document.getElementById("cardMeta");
const cardBio = document.getElementById("cardBio");
const cardShelter = document.getElementById("cardShelter");
const cardAdoptLink = document.getElementById("cardAdoptLink");
const petBtn = document.getElementById("petBtn");

function onDogClick(id, el, event) {
  const dog = dogs.find((d) => d.id === id);
  if (!dog) return;
  selectedDogId = id;
  cardAvatar.textContent = dog.emoji;
  cardName.textContent = dog.name;
  cardMeta.textContent = `${dog.breed} · ${dog.age}`;
  cardBio.textContent = dog.bio || "This good boy/girl is still writing their bio.";
  cardShelter.textContent = dog.shelter;
  cardAdoptLink.href = dog.url && dog.url.trim() ? dog.url : "https://wescue.com";
  dogModalOverlay.classList.add("open");
  spawnHeart(event, el);
}

function spawnHeart(event, el) {
  const heart = document.createElement("div");
  heart.className = "heart-pop";
  heart.textContent = "💛";
  const rect = el.getBoundingClientRect();
  const parkRect = park.getBoundingClientRect();
  heart.style.left = (rect.left - parkRect.left + rect.width / 2 - 8) + "px";
  heart.style.top = (rect.top - parkRect.top - 6) + "px";
  park.appendChild(heart);
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
  renderDog(dog, { spawn: true });
  updateCounts();
  showToast(`🐾 ${dog.name} from ${dog.shelter} just joined the park!`);
  addDogForm.reset();
  formModalOverlay.classList.remove("open");
});

// --- Init ---
saveDogs();
renderAllDogs();
