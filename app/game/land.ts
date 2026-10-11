import {
  isLandPredator,
  LAND_SPECIES,
  landSpecies,
  type LandFeature,
  type LandSpecies,
} from './land-catalog.ts';
export type { LandSpecies } from './land-catalog.ts';
import {
  hasLandFeature,
  inFeatureShelter,
  stepLandFeatures,
  landFeatureSpeed,
  landFeatureMetabolism,
  activeLandFeature,
  activateLandFeature,
} from './land-features.ts';
import { landEcologyGoal, stepLandEcology, landArea } from './land-ecology.ts';
import { inheritedDna, ingestBiologicalDna } from './dna-evolution.ts';
import {
  biologicalBonus,
  inheritedLearning,
  learnFrom,
} from './lineage-learning.ts';
import { adaptationsOf, hasAdaptation } from './life-adaptations.ts';
import {
  constrainBody,
  trunkTouches,
  organTouches,
  worldBodyPose,
} from './body-geometry.ts';
import { beginEvolution } from './evolution-experience.ts';
import { companionSlot, separateNeighbors } from './readability.ts';
import { rememberGeneration } from './lineage.ts';
import { commandCompanions, stepCompanionTask } from './companions.ts';
import {
  creatureHealth,
  inLandCover,
  strikePrey,
  sweepPounce,
  eatMeat,
} from './land-hunt.ts';
import type { Meat } from './land-hunt.ts';
import { announce, createWorld, distance, getStats } from './simulation.ts';
import type { Ancestor, Input, Vec, World } from './simulation.ts';
import type { BodyForm } from './forms.ts';
import { FORMS } from './forms.ts';
import { bodyEffects, freshBody } from './body-design.ts';
import { layoutSignature } from './body-layout.ts';
import type { BodyDesign } from './body-design.ts';
import { face, glide } from './motion.ts';
import {
  droughtLegacy,
  droughtTarget,
  droughtInteraction,
  performDroughtInteraction,
  stepLandDrought,
  landWet,
  droughtDry,
  droughtSheltered,
  droughtFoodRate,
  droughtHarvest,
} from './land-drought.ts';
import type { LandDrought } from './land-drought.ts';
export {
  startLandDrought,
  chooseDroughtStrategy,
  trackDrought,
} from './land-drought.ts';

export type LandChoice = 'strider' | 'stalker' | 'crest' | 'plates';
export type LandFocus = 'wander' | 'companions' | 'hunt' | 'garden' | 'settle';
export type LandWay = 'companions' | 'hunt' | 'garden' | 'migration';
export const LAND_WAY_NAMES: Record<LandWay, string> = {
  companions: '结伴探索',
  hunt: '伏击捕猎',
  garden: '经营果丛',
  migration: '水源迁徙',
};
export type LandCreature = Vec & {
  id: number;
  species: LandSpecies;
  shoreOrigin?: number;
  home: Vec;
  angle: number;
  health: number;
  friendship: number;
  joined: boolean;
  respawn: number;
  stun: number;
  trustCooldown: number;
  alert: boolean;
  flash: number;
  task: 'follow' | 'forage' | 'return';
  targetFood: number | null;
  carrying: number;
  reaction: number;
  suspicion: number;
  escape: number;
};
export type LandCheckpoint = {
  startingTier?: 0 | 1 | 2;
  organ?: 'crest' | 'plates' | null;
  features?: LandFeature[];
  learning?: import('./lineage-learning.ts').LearningState;
  dnaLineage?: import('./dna-evolution.ts').DnaLineage;
  adaptations?: import('./life-adaptations.ts').Adaptation[];
  tidalLegacy?: World['tidalLegacy'];
  seed: number;
  generation: number;
  time: number;
  age?: number;
  totalFood: number;
  history: Ancestor[];
  traits: World['traits'];
  form: BodyForm;
  body: BodyDesign;
  biomass: number;
  protection: 'reservoir' | 'skin' | null;
  standalone: boolean;
  shoreCompanions?: number[];
};
export type SeedAction = 'eat' | 'plant' | 'water';
export type LandSeed = {
  stage: 'unseen' | 'seen' | 'carried' | 'eaten' | 'planted';
  nest: number | null;
  waters: number;
  cooldown: number;
};
export type LandState = {
  features?: LandFeature[];
  activeFeature?: LandFeature;
  featureCooldown?: number;
  featureActive?: number;
  cachedFood?: number;
  sifting?: boolean;
  camps?: (Vec & { life: number })[];
  ecology?: Partial<Record<number, number>>;
  adaptations?: import('./life-adaptations.ts').Adaptation[];
  focus?: LandFocus;
  destination?: number;
  groveHarvests?: number[];
  drought?: LandDrought;
  seedPod?: LandSeed;
  checkpoint: LandCheckpoint;
  body: BodyDesign;
  biomass: number;
  protection: LandCheckpoint['protection'];
  moisture: number;
  nests: number[];
  visited: string[];
  discovered: LandSpecies[];
  observation: Partial<Record<LandSpecies, number>>;
  creatures: LandCreature[];
  tier: 0 | 1 | 2;
  organ: 'crest' | 'plates' | null;
  hunts: number;
  skillCooldown: number;
  skillActive: number;
  morph: {
    from: BodyForm;
    fromBody?: BodyDesign;
    elapsed: number;
    duration: number;
  } | null;
  impact: number;
  sneaking: boolean;
  nutrition: number;
  meat: Meat[];
  meatId: number;
  stolen: number;
  pounce: {
    angle: number;
    remaining: number;
    hit: boolean;
    ambush: boolean;
  } | null;
};
export const LAND_MAP = { width: 2900, height: 1950 };
export const LAND_NESTS = [
  { x: 450, y: 1450, radius: 150, name: '树根之家' },
  { x: 1300, y: 930, radius: 125, name: '蕨影驿巢' },
  { x: 2470, y: 500, radius: 150, name: '溪畔新家' },
];
export const LAND_AREAS = [
  { x: 1060, y: 620, radius: 320, name: '蕨叶聚落', species: 'fern' as const },
  {
    x: 2010,
    y: 1320,
    radius: 370,
    name: '日光果甸',
    species: 'grazer' as const,
  },
  {
    x: 620,
    y: 500,
    radius: 255,
    name: '晨露芦泽',
    species: 'reed-runner' as const,
  },
  {
    x: 1120,
    y: 1630,
    radius: 235,
    name: '穴巢荒坡',
    species: 'burrow-mole' as const,
  },
  {
    x: 2450,
    y: 490,
    radius: 240,
    name: '风帆山脊',
    species: 'sail-glider' as const,
  },
  {
    x: 2370,
    y: 1560,
    radius: 240,
    name: '刺叶旱原',
    species: 'spine-hedgehog' as const,
  },
];
export const LAND_PONDS = [
  { x: 620, y: 1130, radius: 85 },
  { x: 1790, y: 810, radius: 95 },
  { x: 2540, y: 310, radius: 100 },
];
export const LAND_ROCKS = [
  { x: 800, y: 960, radius: 58 },
  { x: 1580, y: 1210, radius: 70 },
  { x: 2200, y: 710, radius: 64 },
];
export const SPECIES_NAMES = Object.fromEntries(
  LAND_SPECIES.map((s) => [s.id, s.name]),
) as Record<LandSpecies, string>;
export const LAND_SEED = { x: 1580, y: 910, name: '月露荚' };
export const GROVE_FOOD_ID = 1000;
const newSeed = (): LandSeed => ({
  stage: 'unseen',
  nest: null,
  waters: 0,
  cooldown: 0,
});
export function seedPlot(w: World): Vec | null {
  const seed = w.land?.seedPod;
  if (seed?.stage !== 'planted' || seed.nest == null) return null;
  const nest = LAND_NESTS[seed.nest];
  return nest ? { x: nest.x + 85, y: nest.y - 45 } : null;
}
export function canPickSeed(w: World) {
  const stage = w.land?.seedPod?.stage ?? 'unseen';
  return (
    !!w.land &&
    ['unseen', 'seen'].includes(stage) &&
    distance(w.player, LAND_SEED) < 75
  );
}
export function seedActionGate(w: World, action: SeedAction) {
  const s = w.land,
    seed = s?.seedPod;
  if (!s || w.mode !== 'running' || s.morph) return '先继续探索。';
  if (action === 'water') {
    const plot = seedPlot(w);
    if (!plot || !seed || seed.waters >= 3) return '没有需要浇灌的幼苗。';
    if (distance(w.player, plot) > 140) return '回到种下幼苗的巢穴旁。';
    if (seed.cooldown > 0)
      return `等 ${Math.ceil(seed.cooldown)} 秒，让水分渗入根部。`;
    if (s.moisture < 20) return '先恢复至少20点湿润度，留一点水分给自己。';
    return '';
  }
  if (seed?.stage !== 'carried')
    return '先在蕨影驿巢以东找到月露荚，靠近按 K 拾取。';
  if (action === 'plant') {
    const n = nearNest(w);
    if (n < 0 || !s.nests.includes(n)) return '带回已经建好的巢穴再种下。';
    if (w.food < 2) return '种植需要2份食物作为养分。';
  }
  return '';
}
export function applyLandSeed(w: World, action: SeedAction) {
  if (!['eat', 'plant', 'water'].includes(action)) return false;
  const gate = seedActionGate(w, action);
  if (gate) {
    if (w.land && w.mode === 'running') announce(w, gate);
    return false;
  }
  const s = w.land!,
    seed = s.seedPod!;
  if (action === 'eat') {
    seed.stage = 'eaten';
    w.food += 6;
    w.totalFood += 6;
    w.player.energy = Math.min(landStats(w).maxEnergy, w.player.energy + 30);
    announce(w, '吃下月露荚：获得6份食物和能量。这枚种荚不能再种下了。');
  } else if (action === 'plant') {
    w.food -= 2;
    seed.stage = 'planted';
    seed.nest = nearNest(w);
    announce(
      w,
      '月露幼苗种下了。靠近浇灌3次，每次消耗15湿润度；成熟后可带种苗走向族群生活。',
    );
  } else {
    s.moisture -= 15;
    seed.waters++;
    seed.cooldown = 6;
    const plot = seedPlot(w)!;
    burst(w, plot, '#c9e69f');
    if (seed.waters === 3) {
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        w.foods.push({
          id: GROVE_FOOD_ID + i,
          x: plot.x + Math.cos(a) * 65,
          y: plot.y + Math.sin(a) * 65,
          cooldown: 0,
          rich: true,
        });
      }
      announce(
        w,
        '月露果丛成熟了！4处果实会再生，伙伴也能采集。进入族群后，种苗会在新巢旁生长。',
      );
    } else
      announce(
        w,
        `浇灌 ${seed.waters}/3：幼苗舒展了新叶。等水分渗入时，可以采集附近果实或安排伙伴。`,
      );
  }
  return true;
}
export function landRadius(w: World) {
  return worldBodyPose(w).size;
}

export const nearNest = (w: World) =>
  LAND_NESTS.findIndex((n) => distance(w.player, n) < n.radius);
export const landFriends = (w: World) =>
  w.land!.creatures.filter((c) => c.joined).length;
export function landStats(w: World) {
  const s = w.land!,
    anatomy = bodyEffects(s.body),
    base = getStats(w.traits, w.form);
  return {
    ...base,
    speed:
      base.speed *
      anatomy.speed *
      (1 + ((s.body.legs ?? 1) - 1) * 0.25) *
      (s.organ === 'plates' ? 0.88 : 1) *
      biologicalBonus(w).speed,
    damage:
      (base.damage / 26) * anatomy.damage * (s.organ === 'plates' ? 0.6 : 1),
    metabolism:
      base.metabolism *
      anatomy.metabolism *
      (1 + Math.max(0, (s.body.legs ?? 1) - 1) * 0.35) *
      (hasAdaptation(s, 'skin') ? 1.1 : 1) *
      landFeatureMetabolism(s.features ?? []),
    turnRate: FORMS[w.form].turnRate * (hasLandFeature(w, 'thorns') ? 0.88 : 1),
    maxMoisture: hasAdaptation(s, 'reservoir') ? 150 : 100,
    pickup: 22 + anatomy.pickup + biologicalBonus(w).pickup,
  };
}
export function landZone(w: World) {
  return (
    LAND_AREAS.find((a) => distance(a, w.player) < a.radius)?.name ??
    (nearNest(w) >= 0 ? LAND_NESTS[nearNest(w)].name : '古蕨林地')
  );
}
function record(w: World): Ancestor {
  return {
    ...(w.land?.nests.includes(2) ? { landWays: landSettlementWays(w) } : {}),
    ...(droughtLegacy(w) ? { landLegacy: droughtLegacy(w) } : {}),
    generation: w.generation,
    form: w.form,
    habitat: 'land',
    ...(w.tidalLegacy ? { tidalLegacy: structuredClone(w.tidalLegacy) } : {}),
    ...(w.learning ? { learning: inheritedLearning(w) } : {}),
    ...(w.dnaLineage ? { dnaLineage: inheritedDna(w) } : {}),
    traits: [...w.traits],
    food: w.food,
    seconds: w.age,
    body: structuredClone(w.land!.body),
    adaptation: w.land!.protection ?? undefined,
    adaptations: adaptationsOf(w.land!),
    landOrgan: w.land!.organ ?? undefined,
    landFeatures: [...(w.land!.features ?? [])],
  };
}
export function createLandWorld(seed = 71, checkpoint?: LandCheckpoint): World {
  const cp: LandCheckpoint = checkpoint
    ? structuredClone(checkpoint)
    : {
        seed,
        generation: 1,
        time: 0,
        totalFood: 0,
        history: [],
        traits: [],
        form: 'crawler',
        body: freshBody(),
        biomass: 0,
        protection: 'skin',
        standalone: true,
      };
  const w = createWorld(cp.seed);
  w.learning = inheritedLearning(cp);
  w.dnaLineage = inheritedDna(cp);
  w.pondLife = undefined;
  Object.assign(w, {
    habitat: 'land',
    form: cp.form,
    mode: 'running',
    generation: cp.generation,
    time: cp.time,
    age: cp.age ?? 0,
    totalFood: cp.totalFood,
    traits: [...cp.traits],
    history: structuredClone(cp.history),
    foods: [],
    predators: [],
    explored: [],
  });
  if (cp.tidalLegacy) w.tidalLegacy = structuredClone(cp.tidalLegacy);
  w.player.x = LAND_NESTS[0].x;
  w.player.y = LAND_NESTS[0].y;
  w.player.energy = getStats(w.traits, w.form).maxEnergy * 0.9;
  w.land = {
    checkpoint: cp,
    features: cp.features ? [...cp.features] : undefined,
    activeFeature: cp.features?.find(activeLandFeature) ?? cp.features?.[0],
    ecology: {},
    seedPod: newSeed(),
    body: structuredClone(cp.body),
    biomass: cp.biomass,
    protection: cp.protection,
    adaptations: cp.adaptations ? [...cp.adaptations] : undefined,
    moisture: hasAdaptation(cp, 'reservoir') ? 150 : 100,
    nests: [],
    visited: [],
    discovered: [],
    observation: {},
    creatures: [],
    tier: cp.startingTier ?? 0,
    organ: cp.organ ?? null,
    hunts: 0,
    skillCooldown: 0,
    skillActive: 0,
    morph: null,
    impact: 0,
    sneaking: false,
    nutrition: 0,
    meat: [],
    meatId: 0,
    stolen: 0,
    pounce: null,
  };
  let state = cp.seed >>> 0;
  const rand = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const patches = [...LAND_NESTS, ...LAND_AREAS, ...LAND_PONDS];
  for (let i = 0; i < 180; i++) {
    const p = patches[i % patches.length],
      a = rand() * Math.PI * 2,
      r = 35 + rand() * (i % 8 < 3 ? 210 : 260);
    const food = {
      id: i,
      x: p.x + Math.cos(a) * r,
      y: p.y + Math.sin(a) * r,
      rich: i % 4 === 0,
      cooldown: 0,
    };
    if (!LAND_ROCKS.some((rock) => distance(rock, food) < rock.radius + 55))
      w.foods.push(food);
  }
  const homes: (Vec & { species: LandSpecies })[] = [
    { x: 1040, y: 650, species: 'fern' },
    { x: 1220, y: 520, species: 'fern' },
    { x: 890, y: 520, species: 'fern' },
    { x: 1980, y: 1290, species: 'grazer' },
    { x: 2200, y: 1400, species: 'grazer' },
    { x: 1850, y: 1450, species: 'grazer' },
    { x: 1580, y: 480, species: 'hunter' },
    { x: 2270, y: 980, species: 'hunter' },
  ];
  homes.push(
    ...LAND_SPECIES.slice(3).map((s) => ({ ...s.home, species: s.id })),
  );
  w.land.creatures = homes.map((h, id) => ({
    ...h,
    id,
    home: { x: h.x, y: h.y },
    angle: 0,
    health: landSpecies(h.species).health,
    friendship: 0,
    joined: false,
    respawn: 0,
    stun: 0,
    trustCooldown: 0,
    alert: false,
    flash: 0,
    task: 'follow',
    targetFood: null,
    carrying: 0,
    reaction: 0,
    suspicion: 0,
    escape: 3,
  }));
  for (const [i, shoreOrigin] of (cp.shoreCompanions ?? []).entries()) {
    const x = w.player.x - 70 - i * 38,
      y = w.player.y + 60;
    w.land.creatures.push({
      ...structuredClone(w.land.creatures[0]),
      id: homes.length + i,
      shoreOrigin,
      x,
      y,
      home: { x, y },
      joined: true,
      friendship: 3,
    });
  }
  announce(
    w,
    `来到古蕨林。${cp.shoreCompanions?.length ? `${cp.shoreCompanions.length} 位潮池旅伴随你抵达。` : ''}拾取果实，带 6 份食物回树根处按 K 建巢。`,
  );
  return w;
}
export function enterLand(w: World) {
  if (w.habitat !== 'shore' || w.mode !== 'won' || !w.shore) return false;
  const cp: LandCheckpoint = {
    ...(w.tidalLegacy ? { tidalLegacy: structuredClone(w.tidalLegacy) } : {}),
    seed: w.seed + 307,
    generation: w.generation,
    time: w.time,
    age: w.age,
    totalFood: w.totalFood,
    history: structuredClone(w.history),
    ...(w.learning ? { learning: inheritedLearning(w) } : {}),
    ...(w.dnaLineage ? { dnaLineage: inheritedDna(w) } : {}),
    traits: [...w.traits],
    form: w.form,
    body: structuredClone(w.shore.body),
    biomass: w.shore.biomass,
    protection: w.shore.protection,
    adaptations: adaptationsOf(w.shore),
    shoreCompanions: w.shore.creatures.filter((c) => c.joined).map((c) => c.id),
    standalone: false,
  };
  Object.assign(w, createLandWorld(cp.seed, cp));
  return true;
}
export const retryLand = (w: World) =>
  createLandWorld(w.land?.checkpoint.seed ?? w.seed, w.land?.checkpoint);
export function landEvolutionGate(w: World) {
  const s = w.land;
  if (!s || w.habitat !== 'land' || !['running', 'evolving'].includes(w.mode))
    return '先继续陆地探索。';
  if (s.morph) return '等待新的身体形成。';
  if (!s.nests.length) return '先带 6 份食物回树根处按 K 建巢。';
  if (!s.discovered.length)
    return '靠近蕨尾兽或果角兽观察 2 秒，发现陆地身体。';
  if (w.food < 10) return `孕育下一代还需 ${10 - w.food} 份食物。`;
  const n = nearNest(w);
  if (n < 0 || !s.nests.includes(n)) return '回已建立的巢穴，按 O 孕育下一代。';
  if (w.player.energy < 45) return '先在巢穴休息，恢复到 45 能量。';
  return '';
}
export function landDraftError(w: World, draft: BodyDesign) {
  if (!w.land) return '先进入陆地。';
  if (
    !Number.isFinite(draft.length) ||
    draft.length < 0.8 ||
    draft.length > 1.5 ||
    !Number.isFinite(draft.width) ||
    draft.width < 0.7 ||
    draft.width > 1.3 ||
    !Number.isFinite(draft.legs ?? 1) ||
    (draft.legs ?? 1) < 0.75 ||
    (draft.legs ?? 1) > 1.4
  )
    return '身体比例超出可生存范围。';
  if (layoutSignature(draft) !== layoutSignature(w.land.body))
    return '本次塑形保留已有器官。';
  return '';
}
export function evolveLand(w: World, choice: LandChoice, draft?: BodyDesign) {
  if (landEvolutionGate(w)) return false;
  const s = w.land!;
  if (
    !(
      s.tier === 0
        ? ['strider', 'stalker']
        : ['strider', 'stalker', 'crest', 'plates']
    ).includes(choice)
  )
    return false;
  if ((choice === 'crest' || choice === 'plates') && s.discovered.length < 2)
    return false;
  if (draft && landDraftError(w, draft)) return false;
  const fromBody = structuredClone(s.body);
  rememberGeneration(w.history, record(w));
  if (draft)
    s.body = {
      ...structuredClone(s.body),
      length: draft.length,
      width: draft.width,
      ...(draft.legs !== undefined ? { legs: draft.legs } : {}),
    };
  const from = w.form;
  if (choice === 'strider' || choice === 'stalker') {
    w.form = choice;
    s.tier = s.tier === 2 ? 2 : 1;
    if (choice === 'strider' && s.focus === 'hunt') s.focus = 'wander';
  } else {
    s.organ = choice;
    s.tier = 2;
  }
  w.generation++;
  w.age = 0;
  w.food -= 10;
  w.mode = 'running';
  w.player.health = 100;
  w.player.energy = getStats(w.traits, w.form).maxEnergy;
  w.player.vx = 0;
  w.player.vy = 0;
  s.moisture = landStats(w).maxMoisture;
  s.skillActive = 0;
  s.skillCooldown = 0;
  s.pounce = null;
  s.sneaking = false;
  s.morph = { from, fromBody, elapsed: 0, duration: 4.8 };
  announce(
    w,
    choice === 'strider'
      ? '身体被长足托起！J 发出呼唤，驱离猎手并与邻居建立信任。'
      : choice === 'stalker'
        ? '身体低伏，后肢蓄力！靠近小型生物按 J 扑猎，也仍然可以分享食物。'
        : '新的器官已经形成，试试不同的生存方式。',
  );
  beginEvolution(w, choice);
  return true;
}
export const nearbyLandCreature = (w: World) =>
  w.land?.creatures
    .filter(
      (c) =>
        c.species !== 'hunter' &&
        !c.joined &&
        c.respawn <= 0 &&
        distance(c, w.player) < 135,
    )
    .sort((a, b) => distance(a, w.player) - distance(b, w.player))[0];
export function landInteraction(w: World) {
  const s = w.land!,
    n = nearNest(w),
    c = nearbyLandCreature(w);
  const drought = droughtInteraction(w);
  if (drought && distance(w.player, drought.point) <= 140)
    return { label: drought.label, hint: drought.hint };
  if (canPickSeed(w))
    return { label: '拾起月露荚', hint: '稀有发现 · 吃下补给，或带回巢穴种植' };
  if (n === 2 && !s.nests.includes(2))
    return {
      label: '建立溪畔新家',
      hint: '新身体 · 两片区域 · 结伴、捕猎、果丛或迁徙 · 12 食物',
    };
  if (n >= 0 && !s.nests.includes(n))
    return { label: '用食物筑巢', hint: '6 份食物 · 安全休息和孕育下一代' };
  if (c)
    return {
      label: `与${SPECIES_NAMES[c.species]}分享`,
      hint:
        c.trustCooldown > 0
          ? `等 ${Math.ceil(c.trustCooldown)} 秒，再次示好`
          : `${s.organ === 'crest' ? 1 : 2} 食物 · 信任 ${c.friendship}/3`,
    };
  return { label: '分享食物 / 筑巢', hint: '靠近温和生物或空巢穴按 K' };
}
export function interactLand(w: World) {
  const s = w.land;
  if (!s || w.mode !== 'running' || s.morph) return false;
  const drought = droughtInteraction(w);
  if (drought && distance(w.player, drought.point) <= 140) {
    if (!performDroughtInteraction(w)) {
      announce(w, drought.hint);
      return false;
    }
    return true;
  }
  if (canPickSeed(w)) {
    s.seedPod ??= newSeed();
    s.seedPod.stage = 'carried';
    announce(
      w,
      '拾到了月露荚！现在吃掉可补充6食物，也可以带回巢穴种下，照料成长期果丛。',
    );
    return true;
  }
  const n = nearNest(w);
  if (n >= 0 && !s.nests.includes(n)) {
    if (
      n === 2 &&
      (!s.tier || s.visited.length < 2 || !landSettlementWays(w).length)
    ) {
      announce(
        w,
        '先孕育新身体、探索两片区域，再结伴2位、捕猎3次、照料并采收果丛，或完成水源迁移。',
      );
      return false;
    }
    const cost = n === 2 ? 12 : 6;
    if (w.food < cost) {
      announce(w, `筑巢还需要 ${cost - w.food} 份食物。`);
      return false;
    }
    w.food -= cost;
    s.nests.push(n);
    if (n === 2) {
      w.mode = 'won';
      rememberGeneration(w.history, record(w));
      announce(w, '溪畔新家建立了，新的生命正在巢中苏醒。');
    } else
      announce(
        w,
        '巢穴建好了！停下来恢复生命与能量，探索后回来按 O 孕育下一代。',
      );
    return true;
  }
  const c = nearbyLandCreature(w),
    cost = s.organ === 'crest' ? 1 : 2;
  if (!c) {
    announce(w, '靠近蕨尾兽或果角兽分享食物，或靠近空巢穴筑巢。');
    return false;
  }
  if (c.trustCooldown > 0) {
    announce(w, '邻居还在享用食物，稍等片刻再示好。');
    return false;
  }
  if (w.food < cost) {
    announce(w, `需要 ${cost} 份食物才能分享。`);
    return false;
  }
  w.food -= cost;
  befriend(w, c);
  return true;
}
function befriend(w: World, c: LandCreature) {
  c.friendship = Math.min(3, c.friendship + 1);
  c.trustCooldown = 3;
  c.health = creatureHealth(c);
  c.stun = 0;
  c.reaction = 2;
  if (c.friendship === 3) {
    c.joined = true;
    ingestBiologicalDna(w, `land:${c.species}`, 'symbiosis');
    learnFrom(w, 'land:friend');
    announce(
      w,
      `${SPECIES_NAMES[c.species]}加入同行！伙伴靠近时可以分担伤害。`,
    );
  } else
    announce(
      w,
      `${SPECIES_NAMES[c.species]}的信任 ${c.friendship}/3，再试着呼唤或分享。`,
    );
}
function burst(w: World, q: Vec, color: string) {
  for (let i = 0; i < 14; i++) {
    const a = (i * Math.PI * 2) / 14;
    w.particles.push({
      x: q.x,
      y: q.y,
      vx: Math.cos(a) * 90,
      vy: Math.sin(a) * 90,
      life: 0.7,
      color,
    });
  }
}
export function landSkill(w: World) {
  const s = w.land;
  if (
    !s ||
    w.mode !== 'running' ||
    s.morph ||
    s.skillCooldown > 0 ||
    w.player.energy < 12
  )
    return false;
  if (w.form === 'strider') {
    w.player.energy -= 12;
    s.skillCooldown = 5;
    s.skillActive = 1;
    for (const c of s.creatures)
      if (
        c.respawn <= 0 &&
        distance(c, w.player) < (s.organ === 'crest' ? 300 : 220)
      ) {
        c.reaction = 1.5;
        if (c.species === 'hunter') c.stun = 3.5;
        else if (!c.joined && c.trustCooldown <= 0) befriend(w, c);
      }
    burst(w, w.player, '#cfe8ad');
    return true;
  }
  const range = w.form === 'stalker' ? 240 : 110;
  const target = s.creatures
    .filter(
      (c) =>
        !c.joined &&
        c.respawn <= 0 &&
        distance(c, w.player) < range &&
        Math.cos(
          Math.atan2(c.y - w.player.y, c.x - w.player.x) - w.player.angle,
        ) > 0.15,
    )
    .sort((a, b) => distance(a, w.player) - distance(b, w.player))[0];
  if (!target) {
    announce(w, '朝向附近的小型生物再按 J；橙色猎手更难应付。');
    return false;
  }
  w.player.energy -= 12;
  s.skillCooldown = w.form === 'stalker' ? 2 : 2.8;
  s.skillActive = 0.4;
  if (w.form === 'stalker') {
    s.pounce = {
      angle: w.player.angle,
      remaining: 0.32,
      hit: false,
      ambush: s.sneaking && target.suspicion < 0.65,
    };
    w.player.invulnerable = 0.38;
  } else strikePrey(w, target, 28);
  return true;
}
function constrain(p: Vec, r: number) {
  p.x = Math.max(r, Math.min(LAND_MAP.width - r, p.x));
  p.y = Math.max(r, Math.min(LAND_MAP.height - r, p.y));
  for (const rock of LAND_ROCKS) {
    const d = distance(p, rock),
      limit = r + rock.radius;
    if (d < limit) {
      const a = Math.atan2(p.y - rock.y, p.x - rock.x);
      p.x = rock.x + Math.cos(a) * limit;
      p.y = rock.y + Math.sin(a) * limit;
    }
  }
}
export type LandTarget = {
  point: Vec;
  label: string;
  action:
    | 'forage'
    | 'nest'
    | 'observe'
    | 'evolve'
    | 'befriend'
    | 'hunt'
    | 'explore'
    | 'settle'
    | 'rest'
    | 'recover'
    | 'wait';
};
export function landSettlementWays(w: World): LandWay[] {
  const s = w.land;
  if (!s) return [];
  const ways: LandWay[] = [];
  if (landFriends(w) >= 2) ways.push('companions');
  if (s.hunts >= 3) ways.push('hunt');
  if (
    s.seedPod?.stage === 'planted' &&
    s.seedPod.waters === 3 &&
    (s.groveHarvests?.length ?? 0) >= 2
  )
    ways.push('garden');
  if (droughtLegacy(w)?.strategy === 'migration') ways.push('migration');
  return ways;
}
export function chooseLandFocus(
  w: World,
  focus: LandFocus,
  destination?: number,
) {
  const s = w.land;
  if (
    !s ||
    w.mode !== 'running' ||
    s.morph ||
    !['wander', 'companions', 'hunt', 'garden', 'settle'].includes(focus)
  )
    return false;
  if (
    destination != null &&
    (!Number.isInteger(destination) ||
      destination < 0 ||
      destination >= LAND_AREAS.length)
  )
    return false;
  if (focus === 'garden' && s.seedPod?.stage === 'eaten') return false;
  if (focus === 'hunt' && w.form !== 'stalker') return false;
  s.focus = focus;
  if (destination != null) s.destination = destination;
  if (s.drought) s.drought.tracking = false;
  return true;
}
export function continueLandLife(w: World) {
  const s = w.land;
  if (!s || w.mode !== 'won' || !s.nests.includes(2)) return false;
  w.mode = 'running';
  w.freeLife = true;
  s.focus = 'wander';
  announce(
    w,
    '溪畔家园留在这里。继续探索、经营果丛或陪伙伴生活，随时可以开始族群旅程。',
  );
  return true;
}
export function revisitLandSettlement(w: World) {
  const s = w.land;
  if (
    !s ||
    !['running', 'paused'].includes(w.mode) ||
    s.morph ||
    !s.nests.includes(2)
  )
    return false;
  w.mode = 'won';
  rememberGeneration(w.history, record(w));
  return true;
}
export function landTarget(w: World): LandTarget {
  const s = w.land!,
    p = w.player;
  const closest = <T extends Vec>(items: T[]) =>
    [...items].sort((a, b) => distance(a, p) - distance(b, p))[0];
  const home = closest(s.nests.map((i) => LAND_NESTS[i]));
  const dangerAt = (point: Vec) =>
    s.creatures.reduce(
      (sum, c) =>
        sum +
        (isLandPredator(c.species) &&
        !c.joined &&
        !c.friendship &&
        c.respawn <= 0
          ? Math.max(
              0,
              (c.species === 'hunter' ? 420 : 300) -
                Math.min(distance(point, c.home), distance(point, c)),
            )
          : 0),
      0,
    );
  const forage = (need: number, purpose: string): LandTarget => {
    // Prefer available food outside hunter territory; compute each score once per frame.
    const score = (f: Vec) => distance(f, p) + dangerAt(f) * 4;
    const food = w.foods
      .filter((f) => f.cooldown === 0)
      .map((point) => ({ point, score: score(point) }))
      .sort((a, b) => a.score - b.score)[0]?.point;
    return food
      ? {
          point: food,
          action: 'forage',
          label: `拾取标记果实 · ${purpose}还差 ${Math.max(1, need - w.food)} 食物`,
        }
      : {
          point: home ?? LAND_NESTS[0],
          action: 'wait',
          label: '附近果实正在重新生长，稍等再出发',
        };
  };
  if (s.morph)
    return { point: p, action: 'wait', label: '新身体正在形成，稍候再迈步' };
  if (
    home &&
    (p.energy < 30 ||
      p.health < 35 ||
      (distance(home, p) < home.radius && (p.energy < 75 || p.health < 90)))
  )
    return {
      point: home,
      action: 'rest',
      label:
        distance(home, p) < home.radius
          ? '停下休息 · 恢复到 75 能量、90 生命'
          : '先回已建巢穴休息，补充生命和能量',
    };
  if (s.moisture < 20)
    return {
      point: closest(LAND_PONDS)!,
      action: 'recover',
      label: '先到水洼补水，再继续前进',
    };
  const meal = closest(s.meat.filter((m) => m.life > 0));
  if (w.form === 'stalker' && meal)
    return {
      point: meal,
      action: 'forage',
      label: '靠近标记食物停下 0.8 秒进食；留意来抢食的猎手',
    };
  if (p.energy < 35) return forage(w.food + 1, '补充能量');
  const climateTarget = droughtTarget(w);
  if (climateTarget) return climateTarget;
  if (!s.nests.length)
    return w.food < 6
      ? forage(6, '筑巢')
      : {
          point: LAND_NESTS[0],
          action: 'nest',
          label: '回树根空巢按 K · 消耗 6 食物筑巢',
        };
  if (!s.discovered.length) {
    const neighbor = closest(
      s.creatures.filter(
        (c) => c.species === 'fern' && c.shoreOrigin == null && c.respawn <= 0,
      ),
    );
    return {
      point: neighbor ?? LAND_AREAS[0],
      action: neighbor ? 'observe' : 'wait',
      label: neighbor
        ? '靠近标记蕨尾兽观察 2 秒'
        : '蕨尾兽暂时离开，等待它们返回聚落',
    };
  }
  if (!s.tier)
    return w.food < 10
      ? forage(10, '孕育')
      : {
          point: home!,
          action: 'evolve',
          label: '回巢按 O · 选择新的陆地身体，消耗 10 食物',
        };
  if (s.focus === 'wander') {
    const area = LAND_AREAS[s.destination ?? 0];
    return {
      point: area,
      action: 'explore',
      label:
        distance(p, area) < area.radius
          ? `已抵达${area.name} · 自由观察、采食或换个目的地`
          : `自由探索 · ${area.name}`,
    };
  }
  const ways = landSettlementWays(w);
  if (
    s.focus === 'garden' ||
    (!ways.length && s.seedPod?.stage === 'planted')
  ) {
    const seed = s.seedPod,
      plot = seedPlot(w);
    if (!seed || seed.stage === 'unseen' || seed.stage === 'seen')
      return {
        point: LAND_SEED,
        action: 'explore',
        label: '寻找月露种荚 · 靠近按K拾取',
      };
    if (seed.stage === 'carried')
      return {
        point: home!,
        action: 'explore',
        label: '回巢种下月露荚 · 在发现卡选择种植',
      };
    if (plot && seed.waters < 3)
      return {
        point: s.moisture < 20 ? closest(LAND_PONDS)! : plot,
        action: 'explore',
        label:
          s.moisture < 20
            ? '先到水边补水，再照料幼苗'
            : `照料幼苗 ${seed.waters}/3 · 靠近后浇灌`,
      };
    const fruit = closest(
      w.foods.filter(
        (f) =>
          f.id >= 1000 &&
          f.id < 1004 &&
          !s.groveHarvests?.includes(f.id) &&
          f.cooldown === 0,
      ),
    );
    if (fruit)
      return {
        point: fruit,
        action: 'forage',
        label:
          (s.groveHarvests?.length ?? 0) >= 2
            ? '果丛已扎根 · 继续采果或选择新的生活方向'
            : `采收成熟果丛 ${s.groveHarvests?.length ?? 0}/2 · 不需要结伴或捕猎`,
      };
    if (s.focus === 'garden')
      return {
        point: plot ?? home!,
        action: 'explore',
        label: '果丛可以持续采收 · 或选择定居开始族群生活',
      };
  }
  if (!ways.length || s.focus === 'companions' || s.focus === 'hunt') {
    if (
      (s.focus === 'companions' && landFriends(w) >= 2) ||
      (s.focus === 'hunt' && s.hunts >= 3)
    )
      return {
        point: p,
        action: 'explore',
        label: '已找到这种生存方式 · 可以继续生活或选择定居',
      };
    const candidates = s.creatures.filter(
      (c) => !isLandPredator(c.species) && !c.joined && c.respawn <= 0,
    );
    const hunting =
      s.focus === 'hunt' || (w.form === 'stalker' && s.focus !== 'companions');
    candidates.sort(
      (a, b) => dangerAt(a) - dangerAt(b) || distance(a, p) - distance(b, p),
    );
    const preferred = hunting
      ? candidates.filter(
          (c) =>
            dangerAt(c) === 0 &&
            c.species === (s.nutrition < 2 ? 'fern' : 'grazer'),
        )
      : [];
    const neighbor =
      preferred[0] ??
      (hunting
        ? candidates[0]
        : candidates.sort(
            (a, b) =>
              dangerAt(a) - dangerAt(b) ||
              b.friendship - a.friendship ||
              distance(a, p) - distance(b, p),
          )[0]);
    if (!neighbor)
      return {
        point: LAND_AREAS[0],
        action: 'wait',
        label: '等待邻居返回，再结伴或捕猎',
      };
    if (hunting)
      return {
        point: neighbor,
        action: 'hunt',
        label: `Shift 伏低接近${SPECIES_NAMES[neighbor.species]}，朝向它按 J 扑击 · ${s.hunts}/3；猎物会逃跑`,
      };
    const cooldown = Math.ceil(
      Math.max(neighbor.trustCooldown, s.skillCooldown),
    );
    return {
      point: neighbor,
      action: 'befriend',
      label: `结伴 ${landFriends(w)}/2 · ${SPECIES_NAMES[neighbor.species]}信任 ${neighbor.friendship}/3 · ${neighbor.trustCooldown > 0 ? `稍等 ${Math.ceil(neighbor.trustCooldown)} 秒` : s.skillCooldown > 0 ? `K 分享食物，或等 ${cooldown} 秒后 J 呼唤` : '靠近按 J 呼唤 / K 分享'}`,
    };
  }
  if (s.nests.includes(2))
    return {
      point: home!,
      action: 'explore',
      label: '家园已经建立 · 自由探索，或开始族群生活',
    };
  const area = LAND_AREAS.slice(0, 2).find((a) => !s.visited.includes(a.name));
  if (area)
    return {
      point: area,
      action: 'explore',
      label: `${landFriends(w) > 0 ? '带伙伴探索' : '前往'}${area.name} · 不必购买第二次器官`,
    };
  return w.food < 12
    ? forage(12, '溪畔新家')
    : {
        point: LAND_NESTS[2],
        action: 'settle',
        label: '前往溪畔空巢按 K · 消耗 12 食物，建立新家',
      };
}
export function stepLand(w: World, input: Input, dt: number) {
  if (!w.land || w.mode !== 'running' || dt <= 0 || !Number.isFinite(dt))
    return;
  const s = w.land,
    p = w.player;
  w.time += dt;
  w.age += dt;
  if (s.morph) {
    s.morph.elapsed += dt;
    if (s.morph.elapsed >= s.morph.duration) s.morph = null;
    return;
  }
  stepLandDrought(w, dt);
  stepLandFeatures(w, dt);
  stepLandEcology(w, dt);
  if (input.feature) activateLandFeature(w);
  s.skillCooldown = Math.max(0, s.skillCooldown - dt);
  s.skillActive = Math.max(0, s.skillActive - dt);
  s.impact = Math.max(0, s.impact - dt);
  const seed = (s.seedPod ??= newSeed());
  seed.cooldown = Math.max(0, seed.cooldown - dt);
  if (seed.stage === 'unseen' && distance(p, LAND_SEED) < 330) {
    seed.stage = 'seen';
    announce(
      w,
      '林间有一枚发光的月露荚。靠近按 K 拾取，选择立即补给或在巢旁种植。',
    );
  }
  p.invulnerable = Math.max(0, p.invulnerable - dt);
  s.sneaking = w.form === 'stalker' && !!input.sneak && !s.pounce;
  if (input.skill) landSkill(w);
  if (input.interact) interactLand(w);
  if (input.command) commandCompanions(w);
  if (w.mode !== 'running') return;
  const st = landStats(w),
    mag = Math.hypot(input.x, input.y),
    moving = mag > 0.01,
    n = nearNest(w),
    rest = n >= 0 && s.nests.includes(n);
  p.dashing = input.dash && !s.sneaking && !s.pounce && p.energy > 12 && moving;
  const speed =
      st.speed *
      landFeatureSpeed(w) *
      (s.sneaking ? 0.5 : p.dashing ? 1.65 : 1),
    dx = moving ? input.x / Math.max(1, mag) : 0,
    dy = moving ? input.y / Math.max(1, mag) : 0;
  if (s.pounce) {
    const attack = s.pounce;
    let travel = Math.min(dt, attack.remaining);
    while (travel > 0 && attack.remaining > 0) {
      const slice = Math.min(travel, 1 / 120),
        from = { x: p.x, y: p.y };
      p.angle = attack.angle;
      p.vx = Math.cos(p.angle) * 620;
      p.vy = Math.sin(p.angle) * 620;
      p.x += p.vx * slice;
      p.y += p.vy * slice;
      const expected = { x: p.x, y: p.y };
      Object.assign(
        p,
        constrainBody(
          { ...p, form: w.form, size: landRadius(w), body: s.body },
          LAND_ROCKS,
          LAND_MAP,
        ),
      );
      sweepPounce(w, from, p);
      attack.remaining -= slice;
      travel -= slice;
      if (distance(expected, p) > 0.01) attack.remaining = 0;
    }
    if (attack.remaining <= 0) {
      if (!attack.hit) announce(w, '扑空了！先看准朝向，伏低接近后再出击。');
      s.pounce = null;
      p.vx *= 0.3;
      p.vy *= 0.3;
    }
  } else {
    if (moving) p.angle = face(p.angle, Math.atan2(dy, dx), dt, st.turnRate);
    glide(p, dx * speed, dy * speed, dt, moving);
    Object.assign(
      p,
      constrainBody(
        { ...p, form: w.form, size: landRadius(w), body: s.body },
        LAND_ROCKS,
        LAND_MAP,
      ),
    );
  }
  eatMeat(w, dt, landRadius(w) + 30, st.maxEnergy);
  const wet = landWet(w, p),
    sun = distance(p, LAND_AREAS[1]) < LAND_AREAS[1].radius;
  s.moisture = Math.max(
    0,
    Math.min(
      st.maxMoisture,
      s.moisture +
        dt *
          (wet
            ? 22
            : inFeatureShelter(w)
              ? -0.25
              : droughtDry(w)
                ? -(droughtSheltered(w, p)
                    ? 0.15
                    : hasAdaptation(s, 'skin')
                      ? 1.1
                      : 2.1) * (p.dashing ? 1.4 : 1)
                : rest
                  ? 8
                  : sun
                    ? -(hasAdaptation(s, 'skin') ? 0.65 : 1.3)
                    : 0.8),
    ),
  );
  p.energy = Math.max(
    0,
    Math.min(
      st.maxEnergy,
      p.energy +
        dt *
          (rest && !moving
            ? 8
            : -st.metabolism * (moving ? 1.2 : 0.7) - (p.dashing ? 3 : 0)),
    ),
  );
  if (rest) p.health = Math.min(100, p.health + dt * 5);
  if (s.moisture <= 0) p.health -= dt * 6;
  if (p.energy <= 0) p.health -= dt * 6;
  for (const food of w.foods) {
    food.cooldown = Math.max(
      0,
      food.cooldown -
        ((dt * droughtFoodRate(w, food.id)) /
          (1 + (s.ecology?.[landArea(food)] ?? 0) * 0.1)) *
          (seed.stage === 'planted' &&
          seed.waters === 3 &&
          food.id >= GROVE_FOOD_ID &&
          food.id < GROVE_FOOD_ID + 4
            ? 2
            : 1),
    );
    if (
      food.cooldown === 0 &&
      distance(food, p) <
        landRadius(w) + st.pickup + (s.sifting && landWet(w, p) ? 50 : 0)
    ) {
      food.cooldown = 32;
      w.food++;
      w.totalFood++;
      if (
        seed.stage === 'planted' &&
        seed.waters === 3 &&
        food.id >= 1000 &&
        food.id < 1004
      ) {
        s.groveHarvests ??= [];
        if (!s.groveHarvests.includes(food.id)) {
          s.groveHarvests.push(food.id);
          ingestBiologicalDna(w, 'land:garden', 'practice');
        }
      }
      droughtHarvest(w, food.id);
      p.energy = Math.min(st.maxEnergy, p.energy + (food.rich ? 16 : 10));
      burst(w, food, '#d8e7a3');
    }
  }
  for (const area of LAND_AREAS)
    if (distance(area, p) < area.radius && !s.visited.includes(area.name)) {
      s.visited.push(area.name);
      announce(
        w,
        `发现${area.name}。温和生物既能成为邻居，也会争夺这里的食物。`,
      );
    }
  for (const species of LAND_SPECIES.map((s) => s.id))
    if (
      !s.discovered.includes(species) &&
      s.creatures.some(
        (c) =>
          c.species === species &&
          c.shoreOrigin == null &&
          c.respawn <= 0 &&
          distance(c, p) < 170,
      )
    ) {
      s.observation[species] = (s.observation[species] ?? 0) + dt;
      if (s.observation[species]! >= 2) {
        s.discovered.push(species);
        ingestBiologicalDna(w, `land:${species}`, 'observe');
        if (species === 'fern' || species === 'grazer')
          learnFrom(w, `land:${species}`);
        announce(
          w,
          s.discovered.length === 1
            ? '发现陆地身体！带 10 份食物回巢，按 O 孕育下一代。'
            : '发现第二种身体：可选鸣冠或肩甲，也可以直接建立新家。',
        );
      }
    }
  for (const c of s.creatures) {
    c.flash = Math.max(0, c.flash - dt);
    c.reaction = Math.max(0, c.reaction - dt);
    c.trustCooldown = Math.max(0, c.trustCooldown - dt);
    c.stun = Math.max(0, c.stun - dt);
    if (c.respawn > 0) {
      c.respawn = Math.max(0, c.respawn - dt);
      if (c.respawn === 0) {
        c.x = c.home.x;
        c.y = c.home.y;
        c.health = creatureHealth(c);
        c.suspicion = 0;
        c.escape = 3;
        c.friendship = 0;
      }
      continue;
    }
    if (c.stun > 0) continue;
    const d = distance(c, p);
    let target: Vec = c.home,
      velocity = 0;
    if (
      c.joined &&
      stepCompanionTask(w, c, dt, st.speed, st.maxEnergy, constrain)
    )
      continue;
    if (c.joined) {
      target = companionSlot(p, s.creatures.filter((a) => a.joined).indexOf(c));
      const gap = distance(c, target);
      velocity =
        gap > 100 ? st.speed * 1.25 : gap > 12 ? Math.min(90, gap * 5) : 0;
    } else if (c.species === 'hunter') {
      c.alert = !rest && distance(p, c.home) < 290;
      const meal = s.meat.find((m) => m.life > 0 && distance(m, c.home) < 340);
      target = c.alert ? p : (meal ?? c.home);
      velocity = c.alert ? 144 : meal ? 150 : distance(c, c.home) > 25 ? 80 : 0;
      if (meal && distance(c, meal) < 36) {
        meal.life = 0;
        s.stolen++;
        c.health = Math.min(creatureHealth(c), c.health + 30);
        announce(w, '岩背猎手抢走了食物！下次先引开它，再回来进食。');
      }
      if (
        c.alert &&
        trunkTouches(
          { ...p, form: w.form, size: landRadius(w), body: s.body },
          { ...c, radius: 39 },
        ) &&
        p.invulnerable <= 0
      ) {
        const guarded = organTouches(
          { ...p, form: w.form, size: landRadius(w), body: s.body },
          { ...c, radius: 39 },
          'spine',
        );
        if (guarded) {
          c.stun = 2;
          burst(w, c, '#f6d191');
        } else {
          p.health -=
            20 *
            st.damage *
            (s.creatures.some((f) => f.joined && distance(f, p) < 190)
              ? hasLandFeature(w, 'herd')
                ? 0.45
                : 0.7
              : 1);
          p.invulnerable = 1.2;
          if (hasLandFeature(w, 'thorns')) {
            c.health = Math.max(1, c.health - 15);
            c.stun = 1.5;
          }
          s.impact = 0.18;
        }
      }
    } else {
      const detection = s.sneaking
        ? inLandCover(p)
          ? 60
          : 90
        : p.dashing
          ? 280
          : 190;
      const threat =
        w.form === 'stalker' && c.friendship === 0 && d < detection;
      c.suspicion = Math.max(
        0,
        Math.min(
          1,
          c.suspicion + dt * (threat ? (s.sneaking ? 0.8 : 2.2) : -0.65),
        ),
      );
      const scared =
        c.friendship === 0 &&
        ((c.suspicion > 0.6 && d < 310) ||
          (c.health < creatureHealth(c) && d < 250));
      c.alert = scared;
      c.escape = Math.max(0, Math.min(3, c.escape + dt * (scared ? -1 : 1.2)));
      if (scared) {
        target = { x: c.x + (c.x - p.x), y: c.y + (c.y - p.y) };
        velocity = c.escape <= 0 ? 65 : c.species === 'grazer' ? 125 : 140;
      } else if (['fern', 'grazer'].includes(c.species)) {
        const food = w.foods.find(
          (f) => f.cooldown === 0 && distance(f, c.home) < 180,
        );
        target = food ?? c.home;
        velocity = distance(c, target) > 25 ? 34 : 0;
        if (food && distance(food, c) < 22) {
          food.cooldown = 32;
          c.health = Math.min(creatureHealth(c), c.health + 8);
        }
      }
    }
    const special = landEcologyGoal(w, c, dt);
    if (special) {
      target = special.target;
      velocity = special.speed;
    }
    if (velocity) {
      c.angle = face(
        c.angle,
        Math.atan2(target.y - c.y, target.x - c.x),
        dt,
        5,
      );
      c.x += Math.cos(c.angle) * velocity * dt;
      c.y += Math.sin(c.angle) * velocity * dt;
      constrain(c, creatureHealth(c) >= 130 ? 39 : 25);
    }
  }
  const spacable = new Set(
    s.creatures
      .filter(
        (c) =>
          c.respawn <= 0 &&
          !c.alert &&
          c.stun <= 0 &&
          distance(c, p) > 90 &&
          !w.foods.some((f) => f.cooldown === 0 && distance(f, c) < 40) &&
          !s.meat.some((m) => m.life > 0 && distance(m, c) < 50),
      )
      .map((c) => c.id),
  );
  separateNeighbors(
    s.creatures,
    dt,
    (id) => spacable.has(id),
    (c) => landSpecies(c.species).radius,
  );
  for (const c of s.creatures)
    if (spacable.has(c.id)) constrain(c, landSpecies(c.species).radius);
  for (const b of w.particles) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
  }
  w.particles = w.particles.filter((b) => b.life > 0).slice(-180);
  if (p.health <= 0) {
    p.health = 0;
    w.mode = 'dead';
    w.reason =
      s.moisture <= 0
        ? '身体失水'
        : p.energy <= 0
          ? '能量耗尽'
          : '遭遇领地猎手';
  }
}
