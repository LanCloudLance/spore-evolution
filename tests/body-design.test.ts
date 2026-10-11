import { createOceanWorld } from './helpers/legacy-ocean.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { stepOcean, retryOcean, OCEAN_NURSERY } from '../app/game/ocean.ts';
import {
  blockWithSpine,
  commitBody,
  freshBody,
  SPECIMENS,
  organFaces,
  bodyEffects,
  designCost,
} from '../app/game/body-design.ts';
import { stepFoodChain } from '../app/game/food-chain.ts';
import { distance } from '../app/game/simulation.ts';
const idle = { x: 0, y: 0, dash: false };
void test('unseen organs, missing mouths and overspending are rejected without modifying the world', () => {
  const w = createOceanWorld();
  const body = freshBody();
  body.organs.tail = 'spine';
  const before = structuredClone(w);
  assert.equal(commitBody(w, body), false);
  assert.deepEqual(w, before);
  w.ocean!.discovered.push('spine');
  w.ocean!.dna = 0;
  assert.equal(commitBody(w, body), false);
  w.ocean!.dna = 100;
  delete body.organs.front;
  assert.equal(commitBody(w, body), false);
});
void test('nursery rebirth charges DNA, records the actual parent, and preserves progress independently of the draft', () => {
  const w = createOceanWorld();
  w.ocean!.dna = 50;
  w.ocean!.discovered.push('spine');
  w.food = 12;
  w.ocean!.biomass = 20;
  const draft = freshBody();
  draft.length = 1.3;
  draft.organs.tail = 'spine';
  assert.ok(commitBody(w, draft));
  assert.equal(w.ocean!.dna, 50 - designCost(draft));
  assert.equal(w.generation, 2);
  assert.equal(w.food, 12);
  assert.equal(w.ocean!.biomass, 20);
  assert.deepEqual(w.history[0].body, freshBody());
  draft.organs.tail = 'fin';
  assert.equal(w.ocean!.body.organs.tail, 'spine');
  assert.equal(
    commitBody(w, draft),
    false,
    'cannot edit during the birth animation',
  );
  w.ocean!.morph = null;
  w.player.x += 600;
  assert.equal(commitBody(w, draft), false, 'cannot edit outside nursery');
});
void test('a tail spike blocks a pursuer but leaves the front exposed, and rotating the body rotates protection', () => {
  const w = createOceanWorld();
  w.player.angle = 0;
  w.ocean!.body.organs.tail = 'spine';
  const enemy = { x: w.player.x - 40, y: w.player.y, stun: 0 };
  assert.ok(blockWithSpine(w, enemy, 44));
  assert.equal(w.ocean!.blocks, 1);
  enemy.stun = 0;
  enemy.x = w.player.x + 40;
  assert.equal(blockWithSpine(w, enemy, 44), false);
  w.player.angle = Math.PI;
  assert.ok(blockWithSpine(w, enemy, 44));
});
void test('feeding uses the installed mouth direction and a filter-only body cannot eat live fish', () => {
  const w = createOceanWorld();
  w.player.angle = 0;
  assert.ok(organFaces(w, { x: w.player.x + 20, y: w.player.y }, 'jaw'));
  assert.equal(
    organFaces(w, { x: w.player.x - 20, y: w.player.y }, 'jaw'),
    false,
  );
  w.ocean!.body.organs = { tail: 'jaw' };
  assert.ok(organFaces(w, { x: w.player.x - 20, y: w.player.y }, 'jaw'));
  w.ocean!.body.organs = { front: 'filter' };
  w.predators = [];
  const f = w.ocean!.shoal[0];
  f.x = w.player.x;
  f.y = w.player.y;
  f.radius = 12;
  w.ocean!.shoal = [f];
  stepFoodChain(w, 0.01);
  assert.equal(w.ocean!.eaten, 0);
  assert.equal(bodyEffects(w.ocean!.body).pickup, 35);
});
void test('paused observation earns no progress and each organ discovery pays only once', () => {
  const w = createOceanWorld();
  w.player.x = SPECIMENS[0].x;
  w.player.y = SPECIMENS[0].y;
  w.predators = [];
  w.foods = [];
  w.ocean!.shoal = [];
  w.mode = 'paused';
  const before = structuredClone(w);
  stepOcean(w, idle, 0.05);
  assert.deepEqual(w, before);
  w.mode = 'running';
  for (let i = 0; i < 41; i++) stepOcean(w, idle, 0.05);
  assert.ok(w.ocean!.discovered.includes('spine'));
  assert.equal(w.ocean!.dna, 40);
  for (let i = 0; i < 50; i++) stepOcean(w, idle, 0.05);
  assert.equal(w.ocean!.dna, 40);
  const retry = retryOcean(w);
  assert.deepEqual(retry.ocean!.discovered, ['jaw', 'fin']);
  assert.deepEqual(retry.ocean!.body, freshBody());
});
void test('longer bodies swim faster but turn slower; wider bodies take less damage and spend more energy', () => {
  const normal = bodyEffects(freshBody());
  const long = bodyEffects({ ...freshBody(), length: 1.5 });
  const wide = bodyEffects({ ...freshBody(), width: 1.3 });
  assert.ok(long.speed > normal.speed);
  assert.ok(long.turn < normal.turn);
  assert.ok(wide.damage < normal.damage);
  assert.ok(wide.metabolism > normal.metabolism);
});
void test('the specimen journey is reachable by swimming and the new tail stops a live pursuing predator', () => {
  const w = createOceanWorld(23);
  const swimTo = (target: { x: number; y: number }, frames = 1000) => {
    for (let i = 0; i < frames && distance(w.player, target) > 18; i++) {
      const d = distance(w.player, target);
      stepOcean(
        w,
        {
          x: (target.x - w.player.x) / d,
          y: (target.y - w.player.y) / d,
          dash: false,
          skill: false,
        },
        0.05,
      );
      assert.equal(w.mode, 'running', w.reason);
    }
    assert.ok(distance(w.player, target) < 25);
  };
  swimTo({ x: 590, y: 1510 });
  swimTo(SPECIMENS[0]);
  for (let i = 0; i < 45; i++) stepOcean(w, idle, 0.05);
  assert.ok(w.ocean!.discovered.includes('spine'));
  swimTo({ x: 590, y: 1510 });
  swimTo(OCEAN_NURSERY);
  const draft = freshBody();
  draft.organs.tail = 'spine';
  assert.ok(commitBody(w, draft));
  for (let i = 0; i < 35; i++) stepOcean(w, idle, 0.05);
  swimTo({ x: 730, y: 1320 });
  // A deterministic pursuer encounter after the real discovery/return journey.
  w.player.angle = 0;
  w.player.invulnerable = 0;
  w.predators = [
    {
      id: 8,
      x: w.player.x - 65,
      y: w.player.y,
      home: { ...w.player },
      radius: 100,
      angle: 0,
      alert: true,
      stun: 0,
    },
  ];
  const health = w.player.health;
  stepOcean(w, { x: 1, y: 0, dash: false }, 0.05);
  assert.ok(w.ocean!.blocks > 0);
  assert.ok(w.predators[0].stun > 0);
  assert.ok(w.player.health >= health);
});
