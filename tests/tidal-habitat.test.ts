import test from 'node:test';
import assert from 'node:assert/strict';
import {
  biomeAt,
  tidalFlow,
  tidalCover,
  tidalObstacles,
  nearestTidalSafePoint,
} from '../app/game/tidal/habitat.ts';
import { stepTidal, ensureTidalWorld } from '../app/game/tidal/step.ts';
import { createOceanWorld, stepOcean } from '../app/game/ocean.ts';
import {
  constrainBody,
  trunkTouches,
  trunkCircles,
  worldBodyPose,
} from '../app/game/body-geometry.ts';
import { FORMS } from '../app/game/forms.ts';
import { getStats } from '../app/game/simulation.ts';
import { decodeSave, encodeSave } from '../app/game/campaign-save.ts';
import { readFileSync } from 'node:fs';
import type { BodyPose } from '../app/game/body-geometry.ts';

const idle = { x: 0, y: 0, dash: false },
  map = { width: 3400, height: 2300 };
void test('four habitats cover the map deterministically; safe cover is out of the current', () => {
  for (const [x, y, id] of [
    [460, 1770, 'nursery'],
    [2380, 1430, 'reef'],
    [1550, 700, 'drift'],
    [3060, 390, 'estuary'],
  ] as const)
    assert.equal(biomeAt({ x, y }), id);
  const p = { x: 460, y: 1770 };
  assert.ok(tidalCover(p) > 0);
  assert.deepEqual(tidalFlow(p, 1200), { x: 0, y: 0 });
  const current = tidalFlow({ x: 1550, y: 700 }, 1200);
  assert.ok(Math.hypot(current.x, current.y) > 20);
  assert.deepEqual(current, tidalFlow({ x: 1550, y: 700 }, 1200));
});

void test('narrow crack accepts a juvenile; maximum adult can use the open bypass in either orientation', () => {
  const rocks = tidalObstacles(0);
  const small: BodyPose = {
    x: 2230,
    y: 1350,
    size: 27,
    angle: 0,
    form: 'bilateral',
    body: { length: 1, width: 0.7, organs: {} },
  };
  assert.deepEqual(constrainBody(small, rocks, map), {
    x: small.x,
    y: small.y,
  });
  const big: BodyPose = {
    ...small,
    size: FORMS.jelly.radius * 2.1,
    form: 'jelly',
    body: { length: 1.5, width: 1.3, organs: {} },
  };
  assert.ok(
    rocks.some((r) => trunkTouches(big, r)),
    'a large adult cannot occupy the juvenile crack',
  );
  // Broad western route circles the same reef. At least 20 units remain beyond its full trunk.
  for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    for (let y = 1000; y <= 1600; y += 10) {
      const p = { ...big, x: 1950, y, angle };
      assert.ok(
        !rocks.some((r) => trunkTouches(p, { ...r, radius: r.radius + 20 })),
        `wide bypass y=${y}, angle=${angle}`,
      );
      assert.deepEqual(constrainBody(p, rocks, map), { x: p.x, y: p.y });
    }
  }
});

void test('collision preserves tangential travel, and both spawn and restored safety point are legal', () => {
  const w = createOceanWorld();
  const rocks = tidalObstacles(0),
    pose = worldBodyPose(w);
  assert.ok(!rocks.some((r) => trunkTouches(pose, r)));
  const rock = rocks[0];
  const a = constrainBody(
    { ...pose, x: rock.x + rock.radius, y: rock.y + 10 },
    rocks,
    map,
  );
  const b = constrainBody(
    { ...pose, x: rock.x + rock.radius, y: rock.y + 30 },
    rocks,
    map,
  );
  assert.ok(b.y > a.y);
  const point = nearestTidalSafePoint(rock);
  const restored = { ...pose, ...point };
  assert.ok(!rocks.some((r) => trunkTouches(restored, r)));
  assert.ok(
    trunkCircles(restored).every(
      (c) => c.x - c.radius >= 0 && c.y - c.radius >= 0,
    ),
  );
});

void test('new ocean takes a single path; legacy particles, predators and discovery never resolve alongside it', () => {
  const w = createOceanWorld();
  assert.ok(w.ocean!.tidal);
  w.foods = [{ id: 99, x: w.player.x, y: w.player.y, cooldown: 0, rich: true }];
  w.predators = [
    {
      id: 99,
      x: w.player.x,
      y: w.player.y,
      home: { ...w.player },
      angle: 0,
      alert: true,
      stun: 0,
      radius: 200,
    },
  ];
  const before = { food: w.food, dna: w.ocean!.dna, health: w.player.health };
  stepOcean(w, idle, 1 / 60);
  assert.equal(w.food, before.food);
  assert.equal(w.ocean!.dna, before.dna);
  assert.equal(w.player.health, before.health);
  assert.deepEqual(w.ocean!.observation, {});
  assert.equal(w.ocean!.tidal!.tick, 2);
});

void test('pause, terminal states, invalid dt and birth freeze tidal ecology and resources', () => {
  const w = createOceanWorld();
  for (const mode of ['paused', 'won', 'dead', 'ready'] as const) {
    w.mode = mode;
    const before = structuredClone(w);
    stepTidal(w, { x: 1, y: 0, dash: true }, 1 / 60);
    assert.deepEqual(w, before);
  }
  w.mode = 'running';
  for (const dt of [NaN, Infinity, 0, -1]) {
    const before = structuredClone(w);
    stepTidal(w, idle, dt);
    assert.deepEqual(w, before);
  }
  w.ocean!.morph = {
    from: 'colony',
    to: 'bilateral',
    elapsed: 0,
    duration: 4.2,
  };
  const energy = w.player.energy,
    body = structuredClone(w.ocean!.tidal),
    p = { x: w.player.x, y: w.player.y };
  stepTidal(w, { x: 1, y: 1, dash: true }, 0.05);
  assert.equal(w.player.energy, energy);
  assert.deepEqual(w.ocean!.tidal, body);
  assert.equal(w.player.x, p.x);
  assert.equal(w.player.y, p.y);
});

void test('new movement matches the established response and does not use viewport to award anything', () => {
  const w = createOceanWorld(),
    legacy = createOceanWorld(23, undefined, 'legacy');
  for (let i = 0; i < 10; i++) {
    const input = { x: 1, y: 0.3, dash: false };
    stepOcean(w, input, 1 / 120);
    stepOcean(legacy, input, 1 / 120);
    assert.ok(Math.abs(w.player.x - legacy.player.x) < 1e-8);
    assert.ok(Math.abs(w.player.y - legacy.player.y) < 1e-8);
    assert.equal(w.player.angle, legacy.player.angle);
  }
  assert.ok(w.player.energy <= getStats(w.traits, w.form).maxEnergy);
});

void test('pending old journey stays intact until its real nursery arrival then retains earned progress', () => {
  const old = JSON.parse(
    readFileSync(
      new URL('./fixtures/campaign-v4.json', import.meta.url),
      'utf8',
    ),
  );
  old.campaign.journey.mode = 'running';
  const read = decodeSave(JSON.stringify(old));
  if (read.kind !== 'ok') throw Error(read.kind);
  const w = read.save.campaign.journey;
  const t = w.ocean!.tidal!;
  assert.equal(t.compat.mode, 'pending');
  const before = structuredClone(w);
  ensureTidalWorld(w);
  assert.deepEqual(w, before);
  w.player.x = 460;
  w.player.y = 1770;
  const earned = structuredClone(t.compat);
  ensureTidalWorld(w);
  assert.equal(t.compat.mode, 'active');
  assert.equal(t.compat.legacyStations, earned.legacyStations);
  assert.deepEqual(t.compat.legacyLegs, earned.legacyLegs);
  assert.deepEqual(w.foods, []);
  assert.deepEqual(w.predators, []);
  assert.deepEqual(w.ocean!.shoal, []);
  assert.equal(
    decodeSave(encodeSave({ ...read.save.campaign, journey: w })).kind,
    'ok',
  );
});
