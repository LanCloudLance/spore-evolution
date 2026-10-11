import test from 'node:test';
import assert from 'node:assert/strict';
import { createLandWorld } from '../app/game/land.ts';
import { createWorld } from '../app/game/simulation.ts';
import { beginGuidedAction } from '../app/game/evolution-navigation.ts';
import { createOceanWorld } from '../app/game/ocean.ts';
import { tidalGuidance } from '../app/game/tidal/migration.ts';
import { tidalIntent } from '../app/game/tidal/behavior.ts';
import { shareTidalNutrition } from '../app/game/tidal/ecology.ts';
import { stepWorld } from '../app/game/simulation.ts';
const guidance = await import('../app/game/life-guidance.ts').catch(() => null);
const marineReceipt = (w: ReturnType<typeof createOceanWorld>) =>
  w.dnaLineage?.sources['sea:silver-dart'];
void test('a sharing source guide first finds real unreserved nutrition, then tracks the living recipient', () => {
  assert.ok(guidance);
  const w = createOceanWorld(41);
  w.food = 0;
  const before = structuredClone(w),
    supply = guidance.biologicalSourceGuide(w, 'ocean:shellrunner')!;
  assert.ok(supply.destination.foodId);
  assert.ok(w.ocean!.tidal!.foods.some(f => f.id === supply.destination.foodId && f.state === 'available' && !f.reservedFor));
  assert.deepEqual(w, before, 'a guide cannot grant nutrition or source DNA');
  w.food = 1;
  const recipient = guidance.biologicalSourceGuide(w, 'ocean:shellrunner')!;
  assert.ok(recipient.destination.oceanActorId);
  assert.equal(recipient.destination.oceanIntent, 'visit');
});
void test('the selected land organ follows a real matching provider instead of the nearest unrelated animal', () => {
  assert.ok(guidance);
  const w = createLandWorld(41),
    before = structuredClone(w.dnaLineage);
  const g = guidance.biologicalSourceGuide(w, 'landpart:burrow')!;
  assert.ok(
    ['burrow-mole', 'shell-grazer'].includes(
      w.land!.creatures.find((c) => c.id === g.destination.landCreatureId)!
        .species,
    ),
  );
  assert.deepEqual(w.dnaLineage, before);
  const n = beginGuidedAction(w, g.destination)!;
  const c = w.land!.creatures.find((c) => c.id === n.landCreatureId)!;
  c.respawn = 10;
  assert.equal(guidance.refreshLandSource(w, n), false);
});
void test('a slow inherited armored body can offer real food before the fish enters its flight radius (distance fixture)', () => {
  const w = createOceanWorld(41),
    a = w.ocean!.tidal!.actors.find((a) => a.species === 'silver-dart')!;
  w.traits = ['shell', 'vacuole'];
  w.food = 2;
  w.ocean!.tidal!.actors = [a];
  Object.assign(a, { x: w.player.x + 165, y: w.player.y });
  assert.ok(shareTidalNutrition(w));
  assert.equal(w.food, 1);
  assert.equal(w.dnaLineage?.sources['sea:silver-dart'], undefined);
  for (let i = 0; i < 100 && !marineReceipt(w); i++)
    stepWorld(w, { x: 0, y: 0, dash: false }, 0.05);
  assert.ok(marineReceipt(w)?.methods?.symbiosis);
});
void test('a mature low-energy body seeks real unreserved food before a long migration', () => {
  const w = createOceanWorld(41);
  w.form = 'fish';
  w.ocean!.tier = 2;
  w.player.energy = 15;
  const goal = tidalGuidance(w)!;
  assert.equal(goal.label, '寻找补给');
  assert.ok(
    w.ocean!.tidal!.foods.some(
      (f) =>
        f.state === 'available' &&
        !f.reservedFor &&
        f.x === goal.point.x &&
        f.y === goal.point.y,
    ),
  );
});
void test('glowing organs have a real detection tradeoff with nearby marine predators', () => {
  const w = createOceanWorld(41),
    a = w.ocean!.tidal!.actors.find((a) => a.species === 'crested-hunter')!;
  assert.ok(a);
  w.ocean!.tidal!.actors = [a];
  Object.assign(w.player, { x: 1300, y: 1600 });
  Object.assign(a, { x: 1540, y: 1600, hunger: 90 });
  tidalIntent(w, a, 0.05);
  assert.notEqual(a.targetId, 'player');
  delete w.ocean!.body.placements;
  w.ocean!.body.organs.left = 'glow';
  tidalIntent(w, a, 0.05);
  assert.equal(a.targetId, 'player');
});
void test('pond source guidance visits the required organism for observation and preserves explicit hunting as a choice', () => {
  assert.ok(guidance);
  const w = createWorld(41);
  w.mode = 'paused';
  const g = guidance.biologicalSourceGuide(w, 'pond:grazer')!;
  assert.equal(
    w.pondLife!.prey.find((p) => p.id === g.destination.preyId)!.species,
    'feather',
  );
  assert.equal(g.destination.pondIntent, 'visit');
  const n = beginGuidedAction(w, g.destination)!;
  assert.equal(n.pondIntent, 'visit');
  assert.equal(
    guidance.biologicalSourceGuide(w, 'pond:grazer', 'hunt')!.destination
      .pondIntent,
    'hunt',
  );
});
