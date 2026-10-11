import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld } from '../app/game/simulation.ts';
import { guideNavigation } from '../app/game/navigation.ts';
import { beginGuidedAction } from '../app/game/evolution-navigation.ts';
import * as guidance from '../app/game/life-guidance.ts';
import { journeyTarget } from '../app/game/world-guidance.ts';
import { distance } from '../app/game/simulation.ts';
import { createOceanWorld } from '../app/game/ocean.ts';
import { createShoreWorld, SHORE_POOLS } from '../app/game/shore.ts';
import { createLandWorld } from '../app/game/land.ts';

void test('the public pond goal reaches a real food contact, instead of stopping outside pickup reach', () => {
  const destination = (
    guidance as unknown as {
      journeyDestination?: (w: ReturnType<typeof createWorld>) => {
        target: { x: number; y: number };
        arrivalRadius?: number;
      };
    }
  ).journeyDestination;
  assert.ok(destination);
  const w = createWorld(23);
  w.mode = 'running';
  const next = beginGuidedAction(w, destination(w))!;
  const food = w.foods.find(
    (f) => f.x === next.target.x && f.y === next.target.y,
  )!;
  assert.ok(food);
  for (let i = 0; i < 300 && food.cooldown === 0; i++) {
    const input = guideNavigation(next, w.player, 0.05);
    stepWorld(w, { x: input?.x ?? 0, y: input?.y ?? 0, dash: false }, 0.05);
  }
  assert.ok(food.cooldown > 0);
  assert.ok(w.food > 0);
});
void test('observational travel honors a safe source approach radius and does not drive into a predator', () => {
  const n = {
    target: { x: 200, y: 0 },
    last: { x: 60, y: 0 },
    stalled: 0,
    arrivalRadius: 155,
  };
  assert.equal(guideNavigation(n, { x: 60, y: 0 }, 0.05), null);
  assert.deepEqual(n.target, { x: 200, y: 0 });
});
void test('a safe final approach radius does not stop travel at an intermediate rock detour', () => {
  const n = {
    target: { x: 400, y: 0 },
    arrivalRadius: 140,
    last: { x: 0, y: 0 },
    stalled: 0,
    path: [
      { x: 50, y: 0 },
      { x: 400, y: 0 },
    ],
  };
  assert.ok(guideNavigation(n, { x: 0, y: 0 }, 0.05));
  assert.ok(guideNavigation(n, { x: 45, y: 0 }, 0.05));
  assert.equal(n.path.length, 1);
  assert.equal(guideNavigation(n, { x: 300, y: 0 }, 0.05), null);
});
void test('the food goal bypasses a nearer meal inside a visible predator warning area', () => {
  const w = createWorld(23);
  w.mode = 'running';
  w.predators = [w.predators[0]];
  Object.assign(w.predators[0], { x: w.player.x + 100, y: w.player.y });
  w.foods = [
    { ...w.foods[0], x: w.player.x + 90, y: w.player.y, cooldown: 0 },
    { ...w.foods[1], x: w.player.x - 150, y: w.player.y, cooldown: 0 },
  ];
  const goal = journeyTarget(w);
  assert.ok(distance(goal.point, w.predators[0]) > 210);
  assert.equal(goal.point.x, w.foods[1].x);
});
void test('the public marine hunting goal follows the living prey instead of its obsolete coordinates', () => {
  const w = createOceanWorld(41);
  w.form = 'fish';
  w.ocean!.tier = 2;
  w.food = 4;
  w.ocean!.tidal!.migration.startedTick = 1;
  w.ocean!.tidal!.migration.visited = ['reef', 'drift'];
  const destination = guidance.journeyDestination(w);
  assert.ok(destination.oceanActorId);
  assert.equal(destination.oceanIntent, 'hunt');
  assert.ok(
    w.ocean!.tidal!.actors.some(
      (a) => a.id === destination.oceanActorId && a.health > 0,
    ),
  );
});
void test('shore supply guidance selects an available meal instead of an empty nursery', () => {
  const w = createShoreWorld(37);
  w.shore!.tier = 1;
  w.shore!.discovered = ['support', 'moisture'];
  w.shore!.visited.push(SHORE_POOLS[2].name);
  w.food = 8;
  w.foods.forEach((f) => {
    f.cooldown = 40;
  });
  const food = w.foods[0];
  Object.assign(food, { x: w.player.x + 100, y: w.player.y, cooldown: 0 });
  const goal = journeyTarget(w);
  assert.equal(goal.point, food);
  const destination = guidance.journeyDestination(w);
  const next = beginGuidedAction(w, destination)!;
  for (let i = 0; i < 200 && food.cooldown === 0; i++) {
    const input = guideNavigation(next, w.player, 0.05);
    stepWorld(w, { x: input?.x ?? 0, y: input?.y ?? 0, dash: false }, 0.05);
  }
  assert.ok(food.cooldown > 0);
  assert.ok(w.food > 8);
});
void test('ordinary guided travel detours around an ambush territory rather than crossing its attack range', () => {
  const terrainFor = (
    guidance as unknown as {
      landJourneyObstacles?: (
        w: ReturnType<typeof createWorld>,
      ) => { x: number; y: number; radius: number }[];
    }
  ).landJourneyObstacles;
  assert.ok(terrainFor);
  const w = createLandWorld(41);
  const c = w.land!.creatures.find((c) => c.species === 'dusk-stalker')!;
  w.land!.creatures = [c];
  Object.assign(c, { x: 850, y: 1450 });
  c.home = { x: c.x, y: c.y };
  const n = { target: { x: 1300, y: 1450 }, last: { ...w.player }, stalled: 0 };
  const p = { x: 450, y: 1450 };
  const terrain = { obstacles: terrainFor(w), clearance: 50 };
  for (let i = 0; i < 1000; i++) {
    const input = guideNavigation(n, p, 0.05, terrain);
    if (!input) break;
    p.x += input.x * 5;
    p.y += input.y * 5;
    assert.ok(distance(p, c.home) > 180);
  }
  assert.ok(distance(p, n.target) < 20);
});
