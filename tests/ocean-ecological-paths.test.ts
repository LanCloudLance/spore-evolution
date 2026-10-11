import test from 'node:test';
import assert from 'node:assert/strict';
import { createOceanWorld } from '../app/game/ocean.ts';
import { TIDAL_BIOMES, TIDAL_SPECIES } from '../app/game/tidal/catalog.ts';
import {
  catchTidalActor,
  stepTidalEcology,
} from '../app/game/tidal/ecology.ts';
import { tidalExitGate } from '../app/game/tidal/migration.ts';
import { organAnchor, listOrgans } from '../app/game/body-layout.ts';
import { worldBodyPose } from '../app/game/body-geometry.ts';
import { encodeSave, decodeSave } from '../app/game/campaign-save.ts';
import { ensureTidalWorld } from '../app/game/tidal/step.ts';
import { shareTidalNutrition } from '../app/game/tidal/ecology.ts';
import { tidalWake } from '../app/game/tidal/ecology.ts';
import { commitOceanDna } from '../app/game/ocean-dna.ts';

void test('six connected biomes support eighteen living species and bounded food/actor pools', () => {
  assert.equal(TIDAL_BIOMES.length, 6);
  assert.equal(TIDAL_SPECIES.length, 18);
  const w = createOceanWorld(23),
    t = w.ocean!.tidal!;
  assert.equal(new Set(t.actors.map((a) => a.species)).size, 18);
  assert.ok(t.actors.length <= 48);
  assert.ok(t.foods.length <= 144);
  assert.equal(
    decodeSave(encodeSave({ journey: w, colony: null, active: 'journey' }))
      .kind,
    'ok',
  );
});
void test('a complete eighteen-species field journal remains saveable; duplicates still reject (journal fixture)', () => {
  const w = createOceanWorld(23), t = w.ocean!.tidal!;
  t.journal.seen = TIDAL_SPECIES.map(s => s.id);
  assert.equal(decodeSave(encodeSave({journey:w, colony:null, active:'journey'})).kind, 'ok');
  t.journal.seen.push(t.journal.seen[0]);
  assert.throws(() => encodeSave({journey:w, colony:null, active:'journey'}), 'duplicate entries still reject');
});

void test('hunting, filtering and partnership can each reach the estuary through their own ecological corridor (gate fixture)', () => {
  for (const [way, visits] of [
    ['hunt', ['reef', 'vent']],
    ['filter', ['drift', 'kelp']],
    ['reserve', ['kelp', 'reef']],
  ] as const) {
    const w = createOceanWorld(23),
      t = w.ocean!.tidal!;
    w.form = 'fish';
    w.ocean!.tier = 2;
    w.ocean!.branch = 'bilateral';
    w.food = 4;
    Object.assign(w.player, TIDAL_BIOMES[3]);
    t.tick = 90 * 120;
    t.migration.startedTick = 1;
    t.migration.visited = [...visits];
    t.migration.gains[way] = 1;
    assert.equal(tidalExitGate(w), null, `${way} has a complete corridor`);
    t.migration.visited = [visits[0]];
    assert.notEqual(tidalExitGate(w), null, 'one ecosystem is insufficient');
  }
});

void test('an actual catch leaves lasting, recoverable ecological pressure through saving and birth; paused ecology freezes it (mouth fixture)', () => {
  const w = createOceanWorld(23),
    t = w.ocean!.tidal!;
  const prey = t.actors.find((a) => a.species === 'silver-dart')!;
  const mouth = organAnchor(
    worldBodyPose(w),
    listOrgans(w.ocean!.body).find((p) => p.organ === 'jaw')!,
  );
  Object.assign(prey, mouth);
  assert.ok(catchTidalActor(w, prey.id) > 0);
  assert.ok(t.regions.nursery.harvestPressure! > 0);
  const pressure = t.regions.nursery.harvestPressure!;
  assert.ok(commitOceanDna(w, 'silverflow'));
  assert.equal(w.ocean!.tidal!.regions.nursery.harvestPressure, pressure);
  w.ocean!.morph = null;
  const saved = decodeSave(
    encodeSave({ journey: w, colony: null, active: 'journey' }),
  );
  assert.equal(saved.kind, 'ok');
  if (saved.kind !== 'ok') return;
  const restored = saved.save.campaign.journey;
  assert.equal(
    restored.ocean!.tidal!.regions.nursery.harvestPressure,
    pressure,
  );
  restored.mode = 'paused';
  for (let i = 0; i < 120; i++) stepTidalEcology(restored, 0.05);
  assert.equal(
    restored.ocean!.tidal!.regions.nursery.harvestPressure,
    pressure,
  );
  restored.mode = 'running';
  for (let i = 0; i < 120; i++) stepTidalEcology(restored, 0.05);
  assert.ok(restored.ocean!.tidal!.regions.nursery.harvestPressure! < pressure);
});

void test('a fed kelp companion enables a paid symbiosis supply and actually buffers current (interaction fixture)', () => {
  const w = createOceanWorld(23),
    t = w.ocean!.tidal!;
  const partner = t.actors.find((a) => a.species === 'pipe-seahorse')!;
  Object.assign(partner, { x: w.player.x + 92, y: w.player.y });
  t.actors = [partner];
  w.food = 1;
  t.tick = 100;
  t.migration.startedTick = 1;
  assert.ok(shareTidalNutrition(w));
  const gift = t.foods.find((f) => f.reservedFor === partner.id)!;
  for (let i = 0; i < 360 && gift.state !== 'consumed'; i++)
    stepTidalEcology(w, 1 / 120);
  assert.equal(gift.state, 'consumed');
  assert.equal(t.migration.gains.symbiosis, 1);
  assert.equal(w.food, 0, 'sharing does not grant food back to the donor');
  assert.equal(partner.trust, 20);
  assert.deepEqual(tidalWake(w, { x: 100, y: 50 }), { x: 60, y: 30 });
});

void test('old four-region saves resume with new habitats without moving the player or inventing source DNA', () => {
  const w = createOceanWorld(23);
  const t = w.ocean!.tidal!;
  t.actors = t.actors.filter((a) => !['kelp', 'vent'].includes(a.homeBiome));
  t.foods = t.foods.filter((f) => !['kelp', 'vent'].includes(f.biome));
  delete (t.regions as Partial<typeof t.regions>).kelp;
  delete (t.regions as Partial<typeof t.regions>).vent;
  const raw = encodeSave({ journey: w, colony: null, active: 'journey' });
  const result = decodeSave(raw);
  assert.equal(result.kind, 'ok');
  if (result.kind !== 'ok') return;
  const old = result.save.campaign.journey,
    player = structuredClone(old.player);
  ensureTidalWorld(old);
  assert.ok(old.ocean!.tidal!.regions.kelp);
  assert.deepEqual(old.player, player);
  assert.equal(old.dnaLineage, undefined);
});
