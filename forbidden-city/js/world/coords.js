// 坐标约定：x 向东，z 向南（北为 -z），y 向上，单位米。
// s 为「自紫禁城南墙外皮向北的距离」：南墙 s = 0，北墙 s = 961。
export const Z = (s) => 480.5 - s;

export const WALL = { x: 376.5, s0: 0, s1: 961, thick: 8.62 };
export const SANTAI_H = 8.13; // 三台通高
export const QQ_H = 2.6; // 乾清宫台基高
