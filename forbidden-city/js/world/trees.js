// 树木：实例化渲染。树冠由若干带透明叶片贴图的面片组成，颜色随四季变化。
import * as THREE from 'three';
import { foliageTexture } from '../core/textures.js';
import { enhance } from '../core/materials.js';

// 每个树种：树冠形状、贴图、四季颜色（null 表示落叶）
export const SPECIES = {
  cypress: { name: '古柏', crown: 'cone', tex: 'needle', h: [10, 15], r: [2.2, 3.0], trunk: 0x5a4636,
    colors: { spring: 0x3f5a35, summer: 0x34502d, autumn: 0x3b5230, winter: 0x404a33 } },
  pine: { name: '油松', crown: 'oval', tex: 'needle', h: [7, 11], r: [3.4, 4.6], trunk: 0x5c4434,
    colors: { spring: 0x3c5a34, summer: 0x31502c, autumn: 0x39532f, winter: 0x3e4a32 } },
  huai: { name: '国槐', crown: 'round', tex: 'broad', h: [9, 14], r: [4, 6], trunk: 0x4d4036,
    colors: { spring: 0x8fb05a, summer: 0x4f7a34, autumn: 0xa9a046, winter: null } },
  ginkgo: { name: '银杏', crown: 'oval', tex: 'broad', h: [12, 18], r: [3.5, 5], trunk: 0x5a4a3c,
    colors: { spring: 0x9cc25e, summer: 0x5e8a3a, autumn: 0xf0c22a, winter: null } },
  willow: { name: '垂柳', crown: 'droop', tex: 'willow', h: [9, 12], r: [4, 5.5], trunk: 0x56483a,
    colors: { spring: 0xb6cf6a, summer: 0x6f9a44, autumn: 0xb9a654, winter: null } },
  crabapple: { name: '海棠', crown: 'round', tex: 'broad', h: [4, 6], r: [2, 3], trunk: 0x5a4034,
    colors: { spring: 0xf4b3c2, summer: 0x5a8a3c, autumn: 0xc8642e, winter: null } },
  magnolia: { name: '玉兰', crown: 'oval', tex: 'broad', h: [5, 8], r: [2.2, 3.2], trunk: 0x6a5a4c,
    colors: { spring: 0xf6f0e6, summer: 0x5c8a3e, autumn: 0x8a7a40, winter: null } },
};

/** 树冠轮廓：归一化高度 t（0 底，1 顶）处的半径（树冠半径为 1） */
const PROFILE = {
  cone: (t) => 0.06 + 0.94 * Math.pow(Math.sin(Math.PI * Math.pow(0.06 + 0.94 * t, 0.72)), 0.75),
  round: (t) => Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)),
  oval: (t) => 0.92 * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)),
  flat: (t) => Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)),
  droop: (t) => 0.55 + 0.45 * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)),
};

/**
 * 树冠几何：叶片面片沿树冠表面朝外排布（避免侧看成一个个椭圆），
 * 内部加一个深色实心芯填补缝隙；顶点颜色上亮下暗，表现体积。
 */
function crownGeometry(kind, seed) {
  let s = seed;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const prof = PROFILE[kind] || PROFILE.round;
  const quads = kind === 'cone' ? 64 : kind === 'droop' ? 54 : 58;
  const pos = [], nor = [], uv = [], col = [], idx = [];
  const size = kind === 'droop' ? 0.5 : kind === 'cone' ? 0.42 : 0.52;
  for (let q = 0; q < quads; q++) {
    const t = kind === 'cone' ? Math.pow(r(), 0.85) : 0.08 + r() * 0.86;
    const a = r() * Math.PI * 2;
    const rr = prof(t) * (0.78 + 0.26 * r());
    const cx = Math.cos(a) * rr, cz = Math.sin(a) * rr, cy = t;
    // 外法线（近似椭球法线，带一点向上）
    let nx = Math.cos(a), ny = (t - 0.5) * 1.2 + 0.25, nz = Math.sin(a);
    const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    // 与法线垂直的两个切向量
    let ux = -nz, uy = 0, uz = nx;
    const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
    let vx = ny * uz - nz * uy, vy = nz * ux - nx * uz, vz = nx * uy - ny * ux;
    const roll = (r() - 0.5) * 1.2, cr = Math.cos(roll), sr = Math.sin(roll);
    const Ux = ux * cr + vx * sr, Uy = uy * cr + vy * sr, Uz = uz * cr + vz * sr;
    const Vx = vx * cr - ux * sr, Vy = vy * cr - uy * sr, Vz = vz * cr - uz * sr;
    const sz = size * (0.8 + r() * 0.45), sv = sz * (kind === 'droop' ? 1.7 : 1);
    const lum = 0.62 + 0.38 * t + (r() - 0.5) * 0.12;
    const base = pos.length / 3;
    for (const [a1, b1] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      pos.push(cx + (Ux * a1 * sz + Vx * b1 * sv) / 2, cy + (Uy * a1 * sz + Vy * b1 * sv) / 2 * 0.62, cz + (Uz * a1 * sz + Vz * b1 * sv) / 2);
      nor.push(nx, ny, nz);
      uv.push((a1 + 1) / 2 * 0.94 + 0.06, (b1 + 1) / 2 * 0.94);
      col.push(lum, lum, lum);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  // 实心芯：低面数的闭合纺锤体（上下收成尖，从树下仰视不会看到空心），贴图取左上角的不透明小块
  const rings = 5, segs = 9;
  const coreBase = pos.length / 3;
  for (let i = 0; i <= rings; i++) {
    const t = 0.12 + (i / rings) * 0.76;
    const rr = prof(t) * (kind === 'cone' ? 0.58 : 0.66);
    for (let j = 0; j <= segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      pos.push(Math.cos(a) * rr, t, Math.sin(a) * rr);
      const ny = (t - 0.5) * 1.2; const l = Math.hypot(1, ny);
      nor.push(Math.cos(a) / l, ny / l, Math.sin(a) / l);
      uv.push(0.02, 0.98);
      const lum = 0.5 + 0.3 * t;
      col.push(lum, lum, lum);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) {
    const a = coreBase + i * (segs + 1) + j, b = a + segs + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const bot = pos.length / 3;
  pos.push(0, 0.03, 0, 0, 0.97, 0); nor.push(0, -1, 0, 0, 1, 0); uv.push(0.02, 0.98, 0.02, 0.98); col.push(0.42, 0.42, 0.42, 0.8, 0.8, 0.8);
  const topRing = coreBase + rings * (segs + 1);
  for (let j = 0; j < segs; j++) {
    idx.push(bot, coreBase + j, coreBase + j + 1);
    idx.push(bot + 1, topRing + j + 1, topRing + j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

export class Trees {
  constructor(scene) {
    this.scene = scene;
    this.list = []; // {sp, x, y, z, h, r, rot}
    this.groups = {};
    this.tex = {};
  }
  add(sp, x, z, y = 0, scale = 1) {
    this.list.push({ sp, x, y, z, scale });
  }
  /** 在矩形内随机种树，避开回调返回 false 的位置 */
  scatter(sp, x0, z0, x1, z1, n, y = 0, ok = null, seed = 1) {
    let s = seed * 9301 + 49297;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    let tries = 0;
    for (let i = 0; i < n && tries < n * 6; tries++) {
      const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
      if (ok && !ok(x, z)) continue;
      this.add(typeof sp === 'function' ? sp(r()) : sp, x, z, typeof y === 'function' ? y(x, z) : y, 0.8 + r() * 0.45);
      i++;
    }
  }
  build(quality) {
    const keep = quality.trees ?? 1;
    let s = 77;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const bySp = {};
    for (const t of this.list) { if (r() > keep) continue; (bySp[t.sp] ||= []).push(t); }
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 1, 6, 1, true).translate(0, 0.5, 0);
    const trunkMat = enhance(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), { snowAt: 0.6 });
    for (const [spName, arr] of Object.entries(bySp)) {
      const sp = SPECIES[spName];
      const crownGeo = crownGeometry(sp.crown, spName.length * 131 + 7);
      if (!this.tex[sp.tex]) this.tex[sp.tex] = foliageTexture(sp.tex);
      if (!this.tex.bare) this.tex.bare = foliageTexture('bare');
      const mat = enhance(new THREE.MeshStandardMaterial({ map: this.tex[sp.tex], alphaTest: 0.45, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.85, color: 0xffffff, vertexColors: true }), { snowAt: 0.35, extraKey: 'leaf' });
      const crown = new THREE.InstancedMesh(crownGeo, mat, arr.length);
      const trunk = new THREE.InstancedMesh(trunkGeo, trunkMat, arr.length);
      crown.castShadow = true; crown.receiveShadow = true;
      trunk.castShadow = true; trunk.receiveShadow = true;
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      const tc = new THREE.Color(sp.trunk);
      arr.forEach((t, i) => {
        const h = (sp.h[0] + r() * (sp.h[1] - sp.h[0])) * t.scale;
        const rad = (sp.r[0] + r() * (sp.r[1] - sp.r[0])) * t.scale;
        const trunkH = sp.crown === 'cone' ? h * 0.32 : sp.crown === 'droop' ? h * 0.35 : spName === 'pine' ? h * 0.28 : h * 0.38;
        e.set(0, r() * Math.PI * 2, 0); q.setFromEuler(e);
        m.compose(new THREE.Vector3(t.x, t.y + trunkH * 0.82, t.z), q, new THREE.Vector3(rad, h - trunkH * 0.82, rad));
        crown.setMatrixAt(i, m);
        m.compose(new THREE.Vector3(t.x, t.y - 0.2, t.z), q, new THREE.Vector3(rad * 0.1 + 0.22, trunkH + 0.9, rad * 0.1 + 0.22));
        trunk.setMatrixAt(i, m);
        trunk.setColorAt(i, tc);
        t.var = 0.85 + r() * 0.3;
        t.h = h;
      });
      crown.instanceMatrix.needsUpdate = true; trunk.instanceMatrix.needsUpdate = true;
      crown.computeBoundingSphere(); trunk.computeBoundingSphere();
      this.scene.add(crown); this.scene.add(trunk);
      this.groups[spName] = { crown, trunk, arr, mat, sp };
    }
  }
  setSeason(season) {
    const c = new THREE.Color();
    for (const g of Object.values(this.groups)) {
      const col = g.sp.colors[season];
      const bare = col === null;
      g.mat.map = bare ? this.tex.bare : this.tex[g.sp.tex];
      g.mat.alphaTest = bare ? 0.3 : 0.45;
      g.mat.needsUpdate = true;
      g.arr.forEach((t, i) => {
        if (bare) c.setHex(0x5b4e44).multiplyScalar(t.var);
        else {
          c.setHex(col).multiplyScalar(t.var);
          // 春天开花的树：部分仍是绿叶
          if (season === 'spring' && (g.sp.name === '海棠' || g.sp.name === '玉兰') && t.var > 1.08) c.setHex(0x8fb05a);
          if (season === 'autumn' && g.sp.name === '国槐' && t.var > 1.05) c.setHex(0x7a8a3a);
        }
        g.crown.setColorAt(i, c);
      });
      if (g.crown.instanceColor) g.crown.instanceColor.needsUpdate = true;
    }
  }
  /** 小地图使用 */
  points() { return this.list.map((t) => [t.x, t.z, t.sp]); }
}
