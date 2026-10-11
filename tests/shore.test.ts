import { createOceanWorld } from './helpers/legacy-ocean.ts';
import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorld, stepWorld, distance } from '../app/game/simulation.ts';
import {
  createShoreWorld,
  enterShore,
  retryShore,
  stepShore,
  wetAt,
  SHORE_POOLS,
  SHORE_SPECIMENS,
  shoreEvolutionGate,
  evolveShore,
  shoreStats,
  poolRadius,
  interactShore,
} from '../app/game/shore.ts';
const idle = { x: 0, y: 0, dash: false };
void test('only a completed ocean world can land, preserving the exact marine body and true ancestry', () => {
  assert.equal(enterShore(createWorld()), false);
  const w = createOceanWorld(23);
  assert.equal(enterShore(w), false);
  w.mode = 'won';
  w.form = 'jelly';
  w.generation = 4;
  w.traits = ['shell'];
  w.ocean!.body.length = 1.4;
  w.ocean!.body.organs.tail = 'spine';
  w.ocean!.biomass = 70;
  w.history = [
    {
      generation: 4,
      form: 'jelly',
      habitat: 'ocean',
      traits: ['shell'],
      food: 8,
      seconds: 100,
    },
  ];
  const body = structuredClone(w.ocean!.body),
    history = structuredClone(w.history);
  assert.ok(enterShore(w));
  assert.equal(w.habitat, 'shore');
  assert.equal(w.form, 'jelly');
  assert.equal(w.generation, 4);
  assert.deepEqual(w.shore!.body, body);
  assert.deepEqual(w.history, history);
  assert.equal(w.shore!.biomass, 70);
  assert.equal(w.ocean, null);
  assert.equal(enterShore(w), false);
});
void test('standalone landfall has no fabricated ocean history and retry restores its checkpoint', () => {
  const w = createShoreWorld(9);
  assert.deepEqual(w.history, []);
  assert.ok(w.shore!.checkpoint.standalone);
  w.shore!.tier = 1;
  w.form = 'crawler';
  w.shore!.visited.push('test');
  w.shore!.body.length = 1.5;
  w.generation++;
  const retry = retryShore(w);
  assert.equal(retry.form, 'fish');
  assert.equal(retry.generation, 1);
  assert.equal(retry.shore!.body.length, 1);
});
void test('dry land consumes moisture, water restores it, and paused simulation freezes tide and resources', () => {
  const w = createShoreWorld();
  w.player.x = 800;
  w.player.y = 600;
  w.foods = [];
  w.shore!.creatures = [];
  assert.equal(wetAt(w, w.player), false);
  const moisture = w.shore!.moisture;
  stepWorld(w, idle, 0.05);
  assert.ok(w.shore!.moisture < moisture);
  w.player.x = SHORE_POOLS[0].x;
  w.player.y = SHORE_POOLS[0].y;
  stepWorld(w, idle, 0.05);
  assert.ok(w.shore!.moisture >= moisture);
  w.mode = 'paused';
  const before = structuredClone(w);
  stepWorld(w, { x: 1, y: 0, dash: true, skill: true, interact: true }, 0.05);
  assert.deepEqual(w, before);
});
void test('tide changes the same pool boundary used by survival', () => {
  const w = createShoreWorld();
  const pool = SHORE_POOLS[1];
  w.time = 17.5;
  const high = poolRadius(w, pool);
  w.time = 52.5;
  const low = poolRadius(w, pool);
  assert.ok(high > low);
  const p = { x: pool.x + (high + low) / 2, y: pool.y };
  assert.equal(wetAt(w, p), false);
  w.time = 17.5;
  assert.equal(wetAt(w, p), true);
});
void test('adaptation requires discovery, food and recovery in a pool and records a real birth', () => {
  const w = createShoreWorld();
  assert.ok(shoreEvolutionGate(w));
  assert.equal(evolveShore(w, 'crawler'), false);
  w.food = 8;
  w.shore!.discovered = ['support'];
  w.player.energy = 100;
  w.shore!.moisture = 100;
  assert.equal(shoreEvolutionGate(w), '');
  assert.equal(evolveShore(w, 'skin'), false);
  assert.ok(evolveShore(w, 'crawler'));
  assert.equal(w.form, 'crawler');
  assert.equal(w.generation, 2);
  assert.equal(w.history[0].form, 'fish');
  assert.equal(w.food, 0);
  assert.equal(evolveShore(w, 'skipper'), false);
  w.shore!.morph = null;
  w.food = 12;
  w.shore!.discovered.push('moisture');
  w.shore!.visited.push(SHORE_POOLS[2].name);
  assert.ok(evolveShore(w, 'reservoir'));
  assert.equal(w.shore!.tier, 2);
  assert.equal(shoreStats(w).maxMoisture, 150);
});
void test('support legs favor land speed while damp pads favor moisture and swimming', () => {
  const a = createShoreWorld(),
    b = createShoreWorld();
  a.form = 'crawler';
  b.form = 'skipper';
  const sa = shoreStats(a),
    sb = shoreStats(b);
  assert.ok(sa.landSpeed > sb.landSpeed);
  assert.ok(sa.waterSpeed < sb.waterSpeed);
  assert.ok(sa.dryRate > sb.dryRate);
});
void test('observation unlocks support after two seconds and companion food is charged only once', () => {
  const w = createShoreWorld();
  w.player.x = SHORE_SPECIMENS[0].x;
  w.player.y = SHORE_SPECIMENS[0].y;
  for (let i = 0; i < 41; i++) stepShore(w, idle, 0.05);
  assert.ok(w.shore!.discovered.includes('support'));
  const ally = w.shore!.creatures.find((c) => c.role === 'ally')!;
  w.player.x = ally.x;
  w.player.y = ally.y;
  w.food = 1;
  assert.equal(interactShore(w), false);
  w.food = 4;
  assert.ok(interactShore(w));
  assert.equal(w.food, 2);
  assert.equal(interactShore(w), false);
  assert.equal(w.food, 2);
  const x = ally.x;
  w.player.x += 130;
  stepShore(w, idle, 0.05);
  assert.ok(ally.x > x);
  assert.ok(distance(w.player, ally) < 131);
});
void test('dryness can end the journey and terminal worlds never continue simulating', () => {
  const w = createShoreWorld();
  w.player.x = 800;
  w.player.y = 600;
  w.shore!.moisture = 0;
  w.player.health = 0.1;
  w.foods = [];
  stepShore(w, idle, 0.05);
  assert.equal(w.mode, 'dead');
  assert.equal(w.reason, '身体失水');
  const before = structuredClone(w);
  stepShore(w, idle, 0.05);
  assert.deepEqual(w, before);
});

void test('guardians only pursue inside their territory, and Q spends energy once then repels them', () => {
  const w = createShoreWorld();
  const guardian = w.shore!.creatures.find((c) => c.role === 'guardian')!;
  w.shore!.creatures = [guardian];
  w.foods = [];
  w.player.invulnerable = 0;
  w.player.x = guardian.home.x + 270;
  w.player.y = guardian.home.y;
  stepShore(w, idle, 0.01);
  assert.equal(guardian.alert, false);
  w.player.x = guardian.home.x + 170;
  stepShore(w, idle, 0.01);
  assert.equal(guardian.alert, true);
  guardian.x = w.player.x - 55;
  guardian.y = w.player.y;
  guardian.stun = 0;
  const energy = w.player.energy,
    health = w.player.health;
  stepShore(w, { ...idle, skill: true }, 0.01);
  assert.ok(w.player.energy < energy - 11);
  assert.ok(guardian.stun > 0);
  assert.equal(w.player.health, health);
  const after = w.player.energy;
  stepShore(w, { ...idle, skill: true }, 0.01);
  assert.ok(w.player.energy > after - 1);
});
void test('a close companion reduces a guardian hit while rivals consume food without crediting the player', () => {
  const hit = (company: boolean) => {
    const w = createShoreWorld();
    w.foods = [];
    w.player.x = 1340;
    w.player.y = 1450;
    w.player.invulnerable = 0;
    const guard = w.shore!.creatures.find((c) => c.role === 'guardian')!;
    guard.x = w.player.x + 10;
    guard.y = w.player.y;
    const ally = w.shore!.creatures.find((c) => c.role === 'ally')!;
    ally.x = w.player.x - 70;
    ally.y = w.player.y;
    ally.joined = company;
    w.shore!.creatures = [guard, ally];
    stepShore(w, idle, 0.01);
    return w.player.health;
  };
  assert.ok(hit(true) > hit(false));
  const w = createShoreWorld();
  const rival = w.shore!.creatures.find((c) => c.role === 'rival')!;
  w.shore!.creatures = [rival];
  w.foods = [{ id: 99, x: rival.x, y: rival.y, cooldown: 0, rich: false }];
  stepShore(w, idle, 0.01);
  assert.ok(w.foods[0].cooldown > 0);
  assert.equal(w.food, 0);
});
void test('skin reduces water loss with an energy tradeoff, while the reservoir raises only water capacity', () => {
  const w = createShoreWorld();
  w.form = 'crawler';
  const base = shoreStats(w);
  w.shore!.protection = 'skin';
  const skin = shoreStats(w);
  assert.ok(skin.dryRate < base.dryRate);
  assert.ok(skin.metabolism > base.metabolism);
  w.shore!.protection = 'reservoir';
  const reservoir = shoreStats(w);
  assert.equal(reservoir.dryRate, base.dryRate);
  assert.equal(reservoir.metabolism, base.metabolism);
  assert.equal(reservoir.maxMoisture, 150);
});
