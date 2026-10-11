import test from 'node:test';
import assert from 'node:assert/strict';
import { tidalFixture } from './helpers/tidal-world.ts';
import { TIDAL_SPECIES } from '../app/game/tidal/catalog.ts';
import {
  seedTidalActors,
  stepTidalEcology,
  takeTidalFood,
  consumeTidalFood,
  releaseTidalFood,
  tidalWake,
} from '../app/game/tidal/ecology.ts';
import { createOceanWorld } from '../app/game/ocean.ts';
import type {
  TidalActor,
  TidalFood,
  SpeciesId,
} from '../app/game/tidal/types.ts';
import type { World } from '../app/game/simulation.ts';
import { validTidalState } from '../app/game/tidal/save-guards.ts';

// Explicit, isolated mechanics fixtures. These coordinates and resources are not journey evidence.
const actor = (
  species: SpeciesId,
  id: string = species,
  x = 1550,
  y = 700,
): TidalActor => {
  const d = TIDAL_SPECIES.find((s) => s.id === species)!;
  return {
    id,
    species,
    x,
    y,
    homeBiome: d.biome,
    radius: d.radius,
    angle: 0,
    hunger: 70,
    health: 100,
    behavior: d.behavior,
    targetId: null,
    phaseSeconds: 0,
    respawnSeconds: 0,
    trust: 0,
    carryingId: null,
  };
};
const food = (
  id = 'meal',
  kind: TidalFood['kind'] = 'plankton',
  x = 1550,
  y = 700,
): TidalFood => ({
  id,
  kind,
  x,
  y,
  energy: 8,
  biome: 'drift',
  owner: null,
  state: 'available',
  regrowSeconds: 0,
});
function isolated(actors: TidalActor[], foods: TidalFood[] = []) {
  const w = tidalFixture();
  w.ocean!.tidal!.compat.mode = 'active';
  w.ocean!.tidal!.actors = actors;
  w.ocean!.tidal!.foods = foods;
  w.player.x = 50;
  w.player.y = 50;
  return w;
}
function advance(w: World, seconds: number) {
  const signals = [];
  for (let i = 0; i < Math.ceil(seconds * 120); i++)
    signals.push(...stepTidalEcology(w, 1 / 120));
  return signals;
}

void test('food ownership is atomic, one item per carrier, consumption exactly once and drops do not award energy', () => {
  const a = actor('moss-crab', 'npc:1'),
    b = actor('moss-crab', 'npc:2');
  const w = isolated([a, b], [food('f1'), food('f2')]);
  const p = structuredClone(w.player);
  assert.equal(takeTidalFood(w, 'f1', 'npc:1')?.id, 'f1');
  assert.equal(takeTidalFood(w, 'f1', 'player'), null);
  assert.equal(takeTidalFood(w, 'f1', 'npc:2'), null);
  assert.equal(takeTidalFood(w, 'f2', 'npc:1'), null);
  assert.equal(consumeTidalFood(w, 'f1', 'npc:2'), 0);
  assert.equal(releaseTidalFood(w, 'f1', 'npc:2', { x: 1, y: 1 }), false);
  assert.equal(releaseTidalFood(w, 'f1', 'npc:1', { x: 100, y: 100 }), true);
  assert.equal(takeTidalFood(w, 'f1', 'player')?.id, 'f1');
  assert.equal(consumeTidalFood(w, 'f1', 'player'), 8);
  assert.equal(consumeTidalFood(w, 'f1', 'player'), 0);
  assert.deepEqual(w.player, p);
  assert.equal(w.food, 0);
});

void test('silver shoal separates from a real threat; thinwing rests instead of swimming forever', () => {
  const silver = actor('silver-dart', 's1', 600, 1550),
    other = actor('silver-dart', 's2', 620, 1550),
    hunter = actor('crested-hunter', 'hunter', 680, 1550);
  const w = isolated([silver, other, hunter]);
  hunter.hunger = 0;
  hunter.behavior = 'digest';
  hunter.phaseSeconds = 10;
  const before = Math.hypot(silver.x - hunter.x, silver.y - hunter.y);
  const signals = advance(w, 0.3);
  assert.ok(Math.hypot(silver.x - hunter.x, silver.y - hunter.y) > before);
  assert.ok(
    signals.some((s) => s.kind === 'shoal-avoid' && s.actorId === 's1'),
  );
  assert.notEqual(silver.x, other.x);
  const wing = actor('thinwing');
  wing.behavior = 'digest';
  wing.phaseSeconds = 3;
  const rest = isolated([wing]);
  const start = { x: wing.x, y: wing.y };
  advance(rest, 1);
  assert.ok(Math.hypot(wing.x - start.x, wing.y - start.y) < 15);
  assert.ok(wing.phaseSeconds > 0);
});

void test('fanworm must actually receive food; lantern contracts at the fast current boundary', () => {
  const fan = actor('fanworm'),
    w = isolated([fan], [food('f', 'plankton', 1555, 700)]);
  const signals = advance(w, 0.1);
  assert.equal(w.ocean!.tidal!.foods[0].state, 'consumed');
  assert.ok(
    signals.some((s) => s.kind === 'filter' && s.actorId === 'fanworm'),
  );
  assert.ok(fan.hunger < 70);
  const lantern = actor('lantern-drifter'),
    l = isolated([lantern], [food('f', 'plankton', 1555, 700)]);
  advance(l, 0.1);
  assert.equal(l.ocean!.tidal!.foods[0].state, 'available');
  assert.ok(lantern.phaseSeconds > 0, 'contraction remains visible');
});

void test('thornpuffer turns its spiked tail toward a threat; shellsnail survives a bite by closing and cannot feed while closed', () => {
  for (const species of ['thornpuffer', 'shellsnail'] as const) {
    const defender = actor(species, species, 2300, 1350),
      hunter = actor('crested-hunter', 'h', 2330, 1350);
    const w = isolated(
      [defender, hunter],
      [food('algae', 'algae', 2300, 1350)],
    );
    const signals = advance(w, 1);
    assert.equal(defender.health, 100);
    assert.equal(w.ocean!.tidal!.foods[0].state, 'available');
    assert.ok(
      signals.some((s) => s.kind === 'defend' && s.actorId === species),
    );
    if (species === 'thornpuffer')
      assert.ok(
        Math.cos(defender.angle) < -0.8,
        'tail points at the attacker on the right',
      );
  }
});

void test('sand-eel telegraphs before lunging and then moves on its committed heading', () => {
  const eel = actor('sand-eel', 'eel', 2300, 1350),
    prey = actor('thinwing', 'prey', 2380, 1350);
  prey.behavior = 'digest';
  prey.phaseSeconds = 10;
  const w = isolated([eel, prey]);
  advance(w, 0.55);
  assert.ok(Math.abs(eel.x - 2300) < 2);
  const x = eel.x;
  advance(w, 0.2);
  assert.ok(eel.x > x + 10);
  assert.ok(eel.phaseSeconds >= 0.6);
  assert.equal(eel.targetId, 'prey');
});

void test('shrimp carries actual scraps to shelter, and crab moves algae back to its guarded source', () => {
  for (const [species, kind, x, y] of [
    ['scavenger-shrimp', 'scrap', 2390, 1340],
    ['moss-crab', 'algae', 570, 1770],
  ] as const) {
    const a = actor(species, species, x, y),
      w = isolated([a], [food('f', kind, x, y)]);
    advance(w, 0.05);
    assert.equal(a.carryingId, 'f');
    const original = { x: a.x, y: a.y };
    advance(w, 0.8);
    assert.ok(Math.hypot(a.x - original.x, a.y - original.y) > 10);
    assert.equal(w.ocean!.tidal!.foods[0].owner, a.id);
  }
});

void test('ribbonfish migration evidence needs real feeding and completed travel, not an elapsed timer', () => {
  const r = actor('ribbonfish'),
    w = isolated([r], [food('f')]);
  const first = advance(w, 0.1);
  assert.ok(first.some((s) => s.kind === 'feed'));
  assert.equal(
    first.some((s) => s.kind === 'ribbon-leg'),
    false,
  );
  const start = { x: r.x, y: r.y },
    signals = advance(w, 25);
  assert.ok(Math.hypot(r.x - start.x, r.y - start.y) > 500);
  assert.ok(signals.some((s) => s.kind === 'ribbon-leg'));
  const empty = isolated([actor('ribbonfish')]);
  assert.equal(
    advance(empty, 25).some((s) => s.kind === 'ribbon-leg'),
    false,
  );
});

void test('a fed hunter digests, drops its target and stops chasing beyond sensing range; ray offers a wake without hunting', () => {
  const hunter = actor('crested-hunter', 'h', 2300, 1350),
    prey = actor('silver-dart', 'p', 2330, 1350);
  const w = isolated([hunter, prey]);
  advance(w, 1.2);
  assert.equal(prey.health, 0);
  assert.equal(hunter.behavior, 'digest');
  assert.equal(hunter.targetId, null);
  const settled = structuredClone(hunter);
  advance(w, 0.5);
  assert.ok(Math.hypot(hunter.x - settled.x, hunter.y - settled.y) < 8);
  const ray = actor('great-ray', 'ray', 3000, 500),
    rw = isolated([ray]);
  rw.player.x = 2900;
  rw.player.y = 500;
  const flow = tidalWake(rw, { x: 80, y: 0 });
  assert.ok(flow.x < 40);
  const health = rw.player.health;
  advance(rw, 1);
  assert.equal(rw.player.health, health);
  assert.notEqual(ray.targetId, 'player');
});

void test('deterministic bounded population recovers food with new IDs; visible prey never pops back into life', () => {
  const a = createOceanWorld(71),
    b = createOceanWorld(71);
  seedTidalActors(a);
  seedTidalActors(b);
  assert.deepEqual(a, b);
  const t = a.ocean!.tidal!;
  assert.equal(new Set(t.actors.map((x) => x.species)).size, 18);
  assert.ok(t.actors.length <= 48);
  assert.ok(t.foods.length <= 144);
  const consumed = t.foods[0].id;
  assert.ok(takeTidalFood(a, consumed, 'player'));
  consumeTidalFood(a, consumed, 'player');
  advance(a, 35);
  assert.ok(t.foods.some((f) => f.id !== consumed && f.state === 'available'));
  assert.ok(t.foods.length <= 144);
  assert.equal(
    t.foods.some((f) => f.id === consumed && f.state === 'available'),
    false,
  );
  const visible = t.actors[0];
  visible.health = 0;
  visible.respawnSeconds = 0.01;
  stepTidalEcology(a, 0.05, { minX: 0, minY: 0, maxX: 3400, maxY: 2300 });
  assert.equal(visible.health, 0);
  a.mode = 'paused';
  const frozen = structuredClone(a);
  stepTidalEcology(a, 0.05);
  assert.deepEqual(a, frozen);
});

void test('a crab guards its real food source and raises local alert when approached; live ownership stays saveable', () => {
  const crab = actor('moss-crab', 'crab', 540, 1770),
    w = isolated([crab], [food('f', 'algae', 540, 1770)]);
  w.player.x = 460;
  w.player.y = 1770;
  advance(w, 0.5);
  assert.equal(w.ocean!.tidal!.foods[0].state, 'available');
  assert.ok(w.ocean!.tidal!.regions.nursery.alert > 0);
  assert.ok(
    Math.cos(crab.angle) < -0.8,
    'claws turn toward the approaching player',
  );
  const live = createOceanWorld(101);
  advance(live, 30);
  assert.equal(
    validTidalState(live.ocean!.tidal),
    true,
    'real NPC consumption and carrying are valid persisted state',
  );
});
