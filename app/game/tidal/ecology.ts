import { separateNeighbors } from '../readability.ts';
import { TIDAL_FOOD_LIMIT } from './types.ts';
import { tidalSight } from './discovery.ts';
import { ingestOceanDna } from '../dna-evolution.ts';
import { announce } from '../simulation.ts';
import { learnFrom } from '../lineage-learning.ts';
import type { World, Vec, Input } from '../simulation.ts';
import { distance } from '../simulation.ts';
import { face } from '../motion.ts';
import { worldBodyPose, organTouches } from '../body-geometry.ts';
import { canSwallow, bodyRadius } from '../food-chain.ts';
import { tidalObstacles, tidalWaypoint } from './habitat.ts';
import { TIDAL_BIOMES, TIDAL_SPECIES } from './catalog.ts';
import type {
  TidalActor,
  TidalFood,
  TidalSignal,
  SignalKind,
  BiomeId,
} from './types.ts';
import { tidalIntent } from './behavior.ts';

const state = (w: World) => w.ocean!.tidal!;
const emitted = new WeakMap<World, WeakSet<TidalSignal>>();
export const emittedTidalSignal = (w: World, s: TidalSignal) =>
  emitted.get(w)?.has(s) ?? false;
function random(w: World) {
  const t = state(w);
  t.rng = (Math.imul(t.rng, 1664525) + 1013904223) >>> 0;
  return t.rng / 4294967296;
}
export function tidalSignal(
  w: World,
  kind: SignalKind,
  actorId: string | null,
  targetId: string | null,
  point: Vec,
  amount = 0,
): TidalSignal {
  const t = state(w);
  const signal = Object.freeze({
    seq: t.nextSeq++,
    tick: t.tick,
    kind,
    actorId,
    targetId,
    point: Object.freeze({ x: point.x, y: point.y }),
    amount,
  });
  if (!emitted.has(w)) emitted.set(w, new WeakSet());
  emitted.get(w)!.add(signal);
  return signal;
}
function carrier(w: World, id: string) {
  if (id === 'player') return state(w).abilities;
  return state(w).actors.find((a) => a.id === id);
}
function carried(w: World, owner: string): string | null | undefined {
  const c = carrier(w, owner);
  return c && ('carriedId' in c ? c.carriedId : c.carryingId);
}
function setCarried(w: World, owner: string, id: string | null) {
  const c = carrier(w, owner);
  if (c) {
    if ('carriedId' in c) c.carriedId = id;
    else c.carryingId = id;
  }
}
export function takeTidalFood(
  w: World,
  id: string,
  owner: string,
): TidalFood | null {
  if (
    !w.ocean?.tidal ||
    w.mode !== 'running' ||
    !!w.ocean.morph ||
    carried(w, owner) !== null
  )
    return null;
  const f = state(w).foods.find(
    (f) => f.id === id && f.state === 'available' && f.owner === null,
  );
  if (!f || (f.reservedFor && f.reservedFor !== owner)) return null;
  f.state = 'carried';
  f.owner = owner;
  setCarried(w, owner, id);
  return f;
}
export function consumeTidalFood(w: World, id: string, owner: string): number {
  if (
    !w.ocean?.tidal ||
    w.mode !== 'running' ||
    !!w.ocean.morph ||
    carried(w, owner) !== id
  )
    return 0;
  const f = state(w).foods.find(
    (f) => f.id === id && f.state === 'carried' && f.owner === owner,
  );
  if (!f) return 0;
  f.state = 'consumed';
  f.owner = null;
  f.regrowSeconds = f.biome === 'nursery' ? 18 : 25;
  setCarried(w, owner, null);
  const recipient = state(w).actors.find((a) => a.id === owner && a.health > 0);
  const region = state(w).regions[f.biome];
  if (owner === 'player')
    region.harvestPressure = Math.min(12, (region.harvestPressure ?? 0) + 0.08);
  if (f.offeredBy === 'player' && recipient) {
    region.harvestPressure = Math.max(0, (region.harvestPressure ?? 0) - 0.6);
    region.bond = Math.min(6, (region.bond ?? 0) + 0.5);
    recipient.trust = Math.min(100, recipient.trust + 20);
    if (state(w).migration.startedTick !== null)
      state(w).migration.gains.symbiosis =
        (state(w).migration.gains.symbiosis ?? 0) + 1;
    const gain = ingestOceanDna(w, recipient.species, 'symbiosis');
    if (gain > 0)
      announce(
        w,
        `共生回应 · ${TIDAL_SPECIES.find((s) => s.id === recipient.species)!.name}DNA +${gain}`,
      );
  }
  delete f.reservedFor;
  return f.energy;
}
export function releaseTidalFood(
  w: World,
  id: string,
  owner: string,
  point: Vec,
): boolean {
  if (
    !w.ocean?.tidal ||
    w.mode !== 'running' ||
    !!w.ocean.morph ||
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    carried(w, owner) !== id
  )
    return false;
  const f = state(w).foods.find(
    (f) => f.id === id && f.owner === owner && f.state === 'carried',
  );
  if (!f) return false;
  f.owner = null;
  f.state = 'available';
  f.x = point.x;
  f.y = point.y;
  f.offeredBy = owner;
  delete f.reservedFor;
  setCarried(w, owner, null);
  return true;
}
/** The ecology owns life/death and resource release; callers cannot claim a dead fish twice. */
export function catchTidalActor(w: World, id: string): number {
  const a = state(w).actors.find((a) => a.id === id && a.health > 0);
  if (
    w.mode !== 'running' ||
    w.ocean?.morph ||
    !a ||
    a.species === 'great-ray' ||
    state(w).foods.some(
      (f) => f.reservedFor === a.id && f.state !== 'consumed',
    ) ||
    !canSwallow(bodyRadius(w), a.radius) ||
    !organTouches(worldBodyPose(w), { ...a, radius: a.radius * 0.65 }, 'jaw')
  )
    return 0;
  if (
    a.behavior === 'defend' &&
    (['shellsnail', 'burrow-crab'].includes(a.species) ||
      (a.species === 'thornpuffer' &&
        Math.cos(
          Math.atan2(w.player.y - a.y, w.player.x - a.x) - a.angle - Math.PI,
        ) > 0.5))
  )
    return 0;
  if (a.carryingId) releaseTidalFood(w, a.carryingId, a.id, a);
  learnFrom(
    w,
    ['shellsnail', 'thornpuffer', 'moss-crab'].includes(a.species)
      ? 'ocean:shell'
      : 'ocean:swift',
  );
  ingestOceanDna(w, a.species, 'hunt');
  const region = state(w).regions[a.homeBiome];
  region.harvestPressure = Math.min(12, (region.harvestPressure ?? 0) + 0.7);
  region.alert = Math.min(
    TIDAL_BIOMES.find((b) => b.id === a.homeBiome)!.alertCap,
    region.alert + 0.15,
  );
  a.health = 0;
  a.respawnSeconds =
    35 + (state(w).regions[a.homeBiome].harvestPressure ?? 0) * 8;
  a.targetId = null;
  return Math.max(2, Math.round(a.radius / 5));
}
export function repelTidalActor(w: World, id: string, seconds: number): void {
  const a = state(w).actors.find((a) => a.id === id && a.health > 0);
  if (a) {
    a.behavior = 'digest';
    a.phaseSeconds = seconds;
    a.targetId = null;
  }
}
function location(w: World, biome: BiomeId, radius = 15): Vec {
  const b = TIDAL_BIOMES.find((b) => b.id === biome)!,
    rocks = tidalObstacles(state(w).tick);
  let point: Vec = { x: b.x, y: b.y };
  for (let i = 0; i < 80; i++) {
    const angle = random(w) * Math.PI * 2,
      r = 80 + random(w) * (b.radius * 0.8);
    point = {
      x: Math.max(100, Math.min(3300, b.x + Math.cos(angle) * r)),
      y: Math.max(100, Math.min(2200, b.y + Math.sin(angle) * r)),
    };
    if (
      !rocks.some((rock) => distance(point, rock) < rock.radius + radius + 12)
    )
      return point;
  }
  return { x: b.x - 220, y: b.y };
}
function makeFood(
  w: World,
  biome: BiomeId,
  kind: TidalFood['kind'],
): TidalFood {
  return {
    ...location(w, biome, 8),
    id: `food:${state(w).nextEntityId++}`,
    kind,
    energy: 8,
    biome,
    owner: null,
    state: 'available',
    regrowSeconds: 0,
  };
}

export const TIDAL_SHARE_RADIUS = 180;
export function shareTidalNutrition(w: World): boolean {
  if (
    !w.ocean?.tidal ||
    w.mode !== 'running' ||
    w.ocean.morph ||
    w.player.health <= 0 ||
    w.food < 1
  )
    return false;
  const t = state(w);
  const actor = t.actors
    .filter(
      (a) =>
        a.health > 0 &&
        !TIDAL_SPECIES.find((s) => s.id === a.species)!.diet.includes('prey') &&
        distance(a, w.player) <= TIDAL_SHARE_RADIUS &&
        tidalSight(w.player, a) &&
        !t.foods.some((f) => f.reservedFor === a.id && f.state !== 'consumed'),
    )
    .sort((a, b) => distance(a, w.player) - distance(b, w.player))[0];
  if (!actor) return false;
  const index = t.foods.findIndex((f) => f.state === 'consumed');
  if (index < 0 && t.foods.length >= TIDAL_FOOD_LIMIT) return false;
  const species = TIDAL_SPECIES.find((s) => s.id === actor.species)!;
  const kind = species.diet.find((k) => k !== 'prey')!;
  const gift = {
    ...makeFood(w, actor.homeBiome, kind),
    x: actor.x,
    y: actor.y,
    energy: 6,
    offeredBy: 'player',
    reservedFor: actor.id,
  };
  w.food--;
  if (index >= 0) t.foods[index] = gift;
  else t.foods.push(gift);
  announce(w, `分享1份营养 · 等待${species.name}进食；捕食者仍可能打断。`);
  return true;
}

export function seedTidalActors(w: World, addedBiomes?: BiomeId[]): void {
  const t = state(w);
  if (!addedBiomes && (t.actors.length || t.foods.length)) return;
  for (const d of TIDAL_SPECIES) {
    if (addedBiomes && !addedBiomes.includes(d.biome)) continue;
    const count =
      d.id === 'silver-dart'
        ? 6
        : d.id === 'thinwing'
          ? 3
          : ['great-ray', 'crested-hunter'].includes(d.id)
            ? 1
            : 2;
    for (let n = 0; n < count; n++)
      t.actors.push({
        ...location(w, d.biome, d.radius),
        id: `actor:${t.nextEntityId++}`,
        species: d.id,
        homeBiome: d.biome,
        radius: d.radius,
        angle: random(w) * Math.PI * 2,
        hunger: 45 + random(w) * 20,
        health: 100,
        behavior: 'forage',
        targetId: null,
        phaseSeconds: 0,
        respawnSeconds: 0,
        trust: 0,
        carryingId: null,
      });
  }
  for (const b of TIDAL_BIOMES.filter(
    (b) => !addedBiomes || addedBiomes.includes(b.id),
  ))
    for (let n = 0; n < b.foodCap; n++) {
      const kind =
        b.id === 'reef'
          ? n % 3 === 0
            ? 'scrap'
            : 'algae'
          : b.id === 'nursery' && n % 4 === 0
            ? 'algae'
            : 'plankton';
      const f = makeFood(w, b.id, kind);
      if (b.id === 'nursery' && n < 4) {
        f.x = b.x + 65 + n * 24;
        f.y = b.y + (n % 2 ? 24 : -24);
      }
      t.foods.push(f);
    }
}
function constrain(a: TidalActor) {
  for (let pass = 0; pass < 3; pass++)
    for (const rock of tidalObstacles(0)) {
      const d = distance(a, rock),
        overlap = rock.radius + a.radius * 0.8 - d;
      if (overlap > 0) {
        const angle = Math.atan2(a.y - rock.y, a.x - rock.x);
        a.x += Math.cos(angle) * overlap;
        a.y += Math.sin(angle) * overlap;
      }
    }
  a.x = Math.max(a.radius, Math.min(3400 - a.radius, a.x));
  a.y = Math.max(a.radius, Math.min(2300 - a.radius, a.y));
}
export function tidalWake(w: World, flow: Vec): Vec {
  const ray = state(w).actors.find(
    (a) =>
      a.species === 'great-ray' &&
      a.health > 0 &&
      distance(a, w.player) < 180 &&
      Math.cos(Math.atan2(w.player.y - a.y, w.player.x - a.x) - a.angle) < -0.5,
  );
  const escort = state(w).actors.some(
    (a) =>
      a.species === 'pipe-seahorse' &&
      a.health > 0 &&
      a.trust >= 20 &&
      distance(a, w.player) < 160,
  );
  return ray
    ? { x: flow.x * 0.35, y: flow.y * 0.35 }
    : escort
      ? { x: flow.x * 0.6, y: flow.y * 0.6 }
      : flow;
}
export function stepTidalEcology(
  w: World,
  dt: number,
  viewport?: Input['viewport'],
): TidalSignal[] {
  if (
    !w.ocean?.tidal ||
    w.mode !== 'running' ||
    w.ocean.morph ||
    !Number.isFinite(dt) ||
    dt <= 0
  )
    return [];
  dt = Math.min(dt, 0.05);
  const t = state(w),
    signals: TidalSignal[] = [];
  const view = viewport ?? {
    minX: w.player.x - 800,
    maxX: w.player.x + 800,
    minY: w.player.y - 500,
    maxY: w.player.y + 500,
  };
  for (let i = t.foods.length - 1; i >= 0; i--) {
    const f = t.foods[i];
    if (
      f.reservedFor &&
      !t.actors.some((a) => a.id === f.reservedFor && a.health > 0)
    )
      delete f.reservedFor;
    if (f.state === 'consumed') {
      f.regrowSeconds = Math.max(
        0,
        f.regrowSeconds -
          dt / (1 + (t.regions[f.biome].harvestPressure ?? 0) * 0.15),
      );
      if (f.regrowSeconds === 0) t.foods[i] = makeFood(w, f.biome, f.kind);
    }
  }
  for (const a of t.actors) {
    if (a.health <= 0) {
      a.respawnSeconds = Math.max(0, a.respawnSeconds - dt);
      if (a.respawnSeconds === 0) {
        const point = location(w, a.homeBiome, a.radius);
        if (
          distance(point, w.player) >= 420 &&
          (point.x < view.minX ||
            point.x > view.maxX ||
            point.y < view.minY ||
            point.y > view.maxY)
        ) {
          Object.assign(a, point);
          a.health = 100;
          a.hunger = 45;
          a.behavior = 'home';
          a.phaseSeconds = 0;
          a.targetId = null;
        }
      }
      continue;
    }
    a.hunger = Math.min(100, a.hunger + dt * 0.65);
    const intent = tidalIntent(w, a, dt);
    if (intent.evidence)
      signals.push(tidalSignal(w, intent.evidence, a.id, a.targetId, a));
    const destination =
      a.behavior === 'ambush' || a.behavior === 'flee'
        ? intent.point
        : tidalWaypoint(a, intent.point);
    const d = distance(a, destination);
    if (d > 2 && intent.speed > 0) {
      a.angle = face(
        a.angle,
        Math.atan2(destination.y - a.y, destination.x - a.x),
        dt,
        8,
      );
      const step = Math.min(d, intent.speed * dt);
      a.x += ((destination.x - a.x) / d) * step;
      a.y += ((destination.y - a.y) / d) * step;
      constrain(a);
    }
    if (a.carryingId) {
      const f = t.foods.find((f) => f.id === a.carryingId)!;
      f.x = a.x;
      f.y = a.y;
      const destination =
        a.species === 'scavenger-shrimp'
          ? { x: 2290, y: 1350 }
          : TIDAL_BIOMES.find((b) => b.id === a.homeBiome)!;
      if (distance(a, destination) < 35) {
        const id = f.id,
          energy = consumeTidalFood(w, id, a.id);
        a.hunger = Math.max(0, a.hunger - energy * 5);
        a.behavior = 'digest';
        a.phaseSeconds = 5;
        signals.push(tidalSignal(w, 'feed', a.id, id, a, energy));
      }
      continue;
    }
    if (intent.food) {
      const f = t.foods.find((f) => f.id === intent.food);
      if (
        f &&
        distance(a, f) <= a.radius + 14 &&
        takeTidalFood(w, f.id, a.id)
      ) {
        if (intent.carry) {
          a.behavior = 'carry';
          signals.push(tidalSignal(w, 'carry', a.id, f.id, a));
        } else {
          const energy = consumeTidalFood(w, f.id, a.id);
          a.hunger = Math.max(0, a.hunger - energy * 5);
          signals.push(
            tidalSignal(
              w,
              ['fanworm', 'siphon-jelly', 'vent-tube'].includes(a.species)
                ? 'filter'
                : 'feed',
              a.id,
              f.id,
              a,
              energy,
            ),
          );
          if (
            ['ribbonfish', 'pipe-seahorse'].includes(a.species) &&
            a.trust >= 20
          ) {
            a.targetId = 'player';
            a.behavior = 'follow';
          } else if (a.species === 'ribbonfish') {
            a.targetId = `way:${f.biome === 'drift' ? 'reef' : f.biome === 'reef' ? 'nursery' : 'drift'}`;
            a.behavior = 'home';
          } else {
            a.behavior = 'digest';
            a.phaseSeconds = a.species === 'thinwing' ? 4 : 3;
          }
        }
      }
    }
    if (intent.prey) {
      const prey = t.actors.find((p) => p.id === intent.prey && p.health > 0);
      const target = prey ?? (intent.prey === 'player' ? w.player : null);
      if (
        !target ||
        distance(a, target) > a.radius + (prey?.radius ?? 28) * 0.8
      )
        continue;
      const protectedPrey =
        prey?.behavior === 'defend' &&
        (['shellsnail', 'burrow-crab'].includes(prey.species) ||
          (prey.species === 'thornpuffer' &&
            Math.cos(
              Math.atan2(a.y - prey.y, a.x - prey.x) - prey.angle - Math.PI,
            ) > 0.5));
      if (protectedPrey) {
        signals.push(tidalSignal(w, 'defend', prey!.id, a.id, prey!));
        a.behavior = 'digest';
        a.phaseSeconds = 2;
        a.targetId = null;
        continue;
      }
      if (prey) {
        if (prey.carryingId)
          releaseTidalFood(w, prey.carryingId, prey.id, prey);
        prey.health = 0;
        prey.respawnSeconds = 35;
        prey.targetId = null;
        a.hunger = Math.max(0, a.hunger - 55);
        a.behavior = 'digest';
        a.phaseSeconds = 6;
        a.targetId = null;
        signals.push(tidalSignal(w, 'feed', a.id, prey.id, prey, 8));
      } else if (w.player.invulnerable <= 0) {
        signals.push(tidalSignal(w, 'defend', a.id, 'player', w.player, 25));
        a.behavior = 'digest';
        a.phaseSeconds = 4;
        a.targetId = null;
      }
    }
  }
  const spacable = new Set(
    t.actors
      .filter(
        (a) =>
          a.health > 0 &&
          !['flee', 'ambush', 'defend', 'carry', 'digest'].includes(
            a.behavior,
          ) &&
          distance(a, w.player) > bodyRadius(w) + a.radius + 20 &&
          !t.foods.some(
            (f) => f.state === 'available' && distance(f, a) < a.radius + 18,
          ),
      )
      .map((a) => a.id),
  );
  separateNeighbors(t.actors, dt, (id) => spacable.has(id));
  for (const a of t.actors) if (spacable.has(a.id)) constrain(a);
  for (const b of TIDAL_BIOMES) {
    const r = t.regions[b.id];
    r.alert = Math.max(0, r.alert - dt * 0.02);
    r.harvestPressure = Math.max(0, (r.harvestPressure ?? 0) - dt * 0.012);
    r.bond = Math.max(0, (r.bond ?? 0) - dt * 0.002);
    r.recoverySeconds = Math.max(
      0,
      ...t.foods
        .filter((f) => f.biome === b.id && f.state === 'consumed')
        .map((f) => f.regrowSeconds),
      ...t.actors
        .filter((a) => a.homeBiome === b.id && a.health <= 0)
        .map((a) => a.respawnSeconds),
    );
    r.foodStock = Math.min(
      b.foodCap,
      t.foods.filter((f) => f.biome === b.id && f.state !== 'consumed').length,
    );
    r.populations = {};
    for (const a of t.actors)
      if (a.homeBiome === b.id && a.health > 0)
        r.populations[a.species] = (r.populations[a.species] ?? 0) + 1;
  }
  return signals;
}
