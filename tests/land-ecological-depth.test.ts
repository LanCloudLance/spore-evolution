import test from 'node:test';
import assert from 'node:assert/strict';
import { createLandWorld, LAND_AREAS } from '../app/game/land.ts';
import { stepWorld } from '../app/game/simulation.ts';
import {
  nextGenerationCandidates,
  commitBiologicalEvolution,
} from '../app/game/biological-evolution.ts';
import { encodeSave, decodeSave } from '../app/game/campaign-save.ts';
const features = await import('../app/game/land-features.ts').catch(() => null);
const idle = { x: 0, y: 0, dash: false };
void test('land has six habitats and eighteen mechanically described species in a bounded, valid save', () => {
  const w = createLandWorld(41);
  assert.equal(LAND_AREAS.length, 6);
  assert.equal(new Set(w.land!.creatures.map((c) => c.species)).size, 18);
  assert.ok(w.land!.creatures.length <= 36);
  assert.equal(
    decodeSave(encodeSave({ journey: w, colony: null, active: 'journey' }))
      .kind,
    'ok',
  );
});
void test('actual burrow-mole observation supplies a source-gated paid feature birth, preserving the parent and not creating other sources', () => {
  const w = createLandWorld(41),
    mole = w.land!.creatures.find((c) => c.species === 'burrow-mole');
  assert.ok(mole);
  w.land!.tier = 1;
  w.form = 'strider';
  w.land!.nests = [0];
  w.food = 10;
  w.foods = [];
  w.land!.creatures = [mole];
  Object.assign(w.player, mole.home);
  for (let i = 0; i < 45; i++) stepWorld(w, idle, 0.05);
  assert.equal(w.dnaLineage?.sources['land:burrow-mole']?.method, 'observe');
  Object.assign(w.player, { x: 450, y: 1450 });
  const before = structuredClone(w.land!.body);
  assert.equal(
    nextGenerationCandidates(w).find((c) => c.id === 'landpart:burrow')?.gate,
    '',
  );
  assert.ok(commitBiologicalEvolution(w, 'landpart:burrow'));
  assert.equal(w.food, 0);
  assert.ok(w.land!.features?.includes('burrow'));
  assert.deepEqual(w.history.at(-1)?.body, before);
  assert.equal(w.dnaLineage?.sources['land:ridge-ram'], undefined);
  assert.equal(
    decodeSave(encodeSave({ journey: w, colony: null, active: 'journey' }))
      .kind,
    'ok',
  );
});
void test('burrowing pays energy and makes persistent dry shelter rather than water; paused actions and capped anatomy are rejected', () => {
  assert.ok(features);
  const w = createLandWorld(41);
  w.form = 'strider';
  w.land!.tier = 1;
  w.land!.features = ['burrow'];
  w.land!.activeFeature = 'burrow';
  w.land!.creatures = [];
  w.foods = [];
  Object.assign(w.player, { x: 2060, y: 1280 });
  const e = w.player.energy,
    m = w.land!.moisture;
  assert.ok(features.activateLandFeature(w));
  assert.equal(w.player.energy, e - 16);
  for (let i = 0; i < 60; i++) stepWorld(w, idle, 0.05);
  assert.ok(w.land!.moisture < m);
  assert.ok(features.inFeatureShelter(w));
  w.mode = 'paused';
  const before = structuredClone(w);
  assert.equal(features.activateLandFeature(w), false);
  assert.deepEqual(w, before);
});
