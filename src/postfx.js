import * as THREE from 'three';

// 超軽量・単一パス HDRボディカム実写風ポストプロセス
// （HDRブルーム＋色収差＋広角微バレル歪み＋ACES Filmicトーンマッピング＋ISO800センサーノイズ＋sRGB出力）
export class BodycamPostFX {
  constructor(renderer) {
    this.renderer = renderer;
    this.width = 1;
    this.height = 1;
    this.ps1Mode = false;

    const useHalfFloat = !!(renderer.capabilities && renderer.capabilities.isWebGL2);
    this.renderTarget = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: useHalfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false
    });

    this.postScene = new THREE.Scene();
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.uniforms = {
      tDiffuse: { value: this.renderTarget.texture },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uPs1Mode: { value: 0.0 },
      uDanger: { value: 0.0 },
      uExposure: { value: 1.28 }
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform vec2 uResolution;
        uniform float uTime;
        uniform float uPs1Mode;
        uniform float uDanger;
        uniform float uExposure;
        varying vec2 vUv;

        float hash12(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }

        // 広角ボディカムの自然な微バレル歪み
        vec2 barrelDistort(vec2 uv, float k) {
          vec2 c = uv - 0.5;
          float r2 = dot(c, c);
          return 0.5 + c * (1.0 + k * r2);
        }

        // 実写映画・ボディカム向け ACES Filmic トーンマッピング
        vec3 acesFilm(vec3 x) {
          const float a = 2.51;
          const float b = 0.03;
          const float c = 2.43;
          const float d = 0.59;
          const float e = 0.14;
          return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
        }

        void main() {
          float isBodycam = 1.0 - uPs1Mode;
          vec2 uv = mix(vUv, barrelDistort(vUv, 0.10), isBodycam);

          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            return;
          }

          vec2 fromCenter = uv - 0.5;
          float r2 = dot(fromCenter, fromCenter);

          // 1. レンズ周辺の色収差（Chromatic Aberration）
          vec2 caOffset = fromCenter * (0.0038 + uDanger * 0.0055) * (0.35 + r2 * 2.2) * isBodycam;
          float r = texture2D(tDiffuse, clamp(uv + caOffset, 0.001, 0.999)).r;
          float g = texture2D(tDiffuse, uv).g;
          float b = texture2D(tDiffuse, clamp(uv - caOffset, 0.001, 0.999)).b;
          vec3 hdr = vec3(r, g, b);

          // 2. 高速8タップ HDRハレーション／ブルーム（蛍光灯・暖色ランプ・自販機・懐中電灯反射が滲む！）
          if (isBodycam > 0.5) {
            vec2 px = vec2(1.0) / max(uResolution, vec2(1.0));
            vec3 bloom = vec3(0.0);
            vec2 offs[8];
            offs[0] = vec2( 3.0,  0.0);
            offs[1] = vec2(-3.0,  0.0);
            offs[2] = vec2( 0.0,  3.0);
            offs[3] = vec2( 0.0, -3.0);
            offs[4] = vec2( 5.5,  5.5);
            offs[5] = vec2(-5.5,  5.5);
            offs[6] = vec2( 5.5, -5.5);
            offs[7] = vec2(-5.5, -5.5);
            for (int i = 0; i < 8; i++) {
              vec3 s = texture2D(tDiffuse, clamp(uv + offs[i] * px, 0.001, 0.999)).rgb;
              float lum = dot(s, vec3(0.2126, 0.7152, 0.0722));
              float w = smoothstep(0.62, 1.85, lum);
              bloom += s * w;
            }
            hdr += (bloom / 8.0) * 0.62;
          }

          // 3. 露出調整 ＋ ACES Filmic トーンマッピング ＋ リニア->sRGBガンマ変換
          vec3 col = acesFilm(hdr * uExposure);
          col = pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));

          // 4. ボディカム調カラーグレーディング＆ISO-800動的センサーグレイン
          if (isBodycam > 0.5) {
            float luma = dot(col, vec3(0.299, 0.587, 0.114));
            // わずかに冷たいシャドウ × 引き締まったコントラスト
            col = mix(col, col * col * (3.0 - 2.0 * col), 0.18);
            col += vec3(-0.006, 0.004, 0.011) * (1.0 - smoothstep(0.0, 0.55, luma));

            float n = hash12(floor(gl_FragCoord.xy * 0.75) + fract(uTime * 17.3) * 100.0) - 0.5;
            float grainStrength = mix(0.055, 0.015, smoothstep(0.06, 0.72, luma));
            col += n * grainStrength;
          } else {
            // PS1レトロモード：5bit色減色
            col = floor(col * 28.0 + 0.5) / 28.0;
          }

          // 5. 広角ボディカム周辺減光（ビネット）
          float vig = 1.0 - r2 * mix(0.42, 0.85, isBodycam);
          col *= clamp(vig, 0.24, 1.0);

          gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
        }
      `
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    this.postScene.add(quad);
  }

  setSize(w, h) {
    const rw = Math.max(1, Math.floor(w));
    const rh = Math.max(1, Math.floor(h));
    if (rw === this.width && rh === this.height) return;
    this.width = rw;
    this.height = rh;
    this.renderTarget.setSize(rw, rh);
    this.uniforms.uResolution.value.set(rw, rh);
  }

  setPs1Mode(flag) {
    this.ps1Mode = !!flag;
    this.uniforms.uPs1Mode.value = this.ps1Mode ? 1.0 : 0.0;
  }

  render(scene, camera, time, danger = 0) {
    this.uniforms.uTime.value = time;
    this.uniforms.uDanger.value = danger;

    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  }
}
