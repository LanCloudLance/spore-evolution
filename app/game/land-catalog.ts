import type { BodyForm } from './forms.ts';
export type LandFeature =
  | 'leap'
  | 'burrow'
  | 'glide'
  | 'cache'
  | 'alarm'
  | 'herd'
  | 'dew'
  | 'thorns'
  | 'roots'
  | 'sift'
  | 'scent'
  | 'horns';
export type LandSpecies =
  | 'fern'
  | 'grazer'
  | 'hunter'
  | 'reed-runner'
  | 'burrow-mole'
  | 'shell-grazer'
  | 'dusk-stalker'
  | 'seed-carrier'
  | 'sail-glider'
  | 'amber-beetle'
  | 'echo-finch'
  | 'moss-tortoise'
  | 'pack-runner'
  | 'dew-newt'
  | 'spine-hedgehog'
  | 'root-weaver'
  | 'marsh-filter'
  | 'ridge-ram';
type Life = {
  id: LandSpecies;
  name: string;
  form: BodyForm;
  color: string;
  radius: number;
  health: number;
  food: number;
  feature: LandFeature;
  behavior:
    | 'browse'
    | 'graze'
    | 'hunt'
    | 'leap'
    | 'burrow'
    | 'armor'
    | 'ambush'
    | 'carry'
    | 'glide'
    | 'scavenge'
    | 'alarm'
    | 'garden'
    | 'pack'
    | 'wet'
    | 'spine'
    | 'roots'
    | 'sift'
    | 'charge';
  home: { x: number; y: number };
  hint: string;
};
export const LAND_SPECIES: Life[] = [
  {
    id: 'fern',
    name: '蕨尾兽',
    form: 'strider',
    color: '#bfd797',
    radius: 26,
    health: 60,
    food: 5,
    feature: 'roots',
    behavior: 'browse',
    home: { x: 1040, y: 650 },
    hint: '在蕨林采食嫩叶',
  },
  {
    id: 'grazer',
    name: '果角兽',
    form: 'crawler',
    color: '#dac69b',
    radius: 36,
    health: 100,
    food: 7,
    feature: 'herd',
    behavior: 'graze',
    home: { x: 1980, y: 1290 },
    hint: '果实成熟时群聚',
  },
  {
    id: 'hunter',
    name: '岩背猎手',
    form: 'stalker',
    color: '#d2a076',
    radius: 48,
    health: 160,
    food: 10,
    feature: 'scent',
    behavior: 'hunt',
    home: { x: 1580, y: 480 },
    hint: '守领地，也会夺走肉食',
  },
  {
    id: 'reed-runner',
    name: '芦足跃兽',
    form: 'skipper',
    color: '#d6e6a1',
    radius: 23,
    health: 55,
    food: 4,
    feature: 'leap',
    behavior: 'leap',
    home: { x: 650, y: 500 },
    hint: '受惊后短跃，疲惫时放慢',
  },
  {
    id: 'burrow-mole',
    name: '穴掌兽',
    form: 'crawler',
    color: '#bba78c',
    radius: 28,
    health: 80,
    food: 5,
    feature: 'burrow',
    behavior: 'burrow',
    home: { x: 1150, y: 1250 },
    hint: '热风中躲进自己的穴口',
  },
  {
    id: 'shell-grazer',
    name: '盾背食草兽',
    form: 'crawler',
    color: '#c4af92',
    radius: 38,
    health: 135,
    food: 7,
    feature: 'burrow',
    behavior: 'armor',
    home: { x: 1250, y: 1650 },
    hint: '厚甲挡住正面扑击，热风中回穴避暑',
  },
  {
    id: 'dusk-stalker',
    name: '暮影伏兽',
    form: 'stalker',
    color: '#879c99',
    radius: 34,
    health: 100,
    food: 7,
    feature: 'scent',
    behavior: 'ambush',
    home: { x: 850, y: 350 },
    hint: '藏在阴影中，接近才扑出',
  },
  {
    id: 'seed-carrier',
    name: '种袋兽',
    form: 'strider',
    color: '#e4c28a',
    radius: 28,
    health: 70,
    food: 5,
    feature: 'cache',
    behavior: 'carry',
    home: { x: 1250, y: 550 },
    hint: '带走果实，留到远处再吃',
  },
  {
    id: 'sail-glider',
    name: '风帆滑兽',
    form: 'skipper',
    color: '#b6d9d9',
    radius: 29,
    health: 65,
    food: 5,
    feature: 'glide',
    behavior: 'glide',
    home: { x: 2120, y: 440 },
    hint: '沿山脊顺风滑行',
  },
  {
    id: 'amber-beetle',
    name: '琥甲腐食虫',
    form: 'crawler',
    color: '#d6a95c',
    radius: 22,
    health: 75,
    food: 4,
    feature: 'sift',
    behavior: 'scavenge',
    home: { x: 2220, y: 1200 },
    hint: '吃掉无人看守的残肉',
  },
  {
    id: 'echo-finch',
    name: '回声鸣兽',
    form: 'strider',
    color: '#e5d68d',
    radius: 23,
    health: 50,
    food: 4,
    feature: 'alarm',
    behavior: 'alarm',
    home: { x: 520, y: 440 },
    hint: '遇险鸣叫，附近邻居一起逃离',
  },
  {
    id: 'moss-tortoise',
    name: '苔背育园兽',
    form: 'crawler',
    color: '#8fb5a0',
    radius: 37,
    health: 125,
    food: 7,
    feature: 'roots',
    behavior: 'garden',
    home: { x: 750, y: 1600 },
    hint: '活动处的种子更快再生',
  },
  {
    id: 'pack-runner',
    name: '环尾群兽',
    form: 'strider',
    color: '#b6c8aa',
    radius: 30,
    health: 85,
    food: 6,
    feature: 'herd',
    behavior: 'pack',
    home: { x: 2370, y: 1520 },
    hint: '留在邻居身边，遇险抱团',
  },
  {
    id: 'dew-newt',
    name: '露囊水兽',
    form: 'skipper',
    color: '#9acbd0',
    radius: 27,
    health: 70,
    food: 5,
    feature: 'dew',
    behavior: 'wet',
    home: { x: 1800, y: 760 },
    hint: '沿水洼活动，旱季迁向泉眼',
  },
  {
    id: 'spine-hedgehog',
    name: '刺叶卷兽',
    form: 'crawler',
    color: '#b6b997',
    radius: 30,
    health: 90,
    food: 6,
    feature: 'thorns',
    behavior: 'spine',
    home: { x: 2490, y: 1650 },
    hint: '受攻击时竖刺反击',
  },
  {
    id: 'root-weaver',
    name: '织根兽',
    form: 'strider',
    color: '#b3d59a',
    radius: 25,
    health: 65,
    food: 5,
    feature: 'roots',
    behavior: 'roots',
    home: { x: 720, y: 1460 },
    hint: '在植物周围维护食源',
  },
  {
    id: 'marsh-filter',
    name: '沼须滤兽',
    form: 'crawler',
    color: '#a4d6c1',
    radius: 33,
    health: 90,
    food: 6,
    feature: 'sift',
    behavior: 'sift',
    home: { x: 560, y: 1050 },
    hint: '只在湿润食场展开摄食须',
  },
  {
    id: 'ridge-ram',
    name: '脊角冲兽',
    form: 'strider',
    color: '#d5b587',
    radius: 42,
    health: 140,
    food: 8,
    feature: 'horns',
    behavior: 'charge',
    home: { x: 2600, y: 600 },
    hint: '保卫领地，直线冲撞后需要停歇',
  },
];
const speciesById = Object.fromEntries(
  LAND_SPECIES.map((s) => [s.id, s]),
) as Record<LandSpecies, Life>;
export const landSpecies = (id: LandSpecies) => speciesById[id];
export const isLandPredator = (id: LandSpecies) =>
  ['hunt', 'ambush', 'charge'].includes(landSpecies(id).behavior);
export const LAND_FEATURES: Record<
  LandFeature,
  { name: string; benefit: string; cost: string; action: string }
> = {
  leap: {
    name: '弹力后足',
    benefit: '短时跃进，脱离围堵',
    cost: '16能量，跃进仍受岩石阻挡',
    action: 'I 跃进',
  },
  burrow: {
    name: '掘穴前掌',
    benefit: '留下减缓失水的短期穴巢',
    cost: '16能量，最多三处，仍需补水',
    action: 'I 掘穴',
  },
  glide: {
    name: '滑翔侧膜',
    benefit: '展开侧膜短时滑行，穿越开阔地',
    cost: '16能量，维持组织增加代谢12%',
    action: 'I 展开侧膜',
  },
  cache: {
    name: '储食袋',
    benefit: '保留3营养，后代搬运满载不减速',
    cost: '储藏占用现有食物，取回不额外补能',
    action: 'I 储藏 / 取回',
  },
  alarm: {
    name: '警戒鸣囊',
    benefit: '警戒声驱退靠近的威胁',
    cost: '16能量，不能替代食物分享',
    action: 'I 警戒鸣叫',
  },
  herd: {
    name: '群居感知',
    benefit: '附近同行者分担更多伤害',
    cost: '独行时没有额外保护',
    action: 'L 指挥同行者',
  },
  dew: {
    name: '凝露组织',
    benefit: '湿地停歇时快速恢复水分',
    cost: '阳光下仍会失水',
    action: '在水边或蕨影中停歇',
  },
  thorns: {
    name: '竖刺肩背',
    benefit: '受到接触攻击时反击',
    cost: '宽阔身体转向较慢',
    action: '接触威胁时自动防护',
  },
  roots: {
    name: '育根足',
    benefit: '驻留时帮助附近果实重新生长',
    cost: '维持组织增加代谢12%',
    action: '停在自己维护的食场',
  },
  sift: {
    name: '湿地摄食须',
    benefit: '在水边展开摄食须，扩大采食范围',
    cost: '展开时移动较慢',
    action: 'I 展开 / 收拢',
  },
  scent: {
    name: '嗅迹触须',
    benefit: '标记附近残肉与猎物的警觉',
    cost: '8能量，需要真实接近猎物',
    action: 'I 追踪气味',
  },
  horns: {
    name: '护地长角',
    benefit: '击退近身威胁，保护同行者',
    cost: '16能量，直线接触才有效',
    action: 'I 护地冲击',
  },
};
export function validLandFeatures(v: unknown): v is LandFeature[] {
  return (
    Array.isArray(v) &&
    v.length <= 3 &&
    new Set(v).size === v.length &&
    v.every((id) => Object.hasOwn(LAND_FEATURES, id))
  );
}
