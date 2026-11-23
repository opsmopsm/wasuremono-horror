import * as THREE from 'three';

// 校舎内の廊下・階段・別館を壁に一切触れずに繋ぐナビゲーションノード
function buildNavGraph() {
  const nodes = [
    // --- 1F 本館 ---
    { id: 0, pos: new THREE.Vector3(12, 0, 11) },      // 1F 東棟南（昇降口付近）
    { id: 1, pos: new THREE.Vector3(12, 0, 0) },       // 1F 東棟中（職員室前）
    { id: 2, pos: new THREE.Vector3(12, 0, -8) },      // 1F 北東角
    { id: 3, pos: new THREE.Vector3(0, 0, -8) },       // 1F 北棟中（保健室前）
    { id: 4, pos: new THREE.Vector3(-12, 0, -8) },     // 1F 北西角
    { id: 5, pos: new THREE.Vector3(-12, 0, 4) },      // 1F 西棟中
    { id: 6, pos: new THREE.Vector3(-12, 0, 12) },     // 1F 西棟南（西昇降口前）

    // --- 東階段 1F->2F（廊下端の中継ノード経由で壁に絶対触れない） ---
    { id: 7, pos: new THREE.Vector3(20.0, 0, -8.2) },  // 1F 東階段右レーン入口前
    { id: 8, pos: new THREE.Vector3(20.0, 0.2, -10.5) },
    { id: 9, pos: new THREE.Vector3(20.0, 2.0, -16.4) },
    { id: 10, pos: new THREE.Vector3(16.0, 2.0, -16.4) },
    { id: 11, pos: new THREE.Vector3(16.0, 3.8, -10.5) },
    { id: 12, pos: new THREE.Vector3(16.0, 4.0, -8.2) }, // 2F 東階段左レーン出口

    // --- 西階段 1F->2F ---
    { id: 13, pos: new THREE.Vector3(-16.0, 0, -8.2) },  // 1F 西階段右レーン入口前
    { id: 14, pos: new THREE.Vector3(-16.0, 0.2, -10.5) },
    { id: 15, pos: new THREE.Vector3(-16.0, 2.0, -16.4) },
    { id: 16, pos: new THREE.Vector3(-20.0, 2.0, -16.4) },
    { id: 17, pos: new THREE.Vector3(-20.0, 3.8, -10.5) },
    { id: 18, pos: new THREE.Vector3(-20.0, 4.0, -8.2) }, // 2F 西階段左レーン出口

    // --- 2F 本館 ---
    { id: 19, pos: new THREE.Vector3(12, 4, 11) },     // 2F 東棟南
    { id: 20, pos: new THREE.Vector3(12, 4, 0) },      // 2F 東棟中（渡り廊下口）
    { id: 21, pos: new THREE.Vector3(12, 4, -8) },     // 2F 北東角
    { id: 22, pos: new THREE.Vector3(0, 4, -8) },      // 2F 北棟中（2-A前）
    { id: 23, pos: new THREE.Vector3(-12, 4, -8) },    // 2F 北西角
    { id: 24, pos: new THREE.Vector3(-12, 4, 4) },     // 2F 西棟中（図書室前）
    { id: 25, pos: new THREE.Vector3(-12, 4, 12) },    // 2F 西棟南

    // --- 2F 渡り廊下 & 別館2F ---
    { id: 26, pos: new THREE.Vector3(19, 4, 0) },      // 2F 渡り廊下入口
    { id: 27, pos: new THREE.Vector3(27, 4, 0) },      // 2F 渡り廊下中央
    { id: 28, pos: new THREE.Vector3(34, 4, 0) },      // 別館2F 渡り廊下出口
    { id: 29, pos: new THREE.Vector3(34, 4, 1.0) },    // 別館2F 音楽室ドア正面
    { id: 30, pos: new THREE.Vector3(34, 4, 6.5) },    // 別館2F 廊下南
    { id: 31, pos: new THREE.Vector3(38.2, 4, 1.0) },  // 別館2F 音楽室入口内
    { id: 32, pos: new THREE.Vector3(40.0, 4, -3.5) }, // 別館2F 音楽室ピアノ手前

    // --- 別館階段 2F<->1F（廊下側の中継ノード経由） ---
    { id: 33, pos: new THREE.Vector3(33.5, 4.0, -1.2) },
    { id: 34, pos: new THREE.Vector3(33.5, 3.8, -2.5) },
    { id: 35, pos: new THREE.Vector3(33.5, 2.0, -8.5) },
    { id: 36, pos: new THREE.Vector3(36.5, 2.0, -8.5) },
    { id: 37, pos: new THREE.Vector3(36.5, 0.2, -2.5) },
    { id: 38, pos: new THREE.Vector3(36.5, 0.0, -1.2) },
    { id: 39, pos: new THREE.Vector3(34.0, 0.0, 1.0) }, // 別館1F 廊下
    { id: 40, pos: new THREE.Vector3(34.0, 0.0, 7.0) }, // 別館1F 裏口前

    // --- 東階段 2F->3F & 3F 本館 ---
    { id: 41, pos: new THREE.Vector3(20.0, 4.0, -8.2) },
    { id: 42, pos: new THREE.Vector3(20.0, 4.2, -10.5) },
    { id: 43, pos: new THREE.Vector3(20.0, 6.0, -16.4) },
    { id: 44, pos: new THREE.Vector3(16.0, 6.0, -16.4) },
    { id: 45, pos: new THREE.Vector3(16.0, 7.8, -10.5) },
    { id: 46, pos: new THREE.Vector3(16.0, 8.0, -8.2) },
    { id: 47, pos: new THREE.Vector3(12, 8, -8) },      // 3F 北東角
    { id: 48, pos: new THREE.Vector3(0, 8, -8) },       // 3F 北棟中
    { id: 49, pos: new THREE.Vector3(-12, 8, -8) },     // 3F 北西角
    { id: 50, pos: new THREE.Vector3(12, 8, 6) },       // 3F 東棟
    { id: 51, pos: new THREE.Vector3(-12, 8, 6) }       // 3F 西棟
  ];

  const edges = [
    // 1F 本館廊下
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6],
    // 東階段 1F->2F
    [2, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 21],
    // 西階段 1F->2F
    [4, 13], [13, 14], [14, 15], [15, 16], [16, 17], [17, 18], [18, 23],
    // 2F 本館廊下
    [19, 20], [20, 21], [21, 22], [22, 23], [23, 24], [24, 25],
    // 2F 渡り廊下 & 別館2F
    [20, 26], [26, 27], [27, 28], [28, 29], [29, 30], [29, 31], [31, 32],
    // 別館階段 2F<->1F
    [28, 33], [33, 34], [34, 35], [35, 36], [36, 37], [37, 38], [38, 39], [39, 40],
    // 東階段 2F->3F & 3F
    [21, 41], [41, 42], [42, 43], [43, 44], [44, 45], [45, 46], [46, 47],
    [47, 48], [48, 49], [47, 50], [49, 51]
  ];

  // パトロールの目的地に使う「広い廊下・ホール」ノード一覧（階段途中を目的地にしない）
  const patrolTargets = [0, 1, 2, 3, 4, 5, 6, 19, 20, 21, 22, 23, 24, 25, 27, 29, 30, 39, 40, 47, 48, 49, 50, 51];

  const adj = Array.from({ length: nodes.length }, () => []);
  for (const [a, b] of edges) {
    adj[a].push(b);
    adj[b].push(a);
  }
  return { nodes, adj, patrolTargets };
}

export class RedCoatWoman {
  constructor(scene, textures) {
    this.scene = scene;
    this.nav = buildNavGraph();
    this.active = false;
    this.state = 'idle'; // idle | patrol | chase
    this.position = new THREE.Vector3(34, 4, 6.5);
    this.currentPath = [];
    this.pathTimer = 0;
    this.loseSightTimer = 0;
    this.spotDelayTimer = 0;   // 発見してから加速するまでの逃げ出し猶予
    this.retreatCooldown = 0;  // 振り切ったあと遠くへ離れるクールダウン
    this.whisperTimer = 5.0;
    this.animTime = 0;

    // ちょうど良く怖くて逃げ切れる速度バランス！
    this.speedPatrol = 1.75;
    this.speedChase = 3.45; // プレイヤー歩行(3.25)よりやや速く、ダッシュ(5.7)で余裕で振り切れる

    this.group = this.buildModel(textures);
    this.group.position.copy(this.position);
    this.group.visible = false;
    this.scene.add(this.group);
  }

  // 赤いコートと赤い帽子を着た「形がいびつな女の人」（高精細PBR＋シャドウ対応）
  buildModel(textures) {
    const root = new THREE.Group();

    const coatMat = new THREE.MeshStandardMaterial({
      map: textures.redCoat,
      roughness: 0.78,
      metalness: 0.04,
      emissive: 0x260205,
      emissiveIntensity: 0.4
    });
    const hatMat = new THREE.MeshStandardMaterial({
      color: 0xa40d16,
      roughness: 0.72,
      metalness: 0.05,
      emissive: 0x2a0205,
      emissiveIntensity: 0.35
    });
    const hatRibbonMat = new THREE.MeshStandardMaterial({ color: 0x180406, roughness: 0.45, metalness: 0.1 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xcbc4ba, roughness: 0.68, metalness: 0.02 });
    const faceMat = new THREE.MeshStandardMaterial({
      map: textures.ghostFace,
      roughness: 0.62,
      metalness: 0.02,
      emissive: 0x161314,
      emissiveIntensity: 0.3
    });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x0b090d, roughness: 0.88 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x141013, roughness: 0.8 });

    this.bodyPivot = new THREE.Group();
    this.bodyPivot.position.y = 0.0;
    root.add(this.bodyPivot);

    this.leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.78, 10), darkMat);
    this.leftLeg.position.set(-0.14, 0.39, 0);
    this.bodyPivot.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.78, 10), darkMat);
    this.rightLeg.position.set(0.14, 0.39, 0);
    this.bodyPivot.add(this.rightLeg);

    const coatSkirt = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.44, 1.12, 16), coatMat);
    coatSkirt.position.set(0, 0.86, 0);
    coatSkirt.rotation.z = 0.05;
    this.bodyPivot.add(coatSkirt);

    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.25, 0.07, 16), hatRibbonMat);
    belt.position.set(0, 1.24, 0);
    this.bodyPivot.add(belt);

    this.torso = new THREE.Group();
    this.torso.position.set(0, 1.38, 0);
    this.torso.rotation.z = -0.09;
    this.torso.rotation.x = 0.14;
    this.bodyPivot.add(this.torso);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.28), coatMat);
    chest.position.y = 0.12;
    this.torso.add(chest);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.16, 14), hatMat);
    collar.position.set(0, 0.42, 0);
    this.torso.add(collar);

    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0.03, 0.48, 0.04);
    this.headGroup.rotation.z = 0.68;
    this.headGroup.rotation.x = -0.12;
    this.torso.add(this.headGroup);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.078, 0.23, 12), skinMat);
    neck.position.y = 0.07;
    this.headGroup.add(neck);

    const headMats = [skinMat, skinMat, skinMat, skinMat, faceMat, hairMat];
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.34, 0.25), headMats);
    head.position.set(0, 0.28, 0.02);
    this.headGroup.add(head);

    const backHair = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.62, 0.13), hairMat);
    backHair.position.set(0, 0.14, -0.11);
    this.headGroup.add(backHair);
    [-0.14, 0.14].forEach((hx) => {
      const sideHair = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.52, 0.17), hairMat);
      sideHair.position.set(hx, 0.12, -0.02);
      this.headGroup.add(sideHair);
    });

    const hatGroup = new THREE.Group();
    hatGroup.position.set(0, 0.45, 0.01);
    hatGroup.rotation.z = -0.14;
    hatGroup.rotation.x = 0.16;
    this.headGroup.add(hatGroup);

    const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.04, 20), hatMat);
    hatGroup.add(hatBrim);
    const hatCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.23, 0.23, 18), hatMat);
    hatCrown.position.y = 0.12;
    hatGroup.add(hatCrown);
    const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.24, 0.055, 18), hatRibbonMat);
    hatBand.position.y = 0.04;
    hatGroup.add(hatBand);

    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.28, 0.34, 0);
    this.torso.add(this.rightArm);
    const rUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.055, 0.58, 10), coatMat);
    rUpper.position.set(0.04, -0.26, 0.04);
    rUpper.rotation.z = 0.18;
    this.rightArm.add(rUpper);
    const rFore = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.62, 10), coatMat);
    rFore.position.set(0.06, -0.78, 0.18);
    rFore.rotation.x = -0.45;
    this.rightArm.add(rFore);
    const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.23, 0.06), skinMat);
    rHand.position.set(0.06, -1.12, 0.31);
    this.rightArm.add(rHand);

    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.27, 0.38, 0);
    this.torso.add(this.leftArm);
    const lUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.055, 0.48, 10), coatMat);
    lUpper.position.set(-0.04, -0.22, 0);
    lUpper.rotation.z = -0.22;
    this.leftArm.add(lUpper);
    const lFore = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.46, 10), coatMat);
    lFore.position.set(-0.02, -0.58, 0.12);
    lFore.rotation.x = -0.55;
    this.leftArm.add(lFore);
    const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.19, 0.06), skinMat);
    lHand.position.set(-0.01, -0.84, 0.24);
    this.leftArm.add(lHand);

    root.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    const aura = new THREE.PointLight(0xb80c1c, 0.85, 7.2, 1.7);
    aura.position.set(0, 1.5, 0.28);
    root.add(aura);

    return root;
  }

  activate(spawnPos) {
    this.active = true;
    this.state = 'patrol';
    this.retreatCooldown = 0;
    this.spotDelayTimer = 0;
    if (spawnPos) {
      this.position.copy(spawnPos);
      this.group.position.copy(spawnPos);
    }
    this.group.visible = true;
    this.currentPath = [];
    this.pathTimer = 0;
  }

  deactivate() {
    this.active = false;
    this.state = 'idle';
    this.group.visible = false;
  }

  findNearestNode(pos, colliders = null) {
    let best = 0;
    let bestScore = Infinity;
    for (let i = 0; i < this.nav.nodes.length; i++) {
      const n = this.nav.nodes[i].pos;
      const dy = Math.abs(n.y - pos.y);
      let score = Math.hypot(n.x - pos.x, n.z - pos.z) + dy * 4.0;
      // 壁の向こう側のノードを誤って選ばないよう視線が遮られていたら大きなペナルティ！
      if (colliders && dy < 1.5 && !this.segmentClear(pos, n, colliders)) {
        score += 25.0;
      }
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return best;
  }

  computePath(fromIdx, toIdx) {
    if (fromIdx === toIdx) return [this.nav.nodes[toIdx].pos.clone()];
    const visited = new Set([fromIdx]);
    const prev = new Map();
    const queue = [fromIdx];

    while (queue.length > 0) {
      const cur = queue.shift();
      if (cur === toIdx) break;
      for (const nxt of this.nav.adj[cur]) {
        if (!visited.has(nxt)) {
          visited.add(nxt);
          prev.set(nxt, cur);
          queue.push(nxt);
        }
      }
    }
    if (!visited.has(toIdx)) return [];
    const path = [];
    let cur = toIdx;
    while (cur !== undefined && cur !== fromIdx) {
      path.unshift(this.nav.nodes[cur].pos.clone());
      cur = prev.get(cur);
    }
    return path;
  }

  // 2点間が壁で遮られていないか厳密チェック（高さ0.9mと1.5mの2ライン）
  segmentClear(a, b, colliders) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.4) return true;

    const steps = Math.ceil(dist / 0.4);
    const baseY = Math.min(a.y, b.y);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const px = a.x + dx * t;
      const pz = a.z + dz * t;
      for (const c of colliders) {
        if (c.active === false) continue;
        // 胸の高さ(1.3m)で壁に当たるかチェック
        const cy = baseY + 1.3;
        if (cy < c.minY || cy > c.maxY) continue;
        if (px >= c.minX - 0.12 && px <= c.maxX + 0.12 && pz >= c.minZ - 0.12 && pz <= c.maxZ + 0.12) {
          return false;
        }
      }
    }
    return true;
  }

  hasLineOfSight(playerPos, colliders) {
    if (Math.abs(playerPos.y - this.position.y) > 1.6) return false;
    return this.segmentClear(this.position, playerPos, colliders);
  }

  // 広めの半径(0.46m)で壁コライダーと常時衝突判定（コートや腕が壁を突き抜けない！）
  collidesAt(x, y, z, colliders) {
    const r = 0.46;
    const minY = y + 0.3;
    const maxY = y + 1.8;
    for (const c of colliders) {
      if (c.active === false) continue;
      if (maxY <= c.minY || minY >= c.maxY) continue;
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) {
        return true;
      }
    }
    return false;
  }

  // 目の前の閉まったドアだけを開ける（壁越しのドアは開けない）
  openNearbyDoors(doors, colliders, callbacks) {
    if (!doors) return;
    for (const d of doors) {
      if (d.isOpen || d.locked) continue;
      if (Math.abs(d.center.y - (this.position.y + 1.2)) > 1.4) continue;
      const dist = Math.hypot(d.center.x - this.position.x, d.center.z - this.position.z);
      if (dist < 1.1) {
        d.isOpen = true;
        d.collider.active = false;
        if (callbacks && callbacks.onOpenDoor) callbacks.onOpenDoor();
      }
    }
  }

  // プレイヤーから十分に離れた巡回ノードを選ぶ（張り付きを完全防止！）
  pickPatrolTarget(playerPos, preferFar = false) {
    const pool = this.nav.patrolTargets;
    const farNodes = pool.filter((idx) => {
      const p = this.nav.nodes[idx].pos;
      return p.distanceTo(playerPos) >= 14.0;
    });
    const candidates = (preferFar && farNodes.length > 0)
      ? farNodes
      : (Math.random() < 0.72 && farNodes.length > 0 ? farNodes : pool);
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  update(dt, playerPos, playerState, colliders, callbacks, doors = []) {
    if (!this.active) return 999;

    const dist3D = this.position.distanceTo(playerPos);
    const sameFloor = Math.abs(this.position.y - playerPos.y) < 1.6;
    if (this.retreatCooldown > 0) this.retreatCooldown -= dt;
    if (this.spotDelayTimer > 0) this.spotDelayTimer -= dt;

    // 1. ロッカーに隠れている場合の専用AI
    if (playerState.hiding && playerState.hidingLocker) {
      const locker = playerState.hidingLocker;

      if (playerState.seenHiding) {
        this.state = 'chase';
        const target = locker.exitPos;
        const dToLocker = Math.hypot(target.x - this.position.x, target.z - this.position.z);
        if (dToLocker < 1.05 && sameFloor && this.segmentClear(this.position, target, colliders)) {
          if (callbacks.onLockerBreach) callbacks.onLockerBreach();
          return dToLocker;
        }
        this.moveToward(target, this.speedChase, dt, colliders, doors, callbacks);
        this.animateBody(dt);
        return dist3D;
      }

      // 見られずに隠れた → 追跡を解除して、遠くの廊下へ去っていく！
      if (this.state === 'chase') {
        this.state = 'patrol';
        this.retreatCooldown = 14.0;
        const startN = this.findNearestNode(this.position, colliders);
        const farN = this.pickPatrolTarget(playerPos, true);
        this.currentPath = this.computePath(startN, farN);
        this.pathTimer = 10.0;
      }

      this.whisperTimer -= dt;
      if (sameFloor && dist3D < 6.5 && this.whisperTimer <= 0) {
        this.whisperTimer = 6.5 + Math.random() * 4;
        const hideLines = [
          '「……ドコ……カクレテルノ……？」',
          '「……カチ……カチ……イナイノカナ……」'
        ];
        if (callbacks.onWhisper) {
          callbacks.onWhisper(hideLines[Math.floor(Math.random() * hideLines.length)]);
        }
      }

      this.updatePatrolMovement(dt, playerPos, true, colliders, doors, callbacks);
      this.animateBody(dt);
      return dist3D;
    }

    // 2. 通常時の索敵＆追跡（理不尽のない視界距離とクールダウン）
    let detectRange = playerState.flashlightOn ? 11.5 : 5.0;
    if (playerState.crouching) detectRange *= 0.55;
    if (playerState.running) detectRange += 2.5;

    const canSee = sameFloor && dist3D < detectRange && this.hasLineOfSight(playerPos, colliders);

    if (canSee) {
      if (this.state !== 'chase') {
        this.state = 'chase';
        this.spotDelayTimer = 0.45; // 発見から逃げ出すための0.45秒の猶予
        if (callbacks.onSpot) callbacks.onSpot();
      }
      this.loseSightTimer = 3.2; // 角を曲がって少し走ればちゃんと撒ける！
    } else if (this.state === 'chase') {
      this.loseSightTimer -= dt;
      if (this.loseSightTimer <= 0) {
        this.state = 'patrol';
        this.retreatCooldown = 12.0; // 撒いたあとはしばらく遠くへ離れる
        const startN = this.findNearestNode(this.position, colliders);
        const farN = this.pickPatrolTarget(playerPos, true);
        this.currentPath = this.computePath(startN, farN);
        this.pathTimer = 9.0;
      }
    }

    // 捕獲判定（壁越し捕獲なし＆距離0.92mで理不尽なし）
    if (dist3D < 0.92 && sameFloor && this.hasLineOfSight(playerPos, colliders)) {
      if (callbacks.onCatch) callbacks.onCatch();
      return dist3D;
    }

    // 近いときのホラー囁きセリフ
    this.whisperTimer -= dt;
    if (sameFloor && dist3D < 9.5 && this.whisperTimer <= 0) {
      this.whisperTimer = 8.0 + Math.random() * 5;
      const lines = this.state === 'chase'
        ? ['「……ミツケタ……！」', '「……ニゲナイデ……ワスレモノ……」']
        : ['「……ワスレモノ……ドコ……」', '「……アケテ……クラクテ、セマイヨ……」'];
      if (callbacks.onWhisper) {
        callbacks.onWhisper(lines[Math.floor(Math.random() * lines.length)]);
      }
    }

    // 移動ターゲット決定
    this.pathTimer -= dt;
    let moveTarget = null;

    if (this.state === 'chase') {
      // 発見直後の0.45秒はゆっくり踏み出して逃げ出す隙を作る
      const curChaseSpeed = this.spotDelayTimer > 0 ? this.speedPatrol * 0.7 : this.speedChase;

      // 間に壁がなく真っ直ぐ見えているときだけ直接追う。少しでも遮られたら必ずナビ経路！
      if (canSee && dist3D < 9.5 && this.segmentClear(this.position, playerPos, colliders)) {
        moveTarget = playerPos.clone();
        this.currentPath = [];
      } else if (this.pathTimer <= 0 || this.currentPath.length === 0) {
        const startN = this.findNearestNode(this.position, colliders);
        const endN = this.findNearestNode(playerPos, colliders);
        this.currentPath = this.computePath(startN, endN);
        this.pathTimer = 1.0;
      }

      if (!moveTarget && this.currentPath.length > 0) {
        moveTarget = this.currentPath[0];
        const flatDist = Math.hypot(moveTarget.x - this.position.x, moveTarget.z - this.position.z);
        if (flatDist < 0.45 && Math.abs(moveTarget.y - this.position.y) < 0.7) {
          this.currentPath.shift();
          moveTarget = this.currentPath[0] || null;
        }
      }

      if (moveTarget) {
        const moved = this.moveToward(moveTarget, curChaseSpeed, dt, colliders, doors, callbacks);
        if (!moved) {
          const startN = this.findNearestNode(this.position, colliders);
          const endN = this.findNearestNode(playerPos, colliders);
          this.currentPath = this.computePath(startN, endN);
          this.pathTimer = 1.0;
        }
      }
    } else {
      this.updatePatrolMovement(dt, playerPos, false, colliders, doors, callbacks);
    }

    this.animateBody(dt);
    return dist3D;
  }

  updatePatrolMovement(dt, playerPos, playerIsHiding, colliders, doors, callbacks) {
    this.pathTimer -= dt;
    if (this.currentPath.length === 0 || this.pathTimer <= 0) {
      const startN = this.findNearestNode(this.position, colliders);
      const preferFar = playerIsHiding || this.retreatCooldown > 0;
      const targetN = this.pickPatrolTarget(playerPos, preferFar);
      this.currentPath = this.computePath(startN, targetN);
      this.pathTimer = 9.0;
    }

    if (this.currentPath.length > 0) {
      const wp = this.currentPath[0];
      const flatDist = Math.hypot(wp.x - this.position.x, wp.z - this.position.z);
      if (flatDist < 0.45 && Math.abs(wp.y - this.position.y) < 0.7) {
        this.currentPath.shift();
      } else {
        const moved = this.moveToward(wp, this.speedPatrol, dt, colliders, doors, callbacks);
        if (!moved) {
          this.currentPath = [];
          this.pathTimer = 0;
        }
      }
    }
  }

  moveToward(target, speed, dt, colliders, doors, callbacks) {
    this.openNearbyDoors(doors, colliders, callbacks);

    const dir = target.clone().sub(this.position);
    const len = dir.length();
    if (len <= 0.01) return true;

    dir.normalize();
    const step = Math.min(len, speed * dt);
    const dx = dir.x * step;
    const dy = dir.y * step;
    const dz = dir.z * step;

    const prevX = this.position.x;
    const prevZ = this.position.z;

    // 階段移動中も含めて常に壁コライダーを厳密チェック（絶対に壁をすり抜けない！）
    const subSteps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.07));
    const sx = dx / subSteps;
    const sy = dy / subSteps;
    const sz = dz / subSteps;

    for (let i = 0; i < subSteps; i++) {
      const ny = this.position.y + sy;
      let movedAny = false;
      if (!colliders || !this.collidesAt(this.position.x + sx, ny, this.position.z, colliders)) {
        this.position.x += sx;
        movedAny = true;
      }
      if (!colliders || !this.collidesAt(this.position.x, ny, this.position.z + sz, colliders)) {
        this.position.z += sz;
        movedAny = true;
      }
      if (movedAny || Math.abs(sy) > 0.0001) {
        this.position.y = ny;
      }
    }

    const targetAngle = Math.atan2(dir.x, dir.z);
    let diff = targetAngle - this.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.group.rotation.y += diff * Math.min(1, dt * 8);

    this.group.position.copy(this.position);
    const actuallyMoved = Math.hypot(this.position.x - prevX, this.position.z - prevZ) + Math.abs(dy);
    return actuallyMoved > step * 0.2;
  }

  animateBody(dt) {
    const animSpeed = this.state === 'chase' ? 9.5 : 4.8;
    this.animTime += dt * animSpeed;
    const stride = Math.sin(this.animTime);

    this.leftLeg.rotation.x = stride * 0.45;
    this.rightLeg.rotation.x = -stride * 0.45;
    this.rightArm.rotation.x = -stride * 0.4 - (this.state === 'chase' ? 0.5 : 0.1);
    this.leftArm.rotation.x = stride * 0.32 - (this.state === 'chase' ? 0.32 : 0.05);

    this.bodyPivot.position.y = Math.abs(Math.sin(this.animTime)) * 0.08;
    this.torso.rotation.z = -0.1 + Math.sin(this.animTime * 0.7) * 0.07;

    const twitch = Math.sin(this.animTime * 3.7) > 0.85 ? (Math.random() - 0.5) * 0.32 : 0;
    this.headGroup.rotation.z = 0.68 + Math.sin(this.animTime * 1.2) * 0.1 + twitch;
    this.headGroup.rotation.y = Math.sin(this.animTime * 0.9) * 0.16 + twitch;
  }
}
