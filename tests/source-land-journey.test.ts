import test from 'node:test';
import assert from 'node:assert/strict';
import { createLandWorld } from '../app/game/land.ts';
import { runSourceLand } from './helpers/source-land-route.ts';
import { colonyFromLand } from '../app/game/colony.ts';
for (const way of ['hunt', 'garden', 'companions'] as const)
  void test(`${way} earns its DNA body and new structures by normal input, settles and enters colony`, () => {
    const w = runSourceLand(createLandWorld(23), way),
      s = colonyFromLand(w)!;
    assert.ok(s);
    assert.deepEqual(s.dnaLineage, w.dnaLineage);
    assert.ok(w.history.some((a) => a.landFeatures?.length));
  });
