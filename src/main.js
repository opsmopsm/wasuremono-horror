import * as THREE from 'three';
import { createTextures } from './textures.js';
import { HorrorAudio } from './audio.js';
import { buildSchoolMap } from './schoolMap.js';
import { RedCoatWoman } from './enemy.js';
import { SchoolNPCs } from './npcs.js';

// =========================================================================
// DOM要素
// =========================================================================
const canvas = document.getElementById('game-canvas');
const titleScreen = document.getElementById('title-screen');
const startBtn = document.getElementById('start-btn');
const pauseScreen = document.getElementById('pause-screen');
const resumeBtn = document.getElementById('resume-btn');
const gameoverScreen = document.getElementById('gameover-screen');
const gameoverEyebrow = document.getElementById('gameover-eyebrow');
const gameoverTitle = document.getElementById('gameover-title');
const gameoverText = document.getElementById('gameover-text');
const retryBtn = document.getElementById('retry-btn');

const clearScreen = document.getElementById('clear-screen');
const clearCard = document.getElementById('clear-card');
const clearEyebrow = document.getElementById('clear-eyebrow');
const clearTitle = document.getElementById('clear-title');
const clearText = document.getElementById('clear-text');
const playAgainBtn = document.getElementById('play-again-btn');

const titleEndingsEl = document.getElementById('title-endings');
const gameoverEndingsEl = document.getElementById('gameover-endings');
const clearEndingsEl = document.getElementById('clear-endings');

const hud = document.getElementById('hud');
const areaLabel = document.getElementById('area-label');
const objectiveLabel = document.getElementById('objective-label');
const staminaFill = document.getElementById('stamina-fill');
const promptEl = document.getElementById('interact-prompt');
const subtitleEl = document.getElementById('subtitle');
const speakerNameEl = document.getElementById('speaker-name');
const dialogueTextEl = document.getElementById('dialogue-text');
const dangerVignette = document.getElementById('danger-vignette');
const flashOverlay = document.getElementById('flash-overlay');
const lockerSlitOverlay = document.getElementById('locker-slit-overlay');
const mapModal = document.getElementById('map-modal');
const mapCanvas = document.getElementById('map-canvas');
const qualityBadge = document.getElementById('quality-badge');

const mobileControls = document.getElementById('mobile-controls');
const joystickZone = document.getElementById('joystick-zone');
const joystickKnob = document.getElementById('joystick-knob');
const btnInteract = document.getElementById('btn-interact');
const btnFlashlight = document.getElementById('btn-flashlight');
const btnCrouch = document.getElementById('btn-crouch');
const btnMap = document.getElementById('btn-map');
const btnQuality = document.getElementById('btn-quality');
const btnPause = document.getElementById('btn-pause');

// タッチ端末（スマホ・タブレット）自動判定
let isTouchMode = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.innerWidth <= 900;
function applyTouchModeUI() {
  document.body.classList.toggle('touch-mode', isTouchMode);
  if (mobileControls) {
    mobileControls.classList.toggle('hidden', !isTouchMode);
  }
}
applyTouchModeUI();

const invSlots = {
  pouch: document.getElementById('inv-pouch'),
  tape: document.getElementById('inv-tape'),
  key: document.getElementById('inv-key'),
  score: document.getElementById('inv-score')
};

// =========================================================================
// エンディング達成図鑑（localStorage 永続化）
// =========================================================================
const ENDING_DEFS = [
  { id: 'bad1', label: 'BAD① 新しい忘れ物', kind: 'bad' },
  { id: 'bad2', label: 'BAD② 明日でいいか', kind: 'bad' },
  { id: 'normal', label: 'NORMAL 逃げ切った夜', kind: 'normal' },
  { id: 'true', label: 'TRUE もう、忘れない', kind: 'true' }
];
const STORAGE_KEY = 'wasuremono_unlocked_endings_v1';

function loadUnlockedEndings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

const unlockedEndings = loadUnlockedEndings();

function unlockEnding(id) {
  unlockedEndings.add(id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...unlockedEndings]));
  } catch {
    // ignore storage errors
  }
  renderEndingTrackers();
}

function renderEndingTrackers() {
  const html = ENDING_DEFS.map((e) => {
    const unlocked = unlockedEndings.has(e.id);
    const cls = unlocked ? `end-badge unlocked-${e.kind}` : 'end-badge';
    return `<span class="${cls}">${unlocked ? '★ ' + e.label : '？ ' + e.label.split(' ')[0]}</span>`;
  }).join('');
  [titleEndingsEl, gameoverEndingsEl, clearEndingsEl].forEach((el) => {
    if (el) el.innerHTML = html;
  });
}
renderEndingTrackers();

// =========================================================================
// Three.js セットアップ（高精細PBR＋ACESFilmicトーンマッピング＋ソフトシャドウ）
// =========================================================================
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scanlinesEl = document.getElementById('scanlines');
let ps1Mode = false; // デフォルトを高精細リッチホラー画質に！（PキーでPS1レトロ切替可）

function updateResolution() {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  camera.aspect = aspect;
  camera.updateProjectionMatrix();

  if (ps1Mode) {
    renderer.setPixelRatio(1);
    const targetH = 270;
    const targetW = Math.round(targetH * aspect);
    renderer.setSize(targetW, targetH, false);
    canvas.classList.add('pixelated');
    if (scanlinesEl) scanlinesEl.classList.remove('subtle');
    if (qualityBadge) qualityBadge.textContent = '画質: PS1レトロ [P]';
  } else {
    const maxPR = isTouchMode ? 1.5 : 2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPR));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    canvas.classList.remove('pixelated');
    if (scanlinesEl) scanlinesEl.classList.add('subtle');
    if (qualityBadge) qualityBadge.textContent = '画質: 高精細ホラー [P]';
  }
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050811);
scene.fog = new THREE.FogExp2(0x050811, 0.068);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / Math.max(1, window.innerHeight), 0.05, 85);
window.addEventListener('resize', updateResolution);
updateResolution();

// 立体的な夜の環境光（青白い夜空からの光＋暗い床の照り返し）
const ambient = new THREE.HemisphereLight(0x3a4f78, 0x181512, 0.48);
scene.add(ambient);

// 手持ちの懐中電灯（リアルタイム・ソフトシャドウ投射！）
const flashlight = new THREE.SpotLight(0xfff1d2, 5.2, 32, Math.PI / 4.8, 0.62, 1.35);
flashlight.castShadow = true;
const shadowRes = isTouchMode ? 512 : 1024;
flashlight.shadow.mapSize.width = shadowRes;
flashlight.shadow.mapSize.height = shadowRes;
flashlight.shadow.camera.near = 0.25;
flashlight.shadow.camera.far = 30;
flashlight.shadow.bias = -0.0008;
const flashlightTarget = new THREE.Object3D();
scene.add(flashlight);
scene.add(flashlightTarget);
flashlight.target = flashlightTarget;

const playerGlow = new THREE.PointLight(0xaec2de, 0.42, 4.6, 1.8);
scene.add(playerGlow);

// =========================================================================
// ワールド構築
// =========================================================================
const textures = createTextures();
const audio = new HorrorAudio();
const schoolMap = buildSchoolMap(scene, textures);
const enemy = new RedCoatWoman(scene, textures);
const npcs = new SchoolNPCs(scene);

// =========================================================================
// ゲーム状態・プレイヤー状態・ストーリー進行
// =========================================================================
let gameState = 'title'; // title | playing | paused | jumpscare | gameover | clear
let mapOpen = false;

const player = {
  pos: new THREE.Vector3(12, 0, 13.5),
  yaw: 0,
  pitch: 0,
  radius: 0.42,
  stamina: 100,
  flashlightOn: true,
  savedFlashlightOn: true,
  crouching: false,
  hiding: false,
  hidingLocker: null,
  seenHiding: false,
  peekYawOffset: 0,
  peekPitch: 0,
  bobTime: 0,
  stepTimer: 0,
  heartbeatTimer: 0
};

const story = {
  checkedDesk: false,
  enemyTriggered: false,
  entered2A: false,
  enteredMusicRoom: false,
  enteredScienceScare: false,
  enteredArtScare: false,
  hidFirstTime: false,
  giveUpCount: 0,        // 忘れ物なしで昇降口を調べた回数（2回目でBAD END②）
  sealedWarnCount: 0,    // 準備不足で楽器庫を開けようとした回数（2回目でBAD END①罠）
  tapePlayed: false,
  ghostReleased: false,  // TRUE END 条件達成フラグ
  items: {
    pouch: false,
    tape: false,
    key: false,
    score: false
  },
  notesFound: new Set()
};

let dialogueQueue = [];
let subtitleTimer = 0;
let jumpscareTimer = 0;
let pendingBadEnding = 'bad1';

function updateInventoryHUD() {
  for (const [k, el] of Object.entries(invSlots)) {
    if (el) el.classList.toggle('owned', !!story.items[k]);
  }
}

function updateObjectiveText() {
  if (story.ghostReleased) {
    objectiveLabel.textContent = story.items.pouch
      ? '目標: 静かになった校舎の1F出口から外へ出る（TRUE END）'
      : '目標: 音楽室で自分の忘れ物ポーチを取って1F出口へ向かう';
  } else if (story.items.key && story.items.score) {
    objectiveLabel.textContent = '目標: 別館2F 音楽準備室の「封鎖された楽器収納庫」を開放する！';
  } else if (story.items.pouch) {
    objectiveLabel.textContent = '目標: 1F出口から脱出する（または真相の鍵と楽譜を探して楽器庫を開放する）';
  } else if (story.checkedDesk) {
    objectiveLabel.textContent = '目標: 東棟2F渡り廊下から別館2Fの音楽室へ行く';
  } else {
    objectiveLabel.textContent = '目標: 2F 2年A組で忘れ物を探す';
  }
}

function showDialogue(speaker, text, duration = 5.0, isGhost = false) {
  dialogueQueue = [];
  applyDialogue(speaker, text, duration, isGhost);
}

function queueDialogues(entries) {
  if (!entries || entries.length === 0) return;
  const [first, ...rest] = entries;
  dialogueQueue = rest;
  applyDialogue(first.speaker, first.text, first.duration || 4.8, !!first.isGhost);
}

function applyDialogue(speaker, text, duration, isGhost) {
  speakerNameEl.textContent = speaker ? `【${speaker}】` : '';
  dialogueTextEl.textContent = text;
  subtitleEl.classList.toggle('ghost-voice', !!isGhost);
  subtitleEl.classList.add('visible');
  subtitleTimer = duration;
}

function triggerFlash(color = 'rgba(255,255,255,0.45)', ms = 180) {
  flashOverlay.style.background = color;
  flashOverlay.style.opacity = '1';
  setTimeout(() => {
    flashOverlay.style.opacity = '0';
  }, ms);
}

// =========================================================================
// ロッカーに隠れる／出るシステム（隙間から外が見える！）
// =========================================================================
function enterLocker(locker) {
  if (player.hiding) return;

  const enemyDist = enemy.position.distanceTo(player.pos);
  const sameFloor = Math.abs(enemy.position.y - player.pos.y) < 1.8;
  player.seenHiding = (
    enemy.active &&
    enemy.state === 'chase' &&
    sameFloor &&
    enemyDist < 4.5 &&
    enemy.hasLineOfSight(player.pos, schoolMap.colliders)
  );

  player.hiding = true;
  player.hidingLocker = locker;
  player.crouching = false;
  player.savedFlashlightOn = player.flashlightOn;
  player.flashlightOn = false;
  player.peekYawOffset = 0;
  player.peekPitch = 0;
  player.heartbeatTimer = 0.2;

  locker.doorMesh.visible = false;
  locker.collider.active = false;
  lockerSlitOverlay.classList.remove('hidden');
  audio.playLockerToggle(true);

  if (player.seenHiding) {
    showDialogue('美咲', '「っ、見られた！？ まずい、こっちへ来てる……！」', 4.0);
  } else if (!story.hidFirstTime) {
    story.hidFirstTime = true;
    showDialogue('美咲', '「息を殺さないと……ロッカーの隙間から外が見える……！」', 4.5);
  }
}

function exitLocker(silent = false) {
  if (!player.hiding || !player.hidingLocker) return;
  const locker = player.hidingLocker;

  locker.doorMesh.visible = true;
  locker.collider.active = true;
  lockerSlitOverlay.classList.add('hidden');

  player.pos.copy(locker.exitPos);
  player.yaw = locker.faceYaw;
  player.pitch = 0;
  player.flashlightOn = player.savedFlashlightOn;
  player.hiding = false;
  player.hidingLocker = null;
  player.seenHiding = false;

  if (!silent) {
    audio.playLockerToggle(false);
  }
}

// =========================================================================
// リセット＆起動
// =========================================================================
function resetGame() {
  if (player.hiding) exitLocker(true);

  player.pos.set(12, 0, 13.5);
  player.yaw = 0;
  player.pitch = 0;
  player.stamina = 100;
  player.flashlightOn = true;
  player.savedFlashlightOn = true;
  player.crouching = false;

  story.checkedDesk = false;
  story.enemyTriggered = false;
  story.entered2A = false;
  story.enteredMusicRoom = false;
  story.enteredScienceScare = false;
  story.enteredArtScare = false;
  story.hidFirstTime = false;
  story.giveUpCount = 0;
  story.sealedWarnCount = 0;
  story.tapePlayed = false;
  story.ghostReleased = false;
  story.items = { pouch: false, tape: false, key: false, score: false };
  story.notesFound.clear();

  // 夜の暗闇に戻す
  scene.fog.density = 0.068;
  scene.fog.color.setHex(0x050811);
  ambient.intensity = 0.48;

  for (const d of schoolMap.doors) {
    d.isOpen = false;
    d.progress = 0;
    d.collider.active = true;
    if (d.axis === 'x') d.mesh.position.x = d.closedPos;
    else d.mesh.position.z = d.closedPos;
  }

  for (const l of schoolMap.lockers) {
    l.doorMesh.visible = true;
    l.collider.active = true;
  }

  for (const item of schoolMap.interactables) {
    if (item.type === 'pouch' || item.type === 'key_item') {
      item.collected = false;
      if (item.mesh) item.mesh.visible = true;
      if (item.light) item.light.visible = true;
    }
    if (item.id === 'sealed_locker') {
      if (item.releaseLight) item.releaseLight.intensity = 0.0;
    }
  }

  enemy.deactivate();
  npcs.reset();

  updateInventoryHUD();
  updateObjectiveText();
  dangerVignette.style.opacity = '0';
  lockerSlitOverlay.classList.add('hidden');
  mapOpen = false;
  mapModal.classList.add('hidden');

  queueDialogues([
    {
      speaker: '美咲',
      text: '「吹奏楽部の片付けで、すっかり夜になっちゃった……」',
      duration: 3.6
    },
    {
      speaker: '美咲',
      text: '「友達の由香には先に帰ってもらったけど、家の鍵と楽譜のポーチを2年A組の机に忘れたはず。早く取って帰ろう！」',
      duration: 5.4
    }
  ]);
}

function activateRedCoatWoman(spawnPos, dialogueEntries = null) {
  if (story.enemyTriggered || story.ghostReleased) return;
  story.enemyTriggered = true;
  npcs.vanishAll();
  enemy.activate(spawnPos || new THREE.Vector3(34, 4, 5));
  audio.playDistantPiano();
  if (dialogueEntries) queueDialogues(dialogueEntries);
}

// =========================================================================
// 入力管理（キーボード・マウス ＋ スマホ用マルチタッチ操作）
// =========================================================================
const keys = {};
const touchJoy = { x: 0, y: 0, running: false, id: null, cx: 0, cy: 0 };
const touchLook = { id: null, lastX: 0, lastY: 0 };

function requestLockIfDesktop() {
  if (!isTouchMode && canvas.requestPointerLock) {
    try {
      canvas.requestPointerLock();
    } catch {
      // ignore
    }
  }
}

function exitLockSafe() {
  if (document.pointerLockElement && document.exitPointerLock) {
    try {
      document.exitPointerLock();
    } catch {
      // ignore
    }
  }
}

function toggleFlashlight() {
  if (player.hiding) return;
  player.flashlightOn = !player.flashlightOn;
  audio.playFlashlightClick();
}

function toggleCrouch() {
  if (player.hiding) return;
  player.crouching = !player.crouching;
}

function triggerInteractOrExit() {
  if (player.hiding) {
    exitLocker(false);
  } else {
    tryInteract();
  }
}

function toggleMapModal() {
  mapOpen = !mapOpen;
  mapModal.classList.toggle('hidden', !mapOpen);
  if (mapOpen) drawSchoolMap2D();
}

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;

  if (gameState !== 'playing') return;

  if (e.code === 'KeyF') toggleFlashlight();
  if (e.code === 'KeyC' || e.code === 'ControlLeft') toggleCrouch();
  if (e.code === 'KeyE') triggerInteractOrExit();
  if (e.code === 'KeyM' || e.code === 'Tab') {
    e.preventDefault();
    toggleMapModal();
  }
  if (e.code === 'KeyP') {
    ps1Mode = !ps1Mode;
    updateResolution();
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

// タッチ操作を初めて検出したら自動でスマホUIを有効化
window.addEventListener('touchstart', () => {
  if (!isTouchMode) {
    isTouchMode = true;
    applyTouchModeUI();
  }
}, { passive: true });

// --- バーチャルジョイスティック（左手移動＋大きく倒すと自動ダッシュ！） ---
if (joystickZone && joystickKnob) {
  const maxR = 46;
  const updateJoyFromPoint = (clientX, clientY) => {
    const dx = clientX - touchJoy.cx;
    const dy = clientY - touchJoy.cy;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(maxR, dist);
    const angle = Math.atan2(dy, dx);
    const nx = dist > 4 ? (Math.cos(angle) * clamped) / maxR : 0;
    const ny = dist > 4 ? (Math.sin(angle) * clamped) / maxR : 0;
    touchJoy.x = nx;
    touchJoy.y = ny;
    touchJoy.running = (clamped / maxR) > 0.82;
    joystickKnob.style.transform = `translate(${nx * maxR}px, ${ny * maxR}px)`;
  };

  joystickZone.addEventListener('touchstart', (e) => {
    if (gameState !== 'playing') return;
    e.preventDefault();
    const t = e.changedTouches[0];
    const rect = joystickZone.getBoundingClientRect();
    touchJoy.id = t.identifier;
    touchJoy.cx = rect.left + rect.width / 2;
    touchJoy.cy = rect.top + rect.height / 2 - 8;
    updateJoyFromPoint(t.clientX, t.clientY);
  }, { passive: false });

  joystickZone.addEventListener('touchmove', (e) => {
    if (touchJoy.id === null) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === touchJoy.id) {
        updateJoyFromPoint(t.clientX, t.clientY);
      }
    }
  }, { passive: false });

  const endJoy = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === touchJoy.id) {
        touchJoy.id = null;
        touchJoy.x = 0;
        touchJoy.y = 0;
        touchJoy.running = false;
        joystickKnob.style.transform = 'translate(0px, 0px)';
      }
    }
  };
  joystickZone.addEventListener('touchend', endJoy);
  joystickZone.addEventListener('touchcancel', endJoy);
}

// --- 画面スワイプで視点操作（右手ドラッグ、ロッカー内でも覗ける！） ---
canvas.addEventListener('touchstart', (e) => {
  if (gameState !== 'playing') return;
  for (const t of e.changedTouches) {
    if (touchLook.id === null && t.identifier !== touchJoy.id) {
      touchLook.id = t.identifier;
      touchLook.lastX = t.clientX;
      touchLook.lastY = t.clientY;
    }
  }
}, { passive: true });

canvas.addEventListener('touchmove', (e) => {
  if (gameState !== 'playing' || touchLook.id === null) return;
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === touchLook.id) {
      const dx = t.clientX - touchLook.lastX;
      const dy = t.clientY - touchLook.lastY;
      touchLook.lastX = t.clientX;
      touchLook.lastY = t.clientY;
      const sens = 0.0046;
      if (player.hiding) {
        player.peekYawOffset = Math.max(-0.56, Math.min(0.56, player.peekYawOffset - dx * sens));
        player.peekPitch = Math.max(-0.28, Math.min(0.28, player.peekPitch - dy * sens));
      } else {
        player.yaw -= dx * sens;
        player.pitch = Math.max(-1.25, Math.min(1.25, player.pitch - dy * sens));
      }
    }
  }
}, { passive: false });

const endLook = (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === touchLook.id) {
      touchLook.id = null;
    }
  }
};
canvas.addEventListener('touchend', endLook);
canvas.addEventListener('touchcancel', endLook);

// --- スマホ用アクションボタン ---
function bindMobileBtn(el, handler) {
  if (!el) return;
  el.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (gameState === 'playing') handler();
  }, { passive: false });
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    if (gameState === 'playing') handler();
  });
}

bindMobileBtn(btnInteract, triggerInteractOrExit);
bindMobileBtn(btnFlashlight, toggleFlashlight);
bindMobileBtn(btnCrouch, toggleCrouch);
bindMobileBtn(btnMap, toggleMapModal);
bindMobileBtn(btnQuality, () => {
  ps1Mode = !ps1Mode;
  updateResolution();
});
bindMobileBtn(btnPause, () => {
  gameState = 'paused';
  pauseScreen.classList.remove('hidden');
});

// 見取り図モーダルはタップ／クリックでも閉じられる
mapModal.addEventListener('click', () => {
  if (mapOpen) toggleMapModal();
});
mapModal.addEventListener('touchstart', (e) => {
  if (mapOpen) {
    e.preventDefault();
    toggleMapModal();
  }
}, { passive: false });

window.addEventListener('mousemove', (e) => {
  if (gameState !== 'playing' || document.pointerLockElement !== canvas) return;
  const sens = 0.0022;
  if (player.hiding) {
    player.peekYawOffset = Math.max(-0.56, Math.min(0.56, player.peekYawOffset - e.movementX * sens));
    player.peekPitch = Math.max(-0.28, Math.min(0.28, player.peekPitch - e.movementY * sens));
  } else {
    player.yaw -= e.movementX * sens;
    player.pitch = Math.max(-1.25, Math.min(1.25, player.pitch - e.movementY * sens));
  }
});

document.addEventListener('pointerlockchange', () => {
  if (!isTouchMode && document.pointerLockElement !== canvas && gameState === 'playing') {
    gameState = 'paused';
    pauseScreen.classList.remove('hidden');
  }
});

canvas.addEventListener('click', () => {
  if (gameState === 'playing' && !isTouchMode && document.pointerLockElement !== canvas) {
    requestLockIfDesktop();
  }
});

startBtn.addEventListener('click', () => {
  audio.init();
  resetGame();
  titleScreen.classList.add('hidden');
  hud.classList.remove('hidden');
  gameState = 'playing';
  requestLockIfDesktop();
});

resumeBtn.addEventListener('click', () => {
  pauseScreen.classList.add('hidden');
  gameState = 'playing';
  requestLockIfDesktop();
});

retryBtn.addEventListener('click', () => {
  gameoverScreen.classList.add('hidden');
  resetGame();
  gameState = 'playing';
  requestLockIfDesktop();
});

playAgainBtn.addEventListener('click', () => {
  clearScreen.classList.add('hidden');
  resetGame();
  gameState = 'playing';
  requestLockIfDesktop();
});

// =========================================================================
// 衝突判定＆押し戻し解決（サブステップ移動で絶対に壁を貫通しない！）
// =========================================================================
function collidesAt(x, y, z) {
  const r = player.radius;
  const pMinY = y + 0.15;
  const pMaxY = y + (player.crouching ? 1.05 : 1.65);

  for (const c of schoolMap.colliders) {
    if (c.active === false) continue;
    if (pMaxY <= c.minY || pMinY >= c.maxY) continue;
    if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) {
      return true;
    }
  }
  return false;
}

// 万一ドア開閉や角でめり込んだ場合、最短軸で必ず壁の外側へ押し戻す
function pushOutOfWalls() {
  const r = player.radius;
  const pMinY = player.pos.y + 0.15;
  const pMaxY = player.pos.y + (player.crouching ? 1.05 : 1.65);

  for (let iter = 0; iter < 3; iter++) {
    let pushed = false;
    for (const c of schoolMap.colliders) {
      if (c.active === false) continue;
      if (pMaxY <= c.minY || pMinY >= c.maxY) continue;
      const overlapL = (player.pos.x + r) - c.minX;
      const overlapR = c.maxX - (player.pos.x - r);
      const overlapT = (player.pos.z + r) - c.minZ;
      const overlapB = c.maxZ - (player.pos.z - r);
      if (overlapL > 0 && overlapR > 0 && overlapT > 0 && overlapB > 0) {
        const minOverlap = Math.min(overlapL, overlapR, overlapT, overlapB);
        if (minOverlap === overlapL) player.pos.x -= overlapL + 0.002;
        else if (minOverlap === overlapR) player.pos.x += overlapR + 0.002;
        else if (minOverlap === overlapT) player.pos.z -= overlapT + 0.002;
        else player.pos.z += overlapB + 0.002;
        pushed = true;
      }
    }
    if (!pushed) break;
  }
}

function updatePlayer(dt) {
  if (player.hiding && player.hidingLocker) {
    const locker = player.hidingLocker;
    player.stamina = Math.min(100, player.stamina + 18 * dt);
    staminaFill.style.width = `${player.stamina}%`;

    camera.position.copy(locker.insideCamPos);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = locker.faceYaw + player.peekYawOffset;
    camera.rotation.x = player.peekPitch;

    flashlight.visible = false;
    const fwd = new THREE.Vector3(-Math.sin(locker.faceYaw), 0, -Math.cos(locker.faceYaw));
    playerGlow.position.copy(locker.insideCamPos).addScaledVector(fwd, 0.8);

    return {
      flashlightOn: false,
      crouching: true,
      running: false,
      hiding: true,
      hidingLocker: locker,
      seenHiding: player.seenHiding
    };
  }

  const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));

  const move = new THREE.Vector3();
  if (keys['KeyW'] || keys['ArrowUp']) move.add(forward);
  if (keys['KeyS'] || keys['ArrowDown']) move.sub(forward);
  if (keys['KeyD'] || keys['ArrowRight']) move.add(right);
  if (keys['KeyA'] || keys['ArrowLeft']) move.sub(right);

  // スマホのバーチャルジョイスティック入力を合成
  if (Math.abs(touchJoy.y) > 0.08) move.addScaledVector(forward, -touchJoy.y);
  if (Math.abs(touchJoy.x) > 0.08) move.addScaledVector(right, touchJoy.x);

  const isMoving = move.lengthSq() > 0.001;
  const wantsRun = ((keys['ShiftLeft'] || keys['ShiftRight']) || touchJoy.running) && isMoving && !player.crouching && player.stamina > 2;

  if (wantsRun) {
    player.stamina = Math.max(0, player.stamina - 14 * dt);
  } else {
    player.stamina = Math.min(100, player.stamina + 26 * dt);
  }
  staminaFill.style.width = `${player.stamina}%`;

  const speed = player.crouching ? 1.85 : wantsRun ? 5.7 : 3.25;

  if (isMoving) {
    move.normalize().multiplyScalar(speed * dt);
    // サブステップ分割（最大0.07m刻み）で高速ダッシュ時でも壁すり抜けを完全防止
    const dist = Math.hypot(move.x, move.z);
    const steps = Math.max(1, Math.ceil(dist / 0.07));
    const sx = move.x / steps;
    const sz = move.z / steps;

    for (let i = 0; i < steps; i++) {
      if (!collidesAt(player.pos.x + sx, player.pos.y, player.pos.z)) {
        player.pos.x += sx;
      }
      if (!collidesAt(player.pos.x, player.pos.y, player.pos.z + sz)) {
        player.pos.z += sz;
      }
    }
    pushOutOfWalls();

    const targetY = schoolMap.getFloorHeight(player.pos.x, player.pos.z, player.pos.y);
    player.pos.y += (targetY - player.pos.y) * Math.min(1, dt * 16);

    const bobFreq = wantsRun ? 12.5 : player.crouching ? 5.0 : 8.0;
    player.bobTime += dt * bobFreq;
    player.stepTimer -= dt;
    if (player.stepTimer <= 0) {
      audio.playFootstep(wantsRun);
      player.stepTimer = wantsRun ? 0.31 : player.crouching ? 0.65 : 0.48;
    }
  } else {
    pushOutOfWalls();
    player.bobTime = 0;
  }

  const eyeH = player.crouching ? 0.95 : 1.56;
  const bobOffset = isMoving ? Math.sin(player.bobTime) * (wantsRun ? 0.065 : 0.038) : 0;
  camera.position.set(player.pos.x, player.pos.y + eyeH + bobOffset, player.pos.z);

  camera.rotation.order = 'YXZ';
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;

  flashlight.visible = player.flashlightOn;
  if (player.flashlightOn) {
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
    const rightVec = new THREE.Vector3(1, 0, 0).applyEuler(camera.rotation);
    // 壁際でも懐中電灯が壁の裏に突き抜けないようオフセットを小さく抑える
    flashlight.position.copy(camera.position)
      .addScaledVector(rightVec, 0.07)
      .add(new THREE.Vector3(0, -0.10 + bobOffset * 0.4, 0));
    flashlightTarget.position.copy(camera.position).addScaledVector(dir, 8);
  }
  playerGlow.position.copy(camera.position);

  // --- エリア到達時の自動セリフ＆フェイク恐怖イベント ---
  if (!story.entered2A && player.pos.y > 3 && player.pos.y < 6 && player.pos.x > -6 && player.pos.x < 4 && player.pos.z < -10.3) {
    story.entered2A = true;
    showDialogue('美咲', '「2年A組に着いた……たしか真ん中の自分の机に置いたはずなんだけど……」', 4.5);
  }

  if (!story.enemyTriggered && !story.ghostReleased && player.pos.x > 24 && player.pos.y > 2.5) {
    activateRedCoatWoman(new THREE.Vector3(34, 4, 6.5), [
      { speaker: '美咲', text: '「……っ！ 急に空気が冷たくなった……別館の廊下の奥に、赤いコートの誰かがいる！？」', duration: 4.5 },
      { speaker: '赤いコートの女', text: '「……ワスレモノ……ドコ……」', duration: 3.8, isGhost: true }
    ]);
  }

  if (!story.enteredMusicRoom && player.pos.y > 3 && player.pos.y < 6 && player.pos.x > 36.5 && player.pos.z < 3.5) {
    story.enteredMusicRoom = true;
    showDialogue('美咲', '「音楽室……！ ピアノの上にポーチが見えた！ 危なかったらロッカーに隠れよう……」', 5.0);
  }

  // 3F 理科室フェイクびっくり（人体模型）
  if (!story.enteredScienceScare && player.pos.y > 7 && player.pos.x > 6 && player.pos.x < 13.8 && player.pos.z < -11.5) {
    story.enteredScienceScare = true;
    audio.playThudScare();
    triggerFlash('rgba(220, 235, 255, 0.25)', 140);
    showDialogue('美咲', '「きゃっ！！ ……な、なんだ、人体模型か……びっくりした……」', 4.5);
  }

  // 別館1F 美術室フェイク演出（石膏像）
  if (!story.enteredArtScare && player.pos.y < 2 && player.pos.x > 36.8 && player.pos.z > -1.8 && player.pos.z < 3.6) {
    story.enteredArtScare = true;
    audio.playThudScare();
    showDialogue('美咲', '「うわっ……美術室の石膏像、今こっちを見た気がした……」', 4.5);
  }

  return {
    flashlightOn: player.flashlightOn,
    crouching: player.crouching,
    running: wantsRun,
    hiding: false,
    hidingLocker: null,
    seenHiding: false
  };
}

// =========================================================================
// インタラクション（ロッカー・NPC・ドア・机・忘れ物・鍵アイテム・楽器庫・脱出）
// =========================================================================
function findNearestTarget() {
  if (player.hiding) return null;

  const camPos = camera.position;
  const lookDir = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);

  let best = null;
  let bestScore = Infinity;

  for (const l of schoolMap.lockers) {
    const dist = camPos.distanceTo(l.center);
    if (dist > 2.4) continue;
    const toTarget = l.center.clone().sub(camPos).normalize();
    if (lookDir.dot(toTarget) < 0.35 && dist > 1.3) continue;
    if (dist < bestScore) {
      bestScore = dist;
      best = { kind: 'locker', ref: l, label: 'ロッカーに隠れる [E]' };
    }
  }

  for (const npc of npcs.getList()) {
    const npcCenter = npc.pos.clone().add(new THREE.Vector3(0, 1.35, 0));
    const dist = camPos.distanceTo(npcCenter);
    if (dist > 2.8) continue;
    const toTarget = npcCenter.sub(camPos).normalize();
    if (lookDir.dot(toTarget) < 0.3 && dist > 1.4) continue;
    if (dist < bestScore) {
      bestScore = dist;
      best = { kind: 'npc', ref: npc, label: `${npc.speaker}と話す [E]` };
    }
  }

  for (const d of schoolMap.doors) {
    const dist = camPos.distanceTo(d.center);
    if (dist > 2.6) continue;
    const toTarget = d.center.clone().sub(camPos).normalize();
    if (lookDir.dot(toTarget) < 0.35 && dist > 1.3) continue;
    if (dist < bestScore) {
      bestScore = dist;
      best = { kind: 'door', ref: d, label: `${d.label}を${d.isOpen ? '閉める' : '開ける'} [E]` };
    }
  }

  for (const item of schoolMap.interactables) {
    if (item.collected) continue;
    const dist = camPos.distanceTo(item.position);
    if (dist > item.radius) continue;
    const toTarget = item.position.clone().sub(camPos).normalize();
    if (lookDir.dot(toTarget) < 0.25 && dist > 1.4) continue;
    if (dist < bestScore) {
      bestScore = dist;
      let label = item.label;
      if (item.type === 'sealed_locker') {
        if (story.ghostReleased) label = '解放された楽器収納庫を見る [E]';
        else if (story.items.key && story.items.score) label = '鍵と楽譜を使って楽器収納庫を開放する [E]';
        else if (story.sealedWarnCount >= 1) label = '無理やり楽器収納庫をこじ開ける [E]（危険）';
      } else if (item.id === 'exit_main' && !story.items.pouch && story.giveUpCount >= 1) {
        label = '忘れ物を諦めてそのまま帰る [E]';
      }
      best = { kind: 'item', ref: item, label };
    }
  }

  return best;
}

function tryInteract() {
  const target = findNearestTarget();
  if (!target) return;

  if (target.kind === 'locker') {
    enterLocker(target.ref);
    return;
  }

  if (target.kind === 'npc') {
    const res = npcs.talkTo(target.ref);
    showDialogue(res.speaker, res.text, 5.5);
    return;
  }

  if (target.kind === 'door') {
    const d = target.ref;
    if (d.locked) {
      showDialogue('美咲', d.lockMsg, 3.5);
      return;
    }
    d.isOpen = !d.isOpen;
    d.collider.active = !d.isOpen;
    audio.playDoorSlide();
    return;
  }

  const item = target.ref;

  // --- 2年A組の自分の机 ---
  if (item.type === 'desk') {
    if (!story.checkedDesk) {
      story.checkedDesk = true;
      audio.playPickup();
      updateObjectiveText();
      activateRedCoatWoman(new THREE.Vector3(34, 4, 6.5), [
        { speaker: '美咲', text: '「あれ……机の中にもロッカーにもない！？ どこに置いたっけ……！」', duration: 3.8 },
        { speaker: '美咲', text: '「そうだ、片付けの最後に【別館2Fの音楽室】のピアノの上に置いたんだ！ 東棟2Fの渡り廊下から急ごう！」', duration: 5.5 }
      ]);
    } else {
      showDialogue('美咲', '「ポーチはここにはない。東棟2Fの渡り廊下を通って、別館2Fの音楽室へ行こう」', 4.5);
    }
    return;
  }

  // --- 音楽室の忘れ物ポーチ ---
  if (item.type === 'pouch') {
    item.collected = true;
    item.mesh.visible = false;
    item.light.visible = false;
    story.items.pouch = true;
    updateInventoryHUD();
    updateObjectiveText();
    audio.playPickup();

    if (story.ghostReleased) {
      showDialogue('美咲', '「よかった、家の鍵と楽譜のポーチ！ これでやっと帰れるね……」', 4.5);
      return;
    }

    audio.playChaseStinger();
    triggerFlash('rgba(180, 10, 20, 0.35)', 240);
    queueDialogues([
      { speaker: '美咲', text: '「あった！ 家の鍵と楽譜のポーチ！ ……っ、外からメトロノームの音が近づいてくる！」', duration: 4.2 },
      { speaker: '赤いコートの女', text: '「……ミツケタ……ワスレモノ、モッテイカナイデ……」', duration: 4.0, isGhost: true },
      { speaker: '美咲', text: '「このまま1Fの出口へ逃げるか……それとも、校舎の手がかりを集めてあの子を助けてあげるか……！」', duration: 5.0 }
    ]);

    if (!story.enemyTriggered) {
      activateRedCoatWoman(new THREE.Vector3(0, 4, -8));
    }
    return;
  }

  // --- トゥルーエンド用キーアイテム（カセット・鍵・折れたリードと楽譜） ---
  if (item.type === 'key_item') {
    item.collected = true;
    item.mesh.visible = false;
    item.light.visible = false;
    story.items[item.itemKey] = true;
    updateInventoryHUD();
    updateObjectiveText();
    audio.playPickup();

    if (item.itemKey === 'tape') {
      queueDialogues([
        { speaker: '調査', text: '【古いカセットテープ】を手に入れた。ラベルに「平成10年・吹奏楽部」と書かれている。', duration: 4.2 },
        { speaker: '美咲', text: '「2Fの放送室にあるカセットデッキなら再生できるかも……！」', duration: 4.2 }
      ]);
    } else if (item.itemKey === 'key') {
      queueDialogues([
        { speaker: '調査', text: '【古びた楽器庫の鍵】を手に入れた。タグに「音楽準備室・大型収納庫」と記されている。', duration: 4.5 },
        {
          speaker: '美咲',
          text: story.items.score
            ? '「鍵も楽譜も揃った！ 別館2Fの音楽準備室にある封鎖された楽器収納庫を開けに行こう！」'
            : '「これで音楽準備室の楽器庫が開くはず……あとは別館1Fの旧倉庫に、彼女の忘れ物（楽譜）が残っているかも」',
          duration: 5.2
        }
      ]);
    } else if (item.itemKey === 'score') {
      queueDialogues([
        { speaker: '調査', text: '【シオリの折れたリードと楽譜】を手に入れた。赤いリボンが結ばれている。', duration: 4.5 },
        {
          speaker: '美咲',
          text: story.items.key
            ? '「鍵も楽譜も揃った！ 別館2Fの音楽準備室にある封鎖された楽器収納庫へ届けよう！」'
            : '「ずっと探していた本当の忘れ物は、これだったんだ……あとは3Fの理科準備室で楽器庫の鍵を見つけないと！」',
          duration: 5.2
        }
      ]);
    }
    return;
  }

  // --- 2F 放送室のカセットデッキ ---
  if (item.type === 'broadcast_deck') {
    if (!story.items.tape) {
      showDialogue('美咲', '「古いカセットデッキがある。何か録音されたテープが【3Fの視聴覚室】とかに残っていないかな……」', 5.0);
      return;
    }
    story.tapePlayed = true;
    story.notesFound.add('broadcast_tape');
    audio.playTapePlayback();
    queueDialogues([
      { speaker: 'カセット音声', text: '（ザーッ……ドン、ドン、ドン！ 内側から木箱を叩く音……）', duration: 3.2, isGhost: true },
      { speaker: 'シオリの声', text: '「……あけて……暗いよ、狭いよ……誰か気づいて……！」', duration: 4.0, isGhost: true },
      { speaker: 'カセット音声', text: '「……楽器庫の鍵は【3Fの理科準備室】に隠したよ。あいつの楽譜も【別館1Fの旧倉庫】に放り込んどいた……」', duration: 5.5, isGhost: true },
      { speaker: '美咲', text: '「そんな……！【3F 理科準備室】の鍵と、【別館1F 旧倉庫】の楽譜を見つけて、音楽準備室の楽器庫を開けてあげないと！」', duration: 5.8 }
    ]);
    return;
  }

  // --- 別館2F 音楽準備室：封鎖された古い楽器収納庫（TRUE解放 or 罠BAD END①） ---
  if (item.type === 'sealed_locker') {
    if (story.ghostReleased) {
      showDialogue('美咲', '「もう中は空っぽだ……温かい月明かりが差している。さあ、1Fの出口から帰ろう」', 4.5);
      return;
    }

    if (story.items.key && story.items.score) {
      // ★ TRUE END クライマックス：封印を解き、赤いコートの女（シオリ）を解放！
      story.ghostReleased = true;
      enemy.deactivate();
      dangerVignette.style.opacity = '0';
      audio.playTrueRelease();
      triggerFlash('rgba(255, 248, 220, 0.85)', 700);

      // 校舎の異界霧が晴れ、穏やかな夜の空気へ
      scene.fog.density = 0.036;
      scene.fog.color.setHex(0x0b1220);
      ambient.intensity = 1.15;
      if (item.releaseLight) item.releaseLight.intensity = 2.6;

      updateObjectiveText();
      queueDialogues([
        { speaker: '美咲', text: '「鍵を開けて、打ち付けられた板を外した……！ ほら、探していた楽譜とリードだよ、シオリさん！」', duration: 4.8 },
        { speaker: 'シオリ', text: '「……やっと、開けてくれた……もう、暗くない……ありがとう……」', duration: 4.8 },
        { speaker: '美咲', text: '「……空気が軽くなった。もう追いかけられる気配もしない……1Fの出口から、由香の待つ校門へ帰ろう！」', duration: 5.5 }
      ]);
      return;
    }

    // 準備不足で調べた場合（1回目：警告＆ヒント、2回目：無理やり開けて罠BAD END①！）
    story.sealedWarnCount++;
    if (story.sealedWarnCount === 1) {
      audio.playThudScare();
      queueDialogues([
        { speaker: '調査', text: '古い大型楽器用の収納庫だ。木の板がバッテンに打ち付けられ、中からメトロノームの音が響いている……', duration: 4.8 },
        { speaker: '美咲', text: '「鍵と彼女の遺品（楽譜）が揃っていないのに無理やり開けたら危ない気がする……（※もう一度調べると無理やり開けます）」', duration: 5.5 }
      ]);
    } else {
      // 罠 BAD END①『新しい忘れ物』
      audio.playJumpscare();
      triggerFlash('rgba(195, 0, 15, 0.8)', 450);
      showBadEnding(
        'bad1',
        'BAD END ① — 新しい忘れ物（罠）',
        '閉じ込められた……',
        '鍵も遺品も持たないまま収納庫の板をこじ開けた瞬間、暗闇から伸びた長い腕に中へ引きずり込まれた。\n' +
        'バタンと外から鍵がかかる音と、遠ざかっていくメトロノームの音……。\n' +
        '翌朝、誰もいない教室の机には、美咲のポーチだけがぽつんと残されていた――。'
      );
    }
    return;
  }

  // --- メモ調査 ---
  if (item.type === 'note') {
    story.notesFound.add(item.id);
    audio.playPickup();
    showDialogue('調査', item.text, 7.0);
    return;
  }

  // --- 脱出出口（BAD② / NORMAL / TRUE の3分岐！） ---
  if (item.type === 'exit') {
    if (!story.items.pouch) {
      if (item.id === 'exit_main') {
        story.giveUpCount++;
        if (story.giveUpCount === 1) {
          showDialogue('美咲', '「まだ忘れ物（家の鍵と楽譜のポーチ）を取っていない……でも怖くなってきた。（※もう一度調べると、諦めてそのまま帰ります）」', 5.5);
          return;
        }
        // 隠し BAD END②『明日でいいか』
        audio.playBoneCrack();
        triggerFlash('rgba(160, 0, 15, 0.65)', 350);
        showBadEnding(
          'bad2',
          'BAD END ② — 明日でいいか（隠しエンド）',
          '家の前で待っていたもの',
          '怖さに耐えきれず、忘れ物を諦めてそのまま暗い夜道を家まで走って帰った。\n' +
          '玄関の前で立ち尽くす――そうだ、家の鍵はあのポーチの中だった。\n' +
          'そのとき背後から、ボキボキと関節の鳴る音と「……ワスレモノ、トドケニキタヨ……」の声。\n' +
          '振り向いた暗闇の先に、赤い帽子がゆっくりと傾いた――。'
        );
        return;
      }
      showDialogue('美咲', '「まだ忘れ物（家の鍵と楽譜のポーチ）を取っていない……2年A組か、別館2Fの音楽室を探そう」', 4.5);
      return;
    }

    // 忘れ物ポーチを持っている状態で脱出！
    gameState = 'clear';
    exitLockSafe();
    enemy.deactivate();
    clearCard.classList.remove('true-end');

    if (story.ghostReleased) {
      // ★ TRUE END『もう、忘れない』
      unlockEnding('true');
      clearCard.classList.add('true-end');
      clearEyebrow.textContent = 'TRUE END — もう、忘れない';
      clearTitle.textContent = '静かな夜道へ';
      clearText.textContent =
        '校門へ飛び出すと、虫の声と澄んだ夜気が迎えてくれた。\n' +
        '「美咲っ！ 遅いから心配して戻ってきちゃったよ！ 大丈夫だった！？」\n' +
        '駆け寄ってきた由香の温かい声に、張り詰めていた緊張が一気にほどける。\n\n' +
        'ふと振り返った別館2F・音楽室の窓にはもう誰もおらず、ただ穏やかな月明かりだけが差し込んでいた。\n' +
        '「……うん、もう大丈夫。忘れ物もちゃんと見つけたから。帰ろう、由香」\n' +
        '二人は街灯の並ぶ帰り道を、並んで歩いていった――。';
    } else {
      // ★ NORMAL END『逃げ切った夜』
      unlockEnding('normal');
      clearEyebrow.textContent = 'NORMAL END — 逃げ切った夜';
      clearTitle.textContent = '生 還';
      clearText.textContent =
        '夜の校舎から命からがら飛び出すと、校門の前で心配して引き返してきてくれた由香が駆け寄ってくれた。\n' +
        '「美咲、すごい顔色してるよ！？ 大丈夫！？」\n\n' +
        'ホッとして二人で歩き出し、ふと校舎を振り返る――。\n' +
        '暗い別館2F・音楽室の窓に、赤い帽子を被ったいびつな人影がべったり張り付いてこちらを見下ろしていた。\n\n' +
        '（ヒント：3F 視聴覚室・理科準備室・2F 放送室・別館1F 旧倉庫の手がかりを集めて、音楽準備室の楽器収納庫を開放すると TRUE END へ進めます）';
    }
    clearScreen.classList.remove('hidden');
  }
}

function showBadEnding(id, eyebrow, title, body) {
  if (player.hiding) exitLocker(true);
  gameState = 'gameover';
  exitLockSafe();
  enemy.deactivate();
  unlockEnding(id);
  gameoverEyebrow.textContent = eyebrow;
  gameoverTitle.textContent = title;
  gameoverText.textContent = body;
  gameoverScreen.classList.remove('hidden');
}

function triggerJumpscare(customMsg = null, reason = 'catch') {
  if (player.hiding) exitLocker(true);
  gameState = 'jumpscare';
  pendingBadEnding = reason;
  jumpscareTimer = 1.25;
  audio.playJumpscare();
  triggerFlash('rgba(210, 0, 15, 0.72)', 380);
  promptEl.classList.remove('visible');
  mapModal.classList.add('hidden');
  if (customMsg) showDialogue('赤いコートの女', customMsg, 2.0, true);
  exitLockSafe();
}

// =========================================================================
// 校舎見取り図（2Dマップモーダル描画・ロッカー＆未回収重要アイテム表示つき！）
// =========================================================================
function drawSchoolMap2D() {
  const ctx = mapCanvas.getContext('2d');
  const W = mapCanvas.width;
  const H = mapCanvas.height;
  ctx.fillStyle = '#181a17';
  ctx.fillRect(0, 0, W, H);

  const floorNum = player.pos.y < 2 ? 1 : player.pos.y < 6 ? 2 : 3;

  const toCX = (wx) => ((wx + 24) / 74) * (W - 40) + 20;
  const toCZ = (wz) => ((wz + 20) / 40) * (H - 60) + 42;

  const drawRect = (x1, z1, x2, z2, fill, label = '') => {
    const rx = toCX(x1);
    const ry = toCZ(z1);
    const rw = toCX(x2) - rx;
    const rh = toCZ(z2) - ry;
    ctx.fillStyle = fill;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = '#6f7367';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rx, ry, rw, rh);
    if (label) {
      ctx.fillStyle = '#d7d3c2';
      ctx.font = '11px "Yu Gothic", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, rx + rw / 2, ry + rh / 2);
    }
  };

  ctx.fillStyle = '#e5dfcc';
  ctx.font = 'bold 14px "Yu Gothic", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`校舎見取り図 【現在: ${floorNum}F】  ■緑=ロッカー  ★金=重要アイテム  (タップ/Mで閉じる)`, 18, 22);

  // 赤いコートの女が同じ階にいるときは不気味な気配表示を出す
  if (enemy.active) {
    const enemyFloor = enemy.position.y < 2 ? 1 : enemy.position.y < 6 ? 2 : 3;
    ctx.font = 'bold 12px "Yu Gothic", sans-serif';
    ctx.fillStyle = enemyFloor === floorNum ? '#ff5964' : '#9aa0a8';
    ctx.fillText(
      enemyFloor === floorNum
        ? '⚠ この階に赤いコートの女の気配がする……'
        : `（気配：別の階 [${enemyFloor}F] の方からメトロノームの音がする）`,
      18,
      H - 10
    );
  }

  drawRect(-22, -10, 22, -6, '#363a35', '北棟廊下');
  drawRect(-14, -6, -10, 16, '#363a35');
  drawRect(10, -6, 14, 16, '#363a35');
  drawRect(-10, -6, 10, 16, '#1f2b1f', '中庭');
  drawRect(-22, -18, -14, -10, '#4a4332', '西階段');
  drawRect(14, -18, 22, -10, '#4a4332', '東階段');

  if (floorNum === 1) {
    drawRect(-14, -18, -6, -10, '#2a2e2b', 'トイレ');
    drawRect(-6, -18, 4, -10, '#2a2e2b', '保健室');
    drawRect(4, -18, 14, -10, '#2a2e2b', '印刷室');
    drawRect(-22, -6, -14, 5, '#2a2e2b', '倉庫');
    drawRect(-22, 5, -14, 16, '#233b2a', '西昇降口');
    drawRect(14, -6, 22, 5, '#2a2e2b', '職員室');
    drawRect(14, 5, 22, 11, '#2a2e2b', '警備員室');
    drawRect(14, 11, 22, 16, '#233b2a', '昇降口');
    drawRect(32, -10, 38, -2, '#4a4332', '別館階段');
    drawRect(32, -2, 38, 10, '#363a35');
    drawRect(38, -2, 46, 4, '#2e2a25', '美術室');
    drawRect(38, 4, 46, 10, '#3a2c22', '旧倉庫');
  } else if (floorNum === 2) {
    drawRect(-14, -18, -6, -10, '#2c3540', '放送室');
    drawRect(-6, -18, 4, -10, '#3e3326', '2年A組');
    drawRect(4, -18, 14, -10, '#2a2e2b', '2年B組');
    drawRect(-22, -6, -14, 16, '#2a2e2b', '図書室');
    drawRect(14, 2, 22, 16, '#2a2e2b', '2年C組');
    drawRect(14, -2, 32, 2, '#3a4648', '渡り廊下');
    drawRect(32, -10, 38, -2, '#4a4332', '別館階段');
    drawRect(32, -2, 38, 10, '#363a35');
    drawRect(38, -10, 46, 4, '#472528', '音楽室');
    drawRect(38, 4, 46, 10, '#3a2224', '音楽準備室');
  } else {
    drawRect(-14, -18, -6, -10, '#2a2e2b', 'トイレ');
    drawRect(-6, -18, 4, -10, '#2f3542', '視聴覚室');
    drawRect(4, -18, 14, -10, '#2a2e2b', '理科室');
    drawRect(-22, -6, -14, 5, '#2a2e2b', '空き教室');
    drawRect(-22, 5, -14, 16, '#2a2e2b', '3年B組');
    drawRect(14, -6, 22, 5, '#3b3324', '理科準備室');
    drawRect(14, 5, 22, 16, '#2a2e2b', '3年A組');
  }

  // 隠れロッカー（緑の四角）
  for (const l of schoolMap.lockers) {
    const lf = l.pos.y < 2 ? 1 : l.pos.y < 6 ? 2 : 3;
    if (lf !== floorNum) continue;
    const lx = toCX(l.pos.x);
    const lz = toCZ(l.pos.z);
    ctx.fillStyle = '#4de88c';
    ctx.fillRect(lx - 4, lz - 4, 8, 8);
  }

  // 未回収の重要アイテム（金色の星★）
  for (const it of schoolMap.interactables) {
    if (it.collected) continue;
    if (it.type !== 'pouch' && it.type !== 'key_item') continue;
    const itf = it.position.y < 2 ? 1 : it.position.y < 6 ? 2 : 3;
    if (itf !== floorNum) continue;
    const ix = toCX(it.position.x);
    const iz = toCZ(it.position.z);
    ctx.fillStyle = '#ffd65c';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', ix, iz);
  }

  // プレイヤー位置＆向き
  const px = toCX(player.pos.x);
  const pz = toCZ(player.pos.z);
  ctx.save();
  ctx.translate(px, pz);
  ctx.rotate(-(player.hiding && player.hidingLocker ? player.hidingLocker.faceYaw : player.yaw));
  ctx.fillStyle = '#5ee6ff';
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(6, 6);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// =========================================================================
// メインループ
// =========================================================================
let lastTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  for (const d of schoolMap.doors) {
    const target = d.isOpen ? 1 : 0;
    d.progress += (target - d.progress) * Math.min(1, dt * 10);
    const val = d.closedPos + (d.openPos - d.closedPos) * d.progress;
    if (d.axis === 'x') d.mesh.position.x = val;
    else d.mesh.position.z = val;
  }

  schoolMap.updateLights(dt, player.pos);

  if (gameState === 'playing') {
    const pState = updatePlayer(dt);

    areaLabel.textContent = player.hiding
      ? `${schoolMap.getAreaName(player.pos.x, player.pos.y, player.pos.z)}（ロッカー内）`
      : schoolMap.getAreaName(player.pos.x, player.pos.y, player.pos.z);

    if (mapOpen) drawSchoolMap2D();

    const near = findNearestTarget();
    if (near) {
      promptEl.textContent = near.label;
      promptEl.classList.add('visible');
    } else {
      promptEl.classList.remove('visible');
    }

    // スマホボタンの状態をリアルタイム更新
    if (isTouchMode && btnInteract) {
      if (player.hiding) {
        btnInteract.textContent = '外へ出る';
        btnInteract.classList.add('ready');
      } else if (near) {
        btnInteract.textContent = near.label.replace(/\s*\[E\]/g, '');
        btnInteract.classList.add('ready');
      } else {
        btnInteract.textContent = '調べる';
        btnInteract.classList.remove('ready');
      }
      if (btnFlashlight) btnFlashlight.classList.toggle('active-state', player.flashlightOn);
      if (btnCrouch) btnCrouch.classList.toggle('active-state', player.crouching);
    }

    npcs.update(dt, player.pos, {
      onGuardScare: () => {
        audio.playFakeScare();
        triggerFlash('rgba(255, 240, 190, 0.35)', 160);
        queueDialogues([
          { speaker: '警備員', text: '「おいっ！ 誰だッ！！」', duration: 2.0 },
          { speaker: '警備員', text: '「……なんだ、吹奏楽部の子か！ びっくりさせるなよ。忘れ物なら早く取って帰りなさい」', duration: 5.5 }
        ]);
      },
      onTeacherScare: () => {
        audio.playFakeScare();
        triggerFlash('rgba(255, 255, 255, 0.28)', 140);
        queueDialogues([
          { speaker: '吹奏楽部 顧問', text: '「うわっ！？ まだ学校にいたのか！？」', duration: 2.0 },
          { speaker: '吹奏楽部 顧問', text: '「2年A組に忘れ物？ もし音楽室なら東棟2Fの渡り廊下から行けるぞ。別館は暗いから気をつけてな」', duration: 5.5 }
        ]);
      }
    });

    const enemyDist = enemy.update(dt, player.pos, pState, schoolMap.colliders, {
      onSpot: () => {
        audio.playChaseStinger();
        triggerFlash('rgba(160, 0, 18, 0.35)', 220);
        queueDialogues([
          { speaker: '赤いコートの女', text: '「……ミツケタ……！」', duration: 2.0, isGhost: true },
          { speaker: '美咲', text: '「きゃっ！！ 赤いコートの女に見つかった！ 走って角を曲がって、ロッカーに隠れないと！」', duration: 4.5 }
        ]);
      },
      onWhisper: (line) => {
        showDialogue('赤いコートの女', line, 3.8, true);
      },
      onLockerBreach: () => {
        audio.playLockerToggle(false);
        triggerJumpscare('「……ソコニ、イルノ、ミテタヨ……！」', 'breach');
      },
      onOpenDoor: () => {
        audio.playDoorSlide();
      },
      onCatch: () => {
        triggerJumpscare('「……ツカマエタ……！」', 'catch');
      }
    }, schoolMap.doors);

    if (player.hiding && enemy.active && enemyDist < 11) {
      const intensity = Math.max(0.25, Math.min(1, 1 - enemyDist / 11));
      player.heartbeatTimer -= dt;
      if (player.heartbeatTimer <= 0) {
        audio.playHeartbeat(intensity);
        player.heartbeatTimer = 1.05 - intensity * 0.55;
      }
    }

    audio.update(dt, enemyDist, enemy.active);
    if (enemy.active && enemyDist < 16) {
      const danger = Math.max(0, Math.min(1, 1 - enemyDist / 16));
      dangerVignette.style.opacity = (danger * 0.85).toFixed(2);
    } else {
      dangerVignette.style.opacity = '0';
    }

    if (subtitleTimer > 0) {
      subtitleTimer -= dt;
      if (subtitleTimer <= 0) {
        if (dialogueQueue.length > 0) {
          const next = dialogueQueue.shift();
          applyDialogue(next.speaker, next.text, next.duration || 4.8, !!next.isGhost);
        } else {
          subtitleEl.classList.remove('visible');
        }
      }
    }
  } else if (gameState === 'jumpscare') {
    jumpscareTimer -= dt;
    const facePos = enemy.position.clone().add(new THREE.Vector3(0, 1.72, 0));
    const frontDir = new THREE.Vector3(
      Math.sin(enemy.group.rotation.y),
      0,
      Math.cos(enemy.group.rotation.y)
    );
    camera.position.copy(facePos).addScaledVector(frontDir, 0.65);
    camera.position.x += (Math.random() - 0.5) * 0.14;
    camera.position.y += (Math.random() - 0.5) * 0.14;
    camera.lookAt(facePos);
    flashlight.visible = true;
    flashlight.position.copy(camera.position);
    flashlightTarget.position.copy(facePos);

    if (jumpscareTimer <= 0) {
      const desc = pendingBadEnding === 'breach'
        ? '目の前で見られながらロッカーに隠れてしまった。扉を力ずくでこじ開けられ、暗闇の奥へ引きずり込まれた。\n翌朝、誰もいない教室には美咲のポーチだけがぽつんと残されていた――。'
        : '赤いコートと赤い帽子の女に追いつかれてしまった。\n翌朝、誰もいない教室には美咲のポーチだけがぽつんと残されていた――。';
      showBadEnding('bad1', 'BAD END ① — 新しい忘れ物', '捕まった……', desc);
    }
  }

  renderer.render(scene, camera);
}

requestAnimationFrame(animate);
