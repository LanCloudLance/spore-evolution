import test from 'node:test';
import { decodeSave, encodeSave } from '../app/game/campaign-save.ts';
import assert from 'node:assert/strict';
import { createShoreWorld } from '../app/game/shore.ts';
import {
  createLandWorld,
  enterLand,
  retryLand,
  LAND_NESTS,
  landEvolutionGate,
  evolveLand,
  interactLand,
  landSkill,
  landStats,
} from '../app/game/land.ts';
import { stepWorld } from '../app/game/simulation.ts';
const idle = { x: 0, y: 0, dash: false };
void test('shore completion preserves actual anatomy, adaptation and lineage; retry restores entry snapshot', () => {
  const w = createShoreWorld(61);
  assert.equal(enterLand(w), false);
  w.mode = 'won';
  w.form = 'skipper';
  w.generation = 6;
  w.shore!.protection = 'reservoir';
  w.shore!.body.organs.tail = 'spine';
  w.shore!.body.length = 1.4;
  w.traits = ['shell', 'vacuole'];
  w.history = [
    {
      generation: 5,
      food: 18,
      seconds: 40,
      form: 'jelly',
      traits: ['shell'],
      habitat: 'ocean',
    },
  ];
  const body = structuredClone(w.shore!.body),
    history = structuredClone(w.history);
  assert.ok(enterLand(w));
  assert.equal(w.habitat, 'land');
  assert.equal(w.shore, null);
  assert.equal(w.ocean, null);
  assert.deepEqual(w.land!.body, body);
  assert.deepEqual(w.history, history);
  assert.equal(w.land!.protection, 'reservoir');
  assert.equal(w.generation, 6);
  w.land!.body.length = 1;
  w.history.push({ generation: 6, food: 1, seconds: 2, traits: [] });
  const r = retryLand(w);
  assert.deepEqual(r.land!.body, body);
  assert.deepEqual(r.history, history);
  assert.equal(r.generation, 6);
});
void test('nest costs are gated, charged once and cannot bypass settlement milestones', () => {
  const w = createLandWorld();
  w.food = 5;
  assert.equal(interactLand(w), false);
  w.food = 20;
  assert.ok(interactLand(w));
  assert.equal(w.food, 14);
  assert.equal(interactLand(w), false);
  assert.equal(w.food, 14);
  assert.equal(w.land!.nests.length, 1);
  Object.assign(w.player, LAND_NESTS[2]);
  assert.equal(interactLand(w), false);
  assert.equal(w.mode, 'running');
  assert.equal(w.food, 14);
});
void test('birth requires observation, food and established nest; second organ preserves body and provides a real tradeoff', () => {
  const w = createLandWorld();
  w.food = 40;
  interactLand(w);
  assert.match(landEvolutionGate(w), /观察/);
  w.land!.discovered = ['fern'];
  w.player.x += 500;
  assert.match(landEvolutionGate(w), /巢穴/);
  Object.assign(w.player, LAND_NESTS[0]);
  assert.ok(evolveLand(w, 'strider'));
  assert.equal(w.form, 'strider');
  assert.equal(w.generation, 2);
  assert.equal(w.food, 24);
  assert.equal(w.history[0].form, 'crawler');
  assert.equal(evolveLand(w, 'plates'), false);
  stepWorld(w, idle, w.evolution!.duration + 0.1);
  w.land!.discovered.push('grazer');
  const speed = landStats(w).speed,
    damage = landStats(w).damage;
  assert.ok(evolveLand(w, 'plates'));
  assert.equal(w.form, 'strider');
  assert.equal(w.land!.organ, 'plates');
  assert.equal(landStats(w).speed, speed * 0.88);
  assert.equal(landStats(w).damage, damage * 0.6);
  assert.equal(w.generation, 3);
});
void test('sharing respects proximity, cooldown, food, and bonded creatures cannot be hunted', () => {
  const w = createLandWorld(),
    c = w.land!.creatures[0];
  w.form = 'stalker';
  w.food = 10;
  w.player.x = c.x - 40;
  w.player.y = c.y;
  assert.ok(interactLand(w));
  assert.equal(w.food, 8);
  assert.equal(interactLand(w), false);
  c.trustCooldown = 0;
  assert.ok(interactLand(w));
  c.trustCooldown = 0;
  assert.ok(interactLand(w));
  assert.equal(c.joined, true);
  w.land!.creatures = [c];
  w.player.angle = 0;
  assert.equal(landSkill(w), false);
  assert.equal(w.land!.hunts, 0);
  assert.equal(c.health, 60);
});
void test('strider call can befriend without kills; crest lowers food cost and extends reach', () => {
  const w = createLandWorld(),
    c = w.land!.creatures[0];
  w.form = 'strider';
  w.land!.creatures = [c];
  w.player.x = c.x - 260;
  w.player.y = c.y;
  assert.ok(landSkill(w));
  assert.equal(c.friendship, 0);
  w.land!.skillCooldown = 0;
  w.land!.organ = 'crest';
  assert.ok(landSkill(w));
  assert.equal(c.friendship, 1);
  w.food = 1;
  w.player.x = c.x - 50;
  c.trustCooldown = 0;
  assert.ok(interactLand(w));
  assert.equal(w.food, 0);
  assert.equal(c.friendship, 2);
  assert.equal(w.land!.hunts, 0);
});
void test('pounce has a facing/range gate, requires contact and eating, and prey renews', () => {
  const w = createLandWorld(),
    c = w.land!.creatures[0];
  w.land!.creatures = [c];
  w.foods = [];
  w.form = 'stalker';
  w.player.x = c.x - 100;
  w.player.y = c.y;
  w.player.angle = Math.PI;
  assert.equal(landSkill(w), false);
  w.player.angle = 0;
  assert.ok(landSkill(w));
  assert.equal(w.food, 0);
  assert.equal(c.health, 60);
  for (let i = 0; i < 100; i++) {
    const meal = w.land!.meat[0],
      d = meal ? Math.hypot(meal.x - w.player.x, meal.y - w.player.y) : 0;
    stepWorld(
      w,
      {
        x: meal && d > 20 ? (meal.x - w.player.x) / d : 0,
        y: meal && d > 20 ? (meal.y - w.player.y) / d : 0,
        dash: false,
      },
      0.05,
    );
  }
  assert.equal(w.food, 5);
  assert.equal(w.land!.hunts, 1);
  assert.equal(w.land!.biomass, 5);
  assert.equal(landSkill(w), false);
  assert.equal(w.food, 5);
  stepWorld(w, idle, 1 / 60);
  assert.equal(w.land!.hunts, 1);
  for (let i = 0; i < 540; i++) stepWorld(w, idle, 0.05);
  assert.equal(c.respawn, 0);
  assert.equal(c.health, 60);
});
void test('pause and morph freeze interactions; resting, shade and water recover resources', () => {
  const w = createLandWorld();
  w.mode = 'paused';
  const before = structuredClone(w);
  stepWorld(w, { ...idle, skill: true, interact: true }, 1);
  assert.deepEqual(w, before);
  assert.equal(interactLand(w), false);
  assert.equal(landSkill(w), false);
  w.mode = 'running';
  w.food = 6;
  interactLand(w);
  w.player.health = 50;
  w.player.energy = 30;
  w.land!.moisture = 20;
  stepWorld(w, idle, 1);
  assert.ok(w.player.health > 50);
  assert.ok(w.player.energy > 30);
  assert.ok(w.land!.moisture > 20);
  w.land!.morph = { from: 'crawler', elapsed: 0, duration: 2 };
  const food = w.food;
  stepWorld(w, { x: 1, y: 0, dash: true, skill: true, interact: true }, 0.1);
  assert.equal(w.food, food);
  assert.equal(w.player.x, LAND_NESTS[0].x);
});
void test('inherited directional spines block hunter contact only on their side', () => {
  for (const facing of [0, Math.PI]) {
    const w = createLandWorld(),
      c = w.land!.creatures.find((c) => c.species === 'hunter')!;
    w.land!.creatures = [c];
    w.foods = [];
    w.player.x = c.x - 30;
    w.player.y = c.y;
    w.player.angle = facing;
    w.land!.body.organs = { front: 'spine' };
    stepWorld(w, idle, 0.05);
    assert.equal(w.player.health, facing === 0 ? 100 : 80);
  }
});
void test('movement and continuous energy costs agree across frame rates', () => {
  const results = [30, 60, 120].map((fps) => {
    const w = createLandWorld();
    w.foods = [];
    w.land!.creatures = [];
    for (let i = 0; i < fps * 2; i++)
      stepWorld(w, { x: 1, y: 0, dash: false }, 1 / fps);
    return w;
  });
  assert.ok(Math.abs(results[0].player.x - results[2].player.x) < 0.01);
  assert.ok(
    Math.abs(results[0].player.energy - results[2].player.energy) < 0.01,
  );
});
void test('settlement works after the first birth without buying an optional organ', () => {
  const w = createLandWorld();
  w.food = 16;
  assert.ok(interactLand(w));
  w.land!.discovered = ['fern'];
  assert.ok(evolveLand(w, 'strider'));
  stepWorld(w, idle, w.evolution!.duration + 0.1);
  w.land!.visited = ['蕨叶聚落', '日光果甸'];
  w.land!.creatures[0].joined = true;
  w.land!.creatures[1].joined = true;
  w.food = 12;
  Object.assign(w.player, LAND_NESTS[2]);
  assert.ok(interactLand(w));
  assert.equal(w.mode, 'won');
  assert.equal(w.land!.organ, null);
  assert.equal(w.food, 0);
});
void test('only earned shore companions migrate, keep their identity on retry, and cannot substitute for observing land species', () => {
  const w = createShoreWorld(71);
  const allies = w
    .shore!.creatures.filter((c) => c.role === 'ally')
    .slice(0, 2);
  allies.forEach((c) => {
    c.joined = true;
  });
  const ids = allies.map((c) => c.id);
  w.mode = 'won';
  assert.ok(enterLand(w));
  const saved = decodeSave(
    encodeSave({ journey: w, colony: null, active: 'journey' }),
  );
  assert.equal(saved.kind, 'ok');
  if (saved.kind !== 'ok') throw new Error('save roundtrip failed');
  assert.deepEqual(
    saved.save.campaign.journey.land!.checkpoint.shoreCompanions,
    ids,
  );
  const migrants = w.land!.creatures.filter((c) => c.joined);
  assert.deepEqual(
    migrants.map((c) => c.shoreOrigin),
    ids,
  );
  assert.equal(
    new Set(w.land!.creatures.map((c) => c.id)).size,
    w.land!.creatures.length,
  );
  for (let i = 0; i < 150; i++) stepWorld(w, idle, 1 / 60);
  assert.deepEqual(w.land!.discovered, []);
  w.land!.creatures.find((c) => c.joined)!.joined = false;
  assert.deepEqual(
    retryLand(w)
      .land!.creatures.filter((c) => c.joined)
      .map((c) => c.shoreOrigin),
    ids,
  );
  const alone = createShoreWorld(71);
  alone.mode = 'won';
  assert.ok(enterLand(alone));
  assert.equal(alone.land!.creatures.filter((c) => c.joined).length, 0);
});
