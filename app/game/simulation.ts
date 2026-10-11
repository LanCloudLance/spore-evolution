import {
  inheritedDna,
  microbeCandidates,
  MICROBE_BODIES,
  microbeEffects,
} from './dna-evolution.ts';
import {
  createPondLife,
  stepPondLife,
  sharePondNutrition,
  pondRadius,
  pondCanSwallow,
} from './pond-life.ts';
import {
  stepLearning,
  biologicalBonus,
  inheritedLearning,
} from './lineage-learning.ts';
import {
  beginEvolution,
  advanceEvolution,
  evolutionObservation,
  revealing,
} from './evolution-experience.ts';
import type { EvolutionExperience } from './evolution-experience.ts';
import { stepShore } from './shore.ts';
import { stepLand } from './land.ts';
import type { LandState } from './land.ts';
import type { ShoreState } from './shore.ts';
import type { BodyDesign } from './body-design.ts';
import { glide, face } from './motion.ts';
import type { BodyForm, Habitat, OceanState } from './forms.ts';
import { FORMS } from './forms.ts';
import { stepOcean } from './ocean.ts';
import { rememberGeneration } from './lineage.ts';
export type TraitId =
  | 'flagellum'
  | 'shell'
  | 'spikes'
  | 'chloroplast'
  | 'cilia'
  | 'vacuole';
export type Mode = 'ready' | 'running' | 'paused' | 'evolving' | 'dead' | 'won';
export type Vec = { x: number; y: number };
export type Input = Vec & {
  learnedSkill?: boolean;
  feature?: boolean;
  dash: boolean;
  skill?: boolean;
  sneak?: boolean;
  command?: boolean;
  interact?: boolean;
  tidalCommand?: import('./tidal/types.ts').TidalCommand;
  viewport?: { minX: number; minY: number; maxX: number; maxY: number };
};
export type Food = Vec & { id: number; cooldown: number; rich: boolean };
export type Predator = Vec & {
  radius?: number;
  respawn?: number;
  bite?: number;
  id: number;
  angle: number;
  alert: boolean;
  stun: number;
  home: Vec;
};
export type Ancestor = {
  dnaLineage?: import('./dna-evolution.ts').DnaLineage;
  learning?: import('./lineage-learning.ts').LearningState;
  adaptations?: import('./life-adaptations.ts').Adaptation[];
  tidalLegacy?: import('./tidal/types.ts').TidalLegacy;
  milestone?: string;
  landFeatures?: import('./land-catalog.ts').LandFeature[];
  landOrgan?: 'crest' | 'plates';
  landWays?: import('./land.ts').LandWay[];
  landLegacy?: import('./land-drought.ts').LandLegacy;
  body?: BodyDesign;
  adaptation?: 'reservoir' | 'skin';
  form?: BodyForm;
  habitat?: Habitat;
  generation: number;
  traits: TraitId[];
  food: number;
  seconds: number;
};
export type Particle = Vec & {
  vx: number;
  vy: number;
  life: number;
  color: string;
};
export type World = {
  dnaLineage?: import('./dna-evolution.ts').DnaLineage;
  pondLife?: import('./pond-life.ts').PondLife;
  learning?: import('./lineage-learning.ts').LearningState;
  freeLife?: boolean;
  tidalLegacy?: import('./tidal/types.ts').TidalLegacy;
  evolution?: EvolutionExperience | null;
  habitat: Habitat;
  form: BodyForm;
  ocean: OceanState | null;
  shore: ShoreState | null;
  land: LandState | null;
  mode: Mode;
  seed: number;
  time: number;
  generation: number;
  age: number;
  food: number;
  totalFood: number;
  traits: TraitId[];
  player: Vec & {
    vx: number;
    vy: number;
    energy: number;
    health: number;
    angle: number;
    invulnerable: number;
    dashing: boolean;
  };
  foods: Food[];
  predators: Predator[];
  history: Ancestor[];
  particles: Particle[];
  explored: string[];
  reason: string;
  notice: string;
  noticeUntil: number;
};
export const MAP = { width: 2400, height: 1650 };
export const NURSERY = { x: 430, y: 1030, radius: 185 };
export const HAVEN = { x: 2160, y: 330, radius: 135 };
export const SUNLIGHT = { x: 1250, y: 380, radius: 340 };
export const CURRENT = { x: 1680, y: 1120, radius: 420 };
export const TRAITS: {
  id: TraitId;
  name: string;
  label: string;
  benefit: string;
  cost: string;
  color: string;
}[] = [
  {
    id: 'flagellum',
    name: '长鞭毛',
    label: '迅游型',
    benefit: '游速 +30%，更擅长追逐与逃脱',
    cost: '活动耗能 +25%',
    color: '#8de3ef',
  },
  {
    id: 'shell',
    name: '厚外壳',
    label: '守护型',
    benefit: '受到的伤害减少 45%',
    cost: '游速降低 18%',
    color: '#d4bdfa',
  },
  {
    id: 'spikes',
    name: '防御尖刺',
    label: '棘刺型',
    benefit: '碰撞后令捕食者眩晕 3 秒',
    cost: '持续耗能 +20%',
    color: '#ffce85',
  },
  {
    id: 'chloroplast',
    name: '光合结构',
    label: '逐光型',
    benefit: '在光照区停止主动游动时恢复能量',
    cost: '游速降低 10%',
    color: '#c5ed84',
  },
  {
    id: 'cilia',
    name: '密集纤毛',
    label: '滤食型',
    benefit: '摄食范围扩大，更容易收集食物',
    cost: '持续耗能 +20%',
    color: '#96efbc',
  },
  {
    id: 'vacuole',
    name: '储能囊',
    label: '远行型',
    benefit: '能量上限增加 45',
    cost: '游速降低 10%',
    color: '#eed893',
  },
];
export function distance(a: Vec, b: Vec) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
export function getStats(traits: TraitId[], form: BodyForm = 'microbe') {
  let { speed, maxEnergy, metabolism, pickup } = FORMS[form];
  let damage = 26;
  for (const trait of new Set(traits)) {
    if (trait === 'flagellum') {
      speed *= 1.3;
      metabolism *= 1.25;
    }
    if (trait === 'shell') {
      speed *= 0.82;
      damage *= 0.55;
    }
    if (trait === 'spikes' || trait === 'cilia') metabolism *= 1.2;
    if (trait === 'cilia') pickup += 24;
    if (trait === 'chloroplast') speed *= 0.9;
    if (trait === 'vacuole') {
      maxEnergy += 45;
      speed *= 0.9;
    }
  }
  return { speed, maxEnergy, metabolism, damage, pickup };
}
export function createWorld(seed = 42): World {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const foods: Food[] = [];
  for (let i = 0; i < 120; i++) {
    let x = 100 + random() * 2200,
      y = 100 + random() * 1450;
    if (i < 18) {
      const a = i * 2.399,
        r = 110 + random() * 330;
      x = NURSERY.x + Math.cos(a) * r;
      y = NURSERY.y + Math.sin(a) * r;
    }
    if (i >= 18 && i < 54) {
      const a = random() * Math.PI * 2,
        r = random() * SUNLIGHT.radius;
      x = SUNLIGHT.x + Math.cos(a) * r;
      y = SUNLIGHT.y + Math.sin(a) * r;
    }
    foods.push({
      id: i,
      x: Math.max(35, x),
      y: Math.max(35, y),
      cooldown: 0,
      rich: i >= 18 && i < 54,
    });
  }
  const homes = [
    { x: 920, y: 940 },
    { x: 790, y: 530 },
    { x: 1420, y: 430 },
    { x: 1720, y: 650 },
    { x: 1750, y: 1340 },
    { x: 2080, y: 850 },
    { x: 1020, y: 1410 },
  ];
  const predators = homes.map((home, id) => ({
    ...home,
    id,
    home: { ...home },
    angle: random() * 6.28,
    alert: false,
    stun: 0,
  }));
  return {
    mode: 'ready',
    freeLife: false,
    learning: undefined,
    dnaLineage: undefined,
    pondLife: createPondLife(seed),
    evolution: null,
    habitat: 'pond',
    form: 'microbe',
    tidalLegacy: undefined,
    ocean: null,
    shore: null,
    land: null,
    seed,
    time: 0,
    generation: 1,
    age: 0,
    food: 0,
    totalFood: 0,
    traits: [],
    player: {
      x: NURSERY.x,
      y: NURSERY.y,
      vx: 0,
      vy: 0,
      energy: 80,
      health: 100,
      angle: -0.3,
      invulnerable: 0,
      dashing: false,
    },
    foods,
    predators,
    history: [],
    particles: [],
    explored: ['育生水域'],
    reason: '',
    notice: '沿着绿色微光寻找食物。',
    noticeUntil: 7,
  };
}
export function getZone(p: Vec) {
  if (distance(p, NURSERY) < NURSERY.radius) return '育生水域';
  if (distance(p, SUNLIGHT) < SUNLIGHT.radius) return '浅光藻场';
  if (distance(p, CURRENT) < CURRENT.radius) return '回流水道';
  if (distance(p, HAVEN) < HAVEN.radius) return '新栖息地';
  return '开放水域';
}
export function reproductionGate(world: World) {
  if (revealing(world)) return '等待新身体形成。';
  if (world.mode !== 'running' && world.mode !== 'evolving')
    return '先继续探索，再繁殖后代。';
  if (world.food < 8) return `本代还需要 ${8 - world.food} 份食物。`;
  if (world.player.energy < 50) return '繁殖需要至少 50 点能量，先补充食物。';
  if (distance(world.player, NURSERY) > NURSERY.radius)
    return '返回育生水域，在安全的地方繁殖。';
  return '';
}
export function announce(world: World, message: string) {
  world.notice = message;
  world.noticeUntil = world.time + 6;
}
function burst(world: World, p: Vec, color: string, count = 9) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    world.particles.push({
      x: p.x,
      y: p.y,
      vx: Math.cos(a) * 36,
      vy: Math.sin(a) * 36,
      life: 0.8,
      color,
    });
  }
}
export function reproduce(world: World, trait: TraitId) {
  if (
    reproductionGate(world) ||
    world.traits.includes(trait) ||
    !TRAITS.some((t) => t.id === trait)
  )
    return false;
  return reviseMicrobe(world, [...world.traits, trait]);
}
export function reviseMicrobe(
  world: World,
  traits: TraitId[],
  body: import('./dna-evolution.ts').MicrobeBody = world.dnaLineage?.body ??
    'ancestor',
) {
  if (
    world.habitat !== 'pond' ||
    !microbeCandidates(world).some((c) => c.id === body && c.available) ||
    !MICROBE_BODIES[body]?.traits.every((id) => traits.includes(id)) ||
    reproductionGate(world) ||
    !traits.length ||
    traits.length > Math.max(3, world.traits.length) ||
    new Set(traits).size !== traits.length ||
    traits.some((id) => !TRAITS.some((t) => t.id === id))
  )
    return false;
  rememberGeneration(world.history, {
    form: world.form,
    habitat: world.habitat,
    generation: world.generation,
    ...(world.learning ? { learning: inheritedLearning(world) } : {}),
    ...(world.dnaLineage ? { dnaLineage: inheritedDna(world) } : {}),
    traits: [...world.traits],
    food: world.food,
    seconds: world.age,
  });
  const change = traits.find((id) => !world.traits.includes(id)) ?? traits[0];
  world.traits = [...traits];
  if (world.dnaLineage) world.dnaLineage.body = body;
  world.generation++;
  world.food = 0;
  world.age = 0;
  world.mode = 'running';
  world.player = {
    ...world.player,
    x: NURSERY.x,
    y: NURSERY.y,
    health: 100,
    vx: 0,
    vy: 0,
    energy: getStats(world.traits).maxEnergy * 0.8,
    invulnerable: 3,
    dashing: false,
  };
  burst(world, world.player, '#c6f598', 24);
  announce(
    world,
    world.generation >= 3
      ? '后代诞生了。可以继续尝试身体组合，或前往新栖息地进入海洋。'
      : '新的后代诞生了。新器官会带来不同的生存方式。',
  );
  beginEvolution(world, change);
  return true;
}
export function waterFlow(p: Vec, time: number): Vec {
  const d = distance(p, CURRENT);
  if (d > CURRENT.radius)
    return {
      x: Math.sin(p.y / 230 + time * 0.15) * 5,
      y: Math.cos(p.x / 300 + time * 0.15) * 4,
    };
  const force = (1 - d / CURRENT.radius) * (time > 85 ? 125 : 85);
  return {
    x: (-(p.y - CURRENT.y) / Math.max(70, d)) * force,
    y: ((p.x - CURRENT.x) / Math.max(70, d)) * force,
  };
}
export function stepWorld(world: World, input: Input, dt: number) {
  if (world.mode !== 'running' || !Number.isFinite(dt) || dt <= 0) return;
  const before = evolutionObservation(world);
  // Existing chapter morphs freeze ecology. Pond births use the same protected reveal.
  if (world.habitat === 'pond' && revealing(world)) {
    advanceEvolution(world, input, Math.min(dt, 0.05), before);
    return;
  }
  if (
    !revealing(world) &&
    !world.ocean?.morph &&
    !world.shore?.morph &&
    !world.land?.morph
  )
    stepLearning(world, !!input.learnedSkill, Math.min(dt, 0.05));
  simulateWorld(world, input, dt);
  advanceEvolution(
    world,
    input,
    world.habitat === 'pond' ? Math.min(dt, 0.05) : dt,
    before,
  );
}
function simulateWorld(world: World, input: Input, dt: number) {
  if (world.habitat === 'land') {
    stepLand(world, input, dt);
    return;
  }
  if (world.habitat === 'shore') {
    stepShore(world, input, dt);
    return;
  }
  if (world.habitat === 'ocean') {
    stepOcean(world, input, dt);
    return;
  }
  if (world.mode !== 'running' || !Number.isFinite(dt) || dt <= 0) return;
  if (world.player.health <= 0) {
    world.mode = 'dead';
    world.player.health = 0;
    world.reason = world.player.energy <= 0 ? '能量耗尽' : '遭遇捕食者';
    return;
  }
  dt = Math.min(dt, 0.05);
  const prevTime = world.time;
  world.time += dt;
  world.age += dt;
  const p = world.player,
    stats = getStats(world.traits),
    raw = Math.hypot(input.x, input.y);
  const bonus = biologicalBonus(world);
  const dna = microbeEffects(world);
  stats.speed *= dna.speed;
  stats.metabolism *= dna.metabolism;
  stats.damage *= dna.damage;
  stats.pickup += dna.pickup;
  stats.speed *= bonus.speed;
  stats.pickup += bonus.pickup;
  const moving = raw > 0.05,
    unit = Math.max(1, raw),
    safe = distance(p, NURSERY) < NURSERY.radius;
  p.dashing = input.dash && moving && p.energy > 8;
  if (moving) p.angle = face(p.angle, Math.atan2(input.y, input.x), dt);
  const flow = safe ? { x: 0, y: 0 } : waterFlow(p, world.time);
  const speed = stats.speed * (p.dashing ? 2.2 : 1);
  glide(
    p,
    (input.x / unit) * speed + flow.x,
    (input.y / unit) * speed + flow.y,
    dt,
    moving,
  );
  p.x = Math.max(20, Math.min(MAP.width - 20, p.x));
  p.y = Math.max(20, Math.min(MAP.height - 20, p.y));
  p.energy = Math.max(
    0,
    p.energy -
      (stats.metabolism * (moving ? 1.15 : 0.65) +
        (p.dashing ? 5 + dna.dashCost : 0)) *
        dt,
  );
  p.invulnerable = Math.max(0, p.invulnerable - dt);
  if (
    world.traits.includes('chloroplast') &&
    distance(p, SUNLIGHT) < SUNLIGHT.radius &&
    raw < 0.3
  )
    p.energy = Math.min(stats.maxEnergy, p.energy + 3 * dt);
  if (p.energy === 0) p.health -= 10 * dt;
  else if (p.energy > 35)
    p.health = Math.min(100, p.health + (safe ? 2.8 : 0.4) * dt);
  for (const food of world.foods) {
    if (food.cooldown > 0) {
      food.cooldown = Math.max(0, food.cooldown - dt);
      continue;
    }
    if (distance(p, food) < stats.pickup) {
      food.cooldown = 24;
      world.food++;
      world.totalFood++;
      p.energy = Math.min(stats.maxEnergy, p.energy + (food.rich ? 16 : 12));
      burst(world, food, food.rich ? '#dfef96' : '#8df3ba', 5);
      if (world.food === 8 && world.generation < 3)
        announce(world, '营养已积累。返回育生水域，按 O 繁殖。');
    }
  }
  if (input.interact) sharePondNutrition(world);
  stepPondLife(world, dt);
  for (const enemy of world.predators) {
    if ((enemy.respawn ?? 0) > 0) {
      enemy.respawn = Math.max(0, enemy.respawn! - dt);
      if (enemy.respawn === 0) Object.assign(enemy, enemy.home);
      continue;
    }
    const d = distance(p, enemy);
    enemy.stun = Math.max(0, enemy.stun - dt);
    const smaller = pondCanSwallow(world, 29 + (enemy.id % 3) * 3);
    enemy.alert = !safe && !smaller && d < 260 + world.generation * 20;
    const target =
      smaller && d < 260
        ? { x: enemy.x + (enemy.x - p.x), y: enemy.y + (enemy.y - p.y) }
        : enemy.alert
          ? p
          : {
              x: enemy.home.x + Math.cos(world.time * 0.2 + enemy.id) * 130,
              y: enemy.home.y + Math.sin(world.time * 0.17 + enemy.id) * 100,
            };
    enemy.angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
    if (enemy.stun === 0) {
      const pace =
        smaller && d < 260 ? 100 : enemy.alert ? 99 + world.generation * 5 : 33;
      const nx = enemy.x + Math.cos(enemy.angle) * pace * dt,
        ny = enemy.y + Math.sin(enemy.angle) * pace * dt;
      if (distance({ x: nx, y: ny }, NURSERY) > NURSERY.radius + 40) {
        enemy.x = nx;
        enemy.y = ny;
      }
    }
    if (
      !safe &&
      !smaller &&
      d < pondRadius(world) + (29 + (enemy.id % 3) * 3) * 0.8 &&
      p.invulnerable === 0 &&
      enemy.stun === 0
    ) {
      if (
        world.dnaLineage?.body === 'ram' &&
        p.dashing &&
        Math.cos(Math.atan2(enemy.y - p.y, enemy.x - p.x) - p.angle) > 0.65
      ) {
        enemy.stun = 2;
        p.invulnerable = 0.3;
        burst(world, enemy, '#d4bdfa', 14);
        announce(world, '甲梭冲撞！捕食者眩晕，趁机脱离。');
        continue;
      }
      p.health -= stats.damage;
      p.invulnerable = 1.8;
      enemy.stun = world.traits.includes('spikes') ? 3 : 0.65;
      burst(world, p, '#ffb58d', 14);
      announce(world, '受到攻击！冲刺拉开距离，或退回育生水域。');
    }
  }
  for (const particle of world.particles) {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
  }
  world.particles = world.particles.filter((particle) => particle.life > 0);
  const zone = getZone(p);
  if (!world.explored.includes(zone)) {
    world.explored.push(zone);
    if (zone !== '开放水域') announce(world, `发现：${zone}。探索手记已记录。`);
  }
  if (prevTime < 85 && world.time >= 85)
    announce(world, '雨水流入池塘，回流水道的水流增强了。');
  if (p.health <= 0) {
    world.mode = 'dead';
    p.health = 0;
    world.reason = p.energy <= 0 ? '能量耗尽' : '遭遇捕食者';
    return;
  }
  if (
    !world.freeLife &&
    world.generation >= 3 &&
    distance(p, HAVEN) < HAVEN.radius
  ) {
    world.mode = 'won';
    rememberGeneration(world.history, {
      form: world.form,
      habitat: world.habitat,
      generation: world.generation,
      ...(world.learning ? { learning: inheritedLearning(world) } : {}),
      ...(world.dnaLineage ? { dnaLineage: inheritedDna(world) } : {}),
      traits: [...world.traits],
      food: world.food,
      seconds: world.age,
    });
  }
}
