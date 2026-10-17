// 用 Canvas 程序化绘制的纹理。所有纹理都在本地生成，不依赖外部图片。
import * as THREE from 'three';

export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

let ANISO = 4;
export function setAnisotropy(a) { ANISO = a; }

function tex(c, { srgb = true, repeat = true, mips = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = ANISO;
  t.generateMipmaps = mips;
  t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

/** 可平铺的值噪声 */
function noiseField(w, h, cell, rand) {
  const gw = Math.ceil(w / cell), gh = Math.ceil(h / cell);
  const g = new Float32Array(gw * gh).map(() => rand());
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const fx = x / cell, fy = y / cell;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = g[(y0 % gh) * gw + (x0 % gw)], b = g[(y0 % gh) * gw + ((x0 + 1) % gw)];
    const c = g[((y0 + 1) % gh) * gw + (x0 % gw)], d = g[((y0 + 1) % gh) * gw + ((x0 + 1) % gw)];
    out[y * w + x] = (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
  }
  return out;
}

function fbm(w, h, cells, rand) {
  const out = new Float32Array(w * h);
  let amp = 1, tot = 0;
  for (const c of cells) {
    const n = noiseField(w, h, c, rand);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    tot += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}

function greyFromField(ctx, w, h, f, lo, hi) {
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < w * h; i++) {
    const v = Math.round(255 * (lo + (hi - lo) * f[i]));
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/** 琉璃瓦：灰度底色（由顶点颜色着色）+ 法线贴图。贴图横向 2 垄、纵向 4 行。 */
export function tileTextures() {
  const W = 256, H = 256;
  const [c, ctx] = canvas(W, H);
  const [cn, nctx] = canvas(W, H);
  const rand = rng(11);
  const img = ctx.createImageData(W, H), nimg = nctx.createImageData(W, H);
  const rowVar = [];
  for (let r = 0; r < 8; r++) rowVar.push([0.9 + rand() * 0.2, 0.9 + rand() * 0.2]);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const col = Math.floor(x / 128), lx = (x % 128) / 128; // 0..1 一垄
      const row = Math.floor(y / 64), ly = (y % 64) / 64;
      let v, nx = 0, ny = 0;
      // 筒瓦占 0.18..0.82，板瓦沟在两侧
      if (lx > 0.16 && lx < 0.84) {
        const t = (lx - 0.5) / 0.34; // -1..1
        const ang = Math.asin(Math.max(-1, Math.min(1, t)));
        nx = Math.sin(ang) * 0.95;
        v = 0.62 + 0.38 * Math.cos(ang) ** 0.6;
        // 每节筒瓦上端被上一节压住，形成细缝
        if (ly > 0.94) { v *= 0.55; ny = -0.6; } else if (ly < 0.06) { ny = 0.3; v *= 1.04; }
        v *= rowVar[row][col];
        // 高光条纹（釉面）
        v += Math.max(0, 0.12 - Math.abs(t + 0.35) * 0.4);
      } else {
        // 板瓦：凹沟
        const t = lx < 0.5 ? lx / 0.16 : (1 - lx) / 0.16; // 0 边缘 → 1 筒瓦边
        v = 0.36 + 0.12 * (1 - t);
        nx = (lx < 0.5 ? -1 : 1) * 0.35 * t;
        if ((ly * 2) % 1 > 0.92) { v *= 0.7; ny = -0.4; }
      }
      const i = (y * W + x) * 4;
      const g = Math.max(0, Math.min(255, Math.round(v * 255)));
      img.data[i] = img.data[i + 1] = img.data[i + 2] = g; img.data[i + 3] = 255;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      nimg.data[i] = Math.round((nx * 0.5 + 0.5) * 255);
      nimg.data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      nimg.data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      nimg.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0); nctx.putImageData(nimg, 0, 0);
  return { map: tex(c), normalMap: tex(cn, { srgb: false }) };
}

/** 墙面抹灰（灰度，由顶点颜色着色）：斑驳与雨痕 */
export function plasterTexture() {
  const W = 512, H = 512;
  const [c, ctx] = canvas(W, H);
  const rand = rng(21);
  const f = fbm(W, H, [128, 64, 16, 4], rand);
  const img = ctx.createImageData(W, H);
  const streak = new Float32Array(W).map(() => rand());
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    let v = 0.82 + (f[i] - 0.5) * 0.28;
    v -= Math.max(0, streak[x] - 0.82) * 0.5 * (0.5 + 0.5 * Math.sin(y * 0.02 + x));
    const g = Math.round(Math.max(0, Math.min(1, v)) * 255);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = g; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return tex(c);
}

/** 汉白玉：带石块分缝与细纹 */
export function marbleTexture() {
  const W = 512, H = 512;
  const [c, ctx] = canvas(W, H);
  const rand = rng(31);
  const f = fbm(W, H, [128, 32, 8, 2], rand);
  greyFromField(ctx, W, H, f, 0.8, 1.0);
  ctx.strokeStyle = 'rgba(90,90,85,0.35)';
  ctx.lineWidth = 1.5;
  for (let y = 0; y <= H; y += 128) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  for (let r = 0; r < 4; r++) {
    const off = (r % 2) * 128;
    for (let x = off; x <= W; x += 256) { ctx.beginPath(); ctx.moveTo(x, r * 128); ctx.lineTo(x, r * 128 + 128); ctx.stroke(); }
  }
  ctx.strokeStyle = 'rgba(120,118,110,0.12)';
  for (let k = 0; k < 18; k++) {
    ctx.beginPath();
    let x = rand() * W, y = rand() * H; ctx.moveTo(x, y);
    for (let s = 0; s < 8; s++) { x += (rand() - 0.5) * 60; y += rand() * 30; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  return tex(c);
}

/** 城砖 / 地面铺砖（灰度） */
export function brickTexture({ bw = 128, bh = 64, mortar = 3, lo = 0.55, hi = 0.85, seed = 41, stagger = true } = {}) {
  const W = 512, H = 512;
  const [c, ctx] = canvas(W, H);
  const rand = rng(seed);
  const f = fbm(W, H, [64, 16, 4], rand);
  greyFromField(ctx, W, H, f, 0.9, 1.0);
  const img = ctx.getImageData(0, 0, W, H);
  const rows = H / bh;
  for (let r = 0; r < rows; r++) {
    const off = stagger && r % 2 ? bw / 2 : 0;
    for (let x0 = -bw; x0 < W; x0 += bw) {
      const base = lo + (hi - lo) * rand();
      for (let y = r * bh; y < (r + 1) * bh; y++) for (let x = x0 + off; x < x0 + off + bw; x++) {
        const xx = ((x % W) + W) % W;
        const i = (y * W + xx) * 4;
        const edge = y - r * bh < mortar || x - x0 - off < mortar;
        const m = img.data[i] / 255;
        const v = edge ? 0.38 * m : base * m;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(v * 255);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return tex(c);
}

/** 隔扇门：一开间 4 扇，上部三交六椀菱花，下部裙板 */
export function latticeTexture(rich = true) {
  const W = 256, H = 512;
  const [c, ctx] = canvas(W, H);
  const frame = rich ? '#7b2318' : '#6e2a1e';
  const gold = rich ? '#c9a24a' : '#9b6b3a';
  ctx.fillStyle = frame; ctx.fillRect(0, 0, W, H);
  const pw = W / 4;
  for (let p = 0; p < 4; p++) {
    const x0 = p * pw + 4, w = pw - 8;
    // 格心（上部 58%）
    const y0 = 14, h = H * 0.56;
    ctx.fillStyle = '#2a1410'; ctx.fillRect(x0 + 3, y0, w - 6, h);
    ctx.strokeStyle = gold; ctx.lineWidth = 2.2;
    ctx.save(); ctx.beginPath(); ctx.rect(x0 + 3, y0, w - 6, h); ctx.clip();
    const s = 12;
    for (let k = -40; k < 80; k++) {
      ctx.beginPath(); ctx.moveTo(x0 + k * s, y0); ctx.lineTo(x0 + k * s + h * 0.577, y0 + h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0 + k * s, y0); ctx.lineTo(x0 + k * s - h * 0.577, y0 + h); ctx.stroke();
    }
    for (let y = y0; y < y0 + h; y += s * 0.866) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = rich ? '#d8b25a' : '#8c5a30'; ctx.lineWidth = 3; ctx.strokeRect(x0 + 3, y0, w - 6, h);
    // 绦环板
    const y1 = y0 + h + 10;
    ctx.fillStyle = '#5c1a12'; ctx.fillRect(x0 + 5, y1, w - 10, 34);
    ctx.strokeStyle = gold; ctx.lineWidth = 2; ctx.strokeRect(x0 + 9, y1 + 4, w - 18, 26);
    // 裙板
    const y2 = y1 + 46, h2 = H - y2 - 18;
    ctx.fillStyle = '#5c1a12'; ctx.fillRect(x0 + 5, y2, w - 10, h2);
    ctx.strokeStyle = gold; ctx.lineWidth = 2; ctx.strokeRect(x0 + 9, y2 + 5, w - 18, h2 - 10);
    if (rich) {
      ctx.beginPath(); ctx.ellipse(x0 + w / 2, y2 + h2 / 2, w * 0.28, h2 * 0.3, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#b8903e'; ctx.fill();
    }
  }
  // 门框
  ctx.fillStyle = '#4a1610'; ctx.fillRect(0, 0, W, 8); ctx.fillRect(0, H - 10, W, 10);
  return tex(c, { repeat: false });
}

/** 彩画额枋：一开间。kind = 'hexi'（和玺）| 'xuanzi'（旋子）| 'su'（苏式） */
export function caihuaTexture(kind = 'hexi') {
  const W = 512, H = 128;
  const [c, ctx] = canvas(W, H);
  const BLUE = '#1d4a7c', GREEN = '#22705e', GOLD = kind === 'hexi' ? '#e2bd52' : '#e9e2c8', RED = '#8c2a1f';
  const band = (y, h, a, b) => {
    // 箍头
    ctx.fillStyle = a; ctx.fillRect(0, y, W, h);
    ctx.fillStyle = b; ctx.fillRect(0, y, 26, h); ctx.fillRect(W - 26, y, 26, h);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 3;
    ctx.strokeRect(0, y + 2, 26, h - 4); ctx.strokeRect(W - 26, y + 2, 26, h - 4);
    // 枋心
    const x0 = W * 0.3, x1 = W * 0.7;
    ctx.fillStyle = b;
    ctx.beginPath();
    ctx.moveTo(x0, y + h / 2); ctx.lineTo(x0 + 18, y + 4); ctx.lineTo(x1 - 18, y + 4);
    ctx.lineTo(x1, y + h / 2); ctx.lineTo(x1 - 18, y + h - 4); ctx.lineTo(x0 + 18, y + h - 4); ctx.closePath();
    ctx.fill(); ctx.stroke();
    if (kind === 'su') {
      // 包袱
      ctx.fillStyle = '#f2ead8';
      ctx.beginPath(); ctx.ellipse(W / 2, y + 4, 70, h - 10, 0, 0, Math.PI); ctx.fill();
      ctx.strokeStyle = '#3d6b5a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(W / 2 - 50, y + h * 0.6); ctx.quadraticCurveTo(W / 2 - 10, y + 10, W / 2 + 40, y + h * 0.65); ctx.stroke();
    } else if (kind === 'hexi') {
      // 龙纹（示意）
      ctx.strokeStyle = GOLD; ctx.lineWidth = 3.5;
      ctx.beginPath();
      for (let t = 0; t <= 1; t += 0.02) {
        const xx = x0 + 30 + t * (x1 - x0 - 60), yy = y + h / 2 + Math.sin(t * Math.PI * 3) * h * 0.22;
        t === 0 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy);
      }
      ctx.stroke();
      ctx.fillStyle = GOLD;
      ctx.beginPath(); ctx.arc(W / 2, y + h / 2, h * 0.12, 0, Math.PI * 2); ctx.fill();
    }
    // 找头：和玺为圭线光（W 形金线），旋子为旋花
    ctx.strokeStyle = GOLD; ctx.lineWidth = 3;
    for (const [s, e] of [[26, x0], [x1, W - 26]]) {
      if (kind === 'hexi') {
        ctx.beginPath();
        const m = (s + e) / 2;
        ctx.moveTo(s + 6, y + 4); ctx.lineTo(m - 10, y + h / 2); ctx.lineTo(s + 6, y + h - 4);
        ctx.moveTo(e - 6, y + 4); ctx.lineTo(m + 10, y + h / 2); ctx.lineTo(e - 6, y + h - 4);
        ctx.stroke();
        ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(m, y + h / 2, 5, 0, Math.PI * 2); ctx.fill();
      } else {
        const m = (s + e) / 2;
        for (const dx of [-22, 22]) {
          ctx.beginPath(); ctx.arc(m + dx, y + h / 2, h * 0.32, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(m + dx, y + h / 2, h * 0.14, 0, Math.PI * 2); ctx.stroke();
        }
      }
    }
  };
  band(0, 58, GREEN, BLUE);
  ctx.fillStyle = RED; ctx.fillRect(0, 58, W, 16);
  ctx.fillStyle = GOLD; for (let x = 20; x < W; x += 40) ctx.fillRect(x, 62, 10, 8);
  band(74, 54, BLUE, GREEN);
  return tex(c);
}

/** 斗拱带：一攒斗拱 + 拱眼壁 */
export function dougongTexture() {
  const W = 256, H = 128;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#16233a'; ctx.fillRect(0, 0, W, H);
  // 拱眼壁（红）
  ctx.fillStyle = '#6e2318'; ctx.fillRect(0, 30, W, 70);
  const set = (cx) => {
    const layers = [[30, 22, '#215f7e'], [52, 18, '#2a7462'], [76, 16, '#215f7e'], [98, 14, '#2a7462']];
    let y = H - 14;
    // 坐斗
    ctx.fillStyle = '#2a7462'; ctx.fillRect(cx - 14, y, 28, 14);
    for (const [hw, h, colr] of layers) {
      y -= h;
      ctx.fillStyle = colr; ctx.fillRect(cx - hw, y, hw * 2, h - 3);
      ctx.fillStyle = '#e6d9a8'; ctx.fillRect(cx - hw, y + h - 5, hw * 2, 2);
      ctx.fillStyle = '#0d1626'; ctx.fillRect(cx - hw + 4, y + h - 3, hw * 2 - 8, 3);
    }
  };
  set(64); set(192);
  // 挑檐枋
  ctx.fillStyle = '#215f7e'; ctx.fillRect(0, 0, W, 10);
  ctx.fillStyle = '#e6d9a8'; ctx.fillRect(0, 9, W, 2);
  return tex(c);
}

/** 檐下椽子：青绿椽、红望板、椽头 */
export function rafterTexture() {
  const W = 256, H = 256;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#7c2a1e'; ctx.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 64) {
    const g = ctx.createLinearGradient(x + 10, 0, x + 54, 0);
    g.addColorStop(0, '#1b4d3c'); g.addColorStop(0.5, '#2f7a5f'); g.addColorStop(1, '#173f33');
    ctx.fillStyle = g; ctx.fillRect(x + 10, 0, 44, H);
    // 椽头（靠檐口一端）
    ctx.fillStyle = '#1f4f86'; ctx.fillRect(x + 10, 0, 44, 30);
    ctx.fillStyle = '#e8c35a'; ctx.beginPath(); ctx.arc(x + 32, 15, 9, 0, Math.PI * 2); ctx.fill();
  }
  return tex(c);
}

/** 宫门：朱红门板 + 九路门钉 + 铺首 */
export function doorTexture(rows = 9, cols = 9) {
  const W = 256, H = 512;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#8f2016'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#5a130d'; ctx.fillRect(W / 2 - 2, 0, 4, H);
  for (const half of [0, 1]) {
    const x0 = half * W / 2;
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols / 2 + 0.5; k++) {
      const x = x0 + 14 + k * ((W / 2 - 28) / (Math.ceil(cols / 2) - 1 || 1));
      const y = 30 + r * ((H - 60) / (rows - 1));
      const g = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, 7);
      g.addColorStop(0, '#fff2b0'); g.addColorStop(0.5, '#d9a93c'); g.addColorStop(1, '#7a5418');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 6.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  // 铺首
  for (const x of [W / 2 - 22, W / 2 + 22]) {
    ctx.fillStyle = '#c8952e'; ctx.beginPath(); ctx.arc(x, H * 0.52, 13, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, H * 0.52 + 14, 10, 0, Math.PI * 2); ctx.stroke();
  }
  return tex(c, { repeat: false });
}

/** 山花板：红底金色绶带 */
export function gableTexture() {
  const W = 256, H = 128;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#8a2a1c'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#d6ad4c'; ctx.lineWidth = 4;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 4) { const y = H * 0.55 + Math.sin(x / W * Math.PI * 4) * H * 0.18; x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
  ctx.stroke();
  ctx.fillStyle = '#d6ad4c';
  for (let x = 32; x < W; x += 64) { ctx.beginPath(); ctx.arc(x, H * 0.35, 9, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#5b1c12'; ctx.fillRect(0, H - 10, W, 10);
  return tex(c);
}

/** 天花板：井口天花（青绿底、金色团龙） */
export function ceilingTexture() {
  const W = 256, H = 256;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#1f6a52'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#143e6a'; ctx.fillRect(14, 14, W - 28, H - 28);
  ctx.strokeStyle = '#e1bb54'; ctx.lineWidth = 4; ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 70, 0, Math.PI * 2); ctx.fillStyle = '#1f6a52'; ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e1bb54';
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 2; a += 0.05) { const r = 40 + Math.sin(a * 5) * 12; const x = W / 2 + Math.cos(a) * r, y = H / 2 + Math.sin(a) * r; a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
  ctx.fill();
  ctx.fillStyle = '#c84a2e'; ctx.beginPath(); ctx.arc(W / 2, H / 2, 12, 0, Math.PI * 2); ctx.fill();
  for (const [x, y] of [[14, 14], [W - 14, 14], [14, H - 14], [W - 14, H - 14]]) { ctx.fillStyle = '#e1bb54'; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); }
  return tex(c);
}

/** 可平铺的水面法线 */
export function waterNormalTexture() {
  const W = 256, H = 256;
  const [c, ctx] = canvas(W, H);
  const img = ctx.createImageData(W, H);
  const rand = rng(77);
  const waves = [];
  for (let k = 0; k < 14; k++) {
    const fx = Math.round((rand() - 0.5) * 16), fy = Math.round((rand() - 0.5) * 16);
    if (!fx && !fy) continue;
    waves.push([fx, fy, rand() * Math.PI * 2, 1 / Math.hypot(fx, fy)]);
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let dx = 0, dy = 0;
    for (const [fx, fy, ph, a] of waves) {
      const t = (fx * x / W + fy * y / H) * Math.PI * 2 + ph;
      const d = Math.cos(t) * a;
      dx += d * fx; dy += d * fy;
    }
    dx *= 0.06; dy *= 0.06;
    const l = Math.hypot(dx, dy, 1);
    const i = (y * W + x) * 4;
    img.data[i] = Math.round((-dx / l * 0.5 + 0.5) * 255);
    img.data[i + 1] = Math.round((-dy / l * 0.5 + 0.5) * 255);
    img.data[i + 2] = Math.round((1 / l * 0.5 + 0.5) * 255);
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return tex(c, { srgb: false });
}

/** 树叶簇（灰度 + alpha，由实例颜色着色）。kind: broad | needle | willow | bare */
export function foliageTexture(kind = 'broad') {
  const W = 256, H = 256;
  const [c, ctx] = canvas(W, H);
  const rand = rng(kind.length * 97);
  ctx.clearRect(0, 0, W, H);
  if (kind === 'bare') {
    ctx.strokeStyle = 'rgba(70,60,52,1)';
    const branch = (x, y, a, len, w, d) => {
      if (d > 6 || len < 4) return;
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
      branch(x2, y2, a - 0.35 - rand() * 0.3, len * 0.72, w * 0.68, d + 1);
      branch(x2, y2, a + 0.35 + rand() * 0.3, len * 0.72, w * 0.68, d + 1);
    };
    branch(W / 2, H, -Math.PI / 2, 70, 8, 0);
  } else {
    const n = kind === 'needle' ? 900 : kind === 'willow' ? 420 : 520;
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * (W * 0.47);
      let x = W / 2 + Math.cos(a) * r, y = H / 2 + Math.sin(a) * r * (kind === 'willow' ? 1.0 : 0.92);
      if (kind === 'willow') { x = rand() * W; y = rand() * H; }
      const l = 0.55 + rand() * 0.45;
      ctx.fillStyle = `rgba(${Math.round(255 * l)},${Math.round(255 * l)},${Math.round(255 * l)},1)`;
      ctx.beginPath();
      if (kind === 'needle') ctx.ellipse(x, y, 2.2, 7, rand() * Math.PI, 0, Math.PI * 2);
      else if (kind === 'willow') ctx.ellipse(x, y, 1.6, 9, (rand() - 0.5) * 0.4, 0, Math.PI * 2);
      else ctx.ellipse(x, y, 4.5, 7.5, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return tex(c, { repeat: false });
}

/** 草地 / 泥土细节（灰度） */
export function groundDetailTexture() {
  const W = 256, H = 256;
  const [c, ctx] = canvas(W, H);
  const rand = rng(55);
  const f = fbm(W, H, [64, 16, 4, 2], rand);
  greyFromField(ctx, W, H, f, 0.72, 1.0);
  return tex(c);
}
