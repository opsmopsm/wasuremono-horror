import * as THREE from 'three';

function buildHumanNPC(uniformColor, hatColor = null, hasFlashlight = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: uniformColor, roughness: 0.78, metalness: 0.05 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e222b, roughness: 0.85 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xdab698, roughness: 0.65 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x22201e, roughness: 0.88 });

  // 脚（ピボットを腰の高さにして歩行アニメーション可能に）
  const lLegPivot = new THREE.Group();
  lLegPivot.position.set(-0.12, 0.78, 0);
  const lLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.78, 10), pantsMat);
  lLeg.position.y = -0.39;
  lLegPivot.add(lLeg);
  g.add(lLegPivot);

  const rLegPivot = new THREE.Group();
  rLegPivot.position.set(0.12, 0.78, 0);
  const rLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.78, 10), pantsMat);
  rLeg.position.y = -0.39;
  rLegPivot.add(rLeg);
  g.add(rLegPivot);

  // 胴体
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.65, 0.26), bodyMat);
  torso.position.y = 1.1;
  g.add(torso);

  // 腕（肩ピボット）
  const lArmPivot = new THREE.Group();
  lArmPivot.position.set(-0.31, 1.36, 0);
  const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.058, 0.56, 10), bodyMat);
  lArm.position.y = -0.26;
  lArmPivot.add(lArm);
  g.add(lArmPivot);

  const rArmPivot = new THREE.Group();
  rArmPivot.position.set(0.31, 1.36, 0);
  const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.058, 0.56, 10), bodyMat);
  rArm.position.y = -0.26;
  rArmPivot.add(rArm);
  if (hasFlashlight) {
    rArmPivot.rotation.x = -Math.PI / 2.6;
    const torch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 0.22, 10),
      new THREE.MeshStandardMaterial({ color: 0x333840, roughness: 0.35, metalness: 0.75 })
    );
    torch.rotation.x = Math.PI / 2;
    torch.position.set(0, -0.54, 0.1);
    rArmPivot.add(torch);

    const lens = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff5cc })
    );
    lens.position.set(0, -0.54, 0.22);
    rArmPivot.add(lens);
  }
  g.add(rArmPivot);

  // 頭（滑らかな球＋髪）
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 14, 14), skinMat);
  head.position.y = 1.62;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.162, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
  hair.position.set(0, 1.64, -0.01);
  g.add(hair);

  // 警備員の制帽
  if (hatColor !== null) {
    const hatMat = new THREE.MeshStandardMaterial({ color: hatColor, roughness: 0.7 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.16, 0.11, 14), hatMat);
    cap.position.set(0, 1.80, 0);
    g.add(cap);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 0.14), new THREE.MeshStandardMaterial({ color: 0x111216, roughness: 0.3, metalness: 0.2 }));
    visor.position.set(0, 1.75, 0.14);
    g.add(visor);
  }

  g.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return { group: g, lLegPivot, rLegPivot, lArmPivot, rArmPivot, hasFlashlight };
}

export class SchoolNPCs {
  constructor(scene) {
    this.scene = scene;
    this.vanished = false;

    // 1. 見回りの警備員さん（1F 東棟廊下を実際に歩いてパトロール！）
    const guardBuilt = buildHumanNPC(0x263b5e, 0x1b2b45, true);
    this.guard = {
      ...guardBuilt,
      id: 'npc_guard',
      speaker: '警備員',
      pos: new THREE.Vector3(12.0, 0, 6.2),
      patrolPoints: [
        new THREE.Vector3(12.0, 0, 7.2),
        new THREE.Vector3(12.0, 0, -7.2),
        new THREE.Vector3(2.0, 0, -8.0),
        new THREE.Vector3(12.0, 0, -7.2)
      ],
      patrolIdx: 0,
      speed: 1.35,
      animTime: 0,
      scared: false,
      radius: 4.4,
      talkIdx: 0,
      dialogues: [
        '「なんだ吹奏楽部の子か！びっくりさせるなよ…忘れ物なら早く取って帰りなさい」',
        '「別館の音楽室？あっちはもう電気落としたぞ。2階の渡り廊下から行けるけど気をつけな」',
        '「……そういえばさっき、音楽室の方から赤い帽子みたいな影が見えた気がしたが…見間違いだよな」'
      ]
    };
    this.guard.group.position.copy(this.guard.pos);
    scene.add(this.guard.group);

    // 2. 残業中の吹奏楽部・顧問の先生（1F 職員室をゆっくり歩きながら整理中）
    const teacherBuilt = buildHumanNPC(0x3f424a, null, false);
    this.teacher = {
      ...teacherBuilt,
      id: 'npc_teacher',
      speaker: '吹奏楽部 顧問',
      pos: new THREE.Vector3(16.2, 0, -1.6),
      patrolPoints: [
        new THREE.Vector3(15.6, 0, -1.8),
        new THREE.Vector3(15.6, 0, 2.2),
        new THREE.Vector3(18.5, 0, 2.2),
        new THREE.Vector3(18.5, 0, -1.8)
      ],
      patrolIdx: 0,
      speed: 0.95,
      animTime: 0,
      scared: false,
      radius: 4.0,
      talkIdx: 0,
      dialogues: [
        '「うわっ、まだいたのか！？……部活の片付けご苦労さん。忘れ物は2年A組か？」',
        '「もし別館2Fの音楽室に忘れたなら、東棟2Fの渡り廊下から行けるぞ。終わったらすぐ帰れよ」',
        '「あ、音楽準備室の奥にある古い楽器収納庫には絶対に近づくなよ。板で封鎖してあるからな」'
      ]
    };
    this.teacher.group.position.copy(this.teacher.pos);
    scene.add(this.teacher.group);
  }

  getList() {
    if (this.vanished) return [];
    return [this.guard, this.teacher];
  }

  talkTo(npc) {
    const line = npc.dialogues[npc.talkIdx % npc.dialogues.length];
    npc.talkIdx++;
    return { speaker: npc.speaker, text: line };
  }

  vanishAll() {
    if (this.vanished) return;
    this.vanished = true;
    this.guard.group.visible = false;
    this.teacher.group.visible = false;
  }

  reset() {
    this.vanished = false;
    this.guard.scared = false;
    this.guard.talkIdx = 0;
    this.guard.patrolIdx = 0;
    this.guard.pos.set(12.0, 0, 6.2);
    this.guard.group.position.copy(this.guard.pos);
    this.guard.group.visible = true;

    this.teacher.scared = false;
    this.teacher.talkIdx = 0;
    this.teacher.patrolIdx = 0;
    this.teacher.pos.set(16.2, 0, -1.6);
    this.teacher.group.position.copy(this.teacher.pos);
    this.teacher.group.visible = true;
  }

  updateOneNPC(npc, dt, playerPos, onScare) {
    const sameFloor = Math.abs(playerPos.y - npc.pos.y) < 1.5;
    const dist = npc.pos.distanceTo(playerPos);

    // 近づいたときの初回フェイクびっくり
    if (!npc.scared && sameFloor && dist < npc.radius) {
      npc.scared = true;
      const angle = Math.atan2(playerPos.x - npc.pos.x, playerPos.z - npc.pos.z);
      npc.group.rotation.y = angle;
      if (onScare) onScare();
      return;
    }

    // プレイヤーがすぐ近く(3.2m以内)にいるときは立ち止まってこちらを見る
    if (sameFloor && dist < 3.2) {
      const targetAngle = Math.atan2(playerPos.x - npc.pos.x, playerPos.z - npc.pos.z);
      let diff = targetAngle - npc.group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      npc.group.rotation.y += diff * Math.min(1, dt * 6);
      npc.lLegPivot.rotation.x *= 0.85;
      npc.rLegPivot.rotation.x *= 0.85;
      return;
    }

    // 見回りパトロール移動＆歩行アニメーション
    const target = npc.patrolPoints[npc.patrolIdx];
    const dx = target.x - npc.pos.x;
    const dz = target.z - npc.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.3) {
      npc.patrolIdx = (npc.patrolIdx + 1) % npc.patrolPoints.length;
    } else {
      const step = Math.min(d, npc.speed * dt);
      npc.pos.x += (dx / d) * step;
      npc.pos.z += (dz / d) * step;
      npc.group.position.copy(npc.pos);

      const moveAngle = Math.atan2(dx, dz);
      let diff = moveAngle - npc.group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      npc.group.rotation.y += diff * Math.min(1, dt * 5);

      npc.animTime += dt * 5.2;
      const swing = Math.sin(npc.animTime) * 0.42;
      npc.lLegPivot.rotation.x = swing;
      npc.rLegPivot.rotation.x = -swing;
      npc.lArmPivot.rotation.x = -swing * 0.6;
      if (!npc.hasFlashlight) {
        npc.rArmPivot.rotation.x = swing * 0.6;
      }
    }
  }

  update(dt, playerPos, callbacks) {
    if (this.vanished) return;
    this.updateOneNPC(this.guard, dt, playerPos, callbacks.onGuardScare);
    this.updateOneNPC(this.teacher, dt, playerPos, callbacks.onTeacherScare);
  }
}
