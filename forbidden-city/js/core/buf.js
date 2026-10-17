// 几何缓冲与绘制上下文：所有静态建筑按「材质 × 空间分块」合并成少量网格，
// 以控制绘制调用数量。坐标约定：x 向东，y 向上，z 向南（北为 -z），单位米。
import * as THREE from 'three';

const _c = new THREE.Color();

/** 把 0xRRGGBB（sRGB）转换成线性空间的 0..255 三元组，供顶点颜色使用 */
export function rgb(hex, k = 1) {
  _c.setHex(hex);
  return [
    Math.min(255, Math.round(_c.r * 255 * k)),
    Math.min(255, Math.round(_c.g * 255 * k)),
    Math.min(255, Math.round(_c.b * 255 * k)),
  ];
}

export class GeoBuf {
  constructor() {
    this.cap = 1024;
    this.pos = new Float32Array(this.cap * 3);
    this.nor = new Float32Array(this.cap * 3);
    this.uv = new Float32Array(this.cap * 2);
    this.col = new Uint8Array(this.cap * 3);
    this.icap = 2048;
    this.idx = new Uint32Array(this.icap);
    this.nv = 0;
    this.ni = 0;
  }
  reserve(nv, ni) {
    if (this.nv + nv > this.cap) {
      let c = this.cap;
      while (this.nv + nv > c) c *= 2;
      const grow = (a, k) => { const b = new a.constructor(c * k); b.set(a); return b; };
      this.pos = grow(this.pos, 3); this.nor = grow(this.nor, 3);
      this.uv = grow(this.uv, 2); this.col = grow(this.col, 3);
      this.cap = c;
    }
    if (this.ni + ni > this.icap) {
      let c = this.icap;
      while (this.ni + ni > c) c *= 2;
      const b = new Uint32Array(c); b.set(this.idx); this.idx = b; this.icap = c;
    }
  }
  v(x, y, z, nx, ny, nz, u, w, col) {
    const i = this.nv++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.nor[i * 3] = nx; this.nor[i * 3 + 1] = ny; this.nor[i * 3 + 2] = nz;
    this.uv[i * 2] = u; this.uv[i * 2 + 1] = w;
    this.col[i * 3] = col[0]; this.col[i * 3 + 1] = col[1]; this.col[i * 3 + 2] = col[2];
    return i;
  }
  tri(a, b, c) { this.idx[this.ni++] = a; this.idx[this.ni++] = b; this.idx[this.ni++] = c; }
  toGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos.slice(0, this.nv * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor.slice(0, this.nv * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv.slice(0, this.nv * 2), 2));
    g.setAttribute('color', new THREE.BufferAttribute(this.col.slice(0, this.nv * 3), 3, true));
    g.setIndex(new THREE.BufferAttribute(this.idx.slice(0, this.ni), 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

const WHITE = [255, 255, 255];

/**
 * 绘制上下文：维护一个「平移 + 绕 Y 轴旋转」的局部坐标系。
 * 建筑都在局部坐标里描述（正面朝 +z），再整体放到世界里。
 */
export class Builder {
  constructor(chunkSize = 240) {
    this.chunkSize = chunkSize;
    this.bufs = new Map();
    this.tx = 0; this.ty = 0; this.tz = 0; this.rot = 0; this.c = 1; this.s = 0;
    this.stack = [];
    this.chunk = '0,0';
    this.detail = 1;
    this.tris = 0;
  }
  setTransform(x, y, z, rot = 0) {
    this.tx = x; this.ty = y; this.tz = z; this.rot = rot;
    this.c = Math.cos(rot); this.s = Math.sin(rot);
    return this;
  }
  /** 开始一个新对象：决定它属于哪个空间分块 */
  at(x, y, z, rot = 0) {
    this.setTransform(x, y, z, rot);
    const cs = this.chunkSize;
    this.chunk = Math.floor(x / cs) + ',' + Math.floor(z / cs);
    return this;
  }
  push() { this.stack.push([this.tx, this.ty, this.tz, this.rot]); return this; }
  pop() { const t = this.stack.pop(); this.setTransform(t[0], t[1], t[2], t[3]); return this; }
  /** 在当前局部坐标系里再嵌套一层 */
  sub(lx, ly, lz, r = 0) {
    const [x, y, z] = this.P(lx, ly, lz);
    this.setTransform(x, y, z, this.rot + r);
    return this;
  }
  P(lx, ly, lz) {
    return [this.tx + this.c * lx + this.s * lz, this.ty + ly, this.tz - this.s * lx + this.c * lz];
  }
  N(nx, ny, nz) {
    return [this.c * nx + this.s * nz, ny, -this.s * nx + this.c * nz];
  }
  buf(mat) {
    const key = mat + '|' + this.chunk;
    let b = this.bufs.get(key);
    if (!b) { b = new GeoBuf(); b.mat = mat; this.bufs.set(key, b); }
    return b;
  }

  /** 四边形（局部坐标，逆时针为正面）。uvs 为 4 个 [u,v]。 */
  quad(mat, p0, p1, p2, p3, uvs, col = WHITE) {
    const b = this.buf(mat);
    b.reserve(4, 6);
    const w0 = this.P(...p0), w1 = this.P(...p1), w2 = this.P(...p2), w3 = this.P(...p3);
    const ax = w1[0] - w0[0], ay = w1[1] - w0[1], az = w1[2] - w0[2];
    const bx = w3[0] - w0[0], by = w3[1] - w0[1], bz = w3[2] - w0[2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-10) { nx = 0; ny = 1; nz = 0; } else { nx /= l; ny /= l; nz /= l; }
    const i0 = b.v(...w0, nx, ny, nz, uvs[0][0], uvs[0][1], col);
    const i1 = b.v(...w1, nx, ny, nz, uvs[1][0], uvs[1][1], col);
    const i2 = b.v(...w2, nx, ny, nz, uvs[2][0], uvs[2][1], col);
    const i3 = b.v(...w3, nx, ny, nz, uvs[3][0], uvs[3][1], col);
    b.tri(i0, i1, i2); b.tri(i0, i2, i3);
    this.tris += 2;
  }

  /**
   * 盒子。中心 (cx, cy0 底面, cz)，尺寸 sx, sy, sz。
   * o.uv: 'm'（按米平铺，默认）| 'unit'（每面 0..1）
   * o.us: 平铺比例；o.skip: 跳过的面，如 'b'（底面）'t' 'n' 's' 'e' 'w'
   * o.taper: 顶面相对底面在 x/z 方向的收分（米）
   */
  box(mat, cx, cy, cz, sx, sy, sz, o = {}) {
    const col = o.col || WHITE;
    const us = o.us || 1;
    const unit = o.uv === 'unit';
    const skip = o.skip || 'b';
    const tx = o.tx || 0, tz = o.tz || 0;
    const x0 = cx - sx / 2, x1 = cx + sx / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
    const y0 = cy, y1 = cy + sy;
    const X0 = x0 + tx, X1 = x1 - tx, Z0 = z0 + tz, Z1 = z1 - tz;
    const U = (a, b) => unit ? [a, b] : [a * us, b * us];
    // 南面 +z
    if (!skip.includes('s')) this.quad(mat, [x0, y0, z1], [x1, y0, z1], [X1, y1, Z1], [X0, y1, Z1],
      unit ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [U(x0, y0), U(x1, y0), U(x1, y1), U(x0, y1)], col);
    // 北面 -z
    if (!skip.includes('n')) this.quad(mat, [x1, y0, z0], [x0, y0, z0], [X0, y1, Z0], [X1, y1, Z0],
      unit ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [U(-x1, y0), U(-x0, y0), U(-x0, y1), U(-x1, y1)], col);
    // 东面 +x
    if (!skip.includes('e')) this.quad(mat, [x1, y0, z1], [x1, y0, z0], [X1, y1, Z0], [X1, y1, Z1],
      unit ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [U(-z1, y0), U(-z0, y0), U(-z0, y1), U(-z1, y1)], col);
    // 西面 -x
    if (!skip.includes('w')) this.quad(mat, [x0, y0, z0], [x0, y0, z1], [X0, y1, Z1], [X0, y1, Z0],
      unit ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [U(z0, y0), U(z1, y0), U(z1, y1), U(z0, y1)], col);
    // 顶面
    if (!skip.includes('t')) this.quad(mat, [X0, y1, Z1], [X1, y1, Z1], [X1, y1, Z0], [X0, y1, Z0],
      unit ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [U(X0, -Z1), U(X1, -Z1), U(X1, -Z0), U(X0, -Z0)], col);
    if (!skip.includes('b')) this.quad(mat, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
      unit ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [U(x0, z0), U(x1, z0), U(x1, z1), U(x0, z1)], col);
  }

  /** 圆柱/圆台，底面中心 (cx, y0, cz) */
  cyl(mat, cx, y0, cz, r0, r1, h, seg = 8, o = {}) {
    const col = o.col || WHITE;
    const b = this.buf(mat);
    seg = Math.max(5, Math.round(seg * (o.noDetail ? 1 : Math.sqrt(this.detail))));
    b.reserve((seg + 1) * 2 + (o.cap ? seg + 2 : 0), seg * 6 + (o.cap ? seg * 3 : 0));
    const base = b.nv;
    const slope = (r0 - r1) / h;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const n = this.N(ca, slope, sa);
      const nl = Math.hypot(...n);
      const p0 = this.P(cx + ca * r0, y0, cz + sa * r0);
      const p1 = this.P(cx + ca * r1, y0 + h, cz + sa * r1);
      const u = (i / seg) * (o.uScale || 1);
      b.v(...p0, n[0] / nl, n[1] / nl, n[2] / nl, u, 0, col);
      b.v(...p1, n[0] / nl, n[1] / nl, n[2] / nl, u, (o.vScale || 1), col);
    }
    for (let i = 0; i < seg; i++) {
      const a = base + i * 2;
      b.tri(a, a + 1, a + 2); b.tri(a + 1, a + 3, a + 2);
    }
    this.tris += seg * 2;
    if (o.cap) {
      const c = b.v(...this.P(cx, y0 + h, cz), 0, 1, 0, 0.5, 0.5, col);
      const s0 = b.nv;
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        b.v(...this.P(cx + Math.cos(a) * r1, y0 + h, cz + Math.sin(a) * r1), 0, 1, 0, 0.5 + Math.cos(a) / 2, 0.5 + Math.sin(a) / 2, col);
      }
      for (let i = 0; i < seg; i++) b.tri(c, s0 + i + 1, s0 + i);
      this.tris += seg;
    }
  }

  /** 球/椭球（低面数） */
  sphere(mat, cx, cy, cz, rx, ry, rz, seg = 8, col = WHITE) {
    const b = this.buf(mat);
    const rows = Math.max(3, Math.round(seg / 2)), cols = seg;
    b.reserve((rows + 1) * (cols + 1), rows * cols * 6);
    const base = b.nv;
    for (let i = 0; i <= rows; i++) {
      const t = (i / rows) * Math.PI, st = Math.sin(t), ct = Math.cos(t);
      for (let j = 0; j <= cols; j++) {
        const p = (j / cols) * Math.PI * 2;
        const nx = st * Math.cos(p), ny = ct, nz = st * Math.sin(p);
        const n = this.N(nx / rx, ny / ry, nz / rz); const l = Math.hypot(...n);
        b.v(...this.P(cx + nx * rx, cy + ny * ry, cz + nz * rz), n[0] / l, n[1] / l, n[2] / l, j / cols, 1 - i / rows, col);
      }
    }
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const a = base + i * (cols + 1) + j, c = a + cols + 1;
      b.tri(a, a + 1, c); b.tri(a + 1, c + 1, c);
    }
    this.tris += rows * cols * 2;
  }

  /**
   * 参数化网格面。fn(i, j) 返回局部坐标 [x,y,z]，uvf(i,j,p) 返回 [u,v]。
   * ref: 期望法线大致方向（世界坐标），用于确定绕序。
   */
  grid(mat, rows, cols, fn, uvf, col = WHITE, ref = [0, 1, 0], colf = null) {
    const b = this.buf(mat);
    const W = cols + 1, H = rows + 1;
    b.reserve(W * H, rows * cols * 6);
    const P = new Array(W * H);
    for (let i = 0; i < H; i++) for (let j = 0; j < W; j++) P[i * W + j] = this.P(...fn(i, j));
    // 法线：中心差分
    const base = b.nv;
    let flip = false, decided = false;
    for (let i = 0; i < H; i++) for (let j = 0; j < W; j++) {
      const a = P[i * W + Math.min(j + 1, cols)], c = P[i * W + Math.max(j - 1, 0)];
      const d = P[Math.min(i + 1, rows) * W + j], e = P[Math.max(i - 1, 0) * W + j];
      const ux = a[0] - c[0], uy = a[1] - c[1], uz = a[2] - c[2];
      const vx = d[0] - e[0], vy = d[1] - e[1], vz = d[2] - e[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz);
      if (l < 1e-9) { const rl = Math.hypot(ref[0], ref[1], ref[2]) || 1; nx = ref[0] / rl; ny = ref[1] / rl; nz = ref[2] / rl; } else { nx /= l; ny /= l; nz /= l; }
      if (!decided && l > 1e-9) { flip = nx * ref[0] + ny * ref[1] + nz * ref[2] < 0; decided = true; }
      if (flip) { nx = -nx; ny = -ny; nz = -nz; }
      const p = P[i * W + j];
      const uv = uvf(i, j, p);
      b.v(p[0], p[1], p[2], nx, ny, nz, uv[0], uv[1], colf ? colf(i, j) : col);
    }
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const a = base + i * W + j, bb = a + 1, c = a + W, d = c + 1;
      // (bb-a)×(c-a) = u×v，与未翻转的法线同向
      if (!flip) { b.tri(a, bb, c); b.tri(bb, d, c); } else { b.tri(a, c, bb); b.tri(bb, c, d); }
    }
    this.tris += rows * cols * 2;
  }

  /** 沿折线扫掠的矩形截面条（屋脊）。pts 为局部坐标点列，w 宽，h 高（向上） */
  ridge(mat, pts, w, h, col = WHITE, o = {}) {
    if (pts.length < 2) return;
    const b = this.buf(mat);
    const n = pts.length;
    b.reserve(n * 6, (n - 1) * 18);
    const W = pts.map((p) => this.P(...p));
    const rings = [];
    for (let i = 0; i < n; i++) {
      const a = W[Math.max(0, i - 1)], c = W[Math.min(n - 1, i + 1)];
      let dx = c[0] - a[0], dy = c[1] - a[1], dz = c[2] - a[2];
      const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
      // side = d × up
      let sx = -dz, sz = dx; const sl = Math.hypot(sx, sz) || 1; sx /= sl; sz /= sl;
      const p = W[i];
      const hw = w / 2;
      rings.push([
        [p[0] - sx * hw, p[1] - h * 0.25, p[2] - sz * hw],
        [p[0] - sx * hw * 0.9, p[1] + h, p[2] - sz * hw * 0.9],
        [p[0] + sx * hw * 0.9, p[1] + h, p[2] + sz * hw * 0.9],
        [p[0] + sx * hw, p[1] - h * 0.25, p[2] + sz * hw],
        [sx, sz],
      ]);
    }
    const col2 = o.col2 || col;
    const face = (A, B, C, D, cc, ox, oy, oz) => {
      const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
      const vx = D[0] - A[0], vy = D[1] - A[1], vz = D[2] - A[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz);
      if (l < 1e-10) {
        const ol = Math.hypot(ox, oy, oz);
        if (ol < 1e-10) { nx = 0; ny = 1; nz = 0; } else { nx = ox / ol; ny = oy / ol; nz = oz / ol; }
      } else { nx /= l; ny /= l; nz /= l; }
      const out = nx * ox + ny * oy + nz * oz >= 0;
      if (!out) { nx = -nx; ny = -ny; nz = -nz; }
      const i0 = b.v(...A, nx, ny, nz, 0, 0, cc), i1 = b.v(...B, nx, ny, nz, 1, 0, cc);
      const i2 = b.v(...C, nx, ny, nz, 1, 1, cc), i3 = b.v(...D, nx, ny, nz, 0, 1, cc);
      // (B-A)×(D-A) 即 n；三角 (A,B,C)/(A,C,D) 的法线与其同向
      if (out) { b.tri(i0, i1, i2); b.tri(i0, i2, i3); } else { b.tri(i0, i2, i1); b.tri(i0, i3, i2); }
    };
    for (let i = 0; i < n - 1; i++) {
      const r0 = rings[i], r1 = rings[i + 1];
      const p = W[i], q = W[i + 1];
      const cx = (p[0] + q[0]) / 2, cy = (p[1] + q[1]) / 2 + h * 0.35, cz = (p[2] + q[2]) / 2;
      for (let k = 0; k < 3; k++) {
        const A = r0[k], B = r0[k + 1], C = r1[k + 1], D = r1[k];
        const fx = (A[0] + B[0] + C[0] + D[0]) / 4 - cx, fy = (A[1] + B[1] + C[1] + D[1]) / 4 - cy, fz = (A[2] + B[2] + C[2] + D[2]) / 4 - cz;
        face(A, B, C, D, k === 1 ? col : col2, fx, fy, fz);
      }
    }
    this.tris += (n - 1) * 6;
    // 端头封口
    const e0 = W[0], e1 = W[n - 1];
    const dx = e1[0] - e0[0], dy = e1[1] - e0[1], dz = e1[2] - e0[2];
    face(rings[0][0], rings[0][1], rings[0][2], rings[0][3], col2, -dx, -dy, -dz);
    face(rings[n - 1][0], rings[n - 1][1], rings[n - 1][2], rings[n - 1][3], col2, dx, dy, dz);
  }

  /** 平面多边形（三角扇/耳切），pts 为局部坐标点列，holes 可选 */
  poly(mat, pts, normal, uvf, col = WHITE, holes = []) {
    const b = this.buf(mat);
    // 投影到 2D：根据法线主轴
    const ax = Math.abs(normal[0]), ay = Math.abs(normal[1]), az = Math.abs(normal[2]);
    const pr = ay >= ax && ay >= az ? (p) => new THREE.Vector2(p[0], p[2])
      : ax >= az ? (p) => new THREE.Vector2(p[2], p[1]) : (p) => new THREE.Vector2(p[0], p[1]);
    const contour = pts.map(pr);
    const hs = holes.map((h) => h.map(pr));
    const tris = THREE.ShapeUtils.triangulateShape(contour, hs);
    const all = pts.concat(...holes);
    b.reserve(all.length, tris.length * 3);
    const n = this.N(...normal);
    const base = b.nv;
    for (const p of all) b.v(...this.P(...p), n[0], n[1], n[2], ...uvf(p), col);
    // 根据法线确定绕序
    for (const t of tris) {
      const A = all[t[0]], B = all[t[1]], C = all[t[2]];
      const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
      const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (nx * normal[0] + ny * normal[1] + nz * normal[2] >= 0) b.tri(base + t[0], base + t[1], base + t[2]);
      else b.tri(base + t[0], base + t[2], base + t[1]);
    }
    this.tris += tris.length;
  }

  /** 把所有缓冲转换成网格，返回 Group */
  build(materials, opts = {}) {
    const group = new THREE.Group();
    for (const b of this.bufs.values()) {
      if (b.nv === 0) continue;
      const mat = materials[b.mat];
      if (!mat) { console.warn('missing material', b.mat); continue; }
      const mesh = new THREE.Mesh(b.toGeometry(), mat);
      const shadowless = opts.noShadow && opts.noShadow.includes(b.mat);
      mesh.castShadow = !shadowless;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.name = b.mat;
      group.add(mesh);
    }
    this.bufs.clear();
    return group;
  }
}
