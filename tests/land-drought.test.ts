import test from 'node:test';
import assert from 'node:assert/strict';
import * as land from '../app/game/land.ts';
import { stepWorld } from '../app/game/simulation.ts';
import { createCampaignSession } from '../app/game/campaign-session.ts';
import { encodeSave, decodeSave } from '../app/game/campaign-save.ts';
import {
  colonyFromLand,
  colonyInteract,
  COLONY_NEST,
} from '../app/game/colony.ts';

const idle = { x: 0, y: 0, dash: false };
function ready() {
  const w = land.createLandWorld(71);
  w.form = 'strider';
  w.land!.tier = 1;
  w.land!.nests = [0, 1];
  w.land!.discovered = ['fern'];
  w.food = 30;
  // Boundary fixtures intentionally isolate climate effects, not campaign evidence.
  w.foods = [];
  w.land!.creatures = [];
  w.player.energy = 150;
  return w;
}
function wait(w: ReturnType<typeof ready>, seconds: number) {
  for (let i = 0; i < Math.round(seconds * 60); i++) stepWorld(w, idle, 1 / 60);
}
function start(w: ReturnType<typeof ready>) {
  assert.equal(
    typeof land.startLandDrought,
    'function',
    'land has no playable drought yet',
  );
  assert.ok(land.startLandDrought(w));
}
void test('drought is voluntary, cannot be restarted for rewards and freezes when paused or birthing', () => {
  const w = ready();
  assert.equal(w.land!.drought, undefined);
  start(w);
  const event = structuredClone(w.land!.drought);
  assert.equal(land.startLandDrought(w), false);
  w.mode = 'paused';
  wait(w, 15);
  assert.deepEqual(w.land!.drought, event);
  w.mode = 'running';
  w.land!.morph = { from: 'crawler', elapsed: 0, duration: 20 };
  wait(w, 5);
  assert.deepEqual(w.land!.drought, event);
  assert.equal(land.chooseDroughtStrategy(w, 'refuge'), false);
});
void test('dry season shrinks two ponds, preserves the spring and slows wild fruit regrowth', () => {
  const w = ready();
  start(w);
  wait(w, 12.1);
  assert.equal(w.land!.drought!.phase, 'dry');
  Object.assign(w.player, { x: 680, y: 1130 });
  w.land!.moisture = 80;
  w.foods = [{ id: 0, x: 100, y: 100, rich: false, cooldown: 20 }];
  wait(w, 1);
  assert.ok(w.land!.moisture < 80, 'the old pond edge must now be dry');
  assert.ok(w.foods[0].cooldown > 19, 'dry fruit must regenerate more slowly');
  Object.assign(w.player, land.LAND_PONDS[2]);
  const before = w.land!.moisture;
  wait(w, 1);
  assert.ok(w.land!.moisture > before, 'permanent spring stays usable');
});
void test('inherited skin loses less water; shelter never creates free moisture', () => {
  const skin = ready(),
    reservoir = ready();
  for (const w of [skin, reservoir]) {
    start(w);
    wait(w, 12.1);
    Object.assign(w.player, { x: 1350, y: 1500 });
    w.land!.moisture = 80;
  }
  skin.land!.protection = 'skin';
  reservoir.land!.protection = 'reservoir';
  wait(skin, 3);
  wait(reservoir, 3);
  assert.ok(skin.land!.moisture > reservoir.land!.moisture);
  const w = ready();
  start(w);
  assert.ok(land.chooseDroughtStrategy(w, 'refuge'));
  assert.ok(land.interactLand(w));
  wait(w, 12.1);
  const before = w.land!.moisture;
  wait(w, 1);
  assert.ok(
    w.land!.moisture <= before,
    'shade reduces water loss but does not refill it',
  );
});
void test('refuge requires paid construction, actual new food collection and return; transfer is conserved', () => {
  const w = ready();
  start(w);
  assert.ok(land.chooseDroughtStrategy(w, 'refuge'));
  assert.ok(land.interactLand(w));
  assert.equal(w.food, 24);
  assert.equal(land.interactLand(w), false);
  assert.equal(
    land.chooseDroughtStrategy(w, 'migration'),
    false,
    'cannot erase paid construction',
  );
  wait(w, 12.1);
  const home = land.LAND_NESTS[0];
  Object.assign(w.player, { x: home.x + 240, y: home.y });
  w.foods = [0, 1, 2].map((id) => ({
    id,
    x: w.player.x,
    y: w.player.y,
    rich: true,
    cooldown: 0,
  }));
  stepWorld(w, idle, 1 / 60);
  assert.equal(w.food, 27);
  assert.notEqual(w.land!.drought!.phase, 'resolved');
  Object.assign(w.player, home);
  assert.ok(land.interactLand(w));
  assert.equal(
    w.food,
    24,
    'three actually collected foods enter the protected cache',
  );
  assert.equal(w.land!.drought!.phase, 'resolved');
  assert.equal(land.interactLand(w), false, 'same action cannot settle twice');
  w.mode = 'won';
  const colony = colonyFromLand(w)!;
  assert.equal(
    colony.food,
    27,
    'cache transfers once rather than producing a bonus',
  );
  assert.equal(colony.history.at(-1)!.landLegacy!.strategy, 'refuge');
  colony.mode = 'running';
  colony.shelter = true;
  colony.storm = 10;
  colony.integrity = 50;
  colony.wood = 1;
  Object.assign(colony.player, COLONY_NEST);
  assert.ok(colonyInteract(colony));
  assert.equal(colony.wood, 0);
  assert.ok(
    colony.integrity > 70,
    'real shelter experience improves repair, without free wood',
  );
});
void test('migration needs both spring stops in order and food at each, not a route menu reward', () => {
  const w = ready();
  start(w);
  assert.ok(land.chooseDroughtStrategy(w, 'migration'));
  assert.equal(land.interactLand(w), false);
  wait(w, 12.1);
  Object.assign(w.player, land.LAND_PONDS[2]);
  assert.equal(land.interactLand(w), false);
  Object.assign(w.player, land.LAND_PONDS[1]);
  w.food = 1;
  assert.equal(land.interactLand(w), false);
  w.food = 6;
  assert.ok(land.interactLand(w));
  assert.equal(w.food, 4);
  assert.equal(land.interactLand(w), false);
  Object.assign(w.player, land.LAND_PONDS[2]);
  assert.ok(land.interactLand(w));
  assert.equal(w.food, 2);
  assert.equal(w.land!.drought!.phase, 'resolved');
  w.mode = 'won';
  const c = colonyFromLand(w)!;
  assert.equal(c.food, 2);
  assert.equal(c.history.at(-1)!.landLegacy!.strategy, 'migration');
  assert.ok(
    c.patches
      .filter((p) => p.kind === 'food')
      .some((p) => Math.hypot(p.x - 570, p.y - 410) < 200),
  );
});
void test('grove strategy needs a mature plant, real irrigation and two different harvested fruits', () => {
  const w = ready();
  start(w);
  w.land!.seedPod = { stage: 'eaten', nest: null, waters: 0, cooldown: 0 };
  assert.equal(land.chooseDroughtStrategy(w, 'grove'), false);
  w.land!.seedPod = { stage: 'planted', nest: 1, waters: 2, cooldown: 0 };
  assert.ok(land.chooseDroughtStrategy(w, 'grove'));
  Object.assign(w.player, land.seedPlot(w)!);
  assert.equal(land.interactLand(w), false);
  assert.ok(land.applyLandSeed(w, 'water'));
  w.land!.moisture = 60;
  const food = w.food;
  assert.ok(land.interactLand(w));
  assert.equal(w.food, food - 4);
  assert.equal(w.land!.moisture, 35);
  assert.equal(land.interactLand(w), false);
  // Existing real harvest loop records unique mature grove foods, not waiting or a button.
  wait(w, 12.1);
  for (const id of [1000, 1001]) {
    const fruit = w.foods.find((f) => f.id === id)!;
    Object.assign(w.player, fruit);
    stepWorld(w, idle, 1 / 60);
  }
  Object.assign(w.player, land.seedPlot(w)!);
  assert.ok(land.interactLand(w));
  assert.equal(w.land!.drought!.phase, 'resolved');
  w.mode = 'won';
  const c = colonyFromLand(w)!;
  assert.equal(c.food, w.food + 4);
  assert.equal(c.seedLegacy, 'grown');
  assert.equal(c.history.at(-1)!.landLegacy!.strategy, 'grove');
});
void test('drought save resumes paid progress, accepts old land saves and rejects fabricated settlement', () => {
  const w = ready();
  start(w);
  assert.ok(land.chooseDroughtStrategy(w, 'migration'));
  Object.assign(w.player, land.LAND_PONDS[1]);
  assert.ok(land.interactLand(w));
  const session = createCampaignSession();
  Object.assign(session.journey.getWorld(), w);
  const result = decodeSave(encodeSave(session.snapshot('journey')));
  assert.equal(result.kind, 'ok');
  if (result.kind !== 'ok') return;
  const restored = result.save.campaign.journey;
  restored.mode = 'running';
  assert.deepEqual(restored.land!.drought, w.land!.drought);
  assert.equal(
    land.interactLand(restored),
    false,
    'reload does not duplicate a spring stop',
  );
  restored.land!.drought!.phase = 'resolved';
  Object.assign(session.journey.getWorld(), restored);
  assert.throws(() => encodeSave(session.snapshot('journey')), /不能安全保存/);
  delete session.journey.getWorld().land!.drought;
  assert.equal(decodeSave(encodeSave(session.snapshot('journey'))).kind, 'ok');
});
void test('a saved refuge must belong to a real established nest', () => {
  const w = ready();
  start(w);
  assert.ok(land.chooseDroughtStrategy(w, 'refuge'));
  assert.ok(land.interactLand(w));
  w.land!.drought!.nest = 2;
  const session = createCampaignSession();
  Object.assign(session.journey.getWorld(), w);
  assert.throws(() => encodeSave(session.snapshot('journey')), /不能安全保存/);
});
void test('returning to the main quest releases contextual F without undoing paid progress', () => {
  const w = ready();
  start(w);
  assert.ok(land.chooseDroughtStrategy(w, 'refuge'));
  assert.ok(land.interactLand(w));
  assert.ok(land.trackDrought(w, false));
  const neighbor = land.createLandWorld().land!.creatures[0];
  Object.assign(neighbor, w.player);
  w.land!.creatures = [neighbor];
  const food = w.food;
  assert.ok(
    land.interactLand(w),
    'F should share instead of trying to finish the inactive tracked event',
  );
  assert.equal(w.food, food - 2);
  assert.equal(neighbor.friendship, 1);
  assert.equal(w.land!.drought!.built, true);
});
void test('refuge guidance sends the player outside the nest instead of farming uncounted home fruit', () => {
  const w = ready();
  start(w);
  assert.ok(land.chooseDroughtStrategy(w, 'refuge'));
  assert.ok(land.interactLand(w));
  w.foods = [
    { id: 0, ...w.player, cooldown: 0, rich: true },
    { id: 1, x: w.player.x + 240, y: w.player.y, cooldown: 0, rich: true },
  ];
  assert.equal(land.landTarget(w).point.x, w.player.x + 240);
});
