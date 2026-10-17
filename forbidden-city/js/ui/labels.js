// 场景中的文字标注：建筑名（鸟瞰时）与古建知识印章（知识模式）。
import * as THREE from 'three';

const v = new THREE.Vector3();

export class Labels {
  constructor(root, camera) {
    this.root = root; this.camera = camera;
    this.names = []; this.pins = [];
    this.showNames = true; this.showKnowledge = false;
    this.onPin = null; this.onName = null;
    this.openPin = null;
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
    const birdsEye = mode === 'orbit' || mode === 'anim' || mode === 'tour';

    // 建筑名：主要建筑与近处优先，贪心放置，跳过重叠
    const cand = [];
    for (const n of this.names) {
      const d = camPos.distanceTo(n.pos);
      let ok = this.showNames && birdsEye && !interior;
      if (ok) ok = n.major ? d < 1500 && d > 30 : d < Math.max(240, high * 1.4) && d > 25;
      const p = ok ? proj(n.pos) : null;
      if (!p) { hide(n); continue; }
      cand.push({ n, d, pri: d * (n.major ? 0.45 : 1), x: p[0], y: p[1] });
    }
    cand.sort((a, b) => a.pri - b.pri);
    const boxes = [];
    for (const c of cand) {
      const w = c.n.len * (c.n.major ? 16 : 14) + 12, h = 22;
      const bx = c.x - w / 2, by = c.y - 30;
      const hit = boxes.some((b) => bx < b[2] && bx + w > b[0] && by < b[3] && by + h > b[1]);
      if (hit || boxes.length >= 28) { hide(c.n); continue; }
      boxes.push([bx, by, bx + w, by + h]);
      show(c.n, c.x, c.y);
      c.n.el.style.opacity = String(Math.max(0.45, Math.min(1, 1.35 - c.d / 1600)));
    }

    // 知识印章：标题与已放置的标签重叠时只显示印章
    const pinBoxes = [];
    for (const p of this.pins) {
      const d = camPos.distanceTo(p.pos);
      let ok = this.showKnowledge && d < (birdsEye ? 700 : 160);
      if (p.item.indoor) ok = ok && !!interior;
      else if (interior) ok = false;
      const pp = ok ? proj(p.pos) : null;
      if (!pp) { hide(p); continue; }
      show(p, pp[0], pp[1]);
      const tw = [...p.item.title].length * 14 + 24;
      const bx = pp[0] - 14, by = pp[1] - 14;
      const overlap = pinBoxes.some((b) => bx < b[2] && bx + tw > b[0] && by < b[3] && by + 28 > b[1]);
      const far = (d > (birdsEye ? 320 : 80) || overlap) && p.note.hidden;
      if (!far) pinBoxes.push([bx, by, bx + tw, by + 28]);
      p.el.classList.toggle('far', far);
    }
  }
}
