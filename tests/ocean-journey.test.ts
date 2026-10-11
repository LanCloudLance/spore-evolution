import { createOceanWorld } from './helpers/legacy-ocean.ts';
import test from 'node:test';
import assert from 'node:assert/strict';

import { runOcean } from './helpers/campaign-route.ts';
for (const branch of ['radial', 'bilateral'] as const) {
  void test(`the ${branch} branch explores, transforms and completes migration through real movement`, () => {
    const w = createOceanWorld(23);
    runOcean(w, branch);
    assert.equal(w.history.length, 3);
    assert.equal(w.form, branch === 'radial' ? 'jelly' : 'fish');
    assert.equal(w.ocean!.migration!.arrived, true);
    assert.deepEqual(w.ocean!.migration!.legs, [
      branch === 'radial' ? 'filter' : 'hunt',
      branch === 'radial' ? 'filter' : 'hunt',
    ]);
    assert.ok(w.history.at(-1)?.milestone);
    assert.ok(w.time < 600);
  });
}
