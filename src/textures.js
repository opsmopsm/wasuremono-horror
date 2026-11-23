import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finalizeTexture(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addNoise(ctx, w, h, amount = 18) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount * 2;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

// 校舎内壁（上：くすんだクリーム塗り壁、下：古い灰緑の腰壁＋木枠）
function createSchoolWallTex() {
  const c = makeCanvas(64, 64);
  const ctx = c.getContext('2d');
  // 上部
  ctx.fillStyle = '#9e9b89';
  ctx.fillRect(0, 0, 64, 38);
  // 下部（腰壁）
  ctx.fillStyle = '#5c665d';
  ctx.fillRect(0, 38, 64, 26);
  // 境目の木製見切り材
  ctx.fillStyle = '#4a3829';
  ctx.fillRect(0, 36, 64, 3);
  ctx.fillRect(0, 61, 64, 3);
  // 水シミ・汚れ
  ctx.fillStyle = 'rgba(30, 28, 22, 0.22)';
  ctx.fillRect(10, 0, 6, 22);
  ctx.fillRect(42, 4, 8, 28);
  ctx.fillRect(24, 42, 12, 16);
  addNoise(ctx, 64, 64, 14);
  return finalizeTexture(c, 1, 1);
}

// 別館の古い壁（少し黄ばんで汚れたレトロ壁）
function createAnnexWallTex() {
  const c = makeCanvas(64, 64);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#857d68';
  ctx.fillRect(0, 0, 64, 36);
  ctx.fillStyle = '#4c4235';
  ctx.fillRect(0, 36, 64, 28);
  ctx.fillStyle = '#31261c';
  ctx.fillRect(0, 34, 64, 3);
  // 木板縦ライン
  ctx.fillStyle = 'rgba(20,15,10,0.3)';
  for (let x = 0; x < 64; x += 8) {
    ctx.fillRect(x, 37, 1, 27);
  }
  // 濃いシミ
  ctx.fillStyle = 'rgba(25, 18, 12, 0.3)';
  ctx.fillRect(6, 0, 12, 30);
  ctx.fillRect(44, 6, 10, 26);
  addNoise(ctx, 64, 64, 18);
  return finalizeTexture(c, 1, 1);
}

// 廊下のリノリウム床
function createCorridorFloorTex() {
  const c = makeCanvas(64, 64);
  const ctx = c.getContext('2d');
  const tile = 16;
  for (let y = 0; y < 64; y += tile) {
    for (let x = 0; x < 64; x += tile) {
      const alt = ((x / tile) + (y / tile)) % 2 === 0;
      ctx.fillStyle = alt ? '#6f6c61' : '#636056';
      ctx.fillRect(x, y, tile, tile);
      ctx.strokeStyle = 'rgba(25,24,20,0.35)';
      ctx.strokeRect(x + 0.5, y + 0.5, tile - 1, tile - 1);
    }
  }
  // 靴の擦れ跡
  ctx.fillStyle = 'rgba(25,22,18,0.22)';
  ctx.fillRect(12, 20, 14, 3);
  ctx.fillRect(38, 48, 10, 2);
  addNoise(ctx, 64, 64, 14);
  return finalizeTexture(c, 1, 1);
}

// 教室・音楽室の木の床
function createWoodFloorTex() {
  const c = makeCanvas(64, 64);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#6c5137';
  ctx.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 8) {
    ctx.fillStyle = y % 16 === 0 ? '#654b32' : '#73573c';
    ctx.fillRect(0, y, 64, 7);
    ctx.fillStyle = '#3b2919';
    ctx.fillRect(0, y + 7, 64, 1);
    const joint = ((y * 7) % 48) + 8;
    ctx.fillRect(joint, y, 1, 8);
  }
  addNoise(ctx, 64, 64, 14);
  return finalizeTexture(c, 1, 1);
}

// 天井タイル
function createCeilingTex() {
  const c = makeCanvas(64, 64);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#7e7d75';
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = '#53524d';
  ctx.strokeRect(0.5, 0.5, 31, 31);
  ctx.strokeRect(32.5, 0.5, 31, 31);
  ctx.strokeRect(0.5, 32.5, 31, 31);
  ctx.strokeRect(32.5, 32.5, 31, 31);
  addNoise(ctx, 64, 64, 16);
  return finalizeTexture(c, 1, 1);
}

// 校舎外壁コンクリート
function createExteriorWallTex() {
  const c = makeCanvas(64, 64);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#737167';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgba(20, 22, 24, 0.25)';
  ctx.fillRect(0, 0, 64, 6);
  ctx.fillRect(14, 6, 4, 40);
  ctx.fillRect(46, 6, 5, 36);
  addNoise(ctx, 64, 64, 20);
  return finalizeTexture(c, 1, 1);
}

// 教室の木製引き戸（上半分にガラス窓付き）
function createDoorTex() {
  const c = makeCanvas(64, 96);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5e432b';
  ctx.fillRect(0, 0, 64, 96);
  // 外枠
  ctx.strokeStyle = '#3a2717';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 60, 92);
  // 上部ガラス
  ctx.fillStyle = '#1b262e';
  ctx.fillRect(10, 10, 44, 38);
  // 格子
  ctx.fillStyle = '#4a3320';
  ctx.fillRect(31, 10, 2, 38);
  ctx.fillRect(10, 28, 44, 2);
  // 下部パネル
  ctx.fillStyle = '#4f3823';
  ctx.fillRect(10, 56, 44, 30);
  // 取っ手
  ctx.fillStyle = '#9aa0a6';
  ctx.fillRect(52, 52, 4, 12);
  addNoise(ctx, 64, 96, 12);
  return finalizeTexture(c, 1, 1);
}

// 黒板テクスチャ
function createBlackboardTex(musicLines = false) {
  const c = makeCanvas(128, 64);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1e3828';
  ctx.fillRect(0, 0, 128, 64);
  // チョーク消し跡
  ctx.fillStyle = 'rgba(220,230,220,0.08)';
  ctx.fillRect(12, 10, 40, 24);
  ctx.fillRect(68, 16, 44, 28);
  if (musicLines) {
    // 五線譜
    ctx.fillStyle = 'rgba(230,235,220,0.45)';
    for (let group = 0; group < 2; group++) {
      const baseY = 14 + group * 24;
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(8, baseY + i * 3, 112, 1);
      }
    }
  } else {
    // 日直・日付っぽい文字跡
    ctx.fillStyle = 'rgba(230,235,220,0.35)';
    ctx.fillRect(108, 8, 2, 34);
    ctx.fillRect(100, 12, 2, 20);
    ctx.fillRect(18, 16, 36, 2);
    ctx.fillRect(18, 24, 28, 2);
  }
  // 木枠
  ctx.strokeStyle = '#5a3f26';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 124, 60);
  addNoise(ctx, 128, 64, 10);
  return finalizeTexture(c, 1, 1);
}

// 封鎖された楽器収納庫（板で打ち付けられた不気味な扉）
function createSealedLockerTex() {
  const c = makeCanvas(64, 96);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3d3730';
  ctx.fillRect(0, 0, 64, 96);
  ctx.strokeStyle = '#1b1815';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 60, 92);
  ctx.fillStyle = '#1a1714';
  ctx.fillRect(31, 2, 2, 92);
  // 引っかき傷
  ctx.strokeStyle = 'rgba(180,170,150,0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(14 + i * 3, 28);
    ctx.lineTo(16 + i * 3, 46);
    ctx.stroke();
  }
  // 打ち付けられた木の板（バッテン）
  ctx.save();
  ctx.strokeStyle = '#6f5132';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(4, 24);
  ctx.lineTo(60, 68);
  ctx.moveTo(60, 26);
  ctx.lineTo(4, 70);
  ctx.stroke();
  ctx.restore();
  // 張り紙（立入禁止・使用禁止）
  ctx.fillStyle = '#d6ceb8';
  ctx.fillRect(20, 38, 24, 16);
  ctx.fillStyle = '#8b1e1e';
  ctx.fillRect(24, 42, 16, 2);
  ctx.fillRect(24, 47, 16, 2);
  addNoise(ctx, 64, 96, 16);
  return finalizeTexture(c, 1, 1);
}

// 階段テクスチャ
function createStairTex() {
  const c = makeCanvas(64, 64);
  const ctx = c.getContext('2d');
  for (let y = 0; y < 64; y += 8) {
    ctx.fillStyle = '#64625b';
    ctx.fillRect(0, y, 64, 6);
    ctx.fillStyle = '#353430';
    ctx.fillRect(0, y + 6, 64, 2);
    // 滑り止めライン
    ctx.fillStyle = '#8b836f';
    ctx.fillRect(2, y + 1, 60, 1);
  }
  addNoise(ctx, 64, 64, 14);
  return finalizeTexture(c, 1, 2);
}

// 中庭の地面
function createGroundTex() {
  const c = makeCanvas(64, 64);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#293326';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#38342b';
  for (let i = 0; i < 40; i++) {
    ctx.fillRect(Math.random() * 60, Math.random() * 60, 4, 4);
  }
  addNoise(ctx, 64, 64, 18);
  return finalizeTexture(c, 8, 8);
}

// ガラス窓（半透明）
function createWindowTex() {
  const c = makeCanvas(64, 64);
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(20, 32, 46, 0.45)';
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = 'rgba(90, 98, 108, 0.85)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 60, 60);
  ctx.fillStyle = 'rgba(80, 88, 96, 0.85)';
  ctx.fillRect(31, 0, 2, 64);
  ctx.fillRect(0, 31, 64, 2);
  addNoise(ctx, 64, 64, 10);
  return finalizeTexture(c, 1, 1);
}

// 赤いコートの布地（深紅＋汚れ）
function createRedCoatTex() {
  const c = makeCanvas(64, 64);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8b1116';
  ctx.fillRect(0, 0, 64, 64);
  // 裾の泥・血のような暗がり
  const grad = ctx.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, 'rgba(180,25,30,0.2)');
  grad.addColorStop(0.7, 'rgba(40,5,8,0.1)');
  grad.addColorStop(1, 'rgba(15,4,6,0.7)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  // ボタン
  ctx.fillStyle = '#240808';
  ctx.fillRect(30, 14, 4, 4);
  ctx.fillRect(30, 28, 4, 4);
  ctx.fillRect(30, 42, 4, 4);
  addNoise(ctx, 64, 64, 18);
  return finalizeTexture(c, 1, 1);
}

// 赤い帽子の女・歪んだ顔テクスチャ
function createGhostFaceTex() {
  const c = makeCanvas(64, 64);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#cbc6bc';
  ctx.fillRect(0, 0, 64, 64);
  // 目の窪み（非対称でいびつ）
  ctx.fillStyle = '#0e0a0d';
  ctx.beginPath();
  ctx.ellipse(20, 26, 7, 5, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(44, 30, 6, 8, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // 小さな白い瞳点
  ctx.fillStyle = '#d9d3c8';
  ctx.fillRect(21, 26, 2, 2);
  ctx.fillRect(43, 30, 2, 2);
  // 歪んだ大きな口
  ctx.fillStyle = '#180508';
  ctx.beginPath();
  ctx.ellipse(33, 47, 11, 7, 0.18, 0, Math.PI * 2);
  ctx.fill();
  // 顔の影
  ctx.fillStyle = 'rgba(20,15,20,0.35)';
  ctx.fillRect(0, 0, 64, 14);
  addNoise(ctx, 64, 64, 22);
  return finalizeTexture(c, 1, 1);
}

// 隠れられるスチールロッカーの扉（上に通気スリット付き）
function createLockerDoorTex() {
  const c = makeCanvas(64, 128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#535e5a';
  ctx.fillRect(0, 0, 64, 128);
  // 外枠
  ctx.strokeStyle = '#262c2a';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 60, 124);
  // 上部・下部の通気スリット（隙間！）
  ctx.fillStyle = '#0e1110';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(12, 16 + i * 7, 40, 3);
  }
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(12, 92 + i * 6, 40, 3);
  }
  // 名札枠
  ctx.fillStyle = '#9aa39c';
  ctx.fillRect(22, 54, 20, 9);
  ctx.fillStyle = '#c8c3b2';
  ctx.fillRect(24, 56, 16, 5);
  // 取っ手
  ctx.fillStyle = '#202424';
  ctx.fillRect(50, 62, 5, 16);
  // サビ・汚れ
  ctx.fillStyle = 'rgba(60, 35, 22, 0.28)';
  ctx.fillRect(4, 100, 18, 22);
  ctx.fillRect(42, 10, 14, 18);
  addNoise(ctx, 64, 128, 16);
  return finalizeTexture(c, 1, 1);
}

export function createTextures() {
  return {
    schoolWall: createSchoolWallTex(),
    annexWall: createAnnexWallTex(),
    corridorFloor: createCorridorFloorTex(),
    woodFloor: createWoodFloorTex(),
    ceiling: createCeilingTex(),
    exteriorWall: createExteriorWallTex(),
    door: createDoorTex(),
    lockerDoor: createLockerDoorTex(),
    blackboard: createBlackboardTex(false),
    musicBlackboard: createBlackboardTex(true),
    sealedLocker: createSealedLockerTex(),
    stair: createStairTex(),
    ground: createGroundTex(),
    windowGlass: createWindowTex(),
    redCoat: createRedCoatTex(),
    ghostFace: createGhostFaceTex()
  };
}
