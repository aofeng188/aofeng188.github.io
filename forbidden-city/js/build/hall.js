// 殿堂、门楼、城墙、宫墙、亭、角楼等建筑本体生成器。
// 局部坐标：建筑中心为原点，正面朝 +z；rot 为绕 y 轴旋转（0 = 坐北朝南）。
import { rgb } from '../core/buf.js';
import { C } from '../core/materials.js';
import { roof, finial } from './roof.js';
import { REG, addPick } from '../world/registry.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** 颜色按系数变暗（模拟檐下、墙脚的遮蔽） */
export const shade = (c, k) => [Math.round(c[0] * k), Math.round(c[1] * k), Math.round(c[2] * k)];
const WHITE = [255, 255, 255];

/** 登记实体包围盒（局部坐标），供相机防穿模与标签遮挡判断 */
export function regSolid(B, id, x0, y0, z0, x1, y1, z1) {
  const a = B.P(x0, y0, z0), b = B.P(x1, y1, z1);
  REG.solids.push({ id: id || null, min: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])], max: [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])] });
}

// ---------- 世界坐标辅助（碰撞、注册） ----------
export function wr(B, x0, z0, x1, z1) {
  const a = B.P(x0, 0, z0), b = B.P(x1, 0, z1);
  return [Math.min(a[0], b[0]), Math.min(a[2], b[2]), Math.max(a[0], b[0]), Math.max(a[2], b[2])];
}
export function wfill(B, x0, z0, x1, z1, h) {
  if (!REG.col) return;
  const r = wr(B, x0, z0, x1, z1); REG.col.fill(r[0], r[1], r[2], r[3], B.ty + h);
}
export function wblock(B, x0, z0, x1, z1) {
  if (!REG.col) return;
  const r = wr(B, x0, z0, x1, z1); REG.col.block(r[0], r[1], r[2], r[3]);
}
/** 局部坐标 z 方向的坡道：z0 处高 h0，z1 处高 h1 */
export function wrampZ(B, x0, z0, x1, z1, h0, h1, archTop) {
  if (!REG.col) return;
  const r = wr(B, x0, z0, x1, z1);
  const p0 = B.P(0, 0, z0), p1 = B.P(0, 0, z1);
  const axis = Math.abs(p1[0] - p0[0]) > Math.abs(p1[2] - p0[2]) ? 'x' : 'z';
  const a0 = axis === 'x' ? p0[0] : p0[2], a1 = axis === 'x' ? p1[0] : p1[2];
  const [lo, hi] = a0 < a1 ? [h0, h1] : [h1, h0];
  if (archTop !== undefined) REG.col.arch(r[0], r[1], r[2], r[3], axis, B.ty + h0, B.ty + archTop);
  else REG.col.ramp(r[0], r[1], r[2], r[3], axis, B.ty + lo, B.ty + hi);
}
function regPick(B, id, x0, y0, z0, x1, y1, z1) {
  const a = B.P(x0, y0, z0), b = B.P(x1, y1, z1);
  addPick(id, [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])], [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])]);
}
function regMap(B, x0, z0, x1, z1, color, kind = 'hall') {
  const r = wr(B, x0, z0, x1, z1);
  REG.map.rects.push({ x0: r[0], z0: r[1], x1: r[2], z1: r[3], color, kind });
}

// ---------- 通用部件 ----------

/** 外围一圈竖向带（额枋、斗拱、墙身），u 按米或按开间计 */
export function ring(B, mat, hx, hz, y0, y1, o = {}) {
  const out = o.out || 0, us = o.us || 1, col = o.col;
  const v0 = o.v0 ?? 0, v1 = o.v1 ?? 1;
  const sides = [
    [[-hx, hz], [hx, hz], [-hx - out, hz + out], [hx + out, hz + out], 2 * hx],
    [[hx, -hz], [-hx, -hz], [hx + out, -hz - out], [-hx - out, -hz - out], 2 * hx],
    [[hx, hz], [hx, -hz], [hx + out, hz + out], [hx + out, -hz - out], 2 * hz],
    [[-hx, -hz], [-hx, hz], [-hx - out, -hz - out], [-hx - out, hz + out], 2 * hz],
  ];
  for (const [i, [a, b, c, d, len]] of sides.entries()) {
    if (o.skip && o.skip.includes(i)) continue;
    const u1 = o.perBay ? (o.perBay[i] ?? 1) : len * us;
    if (o.inward) B.quad(mat, [b[0], y0, b[1]], [a[0], y0, a[1]], [c[0], y1, c[1]], [d[0], y1, d[1]], [[u1, v0], [0, v0], [0, v1], [u1, v1]], col);
    else B.quad(mat, [a[0], y0, a[1]], [b[0], y0, b[1]], [d[0], y1, d[1]], [c[0], y1, c[1]], [[0, v0], [u1, v0], [u1, v1], [0, v1]], col);
  }
}

/** 栏杆：望柱 + 栏板，沿局部坐标的直线 */
export function railing(B, x0, z0, x1, z1, y, o = {}) {
  const mat = o.mat || 'marble';
  const col = o.col || rgb(C.marble);
  const len = Math.hypot(x1 - x0, z1 - z0);
  if (len < 0.5) return;
  const sp = o.sp || 1.7;
  const n = Math.max(1, Math.round(len / sp));
  const dx = (x1 - x0) / len, dz = (z1 - z0) / len;
  const ang = Math.atan2(dx, dz); // 局部 +z 指向线段方向
  const ph = o.h || 1.15, pw = o.pw || 0.22;
  const chiSide = o.outVec ? (Math.sign(o.outVec[0] * dz - o.outVec[1] * dx) || 1) : 1;
  B.push(); B.sub(x0, y, z0, ang);
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * len;
    B.box(mat, 0, 0, t, pw, ph, pw, { col, skip: 'b' });
    B.box(mat, 0, ph, t, pw * 1.15, 0.22, pw * 1.15, { col, skip: 'b', tx: 0.04, tz: 0.04 });
    if (o.chishou) B.box(mat, chiSide * 0.45, -0.5, t, 0.9, 0.3, 0.26, { col });
    if (i < n) {
      B.box(mat, 0, 0.12, t + (len / n) / 2, 0.1, ph * 0.72, len / n - pw, { col, skip: 'bt' });
      B.box(mat, 0, 0.12 + ph * 0.72, t + (len / n) / 2, 0.14, 0.08, len / n - pw, { col, skip: 'b' });
    }
  }
  B.pop();
  if (REG.col && !o.noCollide) {
    const a = B.P(x0, 0, z0), b = B.P(x1, 0, z1);
    REG.col.capsule(a[0], a[2], b[0], b[2], 0.3);
  }
}

/** 台阶（踏跺）：从 (cx, h, cz) 的台基边缘向外，dir: f/b/l/r */
export function stairs(B, cx, cz, w, h, dir = 'f', o = {}) {
  if (h < 0.08) return;
  const ang = { f: 0, r: Math.PI / 2, b: Math.PI, l: -Math.PI / 2 }[dir];
  const mat = o.mat || 'marble';
  const col = o.col || rgb(C.marble);
  const rise = 0.15, run = o.run || 0.32;
  const n = Math.max(1, Math.round(h / rise));
  const L = n * run;
  B.push(); B.sub(cx, 0, cz, ang);
  for (let k = 0; k < n; k++) {
    const z0 = (n - k - 1) * run;
    B.box(mat, 0, 0, z0 + run / 2, w, ((k + 1) / n) * h, run, { col, skip: 'bn' });
  }
  // 垂带
  const bw = Math.min(0.6, w * 0.08);
  for (const s of [-1, 1]) {
    const x = s * (w / 2 + bw / 2);
    B.quad(mat, [x - bw / 2, h + 0.06, 0], [x + bw / 2, h + 0.06, 0], [x + bw / 2, 0.06, L], [x - bw / 2, 0.06, L], [[0, 0], [1, 0], [1, L], [0, L]], col);
    const xs = x + s * bw / 2;
    B.quad(mat, s > 0 ? [xs, 0, 0] : [xs, 0, L], s > 0 ? [xs, 0, L] : [xs, 0, 0], s > 0 ? [xs, 0.06, L] : [xs, h + 0.06, 0], s > 0 ? [xs, h + 0.06, 0] : [xs, 0.06, L], [[0, 0], [L, 0], [L, h], [0, h]], col);
    B.quad(mat, [x - bw / 2, 0, 0], [x + bw / 2, 0, 0], [x + bw / 2, h + 0.06, 0], [x - bw / 2, h + 0.06, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], col);
  }
  if (o.yudao) {
    const yw = o.yudao === true ? w * 0.34 : o.yudao;
    B.quad(mat, [-yw / 2, h + 0.08, 0], [yw / 2, h + 0.08, 0], [yw / 2, 0.08, L], [-yw / 2, 0.08, L], [[0, 0], [yw, 0], [yw, L], [0, L]], rgb(0xf6f2e8));
    B.quad(mat, [-yw / 2 + 0.3, h + 0.1, 0.2], [yw / 2 - 0.3, h + 0.1, 0.2], [yw / 2 - 0.3, 0.1, L - 0.2], [-yw / 2 + 0.3, 0.1, L - 0.2], [[0, 0], [1, 0], [1, 3], [0, 3]], rgb(0xdedad0));
  }
  wrampZ(B, -w / 2 - bw, 0, w / 2 + bw, L, h, 0);
  B.pop();
  return L;
}

/**
 * 台基。hx/hz 半尺寸，h 高度。
 * o.sumeru 须弥座；o.rail 栏杆；o.stairs [{side, w, at, yudao}]；o.chishou 螭首
 */
export function platform(B, o) {
  const { hx, hz, h } = o;
  const mat = o.mat || 'marble';
  const col = o.col || rgb(mat === 'marble' ? C.marble : mat === 'brick' ? C.greyBrick : C.stone);
  const capMat = o.capMat || mat;
  const dark = shade(col, 0.68);
  if (o.sumeru && h > 0.8) {
    B.box(mat, 0, 0, 0, hx * 2 + 0.3, h * 0.22, hz * 2 + 0.3, { col: dark, colTop: shade(col, 0.85) });
    B.box(mat, 0, h * 0.22, 0, hx * 2 + 0.12, h * 0.1, hz * 2 + 0.12, { col: shade(col, 0.85), skip: 'b' });
    B.box(mat, 0, h * 0.32, 0, hx * 2 - 0.25, h * 0.4, hz * 2 - 0.25, { col: shade(col, 0.72), colTop: shade(col, 0.82), skip: 'b' });
    B.box(capMat, 0, h * 0.72, 0, hx * 2 + 0.15, h * 0.28, hz * 2 + 0.15, { col: shade(col, 0.9), colTop: col, skip: 'b' });
  } else {
    B.box(mat, 0, 0, 0, hx * 2, h, hz * 2, { col: dark, colTop: col, skip: 'b' });
  }
  wfill(B, -hx, -hz, hx, hz, h);
  const st = o.stairs || [];
  for (const s of st) {
    const along = s.side === 'f' || s.side === 'b' ? hx : hz;
    const at = s.at || 0;
    const sx = s.side === 'f' || s.side === 'b' ? at : (s.side === 'r' ? hx : -hx);
    const sz = s.side === 'f' ? hz : s.side === 'b' ? -hz : at;
    const sw = Math.min(s.w, along * 2);
    stairs(B, sx, sz, sw, h, s.side, { yudao: s.yudao, mat: o.stairMat || mat, col });
  }
  if (o.rail) {
    const y = h, inset = 0.25;
    const ext = { f: [-hx + inset, hz - inset, hx - inset, hz - inset], b: [hx - inset, -hz + inset, -hx + inset, -hz + inset], r: [hx - inset, hz - inset, hx - inset, -hz + inset], l: [-hx + inset, -hz + inset, -hx + inset, hz - inset] };
    for (const side of ['f', 'b', 'l', 'r']) {
      if (o.railSkip && o.railSkip.includes(side)) continue;
      const [x0, z0, x1, z1] = ext[side];
      const horiz = side === 'f' || side === 'b';
      // 按台阶开口切分
      const gaps = st.filter((s) => s.side === side).map((s) => [(s.at || 0) - s.w / 2 - 0.4, (s.at || 0) + s.w / 2 + 0.4]).concat((o.railGaps || []).filter((g) => g.side === side).map((g) => [g.a, g.b]));
      gaps.sort((a, b) => a[0] - b[0]);
      const lo = horiz ? Math.min(x0, x1) : Math.min(z0, z1), hi = horiz ? Math.max(x0, x1) : Math.max(z0, z1);
      let cur = lo;
      const segs = [];
      for (const [g0, g1] of gaps) { if (g0 > cur) segs.push([cur, Math.min(g0, hi)]); cur = Math.max(cur, g1); }
      if (cur < hi) segs.push([cur, hi]);
      for (const [a, b] of segs) {
        if (b - a < 0.6) continue;
        const outVec = { f: [0, 1], b: [0, -1], r: [1, 0], l: [-1, 0] }[side];
        if (horiz) railing(B, a, z0, b, z0, y, { chishou: o.chishou, outVec });
        else railing(B, x0, a, x0, b, y, { chishou: o.chishou, outVec });
      }
    }
  }
}

/** 门扇（打开状态贴在门洞两侧） */
function doorLeaves(B, x, z, w, h, open = true, mat = 'door') {
  if (!open) {
    B.quad(mat, [x - w / 2, 0, z], [x + w / 2, 0, z], [x + w / 2, h, z], [x - w / 2, h, z], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    B.quad(mat, [x + w / 2, 0, z - 0.02], [x - w / 2, 0, z - 0.02], [x - w / 2, h, z - 0.02], [x + w / 2, h, z - 0.02], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    return;
  }
  const lw = w / 2;
  for (const s of [-1, 1]) {
    const hx = x + s * w / 2;
    B.quad(mat, [hx, 0, z], [hx, 0, z - lw * 0.98], [hx, h, z - lw * 0.98], [hx, h, z], s < 0 ? [[0, 0], [0.5, 0], [0.5, 1], [0, 1]] : [[0.5, 0], [1, 0], [1, 1], [0.5, 1]]);
    B.quad(mat, [hx + s * -0.08, 0, z - lw * 0.98], [hx + s * -0.08, 0, z], [hx + s * -0.08, h, z], [hx + s * -0.08, h, z - lw * 0.98], [[0, 0], [0.5, 0], [0.5, 1], [0, 1]]);
  }
}

/**
 * 殿堂。主要参数：
 *   x, y, z, rot, id
 *   W, D 柱网面阔、进深（米）；bays, dBays 开间数
 *   colH 檐柱高；lang 前廊深；front: 'mixed'|'doors'|'windows'|'gate'|'open'|'wall'
 *   roof: 'wudian'|'xieshan'|'cuanjian'|'yingshan'|'xuanshan'|'juanpeng'|'luding'|'round'|'poly'
 *   double: 重檐；tile 瓦色；caihua 彩画等级；beasts 脊兽数；plaque 匾额 {uv, w}
 *   base: { h, pad, mat, sumeru, rail, stairs, chishou }；enter: 可进入室内
 */
const LAT_TOP = [140, 140, 140], INNER_LAT = [120, 110, 105];

export function hall(B, o) {
  if (o.noCollide && REG.col) {
    // 城台上的门楼：不写碰撞，避免覆盖下面的门洞
    const col = REG.col; REG.col = null;
    try { return hall(B, { ...o, noCollide: false }); } finally { REG.col = col; }
  }
  B.at(o.x, o.y || 0, o.z, o.rot || 0);
  const W = o.W, D = o.D;
  const bays = o.bays || Math.max(1, Math.round(W / 4.6) | 1);
  const dBays = o.dBays || Math.max(1, Math.round(D / 4.6));
  const colH = o.colH ?? clamp(D * 0.32, 2.8, 9);
  const colR = o.colR ?? clamp(colH * 0.052, 0.14, 0.55);
  const beamH = o.beamH ?? Math.max(0.35, colH * 0.12);
  const dgH = o.dougong === false ? 0 : (o.dgH ?? Math.max(0.45, colH * 0.16));
  const dgOut = dgH * 0.6;
  const ov = o.overhang ?? clamp(colH * 0.36 + dgOut, 0.8, 4.4);
  const lang = o.lang ?? (D > 11 && o.front !== 'open' && o.front !== 'gate' ? Math.min(D * 0.16, 3.4) : 0);
  const base = o.base || {};
  const baseH = base.h ?? 0.45;
  const pad = base.pad ?? ov * 0.62 + 0.3;
  const tile = o.tile ?? C.yellow;
  const caihua = o.caihua || 'hexi';
  const front = o.front || 'mixed';
  const rich = caihua === 'hexi';
  const latticeMat = rich ? 'lattice' : 'lattice2';
  const wallCol = rgb(o.wallColor ?? C.redWall);
  const lacquer = rgb(o.colColor ?? C.lacquer);
  const bayW = W / bays;

  if (!o.noBase) platform(B, { hx: W / 2 + pad, hz: D / 2 + pad, h: baseH, ...base, stairs: base.stairs ?? [{ side: 'f', w: Math.min(bayW * (bays >= 5 ? 3 : 1), W) }] });

  B.push(); B.sub(0, baseH, 0);
  const wt = clamp(colR * 2.4, 0.45, 1.5);
  const fz = lang > 0 ? D / 2 - lang : D / 2 - colR * 0.2;
  const open = front === 'open';
  const gate = front === 'gate';
  const enter = !!o.enter;

  // 室内高度：重檐时室内一直到上层檐下
  let yS = 0, upperH = 0;
  if (o.double) {
    const run = ov + lang * 0.9;
    yS = colH + beamH + dgH + run * 0.46;
    upperH = o.upperH ?? Math.max(1.6, colH * 0.36);
  }
  const yC = enter ? (o.double ? yS + upperH * 0.6 : colH + beamH) : colH;

  // ---- 柱子 ----
  const colPos = [];
  for (let i = 0; i <= bays; i++) colPos.push([-W / 2 + i * bayW, D / 2]);
  if (open || gate) for (let i = 0; i <= bays; i++) colPos.push([-W / 2 + i * bayW, -D / 2]);
  if (open || gate) for (let j = 1; j < dBays; j++) for (const sx of [-1, 1]) colPos.push([sx * W / 2, -D / 2 + (j * D) / dBays]);
  const lacquerTop = shade(lacquer, 0.5);
  const wallTop = shade(wallCol, 0.52);
  for (const [cx, cz] of colPos) {
    B.cyl('paint', cx, 0, cz, colR, colR * 0.94, colH + 0.02, 10, { col: lacquer, colTop: lacquerTop });
    B.box('marble', cx, 0, cz, colR * 2.7, 0.18, colR * 2.7, { col: rgb(C.marble), skip: 'b' });
  }
  if (enter) {
    for (let i = 1; i < bays; i++) for (let j = 1; j < dBays; j++) {
      const cx = -W / 2 + i * bayW, cz = -D / 2 + (j * D) / dBays;
      if (cz > fz - 0.8) continue;
      const golden = o.goldCols && Math.abs(cx) < bayW * 1.6 && j >= dBays - 2;
      B.cyl(golden ? 'innerGold' : 'inner', cx, 0, cz, colR * 1.08, colR, yC + 0.05, 12, { col: golden ? rgb(0xe9b949) : lacquer, colTop: golden ? rgb(0xb88a2c) : lacquerTop });
      if (REG.col) { const p = B.P(cx, 0, cz); REG.col.block(p[0] - colR, p[2] - colR, p[0] + colR, p[2] + colR); }
    }
  }

  // ---- 墙身 ----
  const topWall = enter ? yC : colH;
  const dado = colH * 0.3;
  if (!open && !gate) {
    // 后檐墙
    B.box('wall', 0, 0, -D / 2, W + wt, topWall, wt, { col: wallCol, colTop: wallTop, skip: 'b' });
    B.box('brick', 0, 0, -D / 2, W + wt + 0.12, Math.min(1.2, dado), wt + 0.12, { col: rgb(0x8f8a84), skip: 'b' });
    // 山墙
    const sl = fz + D / 2;
    for (const s of [-1, 1]) {
      B.box('wall', s * W / 2, 0, -D / 2 + sl / 2, wt, topWall, sl, { col: wallCol, colTop: wallTop, skip: 'b' });
      B.box('brick', s * W / 2, 0, -D / 2 + sl / 2, wt + 0.12, Math.min(1.2, dado), sl + 0.12, { col: rgb(0x8f8a84), skip: 'b' });
    }
    // 前檐装修
    const doorBays = front === 'doors' ? bays : front === 'windows' ? 1 : front === 'wall' ? 1 : Math.max(1, bays - (bays >= 9 ? 4 : bays >= 5 ? 2 : 0));
    const wallBays = front === 'wall' ? bays - 1 : bays >= 11 ? 2 : 0;
    const openBays = enter ? (o.openBays ?? 1) : 0;
    const frameCol = shade(lacquer, 0.85), frameTop = shade(lacquer, 0.45);
    for (let i = 0; i <= bays; i++) {
      // 抱框：开间之间的立框，让门窗有进深
      B.box('paint', -W / 2 + i * bayW, 0, fz + 0.08, 0.26, topWall, 0.2, { col: frameCol, colTop: frameTop, skip: 'b' });
    }
    for (let i = 0; i < bays; i++) {
      const x0 = -W / 2 + i * bayW, x1 = x0 + bayW;
      const k = Math.abs(i - (bays - 1) / 2);
      const isDoor = k < doorBays / 2;
      const isOpenBay = k < (enter ? (o.openBays ?? 1) : 0) / 2;
      // 中槛、下槛
      B.box('paint', (x0 + x1) / 2, colH * 0.9 - 0.12, fz + 0.06, bayW, 0.24, 0.16, { col: frameCol, colTop: frameTop });
      if (!isOpenBay && k < (bays - (front === 'wall' ? bays - 1 : bays >= 11 ? 2 : 0)) / 2) B.box('paint', (x0 + x1) / 2, 0, fz + 0.06, bayW, 0.22, 0.16, { col: frameCol, skip: 'b' });
      const isWall = !isDoor && (front === 'wall' || k >= (bays - wallBays) / 2);
      const isOpen = k < openBays / 2;
      const hTop = colH * 0.9;
      if (isOpen) {
        // 打开的门：两侧门扇
        B.quad(latticeMat, [x0, 0, fz], [x0 + bayW * 0.12, 0, fz - bayW * 0.3], [x0 + bayW * 0.12, hTop, fz - bayW * 0.3], [x0, hTop, fz], [[0, 0], [0.25, 0], [0.25, 1], [0, 1]]);
        B.quad(latticeMat, [x1 - bayW * 0.12, 0, fz - bayW * 0.3], [x1, 0, fz], [x1, hTop, fz], [x1 - bayW * 0.12, hTop, fz - bayW * 0.3], [[0.75, 0], [1, 0], [1, 1], [0.75, 1]]);
      } else if (isWall) {
        B.box('wall', (x0 + x1) / 2, 0, fz - 0.2, bayW, topWall, 0.5, { col: wallCol, colTop: wallTop, skip: enter ? 'b' : 'bn' });
        continue;
      } else if (isDoor) {
        B.quad(latticeMat, [x0, 0, fz], [x1, 0, fz], [x1, hTop, fz], [x0, hTop, fz], [[0, 0], [1, 0], [1, 1], [0, 1]], WHITE, LAT_TOP);
        if (enter) B.quad(latticeMat, [x1, 0, fz - 0.05], [x0, 0, fz - 0.05], [x0, hTop, fz - 0.05], [x1, hTop, fz - 0.05], [[0, 0], [1, 0], [1, 1], [0, 1]], INNER_LAT, INNER_LAT);
      } else {
        B.box(rich ? 'wall' : 'brick', (x0 + x1) / 2, 0, fz - 0.25, bayW, dado, 0.5, { col: rich ? rgb(0x7d3a2c) : rgb(0x8f8a84), skip: enter ? 'b' : 'bn' });
        B.quad(latticeMat, [x0, dado, fz], [x1, dado, fz], [x1, hTop, fz], [x0, hTop, fz], [[0, 0.42], [1, 0.42], [1, 1], [0, 1]], [225, 225, 225], LAT_TOP);
        if (enter) B.quad(latticeMat, [x1, dado, fz - 0.05], [x0, dado, fz - 0.05], [x0, hTop, fz - 0.05], [x1, hTop, fz - 0.05], [[0, 0.42], [1, 0.42], [1, 1], [0, 1]], INNER_LAT, INNER_LAT);
      }
      // 横披
      B.quad('paint', [x0, hTop, fz], [x1, hTop, fz], [x1, topWall, fz], [x0, topWall, fz], [[0, 0], [1, 0], [1, 1], [0, 1]], shade(rgb(0x7a2416), 0.7), shade(rgb(0x7a2416), 0.45));
      if (enter) B.quad('paint', [x1, hTop, fz - 0.05], [x0, hTop, fz - 0.05], [x0, topWall, fz - 0.05], [x1, topWall, fz - 0.05], [[0, 0], [1, 0], [1, 1], [0, 1]], rgb(0x7a2416));
    }
    // 碰撞
    if (enter) {
      wblock(B, -W / 2 - wt / 2, -D / 2 - wt / 2, W / 2 + wt / 2, -D / 2 + wt / 2);
      for (const s of [-1, 1]) wblock(B, s * W / 2 - wt / 2, -D / 2, s * W / 2 + wt / 2, fz);
      const ob = (o.openBays ?? 1) * bayW / 2;
      wblock(B, -W / 2, fz - 0.3, -ob, fz + 0.1);
      wblock(B, ob, fz - 0.3, W / 2, fz + 0.1);
    } else {
      wblock(B, -W / 2 - wt / 2, -D / 2 - wt / 2, W / 2 + wt / 2, fz + 0.1);
    }
  } else if (gate) {
    // 门殿：中线为门墙，中间三间为门
    const doorN = o.gateDoors ?? Math.min(3, bays);
    for (let i = 0; i < bays; i++) {
      const x0 = -W / 2 + i * bayW, x1 = x0 + bayW;
      const k = Math.abs(i - (bays - 1) / 2);
      if (k < doorN / 2) {
        doorLeaves(B, (x0 + x1) / 2, 0.3, bayW * 0.8, colH * 0.82, o.gateOpen !== false, 'door');
        B.box('wall', x0 + bayW * 0.05, 0, 0, bayW * 0.1, colH, 0.7, { col: wallCol, skip: 'b' });
        B.box('wall', x1 - bayW * 0.05, 0, 0, bayW * 0.1, colH, 0.7, { col: wallCol, skip: 'b' });
        B.box('paint', (x0 + x1) / 2, colH * 0.82, 0, bayW, colH * 0.18, 0.7, { col: rgb(0x7a2416), skip: 'b' });
        if (o.gateOpen === false) wblock(B, x0, -0.4, x1, 0.4);
        else { wblock(B, x0, -0.4, x0 + bayW * 0.12, 0.4); wblock(B, x1 - bayW * 0.12, -0.4, x1, 0.4); }
      } else {
        B.box('wall', (x0 + x1) / 2, 0, 0, bayW, colH, 0.9, { col: wallCol, skip: 'b' });
        wblock(B, x0, -0.5, x1, 0.5);
      }
    }
    for (const s of [-1, 1]) {
      B.box('wall', s * W / 2, 0, 0, wt, colH, D, { col: wallCol, skip: 'b' });
      wblock(B, s * W / 2 - wt / 2, -D / 2, s * W / 2 + wt / 2, D / 2);
    }
  }
  if (open || gate) {
    for (const [cx, cz] of colPos) if (REG.col) { const p = B.P(cx, 0, cz); REG.col.block(p[0] - colR, p[2] - colR, p[0] + colR, p[2] + colR); }
  } else {
    for (let i = 0; i <= bays; i++) if (REG.col) { const p = B.P(-W / 2 + i * bayW, 0, D / 2); REG.col.block(p[0] - colR, p[2] - colR, p[0] + colR, p[2] + colR); }
  }

  // ---- 额枋、斗拱 ----
  const perBay = [bays, bays, dBays, dBays];
  ring(B, caihua, W / 2 + 0.02, D / 2 + 0.02, colH, colH + beamH, { perBay, col: [205, 205, 205] });
  if (dgH > 0) ring(B, 'dougong', W / 2 + 0.05, D / 2 + 0.05, colH + beamH, colH + beamH + dgH, { out: dgOut, us: 1 / 1.6, col: [150, 150, 150] });
  // 雀替：柱头两侧的托木
  const qt = Math.min(bayW * 0.22, 1.6), qh = Math.min(0.55, colH * 0.1);
  for (const [cx, cz] of colPos) {
    if (Math.abs(cz - D / 2) > 0.01 && !(open || gate)) continue;
    for (const sx of [-1, 1]) {
      if ((cx + sx * qt) < -W / 2 - 0.01 || (cx + sx * qt) > W / 2 + 0.01) continue;
      B.box('xuanzi', cx + sx * (colR + qt / 2), colH - qh, cz, qt, qh, 0.2, { uv: 'unit', col: [200, 200, 200], colTop: [150, 150, 150], tx: 0, skip: 'b' });
    }
  }
  // 檐下顶棚：封住柱头以上空间
  const capY = colH + beamH * 0.5;
  if (!enter) {
    B.quad('ceiling', [-W / 2, capY, -D / 2], [W / 2, capY, -D / 2], [W / 2, capY, D / 2], [-W / 2, capY, D / 2], [[0, 0], [W / 3, 0], [W / 3, D / 3], [0, D / 3]]);
  } else {
    if (lang > 0) B.quad('ceiling', [-W / 2, capY, fz], [W / 2, capY, fz], [W / 2, capY, D / 2], [-W / 2, capY, D / 2], [[0, 0], [W / 3, 0], [W / 3, lang / 3], [0, lang / 3]]);
    B.quad('ceiling', [-W / 2, yC, -D / 2], [W / 2, yC, -D / 2], [W / 2, yC, fz], [-W / 2, yC, fz], [[0, 0], [W / 3, 0], [W / 3, (fz + D / 2) / 3], [0, (fz + D / 2) / 3]]);
    B.quad('floor', [-W / 2, 0.03, fz], [W / 2, 0.03, fz], [W / 2, 0.03, -D / 2], [-W / 2, 0.03, -D / 2], [[0, 0], [W / 1.6, 0], [W / 1.6, D / 1.6], [0, D / 1.6]]);
    REG.interiors.push({ id: o.id, min: B.P(-W / 2, 0, -D / 2), max: B.P(W / 2, yC, fz), y: B.ty, yC: B.ty + yC });
  }

  // ---- 屋顶 ----
  const y0 = colH + beamH + dgH;
  const soff = [W / 2 + dgOut, D / 2 + dgOut, y0 + 0.02];
  const rt = o.roof || 'xieshan';
  let top;
  const roofCommon = { color: tile, beasts: o.beasts ?? 0, tileW: o.tileW, scale: o.roofScale };
  if (rt === 'round' || rt === 'poly') {
    const R = Math.max(W, D) / 2 + ov;
    top = roof(B, { ...roofCommon, type: rt, r: R, sides: o.sides, y0: y0 + 0.2, rise: R * (o.riseK ?? 0.8), soffit: [Math.max(W, D) / 2, y0], curve: 1.1 }).topY;
  } else if (o.double) {
    const ex = W / 2 + ov, ez = D / 2 + ov;
    const ix = W / 2 - lang * 0.9, iz = D / 2 - lang * 0.9;
    roof(B, { ...roofCommon, type: 'skirt', hx: ex, hz: ez, top: [ix, iz], y0: y0 + 0.25, rise: yS - y0 - 0.25, soffit: soff, curve: 0.5, beasts: o.beasts ?? 0, lift: o.lift, liftLen: Math.min(ex, ez) * 0.7 });
    // 上层墙身
    B.box('wall', 0, yS - 0.6, 0, ix * 2, upperH + 0.6, iz * 2, { col: wallCol, skip: 'bt' });
    ring(B, caihua, ix + 0.02, iz + 0.02, yS + upperH, yS + upperH + beamH * 0.9, { perBay: [bays - 2, bays - 2, Math.max(1, dBays - 2), Math.max(1, dBays - 2)] });
    const dg2 = dgH * 1.05;
    ring(B, 'dougong', ix + 0.05, iz + 0.05, yS + upperH + beamH * 0.9, yS + upperH + beamH * 0.9 + dg2, { out: dg2 * 0.6, us: 1 / 1.6 });
    const y2 = yS + upperH + beamH * 0.9 + dg2;
    const ov2 = ov * 1.02;
    const hx2 = ix + ov2, hz2 = iz + ov2;
    const r2 = { ...roofCommon, type: rt, hx: hx2, hz: hz2, y0: y2 + 0.25, soffit: [ix + dg2 * 0.6, iz + dg2 * 0.6, y2 + 0.02] };
    if (rt === 'wudian') r2.rise = hz2 * (o.riseK ?? 0.78);
    else if (rt === 'xieshan') r2.rise = hz2 * (o.riseK ?? 0.7);
    else if (rt === 'cuanjian') r2.rise = hz2 * (o.riseK ?? 0.85);
    else if (rt === 'luding') { r2.rise = hz2 * 0.32; r2.t = Math.min(hx2, hz2) * 0.5; }
    if (rt === 'round') top = roof(B, { ...roofCommon, type: 'round', r: Math.max(hx2, hz2), y0: y2 + 0.25, rise: Math.max(hx2, hz2) * 0.8, soffit: [Math.max(ix, iz), y2] }).topY;
    else top = roof(B, { ...r2, rx: o.rx, xg: o.xg, wenH: o.wenH }).topY;
    if (o.plaque) plaque(B, o.plaque, 0, yS + upperH * 0.42, iz + 0.12, o.plaqueW ?? Math.min(bayW * 1.1, 7));
  } else {
    const hx = W / 2 + ov, hz = D / 2 + ov;
    const r = { ...roofCommon, type: rt, hx, hz, y0: y0 + 0.25, soffit: soff };
    if (rt === 'wudian') r.rise = hz * (o.riseK ?? 0.7);
    else if (rt === 'xieshan') r.rise = hz * (o.riseK ?? 0.66);
    else if (rt === 'cuanjian') r.rise = hz * (o.riseK ?? 0.85);
    else if (rt === 'luding') { r.rise = hz * 0.35; r.t = Math.min(hx, hz) * 0.5; }
    else { r.rise = hz * (o.riseK ?? 0.55); r.gableFrom = colH - 0.1; r.gableX = W / 2 + wt / 2 - 0.02; r.gableZ = D / 2 + 0.4; r.gableMat = o.gableMat || 'wall'; r.gableColor = o.gableColor ?? o.wallColor ?? C.redWall; r.wen = o.wen; }
    top = roof(B, { ...r, rx: o.rx, xg: o.xg, wenH: o.wenH, curve: o.curve }).topY;
    if (o.plaque) plaque(B, o.plaque, 0, colH + beamH * 0.3, D / 2 + colR + 0.1, o.plaqueW ?? Math.min(bayW * 0.95, 5));
  }
  B.pop();

  const ext = Math.max(W / 2 + ov, D / 2 + ov);
  // 实体：可进入的殿只把屋顶部分算作实体
  regSolid(B, o.id, -W / 2 - ov, enter ? baseH + yC : 0, -D / 2 - ov, W / 2 + ov, baseH + top, D / 2 + ov);
  if (o.id) regPick(B, o.id, -W / 2 - ov, 0, -D / 2 - ov, W / 2 + ov, baseH + top, D / 2 + ov);
  if (!o.noMap) regMap(B, -W / 2 - ov * 0.8, -D / 2 - ov * 0.8, W / 2 + ov * 0.8, D / 2 + ov * 0.8, tile);
  return { top: baseH + top, baseH, colH, ext, yC, fz, W, D, lang, x: o.x, z: o.z, y: (o.y || 0) + baseH, rot: o.rot || 0 };
}

/** 匾额：蓝底金字。p = { uv:[u0,v0,u1,v1], aspect, vertical } */
export function plaque(B, p, x, y, z, w) {
  if (!p) return;
  const h = w / p.aspect;
  B.box('gold', x, y - h / 2 - 0.12, z - 0.16, w + 0.36, h + 0.24, 0.16, { col: rgb(0xc89a3a) });
  const [u0, v0, u1, v1] = p.uv;
  const zz = z + 0.01;
  B.quad('plaque', [x - w / 2, y - h / 2 - 0.12, zz], [x + w / 2, y - h / 2 - 0.12, zz], [x + w / 2, y + h / 2 - 0.12, zz], [x - w / 2, y + h / 2 - 0.12, zz],
    [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
}

/** 拱券门洞外轮廓（用于城台立面），返回逆时针点列 */
function archOutline(W, H, tunnels, segs = 10) {
  const pts = [[-W / 2, 0]];
  const ts = [...tunnels].sort((a, b) => a.x - b.x);
  for (const t of ts) {
    const r = t.w / 2;
    pts.push([t.x - r, 0], [t.x - r, t.h - r]);
    for (let i = 1; i < segs; i++) {
      const a = Math.PI - (i / segs) * Math.PI;
      pts.push([t.x + Math.cos(a) * r, t.h - r + Math.sin(a) * r]);
    }
    pts.push([t.x + r, t.h - r], [t.x + r, 0]);
  }
  pts.push([W / 2, 0], [W / 2, H], [-W / 2, H]);
  return pts;
}

/**
 * 城台（墩台）+ 门洞。W 面阔、D 进深、H 高；tunnels [{x, w, h}] 沿 z 贯通。
 * 返回后可在其上放置门楼 hall({ y: H, noBase: true ... })
 */
export function gatePlatform(B, o) {
  B.at(o.x, o.y || 0, o.z, o.rot || 0);
  const { W, D, H } = o;
  const col = rgb(o.color ?? C.redCity);
  const tunnels = o.tunnels || [];
  const segs = Math.max(6, Math.round(10 * B.detail));
  const outline = archOutline(W, H, tunnels, segs);
  // 前后立面
  for (const s of [1, -1]) {
    const z = (s * D) / 2;
    const poly = outline.map(([x, y]) => [s > 0 ? x : -x, y, z]);
    B.poly('wall', poly, [0, 0, s], (p) => [p[0] / 3, p[1] / 3], col);
  }
  // 侧面、顶面
  B.box('wall', 0, 0, 0, W, H, D, { col: shade(col, 0.8), colTop: col, skip: 'bns' });
  // 下碱：石台
  const plinth = o.plinth ?? Math.min(1.6, H * 0.12);
  B.box('marble', 0, 0, 0, W + 0.4, plinth, D + 0.4, { col: rgb(C.stone), skip: 'b' });
  for (const t of tunnels) {
    // 门洞内壁与券顶
    const r = t.w / 2, yb = t.h - r;
    for (const sx of [-1, 1]) B.quad('wall', sx > 0 ? [t.x + r, 0, D / 2] : [t.x - r, 0, -D / 2], sx > 0 ? [t.x + r, 0, -D / 2] : [t.x - r, 0, D / 2], sx > 0 ? [t.x + r, yb, -D / 2] : [t.x - r, yb, D / 2], sx > 0 ? [t.x + r, yb, D / 2] : [t.x - r, yb, -D / 2], [[0, 0], [D / 3, 0], [D / 3, yb / 3], [0, yb / 3]], rgb(0xb8a89a));
    B.grid('wall', segs, 1, (i, j) => { const a = (i / segs) * Math.PI; return [t.x + Math.cos(a) * r, yb + Math.sin(a) * r, j ? -D / 2 : D / 2]; }, (i, j) => [i / segs * 3, j * D / 3], rgb(0xb8a89a), [0, -1, 0]);
    // 门洞地面
    B.quad('brick', [t.x - r, 0.02, D / 2], [t.x + r, 0.02, D / 2], [t.x + r, 0.02, -D / 2], [t.x - r, 0.02, -D / 2], [[0, 0], [t.w / 2, 0], [t.w / 2, D / 2], [0, D / 2]], rgb(0x9a9a98));
    // 门扇：位于门洞中段，打开
    if (o.doors !== false) {
      B.push(); B.sub(t.x, 0, 0, 0);
      const dh = yb + r * 0.7;
      for (const sx of [-1, 1]) {
        B.quad(o.doorMat || 'door', [sx * r - sx * 0.06, 0, sx > 0 ? -r * 0.95 : 0], [sx * r - sx * 0.06, 0, sx > 0 ? 0 : -r * 0.95], [sx * r - sx * 0.06, dh, sx > 0 ? 0 : -r * 0.95], [sx * r - sx * 0.06, dh, sx > 0 ? -r * 0.95 : 0], [[0, 0], [0.5, 0], [0.5, 1], [0, 1]]);
      }
      B.pop();
    }
  }
  // 顶部宇墙
  if (o.parapet !== false) {
    const ph = 1.1, pt = 0.6;
    B.box('wall', 0, H, D / 2 - pt / 2, W, ph, pt, { col, skip: 'b' });
    B.box('wall', 0, H, -D / 2 + pt / 2, W, ph, pt, { col, skip: 'b' });
    B.box('wall', W / 2 - pt / 2, H, 0, pt, ph, D - pt * 2, { col, skip: 'b' });
    B.box('wall', -W / 2 + pt / 2, H, 0, pt, ph, D - pt * 2, { col, skip: 'b' });
    B.box('brick', 0, H + ph, D / 2 - pt / 2, W + 0.1, 0.12, pt + 0.1, { col: rgb(0x7d7d80), skip: 'b' });
    B.box('brick', 0, H + ph, -D / 2 + pt / 2, W + 0.1, 0.12, pt + 0.1, { col: rgb(0x7d7d80), skip: 'b' });
  }
  B.quad('brick', [-W / 2, H + 0.01, D / 2], [W / 2, H + 0.01, D / 2], [W / 2, H + 0.01, -D / 2], [-W / 2, H + 0.01, -D / 2], [[0, 0], [W / 3, 0], [W / 3, D / 3], [0, D / 3]], rgb(0x9b9b9d));
  // 碰撞：整体阻挡，门洞可通行
  wblock(B, -W / 2 - 0.2, -D / 2 - 0.2, W / 2 + 0.2, D / 2 + 0.2);
  for (const t of tunnels) wfill(B, t.x - t.w / 2 + 0.3, -D / 2 - 0.3, t.x + t.w / 2 - 0.3, D / 2 + 0.3, 0);
  if (o.id) regPick(B, o.id, -W / 2, 0, -D / 2, W / 2, H, D / 2);
  regSolid(B, o.id, -W / 2, 0, -D / 2, W / 2, H + 1.3, D / 2);
  regMap(B, -W / 2, -D / 2, W / 2, D / 2, o.color ?? C.redCity, 'gate');
  if (o.plaque) plaque(B, o.plaque, 0, (tunnels.find((t) => Math.abs(t.x) < 0.1)?.h ?? H * 0.6) + (H - (tunnels.find((t) => Math.abs(t.x) < 0.1)?.h ?? H * 0.6)) * 0.62, D / 2 + 0.05, o.plaqueW ?? 3.2);
}

/** 宫墙：红墙 + 黄琉璃瓦墙帽。沿局部坐标直线（轴对齐） */
export function palaceWall(B, x0, z0, x1, z1, o = {}) {
  const h = o.h ?? 6.5, t = o.t ?? 1.6;
  const len = Math.hypot(x1 - x0, z1 - z0);
  if (len < 0.3) return;
  const col = rgb(o.color ?? C.redWall);
  const tile = o.tile ?? C.yellow;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const sx = alongX ? len : t, sz = alongX ? t : len;
  B.box('wall', cx, 0, cz, sx, h, sz, { col: shade(col, 0.92), colTop: shade(col, 0.62), skip: 'b', us: 0.5 });
  B.box('brick', cx, 0, cz, sx + (alongX ? 0 : 0.14), Math.min(1.1, h * 0.16), sz + (alongX ? 0.14 : 0), { col: rgb(0x8b8580), skip: 'b' });
  // 墙帽
  const cap = o.cap ?? 0.75;
  const ov = 0.35;
  const L = len + 0.2;
  const ht = t / 2 + ov;
  B.push(); B.sub(cx, h, cz, alongX ? 0 : Math.PI / 2);
  B.box('glaze', 0, 0, 0, L, 0.18, t + 0.2, { col: rgb(tile, 0.75), skip: 'b' });
  for (const s of [1, -1]) {
    B.quad('roof', [-L / 2 * s, 0.12, s * ht], [L / 2 * s, 0.12, s * ht], [L / 2 * s, cap, 0], [-L / 2 * s, cap, 0],
      [[-L / 2 / 0.84 * s, 0], [L / 2 / 0.84 * s, 0], [L / 2 / 0.84 * s, (ht + 0.4) / 1.68], [-L / 2 / 0.84 * s, (ht + 0.4) / 1.68]], rgb(tile));
  }
  B.box('glaze', 0, cap - 0.12, 0, L, 0.3, 0.32, { col: rgb(tile, 0.8) });
  B.pop();
  if (REG.col && !o.noCollide) {
    const a = B.P(x0, 0, z0), b = B.P(x1, 0, z1);
    REG.col.capsule(a[0], a[2], b[0], b[2], t / 2 + 0.25);
  }
  const a = B.P(x0, 0, z0), b = B.P(x1, 0, z1);
  REG.map.walls.push([a[0], a[2], b[0], b[2], o.color ?? C.redWall]);
  regSolid(B, null, Math.min(x0, x1) - (alongX ? 0 : t / 2), 0, Math.min(z0, z1) - (alongX ? t / 2 : 0), Math.max(x0, x1) + (alongX ? 0 : t / 2), h + cap, Math.max(z0, z1) + (alongX ? t / 2 : 0));
}

/** 随墙门 / 琉璃门：门洞 + 小屋顶 */
export function wallGate(B, x, z, rot, o = {}) {
  B.push(); B.sub(x, 0, z, rot);
  const w = o.w ?? 3.2, h = o.h ?? 4.6, t = o.t ?? 1.8;
  const wallH = o.wallH ?? 6.5;
  const tile = o.tile ?? C.yellow;
  const glazed = o.kind === 'glazed';
  const col = rgb(o.color ?? C.redWall);
  // 门垛
  const pw = glazed ? 1.4 : 0.9;
  for (const s of [-1, 1]) B.box('wall', s * (w / 2 + pw / 2), 0, 0, pw, wallH + 0.6, t + 0.3, { col, skip: 'b' });
  B.box('wall', 0, h, 0, w, wallH + 0.6 - h, t + 0.3, { col, skip: 'b' });
  if (glazed) {
    // 琉璃门罩：黄绿琉璃额枋与花饰
    B.box('glaze', 0, h, t / 2 + 0.16, w + 1.4, 0.7, 0.12, { col: rgb(C.green) });
    B.box('glaze', 0, h + 0.7, t / 2 + 0.18, w + 2.0, 0.55, 0.14, { col: rgb(C.yellow) });
    for (const s of [-1, 1]) B.box('glaze', s * (w / 2 + 1.0), h * 0.55, t / 2 + 0.16, 0.9, 0.9, 0.1, { col: rgb(C.green) });
  }
  // 门扇（打开）
  B.quad('door', [-w / 2 + 0.05, 0, t / 2 - 0.1], [-w / 2 + 0.05, 0, -w * 0.45], [-w / 2 + 0.05, h, -w * 0.45], [-w / 2 + 0.05, h, t / 2 - 0.1], [[0, 0], [0.5, 0], [0.5, 1], [0, 1]]);
  B.quad('door', [w / 2 - 0.05, 0, -w * 0.45], [w / 2 - 0.05, 0, t / 2 - 0.1], [w / 2 - 0.05, h, t / 2 - 0.1], [w / 2 - 0.05, h, -w * 0.45], [[0.5, 0], [1, 0], [1, 1], [0.5, 1]]);
  B.quad('brick', [-w / 2, 0.02, t / 2], [w / 2, 0.02, t / 2], [w / 2, 0.02, -t / 2], [-w / 2, 0.02, -t / 2], [[0, 0], [1, 0], [1, 1], [0, 1]], rgb(0x9a9a98));
  // 门顶小屋顶
  roof(B, { type: 'xieshan', hx: w / 2 + pw + 0.9, hz: t / 2 + 1.0, y0: wallH + 0.55, rise: 1.2, color: tile, lift: 0.25, scale: 0.55, noWen: false, wenH: 0.8 });
  if (REG.col) {
    const a = B.P(-w / 2 - pw, 0, -t / 2 - 0.2), b = B.P(-w / 2, 0, t / 2 + 0.2);
    REG.col.block(Math.min(a[0], b[0]), Math.min(a[2], b[2]), Math.max(a[0], b[0]), Math.max(a[2], b[2]));
    const c = B.P(w / 2, 0, -t / 2 - 0.2), d = B.P(w / 2 + pw, 0, t / 2 + 0.2);
    REG.col.block(Math.min(c[0], d[0]), Math.min(c[2], d[2]), Math.max(c[0], d[0]), Math.max(c[2], d[2]));
    const e = B.P(-w / 2, 0, -t / 2 - 0.6), f = B.P(w / 2, 0, t / 2 + 0.6);
    REG.col.fill(Math.min(e[0], f[0]), Math.min(e[2], f[2]), Math.max(e[0], f[0]), Math.max(e[2], f[2]), B.ty);
  }
  B.pop();
}

/**
 * 院落围墙：x0..x1, z0..z1（世界坐标），gates [{side:'s'|'n'|'e'|'w', at, w, kind:'glazed'|'plain'|'none'}]
 * kind 'none' 只留缺口（门殿另行放置）
 */
export function compound(B, o) {
  B.at((o.x0 + o.x1) / 2, o.y || 0, (o.z0 + o.z1) / 2, 0);
  const hx = (o.x1 - o.x0) / 2, hz = (o.z1 - o.z0) / 2;
  const h = o.h ?? 6.5, t = o.t ?? 1.5;
  const gates = o.gates || [];
  const side = (name, a0, a1, fixed, horiz) => {
    const gs = gates.filter((g) => g.side === name).map((g) => {
      const c = horiz ? g.at - (o.x0 + o.x1) / 2 : g.at - (o.z0 + o.z1) / 2;
      const gw = g.w ?? 3.2;
      const pw = g.kind === 'glazed' ? 1.4 : g.kind === 'none' ? 0 : 0.9;
      return { c, half: gw / 2 + pw, g };
    }).sort((a, b) => a.c - b.c);
    let cur = a0;
    for (const { c, half, g } of gs) {
      const e = c - half;
      if (e > cur + 0.2) horiz ? palaceWall(B, cur, fixed, e, fixed, { h, t, tile: o.tile, color: o.color }) : palaceWall(B, fixed, cur, fixed, e, { h, t, tile: o.tile, color: o.color });
      if (g.kind !== 'none') {
        const rot = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }[name];
        horiz ? wallGate(B, c, fixed, rot, { w: g.w, kind: g.kind, wallH: h, t, tile: o.tile, color: o.color }) : wallGate(B, fixed, c, rot, { w: g.w, kind: g.kind, wallH: h, t, tile: o.tile, color: o.color });
      }
      cur = c + half;
    }
    if (a1 > cur + 0.2) horiz ? palaceWall(B, cur, fixed, a1, fixed, { h, t, tile: o.tile, color: o.color }) : palaceWall(B, fixed, cur, fixed, a1, { h, t, tile: o.tile, color: o.color });
  };
  if (!o.skip?.includes('s')) side('s', -hx - t / 2, hx + t / 2, hz, true);
  if (!o.skip?.includes('n')) side('n', -hx - t / 2, hx + t / 2, -hz, true);
  if (!o.skip?.includes('e')) side('e', -hz + t / 2, hz - t / 2, hx, false);
  if (!o.skip?.includes('w')) side('w', -hz + t / 2, hz - t / 2, -hx, false);
}

/** 城墙段（梯形断面，赭红抹灰，外侧垛口，内侧宇墙） */
export function cityWall(B, x0, z0, x1, z1, outward, o = {}) {
  const H = o.H ?? 10, bt = o.bt ?? 8.62, tt = o.tt ?? 6.66;
  const len = Math.hypot(x1 - x0, z1 - z0);
  if (len < 0.5) return;
  const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  B.at(cx, 0, cz, alongX ? 0 : Math.PI / 2);
  // 局部：沿 x 方向延伸，outward 为 ±z
  const col = rgb(C.redCity);
  const taper = (bt - tt) / 2;
  B.box('wall', 0, 0, 0, len, H, bt, { col: shade(col, 0.78), colTop: col, skip: 'b', tz: taper, us: 0.5 });
  B.box('marble', 0, 0, 0, len, 0.9, bt + 0.3, { col: rgb(C.stone), skip: 'b' });
  B.quad('brick', [-len / 2, H + 0.01, tt / 2], [len / 2, H + 0.01, tt / 2], [len / 2, H + 0.01, -tt / 2], [-len / 2, H + 0.01, -tt / 2], [[0, 0], [len / 3, 0], [len / 3, tt / 3], [0, tt / 3]], rgb(0x8f8f92));
  const s = outward;
  // 外侧垛口
  const zo = s * (tt / 2 - 0.3);
  B.box('wall', 0, H, zo, len, 0.95, 0.6, { col, skip: 'b' });
  const step = 2.2, n = Math.floor(len / step);
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (i + 0.5) * step;
    B.box('wall', x, H + 0.95, zo, step * 0.62, 0.85, 0.6, { col, skip: 'b' });
    B.box('brick', x, H + 1.8, zo, step * 0.62 + 0.06, 0.1, 0.66, { col: rgb(0x77777a), skip: 'b' });
  }
  // 内侧宇墙
  const zi = -s * (tt / 2 - 0.25);
  B.box('wall', 0, H, zi, len, 1.0, 0.5, { col, skip: 'b' });
  B.box('brick', 0, H + 1.0, zi, len, 0.1, 0.56, { col: rgb(0x77777a), skip: 'b' });
  if (REG.col) {
    const a = B.P(-len / 2, 0, -bt / 2), b = B.P(len / 2, 0, bt / 2);
    REG.col.block(Math.min(a[0], b[0]) - 0.2, Math.min(a[2], b[2]) - 0.2, Math.max(a[0], b[0]) + 0.2, Math.max(a[2], b[2]) + 0.2);
  }
  REG.map.walls.push([x0, z0, x1, z1, C.redCity, bt]);
  regSolid(B, null, -len / 2, 0, -bt / 2, len / 2, H + 1.9, bt / 2);
}

/** 角楼：曲尺 / 十字平面，三重檐，十字脊歇山顶加宝顶 */
export function cornerTower(B, x, z, y, rot, id) {
  const col = REG.col; REG.col = null; // 城墙上的角楼不写碰撞
  try { cornerTowerBody(B, x, z, y, rot, id); } finally { REG.col = col; }
}
function cornerTowerBody(B, x, z, y, rot, id) {
  B.at(x, y, z, rot);
  const tile = C.yellow;
  const S = 9.2; // 中心方形柱网边长
  const P = 3.4; // 四面抱厦进深
  const PW = 6.6;
  platform(B, { hx: S / 2 + P + 1.2, hz: S / 2 + P + 1.2, h: 0.6, mat: 'marble', rail: true, stairs: [] });
  B.push(); B.sub(0, 0.6, 0);
  const colH = 4.8;
  const lacquer = rgb(C.lacquer);
  // 中心殿身
  B.box('wall', 0, 0, 0, S, colH, S, { col: rgb(C.redWall), skip: 'b' });
  for (const [dx, dz, w, d] of [[0, S / 2 + P / 2, PW, P], [0, -S / 2 - P / 2, PW, P], [S / 2 + P / 2, 0, P, PW], [-S / 2 - P / 2, 0, P, PW]]) {
    B.box('wall', dx, 0, dz, w - 0.6, colH, d - 0.6, { col: rgb(C.redWall), skip: 'b' });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.cyl('paint', dx + sx * w / 2, 0, dz + sz * d / 2, 0.24, 0.22, colH, 8, { col: lacquer });
  }
  // 隔扇（四面抱厦正面）
  for (let k = 0; k < 4; k++) {
    B.push(); B.sub(0, 0, 0, (k * Math.PI) / 2);
    B.quad('lattice', [-PW / 2 + 0.3, 0, S / 2 + P - 0.29], [PW / 2 - 0.3, 0, S / 2 + P - 0.29], [PW / 2 - 0.3, colH * 0.88, S / 2 + P - 0.29], [-PW / 2 + 0.3, colH * 0.88, S / 2 + P - 0.29], [[0, 0], [1.5, 0], [1.5, 1], [0, 1]]);
    ring(B, 'hexi', PW / 2, 0.01, colH, colH + 0.55, { skip: [1, 2, 3], perBay: [3] });
    B.pop();
  }
  ring(B, 'hexi', S / 2, S / 2, colH, colH + 0.6, { perBay: [3, 3, 3, 3] });
  // 第一重：腰檐（环绕十字形，近似为方形下檐）
  const y1 = colH + 0.9;
  roof(B, { type: 'skirt', hx: S / 2 + P + 1.6, hz: S / 2 + P + 1.6, top: [S / 2 + P - 0.8, S / 2 + P - 0.8], y0: y1, rise: 1.2, color: tile, beasts: 5, lift: 0.9, liftLen: 3.5, scale: 0.8, soffit: [S / 2 + P, S / 2 + P, y1 - 0.1] });
  // 第二重：四面抱厦歇山，山面朝外
  const y2 = y1 + 1.3;
  B.box('wall', 0, y1, 0, S, 3.0, S, { col: rgb(C.redWall), skip: 'b' });
  ring(B, 'dougong', S / 2 + 0.05, S / 2 + 0.05, y2 + 0.8, y2 + 1.5, { out: 0.4, us: 1 / 1.6 });
  for (let k = 0; k < 4; k++) {
    B.push(); B.sub(0, 0, 0, (k * Math.PI) / 2);
    B.push(); B.sub(0, 0, S / 2 + 0.6, Math.PI / 2);
    B.box('wall', 0, y2 - 0.2, 0, P + 1.2, 2.2, PW - 0.4, { col: rgb(C.redWall), skip: 'b' });
    roof(B, { type: 'xieshan', hx: P / 2 + 1.9, hz: PW / 2 + 1.0, y0: y2 + 1.9, rise: 2.4, color: tile, beasts: 3, scale: 0.65, lift: 0.7, liftLen: 2.2, wenH: 1.0, soffit: [P / 2 + 0.6, PW / 2 - 0.2, y2 + 1.7] });
    B.pop();
    B.pop();
  }
  // 第三重：十字脊歇山顶
  const y3 = y2 + 3.6;
  B.box('wall', 0, y2 + 1.5, 0, S - 1.2, 2.4, S - 1.2, { col: rgb(C.redWall), skip: 'b' });
  for (const r of [0, Math.PI / 2]) {
    B.push(); B.sub(0, 0, 0, r);
    roof(B, { type: 'xieshan', hx: S / 2 + 1.8, hz: S / 2 - 0.4, y0: y3, rise: 3.6, color: tile, beasts: 5, scale: 0.75, lift: 0.9, liftLen: 2.8, noWen: true, xg: S / 2 - 1.2, soffit: [S / 2 - 0.4, S / 2 - 1.4, y3 - 0.3] });
    B.pop();
  }
  B.push(); B.sub(0, y3 + 3.55, 0); finial(B, 0, 0.9); B.pop();
  B.pop();
  if (id) regPick(B, id, -S / 2 - P - 2, 0, -S / 2 - P - 2, S / 2 + P + 2, y3 + 6, S / 2 + P + 2);
  regSolid(B, id, -S / 2 - P - 1.6, 0, -S / 2 - P - 1.6, S / 2 + P + 1.6, y3 + 5.5, S / 2 + P + 1.6);
  regMap(B, -S / 2 - P, -S / 2 - P, S / 2 + P, S / 2 + P, tile);
}

/** 开敞的亭子：方亭 / 圆亭 / 八角亭；o.double 重檐 */
export function pavilion(B, o) {
  return hall(B, {
    front: 'open', dougong: o.dougong ?? false, caihua: o.caihua || 'su', lang: 0,
    base: { h: o.baseH ?? 0.8, mat: 'marble', rail: o.rail ?? false, stairs: o.stairs ?? [{ side: 'f', w: Math.min(3, o.W) }] },
    ...o,
  });
}

/** 长排廊庑 / 配房：硬山或卷棚，青灰或黄琉璃瓦 */
export function rowHouse(B, o) {
  return hall(B, {
    front: o.front || 'windows', dougong: o.dougong ?? false, caihua: o.caihua || 'xuanzi', roof: o.roof || 'yingshan',
    colH: o.colH ?? 3.4, lang: o.lang ?? 0, tile: o.tile ?? C.yellow,
    base: { h: o.baseH ?? 0.45, mat: o.baseMat || 'marble', stairs: o.stairs ?? [] },
    noMap: false,
    ...o,
  });
}
