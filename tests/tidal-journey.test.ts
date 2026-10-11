import test from 'node:test';
import assert from 'node:assert/strict';
import { createOceanWorld } from '../app/game/ocean.ts';
import { enterShore } from '../app/game/shore.ts';
import { tidalLegacy } from '../app/game/tidal/legacy.ts';
import { encodeSave, decodeSave } from '../app/game/campaign-save.ts';
import { createCampaignSession } from '../app/game/campaign-session.ts';
import { runTidalRoute } from './helpers/tidal-route.ts';
for (const style of ['hunt', 'filter', 'reserve'] as const)
  for (const seed of [23, 71, 101])
    void test(`natural ${style} migration seed ${seed}, shore inheritance and v5 readback`, () => {
      const w = createOceanWorld(seed);
      w.mode = 'running';
      runTidalRoute(w, style);
      const body = structuredClone(w.ocean!.body),
        legacy = tidalLegacy(w);
      assert.ok(legacy?.refuge);
      assert.ok(w.history.length > 0);
      assert.ok(enterShore(w));
      assert.deepEqual(w.shore!.body, body);
      assert.deepEqual(w.tidalLegacy, legacy);
      const session = createCampaignSession();
      Object.assign(session.journey.getWorld(), w);
      const text = encodeSave(session.snapshot('journey'), 1000);
      assert.ok(text);
      const restored = decodeSave(text);
      assert.equal(restored.kind, 'ok');
      if (restored.kind === 'ok')
        assert.deepEqual(restored.save.campaign.journey.shore!.body, body);
    });
void test('real starvation restores the last safe refuge and remains playable without resource rewards', async () => {
  const { stepWorld } = await import('../app/game/simulation.ts');
  const { retryOcean } = await import('../app/game/ocean.ts');
  const w = createOceanWorld(71);
  w.mode = 'running';
  for (let i = 0; i < 16000 && w.mode === 'running'; i++)
    stepWorld(w, { x: 0, y: 0, dash: false }, 0.05);
  assert.equal(w.mode, 'dead');
  const checkpoint = w.ocean!.tidal!.safeCheckpoint!;
  assert.ok(checkpoint);
  const restored = retryOcean(w);
  assert.equal(restored.food, checkpoint.food);
  assert.equal(restored.ocean!.dna, checkpoint.ocean.dna);
  assert.equal(restored.player.energy, checkpoint.player.energy);
  runTidalRoute(restored, 'hunt');
  assert.ok(restored.tidalLegacy?.refuge);
});
