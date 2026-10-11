import test from 'node:test';
import assert from 'node:assert/strict';
import { createLandWorld, landSkill, LAND_ROCKS } from '../app/game/land.ts';
import {
  creatureHealth,
  huntingStats,
  strikePrey,
  LAND_COVER,
} from '../app/game/land-hunt.ts';
import { stepWorld } from '../app/game/simulation.ts';
const idle = { x: 0, y: 0, dash: false };
void test('prey detects an exposed stalker but crouching at the same distance stays unnoticed', () => {
  const run = (sneak: boolean) => {
    const w = createLandWorld(),
      c = w.land!.creatures[0];
    w.form = 'stalker';
    w.foods = [];
    w.land!.creatures = [c];
    w.player.x = c.x - 150;
    w.player.y = c.y;
    for (let i = 0; i < 20; i++) stepWorld(w, { ...idle, sneak }, 0.05);
    return c;
  };
  assert.ok(run(false).suspicion > 0.6);
  assert.equal(run(true).suspicion, 0);
});
void test('fern cover reduces crouched detection range, with slower actual movement', () => {
  const w = createLandWorld(),
    c = w.land!.creatures[0];
  w.form = 'stalker';
  w.land!.creatures = [c];
  w.foods = [];
  Object.assign(w.player, { x: LAND_COVER[0].x, y: LAND_COVER[0].y });
  c.x = w.player.x + 75;
  c.y = w.player.y;
  c.home = { x: c.x, y: c.y };
  for (let i = 0; i < 10; i++) stepWorld(w, { ...idle, sneak: true }, 0.05);
  assert.equal(c.suspicion, 0);
  const run = (sneak: boolean) => {
    const a = createLandWorld();
    a.form = 'stalker';
    a.land!.creatures = [];
    a.foods = [];
    const x = a.player.x;
    for (let i = 0; i < 20; i++)
      stepWorld(a, { x: 1, y: 0, dash: false, sneak }, 0.05);
    return a.player.x - x;
  };
  assert.ok(run(true) < run(false) * 0.6);
});
void test('a committed pounce cannot turn after launch, and missed prey takes no remote damage', () => {
  const w = createLandWorld(),
    c = w.land!.creatures[0];
  w.form = 'stalker';
  w.foods = [];
  w.land!.creatures = [c];
  w.player.x = c.x - 210;
  w.player.y = c.y;
  w.player.angle = 0;
  assert.ok(landSkill(w));
  assert.equal(c.health, 60);
  c.y += 160;
  c.home.y += 160;
  for (let i = 0; i < 8; i++) stepWorld(w, { x: 0, y: 1, dash: false }, 0.04);
  assert.equal(c.health, 60);
  assert.equal(w.land!.hunts, 0);
  assert.match(w.notice, /扑空/);
});
void test('even a long simulation step cannot pounce through a rock', () => {
  const w = createLandWorld(),
    c = w.land!.creatures[0],
    rock = LAND_ROCKS[0];
  w.form = 'stalker';
  w.foods = [];
  w.land!.creatures = [c];
  w.player.x = rock.x - 130;
  w.player.y = rock.y;
  w.player.angle = 0;
  c.x = rock.x + 100;
  c.y = rock.y;
  c.home = { x: c.x, y: c.y };
  assert.ok(landSkill(w));
  stepWorld(w, idle, 0.4);
  assert.ok(w.player.x < rock.x - rock.radius);
  assert.equal(c.health, 60);
});
void test('meat requires stopped eating; a nearby hunter can steal it without giving player food or growth', () => {
  const w = createLandWorld(),
    c = w.land!.creatures[0],
    hunter = w.land!.creatures.find((c) => c.species === 'hunter')!;
  w.form = 'stalker';
  w.foods = [];
  w.player.x = 1500;
  w.player.y = 1500;
  c.x = hunter.x;
  c.y = hunter.y;
  strikePrey(w, c, 999);
  assert.equal(w.food, 0);
  assert.equal(w.land!.nutrition, 0);
  stepWorld(w, idle, 0.05);
  assert.equal(w.land!.stolen, 1);
  assert.equal(w.food, 0);
  assert.equal(w.land!.nutrition, 0);
  stepWorld(w, idle, 0.05);
  assert.equal(w.land!.meat.length, 0);
});
void test('growth strengthens pounces and grazer bodies withstand more than small prey', () => {
  const w = createLandWorld();
  w.form = 'stalker';
  w.foods = [];
  w.land!.creatures = [];
  const start = huntingStats(w);
  for (let id = 0; id < 2; id++)
    w.land!.meat.push({
      id,
      x: w.player.x,
      y: w.player.y,
      life: 20,
      value: 5,
      species: 'fern',
      eating: 0,
    });
  for (let i = 0; i < 20; i++) stepWorld(w, idle, 0.05);
  assert.equal(w.food, 10);
  assert.equal(w.land!.nutrition, 2);
  assert.ok(huntingStats(w).damage > start.damage);
  assert.ok(huntingStats(w).scale > start.scale);
  const fixtures = createLandWorld().land!.creatures;
  assert.ok(creatureHealth(fixtures[3]) > creatureHealth(fixtures[0]));
});
void test('paused hunts freeze pursuit, pounce, dropped food and digestion', () => {
  const w = createLandWorld();
  w.form = 'stalker';
  w.land!.meat.push({
    id: 0,
    x: w.player.x,
    y: w.player.y,
    life: 20,
    value: 5,
    species: 'fern',
    eating: 0.4,
  });
  w.mode = 'paused';
  const before = structuredClone(w);
  stepWorld(w, { x: 1, y: 0, dash: true, skill: true, sneak: true }, 1);
  assert.deepEqual(w, before);
});
void test('an unnoticed crouched ambush adds impact, and growth is not another birth', () => {
  const damage = (sneak: boolean) => {
    const w = createLandWorld(),
      c = w.land!.creatures[3];
    w.form = 'stalker';
    w.foods = [];
    w.land!.creatures = [c];
    w.player.x = c.x - 100;
    w.player.y = c.y;
    w.player.angle = 0;
    stepWorld(w, { ...idle, sneak, skill: true }, 0.1);
    return creatureHealth(c) - c.health;
  };
  assert.ok(damage(true) > damage(false));
  const w = createLandWorld();
  w.form = 'stalker';
  w.foods = [];
  w.land!.creatures = [];
  const gen = w.generation;
  w.land!.meat.push({
    id: 0,
    x: w.player.x,
    y: w.player.y,
    life: 10,
    eating: 0,
    value: 5,
    species: 'fern',
  });
  for (let i = 0; i < 20; i++) stepWorld(w, idle, 0.05);
  assert.equal(w.generation, gen);
  assert.equal(w.history.length, 0);
});
