import test from 'node:test';
import assert from 'node:assert/strict';
import { createOceanWorld } from '../app/game/ocean.ts';
import { stepWorld, distance } from '../app/game/simulation.ts';
import { validTidalState } from '../app/game/tidal/save-guards.ts';
import { tidalFixture } from './helpers/tidal-world.ts';
import {
  stepTidalEvents,
  tidalWindow,
  tidalEventFlow,
} from '../app/game/tidal/events.ts';
import { tidalIntent } from '../app/game/tidal/behavior.ts';
import { stepTidalEcology } from '../app/game/tidal/ecology.ts';
import type { TidalActor, TidalFood } from '../app/game/tidal/types.ts';
void test('events have eight-second warnings, bounded consequences and at least 25 seconds between strong starts', () => {
  const w = tidalFixture(),
    t = w.ocean!.tidal!,
    starts: number[] = [];
  let last = 0;
  for (let second = 0; second < 390; second++) {
    t.tick = second * 120;
    stepTidalEvents(w, 1 / 120, []);
    if (t.events.lastStrongTick !== last) {
      starts.push(t.events.lastStrongTick / 120);
      last = t.events.lastStrongTick;
    }
    if ([30, 55, 82].includes(second % 90))
      assert.equal(t.events.phase, 'warning');
    if ([37, 62, 89].includes(second % 90))
      assert.equal(t.events.phase, 'warning');
    assert.ok(t.events.completed.length <= 3);
  }
  assert.ok(starts.length > 9);
  for (let i = 1; i < starts.length; i++)
    assert.ok(starts[i] - starts[i - 1] >= 25);
});
void test('tidal windows recur for at least thirty seconds and paused/birth events never advance', () => {
  const w = tidalFixture(),
    t = w.ocean!.tidal!;
  for (const cycle of [1, 2, 3]) {
    for (let s = 0; s < 30; s++) {
      t.tick = (cycle * 90 + s) * 120;
      assert.ok(tidalWindow(w));
    }
    t.tick = (cycle * 90 + 30) * 120;
    assert.equal(tidalWindow(w), false);
  }
  for (const mode of ['paused', 'won', 'dead'] as const) {
    w.mode = mode;
    const before = structuredClone(w);
    stepTidalEvents(w, 0.05, []);
    assert.deepEqual(w, before);
  }
  w.mode = 'running';
  w.ocean!.morph = { from: w.form, to: w.form, elapsed: 1, duration: 4.2 };
  const before = structuredClone(w);
  stepTidalEvents(w, 0.05, []);
  assert.deepEqual(w, before);
});
void test('food shift moves real available plankton without duplicating carried food or removing nursery supply', () => {
  const w = tidalFixture(),
    t = w.ocean!.tidal!;
  t.tick = 40 * 120;
  t.foods = [
    {
      id: 'particle',
      kind: 'plankton',
      x: 1450,
      y: 700,
      energy: 8,
      biome: 'drift',
      state: 'available',
      owner: null,
      regrowSeconds: 0,
    },
  ];
  const previous = structuredClone(t.foods);
  stepTidalEvents(w, 0.05, []);
  assert.notEqual(t.foods[0].x, previous[0].x);
  assert.equal(t.foods.length, 1);
  assert.equal(t.foods[0].id, previous[0].id);
});
void test('player-offered bait diverts a hunter to a real meal and puts it into digestion', () => {
  const w = tidalFixture(),
    t = w.ocean!.tidal!;
  w.player.x = 1200;
  w.player.y = 1200;
  const hunter: TidalActor = {
    id: 'hunter',
    species: 'crested-hunter',
    homeBiome: 'reef',
    x: 1100,
    y: 1200,
    angle: 0,
    radius: 44,
    hunger: 80,
    health: 100,
    behavior: 'home',
    targetId: null,
    phaseSeconds: 0,
    respawnSeconds: 0,
    carryingId: null,
    trust: 0,
  };
  const bait: TidalFood = {
    id: 'offering',
    offeredBy: 'player',
    kind: 'scrap',
    x: 1000,
    y: 1200,
    energy: 8,
    biome: 'reef',
    owner: null,
    state: 'available',
    regrowSeconds: 0,
  };
  t.actors = [hunter];
  t.foods = [bait];
  t.foods = [];
  tidalIntent(w, hunter, 0.05);
  assert.equal(
    hunter.targetId,
    'player',
    'without bait the hunter really threatens this body',
  );
  t.foods = [bait];
  const intent = tidalIntent(w, hunter, 0.05);
  assert.equal(intent.food, bait.id);
  assert.equal(intent.prey, undefined);
  for (let i = 0; i < 60; i++) stepTidalEcology(w, 0.05);
  assert.equal(bait.state, 'consumed');
  assert.equal(hunter.behavior, 'digest');
  assert.equal(w.food, 0);
});

void test('three seeded public worlds bring the hunter to the nursery fringe without sealing the safe center or corrupting a checkpoint', () => {
  for (const seed of [23, 71, 101]) {
    const w = createOceanWorld(seed);
    w.mode = 'running';
    let closest = Infinity;
    for (let i = 0; i < 83 * 120; i++) {
      stepWorld(w, { x: 0, y: 0, dash: false }, 1 / 120);
      const t = w.ocean!.tidal!;
      if (t.events.active === 'hunter-visit') {
        const hunter = t.actors.find((a) => a.species === 'crested-hunter')!;
        closest = Math.min(closest, distance(hunter, { x: 810, y: 1770 }));
      }
    }
    assert.ok(closest < 120, `seed ${seed} actual fringe distance ${closest}`);
    assert.equal(w.mode, 'running');
    assert.ok(validTidalState(w.ocean!.tidal));
  }
});

void test('ebb and open tides change real entry current while leaving the sheltered estuary calm', () => {
  const w = tidalFixture();
  const p = { x: 2670, y: 390 };
  w.ocean!.tidal!.tick = 80 * 120;
  assert.ok(tidalEventFlow(w, p, { x: 0, y: 0 }).x < 0);
  w.ocean!.tidal!.tick = 90 * 120;
  assert.ok(tidalEventFlow(w, p, { x: 0, y: 0 }).x > 0);
  assert.deepEqual(tidalEventFlow(w, { x: 3060, y: 390 }, { x: 0, y: 0 }), {
    x: 0,
    y: 0,
  });
});
