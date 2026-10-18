// 水面：平面镜面反射 + 法线扰动 + 菲涅尔；下雪时护城河结冰。
import * as THREE from 'three';
import { waterNormalTexture } from '../core/textures.js';
import { G } from '../core/materials.js';
import { WATER_Y } from './terrain.js';

export class WaterSurface {
  constructor(renderer, scene, polys, quality) {
    this.renderer = renderer; this.scene = scene; this.q = quality;
    const geos = [];
    this.boxes = [];
    for (const w of polys) {
      const shape = new THREE.Shape(w.map(([x, z]) => new THREE.Vector2(x, z)));
      const g = new THREE.ShapeGeometry(shape);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i), WATER_Y, p.getY(i));
      const idx = g.index.array;
      for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
      g.deleteAttribute('uv');
      g.deleteAttribute('normal');
      geos.push(g.toNonIndexed());
      const box = new THREE.Box3();
      for (const [x, z] of w) box.expandByPoint(new THREE.Vector3(x, WATER_Y - 1, z));
      box.max.y = WATER_Y + 1;
      this.boxes.push(box);
    }
    const merged = mergeSimple(geos);
    const res = quality.reflection;
    this.rt = res ? new THREE.WebGLRenderTarget(res, Math.round(res * 0.6), { type: THREE.HalfFloatType }) : null;
    this.textureMatrix = new THREE.Matrix4();
    this.uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      tRefl: { value: null },
      tNormal: { value: waterNormalTexture() },
      texMat: { value: this.textureMatrix },
      uTime: { value: 0 },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunCol: { value: new THREE.Color(1, 1, 1) },
      waterCol: { value: new THREE.Color(0x1d3a3a) },
      skyCol: { value: new THREE.Color(0x9fb4c8) },
      hasRefl: { value: res ? 1 : 0 },
      uIce: { value: 0 },
    }]);
    this.uniforms.uSnow = G.uSnow;
    // 渲染目标纹理不能经 UniformsUtils.merge 克隆，合并后再赋值
    if (this.rt) this.uniforms.tRefl.value = this.rt.texture;
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, fog: true,
      vertexShader: /* glsl */`
        uniform mat4 texMat; varying vec4 vRefl; varying vec3 vWorld;
        #include <fog_pars_vertex>
        void main(){
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          vRefl = texMat * wp;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tRefl; uniform sampler2D tNormal; uniform float uTime; uniform vec3 sunDir; uniform vec3 sunCol;
        uniform vec3 waterCol; uniform vec3 skyCol; uniform float hasRefl; uniform float uIce;
        varying vec4 vRefl; varying vec3 vWorld;
        #include <common>
        #include <fog_pars_fragment>
        void main(){
          vec2 uv1 = vWorld.xz / 22.0 + vec2(uTime * 0.010, uTime * 0.006);
          vec2 uv2 = vWorld.xz / 8.0 + vec2(-uTime * 0.008, uTime * 0.013);
          vec3 n1 = texture2D(tNormal, uv1).rgb * 2.0 - 1.0;
          vec3 n2 = texture2D(tNormal, uv2).rgb * 2.0 - 1.0;
          float rough = mix(1.0, 0.25, uIce);
          vec3 n = normalize(vec3((n1.x + n2.x) * 0.35 * rough, 1.0, (n1.y + n2.y) * 0.35 * rough));
          vec3 V = normalize(cameraPosition - vWorld);
          float fres = 0.03 + 0.97 * pow(1.0 - max(dot(V, n), 0.0), 5.0);
          vec3 refl = skyCol;
          if (hasRefl > 0.5) {
            vec4 rc = vRefl; rc.xy += n.xz * 2.2 * rc.w * 0.012;
            refl = texture2DProj(tRefl, rc).rgb;
          }
          vec3 col = mix(waterCol, refl * 0.9, clamp(fres * 0.95 + 0.14, 0.0, 1.0));
          vec3 H = normalize(sunDir + V);
          float spec = pow(max(dot(n, H), 0.0), 220.0) * step(0.0, sunDir.y);
          col += sunCol * spec * 2.5 * (1.0 - uIce);
          // 结冰：灰白冰面 + 积雪斑块
          vec3 ice = mix(vec3(0.62, 0.68, 0.72), vec3(0.9, 0.92, 0.95), smoothstep(0.35, 0.75, n1.x * 0.5 + 0.5));
          col = mix(col, mix(ice, refl, 0.18), uIce);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(merged, mat);
    this.mesh.name = 'water';
    this.mesh.receiveShadow = false;
    this.mesh.onBeforeRender = () => {};
    this.mirrorCam = new THREE.PerspectiveCamera();
    this.frame = 0;
    this._frustum = new THREE.Frustum();
    this._m = new THREE.Matrix4();
  }

  /** 每帧调用：更新反射贴图 */
  update(dt, camera, env, hide = []) {
    this.uniforms.uTime.value += dt;
    this.uniforms.sunDir.value.copy(env.night > 0.5 ? env.moonDir : env.sunDir);
    this.uniforms.sunCol.value.copy(env.sun.color).multiplyScalar(env.night > 0.5 ? 0.3 : 1);
    this.uniforms.skyCol.value.copy(env.scene.fog.color);
    this.uniforms.waterCol.value.setRGB(0.07, 0.15, 0.13).multiplyScalar(1 - env.night * 0.8);
    const target = env.snowAmt > 0.6 ? 1 : 0;
    this.uniforms.uIce.value += (target - this.uniforms.uIce.value) * Math.min(1, dt * 0.3);
    if (!this.rt || !this.mesh.visible) return;
    // 只在水面可见时渲染反射
    this._m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this._frustum.setFromProjectionMatrix(this._m);
    if (!this.boxes.some((b) => this._frustum.intersectsBox(b))) return;
    if (camera.position.y < WATER_Y + 0.1) return;
    if (this.q.reflectEvery > 1 && (this.frame++ % this.q.reflectEvery) !== 0) return;
    this.renderMirror(camera, hide);
  }

  renderMirror(camera, hide) {
    // 参考 three.js Reflector：镜像相机 + 斜裁剪近平面
    const mc = this.mirrorCam;
    const normal = new THREE.Vector3(0, 1, 0);
    const mirrorPos = new THREE.Vector3(0, WATER_Y, 0);
    const camPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    const rot = new THREE.Matrix4().extractRotation(camera.matrixWorld);
    const look = new THREE.Vector3(0, 0, -1).applyMatrix4(rot).add(camPos);
    const view = mirrorPos.clone().sub(camPos).reflect(normal).negate().add(mirrorPos);
    const target = mirrorPos.clone().sub(look).reflect(normal).negate().add(mirrorPos);
    mc.position.copy(view);
    mc.up.set(0, 1, 0).applyMatrix4(rot).reflect(normal);
    mc.lookAt(target);
    mc.far = camera.far; mc.near = camera.near;
    mc.updateMatrixWorld();
    mc.projectionMatrix.copy(camera.projectionMatrix);
    this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.textureMatrix.multiply(mc.projectionMatrix).multiply(mc.matrixWorldInverse);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, mirrorPos);
    plane.applyMatrix4(mc.matrixWorldInverse);
    const clip = new THREE.Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const pm = mc.projectionMatrix;
    const q = new THREE.Vector4(
      (Math.sign(clip.x) + pm.elements[8]) / pm.elements[0],
      (Math.sign(clip.y) + pm.elements[9]) / pm.elements[5],
      -1.0, (1.0 + pm.elements[10]) / pm.elements[14]);
    clip.multiplyScalar(2.0 / clip.dot(q));
    pm.elements[2] = clip.x; pm.elements[6] = clip.y; pm.elements[10] = clip.z + 1.0 - 0.003; pm.elements[14] = clip.w;

    const r = this.renderer;
    const prevRT = r.getRenderTarget();
    const prevXR = r.xr.enabled, prevShadow = r.shadowMap.autoUpdate;
    r.xr.enabled = false; r.shadowMap.autoUpdate = false;
    this.mesh.visible = false;
    const vis = hide.map((o) => o.visible);
    hide.forEach((o) => (o.visible = false));
    r.setRenderTarget(this.rt);
    r.state.buffers.depth.setMask(true);
    if (r.autoClear === false) r.clear();
    r.render(this.scene, mc);
    r.setRenderTarget(prevRT);
    hide.forEach((o, i) => (o.visible = vis[i]));
    this.mesh.visible = true;
    r.xr.enabled = prevXR; r.shadowMap.autoUpdate = prevShadow;
  }
}

function mergeSimple(geos) {
  let n = 0;
  for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3);
  let o = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o); o += g.attributes.position.array.length; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeBoundingSphere();
  return g;
}
