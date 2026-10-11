import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLandWorld,
  evolveLand,
  landStats,
  interactLand,
  LAND_ROCKS,
} from '../app/game/land.ts';
import { commandCompanions } from '../app/game/companions.ts';
import { stepWorld, distance } from '../app/game/simulation.ts';
const idle = { x: 0, y: 0, dash: false };
function birthWorld() {
  const w = createLandWorld(62);
  w.food = 40;
  interactLand(w);
  w.land!.discovered = ['fern'];
  return w;
}
void test('draft is isolated, rejects invalid anatomy atomically, and birth records the actual parent', () => {
  const w = birthWorld(),
    old = structuredClone(w.land!.body),
    food = w.food;
  const draft = {
    ...structuredClone(old),
    length: 1.45,
    width: 1.2,
    legs: 1.4,
  };
  assert.deepEqual(w.land!.body, old);
  for (const bad of [
    { ...draft, legs: NaN },
    { ...draft, length: 2 },
    {
      ...draft,
      organs: {
        ...old.organs,
        front: old.organs.front === 'jaw' ? ('fin' as const) : ('jaw' as const),
      },
    },
  ]) {
    assert.equal(evolveLand(w, 'strider', bad), false);
    assert.equal(w.food, food);
    assert.equal(w.history.length, 0);
  }
  assert.ok(evolveLand(w, 'strider', draft));
  assert.deepEqual(w.history[0].body, old);
  assert.deepEqual(w.land!.morph!.fromBody, old);
  assert.deepEqual(w.land!.body, draft);
  draft.legs = 0.8;
  assert.equal(w.land!.body.legs, 1.4);
  const long = landStats(w);
  w.land!.body.legs = 0.8;
  const short = landStats(w);
  assert.ok(long.speed > short.speed);
  assert.ok(long.metabolism > short.metabolism);
  const elapsed = w.land!.morph!.elapsed;
  w.mode = 'paused';
  stepWorld(w, idle, 2);
  assert.equal(w.land!.morph!.elapsed, elapsed);
  w.mode = 'running';
  stepWorld(w, idle, 2);
  assert.ok(w.land!.morph);
  stepWorld(w, idle, w.evolution!.duration - 2 + 0.1);
  assert.equal(w.land!.morph, null);
});
function gatheringWorld(count = 1) {
  const w = createLandWorld(83);
  w.food = 0;
  w.land!.creatures = w
    .land!.creatures.filter((c) => c.species === 'fern')
    .slice(0, count);
  Object.assign(w.player, { x: 350, y: 450 });
  for (const [i, c] of w.land!.creatures.entries())
    Object.assign(c, { x: 390, y: 450 + i * 30, joined: true, angle: 0 });
  w.foods = w.foods.slice(0, count);
  w.foods.forEach((f, i) =>
    Object.assign(f, { x: 700, y: 430 + i * 65, cooldown: 0 }),
  );
  return w;
}
void test('companions collect distinct real fruit, carry physically, and award food only on returning', () => {
  const w = gatheringWorld(2);
  assert.ok(commandCompanions(w));
  assert.equal(new Set(w.land!.creatures.map((c) => c.targetFood)).size, 2);
  assert.equal(w.food, 0);
  stepWorld(w, idle, 0.2);
  assert.equal(w.food, 0);
  let carried = false;
  for (let i = 0; i < 600; i++) {
    stepWorld(w, idle, 1 / 60);
    if (w.land!.creatures.some((c) => c.carrying)) carried = true;
  }
  assert.ok(carried);
  assert.equal(w.food, 2);
  assert.equal(w.totalFood, 2);
  assert.ok(w.foods.every((f) => f.cooldown > 0));
  for (let i = 0; i < 60; i++) stepWorld(w, idle, 1 / 60);
  assert.equal(w.food, 2);
});
void test('recall cancels uncollected fruit; pause and birth freeze commands and tasks', () => {
  const w = gatheringWorld();
  commandCompanions(w);
  assert.ok(commandCompanions(w));
  assert.equal(w.land!.creatures[0].task, 'follow');
  assert.equal(w.food, 0);
  commandCompanions(w);
  const before = structuredClone(w.land!.creatures);
  w.mode = 'paused';
  assert.equal(commandCompanions(w), false);
  stepWorld(w, idle, 1);
  assert.deepEqual(w.land!.creatures, before);
  w.mode = 'running';
  w.land!.morph = { from: 'crawler', elapsed: 0, duration: 4.8 };
  assert.equal(commandCompanions(w), false);
  stepWorld(w, idle, 1);
  assert.deepEqual(w.land!.creatures, before);
});
void test('companions avoid live hunter territory and handle a fruit taken before arrival', () => {
  const w = gatheringWorld();
  const hunter = createLandWorld().land!.creatures.find(
    (c) => c.species === 'hunter',
  )!;
  hunter.home = { ...w.foods[0] };
  w.land!.creatures.push(hunter);
  assert.equal(commandCompanions(w), false);
  hunter.respawn = 20;
  assert.ok(commandCompanions(w));
  w.foods[0].cooldown = 30;
  for (let i = 0; i < 180; i++) stepWorld(w, idle, 1 / 60);
  assert.equal(w.food, 0);
  assert.equal(w.land!.creatures[0].task, 'follow');
});
void test('foraging detours around a rock without teleporting or collecting remotely', () => {
  const w = gatheringWorld(),
    rock = LAND_ROCKS[0],
    c = w.land!.creatures[0],
    offset = rock.radius + 90;
  Object.assign(w.player, { x: rock.x - offset - 30, y: rock.y });
  Object.assign(c, { x: rock.x - offset, y: rock.y, angle: 0 });
  Object.assign(w.foods[0], { x: rock.x + offset, y: rock.y });
  assert.ok(commandCompanions(w));
  for (let i = 0; i < 1800 && w.food === 0; i++) {
    const before = { ...c };
    stepWorld(w, idle, 1 / 60);
    assert.ok(distance(c, before) < 6);
    assert.ok(distance(c, rock) >= rock.radius + 26);
  }
  assert.equal(w.food, 1);
});
