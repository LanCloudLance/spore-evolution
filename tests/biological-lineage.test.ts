import test from 'node:test';
import assert from 'node:assert/strict';
import { createOceanWorld } from '../app/game/ocean.ts';
import { createLandWorld } from '../app/game/land.ts';
import {
  createShoreWorld,
  interactShore,
  SHORE_SPECIMENS,
} from '../app/game/shore.ts';
import { stepWorld } from '../app/game/simulation.ts';
import { eatMeat } from '../app/game/land-hunt.ts';
import {
  ingestOceanDna,
  inheritedDna,
  validDnaLineage,
} from '../app/game/dna-evolution.ts';
import { learnFrom, validLearning } from '../app/game/lineage-learning.ts';
import { encodeSave, decodeSave } from '../app/game/campaign-save.ts';
import { createCampaignSession } from '../app/game/campaign-session.ts';

void test('one species keeps both hunting and symbiosis experiences, without refreshing the generation quota', () => {
  const w = createOceanWorld(23);
  assert.equal(ingestOceanDna(w, 'fanworm', 'hunt'), 2);
  assert.equal(ingestOceanDna(w, 'fanworm', 'symbiosis'), 1);
  assert.equal(ingestOceanDna(w, 'fanworm', 'hunt'), 0);
  const receipt = w.dnaLineage!.sources['sea:fanworm']!;
  assert.deepEqual(receipt.methods, { hunt: 2, symbiosis: 1 });
  w.mode = 'paused';
  const before = structuredClone(w.dnaLineage);
  assert.equal(ingestOceanDna(w, 'fanworm', 'symbiosis'), 0);
  assert.equal(ingestOceanDna(w, '__unknown__' as never, 'hunt'), 0);
  assert.deepEqual(w.dnaLineage, before);
});

void test('land DNA comes from eating a specific carcass, once, never simply from the kill (contact fixture)', () => {
  const w = createLandWorld(71);
  for (const species of ['fern', 'grazer'] as const) {
    w.land!.meat.push({
      id: w.land!.meatId++,
      ...w.player,
      species,
      life: 28,
      value: 5,
      eating: 0,
    });
    w.player.vx = w.player.vy = 0;
    eatMeat(w, 0.4, 70, 150);
    assert.equal(w.dnaLineage?.sources[`land:${species}`], undefined);
    eatMeat(w, 0.41, 70, 150);
    assert.equal(w.dnaLineage?.sources[`land:${species}`]?.units, 2);
    eatMeat(w, 1, 70, 150);
    assert.equal(w.dnaLineage!.sources[`land:${species}`]!.meals, 1);
  }
  w.mode = 'paused';
  w.land!.meat.push({
    id: 99,
    ...w.player,
    species: 'hunter',
    life: 28,
    value: 10,
    eating: 1,
  });
  const food = w.food;
  eatMeat(w, 1, 70, 150);
  assert.equal(w.food, food);
  assert.equal(w.dnaLineage!.sources['land:hunter'], undefined);
});

void test('shore observation earns a source only after sustained actual proximity; a paid companion is recorded once', () => {
  const w = createShoreWorld(71);
  Object.assign(w.player, SHORE_SPECIMENS[0]);
  w.shore!.creatures = [];
  w.foods = [];
  stepWorld(w, { x: 0, y: 0, dash: false }, 0.05);
  assert.equal(inheritedDna(w)?.sources['shore:support'], undefined);
  for (let i = 0; i < 45; i++) stepWorld(w, { x: 0, y: 0, dash: false }, 0.05);
  assert.equal(w.dnaLineage?.sources['shore:support']?.method, 'observe');
  const ally = createShoreWorld(71).shore!.creatures.find(
    (c) => c.role === 'ally',
  )!;
  Object.assign(ally, { x: w.player.x + 50, y: w.player.y });
  w.shore!.creatures = [ally];
  w.food = 2;
  assert.ok(interactShore(w));
  assert.equal(w.dnaLineage?.sources['shore:friend']?.method, 'symbiosis');
  assert.equal(interactShore(w), false);
  assert.equal(w.dnaLineage!.sources['shore:friend']!.meals, 1);
});

void test('learning preserves different sources of the same skill without minting repeated study points', () => {
  const w = createOceanWorld(23);
  assert.ok(learnFrom(w, 'pond:dart'));
  assert.ok(learnFrom(w, 'ocean:swim-observe'));
  assert.deepEqual(
    w.learning!.entries.map((e) => e.source),
    ['pond:dart', 'ocean:swim-observe'],
  );
  assert.equal(w.learning!.credits, 2);
  assert.equal(learnFrom(w, 'ocean:swim-observe'), false);
  assert.ok(validLearning(w.learning));
});

void test('new source receipts survive a real campaign save and old receipts remain valid without invented methods', () => {
  const w = createOceanWorld(23);
  ingestOceanDna(w, 'fanworm', 'symbiosis');
  ingestOceanDna(w, 'fanworm', 'hunt');
  const session = createCampaignSession();
  Object.assign(session.journey.getWorld(), w);
  const restored = decodeSave(encodeSave(session.snapshot('journey')))!;
  assert.equal(restored.kind, 'ok');
  if (restored.kind !== 'ok') return;
  assert.deepEqual(restored.save.campaign.journey.dnaLineage, w.dnaLineage);
  const old = inheritedDna(w)!;
  delete old.sources['sea:fanworm']!.methods;
  assert.ok(validDnaLineage(old));
  assert.equal(
    inheritedDna({ dnaLineage: old })!.sources['sea:fanworm']!.methods,
    undefined,
  );
  const malformed = structuredClone(w.dnaLineage!);
  malformed.sources['sea:fanworm']!.methods = { hunt: -1 };
  assert.equal(validDnaLineage(malformed), false);
  malformed.sources['sea:fanworm']!.methods = { hunt: 100 };
  assert.equal(validDnaLineage(malformed), false);
});
