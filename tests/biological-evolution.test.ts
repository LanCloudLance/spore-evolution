import test from 'node:test';
import assert from 'node:assert/strict';
import { createOceanWorld } from '../app/game/ocean.ts';
import { createShoreWorld, SHORE_POOLS } from '../app/game/shore.ts';
import { createLandWorld, LAND_NESTS } from '../app/game/land.ts';
import {
  ingestOceanDna,
  ingestBiologicalDna,
} from '../app/game/dna-evolution.ts';
import { commitOceanDna } from '../app/game/ocean-dna.ts';
import { hasOrgan } from '../app/game/body-layout.ts';
const biology = await import('../app/game/biological-evolution.ts').catch(
  () => null,
);

void test('source-based ocean births mature the corresponding branch while recording the unchanged parent first', () => {
  for (const [source, id, first, mature] of [
    ['silver-dart', 'silverflow', 'bilateral', 'fish'],
    ['fanworm', 'fancrest', 'radial', 'jelly'],
  ] as const) {
    const w = createOceanWorld(23);
    ingestOceanDna(w, source, 'hunt');
    const parent = structuredClone(w.ocean!.body);
    assert.ok(commitOceanDna(w, id));
    assert.equal(w.form, first);
    assert.equal(w.ocean!.tier, 1);
    assert.deepEqual(w.history[0].body, parent);
    assert.equal(w.history[0].form, 'colony');
    w.ocean!.morph = null;
    w.evolution = null;
    assert.ok(commitOceanDna(w, id));
    assert.equal(w.form, mature);
    assert.equal(w.ocean!.tier, 2);
    assert.equal(w.generation, 3);
    assert.equal(w.history[1].form, first);
    assert.ok(hasOrgan(w.ocean!.body, id === 'fancrest' ? 'filter' : 'fin'));
  }
});

void test('the next-generation gateway exposes source tradeoffs and rejects wrong stage or remote births atomically', () => {
  assert.ok(biology, 'one gateway serves all biological stages');
  const shore = createShoreWorld(71);
  const candidates = biology.nextGenerationCandidates(shore);
  assert.ok(candidates.some((c) => c.id === 'shore:skipper' && !c.available));
  ingestBiologicalDna(shore, 'shore:support', 'observe');
  shore.shore!.discovered.push('support');
  shore.food = 8;
  Object.assign(shore.player, SHORE_POOLS[0]);
  assert.ok(biology.commitBiologicalEvolution(shore, 'shore:crawler'));
  assert.equal(shore.form, 'crawler');
  assert.equal(shore.history.at(-1)!.form, 'fish');
  const before = structuredClone(shore);
  assert.equal(biology.commitBiologicalEvolution(shore, 'land:stalker'), false);
  assert.deepEqual(shore, before);

  const land = createLandWorld(71);
  land.land!.nests = [0];
  land.land!.discovered = ['fern'];
  land.food = 10;
  Object.assign(land.player, LAND_NESTS[0]);
  ingestBiologicalDna(land, 'land:fern', 'observe');
  assert.ok(
    biology.nextGenerationCandidates(land).find((c) => c.id === 'land:strider')!
      .available,
  );
  assert.equal(
    biology.nextGenerationCandidates(land).find((c) => c.id === 'land:stalker')!
      .available,
    false,
  );
  ingestBiologicalDna(land, 'land:fern', 'hunt');
  assert.ok(
    biology.nextGenerationCandidates(land).find((c) => c.id === 'land:stalker')!
      .available,
  );
  land.player.x = 0;
  const remote = structuredClone(land);
  assert.equal(biology.commitBiologicalEvolution(land, 'land:stalker'), false);
  assert.deepEqual(land, remote);
  Object.assign(land.player, LAND_NESTS[0]);
  assert.ok(biology.commitBiologicalEvolution(land, 'land:stalker'));
  assert.equal(land.form, 'stalker');
  assert.equal(land.food, 0);
});
