import {
  inheritedDna,
  MICROBE_BODIES,
  inheritedDnaOrgans,
} from './dna-evolution.ts';
import { biologicalBonus, inheritedLearning } from './lineage-learning.ts';
import {
  freshMigration,
  stepMigration,
  migrationTarget,
  migrationLegacy,
} from './ocean-migration.ts';
import { constrainBody, trunkTouches } from './body-geometry.ts';
import { beginEvolution } from './evolution-experience.ts';
import { rememberGeneration } from './lineage.ts';
import {
  freshBody,
  bodyEffects,
  stepDiscovery,
  blockWithSpine,
} from './body-design.ts';
import {
  seedShoal,
  stepFoodChain,
  bodyRadius,
  canSwallow,
} from './food-chain.ts';
import { glide, face } from './motion.ts';
import {
  createWorld,
  getStats,
  distance,
  announce,
  TRAITS,
} from './simulation.ts';
import type { World, TraitId, Input, Vec } from './simulation.ts';
import { FORMS, nextForms } from './forms.ts';
import type { BodyForm, OceanCheckpoint } from './forms.ts';
import { ensureTidalWorld, stepTidal } from './tidal/step.ts';
import { listOrgans } from './body-layout.ts';
import { availableTidalActions } from './tidal/abilities.ts';
import { retryTidal } from './tidal/migration.ts';
import { TIDAL_BIOMES } from './tidal/catalog.ts';
export const OCEAN_MAP = { width: 3400, height: 2300 };
export const OCEAN_NURSERY = { x: 460, y: 1770, radius: 250 };
export const OCEAN_LIGHT = { x: 1250, y: 600, radius: 420 };
export const OCEAN_REEF = { x: 2380, y: 1430, radius: 390 };
export const OCEAN_CURRENT = { x: 1590, y: 1750, radius: 430 };
export const OCEAN_HAVEN = { x: 3060, y: 390, radius: 210 };
export const OCEAN_ROCKS = [
  { x: 840, y: 1450, radius: 80 },
  { x: 1900, y: 1050, radius: 105 },
  { x: 2230, y: 1230, radius: 90 },
  { x: 2500, y: 1620, radius: 105 },
  { x: 2710, y: 1000, radius: 92 },
  { x: 850, y: 420, radius: 76 },
];
export const OCEAN_ZONES = [
  { ...OCEAN_NURSERY, name: '海草育生地', color: '#80d9bc' },
  { ...OCEAN_LIGHT, name: '透光浮游区', color: '#e4e3a0' },
  { ...OCEAN_REEF, name: '珊瑚礁缘', color: '#e4a3c1' },
  { ...OCEAN_CURRENT, name: '洋流走廊', color: '#8bbfe9' },
  { ...OCEAN_HAVEN, name: '远海栖息地', color: '#c3cdf9' },
];
function record(w: World) {
  return {
    ...(migrationLegacy(w) ? { milestone: migrationLegacy(w) } : {}),
    ...(w.tidalLegacy ? { tidalLegacy: structuredClone(w.tidalLegacy) } : {}),
    generation: w.generation,
    form: w.form,
    habitat: w.habitat,
    ...(w.learning ? { learning: inheritedLearning(w) } : {}),
    ...(w.dnaLineage ? { dnaLineage: inheritedDna(w) } : {}),
    traits: [...w.traits],
    food: w.food,
    seconds: w.age,
    body: w.ocean ? structuredClone(w.ocean.body) : undefined,
  };
}
export function createOceanWorld(
  seed = 23,
  checkpoint?: OceanCheckpoint,
  variant: 'tidal' | 'legacy' = 'tidal',
): World {
  const cp = structuredClone(
    checkpoint ?? {
      seed,
      generation: 1,
      time: 0,
      totalFood: 0,
      history: [],
      traits: [],
      standalone: true,
    },
  );
  const w = createWorld(cp.seed);
  w.learning = inheritedLearning(cp);
  w.dnaLineage = inheritedDna(cp);
  w.pondLife = undefined;
  w.habitat = 'ocean';
  w.form = cp.startingForm ?? 'colony';
  w.mode = 'running';
  w.generation = cp.generation;
  w.time = cp.time;
  w.totalFood = cp.totalFood;
  w.history = structuredClone(cp.history);
  w.traits = [...cp.traits];
  w.ocean = {
    body: cp.startingBody
      ? structuredClone(cp.startingBody)
      : {
          ...freshBody(),
          length: MICROBE_BODIES[w.dnaLineage?.body ?? 'ancestor'].length,
          width: MICROBE_BODIES[w.dnaLineage?.body ?? 'ancestor'].width,
        },
    dna: cp.startingDna ?? 24,
    discovered: ['jaw', 'fin', ...inheritedDnaOrgans(w)],
    observation: {},
    blocks: 0,
    defenseFlash: 0,
    biomass: 0,
    eaten: 0,
    shoal: [],
    meals: [],
    gulp: 0,
    tier: ['fish', 'jelly'].includes(w.form)
      ? 2
      : ['bilateral', 'radial'].includes(w.form)
        ? 1
        : 0,
    branch: ['radial', 'jelly'].includes(w.form)
      ? 'radial'
      : ['bilateral', 'fish'].includes(w.form)
        ? 'bilateral'
        : null,
    visited: ['海草育生地'],
    morph: null,
    skillCooldown: 0,
    skillActive: 0,
    checkpoint: cp,
    migration: freshMigration(),
    enteredAt: cp.time,
  };
  w.player = {
    ...w.player,
    x: OCEAN_NURSERY.x,
    y: OCEAN_NURSERY.y,
    energy: getStats(w.traits, w.form).maxEnergy * 0.85,
    invulnerable: 2,
  };
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  w.foods = [];
  for (let i = 0; i < 470; i++) {
    let p: Vec;
    let attempts = 0;
    do {
      const zone = OCEAN_ZONES[i % 5];
      const clustered = i < 250;
      const a = random() * Math.PI * 2;
      const r = 90 + random() * zone.radius;
      p = clustered
        ? { x: zone.x + Math.cos(a) * r, y: zone.y + Math.sin(a) * r }
        : { x: 90 + random() * 3220, y: 90 + random() * 2120 };
      attempts++;
    } while (
      attempts < 50 &&
      (distance(p, OCEAN_NURSERY) < 85 ||
        OCEAN_ROCKS.some((r) => distance(p, r) < r.radius + 70) ||
        p.x > 3340 ||
        p.y > 2240)
    );
    w.foods.push({
      ...p,
      id: i,
      cooldown: 0,
      rich: i % 5 === 1 || i % 5 === 2,
    });
  }
  w.predators = [
    { x: 1040, y: 950 },
    { x: 1490, y: 350 },
    { x: 2070, y: 1750 },
    { x: 2420, y: 810 },
    { x: 2930, y: 1500 },
    { x: 2990, y: 600 },
  ].map((home, id) => ({
    ...home,
    home: { ...home },
    id,
    radius: [36, 44, 54, 66, 82, 100][id],
    respawn: 0,
    bite: 0,
    angle: random() * 6.28,
    alert: false,
    stun: 0,
  }));
  w.ocean.shoal = seedShoal(random);
  w.explored = ['海草育生地'];
  announce(
    w,
    '用嘴对准青绿色小鱼吞食。东北方有金色棘尾生物，靠近可发现新器官。',
  );
  const parent = cp.history.at(-1);
  if (!cp.standalone && parent && (parent.form ?? 'microbe') === 'microbe') {
    w.ocean.morph = {
      from: 'microbe',
      to: 'colony',
      elapsed: 0,
      duration: 5.4,
    };
    beginEvolution(w, 'colony');
    announce(
      w,
      '上一代的细胞没有消失。后代保留原有特征，逐渐形成协同游动的细胞群。',
    );
  }
  w.ocean.discovered = [
    ...new Set([
      ...w.ocean.discovered,
      ...listOrgans(w.ocean.body).map((p) => p.organ),
    ]),
  ];
  if (variant === 'tidal') {
    const tidal = ensureTidalWorld(w);
    if (cp.startingBody)
      tidal.abilities.slots[1] =
        availableTidalActions(w).find((action) => action !== 'form-skill') ??
        null;
  }
  return w;
}
export function enterOcean(w: World, variant: 'tidal' | 'legacy' = 'tidal') {
  if (w.habitat !== 'pond' || w.mode !== 'won') return false;
  rememberGeneration(w.history, {
    generation: w.generation,
    habitat: 'pond',
    form: w.form,
    ...(w.learning ? { learning: inheritedLearning(w) } : {}),
    ...(w.dnaLineage ? { dnaLineage: inheritedDna(w) } : {}),
    traits: [...w.traits],
    food: w.food,
    seconds: w.age,
  });
  const cp: OceanCheckpoint = {
    seed: w.seed + 101,
    generation: w.generation + 1,
    time: w.time,
    totalFood: w.totalFood,
    history: structuredClone(w.history),
    ...(w.learning ? { learning: inheritedLearning(w) } : {}),
    ...(w.dnaLineage ? { dnaLineage: inheritedDna(w) } : {}),
    traits: [...w.traits],
    standalone: false,
  };
  Object.assign(w, createOceanWorld(cp.seed, cp, variant));
  return true;
}
export function retryOcean(w: World) {
  if (w.ocean?.tidal?.compat.mode === 'active') return retryTidal(w);
  return createOceanWorld(
    w.ocean?.checkpoint.seed ?? w.seed,
    w.ocean?.checkpoint,
    'legacy',
  );
}
export function oceanEvolutionGate(w: World) {
  const o = w.ocean;
  if (!o || w.habitat !== 'ocean') return '先进入海洋。';
  if (w.mode !== 'running' && w.mode !== 'evolving') return '先继续探索。';
  if (o.morph) return '新身体正在形成。';
  const food = o.tier === 0 ? 10 : 14,
    energy = o.tier === 0 ? 65 : 75;
  if (w.food < food) return `本代还需要 ${food - w.food} 份食物。`;
  if (w.player.energy < energy) return `形态分化需要 ${energy} 点能量。`;
  const zones = o.tier === 0 ? ['透光浮游区'] : ['珊瑚礁缘', '洋流走廊'];
  const missing = zones.filter((z) => !o.visited.includes(z));
  if (missing.length) return `先探索：${missing.join('、')}。`;
  if (distance(w.player, OCEAN_NURSERY) > OCEAN_NURSERY.radius)
    return '返回海草育生地，孕育新的身体。';
  return '';
}
export function evolveOcean(w: World, form: BodyForm, trait?: TraitId) {
  if (
    oceanEvolutionGate(w) ||
    !nextForms(w.form).includes(form) ||
    (trait !== undefined &&
      (w.traits.includes(trait) || !TRAITS.some((t) => t.id === trait)))
  )
    return false;
  const o = w.ocean!;
  const from = w.form;
  rememberGeneration(w.history, record(w));
  w.form = form;
  w.generation++;
  if (trait) w.traits.push(trait);
  w.food = 0;
  w.age = 0;
  w.mode = 'running';
  o.tier = FORMS[form].tier as 1 | 2;
  o.branch = FORMS[form].branch;
  o.morph = { from, to: form, elapsed: 0, duration: 3 };
  o.skillCooldown = 0;
  o.skillActive = 0;
  w.player.health = 100;
  w.player.energy = getStats(w.traits, form).maxEnergy * 0.85;
  w.player.invulnerable = 4;
  w.player.dashing = false;
  w.player.vx = 0;
  w.player.vy = 0;
  announce(w, `${FORMS[form].name}诞生了！${FORMS[form].movement}。`);
  beginEvolution(w, form);
  return true;
}
export function oceanZone(p: Vec) {
  return OCEAN_ZONES.find((z) => distance(p, z) < z.radius)?.name ?? '开阔海域';
}
export function oceanFlow(p: Vec, time: number) {
  const d = distance(p, OCEAN_CURRENT);
  return d < OCEAN_CURRENT.radius
    ? { x: 95 * (1 - d / OCEAN_CURRENT.radius), y: -24 * Math.sin(time * 0.25) }
    : { x: Math.sin(p.y / 360 + time * 0.12) * 9, y: Math.cos(p.x / 400) * 6 };
}
export function oceanTarget(w: World) {
  const o = w.ocean!;
  if (o.tidal?.compat.mode === 'active') {
    const need = o.tier === 0 ? 10 : o.tier === 1 ? 14 : 8;
    const food = o.tidal.foods
      .filter((f) => f.state === 'available')
      .sort((a, b) => distance(a, w.player) - distance(b, w.player))[0];
    if (w.food < need || w.player.energy < 65)
      return {
        point: food ?? TIDAL_BIOMES[0],
        label: food ? '寻找食物' : '回育生湾等待补给',
      };
    const region =
      o.tier === 0
        ? TIDAL_BIOMES[2]
        : o.tier === 1
          ? TIDAL_BIOMES[1]
          : TIDAL_BIOMES[3];
    if (o.tier < 2 && o.tidal.migration.visited.includes(region.id))
      return { point: TIDAL_BIOMES[0], label: '回育生湾孕育新身体' };
    return {
      point: region,
      label: o.tier === 2 ? '沿补给前往潮岸河口' : `探索${region.name}`,
    };
  }
  // Optional anatomy discoveries must never replace the actual progression goal.
  const need = o.tier === 0 ? 10 : o.tier === 1 ? 14 : 8;
  if (
    w.food < need ||
    w.player.energy < (o.tier === 0 ? 65 : o.tier === 1 ? 75 : 25)
  ) {
    const food = w.foods
      .filter((f) => f.cooldown === 0)
      .map((point) => ({
        point,
        score:
          distance(point, w.player) +
          w.predators.reduce(
            (risk, e) =>
              risk +
              ((e.respawn ?? 0) === 0
                ? Math.max(0, 230 - distance(point, e)) * 4
                : 0),
            0,
          ),
      }))
      .sort((a, b) => a.score - b.score)[0]?.point;
    return {
      point: food ?? OCEAN_NURSERY,
      label: food
        ? w.food < need
          ? '寻找食物，积累营养'
          : '先摄食补充能量'
        : '回育生地休息，等待食物再生',
    };
  }
  if (o.tier === 2) return migrationTarget(w);
  const zones =
    o.tier === 0 ? [OCEAN_ZONES[1]] : [OCEAN_ZONES[3], OCEAN_ZONES[2]];
  const next = zones.find((z) => !o.visited.includes(z.name));
  return next
    ? { point: next, label: `探索${next.name}` }
    : { point: OCEAN_NURSERY, label: '回海草育生地孕育新形态' };
}
function repel(p: Vec, radius: number) {
  for (const rock of OCEAN_ROCKS) {
    const d = distance(p, rock),
      limit = radius + rock.radius;
    if (d < limit) {
      const a = d === 0 ? 0 : Math.atan2(p.y - rock.y, p.x - rock.x);
      p.x = rock.x + Math.cos(a) * limit;
      p.y = rock.y + Math.sin(a) * limit;
    }
  }
}
export function stepOcean(w: World, input: Input, dt: number) {
  if (w.mode !== 'running' || !w.ocean || !Number.isFinite(dt) || dt <= 0)
    return;
  if (
    w.ocean.tidal &&
    !['pending', 'completed-legacy'].includes(w.ocean.tidal.compat.mode)
  ) {
    stepTidal(w, input, dt);
    return;
  }
  if (
    w.ocean.tidal?.compat.mode === 'pending' &&
    distance(w.player, OCEAN_NURSERY) <= OCEAN_NURSERY.radius &&
    !w.ocean.morph
  ) {
    ensureTidalWorld(w);
    stepTidal(w, input, dt);
    return;
  }
  dt = Math.min(dt, 0.05);
  const o = w.ocean,
    p = w.player;
  const die = () => {
    w.mode = 'dead';
    p.health = 0;
    w.reason =
      p.energy <= 0
        ? '能量耗尽'
        : w.reason === '被大鱼吞食'
          ? w.reason
          : '遭遇海洋捕食者';
  };
  if (p.health <= 0) {
    die();
    return;
  }
  w.time += dt;
  if (o.morph) {
    o.morph.elapsed += dt;
    if (o.morph.elapsed >= o.morph.duration) o.morph = null;
    return;
  }
  w.age += dt;
  stepDiscovery(w, dt);
  const anatomy = bodyEffects(o.body);
  const form = FORMS[w.form],
    stats = getStats(w.traits, w.form),
    raw = Math.hypot(input.x, input.y),
    moving = raw > 0.05,
    safe = distance(p, OCEAN_NURSERY) < OCEAN_NURSERY.radius;
  o.skillCooldown = Math.max(0, o.skillCooldown - dt);
  o.skillActive = Math.max(0, o.skillActive - dt);
  p.invulnerable = Math.max(0, p.invulnerable - dt);
  if (input.skill && o.skillCooldown === 0 && p.energy >= 14) {
    p.energy -= 14;
    o.skillCooldown = 8;
    o.skillActive = w.form === 'colony' ? 2.5 : 1.5;
    p.invulnerable = o.skillActive;
    announce(w, `${form.skill}！`);
  }
  if (moving)
    p.angle = face(
      p.angle,
      Math.atan2(input.y, input.x),
      dt,
      (12 + form.turnRate) * anatomy.turn,
    );
  const burst = o.skillActive > 0 && form.branch === 'bilateral';
  p.dashing = input.dash && moving && p.energy > 8;
  const flow = safe ? { x: 0, y: 0 } : oceanFlow(p, w.time);
  const pulse =
    form.branch === 'radial'
      ? 0.82 + 0.36 * (0.5 + 0.5 * Math.sin(w.time * 5))
      : 1;
  const filterDrag = o.migration?.expanded ? 0.38 : 1;
  const speed =
    filterDrag *
    stats.speed *
    biologicalBonus(w).speed *
    anatomy.speed *
    (burst ? 2.8 : p.dashing ? 2.1 : 1) *
    pulse;
  const unit = Math.max(raw, 1),
    dx = burst ? Math.cos(p.angle) : input.x / unit,
    dy = burst ? Math.sin(p.angle) : input.y / unit;
  // Heading animates independently: reversing input never sends the player the wrong way.
  glide(p, dx * speed + flow.x, dy * speed + flow.y, dt, moving || burst);
  const radius = bodyRadius(w);
  Object.assign(
    p,
    constrainBody(
      { ...p, form: w.form, size: radius, body: o.body },
      OCEAN_ROCKS,
      OCEAN_MAP,
    ),
  );
  p.energy = Math.max(
    0,
    p.energy -
      (stats.metabolism * anatomy.metabolism * (moving ? 1.15 : 0.65) +
        (p.dashing ? 5 : 0)) *
        dt,
  );
  if (
    w.traits.includes('chloroplast') &&
    distance(p, OCEAN_LIGHT) < OCEAN_LIGHT.radius &&
    !moving
  )
    p.energy = Math.min(stats.maxEnergy, p.energy + 3 * dt);
  if (p.energy === 0) p.health -= 10 * dt;
  else if (p.energy > 35)
    p.health = Math.min(100, p.health + (safe ? 3 : 0.45) * dt);
  const pickup =
    stats.pickup +
    biologicalBonus(w).pickup +
    anatomy.pickup +
    (o.skillActive > 0 && form.branch === 'radial' ? 100 : 0);
  for (const food of w.foods) {
    if (food.cooldown > 0) {
      food.cooldown = Math.max(0, food.cooldown - dt);
      continue;
    }
    if (distance(p, food) < pickup) {
      food.cooldown = 32;
      w.food++;
      w.totalFood++;
      o.dna = Math.min(999, o.dna + 1);
      o.biomass = Math.min(100, o.biomass + 0.06);
      p.energy = Math.min(stats.maxEnergy, p.energy + (food.rich ? 16 : 12));
    }
  }
  stepFoodChain(w, dt);
  stepMigration(w, dt, !!input.interact);
  for (const enemy of w.predators) {
    if ((enemy.respawn ?? 0) > 0) continue;
    const enemyRadius = enemy.radius ?? 36,
      playerRadius = bodyRadius(w);
    const canHunt = canSwallow(enemyRadius, playerRadius);
    enemy.stun = Math.max(0, enemy.stun - dt);
    const d = distance(p, enemy);
    const guarding = enemy.id === 4;
    const ambushing = enemy.id === 3;
    enemy.alert =
      !safe &&
      canHunt &&
      d < (ambushing ? 190 : 300 + enemyRadius) &&
      (!guarding || distance(p, enemy.home) < 250);
    if (o.skillActive > 0 && form.branch === 'radial' && d < pickup + 65) {
      enemy.stun = 2;
      enemy.x += ((enemy.x - p.x) / Math.max(d, 1)) * 95 * dt;
      enemy.y += ((enemy.y - p.y) / Math.max(d, 1)) * 95 * dt;
    }
    if (!safe && canHunt) blockWithSpine(w, enemy, enemyRadius);
    const scared = canSwallow(playerRadius, enemyRadius) && d < 240;
    const fishTarget = o.shoal.find(
      (f) =>
        f.cooldown === 0 &&
        canSwallow(enemyRadius, f.radius) &&
        distance(enemy, f) < 240,
    );
    const target = scared
      ? { x: enemy.x + (enemy.x - p.x), y: enemy.y + (enemy.y - p.y) }
      : enemy.alert
        ? p
        : ((guarding ? null : fishTarget) ?? {
            x:
              enemy.home.x +
              Math.cos(w.time * 0.18 + enemy.id) *
                (ambushing ? 18 : guarding ? 75 : 150),
            y:
              enemy.home.y +
              Math.sin(w.time * 0.15 + enemy.id) *
                (ambushing ? 18 : guarding ? 75 : 120),
          });
    enemy.angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
    if (enemy.stun === 0) {
      const pace = enemy.alert
        ? ambushing
          ? 170
          : 104 + Math.min(18, enemyRadius * 0.2)
        : scared
          ? 100
          : fishTarget && !guarding
            ? 70
            : 35;
      const next = {
        x: enemy.x + Math.cos(enemy.angle) * pace * dt,
        y: enemy.y + Math.sin(enemy.angle) * pace * dt,
      };
      if (
        distance(next, OCEAN_NURSERY) >
        OCEAN_NURSERY.radius + enemyRadius + 15
      ) {
        enemy.x = next.x;
        enemy.y = next.y;
        repel(enemy, enemyRadius);
      }
    }
    if (
      !safe &&
      canHunt &&
      trunkTouches(
        { ...p, form: w.form, size: playerRadius, body: o.body },
        { ...enemy, radius: enemyRadius * 0.8 },
      ) &&
      p.invulnerable === 0 &&
      enemy.stun === 0
    ) {
      enemy.bite = (enemy.bite ?? 0) + dt;
      if (enemy.bite < 0.5) continue;
      if (enemyRadius > playerRadius * 1.8) w.reason = '被大鱼吞食';
      p.health -=
        enemyRadius > playerRadius * 1.8
          ? 100
          : stats.damage * 1.5 * anatomy.damage;
      enemy.bite = 0;
      p.invulnerable = 1.8;
      enemy.stun = w.traits.includes('spikes') ? 3 : 0.7;
      announce(w, '大鱼正在吞咬！用 J 技能或空格冲刺脱离。');
    } else enemy.bite = 0;
  }
  const zone = oceanZone(p);
  if (!o.visited.includes(zone)) {
    o.visited.push(zone);
    w.explored.push(zone);
    if (zone !== '开阔海域') announce(w, `发现：${zone}。已记入进化旅程。`);
  }
  if (p.health <= 0) {
    die();
    return;
  }
  if (
    !w.freeLife &&
    o.tier === 2 &&
    FORMS[w.form].tier === 2 &&
    w.food >= 8 &&
    (o.migration?.station ?? 0) >= 2 &&
    distance(p, OCEAN_HAVEN) < OCEAN_HAVEN.radius
  ) {
    w.mode = 'won';
    o.migration!.arrived = true;
    announce(w, '这一支生命越过了深水。潮水之外，还有未曾踏过的世界。');
    rememberGeneration(w.history, record(w));
  }
}
