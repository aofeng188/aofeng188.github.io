// 相机控制：鸟瞰（轨道）/ 漫步（碰撞）/ 飞行 / 平滑飞行动画 / 建筑拾取。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { REG } from '../world/registry.js';

const BOUNDS = { x0: -515, x1: 515, z0: -895, z1: 1095 };
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class Controls extends EventTarget {
  constructor(camera, dom, groundAt) {
    super();
    this.camera = camera; this.dom = dom; this.groundAt = groundAt;
    this.mode = 'orbit';
    this.orbit = new OrbitControls(camera, dom);
    Object.assign(this.orbit, { enableDamping: true, dampingFactor: 0.08, maxPolarAngle: 1.48, minDistance: 6, maxDistance: 2600, zoomSpeed: 1.1, rotateSpeed: 0.55, panSpeed: 0.9, screenSpacePanning: false });
    this.orbit.keys = { LEFT: 'KeyA', UP: 'KeyW', RIGHT: 'KeyD', BOTTOM: 'KeyS' };
    this.yaw = 0; this.pitch = 0; this.feet = 0; this.vy = 0;
    this.pos = new THREE.Vector3();
    this.eye = 1.62;
    this.keys = new Set();
    this.joy = { x: 0, y: 0 };
    this.anim = null;
    this.walkDist = 0; this.bob = 0;
    this.locked = false; this.dragLook = null;
    this.interior = null;
    this.speedMul = 1;
    this._ray = new THREE.Raycaster();
    this._bindEvents();
  }

  _emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }

  _bindEvents() {
    const d = this.dom;
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      this.keys.add(e.code);
      if ((this.mode === 'walk' || this.mode === 'fly') && e.code === 'KeyF') this.setMode(this.mode === 'walk' ? 'fly' : 'walk');
      if (this.mode === 'walk' && e.code === 'Space' && this.grounded) { this.vy = 4.0; this.grounded = false; e.preventDefault(); }
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code) && this.mode !== 'orbit') e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === d;
      this._emit('lock', this.locked);
    });
    document.addEventListener('mousemove', (e) => {
      if (this.locked && (this.mode === 'walk' || this.mode === 'fly')) this.look(e.movementX, e.movementY, 0.0022);
    });
    let down = null;
    d.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, type: e.pointerType };
      if ((this.mode === 'walk' || this.mode === 'fly') && !this.locked) {
        this.dragLook = { id: e.pointerId, x: e.clientX, y: e.clientY };
        try { d.setPointerCapture(e.pointerId); } catch { /* 忽略 */ }
      }
    });
    d.addEventListener('pointermove', (e) => {
      if (this.dragLook && e.pointerId === this.dragLook.id) {
        const k = e.pointerType === 'touch' ? 0.0045 : 0.003;
        this.look(e.clientX - this.dragLook.x, e.clientY - this.dragLook.y, k);
        this.dragLook.x = e.clientX; this.dragLook.y = e.clientY;
      } else if (this.mode === 'orbit' && e.pointerType === 'mouse' && e.buttons === 0) {
        this._hoverAt = [e.clientX, e.clientY];
      }
    });
    const up = (e) => {
      if (this.dragLook && e.pointerId === this.dragLook.id) this.dragLook = null;
      if (!down || down.id !== e.pointerId) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const quick = performance.now() - down.t < 450;
      const wasDown = down; down = null;
      if (moved > 6 || !quick) return;
      if (this.mode === 'orbit') {
        const hit = this.pickAt(e.clientX, e.clientY);
        this._emit('select', hit);
      } else if (this.mode === 'walk' || this.mode === 'fly') {
        if (wasDown.type === 'mouse' && !this.locked && this.canLock) {
          this.requestLock();
        } else {
          const hit = this.locked ? this.pickAt(innerWidth / 2, innerHeight / 2) : this.pickAt(e.clientX, e.clientY);
          if (hit && hit.dist < 120) this._emit('select', { ...hit, noFly: true });
        }
      }
    };
    d.addEventListener('pointerup', up);
    d.addEventListener('pointercancel', (e) => { if (this.dragLook && e.pointerId === this.dragLook.id) this.dragLook = null; down = null; });
    this.canLock = 'requestPointerLock' in d && !matchMedia('(pointer: coarse)').matches;
  }

  requestLock() {
    try {
      const r = this.dom.requestPointerLock();
      if (r && r.catch) r.catch(() => { this.canLock = false; this._emit('lockfail'); });
    } catch { this.canLock = false; this._emit('lockfail'); }
  }

  look(dx, dy, k) {
    this.yaw -= dx * k;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * k, -1.45, 1.45);
  }

  /** 屏幕坐标拾取建筑（与拾取盒求交） */
  pickAt(cx, cy) {
    const ndc = new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
    this._ray.setFromCamera(ndc, this.camera);
    const o = this._ray.ray.origin, dir = this._ray.ray.direction;
    let best = null;
    for (const p of REG.picks) {
      let tmin = 0, tmax = 1e9, ok = true;
      for (let a = 0; a < 3; a++) {
        const inv = 1 / (dir.getComponent(a) || 1e-9);
        let t1 = (p.min[a] - o.getComponent(a)) * inv, t2 = (p.max[a] - o.getComponent(a)) * inv;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) { ok = false; break; }
      }
      if (!ok) continue;
      // 起点在盒内（室内）时用出射距离，避免一直选中自身
      const t = tmin > 0 ? tmin : tmax + 1000;
      if (!best || t < best.dist) best = { id: p.id, dist: t };
    }
    if (best && best.dist > 1000) best.dist -= 1000;
    return best;
  }

  hoverPick() {
    if (!this._hoverAt) return null;
    const [x, y] = this._hoverAt; this._hoverAt = null;
    const h = this.pickAt(x, y);
    return h ? { ...h, x, y } : { id: null, x, y };
  }

  /** 找到附近可站立的位置 */
  findWalkable(x, z, maxR = 60) {
    const col = REG.col;
    for (let r = 0; r <= maxR; r += 1) {
      const n = Math.max(1, Math.round(r * 6));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        const h = col.get(px, pz);
        if (h !== null && col.canStand(px, pz, 0.35, h, 0.6) !== null) return { x: px, z: pz, h };
      }
    }
    return null;
  }

  setMode(m, opts = {}) {
    const prev = this.mode;
    if (m === prev && !opts.force) return;
    this.mode = m;
    this.orbit.enabled = m === 'orbit';
    if (m === 'walk' || m === 'fly') {
      const dir = new THREE.Vector3(); this.camera.getWorldDirection(dir);
      if (!opts.keepAngles) {
        this.yaw = Math.atan2(-dir.x, -dir.z);
        this.pitch = THREE.MathUtils.clamp(Math.asin(dir.y), -0.6, 0.6);
      }
      this.pos.copy(this.camera.position);
      if (m === 'walk') {
        const spot = this.findWalkable(this.pos.x, this.pos.z);
        if (spot) { this.pos.x = spot.x; this.pos.z = spot.z; this.feet = spot.h; }
        this.vy = 0; this.grounded = true;
      }
    }
    if (m === 'orbit') {
      if (document.pointerLockElement) document.exitPointerLock();
      const dir = new THREE.Vector3(); this.camera.getWorldDirection(dir);
      if (!opts.keepTarget) {
        const dist = Math.max(25, this.camera.position.y * 1.2);
        const t = this.camera.position.clone().addScaledVector(dir, dist);
        t.y = Math.max(0, this.groundAt(t.x, t.z));
        this.orbit.target.copy(t);
      }
      this.orbit.update();
    }
    this._emit('mode', { mode: m, prev });
  }

  /** 平滑飞到 pos，注视 look。opts: dur, arc(抬升高度), then */
  flyTo(pos, look, opts = {}) {
    const p0 = this.camera.position.clone();
    const dir = new THREE.Vector3(); this.camera.getWorldDirection(dir);
    const l0 = this.mode === 'orbit' ? this.orbit.target.clone() : p0.clone().addScaledVector(dir, 20);
    const p3 = new THREE.Vector3(...pos), l3 = new THREE.Vector3(...look);
    const dist = p0.distanceTo(p3);
    const arc = opts.arc ?? Math.min(220, dist * 0.22);
    const c1 = p0.clone().lerp(p3, 0.25); c1.y = Math.max(p0.y, p3.y) + arc;
    const c2 = p0.clone().lerp(p3, 0.75); c2.y = Math.max(p0.y, p3.y) + arc * 0.7;
    if (opts.direct) { c1.copy(p0).lerp(p3, 0.33); c2.copy(p0).lerp(p3, 0.66); }
    const dur = opts.dur ?? THREE.MathUtils.clamp(1.4 + dist / 110, 1.6, 7);
    const back = this.mode;
    this.orbit.enabled = false;
    this.anim = { p0, c1, c2, p3, l0, l3, t: 0, dur, then: opts.then, back: opts.mode || (back === 'tour' ? 'tour' : back === 'walk' || back === 'fly' ? 'orbit' : back) };
    if (this.mode !== 'tour') this.mode = 'anim';
  }

  stopAnim() { this.anim = null; }

  _updateAnim(dt) {
    const a = this.anim;
    a.t = Math.min(1, a.t + dt / a.dur);
    const t = ease(a.t), u = 1 - t;
    const p = new THREE.Vector3()
      .addScaledVector(a.p0, u * u * u).addScaledVector(a.c1, 3 * u * u * t)
      .addScaledVector(a.c2, 3 * u * t * t).addScaledVector(a.p3, t * t * t);
    const l = a.l0.clone().lerp(a.l3, ease(Math.min(1, a.t * 1.25)));
    this.camera.position.copy(p);
    this.camera.lookAt(l);
    if (a.t >= 1) {
      this.anim = null;
      if (a.back === 'orbit') { this.orbit.target.copy(a.l3); this.mode = 'anim'; this.setMode('orbit', { keepTarget: true, force: true }); }
      else if (a.back === 'walk') { this.mode = 'anim'; this.setMode('walk', { force: true }); }
      else if (a.back === 'tour') { this.mode = 'tour'; }
      if (a.then) a.then();
    }
  }

  update(dt) {
    if (this.anim) { this._updateAnim(dt); this._near(); return; }
    if (this.mode === 'orbit') {
      const t = this.orbit.target;
      t.x = THREE.MathUtils.clamp(t.x, BOUNDS.x0 - 200, BOUNDS.x1 + 200);
      t.z = THREE.MathUtils.clamp(t.z, BOUNDS.z0 - 100, BOUNDS.z1 + 100);
      this.orbit.update();
      const g = this.groundAt(this.camera.position.x, this.camera.position.z);
      if (this.camera.position.y < g + 2) this.camera.position.y = g + 2;
    } else if (this.mode === 'walk') this._walk(dt);
    else if (this.mode === 'fly') this._fly(dt);
    this._near();
  }

  _input() {
    const k = this.keys;
    let f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    let s = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    f += -this.joy.y; s += this.joy.x;
    const l = Math.hypot(f, s);
    if (l > 1) { f /= l; s /= l; }
    return { f, s, run: k.has('ShiftLeft') || k.has('ShiftRight') || Math.hypot(this.joy.x, this.joy.y) > 0.95 };
  }

  _walk(dt) {
    const col = REG.col;
    const { f, s, run } = this._input();
    const speed = (run ? 7.5 : 3.2) * this.speedMul;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const dx = (fx * f + -fz * s) * speed * dt, dz = (fz * f + fx * s) * speed * dt;
    const step = 0.6, r = 0.32;
    let moved = 0;
    if (dx || dz) {
      const tryMove = (nx, nz) => col.canStand(nx, nz, r, this.feet, step);
      let h = tryMove(this.pos.x + dx, this.pos.z + dz);
      if (h !== null) { this.pos.x += dx; this.pos.z += dz; moved = Math.hypot(dx, dz); }
      else if ((h = tryMove(this.pos.x + dx, this.pos.z)) !== null) { this.pos.x += dx; moved = Math.abs(dx); }
      else if ((h = tryMove(this.pos.x, this.pos.z + dz)) !== null) { this.pos.z += dz; moved = Math.abs(dz); }
    }
    const g = col.get(this.pos.x, this.pos.z) ?? this.feet;
    if (this.vy !== 0 || g < this.feet - 0.25) {
      this.vy -= 9.8 * dt; this.feet += this.vy * dt; this.grounded = false;
      if (this.feet <= g) { this.feet = g; this.vy = 0; this.grounded = true; }
    } else {
      this.feet += (g - this.feet) * Math.min(1, dt * 14);
      this.grounded = true;
    }
    if (moved > 0 && this.grounded) {
      this.walkDist += moved;
      this.bob += moved * 2.6;
      const stride = run ? 0.95 : 0.72;
      if (this.walkDist > stride) { this.walkDist = 0; this._emit('step', { run }); }
    }
    const bobY = Math.sin(this.bob) * 0.035;
    this.camera.position.set(this.pos.x, this.feet + this.eye + bobY, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  _fly(dt) {
    const { f, s, run } = this._input();
    const k = this.keys;
    const up = (k.has('Space') || k.has('KeyE') ? 1 : 0) - (k.has('KeyC') || k.has('KeyQ') || k.has('ControlLeft') ? 1 : 0) + (this.joyUp || 0);
    const speed = (run ? 70 : 24) * this.speedMul;
    const dir = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.pos.addScaledVector(dir, f * speed * dt).addScaledVector(right, s * speed * dt);
    this.pos.y += up * speed * 0.7 * dt;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, BOUNDS.x0 - 150, BOUNDS.x1 + 150);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, BOUNDS.z0 - 150, BOUNDS.z1 + 150);
    const g = this.groundAt(this.pos.x, this.pos.z);
    this.pos.y = THREE.MathUtils.clamp(this.pos.y, g + 0.8, 900);
    this.camera.position.copy(this.pos);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.feet = Math.max(g, this.pos.y - this.eye);
  }

  /** 是否在室内（用于点亮殿内灯光） */
  _near() {
    const p = this.camera.position;
    let inside = null;
    for (const it of REG.interiors) {
      const x0 = Math.min(it.min[0], it.max[0]), x1 = Math.max(it.min[0], it.max[0]);
      const z0 = Math.min(it.min[2], it.max[2]), z1 = Math.max(it.min[2], it.max[2]);
      if (p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1 && p.y > it.y - 1 && p.y < it.yC + 1) { inside = it.id; break; }
    }
    if (inside !== this.interior) { this.interior = inside; this._emit('interior', inside); }
  }

  /** 漫步模式下瞬移 */
  teleport(x, z, yaw) {
    const spot = this.findWalkable(x, z, 80);
    if (!spot) return false;
    this.pos.set(spot.x, 0, spot.z); this.feet = spot.h; this.vy = 0;
    if (yaw !== undefined) this.yaw = yaw;
    return true;
  }

  focusPoint() {
    if (this.mode === 'orbit') return this.orbit.target;
    if (this.mode === 'walk' || this.mode === 'fly') return this.camera.position;
    const dir = new THREE.Vector3(); this.camera.getWorldDirection(dir);
    return this.camera.position.clone().addScaledVector(dir, Math.min(150, this.camera.position.y * 1.5 + 20));
  }
}
