import test from 'node:test';
import assert from 'node:assert/strict';
import { tidalFixture } from './helpers/tidal-world.ts';
import { stepTidalEcology } from '../app/game/tidal/ecology.ts';
import { observeTidalSignals } from '../app/game/tidal/discovery.ts';
import type { TidalActor, TidalFood } from '../app/game/tidal/types.ts';
const fan: TidalActor = {
  id: 'fan',
  species: 'fanworm',
  homeBiome: 'drift',
  x: 625,
  y: 1770,
  radius: 18,
  angle: 0,
  hunger: 80,
  health: 100,
  behavior: 'forage',
  targetId: null,
  phaseSeconds: 0,
  respawnSeconds: 0,
  trust: 0,
  carryingId: null,
};
const food: TidalFood = {
  id: 'particle',
  kind: 'plankton',
  x: 625,
  y: 1770,
  energy: 8,
  biome: 'nursery',
  owner: null,
  state: 'available',
  regrowSeconds: 0,
};
void test('seeing a real filter meal unlocks once; cloned raw events and replay after save do not grant prizes', () => {
  const w = tidalFixture();
  w.ocean!.tidal!.actors = [structuredClone(fan)];
  w.ocean!.tidal!.foods = [structuredClone(food)];
  const signals = stepTidalEcology(w, 0.05),
    dna = w.ocean!.dna;
  assert.ok(
    signals.some((s) => s.kind === 'filter'),
    'the witness sees an actual meal',
  );
  observeTidalSignals(w, structuredClone(signals));
  assert.equal(w.ocean!.dna, dna, 'raw UI data has no award authority');
  assert.equal('sea:fanworm' in (w.dnaLineage?.sources ?? {}), false);
  observeTidalSignals(w, signals);
  assert.equal(w.ocean!.dna, dna + 16);
  assert.ok(w.ocean!.discovered.includes('filter'));
  assert.equal(w.dnaLineage?.sources['sea:fanworm']?.methods?.observe, 1);
  const once = structuredClone(w);
  observeTidalSignals(w, signals);
  assert.deepEqual(w, once);
  const reloaded = structuredClone(w);
  observeTidalSignals(reloaded, signals);
  assert.equal(reloaded.ocean!.dna, dna + 16);
});
void test('distance and rock sight lines gate actual observation, not time spent close to a static specimen', () => {
  for (const [playerX, playerY, actorX, actorY] of [
    [460, 1770, 700, 1770],
    [2140, 1318, 2320, 1318],
  ]) {
    const w = tidalFixture();
    w.player.x = playerX;
    w.player.y = playerY;
    w.ocean!.tidal!.actors = [{ ...fan, x: actorX, y: actorY }];
    w.ocean!.tidal!.foods = [{ ...food, x: actorX, y: actorY }];
    const dna = w.ocean!.dna,
      signals = stepTidalEcology(w, 0.05);
    assert.ok(signals.some((s) => s.kind === 'filter'));
    observeTidalSignals(w, signals);
    assert.equal(w.ocean!.dna, dna);
  }
  const w = tidalFixture();
  w.player.x = 1290;
  w.player.y = 600;
  const dna = w.ocean!.dna;
  for (let i = 0; i < 360; i++) observeTidalSignals(w, []);
  assert.equal(w.ocean!.dna, dna);
  assert.deepEqual(w.ocean!.tidal!.journal.claimed, []);
});
void test('inherited discovery is retained without a second reward; pause never observes or awards', () => {
  const w = tidalFixture();
  w.ocean!.discovered.push('filter');
  w.ocean!.tidal!.actors = [structuredClone(fan)];
  w.ocean!.tidal!.foods = [structuredClone(food)];
  const signals = stepTidalEcology(w, 0.05),
    dna = w.ocean!.dna;
  w.mode = 'paused';
  const frozen = structuredClone(w);
  observeTidalSignals(w, signals);
  assert.deepEqual(w, frozen);
  w.mode = 'running';
  observeTidalSignals(w, signals);
  assert.equal(w.ocean!.dna, dna);
  assert.ok(w.ocean!.tidal!.journal.claimed.includes('filter'));
});
