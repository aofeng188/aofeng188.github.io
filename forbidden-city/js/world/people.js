// 游客：简洁人形（实例化），沿预设路线缓慢行走，偶尔驻足拍照。
import * as THREE from 'three';
import { REG } from './registry.js';

const CLOTHES = [0x2f4a6d, 0xb33a3a, 0xe8e2d4, 0x3c3c40, 0x6b7f4a, 0xd98c3a, 0x8a5a9a, 0x2f6f7a, 0xc9a24a, 0x5a3a2a, 0xf0f0ec, 0x1f2a44];
const PANTS = [0x2a2c33, 0x3a4a6a, 0x5a5048, 0x1e1e22, 0x7a6a58];

export class People {
  constructor(scene, count) {
    this.scene = scene;
    this.count = count;
    this.list = [];
  }
  build() {
    const routes = REG.people.map((r) => (r.pts ? r : { pts: r, w: 6 }));
    if (!routes.length) return;
    let s = 4242;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const body = new THREE.CylinderGeometry(0.2, 0.17, 0.75, 8).translate(0, 1.12, 0);
    const legs = new THREE.CylinderGeometry(0.15, 0.12, 0.78, 6).translate(0, 0.39, 0);
    const head = new THREE.SphereGeometry(0.13, 10, 8).translate(0, 1.66, 0);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
    this.body = new THREE.InstancedMesh(body, mat, this.count);
    this.legs = new THREE.InstancedMesh(legs, mat, this.count);
    this.head = new THREE.InstancedMesh(head, mat, this.count);
    for (const m of [this.body, this.legs, this.head]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; this.scene.add(m); }
    const c = new THREE.Color();
    // 按路线长度分配人数
    const lens = routes.map(({ pts: p }) => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; });
    const total = lens.reduce((a, b) => a + b, 0);
    for (let i = 0; i < this.count; i++) {
      let pick = r() * total, ri = 0;
      while (pick > lens[ri] && ri < routes.length - 1) { pick -= lens[ri]; ri++; }
      const p = { route: routes[ri].pts, len: Math.max(1, lens[ri]), d: pick, dir: r() < 0.5 ? 1 : -1, speed: 0.9 + r() * 0.5, off: (r() - 0.5) * routes[ri].w, pause: 0, phase: r() * 10, h: 0.92 + r() * 0.16, x: 0, z: 0, y: 0, yaw: 0 };
      this.list.push(p);
      this.body.setColorAt(i, c.setHex(CLOTHES[Math.floor(r() * CLOTHES.length)]));
      this.legs.setColorAt(i, c.setHex(PANTS[Math.floor(r() * PANTS.length)]));
      this.head.setColorAt(i, c.setHex(r() < 0.7 ? 0x2a211c : 0xd8b48e));
    }
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.sc = new THREE.Vector3();
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
  update(dt) {
    if (!this.body) return;
    const col = REG.col;
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
      p.phase += dt * p.speed * 5.5 * (p.pause > 0 ? 0 : 1);
      const bob = p.pause > 0 ? 0 : Math.abs(Math.sin(p.phase)) * 0.05;
      this.q.setFromAxisAngle(this.v.set(0, 1, 0), yaw);
      this.sc.set(1, p.h, 1);
      this.m.compose(this.v.set(x, p.y + bob, z), this.q, this.sc);
      this.body.setMatrixAt(i, this.m); this.head.setMatrixAt(i, this.m);
      this.sc.set(1, p.h * (1 - (p.pause > 0 ? 0 : Math.abs(Math.sin(p.phase)) * 0.06)), 1);
      this.m.compose(this.v.set(x, p.y, z), this.q, this.sc);
      this.legs.setMatrixAt(i, this.m);
    }
    this.body.instanceMatrix.needsUpdate = true; this.legs.instanceMatrix.needsUpdate = true; this.head.instanceMatrix.needsUpdate = true;
  }
  /** 离某点最近的游客数量（用于人声环境音） */
  near(x, z, r) {
    let n = 0;
    for (const p of this.list) if (Math.abs(p.x - x) < r && Math.abs(p.z - z) < r) n++;
    return n;
  }
}
