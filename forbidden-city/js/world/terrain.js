// 地面：整片区域底图（Canvas 绘制铺地、草地、道路、建筑阴影），挖出水系，再加河道驳岸与景山。
import * as THREE from 'three';
import { rgb } from '../core/buf.js';
import { enhance } from '../core/materials.js';
import { brickTexture, groundDetailTexture } from '../core/textures.js';
import { REG } from './registry.js';

export const WATER_Y = -1.7;
export const BED_Y = -3.4;

const hex = (h) => '#' + h.toString(16).padStart(6, '0');

export class Terrain {
  constructor(b, px = 2048) {
    this.b = b;
    this.s = px / (b.x1 - b.x0);
    this.W = px; this.H = Math.round((b.z1 - b.z0) * this.s);
    this.c = document.createElement('canvas'); this.c.width = this.W; this.c.height = this.H;
    this.ctx = this.c.getContext('2d');
    this.g = document.createElement('canvas'); this.g.width = Math.round(this.W / 2); this.g.height = Math.round(this.H / 2);
    this.gctx = this.g.getContext('2d');
    this.gctx.fillStyle = '#000'; this.gctx.fillRect(0, 0, this.g.width, this.g.height);
    this.water = [];
    this.hills = [];
  }
  P(x, z) { return [(x - this.b.x0) * this.s, (z - this.b.z0) * this.s]; }
  rect(x0, z0, x1, z1, color, alpha = 1) {
    const [a, b] = this.P(Math.min(x0, x1), Math.min(z0, z1)), [c, d] = this.P(Math.max(x0, x1), Math.max(z0, z1));
    this.ctx.globalAlpha = alpha; this.ctx.fillStyle = hex(color); this.ctx.fillRect(a, b, c - a, d - b); this.ctx.globalAlpha = 1;
  }
  poly(pts, color, alpha = 1) {
    this.ctx.globalAlpha = alpha; this.ctx.fillStyle = hex(color); this.ctx.beginPath();
    pts.forEach(([x, z], i) => { const [a, b] = this.P(x, z); i ? this.ctx.lineTo(a, b) : this.ctx.moveTo(a, b); });
    this.ctx.closePath(); this.ctx.fill(); this.ctx.globalAlpha = 1;
  }
  line(pts, w, color, alpha = 1) {
    this.ctx.globalAlpha = alpha; this.ctx.strokeStyle = hex(color); this.ctx.lineWidth = w * this.s; this.ctx.lineJoin = 'round'; this.ctx.lineCap = 'round';
    this.ctx.beginPath(); pts.forEach(([x, z], i) => { const [a, b] = this.P(x, z); i ? this.ctx.lineTo(a, b) : this.ctx.moveTo(a, b); });
    this.ctx.stroke(); this.ctx.globalAlpha = 1;
  }
  /** 草地蒙版 */
  grass(x0, z0, x1, z1, amt = 1) {
    const k = this.s / 2;
    this.gctx.fillStyle = `rgba(255,255,255,${amt})`;
    this.gctx.fillRect((Math.min(x0, x1) - this.b.x0) * k, (Math.min(z0, z1) - this.b.z0) * k, Math.abs(x1 - x0) * k, Math.abs(z1 - z0) * k);
  }
  grassPoly(pts, amt = 1) {
    const k = this.s / 2;
    this.gctx.fillStyle = `rgba(255,255,255,${amt})`; this.gctx.beginPath();
    pts.forEach(([x, z], i) => { const a = (x - this.b.x0) * k, b = (z - this.b.z0) * k; i ? this.gctx.lineTo(a, b) : this.gctx.moveTo(a, b); });
    this.gctx.closePath(); this.gctx.fill();
  }
  /** 建筑脚下与墙脚的柔和阴影：先画在单独图层，最后统一模糊合成 */
  _aoLayer() {
    if (!this.aoC) {
      this.aoC = document.createElement('canvas'); this.aoC.width = this.W; this.aoC.height = this.H;
      this.aoX = this.aoC.getContext('2d'); this.aoX.fillStyle = '#000'; this.aoX.strokeStyle = '#000';
    }
    return this.aoX;
  }
  ao(x0, z0, x1, z1) {
    const ctx = this._aoLayer();
    const [a, b] = this.P(Math.min(x0, x1), Math.min(z0, z1)), [c, d] = this.P(Math.max(x0, x1), Math.max(z0, z1));
    ctx.fillRect(a, b, c - a, d - b);
  }
  aoLine(x0, z0, x1, z1, w) {
    const ctx = this._aoLayer();
    ctx.lineWidth = w * this.s; ctx.lineCap = 'butt';
    const [a, b] = this.P(x0, z0), [c, d] = this.P(x1, z1);
    ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke();
  }
  flushAO(r = 4, k = 0.36) {
    if (!this.aoC) return;
    this.ctx.save();
    this.ctx.filter = `blur(${Math.max(1, r * this.s)}px)`;
    this.ctx.globalAlpha = k;
    this.ctx.drawImage(this.aoC, 0, 0);
    this.ctx.restore();
    this.aoC = null; this.aoX = null;
  }
  addWater(pts) { this.water.push(pts); if (REG.col) REG.col.poly(pts); }

  build(B) {
    const b = this.b;
    // ---- 地面网格：外框挖去水系 ----
    const shape = new THREE.Shape([new THREE.Vector2(b.x0, b.z0), new THREE.Vector2(b.x1, b.z0), new THREE.Vector2(b.x1, b.z1), new THREE.Vector2(b.x0, b.z1)]);
    for (const w of this.water) shape.holes.push(new THREE.Path(w.map(([x, z]) => new THREE.Vector2(x, z))));
    const geo = new THREE.ShapeGeometry(shape);
    // ShapeGeometry 在 xy 平面；转成 xz（y 向上）
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); pos.setXYZ(i, x, 0, y); }
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - b.x0) / (b.x1 - b.x0), 1 - (pos.getZ(i) - b.z0) / (b.z1 - b.z0));
    // 法线朝上；保证绕序正确
    const idx = geo.index.array;
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    geo.computeVertexNormals();
    geo.computeBoundingSphere();

    const tex = new THREE.CanvasTexture(this.c);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const gtex = new THREE.CanvasTexture(this.g);
    const brick = brickTexture({ bw: 64, bh: 32, mortar: 2, lo: 0.78, hi: 1.0, seed: 61 });
    const detail = groundDetailTexture();
    this.uGrass = { value: new THREE.Color(0x6d7f3e) };
    const mat = enhance(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.93 }), {
      extraKey: 'ground', snowAt: 0.2,
      patch: (sh) => {
        sh.uniforms.tBrick = { value: brick };
        sh.uniforms.tDetail = { value: detail };
        sh.uniforms.tGrass = { value: gtex };
        sh.uniforms.uGrass = this.uGrass;
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform sampler2D tBrick; uniform sampler2D tDetail; uniform sampler2D tGrass; uniform vec3 uGrass;')
          .replace('#include <map_fragment>', `#include <map_fragment>
{
  float gm = texture2D(tGrass, vMapUv).r;
  vec3 bd = texture2D(tBrick, vFcWorld.xz / 4.0).rgb;
  vec3 dd = texture2D(tDetail, vFcWorld.xz / 3.0).rgb;
  float far = smoothstep(120.0, 600.0, length(vFcWorld - cameraPosition));
  vec3 det = mix(bd * 1.08, vec3(0.95), far);
  // 大尺度的斑驳：旧砖新砖、雨水痕迹
  float macro = (texture2D(tDetail, vFcWorld.xz / 53.0).r - 0.72) / 0.28;
  float macro2 = (texture2D(tDetail, vFcWorld.zx / 17.0 + 0.37).r - 0.72) / 0.28;
  diffuseColor.rgb *= 0.84 + 0.2 * macro + 0.08 * macro2;
  diffuseColor.rgb *= mix(det, dd * 1.1, gm);
  diffuseColor.rgb = mix(diffuseColor.rgb, uGrass * (0.75 + 0.5 * dd.r) * (0.6 + 0.4 * texture2D(map, vMapUv).g * 2.0), gm * 0.85);
}`);
      },
    });
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    ground.name = 'ground';
    this.mat = mat;

    // ---- 河道驳岸与河床 ----
    for (const w of this.water) {
      const n = w.length;
      for (let i = 0; i < n; i++) {
        const p = w[i], q = w[(i + 1) % n];
        const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
        const dx = q[0] - p[0], dz = q[1] - p[1];
        const L = Math.hypot(dx, dz) || 1;
        // 法线指向水面一侧
        let nx = -dz / L, nz = dx / L;
        if (!pointInPoly(mx + nx * 0.3, mz + nz * 0.3, w)) { nx = -nx; nz = -nz; }
        B.at(0, 0, 0, 0);
        const quadPts = [[p[0], BED_Y, p[1]], [q[0], BED_Y, q[1]], [q[0], 0.05, q[1]], [p[0], 0.05, p[1]]];
        // quad 法线 = (p1-p0)×(p3-p0) = (dx,0,dz)×(0,h,0) = (-dz·h, 0, dx·h)
        const ok = (-dz * nx + dx * nz) > 0;
        const qp = ok ? quadPts : [quadPts[1], quadPts[0], quadPts[3], quadPts[2]];
        B.quad('marble', qp[0], qp[1], qp[2], qp[3], [[0, 0], [L / 2, 0], [L / 2, 1.8], [0, 1.8]], rgb(0x9d988e));
        // 岸边压面石
        const ox = -nx * 0.7, oz = -nz * 0.7;
        const cq = [[p[0] + ox, 0.06, p[1] + oz], [q[0] + ox, 0.06, q[1] + oz], [q[0], 0.06, q[1]], [p[0], 0.06, p[1]]];
        const cqq = (dz * nx - dx * nz) > 0 ? cq : [cq[1], cq[0], cq[3], cq[2]];
        B.quad('marble', cqq[0], cqq[1], cqq[2], cqq[3], [[0, 0], [L / 2, 0], [L / 2, 0.35], [0, 0.35]], rgb(0xc9c4b8));
      }
      B.at(0, 0, 0, 0);
      B.poly('road', w.map(([x, z]) => [x, BED_Y, z]), [0, 1, 0], (p) => [p[0] / 4, p[2] / 4], rgb(0x3b3a30));
    }
    return ground;
  }

  /** 景山等小山：高度函数 + 网格 */
  hill(x0, z0, x1, z1, f, res = 6) {
    const nx = Math.ceil((x1 - x0) / res), nz = Math.ceil((z1 - z0) / res);
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz).rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + (x0 + x1) / 2, z = p.getZ(i) + (z0 + z1) / 2;
      p.setXYZ(i, x, f(x, z), z);
    }
    g.computeVertexNormals();
    const detail = groundDetailTexture();
    const mat = enhance(new THREE.MeshStandardMaterial({ map: detail, color: 0x8c9a5c, roughness: 0.95 }), { snowAt: 0.15, extraKey: 'hill',
      patch: (sh) => {
        sh.uniforms.uGrass = this.uGrass;
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uGrass;')
          .replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = uGrass * (0.7 + 0.5 * texture2D(map, vFcWorld.xz / 6.0).r);');
      } });
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true; m.castShadow = true;
    if (REG.col) REG.col.fn(x0, z0, x1, z1, (x, z) => { const h = f(x, z); return h > 0.05 ? h : null; });
    this.hills.push({ x0, z0, x1, z1, f });
    return m;
  }
  heightAt(x, z) {
    for (const h of this.hills) if (x >= h.x0 && x <= h.x1 && z >= h.z0 && z <= h.z1) return Math.max(0, h.f(x, z));
    return 0;
  }
}

export function pointInPoly(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], zi = pts[i][1], xj = pts[j][0], zj = pts[j][1];
    if (((zi > z) !== (zj > z)) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** 把折线按宽度展开成闭合多边形（用于河道） */
export function strokePoly(pts, w) {
  const L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    let nx = -dz, nz = dx;
    // 拐角处斜接
    if (i > 0 && i < pts.length - 1) {
      const d1x = p[0] - a[0], d1z = p[1] - a[1], l1 = Math.hypot(d1x, d1z) || 1;
      const n1x = -d1z / l1, n1z = d1x / l1;
      const dot = nx * n1x + nz * n1z;
      const k = 1 / Math.max(0.5, dot);
      nx *= k; nz *= k;
    }
    L.push([p[0] + nx * w / 2, p[1] + nz * w / 2]);
    R.push([p[0] - nx * w / 2, p[1] - nz * w / 2]);
  }
  return L.concat(R.reverse());
}

export function seasonGrass(season) {
  const c = { spring: 0x7d9a45, summer: 0x5f7f34, autumn: 0x9a8a4a, winter: 0x8a8264 }[season];
  return new THREE.Color(c);
}
