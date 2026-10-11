import test from 'node:test';
import assert from 'node:assert/strict';
import * as tribe from '../app/game/tribe.ts';
import { createColonyWorld } from '../app/game/colony.ts';
import { runColony } from './helpers/campaign-route.ts';
import { collectTribe, walkTribe } from './helpers/tribe-route.ts';
import { civilizationFromTribe } from '../app/game/civilization.ts';
import { runCity } from './helpers/city-route.ts';

void test('a real family can establish a workshop society without invented allies and continue through civilization', () => {
  assert.equal(typeof tribe.chooseTribeOrganization, 'function');
  const colony = createColonyWorld();
  colony.mode = 'running';
  runColony(colony);
  const s = tribe.tribeFromColony(colony)!;
  s.mode = 'running';
  assert.ok(tribe.chooseTribeOrganization(s, 'workshop'));
  walkTribe(s, tribe.TRIBE_COUNCIL);
  assert.equal(tribe.tribeInteract(s), false); // A route button cannot build a camp.
  for (const tool of ['basket', 'hammer'] as const) {
    for (const [kind, count] of Object.entries(tribe.TOOL_COST[tool]))
      collectTribe(s, kind as tribe.Material, count);
    walkTribe(s, tribe.TRIBE_HOME);
    assert.ok(tribe.craftTribeTool(s, tool));
  }
  for (const [kind, count] of Object.entries(tribe.WORKSHOP_CAMP_COST))
    collectTribe(s, kind as tribe.Material, count);
  walkTribe(s, tribe.TRIBE_COUNCIL);
  assert.ok(tribe.tribeInteract(s), s.notice);
  assert.equal(tribe.chooseTribeOrganization(s, 'network'), false);
  collectTribe(s, 'wood', 9);
  collectTribe(s, 'stone', 6);
  for (const m of s.members) assert.ok(tribe.setTribeRole(s, m.id, 'escort'));
  walkTribe(s, tribe.TRIBE_COUNCIL);
  assert.ok(tribe.startTribeStorm(s));
  for (const b of s.banks) {
    walkTribe(s, b);
    assert.ok(tribe.tribeInteract(s));
    for (let i = 0; i < 240 && b.work < 6; i++)
      tribe.stepTribe(s, { x: 0, y: 0 }, 0.05);
    assert.equal(b.work, 6);
  }
  walkTribe(s, tribe.TRIBE_COUNCIL);
  assert.ok(tribe.tribeInteract(s), s.notice);
  assert.equal(s.mode, 'won');
  assert.equal(tribe.tribeAllies(s), 0);
  assert.ok(s.choices.includes('society:workshop'));
  const city = civilizationFromTribe(s)!;
  assert.ok(city);
  assert.equal(city.couriers.length, s.members.length + 1);
  assert.ok(city.couriers.every((c) => !['moss', 'reed'].includes(c.id)));
  runCity(city, 'fuel');
  assert.equal(city.mode, 'won');
});
