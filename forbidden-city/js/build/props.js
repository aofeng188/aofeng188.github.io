// 陈设与小品：狮子、华表、日晷、嘉量、铜龟铜鹤、香炉、铜缸、宫灯、导览牌、九龙壁、五色土。
import { rgb } from '../core/buf.js';
import { C } from '../core/materials.js';
import { REG } from '../world/registry.js';
import { wblock } from './hall.js';

/** 坐狮。mat: 'bronze' | 'marble'；male 脚踩绣球，female 抚幼狮 */
export function lion(B, x, y, z, rot, o = {}) {
  B.at(x, y, z, rot);
  const s = o.scale || 1;
  const mat = o.mat || 'bronze';
  const col = rgb(mat === 'bronze' ? 0x6b5a3e : C.marble, mat === 'bronze' ? 1 : 0.95);
  const baseMat = mat === 'bronze' ? 'marble' : 'marble';
  // 须弥座
  B.box(baseMat, 0, 0, 0, 2.2 * s, 0.5 * s, 3.0 * s, { col: rgb(C.stone) });
  B.box(baseMat, 0, 0.5 * s, 0, 1.9 * s, 0.6 * s, 2.7 * s, { col: rgb(C.marble, 0.95), skip: 'b' });
  B.box(mat === 'bronze' ? 'bronze' : 'marble', 0, 1.1 * s, 0, 2.0 * s, 0.25 * s, 2.8 * s, { col, skip: 'b' });
  const y0 = 1.35 * s;
  // 后腿与臀
  B.sphere(mat, 0, y0 + 0.55 * s, -0.55 * s, 0.85 * s, 0.6 * s, 0.75 * s, 10, col);
  // 胸
  B.sphere(mat, 0, y0 + 1.25 * s, 0.15 * s, 0.7 * s, 0.85 * s, 0.6 * s, 10, col);
  // 前腿
  for (const sx of [-1, 1]) B.cyl(mat, sx * 0.42 * s, y0, 0.55 * s, 0.2 * s, 0.17 * s, 1.2 * s, 7, { col });
  // 头与鬃毛
  B.sphere(mat, 0, y0 + 2.15 * s, 0.35 * s, 0.75 * s, 0.7 * s, 0.6 * s, 10, col);
  B.sphere(mat, 0, y0 + 2.0 * s, 0.82 * s, 0.4 * s, 0.32 * s, 0.32 * s, 8, col);
  for (let i = 0; i < 5; i++) B.sphere(mat, (i - 2) * 0.28 * s, y0 + 2.7 * s, 0.1 * s, 0.17 * s, 0.17 * s, 0.17 * s, 6, col);
  // 绣球 / 幼狮
  const px = o.male ? 0.75 : -0.75;
  if (o.male) B.sphere(mat, px * s, y0 + 0.3 * s, 0.85 * s, 0.32 * s, 0.32 * s, 0.32 * s, 8, col);
  else B.sphere(mat, px * s, y0 + 0.25 * s, 0.8 * s, 0.3 * s, 0.25 * s, 0.38 * s, 8, col);
  if (REG.col && !o.noCollide) wblock(B, -1.2 * s, -1.6 * s, 1.2 * s, 1.6 * s);
}

/** 华表：八角柱身、云板、承露盘、蹲兽 */
export function huabiao(B, x, z, rot = 0, o = {}) {
  B.at(x, o.y || 0, z, rot);
  const col = rgb(C.marble);
  B.box('marble', 0, 0, 0, 3.6, 0.5, 3.6, { col: rgb(C.stone) });
  B.box('marble', 0, 0.5, 0, 3.0, 0.9, 3.0, { col, skip: 'b' });
  // 栏杆
  for (const [a, b, c, d] of [[-1.7, 1.7, 1.7, 1.7], [-1.7, -1.7, 1.7, -1.7], [1.7, -1.7, 1.7, 1.7], [-1.7, -1.7, -1.7, 1.7]]) {
    B.box('marble', (a + c) / 2, 0.5, (b + d) / 2, Math.abs(c - a) + 0.2, 0.9, Math.abs(d - b) + 0.2, { col, skip: 'b' });
  }
  B.cyl('marble', 0, 1.4, 0, 0.55, 0.48, 7.2, 8, { col, noDetail: true });
  // 盘龙（螺旋凸起）
  for (let i = 0; i < 14; i++) {
    const a = i * 0.9, h = 1.8 + i * 0.45;
    B.sphere('marble', Math.cos(a) * 0.5, h, Math.sin(a) * 0.5, 0.25, 0.3, 0.25, 6, col);
  }
  // 云板
  B.box('marble', 0, 7.0, 0, 2.6, 0.7, 0.28, { col });
  // 承露盘与蹲兽
  B.cyl('marble', 0, 8.6, 0, 0.75, 0.9, 0.35, 12, { col, cap: true });
  B.sphere('marble', 0, 9.35, 0, 0.36, 0.45, 0.5, 8, col);
  B.sphere('marble', 0, 9.85, 0.25, 0.25, 0.25, 0.25, 6, col);
  if (REG.col) wblock(B, -1.8, -1.8, 1.8, 1.8);
}

/** 日晷 */
export function sundial(B, x, y, z, rot = 0) {
  B.at(x, y, z, rot);
  const col = rgb(C.marble);
  B.box('marble', 0, 0, 0, 1.6, 0.4, 1.6, { col });
  B.box('marble', 0, 0.4, 0, 1.0, 1.0, 1.0, { col, skip: 'b' });
  // 倾斜的晷盘（向北倾斜，与赤道平行）
  B.push(); B.sub(0, 1.85, 0, 0);
  const r = 0.85, n = 16, tilt = (90 - 40) * Math.PI / 180;
  const pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const px = Math.cos(a) * r, pz = Math.sin(a) * r; pts.push([px, pz * Math.sin(tilt) * 0 + Math.sin(a) * r * Math.cos(tilt), pz * Math.sin(tilt)]); }
  B.poly('marble', pts, [0, Math.sin(tilt), -Math.cos(tilt)], (p) => [p[0], p[2]], rgb(0xf6f2e8));
  B.poly('marble', pts.slice().reverse(), [0, -Math.sin(tilt), Math.cos(tilt)], (p) => [p[0], p[2]], rgb(0xe6e2d8));
  B.cyl('gold', 0, -0.5, 0, 0.03, 0.03, 1.0, 5, { col: rgb(C.gold) });
  B.pop();
  B.box('marble', 0, 1.4, 0, 0.5, 0.5, 0.6, { col, skip: 'b' });
  if (REG.col) wblock(B, -0.9, -0.9, 0.9, 0.9);
}

/** 嘉量：石亭式座上置铜量器 */
export function jialiang(B, x, y, z, rot = 0) {
  B.at(x, y, z, rot);
  const col = rgb(C.marble);
  B.box('marble', 0, 0, 0, 1.5, 1.4, 1.5, { col });
  B.box('marble', 0, 1.4, 0, 1.2, 0.8, 1.2, { col, skip: 'b' });
  B.box('marble', 0, 2.2, 0, 1.8, 0.3, 1.8, { col, skip: 'b', tx: -0.0, tz: 0 });
  B.box('marble', 0, 2.5, 0, 1.2, 0.5, 1.2, { col, skip: 'b', tx: 0.35, tz: 0.35 });
  B.cyl('bronze', 0, 1.45, 0, 0.42, 0.42, 0.7, 12, { col: rgb(0x8a6a3c), cap: true });
  if (REG.col) wblock(B, -0.9, -0.9, 0.9, 0.9);
}

/** 铜鹤 */
export function crane(B, x, y, z, rot = 0) {
  B.at(x, y, z, rot);
  const col = rgb(0x5d4a33);
  B.box('marble', 0, 0, 0, 1.2, 0.6, 1.2, { col: rgb(C.marble) });
  B.cyl('bronze', -0.12, 0.6, 0, 0.05, 0.05, 1.0, 5, { col });
  B.cyl('bronze', 0.12, 0.6, 0, 0.05, 0.05, 1.0, 5, { col });
  B.sphere('bronze', 0, 1.85, 0, 0.36, 0.38, 0.62, 10, col);
  B.cyl('bronze', 0, 2.05, 0.4, 0.07, 0.06, 1.0, 6, { col });
  B.sphere('bronze', 0, 3.1, 0.45, 0.12, 0.12, 0.2, 6, col);
  B.box('bronze', 0, 3.05, 0.65, 0.05, 0.05, 0.3, { col: rgb(0x8a6a3c) });
  if (REG.col) wblock(B, -0.6, -0.6, 0.6, 0.6);
}

/** 铜龟（龙首龟身） */
export function turtle(B, x, y, z, rot = 0) {
  B.at(x, y, z, rot);
  const col = rgb(0x5d4a33);
  B.box('marble', 0, 0, 0, 1.6, 0.6, 2.0, { col: rgb(C.marble) });
  B.sphere('bronze', 0, 0.95, 0, 0.75, 0.42, 0.95, 10, col);
  B.cyl('bronze', 0, 0.9, 0.85, 0.16, 0.14, 0.7, 6, { col });
  B.sphere('bronze', 0, 1.7, 1.0, 0.24, 0.24, 0.32, 8, col);
  if (REG.col) wblock(B, -0.8, -1.0, 0.8, 1.0);
}

/** 鼎式香炉（三足） */
export function censer(B, x, y, z, s = 1) {
  B.at(x, y, z, 0);
  const col = rgb(0x4f3f2c);
  B.box('marble', 0, 0, 0, 1.2 * s, 0.5 * s, 1.2 * s, { col: rgb(C.marble) });
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; B.cyl('bronze', Math.cos(a) * 0.35 * s, 0.5 * s, Math.sin(a) * 0.35 * s, 0.07 * s, 0.07 * s, 0.6 * s, 5, { col }); }
  B.sphere('bronze', 0, 1.35 * s, 0, 0.55 * s, 0.4 * s, 0.55 * s, 10, col);
  B.cyl('bronze', 0, 1.6 * s, 0, 0.42 * s, 0.25 * s, 0.6 * s, 8, { col });
  B.sphere('bronze', 0, 2.3 * s, 0, 0.18 * s, 0.2 * s, 0.18 * s, 6, col);
  if (REG.col) wblock(B, -0.6 * s, -0.6 * s, 0.6 * s, 0.6 * s);
}

/** 门海（铜缸）：gilt = 鎏金 */
export function vat(B, x, y, z, gilt = false) {
  B.at(x, y, z, 0);
  B.box('marble', 0, 0, 0, 1.9, 0.45, 1.9, { col: rgb(C.marble) });
  const mat = gilt ? 'gold' : 'bronze';
  const col = gilt ? rgb(0xe9b84e) : rgb(0x3e3a34);
  B.cyl(mat, 0, 0.45, 0, 0.72, 0.95, 0.35, 14, { col });
  B.cyl(mat, 0, 0.8, 0, 0.95, 0.88, 0.75, 14, { col, cap: true });
  for (const sx of [-1, 1]) B.sphere(mat, sx * 0.95, 1.25, 0, 0.14, 0.14, 0.14, 6, col);
  if (REG.col) wblock(B, -1.0, -1.0, 1.0, 1.0);
  REG.vats.push([B.tx, B.tz]);
}

/** 悬挂宫灯（红纱灯） */
export function lantern(B, x, y, z, s = 1) {
  B.at(x, y, z, 0);
  B.cyl('gold', 0, 1.3 * s, 0, 0.03 * s, 0.03 * s, 0.6 * s, 4, { col: rgb(C.gold) });
  B.cyl('lamp', 0, 0.05 * s, 0, 0.42 * s, 0.42 * s, 1.0 * s, 10, { col: [255, 255, 255] });
  B.sphere('lamp', 0, 0.55 * s, 0, 0.62 * s, 0.55 * s, 0.62 * s, 10, [255, 255, 255]);
  B.cyl('gold', 0, 1.05 * s, 0, 0.3 * s, 0.3 * s, 0.12 * s, 8, { col: rgb(C.gold), cap: true });
  B.cyl('gold', 0, -0.05 * s, 0, 0.3 * s, 0.3 * s, 0.12 * s, 8, { col: rgb(C.gold) });
  B.cyl('lamp', 0, -0.5 * s, 0, 0.06 * s, 0.02 * s, 0.45 * s, 4, { col: [255, 200, 120] });
  REG.lamps.push([x, y + 0.5 * s, z]);
}

/** 庭院灯（今天的博物馆照明，矮柱灯） */
export function postLamp(B, x, y, z) {
  B.at(x, y, z, 0);
  B.cyl('paint', 0, 0, 0, 0.09, 0.07, 1.1, 6, { col: rgb(0x3a2f28) });
  B.box('lampWarm', 0, 1.1, 0, 0.32, 0.36, 0.32, { col: [255, 255, 255] });
  B.box('paint', 0, 1.46, 0, 0.42, 0.08, 0.42, { col: rgb(0x3a2f28), skip: 'b' });
}

/** 导览牌：p = 图集单元 { uv } */
export function sign(B, x, y, z, rot, p) {
  B.at(x, y, z, rot);
  const w = 1.7, h = 0.95, y0 = 0.75;
  const dark = rgb(0x2e231c);
  for (const sx of [-1, 1]) B.box('paint', sx * (w / 2 - 0.08), 0, 0, 0.1, y0 + h, 0.1, { col: dark });
  B.box('paint', 0, y0 - 0.06, -0.05, w + 0.12, h + 0.12, 0.08, { col: dark, skip: 'b' });
  if (p) {
    const [u0, v0, u1, v1] = p.uv;
    // 牌面略向后仰
    B.quad('sign', [-w / 2, y0, 0.0], [w / 2, y0, 0.0], [w / 2, y0 + h, -0.1], [-w / 2, y0 + h, -0.1], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
  }
  if (REG.col) wblock(B, -w / 2, -0.15, w / 2, 0.15);
}

/** 九龙壁（琉璃影壁） */
export function nineDragonWall(B, x, z, rot = 0) {
  B.at(x, 0, z, rot);
  const L = 29.4, H = 3.5, T = 1.4;
  B.box('marble', 0, 0, 0, L + 0.8, 1.2, T + 0.6, { col: rgb(C.marble) });
  B.box('glaze', 0, 1.2, 0, L, H, T, { col: rgb(0x3a6f8e), skip: 'bs' });
  B.quad('dragons', [-L / 2, 1.2, T / 2 + 0.01], [L / 2, 1.2, T / 2 + 0.01], [L / 2, 1.2 + H, T / 2 + 0.01], [-L / 2, 1.2 + H, T / 2 + 0.01], [[0, 0], [1, 0], [1, 1], [0, 1]]);
  // 琉璃斗拱与顶
  B.box('glaze', 0, 1.2 + H, 0, L + 0.4, 0.5, T + 0.4, { col: rgb(C.green), skip: 'b' });
  B.push(); B.sub(0, 1.2 + H + 0.5, 0);
  B.box('glaze', 0, 0, 0, L + 1.0, 0.2, T + 1.2, { col: rgb(C.yellow, 0.8), skip: 'b' });
  for (const s of [1, -1]) {
    B.quad('roof', [-L / 2 * s - s * 0.5, 0.18, s * (T / 2 + 0.6)], [L / 2 * s + s * 0.5, 0.18, s * (T / 2 + 0.6)], [L / 2 * s + s * 0.5, 1.1, 0], [-L / 2 * s - s * 0.5, 1.1, 0], [[0, 0], [L / 1.1, 0], [L / 1.1, 0.8], [0, 0.8]], rgb(C.yellow));
  }
  B.box('glaze', 0, 1.0, 0, L + 1.0, 0.35, 0.36, { col: rgb(C.yellow, 0.85) });
  B.pop();
  if (REG.col) wblock(B, -L / 2 - 0.4, -T / 2 - 0.3, L / 2 + 0.4, T / 2 + 0.3);
  REG.map.rects.push({ x0: x - L / 2, z0: z - T / 2, x1: x + L / 2, z1: z + T / 2, color: 0x3a6f8e, kind: 'wall' });
}

/** 社稷坛：三层方台，坛面铺五色土 */
export function shejitan(B, x, z) {
  B.at(x, 0, z, 0);
  const col = rgb(C.marble);
  B.box('marble', 0, 0, 0, 17, 0.5, 17, { col });
  B.box('marble', 0, 0.5, 0, 16, 0.5, 16, { col, skip: 'b' });
  B.box('marble', 0, 1.0, 0, 15, 0.12, 15, { col, skip: 'b' });
  const y = 1.13, a = 7.5, c = 2.5;
  const soil = { e: 0x3d7a46, s: 0xb03a28, w: 0xe8e6de, n: 0x2a2a2a, c: 0xd6a92e };
  const q = (pts, colr) => B.poly('road', pts.map(([px, pz]) => [px, y, pz]), [0, 1, 0], (p) => [p[0] / 3, p[2] / 3], rgb(colr));
  q([[-a, a], [a, a], [c, c], [-c, c]], soil.s);
  q([[a, -a], [-a, -a], [-c, -c], [c, -c]], soil.n);
  q([[a, a], [a, -a], [c, -c], [c, c]], soil.e);
  q([[-a, -a], [-a, a], [-c, c], [-c, -c]], soil.w);
  q([[-c, c], [c, c], [c, -c], [-c, -c]], soil.c);
  if (REG.col) REG.col.fill(x - 8.5, z - 8.5, x + 8.5, z + 8.5, y);
}
