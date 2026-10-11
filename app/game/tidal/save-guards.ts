import { TIDAL_FOOD_LIMIT } from './types.ts';
import { TIDAL_BIOMES, TIDAL_SPECIES, TIDAL_ORGANS } from './catalog.ts';
import { validWorld } from '../save-schema.ts';

type Obj = Record<string, unknown>;
const object = (v: unknown): v is Obj =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const number = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e12;
const range = (v: unknown, max = 1e9) => number(v) && v >= 0 && v <= max;
const integer = (v: unknown) => range(v, 1e12 - 1) && Number.isInteger(v);
const id = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= 80;
const point = (v: Obj) => number(v.x) && number(v.y);
const ids = (
  v: unknown,
  max: number,
  allowed?: readonly string[],
): v is string[] =>
  Array.isArray(v) &&
  v.length <= max &&
  v.every((x) => id(x) && (!allowed || allowed.includes(x))) &&
  new Set(v).size === v.length;
const biomes = TIDAL_BIOMES.map((b) => b.id),
  species = TIDAL_SPECIES.map((s) => s.id),
  organs = TIDAL_ORGANS.map((o) => o.id);
const actions = [
  'form-skill',
  'filter',
  'shell',
  'grasp',
  'reserve',
  'ink',
  'anchor',
];
const behaviors = [
  'forage',
  'flee',
  'defend',
  'ambush',
  'digest',
  'home',
  'carry',
  'follow',
];
export function validTidalLegacy(v: unknown): boolean {
  return (
    object(v) &&
    id(v.id) &&
    v.refuge === true &&
    ids(v.companions, 32) &&
    ids(v.diet, 4, ['hunt', 'filter', 'reserve', 'symbiosis']) &&
    ['sheltered', 'channel'].includes(v.entry as string) &&
    integer(v.generation) &&
    (v.generation as number) >= 1
  );
}
export function validTidalState(v: unknown): boolean {
  if (
    !object(v) ||
    v.version !== 1 ||
    !integer(v.rng) ||
    (v.rng as number) > 0xffffffff ||
    !integer(v.tick) ||
    !integer(v.nextSeq) ||
    (v.nextSeq as number) < 1 ||
    !integer(v.nextEntityId) ||
    (v.nextEntityId as number) < 1
  )
    return false;
  if (
    !object(v.regions) ||
    ![4, 6].includes(Object.keys(v.regions).length) ||
    Object.keys(v.regions).some((key) => !biomes.includes(key as never))
  )
    return false;
  const legacyRegions = Object.keys(v.regions).length === 4;
  for (const b of TIDAL_BIOMES) {
    const r = v.regions[b.id];
    if (legacyRegions && ['kelp', 'vent'].includes(b.id) && r === undefined)
      continue;
    if (
      !object(r) ||
      !(r.harvestPressure === undefined || range(r.harvestPressure, 12)) ||
      !(r.bond === undefined || range(r.bond, 6)) ||
      !range(r.foodStock, b.foodCap) ||
      !range(r.alert, b.alertCap) ||
      !range(r.recoverySeconds) ||
      !object(r.populations) ||
      Object.entries(r.populations).some(
        ([key, n]) =>
          !species.includes(key as (typeof species)[number]) ||
          !integer(n) ||
          (n as number) > 32,
      )
    )
      return false;
  }
  if (
    !Array.isArray(v.actors) ||
    v.actors.length > 48 ||
    !Array.isArray(v.foods) ||
    v.foods.length > TIDAL_FOOD_LIMIT
  )
    return false;
  const entityIds = new Set<string>(),
    holders = new Map<string, string | null>();
  for (const actor of v.actors) {
    if (
      !object(actor) ||
      !id(actor.id) ||
      entityIds.has(actor.id) ||
      !species.includes(actor.species as (typeof species)[number]) ||
      !biomes.includes(actor.homeBiome as (typeof biomes)[number]) ||
      !((actor.homeBiome as string) in v.regions) ||
      !point(actor) ||
      !range(actor.radius, 150) ||
      (actor.radius as number) <= 0 ||
      !number(actor.angle) ||
      !range(actor.hunger, 100) ||
      !range(actor.health, 100) ||
      !behaviors.includes(actor.behavior as string) ||
      !(
        actor.targetId === null ||
        (id(actor.targetId) &&
          (!actor.targetId.startsWith('way:') ||
            biomes.includes(
              actor.targetId.slice(4) as (typeof biomes)[number],
            )))
      ) ||
      !range(actor.phaseSeconds) ||
      !range(actor.respawnSeconds) ||
      !range(actor.trust, 100) ||
      !(actor.carryingId === null || id(actor.carryingId))
    )
      return false;
    entityIds.add(actor.id);
    holders.set(actor.id, actor.carryingId as string | null);
  }
  const a = v.abilities;
  if (
    !object(a) ||
    !Array.isArray(a.slots) ||
    a.slots.length !== 2 ||
    a.slots.some((x) => x !== null && !actions.includes(x)) ||
    !range(a.shellSeconds, 2.5) ||
    !(a.inkCooldown === undefined || range(a.inkCooldown, 8)) ||
    !(a.inkSeconds === undefined || range(a.inkSeconds, 2)) ||
    !(a.anchored === undefined || typeof a.anchored === 'boolean') ||
    !range(a.shellCooldown, 5) ||
    !range(a.reserveEnergy, 40) ||
    !range(a.reserveCooldown, 4) ||
    typeof a.filterOpen !== 'boolean' ||
    !(a.carriedId === null || id(a.carriedId)) ||
    !integer(a.lastCommandId)
  )
    return false;
  holders.set('player', a.carriedId as string | null);
  const heldFoods = new Map<string, string>();
  for (const food of v.foods) {
    if (
      !object(food) ||
      !id(food.id) ||
      entityIds.has(food.id) ||
      !point(food) ||
      !['plankton', 'algae', 'scrap'].includes(food.kind as string) ||
      !range(food.energy, 100) ||
      (food.energy as number) <= 0 ||
      !biomes.includes(food.biome as (typeof biomes)[number]) ||
      !['available', 'carried', 'consumed'].includes(food.state as string) ||
      !(food.owner === null || id(food.owner)) ||
      !range(food.regrowSeconds) ||
      !(food.offeredBy === undefined || id(food.offeredBy)) ||
      !(
        food.reservedFor === undefined ||
        (id(food.reservedFor) &&
          (v.actors as Record<string, unknown>[]).some(
            (a) => a.id === food.reservedFor,
          ))
      )
    )
      return false;
    entityIds.add(food.id);
    if (food.state === 'carried') {
      if (
        !id(food.owner) ||
        !holders.has(food.owner) ||
        holders.get(food.owner) !== food.id ||
        heldFoods.has(food.owner)
      )
        return false;
      heldFoods.set(food.owner, food.id);
    } else if (food.owner !== null) return false;
  }
  for (const [owner, food] of holders)
    if (food !== null && heldFoods.get(owner) !== food) return false;
  const j = v.journal;
  if (
    !object(j) ||
    !ids(j.seen, species.length, species) ||
    !ids(j.claimed, organs.length, organs) ||
    !object(j.evidence) ||
    Object.entries(j.evidence).some(
      ([key, seq]) =>
        !organs.includes(key as (typeof organs)[number]) ||
        !integer(seq) ||
        (seq as number) < 1 ||
        (seq as number) >= (v.nextSeq as number),
    )
  )
    return false;
  const e = v.events;
  if (
    !object(e) ||
    !(
      e.active === null ||
      ['food-shift', 'hunter-visit', 'spring-tide'].includes(e.active as string)
    ) ||
    !['idle', 'warning', 'active', 'recover'].includes(e.phase as string) ||
    !range(e.seconds) ||
    !integer(e.lastStrongTick) ||
    (e.lastStrongTick as number) > (v.tick as number) ||
    !ids(e.completed, 3)
  )
    return false;
  const m = v.migration;
  if (
    !object(m) ||
    !(
      m.startedTick === null ||
      (integer(m.startedTick) &&
        (m.startedTick as number) <= (v.tick as number))
    ) ||
    !ids(m.visited, 6, biomes) ||
    !object(m.gains) ||
    Object.keys(m.gains).some(
      (key) => !['hunt', 'filter', 'reserve', 'symbiosis'].includes(key),
    ) ||
    !(m.gains.symbiosis === undefined || range(m.gains.symbiosis)) ||
    ['hunt', 'filter', 'reserve'].some(
      (key) => !range((m.gains as Obj)[key]),
    ) ||
    typeof m.refuge !== 'boolean' ||
    !ids(m.companions, 32) ||
    !['sheltered', 'channel'].includes(m.entry as string)
  )
    return false;
  const c = v.compat;
  if (
    !object(c) ||
    !['new', 'pending', 'active', 'completed-legacy'].includes(
      c.mode as string,
    ) ||
    ![0, 1, 2].includes(c.legacyStations as number) ||
    !Array.isArray(c.legacyLegs) ||
    c.legacyLegs.length !== c.legacyStations ||
    c.legacyLegs.some((x) => !['hunt', 'filter'].includes(x))
  )
    return false;
  if (v.safeCheckpoint !== null) {
    const checkpoint = v.safeCheckpoint;
    if (
      !object(checkpoint) ||
      !object(checkpoint.ocean) ||
      !object(checkpoint.ocean.tidal) ||
      Object.hasOwn(checkpoint.ocean.tidal, 'safeCheckpoint')
    )
      return false;
    // Insert a null only in the temporary validation view, never in the saved snapshot.
    if (
      !validWorld({
        ...checkpoint,
        ocean: {
          ...checkpoint.ocean,
          tidal: { ...checkpoint.ocean.tidal, safeCheckpoint: null },
        },
      })
    )
      return false;
  }
  return true;
}
