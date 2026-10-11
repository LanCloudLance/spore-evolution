import type { World } from './simulation.ts';
import { revealing } from './evolution-experience.ts';
export type LifeStage =
  | 'pond'
  | 'ocean'
  | 'shore'
  | 'land'
  | 'colony'
  | 'tribe'
  | 'city'
  | 'space';
export type LearnedSkill =
  | 'jet'
  | 'ward'
  | 'gather'
  | 'nurture'
  | 'weaving'
  | 'masonry'
  | 'logistics'
  | 'survey'
  | 'navigator';
export const LEARNED_SKILLS: Record<
  LearnedSkill,
  { name: string; effect: string; stages: LifeStage[]; active: boolean }
> = {
  jet: {
    name: '脉冲推进',
    effect: 'U · 12能量，2秒游速/步速提高25%，冷却8秒',
    stages: ['pond', 'ocean', 'shore', 'land'],
    active: true,
  },
  ward: {
    name: '护体脉冲',
    effect: 'U · 12能量，抵挡1.5秒接触伤害，冷却8秒',
    stages: ['pond', 'ocean', 'shore', 'land'],
    active: true,
  },
  gather: {
    name: '摄食展开',
    effect: 'U · 12能量，4秒摄食范围增加22，冷却8秒',
    stages: ['pond', 'ocean', 'shore', 'land'],
    active: true,
  },
  nurture: {
    name: '精细照料',
    effect: '族群喂养同样的食物，幼崽每次多成长5',
    stages: ['colony'],
    active: false,
  },
  weaving: {
    name: '轻巧编织',
    effect: '族群载重+1；部落载重+2；文明每趟载重+1',
    stages: ['colony', 'tribe', 'city'],
    active: false,
  },
  masonry: {
    name: '稳固营造',
    effect: '族群修棚多恢复4；部落河堤建造速度提高30%',
    stages: ['colony', 'tribe'],
    active: false,
  },
  logistics: {
    name: '接力运输',
    effect: '文明运输速度提高20%',
    stages: ['city'],
    active: false,
  },
  survey: {
    name: '比较调查',
    effect: '星海后续环境扫描时间从5秒减为3.5秒',
    stages: ['space'],
    active: false,
  },
  navigator: {
    name: '航路记忆',
    effect: '星海航行少用1燃料，仍至少消耗1燃料',
    stages: ['space'],
    active: false,
  },
};
type Discovery = {
  skill: LearnedSkill;
  stage: LifeStage;
  method: 'hunt' | 'observe' | 'bond' | 'practice' | 'explore';
  name: string;
};
export const DISCOVERIES: Record<string, Discovery> = {
  'pond:dart': {
    skill: 'jet',
    stage: 'pond',
    method: 'hunt',
    name: '流鞭微生物',
  },
  'pond:shield': {
    skill: 'ward',
    stage: 'pond',
    method: 'hunt',
    name: '甲泡微生物',
  },
  'pond:feather': {
    skill: 'gather',
    stage: 'pond',
    method: 'hunt',
    name: '绒羽微生物',
  },
  'pond:hunter': {
    skill: 'ward',
    stage: 'pond',
    method: 'hunt',
    name: '池塘捕食者',
  },
  'ocean:swim-observe': {
    skill: 'jet',
    stage: 'ocean',
    method: 'observe',
    name: '海洋生物避开威胁的运动',
  },
  'ocean:reserve-observe': {
    skill: 'gather',
    stage: 'ocean',
    method: 'observe',
    name: '海洋生物沿补给点迁行',
  },
  'ocean:swift': {
    skill: 'jet',
    stage: 'ocean',
    method: 'hunt',
    name: '海洋迅游生物',
  },
  'ocean:shell': {
    skill: 'ward',
    stage: 'ocean',
    method: 'hunt',
    name: '海洋甲壳生物',
  },
  'ocean:filter': {
    skill: 'gather',
    stage: 'ocean',
    method: 'observe',
    name: '海洋滤食生物',
  },
  'ocean:armor-observe': {
    skill: 'ward',
    stage: 'ocean',
    method: 'observe',
    name: '海洋防御行为',
  },
  'ocean:carry-observe': {
    skill: 'gather',
    stage: 'ocean',
    method: 'observe',
    name: '海洋搬运行为',
  },
  'shore:shellbed': {
    skill: 'ward',
    stage: 'shore',
    method: 'hunt',
    name: '退潮贝床',
  },
  'shore:friend': {
    skill: 'jet',
    stage: 'shore',
    method: 'bond',
    name: '潮池同行者',
  },
  'land:fern': {
    skill: 'gather',
    stage: 'land',
    method: 'observe',
    name: '蕨尾兽的觅食',
  },
  'land:grazer': {
    skill: 'jet',
    stage: 'land',
    method: 'observe',
    name: '果角兽的步态',
  },
  'land:friend': {
    skill: 'ward',
    stage: 'land',
    method: 'bond',
    name: '陆地同行者',
  },
  'land:meal': {
    skill: 'jet',
    stage: 'land',
    method: 'hunt',
    name: '亲手捕获并吃下的猎物',
  },
  'colony:care': {
    skill: 'nurture',
    stage: 'colony',
    method: 'practice',
    name: '三次真实养育',
  },
  'colony:shelter': {
    skill: 'weaving',
    stage: 'colony',
    method: 'practice',
    name: '亲手编筑育幼棚',
  },
  'colony:repair': {
    skill: 'masonry',
    stage: 'colony',
    method: 'practice',
    name: '暴雨中亲手修棚',
  },
  'tribe:basket': {
    skill: 'weaving',
    stage: 'tribe',
    method: 'practice',
    name: '亲手制作编篮',
  },
  'tribe:hammer': {
    skill: 'masonry',
    stage: 'tribe',
    method: 'practice',
    name: '亲手制作石锤',
  },
  'city:delivery': {
    skill: 'logistics',
    stage: 'city',
    method: 'practice',
    name: '真实物资送达',
  },
  'space:beacon': {
    skill: 'navigator',
    stage: 'space',
    method: 'explore',
    name: '航行抵达灯塔站',
  },
  'space:survey': {
    skill: 'survey',
    stage: 'space',
    method: 'explore',
    name: '完成同一星球的两项扫描',
  },
};
export type LearningState = {
  entries: { source: string; time: number; generation: number }[];
  credits: number;
  learned: LearnedSkill[];
  equipped: LearnedSkill | null;
  cooldown: number;
  active: number;
};
export type LearningBearer = {
  learning?: LearningState;
  mode?: string;
  time?: number;
  generation?: number;
};
export function learnFrom(s: LearningBearer, source: string): boolean {
  if (!Object.hasOwn(DISCOVERIES, source)) return false;
  const discovery = DISCOVERIES[source];
  if (!discovery || s.mode !== 'running') return false;
  const l = (s.learning ??= {
    entries: [],
    credits: 0,
    learned: [],
    equipped: null,
    cooldown: 0,
    active: 0,
  });
  if (l.entries.some((e) => e.source === source)) return false;
  const known = l.entries.some(
    (e) => DISCOVERIES[e.source].skill === discovery.skill,
  );
  l.entries.push({ source, time: s.time ?? 0, generation: s.generation ?? 1 });
  if (!known) l.credits += 2;
  return true;
}
export function inheritedLearning(
  s: LearningBearer,
): LearningState | undefined {
  if (!s.learning) return undefined;
  return { ...structuredClone(s.learning), cooldown: 0, active: 0 };
}
export function knowsSkill(s: LearningBearer, id: LearnedSkill) {
  return !!s.learning?.entries.some((e) => DISCOVERIES[e.source]?.skill === id);
}
export function learningBonus(
  s: LearningBearer,
  id: LearnedSkill,
  stage: LifeStage,
) {
  return (
    s.learning?.equipped === id &&
    s.learning.learned.includes(id) &&
    knowsSkill(s, id) &&
    LEARNED_SKILLS[id].stages.includes(stage)
  );
}
export function selectLearnedSkill(
  s: LearningBearer,
  id: LearnedSkill | null,
  stage: LifeStage,
): boolean {
  if (
    ['dead', 'lost'].includes(s.mode ?? '') ||
    !s.learning ||
    s.learning.active > 0 ||
    (id !== null &&
      (!Object.hasOwn(LEARNED_SKILLS, id) ||
        !LEARNED_SKILLS[id].stages.includes(stage) ||
        !knowsSkill(s, id)))
  )
    return false;
  const l = s.learning;
  if (l.equipped === id) return false;
  if (id !== null && !l.learned.includes(id)) {
    if (l.credits < 1) return false;
    l.credits--;
    l.learned.push(id);
  }
  l.equipped = id; // Preserve cooldown when changing a loadout; it cannot reset an active ability.
  return true;
}
export function stepLearning(w: World, activate: boolean, dt: number) {
  if (
    w.mode !== 'running' ||
    revealing(w) ||
    w.ocean?.morph ||
    w.shore?.morph ||
    w.land?.morph
  )
    return;
  const l = w.learning;
  if (l) {
    l.cooldown = Math.max(0, l.cooldown - dt);
    l.active = Math.max(0, l.active - dt);
  }
  if (!activate) return;
  if (activate) {
    const blocked = learnedSkillGate(w);
    if (blocked) {
      w.notice = blocked;
      w.noticeUntil = w.time + 3;
      return;
    }
  }
  if (!l) return;
  const id = l.equipped;
  if (!id) return;
  w.player.energy -= 12;
  l.cooldown = 8;
  l.active = id === 'gather' ? 4 : 2;
  w.notice = `${LEARNED_SKILLS[id].name} · 能量 -12`;
  w.noticeUntil = w.time + 3;
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5;
    w.particles.push({
      x: w.player.x,
      y: w.player.y,
      vx: Math.cos(a) * 65,
      vy: Math.sin(a) * 65,
      life: 0.5,
      color: '#c7e8b9',
    });
  }
  if (id === 'ward')
    w.player.invulnerable = Math.max(w.player.invulnerable, 1.5);
}
export function learnedSkillGate(w: World): string | null {
  if (w.mode !== 'running') return '暂停中，继续探索后使用能力。';
  if (revealing(w) || w.ocean?.morph || w.shore?.morph || w.land?.morph)
    return '身体正在蜕变 · 揭示完成后再使用。';
  if (w.player.health <= 0) return '生命已结束，恢复后再使用能力。';
  const id = w.learning?.equipped;
  if (!id || !LEARNED_SKILLS[id].active || !learningBonus(w, id, w.habitat))
    return '先在下一代面板学会并装备一种能力。';
  if (w.learning!.cooldown > 0)
    return `能力恢复中 · 等 ${Math.ceil(w.learning!.cooldown)} 秒。`;
  if (w.player.energy < 12) return '需要 12 能量 · 先觅食恢复。';
  return null;
}
export function biologicalBonus(w: World) {
  const active = (w.learning?.active ?? 0) > 0;
  return {
    speed: active && learningBonus(w, 'jet', w.habitat) ? 1.25 : 1,
    pickup: active && learningBonus(w, 'gather', w.habitat) ? 22 : 0,
  };
}
export function validLearning(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const l = value as LearningState;
  if (
    !Array.isArray(l.entries) ||
    l.entries.length > Object.keys(DISCOVERIES).length ||
    !Number.isSafeInteger(l.credits) ||
    l.credits < 0 ||
    l.credits > l.entries.length * 2 ||
    !Number.isFinite(l.cooldown) ||
    l.cooldown < 0 ||
    l.cooldown > 8 ||
    !Number.isFinite(l.active) ||
    l.active < 0 ||
    l.active > 4
  )
    return false;
  const skills = new Set<LearnedSkill>();
  const sources = new Set<string>();
  for (const e of l.entries) {
    if (
      !e ||
      !Object.hasOwn(DISCOVERIES, e.source) ||
      !Number.isFinite(e.time) ||
      e.time < 0 ||
      !Number.isSafeInteger(e.generation) ||
      e.generation < 1
    )
      return false;
    const id = DISCOVERIES[e.source].skill;
    if (sources.has(e.source)) return false;
    sources.add(e.source);
    skills.add(id);
  }
  if (
    !Array.isArray(l.learned) ||
    new Set(l.learned).size !== l.learned.length ||
    l.learned.some((id) => !skills.has(id))
  )
    return false;
  if (l.credits !== skills.size * 2 - l.learned.length) return false;
  return l.equipped === null || l.learned.includes(l.equipped);
}
