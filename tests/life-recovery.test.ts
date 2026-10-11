import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../app/game/simulation.ts';
import { createOceanWorld } from '../app/game/ocean.ts';
import { createLandWorld, evolveLand } from '../app/game/land.ts';
import { createShoreWorld, evolveShore } from '../app/game/shore.ts';
import { ingestPondDna } from '../app/game/dna-evolution.ts';
import { encodeSave, decodeSave } from '../app/game/campaign-save.ts';
const recovery = await import('../app/game/life-recovery.ts').catch(() => null);
void test('a pond recovery preserves actual source knowledge and this body but resets expendable supplies; full restart is separate', () => {
  assert.ok(recovery);
  const w = createWorld(41);
  w.mode = 'running';
  ingestPondDna(w, 'pond:dart');
  w.traits = ['flagellum'];
  w.dnaLineage!.body = 'stream';
  w.generation = 2;
  w.food = 9;
  w.mode = 'dead';
  w.player.health = 0;
  const retry = recovery.recoverLife(w, false, false);
  assert.equal(retry.generation, 2);
  assert.deepEqual(retry.dnaLineage, w.dnaLineage);
  assert.deepEqual(retry.traits, w.traits);
  assert.equal(retry.food, 0);
  assert.ok(retry.player.health > 0);
  assert.equal(
    decodeSave(encodeSave({ journey: retry, colony: null, active: 'journey' }))
      .kind,
    'ok',
  );
  const reset = recovery.recoverLife(w, false, true);
  assert.equal(reset.generation, 1);
  assert.equal(reset.dnaLineage?.sources.dart, undefined);
});
void test('ocean practice recovery uses its mature checkpoint while an explicit chapter restart starts the practice over', () => {
  assert.ok(recovery);
  const w = createOceanWorld(41, {
    seed: 41,
    generation: 4,
    time: 0,
    totalFood: 0,
    traits: [],
    history: [],
    standalone: true,
    startingForm: 'fish',
    startingBody: createOceanWorld(41).ocean!.body,
    startingDna: 0,
  });
  w.mode = 'dead';
  w.player.health = 0;
  assert.equal(recovery.recoverLife(w, true, false).form, 'fish');
  assert.equal(recovery.recoverLife(w, true, true).form, 'colony');
});
void test('a newly born land body survives failure recovery with learned sources, while chapter reset is separate', () => {
  const w = createLandWorld(41);
  w.land!.nests = [0];
  w.land!.discovered = ['fern'];
  w.food = 10;
  assert.ok(evolveLand(w, 'stalker'));
  w.land!.features = ['leap'];
  w.mode = 'dead';
  const retry = recovery!.recoverLife(w);
  assert.equal(retry.generation, w.generation);
  assert.equal(retry.form, 'stalker');
  assert.deepEqual(retry.land!.features, ['leap']);
  assert.equal(retry.land!.nests.length, 0);
  assert.equal(retry.food, 0);
  assert.equal(recovery!.recoverLife(w, false, true).generation, 1);
});
void test('a newly born shore body keeps its locomotion through failure recovery', () => {
  const w = createShoreWorld(41);
  w.shore!.discovered = ['support'];
  w.food = 8;
  assert.ok(evolveShore(w, 'skipper'));
  w.mode = 'dead';
  const retry = recovery!.recoverLife(w);
  assert.equal(retry.generation, w.generation);
  assert.equal(retry.form, 'skipper');
  assert.equal(retry.shore!.tier, 1);
  assert.equal(retry.food, 0);
});
