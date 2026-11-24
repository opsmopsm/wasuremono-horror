export class HorrorAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.ambientGain = null;
    this.started = false;
    this.metronomeTimer = 0;
    this.pianoTimer = 14;
  }

  init() {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.65;
    this.master.connect(this.ctx.destination);

    this.startAmbient();
    this.started = true;
  }

  startAmbient() {
    if (!this.ctx) return;
    // 夜の校舎の低い環境ドローン＋微弱な蛍光灯ハム
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.08;
    this.ambientGain.connect(this.master);

    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 52;

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = 100.5;
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.15;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 180;

    osc1.connect(filter);
    osc2.connect(g2);
    g2.connect(filter);
    filter.connect(this.ambientGain);

    osc1.start();
    osc2.start();
  }

  playFootstep(running = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dur = 0.07;
    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.28));
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = running ? 320 + Math.random() * 100 : 220 + Math.random() * 70;
    filter.Q.value = 1.4;

    const gain = this.ctx.createGain();
    gain.gain.value = running ? 0.34 : 0.18;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(now);
  }

  playFlashlightClick() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.03);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  playDoorSlide() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dur = 0.32;
    const bufSize = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      const env = Math.sin((i / bufSize) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env * 0.6;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(260, now);
    filter.frequency.linearRampToValueAtTime(420, now + dur);
    filter.Q.value = 3.0;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.35;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(now);
  }

  playPickup() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, now + idx * 0.09);
      gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.28);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.3);
    });
  }

  // 先生・警備員のフェイクびっくり音
  playFakeScare() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.25);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;

    gain.gain.setValueAtTime(0.38, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  // 赤いコートの女に発見されたときの鋭い不協和音
  playChaseStinger() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs = [110, 155.56, 311.13, 622.25, 659.25];
    freqs.forEach((f) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.linearRampToValueAtTime(f * 0.96, now + 0.9);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + 1.05);
    });
  }

  // 金属ロッカーの開閉音（ギィッ…ガチャン！）
  playLockerToggle(entering = true) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 金属のきしみ音
    const creak = this.ctx.createOscillator();
    const creakGain = this.ctx.createGain();
    creak.type = 'sawtooth';
    creak.frequency.setValueAtTime(entering ? 420 : 320, now);
    creak.frequency.exponentialRampToValueAtTime(entering ? 240 : 510, now + 0.16);
    creakGain.gain.setValueAtTime(0.08, now);
    creakGain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 650;
    filter.Q.value = 4.0;

    creak.connect(filter);
    filter.connect(creakGain);
    creakGain.connect(this.master);
    creak.start(now);
    creak.stop(now + 0.18);

    // 扉が閉まる/開く「ガチャン！」の金属打音
    const clangDelay = entering ? 0.14 : 0.04;
    const dur = 0.12;
    const bufSize = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.25));
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 880;
    bp.Q.value = 2.2;
    const g = this.ctx.createGain();
    g.gain.value = 0.42;
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(now + clangDelay);
  }

  // ロッカー内で敵が近いときの心拍音（ドクン…）
  playHeartbeat(intensity = 0.7) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [0, 0.17].forEach((offset, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(idx === 0 ? 64 : 54, now + offset);
      osc.frequency.exponentialRampToValueAtTime(28, now + offset + 0.13);
      gain.gain.setValueAtTime((idx === 0 ? 0.36 : 0.24) * intensity, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.15);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now + offset);
      osc.stop(now + offset + 0.16);
    });
  }

  // 遠くから響く不気味なピアノ単音
  playDistantPiano() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [261.63, 277.18, 293.66, 311.13, 233.08, 220.0];
    const freq = notes[Math.floor(Math.random() * notes.length)];
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc2.type = 'sine';
    osc.frequency.value = freq;
    osc2.frequency.value = freq * 2.008; // わずかに狂った調律

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 2.4);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc2.start(now);
    osc.stop(now + 2.5);
    osc2.stop(now + 2.5);
  }

  // 放送室のカセットテープ再生（ザーッというノイズ＋箱を内側から叩く音）
  playTapePlayback() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dur = 2.2;
    const bufSize = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.25;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 1.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.01, now);
    g.gain.linearRampToValueAtTime(0.24, now + 0.15);
    g.gain.setValueAtTime(0.22, now + dur - 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(now);

    // 内側から木箱を叩く「ドン、ドン、ドン！」音
    [0.35, 0.72, 1.15, 1.48].forEach((offset) => {
      const osc = this.ctx.createOscillator();
      const kg = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(118, now + offset);
      osc.frequency.exponentialRampToValueAtTime(42, now + offset + 0.14);
      kg.gain.setValueAtTime(0.38, now + offset);
      kg.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.16);
      osc.connect(kg);
      kg.connect(this.master);
      osc.start(now + offset);
      osc.stop(now + offset + 0.17);
    });
  }

  // 理科室・美術室のフェイク物音（ガタンッ！）
  playThudScare() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.22);
    g.gain.setValueAtTime(0.45, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  // 封鎖された楽器収納庫を開放したときの音（鍵＋板が外れる＋切ないピアノ和音）
  playTrueRelease() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // 金属錠前ガチャッ
    this.playLockerToggle(false);

    // 温かく切ないピアノのアルペジオ和音（Cmaj7 -> Fmaj7風）
    const chord = [261.63, 329.63, 392.0, 493.88, 523.25, 659.25];
    chord.forEach((freq, i) => {
      const t = now + 0.28 + i * 0.14;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.14, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 3.2);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 3.3);
    });
  }

  // 関節ボキボキ＋不気味な低音（隠しバッドエンド用）
  playBoneCrack() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [0, 0.12, 0.28].forEach((offset) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(750 - offset * 900, now + offset);
      osc.frequency.exponentialRampToValueAtTime(90, now + offset + 0.06);
      g.gain.setValueAtTime(0.32, now + offset);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.07);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now + offset);
      osc.stop(now + offset + 0.08);
    });
  }

  // どうぶつの森／スプラトゥーン風のキャラ別「喋り声」ブリップ音！
  playVoiceBlip(speaker = '') {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // キャラごとの基本周波数・波形・フォルマント風フィルタ設定
    let baseFreq = 460;
    let wave = 'triangle';
    let filterFreq = 1600;
    let dur = 0.055;
    let vol = 0.14;
    let pitchJitter = 120;

    if (speaker.includes('警備員')) {
      baseFreq = 165;
      wave = 'sawtooth';
      filterFreq = 680;
      dur = 0.065;
      vol = 0.13;
      pitchJitter = 45;
    } else if (speaker.includes('顧問') || speaker.includes('先生')) {
      baseFreq = 240;
      wave = 'triangle';
      filterFreq = 920;
      dur = 0.06;
      vol = 0.14;
      pitchJitter = 60;
    } else if (speaker.includes('赤いコート') || speaker.includes('カセット')) {
      baseFreq = 125;
      wave = 'sawtooth';
      filterFreq = 520;
      dur = 0.085;
      vol = 0.15;
      pitchJitter = 70;
    } else if (speaker.includes('シオリ')) {
      baseFreq = 520;
      wave = 'sine';
      filterFreq = 1800;
      dur = 0.07;
      vol = 0.12;
      pitchJitter = 95;
    } else if (speaker.includes('調査')) {
      baseFreq = 340;
      wave = 'sine';
      filterFreq = 1100;
      dur = 0.035;
      vol = 0.08;
      pitchJitter = 30;
    } else {
      // 美咲（女子高生：スプラ/どう森風の軽快な喋り声）
      baseFreq = 540;
      wave = 'triangle';
      filterFreq = 1900;
      dur = 0.052;
      vol = 0.13;
      pitchJitter = 150;
    }

    const f0 = baseFreq + (Math.random() - 0.5) * pitchJitter;
    const f1 = f0 * (0.86 + Math.random() * 0.34); // 母音っぽいピッチ揺らぎ

    const osc = this.ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(f0, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(55, f1), now + dur);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq + (Math.random() - 0.5) * 350;
    filter.Q.value = 2.6;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + dur + 0.015);
  }

  // ロッカーをガタンッ！と激しく叩く音
  playLockerBang() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // 金属の共鳴
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(195, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.22);
    og.gain.setValueAtTime(0.45, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(og);
    og.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.26);

    // 衝撃ノイズ
    const dur = 0.18;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.22));
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 720;
    const g = this.ctx.createGain();
    g.gain.value = 0.5;
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(now);
  }

  // YOU ARE DEAD の重厚な暗転音
  playYouAreDead() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [55, 61.74, 110].forEach((f) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.72, now + 2.4);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 260;
      g.gain.setValueAtTime(0.28, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
      osc.connect(lp);
      lp.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + 2.6);
    });
  }

  // 狂気エンド：コンパスで目を刺す音＋赤い女の絶叫
  playCompassStab() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // グサッ！
    const dur = 0.16;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.3));
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.52;
    src.connect(g);
    g.connect(this.master);
    src.start(now);

    // 女の絶叫スクリーチ
    [520, 740, 1080].forEach((f) => {
      const osc = this.ctx.createOscillator();
      const sg = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now + 0.05);
      osc.frequency.exponentialRampToValueAtTime(f * 0.45, now + 0.95);
      sg.gain.setValueAtTime(0.16, now + 0.05);
      sg.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
      osc.connect(sg);
      sg.connect(this.master);
      osc.start(now + 0.05);
      osc.stop(now + 1.05);
    });
  }

  // 狂気エンド：大きい三角定規で攻撃をガキィン！とガード
  playRulerGuard() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [320, 640, 1280].forEach((f) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.65, now + 0.25);
      g.gain.setValueAtTime(0.28, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.3);
    });
  }

  // 狂気エンド：アルコールランプをぶっかけて割れる音
  playGlassSplash() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // ガラス粉砕の高周波ノイズ
    const dur = 0.45;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.35));
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2200;
    const g = this.ctx.createGain();
    g.gain.value = 0.48;
    src.connect(hp);
    hp.connect(g);
    g.connect(this.master);
    src.start(now);

    // ガラス片チリンチリン
    [2800, 3650, 4400, 3150].forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const cg = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      cg.gain.setValueAtTime(0.14, now + idx * 0.04);
      cg.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.14);
      osc.connect(cg);
      cg.connect(this.master);
      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.16);
    });
  }

  // 狂気エンド：タバコ用ライターのカチンッ・シュボッ！
  playLighterClick() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // カチン（金属蓋）
    const c1 = this.ctx.createOscillator();
    const g1 = this.ctx.createGain();
    c1.type = 'square';
    c1.frequency.setValueAtTime(2400, now);
    c1.frequency.exponentialRampToValueAtTime(900, now + 0.035);
    g1.gain.setValueAtTime(0.24, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    c1.connect(g1);
    g1.connect(this.master);
    c1.start(now);
    c1.stop(now + 0.045);

    // シュボッ（着火）
    const dur = 0.22;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((i / d.length) * Math.PI);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 950;
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.35;
    src.connect(bp);
    bp.connect(g2);
    g2.connect(this.master);
    src.start(now + 0.18);
  }

  // 狂気エンド：ボォォォッ！！炎上轟音＋パチパチ燃焼
  playFireIgnite() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dur = 3.2;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const t = i / d.length;
      const env = t < 0.08 ? t / 0.08 : Math.exp(-(t - 0.08) * 1.4);
      d[i] = (Math.random() * 2 - 1) * env;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(950, now);
    lp.frequency.exponentialRampToValueAtTime(320, now + dur);
    const g = this.ctx.createGain();
    g.gain.value = 0.65;
    src.connect(lp);
    lp.connect(g);
    g.connect(this.master);
    src.start(now);

    // 燃えながらの断末魔
    [420, 610, 880].forEach((f) => {
      const osc = this.ctx.createOscillator();
      const sg = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now + 0.12);
      osc.frequency.exponentialRampToValueAtTime(f * 0.32, now + 1.8);
      sg.gain.setValueAtTime(0.14, now + 0.12);
      sg.gain.exponentialRampToValueAtTime(0.001, now + 1.9);
      osc.connect(sg);
      sg.connect(this.master);
      osc.start(now + 0.12);
      osc.stop(now + 1.95);
    });
  }

  // メトロノーム接近音（＋近いと不気味な低音鼓動）
  playMetronomeTick(intensity) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // カチッという木製メトロノーム音
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1100 + Math.random() * 120, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.025);
    gain.gain.setValueAtTime(0.08 + intensity * 0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.045);

    // とても近いときは心拍の低音も重ねる
    if (intensity > 0.45) {
      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(68, now);
      sub.frequency.exponentialRampToValueAtTime(32, now + 0.14);
      subGain.gain.setValueAtTime(intensity * 0.35, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      sub.connect(subGain);
      subGain.connect(this.master);
      sub.start(now);
      sub.stop(now + 0.18);
    }
  }

  // ジャンプスケア（捕まったとき）
  playJumpscare() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // ノイズバースト
    const dur = 0.85;
    const bufSize = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.45));
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const nGain = this.ctx.createGain();
    nGain.gain.value = 0.55;
    src.connect(nGain);
    nGain.connect(this.master);
    src.start(now);

    // 強烈な不協和音
    [95, 138, 415, 587, 830].forEach((f) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.linearRampToValueAtTime(f * 0.78, now + dur);
      g.gain.setValueAtTime(0.22, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + dur + 0.05);
    });
  }

  update(dt, enemyDist, enemyActive) {
    if (!this.started) return;

    // ランダムで遠くからピアノの単音
    this.pianoTimer -= dt;
    if (this.pianoTimer <= 0) {
      this.pianoTimer = 16 + Math.random() * 20;
      if (enemyActive) {
        this.playDistantPiano();
      }
    }

    // 敵との距離に応じたメトロノーム音
    if (enemyActive && enemyDist < 22) {
      const intensity = Math.max(0, Math.min(1, 1 - enemyDist / 22));
      const interval = 0.85 - intensity * 0.58; // 近いほど速くなる！
      this.metronomeTimer -= dt;
      if (this.metronomeTimer <= 0) {
        this.playMetronomeTick(intensity);
        this.metronomeTimer = interval;
      }
    } else {
      this.metronomeTimer = 0.2;
    }
  }
}
