// 场景生成过程中收集的元数据：可点击建筑、小地图图形、标注锚点、导览牌等。
export const REG = {
  col: null, // HeightGrid
  picks: [], // { id, min:[x,y,z], max:[x,y,z] }
  anchors: {}, // id → { x, y, z, r }（建筑中心与尺度，用于飞行定位）
  map: { rects: [], walls: [], water: [], trees: [] },
  signs: [], // 导览牌 { id, x, z, rot }
  lamps: [], // 夜景灯笼位置
  interiors: [], // { id, min, max, light }
  vats: [],
  solids: [], // 实体包围盒 { id, min, max }：相机不能进入，也用于标签遮挡判断
  people: [], // 游客路线
};

export function addPick(id, min, max) {
  if (!id) return;
  REG.picks.push({ id, min, max });
  const a = REG.anchors[id];
  const cx = (min[0] + max[0]) / 2, cz = (min[2] + max[2]) / 2;
  const r = Math.max(max[0] - min[0], max[2] - min[2], (max[1] - min[1]) * 1.4) / 2;
  if (!a || r > a.r) REG.anchors[id] = { x: cx, y: (min[1] + max[1]) / 2, z: cz, top: max[1], base: min[1], r, w: max[0] - min[0], d: max[2] - min[2] };
}

export function setAnchor(id, x, y, z, r, extra = {}) {
  REG.anchors[id] = { x, y, z, top: y + r, base: 0, r, w: r * 2, d: r * 2, ...extra };
}
