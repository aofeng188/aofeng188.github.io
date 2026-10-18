// 共享材质。通过 onBeforeCompile 注入两种全局效果：
//   积雪：朝上的表面按坡度与噪声混入白色；
//   夜景：竖直立面加一层暖色泛光，模拟夜间投光照明。
import * as THREE from 'three';
import * as T from './textures.js';

export const G = {
  uSnow: { value: 0 },
  uNight: { value: 0 },
  uTime: { value: 0 },
};

const NOISE = /* glsl */`
varying vec3 vFcWorld;
uniform float uSnow;
uniform float uNight;
float fcHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fcNoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(fcHash(i), fcHash(i + vec2(1,0)), u.x), mix(fcHash(i + vec2(0,1)), fcHash(i + vec2(1,1)), u.x), u.y);
}
`;

const WORLD_VARY = /* glsl */`
{
  vec4 fcW = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  fcW = instanceMatrix * fcW;
  #endif
  fcW = modelMatrix * fcW;
  vFcWorld = fcW.xyz;
}
`;

export function snowChunk(threshold = 0.3) {
  return /* glsl */`
#ifdef FC_SNOW
{
  vec3 fcUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  float fcN = dot(normal, fcUp);
  float fcNz = fcNoise(vFcWorld.xz * 0.45) * 0.6 + fcNoise(vFcWorld.xz * 3.1) * 0.4;
  float fcCov = smoothstep(${threshold.toFixed(2)}, ${(threshold + 0.3).toFixed(2)}, fcN + (fcNz - 0.5) * 0.4) * uSnow;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.90, 0.92, 0.96), fcCov);
  roughnessFactor = mix(roughnessFactor, 0.85, fcCov);
}
#endif
`;
}

/**
 * 给材质注入积雪 / 夜景效果。
 * o.snow: 是否积雪；o.night: 夜景泛光强度（0 关闭）；o.snowAt: 积雪起始坡度阈值
 */
export function enhance(mat, o = {}) {
  const snow = o.snow !== false;
  const night = o.night || 0;
  const key = `fc-${snow ? 1 : 0}-${night}-${o.snowAt || 0.3}-${o.extraKey || ''}`;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    sh.uniforms.uSnow = G.uSnow;
    sh.uniforms.uNight = G.uNight;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFcWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + WORLD_VARY);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + NOISE)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + (snow ? snowChunk(o.snowAt || 0.3) : ''))
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + (night ? `
{
  vec3 fcUp2 = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  float fcV = 1.0 - abs(dot(normal, fcUp2));
  float fcH = clamp(1.0 - (vFcWorld.y - 2.0) / 60.0, 0.25, 1.0);
  totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.6, 0.3) * uNight * fcV * fcH * ${(night * 2.6).toFixed(3)};
}` : ''));
    if (snow) sh.fragmentShader = '#define FC_SNOW\n' + sh.fragmentShader;
    if (o.patch) o.patch(sh);
    if (prev) prev(sh, r);
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}

export function createMaterials(quality) {
  T.setAnisotropy(quality.aniso || 4);
  const tile = T.tileTextures();
  const plaster = T.plasterTexture();
  const marble = T.marbleTexture();
  const brick = T.brickTexture({ bw: 64, bh: 32, mortar: 2, lo: 0.5, hi: 0.72, seed: 43 });
  marble.repeat.set(0.38, 0.38); // 石块约 0.7 米
  brick.repeat.set(0.32, 0.32); // 城砖约 0.4 米
  const floor = T.brickTexture({ bw: 128, bh: 128, mortar: 2, lo: 0.22, hi: 0.3, seed: 47, stagger: false });

  const std = (p) => new THREE.MeshStandardMaterial(p);
  const M = {};
  M.roof = enhance(std({ map: tile.map, normalMap: tile.normalMap, normalScale: new THREE.Vector2(0.9, 0.9), vertexColors: true, roughness: 0.32, metalness: 0.05 }), { snowAt: 0.28 });
  M.glaze = enhance(std({ vertexColors: true, roughness: 0.3, metalness: 0.05 }), { snowAt: 0.4 });
  M.eave = enhance(std({ map: T.eaveTexture(), vertexColors: true, roughness: 0.32, metalness: 0.05 }), { snow: false });
  M.ridge = enhance(std({ map: T.ridgeTexture(), vertexColors: true, roughness: 0.34, metalness: 0.05 }), { snowAt: 0.45 });
  M.wall = enhance(std({ map: plaster, vertexColors: true, roughness: 0.95, envMapIntensity: 0.6 }), { night: 0.55 });
  M.brick = enhance(std({ map: brick, vertexColors: true, roughness: 0.95 }), { night: 0.4 });
  M.marble = enhance(std({ map: marble, vertexColors: true, roughness: 0.75, envMapIntensity: 0.6 }), { night: 0.45 });
  M.paint = enhance(std({ vertexColors: true, roughness: 0.62 }), { night: 0.5 });
  M.lattice = enhance(std({ map: T.latticeTexture(true), vertexColors: true, roughness: 0.6 }), { night: 0.6, snow: false });
  M.lattice2 = enhance(std({ map: T.latticeTexture(false), vertexColors: true, roughness: 0.65 }), { night: 0.5, snow: false });
  M.hexi = enhance(std({ map: T.caihuaTexture('hexi'), vertexColors: true, roughness: 0.55 }), { night: 0.8, snow: false });
  M.xuanzi = enhance(std({ map: T.caihuaTexture('xuanzi'), vertexColors: true, roughness: 0.6 }), { night: 0.7, snow: false });
  M.su = enhance(std({ map: T.caihuaTexture('su'), vertexColors: true, roughness: 0.6 }), { night: 0.7, snow: false });
  M.dougong = enhance(std({ map: T.dougongTexture(), vertexColors: true, roughness: 0.6 }), { night: 0.9, snow: false });
  M.rafter = enhance(std({ map: T.rafterTexture(), vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }), { night: 0.5, snow: false });
  M.door = enhance(std({ map: T.doorTexture(9, 9), vertexColors: true, roughness: 0.55, metalness: 0.1 }), { night: 0.5, snow: false });
  M.door72 = enhance(std({ map: T.doorTexture(8, 9), vertexColors: true, roughness: 0.55, metalness: 0.1 }), { night: 0.5, snow: false });
  M.gable = enhance(std({ map: T.gableTexture(), vertexColors: true, roughness: 0.6 }), { night: 0.6, snow: false });
  M.gold = enhance(std({ color: 0xffffff, vertexColors: true, roughness: 0.28, metalness: 1.0 }), { snowAt: 0.5 });
  M.bronze = enhance(std({ vertexColors: true, roughness: 0.42, metalness: 0.85 }), { snowAt: 0.4 });
  M.ceiling = std({ map: T.ceilingTexture(), vertexColors: true, roughness: 0.7, side: THREE.DoubleSide });
  M.floor = std({ map: floor, vertexColors: true, roughness: 0.38, metalness: 0.0, envMapIntensity: 0.25 });
  M.inner = std({ vertexColors: true, roughness: 0.6, envMapIntensity: 0.35 }); // 室内（不积雪）
  M.innerGold = std({ vertexColors: true, roughness: 0.32, metalness: 1.0, envMapIntensity: 0.6 });
  M.lamp = new THREE.MeshStandardMaterial({ color: 0xc8321e, emissive: 0xff5a28, emissiveIntensity: 0.25, roughness: 0.6 });
  M.lampWarm = new THREE.MeshStandardMaterial({ color: 0xfff2d0, emissive: 0xffc070, emissiveIntensity: 0.0, roughness: 0.5 });
  M.road = enhance(std({ map: T.groundDetailTexture(), vertexColors: true, roughness: 0.9 }), {});
  M.plaque = std({ roughness: 0.45, metalness: 0.15 });
  M.sign = std({ roughness: 0.6 });
  M.glass = new THREE.MeshStandardMaterial({ color: 0x8fb8c8, roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.45 });
  M._textures = { tile, plaster, marble, brick, floor };
  return M;
}

// 常用颜色（sRGB）
export const C = {
  yellow: 0xd39628, // 黄琉璃
  yellowDark: 0xa8741c,
  green: 0x2f7d4a, // 绿琉璃
  greenDark: 0x1f5a35,
  black: 0x2a2a2e, // 黑琉璃
  grey: 0x6e7075, // 青灰瓦
  greyDark: 0x4f5156,
  blue: 0x2b4f8f,
  red: 0xa8321f, // 朱红
  redWall: 0x8c2a1f, // 宫墙红
  redCity: 0x7c3226, // 城墙赭红
  lacquer: 0x8e1d13, // 柱子朱漆
  marble: 0xc2bdb1,
  stone: 0xa7a39a,
  greyBrick: 0x8e9094,
  pave: 0xb3b0aa,
  gold: 0xf2c25a,
  bronze: 0x5c4a32,
  darkWood: 0x3a2318,
  white: 0xffffff,
};
