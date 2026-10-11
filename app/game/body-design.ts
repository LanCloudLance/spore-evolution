import { inheritedDna } from './dna-evolution.ts';
import { inheritedLearning, learnFrom } from './lineage-learning.ts';
import { organTouches } from './body-geometry.ts';
import { beginEvolution } from './evolution-experience.ts';
import type { World, Vec } from './simulation.ts';
import { announce, distance } from './simulation.ts';
import { OCEAN_NURSERY } from './ocean.ts';
import { bodyRadius } from './food-chain.ts';
import {
  listOrgans,
  hasOrgan,
  installedCost,
  editCost,
  layoutSignature,
  validateLayout,
  organAnchor,
  ORGAN_COSTS,
} from './body-layout.ts';
import type { TidalAction } from './tidal/types.ts';
import type { OrganPlacement, BodyAppearance } from './body-layout.ts';
export type Organ =
  | 'jaw'
  | 'fin'
  | 'spine'
  | 'filter'
  | 'shell'
  | 'grasp'
  | 'lateral'
  | 'reserve'
  | 'sail'
  | 'ink'
  | 'glow'
  | 'anchor';
export type Slot = 'front' | 'left' | 'right' | 'tail';
export type BodyDesign = {
  legs?: number;
  length: number;
  width: number;
  organs: Partial<Record<Slot, Organ>>;
  placements?: OrganPlacement[];
  appearance?: BodyAppearance;
};
export const SLOTS: Slot[] = ['front', 'left', 'right', 'tail'];
export const SLOT_NAMES: Record<Slot, string> = {
  front: '头部',
  left: '左侧',
  right: '右侧',
  tail: '尾部',
};
export const SLOT_ANGLES: Record<Slot, number> = {
  front: 0,
  left: -Math.PI / 2,
  right: Math.PI / 2,
  tail: Math.PI,
};
export const ORGANS: Record<
  Organ,
  { name: string; cost: number; hint: string; source: string }
> = {
  jaw: {
    name: '捕食口',
    cost: 4,
    hint: '嘴朝向猎物才能吞食；每张嘴增加耗能',
    source: '初始拥有',
  },
  fin: {
    name: '游泳鳍',
    cost: 3,
    hint: '尾鳍加速，侧鳍改善转向；增加耗能',
    source: '初始拥有',
  },
  spine: {
    name: '防御长刺',
    cost: 8,
    hint: '只阻挡装有长刺方向的接触；游速降低',
    source: '观察海草外缘的棘尾生物',
  },
  filter: {
    name: '滤食扇',
    cost: 6,
    hint: '扩大浮游食物摄取范围；不能吞食活鱼',
    source: '观察透光区的滤食生物',
  },
  shell: {
    name: '折叠甲壳',
    cost: ORGAN_COSTS.shell,
    hint: '缩壳减伤，期间移动慢且不能取食',
    source: '见证壳背螺缩壳挡下攻击',
  },
  grasp: {
    name: '抓握触肢',
    cost: ORGAN_COSTS.grasp,
    hint: '搬运一件食物，用于投饵或河口交付',
    source: '见证苔冠蟹搬运藻团',
  },
  lateral: {
    name: '侧线感受带',
    cost: ORGAN_COSTS.lateral,
    hint: '感受附近水纹，高速时噪声缩小范围',
    source: '见证银梭鱼避开草后威胁',
  },
  reserve: {
    name: '储能囊',
    cost: ORGAN_COSTS.reserve,
    hint: '储存进食溢出的能量，远行时主动释放',
    source: '见证彩鳍鱼沿补给点迁行',
  },
  sail: {
    name: '借流帆鳍',
    cost: 7,
    hint: '宽帆缓冲洋流推力，宽膜增加维持成本',
    source: '伏沙刷鳐或大型鳐的祖源',
  },
  ink: {
    name: '遮蔽墨囊',
    cost: 8,
    hint: '短时墨云驱离近身威胁，消耗16能量',
    source: '虹吸裙水母或漂光水母的祖源',
  },
  glow: {
    name: '发光组织',
    cost: 5,
    hint: '显出附近颗粒，同时增加被察觉的风险',
    source: '暖泉管虫或漂光水母的祖源',
  },
  anchor: {
    name: '锚定触须',
    cost: 6,
    hint: '锚定时抵消大部分水流，移动很慢',
    source: '暖泉管虫或穴居盾蟹的祖源',
  },
};
export const freshBody = (): BodyDesign => ({
  length: 1,
  width: 1,
  organs: { front: 'jaw', left: 'fin', right: 'fin' },
});
export const designCost = (b: BodyDesign) => 8 + installedCost(b);
export function bodyEffects(b: BodyDesign) {
  const organs = listOrgans(b);
  const fins = organs.filter((p) => p.organ === 'fin');
  const spines = organs.filter((p) => p.organ === 'spine').length;
  return {
    speed:
      1 +
      (b.length - 1) * 0.24 -
      (b.width - 1) * 0.24 +
      (fins.some((p) => p.mount === 'tail') ? 0.16 : 0) -
      spines * 0.05,
    turn: Math.max(
      0.55,
      1 -
        (b.length - 1) * 0.5 +
        fins.filter((p) => p.mount === 'left' || p.mount === 'right').length *
          0.08,
    ),
    metabolism: 1 + Math.max(0, b.width - 1) * 0.3 + organs.length * 0.04,
    damage: 1 / b.width,
    pickup: (hasOrgan(b, 'filter') ? 35 : 0) + (hasOrgan(b, 'glow') ? 12 : 0),
  };
}
export const bodyBirthCost = (w: World, b: BodyDesign) =>
  w.ocean?.tidal?.compat.mode === 'active'
    ? editCost(w.ocean.body, b)
    : designCost(b);
export function bodyEditGate(w: World) {
  if (!w.ocean || !['running', 'paused'].includes(w.mode))
    return '先继续海洋探索。';
  if (w.ocean.morph) return '等待新身体形成。';
  if (distance(w.player, OCEAN_NURSERY) > OCEAN_NURSERY.radius)
    return '回海草育生地改造下一代。';
  return '';
}
export function validateDesign(w: World, b: BodyDesign, maturing = false) {
  if (!w.ocean) return '先进入海洋。';
  if (
    !Number.isFinite(b.length) ||
    !Number.isFinite(b.width) ||
    b.length < 0.8 ||
    b.length > 1.5 ||
    b.width < 0.7 ||
    b.width > 1.3
  )
    return '身体尺寸超出范围。';
  const layoutError = validateLayout(b);
  if (layoutError) return layoutError;
  const entries = listOrgans(b);
  if (entries.some((p) => !w.ocean!.discovered.includes(p.organ)))
    return '需要先发现这个器官。';
  if (
    !(w.ocean.tidal?.compat.mode === 'active' && w.ocean.branch === 'radial') &&
    !entries.some((p) => p.organ === 'jaw' || p.organ === 'filter')
  )
    return '至少保留一个捕食口或滤食扇。';
  const same =
    w.ocean.tidal?.compat.mode === 'active'
      ? layoutSignature(b) === layoutSignature(w.ocean.body) &&
        b.length === w.ocean.body.length &&
        b.width === w.ocean.body.width &&
        (b.legs ?? 1) === (w.ocean.body.legs ?? 1) &&
        ['base', 'accent', 'pattern'].every(
          (k) =>
            b.appearance?.[k as keyof BodyAppearance] ===
            w.ocean!.body.appearance?.[k as keyof BodyAppearance],
        )
      : JSON.stringify(b) === JSON.stringify(w.ocean.body);
  if (same && !(maturing && w.ocean.tier < 2))
    return '调整身体或器官后再孕育。';
  if (w.ocean.dna < bodyBirthCost(w, b))
    return `还需要 ${bodyBirthCost(w, b) - w.ocean.dna} DNA。`;
  return '';
}
export function commitBody(
  w: World,
  b: BodyDesign,
  slots?: [TidalAction | null, TidalAction | null],
  maturing = false,
) {
  if (bodyEditGate(w) || validateDesign(w, b, maturing)) return false;
  const o = w.ocean!;
  const knownActions = [
    'form-skill',
    ...(hasOrgan(b, 'filter') || o.branch === 'radial' ? ['filter'] : []),
    ...(['shell', 'grasp', 'reserve', 'ink', 'anchor'] as const).filter((p) =>
      hasOrgan(b, p),
    ),
  ];
  if (
    slots &&
    (!o.tidal ||
      slots.length !== 2 ||
      slots.some((a) => a !== null && !knownActions.includes(a)) ||
      (slots[0] !== null && slots[0] === slots[1]))
  )
    return false;
  w.history.push({
    generation: w.generation,
    form: w.form,
    habitat: w.habitat,
    ...(w.learning ? { learning: inheritedLearning(w) } : {}),
    ...(w.dnaLineage ? { dnaLineage: inheritedDna(w) } : {}),
    traits: [...w.traits],
    food: w.food,
    seconds: w.age,
    body: structuredClone(o.body),
  });
  const newlyActive = (
    ['filter', 'shell', 'grasp', 'reserve', 'ink', 'anchor'] as const
  ).filter((p) => hasOrgan(b, p) && !hasOrgan(o.body, p));
  o.dna -= bodyBirthCost(w, b);
  o.body = structuredClone(b);
  w.generation++;
  w.age = 0;
  // Editing preserves chapter food and growth, so experimentation never resets the journey.
  w.mode = 'running';
  o.morph = { from: w.form, to: w.form, elapsed: 0, duration: 3.6 };
  w.player.invulnerable = 3;
  w.player.vx = w.player.vy = 0;
  announce(w, '新一代诞生！试试嘴的朝向和长刺的防御方向。');
  beginEvolution(w, 'anatomy');
  if (o.tidal?.compat.mode === 'active') {
    const a = o.tidal.abilities;
    a.slots = slots
      ? [...slots]
      : (a.slots.map((action) =>
          action && knownActions.includes(action) ? action : null,
        ) as [TidalAction | null, TidalAction | null]);
    if (!slots)
      for (const action of newlyActive) {
        const empty = a.slots.indexOf(null);
        if (empty >= 0 && !a.slots.includes(action)) a.slots[empty] = action;
      }
    if (!hasOrgan(b, 'anchor')) a.anchored = false;
    if (!hasOrgan(b, 'ink')) a.inkSeconds = 0;
    if (!hasOrgan(b, 'reserve')) o.tidal.abilities.reserveEnergy = 0;
    o.tidal.abilities.filterOpen = false;
    o.tidal.abilities.shellSeconds = 0;
    if (!hasOrgan(b, 'grasp') && o.tidal.abilities.carriedId) {
      const f = o.tidal.foods.find(
        (f) => f.id === o.tidal!.abilities.carriedId,
      );
      if (f) {
        f.state = 'available';
        f.owner = null;
        f.x = w.player.x;
        f.y = w.player.y;
      }
      o.tidal.abilities.carriedId = null;
    }
    // Relocate a few existing, available nursery particles; no new resources or rewards.
    o.tidal.foods
      .filter((f) => f.state === 'available' && f.biome === 'nursery')
      .slice(0, 3)
      .forEach((f, i) => {
        f.x = w.player.x + Math.cos(w.player.angle) * (65 + i * 18);
        f.y = w.player.y + Math.sin(w.player.angle) * (65 + i * 18);
      });
  }
  return true;
}
export function organFaces(w: World, target: Vec, organ: Organ) {
  const b = w.ocean?.body;
  if (!b) return organ === 'jaw';
  const d = distance(w.player, target);
  const a = Math.atan2(target.y - w.player.y, target.x - w.player.x);
  return listOrgans(b).some((part) => {
    const anchor = organAnchor(
      { ...w.player, body: b, size: 36, form: w.form },
      part,
    );
    const direction = Math.atan2(anchor.y - w.player.y, anchor.x - w.player.x);
    return (
      part.organ === organ &&
      (d < bodyRadius(w) * 0.25 || Math.cos(a - direction) > 0.5)
    );
  });
}
export function bodyExtent(w: World, target: Vec) {
  const b = w.ocean?.body;
  if (!b) return bodyRadius(w);
  const a =
    Math.atan2(target.y - w.player.y, target.x - w.player.x) - w.player.angle;
  return (
    bodyRadius(w) / Math.hypot(Math.cos(a) / b.length, Math.sin(a) / b.width)
  );
}
export function blockWithSpine(
  w: World,
  enemy: Vec & { stun: number; bite?: number },
  radius: number,
) {
  const o = w.ocean;
  if (
    !o ||
    enemy.stun > 0 ||
    !organTouches(
      { ...w.player, form: w.form, size: bodyRadius(w), body: o.body },
      { ...enemy, radius: radius * 0.8 },
      'spine',
    )
  )
    return false;
  enemy.stun = 2.4;
  enemy.bite = 0;
  const d = Math.max(1, distance(w.player, enemy));
  enemy.x += ((enemy.x - w.player.x) / d) * 24;
  enemy.y += ((enemy.y - w.player.y) / d) * 24;
  o.blocks++;
  o.defenseFlash = 0.65;
  announce(
    w,
    o.blocks === 1
      ? '设计验证成功：长刺挡住了这个方向的捕食者！'
      : '长刺命中！趁它退缩，拉开距离。',
  );
  return true;
}
export const SPECIMENS: { organ: Organ; name: string; x: number; y: number }[] =
  [
    { organ: 'spine', name: '棘尾生物', x: 730, y: 1320 },
    { organ: 'filter', name: '滤食生物', x: 1200, y: 650 },
  ];
export function stepDiscovery(w: World, dt: number) {
  const o = w.ocean!;
  if (o.tidal?.compat.mode === 'active') return;
  o.defenseFlash = Math.max(0, o.defenseFlash - dt);
  for (const s of SPECIMENS) {
    if (o.discovered.includes(s.organ)) continue;
    if (distance(w.player, s) < 115) {
      o.observation[s.organ] = Math.min(2, (o.observation[s.organ] ?? 0) + dt);
      if (o.observation[s.organ]! >= 2) {
        o.discovered.push(s.organ);
        learnFrom(
          w,
          s.organ === 'filter' ? 'ocean:filter' : 'ocean:armor-observe',
        );
        o.dna += 16;
        announce(
          w,
          `发现${ORGANS[s.organ].name}！获得 16 DNA。返回育生地，把它装在新身体上。`,
        );
      }
    }
  }
}
export function discoveryHint(w: World) {
  const o = w.ocean!;
  if (!o.discovered.includes('spine'))
    return '寻找东北方的金色棘尾生物，靠近观察 2 秒';
  if (!hasOrgan(o.body, 'spine')) return '回育生地改造：选中尾部，装上防御长刺';
  if (o.blocks === 0) return '用装有长刺的一侧迎向捕食者，验证你的设计';
  return '防御设计已验证 · 继续发现器官，尝试新的身体';
}
