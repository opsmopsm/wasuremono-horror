import * as THREE from 'three';

export const FLOOR_H = 4.0;
const WALL_T = 0.28;

// 部屋プレート用の高精細看板テクスチャを生成
function createSignTexture(text, bg = '#d9d4c5', fg = '#1e1c1a') {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 80;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 80);
  ctx.strokeStyle = '#38342e';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 250, 74);
  ctx.fillStyle = fg;
  ctx.font = 'bold 36px "Yu Gothic", "Meiryo", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 42);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildSchoolMap(scene, textures) {
  const mapGroup = new THREE.Group();
  scene.add(mapGroup);

  const colliders = [];     // { minX, maxX, minZ, maxZ, minY, maxY, doorRef? }
  const doors = [];         // インタラクト可能な引き戸
  const lockers = [];       // 隠れられるスチールロッカー
  const interactables = []; // 机・忘れ物・封鎖楽器庫・出口・メモなど
  const flickers = [];      // 明滅する蛍光灯
  const sceneLights = [];   // 距離カリング対象のPointLight一覧（WebGL安定化＆高速化）
  const stairZones = [];    // 階段の高さ補間ゾーン
  const matCache = new Map(); // 同一タイリングのマテリアルを再利用してVRAM/コンパイル負荷を激減！

  // 共通PBRマテリアル（リアルな質感・光沢・凹凸）
  const mats = {
    wall: new THREE.MeshStandardMaterial({
      map: textures.schoolWall,
      bumpMap: textures.plasterBump,
      bumpScale: 0.028,
      roughness: 0.88,
      metalness: 0.02
    }),
    annexWall: new THREE.MeshStandardMaterial({
      map: textures.annexWall,
      bumpMap: textures.plasterBump,
      bumpScale: 0.036,
      roughness: 0.9,
      metalness: 0.02
    }),
    extWall: new THREE.MeshStandardMaterial({
      map: textures.exteriorWall,
      bumpMap: textures.plasterBump,
      bumpScale: 0.04,
      roughness: 0.92
    }),
    corridorFloor: new THREE.MeshStandardMaterial({
      map: textures.corridorFloor,
      roughnessMap: textures.corridorRoughness,
      roughness: 0.42,
      metalness: 0.08
    }),
    woodFloor: new THREE.MeshStandardMaterial({
      map: textures.woodFloor,
      bumpMap: textures.woodFloor,
      bumpScale: 0.018,
      roughness: 0.54,
      metalness: 0.04
    }),
    ceiling: new THREE.MeshStandardMaterial({
      map: textures.ceiling,
      roughness: 0.94,
      metalness: 0.0
    }),
    stair: new THREE.MeshStandardMaterial({
      map: textures.stair,
      roughness: 0.72,
      metalness: 0.08
    }),
    door: new THREE.MeshStandardMaterial({
      map: textures.door,
      roughness: 0.62,
      metalness: 0.05
    }),
    windowGlass: new THREE.MeshStandardMaterial({
      map: textures.windowGlass,
      roughness: 0.12,
      metalness: 0.2,
      transparent: true,
      opacity: 0.56,
      side: THREE.DoubleSide
    }),
    woodDark: new THREE.MeshStandardMaterial({ color: 0x3b2a1c, roughness: 0.68, metalness: 0.04 }),
    woodMid: new THREE.MeshStandardMaterial({ color: 0x62462e, roughness: 0.62, metalness: 0.04 }),
    metalDark: new THREE.MeshStandardMaterial({ color: 0x3b4248, roughness: 0.38, metalness: 0.62 }),
    locker: new THREE.MeshStandardMaterial({ color: 0x4b5752, roughness: 0.42, metalness: 0.55 }),
    lockerDoor: new THREE.MeshStandardMaterial({ map: textures.lockerDoor, roughness: 0.42, metalness: 0.52 }),
    blackboard: new THREE.MeshStandardMaterial({ map: textures.blackboard, roughness: 0.84, metalness: 0.02 }),
    musicBlackboard: new THREE.MeshStandardMaterial({ map: textures.musicBlackboard, roughness: 0.84, metalness: 0.02 }),
    sealedLocker: new THREE.MeshStandardMaterial({ map: textures.sealedLocker, roughness: 0.82, metalness: 0.1 }),
    plaster: new THREE.MeshStandardMaterial({ color: 0xd8d5cb, roughness: 0.78, metalness: 0.02 }),
    pianoBlack: new THREE.MeshStandardMaterial({ color: 0x101116, roughness: 0.14, metalness: 0.14 }),
    pianoKeys: new THREE.MeshStandardMaterial({ color: 0xebe8dc, roughness: 0.28, metalness: 0.02 }),
    curtain: new THREE.MeshStandardMaterial({ color: 0x99a69f, roughness: 0.92, side: THREE.DoubleSide }),
    exitSign: new THREE.MeshStandardMaterial({ color: 0x1c7d3c, emissive: 0x2de068, emissiveIntensity: 1.4, roughness: 0.3 }),
    fluorescentOn: new THREE.MeshStandardMaterial({ color: 0xe8f6ff, emissive: 0xc2e6ff, emissiveIntensity: 1.4, roughness: 0.2 }),
    fluorescentOff: new THREE.MeshStandardMaterial({ color: 0x363b3e, roughness: 0.5, metalness: 0.2 }),
    ground: new THREE.MeshStandardMaterial({ map: textures.ground, roughness: 0.96, metalness: 0.0 }),
    pouch: new THREE.MeshStandardMaterial({ color: 0xc42840, emissive: 0x4a0b15, roughness: 0.6 }),
    paper: new THREE.MeshStandardMaterial({ color: 0xe6dfc8, emissive: 0x1a1810, roughness: 0.85 })
  };

  // 同じタイリング比率のマテリアルをキャッシュ再利用するヘルパー
  function getTiledMaterial(baseMat, repX, repY) {
    if (!baseMat.map || (repX === 1 && repY === 1)) return baseMat;
    const key = `${baseMat.uuid}_${repX}_${repY}`;
    if (matCache.has(key)) return matCache.get(key);
    const clonedMat = baseMat.clone();
    const clonedTex = baseMat.map.clone();
    clonedTex.needsUpdate = true;
    clonedTex.repeat.set(repX, repY);
    clonedMat.map = clonedTex;
    if (baseMat.roughnessMap) {
      const rTex = baseMat.roughnessMap.clone();
      rTex.needsUpdate = true;
      rTex.repeat.set(repX, repY);
      clonedMat.roughnessMap = rTex;
    }
    if (baseMat.bumpMap) {
      const bTex = baseMat.bumpMap.clone();
      bTex.needsUpdate = true;
      bTex.repeat.set(repX, repY);
      clonedMat.bumpMap = bTex;
    }
    matCache.set(key, clonedMat);
    return clonedMat;
  }

  // --- ヘルパー：壁・床・家具（PBR＋ソフトシャドウ対応＋キャッシュ最適化） ---
  function addBox(x1, x2, y1, y2, z1, z2, mat, solid = true, repeatTex = false) {
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    const d = Math.abs(z2 - z1);
    if (w < 0.01 || h < 0.01 || d < 0.01) return null;

    let useMat = mat;
    if (repeatTex && mat.map) {
      const repX = Math.max(1, Math.round(Math.max(w, d) / 3.2));
      const repY = Math.max(1, Math.round(h / 3.2));
      useMat = getTiledMaterial(mat, repX, repY);
    }

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), useMat);
    mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    mesh.castShadow = solid;
    mesh.receiveShadow = true;
    mapGroup.add(mesh);

    if (solid) {
      colliders.push({
        minX: Math.min(x1, x2),
        maxX: Math.max(x1, x2),
        minY: Math.min(y1, y2),
        maxY: Math.max(y1, y2),
        minZ: Math.min(z1, z2),
        maxZ: Math.max(z1, z2)
      });
    }
    return mesh;
  }

  function addFloorSlab(x1, x2, y, z1, z2, mat) {
    const w = x2 - x1;
    const d = z2 - z1;
    const repX = Math.max(1, Math.round(w / 2.6));
    const repY = Math.max(1, Math.round(d / 2.6));
    const m = getTiledMaterial(mat, repX, repY);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), m);
    mesh.position.set((x1 + x2) / 2, y - 0.08, (z1 + z2) / 2);
    mesh.receiveShadow = true;
    mapGroup.add(mesh);
  }

  function addCeilingSlab(x1, x2, y, z1, z2) {
    const w = x2 - x1;
    const d = z2 - z1;
    const repX = Math.max(1, Math.round(w / 3));
    const repY = Math.max(1, Math.round(d / 3));
    const m = getTiledMaterial(mats.ceiling, repX, repY);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, d), m);
    mesh.position.set((x1 + x2) / 2, y - 0.07, (z1 + z2) / 2);
    mesh.receiveShadow = true;
    mapGroup.add(mesh);
  }

  // ドア付きの壁（axis: 'x' はZ固定でX方向に伸びる壁、'z' はX固定でZ方向に伸びる壁）
  function addWallWithOpenings(axis, fixedCoord, start, end, floorY, mat, openings = []) {
    // openings: [{ center, width, hasDoor, label, slideDir, locked, lockMsg }]
    const sorted = [...openings].sort((a, b) => a.center - b.center);
    let cursor = start;
    const yTop = floorY + FLOOR_H;
    const doorH = 2.45;

    for (const op of sorted) {
      const opStart = op.center - op.width / 2;
      const opEnd = op.center + op.width / 2;
      if (opStart > cursor + 0.05) {
        if (axis === 'x') {
          addBox(cursor, opStart, floorY, yTop, fixedCoord - WALL_T / 2, fixedCoord + WALL_T / 2, mat, true, true);
        } else {
          addBox(fixedCoord - WALL_T / 2, fixedCoord + WALL_T / 2, floorY, yTop, cursor, opStart, mat, true, true);
        }
      }
      // ドア上の垂れ壁（ランマ）
      if (axis === 'x') {
        addBox(opStart, opEnd, floorY + doorH, yTop, fixedCoord - WALL_T / 2, fixedCoord + WALL_T / 2, mat, true, false);
      } else {
        addBox(fixedCoord - WALL_T / 2, fixedCoord + WALL_T / 2, floorY + doorH, yTop, opStart, opEnd, mat, true, false);
      }

      // 看板プレート
      if (op.label) {
        const signTex = createSignTexture(op.label);
        const signMat = new THREE.MeshLambertMaterial({ map: signTex });
        const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.06), signMat);
        if (axis === 'x') {
          const offsetZ = op.signSide === -1 ? -0.22 : 0.22;
          sign.position.set(op.center, floorY + doorH + 0.3, fixedCoord + offsetZ);
          if (op.signSide === -1) sign.rotation.y = Math.PI;
        } else {
          const offsetX = op.signSide === -1 ? -0.22 : 0.22;
          sign.position.set(fixedCoord + offsetX, floorY + doorH + 0.3, op.center);
          sign.rotation.y = op.signSide === -1 ? -Math.PI / 2 : Math.PI / 2;
        }
        mapGroup.add(sign);
      }

      // 引き戸の生成
      if (op.hasDoor) {
        const doorW = op.width - 0.04;
        const doorThick = 0.09;
        const geo = axis === 'x'
          ? new THREE.BoxGeometry(doorW, doorH, doorThick)
          : new THREE.BoxGeometry(doorThick, doorH, doorW);
        const doorMesh = new THREE.Mesh(geo, mats.door);
        const baseX = axis === 'x' ? op.center : fixedCoord;
        const baseZ = axis === 'x' ? fixedCoord : op.center;
        doorMesh.position.set(baseX, floorY + doorH / 2, baseZ);
        mapGroup.add(doorMesh);

        const col = {
          minX: baseX - (axis === 'x' ? doorW / 2 : 0.14),
          maxX: baseX + (axis === 'x' ? doorW / 2 : 0.14),
          minY: floorY,
          maxY: floorY + doorH,
          minZ: baseZ - (axis === 'x' ? 0.14 : doorW / 2),
          maxZ: baseZ + (axis === 'x' ? 0.14 : doorW / 2),
          active: true
        };
        colliders.push(col);

        doors.push({
          mesh: doorMesh,
          collider: col,
          axis,
          closedPos: axis === 'x' ? baseX : baseZ,
          openPos: (axis === 'x' ? baseX : baseZ) + (op.slideDir || 1) * (doorW * 0.85),
          isOpen: false,
          progress: 0,
          locked: !!op.locked,
          lockMsg: op.lockMsg || '鍵がかかっている…',
          label: op.label || '扉',
          center: new THREE.Vector3(baseX, floorY + 1.2, baseZ)
        });
      }

      cursor = opEnd;
    }

    if (end > cursor + 0.05) {
      if (axis === 'x') {
        addBox(cursor, end, floorY, yTop, fixedCoord - WALL_T / 2, fixedCoord + WALL_T / 2, mat, true, true);
      } else {
        addBox(fixedCoord - WALL_T / 2, fixedCoord + WALL_T / 2, floorY, yTop, cursor, end, mat, true, true);
      }
    }
  }

  // 窓壁（腰壁＋半透明ガラス＋上部壁。中庭越しに向かいの校舎が見える！）
  function addWindowWall(axis, fixedCoord, start, end, floorY, mat) {
    const yLow = floorY + 1.05;
    const yHigh = floorY + 3.05;
    const yTop = floorY + FLOOR_H;
    const len = end - start;

    if (axis === 'x') {
      addBox(start, end, floorY, yLow, fixedCoord - WALL_T / 2, fixedCoord + WALL_T / 2, mat, true, true);
      addBox(start, end, yHigh, yTop, fixedCoord - WALL_T / 2, fixedCoord + WALL_T / 2, mat, true, false);
      // ガラス板（PBR反射＋当たり判定あり）
      const gTex = textures.windowGlass.clone();
      gTex.needsUpdate = true;
      gTex.repeat.set(Math.max(1, Math.round(len / 2.2)), 1);
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(len, yHigh - yLow, 0.08),
        new THREE.MeshStandardMaterial({ map: gTex, transparent: true, opacity: 0.56, roughness: 0.1, metalness: 0.25 })
      );
      glass.position.set((start + end) / 2, (yLow + yHigh) / 2, fixedCoord);
      mapGroup.add(glass);
      colliders.push({
        minX: start, maxX: end, minY: yLow, maxY: yHigh,
        minZ: fixedCoord - 0.14, maxZ: fixedCoord + 0.14
      });
    } else {
      addBox(fixedCoord - WALL_T / 2, fixedCoord + WALL_T / 2, floorY, yLow, start, end, mat, true, true);
      addBox(fixedCoord - WALL_T / 2, fixedCoord + WALL_T / 2, yHigh, yTop, start, end, mat, true, false);
      const gTex = textures.windowGlass.clone();
      gTex.needsUpdate = true;
      gTex.repeat.set(Math.max(1, Math.round(len / 2.2)), 1);
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, yHigh - yLow, len),
        new THREE.MeshStandardMaterial({ map: gTex, transparent: true, opacity: 0.56, roughness: 0.1, metalness: 0.25 })
      );
      glass.position.set(fixedCoord, (yLow + yHigh) / 2, (start + end) / 2);
      mapGroup.add(glass);
      colliders.push({
        minX: fixedCoord - 0.14, maxX: fixedCoord + 0.14, minY: yLow, maxY: yHigh,
        minZ: start, maxZ: end
      });
    }
  }

  // 廊下の蛍光灯（立体アルミカバー＋チカチカ明滅するリアル蛍光灯）
  function addFluorescent(x, floorY, z, mode = 'dim') {
    const y = floorY + FLOOR_H - 0.18;
    const isLit = mode === 'on' || mode === 'flicker' || mode === 'dim';
    // 天井器具カバー
    const fixture = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.05, 0.26), mats.metalDark);
    fixture.position.set(x, y + 0.05, z);
    mapGroup.add(fixture);

    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.12, 0.06, 0.16),
      isLit ? mats.fluorescentOn.clone() : mats.fluorescentOff
    );
    bar.position.set(x, y, z);
    mapGroup.add(bar);

    if (mode === 'flicker' || mode === 'on') {
      const light = new THREE.PointLight(0xbce0ff, mode === 'on' ? 1.55 : 1.25, 13.5, 1.7);
      light.position.set(x, y - 0.28, z);
      mapGroup.add(light);
      sceneLights.push({ light, baseIntensity: mode === 'on' ? 1.55 : 1.25 });
      if (mode === 'flicker') {
        flickers.push({ light, bar, baseIntensity: 1.35, timer: Math.random() * 2 });
      }
    }
  }

  // 緑の非常口誘導灯
  function addExitSign(x, floorY, z, rotY = 0) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.28, 0.08), mats.exitSign);
    sign.position.set(x, floorY + 2.8, z);
    sign.rotation.y = rotY;
    mapGroup.add(sign);
    const light = new THREE.PointLight(0x28ff66, 0.9, 6.8, 1.9);
    light.position.set(x, floorY + 2.6, z);
    mapGroup.add(light);
    sceneLights.push({ light, baseIntensity: 0.9 });
  }

  // 教室の机・椅子セット
  function addDesk(x, floorY, z, rotY = 0, solid = true) {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.06, 0.52), mats.woodMid);
    top.position.y = 0.72;
    g.add(top);
    const legGeo = new THREE.BoxGeometry(0.05, 0.72, 0.05);
    [[-0.33, -0.22], [0.33, -0.22], [-0.33, 0.22], [0.33, 0.22]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, mats.metalDark);
      leg.position.set(lx, 0.36, lz);
      g.add(leg);
    });
    // 椅子
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.42), mats.woodDark);
    seat.position.set(0, 0.42, 0.42);
    g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.05), mats.woodDark);
    back.position.set(0, 0.65, 0.61);
    g.add(back);

    g.position.set(x, floorY, z);
    g.rotation.y = rotY;
    mapGroup.add(g);

    if (solid) {
      colliders.push({
        minX: x - 0.42, maxX: x + 0.42,
        minY: floorY, maxY: floorY + 1.0,
        minZ: z - 0.38, maxZ: z + 0.58
      });
    }
  }

  // 教室セット（黒板＋並んだ机）
  function populateClassroom(x1, x2, floorY, z1, z2, facingNorth = true) {
    // 黒板
    const bbZ = facingNorth ? z1 + 0.2 : z2 - 0.2;
    const bb = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.35, 0.08), mats.blackboard);
    bb.position.set((x1 + x2) / 2, floorY + 1.75, bbZ);
    mapGroup.add(bb);

    // 教卓
    addBox((x1 + x2) / 2 - 0.5, (x1 + x2) / 2 + 0.5, floorY, floorY + 0.9, bbZ + (facingNorth ? 1.0 : -1.4), bbZ + (facingNorth ? 1.6 : -0.8), mats.woodDark, true);

    // 生徒机（3列×2行）
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2 + (facingNorth ? 0.6 : -0.6);
    for (let r = 0; r < 2; r++) {
      for (let c = -1; c <= 1; c++) {
        addDesk(cx + c * 2.1, floorY, cz + r * 1.9, facingNorth ? 0 : Math.PI, true);
      }
    }
  }

  // Uターン階段ユニット（1フロア分: baseY -> baseY + 4）
  function addStairUnit(xLeft, xRight, zFront, zBack, baseY) {
    const midX = (xLeft + xRight) / 2;
    const splitZ = zFront - 5.2; // ここから奥が中踊り場
    const steps = 10;

    // 右レーン（下階 zFront -> 中踊り場 splitZ、上り）
    const rW = (xRight - midX) - 0.2;
    const rCenterX = (midX + xRight) / 2;
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps;
      const t1 = (i + 1) / steps;
      const sy = baseY + (i + 1) * (2.0 / steps);
      const sz = zFront - (t0 + t1) * 0.5 * (zFront - splitZ);
      const stepD = (zFront - splitZ) / steps + 0.06;
      const m = new THREE.Mesh(new THREE.BoxGeometry(rW, 0.24, stepD), mats.stair);
      m.position.set(rCenterX, sy - 0.12, sz);
      mapGroup.add(m);
    }

    // 中踊り場（高さ baseY + 2.0）
    const landW = xRight - xLeft - 0.2;
    const landD = splitZ - zBack;
    const landing = new THREE.Mesh(new THREE.BoxGeometry(landW, 0.22, landD), mats.stair);
    landing.position.set((xLeft + xRight) / 2, baseY + 2.0 - 0.11, (splitZ + zBack) / 2);
    mapGroup.add(landing);

    // 左レーン（中踊り場 splitZ -> 上階 zFront、上り）
    const lW = (midX - xLeft) - 0.2;
    const lCenterX = (xLeft + midX) / 2;
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps;
      const t1 = (i + 1) / steps;
      const sy = baseY + 2.0 + (i + 1) * (2.0 / steps);
      const sz = splitZ + (t0 + t1) * 0.5 * (zFront - splitZ);
      const stepD = (zFront - splitZ) / steps + 0.06;
      const m = new THREE.Mesh(new THREE.BoxGeometry(lW, 0.24, stepD), mats.stair);
      m.position.set(lCenterX, sy - 0.12, sz);
      mapGroup.add(m);
    }

    // 中央の手すり（入口から0.8m奥・踊り場手前0.4mまでに抑えて、絶対に角に引っかからない！）
    addBox(midX - 0.08, midX + 0.08, baseY + 1.0, baseY + 2.6, splitZ + 0.4, zFront - 0.8, mats.metalDark, false);

    // 高さ補間用データ登録
    stairZones.push({
      xLeft,
      xRight,
      midX,
      zFront,
      zBack,
      splitZ,
      baseY
    });
  }

  // =========================================================================
  // 1. 中庭＆夜の地面・満月・星空・差し込む月光・漂う埃パーティクル
  // =========================================================================
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), mats.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(10, -0.18, 0);
  ground.receiveShadow = true;
  mapGroup.add(ground);

  // 夜の満月＆青白い月光（中庭や渡り廊下の窓から差し込む！）
  const moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xe6f0ff })
  );
  moonMesh.position.set(-18, 34, 48);
  mapGroup.add(moonMesh);

  const moonLight = new THREE.DirectionalLight(0x7ea4e0, 0.52);
  moonLight.position.set(-18, 34, 48);
  mapGroup.add(moonLight);

  // 夜空の星空（中庭から見上げると星が瞬く）
  const starCount = 260;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.42;
    const rad = 58;
    starPos[i * 3] = 10 + Math.sin(phi) * Math.cos(theta) * rad;
    starPos[i * 3 + 1] = 14 + Math.cos(phi) * rad * 0.7;
    starPos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * rad;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xcce0ff, size: 0.35, transparent: true, opacity: 0.75, fog: false });
  mapGroup.add(new THREE.Points(starGeo, starMat));

  // 校舎内を漂う微細な埃パーティクル（光の中でフワフワ舞う空気感！）
  const dustCount = 460;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = -21 + Math.random() * 66;
    dustPos[i * 3 + 1] = 0.4 + Math.random() * 11.2;
    dustPos[i * 3 + 2] = -17 + Math.random() * 32;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xdbe6f5,
    size: 0.045,
    transparent: true,
    opacity: 0.32,
    depthWrite: false
  });
  const dustPoints = new THREE.Points(dustGeo, dustMat);
  mapGroup.add(dustPoints);

  // 中庭のベンチ・街灯・古い木
  addBox(-2, 2, -0.15, 0.45, 4.5, 5.3, mats.woodDark, false);
  // 中庭の街灯（ぼんやり青白く光る）
  addBox(-0.1, 0.1, -0.15, 4.2, 1.9, 2.1, mats.metalDark, false);
  const yardLamp = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), mats.fluorescentOn);
  yardLamp.position.set(0, 4.25, 2.0);
  mapGroup.add(yardLamp);
  const yardLight = new THREE.PointLight(0x9bc4f5, 2.4, 26, 1.5);
  yardLight.position.set(0, 4.0, 2.0);
  mapGroup.add(yardLight);

  // 中庭の木（少し滑らかな多層ローポリ）
  [[-5.5, 8.5], [5.8, 10.5], [-4.5, -1.5]].forEach(([tx, tz]) => {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 3.2, 10), mats.woodDark);
    trunk.position.set(tx, 1.5, tz);
    trunk.castShadow = true;
    mapGroup.add(trunk);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x16291a, roughness: 0.92 });
    const leaves1 = new THREE.Mesh(new THREE.ConeGeometry(1.85, 3.0, 10), leafMat);
    leaves1.position.set(tx, 3.7, tz);
    mapGroup.add(leaves1);
    const leaves2 = new THREE.Mesh(new THREE.ConeGeometry(1.35, 2.6, 10), leafMat);
    leaves2.position.set(tx, 5.1, tz);
    mapGroup.add(leaves2);
  });

  // =========================================================================
  // 2. 本館 1F〜3F（コの字型：北棟・西棟・東棟）
  // =========================================================================
  for (let f = 0; f < 3; f++) {
    const y = f * FLOOR_H;

    // --- 床スラブ ---
    // 北棟廊下
    addFloorSlab(-22, 22, y, -10, -6, mats.corridorFloor);
    // 北棟部屋列
    addFloorSlab(-14, 14, y, -18, -10, mats.woodFloor);
    // 西棟廊下＆部屋
    addFloorSlab(-14, -10, y, -6, 16, mats.corridorFloor);
    addFloorSlab(-22, -14, y, -6, 16, mats.woodFloor);
    // 東棟廊下＆部屋
    addFloorSlab(10, 14, y, -6, 16, mats.corridorFloor);
    addFloorSlab(14, 22, y, -6, 16, f === 0 ? mats.corridorFloor : mats.woodFloor);

    // 階段ホールの1F底面床＆3F天井
    if (f === 0) {
      addFloorSlab(-22, -14, 0, -18, -10, mats.corridorFloor);
      addFloorSlab(14, 22, 0, -18, -10, mats.corridorFloor);
    }

    // --- 天井スラブ ---
    addCeilingSlab(-22, 22, y + FLOOR_H, -10, -6);
    addCeilingSlab(-14, 14, y + FLOOR_H, -18, -10);
    addCeilingSlab(-22, -10, y + FLOOR_H, -6, 16);
    addCeilingSlab(10, 22, y + FLOOR_H, -6, 16);
    if (f === 2) {
      addCeilingSlab(-22, -14, y + FLOOR_H, -18, -10);
      addCeilingSlab(14, 22, y + FLOOR_H, -18, -10);
    }

    // --- 外周壁（北・西・東） ---
    // 北端外周
    addBox(-22, 22, y, y + FLOOR_H, -18 - WALL_T / 2, -18 + WALL_T / 2, mats.wall, true, true);
    // 西端外周
    addBox(-22 - WALL_T / 2, -22 + WALL_T / 2, y, y + FLOOR_H, -18, 16, mats.wall, true, true);
    // 東端外周（2Fの Z=-2..+2 は別館への渡り廊下口なので開口！）
    if (f === 1) {
      addBox(22 - WALL_T / 2, 22 + WALL_T / 2, y, y + FLOOR_H, -18, -2, mats.wall, true, true);
      addBox(22 - WALL_T / 2, 22 + WALL_T / 2, y, y + FLOOR_H, 2, 16, mats.wall, true, true);
    } else {
      addBox(22 - WALL_T / 2, 22 + WALL_T / 2, y, y + FLOOR_H, -18, 16, mats.wall, true, true);
    }

    // 西棟・東棟の南端壁（Z = +16）
    addBox(-22, -14, y, y + FLOOR_H, 16 - WALL_T / 2, 16 + WALL_T / 2, mats.wall, true, true);
    addBox(14, 22, y, y + FLOOR_H, 16 - WALL_T / 2, 16 + WALL_T / 2, mats.wall, true, true);
    // 廊下の南端（1Fは非常口＆メイン昇降口扉、2F/3Fは窓）
    if (f === 0) {
      // 西昇降口（非常口）
      addBox(-14, -10, y, y + FLOOR_H, 16 - WALL_T / 2, 16 + WALL_T / 2, mats.door, true, false);
      addExitSign(-12, y, 15.7, Math.PI);
      // メイン昇降口（スタート地点の後ろ）
      addBox(10, 14, y, y + FLOOR_H, 16 - WALL_T / 2, 16 + WALL_T / 2, mats.door, true, false);
      addExitSign(12, y, 15.7, Math.PI);
    } else {
      addWindowWall('x', 16, -14, -10, y, mats.wall);
      addWindowWall('x', 16, 10, 14, y, mats.wall);
    }

    // --- 中庭に面したコの字の窓壁 ＋ 北棟廊下と西棟/東棟部屋の仕切り壁（Z = -6） ---
    addWindowWall('x', -6, -10, 10, y, mats.wall);   // 北棟南側（中庭の北面）
    addBox(-22, -14, y, y + FLOOR_H, -6 - WALL_T / 2, -6 + WALL_T / 2, mats.wall, true, true); // 北棟廊下と西棟部屋の境界壁
    addBox(14, 22, y, y + FLOOR_H, -6 - WALL_T / 2, -6 + WALL_T / 2, mats.wall, true, true);   // 北棟廊下と東棟部屋の境界壁
    addWindowWall('z', -10, -6, 16, y, mats.wall);   // 西棟東側（中庭の西面）
    addWindowWall('z', 10, -6, 16, y, mats.wall);    // 東棟西側（中庭の東面）

    // --- 階段ホールの仕切り壁（廊下と階段の境界：西・東） ---
    // 西階段（X = -22..-14, Z = -18..-10）
    addBox(-14 - WALL_T / 2, -14 + WALL_T / 2, y, y + FLOOR_H, -18, -10, mats.wall, true, true);
    // 東階段（X = +14..+22, Z = -18..-10）
    addBox(14 - WALL_T / 2, 14 + WALL_T / 2, y, y + FLOOR_H, -18, -10, mats.wall, true, true);

    // 階段下の邪魔な壁・ガード柵は撤去（スムーズに昇降でき引っかかりゼロ！）

    // --- 北棟の部屋仕切り＆廊下壁（Z = -10） ---
    addBox(-6 - WALL_T / 2, -6 + WALL_T / 2, y, y + FLOOR_H, -18, -10, mats.wall, true, true);
    addBox(4 - WALL_T / 2, 4 + WALL_T / 2, y, y + FLOOR_H, -18, -10, mats.wall, true, true);

    const northLabels = [
      ['トイレ(1F)', '保健室', '印刷室'],
      ['放送室', '2年A組', '2年B組'],
      ['トイレ(3F)', '視聴覚室', '理科室']
    ][f];

    addWallWithOpenings('x', -10, -14, 14, y, mats.wall, [
      { center: -10, width: 1.5, hasDoor: true, label: northLabels[0], signSide: 1 },
      { center: -3.5, width: 1.5, hasDoor: true, label: northLabels[1], signSide: 1 },
      { center: 1.5, width: 1.5, hasDoor: true, label: '', signSide: 1 },
      { center: 6.5, width: 1.5, hasDoor: true, label: northLabels[2], signSide: 1 },
      { center: 11.5, width: 1.5, hasDoor: true, label: '', signSide: 1 }
    ]);

    // --- 西棟の部屋仕切り＆廊下壁（X = -14） ---
    if (f === 1) {
      // 2F 西棟は広大な「図書室」（仕切りなし、2ドア）
      addWallWithOpenings('z', -14, -6, 16, y, mats.wall, [
        { center: -1.5, width: 1.6, hasDoor: true, label: '図書室', signSide: 1 },
        { center: 11.5, width: 1.6, hasDoor: true, label: '', signSide: 1 }
      ]);
    } else {
      addBox(-22, -14, y, y + FLOOR_H, 5 - WALL_T / 2, 5 + WALL_T / 2, mats.wall, true, true);
      const westLabels = f === 0 ? ['倉庫', '西昇降口'] : ['空き教室', '3年B組'];
      addWallWithOpenings('z', -14, -6, 16, y, mats.wall, [
        { center: -0.5, width: 1.5, hasDoor: true, label: westLabels[0], signSide: 1 },
        { center: 10.5, width: 1.5, hasDoor: true, label: westLabels[1], signSide: 1 }
      ]);
    }

    // --- 東棟の部屋仕切り＆廊下壁（X = +14） ---
    if (f === 0) {
      // 1F 東棟：職員室(Z=-6..5)、警備員室(Z=5..11)、昇降口下駄箱(Z=11..16オープン)
      addBox(14, 22, y, y + FLOOR_H, 5 - WALL_T / 2, 5 + WALL_T / 2, mats.wall, true, true);
      addBox(14, 22, y, y + FLOOR_H, 11 - WALL_T / 2, 11 + WALL_T / 2, mats.wall, true, true);
      addWallWithOpenings('z', 14, -6, 11, y, mats.wall, [
        { center: -2.0, width: 1.6, hasDoor: true, label: '職員室', signSide: -1 },
        { center: 2.5, width: 1.5, hasDoor: true, label: '', signSide: -1 },
        { center: 8.0, width: 1.5, hasDoor: true, label: '警備員室', signSide: -1 }
      ]);
    } else if (f === 1) {
      // 2F 東棟：Z=-2..+2 は渡り廊下へ直通！北側(Z=-6..-2)は壁、南側(Z=2..16)は2年C組
      addBox(14, 22, y, y + FLOOR_H, -2 - WALL_T / 2, -2 + WALL_T / 2, mats.wall, true, true);
      addBox(14, 22, y, y + FLOOR_H, 2 - WALL_T / 2, 2 + WALL_T / 2, mats.wall, true, true);
      addWallWithOpenings('z', 14, -6, -2, y, mats.wall, []);
      // 渡り廊下案内サイン
      const brSign = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.34, 1.3),
        new THREE.MeshLambertMaterial({ map: createSignTexture('別館・音楽室 →', '#2c3c32', '#e8e6d8') })
      );
      brSign.position.set(14.1, y + 2.9, 0);
      mapGroup.add(brSign);
      addWallWithOpenings('z', 14, 2, 16, y, mats.wall, [
        { center: 5.5, width: 1.5, hasDoor: true, label: '2年C組', signSide: -1 },
        { center: 12.5, width: 1.5, hasDoor: true, label: '', signSide: -1 }
      ]);
    } else {
      // 3F 東棟：理科準備室(Z=-6..5)、3年A組(Z=5..16)
      addBox(14, 22, y, y + FLOOR_H, 5 - WALL_T / 2, 5 + WALL_T / 2, mats.wall, true, true);
      addWallWithOpenings('z', 14, -6, 16, y, mats.wall, [
        { center: -0.5, width: 1.5, hasDoor: true, label: '理科準備室', signSide: -1 },
        { center: 8.5, width: 1.5, hasDoor: true, label: '3年A組', signSide: -1 },
        { center: 13.5, width: 1.5, hasDoor: true, label: '', signSide: -1 }
      ]);
    }

    // --- 各階廊下の蛍光灯 ---
    addFluorescent(-8, y, -8, f === 1 ? 'flicker' : 'on');
    addFluorescent(2, y, -8, f === 2 ? 'flicker' : 'dim');
    addFluorescent(12, y, -8, f === 0 ? 'on' : 'flicker');
    addFluorescent(-12, y, 4, f === 1 ? 'flicker' : 'dim');
    addFluorescent(12, y, 4, f === 0 ? 'on' : 'dim');
    addFluorescent(12, y, 12, f === 0 ? 'on' : 'flicker');
  }

  // 本館階段（1F->2F, 2F->3F）
  addStairUnit(-22, -14, -10, -18, 0); // 西階段 1->2
  addStairUnit(-22, -14, -10, -18, 4); // 西階段 2->3
  addStairUnit(14, 22, -10, -18, 0);   // 東階段 1->2
  addStairUnit(14, 22, -10, -18, 4);   // 東階段 2->3

  // =========================================================================
  // 3. 2F ガラス張り渡り廊下（X = +22 .. +32, Z = -2 .. +2, Y = 4）
  // =========================================================================
  addFloorSlab(22, 32, 4, -2, 2, mats.corridorFloor);
  addCeilingSlab(22, 32, 8, -2, 2);
  addWindowWall('x', -2, 22, 32, 4, mats.annexWall);
  addWindowWall('x', 2, 22, 32, 4, mats.annexWall);
  addFluorescent(27, 4, 0, 'flicker');
  // 渡り廊下を支える1F柱
  [24, 30].forEach((px) => {
    [-1.7, 1.7].forEach((pz) => {
      addBox(px - 0.25, px + 0.25, -0.2, 4, pz - 0.25, pz + 0.25, mats.extWall, false);
    });
  });

  // =========================================================================
  // 4. 別館（特別棟・2階建て：X = +32 .. +46, Z = -10 .. +10）
  // =========================================================================
  for (let f = 0; f < 2; f++) {
    const y = f * FLOOR_H;

    // 床＆天井（別館廊下を階段と同じ幅 X=32..38 に統一して段差・壁引っかかりゼロ！）
    addFloorSlab(32, 38, y, -2, 10, mats.corridorFloor); // 別館廊下（広々6m）
    if (f === 0) {
      addFloorSlab(32, 38, 0, -10, -2, mats.corridorFloor); // 別館階段1F底
      addFloorSlab(38, 46, 0, -2, 10, mats.woodFloor);      // 美術室・旧倉庫
    } else {
      addFloorSlab(38, 46, 4, -10, 10, mats.woodFloor);     // 音楽室＆準備室
    }
    addCeilingSlab(32, 46, y + FLOOR_H, -2, 10);
    if (f === 1) {
      addCeilingSlab(32, 46, y + FLOOR_H, -10, -2);
    }

    // 別館外周壁
    addBox(32, 46, y, y + FLOOR_H, -10 - WALL_T / 2, -10 + WALL_T / 2, mats.annexWall, true, true); // 北
    addBox(46 - WALL_T / 2, 46 + WALL_T / 2, y, y + FLOOR_H, -10, 10, mats.annexWall, true, true);  // 東
    addBox(38, 46, y, y + FLOOR_H, 10 - WALL_T / 2, 10 + WALL_T / 2, mats.annexWall, true, true);   // 南(部屋)

    // 南(廊下端)：1Fは別館裏口（非常口！）、2Fは窓
    if (f === 0) {
      addBox(32, 38, y, y + FLOOR_H, 10 - WALL_T / 2, 10 + WALL_T / 2, mats.door, true, false);
      addExitSign(35, y, 9.7, Math.PI);
    } else {
      addWindowWall('x', 10, 32, 38, y, mats.annexWall);
    }

    // 西外周壁（2Fの Z=-2..+2 は渡り廊下接続口！）
    if (f === 1) {
      addBox(32 - WALL_T / 2, 32 + WALL_T / 2, y, y + FLOOR_H, -10, -2, mats.annexWall, true, true);
      addWindowWall('z', 32, 2, 10, y, mats.annexWall);
    } else {
      addBox(32 - WALL_T / 2, 32 + WALL_T / 2, y, y + FLOOR_H, -10, -2, mats.annexWall, true, true);
      addWindowWall('z', 32, -2, 10, y, mats.annexWall);
    }

    // 別館階段と部屋の仕切り壁（X=38一直線・階段下に壁や柵なし！）
    addBox(38 - WALL_T / 2, 38 + WALL_T / 2, y, y + FLOOR_H, -10, -2, mats.annexWall, true, true);

    // 別館内の部屋割り（すべて X=38 の廊下壁に綺麗に揃える）
    if (f === 0) {
      // 1F：美術室(X=38..46, Z=-2..4)、旧倉庫(X=38..46, Z=4..10)
      addBox(38, 46, y, y + FLOOR_H, -2 - WALL_T / 2, -2 + WALL_T / 2, mats.annexWall, true, true);
      addBox(38, 46, y, y + FLOOR_H, 4 - WALL_T / 2, 4 + WALL_T / 2, mats.annexWall, true, true);
      addWallWithOpenings('z', 38, -2, 10, y, mats.annexWall, [
        { center: 1.0, width: 1.6, hasDoor: true, label: '美術室', signSide: -1 },
        { center: 7.0, width: 1.6, hasDoor: true, label: '旧倉庫', signSide: -1 }
      ]);
      addFluorescent(35, 0, 3, 'flicker');
    } else {
      // 2F：音楽室(X=38..46, Z=-10..4) ＋ 音楽準備室(X=38..46, Z=4..10)
      addWallWithOpenings('x', 4, 38, 46, y, mats.annexWall, [
        { center: 42, width: 1.6, hasDoor: true, label: '音楽準備室', signSide: -1 }
      ]);
      addWallWithOpenings('z', 38, -2, 10, y, mats.annexWall, [
        { center: 1.0, width: 1.7, hasDoor: true, label: '音楽室', signSide: -1 },
        { center: 7.0, width: 1.6, hasDoor: true, label: '音楽準備室', signSide: -1 }
      ]);
      addFluorescent(35, 4, 3, 'flicker');
      addFluorescent(42, 4, -2, 'dim');
    }
  }

  // 別館階段（1F <-> 2F）
  addStairUnit(32, 38, -2, -10, 0);

  // =========================================================================
  // 5. 各部屋の家具・特徴オブジェクト＆インタラクト要素
  // =========================================================================

  // --- 1F メイン昇降口：下駄箱 ---
  for (let i = 0; i < 3; i++) {
    addBox(15.2 + i * 2.1, 16.5 + i * 2.1, 0, 1.5, 11.8, 15.2, mats.woodDark, true);
  }

  // --- 1F 職員室：先生たちのデスク ---
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      addBox(15.8 + c * 2.8, 17.6 + c * 2.8, 0, 0.78, -4.5 + r * 3.8, -2.8 + r * 3.8, mats.metalDark, true);
    }
  }
  // 職員室の机上の「古い名簿」
  const rosterPaper = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.04, 0.32), mats.paper);
  rosterPaper.position.set(16.7, 0.82, -3.6);
  mapGroup.add(rosterPaper);
  interactables.push({
    id: 'staff_roster',
    type: 'note',
    label: '古い吹奏楽部の名簿を調べる [E]',
    position: rosterPaper.position.clone(),
    radius: 2.2,
    text: '『平成10年 吹奏楽部名簿』——1名の名前が黒く塗りつぶされ、端に「音楽準備室・楽器庫にて行方不明扱い」とメモがある。'
  });

  // --- 1F 保健室：カーテン付きベッド ---
  addBox(-4.8, -2.5, 0, 0.6, -16.8, -15.4, mats.plaster, true);
  addBox(-4.8, -2.5, 0, 0.6, -13.6, -12.2, mats.plaster, true);
  const curtainMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.3), mats.curtain);
  curtainMesh.position.set(-2.2, 1.35, -14.5);
  curtainMesh.rotation.y = Math.PI / 2;
  mapGroup.add(curtainMesh);

  // --- 2F 2年A組（主人公の教室） ---
  populateClassroom(-6, 4, 4, -18, -10, true);
  // 主人公の机（調べるポイント）
  const myDeskMarker = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.24), mats.paper);
  myDeskMarker.position.set(-1.0, 4.76, -13.4);
  mapGroup.add(myDeskMarker);
  interactables.push({
    id: 'my_desk',
    type: 'desk',
    label: '自分の机を調べる [E]',
    position: new THREE.Vector3(-1.0, 4.9, -13.4),
    radius: 2.3
  });

  // ★ 狂気エンドアイテム①：2年A組・教卓の下の【大きい三角定規】
  const rulerGroup = new THREE.Group();
  const rulerShape = new THREE.Shape();
  rulerShape.moveTo(0, 0);
  rulerShape.lineTo(0.85, 0);
  rulerShape.lineTo(0, 0.62);
  rulerShape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(0.14, 0.12);
  hole.lineTo(0.48, 0.12);
  hole.lineTo(0.14, 0.36);
  hole.closePath();
  rulerShape.holes.push(hole);
  const rulerMesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(rulerShape, { depth: 0.035, bevelEnabled: false }),
    new THREE.MeshStandardMaterial({ color: 0xd9a838, emissive: 0x3b2a08, roughness: 0.55 })
  );
  rulerGroup.add(rulerMesh);
  rulerGroup.position.set(-1.42, 4.04, -16.02);
  rulerGroup.rotation.x = -0.22;
  mapGroup.add(rulerGroup);
  const rulerLight = new THREE.PointLight(0xffd26a, 0.65, 3.6);
  rulerLight.position.set(-1.0, 4.45, -15.85);
  mapGroup.add(rulerLight);
  sceneLights.push({ light: rulerLight, baseIntensity: 0.65 });
  interactables.push({
    id: 'item_ruler',
    type: 'key_item',
    itemKey: 'ruler',
    label: '教卓の下の大きい三角定規を取る [E]',
    position: new THREE.Vector3(-1.0, 4.4, -15.9),
    mesh: rulerGroup,
    light: rulerLight,
    radius: 2.6,
    collected: false
  });

  // --- 2F 2年B組・2年C組 ---
  populateClassroom(4, 14, 4, -18, -10, true);
  populateClassroom(14, 22, 4, 2, 16, true);

  // ★ 狂気エンドアイテム②：2年B組の教室の机にある【教室のコンパス】
  const compassGroup = new THREE.Group();
  const cMat = new THREE.MeshStandardMaterial({ color: 0xd0dce6, emissive: 0x1a2835, metalness: 0.85, roughness: 0.2 });
  const cLeg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.003, 0.24, 8), cMat);
  cLeg1.position.set(-0.025, 0, 0);
  cLeg1.rotation.z = -0.18;
  const cLeg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.003, 0.24, 8), cMat);
  cLeg2.position.set(0.025, 0, 0);
  cLeg2.rotation.z = 0.18;
  const cHead = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.05, 8), cMat);
  cHead.position.set(0, 0.13, 0);
  compassGroup.add(cLeg1, cLeg2, cHead);
  compassGroup.position.set(9.0, 4.78, -13.4);
  compassGroup.rotation.x = Math.PI / 2;
  compassGroup.rotation.z = 0.45;
  mapGroup.add(compassGroup);
  const compassLight = new THREE.PointLight(0xb8e2ff, 0.65, 3.6);
  compassLight.position.set(9.0, 5.05, -13.4);
  mapGroup.add(compassLight);
  sceneLights.push({ light: compassLight, baseIntensity: 0.65 });
  interactables.push({
    id: 'item_compass',
    type: 'key_item',
    itemKey: 'compass',
    label: '教室のコンパスを取る [E]',
    position: new THREE.Vector3(9.0, 4.85, -13.4),
    mesh: compassGroup,
    light: compassLight,
    radius: 2.5,
    collected: false
  });

  // --- 2F 放送室：放送卓 ---
  addBox(-13.2, -7.5, 4, 4.95, -16.8, -15.4, mats.metalDark, true);
  interactables.push({
    id: 'broadcast_deck',
    type: 'broadcast_deck',
    label: '放送室のカセットデッキを調べる [E]',
    position: new THREE.Vector3(-10.5, 5.0, -15.2),
    radius: 2.4
  });

  // --- 2F 図書室：本棚迷路（ステルスエリア！） ---
  for (let row = 0; row < 4; row++) {
    const bz = -3.2 + row * 4.6;
    addBox(-20.8, -17.5, 4, 6.4, bz - 0.35, bz + 0.35, mats.woodDark, true);
    if (row % 2 === 1) {
      addBox(-16.2, -14.8, 4, 6.4, bz - 0.35, bz + 0.35, mats.woodDark, true);
    }
  }

  // --- 3F 視聴覚室：机＆【古いカセットテープ】 ---
  addBox(-2.8, 0.8, 8, 8.82, -15.2, -13.6, mats.woodMid, true);
  const tapeMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.06, 0.18),
    new THREE.MeshLambertMaterial({ color: 0x2a323b, emissive: 0x162436 })
  );
  tapeMesh.position.set(-1.0, 8.88, -14.3);
  mapGroup.add(tapeMesh);
  const tapeLight = new THREE.PointLight(0x74b9ff, 0.65, 3.6);
  tapeLight.position.set(-1.0, 9.2, -14.3);
  mapGroup.add(tapeLight);
  interactables.push({
    id: 'item_tape',
    type: 'key_item',
    itemKey: 'tape',
    label: '古いカセットテープを取る [E]',
    position: tapeMesh.position.clone(),
    mesh: tapeMesh,
    light: tapeLight,
    radius: 2.4,
    collected: false
  });

  // --- 3F 理科室・理科準備室・3年A/B組 ---
  populateClassroom(4, 14, 8, -18, -10, true);
  populateClassroom(14, 22, 8, 5, 16, true);
  populateClassroom(-22, -14, 8, 5, 16, true);

  // ★ 狂気エンドアイテム③：3F 理科室の【アルコールランプ】
  const lampGroup = new THREE.Group();
  const glassBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.11, 0.18, 12),
    new THREE.MeshStandardMaterial({ color: 0x76c7ff, emissive: 0x164266, transparent: true, opacity: 0.82, roughness: 0.12 })
  );
  glassBody.position.y = 0.09;
  const metalCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.045, 0.05, 10),
    new THREE.MeshStandardMaterial({ color: 0xc2ccd4, metalness: 0.8, roughness: 0.25 })
  );
  metalCap.position.y = 0.2;
  const wick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.05, 6),
    new THREE.MeshStandardMaterial({ color: 0xf2eee2, roughness: 0.9 })
  );
  wick.position.y = 0.24;
  lampGroup.add(glassBody, metalCap, wick);
  lampGroup.position.set(9.0, 8.75, -13.4);
  mapGroup.add(lampGroup);
  const lampLight = new THREE.PointLight(0x6ad4ff, 0.72, 3.8);
  lampLight.position.set(9.0, 9.15, -13.4);
  mapGroup.add(lampLight);
  sceneLights.push({ light: lampLight, baseIntensity: 0.72 });
  interactables.push({
    id: 'item_lamp',
    type: 'key_item',
    itemKey: 'lamp',
    label: '理科室のアルコールランプを取る [E]',
    position: new THREE.Vector3(9.0, 8.9, -13.4),
    mesh: lampGroup,
    light: lampLight,
    radius: 2.5,
    collected: false
  });
  // 理科室に不気味な人体模型シルエット（フェイクびっくり用）
  const dummyGroup = new THREE.Group();
  const dBody = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.9, 0.28), new THREE.MeshLambertMaterial({ color: 0x99443d }));
  dBody.position.y = 1.1;
  dummyGroup.add(dBody);
  const dHead = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), mats.plaster);
  dHead.position.y = 1.72;
  dummyGroup.add(dHead);
  const dStand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.2, 0.7, 5), mats.metalDark);
  dStand.position.y = 0.35;
  dummyGroup.add(dStand);
  dummyGroup.position.set(12.5, 8, -16.5);
  mapGroup.add(dummyGroup);

  // 3F 理科準備室：薬品棚＆【古びた楽器庫の鍵】
  addBox(18.5, 20.8, 8, 8.88, -3.5, -1.6, mats.woodDark, true);
  const keyMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.05, 0.11),
    new THREE.MeshLambertMaterial({ color: 0xd4af37, emissive: 0x4f3b08 })
  );
  keyMesh.position.set(19.6, 8.94, -2.5);
  mapGroup.add(keyMesh);
  const keyLight = new THREE.PointLight(0xffd36b, 0.72, 3.6);
  keyLight.position.set(19.6, 9.25, -2.5);
  mapGroup.add(keyLight);
  interactables.push({
    id: 'item_key',
    type: 'key_item',
    itemKey: 'key',
    label: '古びた楽器庫の鍵を取る [E]',
    position: keyMesh.position.clone(),
    mesh: keyMesh,
    light: keyLight,
    radius: 2.5,
    collected: false
  });

  // --- 別館 1F 美術室：白い石膏像たち ---
  [[39, 0], [42.5, 0.5], [44, 2.5], [39.5, 2.6]].forEach(([sx, sz]) => {
    addBox(sx - 0.35, sx + 0.35, 0, 1.0, sz - 0.35, sz + 0.35, mats.woodMid, true);
    const bust = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.55, 6), mats.plaster);
    bust.position.set(sx, 1.28, sz);
    mapGroup.add(bust);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 6, 6), mats.plaster);
    head.position.set(sx, 1.66, sz);
    mapGroup.add(head);
  });

  // --- 別館 1F 旧倉庫：木箱＆【シオリの折れたリードと楽譜】 ---
  addBox(41.2, 43.6, 0, 0.92, 6.2, 8.2, mats.woodDark, true);
  addBox(38.2, 40.0, 0, 1.4, 7.6, 9.2, mats.woodMid, true);
  const scoreMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.06, 0.28),
    new THREE.MeshLambertMaterial({ color: 0xe6dec8, emissive: 0x3b1218 })
  );
  scoreMesh.position.set(42.2, 0.97, 7.1);
  mapGroup.add(scoreMesh);
  const scoreLight = new THREE.PointLight(0xff7f94, 0.7, 3.8);
  scoreLight.position.set(42.2, 1.3, 7.1);
  mapGroup.add(scoreLight);
  interactables.push({
    id: 'item_score',
    type: 'key_item',
    itemKey: 'score',
    label: 'シオリの折れたリードと楽譜を取る [E]',
    position: scoreMesh.position.clone(),
    mesh: scoreMesh,
    light: scoreLight,
    radius: 2.5,
    collected: false
  });

  // --- 別館 2F 音楽室：五線譜黒板・グランドピアノ・譜面台・忘れ物（ポーチ）！ ---
  const mbb = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.4, 0.08), mats.musicBlackboard);
  mbb.position.set(42, 5.8, -9.75);
  mapGroup.add(mbb);

  // グランドピアノ
  const pianoX = 42.2;
  const pianoZ = -5.5;
  addBox(pianoX - 1.3, pianoX + 1.3, 4.75, 5.15, pianoZ - 1.1, pianoZ + 1.1, mats.pianoBlack, true);
  addBox(pianoX - 1.15, pianoX + 1.15, 4.7, 4.82, pianoZ + 0.9, pianoZ + 1.35, mats.pianoKeys, false);
  [[-1.1, -0.9], [1.1, -0.9], [0, 0.9]].forEach(([lx, lz]) => {
    addBox(pianoX + lx - 0.08, pianoX + lx + 0.08, 4, 4.75, pianoZ + lz - 0.08, pianoZ + lz + 0.08, mats.pianoBlack, false);
  });

  // 音楽室の譜面台と椅子
  for (let i = 0; i < 4; i++) {
    const mx = 39.2 + i * 1.75;
    addBox(mx - 0.04, mx + 0.04, 4, 5.1, -0.8, -0.72, mats.metalDark, false);
    addBox(mx - 0.25, mx + 0.25, 5.05, 5.32, -0.82, -0.7, mats.metalDark, false);
  }

  // 主人公の忘れ物（家の鍵＆楽譜ポーチ）
  const pouchMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.3), mats.pouch);
  pouchMesh.position.set(pianoX + 0.35, 5.23, pianoZ + 0.2);
  mapGroup.add(pouchMesh);
  const pouchLight = new THREE.PointLight(0xff6680, 0.65, 3.8);
  pouchLight.position.set(pianoX + 0.35, 5.55, pianoZ + 0.2);
  mapGroup.add(pouchLight);
  interactables.push({
    id: 'forgotten_pouch',
    type: 'pouch',
    label: '忘れ物（家の鍵・楽譜ポーチ）を取る [E]',
    position: pouchMesh.position.clone(),
    mesh: pouchMesh,
    light: pouchLight,
    radius: 2.5,
    collected: false
  });

  // --- 別館 2F 音楽準備室：封鎖された古い楽器収納庫 ---
  const sealedMesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.35, 0.95), mats.sealedLocker);
  sealedMesh.position.set(44.9, 4 + 1.18, 7.6);
  sealedMesh.rotation.y = -Math.PI / 2;
  mapGroup.add(sealedMesh);
  const sealedReleaseLight = new THREE.PointLight(0xfff1cf, 0.0, 7.0);
  sealedReleaseLight.position.set(43.8, 5.4, 7.6);
  mapGroup.add(sealedReleaseLight);
  colliders.push({
    minX: 44.3, maxX: 45.6, minY: 4, maxY: 6.4, minZ: 6.8, maxZ: 8.4
  });
  interactables.push({
    id: 'sealed_locker',
    type: 'sealed_locker',
    label: '封鎖された楽器収納庫を調べる [E]',
    position: new THREE.Vector3(44.2, 5.2, 7.6),
    mesh: sealedMesh,
    releaseLight: sealedReleaseLight,
    radius: 2.5
  });

  // --- 隠れられるスチールロッカー（隙間から外が見えるホラー定番ギミック） ---
  function addHideLocker(id, x, floorY, z, faceYaw) {
    const group = new THREE.Group();
    const w = 0.86;
    const h = 2.15;
    const d = 0.72;

    // 本体（背面・側面・天板・底板）— ローカル -Z が正面（カメラの yaw=0 と一致）
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), mats.locker);
    back.position.set(0, h / 2, d / 2 - 0.03);
    group.add(back);

    const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, d), mats.locker);
    sideL.position.set(-w / 2 + 0.03, h / 2, 0);
    group.add(sideL);

    const sideR = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, d), mats.locker);
    sideR.position.set(w / 2 - 0.03, h / 2, 0);
    group.add(sideR);

    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), mats.locker);
    top.position.set(0, h - 0.03, 0);
    group.add(top);

    // 前面扉（スリット模様付き・隠れている間は非表示にしてスリットオーバーレイ越しに見る）
    const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, h - 0.06, 0.05), mats.lockerDoor);
    doorMesh.position.set(0, h / 2, -d / 2 + 0.025);
    group.add(doorMesh);

    group.position.set(x, floorY, z);
    group.rotation.y = faceYaw;
    mapGroup.add(group);

    // 外からの衝突コライダー（隠れている間は無効化）
    const halfX = Math.abs(Math.cos(faceYaw)) * (w / 2) + Math.abs(Math.sin(faceYaw)) * (d / 2);
    const halfZ = Math.abs(Math.sin(faceYaw)) * (w / 2) + Math.abs(Math.cos(faceYaw)) * (d / 2);
    const col = {
      minX: x - halfX,
      maxX: x + halfX,
      minY: floorY,
      maxY: floorY + h,
      minZ: z - halfZ,
      maxZ: z + halfZ,
      active: true
    };
    colliders.push(col);

    // 正面方向ベクトル（ローカル -Z を faceYaw で回転）
    const fwdX = -Math.sin(faceYaw);
    const fwdZ = -Math.cos(faceYaw);
    const insideCamPos = new THREE.Vector3(x + fwdX * 0.24, floorY + 1.52, z + fwdZ * 0.24);
    const exitPos = new THREE.Vector3(x + fwdX * 0.92, floorY, z + fwdZ * 0.92);
    const center = new THREE.Vector3(x + fwdX * 0.35, floorY + 1.15, z + fwdZ * 0.35);

    lockers.push({
      id,
      pos: new THREE.Vector3(x, floorY, z),
      insideCamPos,
      exitPos,
      center,
      faceYaw,
      doorMesh,
      collider: col
    });
  }

  // 校舎各階＆別館に13台の隠れロッカーを配置！
  addHideLocker('locker_1f_north1', -7.5, 0, -9.45, Math.PI);
  addHideLocker('locker_1f_north2', 9.0, 0, -9.45, Math.PI);
  addHideLocker('locker_1f_west', -13.45, 0, 3.0, -Math.PI / 2);
  addHideLocker('locker_1f_east', 13.45, 0, 5.0, Math.PI / 2);
  addHideLocker('locker_1f_annex', 37.45, 0, 4.0, Math.PI / 2);

  addHideLocker('locker_2f_2a', -5.35, 4, -13.5, -Math.PI / 2);
  addHideLocker('locker_2f_north1', -6.2, 4, -9.45, Math.PI);
  addHideLocker('locker_2f_north2', 9.0, 4, -9.45, Math.PI);
  addHideLocker('locker_2f_west', -13.45, 4, 4.0, -Math.PI / 2);
  addHideLocker('locker_2f_east', 13.45, 4, 8.8, Math.PI / 2);
  addHideLocker('locker_2f_annex', 37.45, 4, 4.0, Math.PI / 2);
  addHideLocker('locker_2f_music', 38.65, 4, -1.6, -Math.PI / 2);

  addHideLocker('locker_3f_north', 3.8, 8, -9.45, Math.PI);

  // --- 脱出出口（1F メイン昇降口 / 西昇降口 / 別館裏口） ---
  interactables.push({
    id: 'exit_main',
    type: 'exit',
    label: 'メイン昇降口から外へ出る [E]',
    position: new THREE.Vector3(12, 1.3, 15.2),
    radius: 2.5
  });
  interactables.push({
    id: 'exit_west',
    type: 'exit',
    label: '西昇降口（非常口）から脱出する [E]',
    position: new THREE.Vector3(-12, 1.3, 15.2),
    radius: 2.5
  });
  interactables.push({
    id: 'exit_annex',
    type: 'exit',
    label: '別館裏口（非常口）から脱出する [E]',
    position: new THREE.Vector3(35, 1.3, 9.2),
    radius: 2.8
  });

  // =========================================================================
  // 6. 階段＆フロア高さ計算関数（滑らかに1F〜3F・別館を移動可能）
  // =========================================================================
  function getFloorHeight(x, z, currentY) {
    // 階段ゾーンチェック
    for (const s of stairZones) {
      if (x >= s.xLeft && x <= s.xRight && z >= s.zBack && z <= s.zFront) {
        let targetH;
        if (z <= s.splitZ) {
          // 奥の中踊り場
          targetH = s.baseY + 2.0;
        } else if (x >= s.midX) {
          // 右レーン（下階 zFront -> 中踊り場 splitZ）
          const t = (s.zFront - z) / (s.zFront - s.splitZ);
          targetH = s.baseY + Math.max(0, Math.min(1, t)) * 2.0;
        } else {
          // 左レーン（中踊り場 splitZ -> 上階 zFront）
          const t = (z - s.splitZ) / (s.zFront - s.splitZ);
          targetH = s.baseY + 2.0 + Math.max(0, Math.min(1, t)) * 2.0;
        }
        if (Math.abs(targetH - currentY) <= 1.35) {
          return targetH;
        }
      }
    }

    // 通常フロア（0, 4, 8 のうち最も近い面）
    const floors = [0, 4, 8];
    let best = 0;
    let minDiff = Infinity;
    for (const fy of floors) {
      const diff = Math.abs(fy - currentY);
      if (diff < minDiff) {
        minDiff = diff;
        best = fy;
      }
    }
    return best;
  }

  // 現在のエリア名を返す（HUD・見取り図用）
  function getAreaName(x, y, z) {
    const floorNum = y < 2 ? '1F' : y < 6 ? '2F' : '3F';
    if (x >= 22 && x <= 32 && z >= -2 && z <= 2) return '2F 渡り廊下';
    if (x > 32) {
      if (z < -2 && x < 38) return `別館階段 (${floorNum})`;
      if (floorNum === '2F') {
        if (x >= 36 && z < 4) return '別館2F 音楽室';
        if (x >= 36 && z >= 4) return '別館2F 音楽準備室';
        return '別館2F 廊下';
      } else {
        if (x >= 36 && z < 4) return '別館1F 美術室';
        if (x >= 36 && z >= 4) return '別館1F 旧倉庫';
        return '別館1F 廊下';
      }
    }
    if (z < -10) {
      if (x < -14) return `西階段 (${floorNum})`;
      if (x > 14) return `東階段 (${floorNum})`;
      if (x < -6) return floorNum === '2F' ? '2F 放送室' : `${floorNum} トイレ`;
      if (x < 4) return floorNum === '1F' ? '1F 保健室' : floorNum === '2F' ? '2F 2年A組' : '3F 視聴覚室';
      return floorNum === '1F' ? '1F 印刷室' : floorNum === '2F' ? '2F 2年B組' : '3F 理科室';
    }
    if (z <= -6) return `${floorNum} 北棟廊下`;
    if (x < -14) {
      if (floorNum === '2F') return '2F 図書室';
      return z < 5 ? (floorNum === '1F' ? '1F 倉庫' : '3F 空き教室') : (floorNum === '1F' ? '1F 西昇降口' : '3F 3年B組');
    }
    if (x <= -10) return `${floorNum} 西棟廊下`;
    if (x > 14) {
      if (floorNum === '1F') return z < 5 ? '1F 職員室' : z < 11 ? '1F 警備員室' : '1F メイン昇降口';
      if (floorNum === '2F') return z >= 2 ? '2F 2年C組' : '2F 渡り廊下口';
      return z < 5 ? '3F 理科準備室' : '3F 3年A組';
    }
    if (x >= 10) return `${floorNum} 東棟廊下`;
    return `${floorNum} 校舎内`;
  }

  // 敵（赤いコートの女）用の巡回ウェイポイント
  const waypoints = [
    // 2F 別館・渡り廊下・本館（メイン活動エリア）
    new THREE.Vector3(34, 4, 2),
    new THREE.Vector3(41, 4, -2),
    new THREE.Vector3(27, 4, 0),
    new THREE.Vector3(12, 4, 0),
    new THREE.Vector3(12, 4, -8),
    new THREE.Vector3(0, 4, -8),
    new THREE.Vector3(-12, 4, -8),
    new THREE.Vector3(-12, 4, 4),
    new THREE.Vector3(12, 4, 10),
    // 1F 廊下・別館1F
    new THREE.Vector3(34, 0, 2),
    new THREE.Vector3(12, 0, -8),
    new THREE.Vector3(0, 0, -8),
    new THREE.Vector3(-12, 0, -8),
    new THREE.Vector3(-12, 0, 10),
    new THREE.Vector3(12, 0, 10),
    // 3F 廊下
    new THREE.Vector3(12, 8, -8),
    new THREE.Vector3(0, 8, -8),
    new THREE.Vector3(-12, 8, -8)
  ];

  // 蛍光灯の明滅アニメーション＆埃パーティクル＆近距離ライトカリング
  let dustTime = 0;
  function updateLights(dt, playerPos = null) {
    dustTime += dt;
    dustPoints.position.y = Math.sin(dustTime * 0.45) * 0.14;
    dustPoints.position.x = Math.cos(dustTime * 0.25) * 0.12;

    if (playerPos) {
      // 遠い階・離れた場所のライトは自動OFFにしてWebGL負荷＆シェーダー上限エラーを完全防止
      for (const entry of sceneLights) {
        const dy = Math.abs(entry.light.position.y - (playerPos.y + 2.0));
        const dxz = Math.hypot(entry.light.position.x - playerPos.x, entry.light.position.z - playerPos.z);
        entry.light.visible = (dy < 3.8 && dxz < 20.0);
      }
    }

    for (const f of flickers) {
      if (!f.light.visible) continue;
      f.timer -= dt;
      if (f.timer <= 0) {
        const roll = Math.random();
        if (roll < 0.25) {
          f.light.intensity = 0.08;
          if (f.bar.material.emissiveIntensity !== undefined) f.bar.material.emissiveIntensity = 0.08;
          f.timer = 0.05 + Math.random() * 0.14;
        } else if (roll < 0.45) {
          f.light.intensity = f.baseIntensity * 0.45;
          if (f.bar.material.emissiveIntensity !== undefined) f.bar.material.emissiveIntensity = 0.55;
          f.timer = 0.08 + Math.random() * 0.18;
        } else {
          f.light.intensity = f.baseIntensity;
          if (f.bar.material.emissiveIntensity !== undefined) f.bar.material.emissiveIntensity = 1.45;
          f.timer = 0.4 + Math.random() * 2.2;
        }
      }
    }
  }

  return {
    colliders,
    doors,
    lockers,
    interactables,
    waypoints,
    getFloorHeight,
    getAreaName,
    updateLights
  };
}
