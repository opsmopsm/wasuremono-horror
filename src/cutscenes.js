import * as THREE from 'three';

// 3D小道具：鋭い金属コンパス
function buildCompassProp() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xe2edf5, metalness: 0.9, roughness: 0.15 });
  const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.002, 0.42, 10), mat);
  leg1.position.set(-0.025, 0, -0.18);
  leg1.rotation.x = Math.PI / 2;
  leg1.rotation.z = 0.08;
  const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.002, 0.42, 10), mat);
  leg2.position.set(0.025, 0, -0.18);
  leg2.rotation.x = Math.PI / 2;
  leg2.rotation.z = -0.08;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 10), mat);
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0, 0, 0.06);
  g.add(leg1, leg2, handle);
  return g;
}

// 3D小道具：特大木製三角定規（黒板用）
function buildLargeRulerProp() {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-0.48, -0.32);
  shape.lineTo(0.48, -0.32);
  shape.lineTo(-0.48, 0.38);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-0.34, -0.2);
  hole.lineTo(0.14, -0.2);
  hole.lineTo(-0.34, 0.14);
  hole.closePath();
  shape.holes.push(hole);
  const mesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false }),
    new THREE.MeshStandardMaterial({ color: 0xe0ae3c, roughness: 0.5, metalness: 0.05 })
  );
  // 持ち手バー
  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.04, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x5c3e1e, roughness: 0.7 })
  );
  grip.position.set(-0.14, -0.05, 0.04);
  g.add(mesh, grip);
  return g;
}

// 3D小道具：アルコールランプ
function buildLampProp() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.105, 0.17, 14),
    new THREE.MeshStandardMaterial({ color: 0x70cbff, emissive: 0x164468, transparent: true, opacity: 0.85, roughness: 0.1 })
  );
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.042, 0.05, 10),
    new THREE.MeshStandardMaterial({ color: 0xcad3db, metalness: 0.85, roughness: 0.2 })
  );
  cap.position.y = 0.11;
  const wick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.01, 0.05, 6),
    new THREE.MeshStandardMaterial({ color: 0xf6f2e4 })
  );
  wick.position.y = 0.15;
  g.add(body, cap, wick);
  return g;
}

// 3D小道具：タバコ用オイルライター（ジッポ風＋揺れる炎）
function buildLighterProp() {
  const g = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xcfd6dc, metalness: 0.9, roughness: 0.18 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.11, 0.032), metalMat);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.045, 0.032), metalMat);
  lid.position.set(-0.045, 0.072, 0);
  lid.rotation.z = 1.25; // パカッと開いた蓋
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.038, 0.022), metalMat);
  chimney.position.set(0.01, 0.072, 0);

  // 炎
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.022, 0.085, 10),
    new THREE.MeshBasicMaterial({ color: 0xffaa2b })
  );
  flame.position.set(0.01, 0.13, 0);
  const flameCore = new THREE.Mesh(
    new THREE.ConeGeometry(0.012, 0.05, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff5c0 })
  );
  flameCore.position.set(0.01, 0.12, 0);

  g.add(body, lid, chimney, flame, flameCore);
  g.userData.flame = flame;
  return g;
}

export class CutsceneDirector {
  constructor(scene, camera, flashlight, flashlightTarget, enemy, audio, ui) {
    this.scene = scene;
    this.camera = camera;
    this.flashlight = flashlight;
    this.flashlightTarget = flashlightTarget;
    this.enemy = enemy;
    this.audio = audio;
    this.ui = ui;

    this.mode = null; // null | 'locker_death' | 'madness' | 'true_release'
    this.time = 0;
    this.phaseTriggered = new Set();
    this.fxGroup = new THREE.Group();
    this.scene.add(this.fxGroup);

    // 演出用ライトは起動時に1灯だけ常駐させ、途中でnew PointLightしない（途中ロード防止！）
    this.fxLight = new THREE.PointLight(0xff8c24, 0, 14, 1.4);
    this.fxLight.position.set(0, -100, 0);
    this.scene.add(this.fxLight);

    this.locker = null;
    this.basePos = new THREE.Vector3();
    this.fwd = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.enemyOrigin = new THREE.Vector3();
    this.props = {};
    this.particles = [];
    this.fireLight = this.fxLight;
    this.onComplete = null;
  }

  isActive() {
    return this.mode !== null;
  }

  cleanup() {
    while (this.fxGroup.children.length > 0) {
      this.fxGroup.remove(this.fxGroup.children[0]);
    }
    this.props = {};
    this.particles = [];
    this.fxLight.intensity = 0;
    this.phaseTriggered.clear();
    this.camera.rotation.z = 0;
    if (this.ui.youAreDeadEl) {
      this.ui.youAreDeadEl.classList.add('hidden');
      this.ui.youAreDeadEl.style.opacity = '0';
    }
    if (this.ui.lockerSlitOverlay) {
      this.ui.lockerSlitOverlay.style.transform = '';
    }
    // 敵の回転やスケールを正常に戻す
    this.enemy.group.rotation.x = 0;
    this.enemy.group.rotation.z = 0;
    this.enemy.group.scale.set(1, 1, 1);
    this.mode = null;
  }

  triggerOnce(key, fn) {
    if (!this.phaseTriggered.has(key)) {
      this.phaseTriggered.add(key);
      fn();
    }
  }

  setupLockerStage(locker) {
    this.locker = locker;
    this.fwd.set(-Math.sin(locker.faceYaw), 0, -Math.cos(locker.faceYaw)).normalize();
    this.right.set(Math.cos(locker.faceYaw), 0, -Math.sin(locker.faceYaw)).normalize();
    this.basePos.copy(locker.insideCamPos);

    // 敵をロッカーの真正面に配置してこちらを向かせる
    this.enemyOrigin.copy(locker.pos).addScaledVector(this.fwd, 1.35);
    this.enemyOrigin.y = locker.pos.y;
    this.enemy.position.copy(this.enemyOrigin);
    this.enemy.group.position.copy(this.enemyOrigin);
    this.enemy.group.visible = true;
    this.enemy.group.rotation.set(0, Math.atan2(-this.fwd.x, -this.fwd.z), 0);
  }

  // =========================================================================
  // 1. ロッカーでバレたときの恐怖ゲームオーバー演出 → YOU ARE DEAD
  // =========================================================================
  startLockerDeath(locker, onComplete) {
    this.cleanup();
    this.mode = 'locker_death';
    this.time = 0;
    this.onComplete = onComplete;
    this.setupLockerStage(locker);

    // ロッカーの隙間オーバーレイを表示したまま開始
    this.ui.lockerSlitOverlay.classList.remove('hidden');
    locker.doorMesh.visible = false;
  }

  // =========================================================================
  // 2. 狂気エンド：リアルタイム3Dアクションムービー（コンパス→大三角定規→アルコールランプ→ライター炎上！）
  // =========================================================================
  startMadnessMovie(locker, onComplete) {
    this.cleanup();
    this.mode = 'madness';
    this.time = 0;
    this.onComplete = onComplete;
    this.setupLockerStage(locker);

    this.ui.lockerSlitOverlay.classList.remove('hidden');
    locker.doorMesh.visible = false;

    // ムービー用3D小道具を準備（初期非表示）
    this.props.compass = buildCompassProp();
    this.props.ruler = buildLargeRulerProp();
    this.props.lamp = buildLampProp();
    this.props.lighter = buildLighterProp();
    Object.values(this.props).forEach((p) => {
      p.visible = false;
      this.fxGroup.add(p);
    });
  }

  // =========================================================================
  // 3. トゥルーエンド：成仏カット演出（歪みが解け、光の粒となって昇天！）
  // =========================================================================
  startTrueReleaseMovie(anchorPos, onComplete) {
    this.cleanup();
    this.mode = 'true_release';
    this.time = 0;
    this.onComplete = onComplete;

    // 音楽準備室の中心でシオリ（赤いコートの女）を目の前に立たせる
    this.enemyOrigin.copy(anchorPos).add(new THREE.Vector3(-1.4, -1.2, 0));
    this.enemyOrigin.y = 4.0;
    this.enemy.position.copy(this.enemyOrigin);
    this.enemy.group.position.copy(this.enemyOrigin);
    this.enemy.group.visible = true;
    this.enemy.group.rotation.set(0, -Math.PI / 2, 0);

    // 温かい成仏の金色ライト（常駐ライトを再利用）＆上昇する光粒子70個
    this.fxLight.color.setHex(0xffe9a6);
    this.fxLight.intensity = 3.5;
    this.fxLight.distance = 14;
    this.fxLight.position.copy(this.enemyOrigin).add(new THREE.Vector3(0, 1.5, 0));

    const orbGeo = new THREE.SphereGeometry(0.055, 6, 6);
    for (let i = 0; i < 70; i++) {
      const m = new THREE.Mesh(
        orbGeo,
        new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xfff5c4 : 0xa8d8ff, transparent: true, opacity: 0.9 })
      );
      m.position.set(
        this.enemyOrigin.x + (Math.random() - 0.5) * 1.4,
        this.enemyOrigin.y + Math.random() * 2.0,
        this.enemyOrigin.z + (Math.random() - 0.5) * 1.4
      );
      this.fxGroup.add(m);
      this.particles.push({
        mesh: m,
        vy: 0.6 + Math.random() * 1.1,
        vx: (Math.random() - 0.5) * 0.35,
        vz: (Math.random() - 0.5) * 0.35,
        kind: 'soul'
      });
    }
  }

  // 飛沫／炎パーティクル生成ヘルパー
  spawnSplashParticles(origin) {
    const geo = new THREE.SphereGeometry(0.04, 6, 6);
    for (let i = 0; i < 48; i++) {
      const m = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0xd9f2ff : 0x5cc4ff, transparent: true, opacity: 0.9 })
      );
      m.position.copy(origin);
      this.fxGroup.add(m);
      this.particles.push({
        mesh: m,
        vx: (Math.random() - 0.5) * 3.4,
        vy: 0.8 + Math.random() * 2.2,
        vz: (Math.random() - 0.5) * 3.4,
        gravity: 6.5,
        kind: 'splash'
      });
    }
  }

  spawnFireParticles(origin) {
    this.fxLight.color.setHex(0xff6214);
    this.fxLight.intensity = 7.5;
    this.fxLight.distance = 16;
    this.fxLight.position.copy(origin).add(new THREE.Vector3(0, 1.4, 0));

    const geo = new THREE.SphereGeometry(0.16, 7, 7);
    const colors = [0xff2a00, 0xff6e0a, 0xffba1a, 0xfff08a, 0x261d1c];
    for (let i = 0; i < 75; i++) {
      const isSmoke = i >= 60;
      const col = isSmoke ? 0x1e1918 : colors[i % 4];
      const m = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: isSmoke ? 0.55 : 0.92 })
      );
      const s = isSmoke ? 1.3 + Math.random() * 0.9 : 0.65 + Math.random() * 0.95;
      m.scale.setScalar(s);
      m.position.set(
        origin.x + (Math.random() - 0.5) * 0.75,
        origin.y + Math.random() * 1.85,
        origin.z + (Math.random() - 0.5) * 0.75
      );
      this.fxGroup.add(m);
      this.particles.push({
        mesh: m,
        baseOrigin: origin,
        vx: (Math.random() - 0.5) * 0.55,
        vy: isSmoke ? 1.4 + Math.random() * 1.0 : 1.8 + Math.random() * 2.0,
        vz: (Math.random() - 0.5) * 0.55,
        isSmoke,
        kind: 'fire'
      });
    }
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      if (p.kind === 'splash') {
        p.vy -= p.gravity * dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.mesh.material.opacity = Math.max(0, p.mesh.material.opacity - dt * 0.9);
      } else if (p.kind === 'fire') {
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        // 上まで昇ったら再び赤い女の足元〜胴体から湧き上がるループ炎！
        const maxH = p.isSmoke ? 3.8 : 2.5;
        if (p.mesh.position.y > this.enemy.group.position.y + maxH) {
          p.mesh.position.set(
            this.enemy.group.position.x + (Math.random() - 0.5) * 0.7,
            this.enemy.group.position.y + 0.2 + Math.random() * 0.7,
            this.enemy.group.position.z + (Math.random() - 0.5) * 0.7
          );
        }
      } else if (p.kind === 'soul') {
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.mesh.material.opacity = Math.max(0, p.mesh.material.opacity - dt * 0.22);
      }
    }
  }

  update(dt) {
    if (!this.mode) return;
    this.time += dt;
    this.updateParticles(dt);

    if (this.mode === 'locker_death') {
      this.updateLockerDeath(dt);
    } else if (this.mode === 'madness') {
      this.updateMadnessMovie(dt);
    } else if (this.mode === 'true_release') {
      this.updateTrueRelease(dt);
    }
  }

  // =========================================================================
  // 更新：ロッカーバレ恐怖演出 → YOU ARE DEAD
  // =========================================================================
  updateLockerDeath(dt) {
    const t = this.time;
    const lookPoint = this.enemy.group.position.clone().add(new THREE.Vector3(0, 1.68, 0));

    // Phase 1 (0.0〜1.7s): 隙間から赤い女がヌッと覗き込む！
    if (t < 1.7) {
      this.triggerOnce('ld_peek', () => {
        this.audio.playChaseStinger();
        this.ui.showDialogue('赤いコートの女', '「……ミィツケタ……ソコニ、イルノ、ワカッテルヨ……」', 2.2, true);
      });
      const p = Math.min(1, t / 1.2);
      // 1.35m -> 0.58m まで隙間真正面へ顔を寄せてくる！
      const dist = 1.35 - p * 0.77;
      this.enemy.group.position.copy(this.locker.pos).addScaledVector(this.fwd, dist);
      this.enemy.group.position.y = this.locker.pos.y - 0.14; // 覗き込むため少し屈む
      this.enemy.headGroup.rotation.z = 0.65 + Math.sin(t * 9) * 0.14;

      this.camera.position.copy(this.basePos);
      this.camera.lookAt(lookPoint);
      this.flashlight.intensity = 14.0;
      this.flashlight.position.copy(this.camera.position);
      this.flashlightTarget.position.copy(lookPoint);
      return;
    }

    // Phase 2 (1.7〜3.3s): ガタン！ガタン！ガタン！と激しく扉を揺らす！
    if (t < 3.3) {
      this.triggerOnce('ld_bang1', () => {
        this.audio.playLockerBang();
        this.ui.showDialogue('美咲', '「いやっ……開かないで……！」', 1.6, false);
      });
      if (t > 2.2) this.triggerOnce('ld_bang2', () => this.audio.playLockerBang());
      if (t > 2.75) this.triggerOnce('ld_bang3', () => this.audio.playLockerBang());

      const shake = Math.sin(t * 52) * 0.06;
      const shakeY = Math.cos(t * 44) * 0.05;
      this.camera.position.copy(this.basePos).addScaledVector(this.right, shake);
      this.camera.position.y += shakeY;
      this.camera.lookAt(lookPoint);
      this.ui.lockerSlitOverlay.style.transform = `translate(${shake * 280}px, ${shakeY * 220}px)`;

      // 赤い女が両腕で扉をドンドン叩く！
      this.enemy.rightArm.rotation.x = -1.2 + Math.sin(t * 22) * 0.5;
      this.enemy.leftArm.rotation.x = -1.2 - Math.sin(t * 22) * 0.5;
      return;
    }

    // Phase 3 (3.3〜4.2s): 扉がガバァッと開く → 襲いかかり！
    if (t < 4.2) {
      this.triggerOnce('ld_open', () => {
        this.ui.lockerSlitOverlay.classList.add('hidden');
        this.ui.lockerSlitOverlay.style.transform = '';
        this.audio.playLockerToggle(false);
        this.audio.playJumpscare();
        this.ui.triggerFlash('rgba(200, 0, 15, 0.7)', 300);
        this.ui.showDialogue('赤いコートの女', '「……イッショニ、イヨウネェェェッ！！」', 1.5, true);
      });
      const p = (t - 3.3) / 0.9;
      this.camera.position.copy(this.basePos).addScaledVector(this.fwd, p * 0.45);
      this.camera.position.x += (Math.random() - 0.5) * 0.12;
      this.camera.position.y += (Math.random() - 0.5) * 0.12;
      this.enemy.group.position.copy(this.locker.pos).addScaledVector(this.fwd, 0.68 - p * 0.12);
      this.enemy.rightArm.rotation.x = -2.1;
      this.enemy.leftArm.rotation.x = -2.1;
      this.camera.lookAt(this.enemy.group.position.clone().add(new THREE.Vector3(0, 1.72, 0)));
      return;
    }

    // Phase 4 (4.2〜6.3s): 床に倒されて画面が真っ赤に → YOU ARE DEAD！！
    if (t < 6.3) {
      this.triggerOnce('ld_dead', () => {
        this.audio.playYouAreDead();
        this.ui.youAreDeadEl.classList.remove('hidden');
      });
      const p = Math.min(1, (t - 4.2) / 0.65);
      const fallPos = this.locker.exitPos.clone();
      fallPos.y = this.locker.pos.y + 1.45 - p * 1.18; // 床へドスンと倒れる
      this.camera.position.copy(fallPos);
      this.camera.lookAt(this.enemy.group.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
      this.camera.rotation.z = p * 1.28; // 横倒し！
      this.ui.youAreDeadEl.style.opacity = Math.min(1, (t - 4.2) / 1.1).toFixed(2);
      return;
    }

    const cb = this.onComplete;
    this.cleanup();
    if (cb) cb();
  }

  // =========================================================================
  // 更新：狂気エンド リアルタイム3Dアクションムービー
  // =========================================================================
  updateMadnessMovie(dt) {
    const t = this.time;
    const enemyFace = this.enemy.group.position.clone().add(new THREE.Vector3(0, 1.68, 0));

    // Cut 1 (0.0〜1.8s): 隙間から赤い女が覗き込み、ガタンガタン！
    if (t < 1.8) {
      this.triggerOnce('m_c1', () => {
        this.audio.playLockerBang();
        this.ui.showDialogue('赤いコートの女', '「……ミィツケタ……！」', 1.4, true);
      });
      if (t > 0.9) {
        this.triggerOnce('m_c1b', () => {
          this.audio.playLockerBang();
          this.ui.showDialogue('美咲', '「……もう、逃げるのはやめた。」', 1.5, false);
        });
      }
      const p = Math.min(1, t / 1.1);
      this.enemy.group.position.copy(this.locker.pos).addScaledVector(this.fwd, 1.25 - p * 0.66);
      this.enemy.group.position.y = this.locker.pos.y - 0.14;
      this.camera.position.copy(this.basePos);
      this.camera.lookAt(enemyFace);
      this.flashlight.intensity = 14.0;
      this.flashlight.position.copy(this.camera.position);
      this.flashlightTarget.position.copy(enemyFace);
      return;
    }

    // Cut 2 (1.8〜3.5s): 隙間からコンパスで目をグサッと刺す！！
    if (t < 3.5) {
      const p = (t - 1.8) / 1.7;
      this.triggerOnce('m_c2', () => {
        this.props.compass.visible = true;
        this.audio.playCompassStab();
        this.ui.triggerFlash('rgba(220, 15, 25, 0.72)', 260);
        this.ui.showDialogue('赤いコートの女', '「ギィヤァァァァッ！！ メガッ……！！」', 1.6, true);
      });

      // コンパスがカメラ手前から隙間を突き抜けて顔へ一直線！
      const thrust = p < 0.25 ? p / 0.25 : 1 - (p - 0.25) * 0.6;
      const cPos = this.basePos.clone()
        .addScaledVector(this.fwd, 0.18 + thrust * 0.48)
        .addScaledVector(this.right, 0.08)
        .add(new THREE.Vector3(0, -0.05, 0));
      this.props.compass.position.copy(cPos);
      this.props.compass.lookAt(enemyFace);

      // 刺された赤い女がのけぞって後退！
      const recoil = Math.min(1, p * 1.4);
      this.enemy.group.position.copy(this.locker.pos).addScaledVector(this.fwd, 0.6 + recoil * 1.7);
      this.enemy.group.position.y = this.locker.pos.y;
      this.enemy.torso.rotation.x = -0.35 * Math.sin(Math.min(1, p * 2) * Math.PI);
      this.enemy.rightArm.rotation.x = -1.6;
      this.camera.position.copy(this.basePos);
      this.camera.position.x += (Math.random() - 0.5) * (p < 0.3 ? 0.08 : 0.01);
      this.camera.lookAt(enemyFace);
      return;
    }

    // Cut 3 (3.5〜5.5s): ロッカーから外へ飛び出し、殴りかかってきた赤い女を特大三角定規でガード！！
    if (t < 5.5) {
      const p = (t - 3.5) / 2.0;
      this.triggerOnce('m_c3', () => {
        this.props.compass.visible = false;
        this.props.ruler.visible = true;
        this.ui.lockerSlitOverlay.classList.add('hidden');
        this.audio.playLockerToggle(false);
        this.ui.showDialogue('美咲', '「その攻撃……教卓の下の大きい三角定規で止めてやるッ！！」', 2.0, false);
      });

      // カメラがロッカーから外へステップアウト
      const stepOut = Math.min(1, p * 2.5);
      const standPos = this.basePos.clone().addScaledVector(this.fwd, stepOut * 0.72);
      this.camera.position.copy(standPos);

      // 赤い女が怒って突進し、長い右腕を振り下ろす！
      const rush = p < 0.52 ? p / 0.52 : 1 - (p - 0.52) * 0.85;
      this.enemy.group.position.copy(this.locker.pos).addScaledVector(this.fwd, 2.35 - rush * 0.95);
      this.enemy.rightArm.rotation.x = p < 0.45 ? -2.6 : -0.9;

      if (p >= 0.48) {
        this.triggerOnce('m_c3_guard', () => {
          this.audio.playRulerGuard();
          this.ui.triggerFlash('rgba(255, 240, 180, 0.75)', 220);
        });
      }

      // 画面前面に3D特大三角定規をガシッと構える！
      const guardShake = (p >= 0.48 && p < 0.75) ? (Math.random() - 0.5) * 0.07 : 0;
      const rPos = standPos.clone()
        .addScaledVector(this.fwd, 0.62)
        .addScaledVector(this.right, -0.05 + guardShake)
        .add(new THREE.Vector3(0, -0.08 + guardShake, 0));
      this.props.ruler.position.copy(rPos);
      this.props.ruler.lookAt(standPos.clone().addScaledVector(this.fwd, 4));
      this.props.ruler.rotateZ(0.25);

      this.camera.position.x += guardShake;
      this.camera.lookAt(this.enemy.group.position.clone().add(new THREE.Vector3(0, 1.45, 0)));
      this.flashlight.position.copy(this.camera.position);
      this.flashlightTarget.position.copy(this.enemy.group.position.clone().add(new THREE.Vector3(0, 1.4, 0)));
      return;
    }

    // Cut 4 (5.5〜7.4s): アルコールランプをぶっかける！！
    if (t < 7.4) {
      const p = (t - 5.5) / 1.9;
      const standPos = this.basePos.clone().addScaledVector(this.fwd, 0.72);
      this.camera.position.copy(standPos);
      this.enemy.group.position.copy(this.locker.pos).addScaledVector(this.fwd, 2.45);
      this.enemy.rightArm.rotation.x = -0.3;

      this.triggerOnce('m_c4', () => {
        this.props.ruler.visible = false;
        this.props.lamp.visible = true;
        this.ui.showDialogue('美咲', '「理科室のアルコールランプ、たっぷり浴びなッ！！」', 1.9, false);
      });

      const impactPos = this.enemy.group.position.clone().add(new THREE.Vector3(0, 1.38, 0));
      if (p < 0.48) {
        // 放物線を描いて赤い女の胸元へ飛んでいく！
        const fp = p / 0.48;
        const startLamp = standPos.clone().addScaledVector(this.fwd, 0.35).addScaledVector(this.right, 0.25).add(new THREE.Vector3(0, -0.1, 0));
        this.props.lamp.position.lerpVectors(startLamp, impactPos, fp);
        this.props.lamp.position.y += Math.sin(fp * Math.PI) * 0.45;
        this.props.lamp.rotation.x += dt * 12;
      } else {
        this.triggerOnce('m_c4_splash', () => {
          this.props.lamp.visible = false;
          this.audio.playGlassSplash();
          this.ui.triggerFlash('rgba(150, 225, 255, 0.55)', 220);
          this.spawnSplashParticles(impactPos);
        });
      }
      this.camera.lookAt(impactPos);
      return;
    }

    // Cut 5 (7.4〜9.4s): ポーチのタバコ用ライターを着火してポイッと投げる！
    if (t < 9.4) {
      const p = (t - 7.4) / 2.0;
      const standPos = this.basePos.clone().addScaledVector(this.fwd, 0.72);
      this.camera.position.copy(standPos);
      this.enemy.group.position.copy(this.locker.pos).addScaledVector(this.fwd, 2.45);

      this.triggerOnce('m_c5', () => {
        this.props.lighter.visible = true;
        this.audio.playLighterClick();
        this.ui.showDialogue('美咲', '「ポーチのタバコ用ライター……役に立ったね。バイバイ。」', 2.0, false);
      });

      const targetPos = this.enemy.group.position.clone().add(new THREE.Vector3(0, 1.25, 0));
      const holdPos = standPos.clone()
        .addScaledVector(this.fwd, 0.42)
        .addScaledVector(this.right, 0.14)
        .add(new THREE.Vector3(0, -0.12, 0));

      // ライターの炎をゆらゆら揺らす（常駐fxLightで手元を照らす）
      if (this.props.lighter.userData.flame) {
        this.props.lighter.userData.flame.scale.y = 0.85 + Math.sin(t * 32) * 0.25;
      }
      this.fxLight.color.setHex(0xff9c33);
      this.fxLight.intensity = 2.6 + Math.sin(t * 28) * 0.5;
      this.fxLight.distance = 6.5;
      this.fxLight.position.copy(this.props.lighter.position).add(new THREE.Vector3(0, 0.14, 0));

      if (p < 0.62) {
        this.props.lighter.position.copy(holdPos);
        this.props.lighter.lookAt(targetPos);
      } else {
        // 赤い女へポイッと放り投げる！
        const tp = (p - 0.62) / 0.38;
        this.props.lighter.position.lerpVectors(holdPos, targetPos, tp);
        this.props.lighter.position.y += Math.sin(tp * Math.PI) * 0.38;
        this.props.lighter.rotation.x += dt * 16;
      }
      this.camera.lookAt(targetPos);
      return;
    }

    // Cut 6 (9.4〜13.6s): ボォォォォッ！！燃え上がる赤いコートの女！！
    if (t < 13.6) {
      const p = (t - 9.4) / 4.2;
      this.triggerOnce('m_c6_fire', () => {
        this.props.lighter.visible = false;
        this.audio.playFireIgnite();
        this.ui.triggerFlash('rgba(255, 130, 20, 0.9)', 550);
        this.spawnFireParticles(this.enemy.group.position.clone());
        this.ui.showDialogue('赤いコートの女', '「アッ……アツイィィィッ！！ ヤメテェェェッ！！」', 2.4, true);
      });
      if (p > 0.58) {
        this.triggerOnce('m_c6_endline', () => {
          this.ui.showDialogue('美咲', '「……ふふ。これで、もう追いかけられないね。」', 2.4, false);
        });
      }

      // 爆炎ライトを激しく揺らす
      if (this.fireLight) {
        this.fireLight.intensity = 6.0 + Math.sin(t * 28) * 2.5 + Math.random() * 1.8;
        this.fireLight.position.copy(this.enemy.group.position).add(new THREE.Vector3(0, 1.3, 0));
      }

      // もがき苦しみながら徐々に崩れ落ちる赤い女！
      this.enemy.rightArm.rotation.x = -1.6 + Math.sin(t * 18) * 0.9;
      this.enemy.leftArm.rotation.x = -1.6 - Math.sin(t * 18) * 0.9;
      this.enemy.headGroup.rotation.z = 0.68 + Math.sin(t * 24) * 0.45;
      if (p > 0.35) {
        const collapse = Math.min(1, (p - 0.35) / 0.55);
        this.enemy.group.rotation.x = collapse * 1.15;
        this.enemy.group.position.y = this.locker.pos.y - collapse * 0.45;
      }

      // カメラが少し後ろへ引きながら燃え上がる女を見下ろす映画的ショット
      const camPos = this.basePos.clone().addScaledVector(this.fwd, 0.72 - p * 0.35);
      this.camera.position.copy(camPos);
      this.camera.lookAt(this.enemy.group.position.clone().add(new THREE.Vector3(0, 1.25 - p * 0.35, 0)));
      return;
    }

    const cb = this.onComplete;
    this.cleanup();
    if (cb) cb();
  }

  // =========================================================================
  // 更新：トゥルーエンド 成仏3Dカット演出
  // =========================================================================
  updateTrueRelease(dt) {
    const t = this.time;
    const p = Math.min(1, t / 4.2);

    // 歪んでいた首がすっと真っ直ぐ戻り、ゆっくりと光の粒に包まれて昇天！
    this.enemy.headGroup.rotation.z = 0.68 * (1 - Math.min(1, p * 2.2));
    this.enemy.torso.rotation.z = -0.09 * (1 - Math.min(1, p * 2.2));
    this.enemy.group.position.y = this.enemyOrigin.y + p * 1.2;
    const scale = Math.max(0.02, 1 - Math.max(0, (p - 0.45) / 0.55));
    this.enemy.group.scale.setScalar(scale);

    if (this.fireLight) {
      this.fireLight.intensity = 3.5 * (1 - p * 0.7);
      this.fireLight.position.y = this.enemy.group.position.y + 1.4;
    }

    const camPos = this.enemyOrigin.clone().add(new THREE.Vector3(-2.4, 1.55, 0));
    this.camera.position.copy(camPos);
    this.camera.lookAt(this.enemy.group.position.clone().add(new THREE.Vector3(0, 1.4, 0)));

    if (t >= 4.2) {
      this.enemy.deactivate();
      const cb = this.onComplete;
      this.cleanup();
      if (cb) cb();
    }
  }
}
