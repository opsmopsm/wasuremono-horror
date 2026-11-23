import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finalizeTexture(canvas, repeatX = 1, repeatY = 1, isColor = true) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return tex;
}

function addSoftNoise(ctx, w, h, amount = 12, monochrome = false) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n1 = (Math.random() - 0.5) * amount * 2;
    const n2 = monochrome ? n1 : (Math.random() - 0.5) * amount * 1.4;
    const n3 = monochrome ? n1 : (Math.random() - 0.5) * amount * 1.4;
    d[i] = Math.max(0, Math.min(255, d[i] + n1));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n2));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n3));
  }
  ctx.putImageData(img, 0, 0);
}

// 汎用バンプマップ（漆喰・コンクリ微細凹凸）
function createPlasterBumpTex() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 160; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 6 + Math.random() * 22;
    const v = Math.random() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    ctx.fillStyle = v;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  addSoftNoise(ctx, 256, 256, 16, true);
  return finalizeTexture(c, 1, 1, false);
}

// 廊下タイルのラフネスマップ（ワックス反射のムラ）
function createCorridorRoughnessTex() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5a5a5a'; // しっとり艶あり
  ctx.fillRect(0, 0, 256, 256);
  const tile = 64;
  for (let y = 0; y < 256; y += tile) {
    for (let x = 0; x < 256; x += tile) {
      ctx.strokeStyle = '#d0d0d0'; // 目地は艶なし
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1, y + 1, tile - 2, tile - 2);
    }
  }
  // 歩かれた部分の微細な擦れ（少しマット）
  for (let i = 0; i < 50; i++) {
    ctx.fillStyle = 'rgba(180,180,180,0.12)';
    ctx.beginPath();
    ctx.ellipse(Math.random() * 256, Math.random() * 256, 18 + Math.random() * 28, 6 + Math.random() * 14, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  addSoftNoise(ctx, 256, 256, 10, true);
  return finalizeTexture(c, 1, 1, false);
}

// 校舎内壁（256x256 高精細：クリーム塗り壁＋灰緑腰壁＋木見切り＋巾木＋陰影）
function createSchoolWallTex() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');

  // 上部塗り壁グラデ
  const topGrad = ctx.createLinearGradient(0, 0, 0, 148);
  topGrad.addColorStop(0, '#9a9685');
  topGrad.addColorStop(0.6, '#aba794');
  topGrad.addColorStop(1, '#989483');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, 256, 148);

  // 下部腰壁（落ち着いた学校の灰緑）
  const lowGrad = ctx.createLinearGradient(0, 152, 0, 246);
  lowGrad.addColorStop(0, '#5a665c');
  lowGrad.addColorStop(0.5, '#626f64');
  lowGrad.addColorStop(1, '#4b554d');
  ctx.fillStyle = lowGrad;
  ctx.fillRect(0, 152, 256, 94);

  // 木製の見切りレール＆立体影
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.fillRect(0, 153, 256, 5);
  ctx.fillStyle = '#4e3927';
  ctx.fillRect(0, 145, 256, 9);
  ctx.fillStyle = '#6b513a';
  ctx.fillRect(0, 146, 256, 2);

  // 巾木（床際）
  ctx.fillStyle = '#33261b';
  ctx.fillRect(0, 244, 256, 12);
  ctx.fillStyle = '#4d3a2a';
  ctx.fillRect(0, 244, 256, 2);

  // 天井際のわずかな影と水シミ
  const ceilShadow = ctx.createLinearGradient(0, 0, 0, 26);
  ceilShadow.addColorStop(0, 'rgba(15,15,12,0.4)');
  ceilShadow.addColorStop(1, 'rgba(15,15,12,0)');
  ctx.fillStyle = ceilShadow;
  ctx.fillRect(0, 0, 256, 26);

  for (let i = 0; i < 6; i++) {
    const sx = 20 + i * 42 + Math.random() * 14;
    const sg = ctx.createLinearGradient(sx, 0, sx, 90 + Math.random() * 50);
    sg.addColorStop(0, 'rgba(38, 34, 26, 0.22)');
    sg.addColorStop(1, 'rgba(38, 34, 26, 0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sx, 0, 10 + Math.random() * 12, 120);
  }

  addSoftNoise(ctx, 256, 256, 9);
  return finalizeTexture(c, 1, 1);
}

// 別館の古い壁（256x256：古びた木目腰板＋黄ばみ漆喰＋濃い雨染み）
function createAnnexWallTex() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');

  const topGrad = ctx.createLinearGradient(0, 0, 0, 144);
  topGrad.addColorStop(0, '#7c745f');
  topGrad.addColorStop(0.5, '#8e856d');
  topGrad.addColorStop(1, '#756c57');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, 256, 144);

  // 木板腰壁
  ctx.fillStyle = '#4c3d2d';
  ctx.fillRect(0, 148, 256, 108);
  for (let x = 0; x < 256; x += 16) {
    ctx.fillStyle = x % 32 === 0 ? 'rgba(255,220,180,0.04)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(x, 148, 15, 108);
    ctx.fillStyle = 'rgba(18, 12, 8, 0.55)';
    ctx.fillRect(x, 148, 2, 108);
  }
  // 見切り＆巾木
  ctx.fillStyle = '#2d2116';
  ctx.fillRect(0, 142, 256, 10);
  ctx.fillRect(0, 245, 256, 11);

  // 濃い経年シミ
  for (let i = 0; i < 8; i++) {
    const sx = Math.random() * 240;
    const sg = ctx.createLinearGradient(sx, 0, sx, 130);
    sg.addColorStop(0, 'rgba(28, 20, 12, 0.34)');
    sg.addColorStop(1, 'rgba(28, 20, 12, 0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sx, 0, 16 + Math.random() * 18, 130);
  }

  addSoftNoise(ctx, 256, 256, 12);
  return finalizeTexture(c, 1, 1);
}

// 廊下のリノリウム床（256x256：リアルな市松タイル＋微細マーブル模様＋目地）
function createCorridorFloorTex() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const tile = 64;
  for (let y = 0; y < 256; y += tile) {
    for (let x = 0; x < 256; x += tile) {
      const alt = ((x / tile) + (y / tile)) % 2 === 0;
      ctx.fillStyle = alt ? '#767367' : '#68655b';
      ctx.fillRect(x, y, tile, tile);

      // マーブル斑点
      for (let m = 0; m < 18; m++) {
        ctx.fillStyle = m % 2 === 0 ? 'rgba(255,250,238,0.06)' : 'rgba(25,24,20,0.07)';
        ctx.fillRect(x + Math.random() * (tile - 8), y + Math.random() * (tile - 3), 8 + Math.random() * 10, 2);
      }

      ctx.strokeStyle = 'rgba(22, 20, 17, 0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, tile - 2, tile - 2);
    }
  }
  addSoftNoise(ctx, 256, 256, 8);
  return finalizeTexture(c, 1, 1);
}

// 教室・音楽室のフローリング木床（256x256：木目＆板継ぎ目＆ニス艶）
function createWoodFloorTex() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const plankH = 24;
  for (let row = 0; row < 11; row++) {
    const y = row * plankH;
    const shade = (row % 3 === 0) ? '#6e5034' : (row % 3 === 1) ? '#78593c' : '#64482e';
    ctx.fillStyle = shade;
    ctx.fillRect(0, y, 256, plankH);

    // 木目スジ
    for (let g = 0; g < 8; g++) {
      ctx.fillStyle = g % 2 === 0 ? 'rgba(36, 22, 10, 0.14)' : 'rgba(170, 130, 88, 0.08)';
      ctx.fillRect(0, y + 2 + g * 2.6, 256, 1.4);
    }
    // 水平の目地
    ctx.fillStyle = '#2f1f12';
    ctx.fillRect(0, y + plankH - 1.5, 256, 1.8);
    // 垂直の板継ぎ目
    const joint = ((row * 97 + 41) % 210) + 20;
    ctx.fillRect(joint, y, 2, plankH);
  }
  addSoftNoise(ctx, 256, 256, 8);
  return finalizeTexture(c, 1, 1);
}

// 天井吸音ボード（256x256：ジプトーン風点々＋格子枠）
function createCeilingTex() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#828179';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 64) {
    for (let x = 0; x < 256; x += 64) {
      ctx.strokeStyle = '#52514c';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, 62, 62);
      // 吸音穴パターン
      ctx.fillStyle = 'rgba(30,30,28,0.22)';
      for (let i = 0; i < 24; i++) {
        ctx.fillRect(x + 6 + Math.random() * 50, y + 6 + Math.random() * 50, 2, 2);
      }
    }
  }
  addSoftNoise(ctx, 256, 256, 7);
  return finalizeTexture(c, 1, 1);
}

// 校舎外壁コンクリート（256x256）
function createExteriorWallTex() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#75746b';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(30,32,34,0.35)';
  ctx.lineWidth = 2;
  for (let y = 0; y < 256; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  addSoftNoise(ctx, 256, 256, 14);
  return finalizeTexture(c, 1, 1);
}

// 木製引き戸（256x384 高精細：木目枠＋曇りガラス格子＋金属引手）
function createDoorTex() {
  const c = makeCanvas(256, 384);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#60452c';
  ctx.fillRect(0, 0, 256, 384);
  // 木目
  for (let x = 0; x < 256; x += 6) {
    ctx.fillStyle = x % 12 === 0 ? 'rgba(30,18,8,0.12)' : 'rgba(145,105,65,0.06)';
    ctx.fillRect(x, 0, 3, 384);
  }
  // 外枠
  ctx.strokeStyle = '#332112';
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, 242, 370);

  // 上部すりガラス窓
  const glassGrad = ctx.createLinearGradient(32, 32, 224, 196);
  glassGrad.addColorStop(0, '#1e2c36');
  glassGrad.addColorStop(0.5, '#2b3d4a');
  glassGrad.addColorStop(1, '#141e26');
  ctx.fillStyle = glassGrad;
  ctx.fillRect(34, 34, 188, 162);
  // 格子桟
  ctx.fillStyle = '#47301d';
  ctx.fillRect(123, 34, 10, 162);
  ctx.fillRect(34, 110, 188, 10);
  ctx.strokeStyle = '#2d1c10';
  ctx.lineWidth = 4;
  ctx.strokeRect(34, 34, 188, 162);

  // 下部パネル（立体縁）
  ctx.fillStyle = '#4c341f';
  ctx.fillRect(34, 224, 188, 126);
  ctx.strokeStyle = '#2f1e10';
  ctx.lineWidth = 5;
  ctx.strokeRect(34, 224, 188, 126);

  // 金属引き戸取っ手
  ctx.fillStyle = '#8b939b';
  ctx.fillRect(204, 204, 18, 46);
  ctx.fillStyle = '#3a3f45';
  ctx.fillRect(208, 210, 10, 34);

  addSoftNoise(ctx, 256, 384, 7);
  return finalizeTexture(c, 1, 1);
}

// 隠れられるスチールロッカー扉（256x512：金属質感＋立体通気ルーバー＋名札＋サビ）
function createLockerDoorTex() {
  const c = makeCanvas(256, 512);
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 256, 512);
  grad.addColorStop(0, '#5a6661');
  grad.addColorStop(0.5, '#4c5753');
  grad.addColorStop(1, '#3c4542');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 512);

  // 立体ベベル枠
  ctx.strokeStyle = '#222826';
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, 244, 500);
  ctx.strokeStyle = 'rgba(210,225,220,0.18)';
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, 228, 484);

  // 上部・下部ルーバー（立体通気スリット）
  const drawSlits = (startY, count) => {
    for (let i = 0; i < count; i++) {
      const y = startY + i * 24;
      ctx.fillStyle = '#070a09';
      ctx.fillRect(46, y, 164, 10);
      ctx.fillStyle = 'rgba(200,215,210,0.22)';
      ctx.fillRect(46, y + 10, 164, 3);
    }
  };
  drawSlits(56, 5);
  drawSlits(366, 4);

  // 名札ホルダー
  ctx.fillStyle = '#9aa39d';
  ctx.fillRect(88, 210, 80, 34);
  ctx.fillStyle = '#d4cebc';
  ctx.fillRect(94, 216, 68, 22);

  // 金属ハンドル＋鍵穴
  ctx.fillStyle = '#262b2c';
  ctx.fillRect(198, 246, 22, 68);
  ctx.fillStyle = '#7b8588';
  ctx.fillRect(202, 252, 14, 52);

  // 下部のサビ汚れ
  const rust = ctx.createRadialGradient(45, 470, 10, 45, 470, 95);
  rust.addColorStop(0, 'rgba(92, 46, 24, 0.5)');
  rust.addColorStop(1, 'rgba(92, 46, 24, 0)');
  ctx.fillStyle = rust;
  ctx.fillRect(0, 380, 160, 132);

  addSoftNoise(ctx, 256, 512, 8);
  return finalizeTexture(c, 1, 1);
}

// 黒板（512x256 高精細）
function createBlackboardTex(musicLines = false) {
  const c = makeCanvas(512, 256);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 512, 256);
  g.addColorStop(0, '#1c3626');
  g.addColorStop(0.5, '#22402d');
  g.addColorStop(1, '#182f21');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);

  // チョーク消し跡の霞み
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = 'rgba(225,235,225,0.035)';
    ctx.beginPath();
    ctx.ellipse(60 + Math.random() * 390, 40 + Math.random() * 170, 45 + Math.random() * 55, 18 + Math.random() * 24, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (musicLines) {
    ctx.fillStyle = 'rgba(235, 240, 228, 0.52)';
    for (let group = 0; group < 2; group++) {
      const baseY = 58 + group * 92;
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(36, baseY + i * 11, 440, 2);
      }
    }
  } else {
    ctx.fillStyle = 'rgba(235, 240, 228, 0.45)';
    ctx.font = '20px "Yu Mincho", serif';
    ctx.fillText('日直', 442, 48);
    ctx.fillRect(434, 24, 2, 180);
    ctx.fillRect(60, 62, 150, 4);
    ctx.fillRect(60, 88, 110, 4);
  }

  // 木枠＋チョーク受け
  ctx.strokeStyle = '#5c4026';
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, 498, 242);
  ctx.fillStyle = '#47301b';
  ctx.fillRect(14, 234, 484, 14);

  addSoftNoise(ctx, 512, 256, 6);
  return finalizeTexture(c, 1, 1);
}

// 封鎖された楽器収納庫（256x384 高精細）
function createSealedLockerTex() {
  const c = makeCanvas(256, 384);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#38322b';
  ctx.fillRect(0, 0, 256, 384);
  ctx.strokeStyle = '#181512';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 246, 374);
  ctx.fillStyle = '#15120f';
  ctx.fillRect(125, 8, 6, 368);

  // 爪の引っかき傷
  ctx.strokeStyle = 'rgba(205, 192, 170, 0.42)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(52 + i * 9, 98);
    ctx.lineTo(62 + i * 9, 178);
    ctx.stroke();
  }

  // 打ち付けられた木の板（バッテン＋影＋釘）
  const drawPlank = (x1, y1, x2, y2) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 36;
    ctx.beginPath();
    ctx.moveTo(x1, y1 + 6);
    ctx.lineTo(x2, y2 + 6);
    ctx.stroke();

    ctx.strokeStyle = '#735334';
    ctx.lineWidth = 30;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // 釘頭
    ctx.fillStyle = '#252629';
    [[x1 + (x2 - x1) * 0.12, y1 + (y2 - y1) * 0.12], [x1 + (x2 - x1) * 0.88, y1 + (y2 - y1) * 0.88]].forEach(([nx, ny]) => {
      ctx.beginPath();
      ctx.arc(nx, ny, 4.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  };
  drawPlank(18, 96, 238, 276);
  drawPlank(238, 102, 18, 282);

  // 張り紙「使用禁止」
  ctx.fillStyle = '#dcd4bd';
  ctx.fillRect(76, 152, 104, 66);
  ctx.strokeStyle = '#8b1e1e';
  ctx.lineWidth = 3;
  ctx.strokeRect(82, 158, 92, 54);
  ctx.fillStyle = '#8b1e1e';
  ctx.font = 'bold 20px "Yu Mincho", serif';
  ctx.textAlign = 'center';
  ctx.fillText('使用禁止', 128, 192);

  addSoftNoise(ctx, 256, 384, 11);
  return finalizeTexture(c, 1, 1);
}

// 階段テクスチャ（256x256）
function createStairTex() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  for (let y = 0; y < 256; y += 32) {
    ctx.fillStyle = '#68665e';
    ctx.fillRect(0, y, 256, 25);
    ctx.fillStyle = '#33322e';
    ctx.fillRect(0, y + 25, 256, 7);
    // 真鍮色の滑り止めライン
    ctx.fillStyle = '#998d6e';
    ctx.fillRect(10, y + 4, 236, 4);
  }
  addSoftNoise(ctx, 256, 256, 9);
  return finalizeTexture(c, 1, 2);
}

// 中庭地面（256x256）
function createGroundTex() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#243022';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 220; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(58, 52, 42, 0.35)' : 'rgba(34, 58, 34, 0.35)';
    ctx.beginPath();
    ctx.arc(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 14, 0, Math.PI * 2);
    ctx.fill();
  }
  addSoftNoise(ctx, 256, 256, 12);
  return finalizeTexture(c, 8, 8);
}

// 窓ガラス（256x256）
function createWindowTex() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 256, 256);
  g.addColorStop(0, 'rgba(32, 48, 68, 0.34)');
  g.addColorStop(0.5, 'rgba(18, 28, 42, 0.22)');
  g.addColorStop(1, 'rgba(42, 60, 82, 0.36)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  // アルミサッシ枠
  ctx.strokeStyle = 'rgba(105, 114, 124, 0.92)';
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, 244, 244);
  ctx.fillStyle = 'rgba(92, 100, 110, 0.9)';
  ctx.fillRect(124, 0, 8, 256);
  ctx.fillRect(0, 124, 256, 8);
  return finalizeTexture(c, 1, 1);
}

// 赤いコート布地（256x256：深紅のウール織り目＋裾の暗い汚れ＋ダブルボタン）
function createRedCoatTex() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#9c1118');
  g.addColorStop(0.65, '#7e0c12');
  g.addColorStop(1, '#260408');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  // ウール繊維テクスチャ
  for (let y = 0; y < 256; y += 4) {
    ctx.fillStyle = y % 8 === 0 ? 'rgba(255,80,80,0.04)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(0, y, 256, 2);
  }
  // 合わせ目＆ボタン
  ctx.fillStyle = 'rgba(25, 4, 6, 0.55)';
  ctx.fillRect(126, 0, 4, 256);
  [54, 110, 166].forEach((by) => {
    [106, 150].forEach((bx) => {
      ctx.fillStyle = '#1c0507';
      ctx.beginPath();
      ctx.arc(bx, by, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(180,90,95,0.35)';
      ctx.beginPath();
      ctx.arc(bx - 2, by - 2, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  addSoftNoise(ctx, 256, 256, 11);
  return finalizeTexture(c, 1, 1);
}

// 赤い帽子の女・歪んだ顔（256x256：蒼白く不気味な陰影＋非対称の窪んだ目と口）
function createGhostFaceTex() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const bg = ctx.createRadialGradient(128, 128, 25, 128, 128, 145);
  bg.addColorStop(0, '#d8d3c9');
  bg.addColorStop(0.75, '#b6b0a6');
  bg.addColorStop(1, '#6f6a66');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 256);

  // 帽子のつばが落とす額の暗い影
  const topShadow = ctx.createLinearGradient(0, 0, 0, 80);
  topShadow.addColorStop(0, 'rgba(10, 6, 12, 0.72)');
  topShadow.addColorStop(1, 'rgba(10, 6, 12, 0)');
  ctx.fillStyle = topShadow;
  ctx.fillRect(0, 0, 256, 80);

  // 深い隈と非対称の黒い眼窩
  const drawEye = (ex, ey, rx, ry, rot) => {
    const halo = ctx.createRadialGradient(ex, ey, rx * 0.4, ex, ey, rx * 1.9);
    halo.addColorStop(0, 'rgba(12, 6, 14, 0.85)');
    halo.addColorStop(1, 'rgba(12, 6, 14, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(ex, ey, rx * 1.9, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(rot);
    ctx.fillStyle = '#090609';
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    // わずかに光る小さな瞳点
    ctx.fillStyle = '#ebe4d6';
    ctx.beginPath();
    ctx.arc(2, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  drawEye(82, 108, 24, 17, -0.24);
  drawEye(174, 122, 22, 27, 0.28);

  // 歪んで開いた口
  ctx.save();
  ctx.translate(132, 192);
  ctx.rotate(0.16);
  ctx.fillStyle = '#140306';
  ctx.beginPath();
  ctx.ellipse(0, 0, 42, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  addSoftNoise(ctx, 256, 256, 10);
  return finalizeTexture(c, 1, 1);
}

export function createTextures() {
  return {
    plasterBump: createPlasterBumpTex(),
    corridorRoughness: createCorridorRoughnessTex(),
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
