import { createOceanWorld } from './helpers/legacy-ocean.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseMigration,
  stepMigration,
  MIGRATION_STATIONS,
} from '../app/game/ocean-migration.ts';
import { stepOcean } from '../app/game/ocean.ts';
import { enterShore } from '../app/game/shore.ts';
import {
  encodeSave,
  decodeSave,
  pausedCampaign,
} from '../app/game/campaign-save.ts';
import { runOcean } from './helpers/campaign-route.ts';
// Boundary fixtures isolate timer/capability/save rules. Journey tests earn the full route.
function adult() {
  const w = createOceanWorld();
  w.form = 'jelly';
  w.ocean!.tier = 2;
  w.ocean!.branch = 'radial';
  return w;
}
void test('changing route preserves earned legs but cannot grant progress; paused choices and incoherent saves are rejected', () => {
  const w = adult();
  chooseMigration(w, 'filter');
  Object.assign(w.player, MIGRATION_STATIONS[0]);
  stepMigration(w, 0.05, true);
  for (let i = 0; i < 121; i++) stepMigration(w, 0.05, false);
  assert.equal(w.ocean!.migration!.station, 1);
  assert.ok(chooseMigration(w, 'hunt'));
  assert.deepEqual(w.ocean!.migration!.legs, ['filter']);
  assert.equal(w.ocean!.migration!.progress, 0);
  w.mode = 'paused';
  const before = structuredClone(w);
  assert.equal(chooseMigration(w, 'filter'), false);
  assert.deepEqual(w, before);
  w.ocean!.migration!.arrived = true;
  assert.throws(
    () => encodeSave({ journey: w, colony: null, active: 'journey' }),
    /不能安全保存/,
  );
  assert.equal(
    decodeSave(
      JSON.stringify({
        version: 4,
        savedAt: Date.now(),
        campaign: { journey: w, colony: null, active: 'journey' },
      }),
    ).kind,
    'invalid',
  );
});
void test('migration requires mature anatomy and route actions; old food cannot finish the chapter', () => {
  const young = createOceanWorld();
  assert.equal(chooseMigration(young, 'hunt'), false);
  const w = adult();
  w.ocean!.branch = 'bilateral';
  w.form = 'fish';
  assert.equal(chooseMigration(w, 'filter'), false);
  assert.ok(chooseMigration(w, 'hunt'));
  w.food = 50;
  w.player.x = 3060;
  w.player.y = 390;
  stepOcean(w, { x: 0, y: 0, dash: false }, 0.05);
  assert.equal(w.mode, 'running');
  assert.equal(w.ocean!.migration!.station, 0);
});
void test('filtering needs unfolding, the nutrient field and low speed; pausing freezes progress', () => {
  const w = adult();
  assert.ok(chooseMigration(w, 'filter'));
  for (let i = 0; i < 200; i++) stepMigration(w, 0.05, false);
  assert.equal(w.ocean!.migration!.progress, 0);
  Object.assign(w.player, MIGRATION_STATIONS[0]);
  w.player.vx = 100;
  stepMigration(w, 0.05, true);
  assert.equal(w.ocean!.migration!.progress, 0);
  w.player.vx = 0;
  for (let i = 0; i < 40; i++) stepMigration(w, 0.05, false);
  const progress = w.ocean!.migration!.progress;
  assert.ok(progress > 1.9);
  w.mode = 'paused';
  const before = structuredClone(w);
  stepOcean(w, { x: 1, y: 1, interact: true, dash: true }, 0.05);
  stepMigration(w, 0.05, true);
  assert.deepEqual(w, before);
  w.mode = 'running';
  w.player.x += 400;
  stepMigration(w, 0.05, false);
  assert.equal(w.ocean!.migration!.progress, progress);
});
void test('mid-route saves resume paused, old ocean saves initialize safely and completed old saves stay enterable', () => {
  const w = adult();
  chooseMigration(w, 'filter');
  Object.assign(w.player, MIGRATION_STATIONS[0]);
  stepMigration(w, 0.05, true);
  const saved = decodeSave(
    encodeSave({ journey: w, colony: null, active: 'journey' }),
  );
  assert.equal(saved.kind, 'ok');
  if (saved.kind !== 'ok') return;
  const restored = pausedCampaign(saved.save.campaign).journey;
  assert.deepEqual(restored.ocean!.migration, w.ocean!.migration);
  const before = structuredClone(restored);
  stepOcean(restored, { x: 1, y: 0, dash: false }, 0.05);
  assert.deepEqual(restored, before);
  delete w.ocean!.migration;
  assert.equal(
    decodeSave(encodeSave({ journey: w, colony: null, active: 'journey' }))
      .kind,
    'ok',
  );
  stepOcean(w, { x: 0, y: 0, dash: false }, 0.05);
  assert.equal(w.ocean!.migration!.station, 0);
  delete w.ocean!.migration;
  w.mode = 'won';
  assert.ok(enterShore(w));
});
void test('earned migration leaves a real inherited milestone and both body and milestone survive saving on shore', () => {
  const w = createOceanWorld(23);
  runOcean(w, 'radial');
  const note = w.history.at(-1)!.milestone;
  assert.match(note!, /滤食/);
  const body = structuredClone(w.ocean!.body);
  assert.ok(enterShore(w));
  assert.deepEqual(w.shore!.body, body);
  assert.equal(w.history.at(-1)!.milestone, note);
  const result = decodeSave(
    encodeSave({ journey: w, colony: null, active: 'journey' }),
  );
  assert.equal(result.kind, 'ok');
  if (result.kind === 'ok')
    assert.equal(result.save.campaign.journey.history.at(-1)!.milestone, note);
});
