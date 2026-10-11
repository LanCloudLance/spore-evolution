import test from 'node:test';
import assert from 'node:assert/strict';
import { createOceanWorld } from '../app/game/ocean.ts';
import { enterShore } from '../app/game/shore.ts';
import { encodeSave, decodeSave } from '../app/game/campaign-save.ts';
const route = await import('./helpers/source-ocean-route.ts').catch(() => null);

for (const id of ['silverflow', 'fancrest', 'shellrunner'] as const)
  void test(`source-earned ${id} births, different marine corridor, shore inheritance and save through normal inputs`, () => {
    assert.ok(route, 'the new biology must be playable through normal inputs');
    const w = createOceanWorld(23);
    route.runSourceOcean(w, id);
    assert.equal(w.mode, 'won');
    assert.equal(w.dnaLineage!.oceanBody, id);
    const t = w.ocean!.tidal!;
    const expected =
      id === 'silverflow'
        ? ['reef', 'vent']
        : id === 'fancrest'
          ? ['drift', 'kelp']
          : ['kelp', 'reef'];
    assert.ok(
      expected.every((region) => t.migration.visited.includes(region as never)),
    );
    assert.ok(w.history.some((a) => a.form === 'colony'));
    assert.ok(enterShore(w));
    assert.equal(w.dnaLineage!.oceanBody, id);
    assert.equal(
      decodeSave(encodeSave({ journey: w, colony: null, active: 'journey' }))
        .kind,
      'ok',
    );
  });
