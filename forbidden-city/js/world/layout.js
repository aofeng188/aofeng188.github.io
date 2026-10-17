// 紫禁城总体布局。所有位置按真实格局近似安排，尺度以米计。
import { rgb } from '../core/buf.js';
import { C } from '../core/materials.js';
import { hall, gatePlatform, palaceWall, wallGate, compound, cityWall, cornerTower, pavilion, rowHouse, railing, stairs, wfill, wblock, wrampZ } from '../build/hall.js';
import { roof } from '../build/roof.js';
import * as P from '../build/props.js';
import { furnish } from '../build/interiors.js';
import { REG, addPick, setAnchor } from './registry.js';
import { strokePoly, WATER_Y, BED_Y } from './terrain.js';
import { Z, SANTAI_H, QQ_H } from './coords.js';

const PI = Math.PI, E = -PI / 2, W_ = PI / 2; // 朝西 / 朝东

// 区域底色
const PAVE = 0xa9a59c, PAVE2 = 0xb3afa6, YULU = 0xd4cfc3, SOIL = 0x8a8068, ROAD = 0x55565a, WALK = 0x9b968c, LANE = 0xa29e95;

export function buildWorld(ctx) {
  const { B, T, TR, PL, SG } = ctx;
  const out = { interiors: [] };
  const sg = (id, x, z, rot = 0, y = 0) => { if (SG[id]) P.sign(B, x, y, z, rot, SG[id]); REG.signs.push({ id, x, z }); };

  // ================= 地面底图 =================
  T.rect(T.b.x0, T.b.z0, T.b.x1, T.b.z1, 0x8f8b80);
  // 宫城内铺地
  T.rect(-376, Z(0), 376, Z(961), PAVE);
  // 筒子河两岸
  T.rect(-470, Z(-92), 470, Z(1053), WALK);
  T.rect(-396, Z(-20), 396, Z(981), 0x948f84);
  // 长安街、景山前街、南北池子
  T.rect(T.b.x0, 1012, T.b.x1, 1062, ROAD);
  for (let x = T.b.x0; x < T.b.x1; x += 12) { T.rect(x, 1036.6, x + 6, 1037.2, 0xe8e8e0); }
  T.rect(T.b.x0, 1062, T.b.x1, T.b.z1, 0xbab6ac);
  T.rect(T.b.x0, -560, T.b.x1, -590, ROAD);
  for (const sx of [1, -1]) T.rect(sx * 455, -560, sx * 472, 560, ROAD);
  // 天安门—午门 御路
  T.rect(-60, 1010, 60, 600, PAVE2);
  T.rect(-4, 1010, 4, 492, YULU);
  // 宫内中轴御路
  T.rect(-3.5, Z(22), 3.5, Z(150), YULU);
  T.rect(-4.5, Z(176), 4.5, Z(300), YULU);
  T.rect(-3.5, Z(545), 3.5, Z(594), YULU);
  // 宫城周边草地
  for (const [x0, z0, x1, z1] of [[-700, 560, -300, 1010], [300, 560, 700, 1010], [-700, -600, -478, 600], [478, -600, 700, 600]]) {
    T.rect(x0, z0, x1, z1, SOIL); T.grass(x0, z0, x1, z1, 0.75);
  }

  // ================= 水系 =================
  const moat = [[-78, 500.5], [-396.5, 500.5], [-396.5, -500.5], [396.5, -500.5], [396.5, 500.5], [78, 500.5], [78, 552.5], [448.5, 552.5], [448.5, -552.5], [-448.5, -552.5], [-448.5, 552.5], [-78, 552.5]];
  T.addWater(moat);
  const riverPts = [[-345, Z(945)], [-345, Z(270)], [-125, Z(270)], [-125, Z(122)]];
  for (let x = -115; x <= 115; x += 10) riverPts.push([x, Z(95 + 27 * (x / 125) ** 2)]);
  riverPts.push([125, Z(122)], [125, Z(270)], [322, Z(270)], [322, Z(18)]);
  const river = strokePoly(riverPts, 8);
  T.addWater(river);
  const outerPts = [];
  for (let x = -190; x <= 190; x += 10) outerPts.push([x, 984 + 9 * (1 - (x / 190) ** 2)]);
  T.addWater(strokePoly(outerPts, 9));
  // 园中小池
  const ponds = [[47, 63, 815, 829], [-63, -47, 815, 829]].map(([a, b, s0, s1]) => [[a, Z(s0)], [b, Z(s0)], [b, Z(s1)], [a, Z(s1)]]);
  ponds.push([[-284, Z(418)], [-256, Z(418)], [-256, Z(436)], [-284, Z(436)]]);
  for (const p of ponds) T.addWater(p);
  out.water = T.water;

  // ================= 天安门 =================
  const tamZ = 950;
  gatePlatform(B, { x: 0, z: tamZ, W: 120, D: 38, H: 13, tunnels: [{ x: 0, w: 7, h: 9.5 }, { x: -17, w: 5.5, h: 8 }, { x: 17, w: 5.5, h: 8 }, { x: -33, w: 4.5, h: 6.5 }, { x: 33, w: 4.5, h: 6.5 }], id: 'tiananmen' });
  // 城台上的标语
  if (PL['中华人民共和国万岁']) {
    B.at(0, 0, tamZ, 0);
    const sl = PL['中华人民共和国万岁'], sr = PL['世界人民大团结万岁'];
    for (const [cell, x] of [[sl, -36], [sr, 36]]) {
      const w = 26, h = w / cell.aspect;
      B.quad('plaque', [x - w / 2, 10.3, 19.06], [x + w / 2, 10.3, 19.06], [x + w / 2, 10.3 + h, 19.06], [x - w / 2, 10.3 + h, 19.06], [[cell.uv[0], cell.uv[1]], [cell.uv[2], cell.uv[1]], [cell.uv[2], cell.uv[3]], [cell.uv[0], cell.uv[3]]]);
    }
  }
  const tam = hall(B, { noCollide: true, x: 0, y: 13, z: tamZ, W: 57, D: 25, bays: 9, dBays: 5, colH: 6.4, double: true, roof: 'xieshan', beasts: 9, base: { h: 0.6, pad: 2.5, rail: true, stairs: [] }, id: 'tiananmen', noMap: true });
  // 国徽（简化为圆形徽章）与大红灯笼
  B.at(0, 13 + tam.baseH, tamZ, 0);
  B.sphere('gold', 0, 12.1, 9.7, 1.3, 1.3, 0.22, 16, rgb(0xd9a93c));
  B.sphere('lamp', 0, 12.1, 9.75, 0.75, 0.75, 0.2, 12, [255, 255, 255]);
  for (let k = 1; k <= 4; k++) for (const sx of [-1, 1]) P.lantern(B, sx * (57 / 9) * k, 13 + 0.6 + 4.4, tamZ + 13.6, 1.7);
  // 华表、石狮、外金水桥
  for (const sx of [-1, 1]) {
    P.huabiao(B, sx * 42, 1003, 0);
    P.huabiao(B, sx * 42, 902, 0);
    P.lion(B, sx * 17, 0, 1004, 0, { mat: 'marble', male: sx > 0, scale: 0.95 });
    P.lion(B, sx * 26, 0, 973, 0, { mat: 'marble', male: sx > 0, scale: 0.95 });
  }
  for (const [x, w] of [[0, 9], [-12.5, 6.5], [12.5, 6.5], [-24, 5.5], [24, 5.5], [-95, 5], [95, 5]]) {
    const zc = 984 + 9 * (1 - (x / 190) ** 2);
    bridge(B, x, zc, 20, w, 0, { h: 1.4 });
  }
  sg('tiananmen', 9, 1008, 0);
  // 皇城墙
  for (const sx of [1, -1]) palaceWall(B, sx * 60, tamZ, sx * 640, tamZ, { h: 8.5, t: 2.6 });
  // 天安门—端门之间
  for (const sx of [1, -1]) {
    palaceWall(B, sx * 75, 931, sx * 75, 830, { h: 7 });
    rowHouse(B, { x: sx * 64, z: 882, rot: sx > 0 ? E : W_, W: 76, D: 7, bays: 19, colH: 3.6, tile: C.yellow });
    T.rect(sx * 75, 931, sx * 3, 830, PAVE2);
  }
  T.rect(-4, 931, 4, 830, YULU);

  // ================= 端门 =================
  const dmZ = 815;
  gatePlatform(B, { x: 0, z: dmZ, W: 110, D: 30, H: 12, tunnels: [{ x: 0, w: 6.5, h: 9 }, { x: -16, w: 5, h: 7.5 }, { x: 16, w: 5, h: 7.5 }, { x: -31, w: 4.5, h: 6.5 }, { x: 31, w: 4.5, h: 6.5 }], id: 'duanmen' });
  hall(B, { noCollide: true, x: 0, y: 12, z: dmZ, W: 54, D: 22, bays: 9, dBays: 5, colH: 6, double: true, roof: 'xieshan', beasts: 9, base: { h: 0.6, pad: 2.2, rail: true, stairs: [] }, id: 'duanmen', plaque: PL['端门'], plaqueW: 1.5, noMap: true });
  for (const sx of [1, -1]) palaceWall(B, sx * 55, dmZ, sx * 75, dmZ, { h: 8 });
  sg('duanmen', 9, 838, 0);

  // ================= 端门—午门 =================
  for (const sx of [1, -1]) {
    const gx = sx * 70;
    // 两侧墙，开阙左门/阙右门、太庙街门/社稷街门
    palaceWall(B, gx, 800, gx, 774);
    wallGate(B, gx, 768, sx > 0 ? E : W_, { w: 4, kind: 'plain', wallH: 6.5 });
    palaceWall(B, gx, 762, gx, 618);
    wallGate(B, gx, 611, sx > 0 ? E : W_, { w: 4, kind: 'plain', wallH: 6.5 });
    palaceWall(B, gx, 604, gx, 588.5);
    palaceWall(B, sx * 63, 588.5, gx, 588.5);
    rowHouse(B, { x: sx * 60, z: 735, rot: sx > 0 ? E : W_, W: 52, D: 7, bays: 13, colH: 3.6 });
    rowHouse(B, { x: sx * 60, z: 652, rot: sx > 0 ? E : W_, W: 60, D: 7, bays: 15, colH: 3.6 });
  }

  // ================= 太庙（东） =================
  compound(B, { x0: 82, z0: 595, x1: 292, z1: 935, h: 7, gates: [{ side: 'w', at: 768, w: 4, kind: 'plain' }] });
  compound(B, { x0: 122, z0: 625, x1: 252, z1: 905, h: 6.5, gates: [{ side: 's', at: 187, w: 26, kind: 'none' }] });
  hall(B, { x: 187, z: 900, W: 26, D: 10, bays: 5, colH: 4.8, roof: 'wudian', front: 'gate', beasts: 7, caihua: 'hexi', base: { h: 1.2, rail: true, stairs: [{ side: 'f', w: 6 }, { side: 'b', w: 6 }] } });
  hall(B, { x: 187, z: 800, W: 64, D: 28, bays: 11, dBays: 5, colH: 7, double: true, roof: 'wudian', beasts: 9, base: { h: 3.6, pad: 6, sumeru: true, rail: true, stairs: [{ side: 'f', w: 10, yudao: true }] }, id: 'taimiao' });
  hall(B, { x: 187, z: 735, W: 56, D: 18, bays: 9, colH: 5.6, roof: 'wudian', beasts: 7, base: { h: 1.6, rail: true } });
  hall(B, { x: 187, z: 670, W: 50, D: 16, bays: 9, colH: 5.2, roof: 'wudian', beasts: 7, base: { h: 1.4, rail: true } });
  T.rect(122, 625, 252, 905, PAVE);
  forest(TR, T, 86, 598, 288, 932, 'cypress', 260, (x, z) => !(x > 118 && x < 256 && z > 621 && z < 909), 11);

  // ================= 社稷坛（西） =================
  compound(B, { x0: -292, z0: 595, x1: -82, z1: 935, h: 7, gates: [{ side: 'e', at: 768, w: 4, kind: 'plain' }] });
  // 四色琉璃坛墙
  const swCol = { s: 0xb03a28, n: 0x2c2c2e, e: 0x3d7a46, w: 0xe8e4da };
  for (const [side, x0, z0, x1, z1] of [['s', -222, 790, -148, 790], ['n', -222, 720, -148, 720], ['e', -148, 720, -148, 790], ['w', -222, 720, -222, 790]]) {
    B.at(0, 0, 0, 0);
    palaceWall(B, x0, z0, x1, z1, { h: 1.8, t: 0.9, color: swCol[side], tile: swCol[side] });
  }
  P.shejitan(B, -185, 755);
  hall(B, { x: -185, z: 690, W: 40, D: 16, bays: 5, colH: 5, roof: 'xieshan', beasts: 7, base: { h: 1.2, rail: true }, id: 'shejitan' });
  T.rect(-222, 720, -148, 790, PAVE2);
  forest(TR, T, -288, 598, -86, 932, 'cypress', 220, (x, z) => !(x > -226 && x < -144 && z > 680 && z < 794) && !(x > -210 && x < -160 && z > 670 && z < 712), 13);

  // ================= 城墙、角楼、护城河 =================
  const wc = 372.2, ws = Z(4.3), wn = Z(956.7);
  cityWall(B, -376.5, ws, -63, ws, 1); cityWall(B, 63, ws, 376.5, ws, 1);
  cityWall(B, -376.5, wn, -31, wn, -1); cityWall(B, 31, wn, 376.5, wn, -1);
  cityWall(B, wc, 480.5, wc, Z(165), 1); cityWall(B, wc, Z(215), wc, -480.5, 1);
  cityWall(B, -wc, 480.5, -wc, Z(165), -1); cityWall(B, -wc, Z(215), -wc, -480.5, -1);
  for (const [x, z] of [[wc, ws], [-wc, ws], [wc, wn], [-wc, wn]]) cornerTower(B, x, z, 10, 0, 'jiaolou');
  setAnchor('jiaolou', -wc, 18, wn, 24, { top: 28.5, base: 10 });
  setAnchor('chengqiang', -wc, 6, 0, 40, { top: 12, base: 0 });
  sg('jiaolou', -392, -488, W_ + PI);
  // 神武门、东华门、西华门外桥
  bridge(B, 0, -527, 54, 30, 0, { flat: true });
  bridge(B, 422.5, Z(190), 54, 22, W_, { flat: true });
  bridge(B, -422.5, Z(190), 54, 22, W_, { flat: true });

  // ================= 午门 =================
  gatePlatform(B, { x: 0, z: Z(5), W: 126, D: 34, H: 12, tunnels: [{ x: 0, w: 6, h: 8.5 }, { x: -13, w: 5, h: 7.5 }, { x: 13, w: 5, h: 7.5 }], id: 'wumen' });
  for (const sx of [1, -1]) gatePlatform(B, { x: sx * 50.5, z: 540.5, rot: W_, W: 96, D: 25, H: 12, tunnels: [], id: 'wumen', doors: false });
  hall(B, { noCollide: true, x: 0, y: 12, z: Z(5), W: 60, D: 25, bays: 9, dBays: 5, colH: 6.6, double: true, roof: 'wudian', beasts: 9, base: { h: 0.6, pad: 2.4, rail: true, stairs: [] }, id: 'wumen', plaque: PL['午门'], plaqueW: 1.6, noMap: true });
  for (const sx of [1, -1]) {
    hall(B, { noCollide: true, x: sx * 50.5, y: 12, z: 540.5, rot: sx > 0 ? E : W_, W: 62, D: 10, bays: 13, colH: 4.2, roof: 'xieshan', beasts: 5, front: 'windows', base: { h: 0.4, pad: 1.2, stairs: [] }, noMap: true });
    for (const zz of [497, 583]) hall(B, { noCollide: true, x: sx * 50.5, y: 12, z: zz, W: 12, D: 12, bays: 3, dBays: 3, colH: 4.2, double: true, roof: 'cuanjian', beasts: 7, front: 'doors', base: { h: 0.4, pad: 1.2, stairs: [] }, noMap: true });
  }
  T.rect(-38, 492, 38, 588, PAVE2);
  T.rect(-4, 492, 4, 588, YULU);
  sg('wumen', 24, 600, 0);

  // ================= 太和门广场 =================
  for (const x of [0, -11, 11, -21, 21]) {
    const s = 95 + 27 * (x / 125) ** 2;
    bridge(B, x, Z(s), 16, x === 0 ? 6.5 : x * x < 200 ? 5 : 4.5, 0, { h: 1.3 });
  }
  // 金水河两岸栏杆
  B.at(0, 0, 0, 0);
  const bankRail = (sgn) => {
    let cur = null;
    for (let x = -120; x <= 120; x += 4) {
      const gap = [0, -11, 11, -21, 21].some((bx) => Math.abs(x - bx) < (bx === 0 ? 5.5 : 4.5));
      const p = [x, Z(95 + 27 * (x / 125) ** 2) + sgn * 4.6];
      if (gap) { cur = null; continue; }
      if (cur) railing(B, cur[0], cur[1], p[0], p[1], 0, { sp: 2, noCollide: false });
      cur = p;
    }
  };
  bankRail(1); bankRail(-1);
  sg('jinshuiqiao', 34, Z(70), 0);
  // 太和门、昭德门、贞度门
  hall(B, { x: 0, z: Z(165), W: 42, D: 18, bays: 9, dBays: 4, colH: 6, double: true, roof: 'xieshan', front: 'gate', beasts: 9, base: { h: 3.4, pad: 3, sumeru: true, rail: true, stairs: [{ side: 'f', w: 8, yudao: true }, { side: 'f', at: -14, w: 4 }, { side: 'f', at: 14, w: 4 }, { side: 'b', w: 8, yudao: true }] }, plaque: PL['太和门'], id: 'taihemen' });
  for (const sx of [1, -1]) {
    P.lion(B, sx * 18, 0, Z(140), 0, { mat: 'bronze', male: sx > 0, scale: 1.15 });
    hall(B, { x: sx * 70, z: Z(162), W: 18, D: 9, bays: 5, colH: 4.4, roof: 'xieshan', front: 'gate', beasts: 7, base: { h: 1.4, rail: true, stairs: [{ side: 'f', w: 4 }, { side: 'b', w: 4 }] } });
    rowHouse(B, { x: sx * 42, z: Z(164), W: 26, D: 8, bays: 7, colH: 3.8 });
    rowHouse(B, { x: sx * 92, z: Z(164), W: 22, D: 8, bays: 5, colH: 3.8 });
    // 东西庑与协和门 / 熙和门
    const rx = sx * 108, rr = sx > 0 ? E : W_;
    rowHouse(B, { x: rx, z: Z(48), rot: rr, W: 46, D: 8, bays: 11, colH: 3.8 });
    rowHouse(B, { x: rx, z: Z(123), rot: rr, W: 50, D: 8, bays: 11, colH: 3.8 });
    hall(B, { x: rx, z: Z(85), rot: rr, W: 20, D: 10, bays: 5, colH: 4.6, roof: 'xieshan', front: 'gate', beasts: 7, base: { h: 1.2, rail: true, stairs: [{ side: 'f', w: 5 }, { side: 'b', w: 5 }] }, id: sx > 0 ? 'xiehemen' : 'xihemen', plaque: PL[sx > 0 ? '协和门' : '熙和门'] });
  }
  sg('taihemen', 30, Z(132), 0);

  // ================= 太和殿广场与三台 =================
  for (const sx of [1, -1]) {
    const rx = sx * 108, rr = sx > 0 ? E : W_;
    hall(B, { x: sx * 101, z: Z(172), W: 12, D: 12, bays: 3, dBays: 3, colH: 4.6, double: true, roof: 'xieshan', beasts: 7, base: { h: 1, stairs: [] } });
    hall(B, { x: rx, z: Z(195), rot: rr, W: 14, D: 8, bays: 3, colH: 4.2, roof: 'xieshan', front: 'gate', base: { h: 1.0, stairs: [{ side: 'f', w: 4 }, { side: 'b', w: 4 }] } });
    rowHouse(B, { x: rx, z: Z(223), rot: rr, W: 38, D: 8, bays: 9, colH: 3.8 });
    hall(B, { x: rx, z: Z(263), rot: rr, W: 38, D: 14, bays: 9, dBays: 3, colH: 5.2, double: true, upperH: 4.6, roof: 'wudian', beasts: 7, base: { h: 1.6, rail: true, stairs: [{ side: 'f', w: 6 }] }, id: sx > 0 ? 'tirenge' : 'hongyige', plaque: PL[sx > 0 ? '体仁阁' : '弘义阁'] });
    rowHouse(B, { x: rx, z: Z(312), rot: rr, W: 56, D: 8, bays: 13, colH: 3.8 });
    rowHouse(B, { x: rx, z: Z(370), rot: rr, W: 52, D: 8, bays: 13, colH: 3.8 });
    hall(B, { x: rx, z: Z(405), rot: rr, W: 14, D: 8, bays: 3, colH: 4.2, roof: 'xieshan', front: 'gate', base: { h: 1.0, stairs: [{ side: 'f', w: 4 }, { side: 'b', w: 4 }] } });
    rowHouse(B, { x: rx, z: Z(446), rot: rr, W: 64, D: 8, bays: 15, colH: 3.8 });
    hall(B, { x: rx, z: Z(488), rot: rr, W: 14, D: 8, bays: 3, colH: 4.2, roof: 'xieshan', front: 'gate', base: { h: 1.0, stairs: [{ side: 'f', w: 4 }, { side: 'b', w: 4 }] } });
    rowHouse(B, { x: rx, z: Z(515), rot: rr, W: 36, D: 8, bays: 9, colH: 3.8 });
    hall(B, { x: sx * 101, z: Z(540), W: 12, D: 12, bays: 3, dBays: 3, colH: 4.6, double: true, roof: 'xieshan', beasts: 7, base: { h: 1, stairs: [] } });
    palaceWall(B, sx * 66, Z(545), sx * 95, Z(545), { h: 6.5 });
  }
  sg('tirenge', 96, Z(240), E);
  sg('hongyige', -96, Z(240), W_);
  // 三台
  const tiers = [
    [[70, 306, 400], [46, 400, 440], [64, 440, 540]],
    [[65, 312, 400], [41, 400, 440], [59, 440, 534]],
    [[60, 318, 400], [36, 400, 440], [54, 440, 528]],
  ];
  const th = SANTAI_H / 3;
  tiers.forEach((secs, k) => terraceTier(B, secs, k * th, th, k));
  setAnchor('santai', 0, 5, Z(420), 120, { top: 9, base: 0 });
  REG.picks.push({ id: 'santai', min: [-70, 0, Z(540)], max: [70, SANTAI_H, Z(306)] });
  sg('santai', 76, Z(296), 0);
  // 太和殿
  const thd = hall(B, { x: 0, y: SANTAI_H, z: Z(372), W: 60, D: 33, bays: 11, dBays: 5, colH: 7.6, double: true, roof: 'wudian', beasts: 10, wenH: 3.6,
    base: { h: 1.4, pad: 3.2, sumeru: true, rail: true, stairs: [{ side: 'f', w: 9, yudao: true }, { side: 'f', at: -20, w: 4 }, { side: 'f', at: 20, w: 4 }, { side: 'b', w: 5 }] },
    enter: true, goldCols: true, openBays: 3, plaque: PL['太和殿'], plaqueW: 6.4, id: 'taihedian' });
  furnish(B, 'taihedian', thd, PL);
  out.interiors.push({ id: 'taihedian', ...thd });
  // 月台陈设
  const yt = SANTAI_H;
  P.sundial(B, 24, yt, Z(338), 0);
  P.jialiang(B, -24, yt, Z(338), 0);
  for (const sx of [1, -1]) {
    P.turtle(B, sx * 12, yt, Z(344), 0);
    P.crane(B, sx * 17, yt, Z(344), 0);
    P.vat(B, sx * 40, yt, Z(362), true); P.vat(B, sx * 40, yt, Z(382), true);
  }
  for (let k = 0; k < 3; k++) for (const sx of [1, -1]) for (const dx of [11, 21, 31]) P.censer(B, sx * dx, k * th + th, Z([306, 312, 318][k] + 2.6), 0.8);
  sg('taihedian', 22, Z(298), 0);
  // 中和殿、保和殿
  hall(B, { x: 0, y: SANTAI_H, z: Z(420), W: 22, D: 22, bays: 5, dBays: 5, colH: 5.4, roof: 'cuanjian', front: 'doors', beasts: 7, riseK: 0.95, base: { h: 0.9, pad: 2, stairs: [{ side: 'f', w: 5 }, { side: 'b', w: 5 }] }, plaque: PL['中和殿'], plaqueW: 3.6, id: 'zhonghedian' });
  hall(B, { x: 0, y: SANTAI_H, z: Z(472), W: 48, D: 24, bays: 9, dBays: 5, colH: 6.8, double: true, roof: 'xieshan', beasts: 9, base: { h: 1.2, pad: 2.6, sumeru: true, rail: true, stairs: [{ side: 'f', w: 7, yudao: true }, { side: 'b', w: 7, yudao: true }] }, plaque: PL['保和殿'], plaqueW: 5, id: 'baohedian' });
  sg('zhonghedian', 16, Z(406), 0, SANTAI_H);
  sg('baohedian', 18, Z(447), 0, SANTAI_H);
  T.rect(-108, Z(175), 108, Z(545), PAVE);
  T.rect(-4.5, Z(176), 4.5, Z(306), YULU);
  for (const sx of [1, -1]) T.rect(sx * 6, Z(176), sx * 9, Z(306), PAVE2, 0.6);

  // ================= 乾清门广场 =================
  T.rect(-112, Z(545), 112, Z(594), PAVE2);
  const qmz = Z(600);
  hall(B, { x: 0, z: qmz, W: 28, D: 12, bays: 5, dBays: 3, colH: 5.2, roof: 'xieshan', front: 'gate', beasts: 7, base: { h: 1.6, pad: 2.2, sumeru: true, rail: true, stairs: [{ side: 'f', w: 6, yudao: true }], railSkip: ['b'] }, plaque: PL['乾清门'], plaqueW: 3.4, id: 'qianqingmen' });
  for (const sx of [1, -1]) {
    P.lion(B, sx * 12, 0, Z(584), 0, { mat: 'gold', male: sx > 0, scale: 0.85 });
    P.vat(B, sx * 24, 0, Z(580), true); P.vat(B, sx * 34, 0, Z(580), true);
    // 八字琉璃影壁
    B.at(sx * 27, 0, Z(597), sx * -0.35);
    B.box('glaze', 0, 0, 0, 14, 1.0, 1.4, { col: rgb(C.marble) });
    B.box('glaze', 0, 1.0, 0, 13, 4.6, 1.1, { col: rgb(0x8f2a1e), skip: 'b' });
    B.box('glaze', 0, 2.2, 0.56, 4, 2.2, 0.1, { col: rgb(C.green) });
    B.box('glaze', 0, 5.6, 0, 14, 0.5, 1.6, { col: rgb(C.yellow), skip: 'b' });
    wblock(B, -7, -0.8, 7, 0.8);
    // 景运门 / 隆宗门
    hall(B, { x: sx * 112, z: Z(568), rot: sx > 0 ? E : W_, W: 16, D: 9, bays: 3, colH: 4.4, roof: 'xieshan', front: 'gate', beasts: 5, base: { h: 1.0, stairs: [{ side: 'f', w: 4 }, { side: 'b', w: 4 }] }, id: sx > 0 ? 'jingyunmen' : 'longzongmen', plaque: PL[sx > 0 ? '景运门' : '隆宗门'], plaqueW: 2.6 });
    palaceWall(B, sx * 112, Z(545), sx * 112, Z(558));
    palaceWall(B, sx * 112, Z(578), sx * 112, Z(594));
    palaceWall(B, sx * 61, Z(594), sx * 96, Z(594));
    wallGate(B, sx * 102, Z(594), PI, { w: 3, kind: 'glazed' });
    palaceWall(B, sx * 108, Z(594), sx * 112, Z(594));
  }
  rowHouse(B, { x: -82, z: Z(589.5), W: 22, D: 6, bays: 7, colH: 3.0, tile: C.grey, roof: 'juanpeng', caihua: 'su', id: 'junjichu' });
  sg('qianqingmen', 18, Z(570), 0);
  sg('junjichu', -70, Z(582), 0);
  setAnchor('qianqingmen_sq', 0, 4, Z(570), 60, { top: 4, base: 0 });

  // ================= 后三宫 =================
  compound(B, { x0: -61, z0: Z(806), x1: 61, z1: Z(594), h: 7, t: 1.5, gates: [{ side: 's', at: 0, w: 34, kind: 'none' }, { side: 'n', at: 0, w: 24, kind: 'none' }, { side: 'e', at: Z(690), w: 3.5, kind: 'glazed' }, { side: 'w', at: Z(690), w: 3.5, kind: 'glazed' }, { side: 'e', at: Z(765), w: 3, kind: 'plain' }, { side: 'w', at: Z(765), w: 3, kind: 'plain' }] });
  T.rect(-60, Z(594), 60, Z(806), PAVE);
  // 高台甬路（丹陛桥）
  B.at(0, 0, 0, 0);
  {
    const z0 = Z(608.4), z1 = Z(640);
    const w = 7;
    B.quad('marble', [-w / 2, 1.6, z0], [w / 2, 1.6, z0], [w / 2, QQ_H, z1], [-w / 2, QQ_H, z1], [[0, 0], [w / 2, 0], [w / 2, 16], [0, 16]], rgb(C.marble));
    for (const sx of [1, -1]) {
      const x = sx * w / 2;
      B.quad('marble', sx > 0 ? [x, 0, z0] : [x, 0, z1], sx > 0 ? [x, 0, z1] : [x, 0, z0], sx > 0 ? [x, QQ_H, z1] : [x, 1.6, z0], sx > 0 ? [x, 1.6, z0] : [x, QQ_H, z1], [[0, 0], [16, 0], [16, 1.3], [0, 1.3]], rgb(C.marble, 0.95));
    }
    wrampZ(B, -w / 2, z1, w / 2, z0, QQ_H, 1.6);
    for (const sx of [1, -1]) {
      for (let k = 0; k <= 10; k++) {
        const t = k / 10, z = z0 + (z1 - z0) * t, y = 1.6 + (QQ_H - 1.6) * t;
        B.box('marble', sx * (w / 2 - 0.15), y, z, 0.2, 1.1, 0.2, { col: rgb(C.marble) });
      }
      B.quad('marble', [sx * (w / 2 - 0.15), 1.75, z0], [sx * (w / 2 - 0.15), QQ_H + 0.15, z1], [sx * (w / 2 - 0.15), QQ_H + 0.95, z1], [sx * (w / 2 - 0.15), 2.55, z0], [[0, 0], [8, 0], [8, 1], [0, 1]], rgb(C.marble));
      REG.col.capsule(sx * (w / 2 - 0.15), z0, sx * (w / 2 - 0.15), z1, 0.25);
    }
  }
  // 乾清宫"工"字形台基
  const qsec = [[34, 640, 706], [16, 706, 728], [31, 728, 762]];
  terraceTier(B, qsec, 0, QQ_H, 2, { front: [{ at: -22, w: 5 }, { at: 22, w: 5 }], frontGap: 8, back: [{ at: 0, w: 6 }], sides: [{ s: 690, w: 4 }], chishou: true, noYudao: true });
  const qqg = hall(B, { x: 0, y: QQ_H, z: Z(688), W: 45, D: 21, bays: 9, dBays: 5, colH: 6.2, double: true, roof: 'wudian', beasts: 9, base: { h: 0.8, pad: 2.2, sumeru: true, stairs: [{ side: 'f', w: 6, yudao: true }] }, enter: true, openBays: 3, plaque: PL['乾清宫'], plaqueW: 5, id: 'qianqinggong' });
  furnish(B, 'qianqinggong', qqg, PL);
  out.interiors.push({ id: 'qianqinggong', ...qqg });
  P.sundial(B, 20, QQ_H, Z(656), 0);
  P.jialiang(B, -20, QQ_H, Z(656), 0);
  for (const sx of [1, -1]) {
    P.turtle(B, sx * 8, QQ_H, Z(662), 0); P.crane(B, sx * 12.5, QQ_H, Z(664), 0);
    // 江山社稷金殿
    B.at(sx * 27, QQ_H, Z(650), 0);
    B.box('marble', 0, 0, 0, 2.6, 1.0, 2.6, { col: rgb(C.marble) });
    B.box('gold', 0, 1.0, 0, 1.4, 1.2, 1.4, { col: rgb(0xe9b84e), skip: 'b' });
    roof(B, { type: 'cuanjian', hx: 1.3, hz: 1.3, y0: 2.2, rise: 1.0, color: 0xe9b84e, lift: 0.15, scale: 0.3, noFascia: true });
  }
  sg('qianqinggong', 18, Z(645), 0, QQ_H);
  hall(B, { x: 0, y: QQ_H, z: Z(717), W: 15, D: 15, bays: 3, dBays: 3, colH: 4.6, roof: 'cuanjian', front: 'doors', beasts: 7, riseK: 0.95, base: { h: 0.5, pad: 1.4, stairs: [{ side: 'f', w: 4 }, { side: 'b', w: 4 }] }, plaque: PL['交泰殿'], plaqueW: 3, id: 'jiaotaidian' });
  hall(B, { x: 0, y: QQ_H, z: Z(746), W: 44, D: 19, bays: 9, dBays: 5, colH: 5.8, double: true, roof: 'wudian', beasts: 7, base: { h: 0.6, pad: 2, stairs: [{ side: 'f', w: 5 }, { side: 'b', w: 5 }] }, plaque: PL['坤宁宫'], plaqueW: 4.6, id: 'kunninggong' });
  for (const sx of [1, -1]) {
    const rr = sx > 0 ? E : W_;
    rowHouse(B, { x: sx * 55, z: Z(640), rot: rr, W: 76, D: 7, bays: 17, colH: 3.6 });
    rowHouse(B, { x: sx * 55, z: Z(726), rot: rr, W: 66, D: 7, bays: 15, colH: 3.6 });
    rowHouse(B, { x: sx * 55, z: Z(786), rot: rr, W: 36, D: 7, bays: 9, colH: 3.6 });
  }
  hall(B, { x: 0, z: Z(806), W: 20, D: 9, bays: 5, colH: 4.4, roof: 'xieshan', front: 'gate', beasts: 5, base: { h: 1.0, stairs: [{ side: 'f', w: 5 }, { side: 'b', w: 5 }] }, plaque: PL['坤宁门'], plaqueW: 2.8 });

  // ================= 御花园 =================
  // 东一长街、西一长街经琼苑东门、西门进入御花园
  for (const sx of [1, -1]) {
    wallGate(B, sx * 64, Z(806), 0, { w: 3, kind: 'glazed', wallH: 6.5 });
    palaceWall(B, sx * 66.8, Z(806), sx * 71, Z(806));
  }
  palaceWall(B, -71, Z(806), -71, Z(905)); palaceWall(B, 71, Z(806), 71, Z(905));
  palaceWall(B, -71, Z(905), -9, Z(905)); palaceWall(B, 9, Z(905), 71, Z(905));
  hall(B, { x: 0, z: Z(905), W: 15, D: 7, bays: 3, colH: 4, roof: 'xieshan', front: 'gate', base: { h: 0.8, stairs: [{ side: 'f', w: 4 }, { side: 'b', w: 4 }] } });
  gardenGround(T, -70, Z(905), 70, Z(807));
  compound(B, { x0: -22, z0: Z(886), x1: 22, z1: Z(838), h: 4.5, t: 1.2, gates: [{ side: 's', at: 0, w: 3.5, kind: 'glazed' }] });
  hall(B, { x: 0, z: Z(864), W: 22, D: 14, bays: 5, dBays: 3, colH: 4.6, double: true, roof: 'luding', beasts: 5, base: { h: 1.4, rail: true, stairs: [{ side: 'f', w: 5 }] }, plaque: PL['钦安殿'], plaqueW: 3, id: 'qinandian' });
  for (const sx of [1, -1]) {
    hall(B, { x: sx * 45, z: Z(846), W: 9, D: 9, bays: 3, dBays: 3, colH: 3.6, double: true, roof: 'round', front: 'open', caihua: 'su', dougong: false, base: { h: 1.0, rail: false, stairs: [{ side: 'f', w: 3 }, { side: 'b', w: 3 }, { side: 'l', w: 3 }, { side: 'r', w: 3 }] }, id: 'wanchunting' });
    pavilion(B, { x: sx * 55, z: Z(822), W: 6, D: 6, bays: 1, dBays: 1, colH: 3.2, roof: 'cuanjian', base: { h: 0.6, stairs: [] } });
    wfill(B, -6, -4, 6, 4, 0.6);
    hall(B, { x: sx * 62, z: Z(860), rot: sx > 0 ? E : W_, W: 15, D: 8, bays: 5, colH: 3.6, double: sx < 0, roof: 'xieshan', caihua: 'su', beasts: 3, base: { h: 0.6, stairs: [{ side: 'f', w: 3 }] } });
  }
  // 堆秀山与御景亭
  rockery(B, 42, Z(893), 10, 9);
  pavilion(B, { x: 42, y: 9, z: Z(893), W: 4.6, D: 4.6, bays: 1, dBays: 1, colH: 2.8, roof: 'cuanjian', base: { h: 0.3, stairs: [] }, id: 'duixiushan' });
  hall(B, { x: -42, z: Z(892), W: 10, D: 8, bays: 3, colH: 3.6, double: true, upperH: 3.2, roof: 'xieshan', caihua: 'su', beasts: 3, base: { h: 0.6, stairs: [{ side: 'f', w: 3 }] } });
  // 古柏与连理柏
  TR.add('cypress', -2.2, Z(832), 0, 1.05); TR.add('cypress', 2.2, Z(832), 0, 1.05);
  const gardenFree = (x, z) => {
    const s = 480.5 - z;
    if (Math.abs(x) < 25 && s > 834 && s < 890) return false;
    if (Math.abs(Math.abs(x) - 45) < 8 && Math.abs(s - 846) < 8) return false;
    if (Math.abs(Math.abs(x) - 55) < 10 && Math.abs(s - 822) < 9) return false;
    if (Math.abs(Math.abs(x) - 62) < 7) return false;
    if (Math.abs(Math.abs(x) - 42) < 9 && s > 883) return false;
    if (Math.abs(x) < 5) return false;
    return true;
  };
  TR.scatter((r) => r < 0.75 ? 'cypress' : r < 0.88 ? 'crabapple' : 'magnolia', -68, Z(903), 68, Z(809), 70, 0, gardenFree, 21);
  sg('yuhuayuan', 10, Z(812), 0);
  setAnchor('yuhuayuan', 0, 2, Z(856), 60, { top: 6, base: 0 });
  REG.picks.push({ id: 'yuhuayuan', min: [-70, 0, Z(905)], max: [70, 1.2, Z(807)] });
  sg('qinandian', 12, Z(838), 0);

  // ================= 神武门 =================
  gatePlatform(B, { x: 0, z: Z(960), rot: PI, W: 62, D: 30, H: 10, tunnels: [{ x: 0, w: 5.5, h: 7.5 }, { x: -12, w: 4.5, h: 6.5 }, { x: 12, w: 4.5, h: 6.5 }], id: 'shenwumen', plaque: PL['故宫博物院'], plaqueW: 9 });
  hall(B, { noCollide: true, x: 0, y: 10, z: Z(960), rot: PI, W: 40, D: 14, bays: 7, dBays: 3, colH: 5.6, double: true, roof: 'wudian', beasts: 9, base: { h: 0.6, pad: 2.2, rail: true, stairs: [] }, plaque: PL['神武门'], plaqueW: 1.5, id: 'shenwumen', noMap: true });
  T.rect(-70, Z(908), 70, Z(945), PAVE2);
  sg('shenwumen', 14, Z(918), 0);

  // ================= 东华门、西华门 =================
  for (const sx of [1, -1]) {
    const x = sx * wc, z = Z(190);
    gatePlatform(B, { x, z, rot: sx > 0 ? W_ : E, W: 50, D: 24, H: 10, tunnels: [{ x: 0, w: 5, h: 7 }, { x: -11, w: 4, h: 6 }, { x: 11, w: 4, h: 6 }], doorMat: sx > 0 ? 'door72' : 'door', id: sx > 0 ? 'donghuamen' : 'xihuamen' });
    hall(B, { noCollide: true, x, y: 10, z, rot: sx > 0 ? W_ : E, W: 34, D: 13, bays: 5, dBays: 3, colH: 5.2, double: true, roof: 'wudian', beasts: 9, base: { h: 0.5, pad: 2, rail: true, stairs: [] }, plaque: PL[sx > 0 ? '东华门' : '西华门'], plaqueW: 1.4, id: sx > 0 ? 'donghuamen' : 'xihuamen', noMap: true });
    T.rect(sx * 368, Z(182), sx * 280, Z(198), LANE);
  }
  bridge(B, 322, Z(190), 16, 8, W_, { h: 1.1 });
  sg('donghuamen', 352, Z(176), W_);
  sg('xihuamen', -352, Z(176), E);

  buildEast(ctx, out, sg);
  buildWest(ctx, out, sg);
  buildFillers(ctx);
  buildJingshan(ctx, out, sg);
  buildCity(ctx);

  // ================= 游客路线 =================
  REG.people.push(
    { pts: [[-30, 1007], [30, 1007]], w: 8 },
    { pts: [[0, 1000], [0, 975]], w: 10 },
    { pts: [[0, 925], [0, 840]], w: 40 },
    { pts: [[0, 795], [0, 600]], w: 40 },
    { pts: [[13, 600], [13, 450], [11, 395], [11, 376], [0, 340], [0, 300]], w: 3 },
    { pts: [[-80, 455], [80, 455]], w: 30 },
    { pts: [[0, 290], [0, 190]], w: 70 },
    { pts: [[86, 300], [86, -60]], w: 12 },
    { pts: [[-86, 300], [-86, -60]], w: 12 },
    { pts: [[-22, 160], [22, 160]], w: 8 },
    { pts: [[-100, -88], [100, -88]], w: 14 },
    { pts: [[40, -135], [40, -320]], w: 8 },
    { pts: [[-40, -135], [-40, -320]], w: 8 },
    { pts: [[0, -164], [0, -166]], w: 30 },
    { pts: [[63, -115], [63, -420]], w: 3 },
    { pts: [[-63, -115], [-63, -420]], w: 3 },
    { pts: [[-50, -335], [50, -335], [50, -415], [-50, -415], [-50, -335]], w: 4 },
    { pts: [[0, -430], [0, -470]], w: 30 },
    { pts: [[303, 46], [303, -18]], w: 8 },
    { pts: [[-30, -575], [30, -575]], w: 8 },
    { pts: [[0, -614], [16, -640], [16, -690], [0, -700], [0, -748]], w: 3 },
    { pts: [[216, 372], [216, 336]], w: 4 },
    { pts: [[-212, 372], [-212, 336]], w: 4 },
  );
  return out;
}

// ---------------------------------------------------------------------------
function buildEast(ctx, out, sg) {
  const { B, T, TR, PL } = ctx;
  // 文华殿
  compound(B, { x0: 140, z0: Z(262), x1: 292, z1: Z(128), gates: [{ side: 's', at: 216, w: 26, kind: 'none' }, { side: 'e', at: Z(190), w: 3.5, kind: 'plain' }] });
  T.rect(140, Z(262), 292, Z(128), PAVE);
  hall(B, { x: 216, z: Z(128), W: 24, D: 10, bays: 5, colH: 4.6, roof: 'xieshan', front: 'gate', caihua: 'xuanzi', beasts: 5, base: { h: 1.0, stairs: [{ side: 'f', w: 5 }, { side: 'b', w: 5 }] } });
  hall(B, { x: 216, z: Z(170), W: 34, D: 16, bays: 5, dBays: 3, colH: 5.2, roof: 'xieshan', beasts: 7, base: { h: 1.2, rail: true, stairs: [{ side: 'f', w: 5 }] }, plaque: PL['文华殿'], plaqueW: 3.4, id: 'wenhuadian' });
  rowHouse(B, { x: 216, z: Z(193), rot: W_, W: 12, D: 6, bays: 3, colH: 3.6, front: 'open', roof: 'xuanshan' });
  hall(B, { x: 216, z: Z(213), W: 30, D: 13, bays: 5, colH: 4.6, roof: 'xieshan', beasts: 5, base: { h: 1.0, stairs: [] } });
  for (const sx of [1, -1]) rowHouse(B, { x: 216 + sx * 62, z: Z(200), rot: sx > 0 ? E : W_, W: 50, D: 7, bays: 11, colH: 3.6 });
  TR.add('huai', 186, Z(150)); TR.add('huai', 246, Z(150));
  sg('wenhuadian', 205, Z(136), 0);
  // 文渊阁（面阔六间，黑琉璃瓦绿剪边）
  bridge(B, 216, Z(270), 14, 5, 0, { h: 1.0 });
  bridge(B, 140, Z(270), 14, 5, 0, { h: 1.0 });
  bridge(B, 296, Z(270), 14, 5, 0, { h: 1.0 });
  hall(B, { x: 216, z: Z(294), W: 33, D: 13, bays: 6, dBays: 3, colH: 4.6, double: true, upperH: 3.6, roof: 'xieshan', tile: C.black, beasts: 3, caihua: 'su', base: { h: 0.9, rail: true, stairs: [{ side: 'f', w: 4 }] }, plaque: PL['文渊阁'], plaqueW: 3, id: 'wenyuange' });
  // 南三所（绿琉璃瓦）
  for (let i = 0; i < 3; i++) {
    const x0 = 242 + i * 38, cx = x0 + 18;
    compound(B, { x0, z0: Z(392), x1: x0 + 36, z1: Z(302), h: 5.5, t: 1.2, tile: C.green, gates: [{ side: 's', at: cx, w: 3, kind: 'glazed' }] });
    hall(B, { x: cx, z: Z(328), W: 22, D: 9, bays: 5, colH: 3.8, roof: 'xieshan', tile: C.green, caihua: 'xuanzi', beasts: 3, base: { h: 0.7, stairs: [{ side: 'f', w: 3 }] }, id: 'nansansuo' });
    hall(B, { x: cx, z: Z(362), W: 22, D: 9, bays: 5, colH: 3.8, roof: 'yingshan', tile: C.green, caihua: 'xuanzi', base: { h: 0.6, stairs: [] }, id: 'nansansuo' });
    TR.add('huai', cx - 9, Z(345), 0, 0.8);
  }
  sg('nansansuo', 258, Z(296), 0);
  // 箭亭
  T.rect(128, Z(398), 236, Z(458), PAVE2);
  hall(B, { x: 186, z: Z(428), W: 30, D: 17, bays: 5, dBays: 3, colH: 5.2, roof: 'xieshan', front: 'open', beasts: 5, base: { h: 1.0, stairs: [{ side: 'f', w: 5 }, { side: 'b', w: 5 }] }, id: 'jianting' });
  sg('jianting', 168, Z(408), 0);
  // 奉先殿
  compound(B, { x0: 136, z0: Z(594), x1: 222, z1: Z(466), gates: [{ side: 's', at: 179, w: 3.5, kind: 'glazed' }] });
  hall(B, { x: 179, z: Z(505), W: 40, D: 18, bays: 7, dBays: 3, colH: 5.4, double: true, roof: 'wudian', beasts: 7, base: { h: 1.4, rail: true, stairs: [{ side: 'f', w: 5 }] }, id: 'fengxiandian' });
  rowHouse(B, { x: 179, z: Z(528), rot: W_, W: 10, D: 6, bays: 3, colH: 3.6, front: 'open', roof: 'xuanshan' });
  hall(B, { x: 179, z: Z(552), W: 40, D: 14, bays: 9, colH: 4.6, roof: 'wudian', beasts: 5, base: { h: 1.0, stairs: [] }, id: 'fengxiandian' });
  sg('fengxiandian', 166, Z(462), 0);
  // 斋宫、毓庆宫
  sixPalace(ctx, null, '斋宫', 66, 132, 600, 660, { trees: 'huai' });
  sixPalace(ctx, null, '毓庆宫', 138, 208, 600, 660, { trees: 'huai' });
  // 东六宫
  const east = [['jingrengong', '景仁宫', 66, 132, 665, 718], ['chengqiangong', '承乾宫', 66, 132, 722, 775], ['zhongcuigong', '钟粹宫', 66, 132, 779, 832],
    ['yanxigong', '延禧宫', 138, 208, 665, 718], ['yonghegong', '永和宫', 138, 208, 722, 775], ['jingyanggong', '景阳宫', 138, 208, 779, 832]];
  for (const [id, name, x0, x1, s0, s1] of east) sixPalace(ctx, id, name, x0, x1, s0, s1, { roof: id === 'jingyanggong' ? 'wudian' : 'xieshan', crystal: id === 'yanxigong' });
  // 乾东五所
  for (let i = 0; i < 5; i++) {
    const x0 = 66 + i * 28.4, cx = x0 + 14;
    compound(B, { x0, z0: Z(905), x1: x0 + 27, z1: Z(838), h: 5.5, t: 1.1, gates: [{ side: 's', at: cx, w: 2.6, kind: 'plain' }] });
    rowHouse(B, { x: cx, z: Z(858), W: 20, D: 8, bays: 5, colH: 3.4, roof: 'xieshan', base: { h: 0.6, stairs: [{ side: 'f', w: 3 }] } });
    rowHouse(B, { x: cx, z: Z(888), W: 20, D: 7, bays: 5, colH: 3.2 });
  }
  T.rect(60, Z(594), 66, Z(908), LANE); T.rect(132, Z(594), 138, Z(908), LANE);

  // ================= 宁寿宫区 =================
  const nx = 303;
  P.nineDragonWall(B, nx, Z(428), 0);
  setAnchor('jiulongbi', nx, 3, Z(428), 22, { top: 6, base: 0 });
  REG.picks.push({ id: 'jiulongbi', min: [nx - 15, 0, Z(428) - 1.5], max: [nx + 15, 6, Z(428) + 1.5] });
  sg('jiulongbi', nx + 18, Z(418), 0);
  compound(B, { x0: 242, z0: Z(945), x1: 365, z1: Z(440), h: 7, gates: [{ side: 's', at: nx, w: 5, kind: 'glazed' }, { side: 'w', at: Z(470), w: 3.5, kind: 'glazed' }, { side: 'n', at: nx, w: 3, kind: 'plain' }] });
  T.rect(242, Z(945), 365, Z(440), PAVE);
  hall(B, { x: nx, z: Z(478), W: 26, D: 11, bays: 5, colH: 4.6, roof: 'xieshan', front: 'gate', beasts: 7, base: { h: 1.2, rail: true, stairs: [{ side: 'f', w: 5 }, { side: 'b', w: 5 }] } });
  palaceWall(B, 262, Z(478), 289, Z(478)); palaceWall(B, 317, Z(478), 344, Z(478));
  palaceWall(B, 262, Z(478), 262, Z(592)); palaceWall(B, 344, Z(478), 344, Z(592));
  for (const sx of [1, -1]) P.lion(B, nx + sx * 10, 0, Z(466), 0, { mat: 'gold', male: sx > 0, scale: 0.75 });
  hall(B, { x: nx, z: Z(527), W: 44, D: 21, bays: 9, dBays: 5, colH: 6, double: true, roof: 'wudian', beasts: 9, base: { h: 2.2, pad: 3, sumeru: true, rail: true, stairs: [{ side: 'f', w: 7, yudao: true }] }, plaque: PL['皇极殿'], plaqueW: 4.4, id: 'huangjidian' });
  hall(B, { x: nx, z: Z(570), W: 36, D: 15, bays: 7, colH: 5, roof: 'xieshan', beasts: 7, base: { h: 1.4, rail: true, stairs: [{ side: 'f', w: 5 }] }, plaque: PL['宁寿宫'], plaqueW: 3.4, id: 'ningshougong' });
  sg('huangjidian', nx + 16, Z(498), 0);
  // 北部三路
  palaceWall(B, 244, Z(594), 363, Z(594));
  palaceWall(B, 282, Z(594), 282, Z(940)); palaceWall(B, 324, Z(594), 324, Z(900));
  wallGate(B, 263, Z(594), 0, { w: 3, kind: 'glazed' });
  wallGate(B, nx, Z(594), 0, { w: 3.5, kind: 'glazed' });
  wallGate(B, 343, Z(594), 0, { w: 3, kind: 'glazed' });
  // 西路：宁寿宫花园
  T.rect(244, Z(940), 282, Z(596), 0x948f80); T.grass(246, Z(930), 280, Z(600), 0.35);
  hall(B, { x: 263, z: Z(612), W: 13, D: 8, bays: 3, colH: 3.6, front: 'open', roof: 'xieshan', caihua: 'su', base: { h: 0.5, stairs: [] }, id: 'qianlonghuayuan' });
  pavilion(B, { x: 263, z: Z(630), W: 6, D: 6, bays: 1, dBays: 1, colH: 3.2, roof: 'xieshan', base: { h: 0.6, stairs: [] }, id: 'qianlonghuayuan' });
  hall(B, { x: 263, z: Z(662), W: 18, D: 8, bays: 5, colH: 3.6, roof: 'yingshan', caihua: 'su', base: { h: 0.5, stairs: [{ side: 'f', w: 3 }] } });
  hall(B, { x: 263, z: Z(700), W: 18, D: 9, bays: 5, colH: 3.6, double: true, upperH: 3, roof: 'xieshan', caihua: 'su', base: { h: 0.6, stairs: [{ side: 'f', w: 3 }] } });
  hall(B, { x: 263, z: Z(740), W: 16, D: 16, bays: 5, dBays: 5, colH: 4, double: true, upperH: 3.6, roof: 'cuanjian', caihua: 'su', beasts: 5, base: { h: 1.0, stairs: [{ side: 'f', w: 3 }] } });
  rowHouse(B, { x: 263, z: Z(772), W: 30, D: 8, bays: 9, colH: 3.4, rot: 0 });
  rockery(B, 256, Z(683), 4, 4); rockery(B, 270, Z(720), 4.5, 5);
  TR.scatter((r) => r < 0.6 ? 'pine' : 'cypress', 246, Z(790), 280, Z(600), 26, 0, (x, z) => Math.abs(x - 263) > 9.5, 31);
  // 中路
  hall(B, { x: nx, z: Z(620), W: 30, D: 13, bays: 7, colH: 4.6, roof: 'xieshan', beasts: 5, base: { h: 1.0, stairs: [{ side: 'f', w: 4 }] } });
  hall(B, { x: nx, z: Z(658), W: 30, D: 13, bays: 7, colH: 4.6, roof: 'xieshan', beasts: 5, base: { h: 1.0, stairs: [{ side: 'f', w: 4 }] }, plaque: PL['乐寿堂'], plaqueW: 3, id: 'leshoutang' });
  hall(B, { x: nx, z: Z(694), W: 26, D: 10, bays: 5, colH: 4.2, roof: 'xieshan', beasts: 3, base: { h: 0.8, stairs: [{ side: 'f', w: 4 }] } });
  hall(B, { x: nx, z: Z(735), W: 26, D: 10, bays: 5, colH: 4.2, double: true, upperH: 3.4, roof: 'xieshan', beasts: 5, base: { h: 0.8, stairs: [{ side: 'f', w: 4 }] } });
  hall(B, { x: nx, z: Z(800), W: 22, D: 10, bays: 5, colH: 4.2, roof: 'xieshan', base: { h: 0.8, stairs: [{ side: 'f', w: 4 }] } });
  for (const s of [640, 676, 715]) for (const sx of [1, -1]) TR.add('huai', nx + sx * 12, Z(s), 0, 0.75);
  sg('leshoutang', nx + 12, Z(640), 0);
  // 东路：畅音阁、阅是楼
  hall(B, { x: 343, z: Z(640), rot: PI, W: 17, D: 15, bays: 3, dBays: 3, colH: 5, double: true, upperH: 7, roof: 'xieshan', beasts: 5, front: 'open', base: { h: 1.2, stairs: [{ side: 'f', w: 5 }] }, plaque: PL['畅音阁'], plaqueW: 3, id: 'changyinge' });
  hall(B, { x: 343, z: Z(676), W: 22, D: 10, bays: 5, colH: 4.2, double: true, upperH: 3.6, roof: 'xieshan', beasts: 5, base: { h: 0.8, stairs: [{ side: 'f', w: 4 }] }, id: 'changyinge' });
  for (const s of [720, 760, 800, 840]) rowHouse(B, { x: 343, z: Z(s), W: 30, D: 8, bays: 7, colH: 3.4 });
  sg('changyinge', 333, Z(655), PI);
  // 珍妃井与贞顺门
  B.at(nx - 6, 0, Z(915), 0);
  B.cyl('marble', 0, 0, 0, 0.75, 0.7, 0.5, 12, { col: rgb(C.stone), cap: false });
  B.cyl('paint', 0, 0.48, 0, 0.55, 0.55, 0.05, 12, { col: rgb(0x2a2a2a), cap: true });
  wblock(B, -0.8, -0.8, 0.8, 0.8);
  setAnchor('zhenfeijing', nx - 6, 1, Z(915), 6, { top: 2.5, base: 0 });
  REG.picks.push({ id: 'zhenfeijing', min: [nx - 7, 0, Z(915) - 1], max: [nx - 5, 1.2, Z(915) + 1] });
  sg('zhenfeijing', nx - 2, Z(908), 0);
  T.rect(212, Z(400), 240, Z(950), LANE);
}

// ---------------------------------------------------------------------------
function buildWest(ctx, out, sg) {
  const { B, T, TR, PL } = ctx;
  // 武英殿
  compound(B, { x0: -284, z0: Z(262), x1: -140, z1: Z(128), gates: [{ side: 's', at: -212, w: 26, kind: 'none' }, { side: 'w', at: Z(190), w: 3.5, kind: 'glazed' }] });
  T.rect(-284, Z(262), -140, Z(128), PAVE);
  hall(B, { x: -212, z: Z(128), W: 24, D: 10, bays: 5, colH: 4.6, roof: 'xieshan', front: 'gate', caihua: 'xuanzi', beasts: 5, base: { h: 1.0, stairs: [{ side: 'f', w: 5 }, { side: 'b', w: 5 }] } });
  hall(B, { x: -212, z: Z(170), W: 34, D: 16, bays: 5, dBays: 3, colH: 5.2, roof: 'xieshan', beasts: 7, base: { h: 1.2, rail: true, stairs: [{ side: 'f', w: 5 }] }, plaque: PL['武英殿'], plaqueW: 3.4, id: 'wuyingdian' });
  rowHouse(B, { x: -212, z: Z(193), rot: W_, W: 12, D: 6, bays: 3, colH: 3.6, front: 'open', roof: 'xuanshan' });
  hall(B, { x: -212, z: Z(213), W: 30, D: 13, bays: 5, colH: 4.6, roof: 'xieshan', beasts: 5, base: { h: 1.0, stairs: [] } });
  for (const sx of [1, -1]) rowHouse(B, { x: -212 + sx * 58, z: Z(200), rot: sx > 0 ? E : W_, W: 50, D: 7, bays: 11, colH: 3.6 });
  T.rect(-368, Z(182), -284, Z(198), LANE);
  TR.add('huai', -242, Z(150)); TR.add('huai', -182, Z(150));
  sg('wuyingdian', -224, Z(136), 0);
  // 断虹桥与十八槐
  bridge(B, -150, Z(270), 18, 9, 0, { h: 1.6, lionPosts: true });
  setAnchor('duanhongqiao', -150, 2, Z(270), 14, { top: 4, base: 0 });
  REG.picks.push({ id: 'duanhongqiao', min: [-155, 0, Z(270) - 9], max: [-145, 3, Z(270) + 9] });
  bridge(B, -300, Z(270), 14, 6, 0, { h: 1.1 });
  for (let i = 0; i < 18; i++) TR.add('huai', -176 + (i % 6) * 9 + (i % 2) * 2, Z(288 + Math.floor(i / 6) * 15), 0, 1.05);
  T.grass(-180, Z(330), -124, Z(282), 0.5);
  sg('duanhongqiao', -140, Z(258), 0);
  // 内务府（今故宫办公区）
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) rowHouse(B, { x: -300 + j * 52, z: Z(300 + i * 28), W: 40, D: 8, bays: 9, colH: 3.4, tile: C.grey, caihua: 'xuanzi' });
  // 慈宁宫花园与慈宁宫
  compound(B, { x0: -325, z0: Z(455), x1: -215, z1: Z(400), h: 6, gates: [{ side: 'e', at: Z(430), w: 3, kind: 'glazed' }] });
  T.rect(-325, Z(455), -215, Z(400), 0x8f8a78); T.grass(-322, Z(452), -218, Z(403), 0.55);
  pavilion(B, { x: -270, z: Z(427), W: 6, D: 6, bays: 1, dBays: 1, colH: 3.2, roof: 'xieshan', base: { h: 0.5, stairs: [] }, id: 'cininghuayuan' });
  wfill(B, -6, -5, 6, 5, 0.5);
  TR.scatter((r) => r < 0.5 ? 'cypress' : r < 0.8 ? 'huai' : 'magnolia', -322, Z(452), -218, Z(403), 20, 0, (x, z) => Math.hypot(x + 270, z - Z(427)) > 14, 41);
  compound(B, { x0: -325, z0: Z(596), x1: -215, z1: Z(458), gates: [{ side: 's', at: -270, w: 26, kind: 'none' }] });
  T.rect(-325, Z(596), -215, Z(458), PAVE);
  hall(B, { x: -270, z: Z(460), W: 26, D: 10, bays: 5, colH: 4.6, roof: 'xieshan', front: 'gate', beasts: 7, base: { h: 1.2, stairs: [{ side: 'f', w: 5 }, { side: 'b', w: 5 }] } });
  hall(B, { x: -270, z: Z(518), W: 44, D: 19, bays: 7, dBays: 5, colH: 5.6, double: true, roof: 'xieshan', beasts: 7, base: { h: 1.6, rail: true, stairs: [{ side: 'f', w: 6, yudao: true }] }, plaque: PL['慈宁宫'], plaqueW: 4, id: 'cininggong' });
  hall(B, { x: -270, z: Z(568), W: 36, D: 14, bays: 7, colH: 4.8, roof: 'xieshan', beasts: 5, base: { h: 1.0, stairs: [{ side: 'f', w: 4 }] } });
  for (const sx of [1, -1]) rowHouse(B, { x: -270 + sx * 49, z: Z(520), rot: sx > 0 ? E : W_, W: 70, D: 7, bays: 15, colH: 3.6 });
  sg('cininggong', -258, Z(472), 0);
  // 寿康宫、寿安宫、英华殿
  compound(B, { x0: -330, z0: Z(668), x1: -235, z1: Z(604), gates: [{ side: 's', at: -282, w: 3, kind: 'glazed' }] });
  hall(B, { x: -282, z: Z(640), W: 30, D: 12, bays: 5, colH: 4.6, roof: 'xieshan', beasts: 5, base: { h: 1.0, stairs: [{ side: 'f', w: 4 }] }, plaque: PL['寿康宫'], plaqueW: 3, id: 'shoukanggong' });
  TR.add('huai', -296, Z(615)); TR.add('huai', -268, Z(615));
  compound(B, { x0: -330, z0: Z(760), x1: -235, z1: Z(680), gates: [{ side: 's', at: -282, w: 3, kind: 'glazed' }] });
  hall(B, { x: -282, z: Z(722), W: 30, D: 12, bays: 5, colH: 4.6, roof: 'xieshan', beasts: 5, base: { h: 1.0, stairs: [{ side: 'f', w: 4 }] } });
  TR.scatter('huai', -326, Z(756), -238, Z(684), 6, 0, (x, z) => Math.abs(x + 282) > 18, 47);
  compound(B, { x0: -330, z0: Z(938), x1: -250, z1: Z(860), gates: [{ side: 's', at: -290, w: 3, kind: 'glazed' }] });
  hall(B, { x: -290, z: Z(902), W: 30, D: 13, bays: 5, colH: 4.6, roof: 'xieshan', beasts: 5, base: { h: 1.0, stairs: [{ side: 'f', w: 4 }] } });
  TR.scatter('ginkgo', -326, Z(934), -254, Z(864), 6, 0, (x, z) => Math.abs(x + 290) > 18 || 480.5 - z < 885, 49);
  // 雨花阁（鎏金铜瓦）
  hall(B, { x: -224, z: Z(705), W: 12, D: 12, bays: 3, dBays: 3, colH: 4.2, double: true, upperH: 5.2, roof: 'cuanjian', tile: 0xd9a63c, beasts: 0, riseK: 0.9, base: { h: 1.0, stairs: [{ side: 'f', w: 3 }] }, id: 'yuhuage' });
  // 建福宫花园
  compound(B, { x0: -248, z0: Z(905), x1: -210, z1: Z(818), h: 5.5, gates: [{ side: 's', at: -229, w: 3, kind: 'glazed' }] });
  hall(B, { x: -229, z: Z(870), W: 14, D: 14, bays: 3, dBays: 3, colH: 4, double: true, upperH: 3.4, roof: 'xieshan', caihua: 'su', base: { h: 0.8, stairs: [{ side: 'f', w: 3 }] }, id: 'jianfugong' });
  pavilion(B, { x: -236, z: Z(838), W: 5, D: 5, bays: 1, dBays: 1, colH: 3, roof: 'poly', sides: 8, base: { h: 0.5, stairs: [] }, id: 'jianfugong' });
  TR.scatter((r) => r < 0.5 ? 'pine' : 'crabapple', -246, Z(903), -212, Z(820), 10, 0, (x, z) => Math.hypot(x + 229, z - Z(870)) > 11 && Math.hypot(x + 236, z - Z(838)) > 5, 51);
  // 养心殿
  compound(B, { x0: -152, z0: Z(670), x1: -70, z1: Z(600), h: 6.5, gates: [{ side: 'e', at: Z(614), w: 3.2, kind: 'glazed' }] });
  T.rect(-152, Z(670), -70, Z(600), PAVE);
  const yxd = hall(B, { x: -112, z: Z(632), W: 36, D: 13, bays: 7, dBays: 3, colH: 4.8, roof: 'xieshan', beasts: 7, base: { h: 1.0, pad: 1.6, rail: false, stairs: [{ side: 'f', w: 5 }] }, enter: true, openBays: 1, plaque: PL['养心殿'], plaqueW: 3, id: 'yangxindian' });
  furnish(B, 'yangxindian', yxd, PL);
  out.interiors.push({ id: 'yangxindian', ...yxd });
  rowHouse(B, { x: -112, z: Z(647), rot: W_, W: 6, D: 5, bays: 1, colH: 3.6, roof: 'xuanshan' });
  hall(B, { x: -112, z: Z(658), W: 30, D: 9, bays: 5, colH: 4, roof: 'xieshan', beasts: 5, base: { h: 0.8, stairs: [] } });
  sg('yangxindian', -64, Z(616), W_);
  // 西六宫
  const west = [['yongshougong', '永寿宫', -132, -66, 674, 724], ['yikungong', '翊坤宫', -132, -66, 728, 778], ['chuxiugong', '储秀宫', -132, -66, 782, 832],
    ['taijidian', '太极殿', -208, -138, 674, 724], ['changchungong', '长春宫', -208, -138, 728, 778], ['xianfugong', '咸福宫', -208, -138, 782, 832]];
  for (const [id, name, x0, x1, s0, s1] of west) sixPalace(ctx, id, name, x0, x1, s0, s1, { roof: id === 'xianfugong' ? 'wudian' : 'xieshan' });
  // 重华宫（乾西五所）
  for (let i = 0; i < 4; i++) {
    const x0 = -208 + i * 35.5, cx = x0 + 17;
    compound(B, { x0, z0: Z(905), x1: x0 + 34, z1: Z(838), h: 5.5, t: 1.1, gates: [{ side: 's', at: cx, w: 2.6, kind: 'plain' }] });
    hall(B, { x: cx, z: Z(862), W: 24, D: 9, bays: 5, colH: 3.8, roof: 'xieshan', beasts: 3, base: { h: 0.7, stairs: [{ side: 'f', w: 3 }] } });
    rowHouse(B, { x: cx, z: Z(890), W: 24, D: 7, bays: 5, colH: 3.2 });
  }
  T.rect(-66, Z(594), -60, Z(908), LANE); T.rect(-138, Z(594), -132, Z(908), LANE);
}

// ---------------------------------------------------------------------------
/** 次要院落与值房：让宫城不至于空旷（位置为示意） */
function buildFillers(ctx) {
  const { B, T, TR } = ctx;
  // 东南：銮仪卫一带
  rowHouse(B, { x: 352, z: Z(65), rot: E, W: 60, D: 8, bays: 13, colH: 3.6 });
  rowHouse(B, { x: 352, z: Z(135), rot: E, W: 50, D: 8, bays: 11, colH: 3.6 });
  rowHouse(B, { x: 344, z: Z(15), W: 34, D: 7, bays: 7, colH: 3.4, rot: PI });
  // 东华门内北侧：上驷院
  compound(B, { x0: 330, z0: Z(292), x1: 366, z1: Z(205), h: 5.5, gates: [{ side: 'w', at: Z(230), w: 3, kind: 'plain' }] });
  rowHouse(B, { x: 354, z: Z(248), rot: E, W: 60, D: 8, bays: 13, colH: 3.4, tile: C.grey });
  // 文渊阁西北：值房
  compound(B, { x0: 140, z0: Z(392), x1: 188, z1: Z(306), h: 5.5, gates: [{ side: 's', at: 164, w: 3, kind: 'plain' }] });
  rowHouse(B, { x: 164, z: Z(330), W: 36, D: 8, bays: 9, colH: 3.4 });
  rowHouse(B, { x: 164, z: Z(372), W: 36, D: 8, bays: 9, colH: 3.4 });
  // 箭亭东侧
  rowHouse(B, { x: 252, z: Z(428), rot: E, W: 40, D: 7, bays: 9, colH: 3.4 });
  // 西南：南熏殿
  compound(B, { x0: -362, z0: Z(112), x1: -296, z1: Z(26), h: 6, gates: [{ side: 's', at: -329, w: 3, kind: 'glazed' }] });
  hall(B, { x: -329, z: Z(72), W: 26, D: 12, bays: 5, colH: 4.6, roof: 'xieshan', beasts: 5, base: { h: 1.0, stairs: [{ side: 'f', w: 4 }] } });
  TR.add('huai', -345, Z(45)); TR.add('huai', -313, Z(45));
  // 西华门内两侧
  rowHouse(B, { x: -352, z: Z(150), rot: W_, W: 50, D: 8, bays: 11, colH: 3.4 });
  rowHouse(B, { x: -352, z: Z(232), rot: W_, W: 50, D: 8, bays: 11, colH: 3.4 });
  // 造办处一带
  compound(B, { x0: -206, z0: Z(442), x1: -124, z1: Z(296), h: 5.5, gates: [{ side: 's', at: -165, w: 3, kind: 'plain' }] });
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) rowHouse(B, { x: -184 + j * 40, z: Z(318 + i * 42), W: 30, D: 8, bays: 7, colH: 3.3, tile: C.grey });
  // 慈宁宫东侧
  compound(B, { x0: -206, z0: Z(592), x1: -124, z1: Z(452), h: 6, gates: [{ side: 'e', at: Z(568), w: 3, kind: 'glazed' }] });
  hall(B, { x: -165, z: Z(500), W: 30, D: 12, bays: 5, colH: 4.4, roof: 'xieshan', beasts: 3, base: { h: 0.9, stairs: [{ side: 'f', w: 4 }] } });
  rowHouse(B, { x: -165, z: Z(560), W: 40, D: 8, bays: 9, colH: 3.4 });
  TR.add('huai', -185, Z(470)); TR.add('huai', -145, Z(470));
  // 西北：寿安宫与英华殿之间
  compound(B, { x0: -330, z0: Z(852), x1: -250, z1: Z(766), h: 6, gates: [{ side: 's', at: -290, w: 3, kind: 'glazed' }] });
  hall(B, { x: -290, z: Z(812), W: 30, D: 12, bays: 5, colH: 4.4, roof: 'xieshan', beasts: 3, base: { h: 0.9, stairs: [{ side: 'f', w: 4 }] } });
  TR.add('cypress', -310, Z(785)); TR.add('cypress', -270, Z(785));
  T.rect(-330, Z(852), -250, Z(766), 0xa9a59c);
}

// ---------------------------------------------------------------------------
function buildJingshan(ctx, out, sg) {
  const { B, T, TR } = ctx;
  const peaks = [[0, -760, 45, 62, 52], [-75, -752, 32, 46, 40], [75, -752, 32, 46, 40], [-145, -742, 21, 40, 36], [145, -742, 21, 40, 36]];
  const f = (x, z) => {
    let h = 0;
    for (const [px, pz, H, sx, sz] of peaks) {
      // 峰顶留出平台，亭子台基与台阶落在平地上
      const r = Math.hypot(x - px, z - pz);
      const d = (Math.max(0, r - 13) / sx) ** 2 * 1.6 + 0 * sz;
      h = Math.max(h, H * Math.exp(-d * 1.1));
    }
    const edge = Math.min(1, Math.max(0, (225 - Math.abs(x)) / 25)) * Math.min(1, Math.max(0, (z + 880) / 30)) * Math.min(1, Math.max(0, (-640 - z) / 30));
    return Math.max(0, h * edge - 0.3);
  };
  ctx.hill = T.hill(-240, -890, 240, -625, f, 5);
  T.ctx.globalAlpha = 1;
  T.rect(-245, -895, 245, -615, SOIL); T.grass(-245, -895, 245, -615, 0.8);
  // 五亭
  const top = (x, z) => f(x, z) + 0.2;
  hall(B, { x: 0, y: top(0, -760) - 0.4, z: -760, W: 14, D: 14, bays: 5, dBays: 5, colH: 5, double: true, upperH: 4.2, roof: 'cuanjian', front: 'open', beasts: 7, caihua: 'xuanzi', base: { h: 1.2, rail: true, stairs: [{ side: 'f', w: 4 }, { side: 'b', w: 4 }, { side: 'l', w: 4 }, { side: 'r', w: 4 }] }, id: 'jingshan' });
  for (const sx of [1, -1]) {
    hall(B, { x: sx * 75, y: top(sx * 75, -752) - 0.4, z: -752, W: 8, D: 8, bays: 3, dBays: 3, colH: 3.8, double: true, roof: 'poly', sides: 8, front: 'open', caihua: 'xuanzi', tile: C.green, base: { h: 0.8, stairs: [{ side: 'f', w: 3 }] } });
    hall(B, { x: sx * 145, y: top(sx * 145, -742) - 0.4, z: -742, W: 7, D: 7, bays: 3, dBays: 3, colH: 3.6, double: true, roof: 'round', front: 'open', caihua: 'xuanzi', tile: C.blue, base: { h: 0.8, stairs: [{ side: 'f', w: 3 }] } });
  }
  hall(B, { x: 0, z: -660, W: 26, D: 12, bays: 5, colH: 5, double: true, upperH: 3.6, roof: 'xieshan', beasts: 5, base: { h: 1.0, rail: true, stairs: [{ side: 'f', w: 4 }] } });
  compound(B, { x0: -245, z0: -895, x1: 245, z1: -612, h: 6, gates: [{ side: 's', at: 0, w: 6, kind: 'glazed' }] });
  TR.scatter((r) => r < 0.55 ? 'pine' : r < 0.85 ? 'cypress' : 'huai', -238, -888, 238, -616, 380, f, (x, z) => {
    if (Math.abs(x) < 5 && z > -760) return false;
    for (const [px, pz] of peaks) if (Math.hypot(x - px, z - pz) < 12) return false;
    if (Math.abs(x) < 20 && Math.abs(z + 660) < 12) return false;
    return true;
  }, 61);
  sg('jingshan', 9, -608, 0);
}

// ---------------------------------------------------------------------------
function buildCity(ctx) {
  const { B, T, TR, quality } = ctx;
  // 护城河外沿街树
  for (let z = -540; z <= 540; z += 14) for (const sx of [1, -1]) TR.add(z % 28 === 0 ? 'willow' : 'huai', sx * 452, z + 3, 0, 0.9);
  for (let x = -440; x <= 440; x += 14) { if (Math.abs(x) > 30) TR.add(x % 28 === 0 ? 'willow' : 'huai', x, -556, 0, 0.9); }
  for (let x = -440; x <= 440; x += 16) { if (Math.abs(x) > 90) TR.add('willow', x, 556, 0, 0.85); }
  // 胡同四合院（简化）
  const cols = quality.hutong;
  const saved = B.detail; B.detail = 0.35;
  let s = 101;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (const sx of [1, -1]) {
    for (let ci = 0; ci < cols; ci++) for (let row = 0; row < 24; row++) {
      const cx = sx * (500 + ci * 44), cz = -500 + row * 43;
      if (r() < 0.08) { TR.add('huai', cx, cz, 0, 1.1); TR.add('huai', cx + 8, cz + 6, 0, 1.0); continue; }
      courtyard(B, cx, cz, 34 + r() * 4, 32 + r() * 4);
      if (r() < 0.6) TR.add(r() < 0.5 ? 'huai' : 'crabapple', cx + (r() - 0.5) * 8, cz + (r() - 0.5) * 6, 0, 0.8);
      T.rect(cx - 19, cz - 18, cx + 19, cz + 18, 0x8d8a83);
    }
  }
  B.detail = saved;
}

function courtyard(B, x, z, w, d) {
  const tile = C.grey, wall = rgb(0x8e8a84);
  const house = (hx, hz, rot, W, D, h) => {
    B.at(hx, 0, hz, rot);
    B.box('brick', 0, 0, 0, W, h, D, { col: wall, skip: 'b' });
    B.box('paint', 0, 0.9, D / 2 + 0.01, W - 1.2, h - 1.3, 0.05, { col: rgb(0x6e2a1e), skip: 'b' });
    roof(B, { type: 'yingshan', hx: W / 2 + 0.3, hz: D / 2 + 0.6, y0: h, rise: D * 0.32, color: tile, scale: 0.4, gableFrom: h - 0.2, gableX: W / 2, gableZ: D / 2, gableMat: 'brick', gableColor: 0x8e8a84 });
    if (REG.col) wblock(B, -W / 2, -D / 2, W / 2, D / 2);
  };
  house(x, z - d / 2 + 4, 0, w - 2, 7, 3.6);
  house(x, z + d / 2 - 3.5, PI, w - 6, 6, 3.2);
  house(x - w / 2 + 3.5, z, W_, d - 16, 6, 3.2);
  house(x + w / 2 - 3.5, z, E, d - 16, 6, 3.2);
}

// ---------------------------------------------------------------------------
/** 东西六宫等标准院落 */
function sixPalace(ctx, id, name, x0, x1, s0, s1, o = {}) {
  const { B, T, TR, PL } = ctx;
  const cx = (x0 + x1) / 2, L = s1 - s0;
  compound(B, { x0, z0: Z(s1), x1, z1: Z(s0), h: 6, t: 1.2, gates: [{ side: 's', at: cx, w: 3, kind: 'glazed' }] });
  T.rect(x0, Z(s1), x1, Z(s0), PAVE);
  const W = Math.min(26, x1 - x0 - 16);
  if (o.crystal) {
    // 灵沼轩：未完工的西洋式水晶宫
    B.at(cx, 0, Z(s0 + L * 0.55), 0);
    B.box('marble', 0, 0, 0, 24, 2.4, 18, { col: rgb(0xb8b4aa), skip: 'b' });
    for (const [px, pz] of [[-10, -7], [10, -7], [-10, 7], [10, 7]]) {
      B.box('marble', px, 2.4, pz, 4, 4, 4, { col: rgb(0xc8c4ba), skip: 'b' });
      B.box('glaze', px, 6.4, pz, 4.4, 0.4, 4.4, { col: rgb(0xc8c4ba), skip: 'b' });
    }
    for (let i = -2; i <= 2; i++) for (const pz of [-6, 6]) B.box('bronze', i * 4, 2.4, pz, 0.25, 7, 0.25, { col: rgb(0x55585c) });
    for (let i = -2; i <= 2; i++) B.box('bronze', i * 4, 9.2, 0, 0.25, 0.25, 12, { col: rgb(0x55585c) });
    for (const pz of [-6, 6]) B.box('bronze', 0, 9.2, pz, 16.2, 0.25, 0.25, { col: rgb(0x55585c) });
    wblock(B, -12, -9, 12, 9);
    if (id) {
      const a = B.P(-12, 0, -9), b = B.P(12, 10, 9);
      addPick(id, [Math.min(a[0], b[0]), 0, Math.min(a[2], b[2])], [Math.max(a[0], b[0]), 10, Math.max(a[2], b[2])]);
    }
    REG.map.rects.push({ x0: cx - 12, z0: Z(s0 + L * 0.55) - 9, x1: cx + 12, z1: Z(s0 + L * 0.55) + 9, color: 0xb8b4aa, kind: 'hall' });
  } else {
    hall(B, { x: cx, z: Z(s0 + L * 0.56), W, D: 12, bays: 5, dBays: 3, colH: 4.4, roof: o.roof || 'xieshan', caihua: 'xuanzi', beasts: 5, base: { h: 0.9, pad: 1.4, stairs: [{ side: 'f', w: 4 }] }, plaque: PL[name], plaqueW: 2.6, id });
  }
  hall(B, { x: cx, z: Z(s1 - 7), W, D: 8, bays: 5, colH: 3.6, roof: 'yingshan', caihua: 'xuanzi', base: { h: 0.6, stairs: [{ side: 'f', w: 3 }] }, id });
  for (const sx of [1, -1]) rowHouse(B, { x: cx + sx * ((x1 - x0) / 2 - 6), z: Z(s0 + L * 0.3), rot: sx > 0 ? E : W_, W: L * 0.3, D: 6, bays: 3, colH: 3.3 });
  if (o.trees !== false) {
    const sp = o.trees || (Math.abs(cx) > 150 ? 'crabapple' : 'huai');
    TR.add(sp, cx - 6, Z(s0 + L * 0.3), 0, 0.75); TR.add(sp, cx + 6, Z(s0 + L * 0.3), 0, 0.75);
  }
  if (id && ctx.SG[id]) P.sign(B, cx + 4.5, 0, Z(s0) - 3, 0, ctx.SG[id]);
  if (id) REG.signs.push({ id, x: cx + 4.5, z: Z(s0) - 3 });
}

/** 三台 / 工字形台基的一层：sections [[hx, s0, s1]...]，自南向北 */
function terraceTier(B, secs, y0, h, k, o = {}) {
  B.at(0, 0, 0, 0);
  for (const [hx, s0, s1] of secs) {
    B.at(0, y0, Z((s0 + s1) / 2), 0);
    const hz = (s1 - s0) / 2;
    B.box('marble', 0, 0, 0, hx * 2 + 0.3, h * 0.2, hz * 2 + 0.3, { col: rgb(C.marble) });
    B.box('marble', 0, h * 0.2, 0, hx * 2 - 0.3, h * 0.55, hz * 2 - 0.3, { col: rgb(C.marble, 0.93), skip: 'b' });
    B.box('marble', 0, h * 0.75, 0, hx * 2 + 0.15, h * 0.25, hz * 2 + 0.15, { col: rgb(C.marble), skip: 'b' });
    wfill(B, -hx, -hz, hx, hz, h);
  }
  B.at(0, 0, 0, 0);
  const yTop = y0 + h;
  const [A, Bm, Cc] = secs.length === 3 ? secs : [secs[0], null, secs[secs.length - 1]];
  const rail = (x0, z0, x1, z1, outVec) => { if (Math.hypot(x1 - x0, z1 - z0) > 0.8) railing(B, x0, z0, x1, z1, yTop, { chishou: o.chishou ?? true, outVec }); };
  const inset = 0.3;
  // 前沿（含台阶开口）
  const fz = Z(A[1]) - inset;
  const frontStairs = o.front ? o.front : [{ at: -38, w: 6 }, { at: 38, w: 6 }];
  const mainW = o.frontGap ?? 15;
  const gaps = [[-mainW / 2 - 0.4, mainW / 2 + 0.4], ...frontStairs.map((s) => [s.at - s.w / 2 - 0.4, s.at + s.w / 2 + 0.4])].sort((a, b) => a[0] - b[0]);
  let cur = -A[0] + inset;
  for (const [g0, g1] of gaps) { rail(cur, fz, g0, fz, [0, 1]); cur = g1; }
  rail(cur, fz, A[0] - inset, fz, [0, 1]);
  if (!o.frontGap) stairs(B, 0, Z(A[1]), mainW, yTop, 'f', { yudao: !o.noYudao });
  for (const st of frontStairs) stairs(B, st.at, Z(A[1]), st.w, yTop, 'f');
  // 侧沿
  const sideS = o.sides ? o.sides : [{ s: (A[1] + A[2]) / 2, w: 6 }];
  for (const sx of [1, -1]) {
    const x = sx * (A[0] - inset);
    let c = Z(A[1]) - inset;
    for (const st of sideS) {
      const zc = Z(st.s);
      rail(x, c, x, zc + st.w / 2 + 0.4, [sx, 0]);
      stairs(B, sx * A[0], zc, st.w, yTop, sx > 0 ? 'r' : 'l');
      c = zc - st.w / 2 - 0.4;
    }
    rail(x, c, x, Z(A[2]) + (Bm ? 0 : inset), [sx, 0]);
    if (Bm) {
      rail(x, Z(A[2]) + inset, sx * (Bm[0] - inset), Z(A[2]) + inset, [0, -1]);
      rail(sx * (Bm[0] - inset), Z(Bm[1]) + inset, sx * (Bm[0] - inset), Z(Bm[2]) - inset, [sx, 0]);
      rail(sx * (Bm[0] - inset), Z(Cc[1]) - inset, sx * (Cc[0] - inset), Z(Cc[1]) - inset, [0, 1]);
      rail(sx * (Cc[0] - inset), Z(Cc[1]) - inset, sx * (Cc[0] - inset), Z(Cc[2]) + inset, [sx, 0]);
    }
  }
  // 后沿
  const bz = Z(Cc[2]) + inset;
  const back = o.back || [{ at: 0, w: 12 }];
  let c2 = -Cc[0] + inset;
  for (const st of back) { rail(c2, bz, st.at - st.w / 2 - 0.4, bz, [0, -1]); c2 = st.at + st.w / 2 + 0.4; stairs(B, st.at, Z(Cc[2]), st.w, yTop, 'b', { yudao: !o.noYudao }); }
  rail(c2, bz, Cc[0] - inset, bz, [0, -1]);
}

/** 汉白玉拱桥（或护城河上的平桥）：沿局部 z 方向跨越 */
function bridge(B, x, z, len, w, rot, o = {}) {
  B.at(x, 0, z, rot);
  const col = rgb(C.marble);
  const h = o.flat ? 0.25 : (o.h ?? 1.4);
  const n = Math.max(8, Math.round(len / 1.0));
  const deck = (t) => o.flat ? h : 0.05 + h * (1 - Math.pow(2 * t - 1, 2)); // t: 0..1
  // 桥面
  B.grid('marble', n, 2, (i, j) => { const t = i / n; return [-w / 2 + (j / 2) * w, deck(t), -len / 2 + t * len]; }, (i, j) => [j * w / 2.5, (i / n) * len / 2.5], col, [0, 1, 0]);
  // 侧立面（带拱洞）
  const span = o.flat ? len * 0.8 : Math.min(len * 0.6, 9);
  for (const sx of [1, -1]) {
    const pts = [];
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push([sx * w / 2, deck(t) + 0.02, -len / 2 + t * len]); }
    pts.push([sx * w / 2, BED_Y, len / 2]);
    if (o.flat) {
      for (const c of [span / 2, span / 6, -span / 6, -span / 2]) pts.push([sx * w / 2, BED_Y, c]);
    } else {
      pts.push([sx * w / 2, BED_Y, span / 2]);
      const ah = (h - 0.55) - (WATER_Y - 0.6);
      for (let i = 0; i <= 12; i++) { const a = (i / 12) * PI; pts.push([sx * w / 2, WATER_Y - 0.6 + Math.sin(a) * ah, Math.cos(a) * span / 2]); }
      pts.push([sx * w / 2, BED_Y, -span / 2]);
    }
    pts.push([sx * w / 2, BED_Y, -len / 2]);
    B.poly('marble', pts, [sx, 0, 0], (p) => [p[2] / 2.5, p[1] / 2.5], rgb(C.marble, 0.92));
    // 栏杆
    const xr = sx * (w / 2 - 0.15);
    for (let i = 0; i <= n; i += 1) {
      const t = i / n, zz = -len / 2 + t * len, y = deck(t);
      if (o.flat && i % 2) continue;
      B.box('marble', xr, y, zz, 0.2, 1.05, 0.2, { col, skip: 'b' });
      if (o.lionPosts) B.sphere('marble', xr, y + 1.2, zz, 0.16, 0.18, 0.2, 6, col);
      if (i < n) {
        const t2 = (i + 1) / n, z2 = -len / 2 + t2 * len, y2 = deck(t2);
        const A = [xr, y + 0.12, zz], Bp = [xr, y2 + 0.12, z2], Cp = [xr, y2 + 0.82, z2], Dp = [xr, y + 0.82, zz];
        B.quad('marble', A, Bp, Cp, Dp, [[0, 0], [1, 0], [1, 1], [0, 1]], col);
        B.quad('marble', Bp, A, Dp, Cp, [[0, 0], [1, 0], [1, 1], [0, 1]], col);
      }
    }
    if (REG.col) { const a = B.P(xr, 0, -len / 2), b = B.P(xr, 0, len / 2); REG.col.capsule(a[0], a[2], b[0], b[2], 0.25); }
  }
  if (!o.flat) {
    const ah = (h - 0.55) - (WATER_Y - 0.6);
    B.grid('marble', 12, 1, (i, j) => { const a = (i / 12) * PI; return [-w / 2 + j * w, WATER_Y - 0.6 + Math.sin(a) * ah, Math.cos(a) * span / 2]; }, (i, j) => [i / 4, j], rgb(0xbdb8ac), [0, -1, 0]);
  }
  if (o.flat) wfill(B, -w / 2 + 0.4, -len / 2, w / 2 - 0.4, len / 2, h);
  else wrampZ(B, -w / 2 + 0.4, -len / 2, w / 2 - 0.4, len / 2, 0.05, 0, h + 0.05);
}

/** 叠石假山 */
function rockery(B, x, z, r, h) {
  B.at(x, 0, z, 0);
  let s = Math.round(x * 13 + z * 7) >>> 0;
  const rnd = () => (s = (s * 16807 + 11) % 2147483647) / 2147483647;
  const col = rgb(0x8a8680);
  for (let i = 0; i < 14; i++) {
    const a = rnd() * PI * 2, d = rnd() * r * 0.8, yy = rnd() * h * 0.7;
    const k = 1 - yy / h;
    B.sphere('brick', Math.cos(a) * d * k, yy, Math.sin(a) * d * k, r * 0.35 * (0.6 + rnd() * 0.6) * k + 1, h * 0.25 + rnd() * 2, r * 0.35 * (0.6 + rnd() * 0.6) * k + 1, 7, col);
  }
  B.sphere('brick', 0, h * 0.3, 0, r * 0.75, h * 0.75, r * 0.75, 9, col);
  wblock(B, -r * 0.8, -r * 0.8, r * 0.8, r * 0.8);
  REG.map.rects.push({ x0: x - r * 0.8, z0: z - r * 0.8, x1: x + r * 0.8, z1: z + r * 0.8, color: 0x8a8680, kind: 'rock' });
}

function gardenGround(T, x0, z0, x1, z1) {
  T.rect(x0, z0, x1, z1, 0x9a927c);
  T.grass(x0 + 2, z0 + 2, x1 - 2, z1 - 2, 0.45);
  // 卵石甬路
  T.line([[x0 + 4, (z0 + z1) / 2], [x1 - 4, (z0 + z1) / 2]], 3, 0xbfb59c);
  T.line([[0, z0], [0, z1]], 4, 0xc4ba9f);
  for (const xx of [-30, 30]) T.line([[xx, z0 + 3], [xx, z1 - 3]], 2.4, 0xbfb59c);
}

function forest(TR, T, x0, z0, x1, z1, sp, n, ok, seed) {
  T.grass(x0, z0, x1, z1, 0.6);
  TR.scatter((r) => r < 0.85 ? sp : 'huai', x0, z0, x1, z1, n, 0, ok, seed);
}
