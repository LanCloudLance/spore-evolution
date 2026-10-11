import test from 'node:test';
import assert from 'node:assert/strict';
import * as biology from '../app/game/simulation.ts';
import { enterOcean } from '../app/game/ocean.ts';
import {
  createOceanWorld,
  evolveOcean,
  OCEAN_NURSERY,
} from '../app/game/ocean.ts';
import {
  createShoreWorld,
  evolveShore,
  SHORE_POOLS,
  shoreStats,
} from '../app/game/shore.ts';
import { landStats } from '../app/game/land.ts';
import { runTidalRoute } from './helpers/tidal-route.ts';
import { enterShore } from '../app/game/shore.ts';
import { enterLand } from '../app/game/land.ts';
import { colonyFromLand, stepColony } from '../app/game/colony.ts';
import { tribeFromColony, stepTribe } from '../app/game/tribe.ts';
import {
  civilizationFromTribe,
  stepCivilization,
} from '../app/game/civilization.ts';
import {
  spaceFromCivilization,
  stepSpace,
  travelSpace,
  spaceActivity,
} from '../app/game/space.ts';
import { createCampaignSession } from '../app/game/campaign-session.ts';
import { encodeSave, decodeSave } from '../app/game/campaign-save.ts';
import type { CampaignSnapshot } from '../app/game/campaign-save.ts';
import {
  runPond,
  runShore,
  runLand,
  runColony,
} from './helpers/campaign-route.ts';
import { runTribe } from './helpers/tribe-route.ts';
import { runCity } from './helpers/city-route.ts';
import { runSpace } from './helpers/space-route.ts';
const life = await import('../app/game/stage-life.ts').catch(() => null);

void test('legacy restores clear a prior earned departure and malformed new ancestry is rejected', () => {
  const session = createCampaignSession();
  session.journey.getWorld().freeLife = true;
  const oldCampaign = createCampaignSession().snapshot('journey');
  delete oldCampaign.journey.freeLife;
  assert.equal(session.restore(oldCampaign), 'journey');
  assert.equal(session.journey.getWorld().freeLife, false);
  assert.equal(life!.reviewStageLife(session.journey.getWorld()), false);
  for (const marker of ['yes', 1, []]) {
    const raw = JSON.parse(encodeSave(oldCampaign));
    raw.campaign.journey.freeLife = marker;
    assert.equal(decodeSave(JSON.stringify(raw)).kind, 'invalid');
  }
  const shore = createShoreWorld();
  for (const adaptations of [
    ['skin', 'skin'],
    ['unknown'],
    ['skin', 'reservoir', 'skin'],
  ]) {
    const raw = JSON.parse(
      encodeSave({ journey: shore, colony: null, active: 'journey' }),
    );
    raw.campaign.journey.shore.adaptations = adaptations;
    assert.equal(decodeSave(JSON.stringify(raw)).kind, 'invalid');
  }
});

void test('an actual eight-chapter journey can keep living at every earned milestone and then depart without inventing history', () => {
  assert.equal(typeof life?.continueStageLife, 'function');
  const w = biology.createWorld(23);
  const session = createCampaignSession();
  let active: CampaignSnapshot['active'] = 'journey';
  w.mode = 'running';
  function stay(
    s: { mode: string; time: number; history: unknown[] },
    step: () => void,
    persist: () => void = () => {
      Object.assign(session.journey.getWorld(), w);
    },
  ) {
    const prior = structuredClone(s.history),
      time = s.time;
    assert.equal(s.mode, 'won');
    assert.ok(life!.continueStageLife(s));
    step();
    assert.equal(s.mode, 'running');
    assert.ok(s.time > time);
    assert.deepEqual(s.history, prior);
    persist();
    const restored = decodeSave(encodeSave(session.snapshot(active), 1234));
    assert.equal(restored.kind, 'ok');
    if (restored.kind === 'ok') {
      const recovered = createCampaignSession();
      recovered.restore(restored.save.campaign);
      const snapshot = recovered.snapshot(active);
      const current =
        active === 'journey' ? snapshot.journey : snapshot[active]!.current;
      assert.equal(current.mode, 'paused');
      assert.equal(current.freeLife, true);
      assert.deepEqual(current.history, JSON.parse(JSON.stringify(prior)));
    }
    assert.ok(life!.reviewStageLife(s));
    assert.equal(s.mode, 'won');
    assert.deepEqual(s.history, prior);
    persist();
  }
  const worldStep = () =>
    biology.stepWorld(w, { x: 0, y: 0, dash: false }, 0.2);
  runPond(w);
  stay(w, worldStep);
  assert.ok(enterOcean(w));
  assert.equal(w.freeLife, false);
  runTidalRoute(w, 'hunt');
  stay(w, worldStep);
  assert.ok(enterShore(w));
  assert.equal(w.freeLife, false);
  runShore(w);
  stay(w, worldStep);
  assert.ok(enterLand(w));
  runLand(w);
  stay(w, worldStep);
  const c = colonyFromLand(w)!;
  session.startColony(c);
  active = 'colony';
  c.mode = 'running';
  runColony(c);
  stay(
    c,
    () => stepColony(c, { x: 1, y: 0 }, 0.2),
    () => session.updateColony(c),
  );
  assert.ok(session.startTribe());
  active = 'tribe';
  const t = tribeFromColony(c)!;
  runTribe(t);
  stay(
    t,
    () => stepTribe(t, { x: 1, y: 0 }, 0.2),
    () => session.updateTribe(t),
  );
  assert.ok(session.startCity());
  active = 'city';
  const city = civilizationFromTribe(t)!;
  runCity(city, 'wind');
  stay(
    city,
    () => stepCivilization(city, 0.2),
    () => session.updateCity(city),
  );
  assert.ok(session.startSpace());
  active = 'space';
  const space = spaceFromCivilization(city)!;
  runSpace(space);
  stay(
    space,
    () => stepSpace(space, 0.2),
    () => session.updateSpace(space),
  );
  assert.ok(life!.continueStageLife(space));
  const oldOutpost = structuredClone(space.outpost);
  assert.ok(travelSpace(space, 'beacon'));
  for (let i = 0; i < 300 && space.flight; i++) stepSpace(space, 0.05);
  assert.equal(space.location, 'beacon');
  assert.ok(spaceActivity(space, 'supply'));
  for (let i = 0; i < 300 && space.activity; i++) stepSpace(space, 0.05);
  assert.deepEqual(space.outpost, oldOutpost);
});

void test('unearned and failed milestones cannot be reviewed or continued', () => {
  assert.equal(typeof life?.reviewStageLife, 'function');
  for (const mode of ['ready', 'running', 'paused', 'dead', 'lost']) {
    const s = { mode, time: 0, history: [] };
    assert.equal(life!.continueStageLife(s), false);
    assert.equal(life!.reviewStageLife(s), false);
    assert.equal(s.mode, mode);
  }
});

// Boundary fixture: isolates later birth, mutation cost and habitat effects.
void test('a fourth microbial generation can replace its structure combination with real movement and feeding tradeoffs', () => {
  assert.equal(typeof biology.reviseMicrobe, 'function');
  const w = biology.createWorld(31);
  w.mode = 'running';
  w.generation = 3;
  w.food = 10;
  w.traits = ['flagellum', 'shell'];
  assert.equal(biology.reproductionGate(w), '');
  const prior = biology.getStats(w.traits);
  assert.ok(biology.reviseMicrobe(w, ['cilia', 'chloroplast', 'vacuole']));
  assert.equal(w.generation, 4);
  assert.deepEqual(w.traits, ['cilia', 'chloroplast', 'vacuole']);
  assert.ok(biology.getStats(w.traits).pickup > prior.pickup);
  assert.ok(biology.getStats(w.traits).maxEnergy > prior.maxEnergy);
  assert.ok(biology.getStats(w.traits).speed < prior.speed);
  assert.deepEqual(w.history[0].traits, ['flagellum', 'shell']);
  const saved = structuredClone(w);
  assert.equal(biology.reviseMicrobe(w, ['shell', 'shell']), false);
  assert.deepEqual(w, saved);
});

void test('mature ocean ancestry can change symmetry without dropping its real anatomy or migration investments', () => {
  const w = createOceanWorld(23);
  const o = w.ocean!;
  w.mode = 'running';
  w.form = 'fish';
  o.tier = 2;
  o.branch = 'bilateral';
  o.visited = ['透光浮游区', '珊瑚礁缘', '洋流走廊'];
  Object.assign(w.player, OCEAN_NURSERY);
  w.food = 20;
  w.player.energy = 100;
  const before = structuredClone(o.body),
    ecology = structuredClone(o.tidal);
  assert.ok(evolveOcean(w, 'jelly'));
  assert.equal(w.form, 'jelly');
  assert.equal(o.branch, 'radial');
  assert.deepEqual(o.body, before);
  assert.deepEqual(o.tidal, ecology);
  assert.equal(w.history.at(-1)!.form, 'fish');
  assert.equal(w.generation, 2);
  assert.ok(w.food < 20);
});

void test('shore descendants combine reservoir and skin, can revise locomotion, and pass both real effects to land', () => {
  const w = createShoreWorld(37);
  const s = w.shore!;
  w.form = 'crawler';
  s.tier = 2;
  s.protection = 'reservoir';
  s.discovered = ['support', 'moisture'];
  s.visited.push(SHORE_POOLS[2].name);
  w.food = 14;
  w.player.energy = 100;
  s.moisture = 100;
  const prior = shoreStats(w);
  assert.ok(evolveShore(w, 'skin'));
  assert.equal(shoreStats(w).maxMoisture, 150);
  assert.ok(shoreStats(w).dryRate < prior.dryRate);
  assert.ok(shoreStats(w).metabolism > prior.metabolism);
  assert.deepEqual(s.adaptations, ['reservoir', 'skin']);
  for (let i = 0; i < 110; i++)
    biology.stepWorld(w, { x: 0, y: 0, dash: false }, 0.05);
  w.food = 14;
  w.player.energy = 100;
  assert.ok(evolveShore(w, 'skipper'));
  assert.equal(w.form, 'skipper');
  assert.equal(s.tier, 2);
  assert.deepEqual(s.adaptations, ['reservoir', 'skin']);
  for (let i = 0; i < 110; i++)
    biology.stepWorld(w, { x: 0, y: 0, dash: false }, 0.05);
  w.mode = 'won'; // Boundary inheritance fixture, not a claimed continuous route.
  assert.ok(enterLand(w));
  assert.deepEqual(w.land!.adaptations, ['reservoir', 'skin']);
  assert.equal(landStats(w).maxMoisture, 150);
});
