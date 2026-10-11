import { createOceanWorld, enterOcean } from './helpers/legacy-ocean.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, getStats, stepWorld } from '../app/game/simulation.ts';
import { retryOcean, evolveOcean, oceanEvolutionGate, stepOcean, OCEAN_NURSERY, OCEAN_HAVEN, OCEAN_ROCKS } from '../app/game/ocean.ts';
const idle = { x: 0, y: 0, dash: false };
function eligible() {
  const w = createOceanWorld(9);
  w.mode = 'running';
  w.food = 10;
  w.player.energy = 120;
  if (w.ocean) {
    w.ocean.visited = ['海草育生地', '透光浮游区'];
    w.ocean.morph = null;
  }
  return w;
}
void test('pond completion enters an ocean body and preserves lineage without inventing ancestors', () => {
  const w = createWorld();
  assert.equal(enterOcean(w), false);
  w.mode = 'won';
  w.generation = 3;
  w.traits = ['shell', 'cilia'];
  w.totalFood = 27;
  w.history = [
    { generation: 3, traits: ['shell', 'cilia'], food: 10, seconds: 70 },
  ];
  assert.equal(enterOcean(w), true);
  assert.equal(w.habitat, 'ocean');
  assert.equal(w.form, 'colony');
  assert.equal(w.generation, 4);
  assert.deepEqual(w.traits, ['shell', 'cilia']);
  assert.equal(w.history.length, 1);
  assert.equal(w.totalFood, 27);
  assert.equal(enterOcean(w), false);
});
void test('standalone ocean starts a fresh documented lineage', () => {
  const w = createOceanWorld();
  assert.equal(w.habitat, 'ocean');
  assert.equal(w.form, 'colony');
  assert.equal(w.generation, 1);
  assert.equal(w.history.length, 0);
  assert.equal(w.ocean?.checkpoint.standalone, true);
});
void test('ocean body statistics have distinct movement and feeding tradeoffs', () => {
  assert.ok(getStats([], 'fish').speed > getStats([], 'jelly').speed);
  assert.ok(getStats([], 'jelly').pickup > getStats([], 'fish').pickup);
  assert.ok(getStats(['shell'], 'fish').speed < getStats([], 'fish').speed);
});
void test('body evolution requires food, energy, exploration and the nursery', () => {
  const w = createOceanWorld();
  w.mode = 'running';
  assert.notEqual(oceanEvolutionGate(w), '');
  assert.equal(evolveOcean(w, 'radial', 'cilia'), false);
  w.food = 10;
  w.player.energy = 120;
  assert.notEqual(oceanEvolutionGate(w), '');
  if (w.ocean) w.ocean.visited.push('透光浮游区');
  assert.equal(oceanEvolutionGate(w), '');
  w.player.x = 1600;
  assert.notEqual(oceanEvolutionGate(w), '');
});
void test('shape changes are births and cannot skip early development; later descendants can change branches', () => {
  const w = eligible();
  assert.equal(evolveOcean(w, 'fish', 'shell'), false);
  assert.equal(evolveOcean(w, 'radial', 'cilia'), true);
  assert.equal(w.form, 'radial');
  assert.equal(w.generation, 2);
  assert.equal(w.history[0].form, 'colony');
  assert.deepEqual(w.traits, ['cilia']);
  assert.equal(w.ocean?.morph?.from, 'colony');
  if (w.ocean) {
    w.ocean.morph = null;
    w.ocean.visited.push('珊瑚礁缘', '洋流走廊');
  }
  w.food = 14;
  w.player.energy = 120;
  assert.equal(evolveOcean(w, 'fish', 'shell'), true);
  assert.equal(w.form, 'fish');
  assert.equal(w.ocean!.branch, 'bilateral');
  assert.equal(w.generation, 3);
  assert.equal(evolveOcean(w, 'jelly'), false); // A reveal cannot be skipped for another birth.
  assert.deepEqual(w.traits, ['cilia', 'shell']);
});
void test('paused body transition stays frozen, then resumes without moving the player', () => {
  const w = eligible();
  evolveOcean(w, 'bilateral', 'flagellum');
  w.mode = 'paused';
  const before = structuredClone(w);
  stepWorld(w, { x: 1, y: 1, dash: true }, 0.05);
  assert.deepEqual(w, before);
  w.mode = 'running';
  const x = w.player.x;
  stepWorld(w, { x: 1, y: 1, dash: true }, 0.05);
  assert.equal(w.player.x, x);
  assert.ok((w.ocean?.morph?.elapsed ?? 0) > 0);
});
void test('skill consumes energy once per cooldown and protects the colony', () => {
  const w = createOceanWorld();
  w.mode = 'running';
  w.player.invulnerable = 0;
  const before = w.player.energy;
  stepOcean(w, { ...idle, skill: true }, 0.05);
  assert.ok(w.player.energy < before - 13);
  assert.ok(w.player.invulnerable > 1);
  const after = w.player.energy;
  stepOcean(w, { ...idle, skill: true }, 0.05);
  assert.ok(w.player.energy > after - 1);
});
void test('reef collision pushes a live body outside the solid rock', () => {
  const w = createOceanWorld();
  w.mode = 'running';
  const rock = OCEAN_ROCKS[0];
  w.player.x = rock.x + 3;
  w.player.y = rock.y;
  stepOcean(w, idle, 0.05);
  assert.ok(
    Math.hypot(w.player.x - rock.x, w.player.y - rock.y) >= rock.radius + 25,
  );
});
void test('only a mature, nourished form with a completed migration may settle', () => {
  const w = createOceanWorld();
  w.mode = 'running';
  w.player.x = OCEAN_HAVEN.x;
  w.player.y = OCEAN_HAVEN.y;
  stepOcean(w, idle, 0.05);
  assert.equal(w.mode, 'running');
  w.form = 'fish';
  if (w.ocean) {
    w.ocean.tier = 2;
    w.ocean.morph = null;
  }
  w.food = 8;
  stepOcean(w, idle, 0.05);
  assert.equal(w.mode, 'running');
  // Boundary fixture for the final gate; ocean-journey earns both migration legs.
  w.ocean!.migration = {
    route: 'hunt',
    station: 2,
    progress: 0,
    expanded: false,
    elapsed: 30,
    arrived: false,
    legs: ['hunt', 'hunt'],
  };
  stepOcean(w, idle, 0.05);
  assert.equal(w.mode, 'won');
});
void test('ocean retry preserves only the entry checkpoint', () => {
  const w = eligible();
  evolveOcean(w, 'radial', 'shell');
  const retry = retryOcean(w);
  assert.equal(retry.form, 'colony');
  assert.deepEqual(retry.traits, []);
  assert.equal(retry.generation, 1);
  assert.equal(retry.history.length, 0);
  assert.equal(retry.player.x, OCEAN_NURSERY.x);
});
