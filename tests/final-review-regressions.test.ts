import test from 'node:test';
import assert from 'node:assert/strict';
import { createLandWorld, LAND_NESTS } from '../app/game/land.ts';
import { createOceanWorld } from '../app/game/ocean.ts';
import { stepWorld } from '../app/game/simulation.ts';
import {
  ingestBiologicalDna,
  ingestOceanDna,
} from '../app/game/dna-evolution.ts';
import { commitBiologicalEvolution } from '../app/game/biological-evolution.ts';
import { activateLandFeature } from '../app/game/land-features.ts';
import { commitOceanDna, oceanDnaCandidates } from '../app/game/ocean-dna.ts';
import { commitBody } from '../app/game/body-design.ts';
import { bodyDraft, placeDraftOrgan } from '../app/game/tidal/body-draft.ts';
import { recoverLife } from '../app/game/life-recovery.ts';
import { learnFrom, selectLearnedSkill } from '../app/game/lineage-learning.ts';
import { encodeSave, decodeSave } from '../app/game/campaign-save.ts';

const idle = { x: 0, y: 0, dash: false };
const saved = (w: ReturnType<typeof createLandWorld>) =>
  decodeSave(encodeSave({ journey: w, colony: null, active: 'journey' })).kind;

// Boundary fixtures isolate paid anatomy changes; native full routes are separate evidence.
void test('replacing active sifting closes removed anatomy and keeps the paid newborn saveable', () => {
  const w = createLandWorld(41);
  w.form = 'strider';
  Object.assign(w.land!, {
    tier: 1,
    nests: [0],
    discovered: ['fern'],
    features: ['sift', 'leap', 'cache'],
    activeFeature: 'sift',
    sifting: true,
    featureActive: 2,
    featureCooldown: 6,
  });
  Object.assign(w.player, LAND_NESTS[0]);
  w.food = 10;
  ingestBiologicalDna(w, 'land:burrow-mole', 'observe');
  assert.equal(saved(w), 'ok');
  assert.ok(commitBiologicalEvolution(w, 'landpart:burrow'));
  assert.equal(w.land!.features!.includes('sift'), false);
  assert.equal(w.land!.sifting, false);
  assert.equal(w.land!.featureActive, 0);
  assert.equal(w.land!.featureCooldown, 0);
  assert.equal(saved(w), 'ok');
});

void test('replacing a full storage structure returns its real contents once instead of trapping nutrition', () => {
  const w = createLandWorld(41);
  w.form = 'strider';
  Object.assign(w.land!, {
    tier: 1,
    nests: [0],
    discovered: ['fern'],
    features: ['cache', 'leap', 'sift'],
    activeFeature: 'cache',
    cachedFood: 3,
  });
  Object.assign(w.player, LAND_NESTS[0]);
  w.food = 10;
  ingestBiologicalDna(w, 'land:burrow-mole', 'observe');
  assert.ok(commitBiologicalEvolution(w, 'landpart:burrow'));
  assert.equal(w.land!.features!.includes('cache'), false);
  assert.equal(w.land!.cachedFood, 0);
  assert.equal(w.food, 3);
  assert.equal(saved(w), 'ok');
});

void test('radial bodies without feeding organs cannot mature into a nonfeeding bilateral fish; rejection is atomic', () => {
  const w = createOceanWorld(23);
  w.form = 'jelly';
  Object.assign(w.ocean!, {
    tier: 2,
    branch: 'radial',
    dna: 100,
    body: {
      length: 1,
      width: 1,
      legs: 1,
      organs: {},
      placements: [{ id: 'tail', organ: 'fin', mount: 'tail', t: 0 }],
    },
  });
  ingestOceanDna(w, 'silver-dart', 'hunt');
  const before = structuredClone(w);
  assert.equal(commitOceanDna(w, 'silverflow'), false);
  assert.deepEqual(w, before);
  assert.notEqual(
    oceanDnaCandidates(w).find((c) => c.id === 'silverflow')!.gate,
    '',
  );
  assert.ok(
    commitBody(w, placeDraftOrgan(bodyDraft(w.ocean!.body), 'jaw', 'front', 0)),
  );
  w.ocean!.morph = null;
  w.evolution = null;
  assert.ok(
    commitOceanDna(w, 'silverflow'),
    'adding a real feeding mouth permits the same branch change',
  );
  assert.equal(w.form, 'fish');
  assert.equal(saved(w), 'ok');
});

void test('normal timed storage cycles conserve nutrition without minting body energy', () => {
  const w = createLandWorld(41);
  w.form = 'strider';
  w.land!.tier = 1;
  w.land!.features = ['cache'];
  w.land!.activeFeature = 'cache';
  w.land!.creatures = [];
  w.foods = [];
  Object.assign(w.player, { x: 1000, y: 1600, energy: 40 });
  w.food = 3;
  const initialEnergy = w.player.energy;
  for (let cycle = 0; cycle < 3; cycle++) {
    assert.ok(activateLandFeature(w));
    assert.equal(w.food, 0);
    for (let i = 0; i < 41; i++) stepWorld(w, idle, 0.05);
    assert.ok(activateLandFeature(w));
    assert.equal(w.food, 3);
    assert.equal(w.land!.cachedFood, 0);
    assert.ok(
      w.player.energy <= initialEnergy,
      'moving supplies between a bag and inventory is not eating them',
    );
    for (let i = 0; i < 41; i++) stepWorld(w, idle, 0.05);
  }
});

void test('ocean recovery preserves paid generation and later knowledge with a parent snapshot or no safe snapshot', () => {
  for (const captureParent of [true, false]) {
    const w = createOceanWorld(23);
    if (captureParent) {
      stepWorld(w, idle, 1 / 120);
      assert.equal(w.ocean!.tidal!.safeCheckpoint!.generation, 1);
    }
    ingestOceanDna(w, 'silver-dart', 'hunt');
    learnFrom(w, 'pond:dart');
    assert.ok(selectLearnedSkill(w, 'jet', 'ocean'));
    Object.assign(w.player, { health: 20, energy: 20 });
    assert.ok(commitOceanDna(w, 'silverflow'));
    const dna = w.ocean!.dna;
    w.ocean!.tidal!.actors = [];
    w.ocean!.tidal!.foods = [];
    Object.assign(w.player, { health: 0.001, energy: 0 });
    for (let i = 0; i < 1200 && w.mode !== 'dead'; i++)
      stepWorld(w, idle, 1 / 120);
    assert.equal(w.mode, 'dead');
    assert.equal(
      w.ocean!.tidal!.safeCheckpoint?.generation ?? null,
      captureParent ? 1 : null,
    );
    w.ocean!.tidal!.journal.seen = ['silver-dart'];
    const next = recoverLife(w);
    assert.equal(next.generation, 2);
    assert.equal(next.form, 'bilateral');
    assert.deepEqual(next.ocean!.body, w.ocean!.body);
    assert.deepEqual(next.history, w.history);
    assert.deepEqual(next.dnaLineage, w.dnaLineage);
    assert.equal(next.learning!.equipped, 'jet');
    assert.deepEqual(
      next.ocean!.tidal!.abilities.slots,
      w.ocean!.tidal!.abilities.slots,
    );
    assert.ok(next.ocean!.tidal!.journal.seen.includes('silver-dart'));
    assert.ok(
      next.ocean!.dna <= dna,
      'recovery cannot refund already spent birth DNA',
    );
    assert.equal(saved(next), 'ok');
  }
});
