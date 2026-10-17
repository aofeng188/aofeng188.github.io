// 天空、太阳、雾、星空、降雪与季节。
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { G } from './materials.js';

const LAT = THREE.MathUtils.degToRad(39.92); // 北京纬度
const DECL = { spring: 8, summer: 21, autumn: -6, winter: -19 };
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class Environment {
  constructor(renderer, scene, quality, M) {
    this.renderer = renderer; this.scene = scene; this.q = quality; this.M = M;
    this.time = 9.5; this.season = 'autumn'; this.snow = false; this.snowAmt = 0;
    this.sunDir = new THREE.Vector3(); this.moonDir = new THREE.Vector3();
    this.night = 0;
    this.listeners = [];

    const sky = new Sky();
    sky.scale.setScalar(9000);
    // 天空亮度单独压低，避免在 ACES 色调映射下发白
    for (const m of [sky.material]) m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb *= 0.5;\n#include <tonemapping_fragment>'); };
    sky.material.depthWrite = false;
    sky.renderOrder = -10;
    scene.add(sky);
    this.sky = sky;
    // 环境贴图用的小天空
    this.envScene = new THREE.Scene();
    this.envSky = new Sky(); this.envSky.scale.setScalar(50);
    this.envScene.add(this.envSky);
    this.envGround = new THREE.Mesh(new THREE.CircleGeometry(40, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8a8378 }));
    this.envGround.position.y = -2;
    this.envScene.add(this.envGround);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = null; this.envDirty = true; this.envTimer = 0;

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    const sm = quality.shadow;
    this.sun.shadow.mapSize.set(sm, sm);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    this.shadowExtent = 160;
    scene.add(this.sun); scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd6ff, 0x8a7a66, 0.6);
    scene.add(this.hemi);

    scene.fog = new THREE.FogExp2(0xbfcad6, 0.00032);

    this._stars();
    this._moon();
    this._snowParticles();
    this.apply();
  }

  _stars() {
    const n = 2600, pos = new Float32Array(n * 3), sz = new Float32Array(n);
    let s = 7;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) {
      const u = r(), v = r() * 0.95;
      const th = u * Math.PI * 2, ph = Math.acos(1 - v);
      pos[i * 3] = Math.sin(ph) * Math.cos(th) * 7000; pos[i * 3 + 1] = Math.cos(ph) * 7000; pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 7000;
      sz[i] = 1 + r() * r() * 3;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('size', new THREE.BufferAttribute(sz, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uA: { value: 0 } },
      vertexShader: 'attribute float size; void main(){ gl_PointSize = size; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform float uA; void main(){ vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(c)); gl_FragColor = vec4(vec3(1.0,0.97,0.9), a * uA); }',
      transparent: true, depthWrite: false, fog: false,
    });
    this.stars = new THREE.Points(g, m);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -9;
    this.scene.add(this.stars);
  }

  _moon() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 10, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,250,230,1)'); g.addColorStop(0.35, 'rgba(250,244,220,1)'); g.addColorStop(0.42, 'rgba(220,220,255,0.25)'); g.addColorStop(1, 'rgba(200,210,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
    this.moon.scale.setScalar(520);
    this.moon.renderOrder = -8;
    this.scene.add(this.moon);
  }

  _snowParticles() {
    const n = this.q.snowCount;
    const pos = new Float32Array(n * 3), rnd = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = Math.random() * 160; pos[i * 3 + 1] = Math.random() * 80; pos[i * 3 + 2] = Math.random() * 160;
      rnd[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('rnd', new THREE.BufferAttribute(rnd, 1));
    this.snowMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uA: { value: 0 }, uPx: { value: 1 } },
      vertexShader: /* glsl */`
        attribute float rnd; uniform float uTime; uniform vec3 uCam; uniform float uPx; varying float vA;
        void main(){
          vec3 p = position;
          p.y -= uTime * (1.2 + rnd * 0.9);
          p.x += uTime * 0.6 + sin(uTime * 0.7 + rnd * 20.0) * 1.5;
          p.z += sin(uTime * 0.5 + rnd * 11.0) * 1.2;
          vec3 box = vec3(160.0, 80.0, 160.0);
          p = mod(p - uCam + box * 0.5, box) - box * 0.5 + uCam;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = uPx * (2.0 + rnd * 3.0) * (60.0 / max(4.0, -mv.z));
          vA = smoothstep(80.0, 20.0, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform float uA; varying float vA;
        void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(1.0, 1.0, 1.0, smoothstep(0.5, 0.1, d) * uA * vA * 0.9); }`,
      transparent: true, depthWrite: false,
    });
    this.snowPts = new THREE.Points(g, this.snowMat);
    this.snowPts.frustumCulled = false;
    this.snowPts.visible = false;
    this.scene.add(this.snowPts);
  }

  setTime(h) { this.time = h; this.apply(); }
  setSeason(s) { this.season = s; this.apply(); this.listeners.forEach((f) => f('season', s)); }
  setSnow(on) { this.snow = on; this.listeners.forEach((f) => f('snow', on)); }
  on(f) { this.listeners.push(f); }

  /** 根据时间与季节计算太阳方位 */
  sunAt(h, season) {
    const d = THREE.MathUtils.degToRad(DECL[season]);
    const H = THREE.MathUtils.degToRad((h - 12) * 15);
    const el = Math.asin(Math.sin(LAT) * Math.sin(d) + Math.cos(LAT) * Math.cos(d) * Math.cos(H));
    const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(LAT) - Math.tan(d) * Math.cos(LAT)); // 自正南起，向西为正
    return new THREE.Vector3(-Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  }

  apply() {
    const sd = this.sunAt(this.time, this.season);
    this.sunDir.copy(sd);
    const el = Math.asin(sd.y) * 180 / Math.PI;
    const night = 1 - smooth(-9, 1.5, el);
    this.night = night;
    G.uNight.value = night;
    // 月亮：大致在太阳对面
    this.moonDir.set(-sd.x * 0.8 + 0.2, Math.max(0.35, -sd.y * 0.8 + 0.25), -sd.z * 0.6 - 0.3).normalize();

    const snowy = this.snowAmt;
    const skyDir = el > -6 ? sd : new THREE.Vector3(sd.x, -0.1, sd.z).normalize();
    for (const s of [this.sky, this.envSky]) {
      const uu = s.material.uniforms;
      uu.sunPosition.value.copy(skyDir);
      uu.turbidity.value = 2.4 + snowy * 16;
      uu.rayleigh.value = THREE.MathUtils.lerp(1.9, 0.4, snowy) * (el < 8 ? 1.4 : 1.0);
      uu.mieCoefficient.value = 0.004 + snowy * 0.02;
      uu.mieDirectionalG.value = 0.82;
    }

    // 太阳光
    const warm = smooth(25, 2, el);
    const sunCol = new THREE.Color().setRGB(1, 0.96 - warm * 0.32, 0.9 - warm * 0.55);
    const dayI = smooth(-2, 12, el);
    this.sun.color.copy(sunCol);
    this.sun.intensity = (3.7 * dayI) * (1 - snowy * 0.62) + night * 0.9;
    if (night > 0.5) this.sun.color.setRGB(0.62, 0.72, 1.0);
    this.hemi.intensity = 0.24 + dayI * 0.36 + snowy * 0.4 + night * 0.22;
    this.hemi.color.setRGB(0.72 + warm * 0.15, 0.8, 0.95).lerp(new THREE.Color(0.32, 0.4, 0.66), night);
    this.hemi.groundColor.setRGB(0.55, 0.48, 0.4).lerp(new THREE.Color(0.08, 0.08, 0.1), night);

    // 雾色
    const day = new THREE.Color(0.66, 0.76, 0.87);
    const gold = new THREE.Color(0.88, 0.66, 0.48);
    const dusk = new THREE.Color(0.42, 0.34, 0.42);
    const nightC = new THREE.Color(0.035, 0.05, 0.09);
    let fc = day.clone().lerp(gold, smooth(18, 3, el));
    fc.lerp(dusk, smooth(2, -5, el));
    fc.lerp(nightC, night);
    fc.lerp(new THREE.Color(0.8, 0.82, 0.86).multiplyScalar(1 - night * 0.85), snowy * 0.85);
    this.scene.fog.color.copy(fc);
    this.scene.fog.density = 0.00028 + snowy * 0.0016 + night * 0.00015;
    this.stars.material.uniforms.uA.value = night * (1 - snowy);
    this.moon.visible = night > 0.05 && snowy < 0.6;
    this.moon.material.opacity = night;
    this.M.lamp.emissiveIntensity = 0.25 + night * 3.2;
    this.M.lampWarm.emissiveIntensity = night * 2.5;
    this.renderer.toneMappingExposure = 0.62 + dayI * 0.12 + night * 0.25;
    this.envDirty = true;
  }

  /** focus：阴影中心点；extent：阴影覆盖半径 */
  update(dt, camera, focus, extent) {
    // 积雪渐变
    const target = this.snow ? 1 : 0;
    if (Math.abs(this.snowAmt - target) > 0.001) {
      this.snowAmt += Math.sign(target - this.snowAmt) * Math.min(Math.abs(target - this.snowAmt), dt * 0.25);
      G.uSnow.value = this.snowAmt;
      this.apply();
    }
    this.snowPts.visible = this.snowAmt > 0.02;
    this.snowMat.uniforms.uA.value = this.snowAmt;
    this.snowMat.uniforms.uTime.value += dt;
    this.snowMat.uniforms.uCam.value.copy(camera.position);
    this.snowMat.uniforms.uPx.value = this.renderer.getPixelRatio();
    G.uTime.value += dt;

    // 太阳 / 月光方向与阴影相机
    const L = this.night > 0.5 ? this.moonDir : this.sunDir;
    const ext = THREE.MathUtils.clamp(extent, 60, 900);
    if (Math.abs(ext - this.shadowExtent) / this.shadowExtent > 0.15) {
      this.shadowExtent = ext;
      const c = this.sun.shadow.camera;
      c.left = c.bottom = -ext; c.right = c.top = ext;
      c.near = 1; c.far = ext * 4 + 600;
      c.updateProjectionMatrix();
      this.sun.shadow.normalBias = 0.3 + ext / 400;
    }
    const texel = (this.shadowExtent * 2) / this.sun.shadow.mapSize.x;
    const fx = Math.round(focus.x / texel) * texel, fz = Math.round(focus.z / texel) * texel;
    this.sun.target.position.set(fx, 0, fz);
    this.sun.position.set(fx + L.x * (ext * 2 + 300), Math.max(40, L.y * (ext * 2 + 300)), fz + L.z * (ext * 2 + 300));
    this.sun.target.updateMatrixWorld();
    this.moon.position.copy(camera.position).addScaledVector(this.moonDir, 6000);
    this.stars.position.copy(camera.position);
    this.sky.position.copy(camera.position);

    this.envTimer -= dt;
    if (this.envDirty && this.envTimer <= 0) {
      this.envDirty = false; this.envTimer = 0.4;
      this.envGround.material.color.setRGB(0.5, 0.47, 0.42).multiplyScalar(1 - this.night * 0.9).lerp(new THREE.Color(0.85, 0.87, 0.9), this.snowAmt * 0.6);
      const rt = this.pmrem.fromScene(this.envScene, 0.02, 0.1, 200);
      if (this.envRT) this.envRT.dispose();
      this.envRT = rt;
      this.scene.environment = rt.texture;
      this.scene.environmentIntensity = (0.35 + (1 - this.night) * 0.3) * (1 - this.night * 0.7);
    }
  }
}
