import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createShoreWorld,
  shoreStats,
  shoreEvolutionGate,
  wetAt,
} from '../app/game/shore.ts';
import { stepWorld } from '../app/game/simulation.ts';
import { encodeSave, decodeSave } from '../app/game/campaign-save.ts';
const shelter = await import('../app/game/shore-shelter.ts').catch(() => null);
const idle = { x: 0, y: 0, dash: false };
function dryBody() {
  const w = createShoreWorld(37);
  w.form = 'crawler';
  w.shore!.tier = 1;
  w.shore!.discovered = ['support'];
  w.food = 12;
  Object.assign(w.player, { x: 900, y: 950 });
  w.shore!.moisture = 100;
  w.foods = [];
  w.shore!.creatures = [];
  return w;
}
void test('paid temporary shore cover changes actual drying, never generates water, and cannot stack on itself', () => {
  assert.ok(shelter);
  const w = dryBody(),
    open = structuredClone(w);
  assert.ok(shelter.buildShoreShelter(w));
  assert.equal(w.food, 9);
  const before = structuredClone(w);
  assert.equal(shelter.buildShoreShelter(w), false);
  assert.deepEqual(w, before);
  for (let i = 0; i < 60; i++) {
    stepWorld(w, idle, 0.05);
    stepWorld(open, idle, 0.05);
  }
  assert.ok(w.shore!.moisture > open.shore!.moisture);
  assert.ok(w.shore!.moisture < 100);
  assert.ok(shoreStats(w).dryRate < shoreStats(open).dryRate);
});
void test('six seconds of real shelter practice discovers a different preservation source, pauses freeze cover, and saves validate it', () => {
  assert.ok(shelter);
  const w = dryBody();
  assert.ok(shelter.buildShoreShelter(w));
  for (let i = 0; i < 121; i++) stepWorld(w, idle, 0.05);
  assert.equal(w.dnaLineage?.sources['shore:shade']?.method, 'practice');
  assert.ok(w.shore!.discovered.includes('moisture'));
  const state = structuredClone(w.shore!.shelters);
  w.mode = 'paused';
  for (let i = 0; i < 100; i++) stepWorld(w, idle, 0.05);
  assert.deepEqual(w.shore!.shelters, state);
  assert.equal(
    decodeSave(encodeSave({ journey: w, colony: null, active: 'journey' }))
      .kind,
    'ok',
  );
});
void test('repeated water-land experiments can unlock preservation without forcing the same fern-pool route (earned-progress fixture)', () => {
  const w = createShoreWorld(37);
  w.form = 'crawler';
  w.shore!.tier = 1;
  w.shore!.discovered = ['support', 'moisture'];
  w.shore!.fieldNotes = { drySeconds: 0, safeReturns: 2, harvestCycles: {} };
  w.food = 12;
  assert.equal(shoreEvolutionGate(w), '');
});
void test('two actual water-land excursions keep recording after the first discovery', () => {
  const w = createShoreWorld(37);
  w.form = 'crawler';
  w.shore!.tier = 1;
  w.shore!.discovered = ['support'];
  w.foods = [];
  w.shore!.creatures = [];
  for (let journey = 0; journey < 2; journey++) {
    for (let i = 0; i < 90; i++)
      stepWorld(w, { x: 1, y: 0, dash: false }, 0.05);
    assert.equal(wetAt(w, w.player), false);
    for (let i = 0; i < 165; i++) stepWorld(w, idle, 0.05);
    for (let i = 0; i < 90; i++)
      stepWorld(w, { x: -1, y: 0, dash: false }, 0.05);
    assert.equal(wetAt(w, w.player), true);
    for (let i = 0; i < 150; i++) stepWorld(w, idle, 0.05);
    assert.equal(w.shore!.fieldNotes!.safeReturns, journey + 1);
  }
  assert.equal(w.dnaLineage?.sources['shore:moisture']?.meals, 2);
  assert.equal(w.dnaLineage?.sources['shore:moisture']?.methods?.practice, 2);
});
