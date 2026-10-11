import { enterOcean } from './helpers/legacy-ocean.ts';
import {
  spaceFromCivilization,
  completeJourney,
  expeditionRecord,
} from '../app/game/space.ts';
import { runSpace } from './helpers/space-route.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../app/game/simulation.ts';

import { enterShore } from '../app/game/shore.ts';
import { enterLand } from '../app/game/land.ts';
import { colonyFromLand } from '../app/game/colony.ts';
import { tribeFromColony } from '../app/game/tribe.ts';
import { runTribe } from './helpers/tribe-route.ts';
import { civilizationFromTribe } from '../app/game/civilization.ts';
import { runCity } from './helpers/city-route.ts';
import {
  runPond,
  runOcean,
  runShore,
  runLand,
  runColony,
} from './helpers/campaign-route.ts';
void test('one life completes all eight chapters without seeded wins, resources or teleportation', () => {
  const w = createWorld(23);
  w.mode = 'running';
  runPond(w);
  const pond = structuredClone(w.history);
  assert.equal(w.generation, 3);
  assert.ok(enterOcean(w));
  assert.deepEqual(w.history, pond);
  runOcean(w);
  const ocean = structuredClone(w.history),
    body = structuredClone(w.ocean!.body);
  assert.equal(w.generation, 6);
  const oceanAge = w.age;
  assert.ok(enterShore(w));
  assert.equal(w.age, oceanAge);
  assert.deepEqual(w.history, ocean);
  assert.deepEqual(w.shore!.body, body);
  runShore(w);
  const shore = structuredClone(w.history);
  assert.equal(w.generation, 8);
  const shoreAge = w.age;
  const shoreFriends = w
    .shore!.creatures.filter((c) => c.joined)
    .map((c) => c.id);
  const adaptation = w.shore!.protection ?? undefined;
  assert.ok(enterLand(w));
  assert.equal(w.age, shoreAge);
  assert.deepEqual(
    w.land!.creatures.filter((c) => c.joined).map((c) => c.shoreOrigin),
    shoreFriends,
  );
  assert.deepEqual(w.history, shore);
  assert.deepEqual(w.land!.body, body);
  runLand(w);
  assert.equal(w.generation, 9);
  const s = colonyFromLand(w)!;
  assert.ok(s);
  assert.equal(s.adaptation, adaptation);
  assert.deepEqual(s.body, body);
  assert.equal(
    s.members.length,
    w.land!.creatures.filter((c) => c.joined).length,
  );
  assert.equal(s.standalone, false);
  const history = structuredClone(s.history);
  s.mode = 'running';
  runColony(s);
  assert.deepEqual(s.history, history);
  assert.equal(s.generation, 9);
  assert.deepEqual(
    s.history.map((a) => a.generation),
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
  );
  const tribe = tribeFromColony(s)!;
  assert.equal(tribe.members.length, s.members.length);
  assert.equal(tribe.stores.food, s.food);
  assert.equal(tribe.stores.wood, s.wood);
  assert.equal(tribe.adaptation, adaptation);
  runTribe(tribe);
  assert.deepEqual(tribe.history, history);
  assert.deepEqual(tribe.body, body);
  assert.equal(tribe.generation, 9);
  assert.deepEqual(tribe.choices, [
    'tool:basket',
    'moss:trade',
    'moss:trade',
    'reed:trade',
    'reed:trade',
  ]);
  const city = civilizationFromTribe(tribe)!;
  assert.equal(city.couriers.length, tribe.members.length + 1);
  assert.equal(city.adaptation, adaptation);
  runCity(city, 'wind');
  assert.deepEqual(city.history, history);
  assert.deepEqual(city.body, body);
  assert.equal(city.generation, 9);
  const space = spaceFromCivilization(city)!;
  assert.equal(space.adaptation, adaptation);
  runSpace(space);
  assert.equal(expeditionRecord(space, 1)!.adaptation, adaptation);
  assert.ok(completeJourney(space));
  assert.deepEqual(space.history, history);
  assert.deepEqual(space.body, body);
  assert.equal(space.generation, 9);
});

// New ocean default is exercised separately from the frozen legacy campaign above.
for (const style of ['hunt', 'filter'] as const)
  void test(`new tidal ${style} lineage completes all eight chapters without injected progress`, async () => {
    const { enterOcean: newEnterOcean } = await import('../app/game/ocean.ts');
    const { runTidalRoute } = await import('./helpers/tidal-route.ts');
    const w = createWorld(23);
    w.mode = 'running';
    runPond(w);
    assert.ok(newEnterOcean(w));
    runTidalRoute(w, style);
    const body = structuredClone(w.ocean!.body),
      legacy = structuredClone(w.tidalLegacy);
    assert.ok(legacy?.refuge);
    assert.ok(enterShore(w));
    runShore(w);
    assert.ok(enterLand(w));
    runLand(w);
    assert.deepEqual(w.land!.body, body);
    assert.deepEqual(w.tidalLegacy, legacy);
    const colony = colonyFromLand(w)!;
    assert.ok(colony);
    colony.mode = 'running';
    runColony(colony);
    const tribe = tribeFromColony(colony)!;
    assert.ok(tribe);
    runTribe(tribe);
    const city = civilizationFromTribe(tribe)!;
    assert.ok(city);
    runCity(city, 'wind');
    const space = spaceFromCivilization(city)!;
    assert.ok(space);
    runSpace(space);
    assert.ok(completeJourney(space));
    const archive = expeditionRecord(space, 1)!;
    assert.ok(archive);
    assert.deepEqual(archive.body, body);
    assert.deepEqual(archive.tidalLegacy, legacy);
    assert.ok(archive.history.length >= 9);
    assert.deepEqual(space.body, body);
    const { createCampaignSession } =
      await import('../app/game/campaign-session.ts');
    const session = createCampaignSession();
    session.restore({
      journey: w,
      colony: { checkpoint: colony, current: colony },
      tribe: { checkpoint: tribe, current: tribe },
      city: { checkpoint: city, current: city },
      space: { checkpoint: space, current: space },
      records: [],
      active: 'space',
    });
    assert.ok(session.newJourney(undefined, 71));
    assert.equal(session.journey.getWorld().tidalLegacy, undefined);
    assert.deepEqual(session.journey.getWorld().history, []);
    assert.equal(session.getRecords().length, 1);
  });
