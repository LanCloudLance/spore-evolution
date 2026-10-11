import { flightPresentation } from '../app/game/space-presentation.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCampaignSession } from '../app/game/campaign-session.ts';
import { createColonyWorld } from '../app/game/colony.ts';
import { tribeFromColony } from '../app/game/tribe.ts';
import { civilizationFromTribe } from '../app/game/civilization.ts';
import {
  spaceFromCivilization,
  travelSpace,
  travelCost,
  stepSpace,
  spaceActivity,
  upgradeSpace,
  buildOutpost,
  startOutpostTrial,
  setEcology,
  ecologyError,
  ecologyReadings,
  STARS,
  ecologyFeedback,
  expeditionRecord,
  completeJourney,
} from '../app/game/space.ts';
import {
  encodeSave,
  decodeSave,
  pausedCampaign,
} from '../app/game/campaign-save.ts';
import { runColony } from './helpers/campaign-route.ts';
import { runTribe } from './helpers/tribe-route.ts';
import { runCity } from './helpers/city-route.ts';
import {
  arrive,
  scanPlanet,
  prepareSpace,
  finishSpace,
} from './helpers/space-route.ts';
const colony = createColonyWorld();
colony.mode = 'running';
runColony(colony);
const tribe = tribeFromColony(colony)!;
runTribe(tribe);
const city = civilizationFromTribe(tribe)!;
runCity(city);
const fresh = () => spaceFromCivilization(city)!;
function session() {
  const a = createCampaignSession();
  a.startColony(colony);
  a.startTribe();
  a.updateTribe(tribe);
  a.startCity();
  a.updateCity(city);
  a.startSpace();
  return a;
}
void test('space starts only from an earned launch with manifest and actual lineage and crew', () => {
  assert.equal(spaceFromCivilization(civilizationFromTribe(tribe)!), null);
  const s = fresh();
  assert.deepEqual([s.fuel, s.food, s.parts], [6, 8, 6]);
  assert.deepEqual(s.body, city.body);
  assert.deepEqual(s.history, city.history);
  assert.equal(s.crew.length, city.couriers.length);
  assert.equal(s.generation, city.generation);
  assert.equal(completeJourney(s), false);
  const a = session();
  const current = a.getSpace()!.current;
  current.mode = 'running';
  travelSpace(current, 'tide');
  a.updateSpace(current);
  assert.ok(a.startSpace());
  assert.deepEqual(a.getSpace()!.current, current);
  assert.equal(a.getSpace()!.checkpoint.mode, 'ready');
});
void test('travel charges once, prevents simultaneous action and freezes exactly on pause', () => {
  const s = fresh();
  assert.equal(travelSpace(s, 'tide'), false);
  s.mode = 'running';
  const cost = travelCost(s, 'tide');
  assert.ok(travelSpace(s, 'tide'));
  assert.equal(s.fuel, 6 - cost);
  assert.equal(s.food, 7);
  assert.equal(travelSpace(s, 'ember'), false);
  assert.equal(spaceActivity(s, 'charge'), false);
  stepSpace(s, 2);
  s.mode = 'paused';
  const before = structuredClone(s);
  stepSpace(s, 100);
  assert.deepEqual(s, before);
  s.mode = 'running';
  stepSpace(s, 12);
  assert.equal(s.location, 'tide');
  assert.equal(s.flight, null);
  assert.deepEqual(s.visited, ['home', 'tide']);
});
void test('scans and upgrade have real gates; building reserves trial food and cannot consume it on orbital charging', () => {
  const s = fresh();
  s.mode = 'running';
  assert.equal(spaceActivity(s, 'water'), false);
  assert.ok(upgradeSpace(s, 'shield'));
  assert.equal(upgradeSpace(s, 'sail'), false);
  assert.equal(s.parts, 4);
  arrive(s, 'tide');
  assert.equal(buildOutpost(s, 'wetland'), false);
  scanPlanet(s);
  assert.equal(spaceActivity(s, 'water'), false);
  assert.ok(buildOutpost(s, 'wetland'));
  assert.equal(s.parts, 0);
  assert.equal(s.food, 5);
  assert.equal(buildOutpost(s, 'dome'), false);
  assert.equal(travelSpace(s, 'beacon'), false);
  assert.equal(spaceActivity(s, 'charge'), false);
  assert.ok(startOutpostTrial(s));
  assert.equal(startOutpostTrial(s), false);
  const poor = fresh();
  poor.mode = 'running';
  arrive(poor, 'tide');
  scanPlanet(poor);
  poor.food = 4;
  assert.equal(buildOutpost(poor, 'dome'), false);
  assert.equal(poor.outpost, null);
  assert.ok(travelSpace(poor, 'beacon'));
});
void test('poor ecological choices fail, while pause supports correction and dome changes heat tolerance', () => {
  const s = fresh();
  prepareSpace(s, 'ember', 'wetland', 'sail');
  assert.ok(setEcology(s, 'water', 3));
  assert.ok(setEcology(s, 'light', 0));
  assert.ok(startOutpostTrial(s));
  stepSpace(s, 30);
  assert.equal(s.mode, 'lost');
  assert.equal(expeditionRecord(s, 1), null);
  const ended = structuredClone(s);
  stepSpace(s, 30);
  assert.deepEqual(s, ended);
  const d = fresh();
  prepareSpace(d, 'ember', 'dome', 'shield');
  d.mode = 'paused';
  assert.ok(setEcology(d, 'heat', 1));
  assert.equal(ecologyError(d), 0);
  const paused = structuredClone(d);
  stepSpace(d, 30);
  assert.deepEqual(d, paused);
  assert.equal(setEcology(d, 'heat', 4), false);
  d.mode = 'running';
  finishSpace(d);
  assert.equal(d.outpost!.trial, 30);
});
void test('midflight and midtrial saves resume paused without duplicating costs; invalid stars and impossible terminal states are rejected', () => {
  const a = session(),
    s = a.getSpace()!.current;
  s.mode = 'running';
  assert.ok(travelSpace(s, 'tide'));
  stepSpace(s, 2);
  a.updateSpace(s);
  const raw = encodeSave(a.snapshot('space'));
  const decoded = decodeSave(raw);
  assert.equal(decoded.kind, 'ok');
  if (decoded.kind !== 'ok') return;
  const b = createCampaignSession();
  b.restore(decoded.save.campaign);
  const resumed = b.getSpace()!.current;
  assert.equal(resumed.mode, 'paused');
  assert.equal(resumed.fuel, s.fuel);
  assert.deepEqual(resumed.flight, s.flight);
  resumed.mode = 'running';
  stepSpace(resumed, 10);
  scanPlanet(resumed);
  buildOutpost(resumed, 'wetland');
  startOutpostTrial(resumed);
  stepSpace(resumed, 12);
  b.updateSpace(resumed);
  const trial = decodeSave(encodeSave(b.snapshot('space')));
  assert.equal(trial.kind, 'ok');
  if (trial.kind === 'ok') {
    const c = pausedCampaign(trial.save.campaign);
    assert.equal(c.space!.current.mode, 'paused');
    assert.equal(c.space!.current.outpost!.trial, resumed.outpost!.trial);
    assert.equal(c.space!.current.food, resumed.food);
  }
  for (const patch of [
    { location: 'missing' },
    { mode: 'won' },
    { surveys: { tide: ['water', 'water'], ember: [] } },
  ]) {
    const broken = JSON.parse(raw);
    Object.assign(broken.campaign.space.current, patch);
    assert.equal(decodeSave(JSON.stringify(broken)).kind, 'invalid');
  }
});
void test('replay keeps completed records, rejects unearned traits, resets chapter state and does not invent ancestors', () => {
  const a = session();
  assert.equal(a.newJourney(), false);
  const s = a.getSpace()!.current;
  prepareSpace(s);
  finishSpace(s);
  a.updateSpace(s);
  const unearned = [
    'flagellum',
    'shell',
    'spikes',
    'chloroplast',
    'cilia',
    'vacuole',
  ].find((t) => !s.traits.includes(t as (typeof s.traits)[number]));
  if (unearned)
    assert.equal(a.newJourney(unearned as (typeof s.traits)[number]), false);
  assert.ok(a.newJourney(s.traits[0], 23));
  assert.equal(a.getRecords().length, 1);
  assert.equal(completeJourney(a.getRecords()[0]), false);
  assert.deepEqual(a.getRecords()[0].body, s.body);
  assert.equal(a.journey.getWorld().mode, 'ready');
  assert.equal(a.journey.getWorld().generation, 1);
  assert.deepEqual(a.journey.getWorld().history, []);
  assert.equal(a.getColony(), null);
  assert.equal(a.getSpace(), null);
  assert.equal(a.newJourney(), false);
  assert.equal(decodeSave(encodeSave(a.snapshot('journey'))).kind, 'ok');
});
void test('old envelopes migrate with empty archives and no space, future envelopes remain untouched', () => {
  const old = session().snapshot('city');
  delete old.space;
  delete old.records;
  for (const version of [1, 2, 3]) {
    const result = decodeSave(
      JSON.stringify({ version, savedAt: 1, campaign: old }),
    );
    assert.equal(result.kind, 'ok');
    if (result.kind === 'ok') {
      assert.equal(result.save.version, 5);
      assert.equal(result.save.campaign.space, null);
      assert.deepEqual(result.save.campaign.records, []);
    }
  }
  assert.equal(decodeSave('{"version":6}').kind, 'unsupported');
});

void test('ecology guidance respects dome and wetland tolerance and only corrects mismatched settings', () => {
  const s = fresh();
  prepareSpace(s, 'tide', 'dome', 'sail');
  assert.ok(startOutpostTrial(s));
  stepSpace(s, 13);
  assert.equal(ecologyError(s), 0);
  assert.match(ecologyFeedback(s).hint, /穹顶耐受范围/);
  assert.doesNotMatch(ecologyFeedback(s).hint, /降低/);
  assert.ok(setEcology(s, 'water', 0));
  assert.match(ecologyFeedback(s).hint, /提高水分/);
  assert.doesNotMatch(ecologyFeedback(s).hint, /温度/);
  const w = fresh();
  prepareSpace(w, 'ember', 'wetland', 'sail');
  assert.ok(startOutpostTrial(w));
  stepSpace(w, 13);
  assert.match(ecologyFeedback(w).hint, /降低温度/);
  assert.ok(setEcology(w, 'heat', 0));
  assert.equal(ecologyError(w), 0);
  assert.doesNotMatch(ecologyFeedback(w).hint, /穹顶/);
  stepSpace(w, 8);
  assert.match(ecologyFeedback(w).hint, /提高温度/);
});

void test('flight drawing follows its visible quadratic route and reduced motion preserves actual progress', () => {
  const s = fresh();
  s.mode = 'running';
  assert.ok(travelSpace(s, 'ember'));
  const a = STARS.home,
    b = STARS.ember;
  const start = flightPresentation(s);
  assert.equal(start.x, a.x);
  assert.equal(start.y, a.y - 58);
  stepSpace(s, s.flight!.duration / 2);
  const before = structuredClone(s),
    mid = flightPresentation(s),
    still = flightPresentation(s, true);
  assert.ok(Math.abs(mid.progress - 0.5) < 1e-8);
  assert.ok(Math.abs(mid.x - (a.x + b.x) / 2) < 1e-7);
  assert.ok(Math.abs(mid.y - ((a.y + b.y) / 2 - 103)) < 1e-7);
  assert.equal(still.x, a.x);
  assert.equal(still.y, a.y - 58);
  assert.equal(still.progress, mid.progress);
  assert.deepEqual(s, before);
  s.mode = 'paused';
  stepSpace(s, 10);
  assert.deepEqual(flightPresentation(s), mid);
  s.mode = 'running';
  stepSpace(s, 10);
  assert.equal(flightPresentation(s).x, b.x);
  assert.equal(flightPresentation(s).y, b.y - 58);
});
void test('surface readings distinguish heater settings, shielded flare and habitat tolerance', () => {
  const s = fresh();
  s.mode = 'running';
  s.location = 'ember';
  s.upgrade = 'shield';
  // Focused display/rule fixture; real browser route is recorded separately.
  s.outpost = {
    planet: 'ember',
    habitat: 'wetland',
    settings: { water: 2, light: 2, heat: 2 },
    trial: 11,
    growth: 50,
    stability: 100,
    foodClock: 0,
  };
  let readings = ecologyReadings(s);
  assert.deepEqual(
    readings.map((r) => r.actual),
    [2, 2, 3],
  );
  assert.deepEqual(
    readings.map((r) => r.tolerance),
    [1, 0, 0],
  );
  assert.deepEqual(
    readings.map((r) => r.offset),
    [0, 0, 1],
  );
  const old = s.outpost.stability;
  stepSpace(s, 0.01);
  assert.ok(Math.abs(s.outpost.stability - (old - 0.03)) < 1e-8);
  s.mode = 'paused';
  assert.ok(setEcology(s, 'heat', 1));
  assert.equal(ecologyReadings(s)[2].actual, 2);
  assert.equal(ecologyError(s), 0);
  const frozen = structuredClone(s);
  ecologyReadings(s);
  assert.deepEqual(s, frozen);
  s.outpost.trial = 20;
  assert.equal(ecologyReadings(s)[2].offset, -1);
  s.outpost.habitat = 'dome';
  s.outpost.settings.water = 1;
  readings = ecologyReadings(s);
  assert.equal(readings[2].tolerance, 1);
  assert.equal(ecologyError(s), 0);
});

void test('thirty-second observation consumes all three meals even when frames straddle ten-second boundaries', () => {
  const s = fresh();
  s.mode = 'running';
  s.location = 'ember';
  s.outpost = {
    planet: 'ember',
    habitat: 'dome',
    settings: { water: 1, light: 2, heat: 1 },
    trial: 0,
    growth: 0,
    stability: 100,
    foodClock: 0,
  };
  const food = s.food;
  for (let i = 0; i < 1100 && s.mode === 'running'; i++)
    stepSpace(s, i % 3 === 0 ? 0.027 : 0.033);
  assert.equal(s.mode, 'won');
  assert.equal(s.outpost.trial, 30);
  assert.equal(s.food, food - 3);
  assert.match(s.notice, /这个族群/);
  assert.doesNotMatch(s.notice, /最初的微小生命/);
});
