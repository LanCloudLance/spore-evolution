import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../app/game/simulation.ts';
import { enterOcean } from '../app/game/ocean.ts';
import { enterShore } from '../app/game/shore.ts';
import { enterLand } from '../app/game/land.ts';
import { colonyFromLand } from '../app/game/colony.ts';
import {
  biologicalRecord,
  branchBiological,
} from '../app/game/biological-finale.ts';
import { encodeSave, decodeSave } from '../app/game/campaign-save.ts';
import { runSourcePond } from './helpers/source-pond-route.ts';
import { runSourceOcean } from './helpers/source-ocean-route.ts';
import { runSourceShore } from './helpers/source-shore-route.ts';
import { runSourceLand } from './helpers/source-land-route.ts';
import { runColony } from './helpers/campaign-route.ts';
for (const way of ['hunt', 'garden', 'companions'] as const)
  void test(`${way}: one continuous source-driven biological journey reaches a cared-for lineage, archive and resource-free fork`, () => {
    const w = createWorld(23);
    w.mode = 'running';
    runSourcePond(w, way);
    const pond = structuredClone(w.dnaLineage);
    assert.ok(enterOcean(w));
    runSourceOcean(
      w,
      way === 'hunt'
        ? 'silverflow'
        : way === 'garden'
          ? 'fancrest'
          : 'shellrunner',
    );
    assert.ok(enterShore(w));
    runSourceShore(
      w,
      way === 'hunt' ? 'remote' : way === 'garden' ? 'cycles' : 'shelter',
    );
    assert.ok(enterLand(w));
    runSourceLand(w, way);
    const s = colonyFromLand(w)!;
    s.mode = 'running';
    runColony(s);
    const record = biologicalRecord(s, 1)!;
    assert.ok(record);
    assert.deepEqual(
      [...new Set(record.history.map((a) => a.habitat))],
      ['pond', 'ocean', 'shore', 'land'],
    );
    assert.ok(record.descendants.some((m) => m.newborn && m.features?.length));
    for (const [id, r] of Object.entries(pond!.sources))
      assert.ok(
        record.dnaLineage!.sources[
          id as keyof NonNullable<typeof pond>['sources']
        ]!.units >= r!.units,
      );
    assert.equal(
      decodeSave(
        encodeSave({
          journey: w,
          colony: { checkpoint: s, current: s },
          active: 'colony',
          biologicalRecords: [record],
        }),
      ).kind,
      'ok',
    );
    const branch = branchBiological(record, record.history[0].generation, 71)!;
    assert.equal(branch.habitat, 'pond');
    assert.equal(branch.food, 0);
    assert.equal(branch.mode, 'paused');
    assert.equal(branch.dnaLineage?.sources['land:garden'], undefined);
    console.info(
      JSON.stringify({
        route: way,
        simulationSeconds: {
          journey: +w.time.toFixed(1),
          colony: +s.time.toFixed(1),
        },
        generation: w.generation,
        sources: Object.keys(record.dnaLineage?.sources ?? {}).length,
        features: record.features,
      }),
    );
  });
