import type { BodyDesign, Organ } from './body-design.ts';
import type { Swimmer, Meal } from './food-chain.ts';
import type { Ancestor, TraitId } from './simulation';
export type Habitat = 'pond' | 'ocean' | 'shore' | 'land';
export type BodyForm =
  | 'microbe'
  | 'colony'
  | 'radial'
  | 'bilateral'
  | 'jelly'
  | 'fish'
  | 'crawler'
  | 'skipper'
  | 'strider'
  | 'stalker';
export type OceanBranch = 'radial' | 'bilateral';
export type OceanCheckpoint = {
  startingBody?: BodyDesign;
  startingForm?: 'colony' | 'bilateral' | 'radial' | 'fish' | 'jelly';
  startingDna?: number;
  learning?: import('./lineage-learning.ts').LearningState;
  dnaLineage?: import('./dna-evolution.ts').DnaLineage;
  seed: number;
  generation: number;
  time: number;
  totalFood: number;
  history: Ancestor[];
  traits: TraitId[];
  standalone: boolean;
};
export type OceanState = {
  tidal?: import('./tidal/types.ts').TidalState;
  migration?: import('./ocean-migration.ts').OceanMigration;
  body: BodyDesign;
  dna: number;
  discovered: Organ[];
  observation: Partial<Record<Organ, number>>;
  blocks: number;
  defenseFlash: number;
  biomass: number;
  eaten: number;
  shoal: Swimmer[];
  meals: Meal[];
  gulp: number;
  tier: 0 | 1 | 2;
  branch: OceanBranch | null;
  visited: string[];
  morph: {
    from: BodyForm;
    to: BodyForm;
    elapsed: number;
    duration: number;
  } | null;
  skillCooldown: number;
  skillActive: number;
  checkpoint: OceanCheckpoint;
  enteredAt: number;
};
export const FORMS: Record<
  BodyForm,
  {
    id: BodyForm;
    name: string;
    short: string;
    tier: number;
    branch: OceanBranch | null;
    speed: number;
    radius: number;
    pickup: number;
    maxEnergy: number;
    metabolism: number;
    turnRate: number;
    color: string;
    movement: string;
    skill: string;
    skillHint: string;
    description: string;
  }
> = {
  strider: {
    id: 'strider',
    name: '长足巡行兽',
    short: '长足型',
    tier: 4,
    branch: null,
    speed: 193,
    radius: 35,
    pickup: 52,
    maxEnergy: 175,
    metabolism: 1.05,
    turnRate: 6,
    color: '#d1df9e',
    movement: '细长的支撑足抬高身体，跨步穿行林地',
    skill: '友善呼唤',
    skillHint: 'J · 呼唤邻居建立信任，驱离领地猎手',
    description: '长足擅长探索，呼唤帮助结伴；无法使用扑猎技能。',
  },
  stalker: {
    id: 'stalker',
    name: '伏地扑猎兽',
    short: '扑猎型',
    tier: 4,
    branch: null,
    speed: 164,
    radius: 38,
    pickup: 43,
    maxEnergy: 185,
    metabolism: 1.2,
    turnRate: 7,
    color: '#d7b57d',
    movement: '身体低伏，粗壮后肢蓄力，长尾维持平衡',
    skill: '蓄力扑猎',
    skillHint: 'J · 朝向近处生物，跃进并咬住猎物',
    description: '短距离扑猎强，平时耗能较高；也可以分享食物结伴。',
  },
  crawler: {
    id: 'crawler',
    name: '撑足爬行体',
    short: '撑足型',
    tier: 3,
    branch: null,
    speed: 152,
    radius: 34,
    pickup: 43,
    maxEnergy: 165,
    metabolism: 0.95,
    turnRate: 6,
    color: '#bdd4a2',
    movement: '成对附肢撑起身体，在湿沙上交替爬行',
    skill: '撑地跃进',
    skillHint: 'J · 短时跃进，驱离近身威胁',
    description: '更强的支撑适合陆地穿行，水中移动则变慢。',
  },
  skipper: {
    id: 'skipper',
    name: '湿足匍行体',
    short: '湿足型',
    tier: 3,
    branch: null,
    speed: 125,
    radius: 36,
    pickup: 48,
    maxEnergy: 170,
    metabolism: 0.85,
    turnRate: 7,
    color: '#a3d8bf',
    movement: '宽阔湿润的足垫交替附着，保持身体湿润',
    skill: '撑地跃进',
    skillHint: 'J · 短时跃进，驱离近身威胁',
    description: '更适合在潮池之间往返，陆地速度较慢，但失水更慢。',
  },
  microbe: {
    id: 'microbe',
    name: '初生微生物',
    short: '微生物',
    tier: -1,
    branch: null,
    speed: 148,
    radius: 20,
    pickup: 27,
    maxEnergy: 100,
    metabolism: 0.8,
    turnRate: 99,
    color: '#b4ead4',
    movement: '纤毛游动',
    skill: '',
    skillHint: '',
    description: '一个微小个体，生命旅程的起点。',
  },
  colony: {
    id: 'colony',
    name: '多细胞群体',
    short: '细胞群体',
    tier: 0,
    branch: null,
    speed: 126,
    radius: 27,
    pickup: 36,
    maxEnergy: 135,
    metabolism: 0.8,
    turnRate: 8,
    color: '#a8e7dc',
    movement: '群体协调，缓慢漂游',
    skill: '聚合护膜',
    skillHint: 'J · 短暂护膜抵御捕食者，消耗 14 能量',
    description: '细胞聚合为一个身体。结构仍然简单，准备分化出不同的组织。',
  },
  radial: {
    id: 'radial',
    name: '辐射软体',
    short: '辐射体',
    tier: 1,
    branch: 'radial',
    speed: 119,
    radius: 34,
    pickup: 59,
    maxEnergy: 150,
    metabolism: 0.72,
    turnRate: 7,
    color: '#d6bdf8',
    movement: '身体收缩推进，周围都能摄食',
    skill: '触腕舒展',
    skillHint: 'J · 暂时扩大滤食范围，驱离附近捕食者',
    description: '身体从中心向外展开，形成口部和短触腕。以滤食和范围防御生存。',
  },
  bilateral: {
    id: 'bilateral',
    name: '两侧游泳体',
    short: '两侧体',
    tier: 1,
    branch: 'bilateral',
    speed: 168,
    radius: 27,
    pickup: 38,
    maxEnergy: 140,
    metabolism: 0.95,
    turnRate: 5.5,
    color: '#9bdce9',
    movement: '有了头尾，身体左右摆动前进',
    skill: '摆体疾游',
    skillHint: 'J · 沿当前朝向快速掠游，短暂避开伤害',
    description:
      '身体拉长并形成头尾，两侧对称。更擅长定向探索，但需要补充更多能量。',
  },
  jelly: {
    id: 'jelly',
    name: '伞形游泳体',
    short: '水母型',
    tier: 2,
    branch: 'radial',
    speed: 133,
    radius: 44,
    pickup: 88,
    maxEnergy: 175,
    metabolism: 0.72,
    turnRate: 6,
    color: '#d6b6fa',
    movement: '伞体搏动，长触腕在身后展开',
    skill: '触腕脉冲',
    skillHint: 'J · 大范围滤食并震退周围捕食者',
    description:
      '半透明伞体与长触腕形成新的身体。滤食范围很大，适合借洋流探索。',
  },
  fish: {
    id: 'fish',
    name: '鳍泳生物',
    short: '鱼型',
    tier: 2,
    branch: 'bilateral',
    speed: 204,
    radius: 33,
    pickup: 43,
    maxEnergy: 155,
    metabolism: 1.05,
    turnRate: 4.8,
    color: '#9edee5',
    movement: '摆尾推进，鱼鳍控制方向',
    skill: '尾鳍掠游',
    skillHint: 'J · 短时高速穿越，避开捕食者的攻击',
    description:
      '流线身体、成对鱼鳍和尾鳍承担不同任务。速度更快，转弯与耗能需要规划。',
  },
};
export const nextForms = (form: BodyForm): BodyForm[] =>
  form === 'colony'
    ? ['radial', 'bilateral']
    : ['radial', 'bilateral', 'jelly', 'fish'].includes(form)
      ? ['jelly', 'fish']
      : [];
