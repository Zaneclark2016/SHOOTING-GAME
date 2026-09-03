import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x666666);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 1.7, -294); // lobby spawn (see LOBBY_SPAWN below)

const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x22334d, 1.2);
hemi.position.set(0, 50, 0);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff2d8, 1.2);
sun.position.set(-18, 24, -12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const worldSize = 120;
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(worldSize, worldSize),
  new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.95, metalness: 0.05 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const wallMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.8, metalness: 0.25 });
const arenaWalls = [
  { x: 0, z: -worldSize / 2, w: worldSize, h: 5, d: 2 },
  { x: 0, z: worldSize / 2, w: worldSize, h: 5, d: 2 },
  { x: -worldSize / 2, z: 0, w: 2, h: 5, d: worldSize },
  { x: worldSize / 2, z: 0, w: 2, h: 5, d: worldSize }
];

arenaWalls.forEach(({ x, z, w, h, d }) => {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  wall.position.set(x, h / 2, z);
  wall.castShadow = true;
  wall.receiveShadow = true;
  scene.add(wall);
});

const obstacles = [];
function addObstacle(x, z, w = 5, h = 3, d = 5, color = 0x2d4254) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.18 })
  );
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  obstacles.push({ mesh, half: new THREE.Vector3(w / 2, h / 2, d / 2) });
}

addObstacle(-26, -18, 10, 6, 8, 0xcccccc);
addObstacle(28, -16, 12, 5, 6, 0xcccccc);
addObstacle(-12, 20, 8, 4, 8, 0xcccccc);
addObstacle(18, 22, 9, 5, 5, 0xcccccc);
addObstacle(0, 12, 12, 3, 4, 0xcccccc);
addObstacle(0, -24, 10, 4, 6, 0xcccccc);
addObstacle(-38, 0, 6, 4, 12, 0xcccccc);
addObstacle(38, 0, 6, 4, 12, 0xcccccc);

const objective = {
  center: new THREE.Vector3(0, 0.5, 0),
  progress: 0,
  ring: null,
  base: null,
};

// -------------------------------
// LOBBY (real walkable staging area, separate from the arena)
// -------------------------------
const LOBBY_CENTER = new THREE.Vector3(0, 0, -300);
const LOBBY_HALF = 10; // room is roughly 20x20
const LOBBY_SPAWN = new THREE.Vector3(LOBBY_CENTER.x, 1.7, LOBBY_CENTER.z + 6);
const LOBBY_BOUNDS = {
  minX: LOBBY_CENTER.x - (LOBBY_HALF - 1),
  maxX: LOBBY_CENTER.x + (LOBBY_HALF - 1),
  minZ: LOBBY_CENTER.z - (LOBBY_HALF - 1),
  maxZ: LOBBY_CENTER.z + (LOBBY_HALF - 1)
};

const lobbyFloor = new THREE.Mesh(
  new THREE.PlaneGeometry(LOBBY_HALF * 2, LOBBY_HALF * 2),
  new THREE.MeshStandardMaterial({ color: 0x0e2230, roughness: 0.7, metalness: 0.25 })
);
lobbyFloor.rotation.x = -Math.PI / 2;
lobbyFloor.position.set(LOBBY_CENTER.x, 0, LOBBY_CENTER.z);
lobbyFloor.receiveShadow = true;
scene.add(lobbyFloor);

const lobbyWallMat = new THREE.MeshStandardMaterial({ color: 0x123246, roughness: 0.6, metalness: 0.3, emissive: 0x0b4f66, emissiveIntensity: 0.15 });
const lobbyWalls = [
  { x: LOBBY_CENTER.x, z: LOBBY_CENTER.z - LOBBY_HALF, w: LOBBY_HALF * 2, h: 6, d: 1 },
  { x: LOBBY_CENTER.x, z: LOBBY_CENTER.z + LOBBY_HALF, w: LOBBY_HALF * 2, h: 6, d: 1 },
  { x: LOBBY_CENTER.x - LOBBY_HALF, z: LOBBY_CENTER.z, w: 1, h: 6, d: LOBBY_HALF * 2 },
  { x: LOBBY_CENTER.x + LOBBY_HALF, z: LOBBY_CENTER.z, w: 1, h: 6, d: LOBBY_HALF * 2 }
];
lobbyWalls.forEach(({ x, z, w, h, d }) => {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lobbyWallMat);
  wall.position.set(x, h / 2, z);
  wall.castShadow = true;
  wall.receiveShadow = true;
  scene.add(wall);
});

// ceiling — closes off the room and gives the light fixtures something to mount to
const lobbyCeiling = new THREE.Mesh(
  new THREE.PlaneGeometry(LOBBY_HALF * 2, LOBBY_HALF * 2),
  new THREE.MeshStandardMaterial({ color: 0x0a1a26, roughness: 0.9, metalness: 0.1, side: THREE.DoubleSide })
);
lobbyCeiling.rotation.x = Math.PI / 2;
lobbyCeiling.position.set(LOBBY_CENTER.x, 6, LOBBY_CENTER.z);
lobbyCeiling.receiveShadow = true;
scene.add(lobbyCeiling);

// ceiling light fixtures — visible glowing discs plus real point lights so the room is actually lit
const lobbyFixturePositions = [[-5, -5], [5, -5], [-5, 5], [5, 5]];
lobbyFixturePositions.forEach(([dx, dz]) => {
  const fx = LOBBY_CENTER.x + dx;
  const fz = LOBBY_CENTER.z + dz;

  const fixture = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 0.15, 16),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xbfe7ff, emissiveIntensity: 1.6 })
  );
  fixture.position.set(fx, 5.85, fz);
  scene.add(fixture);

  const fixtureLight = new THREE.PointLight(0xbfe7ff, 1.2, 22, 2);
  fixtureLight.position.set(fx, 5.5, fz);
  scene.add(fixtureLight);
});

const controls = new PointerLockControls(camera, document.body);
const overlayMsg = document.getElementById('message');
const mobileControls = document.getElementById('mobileControls');
const joystickArea = document.getElementById('joystickArea');
const joystickKnob = document.getElementById('joystickKnob');
const hud = {
  health: document.getElementById('health'),
  armor: document.getElementById('armor'),
  weapon: document.getElementById('weapon'),
  objective: document.getElementById('objective')
};
const weaponIconEl = document.getElementById('weaponIcon');
const gameChatLog = document.getElementById('gameChatLog');
const gameChatInputWrap = document.getElementById('gameChatInputWrap');
const gameChatInput = document.getElementById('gameChatInput');

const moveState = { forward: 0, back: 0, left: 0, right: 0 };
const player = {
  velocity: new THREE.Vector3(),
  position: new THREE.Vector3(0, 1.7, -294),
  health: 100,
  armor: 25,
  score: 0,
  grounded: true,
  round: 1,
  timer: 90,
  weapon: 'rifle',
  weaponCooldown: 0,
  reloadTimer: 0,
  rifleAmmo: 35,
  rifleMagazineSize: 35,
  shotgunAmmo: 8,
  shotgunReserve: 18,
  spawnProtectionTimer: 0,
  started: false,
  alive: true,
  message: 'Awaiting deployment'
};

const state = {
  mode: 'lobby', // 'lobby' | 'arena'
  started: false,
  round: 1,
  score: 0,
  timer: 90,
  win: false,
  objectiveProgress: 0,
  botId: 0,
  fireHeld: false,
  aimHeld: false,
  fadeOut: 0
};

let audioContext = null;
let shotNoiseBuffer = null;
const rifleShotAudio = new Audio('/audio/rifle-shot.mp3');
const shotgunShotAudio = new Audio('/audio/shotgun-shot.mp3');
const shotgunReloadAudio = new Audio('/audio/shotgun-reload.mp3');
const rifleReloadAudio = new Audio('/audio/rifle-reload.mp3');
const activeRifleShots = new Set();
rifleShotAudio.preload = 'auto';
shotgunShotAudio.preload = 'auto';
shotgunReloadAudio.preload = 'auto';
rifleReloadAudio.preload = 'auto';
rifleShotAudio.playsInline = true;
shotgunShotAudio.playsInline = true;
shotgunReloadAudio.playsInline = true;
rifleReloadAudio.playsInline = true;
let audioUnlocked = false;

function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;

  const sounds = [rifleShotAudio, shotgunShotAudio, shotgunReloadAudio, rifleReloadAudio];
  sounds.forEach((sound) => {
    sound.muted = true;
    const playback = sound.play();
    if (playback) {
      playback.then(() => {
        sound.pause();
        sound.currentTime = 0;
        sound.muted = false;
      }).catch((error) => {
        sound.muted = false;
        console.warn('[audio] unlock failed:', error);
      });
    }
  });
}

function getAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
}

function getShotNoiseBuffer(context) {
  if (shotNoiseBuffer && shotNoiseBuffer.sampleRate === context.sampleRate) return shotNoiseBuffer;
  const length = Math.floor(context.sampleRate * 0.25);
  shotNoiseBuffer = context.createBuffer(1, length, context.sampleRate);
  const samples = shotNoiseBuffer.getChannelData(0);
  for (let i = 0; i < samples.length; i += 1) {
    // Slightly shape the noise so it is a punch rather than a constant hiss.
    samples[i] = (Math.random() * 2 - 1) * Math.exp(-i / (context.sampleRate * 0.055));
  }
  return shotNoiseBuffer;
}

function playGunshot(weapon) {
  if (weapon === 'rifle' || weapon === 'shotgun') {
    const shotAudio = weapon === 'rifle' ? rifleShotAudio : shotgunShotAudio;
    const shot = shotAudio.cloneNode();
    shot.volume = weapon === 'rifle' ? 1 : 1;
    activeRifleShots.add(shot);
    const finishShot = () => {
      activeRifleShots.delete(shot);
    };
    shot.addEventListener('ended', finishShot, { once: true });
    const playback = shot.play();
    if (playback) playback.catch((error) => console.warn('[audio] gunshot playback failed:', error));
    window.setTimeout(() => {
      shot.pause();
      shot.currentTime = 0;
      activeRifleShots.delete(shot);
    }, weapon === 'rifle' ? 390 : 500);
    return;
  }

  const context = getAudioContext();
  if (!context) return;

  const now = context.currentTime;
  const isShotgun = false;
  const output = context.createGain();
  const compressor = context.createDynamicsCompressor();
  const crackFilter = context.createBiquadFilter();
  const bodyFilter = context.createBiquadFilter();
  const bodyShape = context.createBiquadFilter();
  const crack = context.createBufferSource();
  const body = context.createBufferSource();
  const crackGain = context.createGain();
  const bodyGain = context.createGain();

  output.gain.setValueAtTime(isShotgun ? 0.62 : 0.52, now);
  compressor.threshold.setValueAtTime(-18, now);
  compressor.knee.setValueAtTime(8, now);
  compressor.ratio.setValueAtTime(8, now);
  compressor.attack.setValueAtTime(0.001, now);
  compressor.release.setValueAtTime(0.12, now);

  crackFilter.type = 'highpass';
  crackFilter.frequency.setValueAtTime(isShotgun ? 1100 : 1500, now);
  bodyFilter.type = 'lowpass';
  bodyFilter.frequency.setValueAtTime(isShotgun ? 3600 : 4300, now);
  bodyFilter.frequency.exponentialRampToValueAtTime(1100, now + 0.14);
  bodyShape.type = 'highpass';
  bodyShape.frequency.setValueAtTime(90, now);

  crack.buffer = getShotNoiseBuffer(context);
  crackGain.gain.setValueAtTime(isShotgun ? 1.0 : 0.85, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
  body.buffer = getShotNoiseBuffer(context);
  bodyGain.gain.setValueAtTime(isShotgun ? 0.95 : 0.78, now);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, now + (isShotgun ? 0.2 : 0.13));

  crack.connect(crackGain).connect(crackFilter);
  body.connect(bodyGain).connect(bodyFilter).connect(bodyShape);
  crackFilter.connect(compressor);
  bodyShape.connect(compressor);
  compressor.connect(output).connect(context.destination);
  crack.start(now);
  body.start(now);
  crack.stop(now + 0.08);
  body.stop(now + 0.25);
}

function playShotgunReload() {
  const reloadSound = shotgunReloadAudio.cloneNode();
  reloadSound.volume = 1;
  const playback = reloadSound.play();
  if (playback) playback.catch((error) => console.warn('[audio] shotgun reload playback failed:', error));
}

function playRifleReload() {
  const reloadSound = rifleReloadAudio.cloneNode();
  reloadSound.volume = 1;
  const playback = reloadSound.play();
  if (playback) playback.catch((error) => console.warn('[audio] rifle reload playback failed:', error));
}

let firstPersonWeapon = null;

function disposeFirstPersonWeapon() {
  if (!firstPersonWeapon) return;
  camera.remove(firstPersonWeapon);
  firstPersonWeapon.traverse((child) => {
    if (child.isMesh) {
      child.geometry.dispose();
      child.material.dispose();
    }
  });
  firstPersonWeapon = null;
}

function createFirstPersonWeapon() {
  disposeFirstPersonWeapon();

  const weapon = new THREE.Group();
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0xd76522, roughness: 0.38, metalness: 0.72 });
  const gripMaterial = new THREE.MeshStandardMaterial({ color: 0x8f3518, roughness: 0.82, metalness: 0.12 });
  const accentMetal = new THREE.MeshStandardMaterial({ color: 0xffb347, roughness: 0.3, metalness: 0.88 });
  const handMaterial = new THREE.MeshStandardMaterial({ color: 0xd99a78, roughness: 0.8 });
  const barrelLength = player.weapon === 'rifle' ? 0.95 : 0.78;
  const addPart = (geometry, material, position, rotation = null) => {
    const part = new THREE.Mesh(geometry, material);
    part.position.copy(position);
    if (rotation) part.rotation.set(rotation.x, rotation.y, rotation.z);
    weapon.add(part);
    return part;
  };

  const receiver = new THREE.Mesh(
    new THREE.BoxGeometry(player.weapon === 'rifle' ? 0.34 : 0.42, 0.24, 0.58),
    darkMetal
  );
  receiver.position.set(0, 0, 0);
  weapon.add(receiver);

  if (player.weapon === 'rifle') {
    addPart(new THREE.CylinderGeometry(0.055, 0.07, barrelLength, 12), darkMetal, new THREE.Vector3(0, 0, -0.58 - barrelLength / 2), new THREE.Vector3(Math.PI / 2, 0, 0));
    addPart(new THREE.BoxGeometry(0.3, 0.12, 0.5), darkMetal, new THREE.Vector3(0, -0.03, 0.48));
    addPart(new THREE.BoxGeometry(0.18, 0.28, 0.14), gripMaterial, new THREE.Vector3(0, -0.25, 0.03), new THREE.Vector3(-0.15, 0, 0));
    addPart(new THREE.BoxGeometry(0.13, 0.3, 0.22), darkMetal, new THREE.Vector3(0, -0.25, 0.1), new THREE.Vector3(-0.2, 0, 0));
    addPart(new THREE.BoxGeometry(0.16, 0.34, 0.22), gripMaterial, new THREE.Vector3(0, -0.27, 0.2), new THREE.Vector3(-0.18, 0, 0));
    // Rear aperture sight: a square frame attached to the rifle.
    const sightMaterial = new THREE.MeshStandardMaterial({
      color: 0x18232b,
      roughness: 0.42,
      metalness: 0.8,
      emissive: 0x0b1d25,
      emissiveIntensity: 0.35
    });
    addPart(new THREE.BoxGeometry(0.035, 0.14, 0.035), sightMaterial, new THREE.Vector3(-0.07, 0.22, -0.08));
    addPart(new THREE.BoxGeometry(0.035, 0.14, 0.035), sightMaterial, new THREE.Vector3(0.07, 0.22, -0.08));
    addPart(new THREE.BoxGeometry(0.14, 0.035, 0.035), sightMaterial, new THREE.Vector3(0, 0.29, -0.08));
  } else {
    addPart(new THREE.CylinderGeometry(0.075, 0.09, barrelLength, 12), darkMetal, new THREE.Vector3(-0.09, 0, -0.58 - barrelLength / 2), new THREE.Vector3(Math.PI / 2, 0, 0));
    addPart(new THREE.CylinderGeometry(0.075, 0.09, barrelLength, 12), darkMetal, new THREE.Vector3(0.09, 0, -0.58 - barrelLength / 2), new THREE.Vector3(Math.PI / 2, 0, 0));
    addPart(new THREE.BoxGeometry(0.36, 0.12, 0.48), gripMaterial, new THREE.Vector3(0, -0.08, 0.46));
    addPart(new THREE.BoxGeometry(0.34, 0.08, 0.28), darkMetal, new THREE.Vector3(0, -0.13, -0.33));
    addPart(new THREE.BoxGeometry(0.3, 0.1, 0.28), gripMaterial, new THREE.Vector3(0, -0.17, -0.48));
    addPart(new THREE.BoxGeometry(0.16, 0.4, 0.2), gripMaterial, new THREE.Vector3(0, -0.29, 0.18), new THREE.Vector3(-0.2, 0, 0));
    addPart(new THREE.BoxGeometry(0.12, 0.05, 0.28), accentMetal, new THREE.Vector3(0, 0.16, -0.29));
    // Front sight post on top of the shotgun barrel.
    addPart(new THREE.BoxGeometry(0.045, 0.14, 0.045), accentMetal, new THREE.Vector3(0, 0.22, -0.58));
  }

  const hand = addPart(new THREE.SphereGeometry(0.13, 12, 8), handMaterial, new THREE.Vector3(0, -0.2, -0.12));
  hand.scale.set(1, 0.75, 1.25);

  const supportHand = addPart(new THREE.SphereGeometry(0.12, 12, 8), handMaterial, new THREE.Vector3(0, -0.08, -0.48));
  supportHand.scale.set(1, 0.8, 1.3);

  weapon.position.set(0.42, -0.38, -0.82);
  weapon.rotation.set(-0.08, -0.08, 0.04);
  const muzzleClearance = 0.01;
  weapon.userData.muzzlePosition = new THREE.Vector3(
    0,
    0,
    -0.58 - barrelLength - muzzleClearance
  );
  weapon.userData.basePosition = weapon.position.clone();
  weapon.userData.baseRotation = weapon.rotation.clone();
  weapon.visible = state.started && player.alive;
  camera.add(weapon);
  firstPersonWeapon = weapon;
}

function updateFirstPersonWeapon() {
  if (!firstPersonWeapon) return;
  firstPersonWeapon.visible = state.started && player.alive;

  const basePosition = firstPersonWeapon.userData.basePosition;
  const baseRotation = firstPersonWeapon.userData.baseRotation;
  if (player.reloadTimer > 0 && player.reloadDuration > 0) {
    const progress = 1 - player.reloadTimer / player.reloadDuration;
    const dip = Math.sin(progress * Math.PI) * 0.16;
    const tilt = Math.sin(progress * Math.PI) * 0.9;
    firstPersonWeapon.position.set(
      basePosition.x + 0.08 * Math.sin(progress * Math.PI),
      basePosition.y - dip,
      basePosition.z + 0.12 * Math.sin(progress * Math.PI)
    );
    firstPersonWeapon.rotation.set(
      baseRotation.x + tilt,
      baseRotation.y,
      baseRotation.z - tilt * 0.35
    );
  } else {
    firstPersonWeapon.position.copy(basePosition);
    firstPersonWeapon.rotation.copy(baseRotation);
    if (state.aimHeld) {
      firstPersonWeapon.position.x -= 0.34;
      firstPersonWeapon.position.y += 0.16;
      firstPersonWeapon.position.z += 0.2;
      firstPersonWeapon.rotation.y *= 0.2;
      firstPersonWeapon.rotation.z *= 0.2;
    }
  }
}

function updateAimState() {
  camera.fov = 75;
  camera.updateProjectionMatrix();
  if (cross) cross.style.opacity = state.aimHeld ? '0' : '0.9';
  updateFirstPersonWeapon();
}

function getWeaponMuzzlePosition(localOffset = new THREE.Vector3()) {
  if (!firstPersonWeapon) return camera.position.clone();
  camera.updateMatrixWorld(true);
  return firstPersonWeapon.userData.muzzlePosition.clone()
    .add(localOffset)
    .applyMatrix4(firstPersonWeapon.matrixWorld);
}

function getWeaponAimDirection(origin) {
  const cameraDirection = new THREE.Vector3();
  const cameraWorldPosition = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);
  camera.getWorldPosition(cameraWorldPosition);
  const aimPoint = cameraWorldPosition.addScaledVector(cameraDirection, 100);
  return aimPoint.sub(origin).normalize();
}

function getShotgunPelletDirection(origin, spreadX, spreadY) {
  const aimDirection = getWeaponAimDirection(origin);
  const cameraRight = new THREE.Vector3();
  const cameraUp = new THREE.Vector3();
  camera.updateMatrixWorld(true);
  cameraRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  cameraUp.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
  return aimDirection
    .addScaledVector(cameraRight, spreadX)
    .addScaledVector(cameraUp, spreadY)
    .normalize();
}

// Multiplayer client: connect to server and manage remote players
let socket = null;
let currentArenaCode = null; // join code of the arena this client is currently deployed into (if any)
let hasConnectedBefore = false; // distinguishes a fresh connect from a reconnect after a drop
const remotePlayers = new Map(); // id -> { mesh, data }

// player.position.y (sent over the network) is camera/eye height, which is
// 1.7 when standing on the ground. Remote player models are built with feet
// at local y=0, so this offset converts eye-height network data into the
// ground-level y the model should actually sit at.
const EYE_HEIGHT = 1.7;

// The leg meshes are 1.0 tall cylinders centered at local y=0, so they
// extend from y=-0.5 to y=0.5 — the model's actual feet are at y=-0.5, not
// y=0. This offset lifts the group so the feet (not the local origin) touch
// the ground.
const MODEL_GROUND_OFFSET = 0.5;

function createForcefieldVisual() {
  const material = new THREE.MeshBasicMaterial({
    color: 0x5cf4c8,
    transparent: true,
    opacity: 0.3,
    wireframe: true,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.45, 24, 16),
    material
  );
  mesh.renderOrder = 2;
  return { mesh, material };
}

function createRemotePlayer(id, data = {}) {
  if (remotePlayers.has(id)) return;
  // build a simple humanoid group: torso, head, and limbs
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x6fc8ff, emissive: 0x0b4f66, roughness: 0.6 });

  // torso
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.2, 8), bodyMat);
  torso.position.y = 0.9;
  group.add(torso);

  // head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), bodyMat);
  head.position.y = 1.7;
  group.add(head);

  // left arm
  const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 8), bodyMat);
  lArm.position.set(-0.6, 1.05, 0);
  group.add(lArm);

  // right arm
  const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 8), bodyMat);
  rArm.position.set(0.6, 1.05, 0);
  group.add(rArm);

  // left leg — pivoted at the hip (y=0.5 local) so it swings naturally instead
  // of rotating around its own middle
  const lLegPivot = new THREE.Group();
  lLegPivot.position.set(-0.22, 0.5, 0);
  const lLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.0, 8), bodyMat);
  lLeg.position.set(0, -0.5, 0);
  lLegPivot.add(lLeg);
  group.add(lLegPivot);

  // right leg
  const rLegPivot = new THREE.Group();
  rLegPivot.position.set(0.22, 0.5, 0);
  const rLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.0, 8), bodyMat);
  rLeg.position.set(0, -0.5, 0);
  rLegPivot.add(rLeg);
  group.add(rLegPivot);

  const forcefield = createForcefieldVisual();
  forcefield.mesh.position.y = 1;
  forcefield.mesh.visible = false;
  group.add(forcefield.mesh);

  group.position.set(data.x || 0, (data.y ?? EYE_HEIGHT) - EYE_HEIGHT + MODEL_GROUND_OFFSET, data.z || 42);
  group.userData = {
    health: data.health ?? 100,
    alive: data.alive ?? true,
    radius: 0.9,
    spawnProtectionUntil: data.spawnProtectionUntil ?? 0,
    spawnProtected: data.spawnProtected === true
  };
  group.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  scene.add(group);
  remotePlayers.set(id, {
    mesh: group,
    data,
    legs: { left: lLegPivot, right: rLegPivot },
    forcefield,
    lastPos: new THREE.Vector2(group.position.x, group.position.z),
    walkPhase: 0,
    isWalking: false
  });
}

// Remote player meshes are grounded at the feet (see EYE_HEIGHT/MODEL_GROUND_OFFSET
// fix above), but hit detection should target roughly torso height (local y=0.9
// on the model), not the group's origin.
function remoteHitCenter(mesh) {
  return mesh.position.clone().add(new THREE.Vector3(0, 0.9, 0));
}

function removeRemotePlayer(id) {
  const p = remotePlayers.get(id);
  if (p) {
    scene.remove(p.mesh);
    p.forcefield.mesh.geometry.dispose();
    p.forcefield.material.dispose();
    remotePlayers.delete(id);
  }
}

function updateRemotePlayer(id, data = {}) {
  const p = remotePlayers.get(id);
  if (!p) return;
  p.data = Object.assign(p.data || {}, data);
  if (data.x !== undefined && data.y !== undefined && data.z !== undefined) {
    p.mesh.position.set(data.x, data.y - EYE_HEIGHT + MODEL_GROUND_OFFSET, data.z);

    // figure out how far they moved horizontally since the last update to
    // decide whether the legs should be swinging
    const moved = Math.hypot(data.x - p.lastPos.x, data.z - p.lastPos.y);
    p.isWalking = moved > 0.03;
    p.lastPos.set(data.x, data.z);
  }
  if (data.health !== undefined) p.mesh.userData.health = data.health;
  if (data.alive !== undefined) p.mesh.userData.alive = data.alive;
  if (data.spawnProtectionUntil !== undefined) {
    p.mesh.userData.spawnProtectionUntil = data.spawnProtectionUntil;
  }
  if (data.spawnProtected !== undefined) {
    p.mesh.userData.spawnProtected = data.spawnProtected === true;
  }
}

// swing remote players' legs back and forth while they're moving, and ease
// them back to a neutral stance when they stop
function updateRemoteWalkAnimations(dt) {
  const WALK_SPEED = 9;
  const MAX_SWING = 0.6;

  for (const p of remotePlayers.values()) {
    const protectionRemaining = p.mesh.userData.spawnProtectionUntil - Date.now();
    p.forcefield.mesh.visible = p.mesh.userData.spawnProtected === true && protectionRemaining > 0;
    if (p.forcefield.mesh.visible) {
      p.forcefield.mesh.rotation.y += dt * 1.8;
      p.forcefield.mesh.rotation.x += dt * 0.7;
      p.forcefield.material.opacity = 0.2 + Math.min(0.18, protectionRemaining / 3000 * 0.18);
    }

    if (!p.legs) continue;

    if (p.isWalking && p.mesh.userData.alive !== false) {
      p.walkPhase += dt * WALK_SPEED;
      const swing = Math.sin(p.walkPhase) * MAX_SWING;
      p.legs.left.rotation.x = swing;
      p.legs.right.rotation.x = -swing;
    } else {
      // ease back to standing straight
      p.legs.left.rotation.x = THREE.MathUtils.lerp(p.legs.left.rotation.x, 0, Math.min(1, dt * 8));
      p.legs.right.rotation.x = THREE.MathUtils.lerp(p.legs.right.rotation.x, 0, Math.min(1, dt * 8));
    }
  }
}

// -------------------------------
// DEBUG: fake walking player for testing the walk animation solo.
// Press T to spawn/despawn a dummy that patrols in a circle in front of
// spawn, using the exact same createRemotePlayer/updateRemotePlayer path a
// real remote player would use — no second browser tab needed.
// -------------------------------
const DEBUG_WALKER_ID = '__debug_walker__';
const debugWalker = { active: false, angle: 0 };

function toggleDebugWalker() {
  if (debugWalker.active) {
    removeRemotePlayer(DEBUG_WALKER_ID);
    debugWalker.active = false;
    console.log('[debug] walker removed');
  } else {
    const startX = player.position.x + 8;
    const startZ = player.position.z;
    createRemotePlayer(DEBUG_WALKER_ID, { x: startX, y: EYE_HEIGHT, z: startZ, health: 100, alive: true });
    debugWalker.active = true;
    debugWalker.angle = 0;
    console.log('[debug] walker spawned — press T again to remove');
  }
}

function updateDebugWalker(dt) {
  if (!debugWalker.active) return;
  const centerX = player.position.x + 8;
  const centerZ = player.position.z;
  const radius = 6;
  const angularSpeed = 0.8; // radians/sec — controls how "fast" it walks

  debugWalker.angle += dt * angularSpeed;
  const x = centerX + Math.cos(debugWalker.angle) * radius;
  const z = centerZ + Math.sin(debugWalker.angle) * radius;

  updateRemotePlayer(DEBUG_WALKER_ID, { x, y: EYE_HEIGHT, z, health: 100, alive: true });
}

// username handling: persist and update UI
let playerName = localStorage.getItem('rival_username') || '';
const lobbyUsernameInput = document.getElementById('lobbyUsernameInput');
if (lobbyUsernameInput) lobbyUsernameInput.value = playerName;

function setPlayerName(name) {
  playerName = String(name || '').trim().substring(0, 24);
  if (!playerName) playerName = '';
  localStorage.setItem('rival_username', playerName);
  if (lobbyUsernameInput && document.activeElement !== lobbyUsernameInput) lobbyUsernameInput.value = playerName;
  try {
    if (socket && socket.connected) socket.emit('update', { name: playerName });
  } catch (e) { /* ignore */ }
}

(function initSocket() {
  try {
    if (typeof io === 'undefined') {
      console.warn('socket.io client not available (io is undefined)');
      return;
    }

    // connect to same origin
    socket = io();

    socket.on('connect', () => {
      console.log('Connected to multiplayer server', socket.id);
      if (connectionBanner) connectionBanner.style.display = 'none';
      if (hasConnectedBefore && currentArenaCode) {
        // This is a reconnect after a dropped connection (common over an
        // unstable tunnel, e.g. localtunnel) rather than the first-ever
        // connect. Socket.IO gives us a brand-new connection id here, and
        // the server already removed our old id from the arena the moment
        // the drop happened — so without this, we'd keep rendering locally
        // as if nothing happened while the server has completely forgotten
        // about us (invisible to other players and to /admin). Silently
        // restore our spot in the same arena.
        rejoinCurrentArena();
      }
      hasConnectedBefore = true;
    });

    socket.on('disconnect', () => {
      if (connectionBanner) {
        connectionBanner.textContent = 'Connection lost — reconnecting…';
        connectionBanner.style.display = 'block';
      }
    });

    socket.on('init-players', (players) => {
      Object.entries(players).forEach(([id, pd]) => {
        if (id === socket.id) return;
        createRemotePlayer(id, pd);
      });
    });

    socket.on('players-list', (players) => {
      // replace current remote players with authoritative list
      const ids = new Set(Object.keys(players));
      // remove ones not present
      for (const id of Array.from(remotePlayers.keys())) {
        if (!ids.has(id)) removeRemotePlayer(id);
      }
      // ensure all present
      Object.entries(players).forEach(([id, pd]) => {
        if (id === socket.id) return;
        if (!remotePlayers.has(id)) createRemotePlayer(id, pd);
        else updateRemotePlayer(id, pd);
      });
      if (typeof updateArenaPlayerCount === 'function') updateArenaPlayerCount(ids.size);
    });

    socket.on('player-joined', (id, pd) => {
      if (id === socket.id) return;
      createRemotePlayer(id, pd);
    });

    socket.on('player-left', (id) => {
      removeRemotePlayer(id);
    });

    socket.on('player-update', (id, pd) => {
      if (id === socket.id) return;
      updateRemotePlayer(id, pd);
    });

    socket.on('player-fired', (id, payload) => {
      if (id === socket.id) return;
      try {
        playGunshot(payload.weapon);
        const origin = new THREE.Vector3(payload.position.x, payload.position.y, payload.position.z);
        const dir = new THREE.Vector3(payload.dir.x, payload.dir.y, payload.dir.z);
        // spawn projectile visuals for remote fire so shots are visible
        if (payload.weapon === 'shotgun') {
          for (let i = 0; i < 8; i += 1) {
            const shotDir = dir.clone();
            shotDir.x += (Math.random() - 0.5) * 0.12;
            shotDir.y += (Math.random() - 0.5) * 0.12;
            shotDir.z += (Math.random() - 0.5) * 0.12;
            shotDir.normalize();
            spawnProjectile(origin.clone(), shotDir, { ownerId: id, speed: 120, ttl: 1.0, damage: 10, color: 0xffefb8 });
          }
        }

      } catch (e) { /* ignore malformed payload */ }
    });

    socket.on('player-hit', (targetId, damage) => {
      if (!socket) return;
      if (socket.id === targetId) {
        applyDamage(damage);
      }
    });

    socket.on('server-chat', (entry) => {
      appendChatMessage(entry);
    });

    socket.on('kicked-from-arena', () => {
      for (const id of Array.from(remotePlayers.keys())) removeRemotePlayer(id);
      currentArenaCode = null;
      if (arenaCodePopup) arenaCodePopup.style.display = 'none';
      if (arenaActionButton) arenaActionButton.title = 'Create a new arena';
      if (joinButton) joinButton.style.display = '';
      resetToLobby();
      overlayMsg.textContent = 'You were kicked from the arena — click PLAY to rejoin';
      overlayMsg.style.display = 'block';
      if (controls.isLocked) controls.unlock();
    });

    // periodically send our state to the server
    setInterval(() => {
      if (!socket || !socket.connected || !currentArenaCode) return;
      socket.emit('update', {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
        rotY: camera.rotation.y,
        weapon: player.weapon,
        health: player.health,
        alive: player.alive,
        name: playerName
      });
    }, 100);
  } catch (err) {
    console.warn('Multiplayer init failed', err);
  }
}());

// -------------------------------
// ARENAS: create a new one, join one by code, or matchmake at random
// -------------------------------
function getDeployName() {
  return playerName || `Player-${Math.floor(Math.random() * 1000)}`;
}

// Pointer lock can only be requested synchronously inside a real user
// gesture (a click/keydown handler) — browsers silently refuse it once
// you're inside an async callback (e.g. after awaiting a server round
// trip). So every deploy path below calls this FIRST, before the
// socket.emit(...) that confirms the arena, rather than waiting for the
// server's reply to start the lock request.
function tryLockPointer() {
  if (!controls.isLocked && !isTouchDevice && typeof document.body.requestPointerLock === 'function') {
    try {
      document.body.requestPointerLock();
    } catch (error) {
      // Some browsers block pointer lock; continue starting the match anyway.
    }
  }
}

const arenaActionButton = document.getElementById('arenaActionButton');
const joinButton = document.getElementById('joinButton');
const connectionBanner = document.getElementById('connectionBanner');
const arenaCodePopup = document.getElementById('arenaCodePopup');
const arenaCodeText = document.getElementById('arenaCodeText');
const arenaPlayerCount = document.getElementById('arenaPlayerCount');
const copyArenaCodeBtn = document.getElementById('copyArenaCodeBtn');

// Shows how many players the server currently has in THIS arena — a quick,
// visible way to confirm you actually landed in a populated arena rather
// than trusting the join succeeded silently.
function updateArenaPlayerCount(count) {
  if (!arenaPlayerCount) return;
  arenaPlayerCount.textContent = `${count} player${count === 1 ? '' : 's'} online`;
}
const joinCodeModal = document.getElementById('joinCodeModal');
const joinCodeInput = document.getElementById('joinCodeInput');
const joinCodeError = document.getElementById('joinCodeError');
const joinCodeCancel = document.getElementById('joinCodeCancel');

// Marks us as deployed into an arena: the corner icon switches from
// "create" to "show join code", and Join (no longer relevant) hides.
function setCurrentArena(code) {
  currentArenaCode = code;
  if (arenaCodeText) arenaCodeText.textContent = code;
  if (arenaActionButton) arenaActionButton.title = 'Show join code';
  if (joinButton) joinButton.style.display = 'none';
}

function toggleArenaCodePopup() {
  if (!arenaCodePopup || !currentArenaCode) return;
  arenaCodePopup.style.display = arenaCodePopup.style.display === 'block' ? 'none' : 'block';
}

// Called once the server has confirmed we're in an arena (create/join/random)
function deployIntoArena() {
  startGame();
}

// Called after a reconnect (not the first connect) when we believe we were
// already in an arena. Restores our server-side membership in that same
// arena WITHOUT resetting local match state (position/health/score) — the
// player shouldn't notice this happened at all if it succeeds.
function rejoinCurrentArena() {
  if (!currentArenaCode || !socket || !socket.connected) return;
  const codeToRejoin = currentArenaCode;
  socket.emit('join-arena', { code: codeToRejoin, name: getDeployName() }, (res) => {
    if (!res || !res.ok) {
      // Most likely the server itself restarted and no longer knows this
      // code at all — nothing more we can do automatically.
      console.warn('Could not rejoin arena after reconnect:', res && res.error);
      if (connectionBanner) {
        connectionBanner.textContent = 'Reconnected, but could not rejoin the arena — please create or join again.';
        connectionBanner.style.display = 'block';
      }
    }
  });
}

function createArena() {
  if (!socket || !socket.connected) return;
  tryLockPointer();
  socket.emit('create-arena', { name: getDeployName() }, (res) => {
    if (res && res.ok) {
      setCurrentArena(res.code);
      deployIntoArena();
      // auto-show the code right away so it's easy to share with friends
      if (arenaCodePopup) arenaCodePopup.style.display = 'block';
    }
  });
}

if (arenaActionButton) {
  arenaActionButton.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentArenaCode) {
      toggleArenaCodePopup();
    } else {
      createArena();
    }
  });
}

if (copyArenaCodeBtn) {
  copyArenaCodeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentArenaCode) return;
    try {
      navigator.clipboard.writeText(currentArenaCode);
      copyArenaCodeBtn.textContent = 'Copied!';
      setTimeout(() => { copyArenaCodeBtn.textContent = 'Copy'; }, 1200);
    } catch (e2) { /* clipboard API unavailable — code is still shown on screen */ }
  });
}

function openJoinCodeModal() {
  if (!joinCodeModal) return;
  joinCodeModal.style.display = 'flex';
  if (joinCodeError) joinCodeError.textContent = '';
  if (joinCodeInput) { joinCodeInput.value = ''; joinCodeInput.focus(); }
  if (controls.isLocked) controls.unlock();
}

function closeJoinCodeModal() {
  if (!joinCodeModal) return;
  joinCodeModal.style.display = 'none';
}

function attemptJoinByCode() {
  if (!joinCodeInput || !socket || !socket.connected) return;
  const code = joinCodeInput.value.trim().toUpperCase();
  if (!code) return;
  tryLockPointer();
  socket.emit('join-arena', { code, name: getDeployName() }, (res) => {
    if (res && res.ok) {
      setCurrentArena(res.code);
      closeJoinCodeModal();
      deployIntoArena();
    } else {
      // Bad code — release the lock we optimistically grabbed so the
      // player can see the cursor again to fix their typo.
      if (controls.isLocked) controls.unlock();
      if (joinCodeError) joinCodeError.textContent = (res && res.error) || 'Could not join that arena.';
    }
  });
}

if (joinButton) joinButton.addEventListener('click', (e) => { e.stopPropagation(); openJoinCodeModal(); });
if (joinCodeCancel) joinCodeCancel.addEventListener('click', (e) => { e.stopPropagation(); closeJoinCodeModal(); });
if (joinCodeModal) joinCodeModal.addEventListener('click', (e) => { if (e.target === joinCodeModal) closeJoinCodeModal(); });
if (joinCodeInput) {
  joinCodeInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') attemptJoinByCode();
    else if (e.key === 'Escape') closeJoinCodeModal();
  });
}

// username modal UI bindings
const usernameButton = document.getElementById('usernameButton');
const usernameModal = document.getElementById('usernameModal');
const usernameInput = document.getElementById('usernameInput');
const usernameSave = document.getElementById('usernameSave');
const usernameCancel = document.getElementById('usernameCancel');

function openUsernameModal() {
  if (!usernameModal) return;
  usernameModal.style.display = 'flex';
  if (usernameInput) { usernameInput.value = playerName || ''; usernameInput.focus(); usernameInput.select(); }
  // Pointer Lock hides the cursor and captures all mouse movement as camera
  // look input, so there's no real cursor to click Save/Cancel with while
  // it's active — release it so the modal is actually usable mid-match.
  if (controls.isLocked) controls.unlock();
}
function closeUsernameModal() {
  if (!usernameModal) return;
  usernameModal.style.display = 'none';
  // resume play if a match is in progress and this isn't a touch device
  if (state.started && player.alive && !isTouchDevice) {
    controls.lock();
  }
}

if (usernameButton) usernameButton.addEventListener('click', (e) => { e.stopPropagation(); openUsernameModal(); });
if (usernameCancel) usernameCancel.addEventListener('click', (e) => { e.stopPropagation(); closeUsernameModal(); });
if (usernameSave) usernameSave.addEventListener('click', (e) => { e.stopPropagation(); setPlayerName(usernameInput.value || ''); closeUsernameModal(); });
if (usernameInput) usernameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { setPlayerName(usernameInput.value || ''); closeUsernameModal(); } else if (e.key === 'Escape') { closeUsernameModal(); } });

// click outside modal to close
if (usernameModal) usernameModal.addEventListener('click', (e) => { if (e.target === usernameModal) closeUsernameModal(); });

// inline lobby username box (next to PLAY) — quick-set name before deploying.
// The Username button/modal above stays available too, including mid-match.
if (lobbyUsernameInput) {
  lobbyUsernameInput.addEventListener('focus', () => {
    if (controls.isLocked) controls.unlock();
  });
  lobbyUsernameInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      setPlayerName(lobbyUsernameInput.value || '');
      lobbyUsernameInput.blur();
    } else if (e.key === 'Escape') {
      lobbyUsernameInput.value = playerName;
      lobbyUsernameInput.blur();
    }
  });
  lobbyUsernameInput.addEventListener('blur', () => {
    setPlayerName(lobbyUsernameInput.value || '');
  });
}

const bots = [];
const isTouchDevice = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const touchLook = { active: false, lastX: 0, lastY: 0 };
const touchActions = {
  forward: false,
  back: false,
  left: false,
  right: false,
  jump: false,
  fire: false
};

if (isTouchDevice) {
  mobileControls.classList.add('visible');
}

// Guards against touch input getting "stuck" across a death/respawn — if the
// player was mid-touch on the joystick or fire button at the exact moment
// they died, the corresponding pointerup can be missed, leaving moveState/
// fireHeld set from before. Called on every deploy (fresh game or respawn).
function resetInputState() {
  moveState.forward = 0;
  moveState.back = 0;
  moveState.left = 0;
  moveState.right = 0;
  touchActions.forward = false;
  touchActions.back = false;
  touchActions.left = false;
  touchActions.right = false;
  touchActions.jump = false;
  touchActions.fire = false;
  touchLook.active = false;
  state.fireHeld = false;
  state.aimHeld = false;
  updateAimState();
  if (typeof resetJoystick === 'function') resetJoystick();
}

const cross = document.createElement('div');
cross.id = 'crosshair';
cross.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8ae2ff" stroke-width="1.6"><circle cx="12" cy="12" r="3" /><path d="M12 2v5M12 17v5M2 12h5M17 12h5" stroke-linecap="round"/></svg>';
document.body.appendChild(cross);

// -------------------------------
// GAME CHAT (always-visible top-left panel)
// -------------------------------
const CHAT_MAX_LINES = 8;
let chatting = false;

function appendChatMessage(entry) {
  if (!gameChatLog || !entry) return;

  const isAdmin = entry.from === 'admin';
  const line = document.createElement('div');
  line.className = isAdmin ? 'chat-line chat-admin' : 'chat-line';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'chat-name';
  nameSpan.textContent = isAdmin ? 'ADMIN:' : `${entry.from}:`;

  line.appendChild(nameSpan);
  line.appendChild(document.createTextNode(` ${entry.text}`));

  gameChatLog.appendChild(line);
  while (gameChatLog.children.length > CHAT_MAX_LINES) {
    gameChatLog.removeChild(gameChatLog.firstChild);
  }
}

function openChatInput() {
  if (!gameChatInput) return;
  gameChatInput.focus();
}

function closeChatInput() {
  if (!gameChatInput) return;
  gameChatInput.blur();
}

function sendChatMessage() {
  if (!gameChatInput) return;
  const text = gameChatInput.value.trim();
  if (text) {
    try {
      if (socket && socket.connected) socket.emit('chat', text);
    } catch (e) { /* ignore */ }
  }
  gameChatInput.value = '';
  closeChatInput();
}

if (gameChatInput) {
  // The box is always visible now (so touch devices can just tap it), so
  // "chatting" tracks real focus rather than an explicit open/close toggle.
  gameChatInput.addEventListener('focus', () => {
    chatting = true;
    if (controls.isLocked) controls.unlock();
  });
  gameChatInput.addEventListener('blur', () => {
    chatting = false;
    if (state.started && player.alive && !isTouchDevice) controls.lock();
  });
  gameChatInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') sendChatMessage();
    else if (e.key === 'Escape') { gameChatInput.value = ''; closeChatInput(); }
  });
}

// On desktop, Enter also works as a shortcut to jump straight into the
// always-visible chat box without reaching for the mouse.
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Enter') return;
  if (chatting) return;
  if (usernameModal && usernameModal.style.display === 'flex') return;
  if (joinCodeModal && joinCodeModal.style.display === 'flex') return;
  openChatInput();
});

function updateHud() {
  hud.health.textContent = `Health: ${Math.max(0, Math.floor(player.health))}`;
  hud.armor.textContent = `Armor: ${Math.max(0, Math.floor(player.armor))}`;
  hud.weapon.textContent = `Weapon: ${player.weapon === 'rifle' ? 'Rifle' : 'Shotgun'}`;

  hud.objective.textContent = 'Objective: Sweep the arena and defend your land.';

  if (!firstPersonWeapon || firstPersonWeapon.userData.weapon !== player.weapon) {
    createFirstPersonWeapon();
    firstPersonWeapon.userData.weapon = player.weapon;
  }
  updateFirstPersonWeapon();

  // update weapon info card
  try {
    if (weaponIconEl) {
      const name = player.weapon === 'rifle' ? 'Rifle' : 'Shotgun';
      const ammoText = player.weapon === 'rifle'
        ? `${player.rifleAmmo}/${player.rifleMagazineSize} (∞ reserve)`
        : `${player.shotgunAmmo}/${player.shotgunReserve}`;
      const reloadPct = (player.reloadDuration && player.reloadDuration > 0) ? Math.max(0, Math.min(1, 1 - (player.reloadTimer / player.reloadDuration))) : 0;
      const reloadBar = `<div class="reload-bar"><div class="reload-fill" style="width:${Math.round(reloadPct * 100)}%"></div></div>`;

      weaponIconEl.innerHTML = `
        <div class="weapon-info">
          <div class="weapon-name">${name}</div>
          <div class="ammo-count">${ammoText}</div>
          ${player.reloadTimer > 0 ? reloadBar : ''}
        </div>
      `;
    }
  } catch (e) { /* ignore rendering errors */ }
}

function resetPlayer() {
  player.position.set(0, 1.7, 42);
  camera.position.copy(player.position);
  controls.getObject().position.copy(player.position);
  player.velocity.set(0, 0, 0);
  player.grounded = true;
  player.health = 100;
  player.armor = 25;
  player.weapon = 'rifle';
  player.weaponCooldown = 0;
  player.reloadTimer = 0;
  player.rifleAmmo = player.rifleMagazineSize;
  player.shotgunAmmo = 8;
  player.shotgunReserve = 18;
  player.spawnProtectionTimer = 3;
  createSpawnForcefield();
  player.message = 'Arena live';
  state.win = false;
  state.objectiveProgress = 0;
  state.score = 0;
  state.round = 1;
  updateHud();
}

function resetToLobby() {
  state.mode = 'lobby';
  state.started = false;
  player.position.copy(LOBBY_SPAWN);
  camera.position.copy(player.position);
  controls.getObject().position.copy(player.position);
  player.velocity.set(0, 0, 0);
  player.grounded = true;
  player.health = 100;
  player.armor = 25;
  player.alive = true;
  player.spawnProtectionTimer = 0;
  if (typeof updateSpawnForcefield === 'function') updateSpawnForcefield(0);
  player.message = 'In the lobby — press PLAY to deploy';
  updateHud();
}

function spawnBot() {
  const botRadius = 1.1;
  const bot = new THREE.Mesh(
    new THREE.SphereGeometry(botRadius, 18, 18),
    new THREE.MeshStandardMaterial({ color: 0xff5c7a, emissive: 0x5d121b, emissiveIntensity: 0.8 })
  );

  const angle = Math.random() * Math.PI * 2;
  const radius = 42 + Math.random() * 18;
  bot.position.set(Math.cos(angle) * radius, 1.1, Math.sin(angle) * radius);
  bot.castShadow = true;
  bot.receiveShadow = true;
  bot.userData = {
    hp: 34 + state.round * 8,
    radius: botRadius,
    speed: 3.2 + Math.random() * 2.2 + state.round * 0.25,
    shootCooldown: 1.2 + Math.random() * 1.4,
    drift: Math.random() * Math.PI * 2,
    hitFlash: 0,
    id: state.botId++
  };
  scene.add(bot);
  bots.push(bot);
}

function startWave() {
  // Bot spawning disabled
  player.message = `Round ${state.round}: arena ready`;
  updateHud();
}

function clearBots() {
  bots.forEach((bot) => scene.remove(bot));
  bots.length = 0;
}

function startGame() {
  state.mode = 'arena';
  tryLockPointer();
  resetPlayer();
  resetInputState();
  clearBots();
  startWave();
  state.started = true;
  overlayMsg.style.display = 'none';
  const deployBarEl = document.getElementById('deployBar');
  if (deployBarEl) deployBarEl.classList.add('hidden');
}

const playButton = document.getElementById('playButton');
if (playButton) {
  playButton.addEventListener('click', (event) => {
    event.stopPropagation();
    unlockAudio();
    if (state.mode !== 'lobby') return;
    if (!socket || !socket.connected) return;
    tryLockPointer();
    // Matchmake into a random existing arena. If there are none yet, the
    // server creates one. If there's exactly one, it's used regardless of
    // whether anyone else is currently in it.
    socket.emit('join-random-arena', { name: getDeployName() }, (res) => {
      if (res && res.ok) {
        setCurrentArena(res.code);
        deployIntoArena();
      }
    });
  });
}

function reloadWeapon() {
  if (player.reloadTimer > 0) return;
  if (player.weapon === 'rifle' && player.rifleAmmo === player.rifleMagazineSize) return;
  if (player.weapon === 'shotgun' && (player.shotgunAmmo === 8 || player.shotgunReserve <= 0)) return;
  player.reloadDuration = player.weapon === 'shotgun' ? 4.5 : 3.5;
  player.reloadTimer = player.reloadDuration;
  if (player.weapon === 'shotgun') playShotgunReload();
  else playRifleReload();
  player.message = `Reloading ${player.weapon}`;
  updateHud();
}

function completeReload() {
  if (player.weapon === 'rifle') {
    player.rifleAmmo = player.rifleMagazineSize;
    player.message = 'Rifle reloaded';
    player.reloadDuration = 0;
    updateHud();
    return;
  }
  const needed = Math.max(0, 8 - player.shotgunAmmo);
  const loaded = Math.min(needed, player.shotgunReserve);
  player.shotgunAmmo += loaded;
  player.shotgunReserve -= loaded;
  player.message = 'Magazine loaded';
  // clear reload duration
  player.reloadDuration = 0;
  updateHud();
}

function switchWeapon() {
  if (!state.started || !player.alive || player.reloadTimer > 0) return;
  player.weapon = player.weapon === 'rifle' ? 'shotgun' : 'rifle';
  player.message = `Switched to ${player.weapon === 'rifle' ? 'rifle' : 'shotgun'}`;
  updateHud();
}

// projectile visuals and logic
const projectiles = [];
const spawnForcefield = {
  mesh: null,
  material: null
};

function createSpawnForcefield() {
  if (spawnForcefield.mesh) {
    scene.remove(spawnForcefield.mesh);
    spawnForcefield.mesh.geometry.dispose();
    spawnForcefield.material.dispose();
  }

  const forcefield = createForcefieldVisual();
  spawnForcefield.mesh = forcefield.mesh;
  spawnForcefield.material = forcefield.material;
  scene.add(spawnForcefield.mesh);
}

function updateSpawnForcefield(dt) {
  if (player.spawnProtectionTimer <= 0) {
    if (spawnForcefield.mesh) {
      scene.remove(spawnForcefield.mesh);
      spawnForcefield.mesh.geometry.dispose();
      spawnForcefield.material.dispose();
      spawnForcefield.mesh = null;
      spawnForcefield.material = null;
    }
    return;
  }

  player.spawnProtectionTimer = Math.max(0, player.spawnProtectionTimer - dt);
  if (!spawnForcefield.mesh) createSpawnForcefield();
  spawnForcefield.mesh.position.copy(player.position);
  spawnForcefield.mesh.rotation.y += dt * 1.8;
  spawnForcefield.mesh.rotation.x += dt * 0.7;
  spawnForcefield.material.opacity = 0.2 + Math.min(0.18, player.spawnProtectionTimer / 3 * 0.18);
}

function spawnProjectile(origin, direction, opts = {}) {
  const speed = opts.speed || 120;
  const ttl = opts.ttl || 1.5;
  const color = opts.color || 0xfff0be;
  const ownerId = opts.ownerId || null;
  const damage = opts.damage || 18;
  const radius = opts.radius || 0.08;

  const geom = new THREE.SphereGeometry(radius, 6, 6);
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8 });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.copy(origin);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  scene.add(mesh);

  projectiles.push({
    mesh,
    dir: direction.clone(),
    speed,
    ttl,
    ownerId,
    damage,
    radius
  });
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const p = projectiles[i];
    p.ttl -= dt;
    if (p.ttl <= 0) {
      scene.remove(p.mesh);
      projectiles.splice(i, 1);
      continue;
    }

    p.mesh.position.addScaledVector(p.dir, p.speed * dt);

    // check collision with bots
    for (let b = bots.length - 1; b >= 0; b -= 1) {
      const bot = bots[b];
      const dist = bot.position.distanceTo(p.mesh.position);
      if (dist < bot.userData.radius + p.radius) {
        // hit bot locally
        bot.userData.hp -= p.damage;
        bot.userData.hitFlash = 0.18;
        if (bot.userData.hp <= 0) {
          scene.remove(bot);
          bots.splice(b, 1);
          state.score += 100;
        }
        // remove projectile
        scene.remove(p.mesh);
        projectiles.splice(i, 1);
        break;
      }
    }
    if (!projectiles[i]) continue; // projectile was removed

    // check collision with remote players
    for (const [id, rp] of remotePlayers.entries()) {
      const mesh = rp.mesh;
      const dist = remoteHitCenter(mesh).distanceTo(p.mesh.position);
      const targetRadius = (mesh.userData && mesh.userData.radius) || 0.9;
      if (dist < targetRadius + p.radius) {
        // if this client fired it, report hit to server so target can be damaged
        try {
          if (socket && socket.connected && p.ownerId === (socket.id || null)) {
            socket.emit('hit', { targetId: id, damage: p.damage });
          }
        } catch (e) { /* ignore */ }
        // local visual impact
        scene.remove(p.mesh);
        projectiles.splice(i, 1);
        break;
      }
    }
    if (!projectiles[i]) continue;

    // check collision with the local player (only if projectile not fired by local client)
    if (socket && p.ownerId && p.ownerId !== socket.id) {
      const playerPos = player.position.clone();
      const distToPlayer = playerPos.distanceTo(p.mesh.position);
      if (distToPlayer < 1.7 + p.radius) {
        // apply damage locally (victim applies damage itself)
        applyDamage(p.damage);
        scene.remove(p.mesh);
        projectiles.splice(i, 1);
      }
    }
  }
}

function fireWeapon() {
  console.log('[game] fireWeapon called, started=', state.started, 'alive=', player.alive, 'weaponCooldown=', player.weaponCooldown, 'reloadTimer=', player.reloadTimer);
  if (!state.started || !player.alive) return;
  if (player.reloadTimer > 0) return;
  if (player.weaponCooldown > 0) return;

  const origin = getWeaponMuzzlePosition();
  const dir = getWeaponAimDirection(origin);
  playGunshot(player.weapon);

  if (player.weapon === 'shotgun') {
    if (player.shotgunAmmo <= 0) {
      reloadWeapon();
      return;
    }
    player.shotgunAmmo -= 1;
    for (let i = 0; i < 8; i += 1) {
      const barrelX = i % 2 === 0 ? -0.16 : 0.16;
      const pelletOrigin = getWeaponMuzzlePosition(new THREE.Vector3(barrelX, 0, -0.12));
      const shotDir = getShotgunPelletDirection(
        pelletOrigin,
        (Math.random() - 0.5) * 0.45,
        (Math.random() - 0.5) * 0.45
      );
      hitScan(pelletOrigin, shotDir, 18, 10, 0xffefb8);
      spawnProjectile(pelletOrigin, shotDir, {
        ownerId: socket && socket.id ? socket.id : null,
        speed: 140,
        ttl: 0.3,
        damage: 10,
        radius: 0.06,
        color: 0xffefb8
      });
    }
    player.weaponCooldown = 0.52;
  } else {
    if (player.rifleAmmo <= 0) {
      reloadWeapon();
      return;
    }
    player.rifleAmmo -= 1;
    player.weaponCooldown = 0.1;
    hitScan(origin, dir, 30, 18, 0xbfe7ff);
    spawnProjectile(origin.clone(), dir.clone(), {
      ownerId: socket && socket.id ? socket.id : null,
      speed: 90,
      ttl: 0.8,
      damage: 18,
      radius: 0.045,
      color: 0xffd166
    });
  }

  if ((player.weapon === 'rifle' && player.rifleAmmo === 0)
    || (player.weapon === 'shotgun' && player.shotgunAmmo === 0)) {
    reloadWeapon();
  }

  // notify server of our fire so other clients can show tracers and resolve hits locally
  try {
    if (socket && socket.connected) {
      socket.emit('fire', { position: { x: origin.x, y: origin.y, z: origin.z }, dir: { x: dir.x, y: dir.y, z: dir.z }, weapon: player.weapon });
    }
  } catch (e) { /* ignore */ }

  updateHud();
}

function hitScan(origin, direction, maxDistance, damage, color) {
  let bestTarget = null;
  let bestDistance = Infinity;
  let bestType = null;
  let bestId = null;

  // check bots
  for (const bot of bots) {
    const toBot = bot.position.clone().sub(origin);
    const projection = toBot.dot(direction);
    if (projection <= 0) continue;

    const closestPoint = origin.clone().add(direction.clone().multiplyScalar(projection));
    const distance = closestPoint.distanceTo(bot.position);
    if (distance < bot.userData.radius + 0.8 && projection < maxDistance) {
      const travelDist = projection;
      if (travelDist < bestDistance) {
        bestDistance = travelDist;
        bestTarget = bot;
        bestType = 'bot';
      }
    }
  }

  // check remote players
  for (const [id, rp] of remotePlayers.entries()) {
    const mesh = rp.mesh;
    const hitCenter = remoteHitCenter(mesh);
    const toP = hitCenter.clone().sub(origin);
    const projection = toP.dot(direction);
    if (projection <= 0) continue;

    const closestPoint = origin.clone().add(direction.clone().multiplyScalar(projection));
    const distance = closestPoint.distanceTo(hitCenter);
    const radius = (mesh.userData && mesh.userData.radius) || 0.9;
    if (distance < radius + 0.8 && projection < maxDistance) {
      const travelDist = projection;
      if (travelDist < bestDistance) {
        bestDistance = travelDist;
        bestTarget = mesh;
        bestType = 'player';
        bestId = id;
      }
    }
  }

  if (bestTarget) {
    const hit = damage * (player.weapon === 'rifle' ? 1 : 0.8);
    if (bestType === 'bot') {
      bestTarget.userData.hp -= hit;
      bestTarget.userData.hitFlash = 0.15;
      if (bestTarget.userData.hp <= 0) {
        scene.remove(bestTarget);
        const index = bots.indexOf(bestTarget);
        if (index >= 0) bots.splice(index, 1);
        state.score += 100;
        player.message = 'Target neutralized';
      }
    } else if (bestType === 'player') {
      // notify server that we hit another player
      try {
        if (socket && socket.connected) {
          socket.emit('hit', { targetId: bestId, damage: hit });
        }
      } catch (e) { /* ignore */ }
      player.message = 'Hit registered';
    }
  }
}

function applyDamage(amount) {
  if (player.spawnProtectionTimer > 0) return;

  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, amount * 0.6);
    player.armor -= absorbed;
    amount -= absorbed;
  }
  player.health -= amount;
  if (player.health <= 0) {
    player.alive = false;
    state.started = false;
    player.message = 'You were eliminated';
    overlayMsg.textContent = 'Mission failed — click to redeploy';
    overlayMsg.style.display = 'block';
    if (controls.isLocked) controls.unlock();
  }
}

function attemptObjectiveCapture(dt) {
  // Objective capture removed
}

function updateBots(dt) {
  for (let i = bots.length - 1; i >= 0; i -= 1) {
    const bot = bots[i];
    const dir = player.position.clone().sub(bot.position);
    const dist = dir.length();
    const steering = dir.clone().normalize();

    let repel = new THREE.Vector3();
    for (const obstacle of obstacles) {
      const toObstacle = bot.position.clone().sub(obstacle.mesh.position);
      const clamped = toObstacle.clone().clampScalar(-obstacle.half.x - 1.5, obstacle.half.x + 1.5);
      const offset = toObstacle.clone().sub(clamped);
      if (offset.lengthSq() > 0) {
        repel.add(offset.normalize().multiplyScalar(4));
      }
    }

    const finalDir = steering.add(repel.multiplyScalar(0.8)).normalize();
    bot.position.addScaledVector(finalDir, bot.userData.speed * dt);
    bot.position.x = THREE.MathUtils.clamp(bot.position.x, -52, 52);
    bot.position.z = THREE.MathUtils.clamp(bot.position.z, -52, 52);

    bot.userData.hitFlash = Math.max(0, bot.userData.hitFlash - dt);
    bot.material.emissiveIntensity = bot.userData.hitFlash > 0 ? 1.6 : 0.8;

    bot.userData.shootCooldown -= dt;
    if (dist < 30 && bot.userData.shootCooldown <= 0) {
      const shotDirection = player.position.clone().sub(bot.position).normalize();
      const origin = bot.position.clone().add(new THREE.Vector3(0, 0.15, 0));
      const targetDist = origin.distanceTo(player.position);
      if (targetDist < 35) {
        const damage = 8 + state.round * 1.5;
        if (player.position.distanceTo(bot.position) < 18) {
          applyDamage(damage * 0.5);
        }
        bot.userData.shootCooldown = 1.1 + Math.random() * 1.2;
        if (Math.random() < 0.65) {
        }
      }
    }

    if (dist < 2.2) {
      applyDamage(12 * dt);
    }
  }
}

function resolvePlayerCollisions() {
  const radius = 1.7;

  if (state.mode === 'lobby') {
    player.position.x = THREE.MathUtils.clamp(player.position.x, LOBBY_BOUNDS.minX, LOBBY_BOUNDS.maxX);
    player.position.z = THREE.MathUtils.clamp(player.position.z, LOBBY_BOUNDS.minZ, LOBBY_BOUNDS.maxZ);
    return;
  }

  for (const obstacle of obstacles) {
    const diffX = player.position.x - obstacle.mesh.position.x;
    const diffZ = player.position.z - obstacle.mesh.position.z;
    const overlapX = radius + obstacle.half.x - Math.abs(diffX);
    const overlapZ = radius + obstacle.half.z - Math.abs(diffZ);

    if (overlapX > 0 && overlapZ > 0) {
      if (overlapX < overlapZ) {
        player.position.x += diffX > 0 ? overlapX : -overlapX;
      } else {
        player.position.z += diffZ > 0 ? overlapZ : -overlapZ;
      }
    }
  }

  player.position.x = THREE.MathUtils.clamp(player.position.x, -54, 54);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -54, 54);
}

function updateMovement(dt) {
  const forward = moveState.forward - moveState.back;
  const side = moveState.right - moveState.left;
  const worldForward = new THREE.Vector3();
  camera.getWorldDirection(worldForward);
  worldForward.y = 0;
  worldForward.normalize();

  const rightVector = new THREE.Vector3().crossVectors(worldForward, new THREE.Vector3(0, 1, 0)).normalize();
  const moveVec = new THREE.Vector3();
  moveVec.addScaledVector(worldForward, forward);
  moveVec.addScaledVector(rightVector, side);

  if (moveVec.lengthSq() > 0) {
    moveVec.normalize().multiplyScalar(14.5 * dt);
  }

  player.position.add(moveVec);
  resolvePlayerCollisions();
  player.velocity.y -= 19 * dt;
  player.position.y += player.velocity.y * dt;
  if (player.position.y < 1.7) {
    player.position.y = 1.7;
    player.velocity.y = 0;
    player.grounded = true;
  } else {
    player.grounded = false;
  }

  camera.position.copy(player.position);
  controls.getObject().position.copy(player.position);
}

function triggerJump() {
  if (player.grounded) {
    player.velocity.y = 8.5;
    player.grounded = false;
  }
}

function handleKey(e, isDown) {
  if (chatting || (document.activeElement && document.activeElement.tagName === 'INPUT')) return;

  if (isDown) {
    if (e.code === 'KeyQ') switchWeapon();
    if (e.code === 'KeyR') reloadWeapon();
    if (e.code === 'Digit1') {
      if (player.reloadTimer <= 0) {
        player.weapon = 'rifle';
        updateHud();
      }
    }
    if (e.code === 'Digit2') {
      if (player.reloadTimer <= 0) {
        player.weapon = 'shotgun';
        updateHud();
      }
    }
    if (e.code === 'Space') triggerJump();
    if (e.code === 'KeyT' && document.activeElement?.tagName !== 'INPUT') toggleDebugWalker();
  }

  if (e.code === 'KeyE' && isDown && !e.repeat) {
    state.aimHeld = !state.aimHeld;
    updateAimState();
  }

  if (e.code === 'KeyW') moveState.forward = isDown ? 1 : 0;
  if (e.code === 'KeyS') moveState.back = isDown ? 1 : 0;
  if (e.code === 'KeyA') moveState.left = isDown ? 1 : 0;
  if (e.code === 'KeyD') moveState.right = isDown ? 1 : 0;
}

function applyJoystickPosition(clientX, clientY) {
  const rect = joystickArea.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = clientX - cx;
  const dy = clientY - cy;
  const radius = rect.width * 0.36;
  const distance = Math.min(Math.hypot(dx, dy), radius);
  const angle = Math.atan2(dy, dx);
  const clampedX = Math.cos(angle) * distance;
  const clampedY = Math.sin(angle) * distance;

  joystickKnob.style.transform = `translate(${clampedX - 21}px, ${clampedY - 21}px)`;

  const normalizedX = clampedX / radius;
  const normalizedY = clampedY / radius;

  moveState.left = normalizedX < 0 ? Math.min(1, Math.abs(normalizedX)) : 0;
  moveState.right = normalizedX > 0 ? Math.min(1, normalizedX) : 0;
  moveState.forward = normalizedY < 0 ? Math.min(1, Math.abs(normalizedY)) : 0;
  moveState.back = normalizedY > 0 ? Math.min(1, normalizedY) : 0;
}

function resetJoystick() {
  joystickKnob.style.transform = 'translate(-50%, -50%)';
  moveState.forward = 0;
  moveState.back = 0;
  moveState.left = 0;
  moveState.right = 0;
}

function bindTouchControls() {
  const joystickArea = document.getElementById('joystickArea');
  const joystickKnob = document.getElementById('joystickKnob');

  if (!joystickArea || !joystickKnob) return;

  joystickArea.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    joystickArea.setPointerCapture(event.pointerId);
    applyJoystickPosition(event.clientX, event.clientY);
  });

  joystickArea.addEventListener('pointermove', (event) => {
    if (event.pressure === 0 && !event.buttons) {
      resetJoystick();
      return;
    }
    applyJoystickPosition(event.clientX, event.clientY);
  });

  joystickArea.addEventListener('pointerup', () => resetJoystick());
  joystickArea.addEventListener('pointercancel', () => resetJoystick());

  const jumpButton = document.querySelector('[data-action="jump"]');
  if (jumpButton) {
    jumpButton.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      triggerJump();
      jumpButton.classList.add('active');
    });
    jumpButton.addEventListener('pointerup', () => jumpButton.classList.remove('active'));
    jumpButton.addEventListener('pointerleave', () => jumpButton.classList.remove('active'));
  }

  const fireButton = document.querySelector('[data-action="fire"]');
  if (fireButton) {
    fireButton.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (state.started) {
        state.fireHeld = true;
      }

      fireButton.classList.add('active');
    });
    fireButton.addEventListener('pointerup', () => {
      state.fireHeld = false;
      fireButton.classList.remove('active');
    });
    fireButton.addEventListener('pointerleave', () => {
      state.fireHeld = false;
      fireButton.classList.remove('active');
    });
  }

  const aimButton = document.querySelector('[data-action="aim"]');
  if (aimButton) {
    const toggleAiming = () => {
      state.aimHeld = state.started && !state.aimHeld;
      aimButton.classList.toggle('active', state.aimHeld);
      updateAimState();
    };
    aimButton.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      aimButton.setPointerCapture(event.pointerId);
      toggleAiming();
    });
  }

  const lookTarget = document.getElementById('c');
  lookTarget.addEventListener('pointerdown', (event) => {
    if (!isTouchDevice) return;
    touchLook.active = true;
    touchLook.lastX = event.clientX;
    touchLook.lastY = event.clientY;
  });
  lookTarget.addEventListener('pointermove', (event) => {
    if (!touchLook.active) return;
    const dx = event.clientX - touchLook.lastX;
    const dy = event.clientY - touchLook.lastY;
    touchLook.lastX = event.clientX;
    touchLook.lastY = event.clientY;
    camera.rotation.order = 'YXZ';
    camera.rotation.y -= dx * 0.004;
    camera.rotation.x -= dy * 0.003;
    camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x, -1.4, 1.4);
  });
  lookTarget.addEventListener('pointerup', () => { touchLook.active = false; });
  lookTarget.addEventListener('pointerleave', () => { touchLook.active = false; });
}

bindTouchControls();

document.addEventListener('keydown', (event) => handleKey(event, true));
document.addEventListener('keyup', (event) => handleKey(event, false));

document.addEventListener('mousedown', (event) => {
  if (chatting) return;
  unlockAudio();
  if (event.button === 0) {
    if (!state.started) {
      // Ignore clicks on UI elements — let their own handlers deal with those
      if (event.target.closest && (event.target.closest('#deployBar') || event.target.closest('#usernameButton') || event.target.closest('#usernameModal') || event.target.closest('#gameChatInputWrap') || event.target.closest('#arenaCorner') || event.target.closest('#arenaCodePopup') || event.target.closest('#joinCodeModal'))) {
        return;
      }
      // In the lobby, clicking the 3D scene just engages pointer lock so the
      // player can look around — it does NOT deploy them into the arena.
      if (state.mode === 'lobby' && !controls.isLocked && !isTouchDevice) {
        controls.lock();
      }
      return;
    }

    // Allow firing with left click even when pointer lock isn't active (shoot while standing still).
    // Avoid starting fire when clicking UI elements like the Username button.
    if (event.target.closest && (event.target.closest('#usernameButton') || event.target.closest('#arenaCorner') || event.target.closest('#arenaCodePopup'))) {
      return;
    }

    if (player.alive) {
      state.fireHeld = true;
    }
  }
});

document.addEventListener('mouseup', (event) => {
  if (event.button === 0) {
    state.fireHeld = false;
  }
});

document.addEventListener('pointerdown', unlockAudio, { once: true });

document.addEventListener('contextmenu', (event) => event.preventDefault());
document.addEventListener('dblclick', (event) => event.preventDefault());

overlayMsg.addEventListener('click', (event) => {
  try {
    // Handle redeploy after death (when player is dead and game is not started)
    if (!player.alive && !state.started) {
      resetPlayer();
      player.alive = true;
      if (socket && socket.connected) socket.emit('respawn');
      resetInputState();
      clearBots();
      startWave();
      state.started = true;
      overlayMsg.style.display = 'none';
      tryLockPointer();
      return;
    }

    // Handle pause resume
    if (!state.started) {
      return;
    }
    tryLockPointer();
  } catch (error) {
    console.error('Redeploy/resume failed:', error);
  }
});

controls.addEventListener('lock', () => {
  overlayMsg.style.display = 'none';
});

controls.addEventListener('unlock', () => {
  if (chatting) return;
  if (usernameModal && usernameModal.style.display === 'flex') return;
  if (!isTouchDevice && state.started && player.alive) {
    overlayMsg.textContent = 'Paused — click to resume battle';
    overlayMsg.style.display = 'block';
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);

  updateSpawnForcefield(dt);

  if (player.alive) {
    updateMovement(dt);
  }

  if (state.started && player.alive) {
    if (player.reloadTimer > 0) {
      player.reloadTimer -= dt;
      if (player.reloadTimer <= 0) {
        completeReload();
      }
    }

    if (player.weaponCooldown > 0) {
      player.weaponCooldown -= dt;
    }

    if (state.fireHeld) {
      fireWeapon();
    }

    updateBots(dt);
    attemptObjectiveCapture(dt);
    updateProjectiles(dt);
  }

  if (state.started && player.alive && bots.length === 0) {
    player.message = 'All enemies cleared';
  }

  updateRemoteWalkAnimations(dt);
  updateDebugWalker(dt);

  updateHud();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

resetToLobby();
scene.add(controls.getObject());
controls.getObject().position.copy(player.position);
updateHud();
animate();