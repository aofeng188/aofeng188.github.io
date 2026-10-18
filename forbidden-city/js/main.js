// 紫禁城漫游：主程序。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { createWorld } from './core/world.js';
import { Controls } from './core/controls.js';
import { AudioEngine } from './core/audio.js';
import { REG } from './world/registry.js';
import { BUILDINGS, AREAS } from './data/buildings.js';
import { KNOWLEDGE } from './data/knowledge.js';
import { TOUR } from './data/tour.js';
import { Labels } from './ui/labels.js';
import { Minimap } from './ui/minimap.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('fc.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('fc.' + k, JSON.stringify(v)); } catch { /* 忽略 */ } },
};

// ---------------- 画质 ----------------
const coarse = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
const PRESETS = {
  high: { name: 'high', pixelRatio: Math.min(devicePixelRatio || 1, 2), shadow: 4096, bloom: true, reflection: 1024, reflectEvery: 1, trees: 1, people: 70, groundTex: 4096, detail: 1, aniso: 8, snowCount: 9000, hutong: 4, msaa: 4 },
  low: { name: 'low', pixelRatio: Math.min(devicePixelRatio || 1, 1.5), shadow: 2048, bloom: false, reflection: 0, reflectEvery: 2, trees: 0.65, people: 34, groundTex: 2048, detail: 0.6, aniso: 4, snowCount: 3500, hutong: 2, msaa: 0 },
};
let qName = store.get('quality', coarse ? 'low' : 'high');
const Q = { ...PRESETS[qName] };

// ---------------- 渲染器 ----------------
const renderer = new THREE.WebGLRenderer({ antialias: !Q.bloom, powerPreference: 'high-performance' });
renderer.setPixelRatio(Q.pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.domElement.id = 'c';
renderer.domElement.tabIndex = 0;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0807);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.3, 14000);
camera.position.set(0, 900, 1900);
camera.lookAt(0, 0, 300);

let composer = null, bloom = null;
function setupComposer() {
  if (!Q.bloom) { composer = null; return; }
  const rt = new THREE.WebGLRenderTarget(innerWidth * Q.pixelRatio, innerHeight * Q.pixelRatio, { type: THREE.HalfFloatType, samples: Q.msaa });
  composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(Q.pixelRatio);
  composer.addPass(new RenderPass(scene, camera));
  // 清除个别 NaN / Inf 像素，防止被泛光扩散成黑块
  composer.addPass(new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0); gl_FragColor = vec4(min(c.rgb, vec3(64.0)), c.a); }',
  }));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.45, 0.88);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}

// ---------------- 加载 ----------------
const FACTS = [
  '紫禁城南北长961米，东西宽753米，占地约72万平方米，是世界上现存规模最大的宫殿建筑群。',
  '紫禁城始建于明永乐四年（1406年），永乐十八年（1420年）建成，至今已有六百多年。',
  '明清两代共有24位皇帝在紫禁城中居住和理政。',
  '黄色琉璃瓦是皇家专用，只有少数建筑例外：皇子居住的南三所用绿瓦，藏书的文渊阁用黑瓦。',
  '太和殿屋脊上的十只脊兽，在中国古建筑中独一无二。',
  '1925年10月10日，故宫博物院在乾清门广场宣告成立。',
];
let fi = 0;
const factTimer = setInterval(() => { fi = (fi + 1) % FACTS.length; $('ldFact').textContent = FACTS[fi]; }, 4200);
const progress = (p, msg) => { $('ldFill').style.width = (p * 100).toFixed(0) + '%'; $('ldText').textContent = msg; };

let W, controls, labels, minimap;
const audio = new AudioEngine();
const settings = {
  music: store.get('music', true), amb: store.get('amb', true), voice: store.get('voice', true),
  names: store.get('names', true), people: store.get('people', true),
};

try {
  W = await createWorld(renderer, scene, Q, progress);
} catch (e) {
  console.error(e);
  $('ldText').textContent = '加载失败：' + (e.message || e) + '。请刷新页面重试，或在设置中切换为流畅画质。';
  throw e;
}
REG.map.trees = W.trees.points();
setupComposer();

const groundAt = (x, z) => {
  const h = REG.col.get(x, z);
  return Math.max(h ?? 0, W.terrain.heightAt(x, z));
};
controls = new Controls(camera, renderer.domElement, groundAt);
controls.orbit.target.set(0, 0, 300);

// 室内灯光
const roomLight = new THREE.PointLight(0xffd29a, 0, 60, 1.6);
scene.add(roomLight);
const roomLight2 = new THREE.PointLight(0xffe2b8, 0, 45, 1.6);
scene.add(roomLight2);

// 标注
labels = new Labels($('labels'), camera);
const MAJOR = ['tiananmen', 'duanmen', 'wumen', 'taihemen', 'taihedian', 'zhonghedian', 'baohedian', 'qianqingmen', 'qianqinggong', 'jiaotaidian', 'kunninggong', 'shenwumen', 'jingshan', 'huangjidian', 'cininggong', 'wenhuadian', 'wuyingdian', 'donghuamen', 'xihuamen', 'yangxindian'];
const nameList = [];
const AREA_IDS = new Set(['santai', 'chengqiang', 'qianqingmen_sq', 'yuhuayuan']);
for (const [id, a] of Object.entries(REG.anchors)) {
  const b = BUILDINGS[id]; if (!b || AREA_IDS.has(id)) continue;
  const major = MAJOR.includes(id);
  const nm = b.name.split(' · ')[0];
  labels.addName(id, nm, [a.x, a.top + 2.5, a.z], major);
  nameList.push({ id, name: nm, x: a.x, z: a.z, major });
}
KNOWLEDGE.forEach((k, i) => labels.addPin(k, i));
labels.onName = (id) => selectBuilding(id, true);
minimap = new Minimap($('mm'), $('bm'), W.out.water, labels);

// 预编译着色器，避免进入时卡顿
progress(1, '准备就绪');
W.env.setTime(9.5);
try { renderer.compile(scene, camera); } catch { /* 忽略 */ }
clearInterval(factTimer);
$('ldText').textContent = '共生成约 ' + Math.round(W.tris / 10000) + ' 万个三角面';
$('enterBtn').hidden = false;
$('enterBtn').focus();

// ---------------- 状态 ----------------
let mode = 'orbit';
let selected = null;
let lastPlace = null;
const ui = { tour: null };

function toast(msg, ms = 4200) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), ms);
}

// ---------------- 进入 ----------------
$('enterBtn').addEventListener('click', () => {
  audio.start();
  audio.setMusic(settings.music); audio.setAmbience(settings.amb);
  $('loading').classList.add('out');
  setTimeout(() => ($('loading').hidden = true), 900);
  // 入场：从高空俯冲到天安门前
  camera.position.set(0, 820, 2200); camera.lookAt(0, 0, 200);
  controls.mode = 'anim';
  controls.flyTo([0, 30, 1095], [0, 16, 950], { dur: 7.5, arc: 0, direct: true, mode: 'orbit', then: () => toast(coarse ? '单指拖动旋转，双指缩放；点建筑看介绍。切到「漫步」可以走进宫城。' : '拖动旋转，滚轮缩放，点击建筑查看介绍。切到「漫步」可以走进宫城，「导览」沿中轴线自动游览。', 7000) });
}, { once: true });

// ---------------- 建筑卡片 ----------------
function viewFor(id) {
  const a = REG.anchors[id];
  if (!a) return null;
  const tgt = new THREE.Vector3(a.x, a.base + (a.top - a.base) * 0.42, a.z);
  const d = THREE.MathUtils.clamp(a.r * 2.3 + 20, 35, 420);
  const from = new THREE.Vector3().subVectors(camera.position, tgt); from.y = 0;
  if (from.lengthSq() < 1) from.set(0, 0, 1);
  from.normalize();
  // 偏向建筑正面（南面）
  from.lerp(new THREE.Vector3(0, 0, 1), 0.35).normalize();
  const pos = tgt.clone().addScaledVector(from, d); pos.y = tgt.y + d * 0.42;
  return { pos: pos.toArray(), look: tgt.toArray() };
}

function showCard(id) {
  const b = BUILDINGS[id]; if (!b) return;
  selected = id;
  $('cardName').textContent = b.name;
  $('cardArea').textContent = AREAS[b.area] || '';
  $('cardEra').textContent = b.era || '—';
  $('cardRoof').textContent = b.roof || '—';
  $('cardUse').textContent = b.use || '—';
  $('cardText').textContent = b.text || '';
  $('cardStory').textContent = b.story || ''; $('cardStory').hidden = !b.story;
  $('cardInside').textContent = b.inside || ''; $('cardInside').hidden = !b.inside;
  $('cardToday').textContent = b.today ? '今天：' + b.today : ''; $('cardToday').hidden = !b.today;
  $('cardWalk').hidden = !REG.anchors[id];
  $('card').hidden = false;
  $('indexPanel').hidden = true; $('btnIndex').setAttribute('aria-pressed', 'false');
  $('settingsPanel').hidden = true; $('btnSettings').setAttribute('aria-pressed', 'false');
  $('card').scrollTop = 0;
}
function hideCard() { $('card').hidden = true; selected = null; audio.stopSay(); }
$('cardClose').addEventListener('click', hideCard);
$('cardFly').addEventListener('click', () => { if (selected) flyToBuilding(selected); });
$('cardWalk').addEventListener('click', () => { if (selected) walkAt(selected); });
$('cardSpeak').addEventListener('click', () => {
  const b = BUILDINGS[selected]; if (!b) return;
  audio.start();
  audio.say(b.name + '。' + (b.text || '') + (b.inside ? b.inside : '') + (b.story ? b.story : ''));
});

function flyToBuilding(id) {
  const v = viewFor(id); if (!v) return;
  if (mode === 'tour') stopTour();
  if (mode !== 'orbit') setMode('orbit', { silent: true });
  controls.flyTo(v.pos, v.look, { mode: 'orbit' });
}
function selectBuilding(id, fly) {
  if (!id || !BUILDINGS[id]) return;
  showCard(id);
  if (fly && mode !== 'walk' && mode !== 'fly') flyToBuilding(id);
}
controls.addEventListener('select', (e) => {
  const hit = e.detail;
  if (!hit || !hit.id) { if (mode === 'orbit') labels.closeNotes(); return; }
  selectBuilding(hit.id, !hit.noFly && mode === 'orbit');
});

// ---------------- 模式切换 ----------------
function setModeButtons(m) {
  for (const b of document.querySelectorAll('.seg button')) b.classList.toggle('on', b.dataset.mode === (m === 'fly' ? 'walk' : m === 'anim' ? mode : m));
}
function setMode(m, o = {}) {
  if (m === mode && !o.force) return;
  const prev = mode;
  if (prev === 'tour' && m !== 'tour') stopTour(true);
  mode = m;
  setModeButtons(m);
  const walking = m === 'walk' || m === 'fly';
  $('crosshair').hidden = !walking || coarse;
  $('joy').hidden = !walking || !coarse;
  $('flyBtns').hidden = !(walking && coarse);
  $('env').hidden = m === 'tour';
  $('mini').hidden = m === 'tour' && innerWidth < 760;
  if (!walking) $('walkHint').hidden = true;
  if (m === 'orbit' && !o.silent) {
    if (prev === 'walk' || prev === 'fly') {
      const p = camera.position, dir = new THREE.Vector3(); camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
      const look = p.clone().addScaledVector(dir, 30); look.y = groundAt(look.x, look.z);
      const pos = p.clone().addScaledVector(dir, -70); pos.y = p.y + 55;
      controls.flyTo(pos.toArray(), look.toArray(), { dur: 1.8, arc: 0, direct: true, mode: 'orbit' });
    } else controls.setMode('orbit');
  }
}
function walkAt(id) {
  const a = id ? REG.anchors[id] : null;
  let x, z, yaw = 0;
  if (a) { x = a.x; z = a.z + Math.max(a.d / 2, 6) + 12; yaw = 0; } else { const t = controls.focusPoint(); x = t.x; z = t.z; }
  if (mode === 'tour') stopTour(true);
  const spot = controls.findWalkable(x, z, 80);
  if (!spot) { toast('这里没有可以站立的地方，换个位置试试。'); return; }
  enterWalk(spot, a ? yaw : null);
}
function enterWalk(spot, yaw) {
  mode = 'walk'; setModeButtons('walk');
  const eye = spot.h + controls.eye;
  let dir;
  if (yaw === null || yaw === undefined) { dir = new THREE.Vector3(); camera.getWorldDirection(dir); dir.y = 0; if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1); dir.normalize(); }
  else dir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const look = new THREE.Vector3(spot.x, eye, spot.z).addScaledVector(dir, 20);
  look.y = eye;
  controls.flyTo([spot.x, eye, spot.z], look.toArray(), {
    dur: 2.4, arc: 10, mode: 'walk',
    then: () => {
      controls.teleport(spot.x, spot.z);
      setMode('walk', { force: true, silent: true });
      showWalkHint();
    },
  });
  hideCard();
}
function showWalkHint() {
  if (coarse) {
    $('walkTitle').textContent = '漫步紫禁城';
    $('walkKeys').innerHTML = '左下摇杆移动，滑动屏幕转向。推满摇杆快走，「升/降」切换飞行。';
  } else {
    $('walkTitle').textContent = controls.canLock ? '点击画面开始漫步' : '漫步紫禁城';
    $('walkKeys').innerHTML = '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 移动 · 鼠标转向 · <kbd>Shift</kbd> 快走 · <kbd>空格</kbd> 跳<br><kbd>F</kbd> 飞行（<kbd>E</kbd>/<kbd>Q</kbd> 升降） · <kbd>Esc</kbd> 释放鼠标 · 点击建筑查看介绍';
  }
  $('walkHint').hidden = false;
}
$('walkGo').addEventListener('click', () => {
  $('walkHint').hidden = true;
  if (!coarse && controls.canLock) controls.requestLock();
  renderer.domElement.focus();
});
controls.addEventListener('lock', (e) => {
  if (e.detail) $('walkHint').hidden = true;
  else if ((mode === 'walk' || mode === 'fly') && controls.canLock) { $('walkTitle').textContent = '点击画面继续漫步'; $('walkHint').hidden = false; }
});
controls.addEventListener('lockfail', () => { $('walkHint').hidden = true; toast('当前环境不能锁定鼠标：按住鼠标拖动来转向。'); });
controls.addEventListener('mode', (e) => {
  const m = e.detail.mode;
  if (m === 'fly' || m === 'walk') {
    if (mode === 'walk' || mode === 'fly') { mode = m; setModeButtons(m); $('flyToggle').textContent = m === 'fly' ? '落地' : '飞行'; if (m === 'fly') toast('飞行模式：E/Q 升降，Shift 加速，再按 F 落地。', 3500); }
  }
});
controls.addEventListener('step', (e) => audio.step(e.detail.run, W.env.snowAmt > 0.5));
controls.addEventListener('interior', (e) => {
  const id = e.detail;
  if (id) {
    const it = REG.interiors.find((x) => x.id === id);
    const cx = (it.min[0] + it.max[0]) / 2, cz = (it.min[2] + it.max[2]) / 2;
    roomLight.position.set(cx, it.yC - 2, cz - (it.max[2] - it.min[2]) * 0.15);
    roomLight2.position.set(cx, it.y + 3, cz + Math.abs(it.max[2] - it.min[2]) * 0.3);
    if (BUILDINGS[id] && mode !== 'tour') toast('进入' + BUILDINGS[id].name + '：' + (BUILDINGS[id].inside || '').slice(0, 40) + '…', 4500);
  }
});

for (const b of document.querySelectorAll('.seg button')) b.addEventListener('click', () => {
  const m = b.dataset.mode;
  if (m === 'orbit') setMode('orbit');
  else if (m === 'walk') { if (mode === 'walk' || mode === 'fly') return; walkAt(null); }
  else if (m === 'tour') startTour(0);
});

// 手机摇杆
(() => {
  const joy = $('joy'), knob = joy.querySelector('i');
  let id = null, cx = 0, cy = 0;
  joy.addEventListener('pointerdown', (e) => { id = e.pointerId; const r = joy.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; joy.setPointerCapture(id); move(e); });
  const move = (e) => {
    if (e.pointerId !== id) return;
    let dx = (e.clientX - cx) / 50, dy = (e.clientY - cy) / 50;
    const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    controls.joy.x = dx; controls.joy.y = dy;
    knob.style.transform = `translate(${dx * 36}px, ${dy * 36}px)`;
  };
  joy.addEventListener('pointermove', move);
  const end = (e) => { if (e.pointerId !== id) return; id = null; controls.joy.x = controls.joy.y = 0; knob.style.transform = ''; };
  joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
  const hold = (el, v) => {
    el.addEventListener('pointerdown', () => { if (mode !== 'fly') controls.setMode('fly'); controls.joyUp = v; });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, () => (controls.joyUp = 0));
  };
  hold($('flyUp'), 1); hold($('flyDown'), -1);
  $('flyToggle').addEventListener('click', () => controls.setMode(mode === 'fly' ? 'walk' : 'fly'));
})();

// ---------------- 导览 ----------------
function startTour(i) {
  hideCard();
  if (document.pointerLockElement) document.exitPointerLock();
  mode = 'tour'; setModeButtons('tour');
  controls.mode = 'tour'; controls.orbit.enabled = false;
  $('crosshair').hidden = true; $('joy').hidden = true; $('flyBtns').hidden = true; $('walkHint').hidden = true;
  $('env').hidden = true;
  $('mini').hidden = true;
  $('tour').hidden = false;
  ui.tour = { i: -1, paused: false, timer: null, drift: 0, inside: false };
  goStop(i);
}
function stopTour(keepMode) {
  if (!ui.tour) return;
  clearTimeout(ui.tour.timer);
  audio.stopSay();
  const wasInside = ui.tour.inside;
  ui.tour = null;
  $('tour').hidden = true;
  $('env').hidden = false;
  $('mini').hidden = false;
  controls.stopAnim();
  if (!keepMode) {
    if (wasInside) {
      // 在殿内结束导览：直接转为漫步，留在殿内
      mode = 'walk';
      controls.setMode('walk', { force: true });
      setMode('walk', { force: true, silent: true });
      showWalkHint();
    } else {
      mode = 'orbit';
      controls.setMode('orbit', { force: true });
      setModeButtons('orbit');
    }
  }
}
function goStop(i) {
  const t = ui.tour; if (!t) return;
  clearTimeout(t.timer); audio.stopSay();
  i = Math.max(0, Math.min(TOUR.length - 1, i));
  const s = TOUR[i];
  t.i = i; t.drift = 0; t.arrived = false;
  $('tourStep').textContent = `第 ${i + 1} / ${TOUR.length} 站`;
  $('tourTitle').textContent = s.title;
  $('tourText').textContent = s.say;
  $('tourProg').style.width = ((i + 1) / TOUR.length * 100).toFixed(1) + '%';
  $('tourPrev').disabled = i === 0;
  $('tourNext').textContent = i === TOUR.length - 1 ? '完成' : '下一站';
  const arrive = () => {
    if (!ui.tour || ui.tour.i !== i) return;
    ui.tour.arrived = true; ui.tour.inside = !!s.interior;
    ui.tour.look = new THREE.Vector3(...s.look);
    ui.tour.base = camera.position.clone();
    if (!ui.tour.paused) narrate(i);
  };
  const legs = [];
  // 出殿：先退到门外
  if (t.inside && !s.interior) legs.push([[camera.position.x, camera.position.y, camera.position.z + 26], [camera.position.x, camera.position.y, camera.position.z - 10], { direct: true, dur: 2.2 }]);
  if (s.interior) {
    const door = [s.cam[0], s.cam[1] + 1.5, s.cam[2] + 34];
    if (!t.inside) legs.push([door, s.look, {}]);
    legs.push([s.cam, s.look, { direct: true, dur: 2.6 }]);
  } else legs.push([s.cam, s.look, {}]);
  t.inside = false;
  const run = (k) => {
    if (!ui.tour || ui.tour.i !== i) return;
    const [p, l, o] = legs[k];
    controls.flyTo(p, l, { ...o, mode: 'tour', then: () => (k + 1 < legs.length ? run(k + 1) : arrive()) });
  };
  run(0);
  if (s.id && BUILDINGS[s.id]) { $('placeName').textContent = BUILDINGS[s.id].name.split(' · ')[0]; $('placeArea').textContent = AREAS[BUILDINGS[s.id].area] || ''; }
}
function narrate(i) {
  const t = ui.tour; if (!t) return;
  const s = TOUR[i];
  const next = () => { if (ui.tour && ui.tour.i === i && !ui.tour.paused) ui.tour.timer = setTimeout(() => goStop(i + 1 < TOUR.length ? i + 1 : i), 1600); };
  if (i === TOUR.length - 1) {
    const end = () => { if (ui.tour && ui.tour.i === i) ui.tour.timer = setTimeout(() => { stopTour(); toast('导览结束。可以继续鸟瞰，或切换「漫步」走进宫城。', 5000); }, 4000); };
    if (settings.voice && audio.say(s.say, end)) return;
    t.timer = setTimeout(end, s.say.length * 200 + 3000);
    return;
  }
  if (settings.voice && audio.say(s.say, next)) return;
  t.timer = setTimeout(next, s.say.length * 200 + 3500);
}
$('tourNext').addEventListener('click', () => { if (!ui.tour) return; if (ui.tour.i === TOUR.length - 1) { stopTour(); return; } goStop(ui.tour.i + 1); });
$('tourPrev').addEventListener('click', () => ui.tour && goStop(ui.tour.i - 1));
$('tourExit').addEventListener('click', () => stopTour());
$('tourPause').addEventListener('click', () => {
  const t = ui.tour; if (!t) return;
  t.paused = !t.paused;
  $('tourPause').textContent = t.paused ? '继续' : '暂停';
  if (t.paused) { clearTimeout(t.timer); audio.stopSay(); }
  else if (t.arrived) narrate(t.i);
});

// ---------------- 索引 ----------------
(() => {
  const groups = $('idxGroups');
  const byArea = {};
  for (const [id, b] of Object.entries(BUILDINGS)) {
    if (!REG.anchors[id]) continue;
    (byArea[b.area] ||= []).push([id, b]);
  }
  const render = (q) => {
    groups.innerHTML = '';
    for (const [area, label] of Object.entries(AREAS)) {
      const items = (byArea[area] || []).filter(([, b]) => !q || b.name.includes(q) || (b.text || '').includes(q));
      if (!items.length) continue;
      const g = document.createElement('div'); g.className = 'idx-group';
      g.innerHTML = `<h4>${label}</h4>`;
      const list = document.createElement('div'); list.className = 'idx-list';
      for (const [id, b] of items) {
        const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn'; btn.textContent = b.name;
        btn.addEventListener('click', () => { selectBuilding(id, true); });
        list.appendChild(btn);
      }
      g.appendChild(list); groups.appendChild(g);
    }
    if (!groups.children.length) groups.innerHTML = '<p class="help">没有找到匹配的建筑。</p>';
  };
  render('');
  $('search').addEventListener('input', (e) => render(e.target.value.trim()));
})();
const panels = [['btnIndex', 'indexPanel'], ['btnSettings', 'settingsPanel']];
for (const [b, p] of panels) $(b).addEventListener('click', () => {
  const open = $(p).hidden;
  for (const [b2, p2] of panels) { $(p2).hidden = true; $(b2).setAttribute('aria-pressed', 'false'); }
  if (open) { $(p).hidden = false; $(b).setAttribute('aria-pressed', 'true'); $('card').hidden = true; }
});
for (const c of document.querySelectorAll('[data-close]')) c.addEventListener('click', () => { $(c.dataset.close).hidden = true; for (const [b, p] of panels) if (p === c.dataset.close) $(b).setAttribute('aria-pressed', 'false'); });
$('placeBtn').addEventListener('click', () => { if (lastPlace) showCard(lastPlace); });

// ---------------- 知识标注 ----------------
function setKnowledge(on) {
  labels.showKnowledge = on;
  $('btnKnow').setAttribute('aria-pressed', String(on));
  if (!on) labels.closeNotes();
  else toast('朱红印章标出了古建筑知识点，点击印章展开说明。', 4000);
}
$('btnKnow').addEventListener('click', () => setKnowledge(!labels.showKnowledge));

// ---------------- 天时 ----------------
const fmtTime = (h) => {
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60) % 60;
  const names = [[0, '拂晓'], [6, '清晨'], [8, '上午'], [11, '正午'], [13, '下午'], [17, '黄昏'], [19, '入夜'], [21, '深夜']];
  const n = names.filter(([t]) => h >= t).pop()[1];
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${n}`;
};
$('timeRange').addEventListener('input', (e) => { const h = +e.target.value; W.env.setTime(h); $('timeOut').textContent = fmtTime(h); });
$('timeOut').textContent = fmtTime(9.5);
for (const b of document.querySelectorAll('#seasons button')) b.addEventListener('click', () => {
  for (const x of document.querySelectorAll('#seasons button')) x.classList.toggle('on', x === b);
  W.env.setSeason(b.dataset.season);
  W.env.apply();
  const msg = { spring: '春：御花园的海棠、玉兰开花了。', summer: '夏：古树浓荫，午后蝉鸣。', autumn: '秋：银杏金黄，天高气爽。', winter: '冬：落叶的树枝光秃秃的，试试「落雪」。' }[b.dataset.season];
  toast(msg, 3000);
});
$('snowBtn').addEventListener('click', () => {
  const on = !W.env.snow;
  W.env.setSnow(on);
  $('snowBtn').setAttribute('aria-pressed', String(on));
  if (on) toast('一下雪，紫禁城就成了"雪落紫禁城"。积雪需要一点时间铺满屋顶，护城河也会慢慢结冰。', 5000);
});
$('btnEnv').addEventListener('click', () => {
  const env = $('env'); const c = env.classList.toggle('collapsed');
  $('btnEnv').setAttribute('aria-pressed', String(!c));
});
if (innerWidth < 760) { $('btnEnv').hidden = false; $('env').classList.add('collapsed'); }

// ---------------- 设置 ----------------
const bindToggle = (id, key, on, off, apply) => {
  const el = $(id);
  const paint = () => { el.setAttribute('aria-pressed', String(settings[key])); el.textContent = settings[key] ? on : off; };
  paint(); apply(settings[key]);
  el.addEventListener('click', () => { settings[key] = !settings[key]; store.set(key, settings[key]); paint(); apply(settings[key]); });
};
bindToggle('setMusic', 'music', '开', '关', (v) => audio.setMusic(v));
bindToggle('setAmb', 'amb', '开', '关', (v) => audio.setAmbience(v));
bindToggle('setVoice', 'voice', '开', '关', (v) => { if (!v) audio.stopSay(); });
bindToggle('setNames', 'names', '显示', '隐藏', (v) => (labels.showNames = v));
bindToggle('setPeople', 'people', '显示', '隐藏', (v) => W.people.setVisible(v));
for (const b of document.querySelectorAll('[data-q]')) {
  b.classList.toggle('on', b.dataset.q === qName);
  b.addEventListener('click', () => {
    if (b.dataset.q === qName) return;
    store.set('quality', b.dataset.q);
    toast('画质已切换，刷新页面后完全生效。', 4000);
    qName = b.dataset.q;
    for (const x of document.querySelectorAll('[data-q]')) x.classList.toggle('on', x === b);
    // 即时生效的部分
    const P = PRESETS[qName];
    renderer.setPixelRatio(P.pixelRatio); Q.pixelRatio = P.pixelRatio;
    Q.bloom = P.bloom; setupComposer();
    W.water.uniforms.hasRefl.value = P.reflection && W.water.rt ? 1 : 0;
    W.water.q.reflectEvery = P.reflection ? 1 : 1e9;
    onResize();
  });
}

// ---------------- 地图 ----------------
const openBig = () => { $('bigmap').hidden = false; requestAnimationFrame(() => minimap.drawBig(camera.position.x, camera.position.z, yawOf(), nameList)); };
$('mmOpen').addEventListener('click', openBig);
$('mm').addEventListener('click', openBig);
$('bmClose').addEventListener('click', () => ($('bigmap').hidden = true));
$('bm').addEventListener('click', (e) => {
  const r = $('bm').getBoundingClientRect();
  const p = minimap.bigToWorld(e.clientX - r.left, e.clientY - r.top);
  if (!p) return;
  $('bigmap').hidden = true;
  if (mode === 'walk' || mode === 'fly') {
    const spot = controls.findWalkable(p.x, p.z, 60);
    if (spot) { controls.teleport(spot.x, spot.z); toast('已到达新的位置。'); } else toast('那里不能站立，换个位置试试。');
  } else {
    if (mode === 'tour') stopTour();
    const g = groundAt(p.x, p.z);
    controls.flyTo([p.x, g + 160, p.z + 200], [p.x, g, p.z], { mode: 'orbit' });
  }
});
const yawOf = () => { const d = new THREE.Vector3(); camera.getWorldDirection(d); return Math.atan2(-d.x, -d.z); };

// ---------------- 键盘 ----------------
addEventListener('keydown', (e) => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (e.code === 'Digit1') setMode('orbit');
  else if (e.code === 'Digit2' && mode !== 'walk' && mode !== 'fly') walkAt(null);
  else if (e.code === 'Digit3') startTour(0);
  else if (e.code === 'KeyM') { if ($('bigmap').hidden) openBig(); else $('bigmap').hidden = true; }
  else if (e.code === 'KeyK') setKnowledge(!labels.showKnowledge);
  else if (e.code === 'Escape') {
    if (!$('bigmap').hidden) $('bigmap').hidden = true;
    else if (!$('card').hidden) hideCard();
    else if (mode === 'tour') stopTour();
  }
});

// ---------------- 尺寸 ----------------
function onResize() {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (composer) { composer.setSize(innerWidth, innerHeight); bloom.resolution.set(innerWidth, innerHeight); }
}
addEventListener('resize', onResize);

// ---------------- 主循环 ----------------
const clock = new THREE.Clock();
let hoverT = 0, mmT = 0, placeT = 0, frame = 0;
const tmp = new THREE.Vector3();
function nearestPlace() {
  const p = camera.position;
  let best = null, bd = 1e9;
  const focus = mode === 'orbit' ? controls.orbit.target : p;
  for (const [id, a] of Object.entries(REG.anchors)) {
    if (!BUILDINGS[id]) continue;
    const d = Math.hypot(a.x - focus.x, a.z - focus.z) - Math.min(a.r, 30) * 0.6;
    if (d < bd) { bd = d; best = id; }
  }
  return bd < 120 ? best : null;
}

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, clock.getDelta());
  frame++;
  controls.update(dt);
  // 导览停留时缓慢环绕
  const t = ui.tour;
  if (t && t.arrived && !controls.anim && !t.paused) {
    t.drift += dt;
    const ang = Math.sin(t.drift * 0.08) * (TOUR[t.i].interior ? 0.12 : 0.22);
    tmp.copy(t.base).sub(t.look).applyAxisAngle(new THREE.Vector3(0, 1, 0), ang).add(t.look);
    camera.position.copy(tmp); camera.lookAt(t.look);
  }
  // 近裁剪面随高度调整
  const hAbove = Math.max(1, camera.position.y - groundAt(camera.position.x, camera.position.z));
  const near = THREE.MathUtils.clamp(hAbove * 0.008, 0.12, 3);
  if (Math.abs(near - camera.near) / camera.near > 0.2) { camera.near = near; camera.updateProjectionMatrix(); }

  const focus = controls.focusPoint();
  const extent = mode === 'walk' ? 110 : mode === 'fly' ? Math.max(120, hAbove * 2) : Math.max(110, Math.min(900, camera.position.distanceTo(focus) * 0.9));
  W.env.update(dt, camera, focus, extent);
  W.water.update(dt, camera, W.env, [W.env.snowPts, W.env.stars]);
  if (settings.people) W.people.update(dt);
  labels.update(mode === 'anim' ? (ui.tour ? 'tour' : 'orbit') : mode, controls.interior);

  // 室内灯光
  const inside = !!controls.interior;
  const li = inside ? 900 : 0;
  roomLight.intensity += (li - roomLight.intensity) * Math.min(1, dt * 3);
  roomLight2.intensity += ((inside ? 380 : 0) - roomLight2.intensity) * Math.min(1, dt * 3);
  // 夜间泛光
  if (bloom) bloom.strength = 0.18 + W.env.night * 0.7;

  // 悬停提示
  hoverT -= dt;
  if (hoverT <= 0 && mode === 'orbit' && !coarse) {
    hoverT = 0.12;
    const h = controls.hoverPick();
    if (h) {
      const tip = $('tip');
      if (h.id && BUILDINGS[h.id]) { tip.textContent = BUILDINGS[h.id].name; tip.style.left = h.x + 'px'; tip.style.top = h.y + 'px'; tip.hidden = false; renderer.domElement.style.cursor = 'pointer'; }
      else { tip.hidden = true; renderer.domElement.style.cursor = ''; }
    }
  } else if (mode !== 'orbit') $('tip').hidden = true;

  // 小地图、地名
  mmT -= dt;
  if (mmT <= 0) {
    mmT = 0.1;
    const f = mode === 'orbit' ? controls.orbit.target : camera.position;
    minimap.drawMini(f.x, f.z, yawOf(), mode);
  }
  placeT -= dt;
  if (placeT <= 0 && !ui.tour) {
    placeT = 0.5;
    const id = nearestPlace();
    if (id !== lastPlace) {
      lastPlace = id;
      const b = BUILDINGS[id];
      $('placeName').textContent = b ? b.name.split(' · ')[0] : '紫禁城';
      $('placeArea').textContent = b ? AREAS[b.area] || '' : '';
    }
  }
  // 声音
  if (frame % 6 === 0) {
    audio.update({ hour: W.env.time, season: W.env.season, snow: W.env.snowAmt > 0.4, night: W.env.night, crowd: settings.people ? W.people.near(camera.position.x, camera.position.z, 45) : 0, height: hAbove, interior: inside });
  }
  if (composer) composer.render(); else renderer.render(scene, camera);
}
loop();
window.__fc = { camera, controls, W, REG, setMode, startTour, selectBuilding, audio, renderer };
window.__ready = true;
