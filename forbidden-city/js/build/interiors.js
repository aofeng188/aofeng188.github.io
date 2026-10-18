// 可进入建筑的室内陈设：宝座台、宝座、屏风、藻井、匾额、陈设。
import { rgb } from '../core/buf.js';
import { plaque, wblock, wfill, wrampZ } from './hall.js';

/**
 * info: { x, y(台明顶面世界高度), z, rot, W, D, fz(前檐墙局部 z), yC(室内顶高，相对台明) }
 * kind: 'taihedian' | 'qianqinggong' | 'yangxindian'
 */
export function furnish(B, kind, info, plaques) {
  B.at(info.x, info.y, info.z, info.rot || 0);
  const gold = rgb(0xe3b24a), lacquer = rgb(0x8e1d12);
  const D = info.D;
  const big = kind === 'taihedian';
  const s = big ? 1 : kind === 'qianqinggong' ? 0.82 : 0.6;
  const backZ = -D / 2 + (big ? 6.5 : 4.5) * s;
  // 宝座台（地平）
  const pw = 10 * s, pd = 7 * s, ph = (big ? 1.6 : 1.1) * s;
  B.box('inner', 0, 0, backZ, pw, ph, pd, { col: lacquer });
  B.box('innerGold', 0, ph - 0.08, backZ, pw + 0.2, 0.12, pd + 0.2, { col: gold });
  // 台前阶梯
  const n = big ? 7 : 5;
  for (let k = 0; k < n; k++) {
    const h = ((k + 1) / n) * ph;
    B.box('inner', 0, 0, backZ + pd / 2 + (n - k - 0.5) * 0.32, 3.2 * s, h, 0.32, { col: k % 2 ? lacquer : rgb(0x7a1a10) });
  }
  // 宝座台栏杆（金漆）
  for (const sx of [-1, 1]) {
    B.box('innerGold', sx * (pw / 2 - 0.1), ph, backZ, 0.12, 0.7 * s, pd, { col: gold });
    B.box('innerGold', sx * (pw / 4 + 0.9 * s), ph, backZ + pd / 2 - 0.1, pw / 2 - 1.8 * s, 0.7 * s, 0.12, { col: gold });
  }
  // 宝座
  const ty = ph, tz = backZ - 0.6 * s;
  B.box('innerGold', 0, ty, tz, 2.6 * s, 0.9 * s, 1.6 * s, { col: gold });
  B.box('innerGold', 0, ty + 0.9 * s, tz - 0.7 * s, 2.6 * s, 1.9 * s, 0.25 * s, { col: gold });
  for (const sx of [-1, 1]) {
    B.box('innerGold', sx * 1.25 * s, ty + 0.9 * s, tz, 0.2 * s, 0.75 * s, 1.5 * s, { col: gold });
    B.cyl('innerGold', sx * 0.95 * s, ty + 2.75 * s, tz - 0.7 * s, 0.14 * s, 0.05 * s, 0.6 * s, 6, { col: gold });
  }
  B.box('inner', 0, ty + 0.9 * s, tz + 0.05, 2.0 * s, 0.1, 1.2 * s, { col: rgb(0xd9a826) });
  // 屏风（七扇）
  const sz = backZ - pd / 2 + 0.4;
  for (let i = -3; i <= 3; i++) {
    const hh = (3.6 - Math.abs(i) * 0.35) * s;
    B.box('innerGold', i * 1.25 * s, ph, sz, 1.2 * s, hh, 0.25, { col: rgb(i === 0 ? 0xf0c45a : 0xd9a63e) });
    B.box('innerGold', i * 1.25 * s, ph + hh, sz, 0.5 * s, 0.5 * s, 0.2, { col: gold });
  }
  // 陈设：香筒、甪端、仙鹤
  for (const sx of [-1, 1]) {
    B.cyl('innerGold', sx * 2.6 * s, ph, backZ + 1.6 * s, 0.25 * s, 0.25 * s, 1.6 * s, 8, { col: rgb(0x3e7a8a) });
    B.box('innerGold', sx * 3.5 * s, ph, backZ + 0.8 * s, 0.6 * s, 0.9 * s, 1.0 * s, { col: gold });
    B.cyl('innerGold', sx * 4.2 * s, ph, backZ - 0.8 * s, 0.05, 0.05, 1.0 * s, 5, { col: gold });
    B.sphere('innerGold', sx * 4.2 * s, ph + 1.3 * s, backZ - 0.8 * s, 0.25 * s, 0.25 * s, 0.4 * s, 8, gold);
    B.cyl('innerGold', sx * 4.2 * s, ph + 1.4 * s, backZ - 0.6 * s, 0.05, 0.04, 0.6 * s, 5, { col: gold });
  }
  // 藻井与轩辕镜（太和殿、乾清宫）
  if (kind !== 'yangxindian') {
    const yc = info.yC - 0.02;
    const zz = backZ + 1.2 * s;
    for (let r = 0; r < 4; r++) {
      const rad = (5.2 - r * 1.1) * s;
      B.cyl('innerGold', 0, yc - 0.35 - r * 0.0, zz, rad, rad, 0.35, 8, { col: r % 2 ? rgb(0x2e6b8a) : gold });
    }
    B.cyl('innerGold', 0, yc - 0.9, zz, 1.0 * s, 1.0 * s, 0.6, 12, { col: gold, cap: false });
    if (big) {
      // 蟠龙口衔宝珠
      B.sphere('innerGold', 0, yc - 1.4, zz, 0.9, 0.5, 1.3, 10, gold);
      B.cyl('innerGold', 0, yc - 2.6, zz + 0.4, 0.02, 0.02, 1.4, 4, { col: gold });
      B.sphere('innerGold', 0, yc - 2.9, zz + 0.4, 0.45, 0.45, 0.45, 12, rgb(0xd8dde2));
    }
  }
  // 匾额
  const pkey = { taihedian: '建极绥猷', qianqinggong: '正大光明', yangxindian: '中正仁和' }[kind];
  if (plaques && plaques[pkey]) {
    B.push(); B.sub(0, 0, 0, 0);
    plaque(B, plaques[pkey], 0, Math.min(info.yC - 1.6, ph + 5.6 * s + 1.4), sz - 0.6 + 0.02, 5.2 * s);
    B.pop();
  }
  // 碰撞：宝座台（可从前方台阶登上）
  wfill(B, -pw / 2, backZ - pd / 2, pw / 2, backZ + pd / 2, ph);
  wrampZ(B, -1.6 * s, backZ + pd / 2, 1.6 * s, backZ + pd / 2 + n * 0.32, ph, 0);
  wblock(B, -pw / 2 - 0.3, backZ - pd / 2 - 1.5, pw / 2 + 0.3, backZ - pd / 2 + 0.6);
  wblock(B, -1.5 * s, tz - 0.9 * s, 1.5 * s, tz + 0.9 * s);
  for (const sx of [-1, 1]) wblock(B, sx * (pw / 2 - 0.25), backZ - pd / 2, sx * (pw / 2 + 0.05), backZ + pd / 2);
}
