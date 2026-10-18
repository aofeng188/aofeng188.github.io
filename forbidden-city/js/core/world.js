// 生成整个场景：材质、文字图集、建筑、地面、水面、树木、游客、环境。
import * as THREE from 'three';
import { Builder } from './buf.js';
import { createMaterials } from './materials.js';
import { Environment } from './env.js';
import { HeightGrid } from '../world/collision.js';
import { Terrain, seasonGrass } from '../world/terrain.js';
import { WaterSurface } from '../world/water.js';
import { Trees } from '../world/trees.js';
import { People } from '../world/people.js';
import { REG } from '../world/registry.js';
import { buildWorld } from '../world/layout.js';
import { plaqueAtlas, signAtlas, dragonWallTexture, loadFonts } from '../build/atlas.js';
import { BUILDINGS } from '../data/buildings.js';

export const PLAQUES = [
  ...['太和门', '太和殿', '中和殿', '保和殿', '乾清门', '乾清宫', '交泰殿', '坤宁宫', '坤宁门', '钦安殿', '体仁阁', '弘义阁', '协和门', '熙和门', '文华殿', '武英殿', '文渊阁', '养心殿', '慈宁宫', '皇极殿', '宁寿宫', '景运门', '隆宗门', '寿康宫', '畅音阁', '乐寿堂',
    '景仁宫', '承乾宫', '钟粹宫', '永和宫', '景阳宫', '永寿宫', '翊坤宫', '储秀宫', '太极殿', '长春宫', '咸福宫', '故宫博物院', '建极绥猷', '正大光明', '中正仁和'].map((t) => ({ text: t })),
  ...['午门', '神武门', '东华门', '西华门', '端门'].map((t) => ({ text: t, vertical: true })),
  { text: '中华人民共和国万岁', style: 'slogan' }, { text: '世界人民大团结万岁', style: 'slogan' },
];

const tick = () => new Promise((r) => setTimeout(r, 0));

export async function createWorld(renderer, scene, quality, progress = () => {}) {
  progress(0.02, '准备字体与纹理');
  const signItems = Object.entries(BUILDINGS).filter(([, b]) => b.sign).map(([key, b]) => ({ key, title: b.name.length > 6 ? b.name.split(' · ')[0] : b.name, text: b.sign }));
  await loadFonts(PLAQUES.map((p) => p.text).join('') + signItems.map((s) => s.title + s.text).join('') + '故宫博物院');
  const M = createMaterials(quality);
  const pa = plaqueAtlas(PLAQUES);
  M.plaque.map = pa.tex; M.plaque.needsUpdate = true;
  const sa = signAtlas(signItems);
  M.sign.map = sa.tex; M.sign.needsUpdate = true;
  M.dragons = new THREE.MeshStandardMaterial({ map: dragonWallTexture(), roughness: 0.3, metalness: 0.05 });
  await tick();

  progress(0.08, '测绘宫城');
  REG.col = new HeightGrid(-520, -900, 520, 1100, 0.5);
  const T = new Terrain({ x0: -720, z0: -960, x1: 720, z1: 1180 }, quality.groundTex);
  const TR = new Trees(scene);
  const B = new Builder(240);
  B.detail = quality.detail;
  const ctx = { B, T, TR, PL: pa.cells, SG: sa.cells, quality };
  progress(0.12, '营造殿宇');
  await tick();
  const out = buildWorld(ctx);
  progress(0.6, '铺设地面与水系');
  await tick();
  // 建筑脚下的柔和阴影
  for (const r of REG.map.rects) if (r.kind === 'hall' || r.kind === 'gate') T.ao(r.x0, r.z0, r.x1, r.z1);
  for (const [x0, z0, x1, z1, , t] of REG.map.walls) T.aoLine(x0, z0, x1, z1, (t || 1.6) + 1.5);
  T.flushAO(3.5, 0.4);
  const ground = T.build(B);
  scene.add(ground);
  if (ctx.hill) scene.add(ctx.hill);
  progress(0.7, '合并几何体');
  await tick();
  const group = B.build(M, { noShadow: ['ceiling', 'rafter', 'floor', 'plaque', 'sign'] });
  scene.add(group);
  progress(0.8, '引水入河');
  await tick();
  const water = new WaterSurface(renderer, scene, out.water, quality);
  scene.add(water.mesh);
  progress(0.86, '种植古树');
  await tick();
  TR.build(quality);
  const people = new People(scene, quality.people);
  people.build();
  progress(0.93, '调和天光');
  await tick();
  const env = new Environment(renderer, scene, quality, M);
  T.uGrass.value.copy(seasonGrass(env.season));
  TR.setSeason(env.season);
  env.on((k, v) => {
    if (k === 'season') { TR.setSeason(v); T.uGrass.value.copy(seasonGrass(v)); }
  });
  progress(1, '完成');
  return { M, env, water, trees: TR, people, terrain: T, group, ground, out, builder: B, tris: B.tris };
}
