import { hasOrgan } from '../body-layout.ts';
import { biologicalBonus } from '../lineage-learning.ts';
import { stepTidalEvents, tidalEventFlow } from './events.ts';
import { saveTidalCheckpoint } from './migration.ts';
import type { Input, World } from '../simulation.ts';
import { getStats, distance } from '../simulation.ts';
import { FORMS } from '../forms.ts';
import { bodyEffects } from '../body-design.ts';
import { worldBodyPose, constrainBody } from '../body-geometry.ts';
import { face, glide } from '../motion.ts';
import { createTidalState } from './state.ts';
import { biomeAt, tidalFlow, tidalObstacles } from './habitat.ts';
import { TIDAL_BIOMES } from './catalog.ts';
import type { TidalState } from './types.ts';
import { seedTidalActors, stepTidalEcology, tidalWake } from './ecology.ts';
import {
  applyTidalCommand,
  stepTidalAbilities,
  tidalMovement,
  resolveTidalDamage,
} from './abilities.ts';
import { observeTidalSignals } from './discovery.ts';

export function ensureTidalWorld(w: World): TidalState {
  if (!w.ocean) throw Error('Tidal state requires the ocean chapter');
  const o = w.ocean,
    t = (o.tidal ??= createTidalState(w.seed));
  const added = TIDAL_BIOMES.filter((b) => !t.regions[b.id]);
  for (const b of added)
    t.regions[b.id] = {
      foodStock: b.foodCap,
      alert: 0,
      recoverySeconds: 0,
      populations: {},
    };
  if (added.length && t.compat.mode === 'active')
    seedTidalActors(
      w,
      added.map((b) => b.id),
    );
  if (t.compat.mode === 'completed-legacy') return t;
  if (t.compat.mode === 'pending' && distance(w.player, TIDAL_BIOMES[0]) > 250)
    return t;
  if (t.compat.mode === 'pending' || t.compat.mode === 'new') {
    t.compat.mode = 'active';
    w.foods = [];
    w.predators = [];
    o.shoal = [];
    o.meals = [];
    o.body.appearance ??= {
      base: FORMS[w.form].color,
      accent: w.traits.includes('chloroplast') ? '#9ce08f' : '#d9ffee',
      pattern: w.traits.includes('spikes') ? 'spots' : 'plain',
    };
    seedTidalActors(w);
  }
  return t;
}

/** Single ocean loop. Later systems extend this order, never run in the UI. */
export function stepTidal(w: World, input: Input, dt: number): void {
  if (!w.ocean || w.mode !== 'running' || !Number.isFinite(dt) || dt <= 0)
    return;
  const o = w.ocean,
    p = w.player;
  if (p.health <= 0) {
    p.health = 0;
    w.mode = 'dead';
    w.reason = '遭遇海洋捕食者';
    return;
  }
  dt = Math.min(dt, 0.05);
  w.time += dt;
  if (o.morph) {
    o.morph.elapsed = Math.min(o.morph.duration, o.morph.elapsed + dt);
    if (o.morph.elapsed >= o.morph.duration) o.morph = null;
    return;
  }
  const t = ensureTidalWorld(w);
  if (t.compat.mode !== 'active') return;
  t.tick += Math.max(1, Math.round(dt * 120));
  w.age += dt;
  const anatomy = bodyEffects(o.body),
    form = FORMS[w.form],
    stats = getStats(w.traits, w.form);
  stats.speed *= biologicalBonus(w).speed;
  const raw = Math.hypot(input.x, input.y),
    moving = raw > 0.05,
    safe = distance(p, TIDAL_BIOMES[0]) < 250;
  o.skillCooldown = Math.max(0, o.skillCooldown - dt);
  o.skillActive = Math.max(0, o.skillActive - dt);
  p.invulnerable = Math.max(0, p.invulnerable - dt);
  const command =
    input.tidalCommand ??
    (input.skill || input.command || input.interact
      ? {
          id: t.abilities.lastCommandId + 1,
          kind: input.skill
            ? ('slot0' as const)
            : input.command
              ? ('slot1' as const)
              : ('interact' as const),
        }
      : null);
  const signals = command ? applyTidalCommand(w, command) : [];
  if (w.mode !== 'running') return;
  const ability = tidalMovement(w);
  if (moving)
    p.angle = face(
      p.angle,
      Math.atan2(input.y, input.x),
      dt,
      (12 + form.turnRate) * anatomy.turn * ability.turn,
    );
  const burst = o.skillActive > 0 && form.branch === 'bilateral';
  p.dashing = input.dash && moving && p.energy > 8 && ability.dash;
  const flow = tidalWake(w, tidalEventFlow(w, p, tidalFlow(p, t.tick)));
  if (t.abilities.anchored) {
    flow.x *= 0.1;
    flow.y *= 0.1;
  } else if (hasOrgan(o.body, 'sail')) {
    flow.x *= 0.45;
    flow.y *= 0.45;
  }
  if (safe && w.evolution?.choice === 'anatomy' && w.age < 30) {
    const resistance = t.abilities.shellSeconds > 0 ? 0.25 : 1;
    flow.y += Math.sin((t.tick / 120) * 1.6) * 12 * resistance;
  }
  const pulse =
    form.branch === 'radial'
      ? 0.82 + 0.36 * (0.5 + 0.5 * Math.sin(w.time * 5))
      : 1;
  const speed =
    stats.speed *
    anatomy.speed *
    (burst ? 2.8 : p.dashing ? 2.1 : 1) *
    pulse *
    ability.speed;
  const unit = Math.max(raw, 1),
    dx = burst ? Math.cos(p.angle) : input.x / unit,
    dy = burst ? Math.sin(p.angle) : input.y / unit;
  glide(p, dx * speed + flow.x, dy * speed + flow.y, dt, moving || burst);
  Object.assign(
    p,
    constrainBody(worldBodyPose(w), tidalObstacles(t.tick), {
      width: 3400,
      height: 2300,
    }),
  );
  p.energy = Math.max(
    0,
    p.energy -
      (stats.metabolism * anatomy.metabolism * (moving ? 1.15 : 0.65) +
        (p.dashing ? 5 : 0)) *
        dt,
  );
  if (w.traits.includes('chloroplast') && biomeAt(p) === 'drift' && !moving)
    p.energy = Math.min(stats.maxEnergy, p.energy + 3 * dt);
  if (p.energy === 0) p.health -= 10 * dt;
  else if (p.energy > 35)
    p.health = Math.min(100, p.health + (safe ? 3 : 0.45) * dt);
  const ecology = stepTidalEcology(w, dt, input.viewport);
  resolveTidalDamage(w, ecology);
  signals.push(...ecology, ...stepTidalAbilities(w, dt));
  observeTidalSignals(w, signals);
  stepTidalEvents(w, dt, signals);
  const biome = biomeAt(p),
    region = TIDAL_BIOMES.find((b) => b.id === biome)!;
  if (
    distance(p, region) < region.radius &&
    !t.migration.visited.includes(biome)
  ) {
    t.migration.visited.push(biome);
    const names = {
      nursery: ['海草育生地'],
      reef: ['珊瑚礁缘'],
      drift: ['透光浮游区', '洋流走廊'],
      estuary: ['潮岸河口'],
      kelp: ['巨藻迷林'],
      vent: ['暖泉深谷'],
    }[biome];
    for (const name of names) {
      if (!o.visited.includes(name)) o.visited.push(name);
      if (!w.explored.includes(name)) w.explored.push(name);
    }
  }
  if (
    p.health > 0 &&
    (!t.safeCheckpoint || t.tick - t.safeCheckpoint.ocean.tidal.tick >= 600)
  )
    saveTidalCheckpoint(w);
  if (p.health <= 0) {
    p.health = 0;
    w.mode = 'dead';
    w.reason = p.energy <= 0 ? '能量耗尽' : '遭遇海洋捕食者';
  }
}
