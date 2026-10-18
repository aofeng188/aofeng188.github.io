// 游客：简洁的小人（躯干、双腿、双臂、头、头发），沿预设路线行走，迈腿摆臂，偶尔驻足。
import * as THREE from 'three';
import { REG } from './registry.js';

const CLOTHES = [0x2f4a6d, 0xb33a3a, 0xe8e2d4, 0x3c3c40, 0x6b7f4a, 0xd98c3a, 0x8a5a9a, 0x2f6f7a, 0xc9a24a, 0x5a3a2a, 0xf0f0ec, 0x1f2a44, 0x9a3b5a, 0x4a6a8a];
const PANTS = [0x2a2c33, 0x3a4a6a, 0x5a5048, 0x1e1e22, 0x7a6a58, 0x3d4652];
const SKIN = [0xe2bf9a, 0xd8b088, 0xc99d74, 0xe8c8a6];
const HAIR = [0x1e1a17, 0x2a211c, 0x3a2b20, 0x14110f, 0x6a5a4a];

const HIP = 0.86, SHOULDER = 1.38;

export class People {
  constructor(scene, count) {
    this.scene = scene;
    this.count = count;
    this.list = [];
    this.meshes = [];
  }
  build() {
    const routes = REG.people.map((r) => (r.pts ? r : { pts: r, w: 6 }));
    if (!routes.length) return;
    let s = 4242;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    // 部件几何（单位：米，原点在脚下中心；四肢以关节为原点）
    const torso = new THREE.CylinderGeometry(0.17, 0.15, SHOULDER - HIP + 0.06, 8).translate(0, (HIP + SHOULDER) / 2, 0);
    torso.scale(1, 1, 0.68);
    const leg = new THREE.CylinderGeometry(0.075, 0.06, HIP, 6).translate(0, -HIP / 2, 0);
    const arm = new THREE.CylinderGeometry(0.05, 0.042, 0.58, 6).translate(0, -0.29, 0);
    const head = new THREE.SphereGeometry(0.11, 10, 8).scale(0.9, 1.05, 0.95).translate(0, SHOULDER + 0.17, 0);
    const hair = new THREE.SphereGeometry(0.118, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55).translate(0, SHOULDER + 0.19, -0.01);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
    const mk = (g) => { const m = new THREE.InstancedMesh(g, mat, this.count); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; this.scene.add(m); this.meshes.push(m); return m; };
    this.torso = mk(torso); this.legL = mk(leg); this.legR = mk(leg); this.armL = mk(arm); this.armR = mk(arm); this.head = mk(head); this.hair = mk(hair);
    const c = new THREE.Color();
    // 按路线长度分配人数
    const lens = routes.map(({ pts: p }) => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; });
    const total = lens.reduce((a, b) => a + b, 0);
    for (let i = 0; i < this.count; i++) {
      let pick = r() * total, ri = 0;
      while (pick > lens[ri] && ri < routes.length - 1) { pick -= lens[ri]; ri++; }
      const p = { route: routes[ri].pts, len: Math.max(1, lens[ri]), d: pick, dir: r() < 0.5 ? 1 : -1, speed: 0.9 + r() * 0.45, off: (r() - 0.5) * routes[ri].w, pause: 0, phase: r() * 10, h: 0.9 + r() * 0.16, x: 0, z: 0, y: 0, yaw: 0 };
      this.list.push(p);
      const shirt = CLOTHES[Math.floor(r() * CLOTHES.length)];
      const skin = SKIN[Math.floor(r() * SKIN.length)];
      this.torso.setColorAt(i, c.setHex(shirt));
      this.armL.setColorAt(i, c.setHex(r() < 0.5 ? shirt : skin)); this.armR.setColorAt(i, c);
      const pants = PANTS[Math.floor(r() * PANTS.length)];
      this.legL.setColorAt(i, c.setHex(pants)); this.legR.setColorAt(i, c);
      this.head.setColorAt(i, c.setHex(skin));
      this.hair.setColorAt(i, c.setHex(HAIR[Math.floor(r() * HAIR.length)]));
    }
    this.m = new THREE.Matrix4(); this.m2 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.sc = new THREE.Vector3();
    this.update(0);
  }
  _pos(p) {
    let d = ((p.d % p.len) + p.len) % p.len;
    const R = p.route;
    for (let i = 1; i < R.length; i++) {
      const a = R[i - 1], b = R[i];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d <= L || i === R.length - 1) {
        const t = Math.min(1, d / (L || 1));
        const dx = (b[0] - a[0]) / (L || 1), dz = (b[1] - a[1]) / (L || 1);
        return [a[0] + (b[0] - a[0]) * t - dz * p.off, a[1] + (b[1] - a[1]) * t + dx * p.off, Math.atan2(dx * p.dir, dz * p.dir)];
      }
      d -= L;
    }
    return [R[0][0], R[0][1], 0];
  }
  _limb(mesh, i, base, x, y, swing) {
    this.m2.makeRotationX(swing).setPosition(x, y, 0);
    this.m.multiplyMatrices(base, this.m2);
    mesh.setMatrixAt(i, this.m);
  }
  update(dt) {
    if (!this.torso) return;
    const col = REG.col;
    const base = new THREE.Matrix4();
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i];
      if (p.pause > 0) p.pause -= dt;
      else {
        p.d += p.dir * p.speed * dt;
        if (p.d > p.len) { p.d = p.len; p.dir = -1; }
        if (p.d < 0) { p.d = 0; p.dir = 1; }
        if (Math.random() < dt * 0.02) p.pause = 3 + Math.random() * 8;
      }
      const [x, z, yaw] = this._pos(p);
      let y = col ? col.get(x, z) : 0;
      if (y === null) y = p.y;
      p.x = x; p.z = z; p.y += (y - p.y) * Math.min(1, dt * 8 + (dt === 0 ? 1 : 0)); p.yaw = yaw;
      const walking = p.pause <= 0;
      if (walking) p.phase += dt * p.speed * 5.2;
      const sw = walking ? Math.sin(p.phase) * 0.5 : 0;
      const bob = walking ? Math.abs(Math.cos(p.phase)) * 0.035 : 0;
      this.q.setFromAxisAngle(this.v.set(0, 1, 0), yaw);
      base.compose(this.v.set(x, p.y + bob, z), this.q, this.sc.set(p.h, p.h, p.h));
      this.torso.setMatrixAt(i, base); this.head.setMatrixAt(i, base); this.hair.setMatrixAt(i, base);
      this._limb(this.legL, i, base, -0.085, HIP, sw);
      this._limb(this.legR, i, base, 0.085, HIP, -sw);
      this._limb(this.armL, i, base, -0.22, SHOULDER - 0.02, -sw * 0.8);
      this._limb(this.armR, i, base, 0.22, SHOULDER - 0.02, sw * 0.8);
    }
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
  }
  setVisible(v) { for (const m of this.meshes) m.visible = v; }
  /** 离某点最近的游客数量（用于人声环境音） */
  near(x, z, r) {
    let n = 0;
    for (const p of this.list) if (Math.abs(p.x - x) < r && Math.abs(p.z - z) < r) n++;
    return n;
  }
}
