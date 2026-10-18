// 场景中的文字标注：建筑名（鸟瞰时）与古建知识印章（知识模式）。
import * as THREE from 'three';
import { occluded } from '../world/solids.js';

const v = new THREE.Vector3();

export class Labels {
  constructor(root, camera) {
    this.root = root; this.camera = camera;
    this.names = []; this.pins = [];
    this.showNames = true; this.showKnowledge = false;
    this.onPin = null; this.onName = null;
    this.openPin = null;
    this.rr = 0; // 遮挡检测轮转指针
  }
  addName(id, name, pos, major) {
    const el = document.createElement('button');
    el.className = 'lbl-name' + (major ? ' major' : '');
    el.type = 'button';
    el.innerHTML = `<i></i><span>${name}</span>`;
    el.addEventListener('click', (e) => { e.stopPropagation(); this.onName && this.onName(id); });
    this.root.appendChild(el);
    this.names.push({ id, el, pos: new THREE.Vector3(...pos), major, vis: false, len: [...name].length });
  }
  addPin(item, i) {
    const el = document.createElement('div');
    el.className = 'lbl-pin';
    el.innerHTML = `<button type="button" class="seal" aria-label="${item.title}">识</button><span class="pin-title">${item.title}</span><div class="pin-note" hidden><b>${item.title}</b><p>${item.text}</p></div>`;
    const note = el.querySelector('.pin-note');
    const toggle = (e) => {
      e.stopPropagation();
      const open = note.hidden;
      this.closeNotes();
      note.hidden = !open; el.classList.toggle('open', open);
      this.openPin = open ? i : null;
    };
    el.querySelector('.seal').addEventListener('click', toggle);
    el.querySelector('.pin-title').addEventListener('click', toggle);
    this.root.appendChild(el);
    this.pins.push({ item, el, note, pos: new THREE.Vector3(...item.pos), vis: false });
  }
  closeNotes() {
    for (const p of this.pins) { p.note.hidden = true; p.el.classList.remove('open'); }
    this.openPin = null;
  }

  update(mode, interior) {
    const cam = this.camera;
    const W = innerWidth, H = innerHeight;
    const camPos = cam.position;
    const high = camPos.y;
    const hide = (o) => { if (o.vis) { o.el.style.display = 'none'; o.vis = false; } };
    const show = (o, x, y) => {
      o.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      if (!o.vis) { o.el.style.display = 'block'; o.vis = true; }
    };
    const proj = (pos) => {
      v.copy(pos).project(cam);
      if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) return null;
      return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H];
    };
    const birdsEye = mode === 'orbit' || mode === 'anim';
    // 遮挡检测：每帧轮流检查一部分标签，结果缓存
    const all = this.names.concat(this.pins);
    for (let k = 0; k < 14 && all.length; k++) {
      const o = all[this.rr++ % all.length];
      o.occ = occluded(camPos.x, camPos.y, camPos.z, o.pos.x, o.pos.y, o.pos.z, o.id);
    }

    // 建筑名：只在鸟瞰时显示；主要建筑与近处优先，被挡住或与已放置标签重叠的不显示
    const cand = [];
    const maxN = high > 380 ? 10 : 14;
    for (const n of this.names) {
      const d = camPos.distanceTo(n.pos);
      let ok = this.showNames && birdsEye && !interior && !n.occ;
      if (ok) ok = n.major ? d < Math.min(1800, Math.max(260, high * 8)) && d > 30 : high < 380 && d < Math.min(230, Math.max(120, high * 4)) && d > 25;
      const p = ok ? proj(n.pos) : null;
      if (!p) { hide(n); continue; }
      cand.push({ n, d, pri: d * (n.major ? 0.45 : 1), x: p[0], y: p[1] });
    }
    cand.sort((a, b) => a.pri - b.pri);
    const boxes = [];
    for (const c of cand) {
      const w = c.n.len * (c.n.major ? 16 : 14) + 16, h = 24;
      const bx = c.x - w / 2, by = c.y - 32;
      const hit = boxes.some((b) => bx < b[2] && bx + w > b[0] && by < b[3] && by + h > b[1]);
      if (hit || boxes.length >= maxN) { hide(c.n); continue; }
      boxes.push([bx, by, bx + w, by + h]);
      show(c.n, c.x, c.y);
      c.n.el.style.opacity = String(Math.max(0.5, Math.min(1, 1.35 - c.d / 1600)));
    }

    // 知识印章：标题与已放置的标签重叠时只显示印章
    const pinBoxes = [];
    const pins = this.pins.map((p) => ({ p, d: camPos.distanceTo(p.pos) })).sort((a, b) => a.d - b.d);
    for (const { p, d } of pins) {
      let ok = this.showKnowledge && d < (birdsEye || mode === 'tour' ? 600 : 160) && (!p.occ || !p.note.hidden);
      if (p.item.indoor) ok = ok && !!interior;
      else if (interior) ok = false;
      const pp = ok ? proj(p.pos) : null;
      if (!pp) { hide(p); continue; }
      show(p, pp[0], pp[1]);
      const tw = [...p.item.title].length * 14 + 24;
      const bx = pp[0] - 14, by = pp[1] - 14;
      const overlap = pinBoxes.some((b) => bx < b[2] && bx + tw > b[0] && by < b[3] && by + 28 > b[1]);
      const far = (d > (birdsEye ? 300 : 80) || overlap) && p.note.hidden;
      if (!far) pinBoxes.push([bx, by, bx + tw, by + 28]);
      p.el.classList.toggle('far', far);
    }
  }
}
