import test from 'node:test';
import assert from 'node:assert/strict';
import { createOceanWorld, retryOcean } from '../app/game/ocean.ts';
import { createShoreWorld, retryShore } from '../app/game/shore.ts';
import { createLandWorld, retryLand, landStats } from '../app/game/land.ts';
import {
  branchBiological,
  type BiologicalRecord,
} from '../app/game/biological-finale.ts';
import { stepLandFeatures } from '../app/game/land-features.ts';
import { stepWorld } from '../app/game/simulation.ts';
import { encodeSave, decodeSave } from '../app/game/campaign-save.ts';
import { landSpecies } from '../app/game/land-catalog.ts';
import type { Ancestor } from '../app/game/simulation.ts';
const fixture = (a: Ancestor): BiologicalRecord => ({
  id: 1,
  title: '测试谱系',
  generation: a.generation + 1,
  seconds: 30,
  history: [a],
  form: a.form ?? 'fish',
  body: a.body!,
  traits: a.traits,
  features: [],
  descendants: [],
  integrity: 100,
});

void test('fork retry retains the selected mature ocean anatomy, with no inherited resources', () => {
  const a = {
    generation: 4,
    habitat: 'ocean' as const,
    form: 'fish' as const,
    traits: [],
    food: 20,
    seconds: 30,
    body: { ...createOceanWorld(23).ocean!.body, length: 1.4, width: 0.8 },
  };
  const record = fixture(a);
  a.body.placements = [
    { id: 'ancestral-filter', organ: 'filter', mount: 'front', t: 0 },
  ];
  const branch = branchBiological(record, 4, 77)!;
  const retry = retryOcean(branch);
  assert.equal(retry.form, 'fish');
  assert.equal(retry.ocean!.tier, 2);
  assert.deepEqual(retry.ocean!.body, a.body);
  assert.equal(retry.ocean!.dna, 0);
  assert.ok(retry.ocean!.discovered.includes('filter'));
  assert.ok(retry.ocean!.tidal!.abilities.slots.includes('filter'));
  assert.equal(
    decodeSave(encodeSave({ journey: retry, colony: null, active: 'journey' }))
      .kind,
    'ok',
  );
});
void test('fork retry retains shore organs and mature preservation adaptations without copying cover', () => {
  const a = {
    generation: 7,
    habitat: 'shore' as const,
    form: 'crawler' as const,
    traits: [],
    food: 20,
    seconds: 30,
    body: createShoreWorld(23).shore!.body,
    adaptations: ['skin', 'reservoir'] as ('skin' | 'reservoir')[],
    adaptation: 'skin' as const,
  };
  const branch = branchBiological(fixture(a), 7, 77)!;
  const retry = retryShore(branch);
  assert.equal(retry.shore!.tier, 2);
  assert.deepEqual(retry.shore!.adaptations, a.adaptations);
  assert.equal(retry.shore!.biomass, 0);
  assert.equal(retry.shore!.shelters?.length ?? 0, 0);
  assert.equal(
    decodeSave(encodeSave({ journey: retry, colony: null, active: 'journey' }))
      .kind,
    'ok',
  );
});
void test('dew needs a real wet habitat and obeys capacity; maintained structures pay actual metabolism', () => {
  const w = createLandWorld(41);
  w.land!.features = ['dew', 'roots', 'glide'];
  w.land!.moisture = 40;
  Object.assign(w.player, { x: 2600, y: 1650, vx: 0, vy: 0 });
  stepLandFeatures(w, 1);
  assert.equal(w.land!.moisture, 40);
  Object.assign(w.player, { x: 620, y: 1130 });
  w.land!.moisture = 99;
  stepLandFeatures(w, 1);
  assert.equal(w.land!.moisture, 100);
  const costly = landStats(w).metabolism;
  w.land!.features = [];
  assert.ok(costly > landStats(w).metabolism);
});
void test('land ancestor forks keep mature body, shoulder plates and chosen parts through retry without copying a nest', () => {
  const a: Ancestor = {
    generation: 10,
    habitat: 'land',
    form: 'strider',
    traits: [],
    food: 20,
    seconds: 30,
    body: createLandWorld(41).land!.body,
    landOrgan: 'plates',
    landFeatures: ['burrow'],
  };
  const branch = branchBiological(fixture(a), 10, 77)!;
  assert.equal(branch.land!.tier, 2);
  assert.equal(branch.land!.organ, 'plates');
  assert.equal(branch.land!.activeFeature, 'burrow');
  const retry = retryLand(branch);
  assert.equal(retry.land!.organ, 'plates');
  assert.equal(retry.land!.nests.length, 0);
  assert.equal(
    decodeSave(encodeSave({ journey: retry, colony: null, active: 'journey' }))
      .kind,
    'ok',
  );
});
void test('seed-carrier gathers actual fruit once, then carries it home instead of being overridden by generic browsing', () => {
  const w = createLandWorld(41),
    c = w.land!.creatures.find((c) => c.species === 'seed-carrier')!;
  w.land!.creatures = [c];
  Object.assign(c, c.home);
  Object.assign(w.player, { x: 450, y: 1450 });
  w.foods = [{ id: 1, x: c.x, y: c.y, cooldown: 0, rich: false }];
  stepWorld(w, { x: 0, y: 0, dash: false }, 0.05);
  assert.equal(c.carrying, 1);
  assert.ok(w.foods[0].cooldown > 0);
  assert.equal(landSpecies(c.species).behavior, 'carry');
});
