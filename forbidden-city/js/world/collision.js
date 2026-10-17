// 高度网格碰撞：每个格子记录可站立的地面高度（厘米），或标记为不可通行。
// 台基、台阶（坡道）、桥面写入高度；墙体、殿身、水面标记为阻挡。
export const BLOCK = -32768;

export class HeightGrid {
  constructor(x0, z0, x1, z1, res = 0.5) {
    this.x0 = x0; this.z0 = z0; this.res = res;
    this.w = Math.ceil((x1 - x0) / res); this.h = Math.ceil((z1 - z0) / res);
    this.data = new Int16Array(this.w * this.h);
  }
  _range(x0, z0, x1, z1) {
    const r = this.res;
    const i0 = Math.max(0, Math.floor((Math.min(x0, x1) - this.x0) / r));
    const i1 = Math.min(this.w - 1, Math.ceil((Math.max(x0, x1) - this.x0) / r) - 1);
    const j0 = Math.max(0, Math.floor((Math.min(z0, z1) - this.z0) / r));
    const j1 = Math.min(this.h - 1, Math.ceil((Math.max(z0, z1) - this.z0) / r) - 1);
    return [i0, i1, j0, j1];
  }
  fill(x0, z0, x1, z1, h) {
    const [i0, i1, j0, j1] = this._range(x0, z0, x1, z1);
    const v = Math.round(h * 100);
    for (let j = j0; j <= j1; j++) this.data.fill(v, j * this.w + i0, j * this.w + i1 + 1);
  }
  block(x0, z0, x1, z1) {
    const [i0, i1, j0, j1] = this._range(x0, z0, x1, z1);
    for (let j = j0; j <= j1; j++) this.data.fill(BLOCK, j * this.w + i0, j * this.w + i1 + 1);
  }
  /** 坡道：沿 axis 从 h0（坐标较小一端）线性变化到 h1 */
  ramp(x0, z0, x1, z1, axis, h0, h1) {
    const [i0, i1, j0, j1] = this._range(x0, z0, x1, z1);
    const a0 = axis === 'x' ? Math.min(x0, x1) : Math.min(z0, z1);
    const a1 = axis === 'x' ? Math.max(x0, x1) : Math.max(z0, z1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const c = axis === 'x' ? this.x0 + (i + 0.5) * this.res : this.z0 + (j + 0.5) * this.res;
      const t = Math.max(0, Math.min(1, (c - a0) / (a1 - a0)));
      this.data[j * this.w + i] = Math.round((h0 + (h1 - h0) * t) * 100);
    }
  }
  /** 拱桥：中间高两端低 */
  arch(x0, z0, x1, z1, axis, h0, hTop) {
    const [i0, i1, j0, j1] = this._range(x0, z0, x1, z1);
    const a0 = axis === 'x' ? Math.min(x0, x1) : Math.min(z0, z1);
    const a1 = axis === 'x' ? Math.max(x0, x1) : Math.max(z0, z1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const c = axis === 'x' ? this.x0 + (i + 0.5) * this.res : this.z0 + (j + 0.5) * this.res;
      const t = (c - a0) / (a1 - a0);
      this.data[j * this.w + i] = Math.round((h0 + (hTop - h0) * Math.sin(Math.PI * Math.max(0, Math.min(1, t)))) * 100);
    }
  }
  /** 粗线段（水道）：距离线段小于 hw 的格子设为 v */
  capsule(ax, az, bx, bz, hw, v = BLOCK) {
    const [i0, i1, j0, j1] = this._range(Math.min(ax, bx) - hw, Math.min(az, bz) - hw, Math.max(ax, bx) + hw, Math.max(az, bz) + hw);
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = this.x0 + (i + 0.5) * this.res, pz = this.z0 + (j + 0.5) * this.res;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2));
      const qx = ax + dx * t - px, qz = az + dz * t - pz;
      if (qx * qx + qz * qz <= hw * hw) this.data[j * this.w + i] = v;
    }
  }
  /** 多边形扫描线填充（默认标记为阻挡） */
  poly(pts, v = BLOCK) {
    let zmin = Infinity, zmax = -Infinity;
    for (const p of pts) { zmin = Math.min(zmin, p[1]); zmax = Math.max(zmax, p[1]); }
    const j0 = Math.max(0, Math.floor((zmin - this.z0) / this.res)), j1 = Math.min(this.h - 1, Math.ceil((zmax - this.z0) / this.res));
    const val = v === BLOCK ? BLOCK : Math.round(v * 100);
    for (let j = j0; j <= j1; j++) {
      const z = this.z0 + (j + 0.5) * this.res;
      const xs = [];
      for (let i = 0, k = pts.length - 1; i < pts.length; k = i++) {
        const a = pts[i], b = pts[k];
        if ((a[1] > z) !== (b[1] > z)) xs.push(a[0] + ((z - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const i0 = Math.max(0, Math.floor((xs[k] - this.x0) / this.res)), i1 = Math.min(this.w - 1, Math.floor((xs[k + 1] - this.x0) / this.res));
        if (i1 >= i0) this.data.fill(val, j * this.w + i0, j * this.w + i1 + 1);
      }
    }
  }
  /** 任意函数写入高度（景山等地形） */
  fn(x0, z0, x1, z1, f) {
    const [i0, i1, j0, j1] = this._range(x0, z0, x1, z1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = this.x0 + (i + 0.5) * this.res, pz = this.z0 + (j + 0.5) * this.res;
      const h = f(px, pz);
      if (h !== null && h !== undefined) this.data[j * this.w + i] = Math.round(h * 100);
    }
  }
  raw(x, z) {
    const i = Math.floor((x - this.x0) / this.res), j = Math.floor((z - this.z0) / this.res);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return BLOCK;
    return this.data[j * this.w + i];
  }
  /** 返回地面高度（米），不可通行返回 null */
  get(x, z) {
    const v = this.raw(x, z);
    return v === BLOCK ? null : v / 100;
  }
  /** 半径 r 内是否都可站立，且高差不超过 step */
  canStand(x, z, r, curH, step) {
    for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r], [r * 0.7, r * 0.7], [-r * 0.7, r * 0.7], [r * 0.7, -r * 0.7], [-r * 0.7, -r * 0.7]]) {
      const h = this.get(x + dx, z + dz);
      if (h === null || h - curH > step) return null;
    }
    const h0 = this.get(x, z);
    if (h0 === null || h0 - curH > step) return null;
    return h0;
  }
}
