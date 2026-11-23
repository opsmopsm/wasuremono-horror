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
const retryBtn = document.getElementById('retry-btn');
const clearScreen = document.getElementById('clear-screen');
const clearText = document.getElementById('clear-text');
const playAgainBtn = document.getElementById('play-again-btn');

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

// =========================================================================
// Three.js セットアップ（PS1風低解像度レンダラー）
// =========================================================================
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;

let ps1Mode = true;
function updateResolution() {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const targetH = ps1Mode ? 270 : Math.min(720, window.innerHeight);
  const targetW = Math.round(targetH * aspect);
  renderer.setSize(targetW, targetH, false);
  if (qualityBadge) {
    qualityBadge.textContent = ps1Mode ? '画質: PS1風 [P]' : '画質: クリア [P]';
  }
}
window.addEventListener('resize', updateResolution);
updateResolution();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04060b);
scene.fog = new THREE.FogExp2(0x04060b, 0.082);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / Math.max(1, window.innerHeight), 0.1, 70);

const ambient = new THREE.AmbientLight(0x232c3d, 0.6);
scene.add(ambient);

// 手持ちの懐中電灯
const flashlight = new THREE.SpotLight(0xfff4d6, 3.8, 28, Math.PI / 5.2, 0.45, 1.45);
const flashlightTarget = new THREE.Object3D();
scene.add(flashlight);
scene.add(flashlightTarget);
flashlight.target = flashlightTarget;

const playerGlow = new THREE.PointLight(0x9fb0c8, 0.34, 4.2, 2.0);
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
// ゲーム状態・プレイヤー状態
// =========================================================================
let gameState = 'title'; // title | playing | paused | jumpscare | gameover | clear
let mapOpen = false;

const player = {
  pos: new THREE.Vector3(12, 0, 13.5),
  yaw: 0,
  pitch: 0,
  radius: 0.36,
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
  hasPouch: false,
  enemyTriggered: false,
  entered2A: false,
  enteredMusicRoom: false,
  hidFirstTime: false,
  notesFound: new Set()
};

// セリフキュー管理（話者名つき）
let dialogueQueue = [];
let subtitleTimer = 0;
let jumpscareTimer = 0;

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

  // 敵に目の前で見られながら入ったか判定！
  const enemyDist = enemy.position.distanceTo(player.pos);
  const sameFloor = Math.abs(enemy.position.y - player.pos.y) < 1.8;
  player.seenHiding = (
    enemy.active &&
    enemy.state === 'chase' &&
    sameFloor &&
    enemyDist < 9.5 &&
    enemy.hasLineOfSight(player.pos, schoolMap.colliders)
  );

  player.hiding = true;
  player.hidingLocker = locker;
  player.crouching = false;
  player.savedFlashlightOn = player.flashlightOn;
  player.flashlightOn = false; // ロッカー内では光が漏れないよう消灯
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
  story.hasPouch = false;
  story.enemyTriggered = false;
  story.entered2A = false;
  story.enteredMusicRoom = false;
  story.hidFirstTime = false;
  story.notesFound.clear();

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

  const pouchItem = schoolMap.interactables.find((i) => i.id === 'forgotten_pouch');
  if (pouchItem) {
    pouchItem.collected = false;
    pouchItem.mesh.visible = true;
    pouchItem.light.visible = true;
  }

  enemy.deactivate();
  npcs.reset();

  objectiveLabel.textContent = '目標: 2F 2年A組で忘れ物を探す';
  dangerVignette.style.opacity = '0';
  lockerSlitOverlay.classList.add('hidden');
  mapOpen = false;
  mapModal.classList.add('hidden');

  queueDialogues([
    {
      speaker: '美咲',
      text: '「吹奏楽部の片付けで、すっかり夜になっちゃった……」',
      duration: 3.8
    },
    {
      speaker: '美咲',
      text: '「友達には先に帰ってもらったけど、家の鍵と楽譜のポーチを2年A組の机に忘れたはず。早く取って帰ろう！」',
      duration: 5.5
    }
  ]);
}

function activateRedCoatWoman(spawnPos, dialogueEntries = null) {
  if (story.enemyTriggered) return;
  story.enemyTriggered = true;
  npcs.vanishAll();
  enemy.activate(spawnPos || new THREE.Vector3(34, 4, 5));
  audio.playDistantPiano();
  if (dialogueEntries) queueDialogues(dialogueEntries);
}

// =========================================================================
// 入力管理
// =========================================================================
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;

  if (gameState !== 'playing') return;

  if (e.code === 'KeyF' && !player.hiding) {
    player.flashlightOn = !player.flashlightOn;
    audio.playFlashlightClick();
  }
  if ((e.code === 'KeyC' || e.code === 'ControlLeft') && !player.hiding) {
    player.crouching = !player.crouching;
  }
  if (e.code === 'KeyE') {
    if (player.hiding) {
      exitLocker(false);
    } else {
      tryInteract();
    }
  }
  if (e.code === 'KeyM' || e.code === 'Tab') {
    e.preventDefault();
    mapOpen = !mapOpen;
    mapModal.classList.toggle('hidden', !mapOpen);
    if (mapOpen) drawSchoolMap2D();
  }
  if (e.code === 'KeyP') {
    ps1Mode = !ps1Mode;
    updateResolution();
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

window.addEventListener('mousemove', (e) => {
  if (gameState !== 'playing' || document.pointerLockElement !== canvas) return;
  const sens = 0.0022;
  if (player.hiding) {
    // ロッカー内では隙間から左右±32°・上下±16°だけ覗き込める！
    player.peekYawOffset = Math.max(-0.56, Math.min(0.56, player.peekYawOffset - e.movementX * sens));
    player.peekPitch = Math.max(-0.28, Math.min(0.28, player.peekPitch - e.movementY * sens));
  } else {
    player.yaw -= e.movementX * sens;
    player.pitch = Math.max(-1.25, Math.min(1.25, player.pitch - e.movementY * sens));
  }
});

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && gameState === 'playing') {
    gameState = 'paused';
    pauseScreen.classList.remove('hidden');
  }
});

canvas.addEventListener('click', () => {
  if (gameState === 'playing' && document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
  }
});

startBtn.addEventListener('click', () => {
  audio.init();
  resetGame();
  titleScreen.classList.add('hidden');
  hud.classList.remove('hidden');
  gameState = 'playing';
  canvas.requestPointerLock();
});

resumeBtn.addEventListener('click', () => {
  pauseScreen.classList.add('hidden');
  gameState = 'playing';
  canvas.requestPointerLock();
});

retryBtn.addEventListener('click', () => {
  gameoverScreen.classList.add('hidden');
  resetGame();
  gameState = 'playing';
  canvas.requestPointerLock();
});

playAgainBtn.addEventListener('click', () => {
  clearScreen.classList.add('hidden');
  resetGame();
  gameState = 'playing';
  canvas.requestPointerLock();
});

// =========================================================================
// 衝突判定＆移動
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

function updatePlayer(dt) {
  // ロッカー隠れ中
  if (player.hiding && player.hidingLocker) {
    const locker = player.hidingLocker;
    player.stamina = Math.min(100, player.stamina + 18 * dt);
    staminaFill.style.width = `${player.stamina}%`;

    camera.position.copy(locker.insideCamPos);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = locker.faceYaw + player.peekYawOffset;
    camera.rotation.x = player.peekPitch;

    flashlight.visible = false;
    // 隙間から廊下の様子がうっすら見えるよう極微弱ライトを少し前方に配置
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

  const isMoving = move.lengthSq() > 0.001;
  const wantsRun = (keys['ShiftLeft'] || keys['ShiftRight']) && isMoving && !player.crouching && player.stamina > 2;

  if (wantsRun) {
    player.stamina = Math.max(0, player.stamina - 24 * dt);
  } else {
    player.stamina = Math.min(100, player.stamina + 16 * dt);
  }
  staminaFill.style.width = `${player.stamina}%`;

  const speed = player.crouching ? 1.65 : wantsRun ? 5.35 : 3.05;

  if (isMoving) {
    move.normalize().multiplyScalar(speed * dt);
    const nx = player.pos.x + move.x;
    const nz = player.pos.z + move.z;

    if (!collidesAt(nx, player.pos.y, player.pos.z)) {
      player.pos.x = nx;
    }
    if (!collidesAt(player.pos.x, player.pos.y, nz)) {
      player.pos.z = nz;
    }

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
    flashlight.position.copy(camera.position)
      .addScaledVector(rightVec, 0.16)
      .add(new THREE.Vector3(0, -0.14 + bobOffset * 0.5, 0));
    flashlightTarget.position.copy(camera.position).addScaledVector(dir, 8);
  }
  playerGlow.position.copy(camera.position);

  // エリア到達時の自動セリフ＆イベント
  if (!story.entered2A && player.pos.y > 3 && player.pos.x > -6 && player.pos.x < 4 && player.pos.z < -10.3) {
    story.entered2A = true;
    showDialogue('美咲', '「2年A組に着いた……たしか真ん中の自分の机に置いたはずなんだけど……」', 4.5);
  }

  if (!story.enemyTriggered && player.pos.x > 24 && player.pos.y > 2.5) {
    activateRedCoatWoman(new THREE.Vector3(34, 4, 7), [
      { speaker: '美咲', text: '「……っ！ 急に空気が冷たくなった……渡り廊下の奥に、誰かいる？」', duration: 4.5 },
      { speaker: '赤いコートの女', text: '「……ワスレモノ……ドコ……」', duration: 4.0, isGhost: true }
    ]);
  }

  if (!story.enteredMusicRoom && player.pos.y > 3 && player.pos.x > 36.5 && player.pos.z < 3.5) {
    story.enteredMusicRoom = true;
    showDialogue('美咲', '「音楽室……！ ピアノの上にポーチが見えた！ 危なかったらロッカーに隠れよう……」', 5.0);
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
// インタラクション（ロッカー・NPC・ドア・机・忘れ物・メモ・脱出）
// =========================================================================
function findNearestTarget() {
  if (player.hiding) return null;

  const camPos = camera.position;
  const lookDir = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);

  let best = null;
  let bestScore = Infinity;

  // 1. 隠れられるロッカーチェック
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

  // 2. NPC（警備員・顧問の先生）チェック
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

  // 3. 引き戸チェック
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

  // 4. オブジェクトチェック
  for (const item of schoolMap.interactables) {
    if (item.collected) continue;
    const dist = camPos.distanceTo(item.position);
    if (dist > item.radius) continue;
    const toTarget = item.position.clone().sub(camPos).normalize();
    if (lookDir.dot(toTarget) < 0.25 && dist > 1.4) continue;
    if (dist < bestScore) {
      bestScore = dist;
      best = { kind: 'item', ref: item, label: item.label };
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
  if (item.type === 'desk') {
    if (!story.checkedDesk) {
      story.checkedDesk = true;
      audio.playPickup();
      objectiveLabel.textContent = '目標: 東棟2F渡り廊下から別館2Fの音楽室へ行く';
      activateRedCoatWoman(new THREE.Vector3(34, 4, 6), [
        { speaker: '美咲', text: '「あれ……机の中にもロッカーにもない！？ どこに置いたっけ……！」', duration: 4.0 },
        { speaker: '美咲', text: '「そうだ、片付けの最後に【別館2Fの音楽室】のピアノの上に置いたんだ！ 東棟2Fの渡り廊下から急ごう！」', duration: 5.5 }
      ]);
    } else {
      showDialogue('美咲', '「ポーチはここにはない。東棟2Fの渡り廊下を通って、別館2Fの音楽室へ行こう」', 4.5);
    }
  } else if (item.type === 'pouch') {
    item.collected = true;
    item.mesh.visible = false;
    item.light.visible = false;
    story.hasPouch = true;
    audio.playPickup();
    audio.playChaseStinger();
    triggerFlash('rgba(180, 10, 20, 0.35)', 240);
    objectiveLabel.textContent = '目標: 赤いコートの女から逃げて1Fの出口から脱出する！';
    queueDialogues([
      { speaker: '美咲', text: '「あった！ 家の鍵と楽譜のポーチ！ ……っ、外からメトロノームの音が近づいてくる！」', duration: 4.2 },
      { speaker: '赤いコートの女', text: '「……ミツケタ……ワスレモノ、モッテイカナイデ……」', duration: 4.2, isGhost: true }
    ]);

    if (!story.enemyTriggered) {
      activateRedCoatWoman(new THREE.Vector3(34, 4, 6));
    } else if (enemy.position.distanceTo(player.pos) > 18) {
      enemy.position.set(27, 4, 0);
      enemy.group.position.copy(enemy.position);
    }
  } else if (item.type === 'note') {
    story.notesFound.add(item.id);
    audio.playPickup();
    showDialogue('調査', item.text, 7.0);
  } else if (item.type === 'exit') {
    if (!story.hasPouch) {
      showDialogue('美咲', '「まだ忘れ物（家の鍵と楽譜のポーチ）を取っていない……今夜中に取り戻さないと家に入れないよ」', 4.5);
      return;
    }
    gameState = 'clear';
    document.exitPointerLock();
    enemy.deactivate();
    const foundCount = story.notesFound.size;
    clearText.textContent =
      `夜の校舎から飛び出すと、校門の前で心配して引き返してきてくれた友達が「遅いから迎えに来ちゃったよ！大丈夫！？」と駆け寄ってくれた。\n\n` +
      `（手がかり発見数: ${foundCount} / 3）\n` +
      `ホッとして振り返った暗い別館2Fの音楽室の窓に、赤い帽子を被ったいびつな人影がじっとこちらを見下ろしている気がした……`;
    clearScreen.classList.remove('hidden');
  }
}

function triggerJumpscare(customMsg = null) {
  if (player.hiding) exitLocker(true);
  gameState = 'jumpscare';
  jumpscareTimer = 1.25;
  audio.playJumpscare();
  triggerFlash('rgba(210, 0, 15, 0.72)', 380);
  promptEl.classList.remove('visible');
  mapModal.classList.add('hidden');
  if (customMsg) showDialogue('赤いコートの女', customMsg, 2.0, true);
  document.exitPointerLock();
}

// =========================================================================
// 校舎見取り図（2Dマップモーダル描画・ロッカー位置表示つき！）
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
  ctx.font = 'bold 15px "Yu Gothic", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`校舎見取り図 【現在: ${floorNum}F】  ■緑=隠れロッカー  (Mキーで閉じる)`, 20, 22);

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
    drawRect(32, -2, 36, 10, '#363a35');
    drawRect(36, -2, 46, 4, '#2e2a25', '美術室');
    drawRect(36, 4, 46, 10, '#2e2a25', '旧倉庫');
  } else if (floorNum === 2) {
    drawRect(-14, -18, -6, -10, '#2a2e2b', '放送室');
    drawRect(-6, -18, 4, -10, '#3e3326', '2年A組');
    drawRect(4, -18, 14, -10, '#2a2e2b', '2年B組');
    drawRect(-22, -6, -14, 16, '#2a2e2b', '図書室');
    drawRect(14, 2, 22, 16, '#2a2e2b', '2年C組');
    drawRect(14, -2, 32, 2, '#3a4648', '渡り廊下');
    drawRect(32, -10, 38, -2, '#4a4332', '別館階段');
    drawRect(32, -2, 36, 10, '#363a35');
    drawRect(36, -10, 46, 4, '#472528', '音楽室');
    drawRect(36, 4, 46, 10, '#3a2224', '音楽準備室');
  } else {
    drawRect(-14, -18, -6, -10, '#2a2e2b', 'トイレ');
    drawRect(-6, -18, 4, -10, '#2a2e2b', '視聴覚室');
    drawRect(4, -18, 14, -10, '#2a2e2b', '理科室');
    drawRect(-22, -6, -14, 5, '#2a2e2b', '空き教室');
    drawRect(-22, 5, -14, 16, '#2a2e2b', '3年B組');
    drawRect(14, -6, 22, 5, '#2a2e2b', '理科準備室');
    drawRect(14, 5, 22, 16, '#2a2e2b', '3年A組');
  }

  // 現在階の隠れロッカー位置を緑の四角で表示
  for (const l of schoolMap.lockers) {
    const lf = l.pos.y < 2 ? 1 : l.pos.y < 6 ? 2 : 3;
    if (lf !== floorNum) continue;
    const lx = toCX(l.pos.x);
    const lz = toCZ(l.pos.z);
    ctx.fillStyle = '#4de88c';
    ctx.fillRect(lx - 4, lz - 4, 8, 8);
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

  // 引き戸スライドアニメーション
  for (const d of schoolMap.doors) {
    const target = d.isOpen ? 1 : 0;
    d.progress += (target - d.progress) * Math.min(1, dt * 10);
    const val = d.closedPos + (d.openPos - d.closedPos) * d.progress;
    if (d.axis === 'x') d.mesh.position.x = val;
    else d.mesh.position.z = val;
  }

  schoolMap.updateLights(dt);

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

    // 見回り中の警備員＆顧問の先生
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

    // 赤いコートと赤い帽子の女 AI更新
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
        triggerJumpscare('「……ソコニ、イルノ、ミテタヨ……！」');
      },
      onCatch: () => {
        triggerJumpscare('「……ツカマエタ……！」');
      }
    });

    // ロッカー隠れ中に敵がすぐ近くにいるときの心拍音！
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

    // セリフキュー進行
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
      gameState = 'gameover';
      gameoverScreen.classList.remove('hidden');
    }
  }

  renderer.render(scene, camera);
}

requestAnimationFrame(animate);
