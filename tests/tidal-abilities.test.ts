import test from 'node:test';
import assert from 'node:assert/strict';
import { tidalFixture } from './helpers/tidal-world.ts';
import {
  applyTidalCommand,
  stepTidalAbilities,
  lateralRipples,
  tidalMovement,
} from '../app/game/tidal/abilities.ts';
import { stepTidal } from '../app/game/tidal/step.ts';
import { stepTidalEcology } from '../app/game/tidal/ecology.ts';
import { worldBodyPose, organZones } from '../app/game/body-geometry.ts';
import { getStats } from '../app/game/simulation.ts';
import { createCampaignSession } from '../app/game/campaign-session.ts';
import { decodeSave, encodeSave } from '../app/game/campaign-save.ts';
import type { World } from '../app/game/simulation.ts';
import type { TidalActor, TidalFood } from '../app/game/tidal/types.ts';

const meal = (
  w: World,
  id = 'meal',
  point = organZones(worldBodyPose(w), 'jaw')[0] ?? w.player,
): TidalFood => ({
  id,
  ...point,
  energy: 8,
  kind: 'plankton',
  biome: 'nursery',
  state: 'available',
  owner: null,
  regrowSeconds: 0,
});
const small = (w: World): TidalActor => ({
  id: 'prey',
  species: 'silver-dart',
  homeBiome: 'nursery',
  ...organZones(worldBodyPose(w), 'jaw')[0],
  radius: 12,
  angle: 0,
  hunger: 10,
  health: 100,
  behavior: 'home',
  targetId: null,
  phaseSeconds: 0,
  respawnSeconds: 0,
  trust: 0,
  carryingId: null,
});
void test('a mouth actually feeds once, stale slot mouths do nothing, closed shells suppress meals and dash', () => {
  const w = tidalFixture({ organs: ['jaw', 'shell'] });
  const t = w.ocean!.tidal!;
  t.foods = [meal(w)];
  const energy = w.player.energy;
  stepTidalAbilities(w, 1 / 120);
  assert.equal(w.food, 1);
  assert.ok(w.player.energy > energy);
  stepTidalAbilities(w, 1 / 120);
  assert.equal(w.food, 1);
  t.abilities.slots = ['shell', null];
  t.foods = [meal(w, 'next')];
  const before = w.food;
  applyTidalCommand(w, { id: 1, kind: 'slot0' });
  assert.equal(t.abilities.shellSeconds, 2.5);
  assert.equal(tidalMovement(w).dash, false);
  assert.equal(tidalMovement(w).speed, 0.25);
  stepTidal(w, { x: 1, y: 0, dash: true }, 1 / 120);
  assert.equal(w.player.dashing, false);
  assert.equal(w.food, before);
  const filter = tidalFixture({ organs: ['filter'] });
  filter.ocean!.tidal!.actors = [small(w)];
  stepTidalAbilities(filter, 0.05);
  assert.equal(filter.ocean!.tidal!.actors[0].health, 100);
});
void test('grasp takes one item without nutrients, one command id only executes once including after save', () => {
  const w = tidalFixture({ organs: ['jaw', 'grasp'] });
  const t = w.ocean!.tidal!;
  t.abilities.slots = ['grasp', null];
  t.foods = [meal(w)];
  const energy = w.player.energy;
  const signals = applyTidalCommand(w, { id: 1, kind: 'slot0' });
  assert.equal(signals[0].kind, 'carry');
  assert.equal(t.foods[0].state, 'carried');
  assert.equal(w.food, 0);
  assert.equal(w.player.energy, energy);
  const once = structuredClone(w);
  applyTidalCommand(w, { id: 1, kind: 'slot0' });
  assert.deepEqual(w, once);
  const session = createCampaignSession();
  Object.assign(session.journey.getWorld(), w);
  const read = decodeSave(encodeSave(session.snapshot('journey')));
  if (read.kind !== 'ok') throw Error(read.kind);
  const restored = read.save.campaign.journey;
  const snapshot = structuredClone(restored);
  applyTidalCommand(restored, { id: 1, kind: 'slot0' });
  assert.deepEqual(restored, snapshot);
  const drop = applyTidalCommand(w, { id: 2, kind: 'slot0' });
  assert.equal(drop[0].kind, 'drop');
  assert.equal(t.abilities.carriedId, null);
  assert.ok(
    Math.abs(
      Math.hypot(t.foods[0].x - w.player.x, t.foods[0].y - w.player.y) - 110,
    ) < 1e-8,
  );
  assert.equal(w.food, 0);
});
void test('dropped bait is consumed by an NPC once and satiates it; it never rewards the player', () => {
  const w = tidalFixture({ organs: ['jaw', 'grasp'] });
  const t = w.ocean!.tidal!;
  t.abilities.slots = ['grasp', null];
  t.foods = [meal(w)];
  applyTidalCommand(w, { id: 1, kind: 'slot0' });
  applyTidalCommand(w, { id: 2, kind: 'slot0' });
  const a = {
    ...small(w),
    id: 'ribbon',
    species: 'ribbonfish' as const,
    x: t.foods[0].x,
    y: t.foods[0].y,
    hunger: 80,
  };
  t.actors = [a];
  w.player.x -= 150;
  const signals = stepTidalEcology(w, 0.05);
  assert.equal(t.foods[0].state, 'consumed');
  assert.ok(a.hunger < 80);
  assert.ok(a.trust >= 20);
  assert.equal(
    stepTidalEcology(w, 0.05).filter((s) => s.kind === 'feed').length,
    0,
  );
  assert.equal(w.food, 0);
  assert.ok(signals.some((s) => s.kind === 'feed'));
});
void test('reserve comes only from real meal overflow and release uses actual missing energy', () => {
  const w = tidalFixture({ organs: ['jaw', 'reserve'] });
  const t = w.ocean!.tidal!,
    max = getStats(w.traits, w.form).maxEnergy;
  t.abilities.slots = ['reserve', null];
  w.player.energy = max - 3;
  t.foods = [meal(w)];
  stepTidalAbilities(w, 0.05);
  assert.equal(w.player.energy, max);
  assert.equal(t.abilities.reserveEnergy, 5);
  w.player.energy = max - 2;
  const sig = applyTidalCommand(w, { id: 1, kind: 'slot0' });
  assert.equal(t.abilities.reserveEnergy, 3);
  assert.equal(sig[0].amount, 2);
  assert.equal(sig[0].kind, 'reserve-use');
  applyTidalCommand(w, { id: 2, kind: 'slot0' });
  assert.equal(
    t.abilities.reserveEnergy,
    3,
    'cooldown blocks a repeated release',
  );
  const noOrgan = tidalFixture({ organs: ['jaw'] });
  noOrgan.player.energy = getStats(noOrgan.traits, noOrgan.form).maxEnergy;
  noOrgan.ocean!.tidal!.foods = [meal(noOrgan)];
  stepTidalAbilities(noOrgan, 0.05);
  assert.equal(noOrgan.ocean!.tidal!.abilities.reserveEnergy, 0);
});
void test('filter opens and consumes real contact particles, never an empty region timer', () => {
  const w = tidalFixture({ organs: ['filter'] });
  const t = w.ocean!.tidal!;
  t.abilities.slots = ['filter', null];
  const anchor = organZones(worldBodyPose(w), 'filter')[0];
  t.foods = [meal(w, 'f', anchor)];
  stepTidalAbilities(w, 0.05);
  assert.equal(w.food, 0);
  applyTidalCommand(w, { id: 1, kind: 'slot0' });
  assert.equal(tidalMovement(w).speed, 0.38);
  stepTidalAbilities(w, 0.05);
  assert.equal(w.food, 1);
  for (let i = 0; i < 1200; i++) stepTidalAbilities(w, 1 / 120);
  assert.equal(w.food, 1);
  applyTidalCommand(w, { id: 2, kind: 'slot0' });
  assert.equal(t.abilities.filterOpen, false);
});
void test('lateral line gives anonymous ripples only from actual movement and halves range under self noise', () => {
  const w = tidalFixture({ organs: ['lateral', 'jaw'] });
  const t = w.ocean!.tidal!;
  const a = { ...small(w), x: w.player.x + 100, y: w.player.y };
  t.actors = [a];
  stepTidalAbilities(w, 0.05);
  assert.deepEqual(lateralRipples(w), []);
  a.x += 1;
  stepTidalAbilities(w, 0.05);
  const ripples = lateralRipples(w);
  assert.equal(ripples.length, 1);
  assert.deepEqual(Object.keys(ripples[0]).sort(), ['x', 'y']);
  w.player.vx = 120;
  assert.deepEqual(lateralRipples(w), []);
  a.x = w.player.x + 60;
  stepTidalAbilities(w, 0.05);
  assert.equal(lateralRipples(w).length, 1);
});
void test('pause, birth, invalid commands and uninstalled abilities are resource inert', () => {
  const w = tidalFixture({ organs: ['jaw'] });
  w.ocean!.tidal!.abilities.slots = ['shell', null];
  assert.deepEqual(applyTidalCommand(w, { id: 1, kind: 'slot0' }), []);
  assert.equal(w.ocean!.tidal!.abilities.shellSeconds, 0);
  const before = structuredClone(w);
  for (const id of [-1, NaN, Infinity])
    applyTidalCommand(w, { id, kind: 'slot0' });
  for (const dt of [0, -1, NaN, Infinity]) stepTidalAbilities(w, dt);
  assert.deepEqual(w, before);
  w.ocean!.morph = { from: w.form, to: w.form, elapsed: 0, duration: 4.2 };
  const birth = structuredClone(w);
  applyTidalCommand(w, { id: 2, kind: 'slot0' });
  stepTidalAbilities(w, 0.05);
  assert.deepEqual(w, birth);
  w.ocean!.morph = null;
  for (const mode of ['paused', 'won', 'dead'] as const) {
    w.mode = mode;
    const before = structuredClone(w);
    applyTidalCommand(w, { id: 2, kind: 'slot0' });
    stepTidalAbilities(w, 0.05);
    assert.deepEqual(w, before);
  }
});

void test('live prey must touch a mouth and an already eaten fish cannot pay twice', () => {
  const w = tidalFixture({ organs: ['jaw'] });
  const t = w.ocean!.tidal!;
  const prey = small(w);
  t.actors = [prey];
  stepTidalAbilities(w, 0.05);
  assert.equal(prey.health, 0);
  assert.ok(w.food >= 2);
  const nutrition = w.food;
  for (let i = 0; i < 30; i++) stepTidalAbilities(w, 1 / 120);
  assert.equal(w.food, nutrition);
});
