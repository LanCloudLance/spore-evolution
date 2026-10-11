import test from 'node:test';
import assert from 'node:assert/strict';
import { createShoreWorld } from '../app/game/shore.ts';
import { runSourceShore } from './helpers/source-shore-route.ts';
import { enterLand } from '../app/game/land.ts';
import { encodeSave, decodeSave } from '../app/game/campaign-save.ts';
for (const route of ['shelter', 'cycles', 'remote'] as const)
  void test(`${route} shore route earns different preservation through normal input and enters land`, () => {
    const w = runSourceShore(createShoreWorld(23), route);
    if (route === 'shelter') assert.ok(w.dnaLineage?.sources['shore:shade']);
    if (route === 'cycles') assert.ok(w.shore!.fieldNotes!.safeReturns >= 2);
    if (route === 'remote') assert.ok(w.shore!.visited.includes('蕨影潮池'));
    const before = structuredClone(w.dnaLineage);
    assert.ok(enterLand(w));
    assert.deepEqual(w.dnaLineage, before);
    assert.equal(
      decodeSave(encodeSave({ journey: w, colony: null, active: 'journey' }))
        .kind,
      'ok',
    );
  });
