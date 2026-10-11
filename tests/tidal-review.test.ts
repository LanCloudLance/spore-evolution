import test from 'node:test';
import assert from 'node:assert/strict';
import { tidalFixture } from './helpers/tidal-world.ts';
import { createWorld, stepWorld } from '../app/game/simulation.ts';
import { createOceanWorld } from '../app/game/ocean.ts';
import { validTidalState } from '../app/game/tidal/save-guards.ts';
import { tidalGuidance } from '../app/game/tidal/migration.ts';
import { createCampaignSession } from '../app/game/campaign-session.ts';
void test('fresh world replacement clears optional legacy and birth state', () => {
  const w = tidalFixture();
  w.tidalLegacy = {
    id: 'previous',
    refuge: true,
    companions: [],
    diet: ['hunt'],
    entry: 'sheltered',
    generation: 3,
  };
  Object.assign(w, createWorld(71));
  assert.equal(w.tidalLegacy, undefined);
  assert.equal(w.evolution, null);
  Object.assign(w, createOceanWorld(101));
  assert.equal(w.tidalLegacy, undefined);
  const session = createCampaignSession();
  session.journey.getWorld().tidalLegacy = {
    id: 'previous',
    refuge: true,
    companions: [],
    diet: ['hunt'],
    entry: 'sheltered',
    generation: 3,
  };
  session.restore(createCampaignSession().snapshot('journey'));
  assert.equal(session.journey.getWorld().tidalLegacy, undefined);
  assert.equal(
    Object.hasOwn(session.snapshot('journey').journey, 'tidalLegacy'),
    false,
  );
});
void test('malformed way destinations reject save validation and cannot crash the live loop', () => {
  const w = createOceanWorld(23),
    t = w.ocean!.tidal!;
  const ribbon = t.actors.find((a) => a.species === 'ribbonfish')!;
  ribbon.targetId = 'way:unknown';
  assert.equal(validTidalState(t), false);
  assert.doesNotThrow(() => stepWorld(w, { x: 0, y: 0, dash: false }, 0.05));
});
void test('hunter qualification points to actual edible prey rather than loose particles', () => {
  const w = tidalFixture({ mature: true, organs: ['jaw'] });
  const t = w.ocean!.tidal!;
  t.migration.startedTick = 1;
  t.migration.visited = ['reef', 'drift'];
  w.food = 5;
  t.actors = [
    {
      id: 'dart',
      species: 'silver-dart',
      homeBiome: 'nursery',
      x: 600,
      y: 1750,
      radius: 9,
      angle: 0,
      hunger: 45,
      health: 100,
      behavior: 'forage',
      targetId: null,
      phaseSeconds: 0,
      respawnSeconds: 0,
      trust: 0,
      carryingId: null,
    },
  ];
  const goal = tidalGuidance(w)!;
  assert.match(goal.label, /捕食|追猎/);
  assert.deepEqual(goal.point, { x: 600, y: 1750 });
  t.actors[0].health = 0;
  assert.notDeepEqual(tidalGuidance(w)!.point, { x: 600, y: 1750 });
});
