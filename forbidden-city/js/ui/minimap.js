// 小地图（随位置移动）与全图（点击前往）。
import { REG } from '../world/registry.js';

const EXT = { x0: -480, x1: 480, z0: -900, z1: 1100 };

const hex = (h) => '#' + h.toString(16).padStart(6, '0');

export class Minimap {
  constructor(mini, big, water, labels) {
    this.mini = mini; this.big = big; this.labels = labels;
    this.k = 1.2; // 底图像素/米
    const c = this.base = document.createElement('canvas');
    c.width = Math.round((EXT.x1 - EXT.x0) * this.k); c.height = Math.round((EXT.z1 - EXT.z0) * this.k);
    this._draw(water);
  }
  P(x, z) { return [(x - EXT.x0) * this.k, (z - EXT.z0) * this.k]; }
  _draw(water) {
    const ctx = this.base.getContext('2d'), k = this.k;
    ctx.fillStyle = '#2b2420'; ctx.fillRect(0, 0, this.base.width, this.base.height);
    // 宫城与周边
    const rect = (x0, z0, x1, z1, c) => { const [a, b] = this.P(x0, z0), [cc, d] = this.P(x1, z1); ctx.fillStyle = c; ctx.fillRect(Math.min(a, cc), Math.min(b, d), Math.abs(cc - a), Math.abs(d - b)); };
    rect(-376, -480, 376, 480, '#45392f');
    rect(-75, 480, 75, 980, '#3e342b');
    rect(-245, -895, 245, -615, '#33402a');
    rect(-292, 595, -82, 935, '#30392a'); rect(82, 595, 292, 935, '#30392a');
    ctx.fillStyle = '#2f5d6b';
    for (const w of water) { ctx.beginPath(); w.forEach(([x, z], i) => { const [a, b] = this.P(x, z); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); ctx.closePath(); ctx.fill(); }
    // 树
    ctx.fillStyle = 'rgba(80,110,62,0.85)';
    for (const [x, z] of REG.map.trees) { const [a, b] = this.P(x, z); ctx.beginPath(); ctx.arc(a, b, 2.2, 0, Math.PI * 2); ctx.fill(); }
    // 墙
    for (const [x0, z0, x1, z1, , t] of REG.map.walls) {
      const [a, b] = this.P(x0, z0), [cc, d] = this.P(x1, z1);
      ctx.strokeStyle = t ? '#a04a36' : '#8e3b2c'; ctx.lineWidth = Math.max(1, (t || 1.6) * k);
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(cc, d); ctx.stroke();
    }
    // 建筑（屋顶颜色）
    for (const r of REG.map.rects) {
      const c = r.color === 0xe0a422 ? '#d9a63a' : hex(r.color);
      rect(r.x0, r.z0, r.x1, r.z1, c);
    }
  }

  /** 小地图：以 (x,z) 为中心，yaw 为朝向 */
  drawMini(x, z, yaw, mode) {
    const cv = this.mini, ctx = cv.getContext('2d');
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const scale = mode === 'walk' ? 1.0 : mode === 'fly' ? 0.7 : 0.5; // 屏幕像素 / 米
    const s = scale / this.k;
    const [px, pz] = this.P(x, z);
    ctx.fillStyle = '#1d1815'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(this.base, px - W / 2 / s, pz - H / 2 / s, W / s, H / s, 0, 0, W, H);
    // 视野扇形 + 箭头
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-yaw);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 46);
    g.addColorStop(0, 'rgba(242,214,138,0.45)'); g.addColorStop(1, 'rgba(242,214,138,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 46, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f2d68a'; ctx.strokeStyle = '#1d1815'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5.5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5.5, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    // 北
    ctx.fillStyle = 'rgba(242,233,216,0.85)'; ctx.font = '600 11px "Noto Sans SC", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('北', W / 2, 13);
  }

  /** 全图 */
  drawBig(x, z, yaw, names) {
    const cv = this.big, ctx = cv.getContext('2d');
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bw = this.base.width, bh = this.base.height;
    const s = Math.min(W / bw, H / bh) * 0.98;
    const ox = (W - bw * s) / 2, oy = (H - bh * s) / 2;
    this.bigT = { s: s * this.k, ox, oy };
    ctx.fillStyle = '#1d1815'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(this.base, ox, oy, bw * s, bh * s);
    const toS = (wx, wz) => [ox + (wx - EXT.x0) * this.k * s, oy + (wz - EXT.z0) * this.k * s];
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const n of names) {
      const [a, b] = toS(n.x, n.z);
      const fs = n.major ? 13 : 11;
      if (!n.major && s * this.k < 0.45) continue;
      ctx.font = `${n.major ? 700 : 500} ${fs}px "Noto Serif SC", serif`;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,15,12,0.85)'; ctx.strokeText(n.name, a, b);
      ctx.fillStyle = n.major ? '#f2d68a' : '#e9dfcb'; ctx.fillText(n.name, a, b);
    }
    const [a, b] = toS(x, z);
    ctx.save(); ctx.translate(a, b); ctx.rotate(-yaw);
    ctx.fillStyle = '#e8483a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  bigToWorld(cx, cy) {
    const t = this.bigT; if (!t) return null;
    const x = (cx - t.ox) / t.s + EXT.x0, z = (cy - t.oy) / t.s + EXT.z0;
    if (x < EXT.x0 || x > EXT.x1 || z < EXT.z0 || z > EXT.z1) return null;
    return { x, z };
  }
}
