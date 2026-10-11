import {
  buildShoreShelter,
  shoreSheltered,
  stepShoreShelters,
} from './shore-shelter.ts';
import { inheritedDna, ingestBiologicalDna } from './dna-evolution.ts';
import {
  biologicalBonus,
  inheritedLearning,
  learnFrom,
} from './lineage-learning.ts';
import { tidalLegacy } from './tidal/legacy.ts';
import {
  constrainBody,
  trunkTouches,
  worldBodyPose,
  organTouches,
} from './body-geometry.ts';
import { beginEvolution } from './evolution-experience.ts';
import { companionSlot, separateNeighbors } from './readability.ts';
import { rememberGeneration } from './lineage.ts';
import type { World, Input, Vec, Ancestor, TraitId } from './simulation.ts';
import type { BodyForm } from './forms.ts';
import type { BodyDesign } from './body-design.ts';
import { createWorld, getStats, distance, announce } from './simulation.ts';
import { freshBody, bodyEffects } from './body-design.ts';
import { face, glide } from './motion.ts';
import { adaptationsOf, hasAdaptation } from './life-adaptations.ts';
export type ShoreChoice = 'crawler' | 'skipper' | 'reservoir' | 'skin';
export type ShoreCreature = Vec & {
  id: number;
  role: 'ally' | 'rival' | 'guardian';
  home: Vec;
  angle: number;
  stun: number;
  joined: boolean;
  alert: boolean;
};
export type ShoreCheckpoint = {
  startingTier?: 0 | 1 | 2;
  adaptations?: import('./life-adaptations.ts').Adaptation[];
  protection?: 'skin' | 'reservoir' | null;
  learning?: import('./lineage-learning.ts').LearningState;
  dnaLineage?: import('./dna-evolution.ts').DnaLineage;
  tidalLegacy?: World['tidalLegacy'];
  seed: number;
  generation: number;
  time: number;
  age?: number;
  totalFood: number;
  history: Ancestor[];
  traits: TraitId[];
  form: BodyForm;
  body: BodyDesign;
  biomass: number;
  standalone: boolean;
};
export type ShoreState = {
  shelters?: import('./shore-shelter.ts').ShoreShelter[];
  adaptations?: import('./life-adaptations.ts').Adaptation[];
  tidalResidents?: (Vec & { originId: string; angle: number })[];
  checkpoint: ShoreCheckpoint;
  body: BodyDesign;
  biomass: number;
  tier: 0 | 1 | 2;
  moisture: number;
  protection: 'reservoir' | 'skin' | null;
  discovered: string[];
  observation: Record<string, number>;
  visited: string[];
  creatures: ShoreCreature[];
  skillCooldown: number;
  skillActive: number;
  morph: { from: BodyForm; elapsed: number; duration: number } | null;
  blocked: number;
  dryWarning: boolean;
  fieldNotes?: {
    shelterSeconds?: number;
    drySeconds: number;
    safeReturns: number;
    harvestCycles: Record<string, number>;
  };
};
export const SHORE_MAP = { width: 3000, height: 1900 };
export const SHORE_POOLS = [
  { x: 460, y: 1440, radius: 210, name: '初登陆潮池' },
  { x: 1060, y: 1170, radius: 165, name: '贝壳浅湾' },
  { x: 1600, y: 850, radius: 155, name: '蕨影潮池' },
  { x: 2150, y: 1080, radius: 150, name: '沙洲水洼' },
  { x: 2740, y: 480, radius: 210, name: '蕨林栖息地' },
];
export const SHORE_SPECIMENS: {
  id: 'support' | 'moisture';
  name: string;
  x: number;
  y: number;
  form: BodyForm;
}[] = [
  {
    id: 'support',
    name: '撑地生物',
    x: 865,
    y: 1330,
    form: 'crawler' as BodyForm,
  },
  {
    id: 'moisture',
    name: '保湿生物',
    x: 1830,
    y: 840,
    form: 'skipper' as BodyForm,
  },
];
export const SHORE_ROCKS = [
  { x: 780, y: 900, radius: 72 },
  { x: 1240, y: 700, radius: 85 },
  { x: 1450, y: 1400, radius: 65 },
  { x: 1910, y: 1190, radius: 80 },
  { x: 2390, y: 590, radius: 70 },
  { x: 2480, y: 1440, radius: 92 },
];
// Shell beds sit inside the high-water boundary and outside the low-water boundary.
export const SHORE_SHELL_BEDS = [
  { id: 'landing', x: 665, y: 1400, name: '浅岸贝床' },
  { id: 'fern', x: 1755, y: 850, name: '蕨影贝床' },
];
export function shoreTide(w: World) {
  const phase = ((w.time % 70) + 70) % 70;
  const opening = (70 * (Math.PI + Math.asin(0.35))) / (2 * Math.PI);
  const closing = (70 * (2 * Math.PI - Math.asin(0.35))) / (2 * Math.PI);
  const exposed = phase > opening && phase < closing;
  return {
    exposed,
    seconds: Math.max(
      1,
      Math.ceil(
        exposed
          ? closing - phase
          : phase < opening
            ? opening - phase
            : 70 - phase + opening,
      ),
    ),
    cycle: Math.floor(w.time / 70),
  };
}
export function nearbyShellBed(w: World) {
  return SHORE_SHELL_BEDS.find((bed) => distance(w.player, bed) < 62);
}
export function shellBedReady(w: World, id: string) {
  const tide = shoreTide(w);
  return tide.exposed && w.shore?.fieldNotes?.harvestCycles[id] !== tide.cycle;
}
export function shoreFieldHint(w: World) {
  const s = w.shore!;
  if (s.tier !== 1 || s.discovered.includes('moisture')) return null;
  const seconds = s.fieldNotes?.drySeconds ?? 0;
  return seconds >= 8
    ? '离水观察已足够 · 现在回潮池，比较补水前后的身体状态'
    : `保湿线索 · 离水观察 ${Math.floor(seconds)} / 8 秒后安全回潮池，也能发现保湿结构`;
}
export function poolRadius(w: World, pool: { radius: number }) {
  return pool.radius + Math.sin((w.time * Math.PI * 2) / 70) * 22;
}
export function wetAt(w: World, p: Vec) {
  return (
    p.x < 290 ||
    SHORE_POOLS.some((pool) => distance(pool, p) < poolRadius(w, pool))
  );
}
export function nearestPool(w: World) {
  return [...SHORE_POOLS].sort(
    (a, b) => distance(w.player, a) - distance(w.player, b),
  )[0];
}
export function shoreZone(w: World) {
  return (
    SHORE_POOLS.find((pool) => distance(pool, w.player) < poolRadius(w, pool))
      ?.name ?? (w.player.x < 290 ? '近岸海水' : '潮间沙洲 · 离水活动')
  );
}
export function shoreStats(w: World) {
  const s = w.shore!,
    anatomy = bodyEffects(s.body),
    base = getStats(w.traits, w.form);
  const legs = w.form === 'crawler',
    pads = w.form === 'skipper';
  return {
    landSpeed:
      (legs ? 152 : pads ? 125 : 76) *
      anatomy.speed *
      (w.traits.includes('shell') ? 0.87 : 1) *
      biologicalBonus(w).speed,
    waterSpeed:
      (legs ? 113 : pads ? 158 : 170) *
      anatomy.speed *
      biologicalBonus(w).speed,
    dryRate:
      (legs ? 4.8 : pads ? 3.2 : 6.5) *
      (hasAdaptation(s, 'skin') ? 0.52 : 1) *
      (shoreSheltered(w) ? 0.4 : 1),
    maxMoisture: hasAdaptation(s, 'reservoir') ? 150 : 100,
    maxEnergy: base.maxEnergy,
    metabolism:
      base.metabolism *
      anatomy.metabolism *
      (hasAdaptation(s, 'skin') ? 1.25 : 1),
    damage: base.damage * anatomy.damage,
  };
}
export function createShoreWorld(
  seed = 37,
  checkpoint?: ShoreCheckpoint,
): World {
  const cp: ShoreCheckpoint = structuredClone<ShoreCheckpoint>(
    checkpoint ?? {
      seed,
      generation: 1,
      time: 0,
      totalFood: 0,
      history: [],
      traits: [],
      form: 'fish',
      body: freshBody(),
      biomass: 0,
      standalone: true,
    },
  );
  const w = createWorld(cp.seed);
  w.learning = inheritedLearning(cp);
  w.dnaLineage = inheritedDna(cp);
  w.pondLife = undefined;
  w.habitat = 'shore';
  w.ocean = null;
  w.mode = 'running';
  w.form = cp.form;
  w.generation = cp.generation;
  w.time = cp.time;
  w.age = cp.age ?? 0;
  w.totalFood = cp.totalFood;
  w.history = structuredClone(cp.history);
  w.traits = [...cp.traits];
  if (cp.tidalLegacy) w.tidalLegacy = structuredClone(cp.tidalLegacy);
  w.shore = {
    checkpoint: cp,
    body: structuredClone(cp.body),
    biomass: cp.biomass,
    tier: cp.startingTier ?? 0,
    moisture: cp.adaptations?.includes('reservoir') ? 150 : 100,
    protection: cp.protection ?? null,
    ...(cp.adaptations ? { adaptations: [...cp.adaptations] } : {}),
    discovered: [],
    observation: {},
    visited: [SHORE_POOLS[0].name],
    creatures: [],
    skillCooldown: 0,
    skillActive: 0,
    morph: null,
    blocked: 0,
    dryWarning: false,
    fieldNotes: { drySeconds: 0, safeReturns: 0, harvestCycles: {} },
  };
  w.player = {
    ...w.player,
    x: SHORE_POOLS[0].x,
    y: SHORE_POOLS[0].y,
    energy: getStats(w.traits, w.form).maxEnergy * 0.85,
    invulnerable: 3,
  };
  if (cp.tidalLegacy) {
    w.shore.tidalResidents = cp.tidalLegacy.companions.map((originId, i) => ({
      originId,
      x: SHORE_POOLS[0].x + Math.cos(i * 2.4) * 90,
      y: SHORE_POOLS[0].y + Math.sin(i * 2.4) * 65,
      angle: i * 2.4,
    }));
    if (cp.tidalLegacy.entry === 'channel') {
      w.player.x += 70;
      w.player.y -= 30;
    }
  }
  w.foods = [];
  w.predators = [];
  w.explored = [SHORE_POOLS[0].name];
  let state = cp.seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = 0; i < 210; i++) {
    const pool = SHORE_POOLS[i % 5],
      angle = random() * Math.PI * 2,
      r = 65 + random() * (i < 140 ? pool.radius - 20 : pool.radius + 145);
    const p = {
      x: pool.x + Math.cos(angle) * r,
      y: pool.y + Math.sin(angle) * r,
    };
    if (SHORE_ROCKS.some((rock) => distance(rock, p) < rock.radius + 55))
      continue;
    w.foods.push({ ...p, id: i, cooldown: 0, rich: i % 4 === 0 });
  }
  const homes: { x: number; y: number; role: ShoreCreature['role'] }[] = [
    { x: 1080, y: 1210, role: 'ally' },
    { x: 2160, y: 1100, role: 'ally' },
    { x: 1360, y: 1140, role: 'rival' },
    { x: 1920, y: 920, role: 'rival' },
    { x: 1340, y: 1450, role: 'guardian' },
    { x: 1990, y: 590, role: 'guardian' },
    { x: 2450, y: 860, role: 'guardian' },
  ];
  w.shore!.creatures = homes.map((home, id) => ({
    ...home,
    home: { x: home.x, y: home.y },
    id,
    angle: 0,
    stun: 0,
    joined: false,
    alert: false,
  }));
  announce(
    w,
    '第一次登陆。潮池可以补水；先沿指引观察撑地生物，别在干沙上停留太久。',
  );
  return w;
}
export function enterShore(w: World) {
  if (w.habitat !== 'ocean' || w.mode !== 'won' || !w.ocean) return false;
  const legacy = tidalLegacy(w);
  if (legacy)
    rememberGeneration(w.history, {
      generation: w.generation,
      form: w.form,
      habitat: 'ocean',
      ...(w.learning ? { learning: inheritedLearning(w) } : {}),
      ...(w.dnaLineage ? { dnaLineage: inheritedDna(w) } : {}),
      traits: [...w.traits],
      food: w.food,
      seconds: w.age,
      body: structuredClone(w.ocean.body),
      ...(legacy
        ? {
            tidalLegacy: structuredClone(legacy),
            milestone: '在河口建立育生点',
          }
        : {}),
    });
  const cp: ShoreCheckpoint = {
    ...(legacy ? { tidalLegacy: structuredClone(legacy) } : {}),
    seed: w.seed + 211,
    generation: w.generation,
    time: w.time,
    age: w.age,
    totalFood: w.totalFood,
    history: structuredClone(w.history),
    ...(w.learning ? { learning: inheritedLearning(w) } : {}),
    ...(w.dnaLineage ? { dnaLineage: inheritedDna(w) } : {}),
    traits: [...w.traits],
    form: w.form,
    body: structuredClone(w.ocean.body),
    biomass: w.ocean.biomass,
    standalone: false,
  };
  Object.assign(w, createShoreWorld(cp.seed, cp));
  return true;
}
export function retryShore(w: World) {
  return createShoreWorld(
    w.shore?.checkpoint.seed ?? w.seed,
    w.shore?.checkpoint,
  );
}
function record(w: World): Ancestor {
  return {
    generation: w.generation,
    form: w.form,
    habitat: 'shore',
    ...(w.tidalLegacy ? { tidalLegacy: structuredClone(w.tidalLegacy) } : {}),
    ...(w.learning ? { learning: inheritedLearning(w) } : {}),
    ...(w.dnaLineage ? { dnaLineage: inheritedDna(w) } : {}),
    traits: [...w.traits],
    food: w.food,
    seconds: w.age,
    body: structuredClone(w.shore!.body),
    adaptation: w.shore!.protection ?? undefined,
    adaptations: adaptationsOf(w.shore!),
  };
}
export function shoreEvolutionGate(w: World) {
  const s = w.shore;
  if (!s || w.habitat !== 'shore' || !['running', 'evolving'].includes(w.mode))
    return '先继续潮间带探索。';
  if (s.morph) return '等待新的身体形成。';
  if (
    s.tier < 2 &&
    !s.discovered.includes(s.tier === 0 ? 'support' : 'moisture')
  )
    return s.tier === 0
      ? '先观察撑地生物，发现附肢的用途。'
      : '观察保湿生物，或离水探索 8 秒后安全返回潮池，寻找保湿方法。';
  const need = s.tier === 0 ? 8 : 12;
  if (w.food < need) return `本代还需要 ${need - w.food} 份食物。`;
  if (
    s.tier === 1 &&
    !s.visited.includes(SHORE_POOLS[2].name) &&
    (s.fieldNotes?.safeReturns ?? 0) < 2 &&
    (s.fieldNotes?.shelterSeconds ?? 0) < 6
  )
    return '探索蕨影潮池，或完成两次水陆往返、一次庇护实验。';
  if (
    !SHORE_POOLS.some((pool) => distance(pool, w.player) < poolRadius(w, pool))
  )
    return '回潮池里孕育下一代。';
  if (s.moisture < 70) return '先在水里恢复到 70 点湿润度。';
  if (w.player.energy < 50) return '先补充到 50 点能量。';
  return '';
}
export function evolveShore(w: World, choice: ShoreChoice) {
  if (shoreEvolutionGate(w)) return false;
  const s = w.shore!;
  if (
    s.tier === 0
      ? !['crawler', 'skipper'].includes(choice)
      : s.tier === 1
        ? !['reservoir', 'skin'].includes(choice)
        : !['crawler', 'skipper', 'reservoir', 'skin'].includes(choice)
  )
    return false;
  const from = w.form;
  const existing = adaptationsOf(s);
  rememberGeneration(w.history, record(w));
  if (choice === 'crawler' || choice === 'skipper') w.form = choice;
  else {
    s.protection = choice;
    s.adaptations = [...new Set([...existing, choice])];
  }
  s.tier = s.tier === 0 ? 1 : 2;
  w.generation++;
  w.age = 0;
  w.food = 0;
  s.morph = { from, elapsed: 0, duration: 2.2 };
  s.skillActive = 0;
  s.skillCooldown = 0;
  if (s.fieldNotes) s.fieldNotes.drySeconds = 0;
  s.moisture = shoreStats(w).maxMoisture;
  w.player.health = 100;
  w.player.energy = shoreStats(w).maxEnergy * 0.85;
  w.player.vx = w.player.vy = 0;
  w.player.dashing = false;
  w.player.invulnerable = 3;
  w.mode = 'running';
  announce(
    w,
    s.tier === 1
      ? '附肢撑起了身体！试试水中与陆地的移动差别。'
      : '下一代更能保存水分了。沿潮池向蕨林栖息地出发。',
  );
  beginEvolution(w, choice);
  return true;
}
export function shoreTarget(w: World): { point: Vec; label: string } {
  const s = w.shore!,
    stats = shoreStats(w);
  if (s.moisture < stats.maxMoisture * 0.32)
    return { point: nearestPool(w), label: '身体正在失水，尽快回潮池' };
  if (
    s.tier === 1 &&
    !s.discovered.includes('moisture') &&
    (s.fieldNotes?.drySeconds ?? 0) >= 8
  )
    return {
      point: nearestPool(w),
      label: '离水观察完成 · 回潮池发现保湿线索',
    };
  if (s.tier < 2) {
    const specimen = SHORE_SPECIMENS[s.tier];
    if (!s.discovered.includes(specimen.id))
      return { point: specimen, label: `观察${specimen.name}` };
    if (
      s.tier === 1 &&
      !s.visited.includes(SHORE_POOLS[2].name) &&
      (s.fieldNotes?.safeReturns ?? 0) < 2 &&
      (s.fieldNotes?.shelterSeconds ?? 0) < 6
    )
      return { point: SHORE_POOLS[2], label: '探索蕨影潮池' };
    if (w.food < (s.tier === 0 ? 8 : 12) || w.player.energy < 50) {
      const food = w.foods
        .filter((f) => f.cooldown === 0)
        .sort((a, b) => distance(a, w.player) - distance(b, w.player))[0];
      if (food) return { point: food, label: '寻找潮池食物，补足孕育营养' };
    }
    return { point: nearestPool(w), label: '回潮池补给，按 O 孕育下一代' };
  }
  const next = SHORE_POOLS.slice(2).find(
    (pool) => !s.visited.includes(pool.name),
  );
  return {
    point: next ?? SHORE_POOLS[4],
    label: next ? `沿潮池前进 · ${next.name}` : '抵达蕨林栖息地定居',
  };
}
export function nearbyAlly(w: World) {
  return w.shore?.creatures.find(
    (c) => c.role === 'ally' && !c.joined && distance(c, w.player) < 115,
  );
}
export function interactShore(w: World) {
  if (!w.shore || w.mode !== 'running' || w.shore.morph) return false;
  const bed = nearbyShellBed(w);
  if (bed && shellBedReady(w, bed.id)) {
    const notes = (w.shore.fieldNotes ??= {
      drySeconds: 0,
      safeReturns: 0,
      harvestCycles: {},
    });
    notes.harvestCycles[bed.id] = shoreTide(w).cycle;
    ingestBiologicalDna(w, 'shore:shellbed', 'practice');
    learnFrom(w, 'shore:shellbed');
    w.food += 4;
    w.totalFood += 4;
    w.player.energy = Math.min(shoreStats(w).maxEnergy, w.player.energy + 24);
    announce(
      w,
      `${bed.name}采食成功：4 份食物。涨潮后贝床会淹没，下一次退潮再来。`,
    );
    return true;
  }
  const ally = nearbyAlly(w);
  if (!ally) {
    if (buildShoreShelter(w)) return true;
    announce(
      w,
      bed
        ? shoreTide(w).exposed
          ? '这处贝床本轮已采食，留待下一次退潮。'
          : '贝床还在水下，等退潮露出后按 K 采食。'
        : '退潮时靠近贝床按 K 采食，或靠近蓝绿色同类分享食物。',
    );
    return false;
  }
  if (w.food < 2) {
    announce(w, '结伴需要分享本代的 2 份食物。');
    return false;
  }
  w.food -= 2;
  ally.joined = true;
  ingestBiologicalDna(w, 'shore:friend', 'symbiosis');
  learnFrom(w, 'shore:friend');
  announce(w, '同类加入了旅程！它会跟随你，并分担一部分碰撞伤害。');
  return true;
}
function constrain(p: Vec, r: number) {
  p.x = Math.max(r, Math.min(SHORE_MAP.width - r, p.x));
  p.y = Math.max(r, Math.min(SHORE_MAP.height - r, p.y));
  for (const rock of SHORE_ROCKS) {
    const d = distance(p, rock),
      limit = r + rock.radius;
    if (d < limit) {
      const a = d === 0 ? 0 : Math.atan2(p.y - rock.y, p.x - rock.x);
      p.x = rock.x + Math.cos(a) * limit;
      p.y = rock.y + Math.sin(a) * limit;
    }
  }
}
function shoreSpine(w: World, c: ShoreCreature) {
  return organTouches(worldBodyPose(w), { ...c, radius: 25 }, 'spine');
}
export function stepShore(w: World, input: Input, dt: number) {
  const s = w.shore,
    p = w.player;
  if (!s || w.mode !== 'running' || !Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, 0.05);
  if (p.health <= 0) {
    w.mode = 'dead';
    p.health = 0;
    return;
  }
  w.time += dt;
  if (s.morph) {
    s.morph.elapsed += dt;
    if (s.morph.elapsed >= s.morph.duration) s.morph = null;
    return;
  }
  w.age += dt;
  for (const [i, r] of (s.tidalResidents ?? []).entries()) {
    const a = w.time * 0.25 + i * 2.4;
    r.x = SHORE_POOLS[0].x + Math.cos(a) * 90;
    r.y = SHORE_POOLS[0].y + Math.sin(a) * 65;
    r.angle = a + Math.PI / 2;
  }
  stepShoreShelters(w, dt);
  const stats = shoreStats(w),
    raw = Math.hypot(input.x, input.y),
    moving = raw > 0.05;
  s.skillCooldown = Math.max(0, s.skillCooldown - dt);
  s.skillActive = Math.max(0, s.skillActive - dt);
  p.invulnerable = Math.max(0, p.invulnerable - dt);
  if (input.interact) interactShore(w);
  if (input.skill && s.skillCooldown === 0 && p.energy >= 12) {
    p.energy -= 12;
    s.skillCooldown = 8;
    s.skillActive = 1.1;
    p.invulnerable = 1.1;
    announce(
      w,
      s.tier === 0
        ? '摆体挣脱！向附近的潮池移动。'
        : '撑地跃进！抓紧时间穿过沙洲。',
    );
  }
  if (moving)
    p.angle = face(
      p.angle,
      Math.atan2(input.y, input.x),
      dt,
      13 * bodyEffects(s.body).turn,
    );
  p.dashing = input.dash && moving && p.energy > 10;
  const speed =
    (wetAt(w, p) ? stats.waterSpeed : stats.landSpeed) *
    (s.skillActive > 0 ? 2.2 : p.dashing ? 1.65 : 1);
  const unit = Math.max(1, raw);
  glide(p, (input.x / unit) * speed, (input.y / unit) * speed, dt, moving);
  const radius = worldBodyPose(w).size;
  Object.assign(
    p,
    constrainBody(
      { ...p, form: w.form, size: radius, body: s.body },
      SHORE_ROCKS,
      SHORE_MAP,
    ),
  );
  const wet = wetAt(w, p);
  s.moisture = Math.min(
    stats.maxMoisture,
    Math.max(
      0,
      s.moisture + (wet ? 25 : -stats.dryRate * (p.dashing ? 1.2 : 1)) * dt,
    ),
  );
  p.energy = Math.max(
    0,
    p.energy -
      (stats.metabolism * (moving ? 1 : 0.55) + (p.dashing ? 4 : 0)) * dt,
  );
  if (wet && !moving) p.energy = Math.min(stats.maxEnergy, p.energy + 1.8 * dt);
  if (s.moisture <= 0) {
    p.health -= 8 * dt;
    w.reason = '身体失水';
  } else if (p.energy <= 0) {
    p.health -= 7 * dt;
    w.reason = '能量耗尽';
  } else if (wet) p.health = Math.min(100, p.health + 3 * dt);
  if (!wet && s.moisture < 25 && !s.dryWarning) {
    s.dryWarning = true;
    announce(w, '身体正在失水！沿蓝色水滴指引返回最近的潮池。');
  }
  if (s.moisture > 70) s.dryWarning = false;
  for (const pool of SHORE_POOLS)
    if (
      distance(p, pool) < poolRadius(w, pool) &&
      !s.visited.includes(pool.name)
    ) {
      s.visited.push(pool.name);
      w.explored.push(pool.name);
      announce(w, `发现${pool.name}。这里可以补水、休息和孕育下一代。`);
    }
  for (const specimen of SHORE_SPECIMENS)
    if (!s.discovered.includes(specimen.id) && distance(p, specimen) < 105) {
      s.observation[specimen.id] = Math.min(
        2,
        (s.observation[specimen.id] ?? 0) + dt,
      );
      if (s.observation[specimen.id] >= 2) {
        s.discovered.push(specimen.id);
        ingestBiologicalDna(w, `shore:${specimen.id}`, 'observe');
        announce(
          w,
          specimen.id === 'support'
            ? '发现撑地结构！在潮池摄食补给，按 O 为下一代选择附肢。'
            : '发现保湿结构！下一代可以选择储水囊或保湿皮膜。',
        );
      }
    }
  for (const food of w.foods) {
    food.cooldown = Math.max(0, food.cooldown - dt);
    if (
      food.cooldown === 0 &&
      distance(p, food) < radius + 16 + biologicalBonus(w).pickup
    ) {
      food.cooldown = 40;
      w.food++;
      w.totalFood++;
      p.energy = Math.min(stats.maxEnergy, p.energy + (food.rich ? 17 : 12));
    }
  }
  for (const c of s.creatures) {
    c.stun = Math.max(0, c.stun - dt);
    let target = {
        x: c.home.x + Math.cos(w.time * 0.2 + c.id) * 30,
        y: c.home.y + Math.sin(w.time * 0.18 + c.id) * 25,
      },
      speed = 25;
    c.alert = c.role === 'guardian' && !wet && distance(p, c.home) < 230;
    if (c.joined) {
      target = companionSlot(p, s.creatures.filter((a) => a.joined).indexOf(c));
      speed = distance(c, target) > 80 ? 185 : 95;
    } else if (c.alert) {
      target = p;
      speed = 112;
    } else if (c.role === 'rival') {
      const food = w.foods
        .filter((f) => f.cooldown === 0 && distance(c.home, f) < 230)
        .sort((a, b) => distance(c, a) - distance(c, b))[0];
      if (food) {
        target = food;
        speed = 67;
        if (distance(c, food) < 25) food.cooldown = 40;
      }
    }
    if (
      c.role === 'guardian' &&
      distance(c, p) < radius + 48 &&
      (s.skillActive > 0 || shoreSpine(w, c))
    ) {
      if (c.stun === 0) {
        s.blocked++;
        announce(
          w,
          s.skillActive > 0
            ? '撑地跃进驱离了护巢者！'
            : '海洋带来的长刺挡住了护巢者！',
        );
      }
      c.stun = 2;
    }
    if (c.stun === 0 && distance(c, target) > 12) {
      const a = Math.atan2(target.y - c.y, target.x - c.x);
      c.angle = face(c.angle, a, dt, 9);
      c.x += Math.cos(a) * speed * dt;
      c.y += Math.sin(a) * speed * dt;
      constrain(c, 25);
    }
    if (
      c.alert &&
      c.stun === 0 &&
      p.invulnerable === 0 &&
      trunkTouches(worldBodyPose(w), { ...c, radius: 25 })
    ) {
      const company = s.creatures.some((a) => a.joined && distance(a, p) < 160);
      p.health -= stats.damage * (company ? 0.75 : 1);
      p.invulnerable = 1.5;
      c.stun = 0.8;
      w.reason = '遭遇护巢者';
      announce(w, '闯入护巢者领地！绕开琥珀色边界，或用 J 挣脱。');
    }
  }
  const spacable = new Set(
    s.creatures
      .filter(
        (c) =>
          !c.alert &&
          c.stun <= 0 &&
          distance(c, p) > radius + 50 &&
          !w.foods.some((f) => f.cooldown === 0 && distance(f, c) < 40),
      )
      .map((c) => c.id),
  );
  separateNeighbors(s.creatures, dt, (id) => spacable.has(id));
  for (const c of s.creatures) if (spacable.has(c.id)) constrain(c, 25);
  if (p.health <= 0) {
    p.health = 0;
    w.mode = 'dead';
    return;
  }
  if (s.tier === 1) {
    const notes = (s.fieldNotes ??= {
      drySeconds: 0,
      safeReturns: 0,
      harvestCycles: {},
    });
    if (!wet) {
      const before = notes.drySeconds;
      notes.drySeconds = Math.min(8, notes.drySeconds + dt);
      if (before < 8 && notes.drySeconds >= 8)
        announce(w, '离水观察足够了！返回潮池，比较身体补水前后的变化。');
    } else {
      if (notes.drySeconds >= 8) {
        notes.safeReturns = Math.min(1000000, notes.safeReturns + 1);
        const first = !s.discovered.includes('moisture');
        if (first) s.discovered.push('moisture');
        ingestBiologicalDna(w, 'shore:moisture', 'practice');
        announce(
          w,
          first
            ? '发现保湿线索：离水失水、入水恢复。下一代可选择储水囊或保湿皮膜，回潮池按 O 查看。'
            : '水陆往返实验完成 · 可以在身边的潮池孕育保湿身体。',
        );
      }
      notes.drySeconds = 0;
    }
  }
  if (
    !w.freeLife &&
    s.tier === 2 &&
    w.food >= 8 &&
    distance(p, SHORE_POOLS[4]) < poolRadius(w, SHORE_POOLS[4])
  ) {
    w.mode = 'won';
    rememberGeneration(w.history, record(w));
  }
}
