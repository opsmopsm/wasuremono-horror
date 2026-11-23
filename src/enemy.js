import * as THREE from 'three';

// 校舎内の廊下・階段・別館を繋ぐナビゲーションノード（壁抜けせず追いかけてくる！）
function buildNavGraph() {
  const nodes = [
    // --- 1F 本館 ---
    { id: 0, pos: new THREE.Vector3(12, 0, 11) },    // 1F 東棟南（昇降口付近）
    { id: 1, pos: new THREE.Vector3(12, 0, 0) },     // 1F 東棟中（職員室前）
    { id: 2, pos: new THREE.Vector3(12, 0, -8) },    // 1F 北東角
    { id: 3, pos: new THREE.Vector3(0, 0, -8) },     // 1F 北棟中（保健室前）
    { id: 4, pos: new THREE.Vector3(-12, 0, -8) },   // 1F 北西角
    { id: 5, pos: new THREE.Vector3(-12, 0, 4) },    // 1F 西棟中
    { id: 6, pos: new THREE.Vector3(-12, 0, 12) },   // 1F 西棟南（西昇降口前）
    // --- 1F->2F 階段中継 ---
    { id: 7, pos: new THREE.Vector3(19.5, 1.0, -13) },  // 東階段1->2 下
    { id: 8, pos: new THREE.Vector3(18, 2.0, -16.5) },  // 東階段1->2 踊り場
    { id: 9, pos: new THREE.Vector3(16, 3.0, -13) },    // 東階段1->2 上
    { id: 10, pos: new THREE.Vector3(-16, 1.0, -13) },  // 西階段1->2 下
    { id: 11, pos: new THREE.Vector3(-18, 2.0, -16.5) },// 西階段1->2 踊り場
    { id: 12, pos: new THREE.Vector3(-20, 3.0, -13) },  // 西階段1->2 上
    // --- 2F 本館 ---
    { id: 13, pos: new THREE.Vector3(12, 4, 11) },   // 2F 東棟南
    { id: 14, pos: new THREE.Vector3(12, 4, 0) },    // 2F 東棟中（渡り廊下口）
    { id: 15, pos: new THREE.Vector3(12, 4, -8) },   // 2F 北東角
    { id: 16, pos: new THREE.Vector3(0, 4, -8) },    // 2F 北棟中（2-A前）
    { id: 17, pos: new THREE.Vector3(-12, 4, -8) },  // 2F 北西角
    { id: 18, pos: new THREE.Vector3(-12, 4, 4) },   // 2F 西棟中（図書室前）
    { id: 19, pos: new THREE.Vector3(-12, 4, 12) },  // 2F 西棟南
    // --- 2F 渡り廊下 & 別館2F ---
    { id: 20, pos: new THREE.Vector3(19, 4, 0) },    // 2F 渡り廊下入口
    { id: 21, pos: new THREE.Vector3(27, 4, 0) },    // 2F 渡り廊下中央
    { id: 22, pos: new THREE.Vector3(34, 4, 0) },    // 別館2F ホール
    { id: 23, pos: new THREE.Vector3(34, 4, 6) },    // 別館2F 廊下南
    { id: 24, pos: new THREE.Vector3(40, 4, 0) },    // 別館2F 音楽室入口内
    { id: 25, pos: new THREE.Vector3(41, 4, -6) },   // 別館2F 音楽室ピアノ付近
    // --- 別館階段 1F<->2F & 別館1F ---
    { id: 26, pos: new THREE.Vector3(33.5, 3.0, -5) },  // 別館階段上
    { id: 27, pos: new THREE.Vector3(35, 2.0, -8.5) },  // 別館階段踊り場
    { id: 28, pos: new THREE.Vector3(36.5, 1.0, -5) },  // 別館階段下
    { id: 29, pos: new THREE.Vector3(34, 0, 0) },       // 別館1F ホール
    { id: 30, pos: new THREE.Vector3(34, 0, 7) },       // 別館1F 裏口前
    // --- 2F->3F 階段 & 3F 本館 ---
    { id: 31, pos: new THREE.Vector3(19.5, 5.0, -13) },
    { id: 32, pos: new THREE.Vector3(18, 6.0, -16.5) },
    { id: 33, pos: new THREE.Vector3(16, 7.0, -13) },
    { id: 34, pos: new THREE.Vector3(12, 8, -8) },   // 3F 北東角
    { id: 35, pos: new THREE.Vector3(0, 8, -8) },    // 3F 北棟中
    { id: 36, pos: new THREE.Vector3(-12, 8, -8) },  // 3F 北西角
    { id: 37, pos: new THREE.Vector3(12, 8, 6) },    // 3F 東棟
    { id: 38, pos: new THREE.Vector3(-12, 8, 6) }    // 3F 西棟
  ];

  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6],
    [2, 7], [7, 8], [8, 9], [9, 15],
    [4, 10], [10, 11], [11, 12], [12, 17],
    [13, 14], [14, 15], [15, 16], [16, 17], [17, 18], [18, 19],
    [14, 20], [20, 21], [21, 22], [22, 23], [22, 24], [24, 25],
    [22, 26], [26, 27], [27, 28], [28, 29], [29, 30],
    [15, 31], [31, 32], [32, 33], [33, 34],
    [34, 35], [35, 36], [34, 37], [36, 38]
  ];

  const adj = Array.from({ length: nodes.length }, () => []);
  for (const [a, b] of edges) {
    adj[a].push(b);
    adj[b].push(a);
  }
  return { nodes, adj };
}

export class RedCoatWoman {
  constructor(scene, textures) {
    this.scene = scene;
    this.nav = buildNavGraph();
    this.active = false;
    this.state = 'idle'; // idle | patrol | chase
    this.position = new THREE.Vector3(34, 4, 6);
    this.currentPath = [];
    this.pathTimer = 0;
    this.loseSightTimer = 0;
    this.whisperTimer = 4.0;
    this.animTime = 0;
    this.speedPatrol = 2.35;
    this.speedChase = 4.25; // プレイヤー走行(5.35)よりやや遅く、歩行(3.05)より速い！

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

    // 上半身・下半身をまとめる胴体ピボット
    this.bodyPivot = new THREE.Group();
    this.bodyPivot.position.y = 0.0;
    root.add(this.bodyPivot);

    // 細長い脚
    this.leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.78, 10), darkMat);
    this.leftLeg.position.set(-0.14, 0.39, 0);
    this.bodyPivot.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.78, 10), darkMat);
    this.rightLeg.position.set(0.14, 0.39, 0);
    this.bodyPivot.add(this.rightLeg);

    // 深紅のロングコート（滑らかなドレープスカート＋ウエストベルト）
    const coatSkirt = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.46, 1.12, 16), coatMat);
    coatSkirt.position.set(0, 0.86, 0);
    coatSkirt.rotation.z = 0.05;
    this.bodyPivot.add(coatSkirt);

    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.25, 0.07, 16), hatRibbonMat);
    belt.position.set(0, 1.24, 0);
    this.bodyPivot.add(belt);

    // 上半身（背骨がわずかに曲がって前傾）
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

    // --- 首＆頭＆赤い帽子（首が真横にグキッと折れ曲がっている！） ---
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

    // 黒く乱れた長い髪（多層で立体的に垂れる）
    const backHair = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.62, 0.13), hairMat);
    backHair.position.set(0, 0.14, -0.11);
    this.headGroup.add(backHair);
    [-0.14, 0.14].forEach((hx) => {
      const sideHair = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.52, 0.17), hairMat);
      sideHair.position.set(hx, 0.12, -0.02);
      this.headGroup.add(sideHair);
    });

    // ★ 赤いツバ広帽子（滑らかな円形ブリム＆クラウン＆暗いリボン）
    const hatGroup = new THREE.Group();
    hatGroup.position.set(0, 0.45, 0.01);
    hatGroup.rotation.z = -0.14;
    hatGroup.rotation.x = 0.16;
    this.headGroup.add(hatGroup);

    const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.46, 0.04, 20), hatMat);
    hatGroup.add(hatBrim);
    const hatCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.23, 0.23, 18), hatMat);
    hatCrown.position.y = 0.12;
    hatGroup.add(hatCrown);
    const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.24, 0.055, 18), hatRibbonMat);
    hatBand.position.y = 0.04;
    hatGroup.add(hatBand);

    // --- 腕（いびつ：右腕が異常に長く、肘が逆関節ぎみに折れている） ---
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

    // 懐中電灯が当たると廊下の壁に巨大な影を落とす！
    root.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    // 暗闇で赤いコートが妖しく浮かび上がる赤オーラ光
    const aura = new THREE.PointLight(0xb80c1c, 0.85, 7.2, 1.7);
    aura.position.set(0, 1.5, 0.28);
    root.add(aura);

    return root;
  }

  activate(spawnPos) {
    this.active = true;
    this.state = 'patrol';
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

  findNearestNode(pos) {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < this.nav.nodes.length; i++) {
      const n = this.nav.nodes[i].pos;
      // 階層違いにはペナルティ
      const dy = Math.abs(n.y - pos.y) * 2.5;
      const d = Math.hypot(n.x - pos.x, n.z - pos.z) + dy;
      if (d < bestDist) {
        bestDist = d;
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

  // 簡易ラインオブサイト（同じ階で壁に遮られていないか）
  hasLineOfSight(playerPos, colliders) {
    if (Math.abs(playerPos.y - this.position.y) > 1.8) return false;
    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.8) return true;

    const steps = Math.ceil(dist / 0.65);
    const checkY = this.position.y + 1.3;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const px = this.position.x + dx * t;
      const pz = this.position.z + dz * t;
      for (const c of colliders) {
        if (c.active === false) continue;
        if (checkY < c.minY || checkY > c.maxY) continue;
        if (px >= c.minX && px <= c.maxX && pz >= c.minZ && pz <= c.maxZ) {
          return false;
        }
      }
    }
    return true;
  }

  update(dt, playerPos, playerState, colliders, callbacks) {
    if (!this.active) return 999;

    const dist3D = this.position.distanceTo(playerPos);
    const sameFloor = Math.abs(this.position.y - playerPos.y) < 1.8;

    // 1. ロッカーに隠れている場合の専用AI
    if (playerState.hiding && playerState.hidingLocker) {
      const locker = playerState.hidingLocker;

      if (playerState.seenHiding) {
        // 目の前で見られながらロッカーに隠れた！→ ロッカー正面まで走ってきてこじ開ける！
        this.state = 'chase';
        const target = locker.exitPos;
        const dToLocker = Math.hypot(target.x - this.position.x, target.z - this.position.z);
        if (dToLocker < 1.15 && sameFloor) {
          if (callbacks.onLockerBreach) callbacks.onLockerBreach();
          return dToLocker;
        }
        const dir = target.clone().sub(this.position);
        dir.y = 0;
        if (dir.length() > 0.01) {
          dir.normalize();
          this.position.addScaledVector(dir, Math.min(dToLocker, this.speedChase * dt));
          this.group.rotation.y = Math.atan2(dir.x, dir.z);
        }
        this.group.position.copy(this.position);
        this.animateBody(dt);
        return dist3D;
      }

      // 見られずに隠れている → 追跡解除してパトロール（ロッカーの前を通り過ぎていく！）
      if (this.state === 'chase') {
        this.state = 'patrol';
        this.currentPath = [];
        this.pathTimer = 0;
      }

      // 近くを通り過ぎるときの不気味な囁きセリフ
      this.whisperTimer -= dt;
      if (sameFloor && dist3D < 6.5 && this.whisperTimer <= 0) {
        this.whisperTimer = 5.5 + Math.random() * 4;
        const hideLines = [
          '「……ドコ……カクレテルノ……？」',
          '「……カチ……カチ……ドコニイルノ……」',
          '「……ナカニ、イルノ……？」'
        ];
        if (callbacks.onWhisper) {
          callbacks.onWhisper(hideLines[Math.floor(Math.random() * hideLines.length)]);
        }
      }

      this.updatePatrolMovement(dt, playerPos, true);
      this.animateBody(dt);
      return dist3D;
    }

    // 2. 通常時（廊下・部屋にいるとき）の索敵＆追跡
    let detectRange = playerState.flashlightOn ? 16.5 : 7.5;
    if (playerState.crouching) detectRange *= 0.62;
    if (playerState.running) detectRange += 4.0;

    const canSee = sameFloor && dist3D < detectRange && this.hasLineOfSight(playerPos, colliders);

    if (canSee) {
      if (this.state !== 'chase') {
        this.state = 'chase';
        if (callbacks.onSpot) callbacks.onSpot();
      }
      this.loseSightTimer = 5.5;
    } else if (this.state === 'chase') {
      this.loseSightTimer -= dt;
      if (this.loseSightTimer <= 0) {
        this.state = 'patrol';
        this.currentPath = [];
      }
    }

    // 捕獲判定！
    if (dist3D < 1.15 && sameFloor) {
      if (callbacks.onCatch) callbacks.onCatch();
      return dist3D;
    }

    // 近いときのホラー囁きセリフ
    this.whisperTimer -= dt;
    if (sameFloor && dist3D < 11.0 && this.whisperTimer <= 0) {
      this.whisperTimer = 6.5 + Math.random() * 5;
      const lines = this.state === 'chase'
        ? ['「……ミツケタ……！」', '「……ニゲナイデ……ワスレモノ……」', '「……アケテ……イッショニ、イヨウ……」']
        : ['「……ワスレモノ……ドコ……」', '「……アケテ……クラクテ、セマイヨ……」'];
      if (callbacks.onWhisper) {
        callbacks.onWhisper(lines[Math.floor(Math.random() * lines.length)]);
      }
    }

    // 移動ターゲット決定
    this.pathTimer -= dt;
    let moveTarget = null;

    if (this.state === 'chase') {
      if (canSee && dist3D < 12) {
        moveTarget = playerPos.clone();
        this.currentPath = [];
      } else if (this.pathTimer <= 0 || this.currentPath.length === 0) {
        const startN = this.findNearestNode(this.position);
        const endN = this.findNearestNode(playerPos);
        this.currentPath = this.computePath(startN, endN);
        this.pathTimer = 0.9;
      }
    } else {
      this.updatePatrolMovement(dt, playerPos, false);
      this.animateBody(dt);
      return dist3D;
    }

    if (!moveTarget && this.currentPath.length > 0) {
      moveTarget = this.currentPath[0];
      const flatDist = Math.hypot(moveTarget.x - this.position.x, moveTarget.z - this.position.z);
      if (flatDist < 0.55 && Math.abs(moveTarget.y - this.position.y) < 0.7) {
        this.currentPath.shift();
        moveTarget = this.currentPath[0] || null;
      }
    }

    if (moveTarget) {
      this.moveToward(moveTarget, this.speedChase, dt);
    }

    this.animateBody(dt);
    return dist3D;
  }

  updatePatrolMovement(dt, playerPos, playerIsHiding) {
    this.pathTimer -= dt;
    if (this.currentPath.length === 0 || this.pathTimer <= 0) {
      const startN = this.findNearestNode(this.position);
      let targetN;
      // 隠れているときはあえて別ノードへ通り抜ける経路を選び、目の前を通過する緊張感を作る
      if (!playerIsHiding && Math.random() < 0.6) {
        const pNode = this.findNearestNode(playerPos);
        const candidates = [pNode, ...this.nav.adj[pNode]];
        targetN = candidates[Math.floor(Math.random() * candidates.length)];
      } else {
        targetN = Math.floor(Math.random() * this.nav.nodes.length);
      }
      this.currentPath = this.computePath(startN, targetN);
      this.pathTimer = 5.0;
    }

    if (this.currentPath.length > 0) {
      const wp = this.currentPath[0];
      const flatDist = Math.hypot(wp.x - this.position.x, wp.z - this.position.z);
      if (flatDist < 0.55 && Math.abs(wp.y - this.position.y) < 0.7) {
        this.currentPath.shift();
      } else {
        // 隠れているロッカーのすぐ近くを通るときは不気味に少しゆっくり歩く
        const nearDist = this.position.distanceTo(playerPos);
        const spd = playerIsHiding && nearDist < 5.0 ? this.speedPatrol * 0.65 : this.speedPatrol;
        this.moveToward(wp, spd, dt);
      }
    }
  }

  moveToward(target, speed, dt) {
    const dir = target.clone().sub(this.position);
    const len = dir.length();
    if (len > 0.01) {
      dir.normalize();
      const step = Math.min(len, speed * dt);
      this.position.addScaledVector(dir, step);

      const targetAngle = Math.atan2(dir.x, dir.z);
      let diff = targetAngle - this.group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.group.rotation.y += diff * Math.min(1, dt * 8);
    }
    this.group.position.copy(this.position);
  }

  animateBody(dt) {
    const animSpeed = this.state === 'chase' ? 11.5 : 5.5;
    this.animTime += dt * animSpeed;
    const stride = Math.sin(this.animTime);

    this.leftLeg.rotation.x = stride * 0.5;
    this.rightLeg.rotation.x = -stride * 0.5;
    this.rightArm.rotation.x = -stride * 0.45 - (this.state === 'chase' ? 0.55 : 0.1);
    this.leftArm.rotation.x = stride * 0.35 - (this.state === 'chase' ? 0.35 : 0.05);

    this.bodyPivot.position.y = Math.abs(Math.sin(this.animTime)) * 0.09;
    this.torso.rotation.z = -0.1 + Math.sin(this.animTime * 0.7) * 0.08;

    const twitch = Math.sin(this.animTime * 3.7) > 0.85 ? (Math.random() - 0.5) * 0.35 : 0;
    this.headGroup.rotation.z = 0.68 + Math.sin(this.animTime * 1.2) * 0.12 + twitch;
    this.headGroup.rotation.y = Math.sin(this.animTime * 0.9) * 0.18 + twitch;
  }
}
