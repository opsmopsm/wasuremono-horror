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

// Sobelフィルタでグレースケール輝度から本物の接空間ノーマルマップを高速生成！
function canvasToNormalTex(srcCanvas, strength = 2.4, repeatX = 1, repeatY = 1) {
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const sCtx = srcCanvas.getContext('2d');
  const src = sCtx.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  for (let i = 0, p = 0; i < lum.length; i++, p += 4) {
    lum[i] = (src[p] * 0.299 + src[p + 1] * 0.587 + src[p + 2] * 0.114) / 255;
  }

  const outCanvas = makeCanvas(w, h);
  const oCtx = outCanvas.getContext('2d');
  const outImg = oCtx.createImageData(w, h);
  const dst = outImg.data;

  const sample = (x, y) => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return lum[wy * w + wx];
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);

      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1.0;
      const invLen = 1.0 / Math.hypot(nx, ny, nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const idx = (y * w + x) * 4;
      dst[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }
  oCtx.putImageData(outImg, 0, 0);
  return finalizeTexture(outCanvas, repeatX, repeatY, false);
}

// 汎用バンプ／漆喰ディテールキャンバス
function createPlasterBumpCanvas() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 240; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 4 + Math.random() * 20;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // 微細なひび割れ
  ctx.strokeStyle = 'rgba(20,20,20,0.45)';
  ctx.lineWidth = 1.2;
  for (let k = 0; k < 10; k++) {
    let cx = Math.random() * 256;
    let cy = Math.random() * 256;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    for (let s = 0; s < 6; s++) {
      cx += (Math.random() - 0.5) * 28;
      cy += Math.random() * 22;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }
  addSoftNoise(ctx, 256, 256, 20, true);
  return c;
}

// 廊下タイルのラフネスマップ（濡れた水たまり＆ワックス鏡面反射コントラスト！）
function createCorridorRoughnessTex() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#929292'; // ベースは程よい半艶
  ctx.fillRect(0, 0, 256, 256);

  const tile = 64;
  for (let y = 0; y < 256; y += tile) {
    for (let x = 0; x < 256; x += tile) {
      // タイルごとの微妙な艶差
      const v = 115 + Math.floor(Math.random() * 45);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
      ctx.strokeStyle = '#e8e8e8'; // 目地は完全マット
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1, y + 1, tile - 2, tile - 2);
    }
  }

  // 湿気・ワックスの光沢パッチ（暗い＝低ラフネス＝鏡のように光を反射！）
  for (let i = 0; i < 14; i++) {
    const px = Math.random() * 256;
    const py = Math.random() * 256;
    const rx = 20 + Math.random() * 42;
    const ry = 12 + Math.random() * 30;
    const grad = ctx.createRadialGradient(px, py, 3, px, py, Math.max(rx, ry));
    grad.addColorStop(0, 'rgba(18, 18, 18, 0.85)');
    grad.addColorStop(0.65, 'rgba(42, 42, 42, 0.55)');
    grad.addColorStop(1, 'rgba(130, 130, 130, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(px, py, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // 足跡の擦れ（マット）
  for (let i = 0; i < 45; i++) {
    ctx.fillStyle = 'rgba(210,210,210,0.14)';
    ctx.beginPath();
    ctx.ellipse(Math.random() * 256, Math.random() * 256, 14 + Math.random() * 26, 4 + Math.random() * 10, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  addSoftNoise(ctx, 256, 256, 12, true);
  return finalizeTexture(c, 1, 1, false);
}

// 校舎内壁（リアルな経年劣化塗り壁＋腰壁＋強いAO影＋水シミ＋ひび割れ＋法線用凹凸）
function createSchoolWallSet() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');

  // 上部塗り壁（少しくすんだ夜の漆喰コンクリ）
  const topGrad = ctx.createLinearGradient(0, 0, 0, 148);
  topGrad.addColorStop(0, '#6c6a60');
  topGrad.addColorStop(0.2, '#8b887a');
  topGrad.addColorStop(0.78, '#807d70');
  topGrad.addColorStop(1, '#68655a');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, 256, 148);

  // 漆喰のムラ・剥がれパッチ
  for (let i = 0; i < 45; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 144;
    const r = 8 + Math.random() * 24;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(42, 40, 34, 0.16)' : 'rgba(180, 175, 160, 0.1)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 下部腰壁（学校の深い灰緑塗装＋擦れ傷）
  const lowGrad = ctx.createLinearGradient(0, 152, 0, 246);
  lowGrad.addColorStop(0, '#445047');
  lowGrad.addColorStop(0.45, '#4c594f');
  lowGrad.addColorStop(0.85, '#38423a');
  lowGrad.addColorStop(1, '#232a25');
  ctx.fillStyle = lowGrad;
  ctx.fillRect(0, 152, 256, 94);

  // 腰壁の擦れ・黒ずみ・縦パネル目地
  for (let x = 0; x < 256; x += 64) {
    ctx.fillStyle = 'rgba(10, 14, 12, 0.35)';
    ctx.fillRect(x, 152, 2, 94);
    ctx.fillStyle = 'rgba(200, 215, 200, 0.08)';
    ctx.fillRect(x + 2, 152, 1, 94);
  }
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = 'rgba(18, 22, 18, 0.22)';
    ctx.fillRect(Math.random() * 256, 175 + Math.random() * 65, 10 + Math.random() * 28, 2 + Math.random() * 4);
  }

  // 木製の見切りレール＆深い立体ドロップシャドウ
  ctx.fillStyle = 'rgba(0,0,0,0.52)';
  ctx.fillRect(0, 153, 256, 8);
  ctx.fillStyle = '#3f2d1e';
  ctx.fillRect(0, 144, 256, 10);
  ctx.fillStyle = '#6e523a';
  ctx.fillRect(0, 145, 256, 2);
  ctx.fillStyle = '#1e140c';
  ctx.fillRect(0, 152, 256, 2);

  // 巾木（床際AO強め）
  const floorAO = ctx.createLinearGradient(0, 222, 0, 256);
  floorAO.addColorStop(0, 'rgba(0,0,0,0)');
  floorAO.addColorStop(1, 'rgba(0,0,0,0.68)');
  ctx.fillStyle = floorAO;
  ctx.fillRect(0, 222, 256, 34);
  ctx.fillStyle = '#241a12';
  ctx.fillRect(0, 244, 256, 12);
  ctx.fillStyle = '#473527';
  ctx.fillRect(0, 244, 256, 2);

  // 天井際の濃いAO影と雨染みドリップ
  const ceilShadow = ctx.createLinearGradient(0, 0, 0, 38);
  ceilShadow.addColorStop(0, 'rgba(8, 10, 12, 0.72)');
  ceilShadow.addColorStop(1, 'rgba(8, 10, 12, 0)');
  ctx.fillStyle = ceilShadow;
  ctx.fillRect(0, 0, 256, 38);

  for (let i = 0; i < 11; i++) {
    const sx = Math.random() * 246;
    const hLen = 50 + Math.random() * 95;
    const sg = ctx.createLinearGradient(sx, 0, sx, hLen);
    sg.addColorStop(0, 'rgba(24, 20, 14, 0.42)');
    sg.addColorStop(1, 'rgba(24, 20, 14, 0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sx, 0, 6 + Math.random() * 14, hLen);
  }

  // 壁のひび割れ
  ctx.strokeStyle = 'rgba(20, 18, 15, 0.45)';
  ctx.lineWidth = 1.2;
  for (let k = 0; k < 5; k++) {
    let cx = 20 + Math.random() * 216;
    let cy = 10 + Math.random() * 80;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    for (let s = 0; s < 5; s++) {
      cx += (Math.random() - 0.5) * 20;
      cy += 8 + Math.random() * 16;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  addSoftNoise(ctx, 256, 256, 13);
  return {
    map: finalizeTexture(c, 1, 1),
    normal: canvasToNormalTex(c, 2.2)
  };
}

// 別館の廃墟風壁（参考ポストの重厚コンクリ＆剥落漆喰＆赤錆シミ＆湿気質感！）
function createAnnexWallSet() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');

  const topGrad = ctx.createLinearGradient(0, 0, 0, 148);
  topGrad.addColorStop(0, '#4f4a3f');
  topGrad.addColorStop(0.35, '#665f50');
  topGrad.addColorStop(1, '#4a4438');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, 256, 148);

  // 剥がれコンクリート下地＋赤茶の錆・カビシミ
  for (let i = 0; i < 65; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 6 + Math.random() * 24;
    if (i % 5 === 0) {
      ctx.fillStyle = 'rgba(72, 24, 16, 0.24)'; // 赤錆／血染み風の経年汚れ
    } else if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(20, 18, 14, 0.28)';
    } else {
      ctx.fillStyle = 'rgba(135, 128, 112, 0.14)';
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 古びた木板腰壁（深い溝）
  ctx.fillStyle = '#382c20';
  ctx.fillRect(0, 148, 256, 108);
  for (let x = 0; x < 256; x += 16) {
    ctx.fillStyle = x % 32 === 0 ? 'rgba(255,210,165,0.05)' : 'rgba(0,0,0,0.12)';
    ctx.fillRect(x, 148, 14, 108);
    ctx.fillStyle = 'rgba(10, 7, 4, 0.78)';
    ctx.fillRect(x, 148, 2, 108);
  }
  ctx.fillStyle = '#1e160e';
  ctx.fillRect(0, 142, 256, 10);
  ctx.fillRect(0, 244, 256, 12);

  // 濃い縦の雨だれ・湿気シミ
  for (let i = 0; i < 16; i++) {
    const sx = Math.random() * 244;
    const hLen = 70 + Math.random() * 140;
    const sg = ctx.createLinearGradient(sx, 0, sx, hLen);
    sg.addColorStop(0, i % 3 === 0 ? 'rgba(54, 16, 12, 0.42)' : 'rgba(14, 12, 10, 0.52)');
    sg.addColorStop(1, 'rgba(14, 12, 10, 0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sx, 0, 8 + Math.random() * 18, hLen);
  }

  // 天井・床の濃いAO
  const topAO = ctx.createLinearGradient(0, 0, 0, 40);
  topAO.addColorStop(0, 'rgba(0,0,0,0.78)');
  topAO.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = topAO;
  ctx.fillRect(0, 0, 256, 40);

  const botAO = ctx.createLinearGradient(0, 200, 0, 256);
  botAO.addColorStop(0, 'rgba(0,0,0,0)');
  botAO.addColorStop(1, 'rgba(0,0,0,0.82)');
  ctx.fillStyle = botAO;
  ctx.fillRect(0, 200, 256, 56);

  addSoftNoise(ctx, 256, 256, 18);
  return {
    map: finalizeTexture(c, 1, 1),
    normal: canvasToNormalTex(c, 3.6)
  };
}

// 廊下のリノリウム床（濡れた艶・汚れ・深い目地＋ノーマルマップ）
function createCorridorFloorSet() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const tile = 64;
  for (let y = 0; y < 256; y += tile) {
    for (let x = 0; x < 256; x += tile) {
      const alt = ((x / tile) + (y / tile)) % 2 === 0;
      ctx.fillStyle = alt ? '#5e5c53' : '#514f48';
      ctx.fillRect(x, y, tile, tile);

      // マーブル斑点＆細かい擦れ
      for (let m = 0; m < 24; m++) {
        ctx.fillStyle = m % 2 === 0 ? 'rgba(235,230,218,0.06)' : 'rgba(16,16,14,0.11)';
        ctx.fillRect(x + Math.random() * (tile - 8), y + Math.random() * (tile - 3), 6 + Math.random() * 12, 2);
      }

      // 目地の影とハイライト
      ctx.strokeStyle = 'rgba(12, 12, 10, 0.72)';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x + 1, y + 1, tile - 2, tile - 2);
    }
  }
  // 湿った黒ずみパッチ
  for (let i = 0; i < 12; i++) {
    const px = Math.random() * 256;
    const py = Math.random() * 256;
    const rad = 18 + Math.random() * 34;
    const g = ctx.createRadialGradient(px, py, 2, px, py, rad);
    g.addColorStop(0, 'rgba(14, 16, 18, 0.34)');
    g.addColorStop(1, 'rgba(14, 16, 18, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  addSoftNoise(ctx, 256, 256, 10);
  return {
    map: finalizeTexture(c, 1, 1),
    normal: canvasToNormalTex(c, 2.4)
  };
}

// 教室・音楽室のフローリング木床（深い木目＆板継ぎ目＋ノーマルマップ）
function createWoodFloorSet() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const plankH = 24;
  for (let row = 0; row < 11; row++) {
    const y = row * plankH;
    const shade = (row % 3 === 0) ? '#5a4028' : (row % 3 === 1) ? '#63472e' : '#503823';
    ctx.fillStyle = shade;
    ctx.fillRect(0, y, 256, plankH);

    for (let g = 0; g < 9; g++) {
      ctx.fillStyle = g % 2 === 0 ? 'rgba(26, 14, 6, 0.2)' : 'rgba(170, 128, 86, 0.08)';
      ctx.fillRect(0, y + 2 + g * 2.4, 256, 1.4);
    }
    ctx.fillStyle = '#1f140b';
    ctx.fillRect(0, y + plankH - 2, 256, 2.2);
    const joint = ((row * 97 + 41) % 210) + 20;
    ctx.fillRect(joint, y, 2.5, plankH);
  }
  addSoftNoise(ctx, 256, 256, 10);
  return {
    map: finalizeTexture(c, 1, 1),
    normal: canvasToNormalTex(c, 2.8)
  };
}

// 天井吸音ボード（ジプトーン＋雨染み＋法線）
function createCeilingSet() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#6a6962';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 64) {
    for (let x = 0; x < 256; x += 64) {
      ctx.strokeStyle = '#383834';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x + 1, y + 1, 62, 62);
      ctx.fillStyle = 'rgba(20,20,18,0.32)';
      for (let i = 0; i < 28; i++) {
        ctx.fillRect(x + 5 + Math.random() * 52, y + 5 + Math.random() * 52, 2, 2);
      }
    }
  }
  // 雨漏りシミ
  for (let i = 0; i < 5; i++) {
    const g = ctx.createRadialGradient(Math.random() * 256, Math.random() * 256, 4, Math.random() * 256, Math.random() * 256, 48);
    g.addColorStop(0, 'rgba(35, 30, 22, 0.35)');
    g.addColorStop(1, 'rgba(35, 30, 22, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  }
  addSoftNoise(ctx, 256, 256, 9);
  return {
    map: finalizeTexture(c, 1, 1),
    normal: canvasToNormalTex(c, 2.0)
  };
}

// 校舎外壁コンクリート
function createExteriorWallTex() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5c5c55';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(20,22,24,0.48)';
  ctx.lineWidth = 2;
  for (let y = 0; y < 256; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  addSoftNoise(ctx, 256, 256, 16);
  return finalizeTexture(c, 1, 1);
}

// 木製引き戸（木目枠＋曇りガラス格子＋金属引手＋法線）
function createDoorSet() {
  const c = makeCanvas(256, 384);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#503923';
  ctx.fillRect(0, 0, 256, 384);
  for (let x = 0; x < 256; x += 6) {
    ctx.fillStyle = x % 12 === 0 ? 'rgba(20,12,5,0.18)' : 'rgba(145,105,65,0.06)';
    ctx.fillRect(x, 0, 3, 384);
  }
  ctx.strokeStyle = '#24170c';
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, 242, 370);

  // 上部すりガラス窓（夜の青反射）
  const glassGrad = ctx.createLinearGradient(32, 32, 224, 196);
  glassGrad.addColorStop(0, '#16242f');
  glassGrad.addColorStop(0.5, '#263c4c');
  glassGrad.addColorStop(1, '#0e171f');
  ctx.fillStyle = glassGrad;
  ctx.fillRect(34, 34, 188, 162);
  ctx.fillStyle = '#382516';
  ctx.fillRect(123, 34, 10, 162);
  ctx.fillRect(34, 110, 188, 10);
  ctx.strokeStyle = '#1e1209';
  ctx.lineWidth = 5;
  ctx.strokeRect(34, 34, 188, 162);

  // 下部パネル
  ctx.fillStyle = '#3d2a18';
  ctx.fillRect(34, 224, 188, 126);
  ctx.strokeStyle = '#1f130a';
  ctx.lineWidth = 6;
  ctx.strokeRect(34, 224, 188, 126);

  // 金属引き戸取っ手
  ctx.fillStyle = '#929ca6';
  ctx.fillRect(204, 204, 18, 46);
  ctx.fillStyle = '#2c3138';
  ctx.fillRect(208, 210, 10, 34);

  addSoftNoise(ctx, 256, 384, 9);
  return {
    map: finalizeTexture(c, 1, 1),
    normal: canvasToNormalTex(c, 2.5)
  };
}

// 隠れられるスチールロッカー扉（金属質感＋立体ルーバー＋サビ＋法線）
function createLockerDoorSet() {
  const c = makeCanvas(256, 512);
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 256, 512);
  grad.addColorStop(0, '#4f5b57');
  grad.addColorStop(0.5, '#3f4946');
  grad.addColorStop(1, '#2f3735');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 512);

  ctx.strokeStyle = '#181d1c';
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, 244, 500);
  ctx.strokeStyle = 'rgba(210,228,224,0.22)';
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, 228, 484);

  const drawSlits = (startY, count) => {
    for (let i = 0; i < count; i++) {
      const y = startY + i * 24;
      ctx.fillStyle = '#050706';
      ctx.fillRect(46, y, 164, 10);
      ctx.fillStyle = 'rgba(210,225,220,0.28)';
      ctx.fillRect(46, y + 10, 164, 3);
    }
  };
  drawSlits(56, 5);
  drawSlits(366, 4);

  ctx.fillStyle = '#9aa39d';
  ctx.fillRect(88, 210, 80, 34);
  ctx.fillStyle = '#d4cebc';
  ctx.fillRect(94, 216, 68, 22);

  ctx.fillStyle = '#1f2426';
  ctx.fillRect(198, 246, 22, 68);
  ctx.fillStyle = '#8b969c';
  ctx.fillRect(202, 252, 14, 52);

  const rust = ctx.createRadialGradient(45, 470, 10, 45, 470, 95);
  rust.addColorStop(0, 'rgba(92, 42, 18, 0.65)');
  rust.addColorStop(1, 'rgba(92, 42, 18, 0)');
  ctx.fillStyle = rust;
  ctx.fillRect(0, 380, 160, 132);

  addSoftNoise(ctx, 256, 512, 10);
  return {
    map: finalizeTexture(c, 1, 1),
    normal: canvasToNormalTex(c, 3.0)
  };
}

// 日本の夜の自動販売機「ヨルコーラ / YORU COLA」（参考ポストオマージュ！暗闇のフォトリアル象徴）
function createVendingMachineSet() {
  const c = makeCanvas(256, 512);
  const ctx = c.getContext('2d');
  const ec = makeCanvas(256, 512);
  const ectx = ec.getContext('2d');
  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, 256, 512);

  // 本体ボディ（古びた白〜暗灰メタル）
  const bodyG = ctx.createLinearGradient(0, 0, 256, 512);
  bodyG.addColorStop(0, '#c8c4b8');
  bodyG.addColorStop(0.5, '#a8a498');
  bodyG.addColorStop(1, '#6f6c62');
  ctx.fillStyle = bodyG;
  ctx.fillRect(0, 0, 256, 512);

  // 上部赤看板「ヨルコーラ / YORU COLA」
  ctx.fillStyle = '#9e1420';
  ctx.fillRect(14, 14, 228, 62);
  ectx.fillStyle = '#d92232';
  ectx.fillRect(18, 18, 220, 54);

  ctx.fillStyle = '#fff5e4';
  ctx.font = 'bold 28px "Yu Gothic", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ヨルコーラ', 128, 48);
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('YORU COLA  •  DRINKS', 128, 67);
  ectx.fillStyle = '#ffffff';
  ectx.font = 'bold 28px "Yu Gothic", sans-serif';
  ectx.textAlign = 'center';
  ectx.fillText('ヨルコーラ', 128, 48);
  ectx.font = 'bold 14px sans-serif';
  ectx.fillText('YORU COLA  •  DRINKS', 128, 67);

  // 発光ディスプレイ窓（3段の缶ジュース）
  ctx.fillStyle = '#d8eefa';
  ctx.fillRect(16, 86, 224, 220);
  ectx.fillStyle = '#9cd8ff';
  ectx.fillRect(18, 88, 220, 216);

  const canColors = ['#d9242e', '#1e78d4', '#2c9e52', '#e8a224', '#ebe6d6', '#303b48'];
  for (let row = 0; row < 3; row++) {
    const ry = 98 + row * 70;
    // 棚板
    ctx.fillStyle = '#30363c';
    ctx.fillRect(18, ry + 50, 220, 14);
    ectx.fillStyle = '#18242e';
    ectx.fillRect(18, ry + 50, 220, 14);

    // つめたい／あったか〜いバー
    const isHot = row === 2;
    ctx.fillStyle = isHot ? '#e04224' : '#1b7ad9';
    ctx.fillRect(22, ry + 53, 212, 8);
    ectx.fillStyle = isHot ? '#ff5533' : '#2ea2ff';
    ectx.fillRect(22, ry + 53, 212, 8);

    // 缶を6本並べる
    for (let col = 0; col < 6; col++) {
      const cx = 26 + col * 34;
      const colHex = canColors[(row * 3 + col) % canColors.length];
      ctx.fillStyle = colHex;
      ctx.fillRect(cx, ry + 8, 24, 40);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(cx + 3, ry + 10, 5, 36);
      ctx.fillStyle = '#cfd6dc';
      ctx.fillRect(cx + 2, ry + 5, 20, 4);

      ectx.fillStyle = colHex;
      ectx.fillRect(cx, ry + 8, 24, 40);
      // 価格ボタン（光るLED）
      ectx.fillStyle = '#fff3b0';
      ectx.fillRect(cx + 4, ry + 55, 16, 4);
    }
  }

  // コイン投入口・ICパネル・金額LED
  ctx.fillStyle = '#22262a';
  ctx.fillRect(160, 318, 76, 62);
  ectx.fillStyle = '#22ff88';
  ectx.font = 'bold 14px monospace';
  ectx.fillText('¥150', 198, 342);
  ctx.fillStyle = '#1a75c4';
  ctx.fillRect(172, 352, 26, 18);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('IC', 185, 365);

  // 下部 PUSH / 取出口
  ctx.fillStyle = '#181a1e';
  ctx.fillRect(24, 396, 208, 78);
  ctx.strokeStyle = '#4e545c';
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 396, 208, 78);
  ctx.fillStyle = '#9aa2ab';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('PUSH / 取出口', 128, 442);

  // 下部の汚れ＆擦り傷
  const grime = ctx.createLinearGradient(0, 420, 0, 512);
  grime.addColorStop(0, 'rgba(18, 16, 12, 0)');
  grime.addColorStop(1, 'rgba(18, 16, 12, 0.72)');
  ctx.fillStyle = grime;
  ctx.fillRect(0, 420, 256, 92);

  addSoftNoise(ctx, 256, 512, 9);
  return {
    map: finalizeTexture(c, 1, 1),
    emissive: finalizeTexture(ec, 1, 1)
  };
}

// 廊下の掲示板（コルク＋時間割・部活ポスター・注意書き）
function createBulletinBoardTex() {
  const c = makeCanvas(256, 160);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#6f5236';
  ctx.fillRect(0, 0, 256, 160);
  addSoftNoise(ctx, 256, 160, 14);
  ctx.strokeStyle = '#3a2717';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 246, 150);

  const papers = [
    [22, 20, 62, 82, '#dfd8c4', '#222'],
    [94, 24, 70, 52, '#e4d5c6', '#8b1e24'],
    [176, 18, 56, 78, '#d4dce0', '#1d3347'],
    [98, 86, 66, 54, '#e5dfcb', '#222'],
    [26, 108, 54, 34, '#d9cbb0', '#333']
  ];
  papers.forEach(([x, y, w, h, bg, fg]) => {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x + 3, y + 3, w, h);
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fg;
    for (let ly = y + 10; ly < y + h - 8; ly += 8) {
      ctx.fillRect(x + 6, ly, w - 14 - ((ly * 7) % 12), 2.5);
    }
    // 画鋲
    ctx.fillStyle = '#c42228';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + 5, 3, 0, Math.PI * 2);
    ctx.fill();
  });
  return finalizeTexture(c, 1, 1);
}

// 光源の空気ハレーション（グロー・スプライト用）
function createLightGlowTex() {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  g.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  g.addColorStop(0.22, 'rgba(255, 255, 255, 0.55)');
  g.addColorStop(0.55, 'rgba(255, 255, 255, 0.14)');
  g.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 窓から差し込む青白い月光ライトシャフト用テクスチャ
function createGodRayTex() {
  const c = makeCanvas(128, 256);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(140, 195, 255, 0.45)');
  g.addColorStop(0.5, 'rgba(120, 175, 245, 0.18)');
  g.addColorStop(1, 'rgba(100, 155, 235, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 256);
  // 左右端を柔らかくぼかす
  ctx.globalCompositeOperation = 'destination-in';
  const hg = ctx.createLinearGradient(0, 0, 128, 0);
  hg.addColorStop(0, 'rgba(255,255,255,0)');
  hg.addColorStop(0.25, 'rgba(255,255,255,1)');
  hg.addColorStop(0.75, 'rgba(255,255,255,1)');
  hg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, 128, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 黒板（512x256 高精細）
function createBlackboardTex(musicLines = false) {
  const c = makeCanvas(512, 256);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 512, 256);
  g.addColorStop(0, '#183021');
  g.addColorStop(0.5, '#1e3a28');
  g.addColorStop(1, '#14291c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);

  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = 'rgba(225,235,225,0.04)';
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

  ctx.strokeStyle = '#4e351e';
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, 498, 242);
  ctx.fillStyle = '#3b2614';
  ctx.fillRect(14, 234, 484, 14);

  addSoftNoise(ctx, 512, 256, 7);
  return finalizeTexture(c, 1, 1);
}

// 封鎖された楽器収納庫
function createSealedLockerTex() {
  const c = makeCanvas(256, 384);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#332d26';
  ctx.fillRect(0, 0, 256, 384);
  ctx.strokeStyle = '#14110e';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 246, 374);
  ctx.fillStyle = '#120f0c';
  ctx.fillRect(125, 8, 6, 368);

  ctx.strokeStyle = 'rgba(205, 192, 170, 0.45)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(52 + i * 9, 98);
    ctx.lineTo(62 + i * 9, 178);
    ctx.stroke();
  }

  const drawPlank = (x1, y1, x2, y2) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = 36;
    ctx.beginPath();
    ctx.moveTo(x1, y1 + 6);
    ctx.lineTo(x2, y2 + 6);
    ctx.stroke();

    ctx.strokeStyle = '#6c4d2e';
    ctx.lineWidth = 30;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.fillStyle = '#202226';
    [[x1 + (x2 - x1) * 0.12, y1 + (y2 - y1) * 0.12], [x1 + (x2 - x1) * 0.88, y1 + (y2 - y1) * 0.88]].forEach(([nx, ny]) => {
      ctx.beginPath();
      ctx.arc(nx, ny, 4.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  };
  drawPlank(18, 96, 238, 276);
  drawPlank(238, 102, 18, 282);

  ctx.fillStyle = '#dcd4bd';
  ctx.fillRect(76, 152, 104, 66);
  ctx.strokeStyle = '#8b1e1e';
  ctx.lineWidth = 3;
  ctx.strokeRect(82, 158, 92, 54);
  ctx.fillStyle = '#8b1e1e';
  ctx.font = 'bold 20px "Yu Mincho", serif';
  ctx.textAlign = 'center';
  ctx.fillText('使用禁止', 128, 192);

  addSoftNoise(ctx, 256, 384, 12);
  return finalizeTexture(c, 1, 1);
}

// 階段テクスチャ
function createStairTex() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  for (let y = 0; y < 256; y += 32) {
    ctx.fillStyle = '#5c5a52';
    ctx.fillRect(0, y, 256, 25);
    ctx.fillStyle = '#292824';
    ctx.fillRect(0, y + 25, 256, 7);
    ctx.fillStyle = '#998b68';
    ctx.fillRect(10, y + 4, 236, 4);
  }
  addSoftNoise(ctx, 256, 256, 10);
  return finalizeTexture(c, 1, 2);
}

// 中庭地面
function createGroundTex() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1d271c';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 220; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(52, 46, 36, 0.35)' : 'rgba(28, 48, 28, 0.35)';
    ctx.beginPath();
    ctx.arc(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 14, 0, Math.PI * 2);
    ctx.fill();
  }
  addSoftNoise(ctx, 256, 256, 12);
  return finalizeTexture(c, 8, 8);
}

// 窓ガラス（結露＆雨粒跡＋アルミサッシ枠）
function createWindowTex() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 256, 256);
  g.addColorStop(0, 'rgba(30, 52, 78, 0.42)');
  g.addColorStop(0.5, 'rgba(14, 26, 42, 0.24)');
  g.addColorStop(1, 'rgba(42, 68, 96, 0.42)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  // 雨粒・ホコリの微細スジ
  ctx.fillStyle = 'rgba(190, 220, 255, 0.14)';
  for (let i = 0; i < 40; i++) {
    ctx.fillRect(14 + Math.random() * 228, 14 + Math.random() * 220, 1.5, 4 + Math.random() * 12);
  }

  ctx.strokeStyle = 'rgba(92, 102, 114, 0.95)';
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, 244, 244);
  ctx.fillStyle = 'rgba(78, 88, 100, 0.95)';
  ctx.fillRect(124, 0, 8, 256);
  ctx.fillRect(0, 124, 256, 8);
  return finalizeTexture(c, 1, 1);
}

// 赤いコート布地
function createRedCoatTex() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#9c1118');
  g.addColorStop(0.65, '#7e0c12');
  g.addColorStop(1, '#260408');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 4) {
    ctx.fillStyle = y % 8 === 0 ? 'rgba(255,80,80,0.04)' : 'rgba(0,0,0,0.09)';
    ctx.fillRect(0, y, 256, 2);
  }
  ctx.fillStyle = 'rgba(25, 4, 6, 0.58)';
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

  addSoftNoise(ctx, 256, 256, 12);
  return finalizeTexture(c, 1, 1);
}

// 赤い帽子の女・歪んだ顔
function createGhostFaceTex() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const bg = ctx.createRadialGradient(128, 128, 25, 128, 128, 145);
  bg.addColorStop(0, '#d8d3c9');
  bg.addColorStop(0.75, '#b6b0a6');
  bg.addColorStop(1, '#6f6a66');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 256);

  const topShadow = ctx.createLinearGradient(0, 0, 0, 80);
  topShadow.addColorStop(0, 'rgba(10, 6, 12, 0.78)');
  topShadow.addColorStop(1, 'rgba(10, 6, 12, 0)');
  ctx.fillStyle = topShadow;
  ctx.fillRect(0, 0, 256, 80);

  const drawEye = (ex, ey, rx, ry, rot) => {
    const halo = ctx.createRadialGradient(ex, ey, rx * 0.4, ex, ey, rx * 1.9);
    halo.addColorStop(0, 'rgba(12, 6, 14, 0.88)');
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
    ctx.fillStyle = '#ebe4d6';
    ctx.beginPath();
    ctx.arc(2, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  drawEye(82, 108, 24, 17, -0.24);
  drawEye(174, 122, 22, 27, 0.28);

  ctx.save();
  ctx.translate(132, 192);
  ctx.rotate(0.16);
  ctx.fillStyle = '#140306';
  ctx.beginPath();
  ctx.ellipse(0, 0, 42, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  addSoftNoise(ctx, 256, 256, 11);
  return finalizeTexture(c, 1, 1);
}

// 夜の校舎・手続き的IBL環境反射マップ（PMREMGeneratorで1回だけ生成→濡れた床・金属・ガラスが実写のように反射！）
export function createNightEnvMap(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x060910);

  // 上部の冷たいシアン蛍光灯帯
  const coolBarMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9be2ff).multiplyScalar(2.4) });
  for (let i = -2; i <= 2; i++) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 0.65), coolBarMat);
    bar.position.set(i * 4.5, 6.0, 0);
    bar.rotation.x = Math.PI / 2;
    envScene.add(bar);
  }

  // 側面の暖かいアンバー壁灯帯（参考ポストの寒色×暖色コントラスト反射！）
  const warmMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff9a3d).multiplyScalar(2.2) });
  const warmL = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.4), warmMat);
  warmL.position.set(-7.5, 1.8, -2);
  warmL.rotation.y = Math.PI / 2;
  envScene.add(warmL);

  const warmR = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.4), warmMat);
  warmR.position.set(7.5, 1.8, 2);
  warmR.rotation.y = -Math.PI / 2;
  envScene.add(warmR);

  // 窓の外の青白い夜空グラデーション
  const nightSkyMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x284770).multiplyScalar(1.3) });
  const skyPanel = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), nightSkyMat);
  skyPanel.position.set(0, 2.5, -8.5);
  envScene.add(skyPanel);

  const envRT = pmrem.fromScene(envScene, 0.04);
  pmrem.dispose();
  return envRT.texture;
}

export function createTextures() {
  const plasterCanvas = createPlasterBumpCanvas();
  const schoolWallSet = createSchoolWallSet();
  const annexWallSet = createAnnexWallSet();
  const corridorFloorSet = createCorridorFloorSet();
  const woodFloorSet = createWoodFloorSet();
  const ceilingSet = createCeilingSet();
  const doorSet = createDoorSet();
  const lockerDoorSet = createLockerDoorSet();
  const vendingSet = createVendingMachineSet();

  return {
    plasterBump: finalizeTexture(plasterCanvas, 1, 1, false),
    plasterNormal: canvasToNormalTex(plasterCanvas, 2.2),
    corridorRoughness: createCorridorRoughnessTex(),
    schoolWall: schoolWallSet.map,
    schoolWallNormal: schoolWallSet.normal,
    annexWall: annexWallSet.map,
    annexWallNormal: annexWallSet.normal,
    corridorFloor: corridorFloorSet.map,
    corridorFloorNormal: corridorFloorSet.normal,
    woodFloor: woodFloorSet.map,
    woodFloorNormal: woodFloorSet.normal,
    ceiling: ceilingSet.map,
    ceilingNormal: ceilingSet.normal,
    exteriorWall: createExteriorWallTex(),
    door: doorSet.map,
    doorNormal: doorSet.normal,
    lockerDoor: lockerDoorSet.map,
    lockerDoorNormal: lockerDoorSet.normal,
    vendingFront: vendingSet.map,
    vendingEmissive: vendingSet.emissive,
    bulletinBoard: createBulletinBoardTex(),
    lightGlow: createLightGlowTex(),
    godRay: createGodRayTex(),
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
