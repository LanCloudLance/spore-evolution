import test from 'node:test';
import assert from 'node:assert/strict';
import { createLandWorld } from '../app/game/land.ts';
import { runSourceLand } from './helpers/source-land-route.ts';
import { colonyFromLand } from '../app/game/colony.ts';
import { runColony } from './helpers/campaign-route.ts';
import { createCampaignSession } from '../app/game/campaign-session.ts';
import { encodeSave, decodeSave } from '../app/game/campaign-save.ts';
const finale = await import('../app/game/biological-finale.ts').catch(
  () => null,
);
void test('only a cared-for child surviving real weather completes the biological archive', () => {
  assert.ok(finale);
  const w = runSourceLand(createLandWorld(23), 'companions'),
    s = colonyFromLand(w)!;
  assert.equal(finale.biologicalRecord(s, 1), null);
  s.mode = 'running';
  runColony(s);
  const record = finale.biologicalRecord(s, 1);
  assert.ok(record);
  assert.ok(record.history.length >= 3);
  assert.ok(record.descendants.some((m) => m.newborn));
  assert.deepEqual(record.features, w.land!.features);
  const before = structuredClone(record);
  s.dnaLineage!.sources['land:fern']!.units++;
  assert.deepEqual(record, before);
});
void test('a saved ancestor branch starts with no copied nutrition, pressure, homes, gifts or later-source receipts; tech remains reachable', () => {
  assert.ok(finale);
  const w = runSourceLand(createLandWorld(23), 'garden'),
    s = colonyFromLand(w)!;
  s.mode = 'running';
  runColony(s);
  const record = finale.biologicalRecord(s, 1)!;
  const ancestor = record.history[0],
    branch = finale.branchBiological(record, ancestor.generation, 77);
  assert.ok(branch);
  assert.equal(branch.food, 0);
  assert.equal(branch.totalFood, 0);
  assert.equal(branch.land?.biomass, 0);
  assert.deepEqual(branch.dnaLineage, ancestor.dnaLineage);
  assert.equal(branch.dnaLineage?.sources['land:garden'], undefined);
  assert.equal(branch.land?.nests.length, 0);
  assert.equal(branch.land?.cachedFood ?? 0, 0);
  assert.equal(finale.branchBiological(record, 999, 77), null);
  const session = createCampaignSession();
  Object.assign(session.journey.getWorld(), w);
  session.startColony(s);
  assert.ok(session.finishBiological());
  assert.equal(session.finishBiological(), false);
  session.updateColony(s);
  assert.equal(
    session.finishBiological(),
    false,
    'an older UI snapshot must not duplicate the same completed cohort',
  );
  assert.ok(session.startTribe());
  const save = decodeSave(encodeSave(session.snapshot('colony')));
  assert.equal(save.kind, 'ok');
  const restored = createCampaignSession();
  if (save.kind === 'ok') restored.restore(save.save.campaign);
  assert.equal(restored.getBiologicalRecords().length, 1);
  assert.ok(restored.branchBiological(1, ancestor.generation, 77));
  assert.equal(restored.getColony(), null);
  assert.equal(restored.getBiologicalRecords().length, 1);
});
