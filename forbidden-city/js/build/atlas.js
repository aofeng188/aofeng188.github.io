// 匾额与导览牌的文字贴图图集（Canvas 绘制）。
import * as THREE from 'three';

export const SERIF = '"Noto Serif SC", "Songti SC", "STSong", "SimSun", "Source Han Serif SC", serif';
export const SANS = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Source Han Sans SC", sans-serif';

/** 等待网页字体加载（失败时使用系统字体） */
export async function loadFonts(text) {
  if (!document.fonts) return;
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load(`900 64px "Noto Serif SC"`, text),
        document.fonts.load(`500 32px "Noto Sans SC"`, text),
      ]),
      new Promise((r) => setTimeout(r, 6000)),
    ]);
  } catch { /* 使用后备字体 */ }
}

/** 匾额图集：横匾 400×136、竖匾 136×(按字数)、标语 900×84 */
export function plaqueAtlas(items) {
  const S = 2048;
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1c3466'; ctx.fillRect(0, 0, S, S);
  const out = {};
  let x = 0, y = 0, rowH = 0;
  const size = (it) => it.style === 'slogan' ? [900, 84] : it.vertical ? [136, 60 + [...it.text].length * 112] : [400, 136];
  const sorted = items.slice().sort((a, b) => size(b)[1] - size(a)[1]);
  for (const it of sorted) {
    const [w, h] = size(it);
    if (x + w > S) { x = 0; y += rowH + 2; rowH = 0; }
    const px = x, py = y;
    x += w + 2; rowH = Math.max(rowH, h);
    if (it.style === 'slogan') drawSlogan(ctx, px, py, w, h, it.text);
    else drawPlaque(ctx, px, py, w, h, it.text, it.vertical);
    out[it.key || it.text] = { uv: [px / S, 1 - (py + h) / S, (px + w) / S, 1 - py / S], aspect: w / h, vertical: !!it.vertical };
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, cells: out };
}

function drawPlaque(ctx, x, y, w, h, text, vertical) {
  ctx.save();
  ctx.translate(x, y);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#24427e'); g.addColorStop(1, '#162b57');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#d9b45a'; ctx.lineWidth = 9; ctx.strokeRect(4.5, 4.5, w - 9, h - 9);
  ctx.strokeStyle = '#8f6e2c'; ctx.lineWidth = 3; ctx.strokeRect(14, 14, w - 28, h - 28);
  ctx.fillStyle = '#f0c95e';
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const chars = [...text];
  if (vertical) {
    const fs = Math.min(w * 0.6, (h - 44) / chars.length * 0.84);
    ctx.font = `900 ${fs}px ${SERIF}`;
    chars.forEach((ch, i) => ctx.fillText(ch, w / 2, 22 + ((h - 44) / chars.length) * (i + 0.5)));
  } else {
    const fs = Math.min(h * 0.58, (w - 50) / chars.length * 0.88);
    ctx.font = `900 ${fs}px ${SERIF}`;
    chars.forEach((ch, i) => ctx.fillText(ch, 25 + ((w - 50) / chars.length) * (i + 0.5), h / 2 + 2));
  }
  ctx.restore();
}

function drawSlogan(ctx, x, y, w, h, text) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#b3241c'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fbf6ec'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const chars = [...text];
  ctx.font = `700 ${Math.min(h * 0.7, (w - 40) / chars.length * 0.86)}px ${SANS}`;
  chars.forEach((ch, i) => ctx.fillText(ch, 20 + ((w - 40) / chars.length) * (i + 0.5), h / 2 + 2));
  ctx.restore();
}

/** 导览牌图集：每块 512×288，标题 + 两行简介 */
export function signAtlas(items) {
  const CW = 512, CH = 288;
  const cols = 4, rows = Math.ceil(items.length / cols);
  const W = CW * cols, H = CH * Math.max(1, rows);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const out = {};
  items.forEach((it, i) => {
    const x = (i % cols) * CW, y = Math.floor(i / cols) * CH;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#3a2a20'; ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = '#4a3528'; ctx.fillRect(10, 10, CW - 20, CH - 20);
    ctx.strokeStyle = '#c9a45a'; ctx.lineWidth = 3; ctx.strokeRect(18, 18, CW - 36, CH - 36);
    ctx.fillStyle = '#f2d78f';
    ctx.font = `900 64px ${SERIF}`; ctx.textBaseline = 'top';
    ctx.fillText(it.title, 40, 38);
    ctx.fillStyle = '#efe6d6';
    ctx.font = `400 25px ${SANS}`;
    wrap(ctx, it.text, 40, 128, CW - 80, 36, 3);
    ctx.fillStyle = '#c9a45a'; ctx.font = `500 20px ${SANS}`;
    ctx.fillText('故宫博物院', CW - 150, CH - 50);
    ctx.restore();
    out[it.key] = { uv: [x / W, 1 - (y + CH) / H, (x + CW) / W, 1 - y / H] };
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, cells: out };
}

function wrap(ctx, text, x, y, maxW, lh, maxLines) {
  let line = '', n = 0;
  for (const ch of text) {
    const t = line + ch;
    if (ctx.measureText(t).width > maxW) {
      ctx.fillText(line, x, y + n * lh); n++; line = ch;
      if (n >= maxLines) return;
    } else line = t;
  }
  if (line && n < maxLines) ctx.fillText(line, x, y + n * lh);
}

/** 九龙壁贴图：海水江崖纹底，九条彩龙 */
export function dragonWallTexture() {
  const W = 2048, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2e6f8f'); g.addColorStop(0.7, '#2a5d86'); g.addColorStop(1, '#1f4a6e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // 海水
  ctx.strokeStyle = 'rgba(220,240,240,0.55)'; ctx.lineWidth = 3;
  for (let row = 0; row < 4; row++) for (let x = 0; x < W; x += 30) {
    ctx.beginPath(); ctx.arc(x + (row % 2) * 15, H - 20 - row * 14, 13, Math.PI, 0); ctx.stroke();
  }
  // 云纹
  ctx.fillStyle = 'rgba(240,240,230,0.35)';
  for (let k = 0; k < 40; k++) { const x = (k * 53) % W, y = 30 + ((k * 37) % 120); ctx.beginPath(); ctx.ellipse(x, y, 26, 9, 0, 0, Math.PI * 2); ctx.fill(); }
  const cols = ['#f0c040', '#e8e2d0', '#f0c040', '#7a5aa8', '#f0c040', '#7a5aa8', '#f0c040', '#e8e2d0', '#f0c040'];
  for (let i = 0; i < 9; i++) {
    const cx = (i + 0.5) * (W / 9);
    ctx.strokeStyle = cols[i]; ctx.lineWidth = 16; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let t = 0; t <= 1; t += 0.02) {
      const xx = cx + Math.sin(t * Math.PI * 2.4 + i) * 70 * (1 - t * 0.3);
      const yy = 40 + t * 150 + Math.cos(t * 7 + i) * 18;
      t === 0 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy);
    }
    ctx.stroke();
    ctx.fillStyle = cols[i];
    ctx.beginPath(); ctx.ellipse(cx + Math.sin(i) * 70, 44, 26, 20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(cx + Math.sin(i) * 70 + 45, 30, 9, 0, Math.PI * 2); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
