// 实体包围盒查询：相机不得进入实体；标签被实体挡住时隐藏。
import { REG } from './registry.js';

function slab(b, ox, oy, oz, dx, dy, dz) {
  let t0 = -Infinity, t1 = Infinity;
  const o = [ox, oy, oz], d = [dx, dy, dz];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) {
      if (o[a] < b.min[a] || o[a] > b.max[a]) return null;
      continue;
    }
    let ta = (b.min[a] - o[a]) / d[a], tb = (b.max[a] - o[a]) / d[a];
    if (ta > tb) { const t = ta; ta = tb; tb = t; }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return null;
  }
  return [t0, t1];
}

export function inside(b, x, y, z, pad = 0) {
  return x > b.min[0] - pad && x < b.max[0] + pad && y > b.min[1] - pad && y < b.max[1] + pad && z > b.min[2] - pad && z < b.max[2] + pad;
}

/** 点是否在任一实体内 */
export function solidAt(x, y, z, pad = 0) {
  for (const b of REG.solids) if (inside(b, x, y, z, pad)) return b;
  return null;
}

/**
 * 轨道相机：从注视点沿方向 (dx,dy,dz) 出发，返回相机可用的距离区间。
 * 注视点落在其平面范围内的实体（包括可进入殿宇的屋顶部分，注视点在殿内时）要求相机在其外侧（最小距离）；
 * 其余实体要求相机停在它们前面（最大距离）。
 */
export function clampOrbit(tx, ty, tz, dx, dy, dz, dist) {
  let minD = 0, maxD = dist;
  for (const b of REG.solids) {
    const r = slab(b, tx, ty, tz, dx, dy, dz);
    if (!r || r[1] < 0) continue;
    const over = tx > b.min[0] && tx < b.max[0] && tz > b.min[2] && tz < b.max[2] && ty < b.max[1];
    if (r[0] <= 0 || over) minD = Math.max(minD, r[1] + 2);
    else if (r[0] < maxD) maxD = Math.max(0, r[0] - 1);
  }
  return maxD >= minD ? maxD : minD;
}

/** 从 a 到 p 的视线是否被实体挡住（忽略 id 相同或包含 p 的实体） */
export function occluded(ax, ay, az, px, py, pz, id) {
  const dx = px - ax, dy = py - ay, dz = pz - az;
  const L = Math.hypot(dx, dy, dz);
  if (L < 1) return false;
  const ux = dx / L, uy = dy / L, uz = dz / L;
  for (const b of REG.solids) {
    if (id && b.id === id) continue;
    if (inside(b, px, py, pz, 0.5)) continue;
    const r = slab(b, ax, ay, az, ux, uy, uz);
    if (r && r[0] > 0.5 && r[0] < L - 2) return true;
  }
  return false;
}
