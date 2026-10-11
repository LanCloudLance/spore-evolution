import { createOceanWorld } from './helpers/legacy-ocean.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { stepOcean, retryOcean } from '../app/game/ocean.ts';
import {
  bodyRadius,
  sizeRelation,
  stepFoodChain,
} from '../app/game/food-chain.ts';
function scene() {
  const w = createOceanWorld(23);
  w.player.angle = 0;
  w.predators = [];
  w.foods = [];
  w.ocean!.shoal = [
    {
      id: 100,
      x: w.player.x + (bodyRadius(w) * 35) / 36,
      y: w.player.y,
      home: { x: 700, y: 1800 },
      radius: 14,
      baseRadius: 14,
      angle: 0,
      cooldown: 0,
      fleeing: false,
      stun: 0,
    },
  ];
  return w;
}
void test('mouth contact with a smaller live fish swallows it once, feeds and grows the player', () => {
  const w = scene(),
    r = bodyRadius(w);
  stepFoodChain(w, 0.016);
  assert.equal(w.ocean!.eaten, 1);
  assert.ok(bodyRadius(w) > r);
  assert.ok(w.food >= 2);
  assert.ok(w.ocean!.shoal[0].cooldown > 0);
  const food = w.food;
  stepFoodChain(w, 0.016);
  assert.equal(w.food, food);
  assert.equal(w.ocean!.meals.length, 1);
});
void test('a similar-sized fish is not edible and size changes reverse the relationship', () => {
  const w = scene();
  w.ocean!.shoal[0].radius = 30;
  stepFoodChain(w, 0.016);
  assert.equal(w.ocean!.eaten, 0);
  assert.equal(sizeRelation(w, 36), 'danger');
  w.ocean!.biomass = 100;
  assert.equal(sizeRelation(w, 36), 'prey');
});
void test('small fish flee from a larger player instead of behaving like static food', () => {
  const w = scene();
  w.ocean!.shoal[0].x += 100;
  const x = w.ocean!.shoal[0].x;
  stepFoodChain(w, 0.05);
  assert.ok(w.ocean!.shoal[0].x > x);
  assert.equal(w.ocean!.shoal[0].fleeing, true);
});
void test('paused food chain is frozen and a chapter retry resets growth', () => {
  const w = scene();
  stepFoodChain(w, 0.02);
  w.mode = 'paused';
  const before = structuredClone(w);
  stepOcean(w, { x: 1, y: 0, dash: true }, 0.05);
  assert.deepEqual(w, before);
  const retry = retryOcean(w);
  assert.equal(retry.ocean!.biomass, 0);
  assert.equal(retry.ocean!.eaten, 0);
});

void test('growth lets the player swallow a former predator and its respawn cannot happen on the player', () => {
  const w = scene();
  w.ocean!.shoal = [];
  w.ocean!.biomass = 100;
  w.predators = [
    {
      id: 0,
      x: w.player.x + (bodyRadius(w) * 35) / 36,
      y: w.player.y,
      home: { x: w.player.x, y: w.player.y },
      radius: 36,
      angle: 0,
      alert: true,
      stun: 0,
      respawn: 0,
    },
  ];
  stepFoodChain(w, 0.02);
  assert.equal(w.ocean!.eaten, 1);
  assert.ok(w.predators[0].respawn! > 0);
  w.predators[0].respawn = 0.01;
  stepFoodChain(w, 0.02);
  assert.ok(
    w.predators[0].respawn! > 0,
    'respawn waits until its home is offscreen',
  );
});
void test('NPC fish swallow smaller fish without crediting the player', () => {
  const w = scene();
  w.ocean!.shoal[0].x = 1300;
  w.ocean!.shoal[0].y = 600;
  w.predators = [
    {
      id: 0,
      x: 1300,
      y: 600,
      home: { x: 1300, y: 600 },
      radius: 66,
      angle: 0,
      alert: false,
      stun: 0,
    },
  ];
  stepFoodChain(w, 0.016);
  assert.ok(w.ocean!.shoal[0].cooldown > 0);
  assert.equal(w.ocean!.eaten, 0);
  assert.equal(w.ocean!.biomass, 0);
});
void test('a giant telegraphs its bite before swallowing the unprotected player', () => {
  const w = scene();
  w.ocean!.shoal = [];
  w.player.x = 1300;
  w.player.y = 600;
  w.player.invulnerable = 0;
  w.predators = [
    {
      id: 0,
      x: 1310,
      y: 600,
      home: { x: 1310, y: 600 },
      radius: 100,
      angle: 0,
      alert: false,
      stun: 0,
      bite: 0,
    },
  ];
  stepOcean(w, { x: 0, y: 0, dash: false }, 0.05);
  assert.equal(w.mode, 'running');
  assert.ok(w.predators[0].bite! > 0);
  for (let i = 0; i < 12; i++) stepOcean(w, { x: 0, y: 0, dash: false }, 0.05);
  assert.equal(w.mode, 'dead');
});

void test('a chasing player can catch six fleeing fish and visibly grow through real movement', () => {
  const w = createOceanWorld(23);
  let frames = 0;
  while (w.mode === 'running' && w.ocean!.eaten < 6 && frames < 1600) {
    const p = w.player,
      pr = bodyRadius(w);
    const prey = w
      .ocean!.shoal.filter((f) => f.cooldown === 0 && f.radius * 1.22 <= pr)
      .sort(
        (a, b) =>
          Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
      )[0];
    if (!prey) break;
    const dx = prey.x - p.x,
      dy = prey.y - p.y,
      d = Math.hypot(dx, dy);
    stepOcean(
      w,
      {
        x: dx / Math.max(1, d),
        y: dy / Math.max(1, d),
        dash: d < 170 && p.energy > 40,
        skill: false,
      },
      0.05,
    );
    frames++;
  }
  assert.equal(w.mode, 'running');
  assert.ok(w.ocean!.eaten >= 6, `caught ${w.ocean!.eaten}`);
  assert.ok(bodyRadius(w) > 35, `radius ${bodyRadius(w)}`);
});
