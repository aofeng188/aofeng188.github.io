// 中国古建筑屋顶生成器（局部坐标：建筑中心为原点，正面朝 +z）。
//
// 庑殿 / 歇山 / 攒尖 / 盝顶 / 重檐腰檐 都可以看作「一圈圈收进的檐口轮廓」：
//   ax(u) = max(rxF, hx - u·kx),  az(u) = max(rzF, hz - u·kz)，u 从檐口 0 到屋脊 1；
//   高度 y(u) = y0 + rise · (u + k·u²) / (1 + k)，模拟「举折」——檐口平缓、近脊陡峭。
// 翼角：檐角附近抬高（起翘）并向外伸出（出冲），越往上越弱。
import { rgb } from '../core/buf.js';
import { C } from '../core/materials.js';

const ROW_L = 0.42; // 每节瓦长（米），贴图纵向 4 节

function profile(o) {
  const k = o.curve ?? 0.9;
  return (u) => o.y0 + o.rise * (u + k * u * u) / (1 + k);
}

function uSamples(n, extra = []) {
  const s = new Set();
  for (let i = 0; i <= n; i++) s.add(+Math.pow(i / n, 1.12).toFixed(5));
  for (const e of extra) if (e > 0 && e < 1) s.add(+e.toFixed(5));
  return [...s].sort((a, b) => a - b);
}

function sSamples(n) {
  const out = [];
  for (let j = 0; j <= n; j++) {
    const t = -1 + (2 * j) / n;
    out.push(Math.sin((Math.PI / 2) * t));
  }
  return out;
}

/** 弧长累计（用于纵向 UV） */
function arcLengths(us, D, Y) {
  const out = [0];
  for (let i = 1; i < us.length; i++) {
    const dd = D(us[i]) - D(us[i - 1]), dy = Y(us[i]) - Y(us[i - 1]);
    out.push(out[i - 1] + Math.hypot(dd, dy));
  }
  return out;
}

/** 沿折线按弧长取点 */
function along(pts, dist) {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (acc + l >= dist) {
      const t = (dist - acc) / (l || 1);
      return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], d: [b[0] - a[0], b[1] - a[1], b[2] - a[2]] };
    }
    acc += l;
  }
  const a = pts[pts.length - 2], b = pts[pts.length - 1];
  return { p: b.slice(), d: [b[0] - a[0], b[1] - a[1], b[2] - a[2]] };
}

/** 脊兽：仙人在前，n 只走兽依次排列 */
function beasts(B, hip, n, scale, col, lift = 0.12) {
  if (!n) return;
  const sp = 0.42 * scale;
  const start = 0.55 * scale;
  for (let i = 0; i <= n; i++) {
    const { p, d } = along(hip, start + i * sp);
    const L = Math.hypot(d[0], d[2]) || 1;
    const ang = Math.atan2(d[0] / L, d[2] / L);
    B.push();
    B.sub(p[0], p[1] + lift, p[2], ang + Math.PI);
    const h = (i === 0 ? 0.42 : 0.34) * scale;
    B.box('glaze', 0, 0, 0, 0.16 * scale, h, 0.24 * scale, { col });
    B.box('glaze', 0, h * 0.7, 0.09 * scale, 0.13 * scale, 0.16 * scale, 0.16 * scale, { col });
    B.pop();
  }
}

/** 正吻（大吻）：正脊两端的龙形构件，用几个盒子组成卷尾轮廓 */
function wen(B, x, y, h, w, col, dir) {
  B.box('glaze', x, y, 0, w * 1.3, h * 0.55, w * 1.5, { col });
  B.box('glaze', x - dir * w * 0.25, y + h * 0.55, 0, w * 1.1, h * 0.28, w * 1.25, { col });
  B.box('glaze', x - dir * w * 0.7, y + h * 0.78, 0, w * 0.75, h * 0.22, w * 0.9, { col });
  B.box('glaze', x + dir * w * 0.45, y + h * 0.25, 0, w * 0.5, h * 0.35, w * 1.1, { col: rgb(0xd4a43a) });
  // 剑把
  B.box('glaze', x - dir * w * 0.1, y + h * 0.8, 0, w * 0.18, h * 0.32, w * 0.18, { col });
}

/**
 * 主入口。o 见文件头注释与各字段默认值。
 * 返回 { topY } 便于上层放宝顶、计算高度等。
 */
export function roof(B, o) {
  const type = o.type || 'wudian';
  if (type === 'round' || type === 'poly') return roundRoof(B, o);
  if (type === 'yingshan' || type === 'xuanshan' || type === 'juanpeng') return gableRoof(B, o);

  const hx = o.hx, hz = o.hz;
  const Y = profile(o);
  const det = B.detail;
  const tileCol = rgb(o.color ?? C.yellow);
  const ridgeCol = rgb(o.ridgeColor ?? o.color ?? C.yellow, 0.88);
  const tileW = o.tileW || 0.55;
  const scale = o.scale || Math.max(0.6, Math.min(2.2, hz / 9));
  const lift = o.lift ?? Math.min(2.4, 0.15 * Math.min(hx, hz));
  const kick = o.kick ?? lift * 1.1;
  const Dl = o.liftLen ?? Math.min(hx, hz) * 0.72;

  // 轮廓参数
  let rxF, kx, rzF = 0, kz = hz, ug = 1;
  if (type === 'wudian') { const rx = o.rx ?? Math.max(0.5, hx - hz * 0.82); rxF = rx; kx = hx - rx; }
  else if (type === 'cuanjian') { rxF = 0; kx = hx; }
  else if (type === 'xieshan') { const xg = o.xg ?? hx - hz * 0.42; rxF = xg; kx = hz; ug = (hx - xg) / hz; }
  else if (type === 'luding') { const t = o.t ?? Math.min(hx, hz) * 0.45; rxF = hx - t; kx = t; rzF = hz - t; kz = t; }
  else if (type === 'skirt') { rxF = o.top[0]; kx = hx - o.top[0]; rzF = o.top[1]; kz = hz - o.top[1]; }
  const ax = (u) => Math.max(rxF, hx - u * kx);
  const az = (u) => Math.max(rzF, hz - u * kz);
  const fadeU = type === 'xieshan' ? ug : type === 'skirt' ? 1 : 0.7;
  const fade = (u) => Math.pow(Math.max(0, 1 - u / fadeU), 1.6);
  const liftAt = (d, u) => d >= Dl ? 0 : Math.pow(1 - d / Dl, 2.2) * fade(u);

  const rows = Math.max(5, Math.round(12 * det * Math.min(1.3, Math.max(0.6, hz / 10))));
  const colsF = Math.max(8, Math.round(26 * det * Math.min(1.3, Math.max(0.5, hx / 18))));
  const colsS = Math.max(8, Math.round(18 * det * Math.min(1.3, Math.max(0.5, hz / 12))));

  // 正面类（前/后）：沿向 A = ax，进深 D = az；侧面：A = az，D = ax
  const faces = [
    { name: 'f', A: ax, D: az, map: (a, b) => [a, b], ref: [0, 1, 1], uMax: 1 },
    { name: 'b', A: ax, D: az, map: (a, b) => [-a, -b], ref: [0, 1, -1], uMax: 1 },
    { name: 'r', A: az, D: ax, map: (a, b) => [b, -a], ref: [1, 1, 0], uMax: type === 'xieshan' ? ug : 1 },
    { name: 'l', A: az, D: ax, map: (a, b) => [-b, a], ref: [-1, 1, 0], uMax: type === 'xieshan' ? ug : 1 },
  ];

  const point = (f, u, s) => {
    const A = f.A(u), D = f.D(u);
    let a = s * A;
    const d = A - Math.abs(a);
    const L = liftAt(d, u);
    let b = D + kick * L;
    a += Math.sign(s) * kick * L;
    const [x, z] = f.map(a, b);
    return [x, Y(u) + lift * L, z];
  };

  for (const f of faces) {
    if (f.uMax <= 0.001) continue;
    const us = uSamples(rows, [ug]).filter((u) => u <= f.uMax + 1e-6);
    if (us[us.length - 1] < f.uMax - 1e-6) us.push(f.uMax);
    const ss = sSamples(f.name === 'f' || f.name === 'b' ? colsF : colsS);
    const arc = arcLengths(us, f.D, Y);
    B.grid('roof', us.length - 1, ss.length - 1,
      (i, j) => point(f, us[i], ss[j]),
      (i, j) => [(ss[j] * f.A(us[i])) / (2 * tileW), arc[i] / (4 * ROW_L)],
      tileCol, f.ref);
    // 檐口：瓦当 + 椽头
    if (!o.noFascia) {
      const ft = o.eaveT ?? 0.26 * scale + 0.16;
      const e0 = ss.map((s) => point(f, 0, s));
      for (let j = 0; j < e0.length - 1; j++) {
        const p = e0[j], q = e0[j + 1];
        const t0 = (ss[j] * f.A(0)) / (2 * tileW), t1 = (ss[j + 1] * f.A(0)) / (2 * tileW);
        B.quad('eave', [p[0], p[1] - ft * 0.45, p[2]], [q[0], q[1] - ft * 0.45, q[2]], [q[0], q[1] + 0.06, q[2]], [p[0], p[1] + 0.06, p[2]],
          [[t0, 0], [t1, 0], [t1, 1], [t0, 1]], tileCol);
        const u0 = (ss[j] * f.A(0)) / (4 * 0.32), u1 = (ss[j + 1] * f.A(0)) / (4 * 0.32);
        B.quad('rafter', [p[0], p[1] - ft, p[2]], [q[0], q[1] - ft, q[2]], [q[0], q[1] - ft * 0.45, q[2]], [p[0], p[1] - ft * 0.45, p[2]],
          [[u0, 0], [u1, 0], [u1, 0.11], [u0, 0.11]]);
      }
    }
    // 檐下（椽子望板）
    if (o.soffit) {
      const [sx, sz, sy] = o.soffit;
      const ft = o.eaveT ?? 0.18 * scale + 0.12;
      const SA = f.name === 'f' || f.name === 'b' ? sx : sz, SD = f.name === 'f' || f.name === 'b' ? sz : sx;
      const A0 = f.A(0), D0 = f.D(0);
      const tr = 4;
      const sp = (t, s) => {
        const A = A0 + (SA - A0) * t, D = D0 + (SD - D0) * t;
        let a = s * A;
        const d = A - Math.abs(a);
        const L = d >= Dl ? 0 : Math.pow(1 - d / Dl, 2.2) * (1 - t);
        const b = D + kick * L; a += Math.sign(s) * kick * L;
        const [x, z] = f.map(a, b);
        const y0 = Y(0) - ft + lift * L;
        return [x, y0 + (sy - y0) * Math.pow(t, 0.85), z];
      };
      const ss2 = sSamples(Math.max(6, Math.round(ss.length * 0.6)));
      B.grid('rafter', tr, ss2.length - 1, (i, j) => sp(i / tr, ss2[j]),
        (i, j) => [(ss2[j] * (A0 + (SA - A0) * (i / tr))) / (4 * 0.32), (i / tr) * Math.max(1, D0 - SD) / 3],
        [255, 255, 255], [0, -1, 0], (i) => { const k = Math.round(255 * (1 - 0.6 * (i / tr))); return [k, k, k]; });
    }
  }

  // ---- 山花（歇山） ----
  if (type === 'xieshan') {
    const xg = rxF;
    const inset = Math.max(0.2, 0.03 * hz);
    const pts = [];
    const n = 8;
    for (let i = 0; i <= n; i++) { const u = ug + (1 - ug) * (i / n); pts.push([az(u) - 0.05, Y(u) - 0.1]); }
    const prof = pts.concat(pts.slice(0, -1).reverse().map(([z, y]) => [-z, y]));
    for (const sgn of [1, -1]) {
      const x = sgn * (xg - inset);
      const poly = prof.map(([z, y]) => [x, y, z]);
      const ymin = Y(ug) - 0.1;
      B.poly('gable', poly, [sgn, 0, 0], (p) => [p[2] / 3, (p[1] - ymin) / 2], [255, 255, 255]);
    }
  }

  // ---- 屋脊 ----
  const rw = (o.ridgeW ?? 0.32 * scale + 0.1), rh = (o.ridgeH ?? 0.45 * scale);
  const hipW = rw * 0.75, hipH = rh * 0.55;
  const corner = (sx, sz, u) => {
    const L = liftAt(0, u);
    return [sx * (ax(u) + kick * L), Y(u) + lift * L, sz * (az(u) + kick * L)];
  };
  const hipU = type === 'xieshan' ? ug : 1;
  const hipUs = uSamples(10, []).map((u) => u * hipU);
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const hip = hipUs.map((u) => corner(sx, sz, u));
    B.ridge('ridge', hip, hipW, hipH, ridgeCol);
    // 套兽
    const tip = hip[0];
    B.box('glaze', tip[0] + sx * 0.12 * scale, tip[1] - 0.25 * scale, tip[2] + sz * 0.12 * scale, 0.22 * scale, 0.26 * scale, 0.22 * scale, { col: ridgeCol });
    if (o.beasts) beasts(B, hip, o.beasts, Math.min(1.6, scale), ridgeCol, hipH * 0.85);
  }
  const topY = Y(1);
  if (type === 'wudian' || type === 'xieshan') {
    const rx = rxF + (type === 'xieshan' ? 0.15 : 0);
    B.box('ridge', 0, topY - rh * 0.3, 0, rx * 2, rh * 1.25, rw, { col: ridgeCol, us: 1 / (rh * 1.25) });
    if (type === 'xieshan') {
      // 垂脊：沿山面前后两条
      for (const sx of [1, -1]) for (const sz of [1, -1]) {
        const us = uSamples(8).map((u) => ug + (1 - ug) * u);
        B.ridge('ridge', us.map((u) => [sx * (rxF + 0.08), Y(u), sz * az(u)]), hipW, hipH, ridgeCol);
      }
    }
    if (!o.noWen) {
      const wh = o.wenH ?? rh * 3.2;
      for (const s of [1, -1]) wen(B, s * rx, topY + rh * 0.6, wh, rw * 1.1, ridgeCol, s);
    }
  } else if (type === 'skirt') {
    // 围脊：腰檐与上层墙身交接处
    const [bx, bz] = o.top;
    const y = Y(1);
    B.box('ridge', 0, y - rh * 0.3, bz, bx * 2 + rw, rh * 0.9, rw, { col: ridgeCol, us: 1 / (rh * 0.9) });
    B.box('ridge', 0, y - rh * 0.3, -bz, bx * 2 + rw, rh * 0.9, rw, { col: ridgeCol, us: 1 / (rh * 0.9) });
    B.box('ridge', bx, y - rh * 0.3, 0, rw, rh * 0.9, bz * 2, { col: ridgeCol, us: 1 / (rh * 0.9) });
    B.box('ridge', -bx, y - rh * 0.3, 0, rw, rh * 0.9, bz * 2, { col: ridgeCol, us: 1 / (rh * 0.9) });
  } else if (type === 'luding') {
    const tx = rxF, tz = rzF;
    B.box('glaze', 0, topY - 0.05, 0, tx * 2, 0.12, tz * 2, { col: rgb(o.color ?? C.yellow, 0.75), skip: 'b' });
    for (const [x, z, sx, sz] of [[0, tz, tx * 2, rw], [0, -tz, tx * 2, rw], [tx, 0, rw, tz * 2], [-tx, 0, rw, tz * 2]])
      B.box('glaze', x, topY - rh * 0.2, z, sx, rh, sz, { col: ridgeCol });
  } else if (type === 'cuanjian') {
    finial(B, topY - 0.2, scale, o.finialColor);
  }
  return { topY: topY + (type === 'wudian' || type === 'xieshan' ? rh * 3 : rh) };
}

/** 宝顶：鎏金宝顶 */
export function finial(B, y, scale = 1, col) {
  const c = col ? rgb(col) : rgb(C.gold);
  B.cyl('glaze', 0, y, 0, 0.55 * scale, 0.4 * scale, 0.5 * scale, 10, { col: rgb(C.yellow, 0.8) });
  B.cyl('gold', 0, y + 0.5 * scale, 0, 0.18 * scale, 0.12 * scale, 0.5 * scale, 8, { col: c });
  B.sphere('gold', 0, y + 1.25 * scale, 0, 0.42 * scale, 0.5 * scale, 0.42 * scale, 10, c);
  B.cyl('gold', 0, y + 1.7 * scale, 0, 0.08 * scale, 0.02 * scale, 0.5 * scale, 6, { col: c });
}

/** 圆形 / 多边形攒尖顶 */
function roundRoof(B, o) {
  const N = o.type === 'round' ? Math.max(12, Math.round((o.seg || 24) * B.detail)) : (o.sides || 8);
  const R = o.r;
  const Y = profile(o);
  const tileCol = rgb(o.color ?? C.yellow);
  const ridgeCol = rgb(o.ridgeColor ?? o.color ?? C.yellow, 0.82);
  const scale = o.scale || Math.max(0.5, R / 7);
  const lift = o.type === 'poly' ? (o.lift ?? 0.08 * R) : 0;
  const rows = Math.max(5, Math.round(10 * B.detail));
  const us = uSamples(rows);
  const rot = o.type === 'poly' ? Math.PI / N : 0;
  const pt = (u, k) => {
    // k 为连续角度参数（边数 N）
    const kk = Math.floor(k), t = k - kk;
    const a0 = (kk / N) * Math.PI * 2 + rot, a1 = ((kk + 1) / N) * Math.PI * 2 + rot;
    const r = R * (1 - u);
    let x, z;
    if (o.type === 'round') { const a = (k / N) * Math.PI * 2; x = Math.cos(a) * r; z = Math.sin(a) * r; }
    else { x = (Math.cos(a0) * (1 - t) + Math.cos(a1) * t) * r; z = (Math.sin(a0) * (1 - t) + Math.sin(a1) * t) * r; }
    const cd = Math.min(t, 1 - t) * 2; // 距角点 0..1
    const L = o.type === 'poly' ? Math.pow(1 - cd, 2.5) * Math.pow(1 - u, 1.6) : 0;
    const k2 = 1 + L * 0.06;
    return [x * k2, Y(u) + lift * L, z * k2];
  };
  const sub = o.type === 'round' ? 1 : 6;
  const cols = N * sub;
  const arc = arcLengths(us, (u) => R * (1 - u), Y);
  B.grid('roof', us.length - 1, cols, (i, j) => pt(us[i], j / sub), (i, j) => [(j / cols) * (2 * Math.PI * R) / (2 * 0.5), arc[i] / (4 * ROW_L)], tileCol, [0, 1, 0]);
  // 檐下
  if (o.soffit) {
    const [sr, sy] = o.soffit;
    B.grid('rafter', 3, cols, (i, j) => {
      const t = i / 3;
      const p = pt(0, j / sub);
      const k = (R + (sr - R) * t) / R;
      return [p[0] * k, p[1] - 0.25 + (sy - p[1] + 0.25) * t, p[2] * k];
    }, (i, j) => [j / cols * (2 * Math.PI * R) / 1.28, i / 3], [255, 255, 255], [0, -1, 0]);
  }
  // 垂脊
  const nr = o.type === 'round' ? 8 : N;
  for (let k = 0; k < nr; k++) {
    const kk = o.type === 'round' ? (k / nr) * N : k;
    B.ridge('ridge', us.map((u) => pt(u, kk)), 0.18 * scale + 0.06, 0.2 * scale, ridgeCol);
  }
  finial(B, Y(1) - 0.15, scale * 0.8, o.finialColor);
  return { topY: Y(1) + 2 * scale };
}

/** 硬山 / 悬山 / 卷棚：两坡顶 */
function gableRoof(B, o) {
  const hx = o.hx, hz = o.hz;
  const Y = profile({ ...o, curve: o.curve ?? 0.7 });
  const det = B.detail;
  const tileCol = rgb(o.color ?? C.grey);
  const ridgeCol = rgb(o.ridgeColor ?? o.color ?? C.grey, 0.82);
  const tileW = o.tileW || 0.42;
  const scale = o.scale || Math.max(0.5, Math.min(1.6, hz / 6));
  const rows = Math.max(4, Math.round(8 * det));
  const cols = Math.max(2, Math.round((hx * 2) / 6 * det));
  const us = uSamples(rows);
  const arc = arcLengths(us, (u) => hz * (1 - u), Y);
  for (const s of [1, -1]) {
    B.grid('roof', us.length - 1, cols, (i, j) => {
      const a = -hx + (2 * hx * j) / cols;
      return [s * a, Y(us[i]), s * hz * (1 - us[i])];
    }, (i, j) => [(-hx + (2 * hx * j) / cols) / (2 * tileW), arc[i] / (4 * ROW_L)], tileCol, [0, 1, s]);
    if (o.soffit) {
      const [, sz, sy] = o.soffit;
      const y0 = Y(0) - 0.25;
      B.quad('rafter', [s * -hx, y0, s * hz], [s * hx, y0, s * hz], [s * hx, sy, s * sz], [s * -hx, sy, s * sz],
        [[-hx / 1.28, 0], [hx / 1.28, 0], [hx / 1.28, 1], [-hx / 1.28, 1]]);
    }
    // 檐口
    B.quad('eave', [s * -hx, Y(0) - 0.26, s * hz], [s * hx, Y(0) - 0.26, s * hz], [s * hx, Y(0) + 0.05, s * hz], [s * -hx, Y(0) + 0.05, s * hz],
      [[0, 0], [hx / tileW, 0], [hx / tileW, 1], [0, 1]], tileCol);
  }
  // 山墙（硬山）：墙体一直砌到屋面下
  const wx = o.gableX ?? hx - (o.type === 'xuanshan' ? 0.7 : 0.12);
  const wz = o.gableZ ?? hz - 0.6;
  const wallMat = o.gableMat || 'wall';
  const wallCol = rgb(o.gableColor ?? C.redWall);
  if (o.gableFrom !== undefined) {
    const n = 8;
    const prof = [];
    for (let i = 0; i <= n; i++) { const u = (1 - wz / hz) + (wz / hz) * (i / n); prof.push([hz * (1 - u), Y(u) - 0.05]); }
    const full = [[wz, o.gableFrom]].concat(prof, prof.slice(0, -1).reverse().map(([z, y]) => [-z, y]), [[-wz, o.gableFrom]]);
    for (const sx of [1, -1]) {
      B.poly(wallMat, full.map(([z, y]) => [sx * wx, y, z]), [sx, 0, 0], (p) => [p[2] / 2, p[1] / 2], wallCol);
    }
  }
  // 屋脊
  const rw = o.ridgeW ?? 0.28 * scale + 0.08, rh = o.ridgeH ?? 0.36 * scale;
  if (o.type === 'juanpeng') {
    B.box('glaze', 0, Y(1) - rh * 0.4, 0, hx * 2, rh * 0.6, rw * 1.6, { col: tileCol });
  } else {
    B.box('ridge', 0, Y(1) - rh * 0.3, 0, hx * 2 + 0.1, rh * 1.2, rw, { col: ridgeCol, us: 1 / (rh * 1.2) });
    if (o.wen) for (const s of [1, -1]) wen(B, s * hx, Y(1) + rh * 0.5, rh * 2.6, rw, ridgeCol, s);
  }
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    const pts = uSamples(6).map((u) => [sx * (hx - 0.02), Y(u) + 0.02, sz * hz * (1 - u)]);
    B.ridge('ridge', pts, rw * 0.7, rh * 0.5, ridgeCol);
    if (o.beasts) beasts(B, pts, o.beasts, scale, ridgeCol, rh * 0.45);
  }
  return { topY: Y(1) + rh };
}
